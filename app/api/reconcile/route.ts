import { isCalendarDate } from "@/lib/backup";
import { ADJUSTMENT_CATEGORY, reconciliationDelta } from "@/lib/finance";
import { assertQuery, dbError, financeClient } from "@/lib/supabase/finance";

export async function POST(request: Request) {
  try {
    const input = await request.json() as Record<string, unknown>;
    const accountId = typeof input.accountId === "string" ? input.accountId.trim() : "";
    const note = typeof input.note === "string" ? input.note.trim() : "";
    const date = input.date;
    const expected = input.expectedBalance;
    const actual = input.actualBalance;
    const delta = typeof expected === "number" && typeof actual === "number" ? reconciliationDelta(expected, actual) : null;
    if (!accountId || !note || note.length > 150 || !isCalendarDate(date) || delta === null || delta === 0) {
      return Response.json({ error: "Isi saldo sebenarnya dan alasan penyesuaian dengan benar." }, { status: 400 });
    }

    const { supabase } = await financeClient();
    const result = await supabase.rpc("arus_reconcile_balance", {
      p_account_id: accountId,
      p_expected_balance: expected,
      p_actual_balance: actual,
      p_note: note,
      p_date: date,
      p_adjustment_category: ADJUSTMENT_CATEGORY,
    });
    assertQuery(result.error);
    if (!result.data) return Response.json({ error: "Saldo akun telah berubah. Muat ulang dan cocokkan kembali." }, { status: 409 });
    return Response.json({ id: result.data }, { status: 201 });
  } catch (error) {
    return dbError(error);
  }
}
