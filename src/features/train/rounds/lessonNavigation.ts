import type { LessonAccess } from '@/services/trainingRoundService';

// Follow this round's saved order, including reinforcement. Lifetime success
// does not complete or unlock a practice in the new round.
export function getRoundPracticeAccess(levelIds: readonly string[], cursor: number, lessonAccess: readonly LessonAccess[]): LessonAccess[] {
  return levelIds.flatMap((levelId, index) => {
    const level = lessonAccess.find(item => item.levelId === levelId);
    return level ? [{ ...level, visited: index <= cursor, completed: index < cursor }] : [];
  });
}

// Browsing never settles a session. Continue follows the paid round's order,
// which may differ from the lesson's numerical order.
export function nextVisitedPractice(viewed: number, current: number, access: readonly LessonAccess[]) {
  const index = access.findIndex(item => item.levelNumber === viewed);
  const next = index >= 0 ? access[index + 1] : undefined;
  return next?.visited ? next.levelNumber : current;
}
