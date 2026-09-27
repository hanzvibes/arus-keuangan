import { database } from "@/db/raw";
import { isCalendarDate } from "@/lib/backup";
import { nextOccurrence, type Frequency } from "@/lib/recurring";

type Payload = Record<string, unknown>;
const clean = (value: unknown, max = 150) => typeof value === "string" ? value.trim().slice(0, max) : "";
const amount = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 1_000_000_000_000 ? value : null;
const bad = (error: string, status = 400) => Response.json({ error }, { status });
const failure = (error: unknown) => { console.error("Recurring error", error); return Response.json({ error: "Jadwal rutin belum bisa diproses." }, { status: 500 }); };

async function validate(p: Payload) {
  const type = clean(p.type), value = amount(p.amount), accountId = clean(p.accountId, 100), toAccountId = clean(p.toAccountId, 100);
  const category = clean(p.category, 50), note = clean(p.note), nextDate = clean(p.nextDate, 10), frequency = clean(p.frequency);
  if (!["expense", "income", "transfer"].includes(type) || !value || !accountId || !isCalendarDate(nextDate) || !["weekly", "monthly"].includes(frequency)) return { error: "Lengkapi jadwal rutin dengan benar." };
  if (type === "transfer" && (!toAccountId || toAccountId === accountId)) return { error: "Pilih akun tujuan yang berbeda." };
  const ids = type === "transfer" ? [accountId, toAccountId] : [accountId];
  const found = await database().prepare(`SELECT id FROM accounts WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all();
  if (found.results.length !== ids.length) return { error: "Akun yang dipilih tidak tersedia." };
  return { value: { type, amount: value, accountId, toAccountId: type === "transfer" ? toAccountId : null, category: type === "transfer" ? "Transfer" : category || "Lainnya", note, nextDate, frequency, anchorDay: Number(nextDate.slice(8)) } };
}

export async function POST(request: Request) {
  try {
    const p = await request.json() as Payload;
    const db = database();
    if (p.action === "record" || p.action === "skip") {
      const id = clean(p.id, 100), due = clean(p.due, 10);
      if (!id || !isCalendarDate(due)) return bad("Tanggal jadwal tidak valid.");
      const rule = await db.prepare("SELECT frequency, anchor_day AS anchorDay FROM recurring WHERE id = ? AND next_date = ? AND active = 1").bind(id, due).first<{ frequency: Frequency; anchorDay: number }>();
      if (!rule) return bad("Jadwal sudah berubah. Muat ulang data.", 409);
      const next = nextOccurrence(due, rule.frequency, rule.anchorDay);
      if (p.action === "skip") {
        const result = await db.prepare("UPDATE recurring SET next_date = ? WHERE id = ? AND next_date = ? AND active = 1").bind(next, id, due).run();
        if (!result.meta.changes) return bad("Jadwal sudah berubah. Muat ulang data.", 409);
      } else {
        const recordedDate = clean(p.recordedDate, 10);
        if (!isCalendarDate(recordedDate)) return bad("Tanggal transaksi tidak valid.");
        const transactionId = `r_${id}_${due.replaceAll("-", "")}`;
        if (await db.prepare("SELECT id FROM transactions WHERE id = ?").bind(transactionId).first()) return bad("Tanggal jadwal ini sudah pernah dicatat. Pilih tanggal berikutnya.", 409);
        const [inserted, advanced] = await db.batch([
          db.prepare(`INSERT INTO transactions (id, type, amount, account_id, to_account_id, category, note, date, created_at)
            SELECT ?, type, amount, account_id, to_account_id, category, note, ?, ? FROM recurring
            WHERE id = ? AND next_date = ? AND active = 1 ON CONFLICT(id) DO NOTHING`)
            .bind(transactionId, recordedDate, new Date().toISOString(), id, due),
          db.prepare("UPDATE recurring SET next_date = ? WHERE id = ? AND next_date = ? AND active = 1").bind(next, id, due),
        ]);
        if (!inserted.meta.changes && !advanced.meta.changes) return bad("Jadwal sudah berubah. Muat ulang data.", 409);
      }
      return Response.json({ ok: true, nextDate: next });
    }
    const checked = await validate(p);
    if (!checked.value) return bad(checked.error || "Jadwal tidak valid.");
    const r = checked.value, id = crypto.randomUUID();
    await db.prepare("INSERT INTO recurring (id, type, amount, account_id, to_account_id, category, note, next_date, frequency, anchor_day, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)")
      .bind(id, r.type, r.amount, r.accountId, r.toAccountId, r.category, r.note, r.nextDate, r.frequency, r.anchorDay, new Date().toISOString()).run();
    return Response.json({ id }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const p = await request.json() as Payload, id = clean(p.id, 100), db = database();
    if (p.action === "toggle") {
      if (typeof p.active !== "boolean") return bad("Status jadwal tidak valid.");
      const result = await db.prepare("UPDATE recurring SET active = ? WHERE id = ?").bind(p.active ? 1 : 0, id).run();
      if (!result.meta.changes) return bad("Jadwal tidak ditemukan.");
      return Response.json({ ok: true });
    }
    const checked = await validate(p);
    if (!checked.value) return bad(checked.error || "Jadwal tidak valid.");
    const r = checked.value;
    const existing = await db.prepare("SELECT next_date AS nextDate, anchor_day AS anchorDay, frequency FROM recurring WHERE id = ?").bind(id).first<{ nextDate: string; anchorDay: number; frequency: Frequency }>();
    if (!existing) return bad("Jadwal tidak ditemukan.");
    if (existing.nextDate === r.nextDate && existing.frequency === r.frequency) r.anchorDay = existing.anchorDay;
    if (await db.prepare("SELECT id FROM transactions WHERE id = ?").bind(`r_${id}_${r.nextDate.replaceAll("-", "")}`).first()) return bad("Tanggal itu sudah pernah dicatat untuk jadwal ini.");
    const result = await db.prepare("UPDATE recurring SET type = ?, amount = ?, account_id = ?, to_account_id = ?, category = ?, note = ?, next_date = ?, frequency = ?, anchor_day = ? WHERE id = ?")
      .bind(r.type, r.amount, r.accountId, r.toAccountId, r.category, r.note, r.nextDate, r.frequency, r.anchorDay, id).run();
    if (!result.meta.changes) return bad("Jadwal tidak ditemukan.");
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json() as { id?: unknown };
    const result = await database().prepare("DELETE FROM recurring WHERE id = ?").bind(clean(id, 100)).run();
    if (!result.meta.changes) return bad("Jadwal tidak ditemukan.");
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
