"use client";

import { useEffect, useRef, useState } from "react";
import { BellRinging, X } from "@phosphor-icons/react";
import {
  ALERT_LEADS,
  DEFAULT_ALERT_SETTINGS,
  DUE_HOUR,
  buildAlertSchedule,
  countUndatedInstallments,
  isValidDueDay,
  toDueDay,
} from "@/lib/dueAlerts";
import { getAlertSettings, listAllExpenses, saveAlertSettings } from "@/lib/localDb";
import { getAlertStatus, requestAlertPermission, sendTestAlert } from "@/lib/nativeAlerts";
import { Banner, Button, Field, IconButton, INPUT_CLASS } from "./ui";

const PREVIEW_COUNT = 5;

const WHEN_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default function DueAlertsDialog({ onClose }) {
  const [settings, setSettings] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [status, setStatus] = useState(null);
  const [dayText, setDayText] = useState("");
  const [dayError, setDayError] = useState("");
  const [error, setError] = useState("");
  const [testSent, setTestSent] = useState(false);
  const [now] = useState(() => new Date());
  const dialogRef = useRef(null);

  // Dialogo nativo: foco preso dentro, Esc fecha e o fundo fica inerte
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [row, all, current] = await Promise.all([getAlertSettings(), listAllExpenses(), getAlertStatus()]);
        if (cancelled) return;
        const merged = { ...DEFAULT_ALERT_SETTINGS, ...row };
        setSettings(merged);
        setExpenses(all);
        setStatus(current);
        setDayText(merged.card_due_day ? String(merged.card_due_day) : "");
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(patch) {
    setSettings((prev) => ({ ...prev, ...patch }));
    try {
      await saveAlertSettings(patch);
    } catch (e) {
      setError(`Não foi possível salvar: ${e.message}`);
    }
  }

  async function handleToggle(checked) {
    setError("");
    if (!checked) {
      await save({ enabled: false });
      return;
    }
    const result = await requestAlertPermission();
    setStatus(result);
    if (result === "granted") await save({ enabled: true });
  }

  // Grava a cada digitacao: no iOS tocar em Fechar nao tira o foco do campo, e um
  // salvamento no blur perderia o dia informado
  function handleDayChange(text) {
    setDayText(text);
    if (!isValidDueDay(text)) {
      setDayError("Use um dia entre 1 e 31.");
      return;
    }
    setDayError("");
    save({ card_due_day: toDueDay(text) });
  }

  function toggleLead(value) {
    const leads = settings.leads.includes(value)
      ? settings.leads.filter((lead) => lead !== value)
      : [...settings.leads, value];
    save({ leads });
  }

  async function handleTest() {
    setStatus(await sendTestAlert());
    setTestSent(true);
  }

  const schedule = settings ? buildAlertSchedule(expenses, settings, now) : [];
  const undated = settings ? countUndatedInstallments(expenses, settings, now) : 0;
  const twelveHoursBefore = DUE_HOUR - 12;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="avisos-titulo"
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      onClick={(e) => e.target === dialogRef.current && onClose?.()}
      className="m-auto w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-2xl bg-surface p-0 text-ink shadow-soft backdrop:bg-black/50 animate-rise"
    >
      <div
        className="flex flex-col"
        style={{ maxHeight: "calc(100dvh - 2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <h2 id="avisos-titulo" className="flex-1 text-base font-semibold">
            Avisos de vencimento
          </h2>
          <IconButton label="Fechar" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5">
          {error && <Banner>{error}</Banner>}
          {status === "denied" && (
            <Banner>O iPhone está bloqueando os avisos. Libere nos Ajustes do iPhone, em Notificações do app Gastos.</Banner>
          )}

          {settings && (
            <>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => handleToggle(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[var(--focus)]"
                />
                <span>
                  <span className="font-medium text-ink">Receber avisos no iPhone</span>
                  <span className="block text-xs text-mute">Chegam mesmo com o app fechado e não precisam de internet.</span>
                </span>
              </label>

              <Field
                label="Dia de vencimento do cartão"
                htmlFor="avisos-dia-cartao"
                hint="Vale para as parcelas sem um dia próprio."
                error={dayError}
              >
                <input
                  id="avisos-dia-cartao"
                  inputMode="numeric"
                  maxLength={2}
                  autoComplete="off"
                  placeholder="Ex.: 10"
                  value={dayText}
                  onChange={(e) => handleDayChange(e.target.value)}
                  aria-invalid={Boolean(dayError)}
                  aria-describedby={dayError ? "avisos-dia-cartao-error" : "avisos-dia-cartao-hint"}
                  className={`${INPUT_CLASS} num`}
                />
              </Field>

              {undated > 0 && (
                <Banner tone="info">
                  {undated === 1 ? "1 parcela está sem" : `${undated} parcelas estão sem`} dia de vencimento. Informe o dia do
                  cartão para receber os avisos.
                </Banner>
              )}

              <div>
                <p id="avisos-antecedencia" className="mb-1.5 text-[13px] font-medium text-body">
                  Avisar quando faltar
                </p>
                <div role="group" aria-labelledby="avisos-antecedencia" className="flex flex-wrap gap-1.5">
                  {ALERT_LEADS.map((lead) => {
                    const pressed = settings.leads.includes(lead.value);
                    return (
                      <button
                        key={lead.value}
                        type="button"
                        aria-pressed={pressed}
                        onClick={() => toggleLead(lead.value)}
                        className={`h-9 rounded-full px-3.5 text-[13px] font-medium transition-[background-color,color] duration-150 ${
                          pressed ? "bg-ink text-canvas" : "bg-surface-2 text-body hover:text-ink"
                        }`}
                      >
                        {lead.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-mute">
                  A contagem vai até as {DUE_HOUR}h do dia do vencimento: 12 horas antes é às {twelveHoursBefore}h do dia.
                </p>
              </div>

              <section aria-labelledby="avisos-proximos">
                <h3 id="avisos-proximos" className="text-[13px] font-medium text-body">
                  Próximos avisos
                </h3>
                {schedule.length === 0 ? (
                  <p className="mt-1.5 text-[13px] text-mute">
                    {settings.enabled
                      ? "Nenhum aviso a enviar. Parcelas e contas pendentes com vencimento aparecem aqui."
                      : "Ligue os avisos para ver o que será enviado."}
                  </p>
                ) : (
                  <ul className="mt-1 divide-y divide-line">
                    {schedule.slice(0, PREVIEW_COUNT).map((alert) => (
                      <li key={alert.id} className="py-2">
                        <p className="flex items-baseline justify-between gap-3 text-sm font-medium text-ink">
                          <span>{alert.title}</span>
                          <span className="num shrink-0 text-xs font-normal text-mute">
                            {WHEN_FORMAT.format(new Date(alert.fireAt))}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[13px] text-mute">{alert.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {schedule.length > PREVIEW_COUNT && (
                  <p className="mt-1 text-xs text-mute">E mais {schedule.length - PREVIEW_COUNT} agendados.</p>
                )}
              </section>

              <div>
                <Button variant="secondary" className="w-full" onClick={handleTest} disabled={status !== "granted"}>
                  <BellRinging size={18} aria-hidden="true" />
                  Enviar aviso de teste
                </Button>
                <p role="status" className="mt-1.5 text-xs text-mute">
                  {testSent ? "O aviso chega em 5 segundos, com o app aberto ou fechado." : ""}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
