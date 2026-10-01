import type { TrainingLevelDetail } from '@/types/domain';

// User-approved shoulder/back alternative for the acquired familiar-trainer footage.
// Preserve all server identities, preparation cards, and checkpoint rules.
export function applyHandlingContent(level: TrainingLevelDetail): TrainingLevelDetail {
  if (level.stageType !== 'level') return level;
  const familiarPerson = level.skill.skillCode === '3-1' && level.levelNumber === 5;
  const briefTouch = level.skill.skillCode === '3-5' && level.levelNumber === 3;
  if (!familiarPerson && !briefTouch) return level;
  const content = {
    title: familiarPerson ? 'Practise With a Familiar Person' : 'Accept One Brief Touch',
    goal: 'Accept one brief shoulder or back touch from a familiar adult.',
    firstPart: 'Let your dog choose to stay near the familiar adult as their hand approaches gently.',
    nextPart: 'Offer one brief shoulder or back touch, withdraw the hand, then reward and pause.',
    easierPath: 'Keep the familiar adult nearby without contact, and reward a comfortable approach.',
    successAnchor: 'Your dog stays available for one brief touch without restraint and may move away.',
  };
  return {
    ...level, ...content, observableCriterion: content.successAnchor,
    cards: level.cards.map(card => ({
      ...card,
      title: card.cardType === 'additional_practice' ? 'Make the touch easier' : content.title,
      body: card.cardType === 'additional_practice' ? content.easierPath : content.goal,
      keyAction: content.firstPart,
      tryIt: card.cardType === 'additional_practice' ? content.easierPath : content.firstPart,
      harderPart: content.nextPart,
      finishInstruction: 'Remove your hand and let your dog move away freely.',
      successCopy: content.successAnchor,
      notYetCopy: content.easierPath,
    })),
  };
}
