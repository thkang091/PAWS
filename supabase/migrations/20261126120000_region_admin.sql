-- PAWS phase 3A: what the road area admin screens need beyond phase 3.
--
--   updated_at                     "last updated" on the region list, bumped by any change to the region or its roads
--   organizer_regions()            the admin list with review counts per region (organizers only)
--   update_competition_region()    fix a draft's name, source, licence, attribution and notes
--   disable_competition_region()   take a draft or published region out of play
--   reopen_competition_region()    bring a disabled region back as a draft so it can be fixed and published again
--   publish_competition_region()   now also requires a draft, and refuses duplicate or looping verified roads
--
-- Nothing here lets players write regions or roads. Every function checks is_tournament_organizer().

alter table public.competition_regions add column if not exists updated_at timestamptz not null default timezone('utc', now());

create or replace function public.touch_competition_region()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists competition_regions_touch on public.competition_regions;
create trigger competition_regions_touch before update on public.competition_regions
  for each row execute function public.touch_competition_region();

-- Imports and reviews count as changes to the region. Statement level, so a 2000-road import updates the region once.
create or replace function public.touch_regions_from_roads()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update competition_regions set updated_at = timezone('utc', now()) where id in (select distinct region_id from changed);
  return null;
end;
$$;
revoke execute on function public.touch_regions_from_roads() from public, anon, authenticated;
revoke execute on function public.touch_competition_region() from public, anon, authenticated;

drop trigger if exists road_edges_touch_insert on public.road_edges;
create trigger road_edges_touch_insert after insert on public.road_edges
  referencing new table as changed for each statement execute function public.touch_regions_from_roads();
drop trigger if exists road_edges_touch_update on public.road_edges;
create trigger road_edges_touch_update after update on public.road_edges
  referencing new table as changed for each statement execute function public.touch_regions_from_roads();

-- The admin list: every region with how far its review has got.
create or replace function public.organizer_regions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  return (
    select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x."updatedAt" desc), '[]'::jsonb)
    from (
      select r.id, r.name, r.status, r.source, r.license, r.attribution, r.notes,
        r.center_lat as latitude, r.center_lng as longitude,
        r.created_at as "createdAt", r.updated_at as "updatedAt", r.published_at as "publishedAt",
        jsonb_build_object(
          'total', count(e.id),
          'pending', count(e.id) filter (where e.status = 'pending'),
          'verified', count(e.id) filter (where e.status = 'verified'),
          'unsafe', count(e.id) filter (where e.status = 'unsafe'),
          'disabled', count(e.id) filter (where e.status = 'disabled')
        ) as roads
      from competition_regions r
      left join road_edges e on e.region_id = r.id
      group by r.id
    ) x
  );
end;
$$;

create or replace function public.update_competition_region(p_region_id uuid, p_name text, p_source text, p_license text, p_attribution text, p_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  update competition_regions set
    name = btrim(p_name),
    source = btrim(coalesce(p_source, '')),
    license = btrim(coalesce(p_license, '')),
    attribution = btrim(coalesce(p_attribution, '')),
    notes = btrim(coalesce(p_notes, ''))
  where id = p_region_id and status = 'draft';
  if not found then raise exception 'region_not_draft'; end if;
end;
$$;

-- Out of play. Open rooms that picked it lose the pick; a match being played on it must finish first.
create or replace function public.disable_competition_region(p_region_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_region competition_regions;
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  select * into v_region from competition_regions where id = p_region_id for update;
  if v_region.id is null then raise exception 'region_not_found'; end if;
  if v_region.status = 'disabled' then return; end if;
  if exists (select 1 from battle_matches where region_id = p_region_id and status in ('preparing', 'countdown', 'active', 'finalizing')) then
    raise exception 'region_in_use';
  end if;
  update competition_regions set status = 'disabled' where id = p_region_id;
  update multiplayer_rooms set region_id = null where region_id = p_region_id and status = 'open';
end;
$$;

-- Back to draft, keeping every review. The boundary is cleared so publishing draws it again from verified roads.
create or replace function public.reopen_competition_region(p_region_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  update competition_regions set status = 'draft', published_at = null, boundary = null where id = p_region_id and status = 'disabled';
  if not found then raise exception 'region_not_disabled'; end if;
end;
$$;

-- Same as phase 3, plus: only drafts publish, and verified roads must not repeat or loop onto one junction.
create or replace function public.publish_competition_region(p_region_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_region competition_regions;
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  select * into v_region from competition_regions where id = p_region_id for update;
  if v_region.id is null then raise exception 'region_not_found'; end if;
  if v_region.status <> 'draft' then raise exception 'region_not_draft'; end if;
  if btrim(v_region.source) = '' or btrim(v_region.license) = '' then raise exception 'source_and_license_required'; end if;
  if exists (select 1 from road_edges where region_id = p_region_id and status = 'pending') then raise exception 'roads_not_reviewed'; end if;
  if (select count(*) from road_edges where region_id = p_region_id and status = 'verified') < 3 then raise exception 'too_few_verified_roads'; end if;
  if exists (
    select 1 from road_edges a join road_edges b on b.region_id = a.region_id and a.id < b.id
    where a.region_id = p_region_id and a.status = 'verified' and b.status = 'verified' and st_equals(a.geom, b.geom)
  ) then raise exception 'duplicate_roads'; end if;
  if exists (select 1 from road_edges where region_id = p_region_id and status = 'verified' and start_node_id = end_node_id) then
    raise exception 'road_loops';
  end if;
  update competition_regions set status = 'published', published_at = timezone('utc', now()),
    boundary = coalesce(boundary, (select st_convexhull(st_buffer(st_collect(geom)::geography, 50)::extensions.geometry) from road_edges where region_id = p_region_id and status = 'verified'))
  where id = p_region_id;
end;
$$;

revoke execute on function public.organizer_regions() from anon;
revoke execute on function public.update_competition_region(uuid, text, text, text, text, text) from anon;
revoke execute on function public.disable_competition_region(uuid) from anon;
revoke execute on function public.reopen_competition_region(uuid) from anon;
revoke execute on function public.publish_competition_region(uuid) from anon;
