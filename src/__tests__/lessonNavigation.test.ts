import { getRoundPracticeAccess, nextVisitedPractice } from '../features/train/rounds/lessonNavigation';
const lesson = [1,2,3,4,5].map(n => ({levelId: `level-${n}`, levelNumber:n, visited:true, completed:true}));
const plan = (levels: number[], cursor: number) => getRoundPracticeAccess(levels.map(n => `level-${n}`), cursor, lesson);

test('Continue from a previous video returns through this round to the current practice', () => {
  const access = plan([1,2,3],2);
  expect(nextVisitedPractice(1,3,access)).toBe(2);
  expect(nextVisitedPractice(2,3,access)).toBe(3);
});

test('a returning round contains only its three practices and starts with empty progress', () => {
  const access = plan([3,4,5],0);
  expect(access.map(item => item.levelNumber)).toEqual([3,4,5]);
  expect(access.map(item => item.completed)).toEqual([false,false,false]);
  expect(access.map(item => item.visited)).toEqual([true,false,false]);
});

test('resuming restores only the current round progress', () => {
  const access = plan([3,4,5],1);
  expect(access.map(item => item.completed)).toEqual([true,false,false]);
  expect(access.map(item => item.visited)).toEqual([true,true,false]);
  expect(nextVisitedPractice(3,4,access)).toBe(4);
  expect(nextVisitedPractice(4,4,access)).toBe(4);
});

test('reinforcement follows its saved order rather than consecutive level numbers', () => {
  const access = plan([4,1,2],2);
  expect(access.map(item => item.levelNumber)).toEqual([4,1,2]);
  expect(nextVisitedPractice(4,2,access)).toBe(1);
  expect(nextVisitedPractice(1,2,access)).toBe(2);
  expect(nextVisitedPractice(5,2,access)).toBe(2);
});

test('a nonconsecutive reinforcement round cannot jump to an upcoming practice', () => {
  const access = plan([2,4,5],1);
  expect(nextVisitedPractice(2,4,access)).toBe(4);
  expect(nextVisitedPractice(4,4,access)).toBe(4);
  expect(access[2].visited).toBe(false);
});

test('round navigation preserves lifetime progress and supports an already-paid shorter plan', () => {
  const before = JSON.stringify(lesson);
  const access = plan([4,5],1);
  expect(access).toHaveLength(2);
  expect(nextVisitedPractice(4,5,access)).toBe(5);
  expect(JSON.stringify(lesson)).toBe(before);
});
