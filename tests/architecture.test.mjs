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

test("root page stays a thin finance composition", async () => {
  const source = await readFile("app/page.tsx", "utf8");
  assert.match(source, /<FinanceApp\s*\/>/);
  assert.doesNotMatch(source, /useState|useEffect|financeApi|supabase/i);
  assert.ok(source.length < 1000, "app/page.tsx should remain composition-only");
});

test("finance UI stays split into feature tabs", async () => {
  const source = await readFile("features/finance/components/finance-app.tsx", "utf8");
  for (const tab of [
    "HomeTab",
    "AccountsTab",
    "TransactionsTab",
    "BudgetTab",
    "AnalyticsTab",
    "SettingsTab",
  ]) {
    assert.match(source, new RegExp(tab));
  }
  assert.doesNotMatch(source, /className="account-group"/);
  assert.doesNotMatch(source, /className="analytics-grid"/);
  assert.doesNotMatch(source, /className="filter-bar"/);
});

test("offline storage is scoped by authenticated user", async () => {
  const source = await readFile("lib/offline.ts", "utf8");
  assert.match(source, /DATABASE_PREFIX\s*=\s*"arus-device-cache:"/);
  assert.match(source, /readSnapshot\s*=\s*<T>\(userId: string\)/);
  assert.match(source, /writeSnapshot\s*=\s*\(userId: string,/);
  assert.match(source, /readQueue<T>\(userId: string\)/);
  assert.match(source, /enqueueTransaction\(userId: string,/);
  assert.match(source, /removeQueuedTransaction\(userId: string,/);
  assert.match(source, /clearDeviceCache\(userId: string\)/);
});

test("finance offline hook resolves the Supabase user before touching device storage", async () => {
  const source = await readFile("features/finance/hooks/use-finance-data.ts", "utf8");
  assert.match(source, /supabase\.auth\.getUser\(\)/);
  assert.match(source, /readQueue<QueuedTransaction>\(userId\)/);
  assert.match(source, /writeSnapshot\(userId,/);
  assert.match(source, /readSnapshot<FinanceData>\(userId\)/);
});
