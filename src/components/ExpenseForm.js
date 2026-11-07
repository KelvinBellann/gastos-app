"use client";

import { useRef, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { insertExpenses } from "@/lib/localDb";
import { todayISO, isValidISODate } from "@/lib/dates";
import { addMonths, buildExpenseEntries, monthLabel, splitInstallments } from "@/lib/expenses";
import { formatBRLFromCents } from "@/lib/money";
import { toSentenceCase } from "@/lib/text";
import MoneyInput from "./MoneyInput";
import { CATEGORIES, PAYMENT_METHODS } from "./categories";
import { Button, Card, CardHeader, ChoiceChip, Field, INPUT_CLASS, useToast } from "./ui";

const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 5, 6, 10, 12];

export default function ExpenseForm({ monthKey, onSaved, onError }) {
  const toast = useToast();
  const [category, setCategory] = useState("mercado");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("debit");
  const [installments, setInstallments] = useState(1);
  const [isPaid, setIsPaid] = useState(false);
  const [paidDate, setPaidDate] = useState(todayISO);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const descriptionRef = useRef(null);
  const amountRef = useRef(null);

  const cents = Number(amount) || 0;
  const isFixed = category === "fixos";
  const isCredit = !isFixed && paymentMethod === "credit";

  function validate() {
    const next = {};
    if (!description.trim()) next.description = "Informe o que foi gasto, por exemplo: almoço.";
    if (!Number.isInteger(cents) || cents <= 0) next.amount = "Informe um valor maior que zero.";
    if (!isFixed && !isCredit && isPaid && !isValidISODate(paidDate)) next.paidDate = "Informe a data do pagamento.";
    setErrors(next);
    if (next.description) descriptionRef.current?.focus();
    else if (next.amount) amountRef.current?.focus();
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const entries = buildExpenseEntries({
        monthKey,
        category,
        description,
        amountCents: cents,
        paymentMethod,
        installments,
        isPaid,
        paidDate,
        date: todayISO(),
      });
      await insertExpenses(entries);
      setDescription("");
      setAmount("");
      setPaymentMethod("debit");
      setInstallments(1);
      setIsPaid(false);
      setPaidDate(todayISO());
      setErrors({});
      toast({
        message:
          entries.length > 1
            ? `${entries.length} parcelas de ${toSentenceCase(description)} adicionadas.`
            : `${toSentenceCase(description)} adicionado.`,
      });
      await onSaved?.();
      descriptionRef.current?.focus();
    } catch (err) {
      onError?.(`Não foi possível salvar o gasto: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const installmentValue = isCredit && cents > 0 ? splitInstallments(cents, installments)[0] : 0;

  return (
    <Card aria-labelledby="novo-gasto-titulo">
      <CardHeader id="novo-gasto-titulo" title="Novo gasto" />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field label="Descrição" htmlFor="gasto-descricao" error={errors.description}>
            <input
              ref={descriptionRef}
              id="gasto-descricao"
              name="descricao"
              autoComplete="off"
              placeholder="Ex.: almoço, gasolina..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? "gasto-descricao-error" : undefined}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Valor" htmlFor="gasto-valor" error={errors.amount}>
            <MoneyInput
              ref={amountRef}
              id="gasto-valor"
              name="valor"
              value={amount}
              onChange={setAmount}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errors.amount ? "gasto-valor-error" : undefined}
            />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-body">Categoria</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {CATEGORIES.map(({ value, label, Icon }) => (
              <ChoiceChip key={value} name="categoria" value={value} checked={category === value} onChange={setCategory}>
                <Icon size={16} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{label}</span>
              </ChoiceChip>
            ))}
          </div>
        </fieldset>

        {isFixed ? (
          <p className="rounded-xl bg-primary-pale px-3 py-2.5 text-[13px] text-primary-ink">
            Gastos fixos aparecem em todos os meses e contam como pagos.
          </p>
        ) : (
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-medium text-body">Pagamento</legend>
              <div className="grid grid-cols-3 gap-1.5">
                {PAYMENT_METHODS.map(({ value, label, Icon }) => (
                  <ChoiceChip
                    key={value}
                    name="pagamento"
                    value={value}
                    checked={paymentMethod === value}
                    onChange={setPaymentMethod}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {label}
                  </ChoiceChip>
                ))}
              </div>
            </fieldset>

            {isCredit ? (
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-medium text-body">Parcelas</legend>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                  {INSTALLMENT_OPTIONS.map((n) => (
                    <ChoiceChip
                      key={n}
                      name="parcelas"
                      value={n}
                      checked={installments === n}
                      onChange={(v) => setInstallments(Number(v))}
                    >
                      <span className="num">{n}x</span>
                    </ChoiceChip>
                  ))}
                </div>
                {cents > 0 && (
                  <p className="num mt-2 text-[13px] text-mute">
                    {installments}x de {formatBRLFromCents(installmentValue)}, a primeira em{" "}
                    {monthLabel(addMonths(monthKey, 1))}.
                  </p>
                )}
              </fieldset>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex h-11 cursor-pointer items-center gap-2.5 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="pago"
                    checked={isPaid}
                    onChange={(e) => setIsPaid(e.target.checked)}
                    className="h-5 w-5 cursor-pointer rounded accent-[var(--focus)]"
                  />
                  Já foi pago
                </label>
                {isPaid && (
                  <Field label="Data do pagamento" htmlFor="gasto-pago-em" error={errors.paidDate} className="min-w-40 flex-1">
                    <input
                      id="gasto-pago-em"
                      name="pago_em"
                      type="date"
                      value={paidDate}
                      onChange={(e) => setPaidDate(e.target.value)}
                      aria-invalid={Boolean(errors.paidDate)}
                      className={INPUT_CLASS}
                    />
                  </Field>
                )}
              </div>
            )}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={saving}>
          <Plus size={18} weight="bold" aria-hidden="true" />
          {saving ? "Salvando..." : "Adicionar gasto"}
        </Button>
      </form>
    </Card>
  );
}
