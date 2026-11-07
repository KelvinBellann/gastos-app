// Banco local do app: as tabelas que o app usava antes (incomes, expenses,
// variable_incomes, receipts, receipt_items) e as da aba Plano (plan_settings,
// plan_months, plan_contributions), gravadas como JSON no localStorage do
// navegador. Nao ha servidor nem conta: os dados ficam no aparelho e no navegador
// onde foram criados, por isso o app oferece exportar e importar um backup em JSON.
//
// As funcoes sao assincronas de proposito: os componentes carregam dados dentro de
// useEffect, e a troca futura por IndexedDB nao muda a assinatura.

const STORAGE_KEY = "gastos-app:db:v1";
const BACKUP_FORMAT = "gastos-app-backup";
const BACKUP_VERSION = 1;

export const TABLES = [
  "incomes",
  "expenses",
  "variable_incomes",
  "receipts",
  "receipt_items",
  "plan_settings",
  "plan_months",
  "plan_contributions",
];

const INCOME_FIELDS = ["salary_net_cents", "multibenefits_cents", "food_cents", "spouse_salary_cents"];

function emptyDb() {
  return Object.fromEntries(TABLES.map((t) => [t, []]));
}

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    throw new Error("Armazenamento local indisponível neste navegador.");
  }
  return window.localStorage;
}

function readDb() {
  const raw = getStorage().getItem(STORAGE_KEY);
  if (!raw) return emptyDb();
  try {
    const parsed = JSON.parse(raw);
    const db = emptyDb();
    for (const table of TABLES) {
      if (Array.isArray(parsed?.[table])) db[table] = parsed[table];
    }
    return db;
  } catch {
    // JSON corrompido: nao sobrescreve, para o usuario conseguir recuperar pelo DevTools
    throw new Error("Os dados locais estão corrompidos. Importe um backup para continuar.");
  }
}

function writeDb(db) {
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    if (err?.name === "QuotaExceededError") {
      throw new Error("Espaço local cheio. Exporte um backup e apague recibos antigos.");
    }
    throw err;
  }
}

// crypto.randomUUID so existe em contexto seguro (https ou localhost). Abrindo o app
// pelo IP da rede local no celular (http://192.168...), ele e undefined.
function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowISO() {
  return new Date().toISOString();
}

function withMeta(row) {
  const ts = nowISO();
  return { id: newId(), created_at: ts, updated_at: ts, ...row };
}

function byKey(key, direction = "asc") {
  const sign = direction === "asc" ? 1 : -1;
  return (a, b) => {
    const va = a[key] ?? "";
    const vb = b[key] ?? "";
    if (va < vb) return -1 * sign;
    if (va > vb) return 1 * sign;
    return 0;
  };
}

// ---------- Receitas fixas ----------

export async function getOrCreateIncome(monthKey) {
  const db = readDb();
  const found = db.incomes.find((i) => i.month_key === monthKey);
  if (found) return found;
  const row = withMeta({
    month_key: monthKey,
    ...Object.fromEntries(INCOME_FIELDS.map((f) => [f, 0])),
  });
  db.incomes.push(row);
  writeDb(db);
  return row;
}

export async function updateIncome(id, patch) {
  const db = readDb();
  const idx = db.incomes.findIndex((i) => i.id === id);
  if (idx === -1) throw new Error("Receita não encontrada.");
  db.incomes[idx] = { ...db.incomes[idx], ...patch, updated_at: nowISO() };
  writeDb(db);
  return db.incomes[idx];
}

// ---------- Gastos ----------

// Mesmo filtro da query antiga: gastos do mes, parcelas que vencem no mes e gastos
// fixos (aparecem em todos os meses).
export async function listExpensesForMonth(monthKey) {
  const db = readDb();
  return db.expenses
    .filter((e) => e.month_key === monthKey || e.installment_month === monthKey || e.category === "fixos")
    .sort(byKey("created_at", "desc"));
}

export async function insertExpenses(rows) {
  const db = readDb();
  const inserted = rows.map(withMeta);
  db.expenses.push(...inserted);
  writeDb(db);
  return inserted;
}

export async function updateExpense(id, patch) {
  const db = readDb();
  const idx = db.expenses.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error("Gasto não encontrado.");
  db.expenses[idx] = { ...db.expenses[idx], ...patch, updated_at: nowISO() };
  writeDb(db);
  return db.expenses[idx];
}

// Devolve as linhas apagadas para o "Desfazer" conseguir restaurar
export async function deleteExpense(id) {
  const db = readDb();
  const removed = db.expenses.filter((e) => e.id === id);
  db.expenses = db.expenses.filter((e) => e.id !== id);
  writeDb(db);
  return { expenses: removed };
}

// ---------- Receitas variaveis ----------

export async function listVariableIncomes(monthKey) {
  const db = readDb();
  return db.variable_incomes.filter((v) => v.month_key === monthKey).sort(byKey("date_from"));
}

export async function insertVariableIncome(row) {
  const db = readDb();
  const inserted = withMeta(row);
  db.variable_incomes.push(inserted);
  writeDb(db);
  return inserted;
}

export async function deleteVariableIncome(id) {
  const db = readDb();
  const removed = db.variable_incomes.filter((v) => v.id === id);
  db.variable_incomes = db.variable_incomes.filter((v) => v.id !== id);
  writeDb(db);
  return { variable_incomes: removed };
}

// ---------- Recibos ----------

export async function listReceiptsWithItems(monthKey) {
  const db = readDb();
  const receipts = db.receipts.filter((r) => r.month_key === monthKey).sort(byKey("receipt_date", "desc"));
  const ids = new Set(receipts.map((r) => r.id));
  const itemsByReceipt = {};
  for (const item of db.receipt_items.filter((i) => ids.has(i.receipt_id)).sort(byKey("position"))) {
    (itemsByReceipt[item.receipt_id] ||= []).push(item);
  }
  return { receipts, itemsByReceipt };
}

export async function insertReceiptWithItems(receipt, items) {
  const db = readDb();
  const saved = withMeta(receipt);
  const savedItems = items.map((item) => withMeta({ ...item, receipt_id: saved.id }));
  db.receipts.push(saved);
  db.receipt_items.push(...savedItems);
  writeDb(db);
  return { receipt: saved, items: savedItems };
}

// Equivalente ao ON DELETE CASCADE que existia no banco
export async function deleteReceipt(id) {
  const db = readDb();
  const receipts = db.receipts.filter((r) => r.id === id);
  const receipt_items = db.receipt_items.filter((i) => i.receipt_id === id);
  db.receipts = db.receipts.filter((r) => r.id !== id);
  db.receipt_items = db.receipt_items.filter((i) => i.receipt_id !== id);
  writeDb(db);
  return { receipts, receipt_items };
}

// ---------- Plano ----------

// Fluxo de caixa precisa de todos os gastos: parcelas e fixos vem de outros meses
export async function listAllExpenses() {
  return readDb().expenses;
}

const SETTINGS_ID = "settings";

export async function getPlanSettings() {
  return readDb().plan_settings.find((r) => r.id === SETTINGS_ID) || null;
}

export async function savePlanSettings(patch) {
  const db = readDb();
  const idx = db.plan_settings.findIndex((r) => r.id === SETTINGS_ID);
  const ts = nowISO();
  if (idx === -1) {
    db.plan_settings.push({ id: SETTINGS_ID, created_at: ts, updated_at: ts, ...patch });
  } else {
    db.plan_settings[idx] = { ...db.plan_settings[idx], ...patch, updated_at: ts };
  }
  writeDb(db);
  return db.plan_settings.find((r) => r.id === SETTINGS_ID);
}

export async function listPlanMonths() {
  return readDb().plan_months.sort(byKey("month_key", "desc"));
}

// Um fechamento por mes: refazer substitui o anterior
export async function savePlanMonth(monthKey, values) {
  const db = readDb();
  const idx = db.plan_months.findIndex((r) => r.month_key === monthKey);
  const ts = nowISO();
  if (idx === -1) {
    db.plan_months.push(withMeta({ ...values, month_key: monthKey, decided_at: ts }));
  } else {
    db.plan_months[idx] = { ...db.plan_months[idx], ...values, month_key: monthKey, decided_at: ts, updated_at: ts };
  }
  writeDb(db);
  return db.plan_months.find((r) => r.month_key === monthKey);
}

export async function deletePlanMonth(monthKey) {
  const db = readDb();
  const removed = db.plan_months.filter((r) => r.month_key === monthKey);
  db.plan_months = db.plan_months.filter((r) => r.month_key !== monthKey);
  writeDb(db);
  return { plan_months: removed };
}

export async function listContributions() {
  return readDb().plan_contributions.sort(byKey("date"));
}

// amount_cents positivo e aporte, negativo e retirada (ex.: uso da reserva numa emergencia)
export async function insertContributions(rows) {
  const db = readDb();
  const inserted = rows.map(withMeta);
  db.plan_contributions.push(...inserted);
  writeDb(db);
  return inserted;
}

export async function deleteContribution(id) {
  const db = readDb();
  const removed = db.plan_contributions.filter((c) => c.id === id);
  db.plan_contributions = db.plan_contributions.filter((c) => c.id !== id);
  writeDb(db);
  return { plan_contributions: removed };
}

// ---------- Desfazer, backup ----------

// Recoloca linhas devolvidas por um delete*. Ids preservados, sem duplicar se ja existirem.
export async function restoreRows(removed) {
  const db = readDb();
  for (const table of TABLES) {
    const rows = removed?.[table];
    if (!rows?.length) continue;
    const existing = new Set(db[table].map((r) => r.id));
    db[table].push(...rows.filter((r) => !existing.has(r.id)));
  }
  writeDb(db);
}

export async function exportBackup() {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: nowISO(),
    data: readDb(),
  };
}

export function countRows(data) {
  return TABLES.reduce((sum, t) => sum + (Array.isArray(data?.[t]) ? data[t].length : 0), 0);
}

// Substitui todo o banco local pelo conteudo do backup. Valida antes de gravar para um
// arquivo errado nao apagar os dados atuais.
export async function importBackup(payload) {
  if (payload?.format !== BACKUP_FORMAT || typeof payload.data !== "object" || payload.data === null) {
    throw new Error("Arquivo não reconhecido. Use um backup exportado por este app.");
  }
  const db = emptyDb();
  for (const table of TABLES) {
    const rows = payload.data[table];
    if (rows === undefined) continue;
    if (!Array.isArray(rows) || rows.some((r) => typeof r !== "object" || r === null || !r.id)) {
      throw new Error(`Backup inválido: a tabela "${table}" está malformada.`);
    }
    db[table] = rows;
  }
  writeDb(db);
  return countRows(db);
}
