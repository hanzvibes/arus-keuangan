-- Normalize production privilege drift caused by broad default table grants.
-- The cleanup queue is intentionally write-only for authenticated users.
revoke all privileges on table public.receipt_photo_cleanup from authenticated;
grant insert on table public.receipt_photo_cleanup to authenticated;
