import { createClient } from "@/lib/supabase/server";

export async function financeClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";

  if (error || !userId) {
    throw new Error("UNAUTHENTICATED");
  }

  return { supabase, userId };
}

export function dbError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return Response.json({ error: "Sesi login tidak valid." }, { status: 401 });
  }

  console.error("Supabase finance error", error);
  return Response.json({ error: "Data belum bisa diproses. Coba lagi." }, { status: 500 });
}

export function assertQuery(error: { message: string; code?: string } | null) {
  if (error) throw new Error(`${error.code ?? "DB"}: ${error.message}`);
}

export function asNumber(value: number | string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error("Nilai uang dari database tidak valid.");
  return parsed;
}
