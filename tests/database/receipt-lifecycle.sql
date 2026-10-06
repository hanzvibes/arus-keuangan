-- Run after tests/database/receipts.sql in the same isolated database.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';

update public.transaction_receipts
set photo_path = '33333333-3333-4333-8333-333333333333/lifecycle-test.jpg'
where user_id = auth.uid()
  and transaction_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

do $$
declare deletion text;
begin
  deletion := public.arus_delete_transaction('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  if deletion <> 'deleted' then raise exception 'receipt transaction delete returned %', deletion; end if;

  if exists(
    select 1 from public.transactions
    where user_id = auth.uid()
      and id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  ) then
    raise exception 'transaction survived atomic receipt delete';
  end if;

  if exists(
    select 1 from public.transaction_receipts
    where user_id = auth.uid()
      and transaction_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  ) then
    raise exception 'receipt metadata survived atomic transaction delete';
  end if;

  if exists(
    select 1 from public.receipt_scans
    where user_id = auth.uid()
      and id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) then
    raise exception 'receipt scan survived atomic transaction delete';
  end if;
end; $$;

insert into public.transactions(user_id,id,type,amount,account_id,to_account_id,category,note,date)
values(auth.uid(),'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','adjustment',1000,'wallet',null,'Penyesuaian','Guard delete','2026-10-02');

do $$
declare deletion text;
begin
  deletion := public.arus_delete_transaction('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  if deletion <> 'adjustment' then raise exception 'adjustment delete guard returned %', deletion; end if;
  if not exists(
    select 1 from public.transactions
    where user_id = auth.uid()
      and id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  ) then
    raise exception 'adjustment was deleted';
  end if;
end; $$;

set request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
do $$
declare deletion text;
begin
  deletion := public.arus_delete_transaction('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  if deletion <> 'missing' then raise exception 'cross-user delete exposed transaction: %', deletion; end if;
end; $$;

reset role;

do $$
begin
  if not exists(
    select 1 from public.receipt_photo_cleanup
    where user_id = '33333333-3333-4333-8333-333333333333'
      and photo_path = '33333333-3333-4333-8333-333333333333/lifecycle-test.jpg'
  ) then
    raise exception 'receipt photo cleanup was not queued';
  end if;

  if not exists(
    select 1 from public.transactions
    where user_id = '33333333-3333-4333-8333-333333333333'
      and id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  ) then
    raise exception 'cross-user delete removed another user transaction';
  end if;
end; $$;
