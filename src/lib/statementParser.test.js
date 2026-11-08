import { TextDecoder as NodeTextDecoder } from "util";
import { decodeBankFile, mergeStatementPages, parseCSV, parseMoney, parseOFX, parseStatementText } from "./statementParser";

// jsdom nao expoe TextDecoder
global.TextDecoder = NodeTextDecoder;

const TODAY = new Date(2026, 10, 8);

function summary(transactions) {
  return transactions.map((t) => `${t.date} ${t.description} ${t.amount_cents} ${t.direction}`);
}

describe("parseMoney", () => {
  it.each([
    ["1.234,56", 123456, 0],
    ["1,234.56", 123456, 0],
    ["-150.00", 15000, -1],
    ["R$ 89,90", 8990, 0],
    ["- R$ 89,90", 8990, -1],
    ["(10,00)", 1000, -1],
    ["150,00-", 15000, -1],
    ["150,00 D", 15000, -1],
    ["150,00 C", 15000, 1],
    ["+R$ 5,00", 500, 1],
    ["1.234", 123400, 0],
    ["19.9", 1990, 0],
  ])("%s", (raw, cents, sign) => {
    expect(parseMoney(raw)).toEqual({ cents, sign });
  });

  it("devolve null sem numero", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
});

describe("parseOFX", () => {
  const SGML = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260305120000[-3:BRT]
<TRNAMT>-89.90
<FITID>1
<MEMO>Compra no débito - Supermercado Extra
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260306
<TRNAMT>2500.00
<FITID>2
<NAME>Salario
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

  it("le OFX 1.x sem tags de fechamento", () => {
    const { transactions, accountType } = parseOFX(SGML);
    expect(accountType).toBe("account");
    expect(summary(transactions)).toEqual([
      "2026-03-05 Compra no débito - Supermercado Extra 8990 out",
      "2026-03-06 Salario 250000 in",
    ]);
  });

  it("le OFX 2.x em XML, junta NAME e MEMO e reconhece cartao", () => {
    const xml = `<?xml version="1.0"?><OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260310</DTPOSTED><TRNAMT>-44.90</TRNAMT><NAME>Pag &amp; Leva</NAME><MEMO>Netflix</MEMO></STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;
    const { transactions, accountType } = parseOFX(xml);
    expect(accountType).toBe("card");
    expect(summary(transactions)).toEqual(["2026-03-10 Pag & Leva Netflix 4490 out"]);
  });
});

describe("parseCSV", () => {
  it("Nubank conta: virgula, ponto decimal e negativo como saida", () => {
    const csv = "Data,Valor,Identificador,Descrição\n05/03/2026,-89.90,abc-1,Compra no débito - Mercado\n06/03/2026,100.00,abc-2,Transferência recebida";
    const { transactions, accountType } = parseCSV(csv, TODAY);
    expect(accountType).toBe("account");
    expect(summary(transactions)).toEqual([
      "2026-03-05 Compra no débito - Mercado 8990 out",
      "2026-03-06 Transferência recebida 10000 in",
    ]);
  });

  it("Nubank fatura: compra positiva e pagamento negativo", () => {
    const csv = "date,title,amount\n2026-03-05,Netflix,44.90\n2026-03-06,Uber,20.00\n2026-03-07,Mercado,10.00\n2026-03-10,Pagamento recebido,-500.00";
    const { transactions, accountType } = parseCSV(csv, TODAY);
    expect(accountType).toBe("card");
    expect(summary(transactions)).toEqual([
      "2026-03-05 Netflix 4490 out",
      "2026-03-06 Uber 2000 out",
      "2026-03-07 Mercado 1000 out",
      "2026-03-10 Pagamento recebido 50000 in",
    ]);
  });

  it("Inter: pula o preambulo, junta historico e descricao e ignora saldo", () => {
    const csv = [
      "Extrato Conta Corrente",
      "Conta ;123456",
      "Período ;01/03/2026 a 31/03/2026",
      "",
      "Data Lançamento;Histórico;Descrição;Valor;Saldo",
      "05/03/2026;Pix enviado;João da Silva;-150,00;1.000,00",
      '05/03/2026;Saldo do dia;;0,00;1.000,00',
    ].join("\r\n");
    expect(summary(parseCSV(csv, TODAY).transactions)).toEqual(["2026-03-05 Pix enviado João da Silva 15000 out"]);
  });

  it("Bradesco: colunas separadas de credito e debito", () => {
    const csv = "Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$);\n05/03/26;TARIFA BANCARIA;123;;19,90;980,10;\n06/03/26;DEPOSITO;124;50,00;;1.030,10;";
    expect(summary(parseCSV(csv, TODAY).transactions)).toEqual([
      "2026-03-05 TARIFA BANCARIA 1990 out",
      "2026-03-06 DEPOSITO 5000 in",
    ]);
  });

  it("BB: campos entre aspas, com virgula decimal e duas colunas de data", () => {
    const csv = '"Data","Dependencia Origem","Histórico","Data do Balancete","Número do documento","Valor",\n"05/03/2026","","Pix - Enviado","05/03/2026","1","-1.234,56",\n"05/03/2026","","S A L D O","","","900,00",';
    expect(summary(parseCSV(csv, TODAY).transactions)).toEqual(["2026-03-05 Pix - Enviado 123456 out"]);
  });

  it("Itau: sem cabecalho", () => {
    const csv = "05/03/2026;PIX TRANSF JOAO;-150,00\n06/03/2026;SALDO DO DIA;850,00\n07/03/2026;TED RECEBIDA;200,00";
    expect(summary(parseCSV(csv, TODAY).transactions)).toEqual([
      "2026-03-05 PIX TRANSF JOAO 15000 out",
      "2026-03-07 TED RECEBIDA 20000 in",
    ]);
  });

  it("C6: usa o valor em reais, nao o em dolar", () => {
    const csv = "Data de Compra;Nome no Cartão;Final do Cartão;Categoria;Descrição;Parcela;Valor (em US$);Cotação (em R$);Valor (em R$)\n05/03/2026;KELVIN;1234;Compras;LOJA;Única;2,00;5,00;10,00";
    expect(summary(parseCSV(csv, TODAY).transactions)).toEqual(["2026-03-05 LOJA 1000 out"]);
  });
});

describe("decodeBankFile", () => {
  it("mantem UTF-8 e cai para Latin-1 quando os bytes nao sao UTF-8", () => {
    expect(decodeBankFile(Buffer.from("Descrição", "utf8"))).toBe("Descrição");
    expect(decodeBankFile(Buffer.from("Descrição", "latin1"))).toBe("Descrição");
  });
});

describe("parseStatementText", () => {
  it("le tabela com data, historico, documento, valor e saldo na mesma linha", () => {
    const text = `EXTRATO DE CONTA CORRENTE
DATA HISTORICO DOCTO VALOR SALDO
02/03/2026 SALDO ANTERIOR 1.400,00
03/03/2026 PIX ENVIADO JOAO 123456 -150,00 1.250,00
04/03 COMPRA CARTAO MERCADO BOM 000123 89,90 D 1.160,10
05/03 TED RECEBIDA 500,00 C 1.660,10
TOTAL DE SAIDAS 239,90`;
    expect(summary(parseStatementText(text, TODAY).transactions)).toEqual([
      "2026-03-03 PIX ENVIADO JOAO 15000 out",
      "2026-03-04 COMPRA CARTAO MERCADO BOM 8990 out",
      "2026-03-05 TED RECEBIDA 50000 in",
    ]);
  });

  it("le lista de app: data como titulo e descricao acima do valor", () => {
    const text = `15 MAR 2026
Compra no débito
Supermercado Extra
R$ 89,90
Transferência recebida
Maria Souza
R$ 100,00
Segunda, 16 de março
Pix enviado João - R$ 20,00`;
    expect(summary(parseStatementText(text, TODAY).transactions)).toEqual([
      "2026-03-15 Compra no débito Supermercado Extra 8990 out",
      "2026-03-15 Transferência recebida Maria Souza 10000 in",
      "2026-03-16 Pix enviado João 2000 out",
    ]);
  });

  it("aceita Hoje e Ontem e infere o ano para ficar no passado", () => {
    const text = `Hoje
Padaria R$ 10,00
Ontem
Farmacia R$ 20,00
20/12 Netflix 44,90`;
    expect(summary(parseStatementText(text, TODAY).transactions)).toEqual([
      "2026-11-08 Padaria 1000 out",
      "2026-11-07 Farmacia 2000 out",
      "2025-12-20 Netflix 4490 out",
    ]);
  });

  it("marca quando a data nao foi lida", () => {
    const [tx] = parseStatementText("Padaria R$ 10,00", TODAY).transactions;
    expect(tx.date).toBe("2026-11-08");
    expect(tx.dateMissing).toBe(true);
  });

  it("nao confunde data, hora e numero de documento com valor", () => {
    const text = "05/03/2026 10:32 PIX 12.03.2026 ENVIADO 987654 R$ 7,50";
    const [tx] = parseStatementText(text, TODAY).transactions;
    expect(tx.amount_cents).toBe(750);
  });

  it("aceita R$ lido como RS, virgula lida como ponto e borda de tabela", () => {
    const text = "| 05/03 | Padaria | RS 12.50 |";
    expect(summary(parseStatementText(text, TODAY).transactions)).toEqual(["2026-03-05 Padaria 1250 out"]);
  });

  it("nao transforma mes em palavra parecida", () => {
    const text = "01/03 Abertura\n10 MARCAS LOJA R$ 5,00";
    const [tx] = parseStatementText(text, TODAY).transactions;
    expect(tx.date).toBe("2026-03-01");
    expect(tx.description).toContain("10 MARCAS LOJA");
  });

  it("reconhece fatura de cartao pelo texto", () => {
    expect(parseStatementText("Fatura de março\nVencimento 10/04\n05 MAR Netflix 44,90", TODAY).accountType).toBe("card");
    expect(parseStatementText("05/03 Netflix 44,90", TODAY).accountType).toBe("account");
  });
});

describe("mergeStatementPages", () => {
  const tx = (description, amount_cents = 1000) => ({ date: "2026-03-05", description, amount_cents, direction: "out" });

  it("nao repete o que aparece em dois prints", () => {
    expect(mergeStatementPages([[tx("A"), tx("B")], [tx("b"), tx("C")]]).map((t) => t.description)).toEqual(["A", "B", "C"]);
  });

  it("mantem repeticoes reais dentro do mesmo print", () => {
    expect(mergeStatementPages([[tx("Cafe"), tx("Cafe")], [tx("Cafe")]])).toHaveLength(2);
  });
});
