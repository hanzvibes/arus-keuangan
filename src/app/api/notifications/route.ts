import { createClient } from "@/lib/supabase/server";
import { financeRouteError, readFinanceJson } from "@/app/api/_shared/finance-route";

type NotificationRow = {
  id: string; kind: "budget_alert"; title: string; body: string; budget_id: string | null;
  period: string; severity: "warning" | "exceeded"; read_at: string | null; created_at: string;
};

async function clientForUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (error || !userId) throw new Error("UNAUTHENTICATED");
  return { supabase, userId };
}

async function evaluate(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const period = new Date().toISOString().slice(0, 7);
  const [{ data: budgets, error: budgetError }, { data: transactions, error: txError }] = await Promise.all([
    supabase.from("budgets").select("id,category,amount").eq("user_id", userId),
    supabase.from("transactions").select("category,amount,type,date").eq("user_id", userId).eq("type", "expense").gte("date", `${period}-01`).lt("date", `${period}-32`),
  ]);
  if (budgetError) throw budgetError;
  if (txError) throw txError;
  for (const budget of budgets ?? []) {
    const spent = (transactions ?? []).filter(tx => tx.category === budget.category).reduce((sum, tx) => sum + Number(tx.amount), 0);
    const ratio = spent / Number(budget.amount);
    if (ratio < 0.8) continue;
    const severity = ratio >= 1 ? "exceeded" : "warning";
    await supabase.from("notifications").upsert({
      user_id: userId, id: `budget-${budget.id}-${period}`, kind: "budget_alert",
      budget_id: budget.id, period, severity,
      title: severity === "exceeded" ? "Budget terlampaui" : "Budget hampir habis",
      body: `${budget.category} sudah memakai ${Math.round(ratio * 100)}% dari budget bulan ini.`,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,kind,budget_id,period", ignoreDuplicates: false });
  }
}

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await clientForUser();
    await evaluate(supabase, userId);
    const { data, error } = await supabase.from("notifications").select("id,kind,title,body,budget_id,period,severity,read_at,created_at").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return Response.json({ notifications: (data ?? []) as NotificationRow[], unreadCount: (data ?? []).filter(row => !row.read_at).length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ error: "Sesi login diperlukan." }, { status: 401 });
    return financeRouteError(error, request);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await readFinanceJson<{ id?: unknown; all?: unknown }>(request);
    const { supabase, userId } = await clientForUser();
    if (payload.all === true) {
      const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
      if (error) throw error;
    } else if (typeof payload.id === "string" && payload.id.length <= 160) {
      const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).eq("id", payload.id);
      if (error) throw error;
    } else return Response.json({ error: "Notifikasi tidak valid." }, { status: 400 });
    const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
    if (error) throw error;
    return Response.json({ unreadCount: count ?? 0 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ error: "Sesi login diperlukan." }, { status: 401 });
    return financeRouteError(error, request);
  }
}
