import type { ReceiptDraft, ReceiptScan, ReceiptMeta } from "./types";
import { createClient } from "@/lib/supabase/client";
import { readReceiptDrafts, writeReceiptDrafts } from "@/lib/offline";

async function receiptRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, { method, cache: "no-store", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && !(response.status === 409 && data.duplicate)) throw Error(data.error || "Struk belum bisa diproses.");
  return data as T;
}
export const receiptApi = {
  list: () => receiptRequest<{ scans: ReceiptScan[] }>("/api/receipt-scans"),
  get: (id: string) => receiptRequest<ReceiptScan>(`/api/receipt-scans/${id}`),
  create: (scan: Omit<ReceiptScan, "version" | "updatedAt" | "createdAt" | "transactionId">) => receiptRequest<{ version: number }>("/api/receipt-scans", "POST", scan),
  update: (scan: ReceiptScan) => receiptRequest<{ version: number }>(`/api/receipt-scans/${scan.id}`, "PATCH", { expectedVersion: scan.version, status: scan.status, draft: scan.draft, imageHash: scan.imageHash, visualHash: scan.visualHash, savePhoto: scan.savePhoto }),
  remove: (id: string) => receiptRequest<{ ok: boolean }>(`/api/receipt-scans/${id}`, "DELETE", {}),
  finalize: (id: string, body: { expectedVersion: number; transactionId: string; accountId: string; draft: ReceiptDraft; duplicateToken: string | null; photoPath: string | null }) => receiptRequest<{ transactionId?: string; duplicate?: boolean; transactionIds?: string[]; token?: string }>(`/api/receipt-scans/${id}/finalize`, "POST", body),
  updateTransaction: (id: string, body: { expectedVersion: number; accountId: string; draft: ReceiptDraft; photoPath: string | null }) => receiptRequest<{ transactionId: string }>(`/api/receipt-scans/${id}/update-transaction`, "POST", body),
  detail: (id: string) => receiptRequest<{ receipt: ReceiptMeta; photoUrl: string | null }>(`/api/receipts/${id}`),
  reservePhoto: (scanId: string, extension: string) => receiptRequest<{ photoPath: string }>("/api/receipt-photos", "POST", { scanId, extension }),
};
export async function listAndSyncReceiptDrafts(): Promise<ReceiptScan[]> {
  const { data } = await createClient().auth.getUser();
  if (!data.user) return [];
  const local = await readReceiptDrafts<ReceiptScan>(data.user.id).catch(() => null) || [];
  let remote: ReceiptScan[];
  try { remote = (await receiptApi.list()).scans; } catch { return local; }
  const pending: ReceiptScan[] = [];
  for (const item of local) {
    try {
      const saved = remote.find(row => row.id === item.id);
      if (saved && saved.version !== item.version) { pending.push(item); continue; }
      const result = saved ? await receiptApi.update(item) : await receiptApi.create(item);
      let next = { ...item, version: result.version };
      if (!saved && item.draft) { const updated = await receiptApi.update(next); next = { ...next, version: updated.version }; }
      remote = [next, ...remote.filter(row => row.id !== item.id)];
    } catch { pending.push(item); }
  }
  await writeReceiptDrafts(data.user.id, pending).catch(() => {});
  return [...pending, ...remote.filter(row => !pending.some(item => item.id === row.id))];
}
