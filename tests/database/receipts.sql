-- Run in an isolated Supabase test database after receipt migration. Never run against production.
insert into auth.users(id,email) values
('33333333-3333-4333-8333-333333333333','receipt-a@example.test'),
('44444444-4444-4444-8444-444444444444','receipt-b@example.test');
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
insert into public.accounts(user_id,id,name,kind,opening_balance) values(auth.uid(),'wallet','Wallet','cash',100000);
insert into public.receipt_scans(user_id,id,status,draft,image_hash,visual_hash) values
(auth.uid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','review',null,repeat('a',64),repeat('1',16)),
(auth.uid(),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','review',null,repeat('a',64),repeat('1',16));
do $$
declare d jsonb := '{"merchant":{"value":"Toko A"},"date":{"value":"2026-10-02"},"total":{"value":25000},"category":{"value":"Belanja"},"note":"Struk tes","items":[]}'::jsonb;
  first jsonb; second jsonb; confirmed jsonb;
begin
  first := public.arus_finalize_receipt('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','wallet',d,null,null);
  if first->>'transactionId' <> 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' then raise exception 'first finalize failed: %',first; end if;
  second := public.arus_finalize_receipt('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','wallet',d,null,null);
  if second->>'duplicate' <> 'true' then raise exception 'duplicate was not detected: %',second; end if;
  confirmed := public.arus_finalize_receipt('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','wallet',d,second->>'token',null);
  if confirmed->>'transactionId' <> 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' then raise exception 'override failed: %',confirmed; end if;
  if (select count(*) from public.transactions where category='Belanja') <> 2 then raise exception 'wrong transaction count'; end if;
  if (select count(*) from public.transaction_receipts) <> 2 then raise exception 'wrong receipt count'; end if;
  if (public.arus_update_receipt('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'wallet',d,null)->>'error') <> 'stale' then raise exception 'stale edit was accepted'; end if;
end; $$;
set request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
do $$
begin
  if exists(select 1 from public.receipt_scans) or exists(select 1 from public.transaction_receipts) then raise exception 'cross-user receipt read allowed'; end if;
  begin
    insert into public.receipt_scans(user_id,id,status) values('33333333-3333-4333-8333-333333333333','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','review');
    raise exception 'cross-user write allowed';
  exception when insufficient_privilege then null;
  end;
end; $$;
reset role;
set role anon;
do $$
begin
  begin
    perform count(*) from public.receipt_scans;
    raise exception 'anon scan read allowed';
  exception when insufficient_privilege then null;
  end;
end; $$;
reset role;
