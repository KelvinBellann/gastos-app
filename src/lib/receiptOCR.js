import Tesseract from "tesseract.js";

let worker = null;

async function initWorker() {
  if (!worker) {
    // tesseract.js 7 recebe (langs, oem, options); a forma antiga createWorker({ logger })
    // fazia o objeto de opcoes ser lido como lista de idiomas e o OCR nunca inicializava.
    worker = await Tesseract.createWorker("por+eng", Tesseract.OEM.LSTM_ONLY);
  }
  return worker;
}

export async function extractTextFromImage(imageFile) {
  try {
    const workerInstance = await initWorker();

    const {
      data: { text, confidence },
    } = await workerInstance.recognize(imageFile);

    return {
      text: text || "",
      confidence: Math.round(confidence),
      success: true,
    };
  } catch (error) {
    console.error("OCR Error:", error);
    return {
      text: "",
      confidence: 0,
      success: false,
      error: error.message,
    };
  }
}

const MAX_IMAGE_SIDE = 2400;

// Foto de celular tem 12 MP e a orientacao so nos metadados, que o OCR ignora. Desenhar no
// canvas aplica a rotacao, reduz a imagem e ainda converte HEIC, que o tesseract nao le.
async function prepareImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Extrato e tabela: no modo automatico o tesseract le cada coluna separada e a descricao
// perde o valor da mesma linha. O modo de bloco unico le linha a linha.
export async function extractStatementText(imageFile) {
  try {
    const workerInstance = await initWorker();
    await workerInstance.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK });
    try {
      const prepared = await prepareImage(imageFile);
      const {
        data: { text, confidence },
      } = await workerInstance.recognize(prepared);
      return { text: text || "", confidence: Math.round(confidence), success: true };
    } finally {
      // O worker e o mesmo da leitura de nota, que continua no modo automatico
      await workerInstance.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.AUTO });
    }
  } catch (error) {
    console.error("OCR Error:", error);
    return { text: "", confidence: 0, success: false, error: error.message };
  }
}

export async function terminateWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
