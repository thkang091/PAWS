// Run after: npm install --prefix .expo/round-sql --no-save @electric-sql/pglite
// Uses an in-memory Postgres and the actual curriculum migrations. No remote DB.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../.expo/round-sql/node_modules/@electric-sql/pglite/dist/index.js';
const db = new PGlite();
const uid = '10000000-0000-0000-0000-000000000001';
const other = '10000000-0000-0000-0000-000000000002';
const dog = '20000000-0000-0000-0000-000000000001';
const secondDog = '20000000-0000-0000-0000-000000000002';
const legacyDog = '20000000-0000-0000-0000-000000000003';
const skill = '30000000-0000-0000-0000-000000000001';
const skill2 = '30000000-0000-0000-0000-000000000002';
let assertions = 0;
const eq = (actual, expected, label) => { assert.deepEqual(actual,expected,label); assertions++; };
const reject = async (fn, pattern) => { await assert.rejects(fn,pattern); assertions++; };
try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table dogs(id uuid primary key,owner_id uuid not null);
    create table dog_training_preferences(dog_id uuid primary key references dogs(id),preferred_section_id uuid);
    create function owns_dog(uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.dogs where id=$1 and owner_id=auth.uid()) $$;
    create function set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now();return new;end; $$;
    grant usage on schema auth to authenticated; grant select on dogs to authenticated;`);
  for (const file of [
    '20260915000002_curriculum_content_schema.sql','20260915000003_training_progress_and_sessions.sql',
    '20260915000004_training_rpc_functions.sql','20260917073000_fix_checkpoint_review_self_cancel.sql',
    '20260917061500_configurable_daily_energy_base.sql',
    '20260929165234_training_course_energy_continuation.sql',
    '20261003092948_training_rounds_and_refresher.sql',
  ]) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
  await db.exec(`insert into dogs values('${dog}','${uid}'),('${secondDog}','${uid}'),('${legacyDog}','${uid}');
    insert into training_curriculum_versions(id,version_key,title) values('40000000-0000-0000-0000-000000000001','test','test');
    insert into training_sections(id,curriculum_version_id,section_number,slug,title,sort_order) values('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',1,'rules','Rules',1);
    insert into training_skills(id,section_id,skill_code,internal_concept_id,slug,title,one_line_goal,sort_order) values
      ('${skill}','50000000-0000-0000-0000-000000000001','1-1','door','door','Wait at the Door','Wait',1),
      ('${skill2}','50000000-0000-0000-0000-000000000001','1-2','floor','floor','Choose Your Spot','Choose',2);
    insert into training_levels(skill_id,stage_type,level_number,sequence_index,title)
      select s.id,'level',n,n,'Action '||n from training_skills s cross join generate_series(1,5) n;
    grant select on all tables in schema public to authenticated;
    set role authenticated;
    select set_config('request.jwt.claim.sub','${uid}',false);`);
  const action = async (op, payload={}, d=dog, sk=skill) => (await db.query(
    'select public.training_round_action($1,$2,$3,current_date,$4::jsonb) as state',[d,sk,op,JSON.stringify(payload)]
  )).rows[0].state;
  const payload = r => ({roundId:r.round.id,sessionId:r.session.id});
  let r = await action('get'); eq(r.round,null,'read does not create'); eq(r.energy.remaining,3,'initial energy');
  r = await action('start',{key:'round-a'}); const first=payload(r);
  eq(r.round.phase,'practice','no arbitrary quiz'); eq(r.energy.remaining,2,'one charge');
  eq((await action('start',{key:'different-retry'})).round.id,r.round.id,'reconnect adopts paid round');
  const question = n => ({id:`caption-v1:1-1:1:${n}`,concept:`1-1:1:${n}`,skillCode:'1-1',lessonTitle:'Wait at the Door',level:1,prompt:'What next?',options:[{id:'0',label:'Wait'},{id:'1',label:'Rush'},{id:'2',label:'Repeat'}],correctOptionId:'0',explanation:'Wait',cueAt:n});
  for(let i=0;i<4;i++) await action('help',{...first,question:question(i)});
  await action('help',{...first,question:question(0)});
  eq((await db.query('select count(*)::int n from training_struggles')).rows[0].n,4,'help retry deduplicates');
  eq((await action('get')).session.status,'active','help cannot fail/finalize practice');
  r=await action('continue',first); eq(r.energy.remaining,2,'next step free');
  eq((await action('continue',first)).session.id,r.session.id,'retry cannot complete next step');
  eq((await db.query('select count(*)::int n from training_attempt_reports')).rows[0].n,1,'single success report');
  await reject(() => db.query('select continue_training_session($1,current_date)',[first.sessionId]),/current training round/);
  r=await action('continue',payload(r)); eq(r.round.status,'completed','two steps end first round');
  eq(r.unlocked,false,'not yet unlocked'); eq((await action('start',{key:'not-yet-acked'})).round.id,r.round.id,'lost completion stays visible');
  const done=payload(r); await action('ack',done); await action('ack',done);
  r=await action('start',{key:'round-b'}); eq(r.energy.remaining,1,'second round charge');
  eq(r.round.phase,'quiz','struggles become next paid refresher'); eq(r.round.review_items.length,3,'quiz capped at three');
  await reject(() => action('continue',payload(r)),/Finish refresher first/);
  await reject(() => action('advance_quiz',{...payload(r),cursor:0}),/Answer first/);
  const q=r.round.review_items[0].question;
  r=await action('answer',{...payload(r),questionId:q.id,optionId:'1'});
  r=await action('answer',{...payload(r),questionId:q.id,optionId:'0'}); eq(r.round.answers[0].optionId,'1','first answer immutable');
  eq((await action('get')).round.quiz_cursor,0,'feedback resumes before next');
  r=await action('advance_quiz',{...payload(r),cursor:0});
  r=await action('advance_quiz',{...payload(r),cursor:0}); eq(r.round.quiz_cursor,1,'advance retry does not skip');
  for(let i=1;i<3;i++) {
    r=await action('answer',{...payload(r),questionId:r.round.review_items[i].question.id,optionId:'0'});
    r=await action('advance_quiz',{...payload(r),cursor:i});
  }
  eq(r.round.phase,'practice','quiz finishes into paid practice');
  eq(r.energy.remaining,1,'quiz no extra energy');
  eq((await db.query('select count(*)::int n from training_attempt_reports')).rows[0].n,2,'quiz answers not skill successes');
  for(let i=0;i<3;i++) r=await action('continue',payload(r));
  eq(r.round.status,'completed','three-step round done'); eq(r.unlocked,true,'last step unlocks videos');
  await action('ack',payload(r));
  r=await action('start',{key:'rewatch'}); eq(r.round,null,'rewatch creates no round'); eq(r.energy.remaining,1,'rewatch free');
  await db.exec('reset role');
  await db.exec(`insert into training_energy_ledger(dog_id,effective_local_day,delta,reason) values('${dog}',current_date,-1,'test');set role authenticated;`);
  await reject(()=>action('start',{key:'empty'},dog,skill2),/insufficient_training_energy/);
  r=await action('start',{key:'dog2'},secondDog); const paused=payload(r);
  await db.exec('reset role');
  await db.exec(`insert into training_energy_ledger(dog_id,effective_local_day,delta,reason) values('${secondDog}',current_date,-2,'test');set role authenticated;`);
  r=await action('start',{key:'resume-zero'},secondDog); eq(r.round.id,paused.roundId,'zero energy resume');
  r=await action('continue',paused,secondDog); eq(r.energy.remaining,0,'free continuation at zero');
  await action('end',payload(r),secondDog); await action('end',payload(r),secondDog);
  eq((await action('get',{},secondDog)).round,null,'explicit end ends round');
  // Existing paid practice, even an easier review, is adopted. Finishing it
  // cannot lower the highest recorded progress.
  await db.exec('reset role');
  await db.exec(`insert into dog_training_skill_progress(dog_id,skill_id,current_level_number,status) values('${legacyDog}','${skill}',4,'in_progress');
    insert into training_sessions(dog_id,skill_id,level_id,session_type,status,energy_consumed,effective_local_day,idempotency_key)
      select '${legacyDog}','${skill}',id,'review','active',true,current_date,'legacy-paid' from training_levels where skill_id='${skill}' and level_number=1;
    insert into training_energy_ledger(dog_id,effective_local_day,delta,reason) values('${legacyDog}',current_date,-1,'legacy');
    update training_levels set additional_practice_allowed=false where skill_id='${skill}'; set role authenticated;`);
  eq((await action('get',{},legacyDog)).canResume,true,'legacy prepare shows resume');
  r=await action('start',{key:'adopt'},legacyDog); eq(r.energy.remaining,2,'legacy adoption never charges');
  await action('help',{...payload(r),question:question(1)},legacyDog);
  eq((await action('get',{},legacyDog)).session.status,'active','help stays active even without additional practice');
  r=await action('continue',payload(r),legacyDog); r=await action('continue',payload(r),legacyDog);
  eq((await db.query('select current_level_number n from dog_training_skill_progress where dog_id=$1',[legacyDog])).rows[0].n,4,'highest progress preserved');
  await action('ack',payload(r),legacyDog);
  r=await action('start',{key:'after-adoption'},legacyDog);
  eq(r.round.phase,'quiz','struggle survives later success');
  await reject(()=>action('help',{...payload(r),question:question(1)},legacyDog),/Practice is not active/);
  await reject(()=>action('continue',{...payload(r),sessionId:first.sessionId},legacyDog),/Session changed/);
  await reject(()=>db.query('select training_round_action($1,$2,$3,current_date+10,$4)',[dog,skill,'get','{}']),/Invalid local date/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
  await reject(()=>action('get'),/Dog not found/);
  eq((await db.query('select count(*)::int n from training_rounds')).rows[0].n,0,'RLS other owner sees none');
  await reject(()=>db.exec("update training_rounds set phase='complete'"),/permission denied/);
  await db.exec('reset role; set role anon');
  await reject(()=>action('get'),/permission denied/);
  console.log(`Training rounds: ${assertions} SQL assertions passed (real migrations, local Postgres).`);
} catch(error) { console.error(error.message); process.exitCode=1; }
finally { await db.close(); }
