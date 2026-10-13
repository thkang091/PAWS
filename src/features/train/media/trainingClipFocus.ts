import plans from "./trainingClipFocus.json";
import type { TrainingClipLesson } from "./doorwayWaitLesson";
import type { YouTubeSegment } from "./trainingYouTube";

export type ClipFocus = {
  groups: readonly (readonly number[])[];
  reason?: string;
  captions?: Readonly<Record<string, string>>;
  stepTitles?: Readonly<Record<string, string>>;
  coverageNote?: string;
};

export const TRAINING_CLIP_FOCUS: Readonly<Record<string, Readonly<Record<number, ClipFocus>>>> = plans;
const rounded = (seconds: number) => Math.round(seconds * 1e6) / 1e6;

// Keep the acquired/source mappings immutable for provenance and saved reviews.
// Each group is one continuous interval; joining across a gap is not permitted.
export function focusSegments(original: readonly YouTubeSegment[], focus?: ClipFocus) {
  if (!focus) return original;
  let cursor = 0;
  return focus.groups.map(indices => {
    const parts = indices.map(index => original[index]);
    if (!parts.length || parts.some(part => !part)) throw new Error("Missing focus source");
    parts.forEach((part, index) => {
      if (index && (part.videoId !== parts[index - 1].videoId || Math.abs(part.startSeconds - parts[index - 1].endSeconds) > 0.00001)) {
        throw new Error("Focus groups must be contiguous in the same original video");
      }
    });
    const first = parts[0], endSeconds = parts[parts.length - 1].endSeconds;
    const clipStartSeconds = cursor;
    cursor = rounded(cursor + endSeconds - first.startSeconds);
    return { ...first, endSeconds, clipStartSeconds, clipEndSeconds: cursor };
  });
}

export function focusLesson(lesson: TrainingClipLesson, original: readonly YouTubeSegment[], focus?: ClipFocus): TrainingClipLesson {
  if (!focus) return lesson;
  const segments = focusSegments(original, focus);
  const flat = lesson.steps.flatMap((step, stepIndex) => step.cues.map(cue => ({ cue, step, stepIndex })));
  const selected = new Map(focus.groups.flatMap((indices, group) => indices.map(index => [index, group] as const)));
  const steps = lesson.steps.flatMap((step, stepIndex) => {
    const cues = flat.flatMap(({ cue, stepIndex: owner }, reviewIndex) => {
      if (owner !== stepIndex) return [];
      const sourceIndex = original.reduce((last, part, index) => (part.clipStartSeconds ?? 0) <= cue.at ? index : last, 0);
      const group = selected.get(sourceIndex);
      if (group === undefined) return [];
      const source = original[sourceIndex], target = segments[group];
      const sourceTime = source.startSeconds + cue.at - (source.clipStartSeconds ?? 0);
      return [{ ...cue, text: focus.captions?.[reviewIndex] ?? cue.text,
        at: rounded(target.clipStartSeconds! + sourceTime - target.startSeconds),
        reviewIndex, reviewAt: cue.at }];
    });
    return cues.length ? [{ title: focus.stepTitles?.[stepIndex] ?? step.title, cues }] : [];
  });
  return { ...lesson, duration: segments[segments.length - 1].clipEndSeconds!, steps,
    coverageNote: focus.coverageNote ?? lesson.coverageNote };
}
