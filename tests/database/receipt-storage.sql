-- Run only against the isolated snapshot database after bootstrap and arus.sql.
do $$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'arus-receipts' and not public and file_size_limit = 15000000
      and allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[]
  ) then raise exception 'private receipt bucket is missing or misconfigured'; end if;
end;
$$;

insert into storage.objects(bucket_id,name) values
  ('arus-receipts','11111111-1111-4111-8111-111111111111/receipt.jpg'),
  ('arus-receipts','22222222-2222-4222-8222-222222222222/receipt.jpg');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $$
declare affected integer;
begin
  if (select count(*) from storage.objects where bucket_id = 'arus-receipts') <> 1 then
    raise exception 'receipt photo read policy crossed user folders';
  end if;
  insert into storage.objects(bucket_id,name)
    values('arus-receipts','11111111-1111-4111-8111-111111111111/new.jpg');
  begin
    insert into storage.objects(bucket_id,name)
      values('arus-receipts','22222222-2222-4222-8222-222222222222/forbidden.jpg');
    raise exception 'cross-user receipt photo insertion was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update storage.objects set name = '22222222-2222-4222-8222-222222222222/moved.jpg'
      where name = '11111111-1111-4111-8111-111111111111/new.jpg';
    raise exception 'receipt photo moved to another user folder';
  exception when insufficient_privilege then null;
  end;
  delete from storage.objects where name = '22222222-2222-4222-8222-222222222222/receipt.jpg';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'cross-user receipt photo deletion was allowed'; end if;
end;
$$;
reset role;
