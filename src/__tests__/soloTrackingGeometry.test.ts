import { projectSoloTrackingEvent, type SoloNativeTrackingEvent } from "../features/game/flow/soloTrackingGeometry";

const event = (overrides: Partial<SoloNativeTrackingEvent> = {}): SoloNativeTrackingEvent => ({
  state: "tracking",
  box: { x: 0.25, y: 0.20, width: 0.50, height: 0.40 },
  confidence: 0.85,
  frameWidth: 720,
  frameHeight: 1280,
  ...overrides,
});
const portrait = { width: 390, height: 844 };

test("an uncropped matching aspect ratio preserves the native box", () => {
  expect(projectSoloTrackingEvent(event(), { width: 360, height: 640 }, 100)).toEqual({
    state: "tracking", box: event().box, confidence: 0.85, timestampMs: 100,
  });
});

test("portrait 16:9 camera frames crop horizontally on a tall iPhone", () => {
  const result = projectSoloTrackingEvent(event(), portrait, 10)!;
  // The 720x1280 frame fills height844, yielding width474.75 and crop42.375.
  expect(result.box!.x).toBeCloseTo((0.25 * 474.75 - 42.375) / 390);
  expect(result.box!.width).toBeCloseTo(0.50 * 474.75 / 390);
  expect(result.box!.y).toBeCloseTo(0.20);
  expect(result.box!.height).toBeCloseTo(0.40);
});

test("landscape previews crop the vertical image bounds when filling width", () => {
  const result = projectSoloTrackingEvent(event({ frameWidth: 1280, frameHeight: 720 }), { width: 844, height: 390 }, 5)!;
  expect(result.box!.x).toBeCloseTo(0.25);
  expect(result.box!.width).toBeCloseTo(0.50);
  expect(result.box!.y).toBeCloseTo((0.20 * 474.75 - 42.375) / 390);
  expect(result.box!.height).toBeCloseTo(0.40 * 474.75 / 390);
});

test("cropped edges remain outside0..1 for framing hints instead of being clamped", () => {
  const result = projectSoloTrackingEvent(event({ box: { x: 0, y: 0, width: 1, height: 1 } }), portrait, 0)!;
  expect(result.box!.x).toBeLessThan(0);
  expect(result.box!.x + result.box!.width).toBeGreaterThan(1);
  expect(result.box!.y).toBe(0);
  expect(result.box!.height).toBe(1);
});

test("Expo's nativeEvent wrapper and a plain event produce the same observation", () => {
  expect(projectSoloTrackingEvent({ nativeEvent: event() }, portrait, 4)).toEqual(projectSoloTrackingEvent(event(), portrait, 4));
});

test("already mirrored native coordinates are not mirrored a second time", () => {
  const result = projectSoloTrackingEvent(event({ box: { x: 0.1, y: 0.2, width: 0.2, height: 0.3 } }), { width: 720, height: 1280 }, 10)!;
  expect(result.box!.x).toBeCloseTo(0.1);
  expect(result.box!.y).toBeCloseTo(0.2);
});

test.each(["searching", "lost", "unavailable"] as const)("%s does not require a frame or box", state => {
  expect(projectSoloTrackingEvent({ state }, { width: 0, height: 0 }, 30)).toEqual({ state, confidence: 0, timestampMs: 30 });
});

test.each([null, undefined, "tracking", {}, { state: "dog" }, { nativeEvent: null }, []])("unknown event payload%p is ignored", payload => {
  expect(projectSoloTrackingEvent(payload, portrait, 30)).toBeNull();
});

test.each([
  { frameWidth: 0 }, { frameHeight: -1 }, { frameWidth: Infinity },
  { confidence: NaN }, { confidence: -0.1 }, { confidence: 1.2 },
  { box: undefined }, { box: { x: NaN, y: 0, width: 0.2, height: 0.2 } },
  { box: { x: 0, y: 0, width: -0.2, height: 0.2 } },
])("invalid native tracking values become an unknown/lost observation", overrides => {
  expect(projectSoloTrackingEvent(event(overrides), portrait, 30)).toEqual({ state: "lost", confidence: 0, timestampMs: 30 });
});

test.each([{ width: 0, height: 844 }, { width: 390, height: NaN }])("tracking requires a laid-out finite viewport", viewport => {
  expect(projectSoloTrackingEvent(event(), viewport, 30)).toEqual({ state: "lost", confidence: 0, timestampMs: 30 });
});

test.each([NaN, Infinity, -1])("invalid receipt timestamp%s is ignored", timestampMs => {
  expect(projectSoloTrackingEvent(event(), portrait, timestampMs)).toBeNull();
});

test("a low but valid native confidence is preserved for the advisory evaluator", () => {
  expect(projectSoloTrackingEvent(event({ confidence: 0.1 }), portrait, 100)?.confidence).toBe(0.1);
});
