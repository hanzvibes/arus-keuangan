import { readFinanceJson } from "@/app/api/_shared/finance-route";
import { receiptClient, receiptError, receiptId, receiptReply } from "@/features/receipt/server";

export async function POST(request: Request) {
  try {
    const payload = await readFinanceJson(request);
    if (!receiptId(payload.scanId) || !["jpg","png","webp"].includes(String(payload.extension))) return receiptReply({ error: "Foto tidak valid." }, 400);
    const { supabase, userId } = await receiptClient();
    const scan = await supabase.from("receipt_scans").select("id").eq("id", payload.scanId).maybeSingle();
    if (scan.error) throw scan.error;
    if (!scan.data) return receiptReply({ error: "Draft scan tidak ditemukan." }, 404);
    const photoPath = `${userId}/${payload.scanId}.${payload.extension}`;
    const reservation = await supabase.from("receipt_photo_cleanup").upsert({ user_id: userId, photo_path: photoPath, created_at: new Date().toISOString() }, { onConflict: "user_id,photo_path", ignoreDuplicates: true });
    if (reservation.error) throw reservation.error;
    return receiptReply({ photoPath });
  } catch (error) { return receiptError(error); }
}
