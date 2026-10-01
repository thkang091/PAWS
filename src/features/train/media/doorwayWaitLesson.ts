export type TrainingClipCue = { at: number; text: string };
export type TrainingClipStep = { title: string; cues: readonly TrainingClipCue[] };
export type TrainingClipLesson = {
  id: string;
  levelNumber: number;
  duration: number;
  coverageNote: string;
  steps: readonly TrainingClipStep[];
};

// PAWS action captions, not a transcription of the source audio.
// Times are relative to the exported clips, checked against their visible frames.
export const DOORWAY_WAIT_LESSONS: readonly TrainingClipLesson[] = [
  {
    id: "doorway-wait-l1", levelNumber: 1, duration: 7.566667,
    coverageNote: "Watch the spot-and-reward example. For your practice, use a floor mat and keep the door closed. The small step toward the door is your next practice task.",
    steps: [
      { title: "Find the waiting spot", cues: [
        { at: 0, text: "Guide your dog to the waiting spot." },
        { at: 1.5, text: "Let all four paws settle on the spot." },
      ] },
      { title: "Reward in place", cues: [
        { at: 3, text: "Keep the reward close to the waiting spot." },
        { at: 4, text: "Give the treat while your dog stays there." },
      ] },
      { title: "Finish together", cues: [
        { at: 5.7, text: "Finish the short repetition." },
        { at: 6.5, text: "Move away together; keep the door closed." },
      ] },
    ],
  },
  {
    id: "doorway-wait-l2", levelNumber: 2, duration: 4.466667,
    coverageNote: "A short handle-and-reward example. Practise with a floor mat; the door stays closed.",
    steps: [
      { title: "Reach for the handle", cues: [{ at: 0, text: "Reach toward the handle while your dog waits." }] },
      { title: "Keep the door closed", cues: [{ at: 1, text: "Hold the handle briefly; keep the door closed." }] },
      { title: "Reward the wait", cues: [{ at: 2.8, text: "Bring the reward to your dog on the spot." }] },
    ],
  },
  {
    id: "doorway-wait-l3", levelNumber: 3, duration: 5.466667,
    coverageNote: "Watch a small opening, an in-place reward, then the door closing. This clip does not show the release.",
    steps: [
      { title: "Open a little", cues: [{ at: 0, text: "Open the door just a little while your dog waits." }] },
      { title: "Reward in place", cues: [{ at: 2.4, text: "Reward on the spot while the door is slightly open." }] },
      { title: "Close the door", cues: [{ at: 3.8, text: "Close the door while your dog stays on the spot." }] },
    ],
  },
  {
    id: "doorway-wait-l4", levelNumber: 4, duration: 6.466667,
    coverageNote: "This example shows waiting at an open door. The release and crossing the doorway are not shown.",
    steps: [
      { title: "Open gradually", cues: [{ at: 0, text: "Open the door gradually while your dog waits." }] },
      { title: "Reward the wait", cues: [
        { at: 2, text: "Keep the waiting spot clear as the door opens." },
        { at: 4, text: "Reward your dog on the spot." },
      ] },
      { title: "Close calmly", cues: [{ at: 5.3, text: "Keep your dog on the spot as you close the door." }] },
    ],
  },
  {
    id: "doorway-wait-l5", levelNumber: 5, duration: 7.266667,
    coverageNote: "A leashed dog settles on the waiting spot, waits as the door opens, then leaves with the guardian. Captions describe the practice actions, not the source audio.",
    steps: [
      { title: "Get ready to leave", cues: [
        { at: 0, text: "Guide your leashed dog to the waiting spot." },
        { at: 1.8, text: "Let your dog settle before opening the door." },
      ] },
      { title: "Wait at the open door", cues: [
        { at: 3.2, text: "Open the door while your dog waits." },
        { at: 5.2, text: "Keep the wait until your release cue." },
      ] },
      { title: "Leave together", cues: [{ at: 6.1, text: "Release, then head outside together." }] },
    ],
  },
];

export function getDoorwayWaitLesson(skillCode?: string, stageType?: string, levelNumber?: number | null) {
  if (skillCode !== "1-1" || stageType !== "level") return null;
  return DOORWAY_WAIT_LESSONS.find((lesson) => lesson.levelNumber === levelNumber) ?? null;
}

export function clipCueAt(lesson: TrainingClipLesson, seconds: number) {
  const cues = lesson.steps.flatMap((step, stepIndex) => step.cues.map((cue) => ({ ...cue, stepIndex })));
  return cues.reduce((active, cue) => cue.at <= seconds ? cue : active, cues[0]);
}

export function stepPlaybackRange(lesson: TrainingClipLesson, stepIndex: number) {
  const step = lesson.steps[stepIndex];
  if (!step) return null;
  return { start: step.cues[0].at, end: lesson.steps[stepIndex + 1]?.cues[0].at ?? lesson.duration };
}
