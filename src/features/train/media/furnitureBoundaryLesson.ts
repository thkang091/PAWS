import type { TrainingClipLesson } from "./doorwayWaitLesson";

// Captions describe the visible actions, not the source narration. These are
// partial examples: they do not demonstrate every practice goal in the Level.
export const FURNITURE_BOUNDARY_LESSONS: readonly TrainingClipLesson[] = [
  {
    id: "furniture-boundary-l1", levelNumber: 1, duration: 7.7,
    coverageNote: "Floor waiting and reward only. Moving onto a designated resting spot and staying during a step toward the furniture are not shown.",
    steps: [
      { title: "Wait beside the furniture", cues: [
        { at: 0, text: "Let your dog wait on the floor beside the sofa." },
        { at: 1.8, text: "Keep the repetition short while your dog waits." },
      ] },
      { title: "Return to your dog", cues: [
        { at: 4, text: "Keep your dog on the floor as you return." },
        { at: 6.4, text: "Bring the reward to your dog." },
      ] },
      { title: "Reward the wait", cues: [{ at: 7.1, text: "Reward your dog for waiting beside the sofa." }] },
    ],
  },
  {
    id: "furniture-boundary-l2", levelNumber: 2, duration: 4.966667,
    coverageNote: "A sofa-directed gesture followed by reward. Walking to and touching the furniture is not demonstrated; some paws are outside the source frame.",
    steps: [
      { title: "Move toward the sofa", cues: [{ at: 0, text: "Move your hand toward the sofa while your dog waits." }] },
      { title: "Return your hand", cues: [{ at: 2.5, text: "Bring your hand back toward your dog." }] },
      { title: "Reward on the floor", cues: [{ at: 3.9, text: "Reward your dog while they stay on the floor." }] },
    ],
  },
  {
    id: "furniture-boundary-l3", levelNumber: 3, duration: 6.2,
    coverageNote: "One sit, stand, return and reward repetition. Entry onto a designated mat and a release are not shown. Lying down is not an added success condition.",
    steps: [
      { title: "Move to the sofa", cues: [{ at: 0, text: "Move toward the sofa while your dog stays on the floor." }] },
      { title: "Sit briefly", cues: [{ at: 2.5, text: "Sit briefly while your dog waits nearby." }] },
      { title: "Return and reward", cues: [
        { at: 4, text: "Stand up and return to your dog." },
        { at: 5, text: "Reward your dog on the floor." },
      ] },
    ],
  },
  {
    id: "furniture-boundary-l4", levelNumber: 4, duration: 19.633333,
    coverageNote: "A dog waits on a floor bed while the guardian drinks at the table, then the guardian returns and rewards in place.",
    steps: [
      { title: "Keep a quiet routine", cues: [
        { at: 0, text: "Let your dog rest on the bed beside the furniture." },
        { at: 2, text: "Take a sip while your dog waits on the bed." },
        { at: 8.5, text: "Put the cup down and keep the routine calm." },
      ] },
      { title: "Return to the resting spot", cues: [
        { at: 11, text: "Stand up while your dog stays on the bed." },
        { at: 13.5, text: "Walk back to your dog." },
      ] },
      { title: "Reward in place", cues: [{ at: 16, text: "Give the reward on the bed for waiting." }] },
    ],
  },
  {
    id: "furniture-boundary-l5", levelNumber: 5, duration: 15.7,
    coverageNote: "The dog moves onto a floor bed and waits while the guardian moves to nearby furniture and returns. This illustrates the resting-spot rule; the footage does not establish a move between two separate rooms.",
    steps: [
      { title: "Choose the resting spot", cues: [
        { at: 0, text: "Let your dog move toward the floor-level bed." },
        { at: 1.8, text: "Give your dog time to step onto the bed." },
        { at: 4.2, text: "Wait for your dog to settle on the spot." },
      ] },
      { title: "Move beside the furniture", cues: [
        { at: 6.5, text: "Move toward the furniture while your dog stays." },
        { at: 9, text: "Pause beside the furniture as your dog waits." },
      ] },
      { title: "Return to your dog", cues: [{ at: 12.5, text: "Return beside your dog to finish the short repetition." }] },
    ],
  },
];
