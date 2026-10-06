import { createClient } from "@/lib/supabase/server";
import { FinanceRequestError } from "@/app/api/_shared/finance-route";
import { validDate, validRupiah, validateReceiptItem } from "./validation";
import type { ReceiptDraft } from "./types";

export async function receiptClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (error || !userId) throw Error("UNAUTHENTICATED");
  return { supabase, userId };
}
export const receiptId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const receiptHash = (value: unknown): value is string | null => value === null || typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
export function receiptDraftShape(value: unknown): value is ReceiptDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const d = value as Partial<ReceiptDraft>;
  if (!Array.isArray(d.items) || d.items.length > 100 || !d.items.every(validateReceiptItem) || typeof d.rawText !== "string" || d.rawText.length > 30000 || typeof d.note !== "string" || d.note.length > 150 || !Array.isArray(d.warnings) || d.warnings.length > 30) return false;
  for (const key of ["merchant","date","time","total","subtotal","tax","service","discount","paymentMethod","invoice","category"] as const) {
    const f = d[key]; if (!f || typeof f !== "object" || typeof f.source !== "string" || f.source.length > 500 || (f.confidence !== null && (typeof f.confidence !== "number" || f.confidence < 0 || f.confidence > 100)) || typeof f.ambiguous !== "boolean" || typeof f.inferred !== "boolean" || typeof f.checked !== "boolean") return false;
    if (["total","subtotal","tax","service","discount"].includes(key)) { if (f.value !== null && !validRupiah(f.value)) return false; }
    else if (f.value !== null && (typeof f.value !== "string" || f.value.length > 120)) return false;
  }
  return d.date?.value === null || validDate(String(d.date?.value));
}

function receiptContext(request?: Request) {
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

function receiptErrorHeaders(requestId: string) {
  return {
    "Cache-Control": "no-store",
    "X-Request-Id": requestId,
  };
}

export function receiptError(error: unknown, request?: Request) {
  const context = receiptContext(request);
  const headers = receiptErrorHeaders(context.requestId);

  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return Response.json(
      { error: "Sesi login tidak valid.", requestId: context.requestId },
      { status: 401, headers },
    );
  }
  if (error instanceof FinanceRequestError) {
    return Response.json(
      { error: error.message, requestId: context.requestId },
      { status: error.status, headers },
    );
  }

  const record = error && typeof error === "object" ? error as Record<string, unknown> : null;
  const detail = error instanceof Error
    ? { name: error.name, message: error.message }
    : {
        name: "ReceiptError",
        message: typeof record?.message === "string" ? record.message : "Non-error value thrown",
        code: typeof record?.code === "string" ? record.code : undefined,
      };

  console.error(JSON.stringify({
    level: "error",
    event: "receipt_route_error",
    ...context,
    error: detail,
  }));

  return Response.json(
    { error: "Struk belum bisa diproses. Coba lagi.", requestId: context.requestId },
    { status: 500, headers },
  );
}
export const receiptReply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
