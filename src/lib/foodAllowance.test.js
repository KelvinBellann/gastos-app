import { businessDaysInMonth, foodAllowanceCents, isValidFoodDays } from "./foodAllowance";

describe("businessDaysInMonth", () => {
  it("tira fins de semana e feriados nacionais", () => {
    // Novembro de 2026: 21 dias de semana, menos Finados (seg) e Consciencia Negra (sex)
    expect(businessDaysInMonth("2026-11")).toBe(19);
    // Dezembro de 2026: 23 dias de semana, menos o Natal (sex)
    expect(businessDaysInMonth("2026-12")).toBe(22);
  });

  it("tira a Sexta-feira Santa, que muda de data", () => {
    // Abril de 2026: 22 dias de semana, menos Sexta Santa (3) e Tiradentes (21)
    expect(businessDaysInMonth("2026-04")).toBe(20);
    // Pascoa de 2027 em 28/03, Sexta Santa em 26/03
    expect(businessDaysInMonth("2027-03")).toBe(22);
  });

  it("feriado no fim de semana nao desconta duas vezes", () => {
    // 01/05/2027 cai num sabado: maio tem 21 dias de semana e nenhum deles e feriado
    expect(businessDaysInMonth("2027-05")).toBe(21);
  });

  it("Carnaval nao e feriado nacional", () => {
    expect(businessDaysInMonth("2026-02")).toBe(20);
  });
});

describe("foodAllowanceCents", () => {
  it("multiplica por 39,71 e tira 3%", () => {
    expect(foodAllowanceCents(19)).toBe(73186);
    expect(foodAllowanceCents(22)).toBe(84741);
  });

  it("zero dias da zero", () => {
    expect(foodAllowanceCents(0)).toBe(0);
  });
});

describe("isValidFoodDays", () => {
  it("aceita de 0 a 31", () => {
    expect(["0", "19", "31"].every(isValidFoodDays)).toBe(true);
  });

  it("recusa o resto", () => {
    expect(["32", "", "1,5", "a", "-1"].some(isValidFoodDays)).toBe(false);
  });
});
