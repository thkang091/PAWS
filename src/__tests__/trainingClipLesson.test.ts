import { DOORWAY_WAIT_LESSONS, clipCueAt, getDoorwayWaitLesson, stepPlaybackRange } from "../features/train/media/doorwayWaitLesson";
import { FURNITURE_BOUNDARY_LESSONS } from "../features/train/media/furnitureBoundaryLesson";
import { getTrainingClipLesson } from "../features/train/media/trainingClipLessons";
import basicRulesLessons from "../features/train/media/basicRulesLessons.generated.json";
import sections23Lessons from "../features/train/media/sections23Lessons.generated.json";
import sections23Coverage from "../features/train/media/sections23Coverage.generated.json";
import section4Lessons from "../features/train/media/section4Lessons.generated.json";
import section4Coverage from "../features/train/media/section4Coverage.generated.json";
import section6Lessons from "../features/train/media/section6Lessons.generated.json";
import section5Lessons from "../features/train/media/section5Lessons.generated.json";
import section5Coverage from "../features/train/media/section5Coverage.generated.json";

describe("doorway wait instructional clips", () => {
  test("binds only to the matching skill and level, never a checkpoint or missing level", () => {
    expect(getDoorwayWaitLesson("1-1", "level", 1)?.id).toBe("doorway-wait-l1");
    expect(getDoorwayWaitLesson("1-2", "level", 1)).toBeNull();
    expect(getDoorwayWaitLesson("1-1", "checkpoint", null)).toBeNull();
    expect(getDoorwayWaitLesson("1-1", "level", 5)?.id).toBe("doorway-wait-l5");
    expect(getDoorwayWaitLesson("1-1", "level", 6)).toBeNull();
  });

  test.each([...DOORWAY_WAIT_LESSONS, ...FURNITURE_BOUNDARY_LESSONS, ...Object.values(basicRulesLessons).flat(), ...Object.values(sections23Lessons).flat(), ...Object.values(section4Lessons).flat(), ...Object.values(section5Lessons).flat(), ...Object.values(section6Lessons).flat()])("$id has ordered captions inside the exported file", (lesson) => {
    const cues = lesson.steps.flatMap((step) => step.cues);
    expect(cues[0].at).toBe(0);
    for (let i = 0; i < cues.length; i++) {
      expect(cues[i].text.length).toBeGreaterThan(0);
      expect(cues[i].at).toBeLessThan(lesson.duration);
      if (i) expect(cues[i].at).toBeGreaterThan(cues[i - 1].at);
      expect(clipCueAt(lesson, cues[i].at).text).toBe(cues[i].text);
    }
    lesson.steps.forEach((step, index) => {
      const range = stepPlaybackRange(lesson, index)!;
      expect(range.start).toBe(step.cues[0].at);
      expect(range.end).toBeGreaterThan(step.cues[step.cues.length - 1].at);
      expect(range.end).toBeLessThanOrEqual(lesson.duration);
    });
  });

  test.each(Object.entries(basicRulesLessons))("%s connects exactly five distinct Levels", (skill, lessons) => {
    expect(lessons.map(lesson => lesson.levelNumber)).toEqual([1, 2, 3, 4, 5]);
    lessons.forEach(lesson => expect(getTrainingClipLesson(skill, "level", lesson.levelNumber)).toBe(lesson));
    expect(getTrainingClipLesson(skill, "level", 6)).toBeNull();
    expect(getTrainingClipLesson(skill, "checkpoint", null)).toBeNull();
  });

  test.each(Object.entries({ ...sections23Lessons, ...section4Lessons, ...section5Lessons, ...section6Lessons }))("%s connects only reviewed Levels", (skill, lessons) => {
    expect(lessons.map(lesson => lesson.levelNumber)).toEqual([1, 2, 3, 4, 5]);
    lessons.forEach(lesson => expect(getTrainingClipLesson(skill, "level", lesson.levelNumber)).toBe(lesson));
    expect(new Set(lessons.map(lesson => lesson.levelNumber)).size).toBe(lessons.length);
    expect(getTrainingClipLesson(skill, "checkpoint", null)).toBeNull();
    expect(getTrainingClipLesson(skill, "level", 6)).toBeNull();
  });

  test("Section 2 and 3 have no remaining missing Levels", () => {
    expect(sections23Coverage.missing).toEqual([]);
  });

  test("Sections 4 and 5 bind their existing curriculum skills only", () => {
    expect(section4Coverage.missing).toEqual([]);
    expect(Object.keys(section4Lessons)).toEqual(['4-1', '4-2', '4-3', '4-4', '4-5']);
    expect(section5Coverage.missing).toEqual([]);
    expect(Object.keys(section5Lessons)).toEqual(['5-1', '5-2', '5-3']);
    for (let skill = 4; skill <= 5; skill++) {
      for (let level = 1; level <= 5; level++) {
        expect(getTrainingClipLesson(`5-${skill}`, 'level', level)).toBeNull();
      }
    }
  });

  test("Section 5 stays under 30 seconds, with three short recovery examples only in 5-2 L5", () => {
    for (const [skill, lessons] of Object.entries(section5Lessons)) {
      for (const lesson of lessons) {
        expect(getTrainingClipLesson(skill, 'level', lesson.levelNumber)).toBe(lesson);
        expect(lesson.steps).toHaveLength(skill === '5-2' && lesson.levelNumber === 5 ? 3 : 1);
        expect(lesson.duration / 0.6).toBeLessThanOrEqual(30);
      }
    }
    for (const [skill, course] of Object.entries(section5Coverage.courses)) {
      for (const level of course.levels) {
        expect(level.sources).toHaveLength(skill === '5-2' && level.levelNumber === 5 ? 3 : 1);
        level.sources.forEach(source => expect(source).not.toContain('Explanation'));
      }
    }
  });

  test("all five furniture clips stay separate from doorway clips and checkpoints", () => {
    expect(getTrainingClipLesson("1-2", "level", 1)?.id).toBe("furniture-boundary-l1");
    expect(getTrainingClipLesson("1-2", "level", 3)?.duration).toBe(6.2);
    expect(getTrainingClipLesson("1-1", "level", 3)?.id).toBe("doorway-wait-l3");
    expect(getTrainingClipLesson("1-2", "level", 4)?.id).toBe("furniture-boundary-l4");
    expect(getTrainingClipLesson("1-2", "level", 5)?.id).toBe("furniture-boundary-l5");
    expect(getTrainingClipLesson("1-2", "level", 6)).toBeNull();
    expect(getTrainingClipLesson("1-2", "checkpoint", null)).toBeNull();
  });

  test("caption boundaries work for forward and backward seeks", () => {
    const lesson = DOORWAY_WAIT_LESSONS[0];
    expect(clipCueAt(lesson, 4.2).at).toBe(4);
    expect(clipCueAt(lesson, 1.7).at).toBe(1.5);
    expect(clipCueAt(lesson, 2.99).at).toBe(1.5);
    expect(clipCueAt(lesson, 3).stepIndex).toBe(1);
    expect(stepPlaybackRange(lesson, 0)).toEqual({ start: 0, end: 3 });
    expect(stepPlaybackRange(lesson, 99)).toBeNull();
  });
});
