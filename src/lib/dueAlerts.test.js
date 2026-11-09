import {
  MAX_SCHEDULED,
  buildAlertSchedule,
  countUndatedInstallments,
  isValidDueDay,
  toDueDay,
} from "./dueAlerts";

const NOW = new Date(2026, 10, 8, 10, 0);
const ON = { enabled: true, card_due_day: 10 };

function parcel(overrides) {
  return {
    description: "Geladeira (1/3)",
    amount_cents: 25000,
    payment_method: "credit",
    is_paid: false,
    month_key: "2026-11",
    installment_month: "2026-12",
    due_day: null,
    ...overrides,
  };
}

function local(alert) {
  const d = new Date(alert.fireAt);
  return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}h`;
}

describe("buildAlertSchedule", () => {
  it("avisa 3 dias, 1 dia e 12 horas antes das 20h do vencimento", () => {
    const alerts = buildAlertSchedule([parcel()], ON, NOW);
    expect(alerts.map(local)).toEqual(["7/12 20h", "9/12 20h", "10/12 8h"]);
    expect(alerts.map((a) => a.title)).toEqual([
      "Faltam 3 dias para pagar",
      "Falta 1 dia para pagar",
      "Faltam 12 horas para pagar",
    ]);
    expect(alerts[0].body).toContain("Geladeira (1/3)");
    expect(alerts[0].body).toContain("250,00");
    expect(alerts[0].body).toContain("10/12");
  });

  it("respeita a antecedencia escolhida", () => {
    const alerts = buildAlertSchedule([parcel()], { ...ON, leads: ["1h"] }, NOW);
    expect(alerts.map(local)).toEqual(["10/12 19h"]);
    expect(buildAlertSchedule([parcel()], { ...ON, leads: [] }, NOW)).toEqual([]);
  });

  it("nao agenda nada com os avisos desligados ou sem configuracao", () => {
    expect(buildAlertSchedule([parcel()], { ...ON, enabled: false }, NOW)).toEqual([]);
    expect(buildAlertSchedule([parcel()], null, NOW)).toEqual([]);
  });

  it("o dia proprio da parcela vale mais que o dia do cartao", () => {
    const [first] = buildAlertSchedule([parcel({ due_day: 20 })], ON, NOW);
    expect(local(first)).toBe("17/12 20h");
  });

  it("dia 31 em mes curto vence no ultimo dia do mes", () => {
    const [first] = buildAlertSchedule([parcel({ installment_month: "2027-02", due_day: 31 })], ON, NOW);
    expect(first.id).toBe("2027-02-28-3d");
    expect(local(first)).toBe("25/2 20h");
  });

  it("parcela paga nao avisa", () => {
    expect(buildAlertSchedule([parcel({ is_paid: true })], ON, NOW)).toEqual([]);
  });

  it("parcela sem dia proprio e sem dia do cartao nao avisa", () => {
    expect(buildAlertSchedule([parcel()], { enabled: true }, NOW)).toEqual([]);
  });

  it("horario que ja passou fica de fora", () => {
    const today = parcel({ installment_month: "2026-11", due_day: 8 });
    expect(buildAlertSchedule([today], ON, new Date(2026, 10, 8, 9, 0)).map((a) => a.id)).toEqual([]);
    const tomorrow = parcel({ installment_month: "2026-11", due_day: 9 });
    expect(buildAlertSchedule([tomorrow], ON, NOW).map(local)).toEqual(["8/11 20h", "9/11 8h"]);
  });

  it("contas com o mesmo vencimento viram um aviso so, com a soma", () => {
    const alerts = buildAlertSchedule(
      [parcel(), parcel({ description: "Tv (2/6)", amount_cents: 10000 }), parcel({ description: "Sofa (3/4)", amount_cents: 5000 })],
      { ...ON, leads: ["1d"] },
      NOW
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].body).toContain("3 contas somam");
    expect(alerts[0].body).toContain("400,00");
    expect(alerts[0].body).toContain("Geladeira (1/3), Tv (2/6) e mais 1");
  });

  it("debito pendente so avisa se tiver dia", () => {
    const debit = { payment_method: "debit", installment_month: "2026-11" };
    expect(buildAlertSchedule([parcel(debit)], ON, NOW)).toEqual([]);
    expect(buildAlertSchedule([parcel({ ...debit, due_day: 15 })], ON, NOW).map(local)).toEqual([
      "12/11 20h",
      "14/11 20h",
      "15/11 8h",
    ]);
  });

  it("fixo com dia repete todo mes, mesmo contando como pago", () => {
    const rent = parcel({ payment_method: "fixed", is_paid: true, month_key: "2026-01", installment_month: "2026-01", due_day: 5 });
    const alerts = buildAlertSchedule([rent], { ...ON, leads: ["1d"] }, NOW);
    expect(alerts.slice(0, 3).map(local)).toEqual(["4/12 20h", "4/1 20h", "4/2 20h"]);
  });

  it("fixo sem dia nao avisa e fixo futuro so comeca no mes em que foi criado", () => {
    const noDay = parcel({ payment_method: "fixed", is_paid: true, month_key: "2026-01", installment_month: "2026-01" });
    expect(buildAlertSchedule([noDay], ON, NOW)).toEqual([]);
    const future = parcel({ payment_method: "fixed", is_paid: true, month_key: "2027-03", installment_month: "2027-03", due_day: 5 });
    expect(local(buildAlertSchedule([future], { ...ON, leads: ["1d"] }, NOW)[0])).toBe("4/3 20h");
  });

  it("fica dentro do limite do iOS mantendo os mais proximos", () => {
    const rows = Array.from({ length: 28 }, (_, i) => parcel({ due_day: i + 1 }))
      .concat(Array.from({ length: 28 }, (_, i) => parcel({ installment_month: "2027-01", due_day: i + 1 })));
    const alerts = buildAlertSchedule(rows, ON, NOW);
    expect(alerts).toHaveLength(MAX_SCHEDULED);
    expect(alerts.every((a, i) => i === 0 || alerts[i - 1].fireAt <= a.fireAt)).toBe(true);
    expect(alerts[0].id).toBe("2026-12-01-3d");
  });

  it("ignora linha sem mes de vencimento valido", () => {
    expect(buildAlertSchedule([parcel({ installment_month: undefined })], ON, NOW)).toEqual([]);
  });
});

describe("countUndatedInstallments", () => {
  it("conta so parcelas futuras, pendentes e sem dia", () => {
    const rows = [
      parcel(),
      parcel({ due_day: 5 }),
      parcel({ is_paid: true }),
      parcel({ installment_month: "2026-10" }),
      parcel({ payment_method: "debit" }),
    ];
    expect(countUndatedInstallments(rows, { enabled: true }, NOW)).toBe(1);
  });

  it("com o dia do cartao nada fica sem data", () => {
    expect(countUndatedInstallments([parcel()], ON, NOW)).toBe(0);
  });
});

describe("dia de vencimento digitado", () => {
  it("aceita vazio e dias de 1 a 31", () => {
    expect(["", "  ", "1", "09", "31"].every(isValidDueDay)).toBe(true);
  });

  it("recusa o resto", () => {
    expect(["0", "32", "1,5", "a", "-1"].some(isValidDueDay)).toBe(false);
  });

  it("converte para numero ou nulo", () => {
    expect(toDueDay(" 09 ")).toBe(9);
    expect(toDueDay("")).toBeNull();
  });
});
