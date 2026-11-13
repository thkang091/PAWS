-- Number Trail on any one number: nearby races may draw a single digit (0 to 9) when the streets draw it, and
-- practice accepts 0 (its check still said 1 to 99).

create or replace function public.number_record_course(
  p_match_id uuid,
  p_token uuid,
  p_course jsonb,
  p_summary jsonb,
  p_sources jsonb,
  p_fingerprint text,
  p_feasible integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match number_trail_matches;
  v_number text := p_course ->> 'number';
begin
  select * into v_match from number_trail_matches where id = p_match_id for update;
  if v_match.id is null or v_match.prepare_token is distinct from p_token or v_match.status <> 'preparing_routes' then raise exception 'stale_preparation'; end if;
  -- Two digits (00 to 99), or one (0 to 9): a race can go ahead on any one number the streets can draw.
  if v_number is null or v_number !~ '^[0-9]{1,2}$' then raise exception 'bad_number'; end if;
  if jsonb_array_length(coalesce(p_course -> 'digits', '[]'::jsonb)) <> char_length(v_number) then raise exception 'bad_course'; end if;
  if v_match.difficulty is not null and p_course ->> 'difficulty' is distinct from v_match.difficulty then raise exception 'wrong_difficulty'; end if;
  insert into number_trail_courses (match_id, target_number, course, summary, sources, network_fingerprint, feasible_count)
  values (p_match_id, v_number, p_course, coalesce(p_summary, '{}'::jsonb), coalesce(p_sources, '[]'::jsonb), p_fingerprint, p_feasible);
  update number_trail_matches set target_number = v_number, algorithm = p_course ->> 'algorithm', race_version = p_course ->> 'raceVersion',
    match_version = p_course ->> 'version', start_node_id = p_course -> 'start' ->> 'nodeId', network_source = p_summary ->> 'source', prepare_token = null
  where id = p_match_id;
  perform number_transition(p_match_id, 'ready');
  perform number_event(p_match_id, 'ROUTE_READY', null, jsonb_build_object(
    'number', v_number, 'minutes', v_match.minutes, 'difficulty', p_course ->> 'difficulty', 'raceM', (p_course ->> 'raceM')::numeric,
    'layout', p_course ->> 'layout', 'feasible', p_feasible));
  return jsonb_build_object('number', v_number);
end;
$$;

alter table public.number_practice_sessions drop constraint if exists number_practice_sessions_number_check;
alter table public.number_practice_sessions add constraint number_practice_sessions_number_check check (number ~ '^([0-9]|[1-9][0-9])$');
