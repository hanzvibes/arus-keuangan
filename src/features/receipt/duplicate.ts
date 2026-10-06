import type { ReceiptScan } from "./types.ts";

export function receiptDuplicateReasons(candidate: ReceiptScan, current: ReceiptScan): string[] {
  if (candidate.id === current.id || !candidate.draft || !current.draft || !candidate.transactionId) return [];
  const reasons: string[] = [];
  if (candidate.imageHash && candidate.imageHash === current.imageHash) reasons.push("Foto identik");
  if (candidate.visualHash && candidate.visualHash === current.visualHash) reasons.push("Foto terlihat mirip");
  const a = candidate.draft, b = current.draft;
  const merchant = (value: string | null) => (value ?? "").toLocaleLowerCase("id-ID").replace(/[^a-z0-9]/g, "");
  if (a.invoice.value && b.invoice.value && a.invoice.value === b.invoice.value && merchant(a.merchant.value) === merchant(b.merchant.value)) reasons.push("Nomor invoice dan merchant sama");
  if (merchant(a.merchant.value) && merchant(a.merchant.value) === merchant(b.merchant.value) && a.date.value === b.date.value && a.total.value === b.total.value) reasons.push("Merchant, tanggal, dan total sama");
  return reasons;
}
