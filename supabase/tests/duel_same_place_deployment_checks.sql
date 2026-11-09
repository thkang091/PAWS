-- Read-only post-deployment checks for the reviewed Same place migration.
-- Run only against the intended PAWS project (ytitmpodghiehzlmrhte).
-- This file creates no fixtures and invokes no state-changing room RPCs.

-- All three rows should exist and have RLS enabled.
with expected(schema_name, table_name) as (values
  ('public', 'duel_rooms'), ('public', 'duel_room_players'),
  ('private', 'duel_create_requests')
)
select e.schema_name, e.table_name, c.oid is not null as exists,
  coalesce(c.relrowsecurity, false) as rls_enabled,
  case when c.oid is not null then has_table_privilege('authenticated', c.oid, 'SELECT') end as authenticated_select,
  case when c.oid is not null then has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE') end as authenticated_any_direct_write,
  case when c.oid is not null then has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') end as anon_any_access
from expected e
left join pg_namespace n on n.nspname = e.schema_name
left join pg_class c on c.relnamespace = n.oid and c.relname = e.table_name
order by e.schema_name, e.table_name;

-- Expect exactly the two member-only SELECT policies, no write policies.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in ('duel_rooms', 'duel_room_players'))
   or (schemaname = 'private' and tablename = 'duel_create_requests')
order by schemaname, tablename, policyname;

-- All nine public RPCs should exist as JSONB invokers with an empty search path.
-- authenticated_execute=true; anon_execute=false; public_execute=false.
with expected(signature) as (values
  ('public.create_duel_room(uuid,uuid)'), ('public.join_duel_room(text,uuid)'),
  ('public.get_duel_room(uuid)'), ('public.set_duel_ready(uuid,boolean)'),
  ('public.select_duel_game(uuid,text)'), ('public.start_duel_room(uuid)'),
  ('public.leave_duel_room(uuid)'), ('public.reset_duel_round(uuid)'),
  ('public.heartbeat_duel_room(uuid)')
)
select e.signature, p.oid is not null as exists,
  not p.prosecdef as security_invoker, p.prorettype = 'jsonb'::regtype as returns_jsonb,
  p.proconfig as function_settings,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_execute
from expected e left join pg_proc p on p.oid = to_regprocedure(e.signature)
order by e.signature;

-- Definer helpers remain private. Snapshot must not be executable by clients.
select p.oid::regprocedure::text as signature, p.prosecdef as security_definer,
  p.proconfig as function_settings,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private' and p.proname in ('duel_is_member', 'duel_snapshot', 'duel_room_action')
order by p.proname;

-- Require the room primary key, unique code/idempotency keys, member primary
-- key, unique (room_id, slot), and slot IN (1,2) / phase constraints.
select n.nspname as schema_name, c.relname as table_name,
  k.conname as constraint_name, k.contype as constraint_type,
  pg_get_constraintdef(k.oid) as definition
from pg_constraint k join pg_class c on c.oid = k.conrelid
join pg_namespace n on n.oid = c.relnamespace
where (n.nspname = 'public' and c.relname in ('duel_rooms', 'duel_room_players'))
   or (n.nspname = 'private' and c.relname = 'duel_create_requests')
order by n.nspname, c.relname, k.conname;

-- Both flags must be true for the actual Realtime path. A false publication
-- flag must be investigated even though the app has a polling fallback.
select exists (select 1 from pg_publication where pubname = 'supabase_realtime' and pubupdate)
    as realtime_publishes_updates,
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'duel_rooms') as room_is_published;

-- Metadata only: verify the expected underlying dog identity columns.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'dogs'
  and column_name in ('id', 'owner_id', 'name')
order by column_name;
