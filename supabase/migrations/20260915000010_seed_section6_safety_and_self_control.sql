insert into training_sections (curriculum_version_id, section_number, slug, title, description, source_to_product_adaptation, safety_boundary, sort_order)
select id, 6, 'safety-and-self-control', 'Safety and Self-Control', 'Low-risk foundation skills for dropping objects, choosing toys, redirecting chewing, and managing manageable barking contexts.', 'The source "aggression correction" label is not used as a self-guided treatment claim. This Section contains only observable, low-risk foundation behaviors. Human bite risk, puncture bites, guarding, lunging, severe fear, sudden behavior change, pain, or uncontrolled arousal are excluded or referred out.', 'Do not start or continue a self-guided Lesson when there has been a puncture bite, repeated lunging, guarding, hard staring with stiffness, inability to maintain distance, child risk, suspected pain, or sudden behavior change. Create safety and seek veterinary or qualified behavior support.', 6
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
  select sec.id, '6-1', 'DROP_IT', 'drop-it-on-cue', 'Drop It on Cue', '''그만'' / ''놔'' 숙지', 'Release one low-value toy voluntarily in exchange for a reward, then receive the toy again when safe.', 'Product content candidate; not published', 'Supports 1-3 Approved Items and 6-3 Destructive Chewing. Guarded or hazardous objects are not training items.', 'Teach a voluntary trade sequence with a low-value toy, add one cue before the trade, then generalize to two toys and ordinary supervised play.', '["Prying the mouth open, grabbing the collar, chasing, cornering, or pulling the item away.","Practising with guarded, sharp, toxic, battery-powered, edible, or swallowed objects.","Using the cue as a threat or repeating it until release.","Claiming the Skill replaces emergency veterinary care after ingestion."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 1
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 6
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Trade a Low-Value Toy', 'Release one safe toy for a better reward.', 'The dog opens the mouth and releases the toy voluntarily without physical force.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Add the Drop Cue', 'Say one cue before presenting the trade.', 'The dog releases after one cue and the approved trade sequence.', 'Say "Drop" once, then present the reward.', 'Return the toy after the trade.', 'Use the trade without the cue.', 'My dog released after one drop cue and the trade.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Trade Between Two Toys', 'Release one toy to access another safe toy.', 'The dog drops the first toy and takes the second without conflict.', 'Play briefly with toy one.', 'Cue drop and activate toy two.', 'Use food as the trade again.', 'My dog traded one toy for another.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Use a More Interesting Safe Toy', 'Use the cue with a moderately more valuable approved toy.', 'The dog releases while remaining loose enough to continue safely.', 'Use brief calm play.', 'Cue, trade, and return or end clearly.', 'Return to the low-value toy.', 'My dog released the more interesting safe toy.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Use It During Normal Play', 'Use one drop cue in a normal supervised play routine.', 'The toy is released voluntarily and play resumes or ends without conflict.', 'Begin normal calm play.', 'Cue one drop and choose resume or finish.', 'Use a shorter staged play repetition.', 'My dog released the toy during normal play.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Trade During Play on Another Day', 'Use one drop cue during play once on a later day.', 'The dog releases voluntarily after one cue/trade sequence and remains safe.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Small treats","detail":"Use a reward that is more valuable than the practice toy."},{"label":"A low-value toy","detail":"Choose one safe toy your dog can release without guarding or conflict."}]'::jsonb, 'Do not reach into your dog''s mouth or use a guarded item. End the lesson for stiffness, hard staring, growling, snapping, or unsafe tension.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Trade the toy safely', 'Teach your dog to release a low-value toy voluntarily for a better reward.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The dog opens the mouth and releases the toy voluntarily without physical force.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Present the trade', null, 'Hold the treat near your dog''s nose without pulling the toy. Mark when the mouth opens, then reward.', 'Play briefly with the toy. Present the treat, wait for a voluntary release, mark, and reward. Repeat twice.', 'Then, only if the first part is comfortable and successful: Complete the trade, then offer the toy back for one calm repetition. Repeat once.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word and put the toy away calmly. Do not practise with another object today.', 'My dog released the low-value toy voluntarily and remained safe.', 'My dog was not ready for a safe voluntary trade today.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word and put the toy away calmly. Do not practise with another object today.', 'My dog released the low-value toy voluntarily and remained safe.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'My dog released once but stayed tense or needed the treat very close.', 'starting_step', 'Use a quieter toy', 'Choose a less exciting toy and keep the play moment very short.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog held on, became tense, or guarded the toy.', 'starting_step', 'Skip the play', 'Let your dog hold the toy briefly, then present the trade before any tugging begins.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog resumed but became more intense or grabbed quickly.', 'later_step', 'Pause before returning the toy', 'Wait for one neutral moment before offering the toy again.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog could not resume safely or remained tense.', 'later_step', 'End after the trade', 'Reward the release and finish without offering the toy again.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use the easier toy setup once and wait for one voluntary release. Later-step retry: Use one calm pause before returning the toy, or end after the trade. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'DRP-L1-DEMO', 'not_produced', 'Sequence: start with calm play; present the trade; return the toy; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'DRP-L1-CLIP-01', 'Hold a low-value toy', 'The mascot holds one safe low-value toy during calm play.', 'No tug tension, guarding posture, or hazardous object.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'DRP-L1-CLIP-02', 'Trade for one reward', 'A treat hand appears near the nose; the mascot opens the mouth and releases voluntarily.', 'No pulling, mouth prying, collar grab, or hand/object intersection.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'DRP-L1-CLIP-03', 'Return the toy after trade', 'After reward, the glove hand offers the same toy back and the mascot takes it calmly.', 'No snatching or excitement burst.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'DRP-L1-CLIP-04', 'End the trade session', 'A release gesture ends play and the toy is removed without conflict.', 'No forced surrender or punishment.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Use one short play repetition and one drop request.', 'My dog released voluntarily after one cue.', 'My dog did not release or showed tension around the toy. Also includes an unclear result: My dog released but needed visible food, repeated help, or more distance.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'candidate after strict object-safety validation', true, 'Drop It', 'The dog visibly releases one approved toy after one cue/trade sequence without physical force or guarding signs.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 1 and s2.skill_code = '1-3'), 'related', 'Supports 1-3 Approved Items and 6-3 Destructive Chewing. Guarded or hazardous objects are not training items.', false);

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 6 and s2.skill_code = '6-3'), 'related', 'Supports 1-3 Approved Items and 6-3 Destructive Chewing. Guarded or hazardous objects are not training items.', false);
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
  select sec.id, '6-2', 'MOUTHING_REDIRECTION', 'choose-toys-not-hands', 'Choose Toys, Not Hands', '사람에 대한 공격성 차단', 'Redirect low-risk playful mouthing toward an approved toy and pause play if teeth touch skin.', 'Product content candidate; not published', 'This is not an aggression-treatment Skill. It covers only low-risk playful mouthing and links to 2-2 Pause Access and 2-5 Calm Reset.', 'Teach an approved toy choice before play, pause social play immediately and calmly when teeth contact skin, then resume only after a brief calm alternative.', '["Treating hard bites, punctures, growling, lunging, guarding, fear, or child-directed behavior as ordinary mouthing.","Yelping loudly, hitting, muzzle grabbing, alpha rolls, physical restraint, or escalating rough play.","Testing tolerance with hands near the mouth or inviting biting for training.","Claiming the Skill makes interaction safe with every person."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 2
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 6
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Choose the Toy Before Play', 'Put the mouth on the toy rather than a hand.', 'The dog touches or holds the toy while hands remain out of the mouth area.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Pause When Teeth Touch Skin', 'Make skin contact end the current play movement calmly.', 'Play stops immediately without shouting, grabbing, or punishment.', 'Use very gentle play.', 'Freeze and remove attention if teeth touch skin.', 'Keep hands farther away and use a longer toy.', 'I paused play calmly when teeth touched skin.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Resume After a Calm Moment', 'Restart only after the dog is on the toy or briefly calm.', 'The dog reaches the alternative before play resumes.', 'Complete the calm pause.', 'Offer the toy and resume briefly.', 'End after the pause instead of resuming.', 'My dog returned to the toy before play resumed.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Use During More Exciting Play', 'Maintain the toy rule at a slightly higher but still safe play level.', 'The dog remains on the toy or recovers through one calm reset.', 'Increase movement slightly.', 'Use one pause-and-resume if needed.', 'Reduce movement or duration.', 'My dog used the toy rule during more exciting play.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Use With Another Familiar Adult', 'Apply the rule with one informed familiar adult, never a child.', 'The adult presents the toy first and follows the same pause rule.', 'Adult offers the toy and begins calm play.', 'Adult ends or resets at the first skin contact.', 'Adult only rewards toy choice without play.', 'My dog used the toy rule with a familiar adult.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Use the Toy Rule During Normal Play', 'Use the toy rule once during normal play on a later day.', 'The dog chooses the toy and any skin contact causes an immediate calm pause, not escalation.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"A safe toy","detail":"Choose a toy long enough to keep hands away from the mouth during play."},{"label":"Small treats","detail":"Use treats to reward choosing the toy or completing a calm reset."}]'::jsonb, 'This lesson is only for soft, playful mouthing. Do not practise after a hard bite, puncture, growl, lunge, guarding event, severe fear, or child risk. Stop and seek qualified help.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Choose the toy, not hands', 'Teach your dog that play begins with the approved toy in the mouth area.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The dog touches or holds the toy while hands remain out of the mouth area.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Reward the toy choice', null, 'Mark the first touch of the toy, then begin gentle play or give a treat.', 'Present the toy before moving your hands. Mark and reward the first toy touch. Repeat twice.', 'Then, only if the first part is comfortable and successful: Use one brief gentle play movement with the toy. Stop before excitement rises. Repeat once.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word, put the toy away calmly, and end before arousal rises.', 'My dog chose the toy and kept hands clear during gentle play.', 'This play setup was not ready for safe self-guided practice.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word, put the toy away calmly, and end before arousal rises.', 'My dog chose the toy and kept hands clear during gentle play.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'My dog used the toy but still followed or mouthed near my hands.', 'starting_step', 'Use a longer toy', 'Choose a toy that creates more distance between the mouth and your hands.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog ignored the toy and focused on hands or clothing.', 'starting_step', 'Reward one toy touch', 'Skip play and reward the first calm touch of the toy.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog used the toy but moved toward hands or clothing once.', 'later_step', 'Move the toy more slowly', 'Use one short, low movement and stop before your dog becomes more excited.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog repeatedly moved away from the toy toward hands or clothing.', 'later_step', 'Return to a still toy', 'Reward holding or touching the toy without moving it.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use the longer toy or one-touch version once. Later-step retry: Use one slower or still-toy repetition, then stop. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'MOU-L1-DEMO', 'not_produced', 'Sequence: present the toy first; reward the toy choice; keep play on the toy; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'MOU-L1-CLIP-01', 'Present long toy first', 'A warm-white hand holds one long toy with clear distance from the mascot''s mouth.', 'No human skin near mouth; no child; no hand teasing.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'MOU-L1-CLIP-02', 'Reward the toy choice', 'The mascot touches the toy and receives calm play or one treat.', 'Reward follows toy contact; no skin contact.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'MOU-L1-CLIP-03', 'Gentle play on toy', 'The toy moves slowly while the mascot keeps contact only with the toy.', 'No rough tug, clothing, hand biting, or rising arousal.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'MOU-L1-CLIP-04', 'End play early', 'A release gesture ends play and the toy is removed calmly.', 'No conflict, grabbing, or frustration loop.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Use one short normal play period and end early.', 'My dog kept play on the toy or recovered through the calm pause.', 'Teeth contact became hard, frequent, fearful, or unsafe. Also includes an unclear result: My dog used the toy but needed repeated resets or became more excited.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not suitable for MVP AI verification', false, null, 'Human-contact safety, bite force, context, and welfare cannot be safely judged by a simple automated Challenge.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 2 and s2.skill_code = '2-2'), 'related', 'This is not an aggression-treatment Skill. It covers only low-risk playful mouthing and links to 2-2 Pause Access and 2-5 Calm Reset.', false);

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 2 and s2.skill_code = '2-5'), 'related', 'This is not an aggression-treatment Skill. It covers only low-risk playful mouthing and links to 2-2 Pause Access and 2-5 Calm Reset.', false);
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
  select sec.id, '6-3', 'DESTRUCTIVE_CHEWING_REDIRECTION', 'redirect-destructive-chewing', 'Redirect Destructive Chewing', '물건 훼손 깨물기 차단', 'Move from one safe household practice item to an approved chew without chasing or punishment.', 'Product content candidate; not published', 'Advanced context placement of 1-3 Choose Approved Items and 6-1 Drop It. Shared observations should not duplicate Completion or Silver.', 'Teach an approved chew choice, a calm exchange away from one safe practice item, and environmental setup that reduces opportunities to rehearse destructive chewing.', '["Using electrical cords, batteries, medicine, sharp, toxic, breakable, or valuable items for practice.","Chasing, shouting, pulling the object away, or punishing after damage occurred.","Treating ingestion, guarding, pain, pica, or separation distress as an ordinary chewing lesson.","Promising that training replaces environmental management and supervision."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 3
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 6
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Choose the Approved Chew', 'Select the approved chew when a neutral object is present.', 'The dog contacts the approved chew and leaves the practice item untouched.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Exchange the Practice Item', 'Move from one safe neutral item to the approved chew.', 'The dog disengages from the practice item and accepts the chew without conflict.', 'Use one calm redirect or trade.', 'Reward engagement with the chew.', 'Start before the dog touches the practice item.', 'My dog left the practice item and chose the approved chew.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Choose With the Item Visible', 'Keep the practice item available while choosing the chew without visible food.', 'The first sustained engagement is with the approved chew.', 'Hide the reward.', 'Wait for independent chew choice.', 'Increase distance between objects.', 'My dog chose the approved chew while the practice item stayed visible.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Use During a Mild Household Routine', 'Choose the chew while one mild household activity occurs.', 'The dog remains engaged with the chew instead of the restricted object.', 'Begin the chew before the activity.', 'Add one small household movement.', 'Remove the movement.', 'My dog used the approved chew during a mild household routine.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Use the Full Management Routine', 'Set up the environment, offer the chew, redirect once if needed, and finish clearly.', 'The dog uses the approved chew while access to unsafe items is managed.', 'Prepare the room and chew.', 'Use one calm redirect during normal supervision.', 'Return to a staged two-object setup.', 'I used the full chewing-management routine.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Choose the Approved Chew on Another Day', 'Use the approved chew once on a later day.', 'The dog chooses the approved chew and does not contact the safe practice item.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"An approved chew","detail":"Choose one safe, size-appropriate chew or toy your dog is allowed to use."},{"label":"A safe practice object","detail":"Use one large, boring, non-breakable object that cannot be swallowed or damaged."}]'::jsonb, 'Do not use real cords, batteries, medicine, sharp, toxic, or swallowable items. End the lesson for guarding, ingestion risk, pain, or unsafe tension.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Choose the approved chew', 'Teach your dog that the approved chew is the rewarding option.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The dog contacts the approved chew and leaves the practice item untouched.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Reward the chew choice', null, 'Mark the first touch of the approved chew, then reward beside it.', 'Place both items down. Guide your dog toward the approved chew and reward the first touch. Repeat twice.', 'Then, only if the first part is comfortable and successful: Reset both items, take one step back, and reward if your dog chooses the approved chew.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word, remove the practice item, and allow calm use of the approved chew.', 'My dog chose the approved chew while the practice item was nearby.', 'My dog was not ready to choose the chew around the practice item.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word, remove the practice item, and allow calm use of the approved chew.', 'My dog chose the approved chew while the practice item was nearby.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'My dog chose it only while following visible food.', 'starting_step', 'Hide the treat', 'Keep the treat out of sight and reward only after chew contact.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog focused on the practice item instead.', 'starting_step', 'Create more distance', 'Move the practice item farther away and place the chew directly in front of your dog.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog chose it once but still watched my hand or treat.', 'later_step', 'Keep your hands quiet', 'Wait one brief moment before marking the chew choice.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog moved toward the practice item first.', 'later_step', 'Move the chew closer', 'Place the chew closer and the practice item farther to the side.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use the easier spacing once and wait for chew contact. Later-step retry: Use the easier spacing once, then check the first choice. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'CHW-L1-DEMO', 'not_produced', 'Sequence: make the chew easy to find; reward the chew choice; let your dog choose; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'CHW-L1-CLIP-01', 'Approach the approved chew', 'The mascot turns to one approved chew while a neutral practice object remains farther away.', 'Objects safe and distinct; no hazardous item or damage.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'CHW-L1-CLIP-02', 'Reward chew choice', 'A reward arrives beside the approved chew after contact.', 'No lure or force; no practice-item contact.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'CHW-L1-CLIP-03', 'Choose with both visible', 'The mascot independently chooses the chew while the neutral object stays untouched.', 'First movement clearly to chew; stable scene.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'CHW-L1-CLIP-04', 'End with approved chew', 'A release gesture ends the training decision and the mascot remains calmly engaged with the chew.', 'Practice item removed without conflict.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Set up the familiar chew and one safe practice object once.', 'My dog chose the approved chew and left the practice item alone.', 'My dog repeatedly chose or guarded the practice item. Also includes an unclear result: My dog needed repeated redirection or visible food.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'mapped_candidate; not launch-approved', true, 'Choose the Approved Chew', 'With two clearly visible safe objects, the dog chooses the designated chew and leaves the neutral object untouched.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 1 and s2.skill_code = '1-3'), 'shared_foundation', 'Shared foundation for 6-3 Redirect Destructive Chewing. Similar observations should not create duplicate progress or Silver.', false);

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 6 and s2.skill_code = '6-1'), 'advanced_context', 'Advanced context placement of 1-3 Choose Approved Items and 6-1 Drop It. Shared observations should not duplicate Completion or Silver.', false);
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
  select sec.id, '6-4', 'DEMAND_BARKING_ROUTINE', 'reduce-demand-barking', 'Reduce Demand Barking', '요구성 짖음 차단', 'Pause attention or a non-essential activity during barking, then reward a brief quiet alternative.', 'Product content candidate; not published', 'Builds on 1-5 Quiet Pause, 2-2 Pause Access, and 2-5 Calm Reset. It does not use punishment or prolonged ignoring.', 'Teach a transparent, low-arousal sequence: demand barking does not start the requested non-essential activity; one brief quiet pause and simple alternative make attention or activity available again.', '["Ignoring distress, fear, pain, toileting need, basic care need, or escalating behavior.","Shouting, spraying water, confinement punishment, startling, or withholding food/water/walks as retaliation.","Waiting for long silence or making the dog fail repeatedly.","Assuming every bark is demand barking."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 4
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 6
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Reward One Quiet Pause', 'Find and reward a brief quiet moment.', 'The dog pauses barking briefly and can receive calm reinforcement.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Pause Attention During Barking', 'Make barking pause the non-essential attention activity.', 'Attention pauses calmly and resumes after one quiet moment.', 'Begin a mild attention activity.', 'Pause at barking and resume after quiet.', 'Use shorter activity and more distance.', 'Attention paused during barking and resumed after quiet.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Offer a Simple Alternative', 'Move from quiet to one easy behavior.', 'The dog pauses and performs the alternative before attention resumes.', 'Find the quiet pause.', 'Guide to mat, toy, or hand target.', 'Practise the alternative without barking.', 'My dog used the alternative after a quiet pause.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Use During One Familiar Routine', 'Apply the sequence in one normal low-risk demand context.', 'The guardian distinguishes demand from need and uses the rule consistently.', 'Prepare the alternative and activity.', 'Use one pause-and-resume sequence.', 'Return to a staged activity.', 'I used the demand-barking routine consistently.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Use With Reduced Food', 'Maintain the quiet alternative with normal attention/play rewards when appropriate.', 'The dog follows the sequence without visible food on every repetition.', 'Reward the first quiet pause with food.', 'Use the requested safe activity as the next reward.', 'Continue food rewards for each success.', 'My dog used the quiet alternative with reduced visible food.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Use the Demand-Barking Routine Later', 'Use the demand-barking routine once on a later day.', 'Barking pauses the optional activity; a brief quiet alternative makes it available again.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Small treats","detail":"Use treats to reinforce the quiet alternative, not while barking continues."},{"label":"A low-value attention activity","detail":"Choose one safe non-essential activity, such as gentle toy play or petting, that can pause briefly."}]'::jsonb, 'Use only a known low-risk demand context. End the lesson if barking escalates, your dog seems distressed, or a basic need may be present.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Reward one quiet pause', 'Teach your dog that a brief quiet moment is the path to calm attention.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The dog pauses barking briefly and can receive calm reinforcement.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Reward after quiet begins', null, 'Mark the first quiet moment, then give calm attention or one treat.', 'In a low-risk demand context, wait for one brief quiet pause. Mark and reward it. Repeat twice only if arousal stays low.', 'Then, only if the first part is comfortable and successful: Begin the mild activity briefly. If barking occurs, become still. Resume after one quiet pause. Repeat once.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word and end while the environment is calm. Do not continue if barking is escalating.', 'My dog produced a quiet pause and calm attention resumed afterward.', 'This barking context was not ready for safe self-guided practice.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word and end while the environment is calm. Do not continue if barking is escalating.', 'My dog produced a quiet pause and calm attention resumed afterward.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'My dog paused once but stayed highly focused on attention.', 'starting_step', 'Lower the excitement', 'Use a calmer activity and reduce your movement and voice.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog barking escalated or did not pause safely.', 'starting_step', 'Practise quiet without a demand', 'Reward one natural quiet moment in a calm setting.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog paused once but became excited again immediately.', 'later_step', 'Shorten the activity', 'Use only one brief moment of attention before the pause.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'The pause increased barking or frustration.', 'later_step', 'End after the quiet pause', 'Reward the first quiet moment and finish instead of resuming.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use the calmer context once and reward the first brief pause. Later-step retry: Use the shorter sequence once, or end after the quiet pause. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'DBK-L1-DEMO', 'not_produced', 'Sequence: wait for a natural pause; reward after quiet begins; pause attention, then resume; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'DBK-L1-CLIP-01', 'Brief quiet pause', 'The mascot transitions from one low-intensity bark pose to a brief neutral quiet posture.', 'No audio required, no distress or repeated barking loop.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'DBK-L1-CLIP-02', 'Reward after quiet', 'A treat or calm attention hand appears only after the quiet posture begins.', 'No reward during bark pose.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'DBK-L1-CLIP-03', 'Pause and resume attention', 'A gentle play/attention hand becomes still, then resumes after the mascot is quiet.', 'No prolonged ignoring, punishment, or excitement burst.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'DBK-L1-CLIP-04', 'End the routine calmly', 'A release gesture ends the optional activity while the mascot remains calm.', 'No deprivation or isolation.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Use one short normal context and end early.', 'My dog paused and used the alternative before the activity resumed.', 'Barking escalated or a basic need may have been involved. Also includes an unclear result: The pause happened but needed repeated help or the context was unclear.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not recommended for MVP AI verification', false, null, 'Demand context and basic-needs distinction cannot be inferred safely from a short recording.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 1 and s2.skill_code = '1-5'), 'shared_foundation', 'Foundation for 6-4 Reduce Demand Barking and 6-5 Manage Alert Barking. Those Skills retain separate context-specific progress.', false);

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 2 and s2.skill_code = '2-2'), 'related', 'Builds on 1-5 Quiet Pause, 2-2 Pause Access, and 2-5 Calm Reset. It does not use punishment or prolonged ignoring.', false);

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 2 and s2.skill_code = '2-5'), 'related', 'Builds on 1-5 Quiet Pause, 2-2 Pause Access, and 2-5 Calm Reset. It does not use punishment or prolonged ignoring.', false);
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
  select sec.id, '6-5', 'ALERT_BARKING_ROUTINE', 'manage-alert-barking', 'Manage Alert Barking', '경계성 짖음 제지', 'Notice one manageable household trigger, reorient, and move to a safe alternative before arousal escalates.', 'Product content candidate; not published', 'Builds on 1-5 Quiet Pause, 4-2 Visual Triggers, 4-3 Sounds, and 4-4 Resting Space. High-risk guarding or visitor aggression is referred out.', 'Teach a low-intensity alert routine: notice the trigger, mark one brief pause or check-in, move away from the trigger to a resting space, and end or manage the situation safely.', '["Suppressing all alert barking or punishing the dog for noticing the environment.","Practising with visitors, dogs, or sounds that cause lunging, guarding, panic, or loss of control.","Forcing close exposure, blocking escape, shouting, spraying, or startling.","Claiming the dog is safe with visitors because one routine succeeded."]'::jsonb, 'Level 1 is implementation-ready as a content candidate; Levels 2–5 and Checkpoint are structured candidates; no content is published.', 5
  from training_sections sec join training_curriculum_versions v on v.id = sec.curriculum_version_id
  where v.version_key = 'button-flow-v1.1' and sec.section_number = 6
  on conflict (section_id, skill_code) do update set
    internal_concept_id = excluded.internal_concept_id, slug = excluded.slug, title = excluded.title,
    source_label_ko = excluded.source_label_ko, one_line_goal = excluded.one_line_goal, product_status = excluded.product_status,
    shared_skill_bridge_relation = excluded.shared_skill_bridge_relation, skill_promise = excluded.skill_promise,
    boundaries = excluded.boundaries, authoring_state = excluded.authoring_state, sort_order = excluded.sort_order
  returning id into v_skill_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 1, 1, 'Notice and Reorient', 'Notice one mild alert cue and turn back to the guardian.', 'The dog notices, remains manageable, and reorients after one approved cue or natural pause.', null, null, null, null, null, 'full_button_flow', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_level1_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 2, 2, 'Pause After One Alert', 'Find one brief quiet pause after the mild alert response.', 'The dog pauses and remains able to eat and move.', 'Allow one brief alert response.', 'Mark the first pause and reward.', 'Use a softer cue or reward before barking begins.', 'My dog produced a brief quiet pause after the alert cue.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 3, 3, 'Move to a Resting Space', 'Reorient and move away from the trigger to a safe spot.', 'The dog follows the approved route to the resting space without force.', 'Cue the turn away.', 'Move to the resting space and reward.', 'Practise the route without a trigger.', 'My dog moved away from the trigger to the resting space.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 4, 4, 'Use a Low-Volume Door Cue', 'Apply the routine to a very soft knock or bell recording.', 'The dog can notice, reorient, and move away at the chosen low intensity.', 'Use one soft door cue.', 'Complete the resting-space routine.', 'Lower volume or increase distance.', 'My dog used the routine around a low-volume door cue.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, first_part, next_part, easier_path, success_anchor, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'level', 5, 5, 'Use During a Normal Household Alert', 'Apply the routine once during a manageable real alert.', 'The dog notices, reorients, and moves to the alternative while safety is maintained.', 'Prepare the resting space and rewards.', 'Use the routine once during the real event.', 'Return to the recorded or distant cue.', 'My dog used the alert routine during a manageable household event.', null, 'structured_notes', true)
  on conflict (skill_id, stage_type, level_number) do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    first_part = excluded.first_part, next_part = excluded.next_part, easier_path = excluded.easier_path, success_anchor = excluded.success_anchor,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status, additional_practice_allowed = excluded.additional_practice_allowed
  returning id into v_tmp_id;

  insert into training_levels (skill_id, stage_type, level_number, sequence_index, title, goal, observable_criterion, entry_rule, implementation_status, additional_practice_allowed)
  values (v_skill_id, 'checkpoint', null, 6, 'Use the Alert Routine on Another Day', 'Use the alert routine once on a later day.', 'The dog reorients and moves away from the trigger without escalation.', 'Level 5 complete and a later effective local date.', 'checkpoint', false)
  on conflict (skill_id) where stage_type = 'checkpoint' do update set
    sequence_index = excluded.sequence_index, title = excluded.title, goal = excluded.goal, observable_criterion = excluded.observable_criterion,
    entry_rule = excluded.entry_rule, implementation_status = excluded.implementation_status
  returning id into v_checkpoint_id;

  insert into training_ready_cards (level_id, materials, safety_copy, primary_action, secondary_action)
  values (v_level1_id, '[{"label":"Small treats","detail":"Use soft, bite-sized treats your dog can eat quickly."},{"label":"A mild alert cue","detail":"Choose one very soft, predictable sound or distant visual cue that your dog can notice without escalating."}]'::jsonb, 'Use only a low-intensity, controllable trigger. Stop for lunging, guarding, hard staring with stiffness, snapping, severe fear, or inability to maintain safe distance.', 'Continue', 'End lesson')
  on conflict (level_id) do update set materials = excluded.materials, safety_copy = excluded.safety_copy, primary_action = excluded.primary_action, secondary_action = excluded.secondary_action;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'orient', 'orient', 1, 'Notice, then turn back', 'Teach your dog to notice one mild alert cue and reorient before arousal rises.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'demo', 'demo', 2, 'Watch the whole sequence', 'What to look for: The dog notices, remains manageable, and reorients after one approved cue or natural pause.', null, null, null, null, null, null, null, '[{"label":"Back","role":"back"},{"label":"Continue","role":"continue"},{"label":"Play / Replay","role":"play"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'guardian', 'guardian', 3, 'Reward calm noticing', null, 'Mark one brief notice while your dog can still eat and move, then reward beside you.', 'Present the mild cue once. Mark a manageable notice and reward beside you. Repeat twice only if your dog stays below threshold.', 'Then, only if the first part is comfortable and successful: Present the cue once, wait for a turn back, or say your dog''s name once. Mark and reward the reorientation.

If the first part is not ready, choose Not yet instead of moving on to the harder part.', 'Use one release word and leave the trigger area. Do not repeat the cue if your dog is still aroused.', 'My dog noticed the mild alert cue and reoriented safely.', 'This alert cue was not ready for safe self-guided practice.

Choose Not yet if you are unsure.', null, '[{"label":"Back","role":"back"},{"label":"Watch demo","role":"watch_demo"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
  on conflict (level_id, card_key) do update set
    card_type = excluded.card_type, sort_order = excluded.sort_order, title = excluded.title, body = excluded.body,
    key_action = excluded.key_action, try_it = excluded.try_it, harder_part = excluded.harder_part, finish_instruction = excluded.finish_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, uncertainty_instruction = excluded.uncertainty_instruction,
    buttons = excluded.buttons, exact_copy_available = excluded.exact_copy_available, lesson_contract_version = excluded.lesson_contract_version;

  insert into training_lesson_cards (level_id, card_key, card_type, sort_order, title, body, key_action, try_it, harder_part, finish_instruction, success_copy, not_yet_copy, uncertainty_instruction, buttons, exact_copy_available, lesson_contract_version)
  values (v_level1_id, 'additional_practice', 'additional_practice', 4, 'Let''s make it easier', 'Use only the matching approved adjustment in the guidance table below. Try it once; do not work through every adjustment as another sequence. Keep the original stop rules.', null, null, null, 'Use one release word and leave the trigger area. Do not repeat the cue if your dog is still aroused.', 'My dog noticed the mild alert cue and reoriented safely.', 'The original target is not ready, even if an easier part went well. Finish calmly; there is no second retry.', null, '[{"label":"Back","role":"back"},{"label":"Replay","role":"play"},{"label":"Success","role":"success"},{"label":"Not yet","role":"not_yet"},{"label":"End lesson","role":"end_lesson"}]'::jsonb, true, 'button-flow-v1.1')
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
  values (v_level1_id, 'My dog stared, barked more than once, or needed more distance.', 'starting_step', 'Increase the distance', 'Move farther from the cue or lower the volume before trying once more.', null, 0);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog lunged, guarded, froze, panicked, or could not disengage.', 'starting_step', 'Use a neutral cue', 'Choose a softer, less meaningful cue that your dog already notices calmly.', null, 1);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog turned back once but remained highly focused on the cue.', 'later_step', 'Move away first', 'Increase distance before waiting for the turn back.', null, 2);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'My dog could not turn away or became more aroused.', 'later_step', 'Use one name cue', 'At the easier distance, say your dog''s name once and reward the first turn.', null, 3);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'One additional attempt total', 'one_additional_attempt', 'Use the matching instruction only', 'Starting-step retry: Use the easier cue or distance once and reward a brief notice. Later-step retry: Use the easier distance or one name cue, then check the return. Do not perform both as two retries.', null, 4);

  insert into training_adaptive_guidance (level_id, observation, observation_stage, guidance_title, guidance_text, routing_instruction, sort_order)
  values (v_level1_id, 'After additional Practice', 'after_additional_practice', 'Finish or continue', 'Report once on the Practice card against the original Level Success anchor. If only an easier part succeeded, choose Not yet for the original target and finish with Review scheduled. No further retry.', null, 5);

  insert into training_media_bindings (level_id, demo_id, status, production_notes, fallback_text)
  values (v_level1_id, 'ABK-L1-DEMO', 'not_produced', 'Sequence: use a very mild cue; reward calm noticing; turn back to the guardian; finish clearly.', 'Static poster; no new video required.')
  on conflict (level_id) do update set demo_id = excluded.demo_id, status = excluded.status, production_notes = excluded.production_notes, fallback_text = excluded.fallback_text
  returning id into v_media_binding_id;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'ABK-L1-CLIP-01', 'Notice mild alert cue', 'The mascot gives one brief orientation toward a distant neutral door/sound cue.', 'No barking loop, lunging, guarding, or threatening visitor.', 0)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'ABK-L1-CLIP-02', 'Reward manageable notice', 'A treat is delivered beside the guardian while the mascot remains mobile and calm enough to respond.', 'No reward near the trigger or forced proximity.', 1)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'ABK-L1-CLIP-03', 'Turn away from trigger', 'The mascot turns back toward the guide hand and increases distance from the cue.', 'Clear disengagement; no repeated signal.', 2)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  insert into training_media_scenes (media_binding_id, source_scene_id, purpose, required_sequence_beat, acceptance_focus, sort_order)
  values (v_media_binding_id, 'ABK-L1-CLIP-04', 'Leave the alert area', 'A release/guide gesture moves the mascot toward a safe resting direction.', 'No visitor interaction or claim of safety.', 3)
  on conflict (media_binding_id, source_scene_id) do update set purpose = excluded.purpose, required_sequence_beat = excluded.required_sequence_beat, acceptance_focus = excluded.acceptance_focus, sort_order = excluded.sort_order;

  update training_lesson_cards set media_binding_id = v_media_binding_id where level_id = v_level1_id and card_key = 'demo';

  insert into training_checkpoint_policies (skill_id, checkpoint_level_id, entry_rule, guardian_instruction, success_copy, not_yet_copy, success_next_state, not_yet_next_state, no_immediate_retest, maintenance_review_behavior)
  values (v_skill_id, v_checkpoint_id, 'Level 5 complete and a later effective local date.', 'Use one familiar low-intensity cue and complete the full routine once.', 'My dog noticed, reoriented, and moved to the safe alternative.', 'My dog escalated or could not disengage safely. Also includes an unclear result: My dog completed part of the routine but needed more distance or repeated help.', 'Keep Course Progress and schedule Maintenance Review later.', 'Keep Course Progress and schedule a targeted Level Review without resetting the Skill. No immediate Checkpoint retest.', true, null)
  on conflict (skill_id) do update set
    checkpoint_level_id = excluded.checkpoint_level_id, entry_rule = excluded.entry_rule, guardian_instruction = excluded.guardian_instruction,
    success_copy = excluded.success_copy, not_yet_copy = excluded.not_yet_copy, success_next_state = excluded.success_next_state,
    not_yet_next_state = excluded.not_yet_next_state, no_immediate_retest = excluded.no_immediate_retest, maintenance_review_behavior = excluded.maintenance_review_behavior;

  insert into training_game_mappings (skill_id, status, is_mapped_candidate, challenge_title, bounded_criterion, train_effect)
  values (v_skill_id, 'not recommended for MVP AI verification', false, null, 'Alert intensity, trigger meaning, and safety cannot be standardized responsibly in a simple automated Challenge.', 'Game remains optional and never completes or gates Train.')
  on conflict (skill_id) do update set status = excluded.status, is_mapped_candidate = excluded.is_mapped_candidate, challenge_title = excluded.challenge_title, bounded_criterion = excluded.bounded_criterion, train_effect = excluded.train_effect;

  delete from training_skill_relationships where from_skill_id = v_skill_id;

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 1 and s2.skill_code = '1-5'), 'shared_foundation', 'Foundation for 6-4 Reduce Demand Barking and 6-5 Manage Alert Barking. Those Skills retain separate context-specific progress.', false);

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 4 and s2.skill_code = '4-2'), 'related', 'Builds on 1-5 Quiet Pause, 4-2 Visual Triggers, 4-3 Sounds, and 4-4 Resting Space. High-risk guarding or visitor aggression is referred out.', false);

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 4 and s2.skill_code = '4-3'), 'related', 'Builds on 1-5 Quiet Pause, 4-2 Visual Triggers, 4-3 Sounds, and 4-4 Resting Space. High-risk guarding or visitor aggression is referred out.', false);

  insert into training_skill_relationships (from_skill_id, to_skill_id, relationship_type, rule_text, hard_prerequisite)
  values (v_skill_id, (select s2.id from training_skills s2 join training_sections sec2 on sec2.id = s2.section_id join training_curriculum_versions v2 on v2.id = sec2.curriculum_version_id where v2.version_key = 'button-flow-v1.1' and sec2.section_number = 4 and s2.skill_code = '4-4'), 'related', 'Builds on 1-5 Quiet Pause, 4-2 Visual Triggers, 4-3 Sounds, and 4-4 Resting Space. High-risk guarding or visitor aggression is referred out.', false);
end;
$do$;
