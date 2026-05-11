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

function formatDatePT(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

function getDaysSinceToday(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.floor((today - date) / (1000 * 60 * 60 * 24));
}

function getPeriodLabel(dateStr) {
  const days = getDaysSinceToday(dateStr);
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days <= 7) return "Esta semana";
  return "Mês anterior";
}

const DEFAULT_INCOME = {
  salary_net_cents: 0,
  multibenefits_cents: 0,
  food_cents: 0,
  spouse_salary_cents: 0,
};

const CATEGORIES = [
  { value: "fixos", label: "Fixos", icon: "🏠", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "mercado", label: "Mercado", icon: "🛒", color: "bg-green-100 text-green-700 border-green-300" },
  { value: "aleatorios", label: "Aleatórios", icon: "❓", color: "bg-orange-100 text-orange-700 border-orange-300" },
  { value: "emprestado", label: "Emprestado", icon: "🤝", color: "bg-purple-100 text-purple-700 border-purple-300" },
  { value: "gatos", label: "Gatos", icon: "🐱", color: "bg-pink-100 text-pink-700 border-pink-300" },
  { value: "lanches", label: "Lanches", icon: "🍔", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: "dinheiro", label: "Dinheiro", icon: "💵", color: "bg-gray-100 text-gray-700 border-gray-300" },
  { value: "carro", label: "Carro", icon: "🚗", color: "bg-indigo-100 text-indigo-700 border-indigo-300" },
  { value: "farmacia", label: "Farmácia", icon: "💊", color: "bg-red-100 text-red-700 border-red-300" },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

export default function Dashboard({ session, onSignOut }) {
  const userId = session.user.id;
  const [monthKey, setMonthKey] = useState(toMonthKey());
  const [income, setIncome] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("todos");

  const [category, setCategory] = useState("fixos");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState("");

  const filteredExpenses = useMemo(() => {
    if (filter === "todos") return expenses;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return expenses.filter((e) => {
      const expDate = new Date(e.date);
      expDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((now - expDate) / (1000 * 60 * 60 * 24));

      if (filter === "hoje") return daysDiff === 0;
      if (filter === "semana") return daysDiff >= 0 && daysDiff <= 7;
      if (filter === "mes") return daysDiff >= 0 && daysDiff <= 30;
      return true;
    });
  }, [expenses, filter]);

  const totals = useMemo(() => {
    const incomeTotal =
      (income?.salary_net_cents || 0) +
      (income?.multibenefits_cents || 0) +
      (income?.food_cents || 0) +
      (income?.spouse_salary_cents || 0);

    const byCategory = filteredExpenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount_cents;
      return acc;
    }, {});

    const expensesTotal = filteredExpenses.reduce((s, e) => s + e.amount_cents, 0);
    const balance = incomeTotal - expensesTotal;

    return { incomeTotal, expensesTotal, balance, byCategory };
  }, [income, filteredExpenses]);

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

  async function startEdit(expense) {
    setEditingId(expense.id);
    setEditAmount(formatBRLFromCents(expense.amount_cents).replace("R$", "").trim());
  }

  async function saveEdit(id) {
    const newCents = parseBRLToCents(editAmount);
    if (newCents === null || newCents <= 0) {
      setErr("Valor inválido.");
      return;
    }

    setBusy(true);
    setErr("");
    try {
      const { error } = await supabase
        .from("expenses")
        .update({ amount_cents: newCents })
        .eq("id", id);
      if (error) setErr(error.message);
      setEditingId(null);
      setEditAmount("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditAmount("");
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
      <header className="gradient-primary shadow-lg text-white sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">💰 Gastos</h1>
            <p className="text-indigo-100 text-xs mt-0.5">
              {monthLabel(monthKey)}
            </p>
          </div>
          <button
            onClick={onSignOut}
            className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition text-sm font-medium"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4 pb-20">
        {/* Mês e Filtro */}
        <div className="bg-white rounded-xl shadow-sm p-3 space-y-3">
          <div className="flex gap-2 items-center">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Mês:</label>
            <input
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {[
              { value: "hoje", label: "Hoje" },
              { value: "semana", label: "Semana" },
              { value: "mes", label: "Mês" },
              { value: "todos", label: "Todos" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  filter === opt.value
                    ? "bg-indigo-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error & Success */}
        {err && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">
            {err}
          </div>
        )}
        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-sm">
            {successMsg}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-xl shadow-sm p-4 text-white text-center">
            <p className="text-xs opacity-90 mb-1">Receitas</p>
            <p className="text-lg font-bold">{formatBRLFromCents(totals.incomeTotal)}</p>
          </div>
          <div className="bg-gradient-to-br from-red-400 to-red-600 rounded-xl shadow-sm p-4 text-white text-center">
            <p className="text-xs opacity-90 mb-1">Gastos</p>
            <p className="text-lg font-bold">{formatBRLFromCents(totals.expensesTotal)}</p>
          </div>
          <div
            className={`bg-gradient-to-br rounded-xl shadow-sm p-4 text-white text-center ${
              totals.balance >= 0
                ? "from-blue-400 to-blue-600"
                : "from-orange-400 to-orange-600"
            }`}
          >
            <p className="text-xs opacity-90 mb-1">Saldo</p>
            <p className="text-lg font-bold">{formatBRLFromCents(totals.balance)}</p>
          </div>
        </div>

        {/* Receitas Section */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-1">📊 Receitas do mês</h2>
          <p className="text-xs text-gray-500 mb-3">Edite os valores (salva automaticamente)</p>
          <div className="grid grid-cols-2 gap-2">
            <MoneyField
              label="Seu salário"
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
        <div className="bg-white rounded-xl shadow-sm p-4 sticky bottom-20">
          <h2 className="text-lg font-bold text-gray-900 mb-3">➕ Novo gasto</h2>
          <div className="space-y-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>

            <input
              placeholder="O que foi gasto?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <div className="flex gap-2">
              <input
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="flex-1 border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={addExpense}
                disabled={busy}
                className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-60 whitespace-nowrap text-sm"
              >
                {busy ? "..." : "Salvar"}
              </button>
            </div>
          </div>

          {/* Category Totals */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {CATEGORIES.slice(0, 6).map((cat) => (
              <div
                key={cat.value}
                className={`${cat.color} border rounded-lg p-2 text-center text-xs font-medium`}
              >
                <p>{cat.icon}</p>
                <p className="font-bold mt-0.5">
                  {formatBRLFromCents(totals.byCategory[cat.value] || 0)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Expenses List */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-3">📝 Lançamentos ({filteredExpenses.length})</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredExpenses.length === 0 ? (
              <p className="text-gray-500 text-center py-4 text-sm">Nenhum gasto registrado.</p>
            ) : (
              <>
                {(() => {
                  const grouped = {};
                  filteredExpenses.forEach((e) => {
                    const period = getPeriodLabel(e.date);
                    if (!grouped[period]) grouped[period] = [];
                    grouped[period].push(e);
                  });

                  const periods = ["Hoje", "Ontem", "Esta semana", "Mês anterior"];
                  return periods.map((period) => {
                    if (!grouped[period]) return null;
                    return (
                      <div key={period}>
                        <p className="text-xs font-bold text-gray-600 my-2 px-2">{period}</p>
                        {grouped[period].map((e) => {
                          const catInfo = CATEGORY_MAP[e.category] || {
                            label: e.category,
                            icon: "❓",
                            color: ""
                          };
                          return (
                            <div
                              key={e.id}
                              className="border border-gray-200 rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition text-sm"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 flex items-center gap-1">
                                  <span>{catInfo.icon}</span>
                                  <span className="truncate">{e.description}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {formatDatePT(e.date)}
                                </div>
                              </div>
                              {editingId === e.id ? (
                                <div className="flex gap-1 ml-2">
                                  <input
                                    type="text"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    inputMode="decimal"
                                    className="w-20 border border-indigo-300 rounded p-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                  <button
                                    onClick={() => saveEdit(e.id)}
                                    disabled={busy}
                                    className="bg-green-500 text-white px-2 py-1 rounded text-xs font-medium hover:bg-green-600 transition"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    disabled={busy}
                                    className="bg-gray-400 text-white px-2 py-1 rounded text-xs font-medium hover:bg-gray-500 transition"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 ml-2">
                                  <div className="font-bold text-gray-900 min-w-max">
                                    {formatBRLFromCents(e.amount_cents)}
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => startEdit(e)}
                                      disabled={busy || editingId}
                                      className="text-blue-500 hover:text-blue-700 font-bold text-lg transition disabled:opacity-50"
                                      title="Editar"
                                    >
                                      ✎
                                    </button>
                                    <button
                                      onClick={() => deleteExpense(e.id)}
                                      disabled={busy || editingId}
                                      className="text-red-500 hover:text-red-700 font-bold text-lg transition disabled:opacity-50"
                                      title="Deletar"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
              </>
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
      <div className="text-xs font-medium text-gray-700 mb-1">{label}</div>
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange(local)}
        inputMode="decimal"
        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </label>
  );
}