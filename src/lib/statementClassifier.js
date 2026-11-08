import { buildExpenseEntries } from "@/lib/expenses";
import { normalizeForMatch } from "@/lib/text";

const FATURA_NOTE = "Pagamento de fatura: as compras já contam no cartão.";
const INVESTMENT_NOTE = "Investimento ou guardado: não é gasto.";

// Avaliadas em ordem, e a primeira que casa vale. Por isso as especificas vem antes: "uber one"
// antes de "uber", "mercado livre" antes de "mercado" e Pix por ultimo, para "Pix mercado do ze"
// cair em mercado. Termos sem acento (o texto e normalizado) e casados por palavra inteira.
// Nenhuma regra usa "fixos": essa categoria repete em todos os meses e duplicaria o extrato.
const RULES = [
  {
    category: "banco",
    skipNote: FATURA_NOTE,
    terms: [
      "pagamento (?:de |da )?fatura",
      "(?:pgto|pagto|pag) (?:de )?fatura",
      "fatura (?:de |do )?cartao",
      "(?:pagamento|pagto|pgto) (?:de |do )?cartao",
      "fatura nubank",
      "nubank fatura",
    ],
  },
  {
    category: "banco",
    skipNote: INVESTMENT_NOTE,
    terms: ["aplicacao", "aplic", "resgate", "cdb", "rdb", "lci", "lca", "tesouro direto", "poupanca", "caixinhas?", "investimentos?", "corretora", "guardado"],
  },
  {
    category: "assinaturas",
    terms: [
      "assinaturas?",
      "netflix",
      "spotify",
      "deezer",
      "tidal",
      "disney",
      "hbo",
      "hbomax",
      "max com",
      "prime video",
      "primevideo",
      "amazon prime",
      "amazonprime",
      "kindle unlimited",
      "audible",
      "globoplay",
      "paramount",
      "crunchyroll",
      "telecine",
      "apple com",
      "icloud",
      "youtube premium",
      "youtubepremium",
      "google one",
      "google play",
      "microsoft 365",
      "msft",
      "adobe",
      "canva",
      "dropbox",
      "notion",
      "chatgpt",
      "openai",
      "anthropic",
      "claude ai",
      "playstation",
      "psn",
      "xbox",
      "nintendo",
      "uber one",
      "ifood club",
      "smart ?fit",
      "bluefit",
      "academia",
      "gympass",
      "wellhub",
      "total ?pass",
    ],
  },
  {
    category: "aleatorios",
    terms: ["mercado ?livre", "mercado ?pago", "amazon", "shopee", "shein", "aliexpress", "magalu", "magazine luiza", "americanas", "casas bahia"],
  },
  {
    category: "banco",
    terms: [
      "tarifas?",
      "tar",
      "anuidade",
      "juros",
      "iof",
      "encargos?",
      "multa (?:por )?atraso",
      "cesta (?:de )?servicos",
      "cesta b expresso",
      "pacote (?:de )?servicos",
      "pacote tarifas",
      "cheque especial",
      "taxas?",
      "emprestimo",
      "financiamento",
      "cred(?:ito)? pessoal",
      "consignado",
      "seguro (?:do )?cartao",
      "seguro prestamista",
    ],
  },
  {
    category: "lanches",
    terms: [
      "ifood",
      "ifd",
      "rappi",
      "uber ?eats",
      "99 ?food",
      "ze delivery",
      "restaurantes?",
      "lanchonete",
      "lanches?",
      "pizzaria",
      "pizza",
      "hamburgueria",
      "burger",
      "mcdonalds?",
      "mc donalds?",
      "subway",
      "kfc",
      "habibs",
      "bobs",
      "giraffas",
      "spoleto",
      "outback",
      "coco bambu",
      "starbucks",
      "cafeteria",
      "cafe",
      "padaria",
      "panificadora",
      "confeitaria",
      "sorveteria",
      "acai",
      "bar",
      "boteco",
      "churrascaria",
      "sushi",
      "temakeria",
      "pastelaria",
      "cantina",
    ],
  },
  {
    category: "mercado",
    terms: [
      "supermercados?",
      "supermerc",
      "hipermercados?",
      "minimercado",
      "mercados?",
      "mercadinho",
      "mercearia",
      "atacadao",
      "atacarejo",
      "assai",
      "carrefour",
      "pao de acucar",
      "extra",
      "walmart",
      "bompreco",
      "sonda",
      "condor",
      "comper",
      "zona sul",
      "prezunic",
      "covabra",
      "muffato",
      "angeloni",
      "giassi",
      "savegnago",
      "tenda atacado",
      "sam ?s club",
      "makro",
      "hortifruti",
      "sacolao",
      "acougue",
      "emporio",
      "cesta basica",
    ],
  },
  {
    category: "farmacia",
    terms: ["farmacias?", "drogarias?", "drogasil", "droga ?raia", "drogao", "panvel", "pague menos", "ultrafarma", "nissei", "extrafarma"],
  },
  {
    category: "gatos",
    terms: ["pet ?shop", "petz", "petlove", "cobasi", "veterinari[ao]", "racao"],
  },
  {
    category: "carro",
    terms: [
      "postos?",
      "combustive(?:l|is)",
      "gasolina",
      "etanol",
      "shell",
      "ipiranga",
      "petrobras",
      "estacionamento",
      "estapar",
      "sem parar",
      "conectcar",
      "veloe",
      "pedagio",
      "oficina",
      "mecanica",
      "auto ?pecas",
      "borracharia",
      "funilaria",
      "lava rapido",
      "ipva",
      "licenciamento",
      "detran",
      "multa (?:de )?transito",
      "seguro (?:auto|veiculo)",
      "porto seguro",
    ],
  },
  {
    category: "transporte",
    terms: ["uber", "99 ?app", "99 ?pop", "99 ?taxi", "99 tecnologia", "cabify", "onibus", "metro", "bilhete unico", "sptrans", "riocard", "cptm", "buser", "clickbus", "rodoviaria", "latam", "gol linhas", "azul linhas"],
  },
  {
    category: "saude",
    terms: ["hospital", "clinicas?", "laboratorio", "dentista", "odonto", "unimed", "amil", "bradesco saude", "sulamerica", "hapvida", "notredame", "medico", "psicolog[oa]", "fisioterapia", "otica"],
  },
  {
    category: "contas",
    terms: [
      "boleto",
      "energia",
      "enel",
      "cemig",
      "copel",
      "cpfl",
      "celesc",
      "coelba",
      "neoenergia",
      "equatorial",
      "energisa",
      "light servicos",
      "conta de luz",
      "conta de agua",
      "agua e esgoto",
      "saneamento",
      "sabesp",
      "copasa",
      "cedae",
      "sanepar",
      "embasa",
      "comgas",
      "naturgy",
      "ultragaz",
      "liquigas",
      "vivo",
      "claro",
      "tim",
      "oi fibra",
      "oi movel",
      "telefonica",
      "net servicos",
      "sky",
      "internet",
      "condominio",
      "aluguel",
      "iptu",
      "escola",
      "colegio",
      "faculdade",
      "universidade",
      "mensalidade",
    ],
  },
  { category: "dinheiro", terms: ["saque", "saq", "banco 24 ?h(?:oras)?", "atm"] },
  { category: "transferencias", terms: ["pix", "ted", "doc", "transf", "transferencias?", "transferido"] },
].map(({ terms, ...rule }) => ({ ...rule, pattern: new RegExp(`\\b(?:${terms.join("|")})\\b`) }));

const FALLBACK_CATEGORY = "aleatorios";

// Prefixos do banco que nao dizem nada sobre a compra
const GENERIC_PREFIX =
  /^(?:compra\s+(?:no|com|em)\s+(?:cart[aã]o\s*(?:de\s+)?)?(?:d[eé]bito|cr[eé]dito)?|compra\s+cart[aã]o(?:\s+(?:deb|cred))?)[\s:*-]*/i;

export function classifyDescription(description) {
  const text = normalizeForMatch(description);
  const rule = RULES.find((r) => r.pattern.test(text));
  return { category: rule?.category ?? FALLBACK_CATEGORY, skipNote: rule?.skipNote ?? null };
}

function cleanDescription(description) {
  const cleaned = description.replace(GENERIC_PREFIX, "").trim();
  return cleaned || description.trim();
}

function takeOne(counts, key) {
  const left = counts.get(key) || 0;
  if (left === 0) return false;
  counts.set(key, left - 1);
  return true;
}

// Monta as linhas da tela de conferencia a partir dos lancamentos lidos. Entradas de dinheiro
// ficam de fora: salario ja e receita no app e contaria duas vezes.
export function prepareStatementRows(transactions, existingExpenses = []) {
  const learned = new Map();
  const sameDay = new Map();
  const fixedByAmount = new Map();
  for (const expense of existingExpenses) {
    if (expense.category === "fixos") {
      fixedByAmount.set(expense.amount_cents, expense.description);
      continue;
    }
    learned.set(normalizeForMatch(expense.description), expense.category);
    const key = `${expense.date}|${expense.amount_cents}`;
    sameDay.set(key, (sameDay.get(key) || 0) + 1);
  }

  const outgoing = transactions.filter((t) => t.direction === "out");
  const rows = outgoing.map((tx, id) => {
    const description = cleanDescription(tx.description);
    const classified = classifyDescription(tx.description);

    // Consome um registro por lancamento: reimportar o extrato marca cada linha uma vez e
    // dois cafes iguais no mesmo dia continuam sendo dois
    let note = null;
    let selected = true;
    if (takeOne(sameDay, `${tx.date}|${tx.amount_cents}`)) {
      note = "Já lançado: há um gasto com esta data e valor.";
      selected = false;
    } else if (fixedByAmount.has(tx.amount_cents)) {
      note = `Parece o gasto fixo “${fixedByAmount.get(tx.amount_cents)}”.`;
      selected = false;
    } else if (classified.skipNote) {
      note = classified.skipNote;
      selected = false;
    } else if (tx.dateMissing) {
      note = "Data não lida: confira antes de importar.";
    }

    return {
      id,
      date: tx.date,
      description,
      amount_cents: tx.amount_cents,
      // O que a pessoa ja categorizou antes vale mais que a regra generica
      category: learned.get(normalizeForMatch(description)) || classified.category,
      paymentMethod: /\bpix\b/.test(normalizeForMatch(tx.description)) ? "pix" : "debit",
      selected,
      note,
    };
  });

  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id - b.id));
  return { rows, ignoredIncoming: transactions.length - outgoing.length };
}

// Cada linha vira gasto no mes da propria data: um extrato pode cruzar dois meses
export function buildStatementEntries(rows, accountType) {
  return rows.flatMap((row) =>
    buildExpenseEntries({
      monthKey: row.date.slice(0, 7),
      category: row.category,
      description: row.description,
      amountCents: row.amount_cents,
      paymentMethod: accountType === "card" ? "credit" : row.paymentMethod,
      installments: 1,
      isPaid: true,
      paidDate: row.date,
      date: row.date,
    })
  );
}
