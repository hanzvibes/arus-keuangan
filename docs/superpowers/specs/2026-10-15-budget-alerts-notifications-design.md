# Budget Alerts and In-App Notifications

## Goal

Help users notice when a monthly category budget reaches 80% usage without sending email or push notifications. The feature must respect Arus's per-user data isolation and work with the existing transaction and budget flows.

## Scope

The first release includes:

- A persistent notification record owned by a user.
- An in-app unread badge and notification panel/page.
- A fixed 80% budget threshold.
- One alert per budget and calendar month. Crossing 80% creates the alert; later spending updates its state when the budget reaches 100% or more rather than creating duplicates.
- Read, unread, and mark-all-as-read actions.
- Alerts generated after successful transaction mutations and on data refresh so existing data can be recognized.

It excludes email, browser push, configurable thresholds, recurring bill reminders, and notification delivery outside the application.

## Data model and security

Add `public.notifications` with:

- `user_id`, `id`, `kind`, `title`, `body`.
- `budget_id` and `period` for budget-alert identity.
- `severity` (`warning` or `exceeded`), `read_at`, `created_at`, `updated_at`.
- A unique constraint on `(user_id, kind, budget_id, period)`.

Enable RLS and grant authenticated users access only to rows where `user_id = auth.uid()`. Anonymous and public roles receive no access. A migration should add indexes for unread lookup and budget-period lookup.

## Evaluation behavior

The server evaluates active monthly budgets against expense transactions in the same `YYYY-MM` period and category. Transfers, income, and adjustment records do not count. If spending is below 80%, no alert is created. At 80% or above, an upsert creates or updates the alert as `warning`; at 100% or above it updates the same row to `exceeded`. Existing alerts are not recreated on every refresh.

The evaluation runs after successful transaction create, update, and delete operations, and through the normal finance data refresh path to backfill alerts for budgets created before this feature. Failure to create an alert must not roll back a successful transaction; the UI reports the finance mutation result independently.

## Application flow

Add authenticated API operations to list notifications, mark one read, and mark all read. The list returns newest first with a bounded page size and unread count. The client loads notifications with finance data, refreshes after mutations, and keeps the notification panel usable when the finance snapshot is served from offline cache. Read mutations require connectivity and show a clear error when unavailable.

Add a notification entry point to the authenticated app shell. It displays the unread count, opens a compact panel on desktop/mobile, links each budget alert to the budget view, and provides “mark all as read.” The existing visual language and toast system should be reused.

## Error handling and compatibility

Notification failures are isolated from financial writes. Unauthorized API requests return the existing 401 shape. Invalid notification IDs or cross-user records return a safe not-found/forbidden response without revealing ownership. Existing backups do not include notifications; restoring a backup clears or leaves notification history unchanged by design, and a subsequent refresh regenerates current budget alerts.

## Testing

Add database regression coverage for RLS, unique monthly identity, 80% creation, 100% update, and cross-user isolation. Add API/client tests for unread counts and read actions. Add UI/behavior tests for badge rendering, empty state, mark-all-as-read, and budget navigation. Run the existing lint, typecheck, unit tests, production build, and database migration paths.

## Acceptance criteria

1. A user with a budget at 80% sees exactly one unread in-app alert for that budget and month.
2. Additional transactions do not create duplicates; crossing 100% changes the existing alert severity.
3. A different user cannot read or mutate another user's notifications.
4. Marking an alert read updates the badge immediately after a successful response.
5. Existing finance workflows, offline snapshots, backup restore, and production build remain passing.
