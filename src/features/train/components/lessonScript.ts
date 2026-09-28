export type LessonCue = {
  at: number;
  text: string;
};

export type ScriptStep = {
  title: string;
  cues: readonly LessonCue[];
};

export type LessonScript = {
  duration: number;
  steps: readonly ScriptStep[];
};

export const SOCIALIZATION_SCRIPT: LessonScript = {
  duration: 78,
  steps: [
    {
      title: "Pick a quiet spot",
      cues: [
        { at: 0, text: "Start somewhere your dog already knows." },
        { at: 5, text: "Stand back far enough that people register but nobody stares." },
        { at: 10, text: "If the tail stops moving, you are too close." },
      ],
    },
    {
      title: "Introduce gradually",
      cues: [
        { at: 15, text: "Let them watch from where they are comfortable." },
        { at: 21, text: "Close the gap by a step or two, then wait." },
        { at: 26, text: "Several short sessions beat one long one." },
      ],
    },
    {
      title: "Reward the calm",
      cues: [
        { at: 31, text: "Mark the moment they settle." },
        { at: 36, text: "A treat, a word, or a quick game. Whatever they work for." },
        { at: 42, text: "Rewarding late teaches the wrong second." },
      ],
    },
    {
      title: "Read the early signs",
      cues: [
        { at: 47, text: "Lip licking. Turning away. A stiff, high tail." },
        { at: 53, text: "Back off at the first one." },
        { at: 57, text: "Ending early keeps the whole session positive." },
      ],
    },
    {
      title: "Finish while it is going well",
      cues: [
        { at: 63, text: "Stop on a good greeting." },
        { at: 68, text: "Do not push for one more." },
        { at: 72, text: "That last moment is the one they remember." },
      ],
    },
  ],
};

export type FlatCue = LessonCue & { step: number; cue: number };

export const flattenCues = (script: LessonScript): readonly FlatCue[] =>
  script.steps.flatMap((step, stepIndex) =>
    step.cues.map((cue, cueIndex) => ({ ...cue, step: stepIndex, cue: cueIndex })),
  );

export const cueIndexAt = (cues: readonly FlatCue[], time: number) => {
  let index = 0;
  for (let i = 0; i < cues.length; i += 1) {
    if (cues[i].at <= time) index = i;
    else break;
  }
  return index;
};
