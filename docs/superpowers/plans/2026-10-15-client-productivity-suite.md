# Client Productivity Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship ten client-only productivity features across four batches without changing Supabase or server APIs.

**Architecture:** Keep pure calculations in focused `src/lib` modules, device state in existing offline storage/localStorage, and UI orchestration in small feature components/hooks. Reuse the existing transaction queue and finance snapshot; no new persistence service or backend contract.

**Tech Stack:** Next.js 16, React 19, TypeScript, IndexedDB/localStorage, existing Node test runner, existing CSS system.

**Spec:** `docs/superpowers/specs/2026-10-15-client-productivity-suite-design.md`

## Global Constraints

- No Supabase, migrations, server routes, or dependency changes.
- Derived features never write computed results to the server.
- CSV rows use existing validation and offline queue semantics.
- Device-local templates, onboarding, preferences, and import drafts are user-scoped where existing storage supports it.
- All existing lint, typecheck, tests, build, and API behavior remain green.

## Review Focus

- CSV malformed rows, duplicate IDs, and invalid dates must be rejected without partial silent writes; Task 3 tests these.
- Undo must not claim to reverse a server mutation after it has committed; Task 1 tests the reversible boundary.
- Local storage must not leak data between authenticated users; Task 1 tests namespacing.
- Simulator and health score must handle zero budgets, empty data, and negative adjustment balances; Task 2 tests these.
- Dark mode, compact mode, keyboard palette, and mobile gestures must remain accessible with reduced motion; Task 4 tests persistence and keyboard lifecycle.

### Task 1: Local actions, templates, command palette, and undo

**Files:** Create focused modules under `src/lib/client-productivity/` and `src/features/productivity/`; modify transaction entry and finance shell; add unit/UI tests.

- [ ] Write failing tests for template CRUD, namespaced storage, command filtering, shortcut open/close, and undo expiry.
- [ ] Implement minimal IndexedDB/localStorage adapters, command registry, template hook, and reversible toast action.
- [ ] Mount command palette and template actions in the shell and transaction drawer.
- [ ] Run focused tests, then `pnpm test`; leave changes uncommitted for the single final commit.

### Task 2: Filters, simulator, insights, and health dashboard

**Files:** Create pure helpers under `src/lib/client-productivity/`; modify transaction, budget, analytics, and home tabs; add deterministic tests.

- [ ] Write failing tests for filter combinations/reset, budget what-if calculations, monthly insights, health score bounds, and empty data.
- [ ] Implement pure functions with explicit input/output types and no persistence side effects.
- [ ] Add mobile filter sheet, simulator preview state, insight cards, and health summary to existing tabs.
- [ ] Run focused tests and `pnpm typecheck`.

### Task 3: CSV import and onboarding

**Files:** Create `src/lib/client-productivity/csv-import.ts`, importer hook/components, onboarding hook/components; modify finance shell and transaction flow; add tests.

- [ ] Write failing parser/validator tests for headers, quoted commas, dates, amounts, duplicate IDs, and row error reporting.
- [ ] Implement browser-only CSV parsing and preview/mapping without network calls; submit only confirmed valid rows through the existing queue/API path.
- [ ] Implement dismissible local onboarding checklist keyed by authenticated user/device scope.
- [ ] Run focused tests and verify invalid rows never enter the queue.

### Task 4: Client polish and full verification

**Files:** Modify `src/styles/native.css`, global theme hooks, report export helper, and finance shell; add tests for preference persistence and export output.

- [ ] Write failing tests for dark mode, compact density, keyboard shortcuts, safe mobile gesture boundaries, and report export fallback.
- [ ] Implement theme/density preferences, keyboard and gesture affordances, and browser-only PNG/PDF-compatible report export without new dependencies.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- [ ] Review the complete diff, confirm no Supabase/server files changed, commit all implementation and spec/plan files once, then push `origin/main`.
