# Supabase schema workflow

Arus uses Supabase Postgres as the primary data store.

## Current baseline

`schemas/arus.sql` is a declarative snapshot of the application-owned schema currently running in the linked production project:

- accounts
- transactions
- budgets
- categories
- recurring
- profiles
- RLS policies
- Arus RPC functions
- profile creation trigger

Supabase-managed Auth tables are intentionally not duplicated.

## Migration history

The original finance schema predates repository migration history, so `schemas/arus.sql` remains the baseline snapshot.

New database changes are tracked from this point forward in `migrations/`. The first source-controlled post-baseline migration is:

- `20260928060444_add_recurring_fk_indexes.sql` — adds covering indexes for the composite recurring-account foreign keys.

For future schema changes, use the current Supabase CLI to create the migration first, then verify the linked project and local migration history before committing:

```sh
supabase --version
supabase migration new <descriptive_name>
supabase link --project-ref mtoswyittiipcuewrheo
supabase migration list --local
```

Keep `schemas/arus.sql` synchronized with the resulting production schema and run Supabase advisors after DDL changes.

Do not commit production data, database passwords, service-role keys, or other secrets.

## Savings goals and receipt migrations

`20260930170000_add_savings_goals.sql` adds per-user savings goals with RLS,
a database-maintained update timestamp, and backup v3 support in the atomic
restore function. It was already present on FinanceTracker before migration
history was repaired on 2026-10-02. `20261002152109_add_receipt_scans.sql` and
`20261002152428_add_receipt_scan_fk_index.sql` were applied to FinanceTracker on
the same date. Other projects must apply these migrations in order before
deploying the corresponding application code.

Backups v1/v2 omit goals and preserve existing goals on restore. Backups v3
replace goals together with the other finance records within one transaction.
The FinanceTracker remote history now records both migrations. Verify history
against each target project and run advisors after DDL.
