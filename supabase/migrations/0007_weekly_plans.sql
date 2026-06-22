create table weekly_plans (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  week_start_date date not null,
  generated_reason text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(dog_id, week_start_date)
);

create table weekly_plan_items (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references weekly_plans(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  scheduled_date date not null,
  item_type text not null check (item_type in ('training', 'dog_moment', 'walk', 'bonding', 'care_note', 'rest')),
  title text not null,
  description text,
  skill_id uuid references training_skills(id),
  estimated_minutes integer,
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger weekly_plans_set_updated_at before update on weekly_plans for each row execute function set_updated_at();
create trigger weekly_plan_items_set_updated_at before update on weekly_plan_items for each row execute function set_updated_at();

alter table weekly_plans enable row level security;
alter table weekly_plan_items enable row level security;
create policy "weekly plans own read" on weekly_plans for select using (owner_id = auth.uid());
create policy "weekly items own read" on weekly_plan_items for select using (owns_dog(dog_id));

create or replace function generate_weekly_plan(target_dog_id uuid, week_start_date_value date, regenerate boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_row weekly_plans;
  dog_row dogs;
  skill_ids uuid[];
  i integer;
  item_date date;
  chosen_skill uuid;
  reason text;
begin
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;
  select * into dog_row from dogs where id = target_dog_id;
  reason := 'Built from ' || dog_row.obedience_level || ' obedience, ' || dog_row.energy_level || ' energy, selected goals, target skills, and recent training.';

  select array_agg(id order by preferred desc, difficulty asc, name asc) into skill_ids
  from (
    select ts.id, ts.difficulty, ts.name, exists(select 1 from dog_target_skills dts where dts.dog_id = target_dog_id and dts.skill_id = ts.id) as preferred
    from training_skills ts
    where ts.is_active
      and not exists(select 1 from dog_training_progress p where p.dog_id = target_dog_id and p.skill_id = ts.id and p.completion_percentage = 100)
  ) ranked;

  if regenerate then
    delete from weekly_plans where dog_id = target_dog_id and week_start_date = week_start_date_value;
  end if;

  insert into weekly_plans(dog_id, owner_id, week_start_date, generated_reason)
  values (target_dog_id, auth.uid(), week_start_date_value, reason)
  on conflict (dog_id, week_start_date) do update set generated_reason = excluded.generated_reason
  returning * into plan_row;

  if not exists(select 1 from weekly_plan_items where weekly_plan_id = plan_row.id) then
    for i in 0..6 loop
      item_date := week_start_date_value + i;
      chosen_skill := skill_ids[1 + (i % greatest(1, coalesce(array_length(skill_ids, 1), 1)))];
      insert into weekly_plan_items(weekly_plan_id, dog_id, scheduled_date, item_type, title, description, skill_id, estimated_minutes, sort_order)
      values
        (plan_row.id, target_dog_id, item_date, 'dog_moment', 'Save today''s Dog Moment', 'Keep the memory streak private and consistent.', null, 3, 1),
        (plan_row.id, target_dog_id, item_date, case when i in (2, 6) then 'rest' else 'training' end,
          case when i in (2, 6) then 'Light recovery day' else 'Practice a recommended skill' end,
          case when i in (2, 6) then 'Keep it easy today.' else 'Short, focused practice based on the current catalog.' end,
          case when i in (2, 6) then null else chosen_skill end,
          case when i in (2, 6) then 5 else 8 end,
          2);
      if exists(select 1 from dog_goals where dog_id = target_dog_id and goal_key = 'more_outdoor_time') and i in (1, 4) then
        insert into weekly_plan_items(weekly_plan_id, dog_id, scheduled_date, item_type, title, description, estimated_minutes, sort_order)
        values (plan_row.id, target_dog_id, item_date, 'walk', 'Outdoor time', 'A comfortable walk that respects your dog''s energy.', 15, 3);
      elsif i in (1, 4) then
        insert into weekly_plan_items(weekly_plan_id, dog_id, scheduled_date, item_type, title, description, estimated_minutes, sort_order)
        values (plan_row.id, target_dog_id, item_date, 'bonding', 'Focused bonding time', 'A calm owner-led moment without distractions.', 10, 3);
      end if;
    end loop;
  end if;

  perform write_audit_log('weekly_plan_generated', target_dog_id, 'weekly_plan', plan_row.id, jsonb_build_object('regenerate', regenerate));
  return jsonb_build_object(
    'plan', to_jsonb(plan_row),
    'items', (select coalesce(jsonb_agg(to_jsonb(wpi) order by scheduled_date, sort_order), '[]'::jsonb) from weekly_plan_items wpi where wpi.weekly_plan_id = plan_row.id)
  );
end;
$$;

create or replace function complete_weekly_plan_item(target_item_id uuid)
returns weekly_plan_items
language plpgsql
security definer
set search_path = public
as $$
declare
  item weekly_plan_items;
begin
  select * into item from weekly_plan_items where id = target_item_id;
  if item.id is null or not owns_dog(item.dog_id) then raise exception 'Weekly plan item not found'; end if;
  if item.status = 'completed' then return item; end if;
  update weekly_plan_items set status = 'completed' where id = item.id returning * into item;
  perform write_audit_log('weekly_plan_item_completed', item.dog_id, 'weekly_plan_item', item.id, '{}'::jsonb);
  return item;
end;
$$;
