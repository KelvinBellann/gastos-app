"use client";

import { useEffect, useMemo, useState } from "react";

// ---------------- Helpers ----------------
function formatBRLFromCents(cents) {
  const value = (cents || 0) / 100;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`; // YYYY-MM
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

// Month menu (Option B)
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

// Converts a BRL formatted string or digits to cents.
// Strategy: keep only digits; last 2 digits are cents.
function digitsToCents(digitsStr) {
  const digits = (digitsStr || "").replace(/\D/g, "");
  if (!digits) return 0;
  const asInt = Number(digits);
  if (!Number.isFinite(asInt)) return 0;
  return asInt;
}

function centsToBrlInput(cents) {
  const value = (cents || 0) / 100;
  // No "R$" here, because the UI shows prefix separately
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Normalize older saved data (when amount was in "reais" number) to cents.
function normalizeExpensesByMonth(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [monthKey, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;

    out[monthKey] = list
      .filter(Boolean)
      .map((e) => {
        // Old shape: { amount: 12.34 }
        // New shape: { amount_cents: 1234 }
        const amount_cents =
          typeof e.amount_cents === "number"
            ? e.amount_cents
            : typeof e.amount === "number"
              ? Math.round(e.amount * 100)
              : 0;

        return {
          id: e.id || (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now())),
          category: e.category || "fixos",
          description: e.description || "",
          amount_cents,
          createdAt: e.createdAt || new Date().toISOString(),
          meta: e.meta || { type: "single" },
        };
      });
  }
  return out;
}

function normalizeIncomes(raw) {
  // New: { salaries_cents, benefits_cents, food_cents, extra_cents }
  // If nothing exists, seed with your numbers
  const seeded = {
    salaries_cents: 476538,   // 4765,38
    benefits_cents: 109297,   // 1092,97
    food_cents: 3805,         // 38,05
    extra_cents: 120000,      // 1200,00 (usando como "extra", você pode renomear pra esposa se quiser)
  };

  if (!raw || typeof raw !== "object") return seeded;

  // Backward compat: previous fields
  if (
    typeof raw.salary_cents === "number" ||
    typeof raw.multibenefits_cents === "number" ||
    typeof raw.spouse_salary_cents === "number"
  ) {
    return {
      salaries_cents: raw.salary_cents ?? seeded.salaries_cents,
      benefits_cents: raw.multibenefits_cents ?? seeded.benefits_cents,
      food_cents: raw.food_cents ?? seeded.food_cents,
      extra_cents: raw.spouse_salary_cents ?? seeded.extra_cents,
    };
  }

  return {
    salaries_cents: typeof raw.salaries_cents === "number" ? raw.salaries_cents : seeded.salaries_cents,
    benefits_cents: typeof raw.benefits_cents === "number" ? raw.benefits_cents : seeded.benefits_cents,
    food_cents: typeof raw.food_cents === "number" ? raw.food_cents : seeded.food_cents,
    extra_cents: typeof raw.extra_cents === "number" ? raw.extra_cents : seeded.extra_cents,
  };
}

// ---------------- Categories ----------------
const CATEGORY_OPTIONS = [
  { value: "fixos", label: "Fixos" },
  { value: "mercado", label: "Mercado" },
  { value: "aleatorios", label: "Aleatórios" },
  { value: "emprestado", label: "Emprestado" },

  // New
  { value: "gatos", label: "Gatos" },
  { value: "lanches", label: "Lanches" },
  { value: "dinheiro", label: "No dinheiro (papel)" },
  { value: "carro", label: "Carro" },
  { value: "farmacia", label: "Farmácia" },
];

const CATEGORY_LABEL = Object.fromEntries(CATEGORY_OPTIONS.map((c) => [c.value, c.label]));

// ---------------- Page ----------------
export default function Home() {
  // Expenses
  const [expensesByMonth, setExpensesByMonth] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(toMonthKey());

  // Incomes (editable)
  const [incomes, setIncomes] = useState({
    salaries_cents: 0,
    benefits_cents: 0,
    food_cents: 0,
    extra_cents: 0,
  });

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Add expense form
  const [category, setCategory] = useState("fixos");
  const [description, setDescription] = useState("");
  const [amountDigits, setAmountDigits] = useState(""); // digits-only, last 2 are cents

  // Range
  const [fromMonth, setFromMonth] = useState(toMonthKey());
  const [toMonth, setToMonth] = useState(toMonthKey());

  // Month dropdown options
  const monthOptions = useMemo(() => buildMonthOptions(toMonthKey(), 24, 12), []);

  // Current month list
  const currentList = expensesByMonth[selectedMonth] || [];

  // ---------------- Load/Save LocalStorage ----------------
  useEffect(() => {
    // expenses
    const savedExp = localStorage.getItem("expensesByMonth_v1");
    if (savedExp) {
      try {
        const parsed = JSON.parse(savedExp);
        setExpensesByMonth(normalizeExpensesByMonth(parsed));
      } catch {
        setExpensesByMonth({});
      }
    }

    // incomes
    const savedInc = localStorage.getItem("incomes_v2");
    if (savedInc) {
      try {
        setIncomes(normalizeIncomes(JSON.parse(savedInc)));
      } catch {
        setIncomes(normalizeIncomes(null));
      }
    } else {
      // Try older keys if exists in your old codebase
      const legacyInc = localStorage.getItem("incomes_v1");
      if (legacyInc) {
        try {
          setIncomes(normalizeIncomes(JSON.parse(legacyInc)));
        } catch {
          setIncomes(normalizeIncomes(null));
        }
      } else {
        setIncomes(normalizeIncomes(null));
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("expensesByMonth_v1", JSON.stringify(expensesByMonth));
  }, [expensesByMonth]);

  useEffect(() => {
    localStorage.setItem("incomes_v2", JSON.stringify(incomes));
  }, [incomes]);

  // ---------------- Totals ----------------
  const incomeTotalCents = useMemo(() => {
    return (
      (incomes.salaries_cents || 0) +
      (incomes.benefits_cents || 0) +
      (incomes.food_cents || 0) +
      (incomes.extra_cents || 0)
    );
  }, [incomes]);

  const filteredList = useMemo(() => {
    if (categoryFilter === "all") return currentList;
    return currentList.filter((e) => e.category === categoryFilter);
  }, [currentList, categoryFilter]);

  // Group “same names”: group by description + category (normalized)
  const grouped = useMemo(() => {
    const map = new Map();
    for (const e of filteredList) {
      const descKey = (e.description || "").trim().toLowerCase();
      const key = `${e.category}__${descKey}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          category: e.category,
          description: e.description,
          total_cents: 0,
          ids: [],
          count: 0,
          lastCreatedAt: e.createdAt,
        });
      }
      const g = map.get(key);
      g.total_cents += e.amount_cents || 0;
      g.ids.push(e.id);
      g.count += 1;
      if (e.createdAt > g.lastCreatedAt) g.lastCreatedAt = e.createdAt;
    }
    // Show newest first
    return Array.from(map.values()).sort((a, b) => (b.lastCreatedAt || "").localeCompare(a.lastCreatedAt || ""));
  }, [filteredList]);

  const totalExpensesCents = useMemo(() => {
    return currentList.reduce((sum, e) => sum + (e.amount_cents || 0), 0);
  }, [currentList]);

  const balanceCents = useMemo(() => incomeTotalCents - totalExpensesCents, [incomeTotalCents, totalExpensesCents]);

  const totalsByCategory = useMemo(() => {
    const init = Object.fromEntries(CATEGORY_OPTIONS.map((c) => [c.value, 0]));
    for (const e of currentList) {
      init[e.category] = (init[e.category] || 0) + (e.amount_cents || 0);
    }
    return init;
  }, [currentList]);

  // ---------------- Actions ----------------
  function addExpenseToMonth(monthKey, expense) {
    setExpensesByMonth((prev) => {
      const list = prev[monthKey] || [];
      return { ...prev, [monthKey]: [expense, ...list] };
    });
  }

  function buildExpense(amount_cents, meta) {
    return {
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      category,
      description: description.trim(),
      amount_cents,
      createdAt: new Date().toISOString(),
      meta,
    };
  }

  function resetExpenseForm() {
    setDescription("");
    setAmountDigits("");
  }

  function handleAddSingle() {
    if (!description.trim()) return alert("Descreva o gasto.");
    const amount_cents = digitsToCents(amountDigits);
    if (amount_cents <= 0) return alert("Valor inválido.");

    addExpenseToMonth(selectedMonth, buildExpense(amount_cents, { type: "single" }));
    resetExpenseForm();
  }

  function handleAddRange() {
    if (!description.trim()) return alert("Descreva o gasto.");
    const amount_cents = digitsToCents(amountDigits);
    if (amount_cents <= 0) return alert("Valor inválido.");

    const months = listMonthsBetween(fromMonth, toMonth);
    if (months.length === 0) return alert("Intervalo inválido (De > Até).");

    const seriesId = crypto?.randomUUID ? crypto.randomUUID() : `series_${Date.now()}`;
    months.forEach((monthKey) => {
      addExpenseToMonth(
        monthKey,
        buildExpense(amount_cents, { type: "range", seriesId, fromMonth, toMonth })
      );
    });

    resetExpenseForm();
    alert(`Lançado em ${months.length} mês(es).`);
  }

  function removeGroup(monthKey, ids) {
    if (!confirm(`Excluir ${ids.length} item(ns) desse grupo?`)) return;
    setExpensesByMonth((prev) => {
      const list = prev[monthKey] || [];
      const idSet = new Set(ids);
      return { ...prev, [monthKey]: list.filter((e) => !idSet.has(e.id)) };
    });
  }

  function updateCategoryForGroup(monthKey, ids, newCategory) {
    setExpensesByMonth((prev) => {
      const list = prev[monthKey] || [];
      const idSet = new Set(ids);
      return {
        ...prev,
        [monthKey]: list.map((e) => (idSet.has(e.id) ? { ...e, category: newCategory } : e)),
      };
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

  // ---------------- UI ----------------
  return (
    <main className="min-h-screen p-4 bg-gray-100">
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Controle de Gastos</h1>
            <p className="text-sm text-gray-600">
              Visualizando: <span className="font-semibold">{monthLabel(selectedMonth)}</span>
            </p>
          </div>

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

        {/* Summary */}
        <section className="bg-white rounded-2xl shadow p-4">
          <div className="grid md:grid-cols-3 gap-3">
            <SummaryCard title="Ganhos (total)" value={formatBRLFromCents(incomeTotalCents)} />
            <SummaryCard title="Gastos do mês" value={formatBRLFromCents(totalExpensesCents)} />
            <SummaryCard title="Saldo do mês" value={formatBRLFromCents(balanceCents)} />
          </div>

          <div className="grid md:grid-cols-3 gap-3 mt-4">
            <MiniCard title="Fixos" value={formatBRLFromCents(totalsByCategory.fixos)} />
            <MiniCard title="Mercado" value={formatBRLFromCents(totalsByCategory.mercado)} />
            <MiniCard title="Carro" value={formatBRLFromCents(totalsByCategory.carro)} />
          </div>
        </section>

        {/* Incomes editable */}
        <section className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold">Ganhos</h2>
              <p className="text-sm text-gray-600">Edite os valores e o total será recalculado automaticamente.</p>
            </div>
            <div className="text-sm text-gray-600">
              Total: <span className="font-semibold">{formatBRLFromCents(incomeTotalCents)}</span>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-2 mt-3">
            <MoneyField
              label="Salários"
              cents={incomes.salaries_cents}
              onChangeCents={(c) => setIncomes((p) => ({ ...p, salaries_cents: c }))}
            />
            <MoneyField
              label="Benefícios"
              cents={incomes.benefits_cents}
              onChangeCents={(c) => setIncomes((p) => ({ ...p, benefits_cents: c }))}
            />
            <MoneyField
              label="Vale alimentação"
              cents={incomes.food_cents}
              onChangeCents={(c) => setIncomes((p) => ({ ...p, food_cents: c }))}
            />
            <MoneyField
              label="Extra"
              cents={incomes.extra_cents}
              onChangeCents={(c) => setIncomes((p) => ({ ...p, extra_cents: c }))}
            />
          </div>
        </section>

        {/* Add expense */}
        <section className="bg-white rounded-2xl shadow p-4 space-y-3">
          <h2 className="text-lg font-semibold">Adicionar gasto</h2>

          <div className="grid md:grid-cols-4 gap-2">
            <select
              className="border rounded-xl p-3 bg-white"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <input
              className="border rounded-xl p-3 bg-white md:col-span-2"
              placeholder="Descrição (ex: Internet, rancho, Uber...)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <MoneyInput
              valueDigits={amountDigits}
              onChangeDigits={setAmountDigits}
              placeholder="0,00"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={handleAddSingle} className="rounded-xl bg-black text-white px-4 py-3">
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

              <button onClick={handleAddRange} className="rounded-xl border bg-white px-4 py-2">
                Aplicar no intervalo
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            Campo de valor formata automaticamente: digite só números (ex: “123456” vira “1.234,56”).
          </p>
        </section>

        {/* Filters + List */}
        <section className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Lançamentos</h2>
              <p className="text-sm text-gray-600">Exibindo grupos por (descrição + categoria).</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Filtrar</span>
                <select
                  className="border rounded-xl p-2 bg-white"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">Todos</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <button onClick={() => clearMonth(selectedMonth)} className="rounded-xl border bg-white px-4 py-2">
                Limpar mês
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {grouped.map((g) => (
              <div
                key={g.key}
                className="border rounded-2xl p-3 flex items-center justify-between gap-3 bg-white"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{g.description || "(Sem descrição)"}</div>
                  <div className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                    <span>{CATEGORY_LABEL[g.category] || g.category}</span>
                    <span>•</span>
                    <span>{g.count}x</span>

                    {/* Edit category AFTER inserted (applies to the whole group) */}
                    <span className="ml-2 text-gray-400">Alterar tipo:</span>
                    <select
                      className="border rounded-xl p-1.5 bg-white"
                      value={g.category}
                      onChange={(e) => updateCategoryForGroup(selectedMonth, g.ids, e.target.value)}
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="font-semibold whitespace-nowrap">
                    {formatBRLFromCents(g.total_cents)}
                  </div>
                  <button
                    onClick={() => removeGroup(selectedMonth, g.ids)}
                    className="rounded-xl border px-3 py-2 bg-white"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}

            {grouped.length === 0 ? (
              <p className="text-sm text-gray-600">
                Nenhum gasto registrado neste mês (ou nesse filtro).
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

// ---------------- UI Components ----------------
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

// Money input with fixed "R$" prefix and auto thousand separators
function MoneyInput({ valueDigits, onChangeDigits, placeholder }) {
  const cents = digitsToCents(valueDigits);
  const display = centsToBrlInput(cents);

  return (
    <div className="border rounded-xl bg-white p-3 flex items-center gap-2">
      <span className="text-gray-500 select-none">R$</span>
      <input
        className="w-full outline-none"
        inputMode="numeric"
        placeholder={placeholder}
        value={display}
        onChange={(e) => {
          // take whatever user typed, keep only digits
          const digits = e.target.value.replace(/\D/g, "");
          onChangeDigits(digits);
        }}
      />
    </div>
  );
}

// Smaller money fields for incomes
function MoneyField({ label, cents, onChangeCents }) {
  const [digits, setDigits] = useState(String(cents || 0));

  useEffect(() => {
    setDigits(String(cents || 0));
  }, [cents]);

  return (
    <label className="block">
      <div className="text-sm text-gray-700">{label}</div>
      <div className="mt-1">
        <MoneyInput
          valueDigits={digits}
          onChangeDigits={(d) => {
            setDigits(d);
            onChangeCents(digitsToCents(d));
          }}
          placeholder="0,00"
        />
      </div>
    </label>
  );
}