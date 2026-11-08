import { buildStatementEntries, classifyDescription, prepareStatementRows } from "./statementClassifier";

const out = (description, amount_cents = 1000, date = "2026-03-05", extra = {}) => ({
  date,
  dateMissing: false,
  description,
  amount_cents,
  direction: "out",
  ...extra,
});

describe("classifyDescription", () => {
  it.each([
    ["COMPRA CARTAO SUPERMERCADO BOM PRECO", "mercado"],
    ["Compra no débito - Atacadão", "mercado"],
    ["PIX ENVIADO MERCADO DO ZE", "mercado"],
    ["NETFLIX.COM", "assinaturas"],
    ["APPLE.COM/BILL", "assinaturas"],
    ["Uber One", "assinaturas"],
    ["SMART FIT", "assinaturas"],
    ["TARIFA BANCARIA", "banco"],
    ["IOF COMPRA EXTERIOR", "banco"],
    ["ANUIDADE CARTAO", "banco"],
    ["IFD*RESTAURANTE SABOR", "lanches"],
    ["UBER EATS", "lanches"],
    ["UBER *TRIP", "transporte"],
    ["AUTO POSTO SHELL", "carro"],
    ["DROGARIA SAO PAULO", "farmacia"],
    ["PETZ", "gatos"],
    ["ENEL DISTRIBUICAO", "contas"],
    ["VIVO FIXO", "contas"],
    ["UNIMED", "saude"],
    ["SAQUE 24H", "dinheiro"],
    ["PIX ENVIADO JOAO DA SILVA", "transferencias"],
    ["Mercado Livre", "aleatorios"],
    ["MERCADOPAGO*LOJA", "aleatorios"],
    ["LOJA QUALQUER", "aleatorios"],
  ])("%s => %s", (description, category) => {
    expect(classifyDescription(description).category).toBe(category);
  });

  it("casa palavra inteira: mercado nao bate em Mercadoria nem bar em Barbearia", () => {
    expect(classifyDescription("MERCADORIAS LTDA").category).toBe("aleatorios");
    expect(classifyDescription("BARBEARIA").category).toBe("aleatorios");
  });

  it("nunca sugere fixos, que repetiria em todos os meses", () => {
    expect(classifyDescription("ALUGUEL MARCO").category).toBe("contas");
  });

  it("marca pagamento de fatura e investimento para nao contar como gasto", () => {
    expect(classifyDescription("PAGAMENTO DE FATURA").skipNote).toMatch(/fatura/i);
    expect(classifyDescription("APLICACAO CDB").skipNote).toMatch(/investimento/i);
    expect(classifyDescription("NETFLIX").skipNote).toBeNull();
  });
});

describe("prepareStatementRows", () => {
  it("deixa entradas de fora e conta quantas foram", () => {
    const { rows, ignoredIncoming } = prepareStatementRows([out("Netflix"), { ...out("Salario"), direction: "in" }]);
    expect(rows).toHaveLength(1);
    expect(ignoredIncoming).toBe(1);
  });

  it("tira o prefixo generico do banco, mas classifica pelo texto inteiro", () => {
    const { rows } = prepareStatementRows([out("Compra no débito - Supermercado Extra")]);
    expect(rows[0].description).toBe("Supermercado Extra");
    expect(rows[0].category).toBe("mercado");
  });

  it("detecta Pix como forma de pagamento", () => {
    const { rows } = prepareStatementRows([out("PIX ENVIADO JOAO"), out("LOJA")]);
    expect(rows.map((r) => r.paymentMethod)).toEqual(["pix", "debit"]);
  });

  it("desmarca o que ja foi lancado, consumindo um registro por linha", () => {
    const existing = [{ date: "2026-03-05", amount_cents: 500, description: "Cafe", category: "lanches" }];
    const { rows } = prepareStatementRows([out("CAFE", 500), out("CAFE", 500)], existing);
    expect(rows.map((r) => r.selected)).toEqual([false, true]);
    expect(rows[0].note).toMatch(/Já lançado/);
  });

  it("desmarca o que parece um gasto fixo ja cadastrado", () => {
    const existing = [{ date: "2026-01-01", amount_cents: 4490, description: "Netflix", category: "fixos" }];
    const { rows } = prepareStatementRows([out("NETFLIX.COM", 4490)], existing);
    expect(rows[0].selected).toBe(false);
    expect(rows[0].note).toMatch(/Netflix/);
  });

  it("desmarca pagamento de fatura e avisa data nao lida sem desmarcar", () => {
    const { rows } = prepareStatementRows([out("PAGAMENTO DE FATURA", 1), out("LOJA", 2, "2026-03-05", { dateMissing: true })]);
    expect(rows[0].selected).toBe(false);
    expect(rows[1].selected).toBe(true);
    expect(rows[1].note).toMatch(/Data não lida/);
  });

  it("usa a categoria que a pessoa ja deu para a mesma descricao", () => {
    const existing = [{ date: "2026-01-01", amount_cents: 1, description: "Loja do bairro", category: "gatos" }];
    const { rows } = prepareStatementRows([out("LOJA DO BAIRRO", 999)], existing);
    expect(rows[0].category).toBe("gatos");
  });

  it("ordena do mais recente para o mais antigo", () => {
    const { rows } = prepareStatementRows([out("A", 1, "2026-03-01"), out("B", 2, "2026-03-09")]);
    expect(rows.map((r) => r.description)).toEqual(["B", "A"]);
  });
});

describe("buildStatementEntries", () => {
  const row = { date: "2026-03-05", description: "NETFLIX", amount_cents: 4490, category: "assinaturas", paymentMethod: "debit" };

  it("grava no mes da propria data, como pago", () => {
    const [entry] = buildStatementEntries([row], "account");
    expect(entry).toMatchObject({
      month_key: "2026-03",
      installment_month: "2026-03",
      date: "2026-03-05",
      description: "Netflix",
      payment_method: "debit",
      is_paid: true,
      paid_date: "2026-03-05",
    });
  });

  it("em fatura de cartao segue a regra do credito: parcela unica no mes seguinte", () => {
    const [entry] = buildStatementEntries([row], "card");
    expect(entry).toMatchObject({ payment_method: "credit", installments: 1, installment_month: "2026-04", is_paid: false });
  });
});
