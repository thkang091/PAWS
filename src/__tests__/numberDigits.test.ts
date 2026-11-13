/**
 * Number Trail digit templates: the seven-segment table, reading digits back, and how each digit is walked.
 */
import {
  ALL_NUMBERS,
  CORNER_AT,
  DIFFICULTY_RULES,
  DIGITS,
  DIGIT_SEGMENTS,
  SEGMENTS,
  SEGMENT_ENDS,
  cornersOf,
  decodeSegments,
  difficultyOf,
  digitWalks,
  isTwoDigit,
  type Digit,
  type Segment,
} from "../../supabase/functions/tournament/digits";

/** The table from the brief, written out independently of the module. */
const SPEC: Record<string, string> = {
  "0": "ABCDEF",
  "1": "BC",
  "2": "ABGED",
  "3": "ABGCD",
  "4": "FGBC",
  "5": "AFGCD",
  "6": "AFGCDE",
  "7": "ABC",
  "8": "ABCDEFG",
  "9": "ABCDFG",
};

const sorted = (s: Iterable<string>) => [...s].sort().join("");

describe("seven-segment templates", () => {
  it.each(DIGITS)("digit %s uses exactly the segments in the brief", (d) => {
    expect(sorted(DIGIT_SEGMENTS[d])).toBe(sorted(SPEC[d]));
  });

  it("lays the segments out as a two-cell frame", () => {
    // A top, D bottom, G middle are horizontal; B, C right and E, F left are vertical.
    for (const s of SEGMENTS) {
      const [a, b] = SEGMENT_ENDS[s].map((c) => CORNER_AT[c]);
      const horizontal = a[1] === b[1];
      expect(horizontal).toBe(["A", "D", "G"].includes(s));
      expect(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])).toBe(1);
    }
    expect(CORNER_AT[SEGMENT_ENDS.A[0]][1]).toBe(0);
    expect(CORNER_AT[SEGMENT_ENDS.G[0]][1]).toBe(1);
    expect(CORNER_AT[SEGMENT_ENDS.D[0]][1]).toBe(2);
    expect(CORNER_AT[SEGMENT_ENDS.B[0]][0]).toBe(1);
    expect(CORNER_AT[SEGMENT_ENDS.F[0]][0]).toBe(0);
  });

  it("reads every pattern back as its own digit, and nothing else", () => {
    for (const d of DIGITS) expect(decodeSegments(DIGIT_SEGMENTS[d])).toBe(d);
    // Patterns that are not digits read as nothing.
    expect(decodeSegments(["A"])).toBeNull();
    expect(decodeSegments(["A", "D"])).toBeNull();
    expect(decodeSegments(["E", "F"])).toBeNull(); // a 1 on the wrong side is not a 1
    expect(decodeSegments(["A", "B", "C", "D", "E", "F", "G", "G"])).toBe("8");
  });

  it("represents all 100 numbers from 00 to 99 as two-character text", () => {
    expect(ALL_NUMBERS).toHaveLength(100);
    expect(ALL_NUMBERS[0]).toBe("00");
    expect(ALL_NUMBERS[7]).toBe("07");
    expect(ALL_NUMBERS[99]).toBe("99");
    for (const n of ALL_NUMBERS) {
      expect(isTwoDigit(n)).toBe(true);
      for (const d of n) expect(DIGIT_SEGMENTS[d as Digit].length).toBeGreaterThan(0);
    }
  });

  it("keeps leading zeros: only two-digit text is a target", () => {
    expect(isTwoDigit("07")).toBe(true);
    expect(isTwoDigit("7")).toBe(false);
    expect(isTwoDigit(7)).toBe(false);
    expect(isTwoDigit("007")).toBe(false);
    expect(isTwoDigit("7a")).toBe(false);
    expect(String(Number("07"))).toBe("7"); // why the target is never stored as a number
  });
});

describe("walking each digit in one go", () => {
  it.each(DIGITS)("digit %s: every walk covers each segment, joins up, and repeats only what route inspection needs", (d) => {
    const walks = digitWalks(d);
    expect(walks.length).toBeGreaterThan(0);
    const degree = new Map<string, number>();
    for (const s of DIGIT_SEGMENTS[d]) for (const c of SEGMENT_ENDS[s]) degree.set(c, (degree.get(c) ?? 0) + 1);
    const odd = [...degree.values()].filter((v) => v % 2).length;
    for (const w of walks) {
      // Every required segment, no others.
      expect(sorted(new Set(w.strokes.map((s) => s.segment)))).toBe(sorted(DIGIT_SEGMENTS[d]));
      // Strokes chain corner to corner, each along a real segment of the template.
      expect(w.strokes[0].from).toBe(w.start);
      expect(w.strokes[w.strokes.length - 1].to).toBe(w.end);
      w.strokes.forEach((s, i) => {
        expect([...SEGMENT_ENDS[s.segment]].sort()).toEqual([s.from, s.to].sort());
        if (i) expect(s.from).toBe(w.strokes[i - 1].to);
      });
      // An Euler walk needs no repeats when at most two corners are odd; 3 and 4 have four, so exactly one repeat.
      const repeats = w.strokes.filter((s) => s.repeat).length;
      expect(repeats).toBe(odd <= 2 ? 0 : 1);
      expect(w.strokes.length).toBe(DIGIT_SEGMENTS[d].length + repeats);
    }
  });

  it("repeats the cheapest stroke when segment lengths differ", () => {
    // A 4 has four odd corners, so one stroke is walked twice; route inspection picks the cheapest one.
    const long: Record<Segment, number> = { A: 100, B: 100, C: 100, D: 100, E: 100, F: 100, G: 100 };
    const w = digitWalks("4", (s) => long[s])[0];
    expect(w.repeatedM).toBe(100);
    const lopsided = digitWalks("4", (s) => (s === "B" ? 300 : s === "C" ? 80 : 100))[0];
    // With B long and C short, walking C twice beats walking B twice.
    expect(lopsided.strokes.filter((s) => s.repeat).map((s) => s.segment)).toEqual(["C"]);
  });

  it("offers each odd corner as a start, and every corner for loops", () => {
    expect(digitWalks("0").map((w) => w.start).sort()).toEqual([...cornersOf("0")].sort());
    expect(digitWalks("1").map((w) => w.start).sort()).toEqual(["BR", "TR"]);
    expect(digitWalks("8").map((w) => w.start).sort()).toEqual(["ML", "MR"]);
  });
});

describe("difficulty", () => {
  const of = (n: string) => difficultyOf([...n].map((d) => digitWalks(d as Digit)[0]));
  it("rates simple numbers easy and busy ones hard", () => {
    expect(of("11")).toBe("easy");
    expect(of("17")).toBe("easy");
    expect(of("88")).toBe("hard");
    expect(of("38")).toBe("hard");
    expect(of("25")).toBe("medium");
  });
  it("puts every number in exactly one band", () => {
    const bands = { easy: 0, medium: 0, hard: 0 };
    for (const n of ALL_NUMBERS) bands[of(n)]++;
    expect(bands.easy + bands.medium + bands.hard).toBe(100);
    expect(Math.min(bands.easy, bands.medium, bands.hard)).toBeGreaterThan(5);
    expect(DIFFICULTY_RULES.easyMax).toBeLessThan(DIFFICULTY_RULES.mediumMax);
  });
});
