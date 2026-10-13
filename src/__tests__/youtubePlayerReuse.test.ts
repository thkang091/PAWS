const { runInNewContext } = require("node:vm");
import { getOriginalTrainingYouTubeSegments as getTrainingYouTubeSegments, type YouTubeSegment } from "../features/train/media/trainingYouTube";
import { parseYouTubeEvent, youtubePlayerHtml, type YouTubeEvent } from "../features/train/media/youtubePlayerHtml";

function controller(segment: YouTubeSegment, muted?: boolean) {
  const source = { id: segment.videoId, time: segment.startSeconds, muted: false, state: 5 };
  let handlers: any;
  let tick: () => void;
  const listeners: Record<string, () => void> = {};
  const player = {
    cueVideoById: jest.fn(), loadVideoById: jest.fn(), pauseVideo: jest.fn(), playVideo: jest.fn(),
    mute: jest.fn(() => { source.muted = true; }), unMute: jest.fn(() => { source.muted = false; }),
    isMuted: () => source.muted, getCurrentTime: () => source.time,
    getVideoUrl: jest.fn((): string | undefined => `https://www.youtube.com/watch?v=${source.id}`),
    getPlayerState: () => source.state,
    getAvailablePlaybackRates: () => [0.25, 0.5, 0.75, 1, 1.5, 2], setPlaybackRate: jest.fn(),
  };
  const Player = jest.fn(function (_id, options) { handlers = options.events; return player; });
  const window: any = { ReactNativeWebView: { postMessage: jest.fn() }, addEventListener: jest.fn() };
  const document = { hidden: false, addEventListener: (name: string, fn: () => void) => { listeners[name] = fn; } };
  const html = youtubePlayerHtml(segment, "https://com.tminjae1124.paws", segment.startSeconds, { muted });
  runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)![1], {
    window, document, YT: { Player }, setInterval: (fn: () => void) => { tick = fn; return 1; }, clearInterval: jest.fn(),
  });
  window.onYouTubeIframeAPIReady(); handlers.onReady();
  const state = (value: number) => { source.state = value; handlers.onStateChange({ data: value }); };
  const messages = (): YouTubeEvent[] => window.ReactNativeWebView.postMessage.mock.calls.map(([raw]: [string]) => parseYouTubeEvent(raw)!);
  return { source, player, Player, state, document, listeners, messages, tick: () => tick(),
    command: (value: unknown) => window.pawsYouTubeCommand(value), rate: (value: number) => handlers.onPlaybackRateChange({ data: value }) };
}

test("the historical four-source fixture uses one player and retains mute, speed, and end boundaries", () => {
  const parts = getTrainingYouTubeSegments("1-5", 1);
  const c = controller(parts[0]);
  c.source.time = 0; // The initial CUED thumbnail can report zero.
  c.state(5);
  expect(c.messages()).toContainEqual({ type: "ready", request: 0 });
  expect(c.player.mute.mock.invocationCallOrder[0]).toBeLessThan(c.player.cueVideoById.mock.invocationCallOrder[0]);
  for (const [index, part] of parts.entries()) {
    const request = index + 1;
    c.command({ sequence: request, type: "play", at: part.startSeconds, segment: part });
    c.state(0); // A late ENDED from the old source must not skip the new one.
    expect(c.messages().filter(message => message.type === "ended")).toHaveLength(index);
    Object.assign(c.source, { id: part.videoId, time: part.startSeconds });
    c.state(1); c.tick();
    expect(c.messages()).toContainEqual({ type: "ready", request });
    expect(c.player.loadVideoById).toHaveBeenLastCalledWith({ videoId: part.videoId, startSeconds: part.startSeconds, endSeconds: part.endSeconds });
    expect(c.player.setPlaybackRate).toHaveBeenLastCalledWith(0.5);
    expect(c.source.muted).toBe(true);
    c.source.time = part.endSeconds; c.state(0); c.state(0);
    expect(c.messages().filter(message => message.type === "ended")).toHaveLength(index + 1);
  }
  expect(c.Player).toHaveBeenCalledTimes(1);
  expect(c.player.cueVideoById).toHaveBeenCalledTimes(1);
  expect(c.player.loadVideoById).toHaveBeenCalledTimes(4);
  expect(c.player.mute).toHaveBeenCalledTimes(1);
});

test("rapid source changes suppress old times and correlate current playback with its request", () => {
  const [first, second, third] = getTrainingYouTubeSegments("1-5", 1);
  const c = controller(first); c.state(5);
  c.command({ sequence: 1, type: "play", at: second.startSeconds, segment: second });
  c.command({ sequence: 2, type: "play", at: third.startSeconds + 1, segment: third });
  Object.assign(c.source, { id: second.videoId, time: second.startSeconds + 1 });
  const before = c.messages().length;
  c.state(1); c.tick(); c.state(0);
  expect(c.messages()).toHaveLength(before);
  Object.assign(c.source, { id: third.videoId, time: third.startSeconds + 1 });
  c.state(1); c.tick();
  expect(c.messages()).toContainEqual({ type: "time", seconds: third.startSeconds + 1, state: 1, request: 2 });
  // Same original, different interval: an old timestamp is ignored too.
  const next = { ...third, startSeconds: 75, endSeconds: 78.35 };
  c.command({ sequence: 3, type: "play", at: 75, segment: next });
  const switching = c.messages().length;
  c.state(1); c.tick(); c.state(0);
  expect(c.messages()).toHaveLength(switching);
  c.source.time = 75.2; c.state(1); c.tick();
  expect(c.messages()).toContainEqual({ type: "time", seconds: 75.2, state: 1, request: 3 });
});

test("viewer unmute and speed choices survive source changes and settings recreation", () => {
  const [first, second] = getTrainingYouTubeSegments("1-5", 1);
  const c = controller(first); c.state(5);
  c.source.muted = false; c.tick(); c.rate(0.75);
  expect(c.messages()).toContainEqual({ type: "mute", muted: false, request: 0 });
  c.command({ sequence: 1, type: "play", at: second.startSeconds, segment: second });
  Object.assign(c.source, { id: second.videoId, time: second.startSeconds }); c.state(1);
  expect(c.source.muted).toBe(false);
  expect(c.player.setPlaybackRate).toHaveBeenLastCalledWith(0.75);
  const reopened = controller(second, false);
  expect(reopened.player.unMute).toHaveBeenCalledTimes(1);
  expect(reopened.player.mute).not.toHaveBeenCalled();
});

test("an early seek keyframe becomes ready as playback enters the requested range", () => {
  const [first, second] = getTrainingYouTubeSegments("1-5", 1);
  const c = controller(first); c.state(5);
  c.command({ sequence: 1, type: "play", at: second.startSeconds, segment: second });
  Object.assign(c.source, { id: second.videoId, time: second.startSeconds - 1 }); c.state(1);
  expect(c.messages()).not.toContainEqual({ type: "ready", request: 1 });
  c.source.time = second.startSeconds; c.tick();
  expect(c.messages()).toContainEqual({ type: "ready", request: 1 });
  expect(c.player.setPlaybackRate).toHaveBeenLastCalledWith(0.5);
});

test("initial cue accepts late metadata without deadlocking or throwing", () => {
  const [first, second] = getTrainingYouTubeSegments("1-5", 1);
  const c = controller(first);
  c.player.getVideoUrl.mockReturnValue(undefined);
  c.source.time = 0; c.state(5); c.tick();
  expect(c.messages()).toContainEqual({ type: "ready", request: 0 });
  c.command({ sequence: 1, type: "play", at: second.startSeconds, segment: second });
  c.source.time = second.startSeconds; c.state(1); c.tick();
  expect(c.messages()).not.toContainEqual({ type: "ready", request: 1 });
  c.player.getVideoUrl.mockReturnValue(`https://www.youtube.com/watch?v=${second.videoId}`);
  c.tick();
  expect(c.messages()).toContainEqual({ type: "ready", request: 1 });
});

test("an immediate caption request survives a late CUED event without initial autoplay", () => {
  const [first] = getTrainingYouTubeSegments("1-5", 1);
  const c = controller(first); c.state(5);
  expect(c.player.playVideo).not.toHaveBeenCalled();
  c.command({ sequence: 1, type: "play", at: first.startSeconds, segment: first });
  c.state(5); c.tick();
  expect(c.player.playVideo).toHaveBeenCalledTimes(1);
  expect(c.messages()).not.toContainEqual({ type: "ready", request: 1 });
  c.state(1);
  expect(c.messages()).toContainEqual({ type: "ready", request: 1 });
  c.command({ sequence: 2, type: "play", at: first.startSeconds, segment: first });
  c.command({ sequence: 3, type: "pause" }); c.state(5); c.tick();
  expect(c.player.playVideo).toHaveBeenCalledTimes(1);
});

test("backgrounding during a load prevents a late PLAYING event from resuming or advancing", () => {
  const [first, second] = getTrainingYouTubeSegments("1-5", 1);
  const c = controller(first); c.state(5);
  c.command({ sequence: 1, type: "play", at: second.startSeconds, segment: second });
  c.document.hidden = true; c.listeners.visibilitychange();
  Object.assign(c.source, { id: second.videoId, time: second.startSeconds });
  c.state(1);
  expect(c.player.pauseVideo).toHaveBeenCalledTimes(2);
  c.source.time = second.endSeconds; c.state(0);
  expect(c.messages().filter(message => message.type === "ended")).toHaveLength(0);
  c.document.hidden = false;
  const loads = c.player.loadVideoById.mock.calls.length;
  c.command({ sequence: 2, type: "allowPlayback" });
  expect(c.player.loadVideoById).toHaveBeenCalledTimes(loads);
  // Once back, the official YouTube play button may resume normally.
  c.source.time = second.startSeconds; c.state(1);
  expect(c.player.pauseVideo).toHaveBeenCalledTimes(2);
  c.source.time = second.endSeconds; c.state(0);
  expect(c.messages().filter(message => message.type === "ended")).toHaveLength(1);
});
