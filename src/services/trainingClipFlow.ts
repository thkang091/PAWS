import { getTrainingClipLesson } from "@/features/train/media/trainingClipLessons";
import { getTrainingSession, reportTrainingResult, resolveSkillSession, getTrainingLevelDetail, getTrainingEnergy, continueTrainingSession } from "@/services/trainingCurriculumService";

// Finish before resolving a future visit. Celebration must not depend on the
// next day's checkpoint/review being fetchable or start another paid session.
export async function finishTrainingClipCourse(sessionId: string, cardId: string | null) {
  let session = await getTrainingSession(sessionId);
  const level = await getTrainingLevelDetail(session.levelId);
  if (level.stageType !== "level" || level.levelNumber !== 5) {
    throw new Error("Complete Level 5 to unlock these videos.");
  }
  if (session.status === "active") {
    const outcome = await reportTrainingResult(session.id, "success", cardId);
    if (!outcome.settled) throw new Error("Could not complete this Level.");
    session = outcome.session;
  }
  if (session.status !== "completed" || session.finalResult !== "success") {
    throw new Error("This session is no longer active. Reopen the lesson to continue.");
  }
  return session;
}

export async function continueTrainingClip(sessionId: string, cardId: string | null) {
  let session = await getTrainingSession(sessionId);
  if (session.status === "active") {
    const outcome = await reportTrainingResult(session.id, "success", cardId);
    if (!outcome.settled) throw new Error("Could not complete this Level.");
    session = outcome.session;
  }
  // A retry after a failed next-Level request must not report or award twice.
  if (session.status !== "completed" || session.finalResult !== "success") {
    throw new Error("This session is no longer active. Reopen the lesson to continue.");
  }
  const [resolution, energy] = await Promise.all([
    resolveSkillSession(session.dogId, session.skillId),
    getTrainingEnergy(session.dogId),
  ]);
  const level = await getTrainingLevelDetail(resolution.levelId);
  const hasNextClip = level.id !== session.levelId
    && Boolean(getTrainingClipLesson(level.skill.skillCode, level.stageType, level.levelNumber));
  const next = hasNextClip
    ? await continueTrainingSession(session.id)
    : null;
  return { resolution, level, nextSession: next?.session ?? null, hasNextClip,
    energy: next ? { ...energy, remaining: next.remainingEnergy, consumed: energy.base - next.remainingEnergy } : energy };
}

export async function recordTrainingClipHelp(sessionId: string, cardId: string | null) {
  const session = await getTrainingSession(sessionId);
  // Reopening help is not another failed attempt. The first not_yet report
  // leaves these Levels active on additional_practice until Continue succeeds.
  if (session.status !== "active" || session.currentCardKey === "additional_practice") return session;
  const outcome = await reportTrainingResult(session.id, "not_yet", cardId);
  return outcome.settled ? outcome.session : { ...outcome.session, currentCardKey: "additional_practice" };
}
