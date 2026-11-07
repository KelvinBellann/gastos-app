import {
  actualByBucket,
  allocateFuture,
  balances,
  cashFlowExpenses,
  computeIncome,
  formatDuration,
  independenceForecast,
  independenceTarget,
  monthsToReach,
  reserveTarget,
  suggestSplit,
} from "./plan";

// Renda de referencia da conversa: R$ 7.186 no total, essenciais de R$ 3.593
const SETTINGS = { essentials_budget_cents: 359300 };

function income(his, hers, extras = 0, benefits = 0) {
  return computeIncome(
    { salary_net_cents: his, spouse_salary_cents: hers, multibenefits_cents: benefits, food_cents: 0 },
    extras ? [{ amount_cents: extras }] : []
  );
}

describe("computeIncome", () => {
  it("soma os salarios, separa extras e deixa beneficios fora do total", () => {
    const inc = income(480000, 238600, 120000, 60000);
    expect(inc.base).toBe(718600);
    expect(inc.total).toBe(838600);
    expect(inc.benefits).toBe(60000);
    expect(inc.hisShare).toBeCloseTo(0.668, 3);
  });
});

describe("suggestSplit, essencial primeiro", () => {
  it("na renda de referencia bate com a regra 50/30/20", () => {
    expect(suggestSplit(SETTINGS, income(480000, 238600))).toEqual({
      essentials: 359300,
      leisure: 215580,
      future: 143720,
      shortfall: 0,
    });
  });

  it("mes fraco mantem os essenciais e reduz lazer e futuro", () => {
    expect(suggestSplit(SETTINGS, income(400000, 200000))).toMatchObject({
      essentials: 359300,
      leisure: 144420,
      future: 96280,
    });
  });

  it("renda que nao cobre os essenciais zera o lazer e aponta o que falta", () => {
    expect(suggestSplit(SETTINGS, income(300000, 0))).toEqual({
      essentials: 359300,
      leisure: 0,
      future: -59300,
      shortfall: 59300,
    });
  });

  it("com extra_to_future o bonus vai inteiro para o futuro", () => {
    const inc = income(480000, 238600, 120000);
    expect(suggestSplit(SETTINGS, inc).leisure).toBe(287580);
    const s = suggestSplit({ ...SETTINGS, extra_to_future: true }, inc);
    expect(s.leisure).toBe(215580);
    expect(s.future).toBe(143720 + 120000);
  });

  it("sem orcamento definido usa 50% da renda base", () => {
    expect(suggestSplit({}, income(480000, 238600)).essentials).toBe(359300);
  });
});

describe("reserva e futuro", () => {
  it("reserva e 6 meses de essenciais", () => {
    expect(reserveTarget(SETTINGS, income(480000, 238600))).toBe(2155800);
  });

  it("futuro enche a reserva ate o alvo e o resto vai para investimentos", () => {
    expect(allocateFuture(143720, 2155800, 0)).toEqual({ reserve: 143720, invest: 0 });
    expect(allocateFuture(143720, 2155800, 2100000)).toEqual({ reserve: 55800, invest: 87920 });
    expect(allocateFuture(143720, 2155800, 2155800)).toEqual({ reserve: 0, invest: 143720 });
    expect(allocateFuture(-500, 2155800, 0)).toEqual({ reserve: 0, invest: 0 });
  });

  it("saldo soma o inicial com aportes e retiradas", () => {
    const bal = balances({ reserve_initial_cents: 100000 }, [
      { target: "reserve", amount_cents: 50000 },
      { target: "reserve", amount_cents: -20000 },
      { target: "invest", amount_cents: 30000 },
    ]);
    expect(bal).toEqual({ reserve: 130000, invest: 30000 });
  });
});

describe("independencia financeira", () => {
  it("alvo e o custo de vida dividido pelo rendimento real", () => {
    expect(independenceTarget({ real_rate_monthly_pct: 0.4 }, 574880)).toBe(143720000);
    expect(independenceTarget({ real_rate_monthly_pct: 0 }, 574880)).toBeNull();
  });

  it("monthsToReach bate com as contas da conversa", () => {
    // R$ 668.298 aportando R$ 1.437,20: 1,075% ao mes da cerca de 14 anos, 0,4% cerca de 22
    expect(monthsToReach(66829800, 0, 143720, 1.075)).toBe(168);
    expect(monthsToReach(66829800, 0, 143720, 0.4)).toBe(264);
    expect(monthsToReach(2155800, 0, 143720, 0)).toBe(15);
    expect(monthsToReach(100, 0, 0, 0)).toBeNull();
    expect(monthsToReach(100, 200, 0, 0)).toBe(0);
  });

  it("previsao enche a reserva antes de investir", () => {
    const months = independenceForecast({
      settings: { real_rate_monthly_pct: 0.4 },
      monthlyFuture: 143720,
      reserveTarget: 2155800,
      bal: { reserve: 0, invest: 0 },
      target: 66829800,
    });
    expect(months).toBe(15 + 264);
  });

  it("formatDuration escreve meses e anos", () => {
    expect(formatDuration(0)).toBe("já alcançado");
    expect(formatDuration(1)).toBe("1 mês");
    expect(formatDuration(15)).toBe("1 ano e 3 meses");
    expect(formatDuration(24)).toBe("2 anos");
    expect(formatDuration(null)).toBe("sem previsão no ritmo atual");
  });
});

describe("gasto real por pote", () => {
  const expenses = [
    { category: "fixos", month_key: "2026-01", payment_method: "fixed", amount_cents: 180000 },
    { category: "fixos", month_key: "2026-11", payment_method: "fixed", amount_cents: 9900 },
    { category: "mercado", month_key: "2026-10", payment_method: "debit", amount_cents: 80000 },
    { category: "lanches", month_key: "2026-10", payment_method: "pix", amount_cents: 30000 },
    { category: "aleatorios", month_key: "2026-09", installment_month: "2026-10", payment_method: "credit", amount_cents: 10000 },
    { category: "aleatorios", month_key: "2026-10", installment_month: "2026-11", payment_method: "credit", amount_cents: 10000 },
    { category: "emprestado", month_key: "2026-10", payment_method: "pix", amount_cents: 5000 },
  ];

  it("credito conta no mes da parcela e fixo so a partir do mes em que foi criado", () => {
    expect(cashFlowExpenses(expenses, "2026-10")).toHaveLength(5);
  });

  it("beneficios abatem mercado e depois lanches", () => {
    expect(actualByBucket(expenses, "2026-10", 90000)).toEqual({
      essentials: 180000,
      leisure: 30000,
      outside: 5000,
      benefitsUsed: 90000,
    });
  });
});
