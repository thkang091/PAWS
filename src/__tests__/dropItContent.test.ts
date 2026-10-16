import { applyLocalLevelContent, applyLocalSkillContent } from '../features/train/media/dropItContent';
import { buildCardSequence } from '../services/lessonCardSequence';
import type { TrainingLevelDetail, TrainingSkillSummary } from '../types/domain';

const oldLevel: TrainingLevelDetail = {
  id: 'existing-level', skillId: 'existing-skill', stageType: 'level', levelNumber: 1,
  goal: 'old goal', observableCriterion: 'old criterion', firstPart: 'old first', nextPart: 'old next',
  easierPath: 'old easier', successAnchor: 'old anchor', additionalPracticeAllowed: true,
  readyCard: null, checkpointPolicy: null, media: null,
  title: 'Choose Approved Items', skill: { id: 'existing-skill', skillCode: '1-3', title: 'Choose Approved Items', oneLineGoal: 'old goal' },
  cards: (['orient', 'guardian', 'additional_practice', 'completion'] as const).map((cardType, index) => ({
    id: `card-${index}`, cardKey: cardType, cardType, sortOrder: index,
    title: 'old title', body: 'old body', keyAction: 'old action', tryIt: 'old practice', harderPart: 'old challenge',
    finishInstruction: 'old finish', successCopy: 'old success', notYetCopy: 'old retry', buttons: [],
  })),
};

test.each([1, 2, 3, 4, 5])('Drop It Level %i replaces lesson and help copy while preserving server identities', levelNumber => {
  const level = applyLocalLevelContent({ ...oldLevel, levelNumber });
  expect(level.id).toBe(oldLevel.id);
  expect(level.skillId).toBe(oldLevel.skillId);
  expect(level.skill.title).toBe('Drop It');
  expect(level.readyCard?.materials[1].label).toBe('A safe toy');
  expect(level.cards.map(card => [card.id, card.cardKey])).toEqual(oldLevel.cards.map(card => [card.id, card.cardKey]));
  expect(JSON.stringify(buildCardSequence(level))).not.toMatch(/old |Choose Approved/);
  expect(level.media).toBeNull();
});

test('checkpoint also uses Drop It content', () => {
  const level = applyLocalLevelContent({ ...oldLevel, stageType: 'checkpoint', levelNumber: null });
  expect(level.checkpointPolicy?.guardianInstruction).toContain('Drop');
  expect(JSON.stringify(buildCardSequence(level))).not.toMatch(/old |Choose Approved/);
});

test('roadmap label changes without changing skill identity or other courses', () => {
  const skill = { id: 'existing-skill', skillCode: '1-3', title: 'Choose Approved Items' } as TrainingSkillSummary;
  expect(applyLocalSkillContent(skill)).toMatchObject({ id: skill.id, title: 'Drop It' });
  const otherSkill = { ...skill, skillCode: '6-1' };
  expect(applyLocalSkillContent(otherSkill)).toBe(otherSkill);
  const otherLevel = { ...oldLevel, skill: { ...oldLevel.skill, skillCode: '1-4' } };
  expect(applyLocalLevelContent(otherLevel)).toBe(otherLevel);
  expect(oldLevel.title).toBe('Choose Approved Items');
});
