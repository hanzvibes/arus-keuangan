import { validateBackup } from "@/lib/backup";
import { createFinanceRepository } from "@/data/server/supabase-finance-repository";
import { financeRouteError, readFinanceJson } from "@/app/api/_shared/finance-route";

export async function GET(request: Request) {
  try {
    const repository = await createFinanceRepository();
    const snapshot = await repository.readSnapshot();

    return Response.json({
      version: 3,
      exportedAt: new Date().toISOString(),
      ...snapshot,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return financeRouteError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    const input = await readFinanceJson<{ confirm?: string; backup?: unknown }>(
      request,
      3_000_000,
    );
    if (input.confirm !== "GANTI DATA") {
      return Response.json({ error: "Konfirmasi pemulihan diperlukan." }, { status: 400 });
    }

    const validation = validateBackup(input.backup);
    if (!validation.data) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const repository = await createFinanceRepository();
    const counts = await repository.restoreBackup(validation.data);
    return Response.json({ ok: true, counts });
  } catch (error) {
    return financeRouteError(error, request);
  }
}
