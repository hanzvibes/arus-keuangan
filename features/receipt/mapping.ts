import type { ReceiptDraft, ReceiptMeta } from "./types";

export function mapReceiptTransaction(draft: ReceiptDraft, accountId: string, id: string) {
  return { id, type: "expense" as const, amount: draft.total.value, date: draft.date.value, accountId, toAccountId: null, category: draft.category.value || "Lainnya", note: draft.note || draft.merchant.value || "Struk" };
}
export function mapReceiptMeta(draft: ReceiptDraft, transactionId: string, scanId: string | null, imageHash: string | null, photoPath: string | null): ReceiptMeta {
  return { transactionId, scanId, merchant: draft.merchant.value ?? "", paymentMethod: draft.paymentMethod.value ?? "", invoice: draft.invoice.value ?? "", time: draft.time.value, subtotal: draft.subtotal.value, tax: draft.tax.value, service: draft.service.value, discount: draft.discount.value, items: draft.items, fields: Object.fromEntries(Object.entries(draft).filter(([key]) => !["items", "rawText", "warnings", "note"].includes(key))), imageHash, photoPath };
}
