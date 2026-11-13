import {
  RULES,
  checkClip,
  duelOutcome,
  judgeCombo,
  judgeSit,
  makeDuelCode,
  makePlan,
  parseObservation,
  readClipInfo,
  sitChimes,
  soundsMatch,
  weekStart,
  weeklyTricks,
  type ComboPlan,
  type Observation,
  type SitPlan,
} from "../../supabase/functions/arena/logic";

/** A repeatable stand-in for crypto randomness. */
const rngFrom = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const seen = (over: Partial<Observation> = {}): Observation => ({
  codeWordHeard: true,
  handsShownEmpty: true,
  goChimeAtS: 8,
  dogVisible: "whole",
  sameDog: "yes",
  ownerTouchedDogAtS: -1,
  soundsAtS: [],
  sitStartAtS: 9,
  sitBreakAtS: -1,
  tricks: [],
  confidence: 0.9,
  summary: "",
  ...over,
});

/** Builds a minimal MOV: ftyp, then moov with a version 0 mvhd. */
const mov = (durationS: number, createdUnixS: number, timescale = 600) => {
  const mvhd = new Uint8Array(8 + 100);
  const v = new DataView(mvhd.buffer);
  v.setUint32(0, mvhd.length);
  mvhd.set([..."mvhd"].map((c) => c.charCodeAt(0)), 4);
  v.setUint32(12, createdUnixS + 2_082_844_800);
  v.setUint32(20, timescale);
  v.setUint32(24, durationS * timescale);
  const moov = new Uint8Array(8 + mvhd.length);
  new DataView(moov.buffer).setUint32(0, moov.length);
  moov.set([..."moov"].map((c) => c.charCodeAt(0)), 4);
  moov.set(mvhd, 8);
  const ftyp = new Uint8Array(16);
  new DataView(ftyp.buffer).setUint32(0, 16);
  ftyp.set([..."ftypqt  "].map((c) => c.charCodeAt(0)), 4);
  const file = new Uint8Array(ftyp.length + moov.length);
  file.set(ftyp, 0);
  file.set(moov, ftyp.length);
  return file;
};

describe("arena plans", () => {
  it("spaces distraction sounds at least 14s apart and inside the cap", () => {
    for (let s = 1; s < 60; s++) {
      const chimes = sitChimes(rngFrom(s));
      expect(chimes.length).toBeGreaterThanOrEqual(4);
      expect(chimes.length).toBeLessThanOrEqual(6);
      expect(chimes[0].atMs).toBeGreaterThanOrEqual(8_000);
      expect(chimes[chimes.length - 1].atMs).toBeLessThanOrEqual(RULES.longest_sit.capMs - 6_000);
      for (let i = 1; i < chimes.length; i++) expect(chimes[i].atMs - chimes[i - 1].atMs).toBeGreaterThanOrEqual(14_000);
    }
  });

  it("gives everyone the same four tricks in a week, in a different order per attempt", () => {
    const week = weekStart(new Date("2026-10-28T12:00:00Z"));
    expect(week).toBe("2026-10-26");
    const set = weeklyTricks(week);
    expect(new Set(set).size).toBe(4);
    expect(weeklyTricks(week)).toEqual(set);
    const a = makePlan("trick_combo", rngFrom(3), set) as ComboPlan;
    expect([...a.tricks].sort()).toEqual([...set].sort());
  });

  it("starts weeks on Monday", () => {
    expect(weekStart(new Date("2026-11-01T23:59:00Z"))).toBe("2026-10-26");
    expect(weekStart(new Date("2026-11-02T00:00:00Z"))).toBe("2026-11-02");
  });

  it("makes readable duel codes", () => {
    const code = makeDuelCode(rngFrom(9));
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
});

describe("clip checks", () => {
  const started = Date.UTC(2026, 9, 28, 12, 0, 0);

  it("reads length and creation time from a MOV header", () => {
    const info = readClipInfo(mov(42, started / 1000 + 2));
    expect(info).toEqual({ durationMs: 42_000, createdAtMs: started + 2_000 });
  });

  it("rejects files with no header", () => {
    expect(readClipInfo(new Uint8Array(64))).toBeNull();
    expect(checkClip(null, "longest_sit", started, started + 60_000)).toEqual({ ok: false, reason: "unreadable" });
  });

  it("accepts a clip that fits the session", () => {
    const info = { durationMs: 50_000, createdAtMs: started + 1_000 };
    expect(checkClip(info, "longest_sit", started, started + 70_000)).toEqual({ ok: true });
  });

  it("rejects a clip longer than the time since the attempt began", () => {
    const info = { durationMs: 90_000, createdAtMs: started + 1_000 };
    expect(checkClip(info, "longest_sit", started, started + 60_000)).toEqual({ ok: false, reason: "longer_than_session" });
  });

  it("rejects a clip made before the attempt", () => {
    const info = { durationMs: 30_000, createdAtMs: started - 3_600_000 };
    expect(checkClip(info, "trick_combo", started, started + 60_000)).toEqual({ ok: false, reason: "old_clip" });
  });

  it("rejects clips that are too short or too long for the game", () => {
    expect(checkClip({ durationMs: 4_000, createdAtMs: null }, "trick_combo", started, started + 60_000)).toEqual({ ok: false, reason: "too_short" });
    expect(checkClip({ durationMs: 200_000, createdAtMs: null }, "trick_combo", started, started + 400_000)).toEqual({ ok: false, reason: "too_long" });
  });
});

describe("judging a sit", () => {
  const plan: SitPlan = {
    kind: "longest_sit",
    capMs: 180_000,
    chimes: [
      { atMs: 10_000, sound: "squeak" },
      { atMs: 30_000, sound: "doorbell" },
      { atMs: 50_000, sound: "bounce" },
      { atMs: 70_000, sound: "whistle" },
    ],
  };

  it("scores from the sit (or GO) to the break, in whole seconds", () => {
    const o = seen({ sitStartAtS: 9.2, sitBreakAtS: 74.9, soundsAtS: [18.3, 38.6, 57.9, 78.2] });
    // Break at 74.9 means the 4th sound (at 78s) is after the hold and not expected.
    expect(judgeSit(plan, o, 90_000)).toEqual({ status: "scored", scoreMs: 65_000, reason: null });
  });

  it("counts to the end of the clip when the dog is still sitting", () => {
    const o = seen({ sitStartAtS: 5, soundsAtS: [18, 38] });
    expect(judgeSit(plan, o, 45_000)).toEqual({ status: "scored", scoreMs: 37_000, reason: null });
  });

  it("caps the score", () => {
    const o = seen({ sitStartAtS: 8, soundsAtS: [18, 38, 58, 78] });
    expect(judgeSit(plan, o, 200_000).scoreMs).toBe(180_000);
  });

  it("holds a clip whose sounds are not where the plan put them", () => {
    const o = seen({ sitStartAtS: 9, sitBreakAtS: 60, soundsAtS: [25, 44] });
    expect(judgeSit(plan, o, 70_000)).toEqual({ status: "needs_review", scoreMs: null, reason: "sounds_off" });
  });

  it("forgives one missed sound out of four or more", () => {
    const o = seen({ sitStartAtS: 9, soundsAtS: [18, 38, 58] });
    expect(soundsMatch(plan, o, 100).ok).toBe(true);
  });

  it("does not count a sit the owner held in place", () => {
    const o = seen({ ownerTouchedDogAtS: 20, soundsAtS: [18, 38] });
    expect(judgeSit(plan, o, 45_000).reason).toBe("touched");
  });

  it("holds for review when the code word is not heard", () => {
    expect(judgeSit(plan, seen({ codeWordHeard: false }), 30_000)).toEqual({ status: "needs_review", scoreMs: null, reason: "code_not_heard" });
  });

  it("rejects another dog and never-sat clips", () => {
    expect(judgeSit(plan, seen({ sameDog: "no" }), 30_000).reason).toBe("other_dog");
    expect(judgeSit(plan, seen({ sitStartAtS: -1 }), 30_000).reason).toBe("never_sat");
  });

  it("holds an unsure reading", () => {
    expect(judgeSit(plan, seen({ confidence: 0.3 }), 30_000).status).toBe("needs_review");
  });
});

describe("judging a combo", () => {
  const plan: ComboPlan = { kind: "trick_combo", capMs: 60_000, tricks: ["spin", "paw", "down", "bow"] };

  it("times GO to the last trick, allowing extra moves in between", () => {
    const o = seen({
      goChimeAtS: 8,
      tricks: [
        { trick: "spin", doneAtS: 10.4 },
        { trick: "sit", doneAtS: 11 },
        { trick: "paw", doneAtS: 12.9 },
        { trick: "down", doneAtS: 15.2 },
        { trick: "bow", doneAtS: 19.46 },
      ],
    });
    expect(judgeCombo(plan, o)).toEqual({ status: "scored", scoreMs: 11_500, reason: null });
  });

  it("does not count tricks done before GO", () => {
    const o = seen({
      goChimeAtS: 8,
      tricks: [
        { trick: "spin", doneAtS: 6 },
        { trick: "paw", doneAtS: 9 },
        { trick: "down", doneAtS: 11 },
        { trick: "bow", doneAtS: 13 },
      ],
    });
    expect(judgeCombo(plan, o)).toEqual({ status: "invalid", scoreMs: null, reason: "no_tricks" });
  });

  it("rejects the wrong order", () => {
    const o = seen({
      tricks: [
        { trick: "paw", doneAtS: 10 },
        { trick: "spin", doneAtS: 12 },
        { trick: "down", doneAtS: 14 },
        { trick: "bow", doneAtS: 16 },
      ],
    });
    expect(judgeCombo(plan, o).status).toBe("invalid");
  });
});

describe("duels and parsing", () => {
  it("picks winners by the game's direction", () => {
    expect(duelOutcome("longest_sit", 40_000, 30_000).winner).toBe("host");
    expect(duelOutcome("trick_combo", 14_000, 11_000).winner).toBe("guest");
    expect(duelOutcome("trick_combo", 12_000, 12_000).winner).toBe("draw");
    expect(duelOutcome("longest_sit", null, 10_000).winner).toBe("guest");
    expect(duelOutcome("longest_sit", null, null).winner).toBe("none");
  });

  it("reads a partial reply as not seen, never as a pass", () => {
    const o = parseObservation({ goChimeAtS: 8, tricks: [{ trick: "spin" }] });
    expect(o.codeWordHeard).toBe(false);
    expect(o.dogVisible).toBe("poor");
    expect(o.tricks).toEqual([]);
    expect(judgeSit({ kind: "longest_sit", capMs: 180_000, chimes: [] }, o, 30_000).status).toBe("needs_review");
  });
});
