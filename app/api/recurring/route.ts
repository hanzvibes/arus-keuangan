import { isCalendarDate } from "@/lib/backup";
import type { FinanceRepository } from "@/data/server/finance-repository";
import { createFinanceRepository } from "@/data/server/supabase-finance-repository";
import { financeRouteError } from "@/app/api/_shared/finance-route";

type Payload = Record<string, unknown>;

const clean = (value: unknown, max = 150) => typeof value === "string" ? value.trim().slice(0, max) : "";
const amount = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 1_000_000_000_000 ? value : null;
const bad = (error: string, status = 400) => Response.json({ error }, { status });

async function validate(repository: FinanceRepository, payload: Payload) {
  const type = clean(payload.type);
  const value = amount(payload.amount);
  const accountId = clean(payload.accountId, 100);
  const toAccountId = clean(payload.toAccountId, 100);
  const category = clean(payload.category, 50);
  const note = clean(payload.note);
  const nextDate = clean(payload.nextDate, 10);
  const frequency = clean(payload.frequency);

  if (
    !["expense", "income", "transfer"].includes(type) ||
    !value ||
    !accountId ||
    !isCalendarDate(nextDate) ||
    !["weekly", "monthly"].includes(frequency)
  ) {
    return { error: "Lengkapi jadwal rutin dengan benar." };
  }

  if (type === "transfer" && (!toAccountId || toAccountId === accountId)) {
    return { error: "Pilih akun tujuan yang berbeda." };
  }

  const accountIds = type === "transfer" ? [accountId, toAccountId] : [accountId];
  if (!await repository.accountsExist(accountIds)) {
    return { error: "Akun yang dipilih tidak tersedia." };
  }

  return {
    value: {
      type: type as "income" | "expense" | "transfer",
      amount: value,
      accountId,
      toAccountId: type === "transfer" ? toAccountId : null,
      category: type === "transfer" ? "Transfer" : category || "Lainnya",
      note,
      nextDate,
      frequency: frequency as "weekly" | "monthly",
      anchorDay: Number(nextDate.slice(8)),
    },
  };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Payload;
    const repository = await createFinanceRepository();

    if (payload.action === "record" || payload.action === "skip") {
      const id = clean(payload.id, 100);
      const due = clean(payload.due, 10);
      if (!id || !isCalendarDate(due)) return bad("Tanggal jadwal tidak valid.");

      if (payload.action === "skip") {
        const nextDate = await repository.skipRecurring(id, due);
        if (!nextDate) return bad("Jadwal sudah berubah. Muat ulang data.", 409);
        return Response.json({ ok: true, nextDate });
      }

      const recordedDate = clean(payload.recordedDate, 10);
      if (!isCalendarDate(recordedDate)) return bad("Tanggal transaksi tidak valid.");

      const result = await repository.recordRecurring(id, due, recordedDate);
      if (result === "duplicate") {
        return bad("Tanggal jadwal ini sudah pernah dicatat. Pilih tanggal berikutnya.", 409);
      }
      if (!result) return bad("Jadwal sudah berubah. Muat ulang data.", 409);

      return Response.json({ ok: true, nextDate: result.nextDate });
    }

    const checked = await validate(repository, payload);
    if (!checked.value) return bad(checked.error || "Jadwal tidak valid.");

    const id = crypto.randomUUID();
    await repository.createRecurring({
      id,
      ...checked.value,
      active: true,
      createdAt: new Date().toISOString(),
    });

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return financeRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json() as Payload;
    const id = clean(payload.id, 100);
    const repository = await createFinanceRepository();

    if (payload.action === "toggle") {
      if (typeof payload.active !== "boolean") return bad("Status jadwal tidak valid.");
      if (!await repository.toggleRecurring(id, payload.active)) {
        return bad("Jadwal tidak ditemukan.");
      }
      return Response.json({ ok: true });
    }

    const checked = await validate(repository, payload);
    if (!checked.value) return bad(checked.error || "Jadwal tidak valid.");

    const value = checked.value;
    const existing = await repository.getRecurringMeta(id);
    if (!existing) return bad("Jadwal tidak ditemukan.");

    if (existing.nextDate === value.nextDate && existing.frequency === value.frequency) {
      value.anchorDay = existing.anchorDay;
    }

    const transactionId = `r_${id}_${value.nextDate.replaceAll("-", "")}`;
    if (await repository.transactionExists(transactionId)) {
      return bad("Tanggal itu sudah pernah dicatat untuk jadwal ini.");
    }

    if (!await repository.updateRecurring(id, value)) {
      return bad("Jadwal tidak ditemukan.");
    }

    return Response.json({ ok: true });
  } catch (error) {
    return financeRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json() as { id?: unknown };
    const repository = await createFinanceRepository();

    if (!await repository.deleteRecurring(clean(id, 100))) {
      return bad("Jadwal tidak ditemukan.");
    }

    return Response.json({ ok: true });
  } catch (error) {
    return financeRouteError(error);
  }
}
