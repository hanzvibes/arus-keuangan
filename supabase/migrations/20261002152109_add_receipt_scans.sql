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
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('arus-receipts','arus-receipts',false,15000000,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
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
    insert into public.receipt_photo_cleanup(user_id,photo_path) values(old.user_id,old.photo_path)
      on conflict(user_id,photo_path) do nothing;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.photo_path is not null and old.photo_path is distinct from new.photo_path then
    insert into public.receipt_photo_cleanup(user_id,photo_path) values(old.user_id,old.photo_path)
      on conflict(user_id,photo_path) do nothing;
  end if;
  return new;
end; $$;
revoke all on function public.arus_queue_old_receipt_photo() from public,anon;
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

