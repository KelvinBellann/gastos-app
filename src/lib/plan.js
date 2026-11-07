// Regras da aba Plano. Funcoes puras: recebem os dados ja carregados e devolvem numeros
// em centavos, para serem testadas sem navegador.
//
// Modelo "essencial primeiro":
// 1. Base = salario dele + salario dela. Extras = receitas variaveis do mes.
// 2. Multibeneficios e alimentacao ficam fora da divisao: so pagam comida, entao abatem
//    os gastos de mercado e lanches em vez de virar lazer ou investimento.
// 3. As contas essenciais saem primeiro (orcamento fixo, nao percentual), porque o
//    aluguel nao cai quando a renda cai.
// 4. O que sobra e dividido entre lazer e futuro (padrao 60/40, a mesma proporcao de 30/20).
// 5. O futuro enche a reserva de emergencia ate o alvo e so depois vai para investimentos.

export const DEFAULT_SETTINGS = {
  essentials_budget_cents: null, // null = usa 50% da renda base ate o casal definir
  leisure_share_pct: 60, // parte da sobra que vai para lazer; o resto e futuro
  extra_to_future: false, // true = receitas variaveis vao inteiras para o futuro
  reserve_months: 6, // reserva = N meses de essenciais
  real_rate_monthly_pct: 0.4, // rendimento real (descontada a inflacao) ao mes
  reserve_initial_cents: 0, // saldo que ja existia antes de usar o app
  invest_initial_cents: 0,
};

// Categoria do gasto para cada parte do plano. "fora" nao conta: dinheiro emprestado volta.
export const CATEGORY_BUCKET = {
  fixos: "essentials",
  mercado: "essentials",
  farmacia: "essentials",
  carro: "essentials",
  gatos: "essentials",
  lanches: "leisure",
  aleatorios: "leisure",
  dinheiro: "leisure",
  emprestado: "outside",
};

// Categorias que os beneficios de alimentacao podem pagar, na ordem em que sao abatidas
const FOOD_CATEGORIES = ["mercado", "lanches"];

export const BUCKETS = [
  { id: "essentials", label: "Essenciais" },
  { id: "leisure", label: "Lazer" },
  { id: "future", label: "Futuro" },
];

export function normalizeSettings(raw) {
  return { ...DEFAULT_SETTINGS, ...(raw || {}) };
}

export function computeIncome(income, variableIncomes = []) {
  const his = income?.salary_net_cents || 0;
  const hers = income?.spouse_salary_cents || 0;
  const base = his + hers;
  const extras = variableIncomes.reduce((s, v) => s + (v.amount_cents || 0), 0);
  const benefits = (income?.multibenefits_cents || 0) + (income?.food_cents || 0);
  return {
    his,
    hers,
    base,
    extras,
    benefits,
    total: base + extras,
    hisShare: base > 0 ? his / base : 0,
    hersShare: base > 0 ? hers / base : 0,
  };
}

export function effectiveEssentials(settings, inc) {
  const s = normalizeSettings(settings);
  if (Number.isInteger(s.essentials_budget_cents) && s.essentials_budget_cents >= 0) return s.essentials_budget_cents;
  return Math.round(inc.base / 2);
}

export function suggestSplit(settings, inc) {
  const s = normalizeSettings(settings);
  const essentials = effectiveEssentials(s, inc);
  const divisible = s.extra_to_future ? inc.base : inc.total;
  const leftover = divisible - essentials;
  const leisure = leftover > 0 ? Math.round((leftover * s.leisure_share_pct) / 100) : 0;
  const future = inc.total - essentials - leisure;
  return {
    essentials,
    leisure,
    future,
    // Quanto falta para fechar os essenciais quando a renda do mes nao cobre
    shortfall: future < 0 ? -future : 0,
  };
}

// Divide o dinheiro do futuro: reserva ate o alvo, o resto em investimentos
export function allocateFuture(futureCents, reserveTarget, reserveBalance) {
  const future = Math.max(0, futureCents);
  const missing = Math.max(0, reserveTarget - reserveBalance);
  const reserve = Math.min(future, missing);
  return { reserve, invest: future - reserve };
}

// Gasto que saiu do bolso no mes (fluxo de caixa): debito, pix e fixos pelo mes do
// lancamento; credito pelo mes da parcela. Assim a compra parcelada nao conta duas vezes.
export function cashFlowExpenses(expenses, monthKey) {
  return expenses.filter((e) => {
    if (e.payment_method === "credit") return e.installment_month === monthKey;
    if (e.category === "fixos") return e.month_key <= monthKey;
    return e.month_key === monthKey;
  });
}

export function actualByBucket(expenses, monthKey, benefitsCents = 0) {
  const rows = cashFlowExpenses(expenses, monthKey);
  const byCategory = {};
  for (const e of rows) byCategory[e.category] = (byCategory[e.category] || 0) + (e.amount_cents || 0);

  let benefitsLeft = benefitsCents;
  let benefitsUsed = 0;
  for (const cat of FOOD_CATEGORIES) {
    const covered = Math.min(benefitsLeft, byCategory[cat] || 0);
    if (covered > 0) {
      byCategory[cat] -= covered;
      benefitsLeft -= covered;
      benefitsUsed += covered;
    }
  }

  const totals = { essentials: 0, leisure: 0, outside: 0 };
  for (const [cat, cents] of Object.entries(byCategory)) {
    totals[CATEGORY_BUCKET[cat] || "leisure"] += cents;
  }
  return { ...totals, benefitsUsed };
}

export function balances(settings, contributions) {
  const s = normalizeSettings(settings);
  const sum = (target) =>
    contributions.filter((c) => c.target === target).reduce((acc, c) => acc + (c.amount_cents || 0), 0);
  return {
    reserve: s.reserve_initial_cents + sum("reserve"),
    invest: s.invest_initial_cents + sum("invest"),
  };
}

export function reserveTarget(settings, inc) {
  const s = normalizeSettings(settings);
  return s.reserve_months * effectiveEssentials(s, inc);
}

// Capital que, rendendo a taxa real, paga o custo de vida (essenciais + lazer) sem trabalhar
export function independenceTarget(settings, monthlyCostCents) {
  const rate = normalizeSettings(settings).real_rate_monthly_pct / 100;
  if (rate <= 0 || monthlyCostCents <= 0) return null;
  return Math.round(monthlyCostCents / rate);
}

export function multiplier(settings) {
  const rate = normalizeSettings(settings).real_rate_monthly_pct / 100;
  return rate > 0 ? 1 / rate : null;
}

// Meses para sair de `balance` e chegar a `target` aportando `monthly` com juros `rate` ao mes.
// null quando nao chega (sem aporte e sem saldo rendendo).
export function monthsToReach(target, balance, monthly, ratePct = 0) {
  if (balance >= target) return 0;
  const r = ratePct / 100;
  if (r <= 0) return monthly > 0 ? Math.ceil((target - balance) / monthly) : null;
  const numerator = target * r + monthly;
  const denominator = balance * r + monthly;
  if (denominator <= 0) return null;
  return Math.ceil(Math.log(numerator / denominator) / Math.log(1 + r));
}

// Previsao da independencia: primeiro enche a reserva (sem render, e dinheiro parado de
// liquidez), depois todo o futuro vai para investimentos rendendo a taxa real.
export function independenceForecast({ settings, monthlyFuture, reserveTarget: rTarget, bal, target }) {
  if (target === null) return null;
  const s = normalizeSettings(settings);
  const missingReserve = Math.max(0, rTarget - bal.reserve);
  const fillMonths = missingReserve > 0 ? monthsToReach(missingReserve, 0, monthlyFuture, 0) : 0;
  if (fillMonths === null) return null;
  const investMonths = monthsToReach(target, bal.invest, monthlyFuture, s.real_rate_monthly_pct);
  if (investMonths === null) return null;
  return fillMonths + investMonths;
}

export function formatDuration(months) {
  if (months === null || months === undefined) return "sem previsão no ritmo atual";
  if (months === 0) return "já alcançado";
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = `${years} ${years === 1 ? "ano" : "anos"}`;
  return rest ? `${y} e ${rest} ${rest === 1 ? "mês" : "meses"}` : y;
}
