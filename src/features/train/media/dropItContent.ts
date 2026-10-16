import type { TrainingLevelDetail, TrainingReadyCard, TrainingSkillSummary } from "@/types/domain";
import { applyHandlingContent } from './handlingContent';
import { applyChewingContent } from './chewingContent';

// App-only curriculum override, approved for the acquired 1-3 footage.
// Keep server identities and progress intact until the curriculum DB is updated.
const identity = { title: "Drop It", oneLineGoal: "Let go of a safe item willingly and return to calm play." };
export const DROP_IT_PREPARATION: TrainingReadyCard = {
  materials: [
    { label: "Small treats", detail: "Use small, easy-to-eat rewards for friendly trades." },
    { label: "A safe toy", detail: "Choose a low-value toy that is too large to swallow." },
    { label: "A quiet space", detail: "Start away from distractions with room to move apart." },
  ],
  safetyCopy: "Never pry the mouth open or chase for an item. If your dog freezes, growls or guards, stop and give space. Practise only with safe items; seek qualified help for guarding.",
  primaryAction: "Continue",
  secondaryAction: "End lesson",
};

const levels = [
  {
    title: "Introduce the Drop Cue",
    goal: "Build a friendly association with the word Drop before adding a toy.",
    firstPart: "With an empty mouth, say Drop once, then scatter a few small treats.",
    nextPart: "Let your dog finish eating and reset for one easy repetition.",
    easierPath: "Use a quieter spot and keep your hand movement small.",
    successAnchor: "Your dog calmly follows the treat scatter after the cue.",
  },
  {
    title: "Trade and Return",
    goal: "Make releasing a safe toy a rewarding trade.",
    firstPart: "Offer an easy toy, say Drop once, then trade for treats.",
    nextPart: "Pick up the toy while your dog eats and offer it back when safe.",
    easierPath: "Use a less exciting toy and an easier treat scatter; do not pull the toy away.",
    successAnchor: "Your dog willingly releases the toy for the trade.",
  },
  {
    title: "Release Before Reward",
    goal: "Reward letting go after one familiar cue.",
    firstPart: "Say Drop once with a familiar safe item and allow a brief moment to release.",
    nextPart: "Mark the release, reward, then offer the safe item again.",
    easierPath: "Return to an easy treat trade if your dog keeps holding on.",
    successAnchor: "Your dog releases before you deliver the reward.",
  },
  {
    title: "Practise While Standing",
    goal: "Use the same friendly trade while standing nearby.",
    firstPart: "Stand at a comfortable distance and use the familiar Drop cue.",
    nextPart: "Reward the release, return the safe item and step away calmly.",
    easierPath: "Return to your previous position and use a lower-value item.",
    successAnchor: "Your dog releases comfortably with you standing nearby.",
  },
  {
    title: "Drop During Play",
    goal: "Pause a gentle game for a willing release.",
    firstPart: "Begin gentle play, pause your movement and say Drop once.",
    nextPart: "Reward the release, then restart only while your dog stays comfortable.",
    easierPath: "Lower the excitement and return to the easy treat trade.",
    successAnchor: "Your dog lets go during a calm pause in play.",
  },
];

export function applyLocalSkillContent(skill: TrainingSkillSummary): TrainingSkillSummary {
  return skill.skillCode === "1-3" ? { ...skill, ...identity } : skill;
}

export function applyLocalLevelContent(level: TrainingLevelDetail): TrainingLevelDetail {
  if (level.skill.skillCode !== "1-3") return applyChewingContent(applyHandlingContent(level));
  const checkpoint = level.stageType === "checkpoint";
  const content = checkpoint ? {
    title: "Drop It · Checkpoint",
    goal: "Try a familiar, friendly trade during an ordinary calm moment.",
    firstPart: "Use a safe toy, say Drop once and reward a willing release.",
    nextPart: "Return the safe toy or restart gentle play.",
    easierPath: "If releasing is difficult, return to an easier trade without pressure.",
    successAnchor: "Your dog releases willingly and stays comfortable.",
  } : levels[(level.levelNumber ?? 1) - 1];
  if (!content) return { ...level, skill: { ...level.skill, ...identity } };
  return {
    ...level, ...content,
    observableCriterion: content.successAnchor,
    skill: { ...level.skill, ...identity },
    readyCard: DROP_IT_PREPARATION,
    media: null,
    checkpointPolicy: checkpoint ? {
      entryRule: content.goal, guardianInstruction: content.firstPart,
      successCopy: content.successAnchor, notYetCopy: content.easierPath,
    } : null,
    cards: level.cards.map(card => ({
      ...card,
      title: card.cardType === "additional_practice" ? "Make the trade easier" : content.title,
      body: card.cardType === "additional_practice" ? content.easierPath : content.goal,
      keyAction: content.firstPart,
      tryIt: card.cardType === "additional_practice" ? content.easierPath : content.firstPart,
      harderPart: content.nextPart,
      finishInstruction: "Finish with a friendly reward and a calm pause.",
      successCopy: content.successAnchor,
      notYetCopy: content.easierPath,
    })),
  };
}
