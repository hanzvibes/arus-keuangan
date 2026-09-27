import type { Backup } from "../../lib/backup.ts";
import type { FinanceData } from "../../domain/finance/types.ts";

export class FinanceApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function request<T>(url: string, fallback: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new FinanceApiError(body.error || fallback, response.status);
  }
  return response.json() as Promise<T>;
}

const json = (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>): RequestInit => ({
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

export const financeApi = {
  read: () => request<FinanceData>("/api/data", "Data belum bisa dimuat.", { cache: "no-store" }),
  save: (method: "POST" | "PATCH", body: Record<string, unknown>) => request<{ id?: string }>("/api/data", "Gagal menyimpan.", json(method, body)),
  remove: (body: Record<string, unknown>) => request<{ ok: boolean }>("/api/data", "Gagal menghapus.", json("DELETE", body)),
  reconcile: (body: { accountId: string; expectedBalance: number; actualBalance: number; note: string; date: string }) => request<{ id: string }>("/api/reconcile", "Saldo belum bisa dicocokkan.", json("POST", body)),
  backup: () => request<Backup>("/api/backup", "Cadangan belum bisa diunduh.", { cache: "no-store" }),
  restore: (backup: Backup) => request<{ ok: boolean }>("/api/backup", "Pemulihan gagal.", json("POST", { confirm: "GANTI DATA", backup })),
  category: (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) => request<{ ok?: boolean }>("/api/categories", "Kategori belum bisa diproses.", json(method, body)),
  recurring: (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) => request<{ ok?: boolean }>("/api/recurring", "Jadwal belum bisa diproses.", json(method, body)),
};
