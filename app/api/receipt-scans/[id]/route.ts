import { readFinanceJson } from "@/app/api/_shared/finance-route";
import { receiptClient, receiptDraftShape, receiptError, receiptHash, receiptId, receiptReply } from "@/features/receipt/server";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!receiptId(id)) return receiptReply({ error: "ID scan tidak valid." }, 400);
    const { supabase } = await receiptClient();
    const result = await supabase.from("receipt_scans").select("*").eq("id", id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return receiptReply({ error: "Scan tidak ditemukan." }, 404);
    const row = result.data;
    return receiptReply({ id: row.id, status: row.status, draft: row.draft, imageHash: row.image_hash, visualHash: row.visual_hash, savePhoto: row.save_photo, transactionId: row.transaction_id, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at });
  } catch (error) { return receiptError(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const payload = await readFinanceJson(request, 100_000);
    if (!receiptId(id) || !Number.isInteger(payload.expectedVersion) || !["processing","success","review","failed"].includes(String(payload.status)) || payload.draft !== null && !receiptDraftShape(payload.draft) || !receiptHash(payload.imageHash) || payload.visualHash !== null && (typeof payload.visualHash !== "string" || !/^[0-9a-f]{16}$/.test(payload.visualHash)) || typeof payload.savePhoto !== "boolean") return receiptReply({ error: "Data scan tidak valid." }, 400);
    const { supabase } = await receiptClient();
    const result = await supabase.from("receipt_scans").update({ status: payload.status, draft: payload.draft, image_hash: payload.imageHash, visual_hash: payload.visualHash, save_photo: payload.savePhoto, version: Number(payload.expectedVersion) + 1, updated_at: new Date().toISOString() }).eq("id", id).eq("version", payload.expectedVersion).is("transaction_id", null).select("version").maybeSingle();
    if (result.error) throw result.error;
    return result.data ? receiptReply({ version: result.data.version }) : receiptReply({ error: "Draft berubah di perangkat lain. Muat ulang sebelum menyimpan." }, 409);
  } catch (error) { return receiptError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    await readFinanceJson(request);
    if (!receiptId(id)) return receiptReply({ error: "ID scan tidak valid." }, 400);
    const { supabase } = await receiptClient();
    const result = await supabase.from("receipt_scans").delete().eq("id", id).is("transaction_id", null).select("id").maybeSingle();
    if (result.error) throw result.error;
    return result.data ? receiptReply({ ok: true }) : receiptReply({ error: "Draft tidak ditemukan atau sudah tersimpan." }, 409);
  } catch (error) { return receiptError(error); }
}
