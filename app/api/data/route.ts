import { isCalendarDate } from "@/lib/backup";
import { assertQuery, asNumber, dbError, financeClient } from "@/lib/supabase/finance";

type Payload = Record<string, unknown>;
const validKind = ["bank", "ewallet", "cash"];
const validType = ["income", "expense", "transfer"];
const clean = (v: unknown, max = 100) => typeof v === "string" ? v.trim().slice(0, max) : "";
const positive = (v: unknown) => Number.isSafeInteger(Number(v)) && Number(v) > 0 && Number(v) <= 1_000_000_000_000 ? Number(v) : null;
const money = (v: unknown) => Number.isSafeInteger(Number(v)) && Math.abs(Number(v)) <= 1_000_000_000_000 ? Number(v) : null;
const bad = (message: string) => Response.json({ error: message }, { status: 400 });

const mapAccount = (r: any) => ({ id: r.id, name: r.name, kind: r.kind, openingBalance: asNumber(r.opening_balance), createdAt: r.created_at });
const mapTransaction = (r: any) => ({ id: r.id, type: r.type, amount: asNumber(r.amount), accountId: r.account_id, toAccountId: r.to_account_id, category: r.category, note: r.note, date: r.date, createdAt: r.created_at });
const mapBudget = (r: any) => ({ id: r.id, category: r.category, amount: asNumber(r.amount), createdAt: r.created_at });
const mapCategory = (r: any) => ({ id: r.id, name: r.name, createdAt: r.created_at });
const mapRecurring = (r: any) => ({ id: r.id, type: r.type, amount: asNumber(r.amount), accountId: r.account_id, toAccountId: r.to_account_id, category: r.category, note: r.note, nextDate: r.next_date, frequency: r.frequency, anchorDay: r.anchor_day, active: r.active ? 1 : 0, createdAt: r.created_at });

export async function GET() {
  try {
    const { supabase } = await financeClient();
    const [accounts, transactions, budgets, categories, recurring] = await Promise.all([
      supabase.from("accounts").select("id,name,kind,opening_balance,created_at").order("created_at"),
      supabase.from("transactions").select("id,type,amount,account_id,to_account_id,category,note,date,created_at").order("date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("budgets").select("id,category,amount,created_at").order("created_at"),
      supabase.from("categories").select("id,name,created_at").order("created_at"),
      supabase.from("recurring").select("id,type,amount,account_id,to_account_id,category,note,next_date,frequency,anchor_day,active,created_at").order("next_date"),
    ]);
    [accounts, transactions, budgets, categories, recurring].forEach(r => assertQuery(r.error));
    return Response.json({
      accounts: (accounts.data ?? []).map(mapAccount),
      transactions: (transactions.data ?? []).map(mapTransaction),
      budgets: (budgets.data ?? []).map(mapBudget),
      categories: (categories.data ?? []).map(mapCategory),
      recurring: (recurring.data ?? []).map(mapRecurring),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return dbError(error); }
}

export async function POST(request: Request) {
  try {
    const p = await request.json() as Payload;
    const { supabase, userId } = await financeClient();
    const id = p.entity === "transaction" && typeof p.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id) ? p.id : crypto.randomUUID();
    const now = new Date().toISOString();

    if (p.entity === "account") {
      const name = clean(p.name, 50), kind = clean(p.kind), balance = money(p.openingBalance);
      if (!name || !validKind.includes(kind) || balance === null) return bad("Isi nama, jenis, dan saldo awal akun dengan benar.");
      const result = await supabase.from("accounts").insert({ user_id: userId, id, name, kind, opening_balance: balance, created_at: now });
      assertQuery(result.error);
    } else if (p.entity === "transaction") {
      const type = clean(p.type), amount = positive(p.amount), accountId = clean(p.accountId), toAccountId = clean(p.toAccountId), category = clean(p.category, 50), note = clean(p.note, 150), date = clean(p.date, 10);
      if (!validType.includes(type) || !amount || !accountId || !isCalendarDate(date)) return bad("Lengkapi detail transaksi dengan benar.");
      if (type === "transfer" && (!toAccountId || toAccountId === accountId)) return bad("Pilih akun tujuan yang berbeda.");
      const ids = type === "transfer" ? [accountId, toAccountId] : [accountId];
      const found = await supabase.from("accounts").select("id").in("id", ids);
      assertQuery(found.error);
      if ((found.data ?? []).length !== ids.length) return bad("Akun yang dipilih tidak tersedia.");
      const result = await supabase.from("transactions").insert({
        user_id: userId, id, type, amount, account_id: accountId,
        to_account_id: type === "transfer" ? toAccountId : null,
        category: type === "transfer" ? "Transfer" : category || "Lainnya",
        note, date, created_at: now,
      });
      if (result.error?.code === "23505") return Response.json({ id }, { status: 200 });
      assertQuery(result.error);
      return Response.json({ id }, { status: 201 });
    } else if (p.entity === "budget") {
      const category = clean(p.category, 50), amount = positive(p.amount);
      if (!category || !amount) return bad("Isi kategori dan batas budget.");
      const result = await supabase.from("budgets").insert({ user_id: userId, id, category, amount, created_at: now });
      if (result.error?.code === "23505") return bad("Budget kategori ini sudah ada.");
      assertQuery(result.error);
    } else return bad("Jenis data tidak dikenal.");

    return Response.json({ id }, { status: 201 });
  } catch (error) { return dbError(error); }
}

export async function PATCH(request: Request) {
  try {
    const p = await request.json() as Payload;
    const { supabase } = await financeClient();
    const id = clean(p.id);
    if (!id) return bad("Data yang akan diubah tidak ditemukan.");

    if (p.entity === "account") {
      const name = clean(p.name, 50), kind = clean(p.kind), openingBalance = money(p.openingBalance);
      if (!name || !validKind.includes(kind) || openingBalance === null) return bad("Isi nama, jenis, dan saldo awal akun dengan benar.");
      const current = await supabase.from("accounts").select("opening_balance").eq("id", id).maybeSingle();
      assertQuery(current.error);
      if (!current.data) return bad("Akun tidak ditemukan.");
      if (asNumber(current.data.opening_balance) !== openingBalance) {
        const used = await supabase.from("transactions").select("id").or(`account_id.eq.${id},to_account_id.eq.${id}`).limit(1);
        assertQuery(used.error);
        if ((used.data ?? []).length) return bad("Saldo awal tidak dapat diubah setelah ada transaksi. Gunakan Cocokkan saldo.");
      }
      const result = await supabase.from("accounts").update({ name, kind, opening_balance: openingBalance }).eq("id", id).select("id").maybeSingle();
      assertQuery(result.error);
      if (!result.data) return bad("Akun tidak ditemukan.");
    } else if (p.entity === "transaction") {
      const type = clean(p.type), amount = positive(p.amount), accountId = clean(p.accountId), toAccountId = clean(p.toAccountId), category = clean(p.category, 50), note = clean(p.note, 150), date = clean(p.date, 10);
      if (!validType.includes(type) || !amount || !accountId || !isCalendarDate(date)) return bad("Lengkapi detail transaksi dengan benar.");
      if (type === "transfer" && (!toAccountId || toAccountId === accountId)) return bad("Pilih akun tujuan yang berbeda.");
      const existing = await supabase.from("transactions").select("type").eq("id", id).maybeSingle();
      assertQuery(existing.error);
      if (!existing.data || existing.data.type === "adjustment") return bad("Penyesuaian saldo tidak dapat diedit. Cocokkan saldo lagi untuk membuat koreksi.");
      const ids = type === "transfer" ? [accountId, toAccountId] : [accountId];
      const found = await supabase.from("accounts").select("id").in("id", ids);
      assertQuery(found.error);
      if ((found.data ?? []).length !== ids.length) return bad("Akun yang dipilih tidak tersedia.");
      const result = await supabase.from("transactions").update({
        type, amount, account_id: accountId, to_account_id: type === "transfer" ? toAccountId : null,
        category: type === "transfer" ? "Transfer" : category || "Lainnya", note, date,
      }).eq("id", id).select("id").maybeSingle();
      assertQuery(result.error);
      if (!result.data) return bad("Transaksi tidak ditemukan.");
    } else if (p.entity === "budget") {
      const category = clean(p.category, 50), amount = positive(p.amount);
      if (!category || !amount) return bad("Isi kategori dan batas budget.");
      const result = await supabase.from("budgets").update({ category, amount }).eq("id", id).select("id").maybeSingle();
      if (result.error?.code === "23505") return bad("Budget kategori ini sudah ada.");
      assertQuery(result.error);
      if (!result.data) return bad("Budget tidak ditemukan.");
    } else return bad("Jenis data tidak dikenal.");

    return Response.json({ ok: true });
  } catch (error) { return dbError(error); }
}

export async function DELETE(request: Request) {
  try {
    const { entity, id } = await request.json() as Payload;
    const key = clean(id);
    const { supabase } = await financeClient();
    if (!key) return bad("ID tidak tersedia.");

    if (entity === "account") {
      const [used, scheduled] = await Promise.all([
        supabase.from("transactions").select("id").or(`account_id.eq.${key},to_account_id.eq.${key}`).limit(1),
        supabase.from("recurring").select("id").or(`account_id.eq.${key},to_account_id.eq.${key}`).limit(1),
      ]);
      assertQuery(used.error); assertQuery(scheduled.error);
      if ((used.data ?? []).length || (scheduled.data ?? []).length) return bad("Akun memiliki transaksi atau jadwal rutin. Hapus catatan terkait lebih dulu.");
      const result = await supabase.from("accounts").delete().eq("id", key).select("id").maybeSingle();
      assertQuery(result.error);
      if (!result.data) return bad("Akun tidak ditemukan.");
    } else if (entity === "transaction") {
      const existing = await supabase.from("transactions").select("type").eq("id", key).maybeSingle();
      assertQuery(existing.error);
      if (!existing.data || existing.data.type === "adjustment") return bad("Penyesuaian saldo tidak dapat dihapus. Cocokkan saldo lagi untuk membuat koreksi.");
      const result = await supabase.from("transactions").delete().eq("id", key);
      assertQuery(result.error);
    } else if (entity === "budget") {
      const result = await supabase.from("budgets").delete().eq("id", key).select("id").maybeSingle();
      assertQuery(result.error);
      if (!result.data) return bad("Budget tidak ditemukan.");
    } else return bad("Jenis data tidak dikenal.");

    return Response.json({ ok: true });
  } catch (error) { return dbError(error); }
}
