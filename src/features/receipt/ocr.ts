import type { ReceiptOcrEngine, ReceiptOcrResult, ReceiptProgress, ReceiptWord } from "./types";

export class BrowserReceiptOcr implements ReceiptOcrEngine {
  async recognize(image: Blob, progress: (value: ReceiptProgress) => void, signal: AbortSignal): Promise<ReceiptOcrResult> {
    progress({ stage: "engine" });
    const { createWorker } = await import("tesseract.js");
    if (signal.aborted) throw new DOMException("Scan dibatalkan", "AbortError");
    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
    const abort = () => { void worker?.terminate(); };
    signal.addEventListener("abort", abort, { once: true });
    try {
      worker = await createWorker("ind+eng", 1, { workerPath: "/ocr/worker.min.js", corePath: "/ocr", langPath: "/ocr", gzip: false, logger: event => {
        if (signal.aborted) return;
        if (event.status === "recognizing text") progress({ stage: "ocr", percent: Math.round(event.progress * 100) });
        else progress({ stage: "engine" });
      } });
      if (signal.aborted) throw new DOMException("Scan dibatalkan", "AbortError");
      const result = await worker.recognize(image, {}, { blocks: true });
      const words: ReceiptWord[] = [];
      for (const block of result.data.blocks ?? []) for (const paragraph of block.paragraphs ?? []) for (const line of paragraph.lines ?? []) for (const word of line.words ?? []) {
        words.push({ text: word.text, confidence: Number.isFinite(word.confidence) ? word.confidence : null, x: word.bbox.x0, y: word.bbox.y0, width: word.bbox.x1 - word.bbox.x0, height: word.bbox.y1 - word.bbox.y0 });
      }
      return { text: result.data.text, words, engine: "tesseract.js" };
    } finally { signal.removeEventListener("abort", abort); if (worker) await worker.terminate().catch(() => {}); }
  }
}
