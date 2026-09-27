import { isCalendarDate } from "@/lib/backup";
import { createFinanceRepository } from "@/data/server/supabase-finance-repository";
import { financeRouteError } from "@/app/api/_shared/finance-route";

type Payload = Record<string, unknown>;

const validKind = ["bank", "ewallet", "cash"];
const validType = ["income", "expense", "transfer"];
const clean = (value: unknown, max = 100) => typeof value === "string" ? value.trim().slice(0, max) : "";
const positive = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= 1_000_000_000_000 ? Number(value) : null;
const money = (value: unknown) => Number.isSafeInteger(Number(value)) && Math.abs(Number(value)) <= 1_000_000_000_000 ? Number(value) : null;
const bad = (message: string) => Response.json({ error: message }, { status: 400 });

export async function GET() {
  try {
    const repository = await createFinanceRepository();
    const data = await repository.readSnapshot();
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return financeRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Payload;
    const repository = await createFinanceRepository();
    const id = payload.entity === "transaction" &&
      typeof payload.id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.id)
      ? payload.id
      : crypto.randomUUID();
    const createdAt = new Date().toISOString();

    if (payload.entity === "account") {
      const name = clean(payload.name, 50);
      const kind = clean(payload.kind);
      const openingBalance = money(payload.openingBalance);

      if (!name || !validKind.includes(kind) || openingBalance === null) {
        return bad("Isi nama, jenis, dan saldo awal akun dengan benar.");
      }

      await repository.createAccount({ id, name, kind, openingBalance, createdAt });
    } else if (payload.entity === "transaction") {
      const type = clean(payload.type);
      const amount = positive(payload.amount);
      const accountId = clean(payload.accountId);
      const toAccountId = clean(payload.toAccountId);
      const category = clean(payload.category, 50);
      const note = clean(payload.note, 150);
      const date = clean(payload.date, 10);

      if (!validType.includes(type) || !amount || !accountId || !isCalendarDate(date)) {
        return bad("Lengkapi detail transaksi dengan benar.");
      }
      if (type === "transfer" && (!toAccountId || toAccountId === accountId)) {
        return bad("Pilih akun tujuan yang berbeda.");
      }

      const accountIds = type === "transfer" ? [accountId, toAccountId] : [accountId];
      if (!await repository.accountsExist(accountIds)) {
        return bad("Akun yang dipilih tidak tersedia.");
      }

      const result = await repository.createTransaction({
        id,
        type: type as "income" | "expense" | "transfer",
        amount,
        accountId,
        toAccountId: type === "transfer" ? toAccountId : null,
        category: type === "transfer" ? "Transfer" : category || "Lainnya",
        note,
        date,
        createdAt,
      });

      if (result === "duplicate") return Response.json({ id }, { status: 200 });
      return Response.json({ id }, { status: 201 });
    } else if (payload.entity === "budget") {
      const category = clean(payload.category, 50);
      const amount = positive(payload.amount);
      if (!category || !amount) return bad("Isi kategori dan batas budget.");

      const result = await repository.createBudget({ id, category, amount, createdAt });
      if (result === "duplicate") return bad("Budget kategori ini sudah ada.");
    } else {
      return bad("Jenis data tidak dikenal.");
    }

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return financeRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json() as Payload;
    const repository = await createFinanceRepository();
    const id = clean(payload.id);
    if (!id) return bad("Data yang akan diubah tidak ditemukan.");

    if (payload.entity === "account") {
      const name = clean(payload.name, 50);
      const kind = clean(payload.kind);
      const openingBalance = money(payload.openingBalance);

      if (!name || !validKind.includes(kind) || openingBalance === null) {
        return bad("Isi nama, jenis, dan saldo awal akun dengan benar.");
      }

      const currentOpeningBalance = await repository.getAccountOpeningBalance(id);
      if (currentOpeningBalance === null) return bad("Akun tidak ditemukan.");

      if (currentOpeningBalance !== openingBalance && await repository.accountHasTransactions(id)) {
        return bad("Saldo awal tidak dapat diubah setelah ada transaksi. Gunakan Cocokkan saldo.");
      }

      if (!await repository.updateAccount(id, { name, kind, openingBalance })) {
        return bad("Akun tidak ditemukan.");
      }
    } else if (payload.entity === "transaction") {
      const type = clean(payload.type);
      const amount = positive(payload.amount);
      const accountId = clean(payload.accountId);
      const toAccountId = clean(payload.toAccountId);
      const category = clean(payload.category, 50);
      const note = clean(payload.note, 150);
      const date = clean(payload.date, 10);

      if (!validType.includes(type) || !amount || !accountId || !isCalendarDate(date)) {
        return bad("Lengkapi detail transaksi dengan benar.");
      }
      if (type === "transfer" && (!toAccountId || toAccountId === accountId)) {
        return bad("Pilih akun tujuan yang berbeda.");
      }

      const existingType = await repository.getTransactionType(id);
      if (!existingType || existingType === "adjustment") {
        return bad("Penyesuaian saldo tidak dapat diedit. Cocokkan saldo lagi untuk membuat koreksi.");
      }

      const accountIds = type === "transfer" ? [accountId, toAccountId] : [accountId];
      if (!await repository.accountsExist(accountIds)) {
        return bad("Akun yang dipilih tidak tersedia.");
      }

      const updated = await repository.updateTransaction(id, {
        type: type as "income" | "expense" | "transfer",
        amount,
        accountId,
        toAccountId: type === "transfer" ? toAccountId : null,
        category: type === "transfer" ? "Transfer" : category || "Lainnya",
        note,
        date,
      });
      if (!updated) return bad("Transaksi tidak ditemukan.");
    } else if (payload.entity === "budget") {
      const category = clean(payload.category, 50);
      const amount = positive(payload.amount);
      if (!category || !amount) return bad("Isi kategori dan batas budget.");

      const result = await repository.updateBudget(id, { category, amount });
      if (result === "duplicate") return bad("Budget kategori ini sudah ada.");
      if (result === "missing") return bad("Budget tidak ditemukan.");
    } else {
      return bad("Jenis data tidak dikenal.");
    }

    return Response.json({ ok: true });
  } catch (error) {
    return financeRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { entity, id } = await request.json() as Payload;
    const key = clean(id);
    const repository = await createFinanceRepository();
    if (!key) return bad("ID tidak tersedia.");

    if (entity === "account") {
      if (await repository.accountReferenced(key)) {
        return bad("Akun memiliki transaksi atau jadwal rutin. Hapus catatan terkait lebih dulu.");
      }
      if (!await repository.deleteAccount(key)) return bad("Akun tidak ditemukan.");
    } else if (entity === "transaction") {
      const type = await repository.getTransactionType(key);
      if (!type || type === "adjustment") {
        return bad("Penyesuaian saldo tidak dapat dihapus. Cocokkan saldo lagi untuk membuat koreksi.");
      }
      await repository.deleteTransaction(key);
    } else if (entity === "budget") {
      if (!await repository.deleteBudget(key)) return bad("Budget tidak ditemukan.");
    } else {
      return bad("Jenis data tidak dikenal.");
    }

    return Response.json({ ok: true });
  } catch (error) {
    return financeRouteError(error);
  }
}
