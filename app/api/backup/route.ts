import { database } from "@/db/raw";
import { validateBackup } from "@/lib/backup";

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
    return Response.json({ version: 2, exportedAt: new Date().toISOString(), accounts: accounts.results, transactions: transactions.results, budgets: budgets.results, categories: categories.results, recurring: recurring.results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Backup export failed", error);
    return Response.json({ error: "Cadangan belum bisa dibuat." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 3_000_000) return Response.json({ error: "File cadangan terlalu besar." }, { status: 413 });
    const text = await request.text();
    if (text.length > 3_000_000) return Response.json({ error: "File cadangan terlalu besar." }, { status: 413 });
    const input = JSON.parse(text) as { confirm?: string; backup?: unknown };
    if (input.confirm !== "GANTI DATA") return Response.json({ error: "Konfirmasi pemulihan diperlukan." }, { status: 400 });
    const validation = validateBackup(input.backup);
    if (!validation.data) return Response.json({ error: validation.error }, { status: 400 });
    const { accounts, transactions, budgets, categories, recurring } = validation.data;
    const db = database();
    const statements = [
      db.prepare("DELETE FROM transactions"),
      db.prepare("DELETE FROM recurring"),
      db.prepare("DELETE FROM budgets"),
      db.prepare("DELETE FROM categories"),
      db.prepare("DELETE FROM accounts"),
      ...accounts.map(a => db.prepare("INSERT INTO accounts (id, name, kind, opening_balance, created_at) VALUES (?, ?, ?, ?, ?)").bind(a.id, a.name, a.kind, a.openingBalance, a.createdAt)),
      ...categories.map(c => db.prepare("INSERT INTO categories (id, name, created_at) VALUES (?, ?, ?)").bind(c.id, c.name, c.createdAt)),
      ...budgets.map(b => db.prepare("INSERT INTO budgets (id, category, amount, created_at) VALUES (?, ?, ?, ?)").bind(b.id, b.category, b.amount, b.createdAt)),
      ...recurring.map(r => db.prepare("INSERT INTO recurring (id, type, amount, account_id, to_account_id, category, note, next_date, frequency, anchor_day, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(r.id, r.type, r.amount, r.accountId, r.toAccountId, r.category, r.note, r.nextDate, r.frequency, r.anchorDay, r.active, r.createdAt)),
      ...transactions.map(t => db.prepare("INSERT INTO transactions (id, type, amount, account_id, to_account_id, category, note, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(t.id, t.type, t.amount, t.accountId, t.toAccountId, t.category, t.note, t.date, t.createdAt)),
    ];
    await db.batch(statements);
    return Response.json({ ok: true, counts: { accounts: accounts.length, transactions: transactions.length, budgets: budgets.length } });
  } catch (error) {
    console.error("Backup restore failed", error);
    return Response.json({ error: "Pemulihan gagal. Data lama tetap dipertahankan." }, { status: 500 });
  }
}
