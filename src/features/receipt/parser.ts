import { inferReceiptCategory } from "./category.ts";
import { receiptArithmetic, receiptNeedsReview } from "./validation.ts";
import type { ReceiptDraft, ReceiptField, ReceiptOcrResult, ReceiptWord, ReceiptItem } from "./types.ts";

function field<T>(value: T | null, source = "", words: ReceiptWord[] = [], inferred = false, ambiguous = false): ReceiptField<T> {
  const matched = words.filter(word => source && source.toLowerCase().includes(word.text.toLowerCase())).map(word => word.confidence).filter((value): value is number => value !== null);
  return { value, source, confidence: matched.length ? Math.round(matched.reduce((a, b) => a + b, 0) / matched.length) : null, inferred, ambiguous, checked: false };
}
export function parseReceiptMoney(text: string): number | null {
  let cleaned = text.replace(/(?:rp|idr)/gi, "").replace(/\s/g, "").replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  const lastComma = cleaned.lastIndexOf(","), lastDot = cleaned.lastIndexOf(".");
  const decimalAt = Math.max(lastComma, lastDot);
  if (decimalAt >= 0 && cleaned.length - decimalAt - 1 === 2) cleaned = cleaned.slice(0, decimalAt);
  const value = Number(cleaned.replace(/[.,]/g, ""));
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000_000 ? value : null;
}
function dateValue(source: string): string | null {
  const match = source.match(/(\d{1,4})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (!match) return null;
  const [, a, b, c] = match;
  const yyyy = a.length === 4 ? Number(a) : c.length === 4 ? Number(c) : Number(c) + 2000;
  const mm = Number(b), dd = a.length === 4 ? Number(c) : Number(a);
  const result = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const parsed = new Date(`${result}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === result ? result : null;
}
function moneyLine(lines: string[], pattern: RegExp, words: ReceiptWord[]): ReceiptField<number> {
  const candidates = lines.filter(line => pattern.test(line));
  const source = candidates.at(-1) ?? "";
  const value = source ? parseReceiptMoney(source.match(/(?:rp\s*)?\d[\d.,]*(?:[.,]\d{2})?/gi)?.at(-1) ?? "") : null;
  return field(value, source, words, false, candidates.length > 1);
}
export function parseReceipt(ocr: ReceiptOcrResult): ReceiptDraft {
  const lines = ocr.text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const merchantLine = lines.find(line => /[a-z]{3}/i.test(line) && !/^(struk|receipt|invoice|tanggal|date|telp|alamat|jl\.|no\.)/i.test(line)) ?? "";
  const dateLine = lines.find(line => dateValue(line) !== null) ?? "";
  const timeLine = lines.find(line => /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/.test(line)) ?? "";
  const total = moneyLine(lines, /\b(?:grand\s*total|total\s*bayar|total\s*belanja|total\s*harga|jumlah\s*bayar|amount\s*due|total)\b/i, ocr.words);
  const subtotal = moneyLine(lines, /\b(?:sub\s*total|subtotal)\b/i, ocr.words);
  const tax = moneyLine(lines, /\b(?:ppn|pajak|tax|vat)\b/i, ocr.words);
  const service = moneyLine(lines, /\b(?:service|layanan)\b/i, ocr.words);
  const discount = moneyLine(lines, /\b(?:diskon|discount|potongan)\b/i, ocr.words);
  const paymentLine = lines.find(line => /\b(?:qris|debit|kredit|credit|cash|tunai|gopay|ovo|dana|shopeepay|transfer)\b/i.test(line)) ?? "";
  const payment = paymentLine.match(/\b(qris|debit|kredit|credit|cash|tunai|gopay|ovo|dana|shopeepay|transfer)\b/i)?.[1] ?? null;
  const invoiceLine = lines.find(line => /\b(?:invoice|faktur|no\.?\s*(?:trx|transaksi|struk)|receipt\s*no)\b/i.test(line)) ?? "";
  const invoice = invoiceLine.match(/(?:[:#]\s*|\bno\.?\s+)([A-Za-z0-9/-]{3,40})/i)?.[1] ?? null;
  const items: ReceiptItem[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (/\b(total|subtotal|pajak|tax|ppn|diskon|service|bayar|kembali|invoice|tanggal|date)\b/i.test(line)) continue;
    const wrapped = line.match(/^(\d+(?:[.,]\d+)?)\s*[xX@]\s*(?:Rp\s*)?(\d[\d.,]*)\s+(?:Rp\s*)?(\d[\d.,]*)$/);
    const previous = lines[index - 1] ?? "";
    if (wrapped && /[a-z]/i.test(previous) && !/\b(total|subtotal|pajak|tax|ppn|diskon|service|bayar|kembali|invoice|tanggal|date)\b/i.test(previous)) {
      items.push({ name: previous.slice(0, 120), quantity: Number(wrapped[1].replace(",", ".")), unitPrice: parseReceiptMoney(wrapped[2]), total: parseReceiptMoney(wrapped[3]), confidence: field(null, `${previous} ${line}`, ocr.words).confidence });
      continue;
    }
    const match = line.match(/^(.{3,90}?)\s+(?:(\d+(?:[.,]\d+)?)\s*[xX@]\s*(?:Rp\s*)?(\d[\d.,]*)\s+)?(?:Rp\s*)?(\d[\d.,]*)$/);
    if (match && /[a-z]/i.test(match[1])) items.push({ name: match[1].trim(), quantity: match[2] ? Number(match[2].replace(",", ".")) : null, unitPrice: match[3] ? parseReceiptMoney(match[3]) : null, total: parseReceiptMoney(match[4]), confidence: field(null, line, ocr.words).confidence });
  }
  const category = inferReceiptCategory(merchantLine, items.map(item => item.name).join(" "));
  const draft: ReceiptDraft = {
    merchant: field(merchantLine || null, merchantLine, ocr.words), date: field(dateValue(dateLine), dateLine, ocr.words),
    time: field(timeLine.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/)?.[0] ?? null, timeLine, ocr.words),
    total, subtotal, tax, service, discount,
    paymentMethod: field(payment, paymentLine, ocr.words), invoice: field(invoice, invoiceLine, ocr.words),
    category: field(category, merchantLine, ocr.words, true, category === "Lainnya"), note: "", items,
    rawText: ocr.text.slice(0, 30000), warnings: [],
  };
  if (!total.value) draft.warnings.push("Total tidak ditemukan. Isi nominal secara manual.");
  if (!draft.date.value) draft.warnings.push("Tanggal tidak ditemukan. Periksa dan isi tanggal.");
  if (receiptArithmetic(draft) === "mismatch") draft.warnings.push("Rincian nominal tidak cocok dengan total. Periksa struk.");
  if (receiptNeedsReview(draft)) draft.warnings.push("Beberapa hasil pembacaan perlu diperiksa.");
  return draft;
}
