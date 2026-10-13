import type { DogTrainingSkillProgress } from "@/types/domain";

// Finishing the last clip alone does not complete unresolved difficult practice.
export function areLessonVideosUnlocked(progress?: Pick<DogTrainingSkillProgress, "level5CompletedAt" | "checkpointStatus" | "needsReinforcement"> | null) {
  return Boolean(progress && !progress.needsReinforcement && (progress.level5CompletedAt || progress.checkpointStatus === "passed"));
}
