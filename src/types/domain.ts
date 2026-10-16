import type { Database } from "@/types/database";

export type Currency = Database["public"]["Enums"]["currency_type"] | "silver" | "gold";
export type CurrencyType = "silver_coin" | "gold_coin";
export type TrainingDifficulty = "easy" | "medium" | "hard";
export type ChallengeGameDifficulty = "easy" | "medium" | "hard" | "featured";
export type ChallengeGameEconomy = {
  silverCoinEntryCost: number;
  goldCoinPassReward: number;
  bonusXp: number;
};
export type CurrencyTransactionReason =
  | "training_activity_completion"
  | "daily_quest_completion"
  | "challenge_game_entry"
  | "challenge_game_pass_reward"
  | "challenge_game_refund"
  | "coupon_purchase"
  | "legacy_coin_migration";
export type CurrencyTransaction = {
  id: string;
  userId: string;
  dogId?: string;
  currencyType: CurrencyType;
  amount: number;
  reason: CurrencyTransactionReason;
  relatedActivityId?: string;
  relatedChallengeGameId?: string;
  relatedCouponId?: string;
  createdAt: string;
};
export type DogCurrencyBalance = {
  silverCoins: number;
  goldCoins: number;
};
export type DogGender = Database["public"]["Enums"]["dog_gender"];
export type ObedienceLevel = Database["public"]["Enums"]["obedience_level"];
export type EnergyLevel = Database["public"]["Enums"]["energy_level"];
export type TrainingCategory = Database["public"]["Enums"]["training_category"];
export type CareEventType = Database["public"]["Enums"]["care_event_type"];
export type StatusTone = "neutral" | "success" | "warning" | "error";

export type Profile = {
  id: string;
  onboardingCompleted: boolean;
  tutorialCompleted: boolean;
};

export type Dog = {
  id: string;
  ownerId: string;
  name: string;
  gender: DogGender;
  birthday: string | null;
  ageYears: number | null;
  breed: string;
  ownedSince: string | null;
  adoptionDate: string | null;
  obedienceLevel: ObedienceLevel;
  energyLevel: EnergyLevel;
  dogTag: string;
};

export type TrainingSkill = {
  id: string;
  slug: string;
  name: string;
  category: TrainingCategory;
  difficulty: number;
  estimatedMinutes: number;
  description: string;
  instructions: string[];
  silverReward: number;
  bondXpReward: number;
};

export type TrainingProgress = {
  id: string;
  dogId: string;
  skillId: string;
  sessionsCompleted: number;
  completionPercentage: number;
  completedAt: string | null;
};

export type DailyQuest = {
  id: string;
  dogId: string;
  templateId: string;
  questDate: string;
  status: "active" | "completed" | "expired";
  title?: string;
  description?: string;
  silverReward?: number;
  bondXpReward?: number;
};

export type DogMoment = {
  id: string;
  dogId: string;
  storagePath: string;
  caption: string | null;
  momentDate: string;
  imageUrl?: string | null;
};

export type CareEvent = {
  id: string;
  dogId: string;
  eventType: CareEventType;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
};

export type CareRoutine = {
  id: string;
  dogId: string;
  routineKey: string;
  title: string;
  description: string;
  iconKey: string;
  silverReward: number;
  sortOrder: number;
  isActive: boolean;
  reminderTime: string | null;
};

export type CareRoutineCompletion = {
  id: string;
  routineId: string;
  dogId: string;
  completionDate: string;
  silverAwarded: number;
};

export type WalletSummary = {
  silverBalance: number;
  goldBalance: number;
};

export type DogStatus = {
  focus: number;
  discipline: number;
  social: number;
  energy: number;
  intelligence: number;
};

export type DogDashboard = {
  dog: Dog;
  wallet: WalletSummary;
  bondXp: number;
  level: number;
  status: DogStatus;
  streak: number;
  trainingSummary: {
    completedSkills: number;
    activeSkills: number;
  };
};

export type GameDefinition = {
  id: string;
  slug: string;
  name: string;
  description: string;
  silverEntryCost: number;
  goldPassReward?: number;
  bonusXp?: number;
  difficulty?: ChallengeGameDifficulty;
};

export type ChallengeVerificationResult = {
  verdict: "PASS" | "FAIL" | "NEEDS_REVIEW";
  confidence: number;
  summary: string;
  observedCheckpoints: string[];
  missingCheckpoints: string[];
  safetyFlags: string[];
};

export type ChallengeGame = {
  id: string;
  category: OwnerTrainingGoal;
  title: string;
  subtitle: string;
  description: string;
  difficulty: ChallengeGameDifficulty;
  recordingSetup: string[];
  userInstructions: string[];
  clipDurationSeconds: {
    min: number;
    max: number;
  };
  requiredMasteredActivityIds: string[];
  verifierPrompt: string;
  economy: ChallengeGameEconomy;
  maxStars: 3;
  safetyNotes?: string[];
};

export type GameInstance = {
  id: string;
  gameCatalogId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  submissionDeadline: string | null;
};

export type GameEntry = {
  id: string;
  gameInstanceId: string;
  dogId: string;
  status: Database["public"]["Enums"]["game_entry_status"];
};

export type Coupon = {
  id: string;
  title: string;
  description: string;
  goldCoinCost: number;
  status: "active" | "inactive" | "sold_out";
  redemptionInstructions: string;
  expiresAt?: string;
};

export type CouponPurchase = {
  id: string;
  couponId: string;
  dogId: string;
  goldCoinCost: number;
  status: "purchased" | "redeemed" | "cancelled";
  createdAt: string;
};

export type SubscriptionPlan = {
  id: string;
  planType: Database["public"]["Enums"]["plan_type"];
  name: string;
  description: string;
  priceDisplay: string | null;
  isPaid: boolean;
  features: string[];
};

export type AccountStatus = {
  isAnonymous: boolean;
  hasRecoverableIdentity: boolean;
  email?: string;
};

export type BackendHealthCheckItem = {
  key: string;
  label: string;
  status: "pass" | "fail" | "warning";
  message: string;
};

export type WeeklyPlanItem = {
  id: string;
  scheduledDate: string;
  itemType: "training" | "dog_moment" | "walk" | "bonding" | "care_note" | "rest";
  title: string;
  description: string | null;
  skillId: string | null;
  estimatedMinutes: number | null;
  status: "pending" | "completed" | "skipped";
  sortOrder: number;
};

export type WeeklyPlan = {
  id: string;
  dogId: string;
  weekStartDate: string;
  generatedReason: string;
  items: WeeklyPlanItem[];
};

export type WeightLog = {
  id: string;
  dogId: string;
  weightValue: number;
  weightUnit: "lb" | "kg";
  recordedAt: string;
  note: string | null;
};

export type AvatarItem = {
  id: string;
  slug: string;
  name: string;
  silverCost: number;
  assetKey: string;
  slotType: "neck" | "outfit" | "background" | "dog_tag_frame";
  isActive: boolean;
};

export type OwnedAvatarItem = {
  id: string;
  dogId: string;
  avatarItemId: string;
};

export type EquippedAvatarItem = {
  id: string;
  dogId: string;
  slotType: AvatarItem["slotType"];
  avatarItemId: string;
};

export type NotificationPreferences = {
  dogMomentReminder: boolean;
  dailyQuestReminder: boolean;
  trainingReminder: boolean;
  streakAtRiskReminder: boolean;
  careEventReminder: boolean;
  weeklyRecap: boolean;
  reminderTime: string;
};

export type PlaceholderScreenContent = {
  title: string;
  description: string;
  nextPhase: string;
};

export type OwnerTrainingGoal =
  | 'BETTER_BEHAVIOR_AT_HOME'
  | 'SAFETY_AND_OBEDIENCE'
  | 'BETTER_WALKS'
  | 'COOL_TRICKS_AND_GAMES'
  | 'HELPFUL_SKILLS_AROUND_THE_HOUSE'
  | 'CALM_ALONE_TIME'
  | 'RULES_AND_BOUNDARIES'
  | 'CLEAR_COMMUNICATION'
  | 'HANDLING_AND_GROOMING'
  | 'CALM_EVERYDAY_MANNERS'
  | 'PROBLEM_BEHAVIORS'
  | 'POTTY_AND_REAL_WORLD'
  | 'NOT_SURE_YET'
  | 'SOMETHING_ELSE'
  | 'DOING_WELL'
  | 'HEALTHY_HABITS'
  | 'SOCIAL_SKILLS';

export type QuestContentType =
  | 'AI_VERIFIED_MAIN_QUEST'
  | 'GUIDED_SIDE_QUEST'
  | 'HYBRID_QUEST'
  | 'HYBRID_BOSS_QUEST';

export type TrainingGoalCategory = OwnerTrainingGoal;

export type VerificationStatus = CurriculumVerificationStatus;

export type ReferenceAssetType =
  | 'DOG_PROFILE'
  | 'TARGET_TOY'
  | 'TARGET_MAT'
  | 'TARGET_BOWL'
  | 'TARGET_BASKET'
  | 'TARGET_CRATE'
  | 'TARGET_DOORWAY'
  | 'TARGET_PLATFORM'
  | 'TARGET_CONE'
  | 'TARGET_BOX'
  | 'TARGET_BUTTON'
  | 'TARGET_BELL'
  | 'TARGET_DRAWER'
  | 'TARGET_PERSON'
  | 'CUSTOM_OBJECT';

export type ReferenceAssetRequirement = {
  type: ReferenceAssetType;
  required: boolean;
  minimumPhotos: number;
  maximumPhotos: number;
  reusableAcrossActivities: boolean;
  instructions: string[];
};

export type CameraAngle =
  | 'SIDE_FULL_BODY'
  | 'FRONT_FULL_BODY'
  | 'REAR_FULL_BODY'
  | 'WIDE_ROOM_OWNER_AND_DOG'
  | 'WIDE_ROUTE_OWNER_DOG_AND_LEASH'
  | 'CLOSE_HAND_AND_OBJECT'
  | 'VISIBLE_TARGET_ZONE'
  | 'VISIBLE_OBJECT_AND_DESTINATION'
  | 'MULTI_CLIP_COMPONENT_SET'
  | 'CUSTOM';

export type RecordingRequirements = {
  cameraAngle: CameraAngle;
  fullDogBodyRequired: boolean;
  pawsRequired: boolean;
  hipsRequired: boolean;
  ownerRequiredInFrame: boolean;
  audioRequired: boolean;
  targetObjectRequiredInFrame: boolean;
  destinationRequiredInFrame: boolean;
  startBoundaryRequiredInFrame: boolean;
  endBoundaryRequiredInFrame: boolean;
  setupInstructions: string[];
};

export type RoadmapDifficultyMode =
  | 'LEARN'
  | 'REPEAT'
  | 'ADD_DURATION'
  | 'ADD_DISTANCE'
  | 'ADD_DISTRACTION'
  | 'REAL_LIFE_PROOF'
  | 'MAINTENANCE'
  | 'REGRESSION'
  | 'BOSS_BATTLE';

export type CurriculumVerificationStatus =
  | 'DRAFT'
  | 'BETA'
  | 'CERTIFIED'
  | 'DISABLED';

export type RoadmapDayFeedback = 'TOO_HARD' | 'JUST_RIGHT' | 'TOO_EASY';

export type SelectedOwnerGoal = {
  goal: OwnerTrainingGoal;
  priorityRank: number;
  selectedPainPoints: string[];
};

export type TrainingCatalogActivity = {
  id: string;
  category: OwnerTrainingGoal;
  sequenceNumber: number;
  level: number;

  title: string;
  skillFamily: string;
  questContentType: QuestContentType;

  lessonGoal: string;
  whyItMatters: string;
  tutorialSteps: string[];
  visibleCheckpoint: string;

  prerequisites: string[];
  regressionActivityId?: string;
  harderActivityId?: string;

  requiredReferenceAssets: ReferenceAssetRequirement[];
  recordingRequirements: RecordingRequirements;

  startStateCriteria: string[];
  orderedVisibleEvents: string[];
  passCriteria: string[];
  failCriteria: string[];
  needsReviewCriteria: string[];
  outOfScopeClaims: string[];
  safetyNotes: string[];
  retryInstructions: string[];

  recommendedFps: number;
  minClipSeconds: number;
  maxClipSeconds: number;

  minimumAutoPassConfidence: number;
  minimumAutoFailConfidence: number;

  verificationStatus: CurriculumVerificationStatus;

  xpReward: number;
  coinReward: number;
  starsAvailable: number;

  masterPromptVersion: string;
  activityPromptVersion: string;

  vlmPrompt: string;
};

export type PersonalizedRoadmap = {
  id: string;
  dogId: string;
  curriculumVersion: string;
  personalizationEngineVersion: string;
  selectedGoals: SelectedOwnerGoal[];
  generatedAt: string;
  isActive: boolean;
  generationNotes: string | null;
};

export type PersonalizedRoadmapDay = {
  id: string;
  roadmapId: string;
  dayNumber: number;
  primaryActivityId: string;
  optionalSideQuestId: string | null;
  optionalBondQuestId: string | null;
  reasonSelected: string;
  difficultyMode: RoadmapDifficultyMode;
  completedAt: string | null;
  feedback: RoadmapDayFeedback | null;
  primaryActivity?: TrainingCatalogActivity;
};

export type TrainingReferenceAsset = {
  id: string;
  dogId: string;
  assetType: ReferenceAssetType;
  label: string;
  storagePath: string;
  thumbnailUrl: string | null;
  createdAt: string;
};

export type DogSavedTrainingItem = {
  id: string;
  dogId: string;
  assetType: ReferenceAssetType;
  friendlyName: string;
  referenceAssetId: string | null;
  isDefault: boolean;
};

export type VideoSubmission = {
  id: string;
  dogId: string;
  roadmapDayId: string | null;
  activityId: string;
  storagePath: string | null;
  submittedAt: string;
  vlmVerdict: 'pass' | 'fail' | 'needs_review' | 'error' | null;
  vlmConfidence: number | null;
  vlmReasoning: string | null;
  vlmLatencyMs: number | null;
  xpAwarded: number;
  coinsAwarded: number;
  status: 'pending' | 'processing' | 'passed' | 'failed' | 'needs_review' | 'error';
  submissionHash: string | null;
  promptVersion: number | null;
  modelIdentifier: string | null;
  referenceAssetStoragePaths: string[];
  rawGeminiResponse: Record<string, unknown> | null;
  rewardGranted: boolean;
};

export type BossQuestComponent = {
  componentActivityId: string;
  order: number;
  required: boolean;
};

export type HybridBossQuestConfig = {
  bossActivityId: string;
  components: BossQuestComponent[];
  requireAllMandatoryComponentsToPass: boolean;
};

export type TrainingGoalCategoryMeta = {
  key: OwnerTrainingGoal;
  title: string;
  subtitle: string;
  iconName: string;
  painPoints: Array<{ key: string; label: string }>;
};

export type DogTrainingStreak = {
  dogId: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
};

export type TrainingSection = {
  id: string;
  sectionNumber: number;
  slug: string;
  title: string;
  description: string | null;
  safetyBoundary: string | null;
};

export type TrainingSkillStatus = "not_started" | "in_progress" | "completed";
export type TrainingCheckpointStatus = "not_eligible" | "eligible" | "passed" | "needs_review";
export type TrainingResult = "success" | "not_yet";

export type TrainingSkillSummary = {
  id: string;
  sectionId: string;
  skillCode: string;
  slug: string;
  title: string;
  oneLineGoal: string;
  sortOrder: number;
};

export type DogTrainingSkillProgress = {
  skillId: string;
  status: TrainingSkillStatus;
  currentLevelNumber: number;
  checkpointStatus: TrainingCheckpointStatus;
  latestResult: TrainingResult | null;
  reviewSoon: boolean;
  lastPracticedAt: string | null;
  completedAt: string | null;
  level5CompletedAt?: string | null;
  needsReinforcement?: boolean;
};

export type SectionRoadmapNode = {
  skill: TrainingSkillSummary;
  progress: DogTrainingSkillProgress | null;
};

export type SectionRoadmap = {
  section: TrainingSection;
  nodes: SectionRoadmapNode[];
};

export type DogTrainingPreferences = {
  dogId: string;
  preferredSectionId: string | null;
  trainingExperience: string | null;
  dailyMinutes: number | null;
  deliveryStyle: string | null;
  onboardingCompletedAt: string | null;
};

export type TrainingEnergy = {
  base: number;
  consumed: number;
  remaining: number;
};

export type SkillSessionResolution = {
  resolution: "resume" | "review" | "checkpoint" | "level";
  levelId: string;
  sessionType: "normal" | "review" | "bridge" | "checkpoint";
  levelNumber: number | null;
  sessionId?: string;
  reviewAssignmentId?: string;
  reviewType?: string;
};

export type TrainingSessionType = "normal" | "review" | "bridge" | "checkpoint";
export type TrainingSessionStatus = "active" | "completed" | "ended";

export type TrainingSession = {
  id: string;
  dogId: string;
  skillId: string;
  levelId: string;
  sessionType: TrainingSessionType;
  status: TrainingSessionStatus;
  startedAt: string;
  completedAt: string | null;
  endedAt: string | null;
  energyConsumed: boolean;
  retryUsed: boolean;
  finalResult: TrainingResult | "ended" | null;
  currentCardKey: string | null;
  idempotencyKey: string;
};

export type StartSessionResult = {
  session: TrainingSession;
  remainingEnergy: number;
  chargedEnergy: boolean;
};

export type ReportResultOutcome = {
  settled: boolean;
  allowAdditionalPractice: boolean;
  result: TrainingResult | null;
  session: TrainingSession;
};

export type TrainingLessonCardButton = { label: string; role: string };

export type TrainingLessonCard = {
  id: string;
  cardKey: string;
  cardType: "orient" | "demo" | "guardian" | "additional_practice" | "completion";
  sortOrder: number;
  title: string | null;
  body: string | null;
  keyAction: string | null;
  tryIt: string | null;
  harderPart: string | null;
  finishInstruction: string | null;
  successCopy: string | null;
  notYetCopy: string | null;
  buttons: TrainingLessonCardButton[];
};

export type TrainingReadyCardMaterial = { label: string; detail: string };

export type TrainingReadyCard = {
  materials: TrainingReadyCardMaterial[];
  safetyCopy: string;
  primaryAction: string;
  secondaryAction: string;
};

export type TrainingCheckpointPolicy = {
  entryRule: string;
  guardianInstruction: string;
  successCopy: string;
  notYetCopy: string;
};

export type TrainingLevelDetail = {
  id: string;
  skillId: string;
  stageType: "level" | "checkpoint";
  levelNumber: number | null;
  title: string;
  goal: string | null;
  observableCriterion: string | null;
  firstPart: string | null;
  nextPart: string | null;
  easierPath: string | null;
  successAnchor: string | null;
  additionalPracticeAllowed: boolean;
  readyCard: TrainingReadyCard | null;
  cards: TrainingLessonCard[];
  checkpointPolicy: TrainingCheckpointPolicy | null;
  media: TrainingMediaBinding | null;
  skill: {
    id: string;
    skillCode: string;
    title: string;
    oneLineGoal: string;
  };
};

export type TrainingMediaBinding = {
  id: string;
  levelId: string;
  demoId: string;
  mediaUrl: string | null;
  posterUrl: string | null;
  status: string;
  fallbackText: string | null;
};

export type TrainingReviewAssignment = {
  id: string;
  dogId: string;
  skillId: string;
  levelId: string;
  reviewType: "easier_review" | "bridge" | "targeted_level_review" | "maintenance_review";
  status: "pending" | "active" | "completed" | "cancelled";
  reason: string | null;
  dueAt: string | null;
};

export type VerificationVerdict = 'PASS' | 'FAIL' | 'NEEDS_REVIEW' | 'UNSUPPORTED';

export type ClipQuality = {
  dogVisible: boolean;
  targetDogUnambiguous: boolean;
  fullDogBodyVisibleWhenRequired: boolean;
  pawsVisibleWhenRequired: boolean;
  hipsVisibleWhenRequired: boolean;
  ownerVisibleWhenRequired: boolean;
  audioAvailableWhenRequired: boolean;
  targetObjectVisibleWhenRequired: boolean;
  destinationVisibleWhenRequired: boolean;
  referenceAssetsAvailableWhenRequired: boolean;
  referenceObjectMatchedWhenRequired: boolean;
  lightingSufficient: boolean;
  framingSufficient: boolean;
  actionCapturedFromStartToFinish: boolean;
};

export type ObservedEvent = {
  timestampSec: number;
  description: string;
};

export type MatchedReferenceAsset = {
  type: string;
  matched: boolean;
  confidence: number;
  notes: string;
};

export type DogTrainingVerificationResult = {
  activityId: string;

  verdict: VerificationVerdict;
  confidence: number;
  scorable: boolean;

  clipQuality: ClipQuality;

  observedEvents: ObservedEvent[];

  satisfiedCriteria: string[];
  failedCriteria: string[];
  missingEvidence: string[];

  matchedReferenceAssets: MatchedReferenceAsset[];

  visibleStartTimestampSec: number | null;
  visibleEndTimestampSec: number | null;

  passReason: string | null;
  failReason: string | null;

  needsHumanReview: boolean;
  suggestedRetryInstruction: string | null;
};
