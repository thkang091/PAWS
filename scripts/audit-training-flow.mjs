// Read-only with respect to PAWS: every mutation runs in isolated local Postgres.
// Run: node scripts/audit-training-flow.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PGlite } from '../.expo/round-sql/node_modules/@electric-sql/pglite/dist/index.js';
const require = createRequire(import.meta.url);
const { courses, load } = require('./training-review-caption-seed.cjs');
const { makeRefresherQuestion } = load('../rounds/refresherQuestion');
const { getTrainingYouTubeSegments } = load('trainingYouTube');
const db = new PGlite();
const owner = '10000000-0000-0000-0000-000000000001';
let assertions = 0, scenarios = 0, plannerCases = 0;
const eq = (a,b,label) => { assert.deepEqual(a,b,label); assertions++; };
const check = (condition,label) => { assert.ok(condition,label); assertions++; };
const findings = [];
try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table dogs(id uuid primary key default gen_random_uuid(),owner_id uuid not null);
    create table dog_training_preferences(dog_id uuid primary key references dogs(id),preferred_section_id uuid);
    create function owns_dog(uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.dogs where id=$1 and owner_id=auth.uid())$$;
    create function set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end;$$;
    grant usage on schema auth to authenticated; grant select on dogs to authenticated;`);
  for (const file of [
    '20260915000002_curriculum_content_schema.sql','20260915000003_training_progress_and_sessions.sql',
    '20260915000004_training_rpc_functions.sql','20260917073000_fix_checkpoint_review_self_cancel.sql',
    '20260917061500_configurable_daily_energy_base.sql','20260929165234_training_course_energy_continuation.sql',
    '20261001165126_free_training_energy_reset.sql','20261003144611_training_rounds_and_refresher.sql',
    '20261003151409_training_three_clip_rounds.sql','20261003154551_training_two_question_review_quiz.sql',
    '20261006151617_focus_training_review_captions.sql','20261006160432_training_difficult_practice_navigation.sql',
    '20261006164320_gate_training_unlock_on_difficulties.sql','20261012181639_training_round_adaptive_end_level.sql',
    '20261012185603_coach_conversation_adaptive_practice.sql',
  ]) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
  await db.exec(`insert into training_curriculum_versions(version_key,title) values('audit','audit');
    insert into training_sections(curriculum_version_id,section_number,slug,title,sort_order)
      select v.id,n,'section-'||n,'Section '||n,n from training_curriculum_versions v cross join generate_series(1,6) n;
    select set_config('request.jwt.claim.sub','${owner}',false);`);
  const skills = [];
  for (const [code,clips] of Object.entries(courses)) {
    const skill=(await db.query(`insert into training_skills(section_id,skill_code,internal_concept_id,slug,title,one_line_goal,sort_order)
      select id,$1,$1,$1,$1,$1,$3 from training_sections where section_number=$2 returning id`,[code,Number(code[0]),Number(code[2])])).rows[0].id;
    for (const clip of clips) {
      await db.query(`insert into training_levels(skill_id,stage_type,level_number,sequence_index,title) values($1,'level',$2,$2,$3)`,[skill,clip.levelNumber,clip.steps[0].title]);
      check(getTrainingYouTubeSegments(code,clip.levelNumber).length>0,`${code} L${clip.levelNumber}: playable mapping`);
      for(const cue of clip.steps.flatMap(s=>s.cues)) {
        const q=makeRefresherQuestion(code,code,clip,cue.at);
        check(Buffer.byteLength(JSON.stringify(q))<6000 && q.options.every(o=>o.label.length<=1500),`${code}: Help fits RPC validation`);
      }
    }
    eq(clips.map(c=>c.levelNumber),[1,2,3,4,5],`${code}: complete level catalog`);
    skills.push({code,skill,clips});
  }
  await db.exec('grant select on all tables in schema public to authenticated;');
  const newDog=async()=>{
    const dog=(await db.query('insert into dogs(owner_id) values($1) returning id',[owner])).rows[0].id;
    await db.query('insert into dog_training_preferences(dog_id,daily_energy_base) values($1,10)',[dog]);
    return dog;
  };
  const action=async(dog,skill,op,payload={})=>(await db.query('select public.training_round_action($1,$2,$3,current_date,$4::jsonb) state',[dog,skill,op,JSON.stringify(payload)])).rows[0].state;
  const payload=s=>({roundId:s.round.id,sessionId:s.session.id});
  const number=async s=>(await db.query('select level_number n from training_levels where id=$1',[s.levelId])).rows[0].n;
  const quiz=async(dog,skill,s,wrong=false)=>{
    while(s.round.phase==='quiz') {
      const cursor=s.round.quiz_cursor, q=s.round.review_items[cursor].question;
      s=await action(dog,skill,'answer',{...payload(s),questionId:q.id,optionId:wrong?q.options.find(o=>o.id!==q.correctOptionId).id:q.correctOptionId});
      const resumed=await action(dog,skill,'get');
      eq(resumed.round.answers,s.round.answers,'quiz feedback survives resume');
      s=await action(dog,skill,'advance_quiz',{...payload(s),cursor});
    }
    return s;
  };
  // All sections: no difficulty, each individual difficulty, and all five.
  for(const {code,skill,clips} of skills) {
    for(const mask of [0,1,2,4,8,16,31]) {
      await db.exec('begin');
      const dog=await newDog();
      await db.exec('set local role authenticated');
      let s, rounds=0, helped=0, conversation;
      do {
        s=await action(dog,skill,'start',{key:`${code}-${mask}-${rounds}`});
        rounds++;
        check(rounds<=8,`${code}/${mask}: reinforcement eventually terminates`);
        eq(s.energy.remaining,10-rounds,`${code}: one Energy per round`);
        eq((await action(dog,skill,'start',{key:'retry'})).round.id,s.round.id,'Start retry is idempotent');
        s=await quiz(dog,skill,s,mask===0); // Wrong quiz answers do not block practice.
        while(s.round.status==='active') {
          const n=await number(s), bit=1<<(n-1);
          if((mask&bit) && !(helped&bit)) {
            const q=makeRefresherQuestion(code,code,clips[n-1],0);
            const frozenPlan=s.round.practice_level_ids;
            const opened=await action(dog,skill,'help',{...payload(s),question:q});
            eq(opened.difficultLevelIds,s.difficultLevelIds,'opening Coach in an old client has no effect');
            conversation={...payload(s),question:q};
            s=await action(dog,skill,'coach_reply',conversation); helped|=bit;
            eq(s.round.practice_level_ids,frozenPlan,'conversation never changes the current three practices');
            check(s.difficultLevelIds.includes(s.levelId),'actual Coach exchange marks the viewed practice');
          }
          const old=payload(s);
          s=await action(dog,skill,'continue',old);
          eq((await action(dog,skill,'continue',old)).session.id,s.session.id,'duplicate Continue cannot skip');
          if(s.unlocked) eq(s.difficultLevelIds.length,0,'no pending difficulty when unlocked');
        }
        await action(dog,skill,'ack',payload(s));
      } while(!s.unlocked);
      eq(helped,mask,`${code}: all requested Help paths exercised`);
      if(conversation) {
        const retried=await action(dog,skill,'coach_reply',conversation);
        eq(retried.difficultLevelIds,[],'late duplicate conversation cannot reopen resolved difficulty');
        eq(retried.unlocked,true,'late duplicate cannot revoke the library');
      }
      eq((await db.query('select count(*)::int n from dog_training_level_progress where dog_id=$1 and successful_at is not null',[dog])).rows[0].n,5,'all five practices completed');
      eq((await action(dog,skill,'start',{key:'free-library'})).round,null,'completed lesson opens free library');
      scenarios++;
      await db.exec('rollback');
    }
    console.log(`${code}: 7 complete lifecycle scenarios passed`);
  }
  // A response can arrive after closing Coach and advancing the source step.
  // It must still attach to the original practice without moving the queue.
  const lateSkill=skills[0];
  const lateDog=await newDog();
  let late=await action(lateDog,lateSkill.skill,'start',{key:'late-reply'});
  const lateOrigin={...payload(late),question:makeRefresherQuestion(lateSkill.code,lateSkill.code,lateSkill.clips[0],0)};
  const latePlan=late.round.practice_level_ids;
  late=await action(lateDog,lateSkill.skill,'continue',payload(late));
  late=await action(lateDog,lateSkill.skill,'coach_reply',lateOrigin);
  eq(await number(late),2,'late reply preserves the current successor session');
  eq(late.round.practice_level_ids,latePlan,'late reply cannot reshuffle the paid round');
  eq(late.difficultLevelIds,[latePlan[0]],'late reply marks the original viewed level');
  await action(lateDog,lateSkill.skill,'coach_reply',lateOrigin);
  eq((await db.query('select count(*)::int n from training_coach_practice_events where dog_id=$1',[lateDog])).rows[0].n,1,'conversation deduplicates by round and level');
  await action(lateDog,lateSkill.skill,'end',payload(late));
  const lateSecond={...payload(late),question:makeRefresherQuestion(lateSkill.code,lateSkill.code,lateSkill.clips[1],0)};
  late=await action(lateDog,lateSkill.skill,'coach_reply',lateSecond);
  eq(late.difficultLevelIds.length,2,'reply arriving after explicit End is saved for the next session');
  await assert.rejects(()=>action(lateDog,lateSkill.skill,'coach_reply',{...lateOrigin,sessionId:'00000000-0000-0000-0000-000000000000'}),/Conversation session not found/);
  await db.exec('set role authenticated');
  await assert.rejects(()=>db.query('insert into training_coach_practice_events(dog_id,round_id,level_id) values($1,$2,$3)',[lateDog,late.round.id,latePlan[2]]),/permission denied/);
  await db.exec('reset role');
  // Exhaust all success/difficulty subsets and both starting windows. The
  // planner is shared by all lessons, each of which was exercised above.
  const skill=skills[0].skill;
  const dog=await newDog();
  const levels=(await db.query('select id,level_number from training_levels where skill_id=$1 order by level_number',[skill])).rows;
  for(let success=0;success<32;success++) for(let difficult=0;difficult<32;difficult++) {
    await db.query('delete from dog_training_level_progress where dog_id=$1',[dog]);
    await db.query('delete from training_level_difficulties where dog_id=$1',[dog]);
    for(const l of levels) {
      if(success&(1<<(l.level_number-1))) await db.query("insert into dog_training_level_progress(dog_id,level_id,status,successful_at) values($1,$2,'completed',now())",[dog,l.id]);
      if(difficult&(1<<(l.level_number-1))) await db.query('insert into training_level_difficulties(dog_id,level_id) values($1,$2)',[dog,l.id]);
    }
    for(const start of [1,3]) {
      const plan=(await db.query('select training_private.training_practice_plan($1,$2,$3) ids',[dog,skill,start])).rows[0].ids;
      eq(plan.length,3,'every planner state has three practices');
      eq(new Set(plan).size,3,'planner never repeats a practice within a round');
      check(plan.every(id=>levels.some(l=>l.id===id)),'planner uses only this lesson');
      const numbers=plan.map(id=>levels.find(l=>l.id===id).level_number);
      eq(numbers,[...numbers].sort((a,b)=>a-b),'rearrangement follows curriculum order');
      if(difficult) eq(numbers.filter(n=>difficult&(1<<(n-1))).length,Math.min(3,difficult.toString(2).replace(/0/g,'').length),'pending difficulties receive all available priority slots');
      if(success===7 && [0,2,3,7].includes(difficult)) eq(numbers,({0:start===1?[1,2,3]:[3,4,5],2:[2,4,5],3:[1,2,4],7:[1,2,3]})[difficult],'approved adaptive examples');
      if(success===31 && difficult===8) eq(numbers,[3,4,5],'only L4 pending uses adjacent recap rather than L1/L2');
      plannerCases++;
    }
  }
  // Legacy checkpoint adoption has no route forward in the new round UI.
  await db.exec('begin');
  const legacyDog=await newDog();
  const checkpoint=(await db.query("insert into training_levels(skill_id,stage_type,sequence_index,title) values($1,'checkpoint',6,'Checkpoint') returning id",[skill])).rows[0].id;
  await db.query("insert into training_sessions(dog_id,skill_id,level_id,session_type,status,energy_consumed,effective_local_day,idempotency_key) values($1,$2,$3,'checkpoint','active',true,current_date,'legacy-checkpoint-audit')",[legacyDog,skill,checkpoint]);
  await db.exec('set local role authenticated');
  eq((await action(legacyDog,skill,'get')).canResume,true,'legacy checkpoint is advertised as resumable');
  await assert.rejects(()=>action(legacyDog,skill,'start',{key:'adopt-checkpoint'}),/Finish the existing checkpoint/);
  findings.push('Legacy active checkpoint: Get says resumable, but Start rejects; new UI has no legacy-checkpoint route.');
  await db.exec('rollback');
  console.log(JSON.stringify({lessons:skills.length,levels:skills.length*5,scenarios,plannerCases,assertions,findings},null,2));
} finally { await db.close(); }
