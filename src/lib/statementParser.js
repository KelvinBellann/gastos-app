import { isValidISODate, parseISODate } from "@/lib/dates";
import { normalizeForMatch } from "@/lib/text";

// Transforma extratos em lancamentos { date, description, amount_cents, direction }.
// amount_cents e sempre positivo; direction diz se o dinheiro saiu ("out") ou entrou ("in").
// Cada leitor devolve { transactions, accountType }, com accountType "account" ou "card".

const MONTH_NUMBERS = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const MONTH_PATTERN =
  "jan(?:eiro)?|fev(?:ereiro)?|mar(?:[cç]o)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?";

const NUMERIC_DATE = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}|\d{2}))?(?![\d,])\s*/;
const TEXT_DATE = new RegExp(`^(\\d{1,2})\\s+(?:de\\s+)?(${MONTH_PATTERN})\\.?(?:\\s+(?:de\\s+)?(\\d{4}))?(?=\\s|$)\\s*`, "i");
const WEEKDAY_PREFIX = /^(?:seg|ter|qua|qui|sex|s[aá]b|dom)[a-zçá-]*\.?,?\s+(?=\d)/i;
const RELATIVE_DAY = /^(hoje|ontem)\b[,.\s]*/i;
const FULL_DATE_ANYWHERE = /(?<!\d)(\d{2})[/.-](\d{2})[/.-](\d{4})(?!\d)/;

// O valor pode vir com sinal, R$ e D/C ("- R$ 89,90", "89,90 D", "150,00-"). O OCR costuma
// ler "R$" como "RS" e virgula como ponto. O lookbehind evita casar no meio de numero ou data.
const MONEY_TOKEN =
  /(?<![\p{L}\d/.,:])(?:\(\s*[-−–+]?\s*\)?\s*|[-−–+]\s*)?(?:R\s?[$S]\s*)?[-−–+]?\s*(?:\d{1,3}(?:[.,]\d{3})+[.,]\d{2}|\d+[.,]\d{2})(?![\d/]|[.,]\d)(?:\)|\s*[-−–](?!\s*\p{L})|\s*[DC]\b)?/giu;

const BALANCE_LINE = /\bsaldo\b|\bs a l d o\b|\bsdo\b/;
// Linhas com valor que nao sao lancamento: saldos, totais e cabecalhos do extrato
const NOISE_LINE =
  /\bsaldo\b|\bs a l d o\b|^total\b|\btotal de\b|\blimite\b|\bdisponivel\b|\bfatura (?:atual|aberta|fechada|anterior)\b|\bvencimento\b|\bagencia\b|\bperiodo\b/;
// So decide quando o extrato nao traz sinal; "credito" sozinho casaria "compra no credito"
const INCOMING_WORDS =
  /\brecebid[oa]s?\b|\bdeposito\b|\bsalario\b|\bestorno\b|\bdevolucao\b|\bdevolvido\b|\brendimentos?\b|\breembolso\b|\bcashback\b|\bcredito em conta\b/;

function buildISO(year, month, day) {
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidISODate(iso) ? iso : null;
}

// Extrato em foto costuma trazer so dia e mes. Vale o ano que deixa a data no passado, com
// folga de um mes porque fatura de cartao lista lancamentos futuros.
function resolveDate(day, month, year, today) {
  if (year) return buildISO(year.length === 2 ? `20${year}` : year, month, day);
  const iso = buildISO(today.getFullYear(), month, day);
  if (!iso) return null;
  const limit = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
  return parseISODate(iso) > limit ? buildISO(today.getFullYear() - 1, month, day) : iso;
}

function daysBefore(today, days) {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  return buildISO(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

// Separa a data do comeco da linha: "15/03 COMPRA" vira { date, rest: "COMPRA" }
function takeLeadingDate(line, today) {
  const text = line.replace(WEEKDAY_PREFIX, "");

  const numeric = text.match(NUMERIC_DATE);
  if (numeric) {
    const date = resolveDate(numeric[1], numeric[2], numeric[3], today);
    if (date) return { date, rest: text.slice(numeric[0].length) };
  }

  const written = text.match(TEXT_DATE);
  if (written) {
    const month = MONTH_NUMBERS[written[2].slice(0, 3).toLowerCase()];
    const date = resolveDate(written[1], month, written[3], today);
    if (date) return { date, rest: text.slice(written[0].length) };
  }

  const relative = text.match(RELATIVE_DAY);
  if (relative) {
    return { date: daysBefore(today, relative[1].toLowerCase() === "hoje" ? 0 : 1), rest: text.slice(relative[0].length) };
  }

  return null;
}

// "1.234,56", "1,234.56", "-150.00", "R$ 89,90", "(10,00)", "150,00-", "150,00 D".
// Devolve { cents, sign } ou null; sign e -1 (saiu), 1 (entrou) ou 0 (o texto nao indica).
export function parseMoney(raw) {
  const text = String(raw ?? "").trim();
  const found = text.match(/\d[\d.,]*/);
  if (!found) return null;

  const number = found[0].replace(/[.,]$/, "");
  const separator = Math.max(number.lastIndexOf(","), number.lastIndexOf("."));
  // Ate 2 digitos depois do ultimo separador sao centavos; 3 digitos sao milhar ("1.234")
  const hasDecimals = separator !== -1 && number.length - separator - 1 <= 2;
  const integer = (hasDecimals ? number.slice(0, separator) : number).replace(/[.,]/g, "");
  const decimals = hasDecimals ? number.slice(separator + 1).padEnd(2, "0") : "00";
  const cents = Number(integer || "0") * 100 + Number(decimals);

  const outside = text.replace(found[0], " ");
  let sign = 0;
  if (/\+/.test(outside) || /\bC\s*$/i.test(text)) sign = 1;
  else if (/[-−–]/.test(outside) || /^\s*\(/.test(text) || /\bD\s*$/i.test(text)) sign = -1;
  return { cents, sign };
}

function cleanFragment(text) {
  return text
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, " ")
    .replace(/\b\d{5,}\b/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:;|.,*]+|[\s\-–—:;|.,*]+$/g, "");
}

function hasLetters(text) {
  return (text.match(/\p{L}/gu) || []).length >= 2;
}

function guessAccountType(text) {
  const normalized = normalizeForMatch(text);
  return /\bfatura\b/.test(normalized) && /\b(?:vencimento|limite)\b/.test(normalized) ? "card" : "account";
}

// Texto corrido, vindo do OCR de foto/print ou de PDF. Cobre dois formatos: tabela, com data,
// historico e valor na mesma linha, e lista de app, com a data como titulo e o valor abaixo.
export function parseStatementText(text, today = new Date()) {
  const transactions = [];
  let currentDate = null;
  let pending = [];

  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    // Bordas de tabela viram "|" no OCR
    let line = rawLine.replace(/\|/g, " ").replace(/\s+/g, " ").trim();
    if (!line) continue;

    const leading = takeLeadingDate(line, today);
    let ownDate = false;
    if (leading) {
      currentDate = leading.date;
      line = leading.rest;
      ownDate = true;
    } else {
      const inner = line.match(FULL_DATE_ANYWHERE);
      const date = inner && resolveDate(inner[1], inner[2], inner[3], today);
      if (date) {
        currentDate = date;
        line = line.replace(inner[0], " ");
        ownDate = true;
      }
    }

    if (NOISE_LINE.test(normalizeForMatch(line))) {
      pending = [];
      continue;
    }

    const tokens = [...line.matchAll(MONEY_TOKEN)];
    if (tokens.length === 0) {
      if (ownDate) pending = line.trim() ? [cleanFragment(line)] : [];
      else if (hasLetters(line)) pending = [...pending, cleanFragment(line)].slice(-2);
      continue;
    }

    // Com duas colunas de valor, a primeira e o lancamento e a ultima, o saldo
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    const inline = cleanFragment(line.slice(0, first.index)) || cleanFragment(line.slice(last.index + last[0].length));
    const description = ownDate && inline ? inline : [...pending, inline].filter(Boolean).join(" ");
    pending = [];
    if (!hasLetters(description)) continue;

    const money = parseMoney(first[0]);
    if (!money?.cents) continue;

    const isIncoming = money.sign === 1 || (money.sign === 0 && INCOMING_WORDS.test(normalizeForMatch(description)));
    transactions.push({
      date: currentDate || daysBefore(today, 0),
      dateMissing: !currentDate,
      description,
      amount_cents: money.cents,
      direction: isIncoming ? "in" : "out",
    });
  }

  return { transactions, accountType: guessAccountType(text) };
}

// Prints seguidos do app repetem lancamentos nas pontas. Dentro da mesma imagem dois iguais
// sao compras reais, entao fica o maior numero de repeticoes visto em uma imagem so.
export function mergeStatementPages(pages) {
  const merged = [];
  const kept = new Map();
  for (const page of pages) {
    const inPage = new Map();
    for (const tx of page) {
      const key = `${tx.date}|${tx.amount_cents}|${tx.direction}|${normalizeForMatch(tx.description)}`;
      const count = (inPage.get(key) || 0) + 1;
      inPage.set(key, count);
      if (count > (kept.get(key) || 0)) {
        kept.set(key, count);
        merged.push(tx);
      }
    }
  }
  return merged;
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");
}

// OFX 1.x e SGML sem tag de fechamento (<MEMO>texto), 2.x e XML. O padrao serve para os dois.
function ofxField(block, tag) {
  const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}

export function parseOFX(text) {
  const accountType = /<(?:CREDITCARDMSGSRSV1|CCSTMTRS)>/i.test(text) ? "card" : "account";
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi) || [];

  const transactions = [];
  for (const block of blocks) {
    const posted = ofxField(block, "DTPOSTED").match(/^(\d{4})(\d{2})(\d{2})/);
    const date = posted && buildISO(posted[1], posted[2], posted[3]);
    const money = parseMoney(ofxField(block, "TRNAMT"));
    if (!date || !money?.cents) continue;

    // Cada banco usa um campo: BB poe o tipo em NAME e o detalhe em MEMO, outros so MEMO
    const name = ofxField(block, "NAME");
    const memo = ofxField(block, "MEMO");
    const description = name && memo && !memo.includes(name) && !name.includes(memo) ? `${name} ${memo}` : memo || name;
    if (BALANCE_LINE.test(normalizeForMatch(description))) continue;

    transactions.push({
      date,
      dateMissing: false,
      description: description.replace(/\s+/g, " "),
      amount_cents: money.cents,
      direction: money.sign === -1 ? "out" : "in",
    });
  }
  return { transactions, accountType };
}

function splitCSVLine(line, delimiter) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function detectDelimiter(lines) {
  const sample = lines.slice(0, 40).join("\n").replace(/"[^"]*"/g, "");
  const counts = [";", "\t", ","].map((d) => [d, sample.split(d).length]);
  return counts.reduce((best, c) => (c[1] > best[1] ? c : best))[0];
}

function findCSVColumns(cells) {
  const names = cells.map(normalizeForMatch);
  const date = names.findIndex((n) => /^(?:data|date|dt)\b/.test(n));
  if (date === -1) return null;

  const description = names.flatMap((n, i) =>
    !/^(?:data|date)\b/.test(n) && /descri|historico|lancamento|title|titulo|estabelecimento|detalhe|memo/.test(n) ? [i] : []
  );
  const amounts = names.flatMap((n, i) => (/^(?:valor|vlr|amount|quantia)\b/.test(n) && !/\bus\b|usd|dolar|saldo/.test(n) ? [i] : []));
  // C6 traz valor em dolar e em real; o de real vale
  const amount = amounts.find((i) => /\br\b|brl/.test(names[i])) ?? amounts[0] ?? -1;
  const debit = names.findIndex((n) => /^(?:debito|saida)/.test(n));
  const credit = names.findIndex((n) => /^(?:credito|entrada)/.test(n));
  const type = names.findIndex((n) => /^(?:tipo|natureza|d c|c d|dc)$/.test(n));

  if (description.length === 0 || (amount === -1 && debit === -1 && credit === -1)) return null;
  return { date, description, amount, debit, credit, type };
}

function directionFromTypeCell(value) {
  const name = normalizeForMatch(value);
  if (/^(?:d|debito|saida)$/.test(name)) return "out";
  if (/^(?:c|credito|entrada)$/.test(name)) return "in";
  return null;
}

function parseFileDate(value, today) {
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return buildISO(iso[1], iso[2], iso[3]);
  const numeric = text.match(NUMERIC_DATE);
  return numeric ? resolveDate(numeric[1], numeric[2], numeric[3], today) : null;
}

export function parseCSV(text, today = new Date()) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { transactions: [], accountType: "account" };

  const delimiter = detectDelimiter(lines);
  const rows = lines.map((l) => splitCSVLine(l, delimiter));

  // Alguns bancos colocam dados da conta antes da tabela
  let headerIndex = rows.slice(0, 40).findIndex((cells) => findCSVColumns(cells));
  let columns = headerIndex === -1 ? null : findCSVColumns(rows[headerIndex]);
  if (!columns) {
    // Sem cabecalho (Itau): data; historico; valor
    columns = { date: 0, description: [1], amount: 2, debit: -1, credit: -1, type: -1 };
    headerIndex = -1;
  }

  const parsed = [];
  for (const cells of rows.slice(headerIndex + 1)) {
    const date = parseFileDate(cells[columns.date], today);
    if (!date) continue;

    const description = [...new Set(columns.description.map((i) => cells[i]).filter(Boolean))].join(" ").replace(/\s+/g, " ");
    if (!description || BALANCE_LINE.test(normalizeForMatch(description))) continue;

    const entry = { date, dateMissing: false, description };
    const debit = columns.debit === -1 ? null : parseMoney(cells[columns.debit]);
    const credit = columns.credit === -1 ? null : parseMoney(cells[columns.credit]);
    if (debit?.cents) {
      parsed.push({ ...entry, amount_cents: debit.cents, direction: "out", sign: -1 });
    } else if (credit?.cents) {
      parsed.push({ ...entry, amount_cents: credit.cents, direction: "in", sign: 1 });
    } else {
      const money = columns.amount === -1 ? null : parseMoney(cells[columns.amount]);
      if (!money?.cents) continue;
      const direction = columns.type === -1 ? null : directionFromTypeCell(cells[columns.type]);
      parsed.push({ ...entry, amount_cents: money.cents, direction, sign: money.sign });
    }
  }

  // Sem coluna que diga o sentido, o sinal decide. Em conta a saida vem negativa; em fatura de
  // cartao (Nubank, Inter, C6) e o contrario: compra positiva, pagamento e estorno negativos.
  const open = parsed.filter((t) => !t.direction);
  const isCard = open.length > 0 && open.filter((t) => t.sign !== -1).length / open.length >= 0.7;
  const transactions = parsed.map(({ sign, direction, ...tx }) => {
    if (direction) return { ...tx, direction };
    const isOut = isCard ? sign !== -1 : sign === -1;
    return { ...tx, direction: isOut ? "out" : "in" };
  });

  return { transactions, accountType: isCard ? "card" : "account" };
}

// Banco brasileiro ainda exporta muito em Latin-1; ler como UTF-8 estragaria os acentos
export function decodeBankFile(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function startsWith(bytes, signature) {
  return signature.every((byte, i) => bytes[i] === byte);
}

export async function readBankFile(file, today = new Date()) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) {
    const { extractPdfText } = await import("./statementPdf");
    const text = await extractPdfText(buffer);
    if (!text.trim()) throw new Error("Este PDF não tem texto, só imagem. Tire um print das páginas.");
    return parseStatementText(text, today);
  }
  // Assinaturas de .xlsx (zip) e .xls (OLE)
  if (startsWith(bytes, [0x50, 0x4b]) || startsWith(bytes, [0xd0, 0xcf])) {
    throw new Error("Planilha do Excel não é aceita. Exporte o extrato em CSV ou OFX.");
  }

  const text = decodeBankFile(bytes);
  return /OFXHEADER|<OFX/i.test(text) ? parseOFX(text) : parseCSV(text, today);
}
