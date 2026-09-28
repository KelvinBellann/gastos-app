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

export async function terminateWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
