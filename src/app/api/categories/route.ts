import { defaultCategories } from "@/lib/categories";
import type { FinanceRepository } from "@/data/server/finance-repository";
import { createFinanceRepository } from "@/data/server/supabase-finance-repository";
import { financeRouteError, readFinanceJson } from "@/app/api/_shared/finance-route";

const clean = (value: unknown) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
const bad = (error: string) => Response.json({ error }, { status: 400 });

async function available(repository: FinanceRepository, name: string, except = "") {
  if (!name || name.length > 50) return false;
  if (defaultCategories.some(category => category.toLowerCase() === name.toLowerCase())) return false;

  const categories = await repository.listCategories();
  return !categories.some(row => row.id !== except && row.name.toLowerCase() === name.toLowerCase());
}

export async function POST(request: Request) {
  try {
    const { name } = await readFinanceJson<{ name?: unknown }>(request);
    const label = clean(name);
    const repository = await createFinanceRepository();

    if (!await available(repository, label)) {
      return bad("Nama kategori kosong, terlalu panjang, atau sudah dipakai.");
    }

    const id = crypto.randomUUID();
    const result = await repository.createCategory({
      id,
      name: label,
      createdAt: new Date().toISOString(),
    });

    if (result === "duplicate") {
      return bad("Nama kategori kosong, terlalu panjang, atau sudah dipakai.");
    }

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return financeRouteError(error, request);
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, name } = await readFinanceJson<{ id?: unknown; name?: unknown }>(request);
    const key = clean(id);
    const label = clean(name);
    const repository = await createFinanceRepository();

    const existingName = await repository.getCategoryName(key);
    if (!existingName) return bad("Kategori tidak ditemukan.");
    if (existingName === label) return Response.json({ ok: true });

    if (!await available(repository, label, key)) {
      return bad("Nama kategori kosong, terlalu panjang, atau sudah dipakai.");
    }

    const result = await repository.renameCategory(key, label);
    if (result === "duplicate") {
      return bad("Nama kategori kosong, terlalu panjang, atau sudah dipakai.");
    }
    if (result === "missing") return bad("Kategori tidak ditemukan.");

    return Response.json({ ok: true });
  } catch (error) {
    return financeRouteError(error, request);
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await readFinanceJson<{ id?: unknown }>(request);
    const key = clean(id);
    const repository = await createFinanceRepository();

    const name = await repository.getCategoryName(key);
    if (!name) return bad("Kategori tidak ditemukan.");

    if (await repository.categoryReferenced(name)) {
      return bad("Kategori masih dipakai. Ubah catatan atau budget terkait lebih dulu.");
    }

    await repository.deleteCategory(key);
    return Response.json({ ok: true });
  } catch (error) {
    return financeRouteError(error, request);
  }
}
