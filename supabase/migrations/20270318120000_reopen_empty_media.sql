-- Photo Pose, Dog Reels and Seasonal Selfie never sit dead: when a public challenge's entry window closes with nothing
-- entered, entries open again until a day before it ends (the last day stays for voting). Without this, a quiet week
-- showed "Voting now, 0 clips" for days and nobody could play.
--
--   * Only public challenges (friend battles keep the times their players agreed to), only while the tournament runs,
--     and only when no entry is in play (withdrawn and rejected ones don't count).
--   * It moves the stored deadline, so every phase check (media_phase() in SQL, mediaPhase() in the app) agrees.
--   * Runs hourly where pg_cron is available; the app's existing fallback (ensure_weekly_challenges, called when a
--     player opens a list) runs it too, so projects without pg_cron behave the same.

create or replace function public.reopen_empty_media_challenges(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update media_challenges mc
     set entries_close_at = t.ends_at - interval '1 day'
    from tournaments t
   where t.id = mc.tournament_id
     and t.status = 'scheduled'
     and not t.private
     and p_now >= mc.entries_close_at
     and t.ends_at - interval '1 day' > p_now + interval '1 hour'
     and mc.entries_close_at < t.ends_at - interval '1 day'
     and not exists (
       select 1 from media_submissions s
        where s.challenge_id = mc.id and s.status not in ('withdrawn', 'rejected')
     );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.reopen_empty_media_challenges(timestamptz) from public, anon, authenticated;

create or replace function public.ensure_weekly_challenges()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opened integer;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  v_opened := open_weekly_challenges(now());
  perform reopen_empty_media_challenges(now());
  return v_opened;
end;
$$;
revoke execute on function public.ensure_weekly_challenges() from public, anon;
grant execute on function public.ensure_weekly_challenges() to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'paws-reopen-empty-media';
    perform cron.schedule('paws-reopen-empty-media', '7 * * * *', 'select public.reopen_empty_media_challenges()');
  end if;
exception when others then
  raise notice 'reopen schedule not set: %', sqlerrm;
end;
$$;

-- Weeks that are already stuck open again now.
select public.reopen_empty_media_challenges();
