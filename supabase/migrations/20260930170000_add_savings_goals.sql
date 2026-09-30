-- Apply after the existing Arus baseline and recorded migrations.
create table public.savings_goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,100}$'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  target_amount bigint not null check (target_amount > 0 and target_amount <= 1000000000000),
  saved_amount bigint not null default 0 check (saved_amount >= 0 and saved_amount <= 1000000000000),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.savings_goals enable row level security;
create policy savings_goals_owner_access on public.savings_goals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.savings_goals from public, anon;
grant select, insert, update, delete on public.savings_goals to authenticated;

create or replace function public.arus_touch_savings_goal()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.arus_touch_savings_goal() from public, anon;
grant execute on function public.arus_touch_savings_goal() to authenticated;
create trigger arus_touch_savings_goal
before update on public.savings_goals
for each row execute function public.arus_touch_savings_goal();

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

  -- Legacy backups preserve goals because they did not contain this feature.
  if p_backup ? 'goals' then
    delete from public.savings_goals where user_id = uid;
    for row_data in select value from jsonb_array_elements(p_backup->'goals')
    loop
      insert into public.savings_goals(user_id, id, name, target_amount, saved_amount, target_date, created_at, updated_at)
      values (uid, row_data->>'id', row_data->>'name',
        (row_data->>'targetAmount')::bigint, (row_data->>'savedAmount')::bigint,
        (row_data->>'targetDate')::date, (row_data->>'createdAt')::timestamptz,
        (row_data->>'updatedAt')::timestamptz);
    end loop;
  end if;

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

