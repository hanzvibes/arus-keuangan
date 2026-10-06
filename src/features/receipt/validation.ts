import type { ReceiptDraft, ReceiptItem } from "./types.ts";

export function validRupiah(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000_000; }
export function validDate(value: string): boolean { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(`${value}T12:00:00Z`); return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value; }
export function validateReceiptItem(item: ReceiptItem): boolean {
  return item.name.trim().length > 0 && item.name.length <= 120 &&
    (item.quantity === null || (Number.isFinite(item.quantity) && item.quantity > 0 && item.quantity <= 100000)) &&
    (item.unitPrice === null || validRupiah(item.unitPrice)) && (item.total === null || validRupiah(item.total));
}
export function receiptArithmetic(draft: ReceiptDraft): "match" | "mismatch" | "unknown" {
  const { subtotal, tax, service, discount, total } = draft;
  if (subtotal.value === null || total.value === null || [tax, service, discount].some(field => field.value === null)) return "unknown";
  const calculated = subtotal.value + (tax.value ?? 0) + (service.value ?? 0) - (discount.value ?? 0);
  return Math.abs(calculated - total.value) <= 100 ? "match" : "mismatch";
}
export function receiptNeedsReview(draft: ReceiptDraft): boolean {
  return !draft.total.value || !draft.date.value ||
    [draft.merchant, draft.date, draft.total, draft.paymentMethod].some(field => field.ambiguous || field.confidence !== null && field.confidence < 80) ||
    receiptArithmetic(draft) === "mismatch";
}
export function validateReceiptDraft(draft: ReceiptDraft): boolean {
  return draft.merchant.value !== null && draft.merchant.value.trim().length > 0 && draft.merchant.value.trim().length <= 100 &&
    validDate(draft.date.value ?? "") && validRupiah(draft.total.value) && draft.total.value > 0 &&
    (draft.time.value === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time.value)) &&
    (draft.paymentMethod.value === null || draft.paymentMethod.value.length <= 50) &&
    (draft.invoice.value === null || draft.invoice.value.length <= 80) &&
    (draft.category.value === null || draft.category.value.length <= 50) &&
    draft.note.length <= 150 && draft.items.length <= 100 && draft.items.every(validateReceiptItem) &&
    draft.rawText.length <= 30000;
}
