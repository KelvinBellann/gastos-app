import { buildAlertSchedule } from "@/lib/dueAlerts";
import { getAlertSettings, listAllExpenses } from "@/lib/localDb";

// Ponte com o lado nativo (ios/Sources/GastosApp/DueAlerts.swift). So existe dentro do
// app iOS: no navegador nao ha como agendar um aviso com o site fechado.
const REPLY_EVENT = "gastos-alerts";

function handler() {
  return window.webkit?.messageHandlers?.dueAlerts;
}

export function alertsSupported() {
  return Boolean(handler());
}

let nextId = 0;

function call(action, payload) {
  return new Promise((resolve) => {
    const id = ++nextId;
    function onReply(event) {
      if (event.detail?.id !== id) return;
      window.removeEventListener(REPLY_EVENT, onReply);
      resolve(event.detail);
    }
    window.addEventListener(REPLY_EVENT, onReply);
    handler().postMessage({ action, id, ...payload });
  });
}

// "granted", "denied" ou "undetermined"
export async function getAlertStatus() {
  return (await call("status")).status;
}

export async function requestAlertPermission() {
  return (await call("enable")).status;
}

export async function sendTestAlert() {
  return (
    await call("test", {
      title: "Teste de aviso",
      body: "Os avisos de vencimento do Gastos estão funcionando.",
    })
  ).status;
}

async function runSync() {
  const [expenses, settings] = await Promise.all([listAllExpenses(), getAlertSettings()]);
  return call("sync", { alerts: buildAlertSchedule(expenses, settings) });
}

// Uma sincronizacao por vez: o nativo apaga e recria a lista inteira, e duas ao mesmo
// tempo poderiam deixar para tras o aviso de uma conta que acabou de ser apagada.
let queue = Promise.resolve();

export function syncDueAlerts() {
  if (!alertsSupported()) return Promise.resolve(null);
  const run = queue.then(runSync);
  queue = run.catch(() => {});
  return run;
}
