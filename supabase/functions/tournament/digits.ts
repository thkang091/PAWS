/**
 * Number Trail digits: seven-segment templates and how to walk them. Pure geometry with no map, so the phone, the
 * edge function and the tests all agree on what each digit is.
 *
 *     A          A top          The frame is two stacked cells, `w` wide and `hh` tall each, with six corners:
 *   F   B        B upper right    TL ── TR
 *     G          C lower right    │      │
 *   E   C        D bottom         ML ── MR
 *     D          E lower left     │      │
 *                F upper left     BL ── BR
 *                G middle
 *
 * The templates are the visual goal, never coordinates: numberRoutes.ts finds real walkable streets that line up
 * with a digit's segments, and the walk follows those streets only.
 */

export type Segment = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type Corner = "TL" | "TR" | "ML" | "MR" | "BL" | "BR";
export type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

export const SEGMENTS: readonly Segment[] = ["A", "B", "C", "D", "E", "F", "G"];
export const CORNERS: readonly Corner[] = ["TL", "TR", "ML", "MR", "BL", "BR"];
export const DIGITS: readonly Digit[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Each segment runs between two corners. */
export const SEGMENT_ENDS: Readonly<Record<Segment, readonly [Corner, Corner]>> = {
  A: ["TL", "TR"],
  B: ["TR", "MR"],
  C: ["MR", "BR"],
  D: ["BL", "BR"],
  E: ["ML", "BL"],
  F: ["TL", "ML"],
  G: ["ML", "MR"],
};

/** Corner positions in frame units: x to the right in widths, y downward in half-heights. */
export const CORNER_AT: Readonly<Record<Corner, readonly [number, number]>> = {
  TL: [0, 0],
  TR: [1, 0],
  ML: [0, 1],
  MR: [1, 1],
  BL: [0, 2],
  BR: [1, 2],
};

/** The required segments of every digit. A digit is drawn with exactly these and no others. */
export const DIGIT_SEGMENTS: Readonly<Record<Digit, readonly Segment[]>> = {
  "0": ["A", "B", "C", "D", "E", "F"],
  "1": ["B", "C"],
  "2": ["A", "B", "G", "E", "D"],
  "3": ["A", "B", "G", "C", "D"],
  "4": ["F", "G", "B", "C"],
  "5": ["A", "F", "G", "C", "D"],
  "6": ["A", "F", "G", "C", "D", "E"],
  "7": ["A", "B", "C"],
  "8": ["A", "B", "C", "D", "E", "F", "G"],
  "9": ["A", "B", "C", "D", "F", "G"],
};

export const isDigit = (s: string): s is Digit => s.length === 1 && s >= "0" && s <= "9";

/** A two-digit target, always two characters so leading zeros survive ("07", never 7). */
export const isTwoDigit = (s: unknown): s is string => typeof s === "string" && /^[0-9]{2}$/.test(s);

/** Every target from "00" to "99". */
export const ALL_NUMBERS: readonly string[] = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, "0"));

/** The digit whose segments are exactly `segs`, or null. Seven-segment patterns are unique, so this inverts the table. */
export const decodeSegments = (segs: Iterable<Segment>): Digit | null => {
  const key = [...new Set(segs)].sort().join("");
  for (const d of DIGITS) if ([...DIGIT_SEGMENTS[d]].sort().join("") === key) return d;
  return null;
};

/** Corners a digit touches. */
export const cornersOf = (d: Digit): Corner[] => CORNERS.filter((c) => DIGIT_SEGMENTS[d].some((s) => SEGMENT_ENDS[s].includes(c)));

// ---------------------------------------------------------------------------------------------------------------
// Walking a digit: route inspection on the seven-segment graph
// ---------------------------------------------------------------------------------------------------------------

/** One stroke of a walk: a segment walked from one corner to the other. `repeat` marks a stroke walked again. */
export type Stroke = { segment: Segment; from: Corner; to: Corner; repeat: boolean };

export type DigitWalk = {
  start: Corner;
  end: Corner;
  strokes: Stroke[];
  /** Length walked, repeats included, for the given segment lengths. */
  lengthM: number;
  /** Length walked twice. */
  repeatedM: number;
  /** Changes of direction of 45 degrees or more between strokes (frame geometry), a measure of how fiddly it is. */
  turns: number;
};

const other = (s: Segment, c: Corner): Corner => (SEGMENT_ENDS[s][0] === c ? SEGMENT_ENDS[s][1] : SEGMENT_ENDS[s][0]);

/** Shortest walk between two corners over a digit's own segments (repeating strokes, never leaving the digit). */
const strokePath = (segs: readonly Segment[], len: (s: Segment) => number, from: Corner, to: Corner): Segment[] | null => {
  const dist = new Map<Corner, number>([[from, 0]]);
  const prev = new Map<Corner, Segment>();
  const todo = new Set<Corner>([from]);
  while (todo.size) {
    let at: Corner | null = null;
    for (const c of todo) if (at === null || dist.get(c)! < dist.get(at)! || (dist.get(c) === dist.get(at) && c < at)) at = c;
    todo.delete(at!);
    if (at === to) break;
    for (const s of segs) {
      if (!SEGMENT_ENDS[s].includes(at!)) continue;
      const next = other(s, at!);
      const nd = dist.get(at!)! + len(s);
      if (nd < (dist.get(next) ?? Infinity)) {
        dist.set(next, nd);
        prev.set(next, s);
        todo.add(next);
      }
    }
  }
  if (!dist.has(to)) return null;
  const out: Segment[] = [];
  for (let at = to; at !== from; ) {
    const s = prev.get(at)!;
    out.push(s);
    at = other(s, at);
  }
  return out.reverse();
};

const direction = (s: Segment, from: Corner): [number, number] => {
  const [ax, ay] = CORNER_AT[from];
  const [bx, by] = CORNER_AT[other(s, from)];
  return [bx - ax, by - ay];
};

const turnsOf = (strokes: readonly Stroke[]) => {
  let n = 0;
  for (let i = 1; i < strokes.length; i++) {
    const [ax, ay] = direction(strokes[i - 1].segment, strokes[i - 1].from);
    const [bx, by] = direction(strokes[i].segment, strokes[i].from);
    if (ax * bx + ay * by < 0.7) n++; // anything other than carrying straight on
  }
  return n;
};

/**
 * Every sensible way to walk a digit in one go. A digit whose segments form an Euler path is walked once, end to end.
 * Digits with four odd corners (3 and 4) can't be: the cheapest strokes to walk twice are found by trying every
 * pairing of odd corners (route inspection), and the repeats stay on the digit's own segments, so no extra line is
 * ever drawn. Returns the best walk for each possible starting corner, fewest turns first.
 */
export const digitWalks = (d: Digit, segmentLengthM: (s: Segment) => number = () => 1): DigitWalk[] => {
  const segs = DIGIT_SEGMENTS[d];
  const degree = new Map<Corner, number>();
  for (const s of segs) for (const c of SEGMENT_ENDS[s]) degree.set(c, (degree.get(c) ?? 0) + 1);
  const odd = CORNERS.filter((c) => (degree.get(c) ?? 0) % 2 === 1);

  // Which corners may be the two ends, and which strokes are walked twice to make that possible.
  type Plan = { ends: Corner[]; extra: Segment[] };
  const plans: Plan[] = [];
  if (odd.length === 0) plans.push({ ends: [], extra: [] });
  else if (odd.length === 2) plans.push({ ends: odd, extra: [] });
  else {
    // Pair up all odd corners but two; the pairing with the least repeated length wins (ties all kept).
    const pairings = (rest: Corner[]): Corner[][][] => {
      if (!rest.length) return [[]];
      const [a, ...others] = rest;
      return others.flatMap((b, i) => pairings(others.filter((_, j) => j !== i)).map((p) => [[a, b], ...p]));
    };
    let best = Infinity;
    const found: Plan[] = [];
    for (let i = 0; i < odd.length; i++)
      for (let j = i + 1; j < odd.length; j++) {
        const rest = odd.filter((_, k) => k !== i && k !== j);
        for (const pairing of pairings(rest)) {
          const extra: Segment[] = [];
          let ok = true;
          for (const [a, b] of pairing) {
            const p = strokePath(segs, segmentLengthM, a, b);
            if (!p) ok = false;
            else extra.push(...p);
          }
          if (!ok) continue;
          const cost = extra.reduce((s, x) => s + segmentLengthM(x), 0);
          if (cost < best - 1e-9) {
            best = cost;
            found.length = 0;
          }
          if (cost <= best + 1e-9) found.push({ ends: [odd[i], odd[j]], extra });
        }
      }
    plans.push(...found);
  }

  // All Euler walks of the multigraph (at most 8 strokes, so this is small), best per start.
  const bestByStart = new Map<Corner, DigitWalk>();
  for (const plan of plans) {
    const edges = [...segs.map((s) => ({ s, repeat: false })), ...plan.extra.map((s) => ({ s, repeat: true }))];
    const starts = plan.ends.length ? plan.ends : CORNERS.filter((c) => degree.has(c));
    for (const start of starts) {
      const used = edges.map(() => false);
      const walk: Stroke[] = [];
      const dfs = (at: Corner) => {
        if (walk.length === edges.length) {
          const strokes = walk.map((w) => ({ ...w }));
          // The first time a segment appears is its drawing stroke; later appearances are repeats.
          const seen = new Set<Segment>();
          strokes.forEach((st) => {
            st.repeat = seen.has(st.segment);
            seen.add(st.segment);
          });
          const lengthM = strokes.reduce((s, st) => s + segmentLengthM(st.segment), 0);
          const repeatedM = strokes.filter((st) => st.repeat).reduce((s, st) => s + segmentLengthM(st.segment), 0);
          const candidate: DigitWalk = { start, end: at, strokes, lengthM, repeatedM, turns: turnsOf(strokes) };
          const current = bestByStart.get(start);
          if (!current || candidate.lengthM < current.lengthM - 1e-9 || (Math.abs(candidate.lengthM - current.lengthM) < 1e-9 && candidate.turns < current.turns)) bestByStart.set(start, candidate);
          return;
        }
        edges.forEach((e, i) => {
          if (used[i] || !SEGMENT_ENDS[e.s].includes(at)) return;
          // Two copies of the same stroke are interchangeable: only try the first unused one.
          if (edges.some((f, j) => j < i && !used[j] && f.s === e.s)) return;
          used[i] = true;
          walk.push({ segment: e.s, from: at, to: other(e.s, at), repeat: e.repeat });
          dfs(other(e.s, at));
          walk.pop();
          used[i] = false;
        });
      };
      dfs(start);
    }
  }
  return [...bestByStart.values()].sort((a, b) => a.lengthM - b.lengthM || a.turns - b.turns || (a.start < b.start ? -1 : 1));
};

/** Strokes walked (repeats included) per digit at equal segment lengths: how much there is to walk. */
export const DIGIT_STROKES: Readonly<Record<Digit, number>> = Object.fromEntries(DIGITS.map((d) => [d, digitWalks(d)[0].strokes.length])) as Record<Digit, number>;

export type Difficulty = "easy" | "medium" | "hard";

/**
 * How demanding a number is to walk: strokes (repeats included) plus turns over both digits.
 * Easy is simple digits with few turns (11, 17, 41); hard is the busiest ones (88, 38, 68).
 */
export const DIFFICULTY_RULES = { easyMax: 11, mediumMax: 18 } as const;

export const difficultyOf = (walks: readonly Pick<DigitWalk, "strokes" | "turns">[]): Difficulty => {
  const effort = walks.reduce((s, w) => s + w.strokes.length + w.turns, 0);
  // The bands are set for two digits; a single digit is judged per digit on the same scale.
  const per = walks.length / 2 || 1;
  return effort <= DIFFICULTY_RULES.easyMax * per ? "easy" : effort <= DIFFICULTY_RULES.mediumMax * per ? "medium" : "hard";
};
