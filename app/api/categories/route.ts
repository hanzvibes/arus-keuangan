import { database } from "@/db/raw";
import { defaultCategories } from "@/lib/categories";

const clean = (value: unknown) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
const bad = (error: string) => Response.json({ error }, { status: 400 });
const failure = (error: unknown) => { console.error("Category error", error); return Response.json({ error: "Kategori belum bisa disimpan." }, { status: 500 }); };

async function available(name: string, except = "") {
  if (!name || name.length > 50) return false;
  if (defaultCategories.some(category => category.toLowerCase() === name.toLowerCase())) return false;
  return !(await database().prepare("SELECT id FROM categories WHERE lower(name) = lower(?) AND id != ? LIMIT 1").bind(name, except).first());
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json() as { name?: unknown };
    const label = clean(name);
    if (!await available(label)) return bad("Nama kategori kosong, terlalu panjang, atau sudah dipakai.");
    const id = crypto.randomUUID();
    await database().prepare("INSERT INTO categories (id, name, created_at) VALUES (?, ?, ?)").bind(id, label, new Date().toISOString()).run();
    return Response.json({ id }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const { id, name } = await request.json() as { id?: unknown; name?: unknown };
    const key = clean(id), label = clean(name), db = database();
    const existing = await db.prepare("SELECT name FROM categories WHERE id = ?").bind(key).first<{ name: string }>();
    if (!existing) return bad("Kategori tidak ditemukan.");
    if (existing.name === label) return Response.json({ ok: true });
    if (!await available(label, key)) return bad("Nama kategori kosong, terlalu panjang, atau sudah dipakai.");
    await db.batch([
      db.prepare("UPDATE categories SET name = ? WHERE id = ?").bind(label, key),
      db.prepare("UPDATE transactions SET category = ? WHERE category = ?").bind(label, existing.name),
      db.prepare("UPDATE budgets SET category = ? WHERE category = ?").bind(label, existing.name),
      db.prepare("UPDATE recurring SET category = ? WHERE category = ?").bind(label, existing.name),
    ]);
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json() as { id?: unknown };
    const key = clean(id), db = database();
    const category = await db.prepare("SELECT name FROM categories WHERE id = ?").bind(key).first<{ name: string }>();
    if (!category) return bad("Kategori tidak ditemukan.");
    const [transactions, budgets, recurring] = await db.batch([
      db.prepare("SELECT id FROM transactions WHERE category = ? LIMIT 1").bind(category.name),
      db.prepare("SELECT id FROM budgets WHERE category = ? LIMIT 1").bind(category.name),
      db.prepare("SELECT id FROM recurring WHERE category = ? LIMIT 1").bind(category.name),
    ]);
    if (transactions.results.length || budgets.results.length || recurring.results.length) return bad("Kategori masih dipakai. Ubah catatan atau budget terkait lebih dulu.");
    await db.prepare("DELETE FROM categories WHERE id = ?").bind(key).run();
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
