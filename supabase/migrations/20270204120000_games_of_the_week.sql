-- Best of the week: every game ranked by how much it was played this week. Only totals leave the database
-- (plays, players, minutes, players who came back); never who played, where, or what they scored.
--
-- A play is one player in one session: a solo challenge attempt, a tournament walk, a place in a battle, a Find the
-- Mafia round or a Number Trail race, a Photo Pose entry, an arena attempt. Minutes come from the session's own clock
-- where it has one. Arena tables are optional (not every project has them yet).

create or replace function public.games_of_the_week(p_since timestamptz default null, p_limit integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz := coalesce(p_since, date_trunc('week', now()));
  v_sql text;
  v_out jsonb;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  -- No reaching back further than a month: this is a weekly board, not a history.
  if v_since < now() - interval '35 days' then v_since := now() - interval '35 days'; end if;

  v_sql := $q$
    select 'challenge:' || a.challenge_game_id::text as game, a.owner_id as user_id, null::numeric as minutes
      from challenge_game_attempts a where a.created_at >= $1
    union all
    select t.game_type::text, s.user_id,
           coalesce(s.elapsed_seconds, extract(epoch from (s.ended_at - s.started_at)))::numeric / 60
      from gps_sessions s join tournaments t on t.id = s.tournament_id
      where s.started_at >= $1 and s.status <> 'cancelled'
    union all
    select m.game_type, tm.user_id, m.duration_minutes::numeric
      from battle_matches m join battle_team_members tm on tm.match_id = m.id
      where m.starts_at >= $1 and m.status <> 'cancelled'
    union all
    select 'find_mafia', ra.user_id, extract(epoch from (coalesce(r.finished_at, r.voting_ends_at) - r.started_at))::numeric / 60
      from mafia_rounds r join mafia_role_assignments ra on ra.round_id = r.id
      where r.started_at >= $1 and r.status <> 'cancelled'
    union all
    select 'number_trail', na.user_id, extract(epoch from (coalesce(nm.completed_at, nm.ends_at) - nm.starts_at))::numeric / 60
      from number_trail_matches nm join number_trail_assignments na on na.match_id = nm.id
      where nm.starts_at >= $1 and nm.status <> 'cancelled'
    union all
    select 'photo_pose', ms.user_id, null::numeric
      from media_submissions ms where ms.submitted_at >= $1
  $q$;
  if to_regclass('public.arena_attempts') is not null then
    v_sql := v_sql || $q$
      union all
      select aa.game::text, aa.owner_id, aa.clip_ms::numeric / 60000
        from arena_attempts aa where aa.created_at >= $1
    $q$;
  end if;

  execute format($f$
    with plays as (%s),
    per_player as (select game, user_id, count(*) as n from plays group by game, user_id),
    ranked as (
      select p.game,
             count(*) as plays,
             count(distinct p.user_id) as players,
             round(coalesce(sum(greatest(p.minutes, 0)), 0))::integer as minutes,
             (select count(*) from per_player pp where pp.game = p.game and pp.n >= 2) as returning_players
        from plays p group by p.game
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'game', r.game,
             'title', cg.title,
             'plays', r.plays,
             'players', r.players,
             'minutes', r.minutes,
             'returningPlayers', r.returning_players
           ) order by r.plays desc, r.minutes desc, r.returning_players desc, r.game), '[]'::jsonb)
      from (select * from ranked order by plays desc, minutes desc, returning_players desc, game limit $2) r
      left join challenge_games cg on r.game = 'challenge:' || cg.id::text
  $f$, v_sql) into v_out using v_since, least(greatest(coalesce(p_limit, 5), 1), 20);

  return jsonb_build_object('since', v_since, 'games', v_out);
end;
$$;

revoke execute on function public.games_of_the_week(timestamptz, integer) from public, anon;
grant execute on function public.games_of_the_week(timestamptz, integer) to authenticated;
