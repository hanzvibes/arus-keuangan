import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const receiptRoutes = [
  "app/api/receipt-scans/route.ts",
  "app/api/receipt-scans/[id]/route.ts",
  "app/api/receipt-scans/[id]/finalize/route.ts",
  "app/api/receipt-scans/[id]/update-transaction/route.ts",
  "app/api/receipt-photos/route.ts",
  "app/api/receipts/[id]/route.ts",
];

test("database CI runs every critical finance SQL suite", async () => {
  const workflow = await readFile(".github/workflows/database.yml", "utf8");
  for (const path of [
    "tests/database/receipt-storage.sql",
    "tests/database/receipts.sql",
    "supabase/migrations/20261006143647_fix_receipt_photo_cleanup_trigger.sql",
    "tests/database/receipt-lifecycle.sql",
    "tests/database/savings.sql",
  ]) {
    assert.ok(workflow.includes(path), `${path} must run in database CI`);
  }
});

test("receipt API errors expose correlation IDs and receive request context", async () => {
  const server = await readFile("features/receipt/server.ts", "utf8");
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
  const source = await readFile("app/api/receipt-photos/route.ts", "utf8");
  assert.match(source, /receipt_photo_cleanup"\)\.insert\(/);
  assert.match(source, /reservation\.error\.code\s*!==\s*"23505"/);
  assert.doesNotMatch(source, /receipt_photo_cleanup"\)\.upsert\(/);
});

test("legacy unscoped offline cache is discarded instead of assigned to the active user", async () => {
  const source = await readFile("lib/offline.ts", "utf8");
  const start = source.indexOf("async function migrateLegacyCache");
  const end = source.indexOf("async function ensureUserDatabase");
  assert.ok(start >= 0 && end > start, "legacy migration function must exist");
  const migration = source.slice(start, end);

  assert.match(migration, /deleteDatabase\(LEGACY_DATABASE\)/);
  assert.doesNotMatch(migration, /openNamedDatabase\(databaseName\(/);
  assert.doesNotMatch(migration, /objectStore\(STORE\)\.put/);
  assert.doesNotMatch(migration, /objectStore\(PENDING\)\.put/);
});
