import {
  DB_CHANGED_EVENT,
  countRows,
  deleteExpense,
  deleteExpenses,
  deleteReceipt,
  exportBackup,
  getAlertSettings,
  getOrCreateIncome,
  importBackup,
  insertExpenses,
  insertReceiptWithItems,
  insertVariableIncome,
  listAllExpenses,
  listExpensesForMonth,
  listReceiptsWithItems,
  listVariableIncomes,
  restoreRows,
  saveAlertSettings,
  setPurchaseDueDay,
  updateExpense,
  updateIncome,
} from "./localDb";

const STORAGE_KEY = "gastos-app:db:v1";

function expense(overrides) {
  return {
    month_key: "2026-10",
    category: "mercado",
    description: "Pao",
    amount_cents: 1000,
    date: "2026-10-05",
    payment_method: "debit",
    installments: 1,
    installment_number: 1,
    installment_month: "2026-10",
    is_paid: false,
    paid_date: null,
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("receitas fixas", () => {
  it("cria a receita do mes zerada uma unica vez", async () => {
    const first = await getOrCreateIncome("2026-10");
    const second = await getOrCreateIncome("2026-10");
    expect(second.id).toBe(first.id);
    expect(first.salary_net_cents).toBe(0);
    expect(countRows((await exportBackup()).data)).toBe(1);
  });

  it("atualiza so os campos enviados", async () => {
    const inc = await getOrCreateIncome("2026-10");
    const updated = await updateIncome(inc.id, { food_cents: 50000 });
    expect(updated.food_cents).toBe(50000);
    expect(updated.salary_net_cents).toBe(0);
  });
});

describe("gastos", () => {
  it("lista gastos do mes, parcelas que vencem no mes e fixos de qualquer mes", async () => {
    await insertExpenses([
      expense({ description: "do mes" }),
      expense({ description: "outro mes", month_key: "2026-09", installment_month: "2026-09" }),
      expense({ description: "parcela", month_key: "2026-09", installment_month: "2026-10", payment_method: "credit" }),
      expense({ description: "fixo antigo", month_key: "2026-01", installment_month: "2026-01", category: "fixos" }),
    ]);
    const names = (await listExpensesForMonth("2026-10")).map((e) => e.description).sort();
    expect(names).toEqual(["do mes", "fixo antigo", "parcela"]);
  });

  it("gera id e datas de criacao", async () => {
    const [row] = await insertExpenses([expense()]);
    expect(row.id).toEqual(expect.any(String));
    expect(row.created_at).toEqual(expect.any(String));
  });

  it("edita e exclui com desfazer", async () => {
    const [row] = await insertExpenses([expense()]);
    await updateExpense(row.id, { amount_cents: 2500 });
    expect((await listExpensesForMonth("2026-10"))[0].amount_cents).toBe(2500);

    const removed = await deleteExpense(row.id);
    expect(await listExpensesForMonth("2026-10")).toHaveLength(0);

    await restoreRows(removed);
    await restoreRows(removed);
    const restored = await listExpensesForMonth("2026-10");
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(row.id);
  });

  it("exclui varios de uma vez, como ao desfazer uma importacao de extrato", async () => {
    const [a, b, c] = await insertExpenses([expense(), expense(), expense()]);
    const removed = await deleteExpenses([a.id, c.id]);
    expect(removed.expenses.map((e) => e.id)).toEqual([a.id, c.id]);
    expect((await listExpensesForMonth("2026-10")).map((e) => e.id)).toEqual([b.id]);
  });

  it("erra ao editar gasto inexistente", async () => {
    await expect(updateExpense("nao-existe", { amount_cents: 1 })).rejects.toThrow("Gasto não encontrado.");
  });
});

describe("receitas variaveis", () => {
  it("filtra por mes e ordena por data inicial", async () => {
    await insertVariableIncome({ month_key: "2026-10", description: "B", amount_cents: 1, date_from: "2026-10-20", date_to: "2026-10-20" });
    await insertVariableIncome({ month_key: "2026-10", description: "A", amount_cents: 1, date_from: "2026-10-02", date_to: "2026-10-02" });
    await insertVariableIncome({ month_key: "2026-11", description: "C", amount_cents: 1, date_from: "2026-11-01", date_to: "2026-11-01" });
    expect((await listVariableIncomes("2026-10")).map((v) => v.description)).toEqual(["A", "B"]);
  });
});

describe("recibos", () => {
  it("salva itens junto e apaga em cascata", async () => {
    const { receipt } = await insertReceiptWithItems(
      { month_key: "2026-10", store_name: "Mercado X", receipt_date: "2026-10-05" },
      [
        { product_name: "Arroz", quantity: 1, unit_price_cents: 2000, total_price_cents: 2000, position: 1 },
        { product_name: "Feijao", quantity: 1, unit_price_cents: 900, total_price_cents: 900, position: 0 },
      ]
    );
    const listed = await listReceiptsWithItems("2026-10");
    expect(listed.itemsByReceipt[receipt.id].map((i) => i.product_name)).toEqual(["Feijao", "Arroz"]);

    const removed = await deleteReceipt(receipt.id);
    expect(removed.receipt_items).toHaveLength(2);
    expect((await exportBackup()).data.receipt_items).toHaveLength(0);

    await restoreRows(removed);
    expect((await listReceiptsWithItems("2026-10")).itemsByReceipt[receipt.id]).toHaveLength(2);
  });
});

describe("backup", () => {
  it("exporta e importa o mesmo conteudo", async () => {
    await insertExpenses([expense()]);
    await getOrCreateIncome("2026-10");
    const backup = await exportBackup();

    window.localStorage.clear();
    const total = await importBackup(JSON.parse(JSON.stringify(backup)));
    expect(total).toBe(2);
    expect(await listExpensesForMonth("2026-10")).toHaveLength(1);
  });

  it("recusa arquivo de outro formato sem apagar os dados atuais", async () => {
    await insertExpenses([expense()]);
    await expect(importBackup({ foo: 1 })).rejects.toThrow("Arquivo não reconhecido");
    await expect(importBackup({ format: "gastos-app-backup", data: { expenses: [{ semId: true }] } })).rejects.toThrow(
      'a tabela "expenses" está malformada'
    );
    expect(await listExpensesForMonth("2026-10")).toHaveLength(1);
  });

  it("avisa quando o JSON salvo esta corrompido", async () => {
    window.localStorage.setItem(STORAGE_KEY, "{quebrado");
    await expect(listExpensesForMonth("2026-10")).rejects.toThrow("corrompidos");
  });
});

describe("avisos de vencimento", () => {
  it("guarda os ajustes e inclui no backup", async () => {
    expect(await getAlertSettings()).toBeNull();
    await saveAlertSettings({ enabled: true });
    await saveAlertSettings({ card_due_day: 10 });
    expect(await getAlertSettings()).toMatchObject({ enabled: true, card_due_day: 10 });
    expect((await exportBackup()).data.alert_settings).toHaveLength(1);
  });

  it("backup antigo, sem a tabela de avisos, continua valido", async () => {
    const { data } = await exportBackup();
    delete data.alert_settings;
    await expect(importBackup({ format: "gastos-app-backup", version: 1, data })).resolves.toBe(0);
    expect(await getAlertSettings()).toBeNull();
  });

  it("toda gravacao avisa que os dados mudaram", async () => {
    const listener = jest.fn();
    window.addEventListener(DB_CHANGED_EVENT, listener);
    await insertExpenses([expense()]);
    window.removeEventListener(DB_CHANGED_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("corrigir o vencimento de uma parcela vale para a compra inteira", async () => {
    const parcela = (i) =>
      expense({
        description: `Tv (${i}/3)`,
        payment_method: "credit",
        installments: 3,
        installment_number: i,
        installment_month: `2026-1${i}`,
      });
    const outra = expense({ description: "Sofa (1/3)", payment_method: "credit", installments: 3 });
    const [first] = await insertExpenses([parcela(1), parcela(2), parcela(3), outra]);
    await setPurchaseDueDay(first, 15);
    const rows = await listAllExpenses();
    expect(rows.map((r) => r.due_day)).toEqual([15, 15, 15, undefined]);
  });
});
