import { defaultCategories } from "@/lib/categories";
import { assertQuery, dbError, financeClient } from "@/lib/supabase/finance";

const clean = (value: unknown) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
const bad = (error: string) => Response.json({ error }, { status: 400 });

async function available(name: string, except = "") {
  if (!name || name.length > 50) return false;
  if (defaultCategories.some(category => category.toLowerCase() === name.toLowerCase())) return false;
  const { supabase } = await financeClient();
  const found = await supabase.from("categories").select("id,name");
  assertQuery(found.error);
  return !(found.data ?? []).some(row => row.id !== except && row.name.toLowerCase() === name.toLowerCase());
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json() as { name?: unknown };
    const label = clean(name);
    if (!await available(label)) return bad("Nama kategori kosong, terlalu panjang, atau sudah dipakai.");
    const { supabase, userId } = await financeClient();
    const id = crypto.randomUUID();
    const result = await supabase.from("categories").insert({ user_id: userId, id, name: label, created_at: new Date().toISOString() });
    if (result.error?.code === "23505") return bad("Nama kategori kosong, terlalu panjang, atau sudah dipakai.");
    assertQuery(result.error);
    return Response.json({ id }, { status: 201 });
  } catch (error) { return dbError(error); }
}

export async function PATCH(request: Request) {
  try {
    const { id, name } = await request.json() as { id?: unknown; name?: unknown };
    const key = clean(id), label = clean(name);
    const { supabase } = await financeClient();
    const existing = await supabase.from("categories").select("name").eq("id", key).maybeSingle();
    assertQuery(existing.error);
    if (!existing.data) return bad("Kategori tidak ditemukan.");
    if (existing.data.name === label) return Response.json({ ok: true });
    if (!await available(label, key)) return bad("Nama kategori kosong, terlalu panjang, atau sudah dipakai.");
    const renamed = await supabase.rpc("arus_rename_category", { p_id: key, p_name: label });
    if (renamed.error?.code === "23505") return bad("Nama kategori kosong, terlalu panjang, atau sudah dipakai.");
    assertQuery(renamed.error);
    if (!renamed.data) return bad("Kategori tidak ditemukan.");
    return Response.json({ ok: true });
  } catch (error) { return dbError(error); }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json() as { id?: unknown };
    const key = clean(id);
    const { supabase } = await financeClient();
    const category = await supabase.from("categories").select("name").eq("id", key).maybeSingle();
    assertQuery(category.error);
    if (!category.data) return bad("Kategori tidak ditemukan.");
    const name = category.data.name;
    const [transactions, budgets, recurring] = await Promise.all([
      supabase.from("transactions").select("id").eq("category", name).limit(1),
      supabase.from("budgets").select("id").eq("category", name).limit(1),
      supabase.from("recurring").select("id").eq("category", name).limit(1),
    ]);
    assertQuery(transactions.error); assertQuery(budgets.error); assertQuery(recurring.error);
    if ((transactions.data ?? []).length || (budgets.data ?? []).length || (recurring.data ?? []).length) {
      return bad("Kategori masih dipakai. Ubah catatan atau budget terkait lebih dulu.");
    }
    const result = await supabase.from("categories").delete().eq("id", key);
    assertQuery(result.error);
    return Response.json({ ok: true });
  } catch (error) { return dbError(error); }
}
