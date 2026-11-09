"use client";

import { useState } from "react";
import { CaretDown, Check, ListBullets, PencilSimple, Trash } from "@phosphor-icons/react";
import { deleteExpense, restoreRows, setPurchaseDueDay, updateExpense } from "@/lib/localDb";
import { formatDatePT, isValidISODate, todayISO } from "@/lib/dates";
import { isValidDueDay, toDueDay } from "@/lib/dueAlerts";
import { FILTERS, groupExpenses } from "@/lib/expenses";
import { formatBRLFromCents } from "@/lib/money";
import { alertsSupported } from "@/lib/nativeAlerts";
import { toSentenceCase } from "@/lib/text";
import MoneyInput from "./MoneyInput";
import { getCategory, getPaymentLabel } from "./categories";
import { Button, Card, CardHeader, ChoiceChip, EmptyState, IconButton, INPUT_CLASS, useToast } from "./ui";

function StatusBadge({ expense }) {
  if (expense.payment_method === "fixed") return null;
  return expense.is_paid ? (
    <span className="rounded-full bg-primary-pale px-2 py-0.5 text-[11px] font-medium text-primary-ink">
      Pago{expense.paid_date ? ` em ${formatDatePT(expense.paid_date)}` : ""}
    </span>
  ) : (
    <span className="rounded-full bg-warning-pale px-2 py-0.5 text-[11px] font-medium text-warning-ink">Pendente</span>
  );
}

function EditRow({ expense, busy, onSave, onCancel }) {
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(expense.amount_cents);
  const [isPaid, setIsPaid] = useState(Boolean(expense.is_paid));
  const [paidDate, setPaidDate] = useState(expense.paid_date || todayISO());
  const [dueDay, setDueDay] = useState(expense.due_day ? String(expense.due_day) : "");
  const [canAlert] = useState(alertsSupported);
  const [error, setError] = useState("");
  const idBase = `editar-${expense.id}`;
  // Fixo e um registro so que vale para todos os meses: marcar pago aqui marcaria todos
  const canTogglePaid = expense.payment_method !== "fixed";
  const asksDueDay = canAlert && (!canTogglePaid || !isPaid);

  function handleSubmit(e) {
    e.preventDefault();
    const cents = Number(amount) || 0;
    if (!description.trim()) return setError("Informe a descrição.");
    if (cents <= 0) return setError("Informe um valor maior que zero.");
    if (canTogglePaid && isPaid && !isValidISODate(paidDate)) return setError("Informe a data do pagamento.");
    if (asksDueDay && !isValidDueDay(dueDay)) return setError("Use um dia de vencimento entre 1 e 31.");
    const patch = { description: toSentenceCase(description), amount_cents: cents };
    if (canTogglePaid) Object.assign(patch, { is_paid: isPaid, paid_date: isPaid ? paidDate : null });
    if (asksDueDay) patch.due_day = toDueDay(dueDay);
    onSave(expense, patch);
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      className="mt-2 space-y-2 rounded-xl border border-line-strong bg-surface-2 p-3"
      aria-label={`Editar ${expense.description}`}
    >
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <div>
          <label htmlFor={`${idBase}-desc`} className="sr-only">
            Descrição
          </label>
          <input
            id={`${idBase}-desc`}
            autoComplete="off"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <MoneyInput id={`${idBase}-valor`} aria-label="Valor" value={amount} onChange={setAmount} />
      </div>
      {canTogglePaid && (
        <div className="flex flex-wrap items-center gap-2">
          <fieldset className="grid w-full grid-cols-2 gap-1.5 sm:w-56">
            <legend className="sr-only">Situação do pagamento</legend>
            <ChoiceChip name={`${idBase}-situacao`} value="pago" checked={isPaid} onChange={() => setIsPaid(true)}>
              <Check size={14} weight="bold" aria-hidden="true" />
              Pago
            </ChoiceChip>
            <ChoiceChip name={`${idBase}-situacao`} value="pendente" checked={!isPaid} onChange={() => setIsPaid(false)}>
              Pendente
            </ChoiceChip>
          </fieldset>
          {isPaid && (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <label htmlFor={`${idBase}-pago-em`} className="shrink-0 text-[13px] text-body">
                Pago em
              </label>
              <input
                id={`${idBase}-pago-em`}
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className={`${INPUT_CLASS} min-w-0 flex-1`}
              />
            </div>
          )}
        </div>
      )}
      {asksDueDay && (
        <div className="flex items-center gap-2">
          <label htmlFor={`${idBase}-vencimento`} className="shrink-0 text-[13px] text-body">
            Vence no dia
          </label>
          <div className="w-24">
            <input
              id={`${idBase}-vencimento`}
              inputMode="numeric"
              maxLength={2}
              autoComplete="off"
              placeholder={expense.payment_method === "credit" ? "Cartão" : "Sem dia"}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              className={`${INPUT_CLASS} num`}
            />
          </div>
        </div>
      )}
      {error && <p className="text-xs font-medium text-negative">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          <Check size={16} weight="bold" aria-hidden="true" />
          Salvar
        </Button>
      </div>
    </form>
  );
}

export default function ExpenseList({ expenses, filter, onFilterChange, onChanged, onError }) {
  const toast = useToast();
  const [editingId, setEditingId] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  const groups = groupExpenses(expenses);

  function toggleGroup(key) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleDelete(expense) {
    setBusy(true);
    try {
      const removed = await deleteExpense(expense.id);
      await onChanged();
      toast({
        message: `${expense.description} excluído.`,
        onAction: async () => {
          try {
            await restoreRows(removed);
            await onChanged();
          } catch (e) {
            onError(`Não foi possível desfazer: ${e.message}`);
          }
        },
      });
    } catch (e) {
      onError(`Não foi possível excluir: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(expense, patch) {
    setBusy(true);
    try {
      await updateExpense(expense.id, patch);
      if (patch.due_day !== undefined && patch.due_day !== (expense.due_day ?? null)) {
        await setPurchaseDueDay(expense, patch.due_day);
      }
      setEditingId(null);
      await onChanged();
      toast({ message: "Gasto atualizado." });
    } catch (e) {
      onError(`Não foi possível salvar: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  function renderActions(expense) {
    return (
      <>
        <IconButton
          label={`Editar ${expense.description}`}
          onClick={() => setEditingId(expense.id)}
          disabled={busy || editingId !== null}
        >
          <PencilSimple size={17} aria-hidden="true" />
        </IconButton>
        <IconButton
          label={`Excluir ${expense.description}`}
          variant="danger"
          onClick={() => handleDelete(expense)}
          disabled={busy || editingId !== null}
        >
          <Trash size={17} aria-hidden="true" />
        </IconButton>
      </>
    );
  }

  return (
    <Card aria-labelledby="lancamentos-titulo">
      <CardHeader
        id="lancamentos-titulo"
        title="Lançamentos"
        description={`${expenses.length} ${expenses.length === 1 ? "registro" : "registros"} no período`}
      />

      <div role="group" aria-label="Período" className="-mt-1 mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((opt) => {
          const checked = filter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={checked}
              onClick={() => onFilterChange(opt.value)}
              className={`h-8 rounded-full px-3.5 text-[13px] font-medium transition-[background-color,color] duration-150 ${
                checked ? "bg-ink text-canvas" : "bg-surface-2 text-body hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {expenses.length === 0 ? (
        <EmptyState icon={ListBullets} title="Nenhum gasto neste período">
          Adicione um gasto no formulário ao lado ou escolha outro período.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {groups.map(({ period, items }) => (
            <section key={period} aria-label={period}>
              <h3 className="mb-1 text-xs font-medium text-mute">{period}</h3>
              <ul className="divide-y divide-line">
                {items.map((e) => {
                  const { Icon, label } = getCategory(e.category);
                  const hasMultiple = e.count > 1;
                  const isExpanded = expanded.has(e.key);
                  const editing = e.items.find((item) => item.id === editingId);
                  return (
                    <li key={e.key} className="py-2.5">
                      <div className="flex items-center gap-3">
                        <span
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-body"
                          title={label}
                        >
                          <Icon size={19} aria-hidden="true" />
                          <span className="sr-only">{label}</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-ink">
                            <span className="truncate">{e.description}</span>
                            {hasMultiple && (
                              <span className="num shrink-0 rounded-full bg-surface-2 px-1.5 text-[11px] font-semibold text-body">
                                {e.count}x
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mute">
                            <span className="num">{formatDatePT(e.date)}</span>
                            <span>{getPaymentLabel(e)}</span>
                            <StatusBadge expense={e} />
                          </p>
                        </div>
                        <p className="num shrink-0 text-sm font-semibold text-ink">{formatBRLFromCents(e.amount_cents)}</p>
                        <div className="flex shrink-0 items-center">
                          {hasMultiple ? (
                            <IconButton
                              label={isExpanded ? `Recolher ${e.description}` : `Mostrar os ${e.count} registros de ${e.description}`}
                              aria-expanded={isExpanded}
                              onClick={() => toggleGroup(e.key)}
                            >
                              <CaretDown
                                size={17}
                                aria-hidden="true"
                                className={`transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`}
                              />
                            </IconButton>
                          ) : (
                            renderActions(e)
                          )}
                        </div>
                      </div>

                      {/* Linha agrupada soma varios registros: editar/excluir so nos sub-itens,
                          senao a soma do grupo seria gravada em um unico registro. */}
                      {hasMultiple && isExpanded && (
                        <ul className="ml-[3.25rem] mt-2 space-y-1 border-l border-line pl-3">
                          {e.items.map((item, idx) => (
                            <li key={item.id} className="flex items-center gap-2 text-sm">
                              <span className="flex-1 text-mute">Registro {idx + 1}</span>
                              <span className="num font-medium text-ink">{formatBRLFromCents(item.amount_cents)}</span>
                              {renderActions(item)}
                            </li>
                          ))}
                        </ul>
                      )}

                      {editing && (
                        <EditRow
                          key={editing.id}
                          expense={editing}
                          busy={busy}
                          onSave={handleSave}
                          onCancel={() => setEditingId(null)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editingId !== null && (
        <p className="sr-only" aria-live="polite">
          Editando gasto. Esc cancela.
        </p>
      )}
    </Card>
  );
}
