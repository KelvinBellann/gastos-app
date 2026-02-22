"use client";

import { useEffect, useMemo, useState } from "react";

// ---------- Helpers ----------
function formatBRL(value) {
  return (value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function toMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`; // "YYYY-MM"
}

function parseMoneyToNumber(input) {
  // aceita "120,50" / "120.50" / "R$ 120,50"
  const clean = String(input)
    .replace(/[^\d,.-]/g, "")
    .replace(".", "")
    .replace(",", ".");
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function monthKeyToDate(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

function dateToMonthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function listMonthsBetween(fromKey, toKey) {
  const from = monthKeyToDate(fromKey);
  const to = monthKeyToDate(toKey);
  if (from > to) return [];

  const months = [];
  const cursor = new Date(from.getTime());

  while (cursor <= to) {
    months.push(dateToMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

// --------- NEW: Month menu (Option B) ----------
function monthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function buildMonthOptions(centerKey, pastMonths = 24, futureMonths = 12) {
  const center = monthKeyToDate(centerKey);
  const options = [];

  const start = new Date(center.getTime());
  start.setMonth(start.getMonth() - pastMonths);

  const end = new Date(center.getTime());
  end.setMonth(end.getMonth() + futureMonths);

  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    options.push(dateToMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return options;
}

// ---------- Page ----------
export default function Home() {
  // Receitas fixas (pode evoluir depois para editar por mês também)
  const incomes = {
    salary: 4765.38,
    multibenefits: 1092.97,
    food: 38.05,
    spouse: 1200.0,
  };

  const incomeTotal =
    incomes.salary + incomes.multibenefits + incomes.food + incomes.spouse;

  // Estrutura: { "YYYY-MM": [ {id, category, description, amount, createdAt, meta} ] }
  const [expensesByMonth, setExpensesByMonth] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(toMonthKey());

  // Form (lançamento)
  const [category, setCategory] = useState("fixos");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  // Intervalo (mês a mês)
  const [fromMonth, setFromMonth] = useState(toMonthKey());
  const [toMonth, setToMonth] = useState(toMonthKey());

  // NEW: menu com meses/ano (sem teclado)
  const monthOptions = useMemo(
    () => buildMonthOptions(toMonthKey(), 24, 12),
    []
  );

  const currentList = expensesByMonth[selectedMonth] || [];

  // ---- Load/Save LocalStorage ----
  useEffect(() => {
    const saved = localStorage.getItem("expensesByMonth_v1");
    if (saved) {
      try {
        setExpensesByMonth(JSON.parse(saved));
      } catch {
        setExpensesByMonth({});
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("expensesByMonth_v1", JSON.stringify(expensesByMonth));
  }, [expensesByMonth]);

  // ---- Totais do mês selecionado ----
  const totalExpenses = useMemo(() => {
    return currentList.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [currentList]);

  const balance = incomeTotal - totalExpenses;

  const totalsByCategory = useMemo(() => {
    return currentList.reduce(
      (acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + (e.amount || 0);
        return acc;
      },
      { fixos: 0, mercado: 0, aleatorios: 0, emprestado: 0 }
    );
  }, [currentList]);

  // ---- Actions ----
  function addExpenseToMonth(monthKey, expense) {
    setExpensesByMonth((prev) => {
      const list = prev[monthKey] || [];
      return { ...prev, [monthKey]: [expense, ...list] };
    });
  }

  function handleAddSingle() {
    const value = parseMoneyToNumber(amount);
    if (!description.trim()) return alert("Descreva o gasto.");
    if (value === null || value <= 0) return alert("Valor inválido.");

    const expense = {
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      category,
      description: description.trim(),
      amount: value,
      createdAt: new Date().toISOString(),
      meta: { type: "single" },
    };

    addExpenseToMonth(selectedMonth, expense);
    setDescription("");
    setAmount("");
  }

  function handleAddRange() {
    const value = parseMoneyToNumber(amount);
    if (!description.trim()) return alert("Descreva o gasto.");
    if (value === null || value <= 0) return alert("Valor inválido.");

    const months = listMonthsBetween(fromMonth, toMonth);
    if (months.length === 0) return alert("Intervalo inválido (De > Até).");

    const seriesId = crypto?.randomUUID ? crypto.randomUUID() : `series_${Date.now()}`;

    months.forEach((monthKey) => {
      const expense = {
        id: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${monthKey}`,
        category,
        description: description.trim(),
        amount: value,
        createdAt: new Date().toISOString(),
        meta: { type: "range", seriesId, fromMonth, toMonth },
      };
      addExpenseToMonth(monthKey, expense);
    });

    setDescription("");
    setAmount("");
    alert(`Lançado em ${months.length} mês(es): ${months.join(", ")}`);
  }

  function removeExpense(monthKey, id) {
    setExpensesByMonth((prev) => {
      const list = prev[monthKey] || [];
      return { ...prev, [monthKey]: list.filter((e) => e.id !== id) };
    });
  }

  function clearMonth(monthKey) {
    if (!confirm(`Apagar todos os lançamentos de ${monthKey}?`)) return;
    setExpensesByMonth((prev) => {
      const copy = { ...prev };
      delete copy[monthKey];
      return copy;
    });
  }

  // ---------- UI ----------
  return (
    <main className="min-h-screen p-4 bg-gray-100">
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Controle de Gastos</h1>
            <p className="text-sm text-gray-600">
              Visualizando o mês:{" "}
              <span className="font-semibold">{selectedMonth}</span>
            </p>
          </div>

          {/* MENU MÊS/ANO (Opção B) */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Mês</span>
            <select
              className="border rounded-xl p-2 bg-white"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {monthOptions.map((key) => (
                <option key={key} value={key}>
                  {monthLabel(key)}
                </option>
              ))}
            </select>
          </div>
        </header>

        <section className="bg-white rounded-2xl shadow p-4">
          <div className="grid md:grid-cols-3 gap-3">
            <SummaryCard title="Receitas (fixas)" value={formatBRL(incomeTotal)} />
            <SummaryCard title="Gastos do mês" value={formatBRL(totalExpenses)} />
            <SummaryCard title="Saldo do mês" value={formatBRL(balance)} />
          </div>

          <div className="grid md:grid-cols-4 gap-3 mt-4">
            <MiniCard title="Fixos" value={formatBRL(totalsByCategory.fixos)} />
            <MiniCard title="Mercado" value={formatBRL(totalsByCategory.mercado)} />
            <MiniCard title="Aleatórios" value={formatBRL(totalsByCategory.aleatorios)} />
            <MiniCard title="Emprestado" value={formatBRL(totalsByCategory.emprestado)} />
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-4 space-y-3">
          <h2 className="text-lg font-semibold">Adicionar gasto</h2>

          <div className="grid md:grid-cols-4 gap-2">
            <select
              className="border rounded-xl p-3 bg-white"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="fixos">Fixos</option>
              <option value="mercado">Mercado</option>
              <option value="aleatorios">Aleatórios</option>
              <option value="emprestado">Emprestado</option>
            </select>

            <input
              className="border rounded-xl p-3 bg-white md:col-span-2"
              placeholder="Descrição (ex: Internet, rancho, Uber...)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <input
              className="border rounded-xl p-3 bg-white"
              placeholder="Valor (ex: 120,50)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={handleAddSingle}
              className="rounded-xl bg-black text-white px-4 py-3"
            >
              Adicionar só em {selectedMonth}
            </button>

            <div className="flex flex-wrap gap-2 items-center border rounded-xl p-2 bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">De</span>
                <input
                  type="month"
                  className="border rounded-xl p-2 bg-white"
                  value={fromMonth}
                  onChange={(e) => setFromMonth(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Até</span>
                <input
                  type="month"
                  className="border rounded-xl p-2 bg-white"
                  value={toMonth}
                  onChange={(e) => setToMonth(e.target.value)}
                />
              </div>

              <button
                onClick={handleAddRange}
                className="rounded-xl border bg-white px-4 py-2"
              >
                Aplicar no intervalo
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            Dica: “Aplicar no intervalo” serve pra despesas recorrentes (aluguel,
            internet, academia etc.).
          </p>
        </section>

        <section className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">
              Lançamentos de {selectedMonth}
            </h2>
            <button
              onClick={() => clearMonth(selectedMonth)}
              className="rounded-xl border bg-white px-4 py-2"
            >
              Limpar mês
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {currentList.map((e) => (
              <div
                key={e.id}
                className="border rounded-2xl p-3 flex items-center justify-between gap-3 bg-white"
              >
                <div>
                  <div className="font-medium">{e.description}</div>
                  <div className="text-sm text-gray-600">
                    {e.category}
                    {e?.meta?.type === "range" ? " • recorrente" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{formatBRL(e.amount)}</div>
                  <button
                    onClick={() => removeExpense(selectedMonth, e.id)}
                    className="rounded-xl border px-3 py-2 bg-white"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}

            {currentList.length === 0 ? (
              <p className="text-sm text-gray-600">
                Nenhum gasto registrado neste mês.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

// ---------- UI Components ----------
function SummaryCard({ title, value }) {
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