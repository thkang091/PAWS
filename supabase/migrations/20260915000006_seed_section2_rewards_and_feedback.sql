insert into training_sections (curriculum_version_id, section_number, slug, title, description, source_to_product_adaptation, safety_boundary, sort_order)
select id, 2, 'rewards-and-clear-feedback', 'Rewards and Clear Feedback', 'Teach the guardian to mark good choices, pause access calmly, and reset without punishment.', 'The source contrast between “pleasant” and “unpleasant” consequences is retained only as a learning-design question: which choices make desired outcomes available, and which choices pause or redirect access. Water spraying, isolation punishment, intimidation, and punitive “No” training are not adopted.', 'Feedback must remain calm, predictable, and non-aversive. Do not remove food, toys, space, or social contact in a way that creates conflict, fear, guarding, or distress.', 2
from training_curriculum_versions where version_key = 'button-flow-v1.1'
on conflict (curriculum_version_id, section_number) do update set
  slug = excluded.slug, title = excluded.title, description = excluded.description,
  source_to_product_adaptation = excluded.source_to_product_adaptation, safety_boundary = excluded.safety_boundary, sort_order = excluded.sort_order;
insert into training_sections (curriculum_version_id, section_number, slug, title, description, source_to_product_adaptation, safety_boundary, sort_order)
select id, 2, 'rewards-and-clear-feedback', 'Rewards and Clear Feedback', 'Teach the guardian to mark good choices, pause access calmly, and reset without punishment.', 'The source contrast between “pleasant” and “unpleasant” consequences is retained only as a learning-design question: which choices make desired outcomes available, and which choices pause or redirect access. Water spraying, isolation punishment, intimidation, and punitive “No” training are not adopted.', 'Feedback must remain calm, predictable, and non-aversive. Do not remove food, toys, space, or social contact in a way that creates conflict, fear, guarding, or distress.', 2
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
  select sec.id, '2-1', 'MARKER_REWARD_FOUNDATION', 'mark-the-right-choice', 'Mark the Right Choice', '올바른 행동과 유쾌함 연결', 'Use one clear marker, then deliver a reward after the behavior you want.', 'Product content candidate; not published', 'Shared foundation for nearly every Train Skill. It may appear as an automatic 1-minute Bridge without duplicating progress.', 'Teach the guardian a precise marker-to-reward sequence, then use it for one easy, observable dog choice so feedback is clear and timely.', '["Using the marker as a command, threat, or repeated attention sound.","Showing food before every behavior or turning the reward into a permanent lure.","Claiming that a marker replaces all other context, management, or reinforcement planning.","Judging the dog''s intent, intelligence, or willingness from one response."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 1
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 2
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Pair the Marker With a Reward', 'Create a clear marker-then-reward sequence.', 'The marker occurs once and the treat follows immediately afterward, without the treat appearing first.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Keep the Timing Clear', 'Place the marker at the exact moment of one easy behavior.', 'The marker occurs while the target behavior is observable, followed by one reward.', 'Mark a head turn or paw-on-mat moment.', 'Repeat with the same criterion twice.', 'Choose an easier, slower behavior.', 'I marked the target behavior at the moment it happened.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Hide the Reward First', 'Keep food out of sight until after the marker.', 'The dog performs the target without following visible food; the reward appears after the marker.', 'Use empty hands during the behavior.', 'Reach for the reward only after marking.', 'Keep the reward in a pocket or container closer to hand.', 'My dog responded without seeing the reward first.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Use the Marker Across Two Behaviors', 'Apply the same marker rule to two already familiar choices.', 'The marker retains the same meaning across both behaviors.', 'Mark behavior one twice.', 'Mark behavior two twice.', 'Use only one behavior today.', 'I used the same clear marker rule for two behaviors.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Use It During a Daily Routine', 'Mark one desired choice during a normal home routine.', 'The marker and reward occur without interrupting safety or changing the criterion.', 'Choose one routine moment in advance.', 'Mark and reward the first clear success.', 'Return to a staged quiet setup.', 'I used the marker clearly during a normal routine.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Mark One Choice on Another Day', 'Use the same marker rule in a familiar routine later.', 'One clear behavior is marked once and rewarded afterward without visible luring.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Small treats","detail":"Use soft, bite-sized treats your dog can eat quickly."},{"label":"A marker word","detail":"Choose one short word, such as \"Yes,\" and use the same word during this lesson."}]'::jsonb, 'Use a normal voice and calm movements. Stop if the food creates tension, guarding, or distress.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Make your marker clear', 'Teach your dog that one short marker word is followed by a reward.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The marker occurs once and the treat follows immediately afterward, without the treat appearing first.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Keep the order consistent', null, 'Marker first. Reward second. Keep the treat out of sight until the marker.', 'Say your marker once, then give a treat. Repeat twice with a short pause between repetitions.', 'Then, only if the first part is comfortable and successful: Wait quietly for your dog to look or turn toward you. Mark the moment and reward. Repeat twice.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one short release word and put the treats away before ending the session.', 'I used one clear marker and delivered the reward afterward.', 'I was not ready to keep the marker-and-reward sequence clear.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one short release word and put the treats away before ending the session.', 'I used one clear marker and delivered the reward afterward.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'The treat appeared at the same time or my timing felt unclear.', 'starting_step', 'Slow the sequence down', 'Keep your hands still, say the marker once, then reach for the treat.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'I showed the treat first or repeated the marker.', 'starting_step', 'Practise without a behavior', 'Focus only on marker first and treat second for one repetition.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'I marked close to the right moment but my timing was not clear.', 'later_step', 'Choose a slower moment', 'Stand still and wait for a clear head turn before marking.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'I marked before or well after the turn.', 'later_step', 'Reduce the movement', 'Start close to your dog and mark the smallest turn toward you.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use one slow marker-then-treat repetition and check the order. Later-step retry: Wait for one clear head turn, mark once, and reward afterward. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'MRK-L1-DEMO', 'not_produced', 'Sequence: say the marker first; keep the order consistent; mark one easy choice; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'MRK-L1-CLIP-01', 'Marker before reward', 'A small visual marker cue occurs, then a treat hand enters afterward.', 'Cause-and-effect order is obvious; no audio required; no treat visible before marker.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'MRK-L1-CLIP-02', 'Deliver one reward', 'The glove hand delivers one treat calmly after the marker.', 'One hand, one treat, no repeated feeding or luring.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'MRK-L1-CLIP-03', 'Mark a head turn', 'The mascot turns toward the guardian cue; the marker occurs at the turn and reward follows.', 'Marker timing aligns with visible turn; no command repetition.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'MRK-L1-CLIP-04', 'End the marker session', 'A release gesture occurs and the treat hand leaves the scene.', 'No reward shower or excitement; clear end state.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Choose one familiar behavior and use the marker sequence once.', 'I marked the behavior clearly and rewarded afterward.', 'I could not create a clear marker-and-reward sequence. Also includes an unclear result: My timing was late, early, or the reward appeared first.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not a direct Game Challenge', false, null, 'This Skill primarily measures guardian timing and is better assessed through guardian self-report than one AI dog-performance recording.', 'Game remains optional and never completes or gates Train.')
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
  select sec.id, '2-2', 'ACCESS_PAUSE_AND_RESUME', 'pause-access-to-rewards', 'Pause Access to Rewards', '잘못된 행동과 불쾌함 연결', 'Pause a desired activity calmly, then resume when a simple safe choice appears.', 'Product content candidate; not published', 'Supports door, play, greeting, and food routines. It must never become punishment or prolonged deprivation.', 'Teach a predictable consequence without fear: pushing, grabbing, or rushing pauses access briefly; one calm alternative makes the activity available again.', '["Water spray, yelling, isolation, intimidation, physical correction, or withholding basic needs.","Taking a guarded object by force or provoking a conflict over resources.","Making the dog guess through long, unexplained pauses.","Using this Skill for fear, aggression, pain, or severe frustration."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 2
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 2
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Pause and Resume a Toy', 'Learn that a calm pause makes play available again.', 'The dog pauses reaching or grabbing for one brief moment, then receives the toy.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Pause Food Access Briefly', 'Use the same rule before a non-essential food reward.', 'The dog stops pushing toward the hand or bowl for one brief moment before access.', 'Cover or lift the reward without scolding.', 'Lower or uncover after the pause.', 'Use a lower-value reward or more distance.', 'My dog paused briefly before food access resumed.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Offer a Simple Alternative', 'Make one easy behavior the path back to the activity.', 'The dog performs the alternative and access resumes without repeated cues.', 'Pause the activity.', 'Cue one easy alternative and resume.', 'Practise the alternative before adding the activity.', 'My dog used the alternative before the activity resumed.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Use It in a Door or Play Routine', 'Apply the pause/resume rule in one familiar routine.', 'The routine pauses when the target boundary is crossed and resumes after the alternative.', 'Use the rule during one staged routine.', 'Repeat once with less visible reward.', 'Reduce the routine intensity.', 'The routine paused and resumed clearly around the target choice.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Apply the Rule Consistently', 'Use the same short pause across two familiar daily contexts.', 'The guardian uses the same calm rule and the dog can access the alternative in both contexts.', 'Use context one.', 'Use context two on a separate repetition.', 'Use only the easier context.', 'I applied the same calm pause-and-resume rule consistently.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Use the Pause Rule in a Normal Routine', 'Apply the familiar rule once on another day.', 'Access pauses briefly without punishment and resumes after the approved calm choice.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"A favorite toy","detail":"Use one safe toy that can be paused and offered again without conflict."},{"label":"Small treats","detail":"Use treats only to reward the calm alternative, not to tease or compete with the toy."}]'::jsonb, 'Use a low-value, non-guarded toy. Do not pull the toy from your dog. End the lesson if tension, guarding, fear, or distress appears.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Pause, then resume', 'Teach your dog that calm behavior makes the toy available again.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The dog pauses reaching or grabbing for one brief moment, then receives the toy.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Resume after a calm pause', null, 'The first brief pause makes the toy available again.', 'Present the toy without starting play. Wait for one brief pause in reaching, then begin play. Repeat twice.', 'Then, only if the first part is comfortable and successful: Play briefly, pause the toy once, then resume after one calm moment.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word, place the toy out of reach, and end while your dog is calm.', 'My dog paused briefly and the toy became available again.', 'My dog was not ready for a calm pause-and-resume game.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word, place the toy out of reach, and end while your dog is calm.', 'My dog paused briefly and the toy became available again.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'My dog paused once but stayed very focused on grabbing the toy.', 'starting_step', 'Use a calmer toy', 'Choose a less exciting toy and keep the pause very brief.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog kept rushing or became more frustrated.', 'starting_step', 'Add more distance', 'Hold the toy farther away and reward the first moment your dog stops moving toward it.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog paused briefly but needed extra distance or time.', 'later_step', 'Shorten the play', 'Use only one or two calm seconds of play before the pause.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog became more intense or tried to grab the toy.', 'later_step', 'Practise before play', 'Return to holding the toy still before any play begins.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use the easier toy setup once and resume play after the first calm pause. Later-step retry: Use one shorter play-and-pause sequence, then check the response. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'PAR-L1-DEMO', 'not_produced', 'Sequence: hold the toy still; resume after a calm pause; pause the game once; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'PAR-L1-CLIP-01', 'Toy held still', 'A glove hand presents a toy, then holds it completely still while the mascot remains on the floor.', 'No teasing motion, tugging, or grabbing conflict.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'PAR-L1-CLIP-02', 'Resume after pause', 'After the mascot pauses, the toy moves gently and play begins.', 'Movement follows visible pause; no excitement burst.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'PAR-L1-CLIP-03', 'Pause during calm play', 'The toy becomes still once; the mascot pauses rather than pulling.', 'No force, leash, growl, or resource conflict.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'PAR-L1-CLIP-04', 'End the toy routine', 'A release gesture occurs and the toy is removed calmly.', 'No snatching or prolonged frustration.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Use one practiced toy or routine once, then record the result.', 'My dog paused and the activity resumed after the calm choice.', 'The pause increased frustration or the alternative did not occur. Also includes an unclear result: The pause happened, but the rule or timing was inconsistent.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not a direct Game Challenge', false, null, 'The key variable is a guardian-controlled access consequence and is not suitable for a simple dog-only AI result.', 'Game remains optional and never completes or gates Train.')
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
  select sec.id, '2-3', 'CLEAR_FEEDBACK_WORDS', 'learn-clear-feedback-words', 'Learn Clear Feedback Words', '''옳지''와 ''안돼''의 인식', 'Pair one reward marker with success and one neutral redirect word with a safe alternative.', 'Product content candidate; not published', 'Uses 2-1 Marker Reward and may support 2-5 Calm Reset. The redirect word never predicts punishment.', 'Create two distinct, non-threatening signals: one marker that predicts a reward, and one neutral redirect that means “turn with me and try this approved alternative.”', '["Teaching \"No\" through fear, raised voice, punishment, or physical interruption.","Repeating either word until the dog responds.","Using a feedback word to label the dog as good, bad, stubborn, or guilty.","Expecting the word alone to solve unsafe or high-arousal behavior."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 3
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 2
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Pair "Yes" With Reward', 'Build one positive marker word.', 'The word occurs once and a reward follows immediately.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Pair "This Way" With Redirect', 'Build one neutral redirect toward an approved option.', 'After the word, the dog turns toward the guardian or toy without pressure.', 'Say the redirect and move toward the toy.', 'Reward the turn and toy choice.', 'Start closer and make the toy easier to see.', 'My dog turned toward the approved alternative after the redirect word.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Use Each Word Once', 'Keep the two signals distinct and non-repetitive.', 'One word is used for its intended outcome with no repeated cueing.', 'Use the marker once.', 'Use the redirect once.', 'Practise only one word today.', 'I used each feedback word once and consistently.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Use With a Mild Distraction', 'Apply the redirect around one manageable distraction.', 'The dog can turn to the alternative before arousal rises.', 'Present the mild distraction at distance.', 'Use the redirect and reward the alternative.', 'Increase distance or remove the distraction.', 'My dog followed the redirect around a mild distraction.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Use During a Daily Routine', 'Use marker and redirect appropriately during one normal routine.', 'The signals remain distinct and lead to the expected outcomes.', 'Mark one correct choice.', 'Redirect one low-risk wrong turn.', 'Use only the marker in a staged setup.', 'I used clear feedback words consistently during a normal routine.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Use Both Words on Another Day', 'Use the marker and neutral redirect in one familiar routine.', 'Each word is used once for its defined purpose and followed by the correct consequence.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Small treats","detail":"Use soft, bite-sized treats your dog can eat quickly."},{"label":"One safe toy","detail":"Use the toy as the approved alternative after your neutral redirect word."}]'::jsonb, 'Use normal volume and relaxed movement. Do not use the redirect word during guarding, fear, pain, or uncontrolled behavior.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Create two clear signals', '"Yes" for a rewarded choice and "This way" for a calm redirect.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The word occurs once and a reward follows immediately.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Keep "Yes" positive', null, 'Use the word only when a reward will follow.', 'Say "Yes" once, then give a treat. Repeat twice with a pause.', 'Then, only if the first part is comfortable and successful: Place the toy nearby. Say "This way" once, move toward it, and reward your dog for turning with you. Repeat twice.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word and put the toy and treats away calmly.', '"Yes" predicted reward and "This way" led to the approved alternative.', 'I was not ready to keep the two feedback words distinct.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word and put the toy and treats away calmly.', '"Yes" predicted reward and "This way" led to the approved alternative.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'The reward order or timing felt unclear.', 'starting_step', 'Keep your hands still', 'Say "Yes" before moving your hand toward the treat.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'I repeated the word or showed the treat first.', 'starting_step', 'Use one slow repetition', 'Practise only one clear "Yes," then one treat.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog followed only while watching visible food.', 'later_step', 'Make the toy clearer', 'Place the toy closer and point with an empty hand after saying the word once.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog did not turn toward the alternative.', 'later_step', 'Start beside the toy', 'Stand next to the toy and reward the smallest turn toward it.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use one slow marker-and-reward repetition. Later-step retry: Use the easier toy position once, then check the turn. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'CFW-L1-DEMO', 'not_produced', 'Sequence: pair "Yes" with reward; keep "Yes" positive; pair "This way" with a toy; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'CFW-L1-CLIP-01', 'Yes then reward', 'A small marker cue appears, followed by a treat hand.', 'Marker and reward order is unmistakable; no punitive expression.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'CFW-L1-CLIP-02', 'Rewarded correct choice', 'The mascot orients to the guardian and receives one reward.', 'No luring before the choice.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'CFW-L1-CLIP-03', 'This way to approved toy', 'A neutral guide hand gestures toward a toy and the mascot turns with it.', 'Friendly redirect, not stop/threat gesture; no force.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'CFW-L1-CLIP-04', 'End the feedback session', 'A release gesture ends the sequence and props leave calmly.', 'No correction scene or disappointment expression.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Mark one correct choice and redirect one manageable wrong turn.', 'Both words remained clear and led to the expected outcome.', 'The redirect increased arousal or did not reach the alternative. Also includes an unclear result: I repeated a word or the consequences were not clear.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not a direct Game Challenge', false, null, 'The Skill depends on guardian word meaning and consequence timing, which is better kept in Train.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 2 and s2.skill_code = '2-1'), 'related', 'Uses 2-1 Marker Reward and may support 2-5 Calm Reset. The redirect word never predicts punishment.', false);
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
  select sec.id, '2-4', 'REINFORCEMENT_PATTERN', 'build-a-reward-pattern', 'Build a Reward Pattern', '유쾌한 행동과 보상의 반복강화', 'Repeat one clear criterion and deliver rewards predictably before gradually varying them.', 'Product content candidate; not published', 'Builds on 2-1. It may be inserted as a guardian-skill Bridge when rewards become visible lures or inconsistent.', 'Help the guardian keep the criterion, marker, reward location, and repetition structure consistent so the dog can learn the pattern before rewards are made less visible or more varied.', '["Withholding rewards before the behavior is established.","Randomly changing the criterion, cue, or reward location within one Lesson.","Using variable rewards as a reason to stop reinforcing useful behavior.","Turning food into pressure, teasing, or a visible lure on every repetition."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 4
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 2
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Reward Every Clear Success', 'Use one criterion and reward every clear repetition.', 'The same behavior is marked and rewarded twice without changing the rule.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Keep the Reward Location Consistent', 'Deliver the reward where it supports the target behavior.', 'Reward placement remains consistent across repetitions.', 'Reward at the target position.', 'Repeat without drawing the dog away.', 'Slow down and use one repetition.', 'I delivered rewards in a consistent location.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Hide the Reward Until After the Behavior', 'Remove visible food from the cue sequence.', 'The dog performs before the reward appears.', 'Use empty hands.', 'Reach for reward after the marker.', 'Keep the reward closer but still hidden.', 'My dog performed before seeing the reward.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Use More Than One Reward Type', 'Use food, play, or praise appropriately without changing the criterion.', 'The behavior remains clear while the approved reward type changes between repetitions.', 'Use the familiar food reward.', 'Use one approved alternative reward.', 'Stay with food today.', 'The criterion stayed clear across two reward types.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Use a Mature Reward Pattern', 'Reward established behavior predictably enough to maintain it without food in every visible cue.', 'The guardian follows the approved schedule and the dog remains willing and accurate.', 'Reward the first clear repetition.', 'Use an approved non-food reward or later food reward for a second repetition.', 'Return to rewarding every success.', 'I used an approved reward pattern without weakening the behavior.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Repeat the Same Reward Rule Later', 'Use the established criterion and reward pattern on another day.', 'The behavior, marker, and reward consequence remain consistent.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Small treats","detail":"Prepare several equal, bite-sized treats."},{"label":"One easy behavior","detail":"Choose a simple behavior your dog can offer safely, such as looking at you or stepping onto a mat."}]'::jsonb, 'Keep the session short and stop if food creates tension, frustration, or guarding.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Reward every clear success', 'Use one easy behavior and keep the reward rule the same for two repetitions.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The same behavior is marked and rewarded twice without changing the rule.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Reward every success', null, 'Mark and reward each repetition that meets the same criterion.', 'Ask for or wait for the easy behavior. Mark and reward two clear repetitions.', 'Then, only if the first part is comfortable and successful: Repeat the behavior twice and deliver each reward in the same supportive location.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word and end after the final rewarded success.', 'I used one criterion and rewarded every clear success consistently.', 'I was not ready to keep the reward pattern clear.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word and end after the final rewarded success.', 'I used one criterion and rewarded every clear success consistently.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'The two repetitions were slightly different or my criterion changed.', 'starting_step', 'Write the rule in one sentence', 'Use a simple rule such as "all four paws on the mat."', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'I was not sure what behavior I was rewarding.', 'starting_step', 'Use one repetition', 'Reward one very clear success before trying again.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'The reward location moved and changed my dog''s position.', 'later_step', 'Slow down the delivery', 'Pause after the marker, then place the reward at the target position.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'The reward pulled my dog away from the target behavior.', 'later_step', 'Reward one clear position', 'Use one repetition and place the treat directly at the target.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use the one-sentence rule for one clear repetition. Later-step retry: Use the easier reward placement once, then check the position. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'RWP-L1-DEMO', 'not_produced', 'Sequence: choose one criterion; reward every success; reward in the same place; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'RWP-L1-CLIP-01', 'One clear criterion', 'The mascot enters one visible target position while the scene highlights the stable target without text.', 'Criterion remains visually stable; no changing target.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'RWP-L1-CLIP-02', 'Reward every success', 'A treat hand rewards at the target position after the mascot meets it.', 'Reward placement supports rather than pulls away.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'RWP-L1-CLIP-03', 'Repeat with same placement', 'A second repetition uses the same target and reward location.', 'Scene and rule unchanged; no visible food before behavior.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'RWP-L1-CLIP-04', 'Release after final reward', 'One release gesture ends the repetition set.', 'No extra unrewarded trial or celebration.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Complete two familiar repetitions using the same criterion.', 'The reward pattern remained clear and consistent.', 'The behavior became unclear or the reward was no longer effective. Also includes an unclear result: I changed the timing, location, or criterion between repetitions.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not a direct Game Challenge', false, null, 'This is a guardian reinforcement skill, not a standalone dog performance criterion.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 2 and s2.skill_code = '2-1'), 'related', 'Builds on 2-1. It may be inserted as a guardian-skill Bridge when rewards become visible lures or inconsistent.', false);
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
  select sec.id, '2-5', 'CALM_RESET', 'practice-a-calm-reset', 'Practice a Calm Reset', '불쾌한 행동과 처벌의 반복강화', 'End an unhelpful repetition calmly, lower the difficulty, and return through an approved alternative.', 'Product content candidate; not published', 'Safe replacement for punishment repetition. It may support any Skill after Uncertain, Not yet, or rising frustration.', 'Teach the guardian a repeatable recovery routine: stop the current opportunity, create a short neutral pause, move to an easier approved behavior, then decide whether to resume or end.', '["Isolation as punishment, yelling, startling, physical correction, or removing basic needs.","Repeating the same difficult setup until the dog gives up.","Using a reset to suppress fear, pain, guarding, or aggression.","Treating the reset as a negative outcome or loss of earned progress."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 5
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 2
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Pause for One Calm Moment', 'Stop one mild activity and wait for a brief neutral pause.', 'The activity stops without conflict and the dog produces one brief pause.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Move Away From the Resource', 'Create distance from the difficult setup without pulling the dog.', 'The dog follows the guardian or approved cue away from the setup.', 'Pause and turn away.', 'Reward at the new position.', 'Start with more distance and no active resource.', 'My dog moved away from the setup calmly.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Offer a Simple Alternative', 'Use one easy behavior after the pause.', 'The dog performs the alternative without repeated cueing.', 'Pause the original activity.', 'Offer a mat, hand target, or approved toy.', 'Practise the alternative before adding the difficult activity.', 'My dog used the simple alternative after the pause.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Return to the Activity', 'Resume only when the easier behavior and environment are calm.', 'The activity resumes at lower difficulty without immediate repetition of the problem.', 'Complete the reset.', 'Resume briefly at easier difficulty.', 'End after the alternative instead of resuming.', 'We returned at a lower difficulty without pressure.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Use the Reset in a Daily Routine', 'Apply the same pause-alternative-resume-or-end rule in one normal context.', 'The guardian follows the sequence consistently and stops if welfare requires it.', 'Use the reset once in the routine.', 'Choose resume or end based on the dog''s response.', 'Rehearse the reset in a staged low-intensity setup.', 'I used a calm reset and made a clear decision to resume or end.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Use a Calm Reset on Another Day', 'Use the approved reset once in a familiar low-risk routine.', 'The guardian pauses, reaches an easier alternative, and resumes or ends without punishment.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"A safe toy","detail":"Use one calm toy activity that can be paused without conflict."},{"label":"Small treats","detail":"Use treats to reinforce the easier alternative after the pause."}]'::jsonb, 'End the lesson instead of resetting if your dog becomes distressed, guards a resource, or the situation becomes unsafe.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Pause without punishment', 'Learn to stop a mild activity and find one calm moment before choosing the next step.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The activity stops without conflict and the dog produces one brief pause.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Reward the first calm moment', null, 'When your dog pauses or loosens focus, mark and reward calmly.', 'Play briefly, hold the toy still, and reward the first calm pause. Repeat twice.', 'Then, only if the first part is comfortable and successful: Pause the toy, wait for calm, then guide your dog to the easy alternative. Reward once.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Choose one release word and end the session. Do not restart the difficult activity today if your dog is still aroused.', 'I paused the activity calmly and reached an easier alternative.', 'The activity was not ready for a calm reset in this setting.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Choose one release word and end the session. Do not restart the difficult activity today if your dog is still aroused.', 'I paused the activity calmly and reached an easier alternative.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'My dog paused briefly but stayed very focused on the toy.', 'starting_step', 'Use less exciting play', 'Move the toy more slowly and pause after only one brief movement.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog became more intense or the pause felt unsafe.', 'starting_step', 'Start before play', 'Hold the toy still before play begins and reward one calm look away.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog followed but stayed focused on the original toy.', 'later_step', 'Place the alternative closer', 'Put the mat or approved toy beside you before the reset begins.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog did not move to the alternative calmly.', 'later_step', 'End after the pause', 'Reward the calm pause and end the session without asking for another behavior.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use the easier pause once and reward the first neutral moment. Later-step retry: Use the closer alternative once, or end after the calm pause. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'RST-L1-DEMO', 'not_produced', 'Sequence: pause the toy; reward the first calm moment; offer an easy alternative; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'RST-L1-CLIP-01', 'Pause the toy', 'A toy becomes still during gentle play while the mascot remains on the floor.', 'No tug conflict, restraint, or abrupt removal.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'RST-L1-CLIP-02', 'Reward the neutral pause', 'A treat hand rewards after the mascot visibly pauses and relaxes focus.', 'Reward follows the pause; no emotional label required.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'RST-L1-CLIP-03', 'Move to an easier alternative', 'A guide hand indicates a nearby mat or approved toy and the mascot turns toward it.', 'No dragging or pushing; alternative is easy and close.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'RST-L1-CLIP-04', 'End the reset clearly', 'A release gesture ends the session and the original toy is removed calmly.', 'No immediate restart or punitive isolation.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Use one familiar toy or routine and apply the reset only if needed.', 'I used the calm reset and the situation became easier.', 'The reset increased frustration or the situation was not safe to continue. Also includes an unclear result: I paused, but the alternative or return was not clear.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not a direct Game Challenge', false, null, 'A calm reset is a guardian-managed recovery process and should remain Train guidance.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;
end;
$do$;
