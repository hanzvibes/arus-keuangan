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
