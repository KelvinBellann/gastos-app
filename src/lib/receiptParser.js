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

function normalizeText(text) {
  return text.toLowerCase().trim();
}

function extractStoreName(text) {
  const lines = text.split("\n").slice(0, 10);

  for (const line of lines) {
    const normalized = normalizeText(line);
    for (const store of KNOWN_STORES) {
      if (normalized.includes(store)) {
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
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return new Date().toISOString().split("T")[0];
}

function extractItems(text) {
  const lines = text.split("\n");
  const items = [];

  const pricePattern = /R?\$?\s*(\d+[.,]\d{2})/g;
  const lineWithPricePattern = /^(.+?)\s+(?:x\s*(\d+(?:[.,]\d+)?)\s+)?.*?(\d+[.,]\d{2})?\s*$/;

  let lineNum = 0;
  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length < 2) continue;

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
  return name
    .toLowerCase()
    .replace(/\d+\s*(?:l|kg|g|ml|un|un\.|unid)/gi, "")
    .trim();
}
