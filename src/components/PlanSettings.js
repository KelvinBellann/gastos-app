"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { formatBRLFromCents } from "@/lib/money";
import MoneyInput from "./MoneyInput";
import { Button, Field, INPUT_CLASS } from "./ui";

// Campo numerico que aceita virgula e so grava quando o valor e valido e esta no intervalo
function NumberField({ id, label, hint, value, min, max, suffix, onCommit }) {
  const [text, setText] = useState(String(value).replace(".", ","));
  const [prev, setPrev] = useState(value);
  const [error, setError] = useState("");

  if (value !== prev) {
    setPrev(value);
    setText(String(value).replace(".", ","));
  }

  function commit() {
    const n = Number(text.replace(",", "."));
    if (text.trim() === "" || Number.isNaN(n) || n < min || n > max) {
      setError(`Use um número entre ${String(min).replace(".", ",")} e ${String(max).replace(".", ",")}.`);
      return;
    }
    setError("");
    if (n !== value) onCommit(n);
  }

  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          aria-invalid={Boolean(error)}
          className={`${INPUT_CLASS} num pr-14`}
        />
        <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-mute">
          {suffix}
        </span>
      </div>
    </Field>
  );
}

export default function PlanSettings({ settings, onSave, lastMonthEssentials, suggestedEssentials }) {
  const [open, setOpen] = useState(settings.essentials_budget_cents === null);
  const essentialsSet = settings.essentials_budget_cents !== null;

  return (
    <section aria-labelledby="ajustes-titulo" className="rounded-2xl border border-line bg-surface">
      <h2 id="ajustes-titulo">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="ajustes-corpo"
          className="flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left text-base font-semibold tracking-tight sm:p-5"
        >
          Ajustes do plano
          <CaretDown
            size={18}
            aria-hidden="true"
            className={`text-mute transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h2>

      {open && (
        <div id="ajustes-corpo" className="space-y-5 px-4 pb-5 sm:px-5">
          <div className="space-y-2">
            <MoneyInput
              id="plano-essenciais"
              label="Contas essenciais por mês"
              value={settings.essentials_budget_cents ?? ""}
              onChange={(cents) => onSave({ essentials_budget_cents: cents === "" ? null : Number(cents) })}
              aria-describedby="plano-essenciais-ajuda"
            />
            <p id="plano-essenciais-ajuda" className="text-xs text-mute">
              Aluguel, contas, mercado, farmácia, carro e gatos. Saem antes de qualquer divisão.
              {!essentialsSet && ` Sem valor definido, o plano usa 50% da renda base (${formatBRLFromCents(suggestedEssentials)}).`}
            </p>
            {lastMonthEssentials > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onSave({ essentials_budget_cents: lastMonthEssentials })}
              >
                Usar o gasto real do mês anterior: {formatBRLFromCents(lastMonthEssentials)}
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <NumberField
              id="plano-lazer"
              label="Lazer na sobra"
              hint="O resto vai para o futuro."
              value={settings.leisure_share_pct}
              min={0}
              max={100}
              suffix="%"
              onCommit={(n) => onSave({ leisure_share_pct: Math.round(n) })}
            />
            <NumberField
              id="plano-reserva-meses"
              label="Reserva"
              hint="Meses de essenciais."
              value={settings.reserve_months}
              min={1}
              max={24}
              suffix="meses"
              onCommit={(n) => onSave({ reserve_months: Math.round(n) })}
            />
            <NumberField
              id="plano-taxa"
              label="Rendimento real"
              hint="Já descontada a inflação."
              value={settings.real_rate_monthly_pct}
              min={0.05}
              max={2}
              suffix="% a.m."
              onCommit={(n) => onSave({ real_rate_monthly_pct: n })}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.extra_to_future}
              onChange={(e) => onSave({ extra_to_future: e.target.checked })}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[var(--focus)]"
            />
            <span>
              <span className="font-medium text-ink">Receitas variáveis vão inteiras para o futuro</span>
              <span className="block text-xs text-mute">
                Bônus e extras não aumentam o lazer do mês. Desligado, eles entram na divisão normal.
              </span>
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyInput
              id="plano-saldo-reserva"
              label="Reserva que já existia"
              value={settings.reserve_initial_cents}
              onChange={(cents) => onSave({ reserve_initial_cents: Number(cents) || 0 })}
            />
            <MoneyInput
              id="plano-saldo-investimentos"
              label="Investimentos que já existiam"
              value={settings.invest_initial_cents}
              onChange={(cents) => onSave({ invest_initial_cents: Number(cents) || 0 })}
            />
          </div>
        </div>
      )}
    </section>
  );
}
