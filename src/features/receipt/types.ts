export type ReceiptWord = { text: string; confidence: number | null; x: number; y: number; width: number; height: number };
export type ReceiptOcrResult = { text: string; words: ReceiptWord[]; engine: string };
export type ReceiptField<T> = { value: T | null; source: string; confidence: number | null; ambiguous: boolean; inferred: boolean; checked: boolean };
export type ReceiptItem = { name: string; quantity: number | null; unitPrice: number | null; total: number | null; confidence: number | null };
export type ReceiptDraft = {
  merchant: ReceiptField<string>; date: ReceiptField<string>; time: ReceiptField<string>;
  total: ReceiptField<number>; subtotal: ReceiptField<number>; tax: ReceiptField<number>;
  service: ReceiptField<number>; discount: ReceiptField<number>; paymentMethod: ReceiptField<string>;
  invoice: ReceiptField<string>; category: ReceiptField<string>; note: string; items: ReceiptItem[];
  rawText: string; warnings: string[];
};
export type ReceiptStatus = "processing" | "success" | "review" | "failed";
export type ReceiptScan = { id: string; status: ReceiptStatus; draft: ReceiptDraft | null; imageHash: string | null; visualHash: string | null; savePhoto: boolean; transactionId: string | null; version: number; updatedAt: string; createdAt: string };
export type ReceiptMeta = { transactionId: string; scanId: string | null; merchant: string; paymentMethod: string; invoice: string; time: string | null; subtotal: number | null; tax: number | null; service: number | null; discount: number | null; items: ReceiptItem[]; fields: Record<string, unknown>; imageHash: string | null; photoPath: string | null };
export type ReceiptProgress = { stage: "engine" | "image" | "ocr" | "parsing"; percent?: number };
export interface ReceiptOcrEngine { recognize(image: Blob, progress: (value: ReceiptProgress) => void, signal: AbortSignal): Promise<ReceiptOcrResult> }
