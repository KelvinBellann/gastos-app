"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function toMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthKeyToDate(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

function monthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatBRLFromCents(cents) {
  const value = (cents || 0) / 100;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseBRLToCents(input) {
  const clean = String(input).replace(/[^\d,.-]/g, "").replace(".", "").replace(",", ".");
  const num = Number(clean);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100);
}

const DEFAULT_INCOME = {
  salary_net_cents: 0,
  multibenefits_cents: 0,
  food_cents: 0,
  spouse_salary_cents: 0,
};

const CATEGORIES = [
  { value: "fixos", label: "Fixos", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "mercado", label: "Mercado", color: "bg-green-100 text-green-700 border-green-300" },
  { value: "aleatorios", label: "Aleatórios", color: "bg-orange-100 text-orange-700 border-orange-300" },
  { value: "emprestado", label: "Emprestado", color: "bg-purple-100 text-purple-700 border-purple-300" },
  { value: "gatos", label: "Gatos", color: "bg-pink-100 text-pink-700 border-pink-300" },
  { value: "lanches", label: "Lanches", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: "dinheiro", label: "Dinheiro", color: "bg-gray-100 text-gray-700 border-gray-300" },
  { value: "carro", label: "Carro", color: "bg-indigo-100 text-indigo-700 border-indigo-300" },
  { value: "farmacia", label: "Farmácia", color: "bg-red-100 text-red-700 border-red-300" },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

export default function Dashboard({ session, onSignOut }) {
  const userId = session.user.id;
  const [monthKey, setMonthKey] = useState(toMonthKey());
  const [income, setIncome] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [category, setCategory] = useState("fixos");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

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

    if (!incRes.data) {
      const ins = await supabase
        .from("incomes")
        .insert({
          user_id: userId,
          month_key: monthKey,
          ...DEFAULT_INCOME,
        })
        .select("*")
        .single();

      if (ins.error) {
        setErr(ins.error.message);
        setBusy(false);
        return;
      }
      setIncome(ins.data);
    } else {
      setIncome(incRes.data);
    }

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
    setSuccessMsg("");

    const cents = parseBRLToCents(amount);
    if (!description.trim()) return setErr("Descreva o gasto.");
    if (cents === null || cents <= 0) return setErr("Valor inválido.");

    setBusy(true);
    try {
      const { error } = await supabase.from("expenses").insert({
        user_id: userId,
        month_key: monthKey,
        category,
        description: description.trim(),
        amount_cents: cents,
        date: new Date().toISOString().slice(0, 10),
      });

      if (error) {
        setErr(error.message);
      } else {
        setDescription("");
        setAmount("");
        setSuccessMsg("✓ Gasto adicionado!");
        setTimeout(() => setSuccessMsg(""), 2000);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteExpense(id) {
    if (!window.confirm("Tem certeza que deseja excluir este gasto?")) return;

    setBusy(true);
    setErr("");
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) setErr(error.message);
      await load();
    } finally {
      setBusy(false);
    }
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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="gradient-primary shadow-lg text-white">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">💰 Controle de Gastos</h1>
            <p className="text-indigo-100 text-sm mt-1">
              {monthLabel(monthKey)} • {session.user.email}
            </p>
          </div>
          <button
            onClick={onSignOut}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition font-medium"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Mês selector */}
        <div className="flex gap-2 items-center bg-white rounded-xl shadow p-3">
          <label className="text-sm font-medium text-gray-700">Mês:</label>
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {busy && <span className="text-sm text-gray-500 ml-auto">Carregando...</span>}
        </div>

        {/* Error & Success */}
        {err && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
            {err}
          </div>
        )}
        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-sm">
            {successMsg}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-2xl shadow-lg p-6 text-white">
            <p className="text-sm opacity-90">Receitas</p>
            <p className="text-3xl font-bold mt-2">{formatBRLFromCents(totals.incomeTotal)}</p>
          </div>
          <div className="bg-gradient-to-br from-red-400 to-red-600 rounded-2xl shadow-lg p-6 text-white">
            <p className="text-sm opacity-90">Gastos</p>
            <p className="text-3xl font-bold mt-2">{formatBRLFromCents(totals.expensesTotal)}</p>
          </div>
          <div
            className={`bg-gradient-to-br rounded-2xl shadow-lg p-6 text-white ${
              totals.balance >= 0
                ? "from-blue-400 to-blue-600"
                : "from-orange-400 to-orange-600"
            }`}
          >
            <p className="text-sm opacity-90">Saldo</p>
            <p className="text-3xl font-bold mt-2">{formatBRLFromCents(totals.balance)}</p>
          </div>
        </div>

        {/* Receitas Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Receitas do mês</h2>
          <p className="text-sm text-gray-600 mb-4">Edite os valores (salva automaticamente no banco)</p>
          <div className="grid md:grid-cols-2 gap-4">
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
        </div>

        {/* Add Expense Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Adicionar gasto</h2>
          <div className="space-y-3">
            <div className="grid md:grid-cols-4 gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>

              <input
                placeholder="Descrição (ex: Internet)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="border border-gray-300 rounded-lg p-3 md:col-span-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <div className="flex gap-2">
                <input
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  className="border border-gray-300 rounded-lg p-3 flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={addExpense}
                  disabled={busy}
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 rounded-lg font-medium hover:shadow-lg transition disabled:opacity-60"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>

          {/* Category Totals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
            {CATEGORIES.map((cat) => (
              <div
                key={cat.value}
                className={`${cat.color} border rounded-lg p-3 text-center text-sm font-medium`}
              >
                <p>{cat.label}</p>
                <p className="text-lg font-bold mt-1">
                  {formatBRLFromCents(totals.byCategory[cat.value] || 0)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Expenses List */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Lançamentos</h2>
          <div className="space-y-2">
            {expenses.map((e) => {
              const catInfo = CATEGORY_MAP[e.category] || { label: e.category, color: "" };
              return (
                <div
                  key={e.id}
                  className="border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:shadow-md transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900">{e.description}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`${catInfo.color} border text-xs px-2 py-1 rounded-full`}>
                        {catInfo.label}
                      </span>
                      <span className="text-xs text-gray-500">{e.month_key}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-bold text-lg text-gray-900 min-w-max">
                      {formatBRLFromCents(e.amount_cents)}
                    </div>
                    <button
                      onClick={() => deleteExpense(e.id)}
                      disabled={busy}
                      className="text-red-500 hover:text-red-700 font-medium text-sm transition"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })}
            {expenses.length === 0 && (
              <p className="text-gray-500 text-center py-6">Nenhum gasto registrado neste mês.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function MoneyField({ label, value, onChange }) {
  const [local, setLocal] = useState("");

  useEffect(() => {
    setLocal(((value || 0) / 100).toFixed(2).replace(".", ","));
  }, [value]);

  return (
    <label className="block">
      <div className="text-sm font-medium text-gray-700 mb-2">{label}</div>
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange(local)}
        inputMode="decimal"
        className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </label>
  );
}