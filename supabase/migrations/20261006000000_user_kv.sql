-- Account copies of the on-device PAWS stores (care log, check-ins, health record, medical facts, food plan, planned
-- walks, profile, set-up answers). One row per store per account. Each person can only see and change their own rows.
create table if not exists public.user_kv (
  owner_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (char_length(key) <= 80),
  value jsonb not null check (pg_column_size(value) < 2000000),
  updated_at timestamptz not null default now(),
  primary key (owner_id, key)
);

alter table public.user_kv enable row level security;

drop policy if exists user_kv_select_own on public.user_kv;
drop policy if exists user_kv_insert_own on public.user_kv;
drop policy if exists user_kv_update_own on public.user_kv;
drop policy if exists user_kv_delete_own on public.user_kv;

create policy user_kv_select_own on public.user_kv for select to authenticated using (owner_id = auth.uid());
create policy user_kv_insert_own on public.user_kv for insert to authenticated with check (owner_id = auth.uid());
create policy user_kv_update_own on public.user_kv for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy user_kv_delete_own on public.user_kv for delete to authenticated using (owner_id = auth.uid());

revoke all on public.user_kv from anon, public;
grant select, insert, update, delete on public.user_kv to authenticated;
