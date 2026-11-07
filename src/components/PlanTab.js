"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowCounterClockwise, CheckCircle, PencilSimple } from "@phosphor-icons/react";
import {
  deletePlanMonth,
  getPlanSettings,
  listAllExpenses,
  listContributions,
  listPlanMonths,
  listVariableIncomes,
  restoreRows,
  savePlanMonth,
  savePlanSettings,
} from "@/lib/localDb";
import { addMonths, monthLabel } from "@/lib/expenses";
import { formatBRLFromCents } from "@/lib/money";
import {
  actualByBucket,
  allocateFuture,
  balances,
  computeIncome,
  effectiveEssentials,
  formatDuration,
  independenceForecast,
  independenceTarget,
  monthsToReach,
  multiplier,
  normalizeSettings,
  reserveTarget,
  suggestSplit,
} from "@/lib/plan";
import MoneyInput from "./MoneyInput";
import PlanContributions from "./PlanContributions";
import PlanSettings from "./PlanSettings";
import { Banner, Button, Card, CardHeader, EmptyState, useToast } from "./ui";

const PERCENT = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function pct(part, total) {
  return total > 0 ? PERCENT.format(part / total) : "-";
}

function ProgressBar({ value, max, tone = "primary", label }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const color = tone === "negative" ? "bg-negative" : "bg-primary";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      className="h-2 overflow-hidden rounded-full bg-surface-2"
    >
      <div className={`h-full rounded-full ${color}`} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}

export default function PlanTab({ monthKey, income, onIncomeChange, onError }) {
  const toast = useToast();
  const [settingsRow, setSettingsRow] = useState(null);
  const [variableIncomes, setVariableIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [planMonths, setPlanMonths] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ essentials: 0, leisure: 0 });

  async function loadAll() {
    try {
      const [s, vi, exp, pm, contrib] = await Promise.all([
        getPlanSettings(),
        listVariableIncomes(monthKey),
        listAllExpenses(),
        listPlanMonths(),
        listContributions(),
      ]);
      setSettingsRow(s);
      setVariableIncomes(vi);
      setExpenses(exp);
      setPlanMonths(pm);
      setContributions(contrib);
    } catch (e) {
      onError(e.message);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o Dashboard remonta a aba ao trocar de mes
  }, [monthKey]);

  const settings = normalizeSettings(settingsRow);
  const inc = computeIncome(income, variableIncomes);
  const suggestion = suggestSplit(settings, inc);
  const closed = planMonths.find((m) => m.month_key === monthKey) || null;
  const current = closed
    ? { essentials: closed.essentials_cents, leisure: closed.leisure_cents, future: closed.future_cents }
    : suggestion;

  const bal = balances(settings, contributions);
  const rTarget = reserveTarget(settings, inc);
  // Reserva antes dos aportes deste mes: o plano do mes decide como encher o que faltava no inicio dele
  const reserveBeforeMonth =
    bal.reserve -
    contributions.filter((c) => c.month_key === monthKey && c.target === "reserve").reduce((s, c) => s + c.amount_cents, 0);
  const planned = closed
    ? { reserve: closed.reserve_cents, invest: closed.invest_cents }
    : allocateFuture(current.future, rTarget, reserveBeforeMonth);

  const actual = useMemo(() => actualByBucket(expenses, monthKey, inc.benefits), [expenses, monthKey, inc.benefits]);
  const previous = useMemo(
    () => actualByBucket(expenses, addMonths(monthKey, -1), inc.benefits),
    [expenses, monthKey, inc.benefits]
  );

  // Ritmo e custo de vida: media dos ultimos 3 meses fechados; sem historico, o mes atual
  const recent = planMonths.slice(0, 3);
  const avgFuture = recent.length
    ? Math.round(recent.reduce((s, m) => s + m.future_cents, 0) / recent.length)
    : current.future;
  const avgLeisure = recent.length
    ? Math.round(recent.reduce((s, m) => s + m.leisure_cents, 0) / recent.length)
    : current.leisure;
  const monthlyCost = effectiveEssentials(settings, inc) + avgLeisure;
  const iTarget = independenceTarget(settings, monthlyCost);
  const reserveMonths = monthsToReach(rTarget, bal.reserve, avgFuture, 0);
  const independenceMonths = independenceForecast({
    settings,
    monthlyFuture: avgFuture,
    reserveTarget: rTarget,
    bal,
    target: iTarget,
  });
  const mult = multiplier(settings);

  const incomeChanged = closed && closed.total_income_cents !== inc.total;

  async function saveSettings(patch) {
    try {
      setSettingsRow(await savePlanSettings(patch));
    } catch (e) {
      onError(`Não foi possível salvar o ajuste: ${e.message}`);
    }
  }

  function startEditing() {
    setDraft({ essentials: current.essentials, leisure: current.leisure });
    setEditing(true);
  }

  const draftFuture = inc.total - (Number(draft.essentials) || 0) - (Number(draft.leisure) || 0);

  async function closeMonth(values) {
    const future = inc.total - values.essentials - values.leisure;
    const split = allocateFuture(future, rTarget, reserveBeforeMonth);
    try {
      await savePlanMonth(monthKey, {
        his_income_cents: inc.his,
        hers_income_cents: inc.hers,
        extra_income_cents: inc.extras,
        benefits_cents: inc.benefits,
        total_income_cents: inc.total,
        essentials_cents: values.essentials,
        leisure_cents: values.leisure,
        future_cents: future,
        reserve_cents: split.reserve,
        invest_cents: split.invest,
      });
      setEditing(false);
      await loadAll();
      toast({ message: `Plano de ${monthLabel(monthKey)} fechado.` });
    } catch (e) {
      onError(`Não foi possível fechar o mês: ${e.message}`);
    }
  }

  async function reopenMonth() {
    try {
      const removed = await deletePlanMonth(monthKey);
      await loadAll();
      toast({
        message: "Fechamento desfeito. O plano voltou para a sugestão.",
        onAction: async () => {
          await restoreRows(removed);
          await loadAll();
        },
      });
    } catch (e) {
      onError(e.message);
    }
  }

  const rows = [
    { id: "essentials", label: "Essenciais", value: current.essentials, hint: "Contas fixas, mercado, farmácia, carro, gatos" },
    { id: "leisure", label: "Lazer", value: current.leisure, hint: "Lanches, aleatórios, saques" },
    { id: "future", label: "Futuro", value: current.future, hint: null },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
      <div className="space-y-4 lg:col-span-5">
        <section aria-labelledby="divisao-titulo" className="rounded-2xl bg-hero p-5 text-on-hero sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="divisao-titulo" className="text-sm text-on-hero-mute first-letter:uppercase">
              Divisão de {monthLabel(monthKey)}
            </h2>
            {closed ? (
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-on-primary">
                <CheckCircle size={14} weight="fill" aria-hidden="true" />
                Fechado em {new Date(closed.decided_at).toLocaleDateString("pt-BR")}
              </span>
            ) : (
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-on-hero">Sugestão</span>
            )}
          </div>
          <p className="mt-3 text-sm text-on-hero-mute">Para dividir</p>
          <p className="num mt-0.5 text-4xl font-semibold tracking-tight text-primary">{formatBRLFromCents(inc.total)}</p>

          <dl className="mt-5 space-y-3 border-t border-white/10 pt-4">
            {rows.map((r) => (
              <div key={r.id} className="flex items-baseline justify-between gap-3">
                <dt className="min-w-0">
                  <span className="text-sm text-on-hero">{r.label}</span>
                  <span className="num ml-2 text-xs text-on-hero-mute">{pct(r.value, inc.total)}</span>
                </dt>
                <dd className={`num text-lg font-semibold ${r.value < 0 ? "text-[#ff8f93]" : ""}`}>
                  {formatBRLFromCents(r.value)}
                </dd>
              </div>
            ))}
          </dl>
          {current.future > 0 && (
            <p className="num mt-2 text-xs text-on-hero-mute">
              Futuro: {formatBRLFromCents(planned.reserve)} para a reserva e {formatBRLFromCents(planned.invest)} para
              investimentos.
            </p>
          )}

          {!editing && (
            <div className="mt-5 flex flex-wrap gap-2">
              {closed ? (
                <>
                  <Button variant="secondary" onClick={startEditing} className="flex-1">
                    <PencilSimple size={16} aria-hidden="true" />
                    Refazer
                  </Button>
                  <Button variant="secondary" onClick={reopenMonth} className="flex-1">
                    <ArrowCounterClockwise size={16} aria-hidden="true" />
                    Reabrir
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => closeMonth(suggestion)} className="flex-1" disabled={inc.total <= 0}>
                    <CheckCircle size={18} weight="bold" aria-hidden="true" />
                    Fechar o mês
                  </Button>
                  <Button variant="secondary" onClick={startEditing} disabled={inc.total <= 0}>
                    Ajustar
                  </Button>
                </>
              )}
            </div>
          )}
        </section>

        {suggestion.shortfall > 0 && !closed && (
          <Banner>
            A renda do mês não cobre os essenciais. Faltam {formatBRLFromCents(suggestion.shortfall)}. O lazer foi zerado na
            sugestão.
          </Banner>
        )}
        {incomeChanged && (
          <Banner tone="info">
            A renda mudou depois do fechamento ({formatBRLFromCents(closed.total_income_cents)} na época, {formatBRLFromCents(inc.total)}{" "}
            agora). Use Refazer para atualizar a divisão.
          </Banner>
        )}
        {settings.essentials_budget_cents === null && (
          <Banner tone="info">
            Defina o valor das contas essenciais em Ajustes do plano. Até lá, a sugestão usa 50% da renda base.
          </Banner>
        )}

        {editing && (
          <Card aria-labelledby="ajustar-titulo">
            <CardHeader
              id="ajustar-titulo"
              title="Ajustar a divisão"
              description="O futuro é o que sobra depois de essenciais e lazer."
            />
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                closeMonth({ essentials: Number(draft.essentials) || 0, leisure: Number(draft.leisure) || 0 });
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <MoneyInput
                  id="ajuste-essenciais"
                  label="Essenciais"
                  value={draft.essentials}
                  onChange={(c) => setDraft((d) => ({ ...d, essentials: Number(c) || 0 }))}
                />
                <MoneyInput
                  id="ajuste-lazer"
                  label="Lazer"
                  value={draft.leisure}
                  onChange={(c) => setDraft((d) => ({ ...d, leisure: Number(c) || 0 }))}
                />
              </div>
              <p className={`num rounded-xl px-3 py-2.5 text-sm ${draftFuture < 0 ? "bg-negative-pale text-negative" : "bg-primary-pale text-primary-ink"}`}>
                Futuro: <strong>{formatBRLFromCents(draftFuture)}</strong>
                {draftFuture < 0 && ". Essenciais e lazer passam da renda do mês."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" className="flex-1">
                  Fechar o mês com estes valores
                </Button>
                <Button variant="ghost" onClick={() => setDraft({ essentials: suggestion.essentials, leisure: suggestion.leisure })}>
                  Usar sugestão
                </Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        )}

        <Card aria-labelledby="renda-titulo">
          <CardHeader
            id="renda-titulo"
            title="Renda do casal"
            description="Muda todo mês. Os valores são os mesmos da aba Gastos."
          />
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <MoneyInput
              id="plano-salario-dele"
              label="Seu salário"
              value={income?.salary_net_cents || 0}
              disabled={!income}
              onChange={(c) => income && onIncomeChange({ ...income, salary_net_cents: Number(c) || 0 })}
            />
            <MoneyInput
              id="plano-salario-dela"
              label="Salário da esposa"
              value={income?.spouse_salary_cents || 0}
              disabled={!income}
              onChange={(c) => income && onIncomeChange({ ...income, spouse_salary_cents: Number(c) || 0 })}
            />
          </div>

          {inc.base > 0 && (
            <div className="mt-4">
              <div className="flex h-2 overflow-hidden rounded-full" aria-hidden="true">
                <div className="bg-primary" style={{ width: `${inc.hisShare * 100}%` }} />
                <div className="bg-ink" style={{ width: `${inc.hersShare * 100}%` }} />
              </div>
              <p className="num mt-2 flex justify-between text-xs text-body">
                <span>Você: {PERCENT.format(inc.hisShare)}</span>
                <span>Esposa: {PERCENT.format(inc.hersShare)}</span>
              </p>
              <p className="num mt-1 text-xs text-mute">
                Na proporção da renda, os essenciais ficam {formatBRLFromCents(Math.round(current.essentials * inc.hisShare))} para
                você e {formatBRLFromCents(current.essentials - Math.round(current.essentials * inc.hisShare))} para ela.
              </p>
            </div>
          )}

          <dl className="num mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-body">Salários</dt>
              <dd className="text-ink">{formatBRLFromCents(inc.base)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-body">Receitas variáveis</dt>
              <dd className="text-ink">{formatBRLFromCents(inc.extras)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Total para dividir</dt>
              <dd>{formatBRLFromCents(inc.total)}</dd>
            </div>
            <div className="flex justify-between pt-1.5 text-xs text-mute">
              <dt>Benefícios (fora da divisão, pagam mercado e lanches)</dt>
              <dd>{formatBRLFromCents(inc.benefits)}</dd>
            </div>
          </dl>
        </Card>

        <Card aria-labelledby="metas-titulo">
          <CardHeader id="metas-titulo" title="Metas" />
          <div className="space-y-5">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-medium text-ink">Reserva de emergência</h3>
                <span className="num text-xs text-mute">{pct(bal.reserve, rTarget)}</span>
              </div>
              <p className="num mt-0.5 text-sm text-body">
                {formatBRLFromCents(bal.reserve)} de {formatBRLFromCents(rTarget)}
              </p>
              <div className="mt-2">
                <ProgressBar value={bal.reserve} max={rTarget} label="Reserva de emergência" />
              </div>
              <p className="num mt-1.5 text-xs text-mute">
                {settings.reserve_months} meses de essenciais. Previsão: {formatDuration(reserveMonths)}.
              </p>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-medium text-ink">Viver de renda</h3>
                <span className="num text-xs text-mute">{iTarget ? pct(bal.invest, iTarget) : "-"}</span>
              </div>
              {iTarget ? (
                <>
                  <p className="num mt-0.5 text-sm text-body">
                    {formatBRLFromCents(bal.invest)} de {formatBRLFromCents(iTarget)}
                  </p>
                  <div className="mt-2">
                    <ProgressBar value={bal.invest} max={iTarget} label="Viver de renda" />
                  </div>
                  <p className="num mt-1.5 text-xs text-mute">
                    Custo de vida de {formatBRLFromCents(monthlyCost)} por mês vezes {NUMBER.format(mult)} (rendimento real de{" "}
                    {String(settings.real_rate_monthly_pct).replace(".", ",")}% ao mês). Previsão: {formatDuration(independenceMonths)}.
                  </p>
                </>
              ) : (
                <p className="mt-0.5 text-[13px] text-mute">Informe a renda do mês para calcular.</p>
              )}
            </div>
            <p className="text-xs text-mute">
              Previsões no ritmo de {formatBRLFromCents(avgFuture)} por mês para o futuro
              {recent.length === 1 ? ", o do último mês fechado" : recent.length > 1 ? `, média dos últimos ${recent.length} meses fechados` : ""}. A
              reserva enche primeiro; depois tudo vai para investimentos.
            </p>
          </div>
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-7">
        <Card aria-labelledby="acompanhamento-titulo">
          <CardHeader
            id="acompanhamento-titulo"
            title="Acompanhamento"
            description="Quanto já saiu do bolso neste mês. Crédito conta no mês da parcela."
          />
          <ul className="space-y-4">
            {[
              { id: "essentials", label: "Essenciais", planned: current.essentials, spent: actual.essentials, before: previous.essentials },
              { id: "leisure", label: "Lazer", planned: current.leisure, spent: actual.leisure, before: previous.leisure },
            ].map((b) => {
              const left = b.planned - b.spent;
              return (
                <li key={b.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-ink">{b.label}</span>
                    <span className="num text-body">
                      {formatBRLFromCents(b.spent)} de {formatBRLFromCents(b.planned)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={b.spent} max={b.planned} tone={left < 0 ? "negative" : "primary"} label={`${b.label} usado`} />
                  </div>
                  <p className="num mt-1.5 flex justify-between text-xs">
                    <span className={left < 0 ? "font-medium text-negative" : "text-mute"}>
                      {left < 0 ? `Passou ${formatBRLFromCents(-left)}` : `Restam ${formatBRLFromCents(left)}`}
                    </span>
                    <span className="text-mute">Mês anterior: {formatBRLFromCents(b.before)}</span>
                  </p>
                </li>
              );
            })}
          </ul>
          {(actual.benefitsUsed > 0 || actual.outside > 0) && (
            <div className="num mt-4 space-y-1 border-t border-line pt-3 text-xs text-mute">
              {actual.benefitsUsed > 0 && <p>Benefícios pagaram {formatBRLFromCents(actual.benefitsUsed)} de mercado e lanches.</p>}
              {actual.outside > 0 && <p>Emprestado, fora dos potes: {formatBRLFromCents(actual.outside)}.</p>}
            </div>
          )}
        </Card>

        <PlanContributions
          monthKey={monthKey}
          planned={planned}
          contributions={contributions}
          onChanged={loadAll}
          onError={onError}
        />

        <Card aria-labelledby="historico-titulo" flush className="overflow-hidden">
          <div className="p-4 pb-0 sm:p-5 sm:pb-0">
            <CardHeader id="historico-titulo" title="Histórico" description="Os meses que vocês fecharam." />
          </div>
          {planMonths.length === 0 ? (
            <div className="px-4 pb-4 sm:px-5 sm:pb-5">
              <EmptyState title="Nenhum mês fechado ainda">
                Ao fechar o mês, a divisão fica registrada aqui para comparar a evolução.
              </EmptyState>
            </div>
          ) : (
            <div className="relative overflow-x-auto" role="region" aria-label="Histórico de meses" tabIndex={0}>
              <table className="num w-full text-[13px]">
                <thead>
                  <tr className="border-y border-line bg-surface-2 text-xs text-mute">
                    <th scope="col" className="px-4 py-2.5 text-left font-medium sm:px-5">Mês</th>
                    <th scope="col" className="px-2 py-2.5 text-right font-medium">Renda</th>
                    <th scope="col" className="px-2 py-2.5 text-right font-medium">Essenciais</th>
                    <th scope="col" className="px-2 py-2.5 text-right font-medium">Lazer</th>
                    <th scope="col" className="px-2 py-2.5 text-right font-medium">Futuro</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium sm:px-5">Guardado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {planMonths.map((m) => {
                    const saved = contributions
                      .filter((c) => c.month_key === m.month_key)
                      .reduce((s, c) => s + c.amount_cents, 0);
                    return (
                      <tr key={m.month_key}>
                        <th scope="row" className="whitespace-nowrap px-4 py-2.5 text-left font-medium first-letter:uppercase sm:px-5">
                          {monthLabel(m.month_key)}
                        </th>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right">{formatBRLFromCents(m.total_income_cents)}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right">{formatBRLFromCents(m.essentials_cents)}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right">{formatBRLFromCents(m.leisure_cents)}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right">{formatBRLFromCents(m.future_cents)}</td>
                        <td
                          className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold sm:px-5 ${
                            saved >= m.future_cents ? "text-positive" : "text-ink"
                          }`}
                        >
                          {formatBRLFromCents(saved)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <PlanSettings
          settings={settings}
          onSave={saveSettings}
          lastMonthEssentials={previous.essentials}
          suggestedEssentials={Math.round(inc.base / 2)}
        />
      </div>
    </div>
  );
}
