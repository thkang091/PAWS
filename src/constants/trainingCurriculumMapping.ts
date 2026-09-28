import type { OwnerTrainingGoal } from "@/types/domain";

export const SECTION_NUMBER_BY_FOCUS: Partial<Record<OwnerTrainingGoal, number>> = {
  RULES_AND_BOUNDARIES: 1,
  CLEAR_COMMUNICATION: 2,
  HANDLING_AND_GROOMING: 3,
  CALM_EVERYDAY_MANNERS: 4,
  POTTY_AND_REAL_WORLD: 5,
  PROBLEM_BEHAVIORS: 6,
};

export const sectionNumberForFocus = (goal: OwnerTrainingGoal | string): number | null =>
  SECTION_NUMBER_BY_FOCUS[goal as OwnerTrainingGoal] ?? null;

export const SECTION_NUMBER_BY_TOPIC_KEY: Partial<Record<string, number>> = {
  rules: 1,
  communication: 2,
  grooming: 3,
  manners: 4,
  potty: 5,
  problems: 6,
};

export const isCurriculumTopic = (topicKey: string): boolean => topicKey in SECTION_NUMBER_BY_TOPIC_KEY;
