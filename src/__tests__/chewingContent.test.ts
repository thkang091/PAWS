import { applyLocalLevelContent } from '../features/train/media/dropItContent';
import { CHEWING_PREPARATION } from '../features/train/media/chewingContent';
import { buildCardSequence } from '../services/lessonCardSequence';
import type { TrainingLevelDetail } from '../types/domain';

const oldLevel = {
  id: 'existing-level', skillId: 'existing-skill', stageType: 'level', levelNumber: 1,
  skill: { id: 'existing-skill', skillCode: '6-3', title: 'Redirect Destructive Chewing' },
  goal: 'old independent-choice goal', title: 'old title', readyCard: null,
  additionalPracticeAllowed: true, checkpointPolicy: null,
  cards: (['orient', 'guardian', 'additional_practice', 'completion'] as const).map((cardType, index) => ({
    id: `card-${index}`, cardKey: cardType, cardType, sortOrder: index,
    title: 'old title', body: 'old body', keyAction: 'old action', tryIt: 'old practice',
    harderPart: 'old challenge', finishInstruction: 'old finish', successCopy: 'old success',
    notYetCopy: 'old retry', buttons: [],
  })),
} as unknown as TrainingLevelDetail;

test.each([1, 2, 3, 4, 5])('6-3 Level %i updates lesson and help without replacing progress identities', levelNumber => {
  const level = applyLocalLevelContent({ ...oldLevel, levelNumber });
  expect(level.id).toBe(oldLevel.id);
  expect(level.skillId).toBe(oldLevel.skillId);
  expect(level.skill).toBe(oldLevel.skill);
  expect(level.readyCard).toBe(CHEWING_PREPARATION);
  expect(level.additionalPracticeAllowed).toBe(true);
  expect(level.cards.map(card => [card.id, card.cardKey])).toEqual(oldLevel.cards.map(card => [card.id, card.cardKey]));
  expect(JSON.stringify(buildCardSequence(level))).not.toMatch(/"old /);
  expect(oldLevel.goal).toBe('old independent-choice goal');
});

test('6-3 checkpoint copy follows the revised management routine', () => {
  const level = applyLocalLevelContent({ ...oldLevel, stageType: 'checkpoint', levelNumber: null });
  expect(level.checkpointPolicy?.entryRule).toBe(level.goal);
  expect(level.checkpointPolicy?.guardianInstruction).toContain('unsafe items');
  expect(level.cards[0].body).toBe(level.goal);
});

test('other skills retain their content', () => {
  const other = { ...oldLevel, skill: { ...oldLevel.skill, skillCode: '6-2' } };
  expect(applyLocalLevelContent(other)).toBe(other);
});
