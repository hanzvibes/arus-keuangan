import { database } from "@/db/raw";
import { isCalendarDate } from "@/lib/backup";

type Payload = Record<string, unknown>;
const validKind = ["bank", "ewallet", "cash"];
const validType = ["income", "expense", "transfer"];
const clean = (v: unknown, max = 100) => typeof v === "string" ? v.trim().slice(0, max) : "";
const positive = (v: unknown) => Number.isSafeInteger(Number(v)) && Number(v) > 0 && Number(v) <= 1_000_000_000_000 ? Number(v) : null;
const money = (v: unknown) => Number.isSafeInteger(Number(v)) && Math.abs(Number(v)) <= 1_000_000_000_000 ? Number(v) : null;
const bad = (message: string) => Response.json({ error: message }, { status: 400 });
const failure = (error: unknown) => {
  console.error("Finance storage error", error);
  return Response.json({ error: "Data belum bisa diproses. Coba lagi." }, { status: 500 });
};

export async function GET() {
  try {
    const db = database();
    const [accounts, transactions, budgets, categories, recurring] = await db.batch([
      db.prepare("SELECT id, name, kind, opening_balance AS openingBalance, created_at AS createdAt FROM accounts ORDER BY created_at ASC"),
      db.prepare("SELECT id, type, amount, account_id AS accountId, to_account_id AS toAccountId, category, note, date, created_at AS createdAt FROM transactions ORDER BY date DESC, created_at DESC"),
      db.prepare("SELECT id, category, amount, created_at AS createdAt FROM budgets ORDER BY created_at ASC"),
      db.prepare("SELECT id, name, created_at AS createdAt FROM categories ORDER BY created_at ASC"),
      db.prepare("SELECT id, type, amount, account_id AS accountId, to_account_id AS toAccountId, category, note, next_date AS nextDate, frequency, anchor_day AS anchorDay, active, created_at AS createdAt FROM recurring ORDER BY next_date ASC"),
    ]);
    return Response.json({ accounts: accounts.results, transactions: transactions.results, budgets: budgets.results, categories: categories.results, recurring: recurring.results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const p = await request.json() as Payload;
    const db = database(), id = p.entity === "transaction" && typeof p.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id) ? p.id : crypto.randomUUID(), now = new Date().toISOString();
    if (p.entity === "account") {
      const name = clean(p.name, 50), kind = clean(p.kind), balance = money(p.openingBalance);
      if (!name || !validKind.includes(kind) || balance === null) return bad("Isi nama, jenis, dan saldo awal akun dengan benar.");
      await db.prepare("INSERT INTO accounts (id, name, kind, opening_balance, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, name, kind, balance, now).run();
    } else if (p.entity === "transaction") {
      const type = clean(p.type), amount = positive(p.amount), accountId = clean(p.accountId), toAccountId = clean(p.toAccountId), category = clean(p.category, 50), note = clean(p.note, 150), date = clean(p.date, 10);
      if (!validType.includes(type) || !amount || !accountId || !isCalendarDate(date)) return bad("Lengkapi detail transaksi dengan benar.");
      if (type === "transfer" && (!toAccountId || toAccountId === accountId)) return bad("Pilih akun tujuan yang berbeda.");
      const ids = type === "transfer" ? [accountId, toAccountId] : [accountId];
      const found = await db.prepare(`SELECT id FROM accounts WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all();
      if (found.results.length !== ids.length) return bad("Akun yang dipilih tidak tersedia.");
      const result = await db.prepare("INSERT INTO transactions (id, type, amount, account_id, to_account_id, category, note, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING")
        .bind(id, type, amount, accountId, type === "transfer" ? toAccountId : null, type === "transfer" ? "Transfer" : category || "Lainnya", note, date, now).run();
      return Response.json({ id }, { status: result.meta.changes ? 201 : 200 });
    } else if (p.entity === "budget") {
      const category = clean(p.category, 50), amount = positive(p.amount);
      if (!category || !amount) return bad("Isi kategori dan batas budget.");
      const exists = await db.prepare("SELECT id FROM budgets WHERE lower(category) = lower(?)").bind(category).first();
      if (exists) return bad("Budget kategori ini sudah ada.");
      await db.prepare("INSERT INTO budgets (id, category, amount, created_at) VALUES (?, ?, ?, ?)").bind(id, category, amount, now).run();
    } else return bad("Jenis data tidak dikenal.");
    return Response.json({ id }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const p = await request.json() as Payload;
    const db = database(), id = clean(p.id);
    if (!id) return bad("Data yang akan diubah tidak ditemukan.");
    if (p.entity === "account") {
      const name = clean(p.name, 50), kind = clean(p.kind), openingBalance = money(p.openingBalance);
      if (!name || !validKind.includes(kind) || openingBalance === null) return bad("Isi nama, jenis, dan saldo awal akun dengan benar.");
      const result = await db.prepare(`UPDATE accounts SET name = ?, kind = ?, opening_balance = ?
        WHERE id = ? AND (opening_balance = ? OR NOT EXISTS
        (SELECT 1 FROM transactions WHERE account_id = ? OR to_account_id = ?))`)
        .bind(name, kind, openingBalance, id, openingBalance, id, id).run();
      if (!result.meta.changes) return bad("Saldo awal tidak dapat diubah setelah ada transaksi. Gunakan Cocokkan saldo.");
    } else if (p.entity === "transaction") {
      const type = clean(p.type), amount = positive(p.amount), accountId = clean(p.accountId), toAccountId = clean(p.toAccountId), category = clean(p.category, 50), note = clean(p.note, 150), date = clean(p.date, 10);
      if (!validType.includes(type) || !amount || !accountId || !isCalendarDate(date)) return bad("Lengkapi detail transaksi dengan benar.");
      if (type === "transfer" && (!toAccountId || toAccountId === accountId)) return bad("Pilih akun tujuan yang berbeda.");
      const ids = type === "transfer" ? [accountId, toAccountId] : [accountId];
      const found = await db.prepare(`SELECT id FROM accounts WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all();
      if (found.results.length !== ids.length) return bad("Akun yang dipilih tidak tersedia.");
      const result = await db.prepare("UPDATE transactions SET type = ?, amount = ?, account_id = ?, to_account_id = ?, category = ?, note = ?, date = ? WHERE id = ? AND type != 'adjustment'")
        .bind(type, amount, accountId, type === "transfer" ? toAccountId : null, type === "transfer" ? "Transfer" : category || "Lainnya", note, date, id).run();
      if (!result.meta.changes) return bad("Penyesuaian saldo tidak dapat diedit. Cocokkan saldo lagi untuk membuat koreksi.");
    } else if (p.entity === "budget") {
      const category = clean(p.category, 50), amount = positive(p.amount);
      if (!category || !amount) return bad("Isi kategori dan batas budget.");
      const exists = await db.prepare("SELECT id FROM budgets WHERE lower(category) = lower(?) AND id != ?").bind(category, id).first();
      if (exists) return bad("Budget kategori ini sudah ada.");
      const result = await db.prepare("UPDATE budgets SET category = ?, amount = ? WHERE id = ?").bind(category, amount, id).run();
      if (!result.meta.changes) return bad("Budget tidak ditemukan.");
    } else return bad("Jenis data tidak dikenal.");
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    const { entity, id } = await request.json() as Payload;
    const key = clean(id), db = database();
    if (!key) return bad("ID tidak tersedia.");
    if (entity === "account") {
      const [used, scheduled] = await db.batch([
        db.prepare("SELECT id FROM transactions WHERE account_id = ? OR to_account_id = ? LIMIT 1").bind(key, key),
        db.prepare("SELECT id FROM recurring WHERE account_id = ? OR to_account_id = ? LIMIT 1").bind(key, key),
      ]);
      if (used.results.length || scheduled.results.length) return bad("Akun memiliki transaksi atau jadwal rutin. Hapus catatan terkait lebih dulu.");
      await db.prepare("DELETE FROM accounts WHERE id = ?").bind(key).run();
    } else if (entity === "transaction") {
      const result = await db.prepare("DELETE FROM transactions WHERE id = ? AND type != 'adjustment'").bind(key).run();
      if (!result.meta.changes) return bad("Penyesuaian saldo tidak dapat dihapus. Cocokkan saldo lagi untuk membuat koreksi.");
    }
    else if (entity === "budget") await db.prepare("DELETE FROM budgets WHERE id = ?").bind(key).run();
    else return bad("Jenis data tidak dikenal.");
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
