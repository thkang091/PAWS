import { continueTrainingClip } from '../services/trainingClipFlow';
import * as service from '../services/trainingCurriculumService';
import sections23Lessons from '../features/train/media/sections23Lessons.generated.json';
import section4Lessons from '../features/train/media/section4Lessons.generated.json';
import section6Lessons from '../features/train/media/section6Lessons.generated.json';
import type { TrainingLevelDetail, TrainingSession } from '../types/domain';

jest.mock('../services/trainingCurriculumService', () => ({
  getTrainingSession: jest.fn(), reportTrainingResult: jest.fn(),
  resolveSkillSession: jest.fn(), getTrainingLevelDetail: jest.fn(),
  getTrainingEnergy: jest.fn(), continueTrainingSession: jest.fn(),
}));
const api = jest.mocked(service);
const lessons = { ...sections23Lessons, ...section4Lessons, ...section6Lessons };
const session = { id: 'current', dogId: 'dog', skillId: 'skill', levelId: 'level-1', status: 'active' } as TrainingSession;

function arrange(skill: string, current: number, next: number) {
  const active = { ...session, levelId: `level-${current}` };
  api.getTrainingSession.mockResolvedValue(active);
  api.reportTrainingResult.mockResolvedValue({ settled: true, allowAdditionalPractice: false, result: 'success', session: { ...active, status: 'completed', finalResult: 'success' } });
  api.resolveSkillSession.mockResolvedValue({ resolution: 'level', levelId: `level-${next}`, levelNumber: next, sessionType: 'normal' });
  api.getTrainingLevelDetail.mockResolvedValue({ id: `level-${next}`, skill: { skillCode: skill }, stageType: 'level', levelNumber: next } as TrainingLevelDetail);
  api.getTrainingEnergy.mockResolvedValue({ base: 3, consumed: 3, remaining: 0 });
  api.continueTrainingSession.mockResolvedValue({ session: { ...active, id: 'next', levelId: `level-${next}` }, remainingEnergy: 0, chargedEnergy: false });
}
beforeEach(() => jest.resetAllMocks());

const transitions = Object.entries(lessons).flatMap(([skill, clips]) => clips.slice(0, -1).filter(clip => clips.some(next => next.levelNumber === clip.levelNumber + 1)).map(clip => [skill, clip.levelNumber, clip.levelNumber + 1] as const));
test.each(transitions)('%s Level %i advances to %i without another Energy charge', async (skill, current, next) => {
  arrange(skill, current, next);
  const result = await continueTrainingClip(session.id, null);
  expect(api.reportTrainingResult).toHaveBeenCalledWith(session.id, 'success', null);
  expect(result.nextSession?.levelId).toBe(`level-${next}`);
  expect(result.energy.remaining).toBe(0);
});

test.each(Object.keys(lessons))('%s final Level does not loop or start a checkpoint', async skill => {
  arrange(skill, 5, 5);
  const result = await continueTrainingClip(session.id, null);
  expect(result.hasNextClip).toBe(false);
  expect(api.continueTrainingSession).not.toHaveBeenCalled();
});
