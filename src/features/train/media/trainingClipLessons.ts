import { DOORWAY_WAIT_LESSONS, type TrainingClipLesson } from "./doorwayWaitLesson";
import { FURNITURE_BOUNDARY_LESSONS } from "./furnitureBoundaryLesson";
import basicRulesLessons from "./basicRulesLessons.generated.json";
import sections23Lessons from "./sections23Lessons.generated.json";
import section4Lessons from "./section4Lessons.generated.json";
import section5Lessons from "./section5Lessons.generated.json";
import section6Lessons from "./section6Lessons.generated.json";
import { focusLesson, focusSegments, TRAINING_CLIP_FOCUS } from "./trainingClipFocus";
import { getOriginalTrainingYouTubeSegments, youtubeSegmentIndexAt } from "./trainingYouTube";

const courses: Readonly<Record<string, readonly TrainingClipLesson[]>> = {
  "1-1": DOORWAY_WAIT_LESSONS,
  "1-2": FURNITURE_BOUNDARY_LESSONS,
  ...basicRulesLessons,
  ...sections23Lessons,
  ...section4Lessons,
  ...section5Lessons,
  ...section6Lessons,
};
const focusedCourses = Object.fromEntries(Object.entries(courses).map(([skill, lessons]) => [skill,
  lessons.map(lesson => focusLesson(lesson, getOriginalTrainingYouTubeSegments(skill, lesson.levelNumber),
    TRAINING_CLIP_FOCUS[skill]?.[lesson.levelNumber])),
]));
const empty: readonly TrainingClipLesson[] = [];

export function getTrainingClipLessons(skillCode?: string) {
  return focusedCourses[skillCode ?? ""] ?? empty;
}

// Old questions retain their original caption clock. Show just that example,
// including a removed example from an older session, rather than seeking an
// old timestamp into the newly shortened lesson or reopening its full montage.
export function getTrainingReviewClip(skillCode: string, level: number, reviewAt: number) {
  const lesson = courses[skillCode]?.find(item => item.levelNumber === level);
  const original = getOriginalTrainingYouTubeSegments(skillCode, level);
  if (!lesson || !original.length) return null;
  const index = youtubeSegmentIndexAt(original, reviewAt);
  const focus = { groups: [[index]] };
  const segments = focusSegments(original, focus);
  return { lesson: focusLesson(lesson, original, focus), segments,
    at: Math.max(0, Math.min(segments[0].clipEndSeconds! - 0.05, reviewAt - (original[index].clipStartSeconds ?? 0))) };
}

export function getTrainingClipLesson(skillCode?: string, stageType?: string, levelNumber?: number | null) {
  if (stageType !== "level") return null;
  return getTrainingClipLessons(skillCode).find((lesson) => lesson.levelNumber === levelNumber) ?? null;
}
