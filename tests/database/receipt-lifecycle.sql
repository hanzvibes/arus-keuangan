-- Run after tests/database/receipts.sql in the same isolated database.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';

update public.transaction_receipts
set photo_path = '33333333-3333-4333-8333-333333333333/lifecycle-test.jpg'
where user_id = auth.uid()
  and transaction_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

delete from public.transactions
where user_id = auth.uid()
  and id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

do $$
begin
  if exists(
    select 1 from public.transaction_receipts
    where user_id = auth.uid()
      and transaction_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  ) then
    raise exception 'receipt metadata survived transaction delete';
  end if;

  if (
    select transaction_id from public.receipt_scans
    where user_id = auth.uid()
      and id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) is not null then
    raise exception 'receipt scan stayed linked to deleted transaction';
  end if;
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
end; $$;
