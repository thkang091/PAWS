-- A paid round contains two/three internal steps; existing sessions remain the
-- source of success/history. Help and quiz answers never settle those sessions.
create table public.training_rounds (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  skill_id uuid not null references public.training_skills(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','ended')),
  phase text not null default 'practice' check (phase in ('quiz','practice','complete')),
  end_level integer not null check (end_level in (2,5)),
  current_session_id uuid references public.training_sessions(id) on delete set null,
  review_items jsonb not null default '[]',
  answers jsonb not null default '[]',
  quiz_cursor integer not null default 0 check (quiz_cursor between 0 and 3),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  acknowledged_at timestamptz
);
create unique index training_rounds_one_open on public.training_rounds(dog_id,skill_id)
  where status = 'active' or (status = 'completed' and acknowledged_at is null);
create index training_rounds_skill on public.training_rounds(skill_id);
create index training_rounds_session on public.training_rounds(current_session_id);
alter table public.training_sessions add column training_round_id uuid references public.training_rounds(id) on delete set null;
create index training_sessions_round on public.training_sessions(training_round_id);

create table public.training_struggles (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  round_id uuid not null references public.training_rounds(id) on delete cascade,
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  concept text not null,
  question jsonb not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  resolved_at timestamptz,
  unique(session_id,concept)
);
create index training_struggles_pending on public.training_struggles(dog_id,created_at desc) where resolved_at is null;
create index training_struggles_round on public.training_struggles(round_id);
alter table public.training_rounds enable row level security;
alter table public.training_struggles enable row level security;
revoke all on public.training_rounds, public.training_struggles from anon, authenticated;
grant select on public.training_rounds, public.training_struggles to authenticated;
create policy rounds_owner_read on public.training_rounds for select to authenticated using (public.owns_dog(dog_id));
create policy struggles_owner_read on public.training_struggles for select to authenticated using (public.owns_dog(dog_id));

create or replace function training_private.training_round_action(
  p_dog_id uuid, p_skill_id uuid, p_action text, p_local_date date, p_payload jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  r public.training_rounds;
  s public.training_sessions;
  l public.training_levels;
  progress public.dog_training_skill_progress;
  items jsonb := '[]';
  q jsonb;
  answer jsonb;
  item jsonb;
  unlocked boolean;
  previous_level integer;
begin
  if auth.uid() is null or not public.owns_dog(p_dog_id) then raise exception 'Dog not found'; end if;
  if p_action not in ('get','start','help','answer','advance_quiz','continue','ack','end') then raise exception 'Invalid action'; end if;
  if p_local_date is null or abs(p_local_date-current_date)>1 then raise exception 'Invalid local date'; end if;
  -- All round mutations for a dog serialize, including simultaneous starts in
  -- different lessons competing for the final Energy.
  perform 1 from public.dogs where id=p_dog_id for update;
  if not exists(select 1 from public.training_skills where id=p_skill_id) then raise exception 'Skill not found'; end if;
  select * into progress from public.dog_training_skill_progress where dog_id=p_dog_id and skill_id=p_skill_id;
  unlocked := progress.level5_completed_at is not null or coalesce(progress.checkpoint_status='passed',false);
  select * into r from public.training_rounds where dog_id=p_dog_id and skill_id=p_skill_id
    and (status='active' or (status='completed' and acknowledged_at is null)) order by created_at desc limit 1;
  if p_action not in ('get','start') then
    select * into r from public.training_rounds where id::text=p_payload->>'roundId' and dog_id=p_dog_id and skill_id=p_skill_id;
  end if;

  if p_action='start' and r.id is null and not unlocked then
    perform pg_advisory_xact_lock(hashtextextended('energy_reset:'||p_dog_id::text,0));
    if coalesce(length(p_payload->>'key'),0) not between 1 and 160 then raise exception 'Start key required'; end if;
    select * into r from public.training_rounds where idempotency_key=p_payload->>'key';
    if r.id is not null and (r.dog_id<>p_dog_id or r.skill_id<>p_skill_id) then raise exception 'Start key conflict'; end if;
    if r.id is null then
      select * into l from public.training_levels where skill_id=p_skill_id and stage_type='level'
        and level_number=coalesce(progress.current_level_number,1);
      if l.id is null then raise exception 'Training unavailable'; end if;
      -- Adopt the already paid, unfinished legacy step without another charge.
      select * into s from public.training_sessions where dog_id=p_dog_id and skill_id=p_skill_id
        and status='active' and training_round_id is null order by started_at desc limit 1;
      if s.id is not null then
        select * into l from public.training_levels where id=s.level_id;
        if l.stage_type<>'level' then raise exception 'Finish the existing checkpoint before starting this round'; end if;
      end if;
      if s.id is null and (public.get_training_energy(p_dog_id,p_local_date)->>'remaining')::integer<1 then
        raise exception 'insufficient_training_energy';
      end if;
      -- Snapshot up to three distinct concepts; wrong answers remain eligible
      -- next time. Never fill an empty refresher with unrelated questions.
      if s.id is null then
        select coalesce(jsonb_agg(jsonb_build_object('eventId',id,'question',question) order by created_at desc),'[]') into items
        from (select * from (
          select distinct on (concept) * from public.training_struggles
          where dog_id=p_dog_id and resolved_at is null order by concept,created_at desc
        ) recent order by reviewed_at nulls first,created_at desc limit 3) selected;
      end if;
      insert into public.training_rounds(dog_id,skill_id,end_level,review_items,phase,idempotency_key)
        values(p_dog_id,p_skill_id,case when l.level_number<=2 then 2 else 5 end,items,
          case when jsonb_array_length(items)>0 then 'quiz' else 'practice' end,p_payload->>'key') returning * into r;
      if s.id is null then
        insert into public.training_sessions(dog_id,skill_id,level_id,session_type,status,energy_consumed,effective_local_day,idempotency_key,training_round_id)
          values(p_dog_id,p_skill_id,l.id,'normal','active',true,p_local_date,'round-'||r.id,r.id) returning * into s;
        insert into public.training_energy_ledger(dog_id,effective_local_day,delta,reason,session_id)
          values(p_dog_id,p_local_date,-1,'training_round_start',s.id);
      else
        update public.training_sessions set training_round_id=r.id where id=s.id;
      end if;
      update public.training_rounds set current_session_id=s.id where id=r.id returning * into r;
      insert into public.dog_training_skill_progress(dog_id,skill_id,status,current_level_number)
        values(p_dog_id,p_skill_id,'in_progress',l.level_number) on conflict(dog_id,skill_id) do nothing;
      insert into public.dog_training_level_progress(dog_id,level_id,status)
        values(p_dog_id,l.id,'in_progress') on conflict(dog_id,level_id) do nothing;
    end if;
  elsif p_action not in ('get','start') then
    if r.id is null or r.id::text is distinct from p_payload->>'roundId' then raise exception 'Round changed; reopen this lesson'; end if;
    select * into s from public.training_sessions where id=r.current_session_id for update;
    select * into l from public.training_levels where id=s.level_id;
    if p_action='help' then
      if r.status<>'active' or r.phase<>'practice' or s.id::text is distinct from p_payload->>'sessionId' then raise exception 'Practice is not active'; end if;
      q:=p_payload->'question';
      -- Question text is authored from the shipped clip captions, not chat
      -- content. It carries no reward/progress authority. Freeze it for resume.
      if q is null or octet_length(q::text)>6000 or coalesce(jsonb_array_length(q->'options'),0)<>3
        or coalesce(length(q->>'concept'),0) not between 1 and 100
        or coalesce(length(q->>'id'),0) not between 1 and 160
        or coalesce(length(q->>'prompt'),0) not between 1 and 600
        or coalesce(length(q->>'explanation'),0) not between 1 and 1500
        or (q->>'level')::integer is distinct from l.level_number
        or q->>'skillCode' is distinct from (select skill_code from public.training_skills where id=p_skill_id)
        or coalesce((q->>'cueAt')::numeric,-1)<0
        or (select count(distinct o->>'id') from jsonb_array_elements(q->'options') o)<>3
        or exists(select 1 from jsonb_array_elements(q->'options') o where coalesce(length(o->>'label'),0) not between 1 and 1500)
        or not exists(select 1 from jsonb_array_elements(q->'options') o where o->>'id'=q->>'correctOptionId') then
        raise exception 'Invalid refresher question';
      end if;
      insert into public.training_struggles(dog_id,round_id,session_id,concept,question)
        values(p_dog_id,r.id,s.id,q->>'concept',q) on conflict(session_id,concept) do nothing;
    elsif p_action='answer' then
      if r.status<>'active' or r.phase<>'quiz' then raise exception 'Refresher is not active'; end if;
      item:=r.review_items->r.quiz_cursor; q:=item->'question';
      if q->>'id' is distinct from p_payload->>'questionId' then raise exception 'Question changed'; end if;
      if not exists(select 1 from jsonb_array_elements(q->'options') o where o->>'id'=p_payload->>'optionId') then raise exception 'Invalid option'; end if;
      -- The first response is immutable; transport retries do not overwrite it.
      if jsonb_array_length(r.answers)=r.quiz_cursor then
        answer:=jsonb_build_object('questionId',q->>'id','optionId',p_payload->>'optionId');
        update public.training_rounds set answers=answers||jsonb_build_array(answer) where id=r.id returning * into r;
        update public.training_struggles set reviewed_at=now(),resolved_at=case when q->>'correctOptionId'=p_payload->>'optionId' then now() else null end
          where id=(item->>'eventId')::uuid and dog_id=p_dog_id;
        if q->>'correctOptionId'=p_payload->>'optionId' then
          update public.training_struggles set resolved_at=now() where dog_id=p_dog_id and concept=q->>'concept'
            and created_at<=(select created_at from public.training_struggles where id=(item->>'eventId')::uuid);
        end if;
      end if;
    elsif p_action='advance_quiz' then
      if r.status='active' and r.phase='quiz' and r.quiz_cursor=(p_payload->>'cursor')::integer then
        if jsonb_array_length(r.answers)<=r.quiz_cursor then raise exception 'Answer first'; end if;
        update public.training_rounds set quiz_cursor=quiz_cursor+1,
          phase=case when quiz_cursor+1>=jsonb_array_length(review_items) then 'practice' else 'quiz' end where id=r.id returning * into r;
      end if;
    elsif p_action='continue' then
      -- Retry after a response was lost returns the committed successor. A
      -- stale request can never report that successor as successful.
      if s.id::text=p_payload->>'sessionId' and r.status='active' then
        if r.phase<>'practice' then raise exception 'Finish refresher first'; end if;
        previous_level:=coalesce(progress.current_level_number,1);
        if s.status='active' then perform public.report_training_result(s.id,'success',null); end if;
        select * into s from public.training_sessions where id=s.id;
        if s.status<>'completed' or s.final_result is distinct from 'success' then raise exception 'Session not completed'; end if;
        update public.dog_training_skill_progress set current_level_number=greatest(current_level_number,previous_level)
          where dog_id=p_dog_id and skill_id=p_skill_id;
        if l.level_number>=r.end_level then
          update public.training_rounds set status='completed',phase='complete',completed_at=now() where id=r.id returning * into r;
        else
          select * into l from public.training_levels where skill_id=p_skill_id and stage_type='level' and level_number=l.level_number+1;
          if l.id is null then raise exception 'Next practice unavailable'; end if;
          insert into public.training_sessions(dog_id,skill_id,level_id,session_type,status,energy_consumed,effective_local_day,idempotency_key,training_round_id)
            values(p_dog_id,p_skill_id,l.id,'normal','active',false,p_local_date,'round-next-'||s.id,r.id) returning * into s;
          insert into public.dog_training_level_progress(dog_id,level_id,status)
            values(p_dog_id,l.id,'in_progress') on conflict(dog_id,level_id) do nothing;
          update public.training_rounds set current_session_id=s.id where id=r.id returning * into r;
        end if;
      elsif not exists(select 1 from public.training_sessions where id::text=p_payload->>'sessionId' and training_round_id=r.id and status='completed' and final_result='success') then
        raise exception 'Session changed';
      end if;
    elsif p_action='ack' then
      if r.status<>'completed' then raise exception 'Round is not completed'; end if;
      update public.training_rounds set acknowledged_at=now() where id=r.id returning * into r;
    elsif p_action='end' then
      if r.status='active' then
        perform public.end_training_session(s.id,'guardian_ended');
        update public.training_rounds set status='ended',completed_at=now() where id=r.id returning * into r;
      end if;
    end if;
  end if;

  select * into progress from public.dog_training_skill_progress where dog_id=p_dog_id and skill_id=p_skill_id;
  unlocked:=progress.level5_completed_at is not null or coalesce(progress.checkpoint_status='passed',false);
  if r.id is not null then select * into s from public.training_sessions where id=r.current_session_id;
  else s:=null; end if;
  select * into l from public.training_levels where skill_id=p_skill_id and stage_type='level'
    and level_number=coalesce(progress.current_level_number,1);
  return jsonb_build_object('round',case when r.id is null then null else to_jsonb(r) end,
    'session',case when s.id is null then null else to_jsonb(s) end,'levelId',coalesce(s.level_id,l.id),
    'unlocked',unlocked,'canResume',exists(select 1 from public.training_sessions where dog_id=p_dog_id and skill_id=p_skill_id and status='active'),
    'energy',public.get_training_energy(p_dog_id,p_local_date));
end;
$fn$;
revoke all on function training_private.training_round_action(uuid,uuid,text,date,jsonb) from public,anon;
grant execute on function training_private.training_round_action(uuid,uuid,text,date,jsonb) to authenticated;
create function public.training_round_action(p_dog_id uuid,p_skill_id uuid,p_action text,p_local_date date,p_payload jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $fn$
  select training_private.training_round_action(p_dog_id,p_skill_id,p_action,p_local_date,p_payload);
$fn$;
revoke all on function public.training_round_action(uuid,uuid,text,date,jsonb) from public,anon;
grant execute on function public.training_round_action(uuid,uuid,text,date,jsonb) to authenticated;

-- The old app's free continuation cannot cross a paid round boundary.
create or replace function public.continue_training_session(p_completed_session_id uuid,p_local_date date)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
begin
  if exists(select 1 from public.training_sessions where id=p_completed_session_id and training_round_id is not null) then
    raise exception 'Use the current training round to continue';
  end if;
  return training_private.continue_training_session(p_completed_session_id,p_local_date);
end;
$fn$;
