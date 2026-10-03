import { readFinanceJson } from "@/app/api/_shared/finance-route";
import { receiptClient, receiptDraftShape, receiptError, receiptId, receiptReply } from "@/features/receipt/server";
import { validateReceiptDraft } from "@/features/receipt/validation";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const payload = await readFinanceJson(request, 100_000);
    if (!receiptId(id) || !Number.isInteger(payload.expectedVersion) || typeof payload.accountId !== "string" || !receiptDraftShape(payload.draft) || !validateReceiptDraft(payload.draft) || payload.photoPath !== null && typeof payload.photoPath !== "string") return receiptReply({ error: "Detail struk tidak valid." }, 400);
    const { supabase } = await receiptClient();
    const result = await supabase.rpc("arus_update_receipt", { p_scan_id: id, p_expected_version: payload.expectedVersion, p_account_id: payload.accountId, p_draft: payload.draft, p_photo_path: payload.photoPath });
    if (result.error) throw result.error;
    const data = result.data as { error?: string };
    return receiptReply(data, data.error === "stale" ? 409 : data.error ? 400 : 200);
  } catch (error) { return receiptError(error); }
}
