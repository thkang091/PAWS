import { createIdempotencyKey, getClientOrThrow, throwIfError } from "@/services/serviceUtils";
import type {
  DogTrainingPreferences,
  DogTrainingSkillProgress,
  ReportResultOutcome,
  SectionRoadmap,
  SkillSessionResolution,
  StartSessionResult,
  TrainingCheckpointPolicy,
  TrainingEnergy,
  TrainingLessonCard,
  TrainingLessonCardButton,
  TrainingLevelDetail,
  TrainingMediaBinding,
  TrainingReadyCard,
  TrainingReadyCardMaterial,
  TrainingReviewAssignment,
  TrainingSection,
  TrainingSession,
  TrainingSkillSummary,
} from "@/types/domain";
import type { Json } from "@/types/database";
import { applyLocalLevelContent, applyLocalSkillContent, DROP_IT_PREPARATION } from "@/features/train/media/dropItContent";
import { CHEWING_PREPARATION } from "@/features/train/media/chewingContent";

const mapSection = (row: Record<string, unknown>): TrainingSection => ({
  id: row.id as string,
  sectionNumber: row.section_number as number,
  slug: row.slug as string,
  title: row.title as string,
  description: (row.description as string | null) ?? null,
  safetyBoundary: (row.safety_boundary as string | null) ?? null,
});

const mapSkillSummary = (row: Record<string, unknown>): TrainingSkillSummary => applyLocalSkillContent({
  id: row.id as string,
  sectionId: row.section_id as string,
  skillCode: row.skill_code as string,
  slug: row.slug as string,
  title: row.title as string,
  oneLineGoal: row.one_line_goal as string,
  sortOrder: row.sort_order as number,
});

const mapSkillProgress = (row: Record<string, unknown>, needsReinforcement = false): DogTrainingSkillProgress => ({
  skillId: row.skill_id as string,
  status: row.status as DogTrainingSkillProgress["status"],
  currentLevelNumber: row.current_level_number as number,
  checkpointStatus: row.checkpoint_status as DogTrainingSkillProgress["checkpointStatus"],
  latestResult: (row.latest_result as DogTrainingSkillProgress["latestResult"]) ?? null,
  reviewSoon: row.review_soon as boolean,
  lastPracticedAt: (row.last_practiced_at as string | null) ?? null,
  completedAt: (row.completed_at as string | null) ?? null,
  level5CompletedAt: (row.level5_completed_at as string | null) ?? null,
  needsReinforcement,
});

// Read alongside progress so the roadmap and history use the same difficulty
// condition as the server's round completion / video unlock response.
const getSkillsNeedingReinforcement = async (dogId: string): Promise<Set<string>> => {
  const { data, error } = await getClientOrThrow().from("training_level_difficulties")
    .select("training_levels!inner(skill_id)").eq("dog_id", dogId).is("resolved_at", null);
  throwIfError(error);
  return new Set((data ?? []).flatMap(row => {
    const levels = row.training_levels as unknown as { skill_id: string } | { skill_id: string }[];
    return (Array.isArray(levels) ? levels : [levels]).map(level => level.skill_id);
  }));
};

const mapPreferences = (row: Record<string, unknown>): DogTrainingPreferences => ({
  dogId: row.dog_id as string,
  preferredSectionId: (row.preferred_section_id as string | null) ?? null,
  trainingExperience: (row.training_experience as string | null) ?? null,
  dailyMinutes: (row.daily_minutes as number | null) ?? null,
  deliveryStyle: (row.delivery_style as string | null) ?? null,
  onboardingCompletedAt: (row.onboarding_completed_at as string | null) ?? null,
});

export const mapTrainingSession = (row: Record<string, unknown>): TrainingSession => ({
  id: row.id as string,
  dogId: row.dog_id as string,
  skillId: row.skill_id as string,
  levelId: row.level_id as string,
  sessionType: row.session_type as TrainingSession["sessionType"],
  status: row.status as TrainingSession["status"],
  startedAt: row.started_at as string,
  completedAt: (row.completed_at as string | null) ?? null,
  endedAt: (row.ended_at as string | null) ?? null,
  energyConsumed: row.energy_consumed as boolean,
  retryUsed: row.retry_used as boolean,
  finalResult: (row.final_result as TrainingSession["finalResult"]) ?? null,
  currentCardKey: (row.current_card_key as string | null) ?? null,
  idempotencyKey: row.idempotency_key as string,
});

const mapSession = mapTrainingSession;

const mapButtons = (value: Json): TrainingLessonCardButton[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter(
        (item): item is TrainingLessonCardButton =>
          typeof item === "object" && item !== null && "label" in item && "role" in item,
      )
    : [];

const mapLessonCard = (row: Record<string, unknown>): TrainingLessonCard => ({
  id: row.id as string,
  cardKey: row.card_key as string,
  cardType: row.card_type as TrainingLessonCard["cardType"],
  sortOrder: row.sort_order as number,
  title: (row.title as string | null) ?? null,
  body: (row.body as string | null) ?? null,
  keyAction: (row.key_action as string | null) ?? null,
  tryIt: (row.try_it as string | null) ?? null,
  harderPart: (row.harder_part as string | null) ?? null,
  finishInstruction: (row.finish_instruction as string | null) ?? null,
  successCopy: (row.success_copy as string | null) ?? null,
  notYetCopy: (row.not_yet_copy as string | null) ?? null,
  buttons: mapButtons(row.buttons as Json),
});

const mapReadyCard = (row: Record<string, unknown>): TrainingReadyCard => ({
  materials: Array.isArray(row.materials) ? (row.materials as TrainingReadyCardMaterial[]) : [],
  safetyCopy: row.safety_copy as string,
  primaryAction: row.primary_action as string,
  secondaryAction: row.secondary_action as string,
});

const mapCheckpointPolicy = (row: Record<string, unknown>): TrainingCheckpointPolicy => ({
  entryRule: row.entry_rule as string,
  guardianInstruction: row.guardian_instruction as string,
  successCopy: row.success_copy as string,
  notYetCopy: row.not_yet_copy as string,
});

const mapReviewAssignment = (row: Record<string, unknown>): TrainingReviewAssignment => ({
  id: row.id as string,
  dogId: row.dog_id as string,
  skillId: row.skill_id as string,
  levelId: row.level_id as string,
  reviewType: row.review_type as TrainingReviewAssignment["reviewType"],
  status: row.status as TrainingReviewAssignment["status"],
  reason: (row.reason as string | null) ?? null,
  dueAt: (row.due_at as string | null) ?? null,
});

export const getEffectiveLocalDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getTrainingSections = async (): Promise<TrainingSection[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("training_sections")
    .select("*")
    .order("section_number", { ascending: true });
  throwIfError(error);
  return (data ?? []).map(mapSection);
};

export const getSectionRoadmap = async (dogId: string, sectionId: string): Promise<SectionRoadmap> => {
  const client = getClientOrThrow();
  const [sectionResult, skillsResult, progressResult, needsReinforcement] = await Promise.all([
    client.from("training_sections").select("*").eq("id", sectionId).single(),
    client.from("training_skills").select("*").eq("section_id", sectionId).order("sort_order", { ascending: true }),
    client.from("dog_training_skill_progress").select("*").eq("dog_id", dogId),
    getSkillsNeedingReinforcement(dogId),
  ]);
  throwIfError(sectionResult.error);
  throwIfError(skillsResult.error);
  throwIfError(progressResult.error);

  const progressBySkillId = new Map(
    (progressResult.data ?? []).map((row) => [row.skill_id as string, mapSkillProgress(row as Record<string, unknown>, needsReinforcement.has(row.skill_id as string))]),
  );

  return {
    section: mapSection(sectionResult.data as Record<string, unknown>),
    nodes: (skillsResult.data ?? []).map((row) => {
      const skill = mapSkillSummary(row as Record<string, unknown>);
      return { skill, progress: progressBySkillId.get(skill.id) ?? null };
    }),
  };
};

export const getDogTrainingPreferences = async (dogId: string): Promise<DogTrainingPreferences | null> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_training_preferences")
    .select("*")
    .eq("dog_id", dogId)
    .maybeSingle();
  throwIfError(error);
  return data ? mapPreferences(data as Record<string, unknown>) : null;
};

export const saveDogTrainingPreferences = async (
  dogId: string,
  prefs: {
    preferredSectionId?: string | null;
    trainingExperience?: string | null;
    dailyMinutes?: number | null;
    deliveryStyle?: string | null;
    markOnboardingComplete?: boolean;
  },
): Promise<void> => {
  const client = getClientOrThrow();
  const payload: Record<string, unknown> = { dog_id: dogId, updated_at: new Date().toISOString() };
  if (prefs.preferredSectionId !== undefined) payload.preferred_section_id = prefs.preferredSectionId;
  if (prefs.trainingExperience !== undefined) payload.training_experience = prefs.trainingExperience;
  if (prefs.dailyMinutes !== undefined) payload.daily_minutes = prefs.dailyMinutes;
  if (prefs.deliveryStyle !== undefined) payload.delivery_style = prefs.deliveryStyle;
  if (prefs.markOnboardingComplete) payload.onboarding_completed_at = new Date().toISOString();

  const { error } = await client.from("dog_training_preferences").upsert(payload, { onConflict: "dog_id" });
  throwIfError(error);
};

export const getTrainingEnergy = async (dogId: string): Promise<TrainingEnergy> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("get_training_energy", {
    p_dog_id: dogId,
    p_local_date: getEffectiveLocalDate(),
  });
  throwIfError(error);
  const result = data as { base: number; consumed: number; remaining: number };
  return { base: result.base, consumed: result.consumed, remaining: result.remaining };
};

export const resetTrainingEnergy = async (dogId: string): Promise<TrainingEnergy> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("reset_training_energy", {
    p_dog_id: dogId,
    p_local_date: getEffectiveLocalDate(),
  });
  if (error) throw new Error("Couldn't refill energy. Please try again.");
  const result = data as TrainingEnergy;
  return { base: result.base, consumed: result.consumed, remaining: result.remaining };
};

export const resolveSkillSession = async (dogId: string, skillId: string): Promise<SkillSessionResolution> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("resolve_skill_session", { p_dog_id: dogId, p_skill_id: skillId });
  throwIfError(error);
  const result = data as {
    resolution: SkillSessionResolution["resolution"];
    levelId: string;
    sessionType: SkillSessionResolution["sessionType"];
    levelNumber: number | null;
    sessionId?: string;
    reviewAssignmentId?: string;
    reviewType?: string;
  };
  return {
    resolution: result.resolution,
    levelId: result.levelId,
    sessionType: result.sessionType,
    levelNumber: result.levelNumber,
    sessionId: result.sessionId,
    reviewAssignmentId: result.reviewAssignmentId,
    reviewType: result.reviewType,
  };
};

export const startTrainingSession = async (
  dogId: string,
  skillId: string,
  idempotencyKey: string = createIdempotencyKey("training-session"),
): Promise<StartSessionResult> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("start_training_session", {
    p_dog_id: dogId,
    p_skill_id: skillId,
    p_local_date: getEffectiveLocalDate(),
    p_idempotency_key: idempotencyKey,
  });
  throwIfError(error);
  const result = data as { session: Record<string, unknown>; remainingEnergy: number; chargedEnergy: boolean };
  return {
    session: mapSession(result.session),
    remainingEnergy: result.remainingEnergy,
    chargedEnergy: result.chargedEnergy,
  };
};

export const continueTrainingSession = async (completedSessionId: string): Promise<StartSessionResult> => {
  const { data, error } = await getClientOrThrow().rpc("continue_training_session", {
    p_completed_session_id: completedSessionId,
    p_local_date: getEffectiveLocalDate(),
  });
  throwIfError(error);
  const result = data as { session: Record<string, unknown>; remainingEnergy: number; chargedEnergy: boolean };
  return { session: mapSession(result.session), remainingEnergy: result.remainingEnergy, chargedEnergy: result.chargedEnergy };
};

export const getActiveTrainingSession = async (dogId: string, skillId: string): Promise<TrainingSession | null> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("training_sessions")
    .select("*")
    .eq("dog_id", dogId)
    .eq("skill_id", skillId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(error);
  return data ? mapSession(data as Record<string, unknown>) : null;
};

export const getTrainingSession = async (sessionId: string): Promise<TrainingSession> => {
  const { data, error } = await getClientOrThrow().from("training_sessions").select("*").eq("id", sessionId).single();
  throwIfError(error);
  return mapSession(data as Record<string, unknown>);
};

export const setSessionCardPosition = async (sessionId: string, cardKey: string): Promise<void> => {
  const client = getClientOrThrow();
  const { error } = await client.rpc("set_session_card_position", { p_session_id: sessionId, p_card_key: cardKey });
  throwIfError(error);
};

export const reportTrainingResult = async (
  sessionId: string,
  result: "success" | "not_yet",
  cardId?: string | null,
): Promise<ReportResultOutcome> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("report_training_result", {
    p_session_id: sessionId,
    p_result: result,
    p_card_id: cardId ?? null,
  });
  throwIfError(error);
  const parsed = data as {
    settled: boolean;
    allowAdditionalPractice?: boolean;
    result?: "success" | "not_yet";
    session: Record<string, unknown>;
  };
  return {
    settled: parsed.settled,
    allowAdditionalPractice: parsed.allowAdditionalPractice ?? false,
    result: parsed.result ?? null,
    session: mapSession(parsed.session),
  };
};

export const endTrainingSession = async (sessionId: string, reason?: string): Promise<TrainingSession> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("end_training_session", {
    p_session_id: sessionId,
    p_reason: reason ?? null,
  });
  throwIfError(error);
  const parsed = data as { session: Record<string, unknown> };
  return mapSession(parsed.session);
};

export const getDueReviews = async (dogId: string): Promise<TrainingReviewAssignment[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("training_review_assignments")
    .select("*")
    .eq("dog_id", dogId)
    .in("status", ["pending", "active"])
    .order("created_at", { ascending: true });
  throwIfError(error);
  return (data ?? []).map(mapReviewAssignment);
};

export const getAllSectionRoadmaps = async (dogId: string): Promise<SectionRoadmap[]> => {
  const client = getClientOrThrow();
  const [sectionsResult, skillsResult, progressResult, needsReinforcement] = await Promise.all([
    client.from("training_sections").select("*").order("section_number", { ascending: true }),
    client.from("training_skills").select("*").order("sort_order", { ascending: true }),
    client.from("dog_training_skill_progress").select("*").eq("dog_id", dogId),
    getSkillsNeedingReinforcement(dogId),
  ]);
  throwIfError(sectionsResult.error);
  throwIfError(skillsResult.error);
  throwIfError(progressResult.error);

  const progressBySkillId = new Map(
    (progressResult.data ?? []).map((row) => [row.skill_id as string, mapSkillProgress(row as Record<string, unknown>, needsReinforcement.has(row.skill_id as string))]),
  );
  const skillsBySectionId = new Map<string, TrainingSkillSummary[]>();
  for (const row of skillsResult.data ?? []) {
    const skill = mapSkillSummary(row as Record<string, unknown>);
    const list = skillsBySectionId.get(skill.sectionId) ?? [];
    list.push(skill);
    skillsBySectionId.set(skill.sectionId, list);
  }

  return (sectionsResult.data ?? []).map((row) => {
    const section = mapSection(row as Record<string, unknown>);
    const skills = skillsBySectionId.get(section.id) ?? [];
    return {
      section,
      nodes: skills.map((skill) => ({ skill, progress: progressBySkillId.get(skill.id) ?? null })),
    };
  });
};

export type DogTrainingOverviewRow = {
  skill: TrainingSkillSummary;
  sectionTitle: string;
  progress: DogTrainingSkillProgress;
};

export const getDogTrainingOverview = async (dogId: string): Promise<DogTrainingOverviewRow[]> => {
  const client = getClientOrThrow();
  const [{ data, error }, needsReinforcement] = await Promise.all([client
    .from("dog_training_skill_progress")
    .select("*, training_skills(*, training_sections(title))")
    .eq("dog_id", dogId)
    .order("last_practiced_at", { ascending: false, nullsFirst: false }), getSkillsNeedingReinforcement(dogId)]);
  throwIfError(error);
  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown> & {
      training_skills: Record<string, unknown> & { training_sections: { title: string } };
    };
    return {
      skill: mapSkillSummary(record.training_skills),
      sectionTitle: record.training_skills.training_sections.title,
      progress: mapSkillProgress(record, needsReinforcement.has(record.skill_id as string)),
    };
  });
};

const mapMediaBinding = (row: Record<string, unknown>): TrainingMediaBinding => ({
  id: row.id as string,
  levelId: row.level_id as string,
  demoId: row.demo_id as string,
  mediaUrl: (row.media_url as string | null) ?? null,
  posterUrl: (row.poster_url as string | null) ?? null,
  status: row.status as string,
  fallbackText: (row.fallback_text as string | null) ?? null,
});

// Preparation belongs to the whole skill. Curriculum ready cards are stored
// on Level 1, even when the session resolver selects a later Level/checkpoint.
export const getTrainingPreparation = async (skillId: string): Promise<TrainingReadyCard> => {
  const client = getClientOrThrow();
  const level = await client.from("training_levels").select("id, training_skills(skill_code)")
    .eq("skill_id", skillId).eq("stage_type", "level").eq("level_number", 1).single();
  throwIfError(level.error);
  const joinedSkill: unknown = level.data?.training_skills;
  const skill = (Array.isArray(joinedSkill) ? joinedSkill[0] : joinedSkill) as { skill_code: string } | undefined;
  if (skill?.skill_code === "1-3") return DROP_IT_PREPARATION;
  if (skill?.skill_code === "6-3") return CHEWING_PREPARATION;
  const ready = await client.from("training_ready_cards").select("*").eq("level_id", level.data!.id).single();
  throwIfError(ready.error);
  return mapReadyCard(ready.data as Record<string, unknown>);
};

export const getTrainingLevelDetail = async (levelId: string): Promise<TrainingLevelDetail> => {
  const client = getClientOrThrow();
  const [levelResult, readyResult, cardsResult, checkpointResult, mediaResult] = await Promise.all([
    client.from("training_levels").select("*, training_skills(id, skill_code, title, one_line_goal)").eq("id", levelId).single(),
    client.from("training_ready_cards").select("*").eq("level_id", levelId).maybeSingle(),
    client.from("training_lesson_cards").select("*").eq("level_id", levelId).order("sort_order", { ascending: true }),
    client.from("training_checkpoint_policies").select("*").eq("checkpoint_level_id", levelId).maybeSingle(),
    client.from("training_media_bindings").select("*").eq("level_id", levelId).maybeSingle(),
  ]);
  throwIfError(levelResult.error);
  throwIfError(readyResult.error);
  throwIfError(cardsResult.error);
  throwIfError(checkpointResult.error);
  throwIfError(mediaResult.error);

  const levelRow = levelResult.data as Record<string, unknown> & {
    training_skills: { id: string; skill_code: string; title: string; one_line_goal: string };
  };

  return applyLocalLevelContent({
    id: levelRow.id as string,
    skillId: levelRow.skill_id as string,
    stageType: levelRow.stage_type as TrainingLevelDetail["stageType"],
    levelNumber: (levelRow.level_number as number | null) ?? null,
    title: levelRow.title as string,
    goal: (levelRow.goal as string | null) ?? null,
    observableCriterion: (levelRow.observable_criterion as string | null) ?? null,
    firstPart: (levelRow.first_part as string | null) ?? null,
    nextPart: (levelRow.next_part as string | null) ?? null,
    easierPath: (levelRow.easier_path as string | null) ?? null,
    successAnchor: (levelRow.success_anchor as string | null) ?? null,
    additionalPracticeAllowed: levelRow.additional_practice_allowed as boolean,
    readyCard: readyResult.data ? mapReadyCard(readyResult.data as Record<string, unknown>) : null,
    cards: (cardsResult.data ?? []).map((row) => mapLessonCard(row as Record<string, unknown>)),
    checkpointPolicy: checkpointResult.data ? mapCheckpointPolicy(checkpointResult.data as Record<string, unknown>) : null,
    media: mediaResult.data ? mapMediaBinding(mediaResult.data as Record<string, unknown>) : null,
    skill: {
      id: levelRow.training_skills.id,
      skillCode: levelRow.training_skills.skill_code,
      title: levelRow.training_skills.title,
      oneLineGoal: levelRow.training_skills.one_line_goal,
    },
  });
};
