import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const receiptRoutes = [
  "src/app/api/receipt-scans/route.ts",
  "src/app/api/receipt-scans/[id]/route.ts",
  "src/app/api/receipt-scans/[id]/finalize/route.ts",
  "src/app/api/receipt-scans/[id]/update-transaction/route.ts",
  "src/app/api/receipt-photos/route.ts",
  "src/app/api/receipts/[id]/route.ts",
];

test("database CI replays the complete migration history from an empty database", async () => {
  const workflow = await readFile(".github/workflows/database.yml", "utf8");
  const baseline = await readFile("supabase/migrations/20260927144843_add_user_profiles.sql", "utf8");

  assert.match(workflow, /schema: \[fresh, snapshot\]/);
  assert.match(workflow, /for migration in supabase\/migrations\/\*\.sql/);
  assert.doesNotMatch(workflow, /git show 6b3e37/);
  assert.match(baseline, /create table public\.accounts/);
  assert.match(baseline, /create table public\.profiles/);
});

test("database CI runs every critical finance SQL suite", async () => {
  const workflow = await readFile(".github/workflows/database.yml", "utf8");
  for (const path of [
    "tests/database/receipt-storage.sql",
    "tests/database/receipts.sql",
    "tests/database/receipt-lifecycle.sql",
    "tests/database/savings.sql",
  ]) {
    assert.ok(workflow.includes(path), `${path} must run in database CI`);
  }
});

test("receipt API errors expose correlation IDs and receive request context", async () => {
  const server = await readFile("src/features/receipt/server.ts", "utf8");
  assert.match(server, /crypto\.randomUUID\(\)/);
  assert.match(server, /X-Request-Id/);
  assert.match(server, /receipt_route_error/);
  assert.match(server, /requestId/);

  for (const path of receiptRoutes) {
    const source = await readFile(path, "utf8");
    assert.match(source, /receiptError\(error,\s*request\)/, `${path} must pass request context to receiptError`);
  }
});

test("receipt photo reservation stays compatible with the insert-only cleanup queue", async () => {
  const source = await readFile("src/app/api/receipt-photos/route.ts", "utf8");
  assert.match(source, /receipt_photo_cleanup"\)\.insert\(/);
  assert.match(source, /reservation\.error\.code\s*!==\s*"23505"/);
  assert.doesNotMatch(source, /receipt_photo_cleanup"\)\.upsert\(/);
});

test("legacy unscoped offline cache is discarded instead of assigned to the active user", async () => {
  const source = await readFile("src/lib/offline.ts", "utf8");
  const start = source.indexOf("async function migrateLegacyCache");
  const end = source.indexOf("async function ensureUserDatabase");
  assert.ok(start >= 0 && end > start, "legacy migration function must exist");
  const migration = source.slice(start, end);

  assert.match(migration, /deleteDatabase\(LEGACY_DATABASE\)/);
  assert.doesNotMatch(migration, /openNamedDatabase\(databaseName\(/);
  assert.doesNotMatch(migration, /objectStore\(STORE\)\.put/);
  assert.doesNotMatch(migration, /objectStore\(PENDING\)\.put/);
});

test("offline device state stays user-scoped even when post-signout cleanup fails", async () => {
  const offline = await readFile("src/lib/offline.ts", "utf8");
  const auth = await readFile("src/features/auth/components/auth-user.tsx", "utf8");

  assert.match(offline, /const DATABASE_PREFIX = "arus-device-cache:"/);
  assert.match(offline, /return DATABASE_PREFIX \+ userId/);
  assert.match(offline, /deleteDatabase\(databaseName\(userId\)\)/);

  const signOut = auth.indexOf("await supabase.auth.signOut()");
  const cleanup = auth.indexOf("await clearDeviceCache(userId)");
  const cleanupFailure = auth.indexOf("catch (cleanupError)");
  const redirect = auth.indexOf('router.replace("/login")');
  assert.ok(signOut >= 0, "logout must invalidate the auth session");
  assert.ok(cleanup > signOut, "device cleanup must happen after auth invalidation");
  assert.ok(cleanupFailure > cleanup, "cleanup failure must be handled separately");
  assert.ok(redirect > cleanupFailure, "cleanup failure must not prevent redirect after logout");
  assert.match(auth.slice(cleanupFailure, redirect), /clearAppShellCache\(\)\.catch\(\(\) => \{\}\)/);
});

test("receipt-backed transaction deletion is delegated to one atomic database RPC", async () => {
  const route = await readFile("src/app/api/data/route.ts", "utf8");
  const repository = await readFile("src/data/server/supabase-finance-repository.ts", "utf8");
  const contract = await readFile("src/data/server/finance-repository.ts", "utf8");
  const deleteRoute = route.slice(route.indexOf("export async function DELETE"));

  assert.match(deleteRoute, /const deletion = await repository\.deleteTransaction\(key\)/);
  assert.doesNotMatch(deleteRoute, /getReceiptScanId\(key\)/);
  assert.doesNotMatch(deleteRoute, /deleteReceiptScan\(/);
  assert.match(repository, /supabase\.rpc\("arus_delete_transaction"/);
  assert.match(contract, /deleteTransaction\(id: string\): Promise<"deleted" \| "missing" \| "adjustment">/);
});


test("receipt cleanup cron has a dedicated proxy authentication exception", async () => {
  const proxy = await readFile("src/lib/supabase/proxy.ts", "utf8");
  const cron = await readFile("src/app/api/cron/receipt-photo-cleanup/route.ts", "utf8");

  assert.match(proxy, /\/api\/cron\/receipt-photo-cleanup/);
  assert.match(proxy, /authorizedReceiptCleanupCron/);
  assert.match(cron, /Unauthorized/);
  assert.match(cron, /status: 401/);
});


test("declarative Supabase snapshot already includes the latest application migrations", async () => {
  const workflow = await readFile(".github/workflows/database.yml", "utf8");
  const schema = await readFile("supabase/schemas/arus.sql", "utf8");

  assert.match(schema, /synchronized through migration 20261006152049/i);
  assert.match(schema, /create or replace function public\.arus_delete_transaction\(p_id text\)/);
  assert.match(schema, /exception when unique_violation/);
  assert.match(schema, /on conflict \(id\) do update/);
  assert.equal(
    (schema.match(/create or replace function public\.arus_restore_backup\(/g) ?? []).length,
    1,
    "snapshot must contain only the final restore implementation",
  );
  assert.doesNotMatch(
    schema,
    /insert into public\.receipt_photo_cleanup[\s\S]*?on conflict\(user_id,photo_path\) do nothing/,
  );
  assert.doesNotMatch(workflow, /Apply post-snapshot receipt cleanup hardening/);
  assert.doesNotMatch(workflow, /Apply post-snapshot atomic transaction deletion/);
});
