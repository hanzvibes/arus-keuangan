import { createFinanceRepository } from "@/data/server/supabase-finance-repository";
import { financeRouteError, readFinanceJson } from "@/app/api/_shared/finance-route";
import { validateSavingsInput } from "@/lib/savings";

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const validId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(id);
const validTimestamp = (value: unknown): value is string => typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));

export async function POST(request: Request) {
  try {
    const payload = await readFinanceJson(request);
    const repository = await createFinanceRepository();
    const input = validateSavingsInput(payload);
    if (!input || !validId(payload.id)) return reply({ error: "Isi nama, nominal rupiah bulat, dan tenggat dengan benar." }, 400);
    if (await repository.createGoal(payload.id, input) === "duplicate") return reply({ error: "Target sudah tersimpan. Muat ulang untuk melihatnya." }, 409);
    return reply({ ok: true }, 201);
  } catch (error) { return financeRouteError(error, request); }
}
export async function PATCH(request: Request) {
  try {
    const payload = await readFinanceJson(request);
    const repository = await createFinanceRepository();
    const input = validateSavingsInput(payload);
    if (!input || !validId(payload.id) || !validTimestamp(payload.expectedUpdatedAt)) return reply({ error: "Data target tidak valid. Muat ulang lalu coba lagi." }, 400);
    if (!await repository.updateGoal(payload.id, payload.expectedUpdatedAt, input)) return reply({ error: "Target berubah di perangkat lain atau sudah dihapus. Muat ulang sebelum menyimpan." }, 409);
    return reply({ ok: true });
  } catch (error) { return financeRouteError(error, request); }
}
export async function DELETE(request: Request) {
  try {
    const payload = await readFinanceJson(request);
    const repository = await createFinanceRepository();
    if (!validId(payload.id) || !validTimestamp(payload.expectedUpdatedAt)) return reply({ error: "Data target tidak valid." }, 400);
    if (!await repository.deleteGoal(payload.id, payload.expectedUpdatedAt)) return reply({ error: "Target berubah atau sudah dihapus. Muat ulang lalu coba lagi." }, 409);
    return reply({ ok: true });
  } catch (error) { return financeRouteError(error, request); }
}
