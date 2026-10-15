# Client Productivity Suite

## Goal

Add ten client-only productivity features to Arus without changing Supabase, server APIs, migrations, or the existing financial data contract.

## Features

The suite consists of command palette, IndexedDB transaction templates, reversible local actions, advanced transaction filters, local budget simulation, derived monthly insights, CSV import with preview and offline queue integration, derived financial-health score, local onboarding checklist, and client polish (dark mode, keyboard shortcuts, compact view, safe mobile gestures, and browser report export).

## Boundaries

All durable feature state is device-local through existing IndexedDB/localStorage facilities. Derived features read the loaded `FinanceData` snapshot and never write computed results to Supabase. CSV import validates rows before enqueueing or submitting them through the existing transaction path. Existing server validation, ownership, offline queue semantics, and user-scoped storage remain authoritative.

## UX

Command palette opens with Ctrl/⌘+K and Escape, supports action search, and exposes existing navigation/form actions. Templates appear beside transaction entry and can be reused or deleted. Undo uses a time-limited toast and only reverses operations that have not been committed remotely. Filters expose a mobile-friendly sheet and a clear-all action. Simulation is visibly labeled as a preview and never changes saved budgets. Insights and health score explain their inputs. CSV import shows row errors and a valid-row count before confirmation. Onboarding is dismissible and remembers progress per device. Theme and density preferences apply consistently and respect reduced-motion.

## Testing and acceptance

Pure parsers, scoring, filtering, simulation, insight generation, and CSV validation receive deterministic unit tests. UI behavior tests cover palette keyboard lifecycle, template persistence, undo expiry, filter reset, import preview, onboarding completion, and theme/density persistence. Existing lint, typecheck, test, build, and health checks must remain green. No Supabase files or server routes change.
