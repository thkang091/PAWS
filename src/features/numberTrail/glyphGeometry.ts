/**
 * Number Trail's two-digit glyph as pure geometry (no React): the seven-segment walks the server plans, laid out side
 * by side, in the walking orders that make the link between the digits shortest. Used by the glyph, the hub art and
 * tests.
 */
import { CORNER_AT, digitWalks, type Digit } from "../../../supabase/functions/tournament/digits";

export const W = 1.08;
export const HH = 1;
export const GAP = 0.62;
export const PAD = 0.22;

type Pt = readonly [number, number];
type DigitGeo = { d: string; length: number; start: Pt; end: Pt };

/** A digit's strokes in one walking order (one of the seven-segment walks the server plans), as one path. */
const walkPath = (d: Digit, walk: ReturnType<typeof digitWalks>[number], x0: number, y0: number): DigitGeo => {
  // A 1 sits on the right of its frame on the street; drawn alone it reads better centred.
  const shift = d === "1" ? -W / 2 : 0;
  const pt = (c: keyof typeof CORNER_AT): Pt => [x0 + shift + CORNER_AT[c][0] * W, y0 + CORNER_AT[c][1] * HH];
  const start = pt(walk.start);
  let dPath = `M${start[0]} ${start[1]}`;
  let length = 0;
  let at = start;
  for (const s of walk.strokes) {
    if (s.repeat) continue;
    const f = pt(s.from);
    const t = pt(s.to);
    if (f[0] !== at[0] || f[1] !== at[1]) dPath += ` M${f[0]} ${f[1]}`;
    dPath += ` L${t[0]} ${t[1]}`;
    length += Math.hypot(t[0] - f[0], t[1] - f[1]);
    at = t;
  }
  return { d: dPath, length, start, end: at };
};

/**
 * Both digits, in the walking orders that make the link between them shortest: digit one ends as close as it can to
 * where digit two begins, as the planner prefers on real streets.
 */
export const digitPair = (value: string) => {
  const [a, b] = [value[0] as Digit, value[1] as Digit];
  let best: { one: DigitGeo; two: DigitGeo; cost: number } | null = null;
  for (const w1 of digitWalks(a))
    for (const w2 of digitWalks(b)) {
      const one = walkPath(a, w1, PAD, PAD);
      const two = walkPath(b, w2, PAD + W + GAP, PAD);
      const cost = Math.hypot(two.start[0] - one.end[0], two.start[1] - one.end[1]) + 0.05 * (w1.lengthM + w2.lengthM);
      if (!best || cost < best.cost) best = { one, two, cost };
    }
  return [best!.one, best!.two] as const;
};

/** The glyph's geometry in its own units (for drawing inside another picture). */
export const numberStrokes = (value: string) => {
  const [a, b] = digitPair(value);
  const width = PAD * 2 + W * 2 + GAP;
  const height = PAD * 2 + HH * 2;
  const link = linkPath(a.end, b.start, height);
  return { paths: [a.d, b.d] as const, lengths: [a.length, b.length] as const, starts: [a.start, b.start] as const, link, width, height };
};

/** The link between the digits: a gentle curve in the gap, never across a digit. */
export const linkPath = (from: Pt, to: Pt, height: number) => {
  const midX = (from[0] + to[0]) / 2;
  const midY = Math.min(height - PAD * 0.3, Math.max(from[1], to[1]) + 0.25);
  return `M${from[0]} ${from[1]} Q${midX} ${midY} ${to[0]} ${to[1]}`;
};


export const GLYPH = { width: PAD * 2 + W * 2 + GAP, height: PAD * 2 + HH * 2 } as const;

/** One digit (1 to 9) alone, in its first walking order. */
export const digitSingle = (value: string) => walkPath(value[0] as Digit, digitWalks(value[0] as Digit)[0], PAD, PAD);
export const GLYPH_SINGLE = { width: PAD * 2 + W, height: PAD * 2 + HH * 2 } as const;
