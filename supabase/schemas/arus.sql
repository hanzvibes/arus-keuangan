-- Arus declarative schema snapshot.
-- Baseline captured from the live Supabase project on 2026-09-27; synchronized through migration 20260928060444.
-- This file covers application-owned objects only. Supabase-managed auth schema is not duplicated here.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.accounts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) between 1 and 50),
  kind text not null check (kind in ('bank','ewallet','cash')),
  opening_balance bigint not null default 0 check (abs(opening_balance) <= 1000000000000),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) between 1 and 50),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create unique index categories_user_name_unique
  on public.categories (user_id, lower(name));

create table public.budgets (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  category text not null check (char_length(category) between 1 and 50),
  amount bigint not null check (amount > 0 and amount <= 1000000000000),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create unique index budgets_user_category_unique
  on public.budgets (user_id, lower(category));

create table public.transactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  type text not null check (type in ('income','expense','transfer','adjustment')),
  amount bigint not null check (
    (type = 'adjustment' and amount <> 0 and abs(amount) <= 1000000000000)
    or
    (type <> 'adjustment' and amount > 0 and amount <= 1000000000000)
  ),
  account_id text not null,
  to_account_id text,
  category text not null check (char_length(category) between 1 and 50),
  note text not null default '' check (char_length(note) <= 150),
  date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint transactions_account_fk
    foreign key (user_id, account_id)
    references public.accounts(user_id, id)
    on delete restrict,
  constraint transactions_to_account_fk
    foreign key (user_id, to_account_id)
    references public.accounts(user_id, id)
    on delete restrict,
  constraint transactions_transfer_shape check (
    (type = 'transfer' and to_account_id is not null and to_account_id <> account_id)
    or
    (type <> 'transfer' and to_account_id is null)
  )
);

create index transactions_user_date_idx
  on public.transactions (user_id, date desc, created_at desc);

create index transactions_user_account_idx
  on public.transactions (user_id, account_id);

create index transactions_user_to_account_idx
  on public.transactions (user_id, to_account_id)
  where to_account_id is not null;

create table public.recurring (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  type text not null check (type in ('income','expense','transfer')),
  amount bigint not null check (amount > 0 and amount <= 1000000000000),
  account_id text not null,
  to_account_id text,
  category text not null check (char_length(category) between 1 and 50),
  note text not null default '' check (char_length(note) <= 150),
  next_date date not null,
  frequency text not null check (frequency in ('weekly','monthly')),
  anchor_day integer not null check (anchor_day between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint recurring_account_fk
    foreign key (user_id, account_id)
    references public.accounts(user_id, id)
    on delete restrict,
  constraint recurring_to_account_fk
    foreign key (user_id, to_account_id)
    references public.accounts(user_id, id)
    on delete restrict,
  constraint recurring_transfer_shape check (
    (type = 'transfer' and to_account_id is not null and to_account_id <> account_id)
    or
    (type <> 'transfer' and to_account_id is null)
  )
);

create index recurring_user_next_date_idx
  on public.recurring (user_id, next_date);

create index recurring_user_account_idx
  on public.recurring (user_id, account_id);

create index recurring_user_to_account_idx
  on public.recurring (user_id, to_account_id)
  where to_account_id is not null;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.budgets enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring enable row level security;
alter table public.profiles enable row level security;

create policy accounts_owner_access on public.accounts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy categories_owner_access on public.categories
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy budgets_owner_access on public.budgets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy transactions_owner_access on public.transactions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy recurring_owner_access on public.recurring
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy profiles_owner_select on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_owner_update on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on public.accounts, public.categories, public.budgets, public.transactions, public.recurring, public.profiles from anon;
grant select, insert, update, delete on public.accounts, public.categories, public.budgets, public.transactions, public.recurring to authenticated;
grant select, update on public.profiles to authenticated;

create or replace function public.arus_next_occurrence(
  p_date date,
  p_frequency text,
  p_anchor_day integer
) returns date
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  target_month date;
  last_day integer;
begin
  if p_frequency = 'weekly' then
    return p_date + 7;
  end if;

  if p_frequency <> 'monthly' or p_anchor_day < 1 or p_anchor_day > 31 then
    raise exception 'invalid recurring rule';
  end if;

  target_month := (date_trunc('month', p_date::timestamp) + interval '1 month')::date;
  last_day := extract(day from (target_month + interval '1 month - 1 day')::date)::integer;

  return make_date(
    extract(year from target_month)::integer,
    extract(month from target_month)::integer,
    least(p_anchor_day, last_day)
  );
end;
$$;

create or replace function public.arus_rename_category(
  p_id text,
  p_name text
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_name text;
begin
  select name into old_name
  from public.categories
  where user_id = (select auth.uid()) and id = p_id
  for update;

  if old_name is null then
    return false;
  end if;

  update public.categories set name = p_name
  where user_id = (select auth.uid()) and id = p_id;

  update public.transactions set category = p_name
  where user_id = (select auth.uid()) and category = old_name;

  update public.budgets set category = p_name
  where user_id = (select auth.uid()) and category = old_name;

  update public.recurring set category = p_name
  where user_id = (select auth.uid()) and category = old_name;

  return true;
end;
$$;

create or replace function public.arus_skip_recurring(
  p_id text,
  p_due date
) returns date
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rule public.recurring%rowtype;
  next_value date;
begin
  select * into rule
  from public.recurring
  where user_id = (select auth.uid())
    and id = p_id
    and next_date = p_due
    and active = true
  for update;

  if not found then return null; end if;

  next_value := public.arus_next_occurrence(p_due, rule.frequency, rule.anchor_day);

  update public.recurring set next_date = next_value
  where user_id = (select auth.uid()) and id = p_id;

  return next_value;
end;
$$;

create or replace function public.arus_record_recurring(
  p_id text,
  p_due date,
  p_recorded_date date
) returns date
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rule public.recurring%rowtype;
  next_value date;
  tx_id text;
begin
  select * into rule
  from public.recurring
  where user_id = (select auth.uid())
    and id = p_id
    and next_date = p_due
    and active = true
  for update;

  if not found then return null; end if;

  tx_id := 'r_' || p_id || '_' || to_char(p_due, 'YYYYMMDD');

  if exists (
    select 1 from public.transactions
    where user_id = (select auth.uid()) and id = tx_id
  ) then
    raise exception 'recurring occurrence already recorded' using errcode = '23505';
  end if;

  insert into public.transactions (
    user_id, id, type, amount, account_id, to_account_id,
    category, note, date, created_at
  ) values (
    (select auth.uid()), tx_id, rule.type, rule.amount, rule.account_id,
    rule.to_account_id, rule.category, rule.note, p_recorded_date, now()
  );

  next_value := public.arus_next_occurrence(p_due, rule.frequency, rule.anchor_day);

  update public.recurring set next_date = next_value
  where user_id = (select auth.uid()) and id = p_id;

  return next_value;
end;
$$;

create or replace function public.arus_reconcile_balance(
  p_account_id text,
  p_expected_balance bigint,
  p_actual_balance bigint,
  p_note text,
  p_date date,
  p_adjustment_category text
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_balance bigint;
  delta bigint;
  new_id text;
begin
  select
    a.opening_balance + coalesce(sum(
      case
        when t.type = 'income' and t.account_id = a.id then t.amount
        when t.type = 'expense' and t.account_id = a.id then -t.amount
        when t.type = 'transfer' and t.account_id = a.id then -t.amount
        when t.type = 'transfer' and t.to_account_id = a.id then t.amount
        when t.type = 'adjustment' and t.account_id = a.id then t.amount
        else 0
      end
    ), 0)
  into current_balance
  from public.accounts a
  left join public.transactions t
    on t.user_id = a.user_id
   and (t.account_id = a.id or t.to_account_id = a.id)
  where a.user_id = (select auth.uid()) and a.id = p_account_id
  group by a.opening_balance;

  if current_balance is null or current_balance <> p_expected_balance then
    return null;
  end if;

  delta := p_actual_balance - p_expected_balance;
  if delta = 0 then return null; end if;

  new_id := gen_random_uuid()::text;

  insert into public.transactions (
    user_id, id, type, amount, account_id, to_account_id,
    category, note, date, created_at
  ) values (
    (select auth.uid()), new_id, 'adjustment', delta, p_account_id, null,
    p_adjustment_category, p_note, p_date, now()
  );

  return new_id;
end;
$$;

create or replace function public.arus_restore_backup(
  p_backup jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  row_data jsonb;
  account_count integer := 0;
  transaction_count integer := 0;
  budget_count integer := 0;
begin
  if uid is null then raise exception 'authentication required'; end if;

  delete from public.transactions where user_id = uid;
  delete from public.recurring where user_id = uid;
  delete from public.budgets where user_id = uid;
  delete from public.categories where user_id = uid;
  delete from public.accounts where user_id = uid;

  for row_data in select value from jsonb_array_elements(coalesce(p_backup->'accounts', '[]'::jsonb))
  loop
    insert into public.accounts(user_id, id, name, kind, opening_balance, created_at)
    values (uid, row_data->>'id', row_data->>'name', row_data->>'kind',
      (row_data->>'openingBalance')::bigint, (row_data->>'createdAt')::timestamptz);
    account_count := account_count + 1;
  end loop;

  for row_data in select value from jsonb_array_elements(coalesce(p_backup->'categories', '[]'::jsonb))
  loop
    insert into public.categories(user_id, id, name, created_at)
    values (uid, row_data->>'id', row_data->>'name', (row_data->>'createdAt')::timestamptz);
  end loop;

  for row_data in select value from jsonb_array_elements(coalesce(p_backup->'budgets', '[]'::jsonb))
  loop
    insert into public.budgets(user_id, id, category, amount, created_at)
    values (uid, row_data->>'id', row_data->>'category',
      (row_data->>'amount')::bigint, (row_data->>'createdAt')::timestamptz);
    budget_count := budget_count + 1;
  end loop;

  for row_data in select value from jsonb_array_elements(coalesce(p_backup->'recurring', '[]'::jsonb))
  loop
    insert into public.recurring(
      user_id, id, type, amount, account_id, to_account_id, category, note,
      next_date, frequency, anchor_day, active, created_at
    ) values (
      uid, row_data->>'id', row_data->>'type', (row_data->>'amount')::bigint,
      row_data->>'accountId', nullif(row_data->>'toAccountId', ''),
      row_data->>'category', coalesce(row_data->>'note', ''),
      (row_data->>'nextDate')::date, row_data->>'frequency',
      (row_data->>'anchorDay')::integer, (row_data->>'active')::integer = 1,
      (row_data->>'createdAt')::timestamptz
    );
  end loop;

  for row_data in select value from jsonb_array_elements(coalesce(p_backup->'transactions', '[]'::jsonb))
  loop
    insert into public.transactions(
      user_id, id, type, amount, account_id, to_account_id, category, note,
      date, created_at
    ) values (
      uid, row_data->>'id', row_data->>'type', (row_data->>'amount')::bigint,
      row_data->>'accountId', nullif(row_data->>'toAccountId', ''),
      row_data->>'category', coalesce(row_data->>'note', ''),
      (row_data->>'date')::date, (row_data->>'createdAt')::timestamptz
    );
    transaction_count := transaction_count + 1;
  end loop;

  return jsonb_build_object(
    'accounts', account_count,
    'transactions', transaction_count,
    'budgets', budget_count
  );
end;
$$;

create or replace function private.arus_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Pengguna'
      ),
      80
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.arus_next_occurrence(date,text,integer) from public, anon;
revoke all on function public.arus_rename_category(text,text) from public, anon;
revoke all on function public.arus_skip_recurring(text,date) from public, anon;
revoke all on function public.arus_record_recurring(text,date,date) from public, anon;
revoke all on function public.arus_reconcile_balance(text,bigint,bigint,text,date,text) from public, anon;
revoke all on function public.arus_restore_backup(jsonb) from public, anon;
revoke all on function private.arus_handle_new_user() from public, anon, authenticated;

grant execute on function public.arus_next_occurrence(date,text,integer) to authenticated;
grant execute on function public.arus_rename_category(text,text) to authenticated;
grant execute on function public.arus_skip_recurring(text,date) to authenticated;
grant execute on function public.arus_record_recurring(text,date,date) to authenticated;
grant execute on function public.arus_reconcile_balance(text,bigint,bigint,text,date,text) to authenticated;
grant execute on function public.arus_restore_backup(jsonb) to authenticated;

create trigger arus_create_profile_on_signup
  after insert on auth.users
  for each row execute function private.arus_handle_new_user();
