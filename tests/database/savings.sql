-- Run only against an isolated test database, after either baseline+migration or snapshot.
insert into auth.users(id,email) values
('11111111-1111-4111-8111-111111111111','a@example.test'),
('22222222-2222-4222-8222-222222222222','b@example.test');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
insert into public.savings_goals(user_id,id,name,target_amount,saved_amount)
values(auth.uid(),'a_goal','A goal',1000,200);

do $$
declare old_stamp timestamptz; new_stamp timestamptz; affected integer;
begin
  select updated_at into old_stamp from public.savings_goals where id='a_goal';
  update public.savings_goals set saved_amount=300
    where id='a_goal' and updated_at=old_stamp returning updated_at into new_stamp;
  if new_stamp=old_stamp then raise exception 'timestamp did not advance'; end if;
  update public.savings_goals set saved_amount=400 where id='a_goal' and updated_at=old_stamp;
  get diagnostics affected = row_count;
  if affected<>0 then raise exception 'stale update overwrote progress'; end if;
  begin
    insert into public.savings_goals(user_id,id,name,target_amount)
    values('22222222-2222-4222-8222-222222222222','cross_user','Forbidden',100);
    raise exception 'cross-user insertion was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
insert into public.savings_goals(user_id,id,name,target_amount,saved_amount)
values(auth.uid(),'b_goal','B goal',2000,600);
do $$
declare affected integer;
begin
  if exists(select 1 from public.savings_goals where id='a_goal') then raise exception 'cross-user read allowed'; end if;
  update public.savings_goals set saved_amount=0 where id='a_goal';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'cross-user update allowed'; end if;
  delete from public.savings_goals where id='a_goal';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'cross-user delete allowed'; end if;
end;
$$;

set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select public.arus_restore_backup('{"version":2,"accounts":[],"transactions":[],"budgets":[],"categories":[],"recurring":[]}'::jsonb);
do $$
begin
  if (select saved_amount from public.savings_goals where id='a_goal')<>300 then raise exception 'legacy restore erased goals'; end if;
end;
$$;
select public.arus_restore_backup('{"version":3,"accounts":[],"transactions":[],"budgets":[],"categories":[],"recurring":[],"goals":[{"id":"restored","name":"Restored goal","targetAmount":1500,"savedAmount":500,"targetDate":null,"createdAt":"2026-09-30T00:00:00Z","updatedAt":"2026-09-30T00:00:00Z"}]}'::jsonb);
do $$
begin
  if exists(select 1 from public.savings_goals where id='a_goal') then raise exception 'v3 did not replace goals'; end if;
  if (select saved_amount from public.savings_goals where id='restored')<>500 then raise exception 'goal was not restored'; end if;
  begin
    perform public.arus_restore_backup('{"version":3,"goals":[{"id":"invalid","name":"Invalid","targetAmount":-1,"savedAmount":0,"targetDate":null,"createdAt":"2026-09-30T00:00:00Z","updatedAt":"2026-09-30T00:00:00Z"}]}'::jsonb);
    raise exception 'invalid restore unexpectedly succeeded';
  exception when check_violation then null;
  end;
  if not exists(select 1 from public.savings_goals where id='restored') then raise exception 'failed restore was not atomic'; end if;
end;
$$;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$
begin
  if (select saved_amount from public.savings_goals where id='b_goal')<>600 then raise exception 'restore changed another user'; end if;
end;
$$;
reset role;
set role anon;
do $$
begin
  begin
    perform count(*) from public.savings_goals;
    raise exception 'anonymous access allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
