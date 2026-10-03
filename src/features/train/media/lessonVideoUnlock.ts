import type { DogTrainingSkillProgress } from "@/types/domain";

// Reaching L5 is not completing it. Later practice results must not relock videos.
export function areLessonVideosUnlocked(progress?: Pick<DogTrainingSkillProgress, "level5CompletedAt" | "checkpointStatus"> | null) {
  return Boolean(progress?.level5CompletedAt || progress?.checkpointStatus === "passed");
}
