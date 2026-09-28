import type { TrainingLessonCard, TrainingLevelDetail } from "@/types/domain";

export type NormalizedCard = {
  key: string;
  type: TrainingLessonCard["cardType"];
  title: string | null;
  body: string | null;
  keyAction: string | null;
  tryIt: string | null;
  harderPart: string | null;
  hint: string | null;
  finishInstruction: string | null;
  successCopy: string | null;
  notYetCopy: string | null;
  showResultButtons: boolean;
  dbCardId: string | null;
};

const blank = (
  overrides: Partial<NormalizedCard> & Pick<NormalizedCard, "key" | "type">,
): NormalizedCard => ({
  title: null,
  body: null,
  keyAction: null,
  tryIt: null,
  harderPart: null,
  hint: null,
  finishInstruction: null,
  successCopy: null,
  notYetCopy: null,
  showResultButtons: false,
  dbCardId: null,
  ...overrides,
});

export const buildCardSequence = (level: TrainingLevelDetail): NormalizedCard[] => {
  if (level.cards.length > 0) {
    return level.cards.map((card) =>
      blank({
        key: card.cardKey,
        type: card.cardType,
        title: card.title,
        body: card.body,
        keyAction: card.keyAction,
        tryIt: card.tryIt,
        harderPart: card.harderPart,
        finishInstruction: card.finishInstruction,
        successCopy: card.successCopy,
        notYetCopy: card.notYetCopy,
        showResultButtons: card.cardType === "guardian" || card.cardType === "additional_practice",
        dbCardId: card.id,
      }),
    );
  }

  if (level.stageType === "checkpoint" && level.checkpointPolicy) {
    const policy = level.checkpointPolicy;
    return [
      blank({ key: "orient", type: "orient", title: `${level.skill.title} · Checkpoint`, body: policy.entryRule }),
      blank({
        key: "guardian",
        type: "guardian",
        title: "Try it on a normal day",
        tryIt: policy.guardianInstruction,
        successCopy: policy.successCopy,
        notYetCopy: policy.notYetCopy,
        showResultButtons: true,
      }),
      blank({
        key: "completion",
        type: "completion",
        successCopy: policy.successCopy,
        notYetCopy: policy.notYetCopy,
        body: "Course progress is kept either way.",
      }),
    ];
  }

  return [
    blank({ key: "orient", type: "orient", title: level.title, body: level.goal }),
    blank({
      key: "guardian",
      type: "guardian",
      title: "Try it",
      body: level.observableCriterion,
      tryIt: level.firstPart,
      harderPart: level.nextPart ? `Then, only if that went well: ${level.nextPart}` : null,
      hint: level.easierPath,
      successCopy: level.successAnchor,
      showResultButtons: true,
    }),
    blank({
      key: "completion",
      type: "completion",
      successCopy: level.successAnchor,
      body: "Show authoritative Silver and remaining Energy only after settlement.",
    }),
  ];
};

export const findCardIndex = (cards: NormalizedCard[], key: string | null): number => {
  if (!key) return 0;
  const i = cards.findIndex((c) => c.key === key);
  return i === -1 ? 0 : i;
};
