import { FinanceRepositoryError } from "@/data/server/finance-repository";

const JSON_CONTENT_TYPE = "application/json";
const DEFAULT_BODY_LIMIT = 64_000;

export class FinanceRequestError extends Error {
  readonly status: 400 | 403 | 413 | 415;

  constructor(status: 400 | 403 | 413 | 415, message: string) {
    super(message);
    this.status = status;
    this.name = "FinanceRequestError";
  }
}

function assertSameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    throw new FinanceRequestError(403, "Permintaan lintas situs ditolak.");
  }

  const origin = request.headers.get("origin");
  if (!origin) return;

  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    throw new FinanceRequestError(403, "Origin permintaan tidak valid.");
  }

  if (origin !== requestOrigin) {
    throw new FinanceRequestError(403, "Permintaan lintas situs ditolak.");
  }
}

export async function readFinanceJson<T extends Record<string, unknown>>(
  request: Request,
  maxBytes = DEFAULT_BODY_LIMIT,
): Promise<T> {
  assertSameOrigin(request);

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== JSON_CONTENT_TYPE) {
    throw new FinanceRequestError(415, "Gunakan Content-Type application/json.");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (!Number.isFinite(declaredBytes) || declaredBytes < 0) {
      throw new FinanceRequestError(400, "Ukuran request tidak valid.");
    }
    if (declaredBytes > maxBytes) {
      throw new FinanceRequestError(413, "Request terlalu besar.");
    }
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new FinanceRequestError(413, "Request terlalu besar.");
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new FinanceRequestError(400, "Format JSON tidak valid.");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new FinanceRequestError(400, "Body request harus berupa object JSON.");
  }

  return value as T;
}

export function financeRouteError(error: unknown) {
  if (error instanceof FinanceRequestError) {
    return Response.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (error instanceof FinanceRepositoryError && error.kind === "UNAUTHENTICATED") {
    return Response.json(
      { error: "Sesi login tidak valid." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  console.error("Finance route error", error);
  return Response.json(
    { error: "Data belum bisa diproses. Coba lagi." },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
