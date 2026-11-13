import { memo } from "react";
import Svg, { Circle, Path } from "react-native-svg";

import { accent, text } from "@/constants/design";

type P = readonly [number, number];

/** Fits normalised points (y up) into a square, with a margin, and returns an SVG path. */
const toPath = (points: readonly P[], size: number, closed: boolean, bounds: { minX: number; maxX: number; minY: number; maxY: number }) => {
  const pad = size * 0.12;
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) || 1;
  const k = (size - pad * 2) / span;
  const ox = pad + (size - pad * 2 - (bounds.maxX - bounds.minX) * k) / 2;
  const oy = pad + (size - pad * 2 - (bounds.maxY - bounds.minY) * k) / 2;
  const xy = (p: P) => [ox + (p[0] - bounds.minX) * k, oy + (bounds.maxY - p[1]) * k] as const;
  const d = points.map((p, i) => `${i ? "L" : "M"}${xy(p)[0].toFixed(1)} ${xy(p)[1].toFixed(1)}`).join(" ");
  return { d: closed ? `${d} Z` : d, start: points.length ? xy(points[0]) : null };
};

const boundsOf = (sets: readonly (readonly P[])[]) => {
  const all = sets.flat();
  return {
    minX: Math.min(...all.map((p) => p[0])),
    maxX: Math.max(...all.map((p) => p[0])),
    minY: Math.min(...all.map((p) => p[1])),
    maxY: Math.max(...all.map((p) => p[1])),
  };
};

/**
 * A target shape, drawn from its vector path. With `route`, the walked route is drawn on top in the same frame:
 * the target dashed and quiet, the route solid in the accent colour, so the two read apart at a glance.
 */
export const ShapeGlyph = memo(
  ({
    points,
    closed,
    size,
    route,
    color = text.primary,
    strokeWidth = 4,
  }: {
    points: readonly P[];
    closed: boolean;
    size: number;
    route?: readonly P[] | null;
    color?: string;
    strokeWidth?: number;
  }) => {
    if (!points.length) return null;
    const bounds = boundsOf(route?.length ? [points, route] : [points]);
    const target = toPath(points, size, closed && !route, bounds);
    const walked = route?.length ? toPath(route, size, false, bounds) : null;
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Path
          d={target.d}
          fill="none"
          stroke={walked ? `${text.primary}55` : color}
          strokeWidth={walked ? Math.max(2, strokeWidth - 1) : strokeWidth}
          strokeDasharray={walked ? "6 7" : undefined}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {walked ? <Path d={walked.d} fill="none" stroke={accent.band} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" /> : null}
        {!walked && target.start ? <Circle cx={target.start[0]} cy={target.start[1]} r={strokeWidth * 1.3} fill={accent.band} /> : null}
      </Svg>
    );
  },
);
ShapeGlyph.displayName = "ShapeGlyph";
