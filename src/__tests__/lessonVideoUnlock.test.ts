import { areLessonVideosUnlocked } from '../features/train/media/lessonVideoUnlock';

test('finishing L5 cannot unlock a lesson with unresolved difficulty', () => {
  expect(areLessonVideosUnlocked({ level5CompletedAt: '2026-10-06', checkpointStatus: 'not_eligible', needsReinforcement: true })).toBe(false);
});

test('even a previous checkpoint pass cannot hide current difficulty', () => {
  expect(areLessonVideosUnlocked({ checkpointStatus: 'passed', needsReinforcement: true })).toBe(false);
});

test('resolving difficulties unlocks completed lessons, not unfinished lessons', () => {
  expect(areLessonVideosUnlocked({ level5CompletedAt: '2026-10-06', checkpointStatus: 'not_eligible', needsReinforcement: false })).toBe(true);
  expect(areLessonVideosUnlocked({ checkpointStatus: 'not_eligible', needsReinforcement: false })).toBe(false);
  expect(areLessonVideosUnlocked(null)).toBe(false);
});
