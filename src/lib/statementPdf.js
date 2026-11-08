// Le o texto de um PDF de extrato e devolve uma linha de texto para cada linha da pagina.
export async function extractPdfText(data) {
  // Carregados so quando alguem importa um PDF. Importar o worker como modulo faz o pdf.js
  // rodar na thread principal: no app iOS as paginas vem de um esquema proprio (gastos://),
  // e assim nao depende de abrir um Worker nele. Build legacy porque o iOS 17 nao tem
  // todas as APIs novas que o build padrao exige.
  const [pdfjs] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs"),
  ]);

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false });
  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    if (err?.name === "PasswordException") {
      throw new Error("Este PDF tem senha. Exporte em OFX ou CSV, ou tire um print das páginas.");
    }
    throw err;
  }

  const lines = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { items } = await page.getTextContent();
    lines.push(...groupIntoLines(items));
  }
  await loadingTask.destroy();
  return lines.join("\n");
}

// O PDF guarda pedacos de texto soltos, com posicao. Pedacos na mesma altura sao a mesma linha.
function groupIntoLines(items) {
  const TOLERANCE = 3;
  const positioned = items
    .filter((item) => item.str?.trim())
    .map((item) => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }))
    .sort((a, b) => b.y - a.y);

  const rows = [];
  for (const item of positioned) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row.y - item.y) <= TOLERANCE) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  return rows.map((row) => row.items.sort((a, b) => a.x - b.x).map((i) => i.text).join(" "));
}
