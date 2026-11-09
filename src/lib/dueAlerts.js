import { addMonths, isValidMonthKey, toMonthKey } from "@/lib/expenses";
import { formatBRLFromCents, sumCents } from "@/lib/money";

// A contagem vai ate as 20h do dia do vencimento: 12 horas antes caem as 8h do proprio
// dia e 1 dia antes as 20h da vespera, horarios em que da para ler o aviso e pagar.
export const DUE_HOUR = 20;

export const ALERT_LEADS = [
  { value: "7d", label: "7 dias", hours: 168, title: "Faltam 7 dias para pagar" },
  { value: "3d", label: "3 dias", hours: 72, title: "Faltam 3 dias para pagar" },
  { value: "1d", label: "1 dia", hours: 24, title: "Falta 1 dia para pagar" },
  { value: "12h", label: "12 horas", hours: 12, title: "Faltam 12 horas para pagar" },
  { value: "1h", label: "1 hora", hours: 1, title: "Falta 1 hora para pagar" },
];

export const DEFAULT_ALERT_SETTINGS = { enabled: false, card_due_day: null, leads: ["3d", "1d", "12h"] };

// O iOS guarda no maximo 64 notificacoes pendentes por app e descarta o resto sem avisar.
// A cada abertura do app a lista e refeita, entao os vencimentos mais distantes entram depois.
export const MAX_SCHEDULED = 60;

const FIXED_MONTHS_AHEAD = 12;

export function isValidDueDay(text) {
  const value = String(text ?? "").trim();
  if (value === "") return true;
  return /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 31;
}

export function toDueDay(text) {
  const value = String(text ?? "").trim();
  return value === "" ? null : Number(value);
}

// Dia 31 em mes mais curto vence no ultimo dia do mes
function dueDateKey(monthKey, day) {
  const [y, m] = monthKey.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${monthKey}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function dueDatesOf(expense, cardDueDay, now) {
  if (expense.payment_method === "fixed") {
    if (!expense.due_day) return [];
    // Fixo e um registro so, que vale para todos os meses a partir de quando foi criado
    const current = toMonthKey(now);
    const first = expense.month_key > current ? expense.month_key : current;
    return Array.from({ length: FIXED_MONTHS_AHEAD }, (_, i) => dueDateKey(addMonths(first, i), expense.due_day));
  }
  if (expense.is_paid || !isValidMonthKey(expense.installment_month)) return [];
  const day = expense.due_day || (expense.payment_method === "credit" ? cardDueDay : null);
  return day ? [dueDateKey(expense.installment_month, day)] : [];
}

function alertBody(items, dueKey) {
  const [, month, day] = dueKey.split("-");
  const due = `vence em ${day}/${month}`;
  const total = formatBRLFromCents(sumCents(items));
  if (items.length === 1) return `${items[0].description}: ${total}, ${due}.`;
  const names = items.slice(0, 2).map((item) => item.description).join(", ");
  const others = items.length - 2;
  return `${items.length} contas somam ${total}, ${due}: ${names}${others > 0 ? ` e mais ${others}` : ""}.`;
}

// Devolve as notificacoes a agendar, das mais proximas para as mais distantes. Contas com
// o mesmo vencimento viram um aviso so: a fatura do cartao seria um aviso por parcela.
export function buildAlertSchedule(expenses, settings, now = new Date()) {
  const { enabled, card_due_day: cardDueDay, leads } = { ...DEFAULT_ALERT_SETTINGS, ...settings };
  if (!enabled) return [];

  const itemsByDue = new Map();
  for (const expense of expenses) {
    for (const dueKey of dueDatesOf(expense, cardDueDay, now)) {
      if (!itemsByDue.has(dueKey)) itemsByDue.set(dueKey, []);
      itemsByDue.get(dueKey).push(expense);
    }
  }

  const chosen = ALERT_LEADS.filter((lead) => leads.includes(lead.value));
  const alerts = [];
  for (const [dueKey, items] of itemsByDue) {
    const [y, m, d] = dueKey.split("-").map(Number);
    const body = alertBody(items, dueKey);
    for (const lead of chosen) {
      // Horas negativas o Date normaliza para os dias anteriores, sempre no horario local
      const fireAt = new Date(y, m - 1, d, DUE_HOUR - lead.hours).getTime();
      if (fireAt > now.getTime()) alerts.push({ id: `${dueKey}-${lead.value}`, fireAt, title: lead.title, body });
    }
  }
  return alerts.sort((a, b) => a.fireAt - b.fireAt).slice(0, MAX_SCHEDULED);
}

// Parcelas futuras que nao tem como avisar porque falta o dia do cartao
export function countUndatedInstallments(expenses, settings, now = new Date()) {
  if (settings?.card_due_day) return 0;
  const current = toMonthKey(now);
  return expenses.filter(
    (e) => e.payment_method === "credit" && !e.is_paid && !e.due_day && e.installment_month >= current
  ).length;
}
