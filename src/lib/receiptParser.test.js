import { parseReceipt, normalizeProductName } from "./receiptParser";

describe("normalizeProductName", () => {
  test("remove quantidade com unidade no fim da palavra", () => {
    expect(normalizeProductName("Leite 1L")).toBe("leite");
    expect(normalizeProductName("Arroz 5kg Tio Joao")).toBe("arroz tio joao");
    expect(normalizeProductName("Ovos 12 un.")).toBe("ovos");
    expect(normalizeProductName("Coca 1,5l")).toBe("coca");
  });

  test("nao corta palavra que comeca com letra de unidade", () => {
    expect(normalizeProductName("2 leite")).toBe("2 leite");
    expect(normalizeProductName("3 goiabas")).toBe("3 goiabas");
  });
});

describe("parseReceipt", () => {
  const text = [
    "SUPERMERCADO CONDOR LTDA",
    "CNPJ 12.345.678/0001-90",
    "27/09/2026 18:32",
    "Leite 1L 4,99",
    "Pao frances x2 8,50",
    "SUBTOTAL 13,49",
    "TOTAL R$ 13,49",
    "Dinheiro 20,00",
    "TROCO 6,51",
  ].join("\n");

  test("identifica loja por palavra inteira", () => {
    expect(parseReceipt(text).storeName).toBe("SUPERMERCADO CONDOR LTDA");
    expect(parseReceipt("Media Mensal 10,00").storeName).toBe("Loja desconhecida");
  });

  test("le a data no formato ISO e ignora data impossivel", () => {
    expect(parseReceipt(text).receiptDate).toBe("2026-09-27");
    const fallback = parseReceipt("31/02/2026 Leite 4,99").receiptDate;
    expect(fallback).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fallback).not.toBe("2026-02-31");
  });

  test("linhas de total, troco e pagamento nao viram item", () => {
    const { items, totalCents } = parseReceipt(text);
    expect(items.map((i) => i.productName)).toEqual(["Leite 1L", "Pao frances"]);
    expect(totalCents).toBe(1349);
  });
});
