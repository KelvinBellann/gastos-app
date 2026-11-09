"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CaretLeft,
  CaretRight,
  ChartBar,
  DownloadSimple,
  Receipt,
  Target,
  UploadSimple,
  Wallet,
} from "@phosphor-icons/react";
import {
  DB_CHANGED_EVENT,
  countRows,
  deleteExpenses,
  exportBackup,
  getOrCreateIncome,
  importBackup,
  listExpensesForMonth,
  updateIncome,
} from "@/lib/localDb";
import { todayISO } from "@/lib/dates";
import { addMonths, filterExpenses, isValidMonthKey, monthLabel, toMonthKey, FILTERS } from "@/lib/expenses";
import { formatBRLFromCents, sumCents } from "@/lib/money";
import { alertsSupported, syncDueAlerts } from "@/lib/nativeAlerts";
import { Banner, IconButton, useToast } from "./ui";
import DueAlertsDialog from "./DueAlertsDialog";
import ExpenseForm from "./ExpenseForm";
import ExpenseList from "./ExpenseList";
import CategoryBreakdown from "./CategoryBreakdown";
import IncomesManager from "./IncomesManager";
import PlanTab from "./PlanTab";
import ReceiptsTab from "./ReceiptsTab";
import StatementImport from "./StatementImport";
import StoreComparison from "./StoreComparison";

const TABS = [
  { id: "gastos", label: "Gastos", Icon: Wallet },
  { id: "plano", label: "Plano", Icon: Target },
  { id: "recibos", label: "Recibos", Icon: Receipt },
  { id: "comparar", label: "Comparar", Icon: ChartBar },
];

const INCOME_FIELDS = ["salary_net_cents", "multibenefits_cents", "food_cents", "spouse_salary_cents"];
const NOTICE_KEY = "gastos-app:aviso-dados-locais";

// Mes e aba ficam na URL (?mes=2026-10&aba=recibos): recarregar ou salvar o link volta ao mesmo lugar
function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const mes = params.get("mes");
  const aba = params.get("aba");
  return {
    monthKey: isValidMonthKey(mes) ? mes : toMonthKey(),
    tab: TABS.some((t) => t.id === aba) ? aba : "gastos",
  };
}

function readNoticeDismissed() {
  try {
    return window.localStorage.getItem(NOTICE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function Dashboard() {
  const toast = useToast();
  const [initial] = useState(readUrlState);
  const [monthKey, setMonthKey] = useState(initial.monthKey);
  const [activeTab, setActiveTab] = useState(initial.tab);
  const [dataVersion, setDataVersion] = useState(0);
  const [income, setIncome] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [variableIncomeTotal, setVariableIncomeTotal] = useState(0);
  const [filter, setFilter] = useState("todos");
  const [err, setErr] = useState("");
  const [noticeDismissed, setNoticeDismissed] = useState(readNoticeDismissed);
  const [showStatementImport, setShowStatementImport] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [canAlert] = useState(alertsSupported);
  const importInputRef = useRef(null);
  const tabRefs = useRef({});

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("mes", monthKey);
    url.searchParams.set("aba", activeTab);
    window.history.replaceState(null, "", url);
  }, [monthKey, activeTab]);

  // Refaz os avisos ao abrir o app, ao voltar para ele e a cada mudanca nos dados.
  // Falha aqui so acontece com o banco ilegivel, e o carregamento do mes ja mostra esse erro.
  useEffect(() => {
    if (!canAlert) return undefined;
    let timer;
    const sync = () => {
      clearTimeout(timer);
      timer = setTimeout(() => syncDueAlerts().catch(() => {}), 300);
    };
    const syncWhenVisible = () => document.visibilityState === "visible" && sync();
    sync();
    window.addEventListener(DB_CHANGED_EVENT, sync);
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(DB_CHANGED_EVENT, sync);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [canAlert]);

  async function loadExpenses() {
    try {
      setExpenses(await listExpensesForMonth(monthKey));
    } catch (e) {
      setErr(e.message);
    }
  }

  async function loadMonth() {
    try {
      const [inc, exp] = await Promise.all([getOrCreateIncome(monthKey), listExpensesForMonth(monthKey)]);
      setIncome(inc);
      setExpenses(exp);
      setErr("");
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    loadMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega ao trocar de mes ou importar backup
  }, [monthKey, dataVersion]);

  const filteredExpenses = useMemo(() => filterExpenses(expenses, filter), [expenses, filter]);

  const totals = useMemo(() => {
    // Inclui as variaveis: o Saldo precisa bater com o "Total de receitas" do IncomesManager
    const fixedTotal = INCOME_FIELDS.reduce((s, f) => s + (income?.[f] || 0), 0);
    const incomeTotal = fixedTotal + variableIncomeTotal;
    const expensesTotal = sumCents(filteredExpenses);
    return { incomeTotal, expensesTotal, balance: incomeTotal - expensesTotal };
  }, [income, variableIncomeTotal, filteredExpenses]);

  async function handleIncomeChange(updated) {
    if (!income) return;
    const patch = {};
    for (const key of INCOME_FIELDS) {
      const next = Number(updated[key]) || 0;
      if (next !== income[key]) patch[key] = next;
    }
    if (Object.keys(patch).length === 0) return;
    const previous = income;
    setIncome({ ...income, ...patch });
    try {
      await updateIncome(income.id, patch);
    } catch (e) {
      setIncome(previous);
      setErr(`Não foi possível salvar a receita: ${e.message}`);
    }
  }

  async function handleExport() {
    try {
      const backup = await exportBackup();
      const filename = `gastos-backup-${todayISO()}.json`;
      const json = JSON.stringify(backup, null, 2);
      // No app iOS o WKWebView ignora <a download>; o lado nativo abre a folha de compartilhar
      const nativeShare = window.webkit?.messageHandlers?.shareFile;
      if (nativeShare) {
        nativeShare.postMessage({ filename, content: json });
      } else {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast({ message: `Backup exportado com ${countRows(backup.data)} registros.` });
    } catch (e) {
      setErr(`Não foi possível exportar: ${e.message}`);
    }
  }

  async function handleImportFile(file) {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const incoming = countRows(payload?.data);
      const current = countRows((await exportBackup()).data);
      const ok = window.confirm(
        `Importar este backup substitui os ${current} registros atuais deste navegador pelos ${incoming} do arquivo. Continuar?`
      );
      if (!ok) return;
      const total = await importBackup(payload);
      setDataVersion((v) => v + 1);
      toast({ message: `Backup importado: ${total} registros.` });
    } catch (e) {
      setErr(e instanceof SyntaxError ? "O arquivo não é um JSON válido." : e.message);
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  function handleStatementImported(inserted) {
    setShowStatementImport(false);
    // Extrato de outro mes: abre o mes dos lancamentos, senao pareceria que nada aconteceu
    const months = [...new Set(inserted.map((e) => e.month_key))].sort();
    if (!months.includes(monthKey)) setMonthKey(months[months.length - 1]);
    setDataVersion((v) => v + 1);
    toast({
      message: `${inserted.length} ${inserted.length === 1 ? "gasto importado" : "gastos importados"}.`,
      onAction: async () => {
        await deleteExpenses(inserted.map((e) => e.id));
        setDataVersion((v) => v + 1);
      },
    });
  }

  function dismissNotice() {
    setNoticeDismissed(true);
    try {
      window.localStorage.setItem(NOTICE_KEY, "1");
    } catch {
      // Sem storage o aviso so volta no proximo carregamento; nada a fazer
    }
  }

  function handleTabKeyDown(e, index) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = TABS[(index + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    setActiveTab(next.id);
    tabRefs.current[next.id]?.focus();
  }

  const filterLabel = FILTERS.find((f) => f.value === filter)?.label;

  return (
    <div className="min-h-[100dvh]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Pular para o conteúdo
      </a>

      <header
        className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-on-primary" aria-hidden="true">
              <Wallet size={18} weight="bold" />
            </span>
            <h1 className="text-lg font-semibold tracking-tight">Gastos</h1>
          </div>

          <div className="order-3 flex w-full items-center gap-1 sm:order-none sm:w-auto">
            <IconButton label="Mês anterior" onClick={() => setMonthKey((m) => addMonths(m, -1))}>
              <CaretLeft size={18} aria-hidden="true" />
            </IconButton>
            <label htmlFor="mes" className="sr-only">
              Mês
            </label>
            <input
              id="mes"
              name="mes"
              type="month"
              value={monthKey}
              onChange={(e) => isValidMonthKey(e.target.value) && setMonthKey(e.target.value)}
              className="h-9 flex-1 rounded-xl border border-line bg-surface px-3 text-sm font-medium sm:w-44 sm:flex-none"
            />
            <IconButton label="Próximo mês" onClick={() => setMonthKey((m) => addMonths(m, 1))}>
              <CaretRight size={18} aria-hidden="true" />
            </IconButton>
          </div>

          <div className="ml-auto flex items-center gap-1">
            {canAlert && (
              <IconButton label="Avisos de vencimento" onClick={() => setShowAlerts(true)}>
                <Bell size={18} aria-hidden="true" />
              </IconButton>
            )}
            <IconButton label="Exportar backup" onClick={handleExport}>
              <DownloadSimple size={18} aria-hidden="true" />
            </IconButton>
            <IconButton label="Importar backup" onClick={() => importInputRef.current?.click()}>
              <UploadSimple size={18} aria-hidden="true" />
            </IconButton>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => handleImportFile(e.target.files?.[0])}
              aria-label="Arquivo de backup"
            />
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-3">
          <div role="tablist" aria-label="Seções" className="inline-flex w-full gap-1 rounded-full bg-surface-2 p-1 sm:w-auto">
            {TABS.map((tab, i) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(el) => (tabRefs.current[tab.id] = el)}
                  id={`aba-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`painel-${tab.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, i)}
                  className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium transition-[background-color,color] duration-150 sm:flex-none sm:px-4 ${
                    selected ? "bg-ink text-canvas" : "text-body hover:text-ink"
                  }`}
                >
                  <tab.Icon size={16} weight={selected ? "fill" : "regular"} aria-hidden="true" className="hidden min-[420px]:block" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main
        id="conteudo"
        className="mx-auto max-w-5xl px-4 pt-5"
        style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 space-y-3 empty:hidden">
          {err && <Banner onDismiss={() => setErr("")}>{err}</Banner>}
          {!noticeDismissed && (
            <Banner tone="info" onDismiss={dismissNotice}>
              Os dados ficam só neste navegador. Use o botão de exportar backup no topo para não perder nada ao trocar de
              aparelho ou limpar o navegador.
            </Banner>
          )}
        </div>

        <div
          role="tabpanel"
          id={`painel-${activeTab}`}
          aria-labelledby={`aba-${activeTab}`}
          tabIndex={-1}
          className="focus:outline-none"
        >
          {activeTab === "gastos" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
              <div className="space-y-4 lg:col-span-5">
                <section
                  aria-label="Resumo do mês"
                  className="rounded-2xl bg-hero p-5 text-on-hero sm:p-6"
                >
                  <p className="text-sm text-on-hero-mute first-letter:uppercase">{monthLabel(monthKey)}</p>
                  <p className="mt-3 text-sm text-on-hero-mute">Saldo</p>
                  <p
                    className={`num mt-0.5 text-4xl font-semibold tracking-tight ${
                      totals.balance >= 0 ? "text-primary" : "text-[#ff8f93]"
                    }`}
                  >
                    {formatBRLFromCents(totals.balance)}
                  </p>
                  <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                    <div>
                      <dt className="text-xs text-on-hero-mute">Receitas</dt>
                      <dd className="num mt-0.5 text-lg font-semibold">{formatBRLFromCents(totals.incomeTotal)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-on-hero-mute">
                        Gastos{filter !== "todos" ? ` (${filterLabel.toLowerCase()})` : ""}
                      </dt>
                      <dd className="num mt-0.5 text-lg font-semibold">{formatBRLFromCents(totals.expensesTotal)}</dd>
                    </div>
                  </dl>
                </section>

                <ExpenseForm
                  monthKey={monthKey}
                  onSaved={loadExpenses}
                  onError={setErr}
                  onImportStatement={() => setShowStatementImport(true)}
                />

                <CategoryBreakdown expenses={filteredExpenses} />
              </div>

              <div className="space-y-4 lg:col-span-7">
                <ExpenseList
                  expenses={filteredExpenses}
                  filter={filter}
                  onFilterChange={setFilter}
                  onChanged={loadExpenses}
                  onError={setErr}
                />

                <IncomesManager
                  key={dataVersion}
                  monthKey={monthKey}
                  income={income}
                  onUpdate={handleIncomeChange}
                  onVariableTotalChange={setVariableIncomeTotal}
                  onError={setErr}
                />
              </div>
            </div>
          )}

          {activeTab === "plano" && (
            <PlanTab
              key={`${monthKey}-${dataVersion}`}
              monthKey={monthKey}
              income={income}
              onIncomeChange={handleIncomeChange}
              onError={setErr}
            />
          )}

          {activeTab === "recibos" && <ReceiptsTab key={dataVersion} monthKey={monthKey} onError={setErr} />}

          {activeTab === "comparar" && <StoreComparison key={dataVersion} monthKey={monthKey} />}
        </div>
      </main>

      {showStatementImport && (
        <StatementImport onImported={handleStatementImported} onClose={() => setShowStatementImport(false)} />
      )}

      {showAlerts && <DueAlertsDialog onClose={() => setShowAlerts(false)} />}
    </div>
  );
}
