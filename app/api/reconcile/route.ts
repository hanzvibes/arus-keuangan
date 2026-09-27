import { isCalendarDate } from "@/lib/backup";
import { ADJUSTMENT_CATEGORY, reconciliationDelta } from "@/lib/finance";
import { createFinanceRepository } from "@/data/server/supabase-finance-repository";
import { financeRouteError } from "@/app/api/_shared/finance-route";

export async function POST(request: Request) {
  try {
    const input = await request.json() as Record<string, unknown>;
    const accountId = typeof input.accountId === "string" ? input.accountId.trim() : "";
    const note = typeof input.note === "string" ? input.note.trim() : "";
    const date = typeof input.date === "string" ? input.date : "";
    const expected = typeof input.expectedBalance === "number" ? input.expectedBalance : null;
    const actual = typeof input.actualBalance === "number" ? input.actualBalance : null;
    const delta = expected !== null && actual !== null
      ? reconciliationDelta(expected, actual)
      : null;

    if (!accountId || !note || note.length > 150 || !isCalendarDate(date) || delta === null || delta === 0) {
      return Response.json({ error: "Isi saldo sebenarnya dan alasan penyesuaian dengan benar." }, { status: 400 });
    }

    const repository = await createFinanceRepository();
    const id = await repository.reconcile({
      accountId,
      expectedBalance: expected,
      actualBalance: actual,
      note,
      date,
      adjustmentCategory: ADJUSTMENT_CATEGORY,
    });

    if (!id) {
      return Response.json({ error: "Saldo akun telah berubah. Muat ulang dan cocokkan kembali." }, { status: 409 });
    }

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return financeRouteError(error);
  }
}