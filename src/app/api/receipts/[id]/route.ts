import { receiptClient, receiptError, receiptId, receiptReply } from "@/features/receipt/server";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!receiptId(id)) return receiptReply({ error: "ID transaksi tidak valid." }, 400);
    const { supabase } = await receiptClient();
    const result = await supabase.from("transaction_receipts").select("transaction_id,scan_id,merchant,payment_method,invoice,receipt_time,subtotal,tax,service,discount,items,fields,image_hash,photo_path").eq("transaction_id", id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return receiptReply({ error: "Detail struk tidak ditemukan." }, 404);
    const row = result.data;
    const signed = row.photo_path ? await supabase.storage.from("arus-receipts").createSignedUrl(row.photo_path, 60) : null;
    if (signed?.error) throw signed.error;
    return receiptReply({ receipt: { transactionId: row.transaction_id, scanId: row.scan_id, merchant: row.merchant, paymentMethod: row.payment_method, invoice: row.invoice, time: row.receipt_time, subtotal: row.subtotal, tax: row.tax, service: row.service, discount: row.discount, items: row.items, fields: row.fields, imageHash: row.image_hash, photoPath: row.photo_path }, photoUrl: signed?.data?.signedUrl ?? null });
  } catch (error) { return receiptError(error, request); }
}
