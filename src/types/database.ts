export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          onboarding_completed: boolean;
          tutorial_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          onboarding_completed?: boolean;
          tutorial_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          onboarding_completed?: boolean;
          tutorial_completed?: boolean;
          updated_at?: string;
        };
      };
      dogs: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          gender: Database["public"]["Enums"]["dog_gender"];
          birthday: string | null;
          age_years: number | null;
          breed: string;
          owned_since: string | null;
          adoption_date: string | null;
          obedience_level: Database["public"]["Enums"]["obedience_level"];
          energy_level: Database["public"]["Enums"]["energy_level"];
          dog_tag: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["dogs"]["Row"]> & {
          owner_id: string;
          name: string;
          gender: Database["public"]["Enums"]["dog_gender"];
          breed: string;
          obedience_level: Database["public"]["Enums"]["obedience_level"];
          energy_level: Database["public"]["Enums"]["energy_level"];
          dog_tag: string;
        };
        Update: Partial<Database["public"]["Tables"]["dogs"]["Row"]>;
      };
      dog_selected_training_goals: {
        Row: DogRelationshipRow<"goal"> & { priority_rank: number };
        Insert: Partial<DogRelationshipRow<"goal"> & { priority_rank: number }> & { dog_id: string; goal: string; priority_rank: number };
        Update: Partial<DogRelationshipRow<"goal"> & { priority_rank: number }>;
      };
      dog_training_pain_points: {
        Row: DogRelationshipRow<"goal"> & { pain_point_key: string };
        Insert: Partial<DogRelationshipRow<"goal"> & { pain_point_key: string }> & { dog_id: string; goal: string; pain_point_key: string };
        Update: Partial<DogRelationshipRow<"goal"> & { pain_point_key: string }>;
      };
      dog_training_preferences: {
        Row: {
          dog_id: string;
          preferred_section_id: string | null;
          training_experience: string | null;
          daily_minutes: number | null;
          delivery_style: string | null;
          onboarding_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["dog_training_preferences"]["Row"]> & { dog_id: string };
        Update: Partial<Database["public"]["Tables"]["dog_training_preferences"]["Row"]>;
      };
      dog_goals: { Row: DogRelationshipRow<"goal_key">; Insert: Partial<DogRelationshipRow<"goal_key">>; Update: Partial<DogRelationshipRow<"goal_key">> };
      dog_existing_skills: { Row: SkillRelationshipRow; Insert: Partial<SkillRelationshipRow>; Update: Partial<SkillRelationshipRow> };
      dog_target_skills: { Row: SkillRelationshipRow; Insert: Partial<SkillRelationshipRow>; Update: Partial<SkillRelationshipRow> };
      dog_behavioral_concerns: {
        Row: DogRelationshipRow<"concern_key"> & { custom_note: string | null };
        Insert: Partial<DogRelationshipRow<"concern_key"> & { custom_note: string | null }>;
        Update: Partial<DogRelationshipRow<"concern_key"> & { custom_note: string | null }>;
      };

      training_curriculum_versions: { Row: TrainingCurriculumVersionRow; Insert: Partial<TrainingCurriculumVersionRow>; Update: Partial<TrainingCurriculumVersionRow> };
      training_sections: { Row: TrainingSectionRow; Insert: Partial<TrainingSectionRow>; Update: Partial<TrainingSectionRow> };
      training_skills: { Row: TrainingCurriculumSkillRow; Insert: Partial<TrainingCurriculumSkillRow>; Update: Partial<TrainingCurriculumSkillRow> };
      training_levels: { Row: TrainingLevelRow; Insert: Partial<TrainingLevelRow>; Update: Partial<TrainingLevelRow> };
      training_ready_cards: { Row: TrainingReadyCardRow; Insert: Partial<TrainingReadyCardRow>; Update: Partial<TrainingReadyCardRow> };
      training_lesson_cards: { Row: TrainingLessonCardRow; Insert: Partial<TrainingLessonCardRow>; Update: Partial<TrainingLessonCardRow> };
      training_adaptive_guidance: { Row: TrainingAdaptiveGuidanceRow; Insert: Partial<TrainingAdaptiveGuidanceRow>; Update: Partial<TrainingAdaptiveGuidanceRow> };
      training_checkpoint_policies: { Row: TrainingCheckpointPolicyRow; Insert: Partial<TrainingCheckpointPolicyRow>; Update: Partial<TrainingCheckpointPolicyRow> };
      training_skill_relationships: { Row: TrainingSkillRelationshipRow; Insert: Partial<TrainingSkillRelationshipRow>; Update: Partial<TrainingSkillRelationshipRow> };
      training_media_bindings: { Row: TrainingMediaBindingRow; Insert: Partial<TrainingMediaBindingRow>; Update: Partial<TrainingMediaBindingRow> };
      training_media_scenes: { Row: TrainingMediaSceneRow; Insert: Partial<TrainingMediaSceneRow>; Update: Partial<TrainingMediaSceneRow> };
      training_game_mappings: { Row: TrainingGameMappingRow; Insert: Partial<TrainingGameMappingRow>; Update: Partial<TrainingGameMappingRow> };

      dog_training_skill_progress: { Row: DogTrainingSkillProgressRow; Insert: Partial<DogTrainingSkillProgressRow>; Update: Partial<DogTrainingSkillProgressRow> };
      dog_training_level_progress: { Row: DogTrainingLevelProgressRow; Insert: Partial<DogTrainingLevelProgressRow>; Update: Partial<DogTrainingLevelProgressRow> };
      training_sessions: { Row: TrainingCurriculumSessionRow; Insert: Partial<TrainingCurriculumSessionRow>; Update: Partial<TrainingCurriculumSessionRow> };
      training_attempt_reports: { Row: TrainingAttemptReportRow; Insert: Partial<TrainingAttemptReportRow>; Update: Partial<TrainingAttemptReportRow> };
      training_review_assignments: { Row: TrainingReviewAssignmentRow; Insert: Partial<TrainingReviewAssignmentRow>; Update: Partial<TrainingReviewAssignmentRow> };
      training_energy_ledger: { Row: TrainingEnergyLedgerRow; Insert: Partial<TrainingEnergyLedgerRow>; Update: Partial<TrainingEnergyLedgerRow> };

      quest_templates: { Row: QuestTemplateRow; Insert: Partial<QuestTemplateRow>; Update: Partial<QuestTemplateRow> };
      daily_quests: { Row: DailyQuestRow; Insert: Partial<DailyQuestRow>; Update: Partial<DailyQuestRow> };
      quest_completions: { Row: QuestCompletionRow; Insert: Partial<QuestCompletionRow>; Update: Partial<QuestCompletionRow> };
      wallet_transactions: { Row: WalletTransactionRow; Insert: Partial<WalletTransactionRow>; Update: Partial<WalletTransactionRow> };
      bond_xp_transactions: { Row: BondXpTransactionRow; Insert: Partial<BondXpTransactionRow>; Update: Partial<BondXpTransactionRow> };
      dog_status: { Row: DogStatusRow; Insert: Partial<DogStatusRow>; Update: Partial<DogStatusRow> };
      dog_moments: { Row: DogMomentRow; Insert: Partial<DogMomentRow>; Update: Partial<DogMomentRow> };
      care_events: { Row: CareEventRow; Insert: Partial<CareEventRow>; Update: Partial<CareEventRow> };
      dog_care_routines: { Row: DogCareRoutineRow; Insert: Partial<DogCareRoutineRow>; Update: Partial<DogCareRoutineRow> };
      dog_care_routine_completions: { Row: DogCareRoutineCompletionRow; Insert: Partial<DogCareRoutineCompletionRow>; Update: Partial<DogCareRoutineCompletionRow> };
      subscription_plans: { Row: SubscriptionPlanRow; Insert: Partial<SubscriptionPlanRow>; Update: Partial<SubscriptionPlanRow> };
      user_plan_selections: { Row: UserPlanSelectionRow; Insert: Partial<UserPlanSelectionRow>; Update: Partial<UserPlanSelectionRow> };
      game_catalog: { Row: GameCatalogRow; Insert: Partial<GameCatalogRow>; Update: Partial<GameCatalogRow> };
      game_instances: { Row: GameInstanceRow; Insert: Partial<GameInstanceRow>; Update: Partial<GameInstanceRow> };
      game_entries: { Row: GameEntryRow; Insert: Partial<GameEntryRow>; Update: Partial<GameEntryRow> };
      game_results: { Row: GameResultRow; Insert: Partial<GameResultRow>; Update: Partial<GameResultRow> };
      challenge_games: { Row: ChallengeGameRow; Insert: Partial<ChallengeGameRow>; Update: Partial<ChallengeGameRow> };
      challenge_game_attempts: { Row: ChallengeGameAttemptRow; Insert: Partial<ChallengeGameAttemptRow>; Update: Partial<ChallengeGameAttemptRow> };
      challenge_game_attempt_submissions: { Row: ChallengeGameAttemptSubmissionRow; Insert: Partial<ChallengeGameAttemptSubmissionRow>; Update: Partial<ChallengeGameAttemptSubmissionRow> };
      coupons: { Row: CouponRow; Insert: Partial<CouponRow>; Update: Partial<CouponRow> };
      coupon_purchases: { Row: CouponPurchaseRow; Insert: Partial<CouponPurchaseRow>; Update: Partial<CouponPurchaseRow> };
      avatar_catalog: { Row: AvatarCatalogRow; Insert: Partial<AvatarCatalogRow>; Update: Partial<AvatarCatalogRow> };
      user_avatar_items: { Row: UserAvatarItemRow; Insert: Partial<UserAvatarItemRow>; Update: Partial<UserAvatarItemRow> };
      activity_verifications: { Row: ActivityVerificationRow; Insert: Partial<ActivityVerificationRow>; Update: Partial<ActivityVerificationRow> };
      activity_reward_events: { Row: ActivityRewardEventRow; Insert: Partial<ActivityRewardEventRow>; Update: Partial<ActivityRewardEventRow> };
      game_sessions: { Row: ActivityGameSessionRow; Insert: Partial<ActivityGameSessionRow>; Update: Partial<ActivityGameSessionRow> };
      daily_routine_logs: { Row: DailyRoutineLogRow; Insert: Partial<DailyRoutineLogRow>; Update: Partial<DailyRoutineLogRow> };
    };
    Views: Record<string, never>;
    Functions: {
      bootstrap_user_profile: { Args: Record<string, never>; Returns: Database["public"]["Tables"]["profiles"]["Row"] };
      create_dog_profile: { Args: CreateDogProfileArgs; Returns: Database["public"]["Tables"]["dogs"]["Row"] };
      owns_dog: { Args: { target_dog_id: string }; Returns: boolean };
      resolve_skill_session: { Args: { p_dog_id: string; p_skill_id: string }; Returns: Json };
      get_training_energy: { Args: { p_dog_id: string; p_local_date: string }; Returns: Json };
      start_training_session: { Args: { p_dog_id: string; p_skill_id: string; p_local_date: string; p_idempotency_key: string }; Returns: Json };
      set_session_card_position: { Args: { p_session_id: string; p_card_key: string }; Returns: undefined };
      report_training_result: { Args: { p_session_id: string; p_result: string; p_card_id?: string | null }; Returns: Json };
      end_training_session: { Args: { p_session_id: string; p_reason?: string | null }; Returns: Json };
      initialize_daily_quests: { Args: { target_dog_id: string; requested_date: string }; Returns: Database["public"]["Tables"]["daily_quests"]["Row"][] };
      complete_daily_quest: { Args: { target_daily_quest_id: string; request_key: string }; Returns: Json };
      submit_daily_dog_moment: { Args: { target_dog_id: string; storage_path_value: string; caption_value: string | null; local_date: string; request_key: string }; Returns: Json };
      enter_game: { Args: { target_dog_id: string; target_game_instance_id: string; request_key: string }; Returns: Json };
      start_challenge_game_attempt: { Args: { target_dog_id: string; target_challenge_game_id: string; request_key: string }; Returns: Json };
      purchase_coupon: { Args: { target_dog_id: string; target_coupon_id: string; request_key: string }; Returns: Json };
      get_wallet_summary: { Args: { target_dog_id: string }; Returns: { silver_balance: number; gold_balance: number }[] };
      get_profile_dashboard: { Args: { target_dog_id: string }; Returns: Json };
      complete_dog_care_routine: { Args: { target_routine_id: string; completion_date_value: string; request_key: string }; Returns: Json };
      purchase_avatar_item: { Args: { target_dog_id: string; target_avatar_item_id: string; request_key: string }; Returns: Json };
      equip_avatar_item: { Args: { target_dog_id: string; target_avatar_item_id: string }; Returns: Json };
      purchase_shop_item: { Args: { target_dog_id: string; target_shop_item_id: string; quantity_value: number; request_key: string }; Returns: Json };
      approve_challenge_submission: { Args: { target_submission_id: string; verdict_value: string; reviewer_note_value?: string | null }; Returns: Json };
      submit_user_confirmed_routine: { Args: { target_dog_id: string; routine_activity_id: string; routine_notes: string | null; routine_metadata?: Json }; Returns: ActivityVerificationRow };
      submit_photo_confirmed_routine: { Args: { target_dog_id: string; routine_activity_id: string; storage_path_value: string; routine_notes: string | null; routine_metadata?: Json }; Returns: ActivityVerificationRow };
    };
    Enums: {
      currency_type: "silver_coin" | "gold_coin";
      dog_gender: "male" | "female" | "unknown";
      obedience_level: "beginner" | "basic" | "intermediate" | "advanced";
      energy_level: "low" | "moderate" | "high" | "very_high";
      quest_status: "active" | "completed" | "expired";
      care_event_type: "walk" | "vet" | "grooming" | "medication" | "training" | "playtime" | "custom";
      game_entry_status: "entered" | "awaiting_submission" | "submitted" | "under_review" | "completed" | "rejected";
      challenge_game_difficulty: "easy" | "medium" | "hard" | "featured";
      challenge_attempt_status: "started" | "awaiting_submission" | "submitted" | "under_review" | "passed" | "failed" | "needs_review" | "refunded" | "error";
      coupon_status: "active" | "inactive" | "sold_out";
      plan_type: "free" | "monthly" | "yearly";
      training_category: "basics" | "obedience" | "fun_tricks" | "outdoor_skills" | "social_skills";
    };
    CompositeTypes: Record<string, never>;
  };
};

type BaseRow = {
  id: string;
  created_at: string;
};

type EditableRow = BaseRow & {
  updated_at: string;
};

type DogRelationshipRow<Key extends string> = BaseRow & {
  dog_id: string;
} & Record<Key, string>;

type SkillRelationshipRow = BaseRow & {
  dog_id: string;
  skill_id: string;
};

export type TrainingCurriculumVersionRow = {
  id: string;
  version_key: string;
  title: string;
  status: string;
  effective_date: string | null;
  created_at: string;
};

export type TrainingSectionRow = {
  id: string;
  curriculum_version_id: string;
  section_number: number;
  slug: string;
  title: string;
  description: string | null;
  source_to_product_adaptation: string | null;
  safety_boundary: string | null;
  sort_order: number;
};

export type TrainingCurriculumSkillRow = {
  id: string;
  section_id: string;
  skill_code: string;
  internal_concept_id: string;
  slug: string;
  title: string;
  source_label_ko: string | null;
  one_line_goal: string;
  product_status: string | null;
  shared_skill_bridge_relation: string | null;
  skill_promise: string | null;
  boundaries: Json;
  authoring_state: string | null;
  sort_order: number;
};

export type TrainingLevelRow = {
  id: string;
  skill_id: string;
  stage_type: "level" | "checkpoint";
  level_number: number | null;
  sequence_index: number;
  title: string;
  goal: string | null;
  observable_criterion: string | null;
  first_part: string | null;
  next_part: string | null;
  easier_path: string | null;
  success_anchor: string | null;
  entry_rule: string | null;
  implementation_status: string | null;
  additional_practice_allowed: boolean;
};

export type TrainingReadyCardRow = {
  id: string;
  level_id: string;
  materials: Json;
  safety_copy: string;
  primary_action: string;
  secondary_action: string;
};

export type TrainingLessonCardRow = {
  id: string;
  level_id: string;
  card_key: string;
  card_type: "orient" | "demo" | "guardian" | "additional_practice" | "completion";
  sort_order: number;
  title: string | null;
  body: string | null;
  key_action: string | null;
  try_it: string | null;
  harder_part: string | null;
  finish_instruction: string | null;
  success_copy: string | null;
  not_yet_copy: string | null;
  uncertainty_instruction: string | null;
  buttons: Json;
  media_binding_id: string | null;
  exact_copy_available: boolean;
  lesson_contract_version: string;
};

export type TrainingAdaptiveGuidanceRow = {
  id: string;
  level_id: string;
  observation: string;
  observation_stage: string | null;
  guidance_title: string;
  guidance_text: string;
  routing_instruction: string | null;
  sort_order: number;
};

export type TrainingCheckpointPolicyRow = {
  id: string;
  skill_id: string;
  checkpoint_level_id: string;
  entry_rule: string;
  guardian_instruction: string;
  success_copy: string;
  not_yet_copy: string;
  success_next_state: string;
  not_yet_next_state: string;
  no_immediate_retest: boolean;
  maintenance_review_behavior: string | null;
};

export type TrainingSkillRelationshipRow = {
  id: string;
  from_skill_id: string;
  to_skill_id: string | null;
  relationship_type: "bridge" | "shared_foundation" | "related" | "advanced_context";
  rule_text: string;
  hard_prerequisite: boolean;
};

export type TrainingMediaBindingRow = {
  id: string;
  level_id: string;
  demo_id: string;
  media_url: string | null;
  poster_url: string | null;
  status: string;
  production_notes: string | null;
  fallback_text: string | null;
};

export type TrainingMediaSceneRow = {
  id: string;
  media_binding_id: string;
  source_scene_id: string;
  purpose: string;
  required_sequence_beat: string | null;
  acceptance_focus: string | null;
  sort_order: number;
};

export type TrainingGameMappingRow = {
  id: string;
  skill_id: string;
  status: string;
  is_mapped_candidate: boolean;
  challenge_title: string | null;
  bounded_criterion: string | null;
  train_effect: string | null;
};

export type DogTrainingSkillProgressRow = {
  id: string;
  dog_id: string;
  skill_id: string;
  status: "not_started" | "in_progress" | "completed";
  current_level_number: number;
  checkpoint_status: "not_eligible" | "eligible" | "passed" | "needs_review";
  latest_result: "success" | "not_yet" | null;
  review_soon: boolean;
  level5_completed_at: string | null;
  checkpoint_retry_not_before: string | null;
  last_practiced_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DogTrainingLevelProgressRow = {
  id: string;
  dog_id: string;
  level_id: string;
  status: "not_started" | "in_progress" | "completed";
  latest_result: "success" | "not_yet" | null;
  successful_at: string | null;
  attempt_count: number;
  last_practiced_at: string | null;
  review_soon: boolean;
  created_at: string;
  updated_at: string;
};

export type TrainingCurriculumSessionRow = {
  id: string;
  dog_id: string;
  skill_id: string;
  level_id: string;
  session_type: "normal" | "review" | "bridge" | "checkpoint";
  lesson_contract_version: string;
  status: "active" | "completed" | "ended";
  started_at: string;
  completed_at: string | null;
  ended_at: string | null;
  energy_consumed: boolean;
  retry_used: boolean;
  final_result: "success" | "not_yet" | "ended" | null;
  safety_disposition: string | null;
  current_card_key: string | null;
  effective_local_day: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
};

export type TrainingAttemptReportRow = {
  id: string;
  session_id: string;
  level_id: string;
  card_id: string | null;
  attempt_number: number;
  is_additional_practice: boolean;
  adaptive_guidance_id: string | null;
  result: "success" | "not_yet" | "uncertain";
  original_criterion_met: boolean;
  reported_at: string;
};

export type TrainingReviewAssignmentRow = {
  id: string;
  dog_id: string;
  skill_id: string;
  level_id: string;
  review_type: "easier_review" | "bridge" | "targeted_level_review" | "maintenance_review";
  source_session_id: string | null;
  due_at: string | null;
  eligible_at: string | null;
  status: "pending" | "active" | "completed" | "cancelled";
  reason: string | null;
  created_at: string;
  completed_at: string | null;
};

export type TrainingEnergyLedgerRow = {
  id: string;
  dog_id: string;
  effective_local_day: string;
  delta: number;
  reason: string;
  session_id: string | null;
  created_at: string;
};

export type TrainingSkillRow = EditableRow & {
  slug: string;
  name: string;
  category: Database["public"]["Enums"]["training_category"];
  difficulty: number;
  estimated_minutes: number;
  description: string;
  instructions: Json;
  silver_reward: number;
  bond_xp_reward: number;
  focus_delta: number;
  discipline_delta: number;
  social_delta: number;
  energy_delta: number;
  intelligence_delta: number;
  is_active: boolean;
};

export type TrainingProgressRow = EditableRow & {
  dog_id: string;
  skill_id: string;
  sessions_completed: number;
  completion_percentage: number;
  completed_at: string | null;
};

export type TrainingSessionRow = BaseRow & {
  dog_id: string;
  skill_id: string;
  owner_id: string;
  idempotency_key: string;
  completed_at: string;
};

export type QuestTemplateRow = EditableRow & {
  slug: string;
  title: string;
  description: string;
  quest_type: string;
  silver_reward: number;
  bond_xp_reward: number;
  is_active: boolean;
};

export type DailyQuestRow = EditableRow & {
  dog_id: string;
  template_id: string;
  quest_date: string;
  status: Database["public"]["Enums"]["quest_status"];
};

export type QuestCompletionRow = BaseRow & {
  daily_quest_id: string;
  dog_id: string;
  owner_id: string;
  idempotency_key: string;
  completed_at: string;
};

export type WalletTransactionRow = BaseRow & {
  owner_id: string;
  dog_id: string;
  currency: Database["public"]["Enums"]["currency_type"];
  amount: number;
  reason: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
  idempotency_key: string;
};

export type BondXpTransactionRow = BaseRow & {
  owner_id: string;
  dog_id: string;
  amount: number;
  reason: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
  idempotency_key: string;
};

export type DogStatusRow = {
  dog_id: string;
  focus: number;
  discipline: number;
  social: number;
  energy: number;
  intelligence: number;
  updated_at: string;
};

export type DogMomentRow = EditableRow & {
  dog_id: string;
  owner_id: string;
  storage_path: string;
  caption: string | null;
  moment_date: string;
  reward_claimed: boolean;
};

export type CareEventRow = EditableRow & {
  dog_id: string;
  owner_id: string;
  event_type: Database["public"]["Enums"]["care_event_type"];
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
};

export type SubscriptionPlanRow = EditableRow & {
  plan_type: Database["public"]["Enums"]["plan_type"];
  name: string;
  description: string;
  price_display: string | null;
  is_paid: boolean;
  is_active: boolean;
  features: Json;
};

export type UserPlanSelectionRow = BaseRow & {
  owner_id: string;
  plan_id: string;
  selected_at: string;
};

export type GameCatalogRow = EditableRow & {
  slug: string;
  name: string;
  description: string;
  silver_entry_cost: number;
  difficulty?: Database["public"]["Enums"]["challenge_game_difficulty"];
  gold_coin_pass_reward?: number;
  bonus_xp?: number;
  is_active: boolean;
};

export type GameInstanceRow = EditableRow & {
  game_catalog_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  submission_deadline: string | null;
  is_active: boolean;
};

export type GameEntryRow = EditableRow & {
  game_instance_id: string;
  dog_id: string;
  owner_id: string;
  status: Database["public"]["Enums"]["game_entry_status"];
  submission_path: string | null;
  idempotency_key: string;
};

export type GameResultRow = EditableRow & {
  game_entry_id: string;
  placement: number | null;
  gold_awarded: number;
  review_note: string | null;
  reviewed_at: string | null;
};

export type ChallengeGameRow = EditableRow & {
  category: string;
  title: string;
  subtitle: string;
  description: string;
  difficulty: Database["public"]["Enums"]["challenge_game_difficulty"];
  recording_setup: Json;
  user_instructions: Json;
  min_clip_seconds: number;
  max_clip_seconds: number;
  required_mastered_activity_ids: Json;
  verifier_prompt: string;
  silver_coin_entry_cost: number;
  gold_coin_pass_reward: number;
  bonus_xp: number;
  max_stars: number;
  safety_notes: Json | null;
  is_active: boolean;
};

export type ChallengeGameAttemptRow = EditableRow & {
  challenge_game_id: string;
  dog_id: string;
  owner_id: string;
  status: Database["public"]["Enums"]["challenge_attempt_status"];
  silver_coin_entry_cost: number;
  gold_coin_pass_reward: number;
  bonus_xp: number;
  free_resubmissions_remaining: number;
  charged_at: string;
  refunded_at: string | null;
  rewarded_at: string | null;
  idempotency_key: string;
};

export type ChallengeGameAttemptSubmissionRow = BaseRow & {
  attempt_id: string;
  dog_id: string;
  owner_id: string;
  storage_path: string | null;
  verdict: "PASS" | "FAIL" | "NEEDS_REVIEW" | null;
  confidence: number | null;
  verification_result: Json | null;
  technical_failure: boolean;
  idempotency_key: string;
};

export type CouponRow = EditableRow & {
  title: string;
  description: string;
  gold_coin_cost: number;
  status: Database["public"]["Enums"]["coupon_status"];
  redemption_instructions: string;
  expires_at: string | null;
};

export type CouponPurchaseRow = BaseRow & {
  coupon_id: string;
  owner_id: string;
  dog_id: string;
  gold_coin_cost: number;
  status: "purchased" | "redeemed" | "cancelled";
  idempotency_key: string;
};

export type AvatarCatalogRow = EditableRow & {
  slug: string;
  name: string;
  silver_cost: number;
  asset_key: string;
  is_active: boolean;
};

export type UserAvatarItemRow = BaseRow & {
  owner_id: string;
  dog_id: string;
  avatar_item_id: string;
  acquired_at: string;
};

export type ActivityVerificationRow = EditableRow & {
  user_id: string;
  dog_id: string;
  activity_id: string;
  activity_category: string;
  verification_mode: string;
  trust_level: string;
  context_type: string;
  related_quest_id: string | null;
  related_training_lesson_id: string | null;
  related_game_session_id: string | null;
  related_tournament_id: string | null;
  source_type: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  status: string;
  confidence_score: number | null;
  model_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  analyzed_at: string | null;
  duration_ms: number | null;
  fps: number | null;
  sensor_metadata: Json | null;
  pose_summary: Json | null;
  analysis_summary: Json | null;
  failure_reason: string | null;
  retry_guidance: string | null;
  camera_quality_metadata: Json | null;
  user_retry_count: number;
  manual_label: string | null;
  correct_result: boolean | null;
  incorrect_result: boolean | null;
  needs_labeling: boolean;
  labeled_activity: string | null;
  reviewer_notes: string | null;
};

export type ActivityRewardEventRow = BaseRow & {
  verification_id: string;
  user_id: string;
  dog_id: string;
  xp_awarded: number;
  coins_awarded: number;
  reward_reason: string;
};

export type ActivityGameSessionRow = BaseRow & {
  activity_id: string;
  game_type: string;
  user_id: string;
  dog_id: string;
  opponent_user_id: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  score_value: number | null;
  score_unit: string | null;
  verification_id: string | null;
  rank_eligible: boolean;
  suspicious: boolean;
  challenge_token_hash: string | null;
};

export type DailyRoutineLogRow = BaseRow & {
  user_id: string;
  dog_id: string;
  routine_type: string;
  verification_id: string | null;
  completion_method: string;
  completed_at: string;
  notes: string | null;
  metadata: Json | null;
};

export type DogCareRoutineRow = EditableRow & {
  dog_id: string;
  owner_id: string;
  routine_key: string;
  title: string;
  description: string;
  icon_key: string;
  silver_reward: number;
  sort_order: number;
  is_active: boolean;
  reminder_time: string | null;
};

export type DogCareRoutineCompletionRow = BaseRow & {
  routine_id: string;
  dog_id: string;
  owner_id: string;
  completion_date: string;
  silver_awarded: number;
  idempotency_key: string;
};

export type CreateDogProfileArgs = {
  dog_name: string;
  dog_gender_value: Database["public"]["Enums"]["dog_gender"];
  dog_birthday: string | null;
  dog_age_years: number | null;
  dog_breed: string;
  dog_owned_since: string | null;
  dog_adoption_date: string | null;
  dog_obedience_level: Database["public"]["Enums"]["obedience_level"];
  dog_energy_level: Database["public"]["Enums"]["energy_level"];
  goal_keys: string[];
  existing_skill_ids: string[];
  target_skill_ids: string[];
  concern_keys: string[];
  concern_other_note: string | null;
};
