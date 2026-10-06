import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return Response.json({ error: "Cleanup belum dikonfigurasi." }, { status: 503 });
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const stale = await admin.from("receipt_photo_cleanup").select("user_id,photo_path").lt("created_at", new Date(Date.now() - 86400000).toISOString()).limit(100);
  if (stale.error) return Response.json({ error: "Cleanup gagal." }, { status: 500 });
  let removed = 0;
  for (const row of stale.data ?? []) {
    const linked = await admin.from("transaction_receipts").select("transaction_id").eq("user_id", row.user_id).eq("photo_path", row.photo_path).limit(1);
    if (linked.error) continue;
    if (!linked.data?.length) {
      const deleted = await admin.storage.from("arus-receipts").remove([row.photo_path]);
      if (deleted.error) continue;
      removed++;
    }
    await admin.from("receipt_photo_cleanup").delete().eq("user_id", row.user_id).eq("photo_path", row.photo_path);
  }
  return Response.json({ ok: true, removed });
}
