alter table public.dog_care_profile
  add column if not exists food_image_url text,
  add column if not exists food_kcal_per_100g numeric;

create table if not exists public.dog_food_rules (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'never' check (kind in ('allergy', 'intolerance', 'never', 'vet')),
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists dog_food_rules_dog_name_idx
  on public.dog_food_rules (dog_id, lower(name));

create table if not exists public.dog_food_checks (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  question text not null,
  food_name text,
  verdict text not null check (verdict in ('safe', 'caution', 'avoid', 'unknown')),
  headline text not null,
  answer text not null,
  had_photo boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists dog_food_checks_dog_created_idx
  on public.dog_food_checks (dog_id, created_at desc);

alter table public.dog_food_rules enable row level security;
alter table public.dog_food_checks enable row level security;

create policy dog_food_rules_select_own on public.dog_food_rules for select using (owns_dog(dog_id));
create policy dog_food_rules_insert_own on public.dog_food_rules for insert with check (owns_dog(dog_id) and owner_id = auth.uid());
create policy dog_food_rules_update_own on public.dog_food_rules for update using (owns_dog(dog_id));
create policy dog_food_rules_delete_own on public.dog_food_rules for delete using (owns_dog(dog_id));

create policy dog_food_checks_select_own on public.dog_food_checks for select using (owns_dog(dog_id));
create policy dog_food_checks_insert_own on public.dog_food_checks for insert with check (owns_dog(dog_id) and owner_id = auth.uid());
create policy dog_food_checks_delete_own on public.dog_food_checks for delete using (owns_dog(dog_id));

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'dog_feeding_logs' and policyname = 'dog_feeding_logs_delete_own'
  ) then
    create policy dog_feeding_logs_delete_own on public.dog_feeding_logs for delete using (owns_dog(dog_id));
  end if;
end $$;

grant select, insert, update, delete on public.dog_food_rules to authenticated;
grant select, insert, delete on public.dog_food_checks to authenticated;
grant delete on public.dog_feeding_logs to authenticated;

alter table public.dog_care_profile
  add column if not exists meal_times text[],
  add column if not exists meal_portions integer[];

create table if not exists public.dog_treats (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  image_url text,
  kcal_each numeric,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists dog_treats_dog_name_idx on public.dog_treats (dog_id, lower(name));

alter table public.dog_treats enable row level security;

create policy dog_treats_select_own on public.dog_treats for select using (owns_dog(dog_id));
create policy dog_treats_insert_own on public.dog_treats for insert with check (owns_dog(dog_id) and owner_id = auth.uid());
create policy dog_treats_delete_own on public.dog_treats for delete using (owns_dog(dog_id));

grant select, insert, delete on public.dog_treats to authenticated;
