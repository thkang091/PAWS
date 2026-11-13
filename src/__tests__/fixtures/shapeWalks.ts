import type { TrackPoint } from "../../../supabase/functions/tournament/geo";
import { T0, offset } from "./gpsWalks";

/**
 * Turns a unit shape into a believable GPS walk: scaled to metres, optionally turned, moved, walked backwards or
 * started elsewhere on a closed outline, then sampled every 5 m at an easy 1.25 m/s.
 */
export const walkShape = (
  points: readonly (readonly [number, number])[],
  closed: boolean,
  opts: { radiusM?: number; rotateDeg?: number; eastM?: number; northM?: number; reverse?: boolean; startAt?: number; jitterM?: number; stepM?: number } = {},
): TrackPoint[] => {
  const r = opts.radiusM ?? 150;
  const theta = ((opts.rotateDeg ?? 0) * Math.PI) / 180;
  let path = points.map(([x, y]) => [x * r, y * r] as [number, number]);
  if (closed && opts.startAt) path = [...path.slice(opts.startAt), ...path.slice(0, opts.startAt)];
  if (closed) path = [...path, path[0]];
  if (opts.reverse) path = [...path].reverse();
  path = path.map(([x, y]) => [x * Math.cos(theta) - y * Math.sin(theta) + (opts.eastM ?? 0), x * Math.sin(theta) + y * Math.cos(theta) + (opts.northM ?? 0)]);

  const step = opts.stepM ?? 5;
  const dense: [number, number][] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1];
    const [bx, by] = path[i];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) dense.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  // A deterministic wobble, like GPS noise, without randomness.
  const j = opts.jitterM ?? 0;
  return dense.map(([x, y], i) => ({
    ...offset(x + j * Math.sin(i * 1.7), y + j * Math.cos(i * 2.3)),
    accuracyM: 6,
    capturedAt: T0 + i * 4_000,
    seq: i + 1,
    segment: 0,
  }));
};
