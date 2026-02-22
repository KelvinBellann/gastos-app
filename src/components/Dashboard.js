"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function toMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatBRLFromCents(cents) {
  const value = (cents || 0) / 100;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseBRLToCents(input) {
  // aceita "123,45" ou "123.45" ou "R$ 123,45"
  const clean = String(input).replace(/[^\d,.-]/g, "").replace(".", "").replace(",", ".");
  const num = Number(clean);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100);
}

const DEFAULT_INCOME = {
  salary_net_cents: 476538,      // 4765,38
  multibenefits_cents: 109297,   // 1092,97
  food_cents: 3805,              // 38,05
  spouse_salary_cents: 120000,   // 1200,00
};

export default function Dashboard({ session, onSignOut }) {
  const userId = session.user.id;
  const [monthKey, setMonthKey] = useState(toMonthKey());
  const [income, setIncome] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Form gasto
  const [category, setCategory] = useState("fixos");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const totals = useMemo(() => {
    const incomeTotal =
      (income?.salary_net_cents || 0) +
      (income?.multibenefits_cents || 0) +
      (income?.food_cents || 0) +
      (income?.spouse_salary_cents || 0);

    const byCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount_cents;
      return acc;
    }, {});

    const expensesTotal = expenses.reduce((s, e) => s + e.amount_cents, 0);
    const balance = incomeTotal - expensesTotal;

    return { incomeTotal, expensesTotal, balance, byCategory };
  }, [income, expenses]);

  async function load() {
    setBusy(true);
    setErr("");

    // 1) receitas do mês
    const incRes = await supabase
      .from("incomes")
      .select("*")
      .eq("user_id", userId)
      .eq("month_key", monthKey)
      .maybeSingle();

    if (incRes.error) {
      setErr(incRes.error.message);
      setBusy(false);
      return;
    }

    // se não existir, cria com padrão
    if (!incRes.data) {
      const ins = await supabase.from("incomes").insert({
        user_id: userId,
        month_key: monthKey,
        ...DEFAULT_INCOME,
      }).select("*").single();

      if (ins.error) {
        setErr(ins.error.message);
        setBusy(false);
        return;
      }
      setIncome(ins.data);
    } else {
      setIncome(incRes.data);
    }

    // 2) gastos do mês
    const expRes = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .eq("month_key", monthKey)
      .order("created_at", { ascending: false });

    if (expRes.error) setErr(expRes.error.message);
    else setExpenses(expRes.data || []);

    setBusy(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  async function addExpense() {
    setErr("");

    const cents = parseBRLToCents(amount);
    if (!description.trim()) return setErr("Descreva o gasto.");
    if (cents === null || cents <= 0) return setErr("Valor inválido.");

    setBusy(true);
    const { error } = await supabase.from("expenses").insert({
      user_id: userId,
      month_key: monthKey,
      category,
      description: description.trim(),
      amount_cents: cents,
      date: new Date().toISOString().slice(0, 10),
    });

    if (error) setErr(error.message);
    setDescription("");
    setAmount("");
    await load();
  }

  async function deleteExpense(id) {
    setBusy(true);
    setErr("");
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) setErr(error.message);
    await load();
  }

  async function updateIncomeField(field, valueStr) {
    const cents = parseBRLToCents(valueStr);
    if (cents === null || cents < 0) return;
    const next = { ...income, [field]: cents };
    setIncome(next);

    const { error } = await supabase
      .from("incomes")
      .update({ [field]: cents })
      .eq("id", income.id);

    if (error) setErr(error.message);
  }

  return (
    <main className="min-h-screen p-4 bg-gray-50">
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Seu mês: {monthKey}</h1>
            <p className="text-sm text-gray-600">Saldo = Receitas - Gastos</p>
          </div>
          <button onClick={onSignOut} className="rounded-xl border px-4 py-2 bg-white">
            Sair
          </button>
        </header>

        <section className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2 items-center">
              <label className="text-sm text-gray-600">Mês</label>
              <input
                className="border rounded-xl p-2"
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                placeholder="YYYY-MM"
              />
            </div>
            <div className="text-sm text-gray-600">
              {busy ? "Carregando..." : null}
            </div>
          </div>

          {err ? <p className="text-sm text-red-600 mt-2">{err}</p> : null}

          <div className="grid md:grid-cols-3 gap-3 mt-4">
            <Card title="Receitas" value={formatBRLFromCents(totals.incomeTotal)} />
            <Card title="Gastos" value={formatBRLFromCents(totals.expensesTotal)} />
            <Card title="Saldo" value={formatBRLFromCents(totals.balance)} />
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="text-lg font-semibold">Receitas do mês</h2>
          <p className="text-sm text-gray-600">Você pode editar os valores (salva no banco).</p>

          <div className="grid md:grid-cols-2 gap-3 mt-3">
            <MoneyField
              label="Seu salário (líquido)"
              value={income?.salary_net_cents}
              onChange={(v) => updateIncomeField("salary_net_cents", v)}
            />
            <MoneyField
              label="Multibenefícios"
              value={income?.multibenefits_cents}
              onChange={(v) => updateIncomeField("multibenefits_cents", v)}
            />
            <MoneyField
              label="Alimentação"
              value={income?.food_cents}
              onChange={(v) => updateIncomeField("food_cents", v)}
            />
            <MoneyField
              label="Salário esposa"
              value={income?.spouse_salary_cents}
              onChange={(v) => updateIncomeField("spouse_salary_cents", v)}
            />
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="text-lg font-semibold">Adicionar gasto</h2>

          <div className="grid md:grid-cols-4 gap-2 mt-3">
            <select
              className="border rounded-xl p-3"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="fixos">Fixos</option>
              <option value="mercado">Mercado</option>
              <option value="aleatorios">Aleatórios</option>
              <option value="emprestado">Emprestado</option>
            </select>

            <input
              className="border rounded-xl p-3 md:col-span-2"
              placeholder="Descrição (ex: Internet, rancho, Uber...)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <div className="flex gap-2">
              <input
                className="border rounded-xl p-3 w-full"
                placeholder="Valor (ex: 120,50)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
              />
              <button
                onClick={addExpense}
                disabled={busy}
                className="rounded-xl bg-black text-white px-4 disabled:opacity-60"
              >
                Add
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-3 mt-4">
            <MiniCard title="Fixos" value={formatBRLFromCents(totals.byCategory.fixos || 0)} />
            <MiniCard title="Mercado" value={formatBRLFromCents(totals.byCategory.mercado || 0)} />
            <MiniCard title="Aleatórios" value={formatBRLFromCents(totals.byCategory.aleatorios || 0)} />
            <MiniCard title="Emprestado" value={formatBRLFromCents(totals.byCategory.emprestado || 0)} />
          </div>

          <h3 className="text-md font-semibold mt-5">Lançamentos</h3>
          <div className="mt-2 space-y-2">
            {expenses.map((e) => (
              <div key={e.id} className="border rounded-2xl p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{e.description}</div>
                  <div className="text-sm text-gray-600">
                    {e.category} • {e.month_key}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{formatBRLFromCents(e.amount_cents)}</div>
                  <button
                    onClick={() => deleteExpense(e.id)}
                    className="rounded-xl border px-3 py-2 bg-white"
                    disabled={busy}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {expenses.length === 0 ? (
              <p className="text-sm text-gray-600">Nenhum gasto registrado neste mês.</p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ title, value }) {
  return (
    <div className="border rounded-2xl p-4 bg-gray-50">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function MiniCard({ title, value }) {
  return (
    <div className="border rounded-2xl p-3 bg-white">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function MoneyField({ label, value, onChange }) {
  const [local, setLocal] = useState("");

  useEffect(() => {
    setLocal(((value || 0) / 100).toFixed(2).replace(".", ","));
  }, [value]);

  return (
    <label className="block">
      <div className="text-sm text-gray-700">{label}</div>
      <input
        className="w-full border rounded-xl p-3 mt-1"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange(local)}
        inputMode="decimal"
      />
    </label>
  );
}