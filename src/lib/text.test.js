import { toSentenceCase } from "./text";

describe("toSentenceCase", () => {
  it("deixa so a primeira letra maiuscula", () => {
    expect(toSentenceCase("CONTA DE LUZ")).toBe("Conta de luz");
    expect(toSentenceCase("conta de Luz")).toBe("Conta de luz");
    expect(toSentenceCase("ÁGUA E ESGOTO")).toBe("Água e esgoto");
  });

  it("tira espacos das pontas e repetidos no meio", () => {
    expect(toSentenceCase("  pao   de queijo ")).toBe("Pao de queijo");
  });

  it("procura a primeira letra quando o texto comeca com numero ou simbolo", () => {
    expect(toSentenceCase("2 PAES")).toBe("2 Paes");
    expect(toSentenceCase("(promo) ARROZ")).toBe("(Promo) arroz");
  });

  it("aceita vazio e nulo", () => {
    expect(toSentenceCase("   ")).toBe("");
    expect(toSentenceCase(null)).toBe("");
  });
});
