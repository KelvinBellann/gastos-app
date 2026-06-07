import Tesseract from "tesseract.js";

let worker = null;

async function initWorker() {
  if (!worker) {
    worker = await Tesseract.createWorker({
      logger: (m) => {
        if (m.status === "recognizing text") {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });
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
