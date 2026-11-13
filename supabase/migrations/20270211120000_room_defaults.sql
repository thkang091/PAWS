-- Room defaults, now that the room screen has no invite switch: a room's code always works, by QR or typed. The host
-- can still turn code joins off through set_room_options; nothing in the app does any more.

create or replace function public.create_room(
  p_game public.tournament_game,
  p_name text,
  p_max_players integer,
  p_team_mode boolean,
  p_start_delay_s integer,
  p_safety_ack boolean,
  p_dog_id uuid,
  p_display_name text,
  p_mode text default 'nearby'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room multiplayer_rooms;
  v_code text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not coalesce(p_safety_ack, false) then raise exception 'safety_not_acknowledged'; end if;
  if coalesce(p_mode, 'nearby') not in ('nearby', 'online') then raise exception 'bad_request'; end if;
  if p_mode = 'online' then p_game := 'number_trail'; end if;
  if p_dog_id is not null and not owns_dog(p_dog_id) then raise exception 'not_your_dog'; end if;
  if exists (
    select 1 from room_members m join multiplayer_rooms r on r.id = m.room_id
    where m.user_id = auth.uid() and m.left_at is null and r.status in ('open', 'playing') and r.expires_at > now()
  ) then raise exception 'already_in_room'; end if;

  for i in 1..8 loop
    v_code := make_room_code();
    begin
      insert into multiplayer_rooms (game_type, name, host_id, max_players, team_mode, start_delay_s, code, safety_ack_at, remote_invite, play_mode)
      values (p_game, btrim(p_name), auth.uid(), p_max_players, coalesce(p_team_mode, false), coalesce(p_start_delay_s, 10), v_code, timezone('utc', now()), true, coalesce(p_mode, 'nearby'))
      returning * into v_room;
      exit;
    exception when unique_violation then
      v_room := null;
    end;
  end loop;
  if v_room.id is null then raise exception 'code_unavailable'; end if;

  insert into room_members (room_id, user_id, dog_id, display_name, ready)
  values (v_room.id, auth.uid(), p_dog_id, left(btrim(p_display_name), 40), true);
  return jsonb_build_object('roomId', v_room.id, 'code', v_room.code) || issue_room_invite(v_room.id);
end;
$$;

update public.multiplayer_rooms set remote_invite = true where status = 'open' and not remote_invite;

revoke execute on function public.create_room(public.tournament_game, text, integer, boolean, integer, boolean, uuid, text, text) from anon;
