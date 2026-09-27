import { validateBackup } from "@/lib/backup";
import { createFinanceRepository } from "@/data/server/supabase-finance-repository";
import { financeRouteError } from "@/app/api/_shared/finance-route";

export async function GET() {
  try {
    const repository = await createFinanceRepository();
    const snapshot = await repository.readSnapshot();

    return Response.json({
      version: 2,
      exportedAt: new Date().toISOString(),
      ...snapshot,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return financeRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 3_000_000) {
      return Response.json({ error: "File cadangan terlalu besar." }, { status: 413 });
    }

    const text = await request.text();
    if (text.length > 3_000_000) {
      return Response.json({ error: "File cadangan terlalu besar." }, { status: 413 });
    }

    const input = JSON.parse(text) as { confirm?: string; backup?: unknown };
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
    return financeRouteError(error);
  }
}
