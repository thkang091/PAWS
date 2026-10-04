const vm = require("node:vm");
import { DOORWAY_WAIT_LESSONS } from "../features/train/media/doorwayWaitLesson";
import { getTrainingYouTubeSegment, getTrainingYouTubeSegments, youtubeSegmentIndexAt, youtubeLocalTime, youtubeSourceTime, youtubeWatchUrl } from "../features/train/media/trainingYouTube";
import { getTrainingClipLessons } from "../features/train/media/trainingClipLessons";
import { parseYouTubeEvent, youtubePlayerHtml } from "../features/train/media/youtubePlayerHtml";

describe("1-1 original YouTube ranges", () => {
  test("all five levels resolve to the original, with existing cue timing retained", () => {
    for (const lesson of DOORWAY_WAIT_LESSONS) {
      const segment = getTrainingYouTubeSegment("1-1", lesson.levelNumber)!;
      expect(segment.videoId).toBe("s0gz8sOZsWw");
      expect(Math.abs(segment.endSeconds - segment.startSeconds - lesson.duration)).toBeLessThan(0.04);
      for (const step of lesson.steps) for (const cue of step.cues) {
        expect(youtubeLocalTime(segment, youtubeSourceTime(segment, cue.at))).toBeCloseTo(cue.at, 5);
      }
    }
    expect(getTrainingYouTubeSegment("1-2", 1)?.videoId).toBe("5kstTBK0ks8");
    expect(getTrainingYouTubeSegment("6-5", 5)).toBeNull();
    expect(getTrainingYouTubeSegment("1-1", 6)).toBeNull();
    expect(getTrainingYouTubeSegment("1-1", null)).toBeNull();
  });
  test("clamps out-of-range and non-finite cue times", () => {
    const segment = getTrainingYouTubeSegment("1-1", 3)!;
    expect(youtubeSourceTime(segment, -10)).toBe(segment.startSeconds);
    expect(youtubeSourceTime(segment, NaN)).toBe(segment.startSeconds);
    expect(youtubeSourceTime(segment, 900)).toBeLessThan(segment.endSeconds);
    expect(youtubeLocalTime(segment, 0)).toBe(0);
    expect(youtubeLocalTime(segment, 999)).toBe(segment.endSeconds - segment.startSeconds);
    expect(youtubeWatchUrl(segment)).toBe("https://www.youtube.com/watch?v=s0gz8sOZsWw&t=175s");
  });
});

describe("Section 1 montage conversion", () => {
  test.each(["1-1", "1-2", "1-3", "1-4", "1-5"])("%s covers each level and every cue without gaps or lost examples", skill => {
    const lessons = getTrainingClipLessons(skill);
    expect(lessons).toHaveLength(5);
    for (const lesson of lessons) {
      const parts = getTrainingYouTubeSegments(skill, lesson.levelNumber);
      expect(parts.length).toBeGreaterThan(0);
      let end = 0;
      parts.forEach((part, index) => {
        expect(part.videoId).toMatch(/^[\w-]{11}$/);
        expect(part.startSeconds).toBeGreaterThanOrEqual(0);
        expect(part.endSeconds).toBeGreaterThan(part.startSeconds);
        expect(part.clipStartSeconds ?? 0).toBeCloseTo(end, 5);
        expect(youtubeSegmentIndexAt(parts, part.clipStartSeconds ?? 0)).toBe(index);
        end = part.clipEndSeconds ?? part.endSeconds - part.startSeconds;
        expect(Math.abs((end - (part.clipStartSeconds ?? 0)) - (part.endSeconds - part.startSeconds))).toBeLessThan(0.04);
      });
      // Historical exports round the final video/AAC packet to a 30fps frame.
      expect(Math.abs(end - lesson.duration)).toBeLessThan(0.04);
      for (const step of lesson.steps) for (const cue of step.cues) {
        const part = parts[youtubeSegmentIndexAt(parts, cue.at)];
        expect(cue.at).toBeLessThan(part.clipEndSeconds ?? lesson.duration);
        expect(youtubeLocalTime(part, youtubeSourceTime(part, cue.at))).toBeCloseTo(cue.at, 4);
      }
    }
  });
  test("source switches map later cues and review positions into their own original", () => {
    const parts = getTrainingYouTubeSegments("1-5", 1);
    expect(parts.map(part => part.videoId)).toEqual(["yr1olzgidMw", "4wBApkKuEVI", "RsqdKr_vzJY", "U2c5EkytNU0"]);
    const later = parts[2];
    const reviewAt = later.clipStartSeconds! + 1;
    expect(youtubeSegmentIndexAt(parts, reviewAt)).toBe(2);
    expect(youtubeSourceTime(later, reviewAt)).toBe(43);
    expect(youtubeLocalTime(later, 43)).toBe(reviewAt);
  });
});

test("bridge ignores unrelated or malformed messages", () => {
  for (const raw of ["bad json", "null", '{"type":"ready"}', '{"channel":"paws-youtube","type":"time","seconds":"3","state":1}']) expect(parseYouTubeEvent(raw)).toBeNull();
  expect(parseYouTubeEvent('{"channel":"paws-youtube","type":"error","code":153}')).toEqual({ type: "error", code: 153 });
  expect(parseYouTubeEvent('{"channel":"paws-youtube","type":"rate","rate":0.75}')).toEqual({ type: "rate", rate: 0.75 });
  expect(parseYouTubeEvent('{"channel":"paws-youtube","type":"rate","rate":0}')).toBeNull();
  expect(parseYouTubeEvent('{"channel":"paws-youtube","type":"ended"}')).toEqual({ type: "ended" });
});

test.each([false, true])("document with controls=%s preserves cue position, selected rate, end and pause", (showControls) => {
  const segment = getTrainingYouTubeSegment("1-1", 2)!;
  const html = youtubePlayerHtml(segment, "https://com.tminjae1124.paws", segment.startSeconds + 1,
    showControls ? { showControls, playbackRate: 0.75 } : undefined);
  const expectedRate = showControls ? 0.75 : 0.5;
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
  const player = { cueVideoById: jest.fn(), loadVideoById: jest.fn(), pauseVideo: jest.fn(), destroy: jest.fn(), getCurrentTime: () => 118, getPlayerState: () => 1, getAvailablePlaybackRates: () => [0.25, 0.5, 0.75, 1, 1.5, 2], setPlaybackRate: jest.fn() };
  const events: Record<string, () => void> = {};
  let options: any;
  let tick: () => void = () => {};
  const window: any = { ReactNativeWebView: { postMessage: jest.fn() }, addEventListener: (name: string, fn: () => void) => { events[name] = fn; } };
  const document = { hidden: true, addEventListener: (name: string, fn: () => void) => { events[name] = fn; } };
  const context = vm.createContext({ window, document, setInterval: (fn: () => void) => { tick = fn; return 1; }, clearInterval: jest.fn(), YT: { Player: function (_id: string, value: unknown) { options = value; return player; } } });
  vm.runInContext(script, context);
  expect(vm.runInContext("closestRate([0.25,0.5,0.75,1,2],0.6)", context)).toBe(0.5);
  expect(vm.runInContext("closestRate([0.5,0.6,1],0.6)", context)).toBe(0.6);
  expect(vm.runInContext("closestRate([1],0.6)", context)).toBe(1);
  expect(vm.runInContext("closestRate([],0.6)", context)).toBe(1);
  window.onYouTubeIframeAPIReady();
  expect(options.playerVars).toMatchObject({ controls: showControls ? 1 : 0, fs: showControls ? 1 : 0, iv_load_policy: 3, autoplay: 0, playsinline: 1 });
  expect(options.playerVars.cc_load_policy).toBeUndefined();
  options.events.onReady();
  expect(player.cueVideoById).toHaveBeenCalledWith({ videoId: segment.videoId, startSeconds: segment.startSeconds + 1, endSeconds: segment.endSeconds });
  expect(player.loadVideoById).not.toHaveBeenCalled();
  options.events.onStateChange({ data: 5 });
  expect(player.setPlaybackRate).toHaveBeenLastCalledWith(expectedRate);
  window.pawsYouTubeCommand({ type: "play", at: 118 });
  expect(player.loadVideoById).toHaveBeenLastCalledWith({ videoId: segment.videoId, startSeconds: 118, endSeconds: segment.endSeconds });
  options.events.onStateChange({ data: 1 });
  expect(player.setPlaybackRate).toHaveBeenLastCalledWith(expectedRate);
  options.events.onPlaybackRateChange({ data: 0.75 });
  window.pawsYouTubeCommand({ type: "play", at: -1 });
  expect(player.loadVideoById).toHaveBeenLastCalledWith({ videoId: segment.videoId, startSeconds: segment.startSeconds, endSeconds: segment.endSeconds });
  options.events.onStateChange({ data: 1 });
  expect(player.setPlaybackRate).toHaveBeenLastCalledWith(0.75);
  tick();
  expect(parseYouTubeEvent(window.ReactNativeWebView.postMessage.mock.calls.at(-1)[0])).toEqual({ type: "time", seconds: 118, state: 1 });
  const endedCount = () => window.ReactNativeWebView.postMessage.mock.calls.filter(
    ([message]: [string]) => parseYouTubeEvent(message)?.type === "ended").length;
  options.events.onStateChange({ data: 0 });
  options.events.onStateChange({ data: 0 });
  expect(endedCount()).toBe(1);
  // Loading a different range can emit ENDED for the old one. That must not
  // skip the range just requested by a caption or by automatic continuation.
  window.pawsYouTubeCommand({ type: "play", at: segment.startSeconds });
  options.events.onStateChange({ data: 0 });
  options.events.onStateChange({ data: 5 });
  options.events.onStateChange({ data: 0 });
  expect(endedCount()).toBe(1);
  options.events.onStateChange({ data: 1 });
  window.pawsYouTubeCommand({ type: "pause" });
  options.events.onStateChange({ data: 0 });
  expect(endedCount()).toBe(1);
  options.events.onStateChange({ data: 1 });
  events.visibilitychange();
  expect(player.pauseVideo).toHaveBeenCalled();
  options.events.onStateChange({ data: 0 });
  expect(endedCount()).toBe(1);
  options.events.onStateChange({ data: 1 });
  options.events.onStateChange({ data: 0 });
  expect(endedCount()).toBe(2);
  events.pagehide();
  expect(player.destroy).not.toHaveBeenCalled();
});
