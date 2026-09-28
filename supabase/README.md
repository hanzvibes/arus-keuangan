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
