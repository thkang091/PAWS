import type { CompanionPoseKey } from "@/features/train/components/companionPaths";
import { trainingGoalCategoryMap } from "@/constants/onboardingOptions";
import type { OwnerTrainingGoal, PersonalizedRoadmapDay } from "@/types/domain";

export type ChapterStep = {
  day: PersonalizedRoadmapDay;
  title: string;
  state: "done" | "current" | "locked";
};

export type Chapter = {
  key: OwnerTrainingGoal;
  title: string;
  subtitle: string;
  pose: CompanionPoseKey;
  steps: ChapterStep[];
  doneCount: number;
  nextDay: PersonalizedRoadmapDay | null;
};

const CHAPTER_POSE: Partial<Record<OwnerTrainingGoal, CompanionPoseKey>> = {
  BETTER_BEHAVIOR_AT_HOME: "settling",
  SAFETY_AND_OBEDIENCE: "communication",
  BETTER_WALKS: "walk",
  COOL_TRICKS_AND_GAMES: "play",
  HELPFUL_SKILLS_AROUND_THE_HOUSE: "realworld",
  CALM_ALONE_TIME: "life",
  HANDLING_AND_GROOMING: "grooming",
  POTTY_AND_REAL_WORLD: "potty",
  HEALTHY_HABITS: "healthy",
  SOCIAL_SKILLS: "social",
};

export const buildChapters = (days: readonly PersonalizedRoadmapDay[]): Chapter[] => {
  const order: OwnerTrainingGoal[] = [];
  const byCategory = new Map<OwnerTrainingGoal, PersonalizedRoadmapDay[]>();

  for (const day of days) {
    const key = day.primaryActivity?.category;
    if (!key) continue;
    if (!byCategory.has(key)) {
      byCategory.set(key, []);
      order.push(key);
    }
    byCategory.get(key)?.push(day);
  }

  return order.map((key) => {
    const chapterDays = byCategory.get(key) ?? [];
    const meta = trainingGoalCategoryMap.get(key);
    let seenUnfinished = false;

    const steps: ChapterStep[] = chapterDays.map((day) => {
      if (day.completedAt) {
        return { day, title: stepTitle(day), state: "done" };
      }
      if (!seenUnfinished) {
        seenUnfinished = true;
        return { day, title: stepTitle(day), state: "current" };
      }
      return { day, title: stepTitle(day), state: "locked" };
    });

    return {
      key,
      title: meta?.title ?? "Training",
      subtitle: meta?.subtitle ?? "Keep building the routine together.",
      pose: CHAPTER_POSE[key] ?? "settling",
      steps,
      doneCount: steps.filter((step) => step.state === "done").length,
      nextDay: steps.find((step) => step.state === "current")?.day ?? null,
    };
  });
};

const stepTitle = (day: PersonalizedRoadmapDay): string =>
  day.primaryActivity?.title ?? `Day ${day.dayNumber}`;
