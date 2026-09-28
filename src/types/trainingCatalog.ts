export type {
  VerificationVerdict,
  DogTrainingVerificationResult,
  ClipQuality,
  ObservedEvent,
  MatchedReferenceAsset,
} from "@/types/domain";

export type TrainingGoalCategory =
  | "BETTER_BEHAVIOR_AT_HOME"
  | "SAFETY_AND_OBEDIENCE"
  | "BETTER_WALKS"
  | "COOL_TRICKS_AND_GAMES"
  | "HELPFUL_SKILLS_AROUND_THE_HOUSE"
  | "CALM_ALONE_TIME";

export type QuestContentType =
  | "AI_VERIFIED_MAIN_QUEST"
  | "GUIDED_SIDE_QUEST"
  | "HYBRID_BOSS_QUEST";

export type VerificationStatus =
  | "DRAFT"
  | "BETA"
  | "CERTIFIED"
  | "DISABLED";

export type ReferenceAssetType =
  | "DOG_PROFILE"
  | "TARGET_TOY"
  | "TARGET_MAT"
  | "TARGET_BOWL"
  | "TARGET_BASKET"
  | "TARGET_CRATE"
  | "TARGET_DOORWAY"
  | "TARGET_PLATFORM"
  | "TARGET_CONE"
  | "TARGET_BOX"
  | "TARGET_BUTTON"
  | "TARGET_BELL"
  | "TARGET_DRAWER"
  | "TARGET_PERSON"
  | "CUSTOM_OBJECT";

export interface ReferenceAssetRequirement {
  type: ReferenceAssetType;
  required: boolean;
  minimumPhotos: number;
  maximumPhotos: number;
  reusableAcrossActivities: boolean;
  instructions: string[];
}

export type CameraAngle =
  | "SIDE_FULL_BODY"
  | "FRONT_FULL_BODY"
  | "REAR_FULL_BODY"
  | "WIDE_ROOM_OWNER_AND_DOG"
  | "WIDE_ROUTE_OWNER_DOG_AND_LEASH"
  | "CLOSE_HAND_AND_OBJECT"
  | "VISIBLE_TARGET_ZONE"
  | "VISIBLE_OBJECT_AND_DESTINATION"
  | "MULTI_CLIP_COMPONENT_SET"
  | "CUSTOM";

export interface RecordingRequirements {
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
}

export interface TrainingCatalogActivity {
  id: string;
  category: TrainingGoalCategory;
  sequenceNumber: number;
  level: number;

  title: string;
  skillFamily: string;
  questContentType: QuestContentType;

  lessonGoal: string;
  whyItMatters: string;
  tutorialSteps: string[];

  visibleCheckpoint: string;

  requiredReferenceAssets: ReferenceAssetRequirement[];
  recordingRequirements: RecordingRequirements;

  recommendedFps: number;
  minClipSeconds: number;
  maxClipSeconds: number;

  startStateCriteria: string[];

  orderedVisibleEvents: string[];

  passCriteria: string[];
  failCriteria: string[];
  needsReviewCriteria: string[];

  outOfScopeClaims: string[];
  safetyNotes: string[];
  retryInstructions: string[];

  minimumAutoPassConfidence: number;
  minimumAutoFailConfidence: number;

  prerequisites: string[];
  regressionActivityId?: string;
  harderActivityId?: string;

  xpReward: number;
  coinReward: number;
  starsAvailable: number;

  verificationStatus: VerificationStatus;

  masterPromptVersion: string;
  activityPromptVersion: string;

  vlmPrompt: string;
}

export interface BossQuestComponent {
  componentActivityId: string;
  order: number;
  required: boolean;
}

export interface HybridBossQuestConfig {
  bossActivityId: string;
  components: BossQuestComponent[];
  requireAllMandatoryComponentsToPass: boolean;
}

export interface GeminiDogTrainingVerificationRequest {
  submissionId: string;
  dogId: string;
  activityId: string;

  videoUrl: string;

  referenceAssets: {
    type: ReferenceAssetType;
    imageUrls: string[];
    displayName?: string;
  }[];

  recommendedFps: number;
  minClipSeconds: number;
  maxClipSeconds: number;
  audioRequired: boolean;

  masterPrompt: string;
  activitySpecificPrompt: string;

  promptVersion: string;
  model: string;
}
