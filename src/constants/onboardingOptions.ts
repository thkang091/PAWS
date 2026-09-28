import type { DogPose } from "@/components/mascot/PawsDog";
import type { CareEventType, EnergyLevel, ObedienceLevel, DogGender, OwnerTrainingGoal, TrainingGoalCategoryMeta } from "@/types/domain";

export const genderOptions: Array<{ label: string; value: DogGender }> = [
  { label: "Female", value: "female" },
  { label: "Male", value: "male" },
  { label: "Unknown", value: "unknown" },
];

export const goalOptions = [
  { label: "Better bonding", value: "better_bonding" },
  { label: "Better training", value: "better_training" },
  { label: "More consistency", value: "more_consistency" },
  { label: "Daily memories", value: "daily_memories" },
  { label: "More outdoor time", value: "more_outdoor_time" },
  { label: "Better socialization", value: "better_socialization" },
] as const;

export const obedienceOptions: Array<{ label: string; value: ObedienceLevel }> = [
  { label: "Beginner", value: "beginner" },
  { label: "Knows basics", value: "basic" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Advanced", value: "advanced" },
];

export const energyOptions: Array<{ label: string; value: EnergyLevel }> = [
  { label: "Low", value: "low" },
  { label: "Moderate", value: "moderate" },
  { label: "High", value: "high" },
  { label: "Very high", value: "very_high" },
];

export const concernOptions = [
  { label: "Pulling on leash", value: "pulling_on_leash" },
  { label: "Barking", value: "barking" },
  { label: "Separation anxiety", value: "separation_anxiety" },
  { label: "Jumping on people", value: "jumping_on_people" },
  { label: "Reactivity around dogs", value: "reactivity_around_dogs" },
  { label: "Recall difficulty", value: "recall_difficulty" },
  { label: "Potty training", value: "potty_training" },
  { label: "Chewing", value: "chewing" },
  { label: "Fearfulness", value: "fearfulness" },
  { label: "Other", value: "other" },
] as const;

export const careEventOptions: Array<{ label: string; value: CareEventType }> = [
  { label: "Walk", value: "walk" },
  { label: "Vet appointment", value: "vet" },
  { label: "Grooming", value: "grooming" },
  { label: "Medication", value: "medication" },
  { label: "Training session", value: "training" },
  { label: "Playtime", value: "playtime" },
  { label: "Custom", value: "custom" },
];

export const trainingGoalCategories: TrainingGoalCategoryMeta[] = [
  {
    key: 'BETTER_BEHAVIOR_AT_HOME',
    title: 'Better Behavior at Home',
    subtitle: 'Jumping, doors, food manners, settling calmly',
    iconName: 'home-outline',
    painPoints: [
      { key: 'jumping_on_people', label: 'Jumping on people' },
      { key: 'rushing_through_doors', label: 'Rushing through doors' },
      { key: 'grabbing_objects', label: 'Grabbing objects' },
      { key: 'refusing_to_drop', label: 'Refusing to drop items' },
      { key: 'food_manners', label: 'Food manners' },
      { key: 'settling_calmly', label: 'Settling calmly' },
      { key: 'doorbell_guest_routine', label: 'Doorbell and guest routine' },
      { key: 'crate_safe_zone', label: 'Crate or safe-zone routine' },
      { key: 'staying_on_mat', label: 'Staying on a mat' },
      { key: 'calm_play_recovery', label: 'Calm play and recovery' },
    ],
  },
  {
    key: 'SAFETY_AND_OBEDIENCE',
    title: 'Safety and Obedience',
    subtitle: 'Recall, leave it, emergency commands',
    iconName: 'shield-checkmark-outline',
    painPoints: [
      { key: 'name_response', label: 'Name response' },
      { key: 'sit_down_stay', label: 'Sit, down, and stay' },
      { key: 'recall', label: 'Recall' },
      { key: 'whistle_recall', label: 'Whistle recall' },
      { key: 'emergency_recall', label: 'Emergency recall' },
      { key: 'leave_it', label: 'Leave it' },
      { key: 'drop_it', label: 'Drop it' },
      { key: 'doorway_safety', label: 'Doorway safety' },
      { key: 'collar_touch_comfort', label: 'Collar-touch comfort' },
      { key: 'emergency_u_turn', label: 'Emergency U-turn' },
    ],
  },
  {
    key: 'BETTER_WALKS',
    title: 'Better Walks',
    subtitle: 'Loose leash, passing dogs, direction changes',
    iconName: 'walk-outline',
    painPoints: [
      { key: 'pulling_on_leash', label: 'Pulling on leash' },
      { key: 'ignoring_me_outside', label: 'Ignoring me outside' },
      { key: 'rushing_through_doors', label: 'Rushing through doors' },
      { key: 'difficulty_changing_direction', label: 'Difficulty changing direction' },
      { key: 'difficulty_passing_objects', label: 'Difficulty passing objects' },
      { key: 'difficulty_passing_people', label: 'Difficulty passing people' },
      { key: 'difficulty_passing_dogs', label: 'Difficulty passing dogs' },
      { key: 'weak_outdoor_recall', label: 'Weak outdoor recall' },
      { key: 'poor_curb_awareness', label: 'Poor curb awareness' },
      { key: 'trouble_settling_breaks', label: 'Trouble settling during breaks' },
    ],
  },
  {
    key: 'COOL_TRICKS_AND_GAMES',
    title: 'Cool Tricks and Games',
    subtitle: 'Spins, paw tricks, fetch games, combos',
    iconName: 'star-outline',
    painPoints: [
      { key: 'beginner_tricks', label: 'Beginner tricks' },
      { key: 'shareable_tricks', label: 'Shareable tricks' },
      { key: 'photo_poses', label: 'Photo poses' },
      { key: 'trick_combinations', label: 'Trick combinations' },
      { key: 'body_awareness_challenges', label: 'Body-awareness challenges' },
      { key: 'fetch_games', label: 'Fetch games' },
      { key: 'search_games', label: 'Search games' },
      { key: 'speed_challenges', label: 'Speed challenges' },
      { key: 'endurance_challenges', label: 'Endurance challenges' },
      { key: 'weekly_tournaments', label: 'Weekly tournaments' },
    ],
  },
  {
    key: 'HELPFUL_SKILLS_AROUND_THE_HOUSE',
    title: 'Helpful Skills Around the House',
    subtitle: 'Fetch, carry, tidy up, find a person',
    iconName: 'construct-outline',
    painPoints: [
      { key: 'bring_a_toy', label: 'Bring a toy' },
      { key: 'carry_an_object', label: 'Carry an object' },
      { key: 'put_toys_away', label: 'Put toys away' },
      { key: 'find_a_toy', label: 'Find a toy' },
      { key: 'find_family_member', label: 'Find a family member' },
      { key: 'touch_a_button', label: 'Touch a button' },
      { key: 'ring_a_bell', label: 'Ring a bell' },
      { key: 'close_a_drawer', label: 'Close a drawer' },
      { key: 'go_to_designated_mat', label: 'Go to a designated mat' },
      { key: 'deliver_object_to_person', label: 'Deliver an object to a person' },
    ],
  },
  {
    key: 'CALM_ALONE_TIME',
    title: 'Calm Alone Time',
    subtitle: 'Safe-zone routine, gradual step-away, independence',
    iconName: 'moon-outline',
    painPoints: [
      { key: 'safe_zone_routine', label: 'Safe-zone routine' },
      { key: 'open_crate_comfort', label: 'Open-crate comfort' },
      { key: 'settling_independently', label: 'Settling independently' },
      { key: 'short_owner_step_away', label: 'Short owner step-away' },
      { key: 'owner_leaving_room', label: 'Owner leaving the room briefly' },
      { key: 'calm_departure_routine', label: 'Calm departure routine' },
      { key: 'enrichment_while_alone', label: 'Enrichment while alone' },
      { key: 'calm_return_routine', label: 'Calm return routine' },
      { key: 'gradual_short_separations', label: 'Gradually longer short separations' },
      { key: 'visible_progress_logging', label: 'Visible progress logging' },
    ],
  },
  {
    key: 'HANDLING_AND_GROOMING',
    title: 'Handling and Grooming',
    subtitle: 'Touch, nails, brushing, baths, vet visits',
    iconName: 'cut-outline',
    painPoints: [
      { key: 'touch_confidence', label: 'Touch confidence' },
      { key: 'brushing_basics', label: 'Brushing basics' },
      { key: 'paw_checks', label: 'Paw checks' },
      { key: 'nail_care', label: 'Nail care' },
      { key: 'ears_eyes_teeth', label: 'Ears, eyes and teeth' },
      { key: 'bath_time', label: 'Bath time' },
      { key: 'being_picked_up', label: 'Being picked up' },
      { key: 'vet_visits', label: 'Vet visits' },
      { key: 'harness_and_collar', label: 'Harness and collar' },
      { key: 'calm_care_routines', label: 'Calm care routines' },
    ],
  },
  {
    key: 'POTTY_AND_REAL_WORLD',
    title: 'Potty Routine',
    subtitle: 'A schedule, clear cues, and fewer accidents',
    iconName: 'time-outline',
    painPoints: [
      { key: 'set_a_potty_schedule', label: 'Set a potty schedule' },
      { key: 'potty_cues', label: 'Potty cues' },
      { key: 'going_outside_successfully', label: 'Going outside successfully' },
      { key: 'rewards_and_praise', label: 'Rewards and praise' },
      { key: 'build_consistency', label: 'Build consistency' },
      { key: 'overnight_routine', label: 'Overnight routine' },
      { key: 'accident_recovery', label: 'Accident recovery' },
      { key: 'signals_to_go_out', label: 'Signals to go out' },
      { key: 'new_places', label: 'New places' },
      { key: 'crate_and_potty', label: 'Crate and potty' },
    ],
  },
  {
    key: 'HEALTHY_HABITS',
    title: 'Healthy Habits',
    subtitle: 'Meals, water, sleep, exercise, daily checks',
    iconName: 'nutrition-outline',
    painPoints: [
      { key: 'balanced_meals', label: 'Balanced meals' },
      { key: 'fresh_water', label: 'Fresh water' },
      { key: 'quality_sleep', label: 'Quality sleep' },
      { key: 'regular_exercise', label: 'Regular exercise' },
      { key: 'routine_checklist', label: 'Routine checklist' },
      { key: 'weight_and_body_condition', label: 'Weight and body condition' },
      { key: 'mealtime_manners', label: 'Mealtime manners' },
      { key: 'enrichment_and_chewing', label: 'Enrichment and chewing' },
      { key: 'rest_after_play', label: 'Rest after play' },
      { key: 'daily_health_check', label: 'Daily health check' },
    ],
  },
  {
    key: 'SOCIAL_SKILLS',
    title: 'Social Skills',
    subtitle: 'Calm greetings, new people, other dogs',
    iconName: 'people-outline',
    painPoints: [
      { key: 'calm_greetings', label: 'Calm greetings' },
      { key: 'meeting_new_people', label: 'Meeting new people' },
      { key: 'passing_other_dogs', label: 'Passing other dogs' },
      { key: 'visitor_manners', label: 'Visitor manners' },
      { key: 'building_confidence', label: 'Building confidence' },
      { key: 'children_and_crowds', label: 'Children and crowds' },
      { key: 'polite_play', label: 'Polite play' },
      { key: 'giving_space', label: 'Giving space' },
      { key: 'recovering_from_a_fright', label: 'Recovering from a fright' },
      { key: 'busy_places', label: 'Busy places' },
    ],
  },
];

export const trainingGoalCategoryMap = new Map<OwnerTrainingGoal, TrainingGoalCategoryMeta>(
  trainingGoalCategories.map((c) => [c.key, c])
);

export type DogAgeBucket = "puppy" | "young_adult" | "senior" | "unsure";

export type AgeBucketOption = {
  value: DogAgeBucket;
  title: string;
  detail: string | null;
  pose: DogPose;
  curious?: boolean;
};

export const ageBucketOptions: AgeBucketOption[] = [
  { value: "puppy", title: "Puppy", detail: "Under 1 year", pose: "puppy" },
  { value: "young_adult", title: "Young Adult", detail: "1–7 years", pose: "young" },
  { value: "senior", title: "Senior", detail: "7+ years", pose: "senior" },
  { value: "unsure", title: "Not sure", detail: null, pose: "unsure", curious: true },
];

export type TogetherDuration = "just_home" | "under_a_month" | "a_few_months" | "a_year_plus";

export type TogetherIcon = "house" | "paw" | "bone" | "heart";

export type TogetherOption = {
  value: TogetherDuration;
  labelTemplate: string;
  icon: TogetherIcon;
};

export const togetherOptions: TogetherOption[] = [
  { value: "just_home", labelTemplate: "Just brought {name} home", icon: "house" },
  { value: "under_a_month", labelTemplate: "Less than a month", icon: "paw" },
  { value: "a_few_months", labelTemplate: "A few months", icon: "bone" },
  { value: "a_year_plus", labelTemplate: "A year or more", icon: "heart" },
];

export const formatTogetherLabel = (option: TogetherOption, dogName: string): string =>
  option.labelTemplate.replace("{name}", dogName.trim() || "them");
