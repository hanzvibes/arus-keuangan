-- Ensure an existing receipt bucket is corrected instead of silently keeping stale settings.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'arus-receipts',
  'arus-receipts',
  false,
  15000000,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
