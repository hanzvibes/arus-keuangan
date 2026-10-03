-- Minimal Supabase Auth interface for isolated PostgreSQL integration tests.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;

-- Minimal Supabase Storage interface for compiling and exercising snapshot policies.
-- Production Storage tables are managed by Supabase, not by this application.
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  bucket_id text not null references storage.buckets(id),
  name text not null,
  primary key (bucket_id, name)
);
alter table storage.objects enable row level security;
create function storage.foldername(path text) returns text[] language sql immutable
as $$ select case when path like '%/%'
  then string_to_array(regexp_replace(path, '/[^/]*$', ''), '/')
  else array[]::text[] end $$;
grant usage on schema storage to authenticated, anon;
grant select, insert, update, delete on storage.objects to authenticated;
grant execute on function storage.foldername(text) to authenticated;
