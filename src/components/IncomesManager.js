"use client";

import { useEffect, useState } from "react";
import { Plus, Trash, X } from "@phosphor-icons/react";
import { deleteVariableIncome, insertVariableIncome, listVariableIncomes, restoreRows } from "@/lib/localDb";
import { todayISO, formatDatePT, isValidISODate } from "@/lib/dates";
import { formatBRLFromCents, sumCents } from "@/lib/money";
import { toSentenceCase } from "@/lib/text";
import MoneyInput from "./MoneyInput";
import { Button, Card, CardHeader, Field, IconButton, INPUT_CLASS, useToast } from "./ui";

const FIXED_FIELDS = [
  { field: "salary_net_cents", label: "Seu salário" },
  { field: "multibenefits_cents", label: "Multibenefícios" },
  { field: "food_cents", label: "Alimentação" },
  { field: "spouse_salary_cents", label: "Salário da esposa" },
];

function emptyVariable() {
  return { description: "", amount: "", date_from: todayISO(), date_to: todayISO() };
}

export default function IncomesManager({ monthKey, income, onUpdate, onVariableTotalChange, onError }) {
  const toast = useToast();
  const [variableIncomes, setVariableIncomes] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState(emptyVariable);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function loadVariableIncomes() {
    try {
      const rows = await listVariableIncomes(monthKey);
      setVariableIncomes(rows);
      // O Dashboard precisa do total para o Saldo bater com o "Total de receitas" daqui
      onVariableTotalChange?.(sumCents(rows));
    } catch (e) {
      onError?.(e.message);
    }
  }

  useEffect(() => {
    loadVariableIncomes();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega so ao trocar de mes
  }, [monthKey]);

  async function handleAdd(e) {
    e.preventDefault();
    const amount = Number(draft.amount) || 0;
    const next = {};
    if (!draft.description.trim()) next.description = "Informe a origem, por exemplo: bônus.";
    if (amount <= 0) next.amount = "Informe um valor maior que zero.";
    if (!isValidISODate(draft.date_from)) next.date_from = "Data inválida.";
    if (!isValidISODate(draft.date_to)) next.date_to = "Data inválida.";
    // Datas ISO comparam como texto; new Date("YYYY-MM-DD") usaria UTC
    else if (isValidISODate(draft.date_from) && draft.date_from > draft.date_to) {
      next.date_to = "A data final precisa ser igual ou depois da inicial.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await insertVariableIncome({
        month_key: monthKey,
        description: toSentenceCase(draft.description),
        amount_cents: amount,
        date_from: draft.date_from,
        date_to: draft.date_to,
      });
      setDraft(emptyVariable());
      setShowAdd(false);
      await loadVariableIncomes();
      toast({ message: "Receita variável adicionada." });
    } catch (err) {
      onError?.(`Não foi possível salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(v) {
    try {
      const removed = await deleteVariableIncome(v.id);
      await loadVariableIncomes();
      toast({
        message: `${v.description} excluída.`,
        onAction: async () => {
          await restoreRows(removed);
          await loadVariableIncomes();
        },
      });
    } catch (err) {
      onError?.(`Não foi possível excluir: ${err.message}`);
    }
  }

  const totalFixed = FIXED_FIELDS.reduce((s, { field }) => s + (income?.[field] || 0), 0);
  const totalVariable = sumCents(variableIncomes);

  return (
    <Card aria-labelledby="receitas-titulo">
      <CardHeader
        id="receitas-titulo"
        title="Receitas"
        description="Fixas se repetem todo mês. Variáveis valem só para este mês."
      />

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        {FIXED_FIELDS.map(({ field, label }) => (
          <MoneyInput
            key={field}
            id={`receita-${field}`}
            name={field}
            label={label}
            value={income?.[field] || 0}
            disabled={!income}
            onChange={(cents) => income && onUpdate({ ...income, [field]: Number(cents) || 0 })}
          />
        ))}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Variáveis</h3>
          <Button variant="secondary" size="sm" onClick={() => setShowAdd((v) => !v)} aria-expanded={showAdd}>
            {showAdd ? <X size={16} aria-hidden="true" /> : <Plus size={16} weight="bold" aria-hidden="true" />}
            {showAdd ? "Cancelar" : "Adicionar"}
          </Button>
        </div>

        {showAdd && (
          <form onSubmit={handleAdd} noValidate className="mb-4 space-y-3 rounded-xl bg-surface-2 p-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <Field label="Origem" htmlFor="variavel-descricao" error={errors.description}>
                <input
                  id="variavel-descricao"
                  name="origem"
                  autoComplete="off"
                  placeholder="Ex.: bônus, freela..."
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  aria-invalid={Boolean(errors.description)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Valor" htmlFor="variavel-valor" error={errors.amount}>
                <MoneyInput
                  id="variavel-valor"
                  name="valor"
                  value={draft.amount}
                  onChange={(cents) => setDraft({ ...draft, amount: cents })}
                  aria-invalid={Boolean(errors.amount)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="De" htmlFor="variavel-de" error={errors.date_from}>
                <input
                  id="variavel-de"
                  type="date"
                  value={draft.date_from}
                  onChange={(e) => setDraft({ ...draft, date_from: e.target.value })}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Até" htmlFor="variavel-ate" error={errors.date_to}>
                <input
                  id="variavel-ate"
                  type="date"
                  value={draft.date_to}
                  onChange={(e) => setDraft({ ...draft, date_to: e.target.value })}
                  aria-invalid={Boolean(errors.date_to)}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Salvando..." : "Salvar receita"}
            </Button>
          </form>
        )}

        {variableIncomes.length === 0 ? (
          <p className="text-[13px] text-mute">Nenhuma receita variável neste mês.</p>
        ) : (
          <ul className="divide-y divide-line">
            {variableIncomes.map((v) => (
              <li key={v.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{v.description}</p>
                  <p className="num text-xs text-mute">
                    {formatDatePT(v.date_from)} até {formatDatePT(v.date_to)}
                  </p>
                </div>
                <p className="num text-sm font-semibold text-positive">{formatBRLFromCents(v.amount_cents)}</p>
                <IconButton label={`Excluir ${v.description}`} variant="danger" onClick={() => handleDelete(v)}>
                  <Trash size={17} aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-primary-pale p-3 text-primary-ink">
        <div>
          <dt className="text-xs">Fixas</dt>
          <dd className="num text-sm font-semibold">{formatBRLFromCents(totalFixed)}</dd>
        </div>
        <div>
          <dt className="text-xs">Variáveis</dt>
          <dd className="num text-sm font-semibold">{formatBRLFromCents(totalVariable)}</dd>
        </div>
        <div>
          <dt className="text-xs">Total</dt>
          <dd className="num text-sm font-semibold">{formatBRLFromCents(totalFixed + totalVariable)}</dd>
        </div>
      </dl>
    </Card>
  );
}
