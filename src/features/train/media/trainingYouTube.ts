import section1 from "./section1YouTube.generated.json";
import sections2to6 from "./sections2to6YouTube.generated.json";
import { focusSegments, TRAINING_CLIP_FOCUS } from "./trainingClipFocus";

export type YouTubeSegment = {
  videoId: string;
  channel: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  clipStartSeconds?: number;
  clipEndSeconds?: number;
};

// Source-video time, NOT the screen-recording times in the historical manifest.
// L1–4 were matched against original frames; see docs/train-youtube-pilot.md.
const doorwayRanges: Record<number, readonly [number, number]> = {
  1: [56.733333, 64.3],
  2: [116.6, 121.066667],
  3: [175.933333, 181.4],
  4: [163.133333, 169.6],
  5: [181.85, 189.15],
};

const doorwaySegments: Record<number, YouTubeSegment> = Object.fromEntries(
  Object.entries(doorwayRanges).map(([level, [startSeconds, endSeconds]]) => [level, {
    videoId: "s0gz8sOZsWw", channel: "Pupford",
    title: "How to STOP Your Dog From Running Out the Front Door",
    startSeconds, endSeconds,
  }]),
);

export function getTrainingYouTubeSegment(skillCode?: string, level?: number | null) {
  return getTrainingYouTubeSegments(skillCode, level)[0] ?? null;
}

const courses: Readonly<Record<string, Readonly<Record<number, readonly YouTubeSegment[]>>>> = {
  "1-1": Object.fromEntries(Object.entries(doorwaySegments).map(([level, segment]) => [level, [segment]])),
  ...section1,
  ...sections2to6,
};
const focusedCourses = Object.fromEntries(Object.entries(courses).map(([skill, levels]) => [skill,
  Object.fromEntries(Object.entries(levels).map(([level, segments]) => [level,
    focusSegments(segments, TRAINING_CLIP_FOCUS[skill]?.[Number(level)]),
  ])),
]));
const empty: readonly YouTubeSegment[] = [];
export function getTrainingYouTubeSegments(skillCode?: string, level?: number | null): readonly YouTubeSegment[] {
  return skillCode && level ? focusedCourses[skillCode]?.[level] ?? empty : empty;
}

export function getOriginalTrainingYouTubeSegments(skillCode?: string, level?: number | null): readonly YouTubeSegment[] {
  return skillCode && level ? courses[skillCode]?.[level] ?? empty : empty;
}

export function youtubeSegmentIndexAt(segments: readonly YouTubeSegment[], time: number) {
  const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0;
  return segments.reduce((index, segment, next) => (segment.clipStartSeconds ?? 0) <= safeTime ? next : index, 0);
}

export function youtubeSourceTime(segment: YouTubeSegment, localTime: number) {
  const safeTime = Number.isFinite(localTime) ? localTime : 0;
  return Math.min(segment.endSeconds - 0.05, Math.max(segment.startSeconds, segment.startSeconds + safeTime - (segment.clipStartSeconds ?? 0)));
}

export function youtubeLocalTime(segment: YouTubeSegment, sourceTime: number) {
  const start = segment.clipStartSeconds ?? 0;
  if (!Number.isFinite(sourceTime)) return start;
  // An ended example must not highlight the next example before it is opened.
  const duration = Math.min(segment.endSeconds - segment.startSeconds,
    segment.clipEndSeconds === undefined ? Infinity : segment.clipEndSeconds - start - 0.001);
  return start + Math.max(0, Math.min(duration, sourceTime - segment.startSeconds));
}

export function youtubeWatchUrl(segment: YouTubeSegment) {
  return `https://www.youtube.com/watch?v=${segment.videoId}&t=${Math.floor(segment.startSeconds)}s`;
}
