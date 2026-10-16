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
const upgradeDog = '20000000-0000-0000-0000-000000000004';
const shortClipDog = '20000000-0000-0000-0000-000000000005';
const skill = '30000000-0000-0000-0000-000000000001';
const skill2 = '30000000-0000-0000-0000-000000000002';
const shortSkill = '30000000-0000-0000-0000-000000000003';
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
    '20261003144611_training_rounds_and_refresher.sql',
  ]) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
  await db.exec(`insert into dogs values('${dog}','${uid}'),('${secondDog}','${uid}'),('${legacyDog}','${uid}'),('${upgradeDog}','${uid}'),('${shortClipDog}','${uid}');
    insert into training_curriculum_versions(id,version_key,title) values('40000000-0000-0000-0000-000000000001','test','test');
    insert into training_sections(id,curriculum_version_id,section_number,slug,title,sort_order) values('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',1,'rules','Rules',1);
    insert into training_skills(id,section_id,skill_code,internal_concept_id,slug,title,one_line_goal,sort_order) values
      ('${skill}','50000000-0000-0000-0000-000000000001','1-1','door','door','Wait at the Door','Wait',1),
      ('${skill2}','50000000-0000-0000-0000-000000000001','1-2','floor','floor','Choose Your Spot','Choose',2),
      ('${shortSkill}','50000000-0000-0000-0000-000000000001','5-2','accident','accident','Handle accidents calmly','Stay calm',3);
    insert into training_levels(skill_id,stage_type,level_number,sequence_index,title)
      select s.id,'level',n,n,'Action '||n from training_skills s cross join generate_series(1,5) n;
    insert into training_sessions(dog_id,skill_id,level_id,session_type,status,energy_consumed,effective_local_day,idempotency_key)
      select '${upgradeDog}','${skill}',id,'normal','active',true,current_date,'old-paid' from training_levels where skill_id='${skill}' and level_number=2;
    insert into training_rounds(dog_id,skill_id,end_level,idempotency_key,current_session_id)
      select '${upgradeDog}','${skill}',2,'old-active',id from training_sessions where idempotency_key='old-paid';
    update training_sessions set training_round_id=(select id from training_rounds where idempotency_key='old-active') where idempotency_key='old-paid';
    insert into training_rounds(dog_id,skill_id,end_level,status,phase,completed_at,acknowledged_at,idempotency_key)
      values('${upgradeDog}','${skill2}',2,'completed','complete',now(),now(),'old-completed');
    insert into training_energy_ledger(dog_id,effective_local_day,delta,reason) values('${upgradeDog}',current_date,-1,'old-round');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261003151409_training_three_clip_rounds.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261003154551_training_two_question_review_quiz.sql',import.meta.url),'utf8'));
  const userStateBeforeFocus = (await db.query(`select
    (select count(*)::int from training_sessions) sessions,
    (select count(*)::int from training_rounds) rounds,
    (select sum(delta)::int from training_energy_ledger) energy`)).rows;
  await db.exec(await readFile(new URL('../supabase/migrations/20261006151617_focus_training_review_captions.sql',import.meta.url),'utf8'));
  eq((await db.query('select count(*)::int n from training_private.training_review_captions')).rows[0].n,650,'focused catalog removes only discarded captions');
  eq((await db.query(`select cue_index, cue_at::float8 from training_private.training_review_captions
    where skill_code='1-5' and level_number=2 order by cue_index`)).rows,
    [{cue_index:2,cue_at:3.366667},{cue_index:3,cue_at:5.866667}], 'focused captions retain historical review identities');
  eq((await db.query(`select (select count(*)::int from training_sessions) sessions,
    (select count(*)::int from training_rounds) rounds,
    (select sum(delta)::int from training_energy_ledger) energy`)).rows,
    userStateBeforeFocus, 'caption curation leaves user sessions, rounds and Energy unchanged');
  eq((await db.query("select end_level from training_rounds where idempotency_key='old-active'")).rows[0].end_level,3,'upgrade extends only unfinished first round');
  eq((await db.query("select end_level from training_rounds where idempotency_key='old-completed'")).rows[0].end_level,2,'historical completion unchanged');
  eq((await db.query('select sum(delta)::int n from training_energy_ledger where dog_id=$1',[upgradeDog])).rows[0].n,-1,'upgrade does not charge Energy');
  await db.exec(await readFile(new URL('../supabase/migrations/20261006160432_training_difficult_practice_navigation.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261006164320_gate_training_unlock_on_difficulties.sql',import.meta.url),'utf8'));
  await db.exec(`grant select on all tables in schema public to authenticated;
    set role authenticated;
    select set_config('request.jwt.claim.sub','${uid}',false);`);
  const action = async (op, payload={}, d=dog, sk=skill) => (await db.query(
    'select public.training_round_action($1,$2,$3,current_date,$4::jsonb) as state',[d,sk,op,JSON.stringify(payload)]
  )).rows[0].state;
  const payload = r => ({roundId:r.round.id,sessionId:r.session.id});
  const levelNumber = async r => (await db.query('select level_number n from training_levels where id=$1',[r.levelId])).rows[0].n;
  const finishQuiz = async (state,d=dog,sk=skill) => {
    while(state.round.phase==='quiz') {
      const cursor=state.round.quiz_cursor;
      const question=state.round.review_items[cursor].question;
      state=await action('answer',{...payload(state),questionId:question.id,optionId:question.correctOptionId},d,sk);
      state=await action('advance_quiz',{...payload(state),cursor},d,sk);
    }
    return state;
  };
  let r = await action('get'); eq(r.round,null,'read does not create'); eq(r.energy.remaining,3,'initial energy');
  r = await action('start',{key:'round-a'}); const first=payload(r);
  eq(r.lessonAccess.filter(item=>item.visited).map(item=>item.levelNumber),[1],'only visited practice is navigable');
  eq(r.round.phase,'practice','no arbitrary quiz'); eq(r.energy.remaining,2,'one charge');
  eq((await action('start',{key:'different-retry'})).round.id,r.round.id,'reconnect adopts paid round');
  const question = n => ({id:`caption-v1:1-1:1:${n}`,concept:`1-1:1:${n}`,skillCode:'1-1',lessonTitle:'Wait at the Door',level:1,prompt:'What next?',options:[{id:'0',label:'Wait'},{id:'1',label:'Rush'},{id:'2',label:'Repeat'}],correctOptionId:'0',explanation:'Wait',cueAt:n});
  for(let i=0;i<4;i++) await action('help',{...first,question:question(i)});
  await action('help',{...first,question:question(0)});
  eq((await db.query('select count(*)::int n from training_struggles')).rows[0].n,4,'help retry deduplicates');
  eq((await db.query('select help_count from training_level_difficulties where dog_id=$1',[dog])).rows[0].help_count,1,'repeated help in one round is one difficulty occurrence');
  await reject(()=>action('help',{...first,question:{...question(0),level:5}}),/Practice not visited/);
  await reject(()=>action('help',{...first,question:{...question(0),skillCode:'1-2'}}),/Invalid review question/);
  eq((await action('get')).session.status,'active','help cannot fail/finalize practice');
  r=await action('continue',first); eq(r.energy.remaining,2,'next step free');
  eq(r.difficultLevelIds.length,1,'Continue keeps same-round difficulty pending');
  eq((await action('continue',first)).session.id,r.session.id,'retry cannot complete next step');
  eq((await db.query('select count(*)::int n from training_attempt_reports')).rows[0].n,1,'single success report');
  await reject(() => db.query('select continue_training_session($1,current_date)',[first.sessionId]),/current training round/);
  r=await action('continue',payload(r)); eq(r.round.status,'active','two steps do not end first round');
  eq(await levelNumber(r),3,'third clip belongs to first paid round');
  eq((await action('start',{key:'resume-third'})).session.id,r.session.id,'resume retains current third clip');
  r=await action('continue',payload(r)); eq(r.round.status,'completed','three steps end first round');
  eq(r.energy.remaining,2,'all three clips cost one Energy');
  const originalRecap = (await db.query('select to_jsonb(p) p from dog_training_level_progress p where dog_id=$1 and level_id=(select level_id from training_sessions where id=$2)',[dog,first.sessionId])).rows[0].p;
  eq(r.unlocked,false,'not yet unlocked'); eq((await action('start',{key:'not-yet-acked'})).round.id,r.round.id,'lost completion stays visible');
  const done=payload(r); await action('ack',done); await action('ack',done);
  r=await action('start',{key:'round-b'}); eq(r.energy.remaining,1,'second round charge');
  eq(await levelNumber(r),1,'second paid round starts with difficult practice');
  eq(r.session.session_type,'review','overlap is a recap session');
  eq(r.round.phase,'quiz','struggles become next paid review quiz'); eq(r.round.review_items.length,2,'quiz has exactly two questions');
  eq(r.round.review_items.every(item=>item.eventId!==null),true,'struggles take priority over fallback');
  eq(new Set(r.round.review_items.map(item=>item.question.concept)).size,2,'concepts do not repeat');
  await reject(() => action('continue',payload(r)),/Finish review quiz first/);
  await reject(() => action('advance_quiz',{...payload(r),cursor:0}),/Answer first/);
  const q=r.round.review_items[0].question;
  r=await action('answer',{...payload(r),questionId:q.id,optionId:'1'});
  r=await action('answer',{...payload(r),questionId:q.id,optionId:'0'}); eq(r.round.answers[0].optionId,'1','first answer immutable');
  eq((await action('get')).round.quiz_cursor,0,'feedback resumes before next');
  r=await action('advance_quiz',{...payload(r),cursor:0});
  r=await action('advance_quiz',{...payload(r),cursor:0}); eq(r.round.quiz_cursor,1,'advance retry does not skip');
  for(let i=1;i<2;i++) {
    r=await action('answer',{...payload(r),questionId:r.round.review_items[i].question.id,optionId:'0'});
    r=await action('advance_quiz',{...payload(r),cursor:i});
  }
  eq(r.round.phase,'practice','quiz finishes into paid practice');
  eq(r.difficultLevelIds.length,1,'quiz answers never resolve physical difficulty');
  eq(r.energy.remaining,1,'quiz no extra energy');
  eq((await db.query('select count(*)::int n from training_attempt_reports')).rows[0].n,3,'quiz answers not skill successes');
  const recapPayload=payload(r), recapLevel=r.levelId;
  r=await action('continue',recapPayload); eq(await levelNumber(r),4,'recap continues into fourth clip');
  eq(r.difficultLevelIds.length,0,'later successful practice without Help resolves difficulty');
  eq((await action('continue',recapPayload)).session.id,r.session.id,'recap retry cannot complete successor');
  eq((await db.query('select count(*)::int n from training_attempt_reports')).rows[0].n,3,'recap creates no duplicate success report');
  eq((await db.query('select to_jsonb(p) p from dog_training_level_progress p where dog_id=$1 and level_id=$2',[dog,recapLevel])).rows[0].p,originalRecap,'recap preserves original progress and success timestamp');
  r=await action('continue',payload(r)); eq(await levelNumber(r),5,'second round includes fifth clip');
  eq(r.round.status,'active','second round still needs third clip');
  r=await action('continue',payload(r));
  eq(r.round.status,'completed','three-step round done'); eq(r.unlocked,true,'last step unlocks videos');
  eq((await db.query('select count(*)::int n from training_attempt_reports')).rows[0].n,5,'six viewings create five successes');
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
  await db.exec('reset role');
  await db.exec(`insert into dog_training_preferences(dog_id,daily_energy_base) values('${secondDog}',4);set role authenticated;`);
  r=await action('start',{key:'after-early-end'},secondDog);
  eq(await levelNumber(r),1,'fresh first group includes three clips after early End');
  eq(r.session.session_type,'review','already completed first clip is a recap');
  eq(r.round.phase,'quiz','returning practice reviews even without Help');
  eq(r.round.review_items.length,2,'zero struggles still produces two questions');
  eq(r.round.review_items.every(item=>item.eventId===null),true,'fallback does not invent Help events');
  eq(r.round.review_items.every(item=>item.question.level===1),true,'fallback excludes next clip ended before completion');
  eq((await action('get',{},secondDog)).round.review_items,r.round.review_items,'question snapshot survives reopening');
  const missed=r.round.review_items[0].question;
  const wrongOption=missed.options.find(o=>o.id!==missed.correctOptionId).id;
  r=await action('answer',{...payload(r),questionId:missed.id,optionId:wrongOption},secondDog);
  await action('answer',{...payload(r),questionId:missed.id,optionId:wrongOption},secondDog);
  eq((await db.query('select count(*)::int n from training_struggles where dog_id=$1',[secondDog])).rows[0].n,1,'missed fallback becomes one future review concept');
  r=await action('advance_quiz',{...payload(r),cursor:0},secondDog);
  r=await finishQuiz(r,secondDog);
  eq((await db.query('select count(*)::int n from training_struggles where dog_id=$1',[secondDog])).rows[0].n,1,'correct fallback does not create a struggle');
  for(let i=0;i<3;i++) r=await action('continue',payload(r),secondDog);
  eq(r.round.status,'completed','restarted first group ends after three clips');
  eq(r.energy.remaining,0,'restarted group charges once');
  await action('ack',payload(r),secondDog);
  // The paid round already open at migration time extends to L3 at no charge.
  r=await action('start',{key:'resume-upgraded'},upgradeDog);
  eq(await levelNumber(r),2,'upgrade resumes existing video');
  r=await action('continue',payload(r),upgradeDog); eq(await levelNumber(r),3,'upgraded round adds third clip');
  r=await action('continue',payload(r),upgradeDog); eq(r.round.status,'completed','upgraded round completes at third clip');
  eq(r.energy.remaining,2,'upgraded continuation is free');
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
  for(let i=0;i<3;i++) r=await action('continue',payload(r),legacyDog);
  eq((await db.query('select current_level_number n from dog_training_skill_progress where dog_id=$1',[legacyDog])).rows[0].n,4,'highest progress preserved');
  await action('ack',payload(r),legacyDog);
  r=await action('start',{key:'after-adoption'},legacyDog);
  eq(r.round.phase,'quiz','struggle survives later success');
  eq(r.round.review_items.length,2,'one struggle is filled with a second question');
  eq(r.round.review_items[0].question.concept,question(1).concept,'single struggle comes first');
  eq(r.round.review_items[1].eventId,null,'second question comes from training content');
  eq(r.round.review_items[1].question.level,1,'supplement prefers same clip as struggle');
  eq(new Set(r.round.review_items.map(item=>item.question.concept)).size,2,'supplement differs from struggled concept');
  await reject(()=>action('help',{...payload(r),question:question(1)},legacyDog),/Practice is not active/);
  await reject(()=>action('continue',{...payload(r),sessionId:first.sessionId},legacyDog),/Session changed/);
  // Even the shortest one-caption clip has two related concepts at a valid seek point.
  r=await action('start',{key:'short-first'},shortClipDog,shortSkill);
  r=await action('continue',payload(r),shortClipDog,shortSkill);
  await action('end',payload(r),shortClipDog,shortSkill);
  r=await action('start',{key:'short-return'},shortClipDog,shortSkill);
  eq(r.round.review_items.length,2,'single-caption completed clip still supports two questions');
  eq(r.round.review_items.every(item=>item.question.skillCode==='5-2' && item.question.level===1 && item.question.cueAt===0),true,'short-clip questions seek the studied moment');
  eq(new Set(r.round.review_items.map(item=>item.question.concept)).size,2,'short-clip concepts differ');
  // Browsing is client-only. Help can refer to an earlier visited level, while
  // the paid queue, rewards and highest progress remain authoritative here.
  const difficultDog='20000000-0000-0000-0000-000000000006';
  await db.exec('reset role');
  await db.query('insert into dogs values($1,$2)',[difficultDog,uid]);
  await db.query('insert into dog_training_preferences(dog_id,daily_energy_base) values($1,4)',[difficultDog]);
  await db.exec('set role authenticated');
  let d=await action('start',{key:'difficult-first'},difficultDog);
  const originalFirstId=d.levelId;
  d=await action('continue',payload(d),difficultDog);
  const hardSecondId=d.levelId;
  const secondQuestion={...question(0),level:2,id:'caption-v1:1-1:2:0',concept:'1-1:2:0'};
  d=await action('help',{...payload(d),question:secondQuestion},difficultDog);
  d=await action('continue',payload(d),difficultDog);
  const thirdSession=d.session.id;
  d=await action('help',{...payload(d),question:question(0)},difficultDog);
  eq(d.session.id,thirdSession,'Help from an earlier video keeps current session');
  eq(await levelNumber(d),3,'browsed Help does not move current practice');
  eq(d.lessonAccess.filter(a=>a.visited).map(a=>a.levelNumber),[1,2,3],'bar exposes reached steps only');
  eq(d.lessonAccess.filter(a=>a.completed).map(a=>a.levelNumber),[1,2],'bar retains completed range');
  eq(new Set(d.difficultLevelIds),new Set([originalFirstId,hardSecondId]),'browsed difficulty belongs to the actual viewed level');
  d=await action('continue',payload(d),difficultDog);
  eq(d.round.status,'completed','difficulty never blocks current round completion');
  await action('ack',payload(d),difficultDog);
  d=await action('start',{key:'difficult-second'},difficultDog);
  eq(await levelNumber(d),1,'unpractised difficulty is first in the next round');
  eq(d.round.practice_level_ids.length,3,'reinforcement occupies one of three slots');
  eq(new Set(d.round.practice_level_ids).size,3,'three planned practices are distinct');
  d=await finishQuiz(d,difficultDog);
  eq(d.difficultLevelIds.length,2,'all correct quiz answers leave both practice difficulties pending');
  d=await action('help',{...payload(d),question:question(0)},difficultDog);
  await action('help',{...payload(d),question:question(0)},difficultDog);
  eq((await db.query('select help_count from training_level_difficulties where dog_id=$1 and level_id=$2',[difficultDog,originalFirstId])).rows[0].help_count,2,'count independent difficult rounds, not duplicate taps');
  d=await action('continue',payload(d),difficultDog);
  eq(d.difficultLevelIds.includes(originalFirstId),true,'repeated difficulty survives Continue');
  eq(await levelNumber(d),4,'after targeted reinforcement continue with unfinished material');
  d=await action('help',{...payload(d),question:secondQuestion},difficultDog);
  d=await action('continue',payload(d),difficultDog);
  d=await action('continue',payload(d),difficultDog);
  eq(d.round.status,'completed','mixed reinforcement and new steps complete normally');
  eq(d.unlocked,false,'finishing two rounds and L5 does not unlock pending difficulties');
  eq((await action('get',{},difficultDog)).unlocked,false,'reopening cannot bypass the difficulty gate');
  eq(d.difficultLevelIds.length,2,'pending difficulties survive the final level');
  const progressBeforeRevisit=(await db.query('select to_jsonb(p) p from dog_training_level_progress p where dog_id=$1 order by level_id',[difficultDog])).rows;
  const reportsBeforeRevisit=(await db.query('select count(*)::int n from training_attempt_reports')).rows[0].n;
  await action('ack',payload(d),difficultDog);
  d=await action('start',{key:'difficult-after-l5'},difficultDog);
  eq(d.energy.remaining,1,'new reinforcement round spends exactly one Energy');
  eq(d.unlocked,false,'pending lesson starts reinforcement rather than the library');
  eq(await levelNumber(d),2,'older unreinforced practice gets its turn');
  const stablePlan=d.round.practice_level_ids;
  eq((await action('start',{key:'resume-difficult'},difficultDog)).round.practice_level_ids,stablePlan,'resume retains paid reinforcement order');
  d=await finishQuiz(d,difficultDog);
  eq(d.difficultLevelIds.length,2,'quiz still does not clear difficult status after L5');
  eq(d.unlocked,false,'two correct review answers cannot unlock physical difficulty');
  const reinforcePayload=payload(d);
  d=await action('continue',reinforcePayload,difficultDog);
  eq(d.difficultLevelIds.includes(hardSecondId),false,'later practice without Help clears that level only');
  eq(d.difficultLevelIds.includes(originalFirstId),true,'another unresolved level remains');
  eq(d.unlocked,false,'resolving only one difficulty does not unlock videos');
  eq((await action('continue',reinforcePayload,difficultDog)).session.id,d.session.id,'replayed Continue does not settle a new queue position');
  d=await action('help',{...payload(d),question:question(0)},difficultDog);
  d=await action('continue',payload(d),difficultDog);
  d=await action('continue',payload(d),difficultDog);
  eq(d.round.status,'completed','third round ends despite repeated difficulty');
  eq(d.unlocked,false,'three rounds still cannot bypass repeated Help');
  eq(d.difficultLevelIds,[originalFirstId],'the repeated difficult practice stays pending');
  await action('ack',payload(d),difficultDog);
  d=await action('start',{key:'fourth-reinforcement'},difficultDog);
  eq(await levelNumber(d),1,'fourth round starts with the remaining difficulty');
  eq(d.energy.remaining,0,'four rounds spend four Energy total');
  d=await finishQuiz(d,difficultDog);
  eq(d.unlocked,false,'quiz never substitutes for the fourth practice attempt');
  for(let i=0;i<3;i++) d=await action('continue',payload(d),difficultDog);
  eq(d.difficultLevelIds,[],'successful later practices resolve pending difficulty');
  eq(d.round.status,'completed','three reinforcement practices complete once');
  eq(d.unlocked,true,'library unlocks only when all pending difficulties are resolved');
  eq((await db.query('select count(*)::int n from training_attempt_reports')).rows[0].n,reportsBeforeRevisit,'revisits do not manufacture rewards');
  eq((await db.query('select to_jsonb(p) p from dog_training_level_progress p where dog_id=$1 order by level_id',[difficultDog])).rows,progressBeforeRevisit,'revisits preserve all original successful progress');
  await action('ack',payload(d),difficultDog);
  d=await action('start',{key:'finished-library'},difficultDog);
  eq(d.round,null,'completed lesson with no difficulties returns to free library');
  eq(d.energy.remaining,0,'library remains available at zero Energy');
  // Regression: after L5, an unresolved L4 creates [4,1,2]. The old fixed
  // end_level whitelist rejected that valid plan before any round could start.
  const levelFourDog='20000000-0000-0000-0000-000000000007';
  await db.exec('reset role');
  await db.query('insert into dogs values($1,$2)',[levelFourDog,uid]);
  await db.exec('set role authenticated');
  let four=await action('start',{key:'four-first'},levelFourDog);
  for(let i=0;i<3;i++) four=await action('continue',payload(four),levelFourDog);
  await action('ack',payload(four),levelFourDog);
  four=await finishQuiz(await action('start',{key:'four-second'},levelFourDog),levelFourDog);
  four=await action('continue',payload(four),levelFourDog);
  eq(await levelNumber(four),4,'regression reaches L4 before Help');
  const fourthQuestion={...question(0),level:4,id:'caption-v1:1-1:4:0',concept:'1-1:4:0'};
  four=await action('help',{...payload(four),question:fourthQuestion},levelFourDog);
  four=await action('continue',payload(four),levelFourDog);
  four=await action('continue',payload(four),levelFourDog);
  eq(four.unlocked,false,'L4 difficulty remains after finishing L5');
  await action('ack',payload(four),levelFourDog);
  const regressionState=async()=> (await db.query(`select
    (select jsonb_agg(to_jsonb(r) order by r.id) from training_rounds r where dog_id=$1) rounds,
    (select jsonb_agg(to_jsonb(s) order by s.id) from training_sessions s where dog_id=$1) sessions,
    (select jsonb_agg(to_jsonb(p) order by p.level_id) from dog_training_level_progress p where dog_id=$1) progress,
    (select jsonb_agg(to_jsonb(e) order by e.id) from training_energy_ledger e where dog_id=$1) energy`,[levelFourDog])).rows;
  const beforeEndLevelFix=await regressionState();
  await reject(()=>action('start',{key:'four-reinforcement'},levelFourDog),/training_rounds_end_level_check/);
  eq(await regressionState(),beforeEndLevelFix,'failed start rolls back sessions, progress and Energy');
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../supabase/migrations/20261012181639_training_round_adaptive_end_level.sql',import.meta.url),'utf8'));
  for(const invalid of [0,6]) await reject(()=>db.query('update training_rounds set end_level=$1 where dog_id=$2',[invalid,levelFourDog]),/training_rounds_end_level_check/);
  await db.exec('set role authenticated');
  eq(await regressionState(),beforeEndLevelFix,'constraint migration changes no existing user records');
  eq((await db.query("select end_level from training_rounds where idempotency_key='old-completed'")).rows[0].end_level,2,'constraint fix preserves historical level-2 completion');
  four=await action('start',{key:'four-reinforcement'},levelFourDog);
  eq(four.round.end_level,4,'adaptive round accepts highest planned L4');
  eq((await db.query('select l.level_number from unnest($1::uuid[]) with ordinality u(id,n) join training_levels l on l.id=u.id order by u.n',[four.round.practice_level_ids])).rows.map(l=>l.level_number),[4,1,2],'reinforcement order remains L4 then L1 then L2');
  eq(four.energy.remaining,0,'third round charges exactly one Energy');
  eq((await action('start',{key:'four-reinforcement'},levelFourDog)).round.id,four.round.id,'retry returns the same paid round at zero Energy');
  four=await finishQuiz(four,levelFourDog);
  const firstFourPayload=payload(four);
  four=await action('continue',firstFourPayload,levelFourDog);
  eq(await levelNumber(four),1,'Continue at L4 advances by queue rather than end_level');
  eq(four.round.status,'active','highest-level practice does not finish the round early');
  eq((await action('continue',firstFourPayload,levelFourDog)).session.id,four.session.id,'duplicate Continue does not skip L1');
  four=await action('continue',payload(four),levelFourDog);
  eq(await levelNumber(four),2,'second Continue reaches L2');
  four=await action('continue',payload(four),levelFourDog);
  eq(four.round.status,'completed','L4 reinforcement round completes after all three practices');
  eq(four.unlocked,true,'successful reinforcement unlocks the lesson');
  eq(four.energy.remaining,0,'Continue never double charges Energy');
  eq((await regressionState())[0].progress,beforeEndLevelFix[0].progress,'reinforcement preserves original successful progress');
  await reject(()=>db.exec('update training_level_difficulties set resolved_at=now()'),/permission denied/);
  await reject(()=>db.query('select training_private.training_practice_plan($1,$2,1)',[dog,skill]),/permission denied/);
  await reject(()=>db.query('select training_round_action($1,$2,$3,current_date+10,$4)',[dog,skill,'get','{}']),/Invalid local date/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
  await reject(()=>action('get'),/Dog not found/);
  eq((await db.query('select count(*)::int n from training_rounds')).rows[0].n,0,'RLS other owner sees none');
  eq((await db.query('select count(*)::int n from training_level_difficulties')).rows[0].n,0,'RLS hides another dog difficulty records');
  await reject(()=>db.exec("update training_rounds set phase='complete'"),/permission denied/);
  await reject(()=>db.exec('select * from training_private.training_review_captions'),/permission denied/);
  await reject(()=>db.query('select training_private.select_training_review_items($1)',[dog]),/permission denied/);
  await db.exec('reset role; set role anon');
  await reject(()=>action('get'),/permission denied/);
  console.log(`Training rounds: ${assertions} SQL assertions passed (real migrations, local Postgres).`);
} catch(error) { console.error(`After ${assertions} assertions: ${error.message}`); process.exitCode=1; }
finally { await db.close(); }
