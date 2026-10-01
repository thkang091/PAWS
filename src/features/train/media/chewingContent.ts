import type { TrainingLevelDetail, TrainingReadyCard } from '@/types/domain';

// User-approved app-only 6-3 revision. Keep server Level IDs and progress intact.
export const CHEWING_PREPARATION: TrainingReadyCard = {
  materials: [
    { label: 'A suitable chew and toy', detail: 'Choose dog-safe items that suit your dog’s size and chewing style.' },
    { label: 'A comfortable space', detail: 'Move unsafe household items out of reach. Use a familiar mat or managed area.' },
    { label: 'A safe practice item', detail: 'If needed, use a large neutral item. Keep small decorations and swallowable objects away.' },
  ],
  safetyCopy: 'Supervise chewing. Never chase, force an item from the mouth, or use confinement as punishment. Stop and give space if your dog guards an item or seems distressed.',
  primaryAction: 'Continue', secondaryAction: 'End lesson',
};

const levels = [
  {
    title: 'Prepare the Chew Space',
    goal: 'Set up a comfortable area and offer an approved chew.',
    firstPart: 'Move unsafe items out of reach and prepare a familiar resting area.',
    nextPart: 'Offer a suitable chew and supervise while your dog settles.',
    easierPath: 'Stay closer and use a chew your dog already enjoys.',
    successAnchor: 'Your dog comfortably engages with the chew in the prepared space.',
  },
  {
    title: 'Redirect to an Approved Toy',
    goal: 'Manage access to a practice item and guide your dog toward an approved toy.',
    firstPart: 'Use a large safe practice item and stay close enough to manage access calmly.',
    nextPart: 'Offer the approved toy and allow a short, gentle game.',
    easierPath: 'Offer the toy before your dog reaches the practice item.',
    successAnchor: 'Your dog moves toward the approved toy without chasing or forced removal.',
  },
  {
    title: 'Keep the Approved Activity Going',
    goal: 'Help your dog continue an approved toy or chew activity after redirection.',
    firstPart: 'Use one calm redirect and keep other items out of reach.',
    nextPart: 'Allow a short toy game or a comfortable chew break while you supervise.',
    easierPath: 'Start directly with the approved activity and remove the distraction.',
    successAnchor: 'Your dog remains engaged with the approved activity after your help.',
  },
  {
    title: 'Chew During Mild Activity',
    goal: 'Continue chewing while one small household movement occurs.',
    firstPart: 'Let your dog settle with the chew before you move.',
    nextPart: 'Make one small movement nearby and continue supervising.',
    easierPath: 'Stay still or reduce the movement.',
    successAnchor: 'Your dog comfortably continues the chew activity during mild movement.',
  },
  {
    title: 'Use the Management Routine',
    goal: 'Prepare the space, offer an approved activity, and redirect calmly if needed.',
    firstPart: 'Move unsafe items away and prepare the chew or toy.',
    nextPart: 'Use one calm redirect if needed, then supervise the approved activity.',
    easierPath: 'Practise only the prepared space and chew step.',
    successAnchor: 'Your dog uses the approved activity comfortably in the managed space.',
  },
];

export function applyChewingContent(level: TrainingLevelDetail): TrainingLevelDetail {
  if (level.skill.skillCode !== '6-3') return level;
  const checkpoint = level.stageType === 'checkpoint';
  const content = checkpoint ? { ...levels[4], title: 'Chewing Routine · Checkpoint' } : levels[(level.levelNumber ?? 1) - 1];
  if (!content) return level;
  return {
    ...level, ...content, observableCriterion: content.successAnchor,
    readyCard: CHEWING_PREPARATION,
    checkpointPolicy: checkpoint ? {
      ...level.checkpointPolicy,
      entryRule: content.goal, guardianInstruction: content.firstPart,
      successCopy: content.successAnchor, notYetCopy: content.easierPath,
    } : level.checkpointPolicy,
    cards: level.cards.map(card => ({
      ...card,
      title: card.cardType === 'additional_practice' ? 'Make the activity easier' : content.title,
      body: card.cardType === 'additional_practice' ? content.easierPath : content.goal,
      keyAction: content.firstPart,
      tryIt: card.cardType === 'additional_practice' ? content.easierPath : content.firstPart,
      harderPart: content.nextPart,
      finishInstruction: 'End the practice calmly and keep supervising the chew.',
      successCopy: content.successAnchor, notYetCopy: content.easierPath,
    })),
  };
}
