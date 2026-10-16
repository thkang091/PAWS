-- Practice difficulty is independent of quiz recall and successful progression.
create table public.training_level_difficulties (
  dog_id uuid not null references public.dogs(id) on delete cascade,
  level_id uuid not null references public.training_levels(id) on delete cascade,
  last_help_round_id uuid references public.training_rounds(id) on delete set null,
  help_count integer not null default 1 check (help_count > 0),
  last_help_at timestamptz not null default now(),
  last_practised_at timestamptz,
  resolved_at timestamptz,
  primary key(dog_id,level_id)
);
create index training_level_difficulties_level on public.training_level_difficulties(level_id);
create index training_level_difficulties_round on public.training_level_difficulties(last_help_round_id);
alter table public.training_level_difficulties enable row level security;
revoke all on public.training_level_difficulties from public,anon,authenticated;
grant select on public.training_level_difficulties to authenticated;
create policy difficulties_owner_read on public.training_level_difficulties for select to authenticated
  using (public.owns_dog(dog_id));

-- Retain unresolved historical review needs; never reopen resolved history.
insert into public.training_level_difficulties(dog_id,level_id,last_help_round_id,help_count,last_help_at)
select dog_id,level_id,round_id,round_count,created_at from (
  select distinct on (st.dog_id,l.id) st.dog_id,l.id level_id,st.round_id,st.created_at,
    (select count(distinct x.round_id)::integer from public.training_struggles x
      where x.dog_id=st.dog_id and x.resolved_at is null
      and x.question->>'skillCode'=sk.skill_code and x.question->>'level'=l.level_number::text) round_count
  from public.training_struggles st
  join public.training_skills sk on sk.skill_code=st.question->>'skillCode'
  join public.training_levels l on l.skill_id=sk.id and l.stage_type='level' and l.level_number::text=st.question->>'level'
  where st.resolved_at is null
  order by st.dog_id,l.id,st.created_at desc,st.id
) pending;

alter table public.training_rounds add column practice_level_ids uuid[] not null default '{}';
alter table public.training_rounds add column practice_cursor integer not null default 0 check (practice_cursor between 0 and 2);
-- Keep the order and current position of already-paid rounds exactly as they are.
update public.training_rounds r set practice_level_ids=(
  select array_agg(l.id order by l.level_number) from public.training_levels l
  where l.skill_id=r.skill_id and l.stage_type='level'
  and l.level_number between case when r.end_level<=3 then 1 else 3 end and r.end_level
);
update public.training_rounds r set practice_cursor=coalesce(array_position(r.practice_level_ids,s.level_id)-1,0)
from public.training_sessions s where s.id=r.current_session_id;

-- Reserve the first of the three practices for an unresolved physical difficulty.
-- Fill with unfinished steps, then familiar recap material. Never add a 4th task.
create function training_private.training_practice_plan(p_dog_id uuid,p_skill_id uuid,p_start integer)
returns uuid[] language plpgsql set search_path='' as $plan$
declare
  target uuid;
  result uuid[];
begin
  select d.level_id into target from public.training_level_difficulties d
  join public.training_levels l on l.id=d.level_id
  where d.dog_id=p_dog_id and l.skill_id=p_skill_id and d.resolved_at is null
  order by d.last_practised_at nulls first,d.help_count desc,d.last_help_at,l.level_number limit 1;
  if target is null then
    select array_agg(l.id order by l.level_number) into result from public.training_levels l
    where l.skill_id=p_skill_id and l.stage_type='level' and l.level_number between p_start and p_start+2;
  else
    select array_agg(chosen.id order by chosen.priority,chosen.level_number) into result from (
      select l.id,l.level_number,case when l.id=target then 0 when p.successful_at is null then 1 else 2 end priority
      from public.training_levels l left join public.dog_training_level_progress p on p.level_id=l.id and p.dog_id=p_dog_id
      where l.skill_id=p_skill_id and l.stage_type='level'
      order by priority,l.level_number limit 3
    ) chosen;
  end if;
  if cardinality(result)<>3 then raise exception 'Three practices unavailable'; end if;
  return result;
end;
$plan$;
revoke all on function training_private.training_practice_plan(uuid,uuid,integer) from public,anon,authenticated;

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
  recap boolean;
  practice_ids uuid[];
  help_level public.training_levels;
  lesson_access jsonb;
  difficulties jsonb;
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

  if p_action='start' and r.id is null and (not unlocked or exists(
    select 1 from public.training_level_difficulties d join public.training_levels dl on dl.id=d.level_id
    where d.dog_id=p_dog_id and dl.skill_id=p_skill_id and d.resolved_at is null)) then
    perform pg_advisory_xact_lock(hashtextextended('energy_reset:'||p_dog_id::text,0));
    if coalesce(length(p_payload->>'key'),0) not between 1 and 160 then raise exception 'Start key required'; end if;
    select * into r from public.training_rounds where idempotency_key=p_payload->>'key';
    if r.id is not null and (r.dog_id<>p_dog_id or r.skill_id<>p_skill_id) then raise exception 'Start key conflict'; end if;
    if r.id is null then
      practice_ids:=training_private.training_practice_plan(p_dog_id,p_skill_id,
        case when coalesce(progress.current_level_number,1)<=2 then 1 else 3 end);
      select * into l from public.training_levels where id=practice_ids[1];
      if l.id is null then raise exception 'Training unavailable'; end if;
      -- Adopt the already paid, unfinished legacy step without another charge.
      select * into s from public.training_sessions where dog_id=p_dog_id and skill_id=p_skill_id
        and status='active' and training_round_id is null order by started_at desc limit 1;
      if s.id is not null then
        select * into l from public.training_levels where id=s.level_id;
        if l.stage_type<>'level' then raise exception 'Finish the existing checkpoint before starting this round'; end if;
        select array_agg(id order by level_number) into practice_ids from public.training_levels
          where skill_id=p_skill_id and stage_type='level' and level_number between l.level_number and case when l.level_number<=2 then 3 else 5 end;
      end if;
      if s.id is null and (public.get_training_energy(p_dog_id,p_local_date)->>'remaining')::integer<1 then
        raise exception 'insufficient_training_energy';
      end if;
      -- Two review questions per new paid round after prior practice.
      if s.id is null then
        items:=training_private.select_training_review_items(p_dog_id);
      end if;
      insert into public.training_rounds(dog_id,skill_id,end_level,review_items,phase,idempotency_key,practice_level_ids)
        values(p_dog_id,p_skill_id,(select max(level_number) from public.training_levels where id=any(practice_ids)),items,
          case when jsonb_array_length(items)>0 then 'quiz' else 'practice' end,p_payload->>'key',practice_ids) returning * into r;
      if s.id is null then
        recap:=exists(select 1 from public.dog_training_level_progress where dog_id=p_dog_id and level_id=l.id and successful_at is not null);
        insert into public.training_sessions(dog_id,skill_id,level_id,session_type,lesson_contract_version,status,energy_consumed,effective_local_day,idempotency_key,training_round_id)
          values(p_dog_id,p_skill_id,l.id,case when recap then 'review' else 'normal' end,
            case when recap then 'round-recap-v1' else 'button-flow-v1.1' end,
            'active',true,p_local_date,'round-'||r.id,r.id) returning * into s;
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
      -- A guardian may ask about any previously visited step in this lesson.
      -- Navigation itself does not change the paid round's current session.
      select * into help_level from public.training_levels hl where hl.skill_id=p_skill_id and hl.stage_type='level'
        and hl.level_number::text=q->>'level';
      if help_level.id is null or not (
        exists(select 1 from public.training_sessions hs where hs.dog_id=p_dog_id and hs.skill_id=p_skill_id and hs.level_id=help_level.id)
        or exists(select 1 from public.dog_training_level_progress hp where hp.dog_id=p_dog_id and hp.level_id=help_level.id and hp.successful_at is not null)
      ) then raise exception 'Practice not visited'; end if;
      -- Question text is authored from the shipped clip captions, not chat
      -- content. It carries no reward/progress authority. Freeze it for resume.
      if q is null or octet_length(q::text)>6000 or coalesce(jsonb_array_length(q->'options'),0)<>3
        or coalesce(length(q->>'concept'),0) not between 1 and 100
        or coalesce(length(q->>'id'),0) not between 1 and 160
        or coalesce(length(q->>'prompt'),0) not between 1 and 600
        or coalesce(length(q->>'explanation'),0) not between 1 and 1500
        or (q->>'level')::integer is distinct from help_level.level_number
        or q->>'skillCode' is distinct from (select skill_code from public.training_skills where id=p_skill_id)
        or coalesce((q->>'cueAt')::numeric,-1)<0
        or (select count(distinct o->>'id') from jsonb_array_elements(q->'options') o)<>3
        or exists(select 1 from jsonb_array_elements(q->'options') o where coalesce(length(o->>'label'),0) not between 1 and 1500)
        or not exists(select 1 from jsonb_array_elements(q->'options') o where o->>'id'=q->>'correctOptionId') then
        raise exception 'Invalid review question';
      end if;
      insert into public.training_struggles(dog_id,round_id,session_id,concept,question)
        values(p_dog_id,r.id,s.id,q->>'concept',q) on conflict(session_id,concept) do nothing;
      insert into public.training_level_difficulties(dog_id,level_id,last_help_round_id)
        values(p_dog_id,help_level.id,r.id)
        on conflict(dog_id,level_id) do update set
          help_count=training_level_difficulties.help_count+case when training_level_difficulties.last_help_round_id is distinct from r.id then 1 else 0 end,
          last_help_round_id=r.id,last_help_at=now(),resolved_at=null;
    elsif p_action='answer' then
      if r.status<>'active' or r.phase<>'quiz' then raise exception 'Review quiz is not active'; end if;
      item:=r.review_items->r.quiz_cursor; q:=item->'question';
      if q->>'id' is distinct from p_payload->>'questionId' then raise exception 'Question changed'; end if;
      if not exists(select 1 from jsonb_array_elements(q->'options') o where o->>'id'=p_payload->>'optionId') then raise exception 'Invalid option'; end if;
      -- The first response is immutable; transport retries do not overwrite it.
      if jsonb_array_length(r.answers)=r.quiz_cursor then
        answer:=jsonb_build_object('questionId',q->>'id','optionId',p_payload->>'optionId');
        update public.training_rounds set answers=answers||jsonb_build_array(answer) where id=r.id returning * into r;
        update public.training_struggles set reviewed_at=now(),resolved_at=case when q->>'correctOptionId'=p_payload->>'optionId' then now() else null end
          where id=(item->>'eventId')::uuid and dog_id=p_dog_id;
        -- A missed supplemental question becomes a real review candidate.
        -- Correct supplemental answers never manufacture a Help event.
        if item->>'eventId' is null and q->>'correctOptionId'<>p_payload->>'optionId' then
          insert into public.training_struggles(dog_id,round_id,session_id,concept,question,reviewed_at)
            select p_dog_id,r.id,source.id,q->>'concept',q,now()
            from public.training_sessions source
            where source.id=(item->>'sourceSessionId')::uuid and source.dog_id=p_dog_id
            on conflict(session_id,concept) do update set resolved_at=null,reviewed_at=now();
        end if;
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
        if r.phase<>'practice' then raise exception 'Finish review quiz first'; end if;
        previous_level:=coalesce(progress.current_level_number,1);
        if s.status='active' then
          -- A later round's successful practice can resolve difficulty. Help
          -- anywhere in this round keeps it pending, even after Continue.
          update public.training_level_difficulties set last_practised_at=now(),
            resolved_at=case when last_help_round_id is distinct from r.id then now() else resolved_at end
            where dog_id=p_dog_id and level_id=l.id and resolved_at is null;
          -- Overlapping clips are a recap. Preserve their original success and
          -- attempt count; do not enter the success/reward path a second time.
          recap:=exists(select 1 from public.dog_training_level_progress where dog_id=p_dog_id and level_id=l.id and successful_at is not null);
          if recap then
            update public.training_sessions set status='completed',completed_at=now(),final_result='success',
              session_type='review',lesson_contract_version='round-recap-v1' where id=s.id;
          else
            perform public.report_training_result(s.id,'success',null);
          end if;
        end if;
        select * into s from public.training_sessions where id=s.id;
        if s.status<>'completed' or s.final_result is distinct from 'success' then raise exception 'Session not completed'; end if;
        update public.dog_training_skill_progress set current_level_number=greatest(current_level_number,previous_level)
          where dog_id=p_dog_id and skill_id=p_skill_id;
        if r.practice_cursor+1>=cardinality(r.practice_level_ids) then
          update public.training_rounds set status='completed',phase='complete',completed_at=now() where id=r.id returning * into r;
        else
          select * into l from public.training_levels where id=r.practice_level_ids[r.practice_cursor+2] and skill_id=p_skill_id;
          if l.id is null then raise exception 'Next practice unavailable'; end if;
          recap:=exists(select 1 from public.dog_training_level_progress where dog_id=p_dog_id and level_id=l.id and successful_at is not null);
          insert into public.training_sessions(dog_id,skill_id,level_id,session_type,lesson_contract_version,status,energy_consumed,effective_local_day,idempotency_key,training_round_id)
            values(p_dog_id,p_skill_id,l.id,case when recap then 'review' else 'normal' end,
              case when recap then 'round-recap-v1' else 'button-flow-v1.1' end,
              'active',false,p_local_date,'round-next-'||s.id,r.id) returning * into s;
          insert into public.dog_training_level_progress(dog_id,level_id,status)
            values(p_dog_id,l.id,'in_progress') on conflict(dog_id,level_id) do nothing;
          update public.training_rounds set current_session_id=s.id,practice_cursor=practice_cursor+1 where id=r.id returning * into r;
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
    and level_number=case when coalesce(progress.current_level_number,1)<=2 then 1 else 3 end;
  select coalesce(jsonb_agg(jsonb_build_object('levelId',ll.id,'levelNumber',ll.level_number,
    'completed',lp.successful_at is not null,'visited',lp.successful_at is not null or exists(
      select 1 from public.training_sessions vs where vs.dog_id=p_dog_id and vs.skill_id=p_skill_id and vs.level_id=ll.id)) order by ll.level_number),'[]')
    into lesson_access from public.training_levels ll left join public.dog_training_level_progress lp on lp.level_id=ll.id and lp.dog_id=p_dog_id
    where ll.skill_id=p_skill_id and ll.stage_type='level';
  select coalesce(jsonb_agg(d.level_id),'[]') into difficulties from public.training_level_difficulties d
    join public.training_levels dl on dl.id=d.level_id where d.dog_id=p_dog_id and dl.skill_id=p_skill_id and d.resolved_at is null;
  return jsonb_build_object('round',case when r.id is null then null else to_jsonb(r) end,
    'session',case when s.id is null then null else to_jsonb(s) end,'levelId',coalesce(s.level_id,l.id),
    'unlocked',unlocked,'lessonAccess',lesson_access,'difficultLevelIds',difficulties,
    'canResume',exists(select 1 from public.training_sessions where dog_id=p_dog_id and skill_id=p_skill_id and status='active'),
    'energy',public.get_training_energy(p_dog_id,p_local_date));
end;
$fn$;
