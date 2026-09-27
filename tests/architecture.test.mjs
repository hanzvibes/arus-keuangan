import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const financeRoutes = [
  "app/api/data/route.ts",
  "app/api/backup/route.ts",
  "app/api/categories/route.ts",
  "app/api/recurring/route.ts",
  "app/api/reconcile/route.ts",
];

test("finance API routes depend on the repository boundary, not Supabase queries", async () => {
  for (const path of financeRoutes) {
    const source = await readFile(path, "utf8");
    assert.match(source, /createFinanceRepository/);
    assert.doesNotMatch(source, /lib\/supabase/);
    assert.doesNotMatch(source, /@supabase/);
    assert.doesNotMatch(source, /\.from\s*\(/);
    assert.doesNotMatch(source, /\.rpc\s*\(/);
  }
});

test("finance domain types stay framework and persistence agnostic", async () => {
  const source = await readFile("domain/finance/types.ts", "utf8");
  assert.doesNotMatch(source, /next\//);
  assert.doesNotMatch(source, /supabase/i);
  assert.doesNotMatch(source, /\.\.\/\.\.\/lib\//);
});
