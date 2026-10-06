import { readFinanceJson } from "@/app/api/_shared/finance-route";
import { receiptClient, receiptDraftShape, receiptError, receiptId, receiptReply } from "@/features/receipt/server";
import { validateReceiptDraft } from "@/features/receipt/validation";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const payload = await readFinanceJson(request, 100_000);
    if (!receiptId(id) || !receiptId(payload.transactionId) || typeof payload.accountId !== "string" || payload.accountId.length > 100 || !Number.isInteger(payload.expectedVersion) || !receiptDraftShape(payload.draft) || !validateReceiptDraft(payload.draft) || payload.duplicateToken !== null && typeof payload.duplicateToken !== "string" || payload.photoPath !== null && typeof payload.photoPath !== "string") return receiptReply({ error: "Lengkapi detail struk dengan benar." }, 400);
    const { supabase } = await receiptClient();
    const result = await supabase.rpc("arus_finalize_receipt", { p_scan_id: id, p_expected_version: payload.expectedVersion, p_transaction_id: payload.transactionId, p_account_id: payload.accountId, p_draft: payload.draft, p_duplicate_token: payload.duplicateToken, p_photo_path: payload.photoPath });
    if (result.error) throw result.error;
    const data = result.data as { error?: string; duplicate?: boolean };
    return receiptReply(data, data.error === "stale" || data.duplicate ? 409 : data.error ? 400 : 200);
  } catch (error) { return receiptError(error, request); }
}
