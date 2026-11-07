"use client";

import { useState } from "react";
import { Check, PiggyBank, Trash, TrendUp } from "@phosphor-icons/react";
import { deleteContribution, insertContributions, restoreRows } from "@/lib/localDb";
import { formatDatePT, todayISO } from "@/lib/dates";
import { formatBRLFromCents } from "@/lib/money";
import MoneyInput from "./MoneyInput";
import { Button, Card, CardHeader, ChoiceChip, Field, IconButton, useToast } from "./ui";

const TARGETS = [
  { value: "reserve", label: "Reserva", Icon: PiggyBank },
  { value: "invest", label: "Investimentos", Icon: TrendUp },
];

function targetLabel(t) {
  return TARGETS.find((x) => x.value === t)?.label || t;
}

export default function PlanContributions({ monthKey, planned, contributions, onChanged, onError }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [target, setTarget] = useState("reserve");
  const [kind, setKind] = useState("deposit");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const monthRows = contributions.filter((c) => c.month_key === monthKey);
  const done = {
    reserve: monthRows.filter((c) => c.target === "reserve").reduce((s, c) => s + c.amount_cents, 0),
    invest: monthRows.filter((c) => c.target === "invest").reduce((s, c) => s + c.amount_cents, 0),
  };
  const pending = {
    reserve: Math.max(0, planned.reserve - done.reserve),
    invest: Math.max(0, planned.invest - done.invest),
  };

  async function save(rows, message) {
    setSaving(true);
    try {
      await insertContributions(rows);
      await onChanged();
      toast({ message });
    } catch (e) {
      onError(`Não foi possível registrar: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function registerPlanned() {
    const rows = TARGETS.filter((t) => pending[t.value] > 0).map((t) => ({
      month_key: monthKey,
      target: t.value,
      amount_cents: pending[t.value],
      date: todayISO(),
    }));
    await save(rows, "Aportes planejados registrados.");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const cents = Number(amount) || 0;
    if (cents <= 0) return setError("Informe um valor maior que zero.");
    setError("");
    await save(
      [{ month_key: monthKey, target, amount_cents: kind === "deposit" ? cents : -cents, date: todayISO() }],
      kind === "deposit" ? `Aporte em ${targetLabel(target)} registrado.` : `Retirada de ${targetLabel(target)} registrada.`
    );
    setAmount("");
  }

  async function handleDelete(c) {
    try {
      const removed = await deleteContribution(c.id);
      await onChanged();
      toast({
        message: "Registro excluído.",
        onAction: async () => {
          await restoreRows(removed);
          await onChanged();
        },
      });
    } catch (e) {
      onError(`Não foi possível excluir: ${e.message}`);
    }
  }

  const hasPending = pending.reserve + pending.invest > 0;

  return (
    <Card aria-labelledby="aportes-titulo">
      <CardHeader
        id="aportes-titulo"
        title="Aportes do mês"
        description="Marque o que foi guardado de verdade, para comparar com o planejado."
      />

      <dl className="grid grid-cols-2 gap-2">
        {TARGETS.map(({ value, label, Icon }) => (
          <div key={value} className="rounded-xl bg-surface-2 px-3 py-2.5">
            <dt className="flex items-center gap-1.5 text-[13px] text-body">
              <Icon size={15} aria-hidden="true" />
              {label}
            </dt>
            <dd className="num mt-0.5">
              <span className="text-base font-semibold text-ink">{formatBRLFromCents(done[value])}</span>
              <span className="text-xs text-mute"> de {formatBRLFromCents(planned[value])}</span>
            </dd>
          </div>
        ))}
      </dl>

      {hasPending && (
        <Button variant="secondary" className="mt-3 w-full" onClick={registerPlanned} disabled={saving}>
          <Check size={16} weight="bold" aria-hidden="true" />
          Registrar o que falta ({formatBRLFromCents(pending.reserve + pending.invest)})
        </Button>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-3 border-t border-line pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-body">Tipo</legend>
            <div className="grid grid-cols-2 gap-1.5">
              <ChoiceChip name="aporte-tipo" value="deposit" checked={kind === "deposit"} onChange={setKind}>
                Aporte
              </ChoiceChip>
              <ChoiceChip name="aporte-tipo" value="withdraw" checked={kind === "withdraw"} onChange={setKind}>
                Retirada
              </ChoiceChip>
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-body">Onde</legend>
            <div className="grid grid-cols-2 gap-1.5">
              {TARGETS.map(({ value, label }) => (
                <ChoiceChip key={value} name="aporte-destino" value={value} checked={target === value} onChange={setTarget}>
                  <span className="truncate">{label}</span>
                </ChoiceChip>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="flex items-end gap-2">
          <Field label="Valor" htmlFor="aporte-valor" error={error} className="flex-1">
            <MoneyInput id="aporte-valor" value={amount} onChange={setAmount} aria-invalid={Boolean(error)} />
          </Field>
          <Button type="submit" disabled={saving} className={error ? "mb-5" : ""}>
            Registrar
          </Button>
        </div>
      </form>

      {monthRows.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {monthRows.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="text-ink">
                  {c.amount_cents < 0 ? "Retirada de" : "Aporte em"} {targetLabel(c.target)}
                </p>
                <p className="num text-xs text-mute">{formatDatePT(c.date)}</p>
              </div>
              <span className={`num font-semibold ${c.amount_cents < 0 ? "text-negative" : "text-positive"}`}>
                {formatBRLFromCents(c.amount_cents)}
              </span>
              <IconButton label="Excluir registro" variant="danger" onClick={() => handleDelete(c)}>
                <Trash size={16} aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
