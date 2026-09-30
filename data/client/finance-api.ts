import type { Backup } from "../../lib/backup.ts";
import type { FinanceData } from "../../domain/finance/types.ts";

const DEFAULT_TIMEOUT_MS = 10_000;
const BACKUP_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 200;
const RETRYABLE_STATUS = new Set([502, 503, 504]);

export type FinanceApiErrorKind = "http" | "network" | "timeout";

export class FinanceApiError extends Error {
  readonly status: number;
  readonly requestId: string | null;
  readonly kind: FinanceApiErrorKind;

  constructor(
    message: string,
    status: number,
    requestId: string | null = null,
    kind: FinanceApiErrorKind = "http",
  ) {
    super(message);
    this.name = "FinanceApiError";
    this.status = status;
    this.requestId = requestId;
    this.kind = kind;
  }
}

type RequestPolicy = {
  timeoutMs?: number;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const upstreamSignal = options.signal;
  let timedOut = false;

  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
  if (upstreamSignal?.aborted) abortFromUpstream();
  else upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new FinanceApiError(
        "Koneksi ke server terlalu lama. Coba lagi.",
        0,
        null,
        "timeout",
      );
    }

    if (error instanceof FinanceApiError) throw error;

    throw new FinanceApiError(
      "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.",
      0,
      null,
      "network",
    );
  } finally {
    clearTimeout(timeout);
    upstreamSignal?.removeEventListener("abort", abortFromUpstream);
  }
}

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({})) as {
    error?: string;
    requestId?: string;
  };
  const requestId = body.requestId || response.headers.get("x-request-id");

  return new FinanceApiError(
    body.error || fallback,
    response.status,
    requestId || null,
    "http",
  );
}

async function request<T>(
  url: string,
  fallback: string,
  options: RequestInit = {},
  policy: RequestPolicy = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const safeToRetry = method === "GET";
  const timeoutMs = policy.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const attempts = safeToRetry ? 2 : 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);

      if (response.ok) {
        return response.json() as Promise<T>;
      }

      if (
        safeToRetry &&
        attempt === 0 &&
        RETRYABLE_STATUS.has(response.status)
      ) {
        await delay(RETRY_DELAY_MS);
        continue;
      }

      throw await responseError(response, fallback);
    } catch (error) {
      const apiError = error instanceof FinanceApiError
        ? error
        : new FinanceApiError(fallback, 0, null, "network");

      if (
        safeToRetry &&
        attempt === 0 &&
        apiError.kind === "network"
      ) {
        await delay(RETRY_DELAY_MS);
        continue;
      }

      throw apiError;
    }
  }

  throw new FinanceApiError(fallback, 0, null, "network");
}

const json = (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const financeApi = {
  read: () => request<FinanceData>("/api/data", "Data belum bisa dimuat.", { cache: "no-store" }),
  save: (method: "POST" | "PATCH", body: Record<string, unknown>) => request<{ id?: string }>("/api/data", "Gagal menyimpan.", json(method, body)),
  remove: (body: Record<string, unknown>) => request<{ ok: boolean }>("/api/data", "Gagal menghapus.", json("DELETE", body)),
  reconcile: (body: { accountId: string; expectedBalance: number; actualBalance: number; note: string; date: string }) => request<{ id: string }>("/api/reconcile", "Saldo belum bisa dicocokkan.", json("POST", body)),
  backup: () => request<Backup>("/api/backup", "Cadangan belum bisa diunduh.", { cache: "no-store" }, { timeoutMs: BACKUP_TIMEOUT_MS }),
  restore: (backup: Backup) => request<{ ok: boolean }>("/api/backup", "Pemulihan gagal.", json("POST", { confirm: "GANTI DATA", backup }), { timeoutMs: BACKUP_TIMEOUT_MS }),
  category: (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) => request<{ ok?: boolean }>("/api/categories", "Kategori belum bisa diproses.", json(method, body)),
  goal: (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) => request<{ ok: boolean }>("/api/goals", "Target belum bisa disimpan.", json(method, body)),
  recurring: (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) => request<{ ok?: boolean }>("/api/recurring", "Jadwal belum bisa diproses.", json(method, body)),
};