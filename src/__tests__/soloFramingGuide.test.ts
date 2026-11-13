import { createSoloFramingGuide, type SoloFramingBox, type SoloFramingObservation } from "../features/game/flow/soloFramingGuide";

const normal: SoloFramingBox = { x: 0.30, y: 0.28, width: 0.40, height: 0.40 };
const tracking = (box: SoloFramingBox, timestampMs: number, confidence = 0.9): SoloFramingObservation => ({ state: "tracking", box, confidence, timestampMs });
const lost = (timestampMs: number): SoloFramingObservation => ({ state: "lost", confidence: 0, timestampMs });

test("before acquisition only the center guide appears, with no fake green checks", () => {
  const guide = createSoloFramingGuide();
  expect(guide.getSnapshot()).toEqual({
    phase: "centering", hint: "Bring your dog to the center", distance: "unknown", visibility: "unknown", position: "unknown",
  });
  expect(guide.update({ state: "searching", confidence: 0, timestampMs: 0 }, 0)).toEqual(guide.getSnapshot());
  expect(guide.getSnapshot()).not.toHaveProperty("canStart");
});

test("a comfortable tracked subject needs no continuing instructions", () => {
  const guide = createSoloFramingGuide();
  expect(guide.update(tracking(normal, 0), 0)).toMatchObject({ phase: "tracking", hint: "Looks good", distance: "good", visibility: "good", position: "good", box: normal });
  expect(guide.update(tracking(normal, 1499), 1499).hint).toBe("Looks good");
  expect(guide.update(tracking(normal, 1500), 1500).hint).toBeNull();
});

test("normal pose and position changes inside the broad frame do not trigger hints", () => {
  const guide = createSoloFramingGuide();
  guide.update(tracking(normal, 0), 0);
  expect(guide.update(tracking({ x: 0.12, y: 0.40, width: 0.65, height: 0.22 }, 2000), 2000)).toMatchObject({ phase: "tracking", hint: null, distance: "good", position: "good" });
  expect(guide.update(tracking({ x: 0.50, y: 0.25, width: 0.38, height: 0.50 }, 4000), 4000).hint).toBeNull();
});

test.each([
  [{ x: 0.45, y: 0.45, width: 0.10, height: 0.10 }, "Move a little closer"],
  [{ x: 0.02, y: 0.04, width: 0.96, height: 0.90 }, "Move your phone back a little"],
  [{ x: 0.3, y: -0.12, width: 0.4, height: 0.4 }, "Tilt your phone up a little"],
  [{ x: 0.3, y: 0.75, width: 0.4, height: 0.4 }, "Tilt your phone down a little"],
  [{ x: 0.8, y: 0.3, width: 0.4, height: 0.4 }, "Keep your dog near the center"],
] as const)("a persistent framing issue gives one specific hint", (box, hint) => {
  const guide = createSoloFramingGuide();
  expect(guide.update(tracking(box, 0), 0).hint).toBeNull();
  expect(guide.update(tracking(box, 899), 899).hint).toBeNull();
  expect(guide.update(tracking(box, 900), 900).hint).toBe(hint);
  expect(guide.getSnapshot().phase).toBe("tracking");
  expect(guide.getSnapshot()).not.toHaveProperty("canStart");
});

test("a brief crossing of the edge neither recenters the flow nor demands correction", () => {
  const guide = createSoloFramingGuide();
  guide.update(tracking(normal, 0), 0);
  const edge = { ...normal, x: 0.75 };
  expect(guide.update(tracking(edge, 2000), 2000)).toMatchObject({ phase: "tracking", hint: null });
  expect(guide.update(tracking(normal, 2400), 2400).hint).toBeNull();
});

test("advice for an old situation disappears before different advice is shown", () => {
  const guide = createSoloFramingGuide();
  const small = { x: 0.45, y: 0.45, width: 0.1, height: 0.1 };
  const large = { x: -0.05, y: 0, width: 1.1, height: 0.9 };
  guide.update(tracking(small, 0), 0);
  expect(guide.update(tracking(small, 900), 900).hint).toBe("Move a little closer");
  expect(guide.update(tracking(large, 1000), 1000).hint).toBeNull();
  expect(guide.update(tracking(large, 1900), 1900).hint).toBe("Move your phone back a little");
});

test("brief lost tracking keeps the box without claiming visibility", () => {
  const guide = createSoloFramingGuide();
  guide.update(tracking(normal, 0), 0);
  expect(guide.update(lost(300), 300)).toMatchObject({ phase: "tracking", box: normal, hint: null, visibility: "unknown" });
  expect(guide.update(lost(600), 600)).toMatchObject({ phase: "lost", hint: "Bring your dog back into view", visibility: "unknown" });
  expect(guide.getSnapshot().box).toBeUndefined();
  expect(guide.update(tracking(normal, 700), 700)).toMatchObject({ phase: "tracking", hint: "Looks good", visibility: "good" });
});

test("stale observations cannot claim the dog is still visible", () => {
  const guide = createSoloFramingGuide();
  guide.update(tracking(normal, 0), 0);
  expect(guide.update(tracking(normal, 10), 1200)).toMatchObject({ phase: "lost", visibility: "unknown" });
});

test("out-of-order observations cannot replace a more recent tracked box", () => {
  const guide = createSoloFramingGuide();
  const current = guide.update(tracking(normal, 1000), 1000);
  expect(guide.update(tracking({ ...normal, x: 0.7 }, 900), 1100)).toBe(current);
});

test.each([
  { ...normal, width: 0 },
  { ...normal, height: NaN },
  { ...normal, x: Infinity },
  { ...normal, x: 1.2 },
])("invalid or fully outside boxes never produce a confirmed tracking state", box => {
  const guide = createSoloFramingGuide();
  expect(guide.update(tracking(box, 0), 0)).toMatchObject({ phase: "centering", distance: "unknown", visibility: "unknown", position: "unknown" });
});

test.each([0, 0.1, NaN, Infinity, 2])("unreliable confidence %s does not create green checks", confidence => {
  const guide = createSoloFramingGuide();
  expect(guide.update(tracking(normal, 0, confidence), 0).visibility).toBe("unknown");
});

test("unsupported providers retain neutral manual framing instead of a technical error", () => {
  const guide = createSoloFramingGuide();
  expect(guide.update({ state: "unavailable", confidence: 0, timestampMs: 0 }, 0)).toEqual({ phase: "unavailable", hint: "Bring your dog to the center", distance: "unknown", visibility: "unknown", position: "unknown" });
});

test("reset starts a new acquisition and forgets the previous subject", () => {
  const guide = createSoloFramingGuide();
  guide.update(tracking(normal, 5000), 5000);
  expect(guide.reset()).toMatchObject({ phase: "centering", visibility: "unknown" });
  expect(guide.getSnapshot().box).toBeUndefined();
  expect(guide.update(tracking(normal, 10), 10).phase).toBe("tracking");
});
