import { DOORWAY_WAIT_LESSONS, type TrainingClipLesson } from "./doorwayWaitLesson";
import { FURNITURE_BOUNDARY_LESSONS } from "./furnitureBoundaryLesson";
import basicRulesLessons from "./basicRulesLessons.generated.json";
import sections23Lessons from "./sections23Lessons.generated.json";
import section4Lessons from "./section4Lessons.generated.json";
import section6Lessons from "./section6Lessons.generated.json";

const courses: Readonly<Record<string, readonly TrainingClipLesson[]>> = {
  "1-1": DOORWAY_WAIT_LESSONS,
  "1-2": FURNITURE_BOUNDARY_LESSONS,
  ...basicRulesLessons,
  ...sections23Lessons,
  ...section4Lessons,
  ...section6Lessons,
};
const empty: readonly TrainingClipLesson[] = [];

export function getTrainingClipLessons(skillCode?: string) {
  return courses[skillCode ?? ""] ?? empty;
}

export function getTrainingClipLesson(skillCode?: string, stageType?: string, levelNumber?: number | null) {
  if (stageType !== "level") return null;
  return getTrainingClipLessons(skillCode).find((lesson) => lesson.levelNumber === levelNumber) ?? null;
}
