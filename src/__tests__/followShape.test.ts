import { DEFAULT_SHAPE_RULES, frechet, matchShape, normalize, resample, scoreFromDistance } from "../../supabase/functions/tournament/shape";
import { SHAPE_PRESETS, presetByKey } from "../../supabase/functions/tournament/shapes";
import { walkShape } from "./fixtures/shapeWalks";

const target = (key: string) => {
  const p = presetByKey(key)!;
  return { closed: p.closed, minDistanceM: p.minDistanceM, points: p.points };
};
const STAR = presetByKey("star")!;
const HEART = presetByKey("heart")!;
const BOLT = presetByKey("lightning")!;

describe("shape presets", () => {
  it("ships at least five reusable vector shapes across difficulties", () => {
    expect(SHAPE_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(SHAPE_PRESETS.map((s) => s.difficulty))).toEqual(new Set(["easy", "medium", "hard"]));
    SHAPE_PRESETS.forEach((s) => expect(s.points.length).toBeGreaterThanOrEqual(3));
  });
});

describe("matching a walk to a shape", () => {
  it("scores a faithful walk near 100", () => {
    const m = matchShape(walkShape(STAR.points, true, { radiusM: 160 }), target("star"));
    expect(m.issues).toEqual([]);
    expect(m.score).toBeGreaterThanOrEqual(97);
  });

  it("does not care where on the map the shape was walked", () => {
    const here = matchShape(walkShape(HEART.points, true), target("heart"));
    const there = matchShape(walkShape(HEART.points, true, { eastM: 2_500, northM: -1_800 }), target("heart"));
    expect(Math.abs(here.score - there.score)).toBeLessThanOrEqual(0.5);
  });

  it("does not care how big the shape was walked", () => {
    const small = matchShape(walkShape(STAR.points, true, { radiusM: 120 }), target("star"));
    const big = matchShape(walkShape(STAR.points, true, { radiusM: 300 }), target("star"));
    expect(Math.abs(small.score - big.score)).toBeLessThanOrEqual(1);
    expect(big.score).toBeGreaterThanOrEqual(95);
  });

  it("allows turning the shape by default, and can be made strict", () => {
    const turned = walkShape(BOLT.points, false, { radiusM: 250, rotateDeg: 73 });
    expect(matchShape(turned, target("lightning")).score).toBeGreaterThanOrEqual(95);
    const strict = matchShape(turned, target("lightning"), { ...DEFAULT_SHAPE_RULES, allowRotation: false });
    expect(strict.score).toBeLessThan(60);
  });

  it("counts walking the outline the other way round, unless the rules forbid it", () => {
    const backwards = walkShape(BOLT.points, false, { radiusM: 250, reverse: true });
    expect(matchShape(backwards, target("lightning")).score).toBeGreaterThanOrEqual(95);
    const oneWay = matchShape(backwards, target("lightning"), { ...DEFAULT_SHAPE_RULES, allowReverse: false, allowRotation: false });
    expect(oneWay.score).toBeLessThan(60);
  });

  it("lets a closed shape be started from any corner", () => {
    const m = matchShape(walkShape(STAR.points, true, { radiusM: 160, startAt: 3 }), target("star"));
    expect(m.score).toBeGreaterThanOrEqual(95);
  });

  it("tells a different shape apart", () => {
    const square = presetByKey("square")!;
    const m = matchShape(walkShape(square.points, true, { radiusM: 150 }), target("star"));
    expect(m.ok).toBe(true);
    expect(m.score).toBeLessThan(70);
  });

  it("stays high through a few metres of GPS wobble", () => {
    const m = matchShape(walkShape(HEART.points, true, { radiusM: 180, jitterM: 3 }), target("heart"));
    expect(m.score).toBeGreaterThanOrEqual(85);
  });

  it("refuses a walk with a hole in the GPS", () => {
    const pts = walkShape(STAR.points, true, { radiusM: 160 });
    const gap = [...pts.slice(0, 60), ...pts.slice(90)];
    const m = matchShape(gap, target("star"));
    expect(m.issues).toContain("gps_gap");
    expect(m.score).toBe(0);
  });

  it("refuses an extremely short walk", () => {
    const m = matchShape(walkShape(STAR.points, true, { radiusM: 20 }), target("star"));
    expect(m.issues).toContain("too_short");
    expect(m.score).toBe(0);
  });

  it("refuses an invalid walk with an impossible jump", () => {
    const pts = walkShape(STAR.points, true, { radiusM: 160 });
    const jumped = pts.map((p, i) => (i >= 50 && i < 60 ? { ...p, latitude: p.latitude + 0.02 } : p));
    expect(matchShape(jumped, target("star")).issues).toContain("suspicious_speed");
  });

  it("gives the same result for the same walk, even when points arrive twice or out of order", () => {
    const pts = walkShape(HEART.points, true, { radiusM: 180, jitterM: 2 });
    const first = matchShape(pts, target("heart"));
    // After a reconnect the phone resends a batch; the server stores each sequence number once, in order.
    const resent = [...pts.slice(40, 80), ...pts, ...pts.slice(10, 30)].reverse();
    const second = matchShape(resent, target("heart"));
    expect(second.score).toBe(first.score);
    expect(second.distance).toBe(first.distance);
  });
});

describe("matching parts", () => {
  it("resamples evenly and keeps both ends", () => {
    const r = resample([[0, 0], [10, 0], [10, 10]], 5);
    expect(r[0]).toEqual([0, 0]);
    expect(r[4]).toEqual([10, 10]);
    expect(r[2][0]).toBeCloseTo(10);
    expect(r[2][1]).toBeCloseTo(0);
  });

  it("measures identical paths at zero distance", () => {
    const p = normalize(resample([[0, 0], [3, 4], [6, 0]], 32));
    expect(frechet(p, p)).toBe(0);
  });

  it("maps distances to scores at the documented ends", () => {
    expect(scoreFromDistance(0)).toBe(100);
    expect(scoreFromDistance(DEFAULT_SHAPE_RULES.perfectAt)).toBe(100);
    expect(scoreFromDistance(DEFAULT_SHAPE_RULES.zeroAt)).toBe(0);
    expect(scoreFromDistance(Infinity)).toBe(0);
  });
});
