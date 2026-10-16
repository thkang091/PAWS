import { getClientOrThrow, throwIfError } from "@/services/serviceUtils";
import type {
  DogSavedTrainingItem,
  DogTrainingStreak,
  OwnerTrainingGoal,
  PersonalizedRoadmap,
  PersonalizedRoadmapDay,
  RecordingRequirements,
  ReferenceAssetRequirement,
  ReferenceAssetType,
  RoadmapDayFeedback,
  SelectedOwnerGoal,
  TrainingCatalogActivity,
  TrainingReferenceAsset,
  VideoSubmission,
} from "@/types/domain";
import type { Json } from "@/types/database";

type ActivityRow = Record<string, unknown>;
type RoadmapRow = Record<string, unknown>;
type RoadmapDayRow = Record<string, unknown>;
type ReferenceAssetRow = Record<string, unknown>;
type SavedItemRow = Record<string, unknown>;
type SubmissionRow = Record<string, unknown>;
type StreakRow = Record<string, unknown>;

export type GeminiTrainingVerificationResult = {
  activityId: string;
  verdict: "PASS" | "FAIL" | "NEEDS_REVIEW";
  confidence: number;
  observations: string[];
  missingEvidence: string[];
  retryInstruction: string | null;
};

const jsonArrayToStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const getErrorText = (error: unknown): string => {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [record.message, record.details, record.hint, record.code]
      .filter((value): value is string => typeof value === "string")
      .join(" ");
  }
  return String(error);
};

const isMissingRoadmapTableError = (error: unknown): boolean =>
  /dog_personalized_roadmaps|dog_personalized_roadmap_days/i.test(getErrorText(error)) &&
  /schema cache|could not find the table|does not exist|PGRST205/i.test(getErrorText(error));

const getFunctionErrorMessage = async (error: unknown): Promise<string | null> => {
  const context = typeof error === "object" && error !== null
    ? (error as { context?: unknown }).context
    : null;
  const responseLike = context && typeof context === "object"
    ? context as { clone?: () => unknown; json?: () => Promise<unknown>; text?: () => Promise<string>; status?: number }
    : null;

  if (responseLike && (typeof responseLike.json === "function" || typeof responseLike.text === "function" || typeof responseLike.clone === "function")) {
    const cloned = typeof responseLike.clone === "function" ? responseLike.clone() : responseLike;
    const response = cloned && typeof cloned === "object"
      ? cloned as { json?: () => Promise<unknown>; text?: () => Promise<string>; clone?: () => unknown }
      : responseLike;
    try {
      const payload = typeof response.json === "function" ? await response.json() : null;
      if (payload && typeof payload === "object") {
        const record = payload as Record<string, unknown>;
        const message = record.error ?? record.message;
        if (typeof message === "string" && message.trim().length > 0) {
          return message;
        }
      }
    } catch {
      const textResponse = typeof response.clone === "function"
        ? response.clone()
        : response;
      const text = textResponse && typeof textResponse === "object" && typeof (textResponse as { text?: () => Promise<string> }).text === "function"
        ? await (textResponse as { text: () => Promise<string> }).text().catch(() => "")
        : "";
      if (text.trim().length > 0) return text;
    }
  }

  console.warn("Unable to extract Edge Function error body.", error);
  return null;
};

const DEFAULT_RECORDING_REQUIREMENTS: RecordingRequirements = {
  cameraAngle: "SIDE_FULL_BODY",
  fullDogBodyRequired: true,
  pawsRequired: true,
  hipsRequired: false,
  ownerRequiredInFrame: false,
  audioRequired: false,
  targetObjectRequiredInFrame: false,
  destinationRequiredInFrame: false,
  startBoundaryRequiredInFrame: false,
  endBoundaryRequiredInFrame: false,
  setupInstructions: [],
};

const mapActivity = (row: ActivityRow): TrainingCatalogActivity => {
  const requiredReferenceAssets: ReferenceAssetRequirement[] = jsonArrayToStrings(
    row.required_reference_assets,
  ).map((assetType) => ({
    type: assetType as ReferenceAssetType,
    required: true,
    minimumPhotos: 1,
    maximumPhotos: 3,
    reusableAcrossActivities: true,
    instructions: [],
  }));

  const recordingRequirements: RecordingRequirements =
    (row.recording_requirements as RecordingRequirements | null) ??
    DEFAULT_RECORDING_REQUIREMENTS;

  return {
    id: row.id as string,
    category: row.category as TrainingCatalogActivity["category"],
    sequenceNumber: row.sequence_number as number,
    level: row.level as number,
    title: row.title as string,
    skillFamily: row.skill_family as string,
    questContentType: row.quest_content_type as TrainingCatalogActivity["questContentType"],
    lessonGoal: row.lesson_goal as string,
    whyItMatters: row.why_it_matters as string,
    tutorialSteps: jsonArrayToStrings(row.tutorial_steps),
    visibleCheckpoint: row.visible_checkpoint as string,
    prerequisites: jsonArrayToStrings(row.prerequisites),
    regressionActivityId: (row.regression_activity_id as string | null) ?? undefined,
    harderActivityId: (row.harder_activity_id as string | null) ?? undefined,
    requiredReferenceAssets,
    recordingRequirements,
    startStateCriteria: jsonArrayToStrings(row.start_state_criteria),
    orderedVisibleEvents: jsonArrayToStrings(row.ordered_visible_events),
    retryInstructions: jsonArrayToStrings(row.retry_instructions),
    masterPromptVersion: (row.master_prompt_version as string) ?? "1.0.0",
    activityPromptVersion: (row.activity_prompt_version as string) ?? "1.0.0",
    passCriteria: jsonArrayToStrings(row.pass_criteria),
    failCriteria: jsonArrayToStrings(row.fail_criteria),
    needsReviewCriteria: jsonArrayToStrings(row.needs_review_criteria),
    outOfScopeClaims: jsonArrayToStrings(row.out_of_scope_claims),
    safetyNotes: jsonArrayToStrings(row.safety_notes),
    recommendedFps: (row.recommended_fps as number) ?? 30,
    minClipSeconds: row.min_clip_seconds as number,
    maxClipSeconds: row.max_clip_seconds as number,
    minimumAutoPassConfidence: (row.minimum_auto_pass_confidence as number) ?? 0.75,
    minimumAutoFailConfidence: (row.minimum_auto_fail_confidence as number) ?? 0.90,
    verificationStatus: row.verification_status as TrainingCatalogActivity["verificationStatus"],
    xpReward: row.xp_reward as number,
    coinReward: row.coin_reward as number,
    starsAvailable: row.stars_available as number,
    vlmPrompt: row.vlm_prompt as string,
  };
};

const mapRoadmap = (row: RoadmapRow): PersonalizedRoadmap => ({
  id: row.id as string,
  dogId: row.dog_id as string,
  curriculumVersion: row.curriculum_version as string,
  personalizationEngineVersion: row.personalization_engine_version as string,
  selectedGoals: (row.selected_goals as Json) as SelectedOwnerGoal[],
  generatedAt: row.generated_at as string,
  isActive: row.is_active as boolean,
  generationNotes: (row.generation_notes as string | null) ?? null,
});

const mapRoadmapDay = (row: RoadmapDayRow): PersonalizedRoadmapDay => ({
  id: row.id as string,
  roadmapId: row.roadmap_id as string,
  dayNumber: row.day_number as number,
  primaryActivityId: row.primary_activity_id as string,
  optionalSideQuestId: (row.optional_side_quest_id as string | null) ?? null,
  optionalBondQuestId: (row.optional_bond_quest_id as string | null) ?? null,
  reasonSelected: row.reason_selected as string,
  difficultyMode: row.difficulty_mode as PersonalizedRoadmapDay["difficultyMode"],
  completedAt: (row.completed_at as string | null) ?? null,
  feedback: (row.feedback as RoadmapDayFeedback | null) ?? null,
  primaryActivity:
    row.primary_activity != null
      ? mapActivity(row.primary_activity as ActivityRow)
      : row.training_catalog_activities != null
        ? mapActivity(row.training_catalog_activities as ActivityRow)
      : undefined,
});

const makeUUID = (): string =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

const inferVideoContentType = (uri: string): string => {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
};

const mapReferenceAsset = (row: ReferenceAssetRow): TrainingReferenceAsset => ({
  id: row.id as string,
  dogId: row.dog_id as string,
  assetType: row.asset_type as ReferenceAssetType,
  label: row.label as string,
  storagePath: row.storage_path as string,
  thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
  createdAt: row.created_at as string,
});

const mapSavedItem = (row: SavedItemRow): DogSavedTrainingItem => ({
  id: row.id as string,
  dogId: row.dog_id as string,
  assetType: row.asset_type as ReferenceAssetType,
  friendlyName: row.friendly_name as string,
  referenceAssetId: (row.reference_asset_id as string | null) ?? null,
  isDefault: row.is_default as boolean,
});

const mapSubmission = (row: SubmissionRow): VideoSubmission => ({
  id: row.id as string,
  dogId: row.dog_id as string,
  roadmapDayId: (row.roadmap_day_id as string | null) ?? null,
  activityId: row.activity_id as string,
  storagePath: (row.storage_path as string | null) ?? null,
  submittedAt: row.submitted_at as string,
  vlmVerdict: (row.vlm_verdict as VideoSubmission["vlmVerdict"]) ?? null,
  vlmConfidence: (row.vlm_confidence as number | null) ?? null,
  vlmReasoning: (row.vlm_reasoning as string | null) ?? null,
  vlmLatencyMs: (row.vlm_latency_ms as number | null) ?? null,
  xpAwarded: (row.xp_awarded as number) ?? 0,
  coinsAwarded: (row.coins_awarded as number) ?? 0,
  status: row.status as VideoSubmission["status"],
  submissionHash: (row.submission_hash as string | null) ?? null,
  promptVersion: (row.prompt_version as number | null) ?? null,
  modelIdentifier: (row.model_identifier as string | null) ?? null,
  referenceAssetStoragePaths: jsonArrayToStrings(row.reference_asset_storage_paths),
  rawGeminiResponse: (row.raw_gemini_response as Record<string, unknown> | null) ?? null,
  rewardGranted: (row.reward_granted as boolean) ?? false,
});

const mapStreak = (row: StreakRow): DogTrainingStreak => ({
  dogId: row.dog_id as string,
  currentStreak: (row.current_streak as number) ?? 0,
  longestStreak: (row.longest_streak as number) ?? 0,
  lastActivityDate: (row.last_activity_date as string | null) ?? null,
});

export const getCatalogActivity = async (id: string): Promise<TrainingCatalogActivity> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("training_catalog_activities")
    .select("*")
    .eq("id", id)
    .single();
  throwIfError(error);
  return mapActivity(data as ActivityRow);
};

export const getCatalogActivities = async (ids: string[]): Promise<TrainingCatalogActivity[]> => {
  if (ids.length === 0) return [];
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("training_catalog_activities")
    .select("*")
    .in("id", ids);
  throwIfError(error);
  return (data ?? []).map((row) => mapActivity(row as ActivityRow));
};

export const getCatalogByCategory = async (
  category: OwnerTrainingGoal,
): Promise<TrainingCatalogActivity[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("training_catalog_activities")
    .select("*")
    .eq("category", category)
    .order("sequence_number", { ascending: true });
  throwIfError(error);
  return (data ?? []).map((row) => mapActivity(row as ActivityRow));
};


export const getDogRoadmap = async (
  dogId: string,
): Promise<(PersonalizedRoadmap & { days: PersonalizedRoadmapDay[] }) | null> => {
  const client = getClientOrThrow();
  const { data: roadmapData, error: roadmapError } = await client
    .from("dog_personalized_roadmaps")
    .select("*")
    .eq("dog_id", dogId)
    .eq("is_active", true)
    .maybeSingle();
  if (isMissingRoadmapTableError(roadmapError)) {
    console.warn("Personalized roadmap tables are missing; showing no-plan state.", roadmapError);
    return null;
  }
  throwIfError(roadmapError);

  if (!roadmapData) return null;

  const roadmap = mapRoadmap(roadmapData as RoadmapRow);

  const { data: daysData, error: daysError } = await client
    .from("dog_personalized_roadmap_days")
    .select("*, primary_activity:training_catalog_activities!dog_personalized_roadmap_days_primary_activity_id_fkey(*)")
    .eq("roadmap_id", roadmap.id)
    .order("day_number", { ascending: true });
  if (isMissingRoadmapTableError(daysError)) {
    console.warn("Personalized roadmap day table is missing; showing empty plan days.", daysError);
    return { ...roadmap, days: [] };
  }
  throwIfError(daysError);

  const days = (daysData ?? []).map((row) => mapRoadmapDay(row as RoadmapDayRow));

  return { ...roadmap, days };
};

export const getRoadmapDay = async (dayId: string): Promise<PersonalizedRoadmapDay | null> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_personalized_roadmap_days")
    .select("*, primary_activity:training_catalog_activities!dog_personalized_roadmap_days_primary_activity_id_fkey(*)")
    .eq("id", dayId)
    .maybeSingle();
  throwIfError(error);
  if (!data) return null;
  return mapRoadmapDay(data as RoadmapDayRow);
};

export const generateRoadmap = async (
  dogId: string,
  forceRegenerate = false,
): Promise<PersonalizedRoadmap> => {
  const client = getClientOrThrow();
  const { data, error } = await client.functions.invoke("generate-roadmap", {
    body: { dogId, forceRegenerate },
  });
  if (error) {
    const functionMessage = await getFunctionErrorMessage(error);
    if (functionMessage) throw new Error(functionMessage);
  }
  throwIfError(error);
  return mapRoadmap(data as RoadmapRow);
};

export const submitDayFeedback = async (
  dayId: string,
  feedback: RoadmapDayFeedback,
): Promise<void> => {
  const client = getClientOrThrow();
  const { error } = await client
    .from("dog_personalized_roadmap_days")
    .update({ feedback })
    .eq("id", dayId);
  throwIfError(error);
};

export const markDayCompleted = async (dayId: string): Promise<void> => {
  const client = getClientOrThrow();
  const { error } = await client
    .from("dog_personalized_roadmap_days")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", dayId);
  throwIfError(error);
};

export const getDogReferenceAssets = async (dogId: string): Promise<TrainingReferenceAsset[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_training_reference_assets")
    .select("*")
    .eq("dog_id", dogId)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return (data ?? []).map((row) => mapReferenceAsset(row as ReferenceAssetRow));
};

export const getDogReferenceAssetsByType = async (
  dogId: string,
  assetType: ReferenceAssetType,
): Promise<TrainingReferenceAsset[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_training_reference_assets")
    .select("*")
    .eq("dog_id", dogId)
    .eq("asset_type", assetType)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return (data ?? []).map((row) => mapReferenceAsset(row as ReferenceAssetRow));
};

export const saveReferenceAsset = async (
  dogId: string,
  assetType: ReferenceAssetType,
  storagePath: string,
  label: string,
): Promise<TrainingReferenceAsset> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_training_reference_assets")
    .insert({ dog_id: dogId, asset_type: assetType, storage_path: storagePath, label })
    .select("*")
    .single();
  throwIfError(error);
  return mapReferenceAsset(data as ReferenceAssetRow);
};

export const getDogSavedItems = async (dogId: string): Promise<DogSavedTrainingItem[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_saved_training_items")
    .select("*")
    .eq("dog_id", dogId);
  throwIfError(error);
  return (data ?? []).map((row) => mapSavedItem(row as SavedItemRow));
};

export const getActivitySubmissions = async (
  dogId: string,
  activityId: string,
): Promise<VideoSubmission[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_training_video_submissions")
    .select("*")
    .eq("dog_id", dogId)
    .eq("activity_id", activityId)
    .order("submitted_at", { ascending: false });
  throwIfError(error);
  return (data ?? []).map((row) => mapSubmission(row as SubmissionRow));
};

export const submitTrainingVideoForGeminiVerification = async ({
  dogId,
  userId,
  activityId,
  uri,
  roadmapDayId = null,
}: {
  dogId: string;
  userId: string;
  activityId: string;
  uri: string;
  roadmapDayId?: string | null;
}): Promise<GeminiTrainingVerificationResult> => {
  const client = getClientOrThrow();
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { data: submission, error: submissionError } = await client
    .from("dog_training_video_submissions")
    .insert({
      dog_id: dogId,
      user_id: userId,
      activity_id: activityId,
      roadmap_day_id: roadmapDayId,
      status: "pending",
      submission_hash: makeUUID(),
    })
    .select("*")
    .single();
  throwIfError(submissionError);

  const submissionId = (submission as SubmissionRow).id as string;
  const extension = uri.toLowerCase().endsWith(".mov") ? "mov" : "mp4";
  const storagePath = `${userId}/${dogId}/${activityId}/${submissionId}/video.${extension}`;
  const upload = await client.storage
    .from("dog-activity-videos")
    .upload(storagePath, arrayBuffer, {
      contentType: inferVideoContentType(uri),
      upsert: false,
    });
  throwIfError(upload.error);

  const update = await client
    .from("dog_training_video_submissions")
    .update({ storage_path: storagePath, status: "processing" })
    .eq("id", submissionId);
  throwIfError(update.error);

  const { data, error } = await client.functions.invoke("verify-training-video", {
    body: {
      submission_id: submissionId,
      dog_id: dogId,
      activity_id: activityId,
      roadmap_day_id: roadmapDayId,
    },
  });
  throwIfError(error);
  return data as GeminiTrainingVerificationResult;
};

export const getDogStreak = async (dogId: string): Promise<DogTrainingStreak | null> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_training_streaks")
    .select("*")
    .eq("dog_id", dogId)
    .maybeSingle();
  throwIfError(error);
  if (!data) return null;
  return mapStreak(data as StreakRow);
};

export const getTrainingGoals = async (dogId: string): Promise<SelectedOwnerGoal[]> => {
  const client = getClientOrThrow();

  const [goalsResult, painPointsResult] = await Promise.all([
    client
      .from("dog_selected_training_goals")
      .select("goal, priority_rank")
      .eq("dog_id", dogId)
      .order("priority_rank", { ascending: true }),
    client
      .from("dog_training_pain_points")
      .select("goal, pain_point_key")
      .eq("dog_id", dogId),
  ]);

  throwIfError(goalsResult.error);
  throwIfError(painPointsResult.error);

  type GoalRow = { goal: string; priority_rank: number };
  type PainPointRow = { goal: string; pain_point_key: string };

  const goalRows = ((goalsResult.data ?? []) as GoalRow[]);
  const ppRows = ((painPointsResult.data ?? []) as PainPointRow[]);

  return goalRows.map((g) => ({
    goal: g.goal as OwnerTrainingGoal,
    priorityRank: g.priority_rank,
    selectedPainPoints: ppRows
      .filter((pp) => pp.goal === g.goal)
      .map((pp) => pp.pain_point_key),
  }));
};

export const saveTrainingGoals = async (
  dogId: string,
  goals: SelectedOwnerGoal[],
): Promise<void> => {
  const client = getClientOrThrow();

  const { error: deleteGoalsError } = await client
    .from("dog_selected_training_goals")
    .delete()
    .eq("dog_id", dogId);
  throwIfError(deleteGoalsError);

  const { error: deletePainPointsError } = await client
    .from("dog_training_pain_points")
    .delete()
    .eq("dog_id", dogId);
  throwIfError(deletePainPointsError);

  if (goals.length === 0) return;

  const goalRows = goals.map((g) => ({
    dog_id: dogId,
    goal: g.goal,
    priority_rank: g.priorityRank,
  }));
  const { error: insertGoalsError } = await client
    .from("dog_selected_training_goals")
    .insert(goalRows);
  throwIfError(insertGoalsError);

  const painPointRows = goals.flatMap((g) =>
    g.selectedPainPoints.map((painPointKey) => ({
      dog_id: dogId,
      goal: g.goal,
      pain_point_key: painPointKey,
    })),
  );

  if (painPointRows.length > 0) {
    const { error: insertPainPointsError } = await client
      .from("dog_training_pain_points")
      .insert(painPointRows);
    throwIfError(insertPainPointsError);
  }
};
