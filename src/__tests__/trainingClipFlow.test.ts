import { continueTrainingClip, recordTrainingClipHelp } from '../services/trainingClipFlow';
import * as service from '../services/trainingCurriculumService';
import type { TrainingSession, TrainingLevelDetail } from '../types/domain';
jest.mock('../services/trainingCurriculumService', () => ({
  getTrainingSession: jest.fn(), reportTrainingResult: jest.fn(),
  resolveSkillSession: jest.fn(), getTrainingLevelDetail: jest.fn(),
  getTrainingEnergy: jest.fn(), continueTrainingSession: jest.fn(),
}));
const api = jest.mocked(service);
const session = { id: 'session-1', dogId: 'dog', skillId: 'skill', levelId: 'level-1', status: 'active', finalResult: null, currentCardKey: 'orient' } as TrainingSession;
const complete = { ...session, status: 'completed', finalResult: 'success' } as TrainingSession;
const next = { ...session, id: 'session-2', levelId: 'level-2' };
const level = { id: 'level-2', skill: { skillCode: '1-1' }, stageType: 'level', levelNumber: 2 } as TrainingLevelDetail;
beforeEach(() => {
  jest.resetAllMocks();
  api.getTrainingSession.mockResolvedValue(session);
  api.reportTrainingResult.mockResolvedValue({ settled: true, allowAdditionalPractice: false, result: 'success', session: complete });
  api.getTrainingEnergy.mockResolvedValue({ base: 3, consumed: 1, remaining: 2 });
  api.resolveSkillSession.mockResolvedValue({ resolution: 'level', levelId: 'level-2', levelNumber: 2, sessionType: 'normal' });
  api.getTrainingLevelDetail.mockResolvedValue(level);
  api.continueTrainingSession.mockResolvedValue({ session: next, remainingEnergy: 2, chargedEnergy: false });
});
test('Continue records success and continues the same course without charging Energy', async () => {
  const result = await continueTrainingClip(session.id, 'guardian-card');
  expect(api.reportTrainingResult).toHaveBeenCalledWith(session.id, 'success', 'guardian-card');
  expect(api.continueTrainingSession).toHaveBeenCalledWith(session.id);
  expect(result.nextSession?.levelId).toBe('level-2');
  expect(result.energy.remaining).toBe(2);
});
test('retry after next-Level loading failure does not report success twice', async () => {
  api.getTrainingSession.mockResolvedValue(complete);
  await continueTrainingClip(session.id, null);
  expect(api.reportTrainingResult).not.toHaveBeenCalled();
  expect(api.continueTrainingSession).toHaveBeenCalledTimes(1);
});
test('zero remaining Energy still allows the next Level of the paid course', async () => {
  api.getTrainingEnergy.mockResolvedValue({ base: 3, consumed: 3, remaining: 0 });
  api.continueTrainingSession.mockResolvedValue({ session: next, remainingEnergy: 0, chargedEnergy: false });
  const result = await continueTrainingClip(session.id, null);
  expect(result.hasNextClip).toBe(true);
  expect(result.nextSession?.levelId).toBe('level-2');
  expect(result.energy.remaining).toBe(0);
  expect(api.continueTrainingSession).toHaveBeenCalledTimes(1);
});
test('Level 4 Continue starts the new Level 5 clip without another Energy charge', async () => {
  api.getTrainingSession.mockResolvedValue({ ...session, levelId: 'level-4' });
  api.reportTrainingResult.mockResolvedValue({ settled: true, allowAdditionalPractice: false, result: 'success', session: { ...complete, levelId: 'level-4' } });
  api.getTrainingLevelDetail.mockResolvedValue({ ...level, id: 'level-5', levelNumber: 5 });
  api.continueTrainingSession.mockResolvedValue({ session: { ...next, levelId: 'level-5' }, remainingEnergy: 2, chargedEnergy: false });
  const result = await continueTrainingClip(session.id, null);
  expect(result.hasNextClip).toBe(true);
  expect(result.nextSession?.levelId).toBe('level-5');
  expect(result.energy.remaining).toBe(2);
});
test('Level 5 Continue records success and exits without starting a checkpoint', async () => {
  api.getTrainingSession.mockResolvedValue({ ...session, levelId: 'level-5' });
  api.reportTrainingResult.mockResolvedValue({ settled: true, allowAdditionalPractice: false, result: 'success', session: { ...complete, levelId: 'level-5' } });
  api.getTrainingLevelDetail.mockResolvedValue({ ...level, id: 'level-5', levelNumber: 5 });
  const result = await continueTrainingClip(session.id, null);
  expect(api.reportTrainingResult).toHaveBeenCalledWith(session.id, 'success', null);
  expect(result.hasNextClip).toBe(false);
  expect(result.nextSession).toBeNull();
  expect(api.continueTrainingSession).not.toHaveBeenCalled();
});
test('a due checkpoint is not automatically started after a clip', async () => {
  api.getTrainingLevelDetail.mockResolvedValue({ ...level, id: 'checkpoint', stageType: 'checkpoint', levelNumber: null });
  expect((await continueTrainingClip(session.id, null)).hasNextClip).toBe(false);
  expect(api.continueTrainingSession).not.toHaveBeenCalled();
});
test('help records one not_yet attempt and repeated help does not fail the Level again', async () => {
  api.reportTrainingResult.mockResolvedValue({ settled: false, allowAdditionalPractice: true, result: null, session });
  const updated = await recordTrainingClipHelp(session.id, 'guardian-card');
  expect(api.reportTrainingResult).toHaveBeenCalledWith(session.id, 'not_yet', 'guardian-card');
  expect(updated.currentCardKey).toBe('additional_practice');
  api.getTrainingSession.mockResolvedValue(updated);
  await recordTrainingClipHelp(session.id, 'guardian-card');
  expect(api.reportTrainingResult).toHaveBeenCalledTimes(1);
});
test('failed success save does not advance or charge for a next Level', async () => {
  api.reportTrainingResult.mockRejectedValue(new Error('offline'));
  await expect(continueTrainingClip(session.id, null)).rejects.toThrow('offline');
  expect(api.continueTrainingSession).not.toHaveBeenCalled();
});

test('furniture Continue starts its next clip without another Energy charge', async () => {
  api.getTrainingLevelDetail.mockResolvedValue({ ...level, skill: { skillCode: '1-2' } } as TrainingLevelDetail);
  const result = await continueTrainingClip(session.id, null);
  expect(result.hasNextClip).toBe(true);
  expect(result.nextSession?.levelId).toBe('level-2');
  expect(result.energy.remaining).toBe(2);
});

test.each(['1-2', '1-3', '1-4', '1-5'].flatMap(skill => [1, 2, 3, 4].map(current => [skill, current] as const)))('%s Level %i continues into its next clip', async (skill, current) => {
  api.getTrainingSession.mockResolvedValue({ ...session, levelId: `level-${current}` });
  api.reportTrainingResult.mockResolvedValue({ settled: true, allowAdditionalPractice: false, result: 'success', session: { ...complete, levelId: `level-${current}` } });
  api.getTrainingLevelDetail.mockResolvedValue({ ...level, id: `level-${current + 1}`, levelNumber: current + 1, skill: { skillCode: skill } } as TrainingLevelDetail);
  api.continueTrainingSession.mockResolvedValue({ session: { ...next, levelId: `level-${current + 1}` }, remainingEnergy: 2, chargedEnergy: false });
  const result = await continueTrainingClip(session.id, null);
  expect(result.hasNextClip).toBe(true);
  expect(result.nextSession?.levelId).toBe(`level-${current + 1}`);
  expect(result.energy.remaining).toBe(2);
});

test.each(['1-2', '1-3', '1-4', '1-5'])('%s Level 5 exits after success when the resolver remains at Level 5', async (skill) => {
  api.getTrainingSession.mockResolvedValue({ ...session, levelId: 'level-5' });
  api.reportTrainingResult.mockResolvedValue({ settled: true, allowAdditionalPractice: false, result: 'success', session: { ...complete, levelId: 'level-5' } });
  api.getTrainingLevelDetail.mockResolvedValue({ ...level, id: 'level-5', levelNumber: 5, skill: { skillCode: skill } } as TrainingLevelDetail);
  const result = await continueTrainingClip(session.id, null);
  expect(result.hasNextClip).toBe(false);
  expect(result.nextSession).toBeNull();
  expect(api.continueTrainingSession).not.toHaveBeenCalled();
});
