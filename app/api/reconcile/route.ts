import { database } from "@/db/raw";
import { isCalendarDate } from "@/lib/backup";
import { ADJUSTMENT_CATEGORY, reconciliationDelta } from "@/lib/finance";

/** Compare and insert in one SQL statement so a stale balance cannot create a wrong adjustment. */
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
    const id = crypto.randomUUID();
    const result = await database().prepare(`
      INSERT INTO transactions (id, type, amount, account_id, to_account_id, category, note, date, created_at)
      SELECT ?, 'adjustment', ?, id, NULL, ?, ?, ?, ? FROM accounts
      WHERE id = ? AND opening_balance + COALESCE((
        SELECT SUM(CASE
          WHEN type = 'income' AND account_id = ? THEN amount
          WHEN type = 'expense' AND account_id = ? THEN -amount
          WHEN type = 'transfer' AND account_id = ? THEN -amount
          WHEN type = 'transfer' AND to_account_id = ? THEN amount
          WHEN type = 'adjustment' AND account_id = ? THEN amount
          ELSE 0 END)
        FROM transactions WHERE account_id = ? OR to_account_id = ?
      ), 0) = ?
    `).bind(id, delta, ADJUSTMENT_CATEGORY, note, date, new Date().toISOString(), accountId,
      accountId, accountId, accountId, accountId, accountId, accountId, accountId, expected).run();
    if (!result.meta.changes) return Response.json({ error: "Saldo akun telah berubah. Muat ulang dan cocokkan kembali." }, { status: 409 });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Balance reconciliation failed", error);
    return Response.json({ error: "Saldo belum bisa dicocokkan. Coba lagi." }, { status: 500 });
  }
}
