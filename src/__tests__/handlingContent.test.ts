import { applyLocalLevelContent } from '../features/train/media/dropItContent';
import type { TrainingLevelDetail } from '../types/domain';

const original = {
  id: 'server-level', skillId: 'server-skill', stageType: 'level', levelNumber: 3,
  title: 'Accept One Shoulder Touch', goal: 'old shoulder-only goal',
  skill: { skillCode: '3-5' }, readyCard: { materials: [] }, checkpointPolicy: null,
  cards: [{ id: 'card', cardKey: 'practice', cardType: 'guardian', buttons: [] }],
} as unknown as TrainingLevelDetail;

test.each([['3-1', 5], ['3-5', 3]] as const)('%s Level %i uses the approved touch alternative throughout lesson and help', (skillCode, levelNumber) => {
  const level = { ...original, levelNumber, skill: { ...original.skill, skillCode } };
  const updated = applyLocalLevelContent(level);
  expect(updated.goal).toContain('shoulder or back');
  expect(updated.cards[0].body).toBe(updated.goal);
  expect(updated.cards[0].harderPart).toBe(updated.nextPart);
  expect(updated.id).toBe(level.id);
  expect(updated.skillId).toBe(level.skillId);
  expect(updated.cards[0].id).toBe(level.cards[0].id);
  expect(updated.readyCard).toBe(level.readyCard);
  expect(level.goal).toBe('old shoulder-only goal');
});

test('equipment Level and checkpoints keep their original curriculum', () => {
  const equipment = { ...original, levelNumber: 4 };
  const checkpoint = { ...original, stageType: 'checkpoint' as const, levelNumber: null };
  expect(applyLocalLevelContent(equipment)).toBe(equipment);
  expect(applyLocalLevelContent(checkpoint)).toBe(checkpoint);
});
