import type { TrainingClipLesson } from "../media/doorwayWaitLesson";
import type { RoundQuestion } from "@/services/trainingRoundService";

// Review the exact instructional moment where Help was opened. These are action
// captions already reviewed with the curriculum, never transcribed chat text.
// Distractors are short, plausible mistakes; they are never shown as advice.
const mistakes = [
  ["Repeat the cue several times before giving them a chance.", "Move on to a harder setup straight away."],
  ["Keep repeating the whole exercise without a reset.", "Wait until the full exercise is perfect before rewarding."],
  ["Add more distractions to test them immediately.", "Rush through this step to finish the session."],
] as const;

export function makeRefresherQuestion(skillCode: string, title: string, lesson: TrainingClipLesson, at: number): RoundQuestion {
  const cues = lesson.steps.flatMap(step => step.cues.map(cue => ({ ...cue, title: step.title })));
  const index = cues.reduce((last, cue, position) => cue.at <= at ? position : last, 0);
  const cue = cues[index];
  if (!cue) throw new Error("This clip has no reviewable instructions.");
  const concept = `${skillCode}:${lesson.levelNumber}:${index}`;
  const wrong = mistakes[(lesson.levelNumber + index) % mistakes.length];
  const labels = [cue.text, ...wrong];
  // Rotate correct positions; correctness is not inferred from option order.
  const rotation = (lesson.levelNumber + index) % 3;
  const options = labels.map((label, position) => ({ id: String(position), label }));
  return {
    id: `caption-v1:${concept}`, skillCode, lessonTitle: title, level: lesson.levelNumber,
    concept, prompt: `For “${cue.title}”, which action matches the demonstration?`,
    options: [...options.slice(rotation), ...options.slice(0, rotation)], correctOptionId: "0",
    explanation: cue.text, cueAt: cue.at,
  };
}
