/**
 * src/types/trainingCatalog.ts
 *
 * Canonical TypeScript types for the PAWS training-catalog system.
 *
 * These are the authoritative runtime types.  The simpler SeedActivity type
 * used in seed data files (bh001_bh010.ts, bh011_bh020.ts) is a write-time
 * convenience format and is intentionally separate.
 *
 * Re-exports the VLM verification result types from domain.ts so that
 * callers only need to import from one module.
 */

// ─── Re-exports from domain.ts (VLM result side) ─────────────────────────────

export type {
  VerificationVerdict,
  DogTrainingVerificationResult,
  ClipQuality,
  ObservedEvent,
  MatchedReferenceAsset,
} from "@/types/domain";

// ─── Category and quest types ─────────────────────────────────────────────────

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

// ─── Reference assets ─────────────────────────────────────────────────────────

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
  /** Whether the activity cannot be scored without this asset. */
  required: boolean;
  minimumPhotos: number;
  maximumPhotos: number;
  /**
   * True when the same uploaded photo can satisfy this requirement for
   * multiple activities (e.g. DOG_PROFILE and TARGET_CRATE once uploaded
   * can be reused across all crate activities).
   */
  reusableAcrossActivities: boolean;
  /** Human-readable photo-taking instructions shown to the owner. */
  instructions: string[];
}

// ─── Recording requirements ───────────────────────────────────────────────────

/**
 * All camera-angle values that an activity may require.
 *
 * MULTI_CLIP_COMPONENT_SET is used exclusively by HYBRID_BOSS_QUEST activities
 * where each component clip has its own camera requirement — the boss activity
 * itself specifies this value and delegates to its component activities.
 */
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

  /** Dog's full body head-to-tail must be visible for the full duration. */
  fullDogBodyRequired: boolean;
  /** All four paws must be visible at the scored moment. */
  pawsRequired: boolean;
  /** Hip region must be visible (relevant for sit/down position checks). */
  hipsRequired: boolean;
  /** Handler must appear in frame (required for distance-send activities). */
  ownerRequiredInFrame: boolean;
  /**
   * An audible release cue or verbal cue must be captured.
   * Missing audio → automatic NEEDS_REVIEW regardless of visual evidence.
   */
  audioRequired: boolean;
  /** A registered target object must be visible in the clip. */
  targetObjectRequiredInFrame: boolean;
  /** A registered destination zone must be visible in the clip. */
  destinationRequiredInFrame: boolean;
  /**
   * The start boundary (e.g. doorway threshold on the dog's side,
   * distance-send starting line) must be visible to confirm start state.
   */
  startBoundaryRequiredInFrame: boolean;
  /**
   * The end boundary (e.g. crate entry, mat edge, doorway threshold on
   * the far side) must be visible to confirm completion.
   */
  endBoundaryRequiredInFrame: boolean;

  /** Ordered steps shown to the owner before they start recording. */
  setupInstructions: string[];
}

// ─── Full training-catalog activity ───────────────────────────────────────────

export interface TrainingCatalogActivity {
  /** Primary key, e.g. "BH011". Globally unique across all categories. */
  id: string;
  category: TrainingGoalCategory;
  /** Display order within the category; lower = shown first. */
  sequenceNumber: number;
  /** Difficulty tier 1–5; used for roadmap scheduling. */
  level: number;

  title: string;
  /** Skill-family label used to group related activities (e.g. "Crate and Safe-Zone Conditioning"). */
  skillFamily: string;
  questContentType: QuestContentType;

  /** One sentence the owner reads before the session. */
  lessonGoal: string;
  /** One paragraph explaining why this skill matters in real life. */
  whyItMatters: string;
  /** Numbered training steps shown in the tutorial screen. */
  tutorialSteps: string[];

  /**
   * Short, observable description of what constitutes a passing attempt.
   * Shown in the UI as the "goal" the owner is aiming for.
   */
  visibleCheckpoint: string;

  requiredReferenceAssets: ReferenceAssetRequirement[];
  recordingRequirements: RecordingRequirements;

  /** Frames per second the Gemini analysis will process the clip at. */
  recommendedFps: number;
  /** Minimum accepted clip length in seconds; shorter clips → NEEDS_REVIEW. */
  minClipSeconds: number;
  /** Maximum accepted clip length in seconds; longer clips → NEEDS_REVIEW. */
  maxClipSeconds: number;

  /**
   * Conditions the dog and owner must satisfy before the recording starts.
   * The VLM evaluates the opening frames against these before scoring.
   */
  startStateCriteria: string[];

  /**
   * Ordered list of visible events Gemini should detect in sequence.
   * Used to populate `observedEvents` in the VLM response and to check
   * that the action was captured from start to finish.
   *
   * Example: ["Handler gives wait cue", "Dog remains behind threshold",
   *           "3-second timer elapses", "Handler gives release cue",
   *           "Dog crosses threshold"]
   */
  orderedVisibleEvents: string[];

  /** All conditions that must be TRUE for a PASS verdict. */
  passCriteria: string[];
  /** Each condition that is sufficient to produce a FAIL verdict. */
  failCriteria: string[];
  /** Conditions under which the VLM should return NEEDS_REVIEW. */
  needsReviewCriteria: string[];

  /**
   * Claims the VLM is forbidden from making regardless of the clip content.
   * Injected into the prompt as the FORBIDDEN INFERENCES section.
   */
  outOfScopeClaims: string[];
  /** Safety guidance shown to the owner and injected into the prompt. */
  safetyNotes: string[];
  /** Shown to the owner after a FAIL or NEEDS_REVIEW verdict. */
  retryInstructions: string[];

  /**
   * Minimum Gemini confidence for an automatic PASS.
   * Below this → NEEDS_REVIEW even if the verdict was PASS.
   */
  minimumAutoPassConfidence: number;
  /**
   * Minimum Gemini confidence for an automatic FAIL.
   * Below this → NEEDS_REVIEW even if the verdict was FAIL.
   */
  minimumAutoFailConfidence: number;

  /** Activity IDs that must be PASSED before this one is unlocked. */
  prerequisites: string[];
  /** Activity to regress to if the dog is consistently failing. */
  regressionActivityId?: string;
  /** Next activity to unlock when this one is CERTIFIED/PASSED. */
  harderActivityId?: string;

  /** XP awarded on PASS; 0 for GUIDED_SIDE_QUEST. */
  xpReward: number;
  /**
   * Gold coins awarded on PASS.
   * Must be 0 for DRAFT and BETA activities; only non-zero for CERTIFIED.
   */
  coinReward: number;
  starsAvailable: number;

  verificationStatus: VerificationStatus;

  /**
   * Semver version of the shared master VLM prompt included with this
   * activity.  Stored alongside each verification result for audit.
   */
  masterPromptVersion: string;
  /**
   * Semver version of this activity's specific VLM prompt.
   * Incremented whenever vlmPrompt is edited.
   */
  activityPromptVersion: string;

  /**
   * The full, standalone activity-specific VLM prompt for this activity.
   * Must not be empty and must not contain TODO/TBD/PLACEHOLDER/FIXME.
   * Compiled by compileDogTrainingActivityPrompt() from the activity's
   * criteria fields, but stored here so it can be audited and versioned.
   */
  vlmPrompt: string;
}

// ─── Boss-quest types ─────────────────────────────────────────────────────────

/**
 * A single component activity within a HYBRID_BOSS_QUEST.
 * Each component gets its own Gemini review pass on its own narrow clip.
 */
export interface BossQuestComponent {
  /**
   * ID of the component activity — must be an AI_VERIFIED_MAIN_QUEST
   * or GUIDED_SIDE_QUEST; may not be another HYBRID_BOSS_QUEST.
   */
  componentActivityId: string;
  /** Display order in the boss-quest flow (1-indexed). */
  order: number;
  /**
   * True = every mandatory component with required=true must PASS for
   * the boss quest to PASS.  False = component is optional bonus evidence.
   */
  required: boolean;
}

export interface HybridBossQuestConfig {
  bossActivityId: string;
  components: BossQuestComponent[];
  /**
   * Runtime aggregation rule:
   * - If true: every component where required=true must return PASS.
   * - Any mandatory component FAIL → boss FAIL.
   * - Any mandatory component NEEDS_REVIEW → boss NEEDS_REVIEW.
   * - Optional components do not affect the final verdict.
   */
  requireAllMandatoryComponentsToPass: boolean;
}

// ─── Gemini request contract ──────────────────────────────────────────────────

/**
 * The request envelope the edge function assembles before calling
 * Gemini 2.5 Flash.  All URLs must be real, signed Supabase Storage URLs
 * pointing to actual owner-uploaded content.
 *
 * Do not generate fake URLs.  Do not auto-generate reference-photo URLs.
 * Only populate referenceAssets with actual dog_training_reference_assets
 * rows that the owner has uploaded for their specific dog.
 */
export interface GeminiDogTrainingVerificationRequest {
  /** Foreign key to dog_training_video_submissions.id */
  submissionId: string;
  dogId: string;
  activityId: string;

  /**
   * Signed URL for the training video stored in Supabase Storage.
   * Must be a real upload — never a synthetic URL.
   */
  videoUrl: string;

  /**
   * Reference photos the owner has on file for their dog + required objects.
   * Empty array is only valid when the activity has no required reference
   * assets beyond DOG_PROFILE and DOG_PROFILE is embedded via videoUrl
   * framing.  In practice, always include DOG_PROFILE when available.
   */
  referenceAssets: {
    type: ReferenceAssetType;
    /** Signed URLs for the reference photos (1–N per asset type). */
    imageUrls: string[];
    displayName?: string;
  }[];

  recommendedFps: number;
  minClipSeconds: number;
  maxClipSeconds: number;
  audioRequired: boolean;

  /**
   * The full shared master prompt text (from masterPrompt.ts).
   * Included first in the Gemini `parts` array.
   */
  masterPrompt: string;
  /**
   * The compiled activity-specific prompt (from compileDogTrainingActivityPrompt).
   * Included after the master prompt in the Gemini `parts` array.
   */
  activitySpecificPrompt: string;

  /** Semver string; stored on the verification result for audit. */
  promptVersion: string;
  /** Configured Gemini model string, e.g. "gemini-2.5-flash". */
  model: string;
}
