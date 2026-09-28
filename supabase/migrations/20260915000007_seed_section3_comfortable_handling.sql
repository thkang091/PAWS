insert into training_sections (curriculum_version_id, section_number, slug, title, description, source_to_product_adaptation, safety_boundary, sort_order)
select id, 3, 'comfortable-handling', 'Comfortable Handling', 'Gradual, choice-based preparation for touch, hygiene, nail care, bathing, and another familiar handler.', 'The source desensitization goals are retained, but sudden touch, forced restraint, and compulsory lifting are not. The dog may move away; the guardian pauses between steps and stops when observable discomfort, pain, fear, or aggression appears.', 'Handling Lessons are not treatment for pain, severe fear, or aggression. Stop for stiffness, repeated avoidance, growling, snapping, yelping, limping, or sudden behavior change, and seek veterinary or qualified behavior support as appropriate.', 3
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
  select sec.id, '3-1', 'EVERYDAY_TOUCH', 'enjoy-everyday-touch', 'Enjoy Everyday Touch', '일상적인 터치 익숙화', 'Build comfort with brief, predictable touch on easy body areas while preserving the dog''s choice to move away.', 'Product content candidate; not published', 'Foundation for 3-2, 3-3, and 3-5. It may be inserted as a short Handling Bridge but never bypasses a safety stop.', 'Teach a simple touch-pause-reward pattern, beginning with the shoulder or side and expanding only when the dog remains willing and relaxed enough to continue.', '["Holding the dog still, hugging, cornering, rolling over, or forcing access to sensitive areas.","Assuming stillness means comfort; freezing or shutdown must not be rewarded as consent.","Using touch to diagnose pain or medical conditions.","Reaching for the face, feet, belly, or rear before easier touch is established."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 1
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 3
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'One Gentle Shoulder Touch', 'Accept one brief touch on the shoulder or side.', 'The dog remains available for one light touch and a pause without physical restraint.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Touch the Neck and Back', 'Extend the same pattern to the neck side and upper back.', 'The dog accepts one brief touch in each approved area and may move away between repetitions.', 'Touch the side of the neck briefly.', 'Touch the upper back briefly.', 'Return to the shoulder or use a shorter touch.', 'My dog accepted brief neck-side and upper-back touch.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Touch the Chest and Side', 'Add a brief touch to the chest front or side of the body.', 'The dog stays willingly available through one brief touch and pause.', 'Touch the chest front or side once.', 'Repeat after a clear pause.', 'Use the shoulder instead.', 'My dog remained available for a brief chest or side touch.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Build a Short Touch Sequence', 'Combine two easy body areas in one calm sequence.', 'The dog accepts two brief touches separated by pauses and rewards.', 'Touch area one and pause.', 'Touch area two and finish.', 'Use only one area.', 'My dog accepted a short two-area touch sequence.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Practise With a Familiar Person', 'Repeat one easy touch with another familiar adult.', 'The dog may approach or remain available and accepts one brief touch without restraint.', 'The familiar person offers a treat and pauses.', 'The person gives one approved shoulder touch.', 'Keep the person nearby without contact.', 'My dog accepted one brief easy touch from a familiar adult.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Repeat the Touch Routine on Another Day', 'Use the familiar touch-pause-reward pattern later.', 'The dog remains available for two familiar touches and can move away between them.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Small treats","detail":"Use soft, bite-sized treats your dog can eat quickly."},{"label":"A quiet space","detail":"Choose a non-slip area where your dog can step away freely."}]'::jsonb, 'Touch only an easy body area. Stop if your dog moves away repeatedly, becomes stiff, growls, yelps, or seems painful or distressed.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Start with one easy touch', 'Teach your dog that a brief shoulder or side touch is followed by a pause and reward.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The dog remains available for one light touch and a pause without physical restraint.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Reward calm availability', null, 'If your dog remains available, mark and reward before the first touch.', 'Move your empty hand toward the shoulder, pause, and reward if your dog remains available. Repeat twice.', 'Then, only if the first part is comfortable and successful: Touch the shoulder lightly for one brief moment, remove your hand, and reward. Repeat twice only if your dog remains available.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word and give your dog space to move away or rest.', 'My dog remained available for one brief shoulder or side touch.', 'My dog was not ready for a brief touch today.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word and give your dog space to move away or rest.', 'My dog remained available for one brief shoulder or side touch.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'My dog stayed but turned away, leaned away, or became less comfortable.', 'starting_step', 'Approach more slowly', 'Stop your hand farther away and reward before moving any closer.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog moved away or did not want the hand to approach.', 'starting_step', 'Remove the touch', 'Reward only for calmly noticing the hand nearby.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog accepted one touch but moved away or became less comfortable.', 'later_step', 'Shorten the touch', 'Use a lighter, shorter touch and remove your hand immediately.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog avoided the touch or showed clear discomfort.', 'later_step', 'Return to hand approach', 'Practise the hand approaching without making contact.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use one slower approach and stop at the distance your dog can comfortably accept. Later-step retry: Use the easier touch or approach once, then stop and check the response. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'TCH-L1-DEMO', 'not_produced', 'Sequence: let the hand approach; reward calm availability; touch, pause, reward; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'TCH-L1-CLIP-01', 'Hand approaches shoulder', 'A warm-white open hand moves slowly toward the mascot''s shoulder and stops before contact.', 'No overhead reach, looming, restraint, or sudden motion.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'TCH-L1-CLIP-02', 'Reward calm availability', 'A treat hand rewards while the mascot remains free to move.', 'No cornering; no emotional claim; exit path remains visible.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'TCH-L1-CLIP-03', 'Brief shoulder touch', 'The open hand makes one light shoulder touch, immediately withdraws, and the mascot stays neutral.', 'One contact only; no stroking loop, pressure, or anatomy distortion.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'TCH-L1-CLIP-04', 'Release and give space', 'A release gesture occurs and the mascot may calmly step away.', 'Moving away is shown as allowed, not failure.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Use two previously successful body areas, one touch each.', 'My dog remained available for the familiar touch routine.', 'My dog avoided contact or showed clear discomfort. Also includes an unclear result: My dog accepted some touch but moved away or became less comfortable.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not suitable for MVP AI verification', false, null, 'Handling comfort cannot be safely reduced to a single camera PASS and should remain guardian-reflected with stop boundaries.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 3 and s2.skill_code = '3-2'), 'shared_foundation', 'Foundation for 3-2, 3-3, and 3-5. It may be inserted as a short Handling Bridge but never bypasses a safety stop.', false);

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 3 and s2.skill_code = '3-3'), 'shared_foundation', 'Foundation for 3-2, 3-3, and 3-5. It may be inserted as a short Handling Bridge but never bypasses a safety stop.', false);

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 3 and s2.skill_code = '3-5'), 'shared_foundation', 'Foundation for 3-2, 3-3, and 3-5. It may be inserted as a short Handling Bridge but never bypasses a safety stop.', false);
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
  select sec.id, '3-2', 'NAIL_CARE_PREPARATION', 'prepare-for-nail-care', 'Prepare for Nail Care', '발톱깎기 둔감화', 'Build a gradual leg-to-paw-to-tool routine before attempting one nail.', 'Product content candidate; not published', 'Builds on 3-1 Everyday Touch. Existing touch comfort can shorten warm-up but does not skip Levels automatically.', 'Prepare for nail care through choice-based touch, stable footing, gradual paw contact, tool sight/sound exposure, and finally one carefully bounded nail-care attempt.', '["Holding the paw until the dog stops resisting.","Clipping multiple nails because one repetition succeeded.","Proceeding through pain, limping, damaged nails, bleeding, growling, or panic.","Using an AI clip or self-report as proof that nail care is medically safe."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 2
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 3
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Touch the Leg', 'Accept one brief touch on the lower leg.', 'The dog remains available for one light lower-leg touch and pause without restraint.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Touch the Paw and Pad', 'Accept brief paw-top and pad contact.', 'The dog allows one brief paw touch without the paw being held tightly.', 'Touch the paw top.', 'Briefly touch one pad.', 'Return to the lower leg.', 'My dog accepted brief paw and pad touch.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Touch One Toe and Nail', 'Accept one brief toe and nail touch.', 'One toe is touched lightly, then released immediately.', 'Touch one toe.', 'Touch the nail surface once.', 'Return to the paw top.', 'My dog accepted one brief toe and nail touch.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'See and Hear the Tool', 'Remain comfortable with the nail tool at a safe distance.', 'The dog can observe the tool and one low-intensity sound without forced proximity.', 'Show the tool at distance and reward.', 'Make one soft tool sound away from the paw.', 'Increase distance or use the closed, silent tool.', 'My dog remained comfortable with the tool sight and sound.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Care for One Nail', 'Complete one carefully prepared nail-care action.', 'One nail is handled or trimmed under the approved technique, then the session ends.', 'Complete the familiar touch sequence.', 'Perform one nail-care action and stop.', 'Touch the tool to the nail without trimming.', 'We completed one prepared nail-care action safely.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Repeat One Nail-Care Step Later', 'Repeat the highest comfortable step on another day.', 'The dog remains available for the selected step and can withdraw.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Small treats","detail":"Use soft, bite-sized treats your dog can eat quickly."},{"label":"A non-slip surface","detail":"Choose a stable mat where your dog can stand or lie down and move away."}]'::jsonb, 'Do not use clippers in Level 1. Stop for pain, limping, damaged nails, growling, snapping, or distress. Seek veterinary or qualified grooming help when needed.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Start with the leg', 'Teach your dog that one brief lower-leg touch is followed by a pause and reward.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The dog remains available for one light lower-leg touch and pause without restraint.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Reward before contact', null, 'If your dog remains available, mark and reward the calm approach.', 'Move your empty hand toward one lower leg, pause, and reward. Repeat twice.', 'Then, only if the first part is comfortable and successful: Give one brief lower-leg touch, remove your hand, and reward. Repeat only if your dog stays available.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word and give your dog space. Do not continue to the paw today.', 'My dog remained available for one brief lower-leg touch.', 'My dog was not ready for lower-leg touch today.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word and give your dog space. Do not continue to the paw today.', 'My dog remained available for one brief lower-leg touch.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'My dog stayed but shifted away or became less comfortable.', 'starting_step', 'Stay higher on the leg', 'Approach closer to the shoulder and stop before your dog shifts away.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog moved away or protected the leg.', 'starting_step', 'Return to shoulder touch', 'Use one familiar shoulder touch from Everyday Touch.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog accepted one touch but shifted away afterward.', 'later_step', 'Use lighter contact', 'Touch with fewer fingers and remove your hand immediately.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog avoided the touch or showed clear discomfort.', 'later_step', 'Return to approach only', 'Practise bringing your hand near the leg without contact.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use one slower approach at the easier body area. Later-step retry: Use one easier approach or touch, then stop. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'NAI-L1-DEMO', 'not_produced', 'Sequence: approach the leg slowly; reward before contact; touch, release, reward; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'NAI-L1-CLIP-01', 'Hand approaches lower leg', 'A warm-white hand approaches the mascot''s lower leg slowly and pauses.', 'No paw lifting, clippers, restraint, or overhead reach.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'NAI-L1-CLIP-02', 'Reward the approach', 'A treat is delivered after the mascot remains available for the hand approach.', 'No lure or paw holding.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'NAI-L1-CLIP-03', 'Brief lower-leg touch', 'The hand gives one light lower-leg touch and immediately withdraws.', 'Single contact, stable footing, no discomfort animation or force.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'NAI-L1-CLIP-04', 'Release and rest', 'A release gesture ends the session and the mascot can step away.', 'No progression to paw or tool in Level 1.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Choose the last successful step, complete it once, and end.', 'My dog remained available for the selected nail-care step.', 'My dog withdrew or showed clear discomfort. Also includes an unclear result: My dog accepted part of the step but showed hesitation.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not suitable for MVP AI verification', false, null, 'Nail-care comfort and safety require nuanced handling and cannot be reduced to one automated PASS.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 3 and s2.skill_code = '3-1'), 'related', 'Builds on 3-1 Everyday Touch. Existing touch comfort can shorten warm-up but does not skip Levels automatically.', false);
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
  select sec.id, '3-3', 'HYGIENE_CHECK_PREPARATION', 'prepare-for-hygiene-checks', 'Prepare for Hygiene Checks', '위생관리 일상화', 'Build brief, external checks around the ears, eyes, lips, and rear area without forcing care.', 'Product content candidate; not published', 'Builds on 3-1. It is preparation for observation only, not medical examination or treatment.', 'Teach short, predictable touch-and-look steps for hygiene areas, one region per Level, while keeping the dog free to disengage and preserving clear veterinary referral boundaries.', '["Inserting objects into the ear, eye, mouth, or rectal area.","Cleaning, medicating, expressing glands, brushing teeth, or diagnosing a condition.","Holding the muzzle, forcing the mouth open, or restraining the dog in place.","Continuing through pain, discharge, swelling, odor, bleeding, or aggression."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 3
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 3
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Touch the Ear Flap', 'Accept one brief external ear-flap touch.', 'The dog remains available for one light touch on the outside of the ear flap.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Check Beside the Eye', 'Accept a brief touch near, not on, the eye area.', 'The dog remains available while one finger touches the cheek below or beside the eye.', 'Approach the cheek.', 'Touch beside the eye and withdraw.', 'Touch farther back on the cheek.', 'My dog accepted a brief touch beside the eye.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Lift One Lip Briefly', 'Allow a short external lip lift without forcing the mouth open.', 'One lip edge is lifted briefly, then released immediately.', 'Touch the side of the muzzle.', 'Lift one lip edge and reward.', 'Remain at muzzle-side touch.', 'My dog accepted one brief lip lift.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Check the Tail-Base Area', 'Accept one brief external touch near the tail base or rear side.', 'The dog remains available for one light external touch without restraint.', 'Approach from the side.', 'Touch briefly and reward.', 'Touch farther forward on the back.', 'My dog accepted one brief external rear-area touch.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Complete a Short Hygiene Sequence', 'Combine two previously comfortable external checks.', 'The dog remains available through two brief checks with a pause between them.', 'Complete check one and pause.', 'Complete check two and finish.', 'Use one check only.', 'My dog remained available for a short two-step hygiene check.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Repeat One Hygiene Check Later', 'Repeat a familiar external check on another day.', 'The dog remains available and can disengage before or after the check.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Small treats","detail":"Use soft, bite-sized treats your dog can eat quickly."},{"label":"A quiet space","detail":"Choose a non-slip area where your dog can move away freely."}]'::jsonb, 'This lesson is for brief external checks only. Stop for pain, discharge, swelling, strong odor, bleeding, growling, snapping, or distress, and contact a veterinarian when appropriate.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Start with the outer ear', 'Teach your dog that one brief touch to the outside of the ear is followed by a pause and reward.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The dog remains available for one light touch on the outside of the ear flap.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Reward the calm approach', null, 'If your dog remains available, mark and reward before touching the ear.', 'Approach beside the ear, pause, and reward. Repeat twice.', 'Then, only if the first part is comfortable and successful: Give one brief touch to the outside of the ear flap, withdraw, and reward. Repeat only if your dog stays available.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word and give your dog space. Do not inspect inside the ear in this lesson.', 'My dog remained available for one brief outer-ear touch.', 'My dog was not ready for outer-ear touch today.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word and give your dog space. Do not inspect inside the ear in this lesson.', 'My dog remained available for one brief outer-ear touch.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'My dog stayed but turned away or became less comfortable.', 'starting_step', 'Approach from the side', 'Keep your hand below eye level and stop farther from the ear.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog moved away or avoided the hand.', 'starting_step', 'Return to neck-side touch', 'Use one familiar touch on the side of the neck instead.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog accepted one touch but turned away afterward.', 'later_step', 'Touch a smaller area', 'Use one fingertip on the outer edge and remove it immediately.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog avoided the touch or showed discomfort.', 'later_step', 'Return to the approach', 'Bring your hand near the ear without touching it.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use one slower side approach at the easier distance. Later-step retry: Use one easier approach or touch, then stop. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'HYG-L1-DEMO', 'not_produced', 'Sequence: approach beside the ear; reward the calm approach; touch the ear flap briefly; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'HYG-L1-CLIP-01', 'Hand approaches beside ear', 'A warm-white hand moves slowly toward the side of the mascot''s head and pauses.', 'No overhead reach or inner-ear contact.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'HYG-L1-CLIP-02', 'Reward the approach', 'A treat follows after the mascot remains available.', 'No lure toward the hand; exit path visible.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'HYG-L1-CLIP-03', 'Brief outer-ear touch', 'One fingertip touches the outside ear-flap edge and withdraws immediately.', 'No ear lifting, cleaning tool, or internal contact.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'HYG-L1-CLIP-04', 'Release and give space', 'A release gesture ends the check and the mascot may step away.', 'Moving away remains allowed.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Choose one previously successful area and complete one brief check.', 'My dog remained available for the familiar check.', 'My dog moved away or showed discomfort. Also includes an unclear result: My dog accepted part of it but showed hesitation.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not suitable for MVP AI verification', false, null, 'Hygiene handling requires nuance, privacy, and medical boundaries that are not appropriate for an automated PASS.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 3 and s2.skill_code = '3-1'), 'related', 'Builds on 3-1. It is preparation for observation only, not medical examination or treatment.', false);
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
  select sec.id, '3-4', 'BATH_TOWEL_PREPARATION', 'stay-calm-for-bath-and-towel', 'Stay Calm for Bath and Towel', '목욕 및 수건으로 물기 닦을 시 기다리기', 'Build comfort with a dry bath area, low-intensity water cues, damp touch, and a brief towel routine.', 'Product content candidate; not published', 'Builds on 3-1 Everyday Touch and may use 4-4 Resting Space as a recovery location.', 'Prepare the dog gradually for bathing and towel handling, beginning with a dry non-slip surface and adding water and towel steps only when the previous condition remains comfortable and safe.', '["Forcing the dog into a tub, spraying the face, restraining, flooding, or completing a full bath in one early Lesson.","Using hot or cold water, slippery footing, loud dryers, or startling water sounds.","Continuing through shaking, escape attempts, growling, pain, or panic.","Replacing veterinary or grooming support for skin, ear, mobility, or behavior concerns."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 4
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 3
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Step Onto a Dry Bath Mat', 'Choose and remain briefly on the dry non-slip surface.', 'All four paws move onto the dry mat and remain for one brief moment.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Notice Water at a Distance', 'Remain comfortable with low-intensity water sight or sound far away.', 'The dog remains below distress threshold while water is briefly present at distance.', 'Show a small container of water.', 'Run a very soft distant trickle briefly.', 'Increase distance or use still water only.', 'My dog remained available around low-intensity water cues.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Accept a Damp Cloth Touch', 'Accept one brief damp-cloth touch on an easy body area.', 'The dog remains available for one light damp touch and pause.', 'Show the damp cloth.', 'Touch shoulder or side once.', 'Use a dry cloth or no contact.', 'My dog accepted one brief damp-cloth touch.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Accept a Brief Towel Press', 'Accept one gentle towel press without rubbing.', 'The dog remains available for one brief press and release.', 'Show and place the towel nearby.', 'Press gently on the shoulder or side once.', 'Use a dry cloth touch.', 'My dog accepted one brief towel press.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Complete a Short Bath-and-Towel Sequence', 'Combine one mild wetting step and one towel step.', 'The dog remains available through the short sequence with pauses and exit choice.', 'Complete the approved low-intensity water step.', 'Complete one towel press and finish.', 'Use only the damp cloth and towel.', 'My dog completed a short bath-and-towel sequence.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Repeat the Comfortable Bath Step Later', 'Repeat the highest comfortable step on another day.', 'The dog remains available and footing, water, and handling stay within the approved condition.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Small treats","detail":"Use soft, bite-sized treats your dog can eat quickly."},{"label":"A non-slip bath mat","detail":"Use a dry, stable mat in or beside the bath area."}]'::jsonb, 'Keep the area dry and non-slip in Level 1. Stop if your dog tries to escape, shakes repeatedly, becomes stiff, or seems distressed.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Start with a dry mat', 'Teach your dog to step onto a dry, non-slip bath mat before adding any water.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: All four paws move onto the dry mat and remain for one brief moment.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Reward all four paws', null, 'Mark when all four paws are on the mat, then reward on the mat.', 'Guide your dog onto the dry mat. Mark and reward when all four paws are on it. Repeat twice.', 'Then, only if the first part is comfortable and successful: Take one small step beside the mat, return, and reward if all four paws stay on it.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word and invite your dog off the mat. No water is used in Level 1.', 'My dog stepped onto and stayed briefly on the dry bath mat.', 'My dog was not ready to stay on the dry bath mat.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word and invite your dog off the mat. No water is used in Level 1.', 'My dog stepped onto and stayed briefly on the dry bath mat.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'My dog stepped on only while following visible food.', 'starting_step', 'Hide the treat', 'Keep the treat out of sight and reward only after all four paws are on the mat.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog avoided the mat or stepped off immediately.', 'starting_step', 'Move the mat away from the bath', 'Place the same dry mat in a familiar open room.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog stayed once but followed me or needed visible food.', 'later_step', 'Use a half-step', 'Make the movement smaller and reward on the mat when you return.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog left the mat when I moved.', 'later_step', 'Use a weight shift', 'Lean slightly without taking a full step.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use the easier mat location once and reward the first full step onto it. Later-step retry: Use one easier movement and check whether your dog stays on the mat. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'BAT-L1-DEMO', 'not_produced', 'Sequence: make the mat easy to enter; reward all four paws; add one small movement; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'BAT-L1-CLIP-01', 'Enter the dry bath mat', 'The mascot walks onto a dry non-slip mat in an open bath area and stops.', 'No water, tub confinement, slippery surface, or jumping.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'BAT-L1-CLIP-02', 'Reward on the mat', 'A treat is delivered on the dry mat after all paws are inside.', 'No lure into a tub; reward follows position.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'BAT-L1-CLIP-03', 'Stay while guardian shifts', 'A neutral hand shifts slightly beside the mat while the mascot remains.', 'No water cue or looming; mascot stays free.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'BAT-L1-CLIP-04', 'Release from the dry mat', 'A release gesture allows the mascot to step off calmly.', 'Exit remains easy and safe.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Choose one previously successful step and complete it once.', 'My dog remained available for the selected bath or towel step.', 'My dog tried to leave repeatedly or showed distress. Also includes an unclear result: My dog completed part of it but showed hesitation.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not suitable for MVP AI verification', false, null, 'Bath and towel comfort requires welfare-sensitive handling and cannot be treated as a simple automated achievement.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 3 and s2.skill_code = '3-1'), 'related', 'Builds on 3-1 Everyday Touch and may use 4-4 Resting Space as a recovery location.', false);

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 4 and s2.skill_code = '4-4'), 'related', 'Builds on 3-1 Everyday Touch and may use 4-4 Resting Space as a recovery location.', false);
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
  select sec.id, '3-5', 'FAMILIAR_HANDLER_COMFORT', 'comfortable-with-another-handler', 'Comfortable With Another Handler', '타인의 갑작스러운 터치 및 들어올리기에 대한 과민반응 억제', 'Choose to approach and accept one brief, predictable touch from a familiar adult.', 'Product content candidate; not published', 'Builds on 3-1. Surprise touch and lifting are excluded from the self-guided progression; supported lifting requires separate professional guidance and suitability review.', 'Help the dog build a predictable, choice-based routine with another familiar adult: observe, approach, take a reward, accept one easy touch, and later tolerate approved collar or harness handling.', '["Sudden touch, forced greeting, crowding, cornering, hugging, or allowing children to test the Skill.","Lifting a dog without health, body-size, support, and handling guidance.","Treating freezing, hiding, growling, snapping, or lunging as ordinary uncertainty.","Claiming comfort with one familiar adult generalizes to strangers."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 5
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 3
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Choose to Approach', 'Approach a familiar adult voluntarily.', 'The dog closes some distance by choice and remains able to move away.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Take a Reward From the Adult', 'Accept a calmly offered reward without pressure.', 'The dog approaches and takes or receives a placed reward, then may retreat.', 'The adult tosses or places the treat away from their body.', 'The adult offers at a comfortable distance.', 'Toss the reward farther away.', 'My dog accepted a reward from the familiar adult.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Accept One Shoulder Touch', 'Accept one brief side or shoulder touch from the familiar adult.', 'The dog remains available for one brief touch and release.', 'The adult approaches the shoulder slowly.', 'One touch, withdraw, reward.', 'Use hand approach only.', 'My dog accepted one brief shoulder touch from the familiar adult.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Accept Collar or Harness Touch', 'Accept one brief touch to the side of a collar or harness.', 'The dog remains available while the adult touches the equipment briefly.', 'Touch near the shoulder.', 'Touch the side of the collar or harness once.', 'Return to shoulder touch.', 'My dog accepted one brief collar or harness touch.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Complete a Familiar-Handler Routine', 'Combine approach, reward, and one easy handling step.', 'The dog completes the short sequence by choice without restraint.', 'Approach and accept reward.', 'One approved touch and release.', 'Use approach and reward only.', 'My dog completed the familiar-handler routine by choice.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Repeat With the Same Familiar Adult', 'Repeat the familiar routine on another day.', 'The dog voluntarily approaches and accepts the approved step while retaining an exit path.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Small treats","detail":"Use soft, bite-sized treats your dog can eat quickly."},{"label":"A familiar adult","detail":"Use one calm adult your dog already knows. Do not use a child for practice."}]'::jsonb, 'Let your dog choose distance and move away. Stop for hiding, repeated avoidance, stiffness, growling, snapping, lunging, or distress.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Let your dog choose', 'Teach your dog that approaching a familiar adult is optional and rewarding.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The dog closes some distance by choice and remains able to move away.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Reward voluntary approach', null, 'When your dog moves closer by choice, mark and place a treat where they can retreat after taking it.', 'Ask the familiar adult to stay sideways and still. Mark and reward one voluntary step closer. Repeat twice.', 'Then, only if the first part is comfortable and successful: Have the adult place or toss one treat to a comfortable spot. Let your dog choose whether to approach.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word and allow your dog to leave. No touching or lifting occurs in Level 1.', 'My dog voluntarily approached and accepted a reward from the familiar adult.', 'My dog was not ready to approach the familiar adult today.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word and allow your dog to leave. No touching or lifting occurs in Level 1.', 'My dog voluntarily approached and accepted a reward from the familiar adult.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'My dog stayed nearby but hesitated or watched from a distance.', 'starting_step', 'Increase the distance', 'Move the adult farther away and have them look slightly away from your dog.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog moved away, hid, froze, or avoided the adult.', 'starting_step', 'Reward calm observation', 'Reward your dog for calmly noticing the adult without approaching.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog took the reward but remained hesitant.', 'later_step', 'Toss the reward farther away', 'Place the reward farther from the adult and closer to your dog''s preferred distance.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog would not approach the reward or showed discomfort.', 'later_step', 'Stay with observation', 'Reward calm observation without asking your dog to approach.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use the greater distance once and reward calm observation or one voluntary step. Later-step retry: Use the easier reward distance once, or end after calm observation. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'HAN-L1-DEMO', 'not_produced', 'Sequence: familiar adult stays sideways; reward voluntary approach; let the adult place the reward; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'HAN-L1-CLIP-01', 'Familiar adult stays sideways', 'A secondary original glove hand/abstract adult cue stays still to the side while the mascot observes from distance.', 'No full human body required; no reaching, looming, or blocked exit.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'HAN-L1-CLIP-02', 'Reward voluntary approach', 'A treat is placed away from the adult cue after the mascot takes one voluntary step closer.', 'No lure into contact; retreat path stays clear.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'HAN-L1-CLIP-03', 'Take a placed reward', 'The mascot approaches, takes a placed treat, and remains free to turn away.', 'No touch, collar handling, or lifting in Level 1.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'HAN-L1-CLIP-04', 'Release and create space', 'A release gesture ends the interaction and the mascot calmly increases distance.', 'Distance is respected and not framed as failure.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Use the highest previously successful handler step once.', 'My dog voluntarily completed the familiar-handler step.', 'My dog avoided, froze, or showed clear discomfort. Also includes an unclear result: My dog completed part of it but needed more distance or help.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not suitable for MVP AI verification', false, null, 'Voluntary social comfort and consent-sensitive handling cannot be safely reduced to one automated video result.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 3 and s2.skill_code = '3-1'), 'related', 'Builds on 3-1. Surprise touch and lifting are excluded from the self-guided progression; supported lifting requires separate professional guidance and suitability review.', false);
end;
$do$;
