import { validateBackup } from "@/lib/backup";
import { assertQuery, asNumber, dbError, financeClient } from "@/lib/supabase/finance";

const mapAccount = (r: any) => ({ id: r.id, name: r.name, kind: r.kind, openingBalance: asNumber(r.opening_balance), createdAt: r.created_at });
const mapTransaction = (r: any) => ({ id: r.id, type: r.type, amount: asNumber(r.amount), accountId: r.account_id, toAccountId: r.to_account_id, category: r.category, note: r.note, date: r.date, createdAt: r.created_at });
const mapBudget = (r: any) => ({ id: r.id, category: r.category, amount: asNumber(r.amount), createdAt: r.created_at });
const mapCategory = (r: any) => ({ id: r.id, name: r.name, createdAt: r.created_at });
const mapRecurring = (r: any) => ({ id: r.id, type: r.type, amount: asNumber(r.amount), accountId: r.account_id, toAccountId: r.to_account_id, category: r.category, note: r.note, nextDate: r.next_date, frequency: r.frequency, anchorDay: r.anchor_day, active: r.active ? 1 : 0, createdAt: r.created_at });

export async function GET() {
  try {
    const { supabase } = await financeClient();
    const [accounts, transactions, budgets, categories, recurring] = await Promise.all([
      supabase.from("accounts").select("id,name,kind,opening_balance,created_at").order("created_at"),
      supabase.from("transactions").select("id,type,amount,account_id,to_account_id,category,note,date,created_at").order("date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("budgets").select("id,category,amount,created_at").order("created_at"),
      supabase.from("categories").select("id,name,created_at").order("created_at"),
      supabase.from("recurring").select("id,type,amount,account_id,to_account_id,category,note,next_date,frequency,anchor_day,active,created_at").order("next_date"),
    ]);
    [accounts, transactions, budgets, categories, recurring].forEach(r => assertQuery(r.error));
    return Response.json({
      version: 2,
      exportedAt: new Date().toISOString(),
      accounts: (accounts.data ?? []).map(mapAccount),
      transactions: (transactions.data ?? []).map(mapTransaction),
      budgets: (budgets.data ?? []).map(mapBudget),
      categories: (categories.data ?? []).map(mapCategory),
      recurring: (recurring.data ?? []).map(mapRecurring),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return dbError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 3_000_000) return Response.json({ error: "File cadangan terlalu besar." }, { status: 413 });
    const text = await request.text();
    if (text.length > 3_000_000) return Response.json({ error: "File cadangan terlalu besar." }, { status: 413 });
    const input = JSON.parse(text) as { confirm?: string; backup?: unknown };
    if (input.confirm !== "GANTI DATA") return Response.json({ error: "Konfirmasi pemulihan diperlukan." }, { status: 400 });
    const validation = validateBackup(input.backup);
    if (!validation.data) return Response.json({ error: validation.error }, { status: 400 });

    const { supabase } = await financeClient();
    const result = await supabase.rpc("arus_restore_backup", { p_backup: validation.data });
    assertQuery(result.error);
    const counts = result.data as { accounts?: number; transactions?: number; budgets?: number } | null;
    return Response.json({ ok: true, counts: { accounts: counts?.accounts ?? 0, transactions: counts?.transactions ?? 0, budgets: counts?.budgets ?? 0 } });
  } catch (error) {
    return dbError(error);
  }
}
