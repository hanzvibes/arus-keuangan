import { FinanceRepositoryError } from "@/data/server/finance-repository";

export function financeRouteError(error: unknown) {
  if (error instanceof FinanceRepositoryError && error.kind === "UNAUTHENTICATED") {
    return Response.json({ error: "Sesi login tidak valid." }, { status: 401 });
  }

  console.error("Finance route error", error);
  return Response.json({ error: "Data belum bisa diproses. Coba lagi." }, { status: 500 });
}
