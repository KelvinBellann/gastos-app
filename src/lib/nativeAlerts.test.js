import { alertsSupported, getAlertStatus, sendTestAlert, syncDueAlerts } from "./nativeAlerts";
import { insertExpenses, saveAlertSettings } from "./localDb";

let messages;

function installNative(status = "granted") {
  messages = [];
  window.webkit = {
    messageHandlers: {
      dueAlerts: {
        postMessage(message) {
          messages.push(message);
          Promise.resolve().then(() =>
            window.dispatchEvent(new CustomEvent("gastos-alerts", { detail: { id: message.id, status } }))
          );
        },
      },
    },
  };
}

function nextYearParcel() {
  const year = new Date().getFullYear() + 1;
  return {
    description: "Geladeira (1/3)",
    amount_cents: 25000,
    payment_method: "credit",
    is_paid: false,
    month_key: `${year}-01`,
    installment_month: `${year}-02`,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  delete window.webkit;
});

describe("ponte com o iOS", () => {
  it("no navegador nao existe e nao sincroniza", async () => {
    expect(alertsSupported()).toBe(false);
    await expect(syncDueAlerts()).resolves.toBeNull();
  });

  it("devolve a situacao da permissao", async () => {
    installNative("denied");
    expect(alertsSupported()).toBe(true);
    await expect(getAlertStatus()).resolves.toBe("denied");
    expect(messages[0].action).toBe("status");
  });

  it("envia o teste com titulo e texto", async () => {
    installNative();
    await sendTestAlert();
    expect(messages[0]).toMatchObject({ action: "test", title: "Teste de aviso" });
  });

  it("envia os avisos calculados a partir do banco local", async () => {
    installNative();
    await insertExpenses([nextYearParcel()]);
    await saveAlertSettings({ enabled: true, card_due_day: 10 });
    await syncDueAlerts();
    expect(messages[0].action).toBe("sync");
    expect(messages[0].alerts).toHaveLength(3);
    expect(messages[0].alerts[0]).toEqual({
      id: expect.stringMatching(/-02-10-3d$/),
      fireAt: expect.any(Number),
      title: "Faltam 3 dias para pagar",
      body: expect.stringContaining("Geladeira (1/3)"),
    });
  });

  it("desligado manda lista vazia, para o nativo apagar o que estava agendado", async () => {
    installNative();
    await insertExpenses([nextYearParcel()]);
    await saveAlertSettings({ enabled: false, card_due_day: 10 });
    await syncDueAlerts();
    expect(messages[0]).toMatchObject({ action: "sync", alerts: [] });
  });

  it("sincroniza uma de cada vez e a ultima le os dados mais novos", async () => {
    installNative();
    await saveAlertSettings({ enabled: true, card_due_day: 10 });
    const first = syncDueAlerts();
    const second = syncDueAlerts();
    await insertExpenses([nextYearParcel()]);
    await Promise.all([first, second]);
    expect(messages).toHaveLength(2);
    expect(messages[1].alerts).toHaveLength(3);
  });
});
