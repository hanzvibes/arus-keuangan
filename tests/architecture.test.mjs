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

test("dashboard page stays a thin finance composition", async () => {
  const source = await readFile("app/app/page.tsx", "utf8");
  assert.match(source, /<FinanceApp\s*\/>/);
  assert.doesNotMatch(source, /useState|useEffect|financeApi|supabase/i);
  assert.ok(source.length < 1000, "app/app/page.tsx should remain composition-only");
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


test("Next.js applies production security headers and disables API caching", async () => {
  const source = await readFile("next.config.ts", "utf8");

  assert.match(source, /poweredByHeader:\s*false/);
  assert.match(source, /Content-Security-Policy/);
  assert.match(source, /frame-ancestors 'none'/);
  assert.match(source, /X-Frame-Options/);
  assert.match(source, /X-Content-Type-Options/);
  assert.match(source, /Permissions-Policy/);
  assert.match(source, /Referrer-Policy/);
  assert.match(source, /Strict-Transport-Security/);
  assert.match(source, /source:\s*"\/api\/:path\*"/);
  assert.match(source, /no-store, max-age=0/);
});


test("finance mutations use the shared bounded JSON parser", async () => {
  const shared = await readFile("app/api/_shared/finance-route.ts", "utf8");
  assert.match(shared, /Content-Type application\/json/);
  assert.match(shared, /DEFAULT_BODY_LIMIT\s*=\s*64_000/);
  assert.match(shared, /TextEncoder\(\)\.encode\(text\)\.byteLength/);
  assert.match(shared, /Format JSON tidak valid/);
  assert.match(shared, /assertSameOrigin\(request\)/);

  for (const path of [
    "app/api/data/route.ts",
    "app/api/backup/route.ts",
    "app/api/categories/route.ts",
    "app/api/recurring/route.ts",
    "app/api/reconcile/route.ts",
  ]) {
    const source = await readFile(path, "utf8");
    assert.match(source, /readFinanceJson/);
    assert.doesNotMatch(source, /request\.json\(\)/);
  }

  const backup = await readFile("app/api/backup/route.ts", "utf8");
  assert.match(backup, /3_000_000/);
  assert.doesNotMatch(backup, /JSON\.parse\(text\)/);
});

test("API proxy rejects cross-site state-changing requests before data access", async () => {
  const source = await readFile("lib/supabase/proxy.ts", "utf8");
  assert.match(source, /SAFE_METHODS/);
  assert.match(source, /sec-fetch-site/);
  assert.match(source, /trustedMutationOrigin/);
  assert.match(source, /Permintaan lintas situs ditolak/);
  assert.match(source, /pathname\.startsWith\("\/api\/"\)/);
});


test("CI runs lint as a production quality gate", async () => {
  const source = await readFile(".github/workflows/ci.yml", "utf8");
  assert.match(source, /- name: Lint\s+run: pnpm lint/);
});

test("health endpoint is public, cache-free, and does not touch auth or finance data", async () => {
  const health = await readFile("app/api/health/route.ts", "utf8");
  const proxy = await readFile("lib/supabase/proxy.ts", "utf8");

  assert.match(health, /status: "ok"/);
  assert.match(health, /service: "arus"/);
  assert.match(health, /Cache-Control/);
  assert.match(health, /no-store/);
  assert.match(health, /X-Robots-Tag/);
  assert.doesNotMatch(health, /supabase|createFinanceRepository|auth\./i);

  assert.match(proxy, /PUBLIC_API_PATHS/);
  assert.match(proxy, /"\/api\/health"/);
  assert.match(proxy, /PUBLIC_API_PATHS\.has\(pathname\)/);
});

test("finance server errors emit correlation IDs without exposing raw errors to clients", async () => {
  const shared = await readFile("app/api/_shared/finance-route.ts", "utf8");

  assert.match(shared, /crypto\.randomUUID\(\)/);
  assert.match(shared, /X-Request-Id/);
  assert.match(shared, /finance_route_error/);
  assert.match(shared, /x-vercel-id/);
  assert.match(shared, /requestId: context\.requestId/);
  assert.match(shared, /Data belum bisa diproses\. Coba lagi\./);
});


test("finance client has bounded requests and retries only safe reads", async () => {
  const source = await readFile("data/client/finance-api.ts", "utf8");

  assert.match(source, /DEFAULT_TIMEOUT_MS\s*=\s*10_000/);
  assert.match(source, /BACKUP_TIMEOUT_MS\s*=\s*30_000/);
  assert.match(source, /AbortController/);
  assert.match(source, /safeToRetry\s*=\s*method === "GET"/);
  assert.match(source, /RETRYABLE_STATUS/);
  assert.match(source, /requestId/);
  assert.match(source, /kind: FinanceApiErrorKind/);
});


test("offline transaction fallback recognizes the hardened API network errors", async () => {
  const app = await readFile("features/finance/components/finance-app.tsx", "utf8");
  const route = await readFile("app/api/data/route.ts", "utf8");

  assert.match(app, /e instanceof FinanceApiError/);
  assert.match(app, /e\.kind === "network"/);
  assert.match(app, /e\.kind === "timeout"/);
  assert.match(app, /queueTransaction\(transaction\)/);

  // Client-generated transaction IDs make timeout recovery idempotent.
  assert.match(route, /payload\.entity === "transaction"/);
  assert.match(route, /payload\.id/);
  assert.match(route, /result === "duplicate"/);
  assert.match(route, /status: 200/);
});


test("logout preserves offline data until Supabase confirms the session is signed out", async () => {
  const source = await readFile("features/auth/components/auth-user.tsx", "utf8");
  const signOutIndex = source.indexOf("supabase.auth.signOut()");
  const clearCacheIndex = source.indexOf("clearDeviceCache(userId)", signOutIndex);

  assert.ok(signOutIndex >= 0, "logout must call Supabase signOut");
  assert.ok(clearCacheIndex > signOutIndex, "device cache must only clear after signOut succeeds");
  assert.match(source, /Post-signout cache cleanup failed/);
  assert.match(source, /window\.location\.assign\("\/login"\)/);
});
