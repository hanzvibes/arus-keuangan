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

function routeContext(request?: Request) {
  let path = "";
  if (request) {
    try {
      path = new URL(request.url).pathname;
    } catch {
      path = "";
    }
  }

  return {
    requestId: crypto.randomUUID(),
    method: request?.method ?? "UNKNOWN",
    path,
    vercelId: request?.headers.get("x-vercel-id") || undefined,
  };
}

function errorHeaders(requestId: string) {
  return {
    "Cache-Control": "no-store",
    "X-Request-Id": requestId,
  };
}

export function financeRouteError(error: unknown, request?: Request) {
  const context = routeContext(request);

  if (error instanceof FinanceRequestError) {
    return Response.json(
      { error: error.message, requestId: context.requestId },
      { status: error.status, headers: errorHeaders(context.requestId) },
    );
  }

  if (error instanceof FinanceRepositoryError && error.kind === "UNAUTHENTICATED") {
    return Response.json(
      { error: "Sesi login tidak valid.", requestId: context.requestId },
      { status: 401, headers: errorHeaders(context.requestId) },
    );
  }

  const detail = error instanceof FinanceRepositoryError
    ? { name: error.name, kind: error.kind, message: error.message }
    : error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: "UnknownError", message: "Non-error value thrown" };

  console.error(JSON.stringify({
    level: "error",
    event: "finance_route_error",
    ...context,
    error: detail,
  }));

  return Response.json(
    { error: "Data belum bisa diproses. Coba lagi.", requestId: context.requestId },
    { status: 500, headers: errorHeaders(context.requestId) },
  );
}
