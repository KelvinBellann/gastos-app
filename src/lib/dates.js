// Datas no formato "YYYY-MM-DD" (colunas DATE do Supabase) sempre no fuso local.
// new Date("YYYY-MM-DD") e toISOString() trabalham em UTC: no Brasil (UTC-3) isso
// mostrava o dia anterior e, depois das 21h, gravava a data de amanha.

function pad(n) {
  return String(n).padStart(2, "0");
}

export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function parseISODate(str) {
  if (!str || typeof str !== "string") return null;
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  // Rejeita datas como 2024-02-31, que o construtor normalizaria para 2 de marco
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export function isValidISODate(str) {
  return parseISODate(str) !== null;
}

export function formatDatePT(str) {
  const date = parseISODate(str);
  return date ? date.toLocaleDateString("pt-BR") : "";
}
