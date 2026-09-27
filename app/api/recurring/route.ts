import { isCalendarDate } from "@/lib/backup";
import { assertQuery, dbError, financeClient } from "@/lib/supabase/finance";

type Payload = Record<string, unknown>;
const clean = (value: unknown, max = 150) => typeof value === "string" ? value.trim().slice(0, max) : "";
const amount = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 1_000_000_000_000 ? value : null;
const bad = (error: string, status = 400) => Response.json({ error }, { status });

async function validate(p: Payload) {
  const type = clean(p.type), value = amount(p.amount), accountId = clean(p.accountId, 100), toAccountId = clean(p.toAccountId, 100);
  const category = clean(p.category, 50), note = clean(p.note), nextDate = clean(p.nextDate, 10), frequency = clean(p.frequency);
  if (!["expense", "income", "transfer"].includes(type) || !value || !accountId || !isCalendarDate(nextDate) || !["weekly", "monthly"].includes(frequency)) return { error: "Lengkapi jadwal rutin dengan benar." };
  if (type === "transfer" && (!toAccountId || toAccountId === accountId)) return { error: "Pilih akun tujuan yang berbeda." };
  const ids = type === "transfer" ? [accountId, toAccountId] : [accountId];
  const { supabase } = await financeClient();
  const found = await supabase.from("accounts").select("id").in("id", ids);
  assertQuery(found.error);
  if ((found.data ?? []).length !== ids.length) return { error: "Akun yang dipilih tidak tersedia." };
  return { value: { type, amount: value, accountId, toAccountId: type === "transfer" ? toAccountId : null, category: type === "transfer" ? "Transfer" : category || "Lainnya", note, nextDate, frequency, anchorDay: Number(nextDate.slice(8)) } };
}

export async function POST(request: Request) {
  try {
    const p = await request.json() as Payload;
    const { supabase, userId } = await financeClient();

    if (p.action === "record" || p.action === "skip") {
      const id = clean(p.id, 100), due = clean(p.due, 10);
      if (!id || !isCalendarDate(due)) return bad("Tanggal jadwal tidak valid.");
      if (p.action === "skip") {
        const result = await supabase.rpc("arus_skip_recurring", { p_id: id, p_due: due });
        assertQuery(result.error);
        if (!result.data) return bad("Jadwal sudah berubah. Muat ulang data.", 409);
        return Response.json({ ok: true, nextDate: result.data });
      }
      const recordedDate = clean(p.recordedDate, 10);
      if (!isCalendarDate(recordedDate)) return bad("Tanggal transaksi tidak valid.");
      const result = await supabase.rpc("arus_record_recurring", { p_id: id, p_due: due, p_recorded_date: recordedDate });
      if (result.error?.code === "23505") return bad("Tanggal jadwal ini sudah pernah dicatat. Pilih tanggal berikutnya.", 409);
      assertQuery(result.error);
      if (!result.data) return bad("Jadwal sudah berubah. Muat ulang data.", 409);
      return Response.json({ ok: true, nextDate: result.data });
    }

    const checked = await validate(p);
    if (!checked.value) return bad(checked.error || "Jadwal tidak valid.");
    const r = checked.value, id = crypto.randomUUID();
    const result = await supabase.from("recurring").insert({
      user_id: userId, id, type: r.type, amount: r.amount, account_id: r.accountId,
      to_account_id: r.toAccountId, category: r.category, note: r.note,
      next_date: r.nextDate, frequency: r.frequency, anchor_day: r.anchorDay,
      active: true, created_at: new Date().toISOString(),
    });
    assertQuery(result.error);
    return Response.json({ id }, { status: 201 });
  } catch (error) { return dbError(error); }
}

export async function PATCH(request: Request) {
  try {
    const p = await request.json() as Payload, id = clean(p.id, 100);
    const { supabase } = await financeClient();
    if (p.action === "toggle") {
      if (typeof p.active !== "boolean") return bad("Status jadwal tidak valid.");
      const result = await supabase.from("recurring").update({ active: p.active }).eq("id", id).select("id").maybeSingle();
      assertQuery(result.error);
      if (!result.data) return bad("Jadwal tidak ditemukan.");
      return Response.json({ ok: true });
    }

    const checked = await validate(p);
    if (!checked.value) return bad(checked.error || "Jadwal tidak valid.");
    const r = checked.value;
    const existing = await supabase.from("recurring").select("next_date,anchor_day,frequency").eq("id", id).maybeSingle();
    assertQuery(existing.error);
    if (!existing.data) return bad("Jadwal tidak ditemukan.");
    if (existing.data.next_date === r.nextDate && existing.data.frequency === r.frequency) r.anchorDay = existing.data.anchor_day;
    const transactionId = `r_${id}_${r.nextDate.replaceAll("-", "")}`;
    const duplicate = await supabase.from("transactions").select("id").eq("id", transactionId).maybeSingle();
    assertQuery(duplicate.error);
    if (duplicate.data) return bad("Tanggal itu sudah pernah dicatat untuk jadwal ini.");

    const result = await supabase.from("recurring").update({
      type: r.type, amount: r.amount, account_id: r.accountId, to_account_id: r.toAccountId,
      category: r.category, note: r.note, next_date: r.nextDate, frequency: r.frequency,
      anchor_day: r.anchorDay,
    }).eq("id", id).select("id").maybeSingle();
    assertQuery(result.error);
    if (!result.data) return bad("Jadwal tidak ditemukan.");
    return Response.json({ ok: true });
  } catch (error) { return dbError(error); }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json() as { id?: unknown };
    const { supabase } = await financeClient();
    const result = await supabase.from("recurring").delete().eq("id", clean(id, 100)).select("id").maybeSingle();
    assertQuery(result.error);
    if (!result.data) return bad("Jadwal tidak ditemukan.");
    return Response.json({ ok: true });
  } catch (error) { return dbError(error); }
}
