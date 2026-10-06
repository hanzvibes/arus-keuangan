-- Keep receipt photo cleanup compatible with the authenticated role.
-- ON CONFLICT requires privileges the cleanup queue intentionally does not expose,
-- so duplicate queue entries are ignored with a local unique-violation handler instead.
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
