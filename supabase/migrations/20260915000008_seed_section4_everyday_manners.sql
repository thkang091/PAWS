insert into training_sections (curriculum_version_id, section_number, slug, title, description, source_to_product_adaptation, safety_boundary, sort_order)
select id, 4, 'everyday-manners', 'Everyday Manners', 'Build orientation, calm recovery, resting behavior, and predictable household routines.', '"Guardian control" language is replaced with observable orientation, distance, recovery, safe-space use, and predictable routines. Mild, controllable stimuli are used; uncontrolled reactivity is excluded.', 'Do not deliberately expose the dog to a trigger that causes intense barking, lunging, panic, shutdown, or loss of control. Increase distance, end the Lesson, or seek qualified support.', 4
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
  select sec.id, '4-1', 'NAME_RESPONSE', 'respond-to-your-name', 'Respond to Your Name', '스스로의 이름 자각시키기', 'Turn toward the guardian after one calm name cue in gradually more distracting settings.', 'Product content candidate; not published', 'Common soft Bridge for many Skills. It has one shared progress identity and never becomes a convenience hard lock.', 'Teach the dog that hearing their name once predicts useful information and reward for orienting toward the guardian.', '["Repeating or shouting the name until the dog responds.","Using the name as punishment or as a recall cue from unsafe situations.","Requiring eye contact; a head or body turn is sufficient.","Claiming one response proves attention in every environment."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 1
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 4
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Turn Toward the Name', 'Turn the head or body toward the guardian after one name cue.', 'The dog begins orienting within a brief observation window after one calm name cue.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Respond Across the Room', 'Orient from a short indoor distance.', 'The dog turns from across the room after one cue.', 'Increase distance by a few steps.', 'Reward when the dog orients.', 'Reduce the distance.', 'My dog turned toward me from across the room.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Respond Around Mild Movement', 'Orient while one small movement is present.', 'The dog turns after one cue despite the mild movement.', 'Add one slow guardian or object movement.', 'Cue the name and reward orientation.', 'Stop the movement first.', 'My dog responded to the name around mild movement.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Respond From Another Room', 'Orient and move toward the guardian from a nearby room.', 'The dog turns or approaches after one cue without repeated calling.', 'Use a doorway with visual contact.', 'Use a nearby room with partial visual contact.', 'Return to across-the-room practice.', 'My dog responded from a nearby room after one cue.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Respond in a Controlled Outdoor Area', 'Orient in a low-distraction outdoor setting.', 'The dog turns toward the guardian after one name cue while safely managed.', 'Practise at a quiet outdoor distance.', 'Repeat with one mild environmental distraction.', 'Increase distance from the distraction or return indoors.', 'My dog responded to the name in a controlled outdoor area.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Respond in a Normal Moment', 'Use one familiar context on another day.', 'The dog orients after one name cue without repeated calling.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Small treats","detail":"Use soft, bite-sized treats your dog can eat quickly."},{"label":"A quiet space","detail":"Use a familiar area with very little competing activity."}]'::jsonb, 'Use a normal voice and one cue. Stop if the environment is too distracting or your dog seems distressed.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Turn toward your name', 'Teach your dog that hearing their name once is worth checking in.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The dog begins orienting within a brief observation window after one calm name cue.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Reward the first turn', null, 'Say the name once. Mark the first head or body turn, then reward.', 'Wait until your dog looks slightly away. Say the name once, mark the first turn toward you, and reward. Repeat twice.', 'Then, only if the first part is comfortable and successful: Move one step to the side, wait until your dog looks away, say the name once, and reward the turn.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word and end after the final reward.', 'My dog turned toward me after one name cue in the quiet setting.', 'My dog was not ready to respond to the name in this setting.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word and end after the final reward.', 'My dog turned toward me after one name cue in the quiet setting.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'My dog turned only after I moved or showed food.', 'starting_step', 'Keep your body still', 'Say the name once without bending, waving, or reaching for food first.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog did not orient to the name.', 'starting_step', 'Move closer', 'Stand closer in a quieter moment and reward the smallest head turn.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog found me once but needed extra movement or food.', 'later_step', 'Make the movement smaller', 'Shift only half a step before using the name once.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog did not orient after the position change.', 'later_step', 'Stay in the same place', 'Return to the original close-distance setup.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use one closer, quieter repetition and mark the first turn. Later-step retry: Use the easier position once, then check the turn. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'NAM-L1-DEMO', 'not_produced', 'Sequence: wait for a neutral moment; reward the first turn; change position slightly; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'NAM-L1-CLIP-01', 'Neutral starting orientation', 'The mascot looks slightly away from the guardian cue in a quiet room.', 'No distraction or emotional interpretation.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'NAM-L1-CLIP-02', 'Reward the head turn', 'After one visual cue representing the name, the mascot turns and receives one treat.', 'One cue, immediate marker, no visible lure beforehand.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'NAM-L1-CLIP-03', 'Find the shifted guardian', 'A guide hand shifts sideways; after one cue the mascot turns toward the new position.', 'Small movement, no recall sprint or repeated cue.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'NAM-L1-CLIP-04', 'Release after check-in', 'A release gesture ends the interaction after the reward.', 'No prolonged staring requirement.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Say the name once during one normal, manageable moment.', 'My dog turned toward me after one cue.', 'My dog did not orient in that context. Also includes an unclear result: My dog responded slowly or only after extra movement.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'candidate for a simple future Challenge', true, 'Name Response', 'The dog begins orienting toward the guardian after one visible/audible name cue within a bounded, clearly observable setup.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;
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
  select sec.id, '4-2', 'VISUAL_TRIGGER_RECOVERY', 'notice-visual-triggers-calmly', 'Notice Visual Triggers Calmly', '시각적 자극에 대한 과민반응 억제', 'Notice one mild visual trigger at a safe distance, then reorient to the guardian.', 'Product content candidate; not published', 'Supports 6-5 Manage Alert Barking. High-intensity reactivity, lunging, or aggression is outside self-guided progression.', 'Teach a distance-based sequence in which the dog sees a low-intensity visual trigger, remains able to eat and move, and then turns back to the guardian for reinforcement.', '["Flooding, forced exposure, close approaches, or making the dog \"face the fear.\"","Practising with a trigger that produces lunging, panic, prolonged barking, freezing, or loss of control.","Claiming the dog is comfortable because they stop moving.","Using another person or animal without appropriate distance and consent."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 2
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 4
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Look and Turn Back', 'Notice one neutral object and turn back to the guardian.', 'The dog looks briefly, then reorients without tension or repeated cueing.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Notice a Slowly Moving Object', 'Recover from one slow, predictable movement.', 'The dog notices the movement and can reorient before arousal rises.', 'Move the object slowly once.', 'Reward look and return.', 'Reduce movement or increase distance.', 'My dog noticed slow movement and reoriented.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Notice a Person at Distance', 'Observe a calm person from a safe distance.', 'The dog looks and returns attention while remaining manageable.', 'Observe the person standing still.', 'Observe one slow person movement.', 'Increase distance or use a barrier.', 'My dog noticed a person at distance and reoriented.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Notice a Dog at Distance', 'Observe one calm dog only at a safe, controlled distance.', 'The dog can look and disengage without escalating.', 'Observe from a large distance.', 'Move away after one successful check-in.', 'Use a larger distance or skip this Level if safety is uncertain.', 'My dog noticed another dog at distance and disengaged.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Use the Pattern in a Normal Setting', 'Apply the look-and-return routine in one familiar real-world location.', 'The dog notices a mild trigger and reorients while the guardian maintains safe distance.', 'Choose one predictable trigger.', 'Complete one look-and-return sequence.', 'Return to a staged object or greater distance.', 'My dog used the look-and-return pattern in a normal setting.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Check the Visual Recovery Pattern Later', 'Use the look-and-return pattern once in a familiar setting on a later date.', 'The dog notices and reorients without escalation at the approved distance.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Small treats","detail":"Use soft, bite-sized treats your dog can eat quickly."},{"label":"A mild visual target","detail":"Choose one neutral, stationary object your dog can notice without becoming highly aroused."}]'::jsonb, 'Start far enough away that your dog can eat, move, and turn away. End the lesson if barking, lunging, freezing, hiding, or distress increases.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Look, then return', 'Teach your dog to notice one mild object and turn back to you for a reward.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The dog looks briefly, then reorients without tension or repeated cueing.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Mark the brief look', null, 'Mark one calm look at the object, then reward beside you.', 'Let your dog notice the object once. Mark the brief look and reward beside you. Repeat twice.', 'Then, only if the first part is comfortable and successful: Let your dog look once, then wait quietly for a turn back. Mark and reward the return.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word and leave the setup while your dog is still calm.', 'My dog noticed the mild object and turned back to me.', 'My dog was not ready for this visual target at this distance.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word and leave the setup while your dog is still calm.', 'My dog noticed the mild object and turned back to me.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'My dog stared longer or needed more distance.', 'starting_step', 'Increase the distance', 'Move farther away until your dog can glance and take a reward calmly.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog barked, lunged, froze, hid, or could not disengage.', 'starting_step', 'Use a simpler target', 'Choose a smaller, still, less interesting object.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog turned back once but needed movement or visible food.', 'later_step', 'Step farther away', 'Increase distance before waiting for the turn back.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog stayed fixed on the object or became more aroused.', 'later_step', 'Use your name once', 'At a safe distance, say your dog''s name once and reward the first turn.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use the easier target or distance for one brief look. Later-step retry: Use the easier distance or one name cue, then check the return. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'VIS-L1-DEMO', 'not_produced', 'Sequence: start far away; mark the brief look; reward the turn back; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'VIS-L1-CLIP-01', 'Notice a neutral object', 'The mascot glances at one stationary object from a generous distance.', 'No stare loop, lunging, fear display, or close exposure.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'VIS-L1-CLIP-02', 'Reward the calm glance', 'A treat is delivered beside the guardian after the brief glance.', 'Reward does not draw the mascot closer to the trigger.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'VIS-L1-CLIP-03', 'Turn back to guardian', 'After looking at the object, the mascot turns back toward the guide hand.', 'Clear disengagement; no repeated cue.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'VIS-L1-CLIP-04', 'Leave the setup calmly', 'A release gesture guides the mascot away from the trigger area.', 'Distance increases; no forced approach.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Complete one look-and-return repetition, then leave the area.', 'My dog noticed the trigger and turned back calmly.', 'My dog became too aroused or could not disengage. Also includes an unclear result: My dog reoriented but needed more distance or repeated help.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not recommended for early MVP AI verification', false, null, 'Trigger intensity and welfare thresholds require context that a single recording cannot safely standardize.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 6 and s2.skill_code = '6-5'), 'related', 'Everyday trigger recovery supports alert-barking work. High-risk reactivity remains outside self-guided progression.', false);
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
  select sec.id, '4-3', 'SOUND_RECOVERY', 'recover-from-everyday-sounds', 'Recover From Everyday Sounds', '청각적 자극에 대한 과민반응 억제', 'Hear one soft, predictable sound at a safe level and reorient without forced exposure.', 'Product content candidate; not published', 'Supports 6-5 Alert Barking. Sudden loud-sound correction is prohibited.', 'Teach a gradual sound-notice-reward-return pattern using low-volume, predictable sounds that the guardian can stop immediately.', '["Playing loud sounds, banging objects, startling the dog, or repeatedly increasing volume.","Using sound as punishment or to interrupt barking through fear.","Continuing when the dog hides, trembles, freezes, tries to escape, or cannot eat.","Claiming that one sound practice generalizes to storms, fireworks, or severe noise fear."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 3
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 4
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Notice a Soft Sound', 'Hear one very soft sound and remain able to eat and move.', 'The dog notices the sound without distress and can orient to the guardian.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Hear a Brief Household Sound', 'Recover from one familiar low-intensity household sound.', 'The dog notices and returns attention before arousal rises.', 'Use the sound once at low intensity.', 'Reward recovery.', 'Return to the softer sound.', 'My dog recovered from a brief household sound.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Hear a Door Sound at Low Volume', 'Practise with a soft recording or distant version of a knock/bell.', 'The dog can notice and reorient at the selected low intensity.', 'Play one very soft repetition.', 'Move to a resting spot or guardian.', 'Lower volume or increase distance.', 'My dog recovered from the low-volume door sound.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Hear a Real Sound From Distance', 'Use one real but predictable sound at a safe distance.', 'The dog notices and follows the recovery routine without escalation.', 'Arrange one distant sound.', 'Reward check-in and leave.', 'Use the recording or greater distance.', 'My dog used the recovery routine around a real distant sound.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Use the Pattern in a Normal Routine', 'Apply the sound-recovery routine once during ordinary life.', 'The dog notices one manageable sound and reorients or moves to the approved alternative.', 'Prepare reward and the alternative before the context.', 'Use the sequence once during the real moment.', 'Return to a controlled sound.', 'My dog used the recovery pattern during a normal sound event.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Repeat the Sound Recovery Later', 'Use the sound-recovery routine once in a familiar context on a later day.', 'The dog notices and reorients without distress at the approved intensity.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Small treats","detail":"Use soft, bite-sized treats your dog can eat quickly."},{"label":"A soft sound","detail":"Use one brief, predictable sound you can control at a very low volume."}]'::jsonb, 'Keep the sound soft and brief. Stop immediately if your dog hides, trembles, freezes, tries to escape, or seems distressed.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Start with a soft sound', 'Teach your dog that one gentle, predictable sound is followed by calm support and reward.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The dog notices the sound without distress and can orient to the guardian.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Reward calm noticing', null, 'Mark the first calm look or ear movement, then reward beside you.', 'Make or play the soft sound once. Mark a calm notice and reward. Repeat twice only if your dog remains comfortable.', 'Then, only if the first part is comfortable and successful: Use the sound once, wait quietly for a turn back, then mark and reward. Repeat twice.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word and end after the final calm reward. Do not increase the volume today.', 'My dog noticed the soft sound and reoriented calmly.', 'My dog was not ready for this sound at this intensity.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word and end after the final calm reward. Do not increase the volume today.', 'My dog noticed the soft sound and reoriented calmly.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'My dog startled or paused longer but recovered quickly.', 'starting_step', 'Lower the intensity', 'Make the sound softer or move the source farther away.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog hid, trembled, froze, tried to escape, or could not eat.', 'starting_step', 'Use a gentler sound', 'Choose a softer, shorter sound your dog already hears comfortably.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog reoriented once but needed extra movement or food.', 'later_step', 'Increase the distance', 'Move farther from the sound source before waiting for the turn back.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog remained focused on the sound or became more worried.', 'later_step', 'Use your name once', 'After the very soft sound, say your dog''s name once and reward the first turn.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use the gentler sound once and reward calm noticing. Later-step retry: Use the easier distance or one name cue, then check the return. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'SND-L1-DEMO', 'not_produced', 'Sequence: keep the sound very low; reward calm noticing; reward the turn back; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'SND-L1-CLIP-01', 'Notice a soft sound', 'A small neutral sound-source icon/prop activates once while the mascot makes one mild ear or head orientation.', 'No actual startling audio required; no fear animation.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'SND-L1-CLIP-02', 'Reward calm noticing', 'A treat arrives after the mascot notices and remains in place.', 'Reward follows calm response; no volume implication.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'SND-L1-CLIP-03', 'Turn back after sound', 'After the sound cue, the mascot turns back to the guardian hand.', 'One sound event; no repeated cue or escalation.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'SND-L1-CLIP-04', 'End at the same intensity', 'A release gesture ends the session without another sound.', 'No volume increase or surprise.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Present the sound once and complete the recovery routine.', 'My dog noticed the sound and reoriented calmly.', 'My dog showed distress or could not recover. Also includes an unclear result: My dog recovered but needed lower volume or repeated help.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not recommended for MVP AI verification', false, null, 'Sound intensity and distress thresholds cannot be standardized safely through one generated challenge.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 6 and s2.skill_code = '6-5'), 'related', 'Everyday trigger recovery supports alert-barking work. High-risk reactivity remains outside self-guided progression.', false);
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
  select sec.id, '4-4', 'RESTING_SPACE', 'use-your-resting-space', 'Use Your Resting Space', '지정된 독립적인 휴식공간 이용', 'Choose a familiar resting spot and remain there during gradually more realistic home activity.', 'Product content candidate; not published', 'Related to 1-2 Stay Off the Furniture. 1-2 teaches an access boundary; 4-4 deepens independent settling.', 'Teach the dog to move to a safe floor-level resting space, remain briefly while the guardian moves, and gradually use the space during ordinary household activity.', '["Confinement, isolation punishment, or using the resting space as a place of social exclusion.","Forcing a posture, long duration, sleep, or immobility.","Removing the dog''s ability to leave when they are uncomfortable.","Claiming the space treats separation anxiety or other clinical behavior concerns."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 4
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 4
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Choose the Resting Space', 'Move all four paws onto the mat or bed.', 'The dog enters the space and remains briefly without physical placement.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Stay While You Step Away', 'Remain while the guardian moves a short distance.', 'The dog stays during one short step away and return.', 'Take one step away.', 'Take two or three calm steps and return.', 'Use a weight shift or half-step.', 'My dog stayed while I stepped away and returned.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Stay for a Short Pause', 'Remain during one brief quiet pause.', 'The dog stays in any comfortable posture while the guardian pauses nearby.', 'Pause beside the space.', 'Pause after stepping away.', 'Shorten the pause.', 'My dog remained on the resting space for a short pause.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Settle During Mild Activity', 'Use the space while one mild household movement occurs.', 'The dog remains or returns during the approved mild activity.', 'Move one household item slowly.', 'Walk a short route nearby.', 'Use less movement.', 'My dog used the resting space during mild household activity.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Choose the Space Independently', 'Move to the space with a reduced cue during a normal routine.', 'The dog chooses or returns to the space without visible food guidance.', 'Give one cue from a short distance.', 'Reward after the independent choice.', 'Stand closer or point with an empty hand.', 'My dog chose the resting space with reduced help.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Use the Resting Space During a Normal Routine', 'Use the resting space once during a normal routine on a later day.', 'The dog chooses or remains on the space while the routine occurs.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Small treats","detail":"Use soft, bite-sized treats your dog can eat quickly."},{"label":"A resting space","detail":"Use one comfortable mat or dog bed placed in a calm, accessible area."}]'::jsonb, 'Keep the resting space accessible and voluntary. Stop if your dog appears distressed, avoids the space, or cannot settle safely.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Choose the resting space', 'Teach your dog to move onto one comfortable mat or bed.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The dog enters the space and remains briefly without physical placement.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Reward on the space', null, 'Mark when all four paws are on the space, then reward there.', 'Guide your dog onto the resting space. Mark and reward when all four paws are on it. Repeat twice.', 'Then, only if the first part is comfortable and successful: Take one small step away, return, and reward on the space.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word and allow your dog to leave the resting space.', 'My dog chose the resting space and stayed while I took one small step away.', 'My dog was not ready to stay on the resting space when I moved.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word and allow your dog to leave the resting space.', 'My dog chose the resting space and stayed while I took one small step away.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'My dog used it only while following visible food.', 'starting_step', 'Hide the treat', 'Keep the treat out of sight and reward only after your dog enters the space.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog avoided the space or stepped off immediately.', 'starting_step', 'Make the space larger', 'Use a larger mat or place the space directly beside you.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog stayed once but followed me or needed visible food.', 'later_step', 'Use a half-step', 'Make the movement smaller and return quickly to reward on the space.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog left the space when I moved.', 'later_step', 'Use a weight shift', 'Lean away without taking a full step.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use the easier space once and reward the first full step onto it. Later-step retry: Use one easier movement and check whether your dog stays. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'RSTSP-L1-DEMO', 'not_produced', 'Sequence: make the space easy to find; reward on the space; take one small step away; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'RSTSP-L1-CLIP-01', 'Enter the resting space', 'The mascot moves onto a comfortable mat or bed and stops with all paws inside.', 'No confinement or forced posture; space remains accessible.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'RSTSP-L1-CLIP-02', 'Reward on the space', 'A treat is delivered on the mat after the mascot enters.', 'Reward does not pull mascot away.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'RSTSP-L1-CLIP-03', 'Stay while guardian steps away', 'A guide hand shifts one small step away while the mascot remains.', 'No long duration or looping; exit path visible.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'RSTSP-L1-CLIP-04', 'Release from resting space', 'A release gesture allows the mascot to step off calmly.', 'Leaving is allowed and not framed as failure.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Begin one familiar calm routine and use the resting-space cue once.', 'My dog used the resting space during the routine.', 'My dog left repeatedly or avoided the space. Also includes an unclear result: My dog used it briefly but needed repeated help.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'candidate after content/device validation', true, 'Go to Your Resting Space', 'The dog moves all four paws onto a visible resting space after one cue and remains briefly without restraint.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 1 and s2.skill_code = '1-2'), 'related', '1-2 teaches a furniture-access boundary; 4-4 deepens independent settling. Progress may support a warm-up Bridge but does not auto-complete the other Skill.', false);
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
  select sec.id, '4-5', 'DAILY_ROUTINE_SEQUENCE', 'follow-a-daily-routine', 'Follow a Daily Routine', '바른 생활 패턴 및 습관', 'Use one consistent starting cue and location for a normal meal, walk, or bedtime routine.', 'Product content candidate; not published', 'A routine organizer Skill. It does not read Care data or alter Train recommendations; the guardian chooses one routine inside the Lesson.', 'Teach one predictable two-step routine through a consistent starting cue, location, and access consequence, then generalize the sequence without rigid clock-based claims.', '["Prescribing universal feeding, walking, sleep, or health schedules.","Requiring exact clock times or treating a missed routine as failure.","Using Care completion as Train success or Silver eligibility.","Claiming the routine fixes medical, sleep, or behavior conditions."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 5
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 4
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Start From One Place', 'Move to one consistent starting place before the routine.', 'The dog enters the starting place and pauses before the routine begins.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Add One Starting Cue', 'Pair one short cue with the routine start.', 'The dog moves toward the starting place after one cue.', 'Say the cue once.', 'Begin the routine after arrival.', 'Stand closer to the starting place.', 'My dog moved to the starting place after one cue.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Build a Two-Step Sequence', 'Complete the starting place plus one next action.', 'The dog follows both steps in the same order.', 'Complete the start step.', 'Complete the next routine step.', 'Practise only the first step.', 'My dog completed the two-step routine in order.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Use the Routine With Mild Variation', 'Keep the sequence when one small non-essential detail changes.', 'The dog follows the routine despite the approved mild variation.', 'Change one small guardian position or prop.', 'Complete the same sequence.', 'Return to the usual setup.', 'My dog followed the routine with one mild variation.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Use the Routine in Daily Life', 'Complete the sequence during the normal routine without a teaching rehearsal.', 'The dog follows the start cue and sequence during ordinary use.', 'Use the normal routine once.', 'End clearly after completion.', 'Return to a staged repetition.', 'My dog followed the routine during normal daily life.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Repeat the Routine on Another Day', 'Use the established routine once on a later day.', 'The dog begins at the selected place and follows the established order.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"One daily routine","detail":"Choose one familiar meal, walk, or bedtime routine for this lesson."},{"label":"One starting place","detail":"Use a clear spot where the routine will begin each time."}]'::jsonb, 'Use only a safe, normal routine. Stop if the routine creates distress, guarding, pain, or unsafe rushing.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Start from one place', 'Teach your dog that one clear place begins the routine you selected.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The dog enters the starting place and pauses before the routine begins.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Reward arrival', null, 'Mark when your dog arrives at the starting place, then begin the routine.', 'Guide your dog to the starting place. Mark the arrival and begin the chosen routine. Repeat twice if appropriate.', 'Then, only if the first part is comfortable and successful: Guide to the starting place, wait for one brief pause, then begin the routine. Repeat once.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one clear end cue when the selected routine step is complete.', 'My dog used the starting place and paused before the routine began.', 'My dog was not ready to use the starting place for this routine.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one clear end cue when the selected routine step is complete.', 'My dog used the starting place and paused before the routine began.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'My dog arrived only while following visible food or repeated guidance.', 'starting_step', 'Make the place clearer', 'Use a larger mat or stand directly beside the starting place.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog did not move to or remain at the starting place.', 'starting_step', 'Shorten the distance', 'Begin only one step away from the starting place.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog paused once but rushed into the routine.', 'later_step', 'Make the pause shorter', 'Reward the first brief still moment and begin the routine immediately.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog could not pause at the starting place.', 'later_step', 'Begin after arrival', 'Skip the pause and begin the routine as soon as your dog reaches the place.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use the clearer, closer starting place once. Later-step retry: Use the easier arrival-and-start sequence once. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'RUT-L1-DEMO', 'not_produced', 'Sequence: choose the starting place; reward arrival; pause before the routine begins; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'RUT-L1-CLIP-01', 'Move to routine start place', 'The mascot moves to one clearly marked starting place beside a neutral routine prop.', 'No fixed medical or feeding schedule implied; one routine only.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'RUT-L1-CLIP-02', 'Reward arrival', 'A reward or access cue follows after the mascot reaches the start place.', 'Clear sequence; no visible lure required.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'RUT-L1-CLIP-03', 'Pause before routine begins', 'The mascot remains briefly at the start place while the routine prop stays unavailable.', 'Very short pause; no long restraint.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'RUT-L1-CLIP-04', 'Begin and end the routine', 'A release/start cue begins the routine, followed by a clear end gesture.', 'No promise about exact schedule or health effect.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Use the normal routine once without a rehearsal.', 'My dog followed the established start and sequence.', 'The routine start or order was not clear. Also includes an unclear result: The sequence happened but needed repeated guidance.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not a direct Game Challenge', false, null, 'The selected routine varies by household and is better kept as a guardian-guided Train sequence.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;
end;
$do$;
