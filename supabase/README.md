# Supabase schema workflow

Arus uses Supabase Postgres as the primary data store.

## Reproducible baseline

`migrations/20260927144843_add_user_profiles.sql` is the source-controlled baseline for the original application-owned schema. Its version intentionally matches the first migration version already recorded by the Arus production project, so existing production databases treat it as already applied while a fresh database can build the missing pre-migration schema.

The baseline contains the original accounts, transactions, budgets, categories, recurring, profiles, RLS policies, Arus RPC functions, and profile creation trigger. Supabase-managed Auth and Storage internals are not duplicated; integration tests provide only the minimal interfaces needed to exercise application-owned SQL.

All later schema changes remain individual migrations in `migrations/` and must replay in filename order from an empty database. Database Integration CI enforces this on every PR and push to `main`.

`schemas/arus.sql` is the current declarative application-schema snapshot, synchronized through `20261007111928_tighten_receipt_photo_cleanup_privileges.sql`. The `snapshot` CI path loads it directly before regression tests; it no longer needs schema migrations layered on top. The receipt-bucket hardening migration is still exercised separately as a regression check by deliberately degrading the test bucket and repairing it. The `fresh` path independently proves the complete migration chain can recreate the same tested application schema from an empty database.

## Migration history

The Arus production migration versions and source-controlled migration filenames must stay aligned. The repository currently starts with:

- `20260927144843_add_user_profiles.sql` — reproducible baseline anchored to the existing production migration version.
- `20260928060444_add_recurring_fk_indexes.sql` — recurring foreign-key covering indexes.
- `20260930170000_add_savings_goals.sql` — savings goals and backup support.
- `20261002152109_add_receipt_scans.sql` — receipt scan schema and RPCs.
- `20261002152428_add_receipt_scan_fk_index.sql` — receipt scan FK index.
- `20261003212611_harden_receipt_bucket.sql` — private receipt bucket hardening; timestamp matches production history.
- `20261006143647_fix_receipt_photo_cleanup_trigger.sql` — receipt photo cleanup trigger hardening.
- `20261006152049_add_atomic_transaction_delete.sql` — atomic receipt-backed transaction deletion.
- `20261007111928_tighten_receipt_photo_cleanup_privileges.sql` — normalize the cleanup queue to INSERT-only for `authenticated`.

For future schema changes, create the migration with the current Supabase CLI instead of inventing a filename:

```sh
supabase --version
supabase migration new <descriptive_name>
supabase link --project-ref mtoswyittiipcuewrheo
supabase migration list --local
```

Then replay migrations from a clean local database (`supabase db reset` when using the local Supabase stack), verify the linked migration list, keep `schemas/arus.sql` synchronized with production when appropriate, and run Supabase advisors after DDL changes.

Do not commit production data, database passwords, service-role keys, or other secrets.
