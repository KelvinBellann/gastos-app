"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ReceiptsTab from "./ReceiptsTab";
import StoreComparison from "./StoreComparison";
import MoneyInput from "./MoneyInput";
import IncomesManager from "./IncomesManager";

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
  { value: "fixos", label: "Fixos", icon: "🏠", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "mercado", label: "Mercado", icon: "🛒", color: "bg-stone-100 text-stone-700 border-stone-200" },
  { value: "aleatorios", label: "Aleatórios", icon: "❓", color: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  { value: "emprestado", label: "Emprestado", icon: "🤝", color: "bg-neutral-100 text-neutral-700 border-neutral-200" },
  { value: "gatos", label: "Gatos", icon: "🐱", color: "bg-rose-50 text-rose-700 border-rose-100" },
  { value: "lanches", label: "Lanches", icon: "🍔", color: "bg-amber-50 text-amber-700 border-amber-100" },
  { value: "dinheiro", label: "Dinheiro", icon: "💵", color: "bg-gray-100 text-gray-600 border-gray-200" },
  { value: "carro", label: "Carro", icon: "🚗", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "farmacia", label: "Farmácia", icon: "💊", color: "bg-rose-50 text-rose-600 border-rose-100" },
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
  const [activeTab, setActiveTab] = useState("gastos");

  const [category, setCategory] = useState("fixos");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState("");

  const filteredExpenses = useMemo(() => {
    if (filter === "todos") return expenses;

    let maxDays;
    if (filter === "hoje") maxDays = 0;
    else if (filter === "semana") maxDays = 7;
    else if (filter === "mes") maxDays = 30;
    else return expenses;

    return expenses.filter((e) => {
      const days = getDaysSinceToday(e.date);
      return days >= 0 && days <= maxDays;
    });
  }, [expenses, filter]);

  const groupedExpenses = useMemo(() => {
    const PERIODS = ["Hoje", "Ontem", "Esta semana", "Mês anterior"];
    const grouped = {};

    // Agrupar por período e depois combinar gastos iguais
    filteredExpenses.forEach((e) => {
      const period = getPeriodLabel(e.date);
      if (!grouped[period]) grouped[period] = {};

      // Chave única: descrição + categoria + data (para combinar duplicatas)
      const key = `${e.description}|${e.category}|${e.date}`;

      if (!grouped[period][key]) {
        // Primeiro gasto dessa descrição nesse dia
        grouped[period][key] = {
          ...e,
          count: 1, // Quantas vezes foi adicionado
        };
      } else {
        // Gasto duplicado - somar valor e incrementar contador
        grouped[period][key].amount_cents += e.amount_cents;
        grouped[period][key].count += 1;
      }
    });

    // Converter de volta para array
    return PERIODS.filter((p) => grouped[p] && Object.keys(grouped[p]).length > 0).map((p) => ({
      period: p,
      items: Object.values(grouped[p]),
    }));
  }, [filteredExpenses]);

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

  async function loadExpenses() {
    const expRes = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .eq("month_key", monthKey)
      .order("created_at", { ascending: false });

    if (expRes.error) setErr(expRes.error.message);
    else setExpenses(expRes.data || []);
  }

  async function load() {
    setBusy(true);
    setErr("");

    const [incRes, expRes] = await Promise.all([
      supabase.from("incomes").select("*").eq("user_id", userId).eq("month_key", monthKey).maybeSingle(),
      supabase.from("expenses").select("*").eq("user_id", userId).eq("month_key", monthKey).order("created_at", { ascending: false }),
    ]);

    if (incRes.error) {
      setErr(incRes.error.message);
      setBusy(false);
      return;
    }

    if (!incRes.data) {
      const ins = await supabase
        .from("incomes")
        .insert({ user_id: userId, month_key: monthKey, ...DEFAULT_INCOME })
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

    // Validação de descrição
    if (!description.trim()) {
      setErr("⚠️ Digite o que foi gasto (ex: Almoço, Gasolina)");
      return;
    }

    // Validação de valor
    const cents = Number(amount);
    if (isNaN(cents) || cents === 0 || cents < 0) {
      setErr("⚠️ Digite um valor válido (ex: 50 para R$ 50,00)");
      return;
    }

    setBusy(true);
    try {
      const expenseData = {
        user_id: userId,
        month_key: monthKey,
        category,
        description: description.trim(),
        amount_cents: cents,
        date: new Date().toISOString().slice(0, 10),
      };

      console.log("Inserindo gasto:", expenseData);

      const { data, error } = await supabase
        .from("expenses")
        .insert([expenseData])
        .select();

      if (error) {
        const errorMsg = error.message || JSON.stringify(error);
        setErr(`❌ Erro ao salvar: ${errorMsg}`);
        console.error("Supabase error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          fullError: error,
        });
      } else {
        console.log("Gasto salvo com sucesso:", data);
        setDescription("");
        setAmount("");
        setSuccessMsg("✅ Gasto adicionado com sucesso!");
        setTimeout(() => setSuccessMsg(""), 3000);
        await loadExpenses();
      }
    } catch (err) {
      setErr(`❌ Erro inesperado: ${err.message}`);
      console.error("Exception details:", {
        message: err.message,
        stack: err.stack,
        fullError: err,
      });
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
      await loadExpenses();
    } finally {
      setBusy(false);
    }
  }

  function startEdit(expense) {
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
      if (error) {
        setErr(error.message);
        return;
      }
      await loadExpenses();
      setEditingId(null);
      setEditAmount("");
    } finally {
      setBusy(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditAmount("");
  }

  async function updateIncomeField(field, cents) {
    if (!income) {
      setErr("Carregando dados de receitas...");
      return;
    }
    const numCents = Number(cents);
    if (!Number.isInteger(numCents) || numCents < 0) {
      setErr("Valor inválido");
      return;
    }

    setErr("");
    const incomeId = income.id;
    const previousValue = income[field];

    setIncome(prev => ({ ...prev, [field]: numCents }));

    try {
      const { error } = await supabase
        .from("incomes")
        .update({ [field]: numCents })
        .eq("id", incomeId);

      if (error) {
        setErr(`Erro ao salvar: ${error.message}`);
        setIncome(prev => ({ ...prev, [field]: previousValue }));
      } else {
        setSuccessMsg("✓ Receita atualizada!");
        setTimeout(() => setSuccessMsg(""), 2000);
      }
    } catch (err) {
      setErr(`Erro ao salvar: ${err.message}`);
      setIncome(prev => ({ ...prev, [field]: previousValue }));
    }
  }

  return (
    <main className="min-h-screen bg-[#F5F0EB] flex flex-col">
      {/* Header */}
      <header className="bg-[#2C2C2C] text-white sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">💰 Gastos</h1>
            <p className="text-stone-400 text-xs mt-0.5">
              {monthLabel(monthKey)}
            </p>
          </div>
          <button
            onClick={onSignOut}
            className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition text-sm font-medium"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-stone-200 px-4 flex gap-2 overflow-x-auto sticky top-16 z-10" style={{ top: 'env(safe-area-inset-top)' }}>
        {[
          { id: "gastos", label: "💰 Gastos" },
          { id: "recibos", label: "📸 Recibos" },
          { id: "comparar", label: "📊 Comparar" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition ${
              activeTab === tab.id
                ? "border-[#3D3D3D] text-[#3D3D3D]"
                : "border-transparent text-stone-600 hover:text-stone-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
        {activeTab === "gastos" && (
          <>
            {/* Mês e Filtro */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200 p-4 space-y-3">
          <div className="flex gap-2 items-center">
            <label className="text-sm font-medium text-stone-700 whitespace-nowrap">Mês:</label>
            <input
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className="flex-1 border border-stone-300 rounded-lg p-2 text-sm focus:outline-none focus:border-stone-600"
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
                    ? "bg-[#3D3D3D] text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error & Success */}
        {err && (
          <div className="bg-red-100 border-2 border-red-500 text-red-800 p-4 rounded-lg text-sm font-semibold shadow-md animate-pulse">
            {err}
          </div>
        )}
        {successMsg && (
          <div className="bg-green-100 border-2 border-green-500 text-green-800 p-4 rounded-lg text-sm font-semibold shadow-md animate-pulse">
            {successMsg}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#EDF4F0] border border-stone-200 rounded-xl p-4 text-center">
            <p className="text-xs text-stone-600 mb-1">Receitas</p>
            <p className="text-lg font-bold text-[#2D5F45]">{formatBRLFromCents(totals.incomeTotal)}</p>
          </div>
          <div className="bg-[#F4EDEE] border border-stone-200 rounded-xl p-4 text-center">
            <p className="text-xs text-stone-600 mb-1">Gastos</p>
            <p className="text-lg font-bold text-[#7A3030]">{formatBRLFromCents(totals.expensesTotal)}</p>
          </div>
          <div className={`border border-stone-200 rounded-xl p-4 text-center ${
            totals.balance >= 0
              ? "bg-[#EEF0F4]"
              : "bg-[#F4F0EC]"
          }`}>
            <p className="text-xs text-stone-600 mb-1">Saldo</p>
            <p className={`text-lg font-bold ${
              totals.balance >= 0
                ? "text-[#2E3F5F]"
                : "text-[#5F4020]"
            }`}>{formatBRLFromCents(totals.balance)}</p>
          </div>
        </div>

        {/* Receitas Section - Improved */}
        <IncomesManager
          userId={userId}
          monthKey={monthKey}
          income={income}
          onUpdate={(updated) => {
            setIncome(prev => {
              Object.keys(updated).forEach((key) => {
                if (
                  [
                    "salary_net_cents",
                    "multibenefits_cents",
                    "food_cents",
                    "spouse_salary_cents",
                  ].includes(key) &&
                  updated[key] !== prev[key]
                ) {
                  updateIncomeField(key, updated[key]);
                }
              });
              return updated;
            });
          }}
        />

        {/* Add Expense Section */}
        <div className="bg-white rounded-2xl border-2 border-stone-300 shadow-lg p-4">
          <h2 className="text-lg font-bold text-stone-900 mb-4">➕ Novo gasto</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-stone-300 rounded-lg p-3 text-sm focus:outline-none focus:border-stone-600 focus:ring-2 focus:ring-stone-400"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Descrição</label>
              <input
                placeholder="Ex: Almoço, Gasolina, Supermercado..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-stone-300 rounded-lg p-3 text-sm focus:outline-none focus:border-stone-600 focus:ring-2 focus:ring-stone-400"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Valor</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <MoneyInput
                    value={amount}
                    onChange={setAmount}
                    placeholder="0,00"
                  />
                </div>
                <button
                  onClick={addExpense}
                  disabled={busy || !description.trim() || !amount}
                  className="bg-[#3D3D3D] text-white px-6 rounded-lg font-bold hover:bg-[#2C2C2C] transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm h-auto"
                  title={!description.trim() ? "Digite a descrição" : !amount ? "Digite o valor" : "Clique para salvar"}
                >
                  {busy ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>

            {amount > 0 && description.trim() && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                ✅ Pronto para salvar: <strong>{description}</strong> - <strong>{formatBRLFromCents(amount)}</strong>
              </div>
            )}
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
        <div className="bg-white rounded-2xl border border-stone-100 p-4">
          <h2 className="text-lg font-bold text-stone-900 mb-3">📝 Lançamentos ({filteredExpenses.length})</h2>
          <div className="space-y-2">
            {filteredExpenses.length === 0 ? (
              <p className="text-stone-500 text-center py-4 text-sm">Nenhum gasto registrado.</p>
            ) : (
              groupedExpenses.map(({ period, items }) => (
                <div key={period}>
                  <p className="text-xs font-bold text-stone-600 my-2 px-2">{period}</p>
                  {items.map((e) => {
                    const catInfo = CATEGORY_MAP[e.category] || {
                      label: e.category,
                      icon: "❓",
                      color: ""
                    };
                    return (
                      <div
                        key={e.id}
                        className="bg-white border border-stone-100 rounded-xl p-3 flex items-center justify-between hover:bg-stone-50 transition text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-stone-900 flex items-center gap-2">
                            <span>{catInfo.icon}</span>
                            <span className="truncate">{e.description}</span>
                            {e.count > 1 && (
                              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                                ×{e.count}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-stone-500 mt-1">
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
                              className="w-20 border border-stone-300 rounded p-1 text-xs focus:outline-none focus:border-stone-600"
                            />
                            <button
                              onClick={() => saveEdit(e.id)}
                              disabled={busy}
                              className="bg-[#4A7C59] text-white px-2 py-1 rounded text-xs font-medium hover:bg-[#3D6A4A] transition"
                            >
                              ✓
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={busy}
                              className="bg-stone-400 text-white px-2 py-1 rounded text-xs font-medium hover:bg-stone-500 transition"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 ml-2">
                            <div className="font-semibold text-stone-900 min-w-max">
                              {formatBRLFromCents(e.amount_cents)}
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => startEdit(e)}
                                disabled={busy || editingId}
                                className="text-stone-400 hover:text-stone-700 font-bold text-lg transition disabled:opacity-50"
                                title="Editar"
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => deleteExpense(e.id)}
                                disabled={busy || editingId}
                                className="text-stone-400 hover:text-red-500 font-bold text-lg transition disabled:opacity-50"
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
              ))
            )}
          </div>
        </div>
          </>
        )}

        {activeTab === "recibos" && (
          <ReceiptsTab userId={userId} monthKey={monthKey} />
        )}

        {activeTab === "comparar" && (
          <StoreComparison userId={userId} monthKey={monthKey} />
        )}
      </div>
    </main>
  );
}

function MoneyField({ label, value, onChange, disabled }) {
  return (
    <MoneyInput
      label={label}
      value={value}
      onChange={onChange}
      placeholder="0,00"
      disabled={disabled}
    />
  );
}