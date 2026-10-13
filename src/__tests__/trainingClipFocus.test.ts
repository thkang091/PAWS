import { focusSegments, TRAINING_CLIP_FOCUS } from '../features/train/media/trainingClipFocus';
import { getTrainingClipLessons, getTrainingReviewClip } from '../features/train/media/trainingClipLessons';
import { getOriginalTrainingYouTubeSegments, getTrainingYouTubeSegments, youtubeSegmentIndexAt, youtubeSourceTime } from '../features/train/media/trainingYouTube';
import { makeRefresherQuestion } from '../features/train/rounds/refresherQuestion';

const codes = [1, 2, 3, 4, 5, 6].flatMap(section =>
  Array.from({length: section === 5 ? 3 : 5}, (_, i) => `${section}-${i + 1}`));

test('all 140 levels use at most two intervals; only the 14 crowded levels change', () => {
  let changed = 0, count = 0;
  for (const code of codes) for (const lesson of getTrainingClipLessons(code)) {
    const original = getOriginalTrainingYouTubeSegments(code, lesson.levelNumber);
    const parts = getTrainingYouTubeSegments(code, lesson.levelNumber);
    expect(parts.length).toBeGreaterThanOrEqual(1);
    expect(parts.length).toBeLessThanOrEqual(2);
    expect(new Set(parts.map(part => part.videoId)).size).toBeLessThanOrEqual(2);
    if (TRAINING_CLIP_FOCUS[code]?.[lesson.levelNumber]) {
      expect(original.length).toBeGreaterThan(2);
      expect(lesson.duration).toBeLessThan(original.at(-1)!.clipEndSeconds!);
      changed++;
    } else expect(parts).toBe(original);
    const cues = lesson.steps.flatMap(step => step.cues);
    expect(cues[0].at).toBe(0);
    expect(cues.map(cue => cue.at)).toEqual(cues.map(cue => cue.at).sort((a, b) => a - b));
    count++;
  }
  expect(count).toBe(140);
  expect(changed).toBe(14);
});

test('contiguous examples merge without skipped or repeated source frames', () => {
  expect(getTrainingYouTubeSegments('1-4', 5)).toMatchObject([
    {videoId: 'gZ0XEr4DGfs', startSeconds: 203.65, endSeconds: 219.65, clipStartSeconds: 0, clipEndSeconds: 16},
  ]);
  expect(getTrainingYouTubeSegments('1-5', 3)).toMatchObject([
    {videoId: 'U2c5EkytNU0', startSeconds: 175.2, endSeconds: 189.2, clipEndSeconds: 14},
  ]);
  const original = getOriginalTrainingYouTubeSegments('1-5', 1);
  expect(() => focusSegments(original, {groups: [[0, 1]]})).toThrow(/contiguous/);
  expect(() => focusSegments([original[0], {...original[0], startSeconds: 100}], {groups: [[0, 1]]})).toThrow(/contiguous/);
  expect(() => focusSegments(original, {groups: [[10]]})).toThrow(/Missing/);
});

test('retimed help keeps the historical concept identity and source clock', () => {
  const lesson = getTrainingClipLessons('1-5')[1];
  const question = makeRefresherQuestion('1-5', 'Quiet', lesson, 0);
  expect(question).toMatchObject({id: 'caption-v1:1-5:2:2', concept: '1-5:2:2', cueAt: 3.366667});
  expect(question.explanation).toBe('Say the quiet cue once, then wait.');
  const review = getTrainingReviewClip('1-5', 2, question.cueAt!)!;
  expect(review.segments).toHaveLength(1);
  expect(review.at).toBe(0);
  expect(youtubeSourceTime(review.segments[0], review.at)).toBe(105);
});

test('a saved question about a removed example still opens that exact single example', () => {
  const review = getTrainingReviewClip('1-5', 1, 6.5)!;
  expect(review.segments).toHaveLength(1);
  expect(review.segments[0].videoId).toBe('4wBApkKuEVI');
  expect(review.at).toBe(2);
  expect(youtubeSourceTime(review.segments[0], review.at)).toBeCloseTo(957.7, 5);
  expect(getTrainingYouTubeSegments('1-5', 1).some(part => part.videoId === review.segments[0].videoId)).toBe(false);
});

test('every current cue and its saved review seek the identical frame', () => {
  for (const code of codes) for (const lesson of getTrainingClipLessons(code)) {
    const parts = getTrainingYouTubeSegments(code, lesson.levelNumber);
    for (const step of lesson.steps) for (const cue of step.cues) {
      const q = makeRefresherQuestion(code, 'Lesson', lesson, cue.at);
      const review = getTrainingReviewClip(code, lesson.levelNumber, q.cueAt!)!;
      const part = parts[youtubeSegmentIndexAt(parts, cue.at)];
      expect(review.segments[0].videoId).toBe(part.videoId);
      expect(youtubeSourceTime(review.segments[0], review.at)).toBeCloseTo(youtubeSourceTime(part, cue.at), 5);
    }
  }
});

test('database caption seed matches the live quiz identities, wording and review clock', () => {
  const { captions } = require('../../scripts/training-review-caption-seed.cjs');
  expect(captions).toHaveLength(650);
  const keys = new Set(captions.map((row: any[]) => row.slice(0, 3).join(':')));
  expect(keys.size).toBe(captions.length);
  for (const code of codes) for (const lesson of getTrainingClipLessons(code)) {
    expect(captions.filter((row: any[]) => row[0] === code && row[1] === lesson.levelNumber).length).toBeGreaterThanOrEqual(2);
    for (const step of lesson.steps) for (const cue of step.cues) {
      const q = makeRefresherQuestion(code, 'Lesson', lesson, cue.at);
      expect(captions).toContainEqual([code, lesson.levelNumber, Number(q.concept.split(':')[2]), step.title, cue.text, q.cueAt]);
    }
  }
});
