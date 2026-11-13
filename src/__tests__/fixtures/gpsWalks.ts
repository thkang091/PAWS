import type { TrackPoint } from "../../../supabase/functions/tournament/geo";

/**
 * Made-up walks for tests, built in metres around a park in San Francisco and turned into latitude and longitude.
 * Each point is four seconds after the last with 8 m accuracy, like a phone walking at an easy pace.
 */

export const ORIGIN = { latitude: 37.7694, longitude: -122.4862 };
export const T0 = Date.UTC(2026, 10, 5, 16, 0, 0);
const M_PER_DEG_LAT = 111_320;

export const offset = (eastM: number, northM: number) => ({
  latitude: ORIGIN.latitude + northM / M_PER_DEG_LAT,
  longitude: ORIGIN.longitude + eastM / (M_PER_DEG_LAT * Math.cos((ORIGIN.latitude * Math.PI) / 180)),
});

export const fromMeters = (xy: readonly [number, number][], opts: { stepMs?: number; accuracyM?: number; segment?: number; startSeq?: number; startAt?: number } = {}): TrackPoint[] =>
  xy.map(([x, y], i) => ({
    ...offset(x, y),
    accuracyM: opts.accuracyM ?? 8,
    capturedAt: (opts.startAt ?? T0) + i * (opts.stepMs ?? 4_000),
    seq: (opts.startSeq ?? 1) + i,
    segment: opts.segment ?? 0,
  }));

/** A circle starting and ending at its east edge. `fraction` below 1 leaves it open. */
export const circle = (radiusM: number, steps: number, fraction = 1): [number, number][] =>
  Array.from({ length: Math.round(steps * fraction) + 1 }, (_, i) => {
    const a = (2 * Math.PI * i) / steps;
    return [radiusM * Math.cos(a), radiusM * Math.sin(a)] as [number, number];
  });

/** A figure eight: two loops that cross in the middle. */
export const figureEight = (radiusM: number, steps: number): [number, number][] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const t = (2 * Math.PI * i) / steps;
    return [radiusM * Math.sin(t), radiusM * Math.sin(t) * Math.cos(t)] as [number, number];
  });

/** A 60 m radius loop: about 377 m walked, about 11,300 m² enclosed. */
export const goodLoop = () => fromMeters(circle(60, 60));
