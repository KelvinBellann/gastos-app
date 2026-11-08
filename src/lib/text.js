// Padrao unico de escrita para o que a pessoa digita: primeira letra maiuscula e o resto
// minusculo, sem espacos sobrando. Sem isso "cafe", "Cafe" e "CAFE" viravam tres
// lancamentos diferentes no agrupamento da lista.
export function toSentenceCase(text) {
  const clean = String(text ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
  // Primeira LETRA, nao primeiro caractere: "2 paes" e "(promo) arroz" tambem seguem o padrao
  return clean.replace(/\p{L}/u, (c) => c.toLocaleUpperCase("pt-BR"));
}

// Forma usada so para comparar textos: sem acento, minuscula e apenas letras e numeros
export function normalizeForMatch(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
