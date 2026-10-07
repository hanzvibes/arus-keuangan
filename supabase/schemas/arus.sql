-- Arus declarative application-schema snapshot.
-- Baseline originated from the live Supabase project on 2026-09-27.
-- Synchronized through migration 20261006152049_add_atomic_transaction_delete.
-- Supabase-managed Auth and Storage internals are not duplicated beyond Arus-owned bucket configuration and policies.

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
revoke all on function private.arus_handle_new_user() from public, anon, authenticated;

grant execute on function public.arus_next_occurrence(date,text,integer) to authenticated;
grant execute on function public.arus_rename_category(text,text) to authenticated;
grant execute on function public.arus_skip_recurring(text,date) to authenticated;
grant execute on function public.arus_record_recurring(text,date,date) to authenticated;
grant execute on function public.arus_reconcile_balance(text,bigint,bigint,text,date,text) to authenticated;

create trigger arus_create_profile_on_signup
  after insert on auth.users
  for each row execute function private.arus_handle_new_user();

-- Receipt scan migration snapshot.
-- Receipt drafts and final metadata are scoped to the authenticated owner.
create table public.receipt_scans (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (id ~ '^[0-9a-f-]{36}$'),
  status text not null check (status in ('processing','success','review','failed')),
  draft jsonb,
  image_hash text check (image_hash is null or image_hash ~ '^[0-9a-f]{64}$'),
  visual_hash text check (visual_hash is null or visual_hash ~ '^[0-9a-f]{16}$'),
  save_photo boolean not null default false,
  transaction_id text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, transaction_id),
  foreign key (user_id, transaction_id) references public.transactions(user_id,id) on delete set null (transaction_id)
);
create index receipt_scans_history_idx on public.receipt_scans(user_id, updated_at desc);
create index receipt_scans_image_idx on public.receipt_scans(user_id, image_hash) where image_hash is not null;
alter table public.receipt_scans enable row level security;
create policy receipt_scans_owner on public.receipt_scans for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.receipt_scans from public, anon;
grant select, insert, update, delete on public.receipt_scans to authenticated;

create table public.transaction_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id text not null,
  scan_id text,
  merchant text not null default '' check (char_length(merchant) <= 100),
  payment_method text not null default '' check (char_length(payment_method) <= 50),
  invoice text not null default '' check (char_length(invoice) <= 80),
  receipt_time text check (receipt_time is null or receipt_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  subtotal bigint, tax bigint, service bigint, discount bigint,
  items jsonb not null default '[]'::jsonb,
  fields jsonb not null default '{}'::jsonb,
  image_hash text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,transaction_id),
  foreign key(user_id,transaction_id) references public.transactions(user_id,id) on delete cascade,
  foreign key(user_id,scan_id) references public.receipt_scans(user_id,id) on delete set null (scan_id),
  check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 100),
  check (jsonb_typeof(fields) = 'object'),
  check (photo_path is null or photo_path like user_id::text || '/%')
);
create index transaction_receipts_merchant_idx on public.transaction_receipts(user_id, lower(merchant));
alter table public.transaction_receipts enable row level security;
create policy transaction_receipts_owner on public.transaction_receipts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.transaction_receipts from public, anon;
grant select, insert, update, delete on public.transaction_receipts to authenticated;

-- Storage object policies are deliberately path-scoped; client uploads only to its own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'arus-receipts',
  'arus-receipts',
  false,
  15000000,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create policy arus_receipt_photo_read on storage.objects for select to authenticated
  using (bucket_id = 'arus-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy arus_receipt_photo_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'arus-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy arus_receipt_photo_update on storage.objects for update to authenticated
  using (bucket_id = 'arus-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'arus-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy arus_receipt_photo_delete on storage.objects for delete to authenticated
  using (bucket_id = 'arus-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table public.receipt_photo_cleanup (
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_path text not null check (photo_path like user_id::text || '/%'),
  created_at timestamptz not null default now(),
  primary key(user_id,photo_path)
);
alter table public.receipt_photo_cleanup enable row level security;
create policy receipt_photo_cleanup_owner on public.receipt_photo_cleanup for insert to authenticated
  with check ((select auth.uid()) = user_id);
revoke all on public.receipt_photo_cleanup from public,anon;
grant insert on public.receipt_photo_cleanup to authenticated;
create or replace function public.arus_queue_old_receipt_photo() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' and old.photo_path is not null then
    begin
      insert into public.receipt_photo_cleanup(user_id, photo_path)
      values(old.user_id, old.photo_path);
    exception when unique_violation then
      null;
    end;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.photo_path is not null and old.photo_path is distinct from new.photo_path then
    begin
      insert into public.receipt_photo_cleanup(user_id, photo_path)
      values(old.user_id, old.photo_path);
    exception when unique_violation then
      null;
    end;
  end if;

  return new;
end;
$$;

revoke all on function public.arus_queue_old_receipt_photo() from public, anon;
grant execute on function public.arus_queue_old_receipt_photo() to authenticated;
create trigger arus_queue_receipt_photo after update or delete on public.transaction_receipts
for each row execute function public.arus_queue_old_receipt_photo();

create or replace function public.arus_finalize_receipt(p_scan_id text, p_expected_version integer,
  p_transaction_id text, p_account_id text, p_draft jsonb, p_duplicate_token text default null,
  p_photo_path text default null) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid()); scan_row public.receipt_scans%rowtype;
  possible_ids text; expected_token text; merchant_key text; receipt_date date;
  total_amount bigint; existing_type text;
begin
  if uid is null then raise exception 'authentication required'; end if;
  select * into scan_row from public.receipt_scans where user_id=uid and id=p_scan_id for update;
  if not found then return jsonb_build_object('error','missing'); end if;
  if scan_row.transaction_id is not null then return jsonb_build_object('transactionId',scan_row.transaction_id,'replayed',true); end if;
  if scan_row.version <> p_expected_version then return jsonb_build_object('error','stale'); end if;
  if p_draft->'total'->>'value' is null or p_draft->'date'->>'value' is null then return jsonb_build_object('error','invalid'); end if;
  total_amount := (p_draft->'total'->>'value')::bigint;
  receipt_date := (p_draft->'date'->>'value')::date;
  if total_amount <= 0 or total_amount > 1000000000000 or
    not exists(select 1 from public.accounts where user_id=uid and id=p_account_id) then
    return jsonb_build_object('error','invalid');
  end if;
  if p_photo_path is not null and p_photo_path not like uid::text || '/%' then return jsonb_build_object('error','invalid'); end if;
  merchant_key := regexp_replace(lower(coalesce(p_draft->'merchant'->>'value','')), '[^a-z0-9]', '', 'g');
  -- Serialize finalization per owner so a retaken photo cannot race a different image hash.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
  select string_agg(r.transaction_id,',' order by r.transaction_id) into possible_ids
    from public.transaction_receipts r join public.transactions t on t.user_id=r.user_id and t.id=r.transaction_id
    where r.user_id=uid and ((scan_row.image_hash is not null and r.image_hash=scan_row.image_hash) or
      (t.date=receipt_date and t.amount=total_amount and
       (regexp_replace(lower(r.merchant),'[^a-z0-9]','','g')=merchant_key or
        (coalesce(p_draft->'invoice'->>'value','') <> '' and r.invoice=p_draft->'invoice'->>'value'))));
  if possible_ids is not null then
    expected_token := md5(possible_ids || '|' || merchant_key || '|' || receipt_date::text || '|' || total_amount::text);
    if p_duplicate_token is distinct from expected_token then
      return jsonb_build_object('duplicate',true,'transactionIds',string_to_array(possible_ids,','),'token',expected_token);
    end if;
  end if;
  select type into existing_type from public.transactions where user_id=uid and id=p_transaction_id;
  if existing_type is not null then return jsonb_build_object('error','id_conflict'); end if;
  insert into public.transactions(user_id,id,type,amount,account_id,to_account_id,category,note,date)
    values(uid,p_transaction_id,'expense',total_amount,p_account_id,null,
      left(coalesce(p_draft->'category'->>'value','Lainnya'),50),
      left(coalesce(nullif(p_draft->>'note',''),p_draft->'merchant'->>'value','Struk'),150),receipt_date);
  insert into public.transaction_receipts(user_id,transaction_id,scan_id,merchant,payment_method,invoice,
    receipt_time,subtotal,tax,service,discount,items,fields,image_hash,photo_path)
    values(uid,p_transaction_id,p_scan_id,left(coalesce(p_draft->'merchant'->>'value',''),100),
      left(coalesce(p_draft->'paymentMethod'->>'value',''),50),left(coalesce(p_draft->'invoice'->>'value',''),80),
      nullif(p_draft->'time'->>'value',''),(p_draft->'subtotal'->>'value')::bigint,
      (p_draft->'tax'->>'value')::bigint,(p_draft->'service'->>'value')::bigint,
      (p_draft->'discount'->>'value')::bigint,coalesce(p_draft->'items','[]'::jsonb),
      p_draft-'rawText'-'items'-'warnings'-'note',scan_row.image_hash,p_photo_path);
  update public.receipt_scans set transaction_id=p_transaction_id,draft=p_draft,version=version+1,updated_at=clock_timestamp()
    where user_id=uid and id=p_scan_id;
  return jsonb_build_object('transactionId',p_transaction_id);
end; $$;
revoke all on function public.arus_finalize_receipt(text,integer,text,text,jsonb,text,text) from public,anon;
grant execute on function public.arus_finalize_receipt(text,integer,text,text,jsonb,text,text) to authenticated;

create or replace function public.arus_update_receipt(p_scan_id text, p_expected_version integer,
  p_account_id text, p_draft jsonb, p_photo_path text default null) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare uid uuid := (select auth.uid()); scan_row public.receipt_scans%rowtype;
  total_amount bigint; receipt_date date;
begin
  if uid is null then raise exception 'authentication required'; end if;
  select * into scan_row from public.receipt_scans where user_id=uid and id=p_scan_id for update;
  if not found or scan_row.transaction_id is null then return jsonb_build_object('error','missing'); end if;
  if scan_row.version <> p_expected_version then return jsonb_build_object('error','stale'); end if;
  if p_draft->'total'->>'value' is null or p_draft->'date'->>'value' is null then return jsonb_build_object('error','invalid'); end if;
  total_amount := (p_draft->'total'->>'value')::bigint;
  receipt_date := (p_draft->'date'->>'value')::date;
  if total_amount <= 0 or total_amount > 1000000000000 or
    not exists(select 1 from public.accounts where user_id=uid and id=p_account_id) then return jsonb_build_object('error','invalid'); end if;
  if p_photo_path is not null and p_photo_path not like uid::text || '/%' then return jsonb_build_object('error','invalid'); end if;
  update public.transactions set amount=total_amount,date=receipt_date,account_id=p_account_id,
    category=left(coalesce(p_draft->'category'->>'value','Lainnya'),50),
    note=left(coalesce(nullif(p_draft->>'note',''),p_draft->'merchant'->>'value','Struk'),150)
    where user_id=uid and id=scan_row.transaction_id and type='expense';
  if not found then return jsonb_build_object('error','missing'); end if;
  update public.transaction_receipts set merchant=left(coalesce(p_draft->'merchant'->>'value',''),100),
    payment_method=left(coalesce(p_draft->'paymentMethod'->>'value',''),50),
    invoice=left(coalesce(p_draft->'invoice'->>'value',''),80),receipt_time=nullif(p_draft->'time'->>'value',''),
    subtotal=(p_draft->'subtotal'->>'value')::bigint,tax=(p_draft->'tax'->>'value')::bigint,
    service=(p_draft->'service'->>'value')::bigint,discount=(p_draft->'discount'->>'value')::bigint,
    items=coalesce(p_draft->'items','[]'::jsonb),fields=p_draft-'rawText'-'items'-'warnings'-'note',
    photo_path=p_photo_path,updated_at=clock_timestamp()
    where user_id=uid and transaction_id=scan_row.transaction_id;
  if not found then return jsonb_build_object('error','missing'); end if;
  update public.receipt_scans set draft=p_draft,version=version+1,updated_at=clock_timestamp()
    where user_id=uid and id=p_scan_id;
  return jsonb_build_object('transactionId',scan_row.transaction_id);
end; $$;
revoke all on function public.arus_update_receipt(text,integer,text,jsonb,text) from public,anon;
grant execute on function public.arus_update_receipt(text,integer,text,jsonb,text) to authenticated;

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

  delete from public.receipt_scans where user_id = uid;
  delete from public.transaction_receipts where user_id = uid;
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

  if p_backup ? 'receipts' then
    for row_data in select value from jsonb_array_elements(p_backup->'receipts')
    loop
      insert into public.transaction_receipts(user_id,transaction_id,scan_id,merchant,payment_method,invoice,
        receipt_time,subtotal,tax,service,discount,items,fields,image_hash,photo_path)
      values(uid,row_data->>'transactionId',null,coalesce(row_data->>'merchant',''),
        coalesce(row_data->>'paymentMethod',''),coalesce(row_data->>'invoice',''),
        nullif(row_data->>'time',''),(row_data->>'subtotal')::bigint,(row_data->>'tax')::bigint,
        (row_data->>'service')::bigint,(row_data->>'discount')::bigint,
        coalesce(row_data->'items','[]'::jsonb),coalesce(row_data->'fields','{}'::jsonb),
        row_data->>'imageHash',null);
    end loop;
  end if;
  return jsonb_build_object(
    'accounts', account_count,
    'transactions', transaction_count,
    'budgets', budget_count
  );
end;
$$;

revoke all on function public.arus_restore_backup(jsonb) from public, anon;
grant execute on function public.arus_restore_backup(jsonb) to authenticated;

-- Receipt scan foreign key index migration snapshot.
create index transaction_receipts_scan_idx
  on public.transaction_receipts(user_id, scan_id);

-- Atomic receipt-backed transaction deletion.
create or replace function public.arus_delete_transaction(p_id text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  tx_type text;
  receipt_scan_id text;
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  select r.scan_id into receipt_scan_id
  from public.transaction_receipts r
  where r.user_id = uid and r.transaction_id = p_id;

  if receipt_scan_id is not null then
    perform 1
    from public.receipt_scans s
    where s.user_id = uid and s.id = receipt_scan_id
    for update;
  end if;

  select t.type into tx_type
  from public.transactions t
  where t.user_id = uid and t.id = p_id
  for update;

  if not found then
    return 'missing';
  end if;
  if tx_type = 'adjustment' then
    return 'adjustment';
  end if;

  delete from public.transactions
  where user_id = uid and id = p_id;

  if receipt_scan_id is not null then
    delete from public.receipt_scans
    where user_id = uid and id = receipt_scan_id;
  end if;

  return 'deleted';
end;
$$;

revoke all on function public.arus_delete_transaction(text) from public, anon;
grant execute on function public.arus_delete_transaction(text) to authenticated;
