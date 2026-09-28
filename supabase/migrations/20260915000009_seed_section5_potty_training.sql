insert into training_sections (curriculum_version_id, section_number, slug, title, description, source_to_product_adaptation, safety_boundary, sort_order)
select id, 5, 'potty-training', 'Potty Training', 'Use clear locations, calm observation, immediate reward, and non-punitive accident recovery.', 'The source indoor/outdoor location goals are retained. Accident "correction" is rewritten as calm interruption only when safely observed, immediate environmental cleanup, prevention, and veterinary referral for sudden or concerning changes. Elimination is recorded separately from Lesson completion.', 'Never punish or frighten a dog for an accident. Sudden changes, straining, pain, blood, excessive thirst/urination, diarrhea, constipation, or unusually frequent accidents require veterinary guidance rather than app diagnosis.', 5
from training_curriculum_versions where version_key = 'button-flow-v1.1'
on conflict (curriculum_version_id, section_number) do update set
  slug = excluded.slug, title = excluded.title, description = excluded.description,
  source_to_product_adaptation = excluded.source_to_product_adaptation, safety_boundary = excluded.safety_boundary, sort_order = excluded.sort_order;
do $do$
declare
  v_skill_id uuid;
  v_level1_id uuid;
  v_checkpoint_id uuid;
  v_media_binding_id uuid;
  v_tmp_id uuid;
begin
  insert into training_skills (section_id, skill_code, internal_concept_id, slug, title, source_label_ko, one_line_goal, product_status, shared_skill_bridge_relation, skill_promise, boundaries, authoring_state, sort_order)
  select sec.id, '5-1', 'INDOOR_POTTY_AREA', 'use-an-indoor-potty-area', 'Use an Indoor Potty Area', '실내 지정된 공간 이용 학습', 'Follow one repeatable route to an indoor potty area and reward elimination there.', 'Product content candidate; not published', 'Builds on 1-4 Start a Potty Routine. If that foundation is complete, the next Session may use it as a warm-up rather than duplicating reward units.', 'Teach one indoor area, route, cue, quiet observation period, and immediate post-elimination reward, then gradually reduce guidance and add another starting location.', '["Forcing the dog to remain on a pad or in a bathroom until elimination occurs.","Punishing accidents or rewarding mere presence as if elimination happened.","Using a dirty, unstable, inaccessible, or unsafe potty area.","Diagnosing medical or developmental causes of accidents."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 1
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 5
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Visit the Indoor Potty Area', 'Follow the route and pause inside the area.', 'The dog enters the area and remains briefly without physical placement.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Eliminate in the Area', 'Reward natural elimination in the selected area.', 'When elimination occurs naturally, the reward follows after completion while the dog remains in the area.', 'Offer the area at a high-probability time.', 'Observe quietly and reward after elimination.', 'Practise only the route when no elimination occurs.', 'When my dog eliminated, it happened in the area and I rewarded afterward.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Add One Potty Cue', 'Pair one short cue with arrival at the area.', 'The cue is used once at the same point in the route, without repeated pressure.', 'Use the cue once before entering.', 'Reward after natural elimination.', 'Use the established route without the cue.', 'I used one consistent potty cue with the indoor routine.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Start From Another Room', 'Follow the same route from a second familiar starting point.', 'The dog reaches the same potty area from the new start with approved guidance.', 'Begin a short distance away.', 'Begin from the second room.', 'Start halfway along the route.', 'My dog followed the route from another room.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Use Less Guidance', 'Move toward the area with reduced visible food and pointing.', 'The dog begins following the routine after one cue and normal guardian movement.', 'Keep treats hidden during the route.', 'Reward only after arrival or elimination.', 'Stand closer or use one empty-hand point.', 'My dog followed the indoor potty routine with less guidance.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Use the Indoor Routine on Another Day', 'Use the indoor potty routine once on a later day.', 'The dog follows the route and, if elimination occurs, it is rewarded only after completion in the area.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Small treats","detail":"Use soft, bite-sized treats your dog can eat quickly."},{"label":"An indoor potty area","detail":"Use one clean, stable pad or toilet area that is easy for your dog to reach."}]'::jsonb, 'Keep the area clean and non-slip. Do not punish accidents. Stop and contact a veterinarian for sudden changes, straining, pain, blood, or unusually frequent accidents.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Visit the indoor potty area', 'Teach your dog one calm route to the indoor potty area.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The dog enters the area and remains briefly without physical placement.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Reward calm arrival', null, 'Mark the brief pause and give one treat in the potty area.', 'Walk your dog to the indoor potty area. Pause and reward when all four paws are inside. Repeat twice.', 'Then, only if the first part is comfortable and successful: Repeat the same route once more. Keep your movement and cue calm and consistent.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word and leave the area calmly. Elimination is not required for Level 1.', 'My dog followed the route and paused in the indoor potty area.', 'My dog was not ready to follow the route to the indoor potty area.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word and leave the area calmly. Elimination is not required for Level 1.', 'My dog followed the route and paused in the indoor potty area.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'completion', 'completion', 5, null, 'Show authoritative Silver and remaining Energy only after settlement. A recorded practice is not a claim of mastery.', null, null, null, null, 'Level complete. The next sequential Level is ready.', 'Practice complete. An approved easier Review or Bridge is scheduled before returning to this Level.', null, '[{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  delete from training_adaptive_guidance where level_id = v_level1_id;

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog entered only while following visible food.', 'starting_step', 'Keep the treat hidden', 'Guide with your body or an empty hand and reward only after your dog enters.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog avoided the area or left immediately.', 'starting_step', 'Make the area easier to reach', 'Begin closer and remove nearby obstacles.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog followed but needed repeated guidance.', 'later_step', 'Use fewer words', 'Use one short route cue and guide with calm movement instead of repeating it.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog did not follow the route to the area.', 'later_step', 'Shorten the route', 'Begin one or two steps from the potty area.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use the shorter route once and reward calm arrival. Later-step retry: Use the shorter route once, then check the arrival. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'IPT-L1-DEMO', 'not_produced', 'Sequence: show the destination; reward calm arrival; repeat the same route; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'IPT-L1-CLIP-01', 'Enter the indoor potty area', 'The mascot follows a short route to a clean, stable indoor pad area and stops inside.', 'No bodily-fluid imagery; area fixed, clean, and non-slip.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'IPT-L1-CLIP-02', 'Reward calm arrival', 'A treat is delivered after the mascot pauses inside the area.', 'No implication that arrival equals elimination.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'IPT-L1-CLIP-03', 'Repeat the same route', 'The mascot returns to the same start and follows the identical path again.', 'Route continuity and target location stable.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'IPT-L1-CLIP-04', 'Release and leave', 'A release gesture allows the mascot to leave the area calmly.', 'No forced waiting or accident imagery.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Offer the indoor potty routine once without a teaching rehearsal.', 'My dog followed the routine and used the area when elimination occurred.', 'My dog avoided the area or repeatedly eliminated elsewhere during the attempt. Also includes an unclear result: The route worked but needed repeated guidance or the timing was unclear.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not suitable for MVP AI verification', false, null, 'Potty behavior is private, timing-dependent, and unsuitable for a routine camera Challenge.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 1 and s2.skill_code = '1-4'), 'shared_foundation', 'Foundation for Section 5. Section 5 adds indoor elimination, accident recovery, and outdoor context without resetting this progress.', false);
end;
$do$;

do $do$
declare
  v_skill_id uuid;
  v_level1_id uuid;
  v_checkpoint_id uuid;
  v_media_binding_id uuid;
  v_tmp_id uuid;
begin
  insert into training_skills (section_id, skill_code, internal_concept_id, slug, title, source_label_ko, one_line_goal, product_status, shared_skill_bridge_relation, skill_promise, boundaries, authoring_state, sort_order)
  select sec.id, '5-2', 'ACCIDENT_RECOVERY_ROUTINE', 'recover-calmly-after-accidents', 'Recover Calmly After Accidents', '배변 실수에 대한 두려움 줄이기', 'Use a neutral cleanup and prevention routine without scolding or frightening the dog.', 'Product content candidate; not published', 'Guardian-behavior Skill linked to 1-4 and 5-1. It never changes the dog''s outcome retrospectively or treats cleanup as punishment.', 'Prepare the guardian to respond calmly: avoid emotional reaction, move the dog away only when safe, clean thoroughly, record context if useful, and adjust the next potty opportunity.', '["Punishment, shouting, startling, nose-rubbing, confinement, or making the dog watch cleanup.","Assuming the dog understands guilt, revenge, or wrongdoing.","Interrupting elimination in a way that frightens or physically forces the dog.","Ignoring sudden or concerning medical signs."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 2
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 5
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Practise a Neutral Response', 'Pause, breathe, and avoid reacting toward the dog.', 'The guardian completes the mock response without scolding, chasing, or startling.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Clean and Remove Access', 'Move the dog to a safe neutral area and clean thoroughly.', 'Cleanup occurs without conflict and the dog is not forced to remain nearby.', 'Use a calm redirect away from the area.', 'Complete the pet-safe cleanup sequence.', 'Practise only the redirect or only the cleanup order.', 'I redirected calmly and completed the cleanup routine.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Record the Context', 'Note useful facts without blaming the dog.', 'The guardian records time, location, recent routine, and observable signs only.', 'Write one neutral event note.', 'Choose the next planned potty opportunity.', 'Record only time and location.', 'I recorded neutral context and planned the next opportunity.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Prevent the Next Miss', 'Adjust supervision, route, or timing after the accident.', 'One practical prevention change is made without restricting basic needs.', 'Choose one prevention change.', 'Run the next calm potty routine.', 'Use only closer supervision or a shorter route.', 'I made one practical prevention change after the accident.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Use the Full Recovery Routine', 'Complete pause, redirect, cleanup, record, and prevention as one sequence.', 'The sequence remains calm, factual, and non-punitive.', 'Rehearse the full sequence with the mock spot.', 'Apply the plan after a real accident if one occurs.', 'Use the first three steps only.', 'I used the full calm accident-recovery routine.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Use the Recovery Routine When Needed', 'Use the calm accident-recovery routine once when needed on a later day.', 'The guardian responds without punishment and completes cleanup plus one prevention step.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Cleaning supplies","detail":"Prepare your normal pet-safe cleanup supplies before practising the response."},{"label":"A mock accident spot","detail":"Use a clean towel or paper marker to rehearse the routine. No real accident is required."}]'::jsonb, 'Do not use a real chemical product during the rehearsal unless its pet-safe instructions are understood. Contact a veterinarian for sudden changes, pain, straining, blood, or frequent accidents.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Practise a neutral response', 'Learn what to do after an accident without scolding or frightening your dog.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The guardian completes the mock response without scolding, chasing, or startling.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Move attention away from the spot', null, 'If your dog is nearby, guide them calmly to a safe neutral place without punishment.', 'Place the clean mock marker on the floor. Notice it, pause, and guide your dog away calmly if needed.', 'Then, only if the first part is comfortable and successful: Rehearse the cleanup order and name one practical next step, such as an earlier potty trip or closer supervision.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'End the rehearsal, remove the mock marker, and return to the normal routine without punishment.', 'I completed a neutral accident-response and prevention routine.', 'I was not ready to complete the routine calmly today.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'End the rehearsal, remove the mock marker, and return to the normal routine without punishment.', 'I completed a neutral accident-response and prevention routine.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'completion', 'completion', 5, null, 'Show authoritative Silver and remaining Energy only after settlement. A recorded practice is not a claim of mastery.', null, null, null, null, 'Level complete. The next sequential Level is ready.', 'Practice complete. An approved easier Review or Bridge is scheduled before returning to this Level.', null, '[{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  delete from training_adaptive_guidance where level_id = v_level1_id;

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'I stayed mostly calm but voice or movement became tense.', 'starting_step', 'Use fewer words', 'Say nothing to your dog. Turn your body and guide them away with one calm movement.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'I reacted sharply or could not redirect calmly.', 'starting_step', 'Rehearse without your dog', 'Practise the pause and first cleanup step while your dog rests elsewhere.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'I cleaned but did not choose a clear prevention step.', 'later_step', 'Choose one simple change', 'Pick only one next step: earlier timing, a shorter route, or closer supervision.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'I was not ready to complete the cleanup and prevention routine calmly.', 'later_step', 'Practise the cleanup order only', 'Rehearse the safe cleanup sequence without adding a prevention plan yet.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use one silent rehearsal of the pause and redirect. Later-step retry: Use the simpler cleanup sequence once, then choose whether to stop. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'ACC-L1-DEMO', 'not_produced', 'Sequence: pause before reacting; move attention away from the spot; clean, then plan the next chance; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'ACC-L1-CLIP-01', 'Pause at a mock spot', 'The mascot is at a safe distance while a clean paper/towel marker appears and the guardian hand remains still.', 'No bodily-fluid imagery, shame, scolding, or threatening gesture.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'ACC-L1-CLIP-02', 'Guide away calmly', 'A neutral guide hand points to a safe mat and the mascot moves away from the mock spot.', 'No dragging, chasing, or confinement.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'ACC-L1-CLIP-03', 'Clean the mock area', 'The mascot rests away while a simplified glove hand removes the clean marker.', 'No chemical label, toxic product, or dog forced to watch.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'ACC-L1-CLIP-04', 'Return to normal routine', 'A release gesture ends the rehearsal and the mascot returns calmly.', 'No punishment or reward implication for the accident itself.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Use a later rehearsal if no natural accident occurs; do not create an accident for training.', 'I stayed neutral, cleaned, and adjusted the next routine.', 'I could not complete the routine calmly or medical signs were present. Also includes an unclear result: I completed some steps but reacted emotionally or missed the prevention step.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not a Game Skill', false, null, 'This is a guardian recovery routine and must not incentivize recording or creating accidents.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 1 and s2.skill_code = '1-4'), 'related', 'Guardian-behavior Skill linked to 1-4 and 5-1. It never changes the dog''s outcome retrospectively or treats cleanup as punishment.', false);

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 5 and s2.skill_code = '5-1'), 'related', 'Guardian-behavior Skill linked to 1-4 and 5-1. It never changes the dog''s outcome retrospectively or treats cleanup as punishment.', false);
end;
$do$;
do $do$
declare
  v_skill_id uuid;
  v_level1_id uuid;
  v_checkpoint_id uuid;
  v_media_binding_id uuid;
  v_tmp_id uuid;
begin
  insert into training_skills (section_id, skill_code, internal_concept_id, slug, title, source_label_ko, one_line_goal, product_status, shared_skill_bridge_relation, skill_promise, boundaries, authoring_state, sort_order)
  select sec.id, '5-3', 'OUTDOOR_POTTY_AREA', 'use-an-outdoor-potty-area', 'Use an Outdoor Potty Area', '실외 배변 시 구역 설정', 'Walk safely to one appropriate outdoor area, wait calmly, and reward elimination there.', 'Product content candidate; not published', 'Builds on 1-4 route consistency and complements 5-1 indoor context. Indoor and outdoor progress remain context-specific.', 'Teach a safe route and outdoor potty location, then add a cue, mild environmental variation, and integration with a normal walk while preserving local rules and cleanup responsibility.', '["Using unsafe roadsides, private property, environmentally sensitive areas, or locations prohibited by local rules.","Pulling the dog to a spot, waiting under extreme weather, or withholding normal opportunities.","Assuming outdoor elimination eliminates the need for indoor management or medical review.","Leaving waste or using a Game reward for toileting."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 3
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 5
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Walk to the Outdoor Area', 'Follow one safe route and pause in the selected area.', 'The dog reaches the area on leash and remains briefly without pulling into danger.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Reward Outdoor Elimination', 'Reward immediately after natural elimination in the area.', 'When elimination occurs, the reward follows after completion and cleanup begins.', 'Wait quietly in the area.', 'Reward after elimination and clean up.', 'Practise only the route if no elimination occurs.', 'When my dog eliminated outdoors, I rewarded afterward in the selected area.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Add One Outdoor Cue', 'Pair one cue with arrival at the area.', 'The cue is used once at the same point without repeated pressure.', 'Use the cue at arrival.', 'Reward after natural elimination.', 'Use the route without a cue.', 'I used one consistent cue in the outdoor potty routine.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Use the Area With Mild Distractions', 'Complete the route around one manageable environmental distraction.', 'The dog can reach and use the area while remaining safe and manageable.', 'Choose a quiet time with one mild distraction.', 'Complete the route and pause.', 'Increase distance or choose a quieter time.', 'My dog used the outdoor area around a mild distraction.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Use the Routine During a Normal Walk', 'Integrate the potty area into the ordinary walking routine.', 'The dog follows the route, uses the cue once, and continues the walk calmly afterward.', 'Approach the area during the walk.', 'Complete the routine and resume the walk.', 'Use a dedicated short potty trip.', 'My dog used the outdoor potty routine during a normal walk.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Use the Outdoor Routine on Another Day', 'Use the outdoor potty routine once on a later day.', 'The dog reaches the area safely and, if elimination occurs, is rewarded after completion.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Small treats","detail":"Use soft, bite-sized treats your dog can eat quickly."},{"label":"A leash and outdoor area","detail":"Use one safe, permitted location with stable footing and room to pause."}]'::jsonb, 'Use a leash and follow local rules. Avoid traffic, extreme weather, unsafe surfaces, and conflict with people or animals. Clean up waste as required.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Walk to the outdoor potty area', 'Teach your dog one safe route to the outdoor area you selected.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The dog reaches the area on leash and remains briefly without pulling into danger.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Reward calm arrival', null, 'Mark when your dog pauses safely in the area, then give one treat.', 'Walk the short route on leash. Pause and reward calm arrival in the selected area. Repeat once if appropriate.', 'Then, only if the first part is comfortable and successful: Pause briefly in the area, keep the leash loose enough for safe movement, then reward calm attention. Repeat once.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word and leave the area calmly. Elimination is not required for Level 1.', 'My dog followed the route and paused safely in the outdoor potty area.', 'The outdoor area was not ready for safe practice today.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word and leave the area calmly. Elimination is not required for Level 1.', 'My dog followed the route and paused safely in the outdoor potty area.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'completion', 'completion', 5, null, 'Show authoritative Silver and remaining Energy only after settlement. A recorded practice is not a claim of mastery.', null, null, null, null, 'Level complete. The next sequential Level is ready.', 'Practice complete. An approved easier Review or Bridge is scheduled before returning to this Level.', null, '[{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  delete from training_adaptive_guidance where level_id = v_level1_id;

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog arrived but pulled, scanned, or needed repeated guidance.', 'starting_step', 'Choose a quieter time', 'Use the same area when fewer people, animals, or vehicles are nearby.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'The route or environment was too difficult to manage safely.', 'starting_step', 'Use a closer area', 'Choose a safe permitted area closer to the exit.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog paused once but stayed distracted or needed tension on the leash.', 'later_step', 'Increase distance from distractions', 'Move farther from people, animals, traffic, or other activity.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog could not pause safely in the area.', 'later_step', 'Shorten the pause', 'Reward the first brief still moment and leave the area.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use the quieter or closer route once, then check the arrival. Later-step retry: Use the easier distance or shorter pause once. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'OPT-L1-DEMO', 'not_produced', 'Sequence: choose a safe route; reward calm arrival; pause without pressure; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'OPT-L1-CLIP-01', 'Walk to safe outdoor area', 'The mascot walks on a loose, visibly safe leash path to a clear outdoor spot.', 'No traffic proximity, pulling, waste, or elimination imagery.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'OPT-L1-CLIP-02', 'Reward calm arrival outdoors', 'A treat is delivered after the mascot pauses in the selected area.', 'Reward does not imply elimination occurred.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'OPT-L1-CLIP-03', 'Pause with safe leash handling', 'The mascot remains manageable while the glove hand holds a loose leash at a safe distance from distractions.', 'No leash correction or tension.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'OPT-L1-CLIP-04', 'Release and leave area', 'A release gesture leads the mascot calmly away from the area.', 'No rushing, traffic, or unsafe path.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Use one normal potty trip without a teaching rehearsal.', 'My dog followed the route and used the selected area when needed.', 'The area or environment was not manageable or safe today. Also includes an unclear result: The route worked but required repeated guidance or timing was unclear.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not suitable for MVP AI verification', false, null, 'Outdoor elimination is private, context-sensitive, and not an appropriate camera Challenge.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 1 and s2.skill_code = '1-4'), 'shared_foundation', 'Foundation for Section 5. Section 5 adds indoor elimination, accident recovery, and outdoor context without resetting this progress.', false);

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 5 and s2.skill_code = '5-1'), 'related', 'Builds on 1-4 route consistency and complements 5-1 indoor context. Indoor and outdoor progress remain context-specific.', false);
end;
$do$;
