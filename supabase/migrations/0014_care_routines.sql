create table dog_care_routines (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  routine_key text not null,
  title text not null,
  description text not null,
  icon_key text not null,
  silver_reward integer not null default 5 check (silver_reward >= 5 and silver_reward <= 10),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(dog_id, routine_key)
);

create table dog_care_routine_completions (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references dog_care_routines(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  completion_date date not null,
  silver_awarded integer not null default 0,
  idempotency_key text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  unique(routine_id, completion_date)
);

create index dog_care_routines_owner_idx on dog_care_routines(owner_id, dog_id, is_active);
create index dog_care_routine_completions_owner_idx on dog_care_routine_completions(owner_id, dog_id, completion_date desc);

create trigger dog_care_routines_set_updated_at before update on dog_care_routines
for each row execute function set_updated_at();

alter table dog_care_routines enable row level security;
alter table dog_care_routine_completions enable row level security;

create policy "care routines own all"
on dog_care_routines for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid() and owns_dog(dog_id));

create policy "care routine completions own read"
on dog_care_routine_completions for select
using (owner_id = auth.uid());

create or replace function complete_dog_care_routine(
  target_routine_id uuid,
  completion_date_value date,
  request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  routine dog_care_routines;
  completion dog_care_routine_completions;
begin
  if request_key is null or length(trim(request_key)) < 8 then
    raise exception 'Missing idempotency key';
  end if;

  select * into routine
  from dog_care_routines
  where id = target_routine_id and owner_id = auth.uid() and is_active = true;

  if routine.id is null then
    perform write_audit_log('quest_reward_rejected', null, 'care_routine', target_routine_id, jsonb_build_object('reason', 'routine_unavailable'));
    raise exception 'Care routine unavailable';
  end if;

  if exists(select 1 from dog_care_routine_completions where idempotency_key = request_key) then
    select * into completion from dog_care_routine_completions where idempotency_key = request_key;
    return jsonb_build_object('completion', to_jsonb(completion), 'silver_earned', 0, 'already_completed', true);
  end if;

  if exists(select 1 from dog_care_routine_completions where routine_id = target_routine_id and completion_date = completion_date_value) then
    select * into completion
    from dog_care_routine_completions
    where routine_id = target_routine_id and completion_date = completion_date_value;
    return jsonb_build_object('completion', to_jsonb(completion), 'silver_earned', 0, 'already_completed', true);
  end if;

  if routine.silver_reward > 0 then
    perform reserve_daily_silver(routine.dog_id, routine.silver_reward, completion_date_value);
  end if;

  insert into dog_care_routine_completions(routine_id, dog_id, owner_id, completion_date, silver_awarded, idempotency_key)
  values (routine.id, routine.dog_id, auth.uid(), completion_date_value, routine.silver_reward, request_key)
  returning * into completion;

  if routine.silver_reward > 0 then
    insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
    values (auth.uid(), routine.dog_id, 'silver', routine.silver_reward, 'care_routine', 'care_routine', routine.id, request_key || ':silver');
  end if;

  insert into daily_routine_logs(user_id, dog_id, routine_type, verification_id, completion_method, notes, metadata)
  values (auth.uid(), routine.dog_id, routine.routine_key, null, 'USER_CONFIRMATION', null, jsonb_build_object('routine_id', routine.id, 'source', 'care_page'));

  perform write_audit_log('quest_completed', routine.dog_id, 'care_routine', routine.id, jsonb_build_object('silver', routine.silver_reward));

  return jsonb_build_object('completion', to_jsonb(completion), 'silver_earned', routine.silver_reward, 'already_completed', false);
end;
$$;
