-- A minimal stand-in for the parts of Supabase the PAWS migrations rely on, so they can run against a throwaway local
-- PostgreSQL + PostGIS cluster. TEST USE ONLY. Never run this against a Supabase project: Supabase already has all of
-- it, and the real objects are richer than these.
--
--   roles        anon, authenticated, service_role (no login), with Supabase's default grants on public
--   auth         users, uid(), role(), jwt(), read from the same request.jwt.* settings PostgREST sets
--   storage      buckets, objects, foldername()
--   realtime     messages, topic(), send(): send() stores the message, so tests can see what was broadcast
--   cron         schedule(), recorded only
--   extensions   pgcrypto and postgis live here, as on Supabase

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end;
$$;

create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists realtime;
create schema if not exists cron;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;

grant usage on schema public, extensions, auth, storage, realtime to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  phone text,
  is_anonymous boolean not null default false,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), auth.jwt() ->> 'sub')::uuid;
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.jwt() ->> 'role');
$$;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
-- As on Supabase: players reach storage tables through grants, and row level security decides what they see.
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;

create table if not exists realtime.messages (
  id bigserial primary key,
  topic text not null,
  extension text not null default 'broadcast',
  event text,
  payload jsonb,
  private boolean not null default true,
  inserted_at timestamptz not null default now()
);
alter table realtime.messages enable row level security;
grant select, insert on realtime.messages to anon, authenticated, service_role;
-- As on Supabase, inserting is a matter of row level security, not of the id sequence.
grant usage on sequence realtime.messages_id_seq to anon, authenticated, service_role;
create or replace function realtime.topic() returns text language sql stable as $$
  select nullif(current_setting('realtime.topic', true), '');
$$;
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void
language sql security definer as $$
  insert into realtime.messages (topic, event, payload, private) values (topic, event, payload, private);
$$;

create table if not exists cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command) returning jobid;
$$;
