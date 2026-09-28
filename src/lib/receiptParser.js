import { todayISO, isValidISODate } from "@/lib/dates";

const KNOWN_STORES = [
  "carrefour",
  "pão de açúcar",
  "extra",
  "walmart",
  "mercado livre",
  "sonda",
  "condor",
  "zona sul",
  "comper",
  "atacadão",
  "assaí",
  "dia",
  "prezunic",
  "cesta",
  "covabra",
  "supermercado",
  "mercado",
  "app",
  "a.c",
];

// Casamento por palavra inteira: com includes, "dia" batia em "media" e "app" em "apple"
const STORE_PATTERNS = KNOWN_STORES.map(
  (store) => new RegExp(`(^|[^\\p{L}])${store.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}])`, "iu")
);

// Linhas de rodape do cupom que tem preco mas nao sao produto
const NON_ITEM_LINE = /\b(sub\s*total|total|troco|dinheiro|cart[aã]o|d[eé]bito|cr[eé]dito|pix|cnpj|cpf|desconto|valor\s+pago|recebido|tributos?|imposto)\b/i;

function extractStoreName(text) {
  const lines = text.split("\n").slice(0, 10);

  for (const line of lines) {
    for (const pattern of STORE_PATTERNS) {
      if (pattern.test(line)) {
        return line.trim();
      }
    }
  }

  return "Loja desconhecida";
}

function extractDate(text) {
  const datePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})/;
  const match = text.match(datePattern);

  if (match) {
    let [, day, month, year] = match;
    if (year.length === 2) {
      year = "20" + year;
    }
    const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    // OCR pode ler 31/02 ou 15/13; data invalida quebrava o insert na coluna DATE
    if (isValidISODate(iso)) return iso;
  }

  return todayISO();
}

function extractItems(text) {
  const lines = text.split("\n");
  const items = [];

  const pricePattern = /R?\$?\s*(\d+[.,]\d{2})/g;

  let lineNum = 0;
  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length < 2) continue;
    if (NON_ITEM_LINE.test(trimmed)) continue;

    const prices = [...trimmed.matchAll(pricePattern)];

    if (prices.length >= 1) {
      const lastPrice = prices[prices.length - 1][1];
      const priceInCents = parseBRLPrice(lastPrice);

      const productName = trimmed
        .replace(/R?\$?\s*\d+[.,]\d{2}/g, "")
        .replace(/x\s*\d+(?:[.,]\d+)?/g, "")
        .trim();

      if (productName.length > 2 && priceInCents > 0) {
        items.push({
          productName: productName.substring(0, 100),
          quantity: 1,
          unitPriceCents: priceInCents,
          totalPriceCents: priceInCents,
          position: lineNum,
        });
        lineNum++;
      }
    }
  }

  return items.slice(0, 100);
}

function parseBRLPrice(priceStr) {
  const clean = priceStr.replace(/R?\$?\s*/g, "").replace(",", ".");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

export function parseReceipt(ocrText) {
  const storeName = extractStoreName(ocrText);
  const receiptDate = extractDate(ocrText);
  const items = extractItems(ocrText);
  const totalCents = items.reduce((sum, item) => sum + item.totalPriceCents, 0);

  return {
    storeName,
    receiptDate,
    items,
    totalCents,
    rawText: ocrText,
  };
}

export function normalizeProductName(name) {
  // A unidade so e removida quando termina a palavra: sem o lookahead, "2 leite"
  // casava "2 l" e virava "eite". Alternativas maiores primeiro (unid antes de un, kg antes de g).
  return name
    .toLowerCase()
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:unid|un|kg|ml|g|l)\.?(?=\s|$)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
