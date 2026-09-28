create index if not exists recurring_user_account_idx
  on public.recurring (user_id, account_id);

create index if not exists recurring_user_to_account_idx
  on public.recurring (user_id, to_account_id)
  where to_account_id is not null;
