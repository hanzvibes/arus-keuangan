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
export function receiptError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ error: "Sesi login tidak valid." }, { status: 401 });
  if (error instanceof FinanceRequestError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  console.error("receipt_error", error instanceof Error ? error.message : error);
  return Response.json({ error: "Struk belum bisa diproses. Coba lagi." }, { status: 500 });
}
export const receiptReply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
