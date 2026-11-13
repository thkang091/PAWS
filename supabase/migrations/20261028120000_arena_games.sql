-- Arena games: Longest Sit (longest hold wins) and Trick Combo (fastest finish wins), played solo on a weekly board
-- or 1 on 1 in a duel. Every attempt is recorded in the app and scored by the `arena` edge function, which alone
-- writes these tables. People read their own rows; boards are read through the functions at the end.

create type public.arena_game as enum ('longest_sit', 'trick_combo');
create type public.arena_status as enum ('started', 'judging', 'scored', 'needs_review', 'invalid', 'expired');
create type public.arena_duel_status as enum ('open', 'playing', 'done', 'expired');

create table public.arena_duels (
  id uuid primary key default gen_random_uuid(),
  game public.arena_game not null,
  -- What the guest types to join. Readable aloud: no 0/O or 1/I.
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_owner_id uuid not null references public.profiles(id) on delete cascade,
  host_dog_id uuid not null references public.dogs(id) on delete cascade,
  guest_owner_id uuid references public.profiles(id) on delete cascade,
  guest_dog_id uuid references public.dogs(id) on delete cascade,
  -- Trick Combo: the four tricks both players get (each attempt shuffles the order).
  tricks text[],
  status public.arena_duel_status not null default 'open',
  winner_dog_id uuid references public.dogs(id) on delete set null,
  expires_at timestamptz not null,
  settled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check (guest_dog_id is null or guest_dog_id <> host_dog_id)
);

create index arena_duels_host_idx on public.arena_duels (host_dog_id, created_at desc);
create index arena_duels_guest_idx on public.arena_duels (guest_dog_id, created_at desc);

create table public.arena_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  dog_id uuid not null references public.dogs(id) on delete cascade,
  game public.arena_game not null,
  duel_id uuid references public.arena_duels(id) on delete cascade,
  -- Monday (UTC) of the board this attempt counts toward.
  week_start date not null,
  -- Said out loud at the start of the clip; only the server and this attempt know it.
  code_word text not null,
  -- Sit: when each distraction sound plays after GO. Combo: the order of the tricks.
  plan jsonb not null,
  status public.arena_status not null default 'started',
  started_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  storage_path text,
  -- The same file can never score twice.
  video_sha256 text unique,
  clip_ms integer,
  score_ms integer check (score_ms is null or score_ms >= 0),
  confidence real,
  observation jsonb,
  reason text,
  -- The owner chose to show this clip to other players on the board. Needed for weekly gold.
  replay_public boolean not null default false,
  judged_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index arena_attempts_board_idx on public.arena_attempts (game, week_start, status, score_ms);
create index arena_attempts_dog_idx on public.arena_attempts (dog_id, game, started_at desc);
create index arena_attempts_duel_idx on public.arena_attempts (duel_id);

alter table public.arena_duels enable row level security;
alter table public.arena_attempts enable row level security;

create policy arena_attempts_select_own on public.arena_attempts
  for select using (owner_id = auth.uid());

create policy arena_duels_select_player on public.arena_duels
  for select using (host_owner_id = auth.uid() or guest_owner_id = auth.uid());

-- Clips live in a private bucket, one folder per person. Only the edge function reads other people's clips, and it
-- hands out short signed links only for replays their owners made public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('arena-videos', 'arena-videos', false, 104857600, array['video/quicktime', 'video/mp4'])
on conflict (id) do nothing;

create policy arena_videos_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'arena-videos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy arena_videos_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'arena-videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- The weekly board: each dog's best scored attempt (longest sit, fastest combo), ranked.
create or replace function public.arena_board(p_game public.arena_game, p_week date, p_limit integer default 50)
returns table (
  rank integer,
  dog_id uuid,
  dog_name text,
  score_ms integer,
  attempt_id uuid,
  replay_public boolean,
  is_mine boolean,
  achieved_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with best as (
    select distinct on (a.dog_id)
      a.dog_id, a.score_ms, a.id as attempt_id, a.replay_public, a.owner_id, a.judged_at
    from arena_attempts a
    where a.game = p_game and a.week_start = p_week and a.status = 'scored' and a.score_ms is not null
    order by a.dog_id,
      case when p_game = 'longest_sit' then -a.score_ms else a.score_ms end,
      a.judged_at
  )
  select
    (row_number() over (
      order by case when p_game = 'longest_sit' then -b.score_ms else b.score_ms end, b.judged_at
    ))::integer as rank,
    b.dog_id, d.name, b.score_ms, b.attempt_id, b.replay_public, b.owner_id = auth.uid(), b.judged_at
  from best b
  join dogs d on d.id = b.dog_id
  order by rank
  limit greatest(1, least(p_limit, 200));
$$;

revoke execute on function public.arena_board(public.arena_game, date, integer) from anon;

-- Gold for last week's top three. Idempotent: a second claim returns the first payout. Needs at least five dogs on
-- the board and a public replay, so nobody earns gold from an empty week or a clip no one can check.
create or replace function public.arena_claim_week(p_dog_id uuid, p_game public.arena_game, p_week date)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rank integer;
  v_public boolean;
  v_dogs integer;
  v_gold integer;
  v_key text := 'arena_week:' || p_game || ':' || p_week || ':' || p_dog_id;
  v_tx wallet_transactions;
begin
  if auth.uid() is null or not owns_dog(p_dog_id) then raise exception 'not_your_dog'; end if;
  if p_week + 7 > (timezone('utc', now()))::date then raise exception 'week_not_over'; end if;

  select count(distinct dog_id) into v_dogs
    from arena_attempts where game = p_game and week_start = p_week and status = 'scored';
  if v_dogs < 5 then raise exception 'not_enough_players'; end if;

  select b.rank, b.replay_public into v_rank, v_public
    from arena_board(p_game, p_week, 3) b where b.dog_id = p_dog_id;
  if v_rank is null then raise exception 'not_in_top_three'; end if;
  if not v_public then raise exception 'replay_not_public'; end if;

  v_gold := (array[15, 10, 5])[v_rank];
  v_tx := apply_wallet_transaction(p_dog_id, 'gold_coin', v_gold, 'arena_weekly_prize', v_key, 'arena_week', null);
  return jsonb_build_object('rank', v_rank, 'gold', v_tx.amount);
end;
$$;

revoke execute on function public.arena_claim_week(uuid, public.arena_game, date) from anon;
