create table public.notifications (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  kind text not null check (kind in ('budget_alert')),
  title text not null,
  body text not null,
  budget_id text,
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  severity text not null check (severity in ('warning', 'exceeded')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, kind, budget_id, period)
);
alter table public.notifications enable row level security;
create policy notifications_owner_access on public.notifications for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.notifications from public, anon;
grant select, insert, update, delete on public.notifications to authenticated;
create index notifications_unread_idx on public.notifications(user_id, read_at, created_at desc);
create index notifications_budget_period_idx on public.notifications(user_id, budget_id, period);
