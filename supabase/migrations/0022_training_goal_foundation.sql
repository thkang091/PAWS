-- ============================================================
-- Migration 0022 — Training Goal Categories Reference Table
-- ============================================================
-- Adds a static lookup table for the six owner-facing training
-- goal categories.  The training_goal_category enum (defined in
-- 0019) remains the authoritative type; this table stores the
-- human-readable metadata (title, subtitle, icon key, available
-- pain-point keys, display order) so clients can fetch it at
-- runtime instead of hard-coding it in application code.
--
-- Core training tables already created in earlier migrations:
--   0019: dog_selected_training_goals, dog_training_pain_points,
--         dog_personalized_roadmaps, dog_personalized_roadmap_days
--   0021: dog_training_skill_progress  (aka dog_training_progress)
--         dog_training_reward_log      (aka dog_training_rewards)
--         dog_training_streaks
--         dog_goal_skill_levels        (aka dog_training_skill_levels)
-- ============================================================

create table if not exists training_goal_categories (
  key             training_goal_category primary key,
  title           text not null,
  subtitle        text not null,
  icon_name       text not null default '',
  pain_point_keys text[] not null default '{}',
  -- Informational safeguard text shown in-app when the user
  -- selects this category.  Empty string means no disclaimer.
  disclaimer_text text not null default '',
  sort_order      integer not null default 0,
  created_at      timestamptz not null default timezone('utc', now())
);

-- ──────────────────────────────────────────────
-- Row-level Security
-- ──────────────────────────────────────────────

alter table training_goal_categories enable row level security;

-- All authenticated users can read category metadata.
create policy "tgc_read" on training_goal_categories
  for select to authenticated using (true);

-- Only admins may insert / update / delete rows.
create policy "tgc_admin_write" on training_goal_categories
  for all to authenticated
  using   (exists (select 1 from profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- ──────────────────────────────────────────────
-- Seed Data — Six Categories
-- ──────────────────────────────────────────────

insert into training_goal_categories
  (key, title, subtitle, icon_name, pain_point_keys, disclaimer_text, sort_order)
values

(
  'BETTER_BEHAVIOR_AT_HOME',
  'Better Behavior at Home',
  'Jumping, doors, food manners, settling calmly',
  'home-outline',
  array[
    'jumping_on_people',
    'rushing_through_doors',
    'grabbing_objects',
    'refusing_to_drop',
    'food_manners',
    'settling_calmly',
    'doorbell_guest_routine',
    'crate_safe_zone',
    'staying_on_mat',
    'calm_play_recovery'
  ],
  '',   -- no disclaimer
  1
),

(
  'SAFETY_AND_OBEDIENCE',
  'Safety and Obedience',
  'Recall, leave it, emergency commands',
  'shield-checkmark-outline',
  array[
    'name_response',
    'sit_down_stay',
    'recall',
    'whistle_recall',
    'emergency_recall',
    'leave_it',
    'drop_it',
    'doorway_safety',
    'collar_touch_comfort',
    'emergency_u_turn'
  ],
  '',   -- no disclaimer
  2
),

(
  'BETTER_WALKS',
  'Better Walks',
  'Loose leash, passing dogs, direction changes',
  'walk-outline',
  array[
    'pulling_on_leash',
    'ignoring_me_outside',
    'rushing_through_doors',
    'difficulty_changing_direction',
    'difficulty_passing_objects',
    'difficulty_passing_people',
    'difficulty_passing_dogs',
    'weak_outdoor_recall',
    'poor_curb_awareness',
    'trouble_settling_breaks'
  ],
  '',   -- no disclaimer
  3
),

(
  'COOL_TRICKS_AND_GAMES',
  'Cool Tricks and Games',
  'Spins, paw tricks, fetch games, combos',
  'star-outline',
  array[
    'beginner_tricks',
    'shareable_tricks',
    'photo_poses',
    'trick_combinations',
    'body_awareness_challenges',
    'fetch_games',
    'search_games',
    'speed_challenges',
    'endurance_challenges',
    'weekly_tournaments'
  ],
  '',   -- no disclaimer
  4
),

(
  'HELPFUL_SKILLS_AROUND_THE_HOUSE',
  'Helpful Skills Around the House',
  'Fetch, carry, tidy up, find a person',
  'construct-outline',
  array[
    'bring_a_toy',
    'carry_an_object',
    'put_toys_away',
    'find_a_toy',
    'find_family_member',
    'touch_a_button',
    'ring_a_bell',
    'close_a_drawer',
    'go_to_designated_mat',
    'deliver_object_to_person'
  ],
  -- Clarification: these are household enrichment tasks, not
  -- service-dog work.  Must be shown whenever this category is
  -- displayed to prevent misrepresentation.
  'These activities are everyday home tasks and enrichment exercises. This is not service-dog training. PAWS does not imply disability-assistance certification.',
  5
),

(
  'CALM_ALONE_TIME',
  'Calm Alone Time',
  'Safe-zone routine, gradual step-away, independence',
  'moon-outline',
  array[
    'safe_zone_routine',
    'open_crate_comfort',
    'settling_independently',
    'short_owner_step_away',
    'owner_leaving_room',
    'calm_departure_routine',
    'enrichment_while_alone',
    'calm_return_routine',
    'gradual_short_separations',
    'visible_progress_logging'
  ],
  -- Safety disclaimer required by spec: no separation-anxiety
  -- diagnosis, visible behavior only, professional referral.
  'PAWS can guide gradual independence-building routines. If your dog shows severe distress, escape attempts, or self-injury, consult a veterinarian or qualified behavior professional.',
  6
);
