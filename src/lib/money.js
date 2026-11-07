const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRLFromCents(cents) {
  return BRL.format((cents || 0) / 100);
}

export function sumCents(rows, field = "amount_cents") {
  return rows.reduce((sum, row) => sum + (row?.[field] || 0), 0);
}
