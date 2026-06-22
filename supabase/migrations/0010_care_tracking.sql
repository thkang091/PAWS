create table care_event_recurrences (
  id uuid primary key default gen_random_uuid(),
  care_event_id uuid not null references care_events(id) on delete cascade,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  interval_count integer not null default 1,
  ends_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table dog_weight_logs (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  weight_value numeric not null,
  weight_unit text not null default 'lb' check (weight_unit in ('lb', 'kg')),
  recorded_at timestamptz not null,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table care_events
  add column if not exists duration_minutes integer,
  add column if not exists note text,
  add column if not exists attachment_path text;

create trigger care_event_recurrences_set_updated_at before update on care_event_recurrences for each row execute function set_updated_at();
create trigger dog_weight_logs_set_updated_at before update on dog_weight_logs for each row execute function set_updated_at();

alter table care_event_recurrences enable row level security;
alter table dog_weight_logs enable row level security;
create policy "care recurrences own read" on care_event_recurrences for select using (exists(select 1 from care_events ce where ce.id = care_event_id and ce.owner_id = auth.uid()));
create policy "weight logs own all" on dog_weight_logs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid() and owns_dog(dog_id));
