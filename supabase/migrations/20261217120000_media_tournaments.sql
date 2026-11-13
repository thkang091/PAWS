-- PAWS phase 4A: media tournaments. Shared by every photo or video game (Photo Pose Challenge first; Match My Dog
-- and Dog Reels Battle can reuse it later).
--
--   media_challenges        one per tournament: what to photograph, the reference image, when entries close
--   media_submissions       one live entry per player per challenge; written only by the `media` edge function
--   media_votes             one vote per player per challenge, changeable while voting is open
--   media_reports           players flag an entry; three reports hide it until a person looks
--   media_moderation_log    every decision on an entry, by a person or by the automatic check
--
-- Timeline, on the server clock: registration -> entries (starts_at to entries_close_at) -> voting
-- (entries_close_at to ends_at) -> completed. Entries are hidden from other players until voting opens, vote
-- counts until voting closes. Community votes decide the winner; the automatic check only decides whether an
-- entry shows the required things (a dog, an owner, together), and anything it is unsure about goes to a person.
-- Photos live in a private bucket and are only ever handed out as short signed links.

create table public.media_challenges (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null unique references public.tournaments(id) on delete cascade,
  media_kind text not null default 'photo' check (media_kind in ('photo', 'video')),
  title text not null check (char_length(title) between 3 and 60),
  brief text not null default '' check (char_length(brief) <= 240),
  -- Snapshot of what players are asked to do: steps, framing, criteria, safety. Fixed once anyone has entered, so
  -- every entry is judged against the same instructions.
  instructions jsonb not null default '{}'::jsonb,
  requires_owner boolean not null default true,
  reference_path text,
  entries_close_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.media_submissions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.media_challenges(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references public.dogs(id) on delete set null,
  media_path text not null unique,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  bytes integer not null check (bytes > 0),
  -- checking: the automatic check is running. approved: in the gallery. held: the check could not see something
  -- required; the player can retake or ask for a person. pending_review: waiting for a moderator. rejected, withdrawn.
  status text not null default 'checking' check (status in ('checking', 'approved', 'held', 'pending_review', 'rejected', 'withdrawn')),
  check_status text not null default 'not_run' check (check_status in ('not_run', 'passed', 'failed', 'unclear', 'unavailable')),
  check_result jsonb,
  check_version text,
  held_reason text,
  review_requested_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 280),
  hidden_by_reports boolean not null default false,
  report_count integer not null default 0,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  submitted_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
-- One live entry per player per challenge. Withdrawn and rejected entries make room for a new one.
create unique index media_submissions_one_live_idx on public.media_submissions (challenge_id, user_id) where status not in ('withdrawn', 'rejected');
create index media_submissions_gallery_idx on public.media_submissions (challenge_id, status);
create index media_submissions_queue_idx on public.media_submissions (status, submitted_at) where status in ('pending_review', 'held');

create table public.media_votes (
  challenge_id uuid not null references public.media_challenges(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  submission_id uuid not null references public.media_submissions(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (challenge_id, voter_id)
);
create index media_votes_submission_idx on public.media_votes (submission_id);

create table public.media_reports (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.media_submissions(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('not_the_challenge', 'inappropriate', 'not_their_photo', 'unsafe_for_dog', 'spam')),
  note text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default timezone('utc', now()),
  unique (submission_id, reporter_id)
);

create table public.media_moderation_log (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.media_submissions(id) on delete cascade,
  -- null when the automatic check or the report threshold made the change
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('check', 'approve', 'reject', 'review_requested', 'hidden_by_reports', 'withdrawn')),
  from_status text,
  to_status text,
  reason text,
  created_at timestamptz not null default timezone('utc', now())
);
create index media_moderation_log_submission_idx on public.media_moderation_log (submission_id, created_at);

alter table public.media_challenges enable row level security;
alter table public.media_submissions enable row level security;
alter table public.media_votes enable row level security;
alter table public.media_reports enable row level security;
alter table public.media_moderation_log enable row level security;

-- Challenges are public to signed-in players, like tournaments. Entries, votes and reports: your own rows only.
-- Everyone else's entries come through media_gallery and media_results, and their photos through signed links.
create policy media_challenges_read on public.media_challenges for select to authenticated using (true);
create policy media_submissions_read_own on public.media_submissions for select to authenticated using (user_id = auth.uid());
create policy media_votes_read_own on public.media_votes for select to authenticated using (voter_id = auth.uid());
create policy media_reports_read_own on public.media_reports for select to authenticated using (reporter_id = auth.uid());

-- Entries: a private bucket, one folder per person. Players upload only into their own `incoming` folder; the edge
-- function strips the photo's metadata (location included) and moves it to its final place.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media-entries', 'media-entries', false, 10485760, array['image/jpeg'])
on conflict (id) do nothing;

create policy media_entries_insert_incoming on storage.objects for insert to authenticated
  with check (bucket_id = 'media-entries' and (storage.foldername(name))[1] = auth.uid()::text and (storage.foldername(name))[2] = 'incoming');
create policy media_entries_read_own on storage.objects for select to authenticated
  using (bucket_id = 'media-entries' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_entries_delete_incoming on storage.objects for delete to authenticated
  using (bucket_id = 'media-entries' and (storage.foldername(name))[1] = auth.uid()::text and (storage.foldername(name))[2] = 'incoming');

-- Reference images: organizers see everything; players only an image a published challenge points at.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('challenge-references', 'challenge-references', false, 10485760, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy challenge_references_read on storage.objects for select to authenticated
  using (bucket_id = 'challenge-references' and (
    public.is_tournament_organizer()
    or exists (select 1 from public.media_challenges c where c.reference_path = name)
  ));

-- Upcoming, registration, entries, voting, completed or cancelled, on the server clock.
create or replace function public.media_phase(p_challenge_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when t.status = 'cancelled' then 'cancelled'
    when now() < t.registration_opens_at then 'upcoming'
    when now() < t.starts_at then 'registration'
    when now() < c.entries_close_at then 'entries'
    when now() < t.ends_at then 'voting'
    else 'completed'
  end
  from media_challenges c join tournaments t on t.id = c.tournament_id
  where c.id = p_challenge_id;
$$;

create or replace function public.media_log(p_submission uuid, p_actor uuid, p_action text, p_from text, p_to text, p_reason text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into media_moderation_log (submission_id, actor_id, action, from_status, to_status, reason)
  values (p_submission, p_actor, p_action, p_from, p_to, p_reason);
$$;
revoke execute on function public.media_log(uuid, uuid, text, text, text, text) from public, anon, authenticated;

-- Organizers attach a challenge to a photo or video tournament. Its instructions are fixed once anyone enters.
create or replace function public.create_media_challenge(
  p_tournament_id uuid,
  p_title text,
  p_brief text,
  p_instructions jsonb,
  p_entries_close_at timestamptz,
  p_requires_owner boolean default true,
  p_reference_path text default null
)
returns public.media_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t tournaments;
  v_row media_challenges;
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  select * into v_t from tournaments where id = p_tournament_id;
  if v_t.id is null or v_t.game_type not in ('photo_pose', 'match_my_dog', 'dog_reels') then raise exception 'not_a_media_tournament'; end if;
  -- At least an hour each for entries and for voting.
  if p_entries_close_at < v_t.starts_at + interval '1 hour' or p_entries_close_at > v_t.ends_at - interval '1 hour' then
    raise exception 'entries_window_invalid';
  end if;
  insert into media_challenges (tournament_id, media_kind, title, brief, instructions, requires_owner, reference_path, entries_close_at, created_by)
  values (v_t.id, case when v_t.game_type = 'dog_reels' then 'video' else 'photo' end, p_title, coalesce(p_brief, ''),
    coalesce(p_instructions, '{}'::jsonb), coalesce(p_requires_owner, true), p_reference_path, p_entries_close_at, auth.uid())
  on conflict (tournament_id) do update set title = excluded.title, brief = excluded.brief, instructions = excluded.instructions,
    requires_owner = excluded.requires_owner, reference_path = excluded.reference_path, entries_close_at = excluded.entries_close_at
  where not exists (select 1 from media_submissions s where s.challenge_id = media_challenges.id)
  returning * into v_row;
  if v_row.id is null then raise exception 'challenge_has_entries'; end if;
  return v_row;
end;
$$;
revoke execute on function public.create_media_challenge(uuid, text, text, jsonb, timestamptz, boolean, text) from anon;

-- Records an entry after the edge function has checked and cleaned the photo. Service role only. A new entry
-- replaces the player's live one while entries are open (a retake); the replaced photo's path comes back so the
-- function can delete the file.
create or replace function public.record_media_submission(
  p_challenge_id uuid,
  p_user_id uuid,
  p_dog_id uuid,
  p_media_path text,
  p_width integer,
  p_height integer,
  p_bytes integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c media_challenges;
  v_old media_submissions;
  v_row media_submissions;
begin
  select * into v_c from media_challenges where id = p_challenge_id;
  if v_c.id is null then raise exception 'challenge_not_found'; end if;
  if media_phase(v_c.id) <> 'entries' then raise exception 'entries_closed'; end if;
  if not exists (select 1 from tournament_participants where tournament_id = v_c.tournament_id and user_id = p_user_id and status = 'joined') then
    raise exception 'not_joined';
  end if;
  if p_dog_id is not null and not exists (select 1 from dogs where id = p_dog_id and owner_id = p_user_id) then raise exception 'not_your_dog'; end if;
  if split_part(p_media_path, '/', 1) <> p_user_id::text then raise exception 'not_your_file'; end if;

  -- Serialise a player's entries for this challenge.
  perform pg_advisory_xact_lock(hashtext(p_challenge_id::text || p_user_id::text));
  select * into v_old from media_submissions where challenge_id = v_c.id and user_id = p_user_id and status not in ('withdrawn', 'rejected');
  if v_old.id is not null then
    update media_submissions set status = 'withdrawn', updated_at = timezone('utc', now()) where id = v_old.id;
    perform media_log(v_old.id, p_user_id, 'withdrawn', v_old.status, 'withdrawn', 'replaced');
  end if;

  insert into media_submissions (challenge_id, tournament_id, user_id, dog_id, media_path, width, height, bytes)
  values (v_c.id, v_c.tournament_id, p_user_id, p_dog_id, p_media_path, p_width, p_height, p_bytes)
  returning * into v_row;
  return jsonb_build_object('submission', to_jsonb(v_row), 'replacedPath', v_old.media_path);
end;
$$;
revoke execute on function public.record_media_submission(uuid, uuid, uuid, text, integer, integer, integer) from public, anon, authenticated;

-- The automatic check's outcome. Service role only. passed -> approved, failed -> held (the player can retake or ask
-- for a person), unclear or unavailable -> a person decides. The check never rejects an entry.
create or replace function public.apply_media_check(p_submission_id uuid, p_check_status text, p_result jsonb, p_version text, p_held_reason text)
returns public.media_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s media_submissions;
  v_to text;
begin
  select * into v_s from media_submissions where id = p_submission_id for update;
  if v_s.id is null then raise exception 'entry_not_found'; end if;
  if v_s.status <> 'checking' then return v_s; end if;
  v_to := case p_check_status when 'passed' then 'approved' when 'failed' then 'held' else 'pending_review' end;
  update media_submissions set status = v_to, check_status = p_check_status, check_result = p_result, check_version = p_version,
    held_reason = case when v_to = 'held' then p_held_reason end, updated_at = timezone('utc', now())
  where id = v_s.id returning * into v_s;
  perform media_log(v_s.id, null, 'check', 'checking', v_to, coalesce(p_held_reason, p_check_status));
  return v_s;
end;
$$;
revoke execute on function public.apply_media_check(uuid, text, jsonb, text, text) from public, anon, authenticated;

-- Withdraw your own entry while entries are open. Returns the photo's path for the edge function to delete.
create or replace function public.withdraw_media_submission(p_submission_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s media_submissions;
begin
  select * into v_s from media_submissions where id = p_submission_id for update;
  if v_s.id is null or v_s.user_id <> auth.uid() then raise exception 'entry_not_found'; end if;
  if v_s.status in ('withdrawn', 'rejected') then raise exception 'entry_closed'; end if;
  if media_phase(v_s.challenge_id) <> 'entries' then raise exception 'entries_closed'; end if;
  update media_submissions set status = 'withdrawn', updated_at = timezone('utc', now()) where id = v_s.id;
  perform media_log(v_s.id, auth.uid(), 'withdrawn', v_s.status, 'withdrawn', null);
  return v_s.media_path;
end;
$$;
revoke execute on function public.withdraw_media_submission(uuid) from anon;

-- Ask a person to look at your entry when the automatic check or other players' reports held it back.
create or replace function public.request_media_review(p_submission_id uuid, p_note text default null)
returns public.media_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s media_submissions;
begin
  select * into v_s from media_submissions where id = p_submission_id for update;
  if v_s.id is null or v_s.user_id <> auth.uid() then raise exception 'entry_not_found'; end if;
  if v_s.review_requested_at is not null then raise exception 'review_already_requested'; end if;
  if not (v_s.status = 'held' or (v_s.status = 'pending_review' and v_s.hidden_by_reports)) then raise exception 'nothing_to_review'; end if;
  if media_phase(v_s.challenge_id) not in ('entries', 'voting') then raise exception 'challenge_closed'; end if;
  perform media_log(v_s.id, auth.uid(), 'review_requested', v_s.status, 'pending_review', null);
  update media_submissions set status = 'pending_review', review_requested_at = timezone('utc', now()), review_note = nullif(trim(p_note), ''),
    updated_at = timezone('utc', now())
  where id = v_s.id returning * into v_s;
  return v_s;
end;
$$;
revoke execute on function public.request_media_review(uuid, text) from anon;

-- One vote per player per challenge, for someone else's approved entry, while voting is open. Voting again moves
-- the vote. Only players who joined the tournament vote.
create or replace function public.cast_media_vote(p_submission_id uuid)
returns public.media_votes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s media_submissions;
  v_row media_votes;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into v_s from media_submissions where id = p_submission_id;
  if v_s.id is null or v_s.status <> 'approved' or v_s.hidden_by_reports then raise exception 'entry_not_found'; end if;
  if media_phase(v_s.challenge_id) <> 'voting' then raise exception 'voting_closed'; end if;
  if v_s.user_id = auth.uid() then raise exception 'own_entry'; end if;
  if not exists (select 1 from tournament_participants where tournament_id = v_s.tournament_id and user_id = auth.uid() and status = 'joined') then
    raise exception 'not_joined';
  end if;
  insert into media_votes (challenge_id, voter_id, submission_id) values (v_s.challenge_id, auth.uid(), v_s.id)
  on conflict (challenge_id, voter_id) do update set submission_id = excluded.submission_id, updated_at = timezone('utc', now())
  returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.cast_media_vote(uuid) from anon;

create or replace function public.clear_media_vote(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if media_phase(p_challenge_id) <> 'voting' then raise exception 'voting_closed'; end if;
  delete from media_votes where challenge_id = p_challenge_id and voter_id = auth.uid();
end;
$$;
revoke execute on function public.clear_media_vote(uuid) from anon;

-- Report someone else's visible entry once. The third report hides it until a moderator decides.
create or replace function public.report_media_submission(p_submission_id uuid, p_reason text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s media_submissions;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into v_s from media_submissions where id = p_submission_id for update;
  if v_s.id is null or v_s.status <> 'approved' then raise exception 'entry_not_found'; end if;
  if v_s.user_id = auth.uid() then raise exception 'own_entry'; end if;
  if media_phase(v_s.challenge_id) not in ('voting', 'completed') then raise exception 'entry_not_found'; end if;
  insert into media_reports (submission_id, reporter_id, reason, note) values (v_s.id, auth.uid(), p_reason, nullif(trim(p_note), ''))
  on conflict (submission_id, reporter_id) do nothing;
  select count(*) into v_count from media_reports where submission_id = v_s.id;
  update media_submissions set report_count = v_count, updated_at = timezone('utc', now()) where id = v_s.id;
  if v_count >= 3 and not v_s.hidden_by_reports then
    update media_submissions set status = 'pending_review', hidden_by_reports = true where id = v_s.id;
    perform media_log(v_s.id, null, 'hidden_by_reports', 'approved', 'pending_review', v_count || ' reports');
  end if;
end;
$$;
revoke execute on function public.report_media_submission(uuid, text, text) from anon;

-- Moderators approve or reject an entry, with a reason for rejections. Every decision is logged.
create or replace function public.moderate_media_submission(p_submission_id uuid, p_decision text, p_reason text default null)
returns public.media_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s media_submissions;
  v_from text;
  v_to text;
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  if p_decision not in ('approve', 'reject') then raise exception 'invalid_decision'; end if;
  if p_decision = 'reject' and coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  select * into v_s from media_submissions where id = p_submission_id for update;
  if v_s.id is null then raise exception 'entry_not_found'; end if;
  if v_s.status = 'withdrawn' then raise exception 'entry_closed'; end if;
  v_from := v_s.status;
  v_to := case p_decision when 'approve' then 'approved' else 'rejected' end;
  update media_submissions set status = v_to, hidden_by_reports = false, reviewed_by = auth.uid(), reviewed_at = timezone('utc', now()),
    rejection_reason = case when v_to = 'rejected' then p_reason end, updated_at = timezone('utc', now())
  where id = v_s.id returning * into v_s;
  perform media_log(v_s.id, auth.uid(), p_decision, v_from, v_to, p_reason);
  return v_s;
end;
$$;
revoke execute on function public.moderate_media_submission(uuid, text, text) from anon;

-- The voting gallery: approved, visible entries, in an order that is shuffled differently for each player (so the
-- first entry doesn't collect votes just for being first) and stays the same between visits. Vote counts only
-- appear once voting has closed.
create or replace function public.media_gallery(p_challenge_id uuid)
returns table (submission_id uuid, dog_name text, media_path text, width integer, height integer, is_mine boolean, my_vote boolean, votes integer)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_phase text := media_phase(p_challenge_id);
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if v_phase is null then raise exception 'challenge_not_found'; end if;
  if v_phase not in ('voting', 'completed') then raise exception 'gallery_not_open'; end if;
  return query
    select s.id, d.name, s.media_path, s.width, s.height, s.user_id = auth.uid(),
      exists (select 1 from media_votes v where v.challenge_id = p_challenge_id and v.voter_id = auth.uid() and v.submission_id = s.id),
      case when v_phase = 'completed' then (select count(*)::integer from media_votes v where v.submission_id = s.id) end
    from media_submissions s
    left join dogs d on d.id = s.dog_id
    where s.challenge_id = p_challenge_id and s.status = 'approved' and not s.hidden_by_reports
    order by md5(s.id::text || auth.uid()::text);
end;
$$;
revoke execute on function public.media_gallery(uuid) from anon;

-- Final results once voting closes: most votes first, earlier entry first on a tie. Only approved entries count.
create or replace function public.media_results(p_challenge_id uuid)
returns table (rank integer, submission_id uuid, dog_name text, media_path text, width integer, height integer, votes integer, is_mine boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if media_phase(p_challenge_id) is distinct from 'completed' then raise exception 'results_not_ready'; end if;
  return query
    with tally as (
      select s.id, s.dog_id, s.media_path, s.width, s.height, s.user_id, s.submitted_at,
        (select count(*)::integer from media_votes v where v.submission_id = s.id) as n
      from media_submissions s
      where s.challenge_id = p_challenge_id and s.status = 'approved' and not s.hidden_by_reports
    )
    select (row_number() over (order by t.n desc, t.submitted_at asc))::integer, t.id, d.name, t.media_path, t.width, t.height, t.n, t.user_id = auth.uid()
    from tally t left join dogs d on d.id = t.dog_id
    order by 1;
end;
$$;
revoke execute on function public.media_results(uuid) from anon;

-- Photo and video challenges for the game screens: phase, your entry, whether you joined, how many entered.
create or replace function public.media_challenge_list(p_game public.tournament_game)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row order by (row ->> 'startsAt')), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'challengeId', c.id, 'tournamentId', t.id, 'name', t.name, 'title', c.title, 'brief', c.brief, 'instructions', c.instructions,
      'requiresOwner', c.requires_owner, 'referencePath', c.reference_path, 'phase', media_phase(c.id),
      'registrationOpensAt', t.registration_opens_at, 'startsAt', t.starts_at, 'entriesCloseAt', c.entries_close_at, 'endsAt', t.ends_at,
      'joined', exists (select 1 from tournament_participants p where p.tournament_id = t.id and p.user_id = auth.uid() and p.status = 'joined'),
      'entries', (select count(*) from media_submissions s where s.challenge_id = c.id and s.status = 'approved' and not s.hidden_by_reports),
      'myEntry', (select jsonb_build_object('id', s.id, 'status', s.status, 'heldReason', s.held_reason, 'mediaPath', s.media_path,
          'reviewRequested', s.review_requested_at is not null, 'rejectionReason', s.rejection_reason, 'hiddenByReports', s.hidden_by_reports)
        from media_submissions s where s.challenge_id = c.id and s.user_id = auth.uid() and s.status <> 'withdrawn'
        order by s.submitted_at desc limit 1),
      'myVote', (select v.submission_id from media_votes v where v.challenge_id = c.id and v.voter_id = auth.uid()),
      'serverNow', now()
    ) as row
    from media_challenges c join tournaments t on t.id = c.tournament_id
    where t.game_type = p_game and t.ends_at > now() - interval '30 days'
  ) list;
$$;
revoke execute on function public.media_challenge_list(public.tournament_game) from anon;
