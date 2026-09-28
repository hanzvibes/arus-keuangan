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

test("shared UI directory contains only primitives used by the application", async () => {
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir("components/ui")).sort();
  assert.deepEqual(files, [
    "alert-dialog.tsx",
    "button.tsx",
    "drawer.tsx",
    "select.tsx",
  ]);
});

test("removed starter UI packages do not return as direct dependencies", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  const direct = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of [
    "@base-ui/react",
    "@hookform/resolvers",
    "@shadcn/react",
    "cmdk",
    "date-fns",
    "embla-carousel-react",
    "input-otp",
    "next-themes",
    "react-day-picker",
    "react-hook-form",
    "react-resizable-panels",
    "recharts",
    "zod",
  ]) {
    assert.equal(direct[name], undefined, `${name} should stay removed unless a real feature needs it`);
  }
});

test("global CSS stays a small ordered stylesheet entrypoint", async () => {
  const source = await readFile("app/globals.css", "utf8");
  assert.ok(source.length < 1000, "globals.css should only compose style modules");
  assert.match(source, /styles\/tokens\.css/);
  assert.match(source, /styles\/finance\.css/);
  assert.match(source, /styles\/auth\.css/);
});

test("obsolete ChatGPT starter auth surface stays removed", async () => {
  const { access } = await import("node:fs/promises");
  await assert.rejects(() => access("app/chatgpt-auth.ts"));
  const proxy = await readFile("lib/supabase/proxy.ts", "utf8");
  assert.doesNotMatch(proxy, /signin-with-chatgpt|signout-with-chatgpt|\\"\/callback\\"/);
});

test("auth-specific account UI lives in the auth feature", async () => {
  const finance = await readFile("features/finance/components/finance-app.tsx", "utf8");
  const settings = await readFile("features/finance/components/tabs/settings-tab.tsx", "utf8");
  assert.match(finance, /features\/auth\/components\/auth-user/);
  assert.match(settings, /features\/auth\/components\/auth-user/);
});

test("finance app composes overlays instead of rendering primitive drawers inline", async () => {
  const source = await readFile("features/finance/components/finance-app.tsx", "utf8");
  for (const component of [
    "FinanceEntryDrawer",
    "InstallGuideDrawer",
    "ReconcileDrawer",
    "ConfirmationDialogs",
  ]) {
    assert.match(source, new RegExp(component));
  }
  assert.doesNotMatch(source, /<Drawer\b|<Select\b|<AlertDialog\b/);
});

test("password recovery routes use the existing Supabase PKCE callback", async () => {
  const forgot = await readFile("app/forgot-password/page.tsx", "utf8");
  const update = await readFile("app/update-password/page.tsx", "utf8");
  const proxy = await readFile("lib/supabase/proxy.ts", "utf8");
  const callback = await readFile("app/auth/callback/route.ts", "utf8");

  assert.match(forgot, /resetPasswordForEmail/);
  assert.match(forgot, /auth\/callback\?next=\/update-password/);
  assert.match(update, /auth\.updateUser\(\{ password \}\)/);
  assert.match(proxy, /"\/forgot-password"/);
  assert.doesNotMatch(proxy, /PUBLIC_PATHS[\s\S]*"\/update-password"/);
  assert.match(callback, /"recovery"/);
});


test("Supabase schema tracks covering indexes for recurring account foreign keys", async () => {
  const schema = await readFile("supabase/schemas/arus.sql", "utf8");
  const migration = await readFile(
    "supabase/migrations/20260928060444_add_recurring_fk_indexes.sql",
    "utf8",
  );

  for (const indexName of [
    "recurring_user_account_idx",
    "recurring_user_to_account_idx",
  ]) {
    assert.match(schema, new RegExp(indexName));
    assert.match(migration, new RegExp(indexName));
  }
});
