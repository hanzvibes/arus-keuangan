import { readFinanceJson } from "@/app/api/_shared/finance-route";
import { receiptClient, receiptDraftShape, receiptError, receiptHash, receiptId, receiptReply } from "@/features/receipt/server";

export async function GET(request: Request) {
  try {
    const { supabase } = await receiptClient();
    const result = await supabase.from("receipt_scans").select("id,status,draft,image_hash,visual_hash,save_photo,transaction_id,version,created_at,updated_at").order("updated_at", { ascending: false }).limit(100);
    if (result.error) throw result.error;
    return receiptReply({ scans: result.data.map(row => ({ id: row.id, status: row.status === "processing" && Date.now() - new Date(row.updated_at).getTime() > 120000 ? "failed" : row.status, draft: row.draft, imageHash: row.image_hash, visualHash: row.visual_hash, savePhoto: row.save_photo, transactionId: row.transaction_id, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at })) });
  } catch (error) { return receiptError(error, request); }
}
export async function POST(request: Request) {
  try {
    const payload = await readFinanceJson(request, 100_000);
    if (!receiptId(payload.id) || !["processing","success","review","failed"].includes(String(payload.status)) ||
      payload.draft !== null && !receiptDraftShape(payload.draft) || !receiptHash(payload.imageHash) ||
      payload.visualHash !== null && (typeof payload.visualHash !== "string" || !/^[0-9a-f]{16}$/.test(payload.visualHash)) || typeof payload.savePhoto !== "boolean") return receiptReply({ error: "Data scan tidak valid." }, 400);
    const { supabase, userId } = await receiptClient();
    const result = await supabase.from("receipt_scans").insert({ user_id: userId, id: payload.id, status: payload.status, draft: payload.draft, image_hash: payload.imageHash, visual_hash: payload.visualHash, save_photo: payload.savePhoto }).select("version").single();
    if (result.error?.code === "23505") return receiptReply({ error: "Scan sudah tercatat." }, 409);
    if (result.error) throw result.error;
    return receiptReply({ version: result.data.version }, 201);
  } catch (error) { return receiptError(error, request); }
}
