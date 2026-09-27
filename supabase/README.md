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

## Important limitation

This repository did not originally contain the full migration history for the finance schema. The declarative schema was captured from the live project during the architecture cleanup.

Before the next database schema change, initialize/link the Supabase CLI and pull/generate a migration using the current CLI instead of inventing a migration filename manually:

```sh
supabase init
supabase login
supabase link --project-ref mtoswyittiipcuewrheo
supabase db pull
supabase migration list --local
```

Review the generated baseline before committing it. Future schema changes should be represented in version control and verified with a local `supabase db reset`.

Do not commit production data, database passwords, service-role keys, or other secrets.
