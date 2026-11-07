import { parseISODate } from "@/lib/dates";
import { toSentenceCase } from "@/lib/text";

export function toMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function isValidMonthKey(value) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function addMonths(monthKey, offset) {
  const [y, m] = monthKey.split("-").map(Number);
  return toMonthKey(new Date(y, m - 1 + offset, 1));
}

export function monthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

export function getDaysSinceToday(dateStr, today = new Date()) {
  const date = parseISODate(dateStr);
  if (!date) return Infinity;
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);
  // round, nao floor: a diferenca nao e multiplo exato de 24h nos dias de troca de horario de verao
  return Math.round((base - date) / (1000 * 60 * 60 * 24));
}

export function splitInstallments(totalCents, count) {
  // floor com o resto nas primeiras parcelas: com ceil a ultima parcela ficava negativa
  // em valores pequenos (1 centavo em 12x dava -10 na ultima)
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

export const PERIODS = ["Hoje", "Ontem", "Esta semana", "Anteriores"];

export function getPeriodLabel(dateStr, today = new Date()) {
  const days = getDaysSinceToday(dateStr, today);
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days >= 0 && days <= 7) return "Esta semana";
  return "Anteriores";
}

export const FILTERS = [
  { value: "hoje", label: "Hoje", maxDays: 0 },
  { value: "semana", label: "7 dias", maxDays: 7 },
  { value: "mes", label: "30 dias", maxDays: 30 },
  { value: "todos", label: "Todos", maxDays: null },
];

export function filterExpenses(expenses, filter, today = new Date()) {
  const option = FILTERS.find((f) => f.value === filter);
  if (!option || option.maxDays === null) return expenses;
  return expenses.filter((e) => {
    const days = getDaysSinceToday(e.date, today);
    return days >= 0 && days <= option.maxDays;
  });
}

// Agrupa por periodo e soma lancamentos iguais (mesma descricao, categoria e dia).
// Cada grupo guarda os registros originais: editar e excluir agem neles, nunca na soma.
export function groupExpenses(expenses, today = new Date()) {
  const grouped = {};
  for (const e of expenses) {
    const period = getPeriodLabel(e.date, today);
    grouped[period] ||= {};
    const key = `${e.description}|${e.category}|${e.date}`;
    if (!grouped[period][key]) {
      grouped[period][key] = { ...e, key, count: 1, items: [e] };
    } else {
      const g = grouped[period][key];
      g.amount_cents += e.amount_cents;
      g.count += 1;
      g.items.push(e);
    }
  }
  return PERIODS.filter((p) => grouped[p]).map((p) => ({ period: p, items: Object.values(grouped[p]) }));
}

// Monta os registros de um novo gasto. Credito vira uma linha por parcela, com a
// primeira parcela vencendo no mes seguinte ao da compra (regra original do app).
export function buildExpenseEntries({ monthKey, category, description, amountCents, paymentMethod, installments, isPaid, paidDate, date }) {
  const base = { month_key: monthKey, category, date };
  const desc = toSentenceCase(description);

  if (category === "fixos") {
    return [{
      ...base,
      description: desc,
      amount_cents: amountCents,
      payment_method: "fixed",
      installments: 1,
      installment_number: 1,
      installment_month: monthKey,
      is_paid: true,
      paid_date: null,
    }];
  }

  if (paymentMethod === "credit") {
    const count = Number(installments) || 1;
    return splitInstallments(amountCents, count).map((cents, i) => ({
      ...base,
      description: count > 1 ? `${desc} (${i + 1}/${count})` : desc,
      amount_cents: cents,
      payment_method: "credit",
      installments: count,
      installment_number: i + 1,
      installment_month: addMonths(monthKey, i + 1),
      is_paid: false,
      paid_date: null,
    }));
  }

  return [{
    ...base,
    description: desc,
    amount_cents: amountCents,
    payment_method: paymentMethod,
    installments: 1,
    installment_number: 1,
    installment_month: monthKey,
    is_paid: Boolean(isPaid),
    paid_date: isPaid ? paidDate : null,
  }];
}

export function totalsByCategory(expenses) {
  return expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount_cents;
    return acc;
  }, {});
}
