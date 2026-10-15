# Budget Alerts and Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure in-app budget alerts at 80% usage with unread tracking and monthly deduplication.

**Architecture:** Store user-owned notifications in Supabase with RLS and a unique budget-period key. Expose authenticated notification API operations and a server-side budget evaluator invoked after finance writes and refresh. Add a client notification hook and app-shell panel using existing finance UI patterns.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Postgres/RLS, existing API repository and toast/UI components, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-15-budget-alerts-notifications-design.md`

## Global Constraints

- Alerts are in-app only; no email, push, or external delivery.
- Threshold is fixed at 80%; 100%+ updates the same alert to `exceeded`.
- Identity is one alert per user, budget, kind, and `YYYY-MM` period.
- All notification data is protected by `user_id = auth.uid()` RLS.
- Notification failure must not roll back a successful financial mutation.
- Preserve offline behavior, backups, tracked files outside this feature, and existing public API behavior.

## Review Focus

- Repeated refreshes and transactions must not duplicate a budget-month alert; test the unique upsert path in Task 1.
- Crossing 100% must update severity while preserving read state; test in Task 1.
- Cross-user IDs must not expose or mutate another user's notification; test RLS/API in Tasks 1 and 3.
- Deleted or edited transactions must recalculate the alert without rolling back the finance write; test evaluator integration in Task 2.
- Offline snapshots must remain renderable while read mutations fail clearly; test client behavior in Task 4.

### Task 1: Notification schema, evaluator, and database regression tests

**Files:**
- Create: `supabase/migrations/<timestamp>_add_notifications.sql`
- Create: `tests/database/notifications.sql`
- Modify: `supabase/schemas/arus.sql`

**Interfaces:**
- Produces table `public.notifications`, RLS policies, indexes, and an idempotent budget-alert upsert/evaluator callable by authenticated server code.

- [ ] **Step 1: Write failing SQL regression tests** for 80% creation, duplicate prevention, 100% severity update, read preservation, RLS ownership, and below-threshold no-op.
- [ ] **Step 2: Run the isolated database test** and verify it fails because the notifications schema/evaluator is absent.
- [ ] **Step 3: Implement the migration** with typed columns, `(user_id, kind, budget_id, period)` uniqueness, unread and period indexes, RLS, grants, and an invoker-safe evaluator/upsert function.
- [ ] **Step 4: Synchronize the declarative snapshot** with the new table, policies, function, and grants.
- [ ] **Step 5: Run fresh and snapshot database paths plus `tests/database/notifications.sql`; verify all assertions pass.
- [ ] **Step 6: Commit** `feat: add budget notification storage and evaluation`.

### Task 2: Server finance integration

**Files:**
- Modify: `src/data/server/supabase-finance-repository.ts`
- Modify: `src/data/server/finance-repository.ts`
- Modify: relevant `src/app/api/*/route.ts` mutation routes
- Test: `tests/finance-api.test.mjs` or a focused new API test

**Interfaces:**
- Consumes the database evaluator from Task 1.
- Produces evaluator invocation after successful transaction create, update, delete, and finance refresh/backfill without changing mutation success semantics.

- [ ] **Step 1: Add failing integration tests** proving a successful transaction still returns success when alert evaluation fails and that successful writes trigger evaluation.
- [ ] **Step 2: Run the focused tests and verify they fail.
- [ ] **Step 3: Add a best-effort `evaluateBudgetAlerts(userId, period)` server boundary** and invoke it after relevant successful writes and refresh/backfill paths; log failures without exposing secrets or changing finance responses.
- [ ] **Step 4: Run focused API tests and existing finance tests; verify pass.
- [ ] **Step 5: Commit** `feat: evaluate budget alerts after finance writes`.

### Task 3: Notification API

**Files:**
- Create: `src/app/api/notifications/route.ts`
- Create: `src/app/api/notifications/read/route.ts`
- Modify: `src/data/client/finance-api.ts`
- Test: `tests/finance-api.test.mjs` or `tests/notifications-api.test.mjs`

**Interfaces:**
- `GET /api/notifications` returns `{ notifications, unreadCount }` newest first with a bounded result.
- `PATCH /api/notifications/read` accepts `{ id }` or `{ all: true }` and returns the updated unread count.

- [ ] **Step 1: Write failing API tests** for list shape, single read, mark-all, 401, invalid IDs, and bounded ordering.
- [ ] **Step 2: Run focused tests and verify they fail.
- [ ] **Step 3: Implement routes using the existing authenticated finance route/session helpers and add typed client methods.
- [ ] **Step 4: Run focused and existing API tests; verify pass.
- [ ] **Step 5: Commit** `feat: expose notification read APIs`.

### Task 4: Client hook and app-shell notification UI

**Files:**
- Create: `src/features/notifications/hooks/use-notifications.ts`
- Create: `src/features/notifications/components/notification-trigger.tsx`
- Create: `src/features/notifications/components/notification-panel.tsx`
- Modify: `src/features/finance/components/finance-app.tsx`
- Test: focused client/UI tests in the existing Node test style or add the smallest supported test harness

**Interfaces:**
- `useNotifications()` exposes `notifications`, `unreadCount`, `loading`, `refresh`, `markRead(id)`, and `markAllRead()`.
- Trigger renders an unread badge; panel renders loading, empty, unread/read states, budget navigation, and mark-all action.

- [ ] **Step 1: Write failing behavior tests** for badge count, empty state, mark-all state transition, and read failure while offline.
- [ ] **Step 2: Run focused tests and verify they fail.
- [ ] **Step 3: Implement the hook with refresh after finance mutations, offline-safe reads, and explicit connectivity errors.
- [ ] **Step 4: Implement the trigger/panel using existing visual tokens, drawer/popover conventions, toasts, and budget navigation.
- [ ] **Step 5: Mount the trigger in the authenticated finance shell without disrupting existing tabs or mobile navigation.
- [ ] **Step 6: Run focused tests, lint, typecheck, and build; verify pass.
- [ ] **Step 7: Commit** `feat: add in-app budget notification center`.

### Task 5: Full verification and handoff

**Files:**
- Modify: documentation only if commands or feature behavior need updating.

- [ ] **Step 1: Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- [ ] **Step 2: Replay both database migration paths and notification regression tests.
- [ ] **Step 3: Start the app and verify health, public login, authenticated API protection, and notification API response behavior.
- [ ] **Step 4: Review `git diff`, confirm no secrets or unrelated tracked changes, and commit any documentation-only correction.
