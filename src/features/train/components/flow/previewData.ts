import type { TrainingReviewQuestion } from "./TrainingReviewQuiz";

// Preview fixtures only. These are not a published question bank or dog records.
export const PREVIEW_LESSON = { code: "1-1", title: "Wait at the Door" };
export const PREVIEW_QUESTIONS: readonly TrainingReviewQuestion[] = [
  {
    id: "reward", lessonTitle: PREVIEW_LESSON.title, level: 1, concept: "Reward in place", cueAt: 3,
    prompt: "Your dog is waiting on the spot. Where should you give the treat?",
    options: [
      { id: "spot", label: "Bring the treat to the waiting spot." },
      { id: "outside", label: "Hold the treat outside the door." },
      { id: "away", label: "Call your dog away to get the treat." },
    ],
    correctOptionId: "spot", explanation: "Bring the reward to your dog so they can stay on the waiting spot.",
  },
  {
    id: "movement", lessonTitle: PREVIEW_LESSON.title, level: 2, concept: "Make it easier", cueAt: 0,
    prompt: "Your dog steps forward as you reach for the handle. What should you try next?",
    options: [
      { id: "open", label: "Open the door a little wider." },
      { id: "smaller", label: "Make a smaller movement toward the handle." },
      { id: "faster", label: "Reach for the handle more quickly." },
    ],
    correctOptionId: "smaller", explanation: "Keep the door closed and make the movement smaller so waiting is easier.",
  },
  {
    id: "timing", lessonTitle: PREVIEW_LESSON.title, level: 2, concept: "Reward timing", cueAt: 2.8,
    prompt: "You reach for the handle and your dog stays put. When do you reward?",
    options: [
      { id: "leaves", label: "After your dog walks off the spot." },
      { id: "now", label: "While your dog is still waiting on the spot." },
      { id: "outside", label: "Once you are both outside." },
    ],
    correctOptionId: "now", explanation: "Reward while your dog is waiting, so the reward matches the action you want.",
  },
];
