-- PAWS phase 2.5B: playing Follow the Shape on a generated walking route.
--
--   A walk starts from a route the player picked (shape_route_assignments, phase 2.5A) and is linked to it.
--   The official score combines the shape match with how much of the route was walked, in order
--   (supabase/functions/tournament/routeScore.ts, "shape-route-score-v1").
--   Players choose their shape, so leaderboards compare within a difficulty tier (the shape's own difficulty).

alter table public.shape_submissions add column if not exists shape_key text references public.shape_presets(key);
alter table public.shape_submissions add column if not exists tier text check (tier is null or tier in ('easy', 'medium', 'hard'));
alter table public.shape_submissions add column if not exists assignment_id uuid references public.shape_route_assignments(id) on delete set null;
alter table public.shape_submissions add column if not exists similarity numeric(4, 1) check (similarity is null or similarity between 0 and 100);
alter table public.shape_submissions add column if not exists route_completion numeric(5, 3) check (route_completion is null or route_completion between 0 and 1);
alter table public.shape_submissions add column if not exists route_progression numeric(5, 3) check (route_progression is null or route_progression between 0 and 1);
alter table public.shape_submissions add column if not exists scoring_version text;
create index if not exists shape_submissions_tier_idx on public.shape_submissions (tournament_id, tier, score desc, submitted_at asc);

-- The route of an assignment, step by step in walking order, each step's coordinates already turned to the
-- direction walked. Readable by its owner, and by the service role for scoring.
create or replace function public.assignment_route(p_assignment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_a shape_route_assignments;
  v_c shape_route_candidates;
  v_r shape_route_requests;
begin
  select * into v_a from shape_route_assignments where id = p_assignment_id;
  if v_a.id is null then raise exception 'route_not_found'; end if;
  if auth.uid() is not null and v_a.user_id <> auth.uid() then raise exception 'not_your_route'; end if;
  select * into v_c from shape_route_candidates where id = v_a.candidate_id;
  select * into v_r from shape_route_requests where id = v_c.request_id;
  return jsonb_build_object(
    'assignmentId', v_a.id, 'status', v_a.status, 'tournamentId', v_a.tournament_id, 'sessionId', v_a.session_id,
    'shapeKey', v_r.shape_key, 'minutes', v_c.minutes, 'lengthM', v_c.length_m, 'loop', v_c."loop", 'shapeScore', v_c.shape_score,
    'legs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'edgeId', e.id, 'lengthM', e.length_m,
        'coords', (st_asgeojson(case when s.fwd then e.geom else st_reverse(e.geom) end, 7)::jsonb) -> 'coordinates') order by s.ord)
      from unnest(v_c.edge_ids, v_c.forward) with ordinality as s(edge_id, fwd, ord)
      join road_edges e on e.id = s.edge_id), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.assignment_route(uuid) from anon;

-- Links a starting walk to the player's picked route. Service role only (the tournament function's start action).
create or replace function public.link_route_session(p_assignment_id uuid, p_session_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a shape_route_assignments;
  v_s gps_sessions;
begin
  select * into v_a from shape_route_assignments where id = p_assignment_id for update;
  if v_a.id is null or v_a.user_id <> p_user_id then raise exception 'not_your_route'; end if;
  if v_a.status not in ('assigned', 'walking') then raise exception 'route_closed'; end if;
  select * into v_s from gps_sessions where id = p_session_id;
  if v_s.id is null or v_s.user_id <> p_user_id then raise exception 'session_not_found'; end if;
  if v_a.tournament_id is not null and v_a.tournament_id <> v_s.tournament_id then raise exception 'wrong_tournament'; end if;
  if v_a.session_id is not null and v_a.session_id <> p_session_id then raise exception 'route_in_use'; end if;
  update shape_route_assignments set session_id = p_session_id, status = 'walking', tournament_id = v_s.tournament_id where id = v_a.id;
end;
$$;
revoke execute on function public.link_route_session(uuid, uuid, uuid) from public, anon, authenticated;

-- Records an official route walk. Service role only, after the tournament function has scored it.
create or replace function public.record_shape_route_submission(
  p_session_id uuid,
  p_similarity numeric,
  p_completion numeric,
  p_progression numeric,
  p_score numeric,
  p_frechet double precision,
  p_route jsonb,
  p_target jsonb,
  p_distance_m double precision,
  p_elapsed_seconds integer,
  p_scoring_version text
)
returns public.shape_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session gps_sessions;
  v_challenge shape_challenges;
  v_a shape_route_assignments;
  v_shape shape_presets;
  v_row shape_submissions;
begin
  select * into v_row from shape_submissions where session_id = p_session_id;
  if v_row.id is not null then return v_row; end if;
  select * into v_session from gps_sessions where id = p_session_id for update;
  if v_session.id is null then raise exception 'session_not_found'; end if;
  if v_session.status not in ('active', 'paused') then raise exception 'session_closed'; end if;
  select * into v_challenge from shape_challenges where tournament_id = v_session.tournament_id;
  if v_challenge.id is null then raise exception 'no_challenge'; end if;
  select * into v_a from shape_route_assignments where session_id = p_session_id and user_id = v_session.user_id and status = 'walking' for update;
  if v_a.id is null then raise exception 'route_required'; end if;
  select p.* into v_shape from shape_route_candidates c join shape_route_requests r on r.id = c.request_id join shape_presets p on p.key = r.shape_key where c.id = v_a.candidate_id;

  insert into shape_submissions (challenge_id, tournament_id, session_id, user_id, dog_id, score, frechet, algorithm_version,
    route_normalized, target_normalized, distance_m, elapsed_seconds,
    shape_key, tier, assignment_id, similarity, route_completion, route_progression, scoring_version)
  values (v_challenge.id, v_session.tournament_id, v_session.id, v_session.user_id, v_session.dog_id, p_score, p_frechet, 'frechet-v1',
    p_route, p_target, p_distance_m, p_elapsed_seconds,
    v_shape.key, v_shape.difficulty, v_a.id, p_similarity, p_completion, p_progression, p_scoring_version)
  returning * into v_row;

  update gps_sessions set status = 'submitted', ended_at = timezone('utc', now()), total_distance_m = p_distance_m,
    elapsed_seconds = p_elapsed_seconds, validation_status = 'valid'
  where id = v_session.id;
  update shape_route_assignments set status = 'completed', completed_at = timezone('utc', now()) where id = v_a.id;
  return v_row;
end;
$$;
revoke execute on function public.record_shape_route_submission(uuid, numeric, numeric, numeric, numeric, double precision, jsonb, jsonb, double precision, integer, text) from public, anon, authenticated;
