import {
  addMonths,
  buildExpenseEntries,
  filterExpenses,
  getPeriodLabel,
  groupExpenses,
  isValidMonthKey,
  samePurchase,
  splitInstallments,
} from "./expenses";

const TODAY = new Date(2026, 9, 12, 15, 0); // 12/10/2026, horario local

const BASE = {
  monthKey: "2026-10",
  description: "  TENIS  ",
  amountCents: 10000,
  paymentMethod: "debit",
  installments: 1,
  isPaid: false,
  paidDate: "2026-10-12",
  date: "2026-10-12",
};

describe("splitInstallments", () => {
  it("soma o total exato e coloca o resto nas primeiras parcelas", () => {
    expect(splitInstallments(1000, 3)).toEqual([334, 333, 333]);
    expect(splitInstallments(1, 12).reduce((a, b) => a + b, 0)).toBe(1);
    expect(Math.min(...splitInstallments(1, 12))).toBe(0);
  });
});

describe("addMonths e isValidMonthKey", () => {
  it("vira o ano nos dois sentidos", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-12", 12)).toBe("2027-12");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("aceita so YYYY-MM com mes de 01 a 12", () => {
    expect(isValidMonthKey("2026-10")).toBe(true);
    expect(isValidMonthKey("2026-13")).toBe(false);
    expect(isValidMonthKey("2026-1")).toBe(false);
    expect(isValidMonthKey(null)).toBe(false);
  });
});

describe("buildExpenseEntries", () => {
  it("gasto fixo vira um registro pago, sem forma de pagamento", () => {
    const [row] = buildExpenseEntries({ ...BASE, category: "fixos" });
    expect(row).toMatchObject({ description: "Tenis", payment_method: "fixed", is_paid: true, installment_month: "2026-10" });
  });

  it("credito em 3x cria uma linha por parcela a partir do mes seguinte", () => {
    const rows = buildExpenseEntries({ ...BASE, category: "aleatorios", paymentMethod: "credit", installments: 3 });
    expect(rows.map((r) => r.installment_month)).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(rows.map((r) => r.description)).toEqual(["Tenis (1/3)", "Tenis (2/3)", "Tenis (3/3)"]);
    expect(rows.reduce((s, r) => s + r.amount_cents, 0)).toBe(10000);
    expect(rows.every((r) => r.is_paid === false)).toBe(true);
  });

  it("credito em 1x nao recebe sufixo de parcela", () => {
    const [row] = buildExpenseEntries({ ...BASE, category: "aleatorios", paymentMethod: "credit", installments: 1 });
    expect(row.description).toBe("Tenis");
    expect(row.installment_month).toBe("2026-11");
  });

  it("debito pago guarda a data, pendente nao", () => {
    const [paid] = buildExpenseEntries({ ...BASE, category: "mercado", isPaid: true });
    const [pending] = buildExpenseEntries({ ...BASE, category: "mercado", isPaid: false });
    expect(paid).toMatchObject({ is_paid: true, paid_date: "2026-10-12" });
    expect(pending).toMatchObject({ is_paid: false, paid_date: null });
  });
});

describe("periodo, filtro e agrupamento", () => {
  const rows = [
    { id: "1", description: "Cafe", category: "lanches", date: "2026-10-12", amount_cents: 500 },
    { id: "2", description: "Cafe", category: "lanches", date: "2026-10-12", amount_cents: 700 },
    { id: "3", description: "Uber", category: "carro", date: "2026-10-11", amount_cents: 2000 },
    { id: "4", description: "Racao", category: "gatos", date: "2026-09-01", amount_cents: 9000 },
  ];

  it("classifica pelo dia local", () => {
    expect(getPeriodLabel("2026-10-12", TODAY)).toBe("Hoje");
    expect(getPeriodLabel("2026-10-11", TODAY)).toBe("Ontem");
    expect(getPeriodLabel("2026-10-06", TODAY)).toBe("Esta semana");
    expect(getPeriodLabel("2026-09-01", TODAY)).toBe("Anteriores");
  });

  it("filtra por janela de dias", () => {
    expect(filterExpenses(rows, "hoje", TODAY).map((r) => r.id)).toEqual(["1", "2"]);
    expect(filterExpenses(rows, "semana", TODAY)).toHaveLength(3);
    expect(filterExpenses(rows, "todos", TODAY)).toHaveLength(4);
  });

  it("soma lancamentos iguais no mesmo dia e preserva os registros originais", () => {
    const groups = groupExpenses(rows, TODAY);
    expect(groups.map((g) => g.period)).toEqual(["Hoje", "Ontem", "Anteriores"]);
    const [cafe] = groups[0].items;
    expect(cafe).toMatchObject({ count: 2, amount_cents: 1200 });
    expect(cafe.items.map((i) => i.id)).toEqual(["1", "2"]);
    expect(rows[0].amount_cents).toBe(500);
  });
});

describe("dia de vencimento", () => {
  const base = { monthKey: "2026-10", description: "Tenis", amountCents: 10000, date: "2026-10-12" };

  it("vai para todas as parcelas da compra", () => {
    const rows = buildExpenseEntries({ ...base, category: "aleatorios", paymentMethod: "credit", installments: 3, dueDay: 15 });
    expect(rows.map((r) => r.due_day)).toEqual([15, 15, 15]);
  });

  it("sem dia fica nulo", () => {
    const [row] = buildExpenseEntries({ ...base, category: "mercado", paymentMethod: "debit" });
    expect(row.due_day).toBeNull();
  });
});

describe("samePurchase", () => {
  const row = (description, overrides) => ({
    description,
    payment_method: "credit",
    installments: 3,
    date: "2026-10-12",
    ...overrides,
  });

  it("liga as parcelas da mesma compra", () => {
    expect(samePurchase(row("Tv (1/3)"), row("Tv (3/3)"))).toBe(true);
  });

  it("separa outra compra, outro dia, outra quantidade e o que nao e parcelado", () => {
    expect(samePurchase(row("Tv (1/3)"), row("Sofa (1/3)"))).toBe(false);
    expect(samePurchase(row("Tv (1/3)"), row("Tv (2/3)", { date: "2026-10-13" }))).toBe(false);
    expect(samePurchase(row("Tv (1/3)"), row("Tv (1/6)", { installments: 6 }))).toBe(false);
    expect(samePurchase(row("Tv", { installments: 1 }), row("Tv", { installments: 1 }))).toBe(false);
    expect(samePurchase(row("Tv", { payment_method: "debit" }), row("Tv", { payment_method: "debit" }))).toBe(false);
  });
});
