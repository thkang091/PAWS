/**
 * Arena games: Longest Sit (longest hold wins) and Trick Combo (fastest finish wins).
 *
 * Everything here is pure so it can be tested without Deno, Supabase or Gemini. The edge function supplies randomness,
 * time and the parsed video, and stores what these functions return.
 *
 * How a clip earns a score:
 *  1. The server starts an attempt and picks a code word plus the plan (when the distraction sounds play, or the order
 *     of the tricks). The phone only learns them once recording is about to begin.
 *  2. The phone records in the app: the owner says the code word and shows empty hands, then a GO chime starts play.
 *  3. The server checks the file (length against the time since start, the date it was made), then Gemini reports what
 *     it saw and heard with timestamps. Gemini never decides the result; `judgeSit` and `judgeCombo` do.
 */

export type ArenaGame = "longest_sit" | "trick_combo";
export type ArenaStatus = "started" | "judging" | "scored" | "needs_review" | "invalid" | "expired";

export const SOUNDS = ["squeak", "doorbell", "bounce", "whistle"] as const;
export type SoundKind = (typeof SOUNDS)[number];

export const TRICKS = ["sit", "down", "spin", "paw", "touch", "bow"] as const;
export type Trick = (typeof TRICKS)[number];

export type SitPlan = { kind: "longest_sit"; capMs: number; chimes: { atMs: number; sound: SoundKind }[] };
export type ComboPlan = { kind: "trick_combo"; capMs: number; tricks: Trick[] };
export type ArenaPlan = SitPlan | ComboPlan;

export const RULES = {
  longest_sit: { capMs: 180_000, setupMs: 20_000, triesPerDay: 5 },
  trick_combo: { capMs: 60_000, setupMs: 20_000, triesPerDay: 5 },
} as const;

/** Tries per player in one duel; the best scored one counts. */
export const DUEL_TRIES = 2;
export const DUEL_HOURS = 48;
/** Seconds of slack between the clip's own length and the time the server saw pass since the attempt began. */
export const CLOCK_SLACK_MS = 4_000;

export const REWARDS = {
  personalBestSilver: 10,
  duelWinSilver: 20,
  duelPlayedSilver: 5,
  /** Gold for the week's top three, only when enough dogs took part for a rank to mean something. */
  weeklyGold: [15, 10, 5],
  weeklyMinDogs: 5,
} as const;

/** Short, distinct, easy to say words. No two sound alike. */
export const CODE_WORDS = [
  "MANGO", "PICKLE", "ROCKET", "WAFFLE", "BANJO", "TACO", "COMET", "PEPPER", "BISCUIT", "CACTUS",
  "NOODLE", "PIRATE", "TURNIP", "VIOLIN", "WALRUS", "YOGURT", "ZEBRA", "ANCHOR", "BUTTON", "CANDLE",
  "DRAGON", "FALCON", "GUITAR", "HAMMOCK", "IGLOO", "JUNGLE", "KETTLE", "LEMON", "MUFFIN", "NUTMEG",
  "OCTOPUS", "PANDA", "QUILT", "RADISH", "SAILOR", "TEAPOT", "UMBRELLA", "VELVET", "WIZARD", "MAPLE",
  "PRETZEL", "SUNFLOWER", "THUNDER", "TOMATO", "VOLCANO", "PEACOCK", "PUMPKIN", "SNOWMAN", "BALLOON", "COCONUT",
] as const;

export type Rng = () => number;

const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

export const shuffle = <T>(items: readonly T[], rng: Rng): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Monday of the UTC week holding `at`, as YYYY-MM-DD. Weekly boards run Monday to Sunday. */
export const weekStart = (at: Date): string => {
  const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const offset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - offset);
  return day.toISOString().slice(0, 10);
};

/** A small deterministic generator so everyone gets the same tricks in a given week. */
const seeded = (seed: string): Rng => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
};

/** The four tricks of the week: the same set for every player so times compare fairly. */
export const weeklyTricks = (week: string): Trick[] => shuffle(TRICKS, seeded(`paws-combo-${week}`)).slice(0, 4);

/**
 * Distraction sounds for a sit: four to six, at least 14 seconds apart, never in the first 8 seconds. Random per
 * attempt, so a clip made earlier cannot have them in the right places.
 */
export const sitChimes = (rng: Rng, capMs: number = RULES.longest_sit.capMs): SitPlan["chimes"] => {
  const count = 4 + Math.floor(rng() * 3);
  const first = 8_000;
  const gap = 14_000;
  const room = capMs - 6_000 - first - gap * (count - 1);
  const offsets = Array.from({ length: count }, () => Math.floor(rng() * Math.max(0, room)))
    .sort((a, b) => a - b)
    .map((extra, i) => first + extra + gap * i);
  return offsets.map((atMs) => ({ atMs, sound: pick(SOUNDS, rng) }));
};

export const makePlan = (game: ArenaGame, rng: Rng, tricks?: readonly Trick[]): ArenaPlan =>
  game === "longest_sit"
    ? { kind: "longest_sit", capMs: RULES.longest_sit.capMs, chimes: sitChimes(rng) }
    : { kind: "trick_combo", capMs: RULES.trick_combo.capMs, tricks: shuffle(tricks ?? [], rng) };

export const makeCode = (rng: Rng) => pick(CODE_WORDS, rng);

/** Six characters people can read aloud: no 0/O or 1/I. */
export const makeDuelCode = (rng: Rng) => Array.from({ length: 6 }, () => pick("ABCDEFGHJKLMNPQRSTUVWXYZ23456789".split(""), rng)).join("");

// ---------- Reading the clip itself ----------

/** Seconds between 1904-01-01 (QuickTime epoch) and 1970-01-01. */
const QT_EPOCH = 2_082_844_800;

export type ClipInfo = { durationMs: number; createdAtMs: number | null };

/**
 * Reads length and creation time from the `moov/mvhd` box of an MP4 or MOV. Returns null when the file has no
 * readable header, which the server treats as a broken upload.
 */
export const readClipInfo = (bytes: Uint8Array): ClipInfo | null => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = (at: number) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);

  const findBox = (start: number, end: number, wanted: string): [number, number] | null => {
    let at = start;
    while (at + 8 <= end) {
      let size = view.getUint32(at);
      let header = 8;
      if (size === 1) {
        if (at + 16 > end) return null;
        size = Number(view.getBigUint64(at + 8));
        header = 16;
      } else if (size === 0) {
        size = end - at;
      }
      if (size < header) return null;
      if (type(at + 4) === wanted) return [at + header, Math.min(end, at + size)];
      at += size;
    }
    return null;
  };

  const moov = findBox(0, bytes.byteLength, "moov");
  if (!moov) return null;
  const mvhd = findBox(moov[0], moov[1], "mvhd");
  if (!mvhd) return null;
  const at = mvhd[0];
  const version = bytes[at];
  let created: number;
  let timescale: number;
  let duration: number;
  if (version === 1) {
    if (at + 32 > mvhd[1]) return null;
    created = Number(view.getBigUint64(at + 4));
    timescale = view.getUint32(at + 20);
    duration = Number(view.getBigUint64(at + 24));
  } else {
    if (at + 20 > mvhd[1]) return null;
    created = view.getUint32(at + 4);
    timescale = view.getUint32(at + 12);
    duration = view.getUint32(at + 16);
  }
  if (!timescale) return null;
  return {
    durationMs: Math.round((duration / timescale) * 1000),
    createdAtMs: created > QT_EPOCH ? (created - QT_EPOCH) * 1000 : null,
  };
};

export type ClipCheck = { ok: true } | { ok: false; reason: "unreadable" | "too_short" | "too_long" | "longer_than_session" | "old_clip" };

/**
 * The clip must be about as long as the time that really passed since the attempt began: a longer clip was made
 * earlier, a clip made before the attempt was not made for it.
 */
export const checkClip = (info: ClipInfo | null, game: ArenaGame, startedAtMs: number, receivedAtMs: number): ClipCheck => {
  if (!info) return { ok: false, reason: "unreadable" };
  const rules = RULES[game];
  if (info.durationMs < 8_000) return { ok: false, reason: "too_short" };
  if (info.durationMs > rules.capMs + rules.setupMs + 15_000) return { ok: false, reason: "too_long" };
  if (info.durationMs > receivedAtMs - startedAtMs + CLOCK_SLACK_MS) return { ok: false, reason: "longer_than_session" };
  if (info.createdAtMs != null && (info.createdAtMs < startedAtMs - 15_000 || info.createdAtMs > receivedAtMs + 15_000)) {
    return { ok: false, reason: "old_clip" };
  }
  return { ok: true };
};

// ---------- What Gemini reports ----------

/** Gemini's observations. Times are seconds from the start of the clip; -1 means not seen or heard. */
export type Observation = {
  codeWordHeard: boolean;
  handsShownEmpty: boolean;
  goChimeAtS: number;
  dogVisible: "whole" | "mostly" | "poor";
  sameDog: "yes" | "no" | "unsure" | "no_reference";
  ownerTouchedDogAtS: number;
  soundsAtS: number[];
  sitStartAtS: number;
  sitBreakAtS: number;
  tricks: { trick: string; doneAtS: number }[];
  confidence: number;
  summary: string;
};

export const OBSERVATION_SCHEMA = {
  type: "object",
  properties: {
    codeWordHeard: { type: "boolean" },
    handsShownEmpty: { type: "boolean" },
    goChimeAtS: { type: "number" },
    dogVisible: { type: "string", enum: ["whole", "mostly", "poor"] },
    sameDog: { type: "string", enum: ["yes", "no", "unsure", "no_reference"] },
    ownerTouchedDogAtS: { type: "number" },
    soundsAtS: { type: "array", items: { type: "number" } },
    sitStartAtS: { type: "number" },
    sitBreakAtS: { type: "number" },
    tricks: {
      type: "array",
      items: { type: "object", properties: { trick: { type: "string" }, doneAtS: { type: "number" } }, required: ["trick", "doneAtS"] },
    },
    confidence: { type: "number" },
    summary: { type: "string" },
  },
  required: [
    "codeWordHeard", "handsShownEmpty", "goChimeAtS", "dogVisible", "sameDog", "ownerTouchedDogAtS",
    "soundsAtS", "sitStartAtS", "sitBreakAtS", "tricks", "confidence", "summary",
  ],
} as const;

const TRICK_WORDS: Record<Trick, string> = {
  sit: "sit: hips on the floor, front legs straight",
  down: "down: elbows and chest on the floor",
  spin: "spin: one full circle on the spot",
  paw: "paw: lifts a front paw into the owner's hand",
  touch: "touch: nose bumps the owner's open palm",
  bow: "bow: front end down, rear end up, briefly",
};

/** The instructions for Gemini: describe what happens, with times. It is never told the expected answer. */
export const observerPrompt = (game: ArenaGame, codeWord: string, hasReference: boolean) => `You are a careful video observer for a dog game in the PAWS app. Report only what is visible or audible in this one phone clip, with times in seconds from the start of the clip. Use -1 for anything you cannot see or hear. Do not guess.

The owner and dog are filmed with the phone's front camera. The clip begins with a setup: the owner says a code word out loud and shows both open hands to the camera. Then the phone plays a bright three-note GO chime and the game starts.

Report:
- codeWordHeard: true only if you clearly hear a person say the word "${codeWord}" (any accent) before the GO chime.
- handsShownEmpty: true if the owner shows both open, empty hands to the camera before the GO chime.
- goChimeAtS: when the three-note GO chime starts.
- dogVisible: "whole" if the whole dog stays in frame after GO, "mostly" if parts leave frame briefly, "poor" if the dog is often out of frame, too dark or blocked.
- sameDog: ${hasReference ? 'compare the dog with the reference photo given first: "yes", "no" or "unsure".' : '"no_reference".'}
- ownerTouchedDogAtS: the first time after GO that a person's hand or body pushes, holds or physically places the dog. Handing a treat or a light pat after the game ends is not touching. -1 if never.
- soundsAtS: every short sound effect played by the phone after GO (a squeak toy, a doorbell, a bouncing ball, a whistle). Not speech, not the GO chime.
${game === "longest_sit"
    ? `- sitStartAtS: when the dog's hips settle on the floor in a sit (if already sitting at GO, the time of GO).
- sitBreakAtS: the first time after sitting that the dog stands up, lies down, or walks away. -1 if the dog is still sitting when the clip ends.
- tricks: an empty array.`
    : `- sitStartAtS and sitBreakAtS: -1.
- tricks: every trick the dog completes after GO, in the order they happen, each with the time it was completed. Use only these names:
${TRICKS.map((t) => `  - ${TRICK_WORDS[t]}`).join("\n")}
  A trick counts when it is clearly finished. If the dog offers the same trick twice, list it twice.`}
- confidence: 0 to 1, how sure you are of the times above.
- summary: one short plain sentence about what happened.

Return JSON only.`;

// ---------- Turning observations into a result ----------

export type Verdict = {
  status: "scored" | "needs_review" | "invalid";
  scoreMs: number | null;
  reason: string | null;
};

const MIN_CONFIDENCE = 0.55;
const SOUND_TOLERANCE_S = 1.6;

/** Shared evidence checks: a clear rule break is invalid, missing or unclear evidence is held for a person to check. */
const evidence = (o: Observation): Verdict | null => {
  if (o.sameDog === "no") return { status: "invalid", scoreMs: null, reason: "other_dog" };
  if (o.goChimeAtS < 0) return { status: "needs_review", scoreMs: null, reason: "no_go_chime" };
  if (!o.codeWordHeard) return { status: "needs_review", scoreMs: null, reason: "code_not_heard" };
  if (!o.handsShownEmpty) return { status: "needs_review", scoreMs: null, reason: "hands_not_shown" };
  if (o.dogVisible === "poor") return { status: "needs_review", scoreMs: null, reason: "dog_not_visible" };
  if (!(o.confidence >= MIN_CONFIDENCE)) return { status: "needs_review", scoreMs: null, reason: "unclear" };
  return null;
};

/** How many planned sounds were heard where they should be. One miss is forgiven when there are four or more. */
export const soundsMatch = (plan: SitPlan, o: Observation, clipEndS: number) => {
  const expected = plan.chimes.map((c) => o.goChimeAtS + c.atMs / 1000).filter((t) => t < clipEndS - 1);
  const heard = expected.filter((t) => o.soundsAtS.some((s) => Math.abs(s - t) <= SOUND_TOLERANCE_S)).length;
  const allowed = expected.length >= 4 ? 1 : 0;
  return { expected: expected.length, heard, ok: heard >= expected.length - allowed };
};

export const judgeSit = (plan: SitPlan, o: Observation, clipMs: number): Verdict => {
  const early = evidence(o);
  if (early) return early;
  const clipEndS = clipMs / 1000;
  if (o.sitStartAtS < 0) return { status: "invalid", scoreMs: null, reason: "never_sat" };
  const start = Math.max(o.sitStartAtS, o.goChimeAtS);
  const end = o.sitBreakAtS >= 0 ? Math.min(o.sitBreakAtS, clipEndS) : clipEndS;
  if (end <= start) return { status: "invalid", scoreMs: null, reason: "never_sat" };
  if (o.ownerTouchedDogAtS >= 0 && o.ownerTouchedDogAtS >= o.goChimeAtS && o.ownerTouchedDogAtS < end) {
    return { status: "invalid", scoreMs: null, reason: "touched" };
  }
  if (!soundsMatch(plan, o, end).ok) return { status: "needs_review", scoreMs: null, reason: "sounds_off" };
  const scoreMs = Math.min(plan.capMs, Math.floor(end - start) * 1000);
  return { status: "scored", scoreMs, reason: null };
};

/** The planned tricks must appear in order (other moves in between are fine); the score is GO to the last one. */
export const judgeCombo = (plan: ComboPlan, o: Observation): Verdict => {
  const early = evidence(o);
  if (early) return early;
  if (o.ownerTouchedDogAtS >= 0 && o.ownerTouchedDogAtS >= o.goChimeAtS) return { status: "invalid", scoreMs: null, reason: "touched" };
  const after = o.tricks
    .filter((t) => t.doneAtS >= o.goChimeAtS)
    .sort((a, b) => a.doneAtS - b.doneAtS);
  let next = 0;
  let lastAt = -1;
  for (const t of after) {
    if (next < plan.tricks.length && t.trick.toLowerCase() === plan.tricks[next]) {
      lastAt = t.doneAtS;
      next++;
    }
  }
  if (next < plan.tricks.length) return { status: "invalid", scoreMs: null, reason: next === 0 ? "no_tricks" : "missed_trick" };
  const ms = Math.round((lastAt - o.goChimeAtS) * 10) * 100;
  if (ms <= 0) return { status: "invalid", scoreMs: null, reason: "no_tricks" };
  if (ms > plan.capMs) return { status: "invalid", scoreMs: null, reason: "too_slow" };
  return { status: "scored", scoreMs: ms, reason: null };
};

/** Higher wins for a sit, lower wins for a combo. */
export const better = (game: ArenaGame, a: number, b: number) => (game === "longest_sit" ? a > b : a < b);

export type DuelOutcome = { winner: "host" | "guest" | "draw" | "none" };

export const duelOutcome = (game: ArenaGame, host: number | null, guest: number | null): DuelOutcome => {
  if (host == null && guest == null) return { winner: "none" };
  if (host == null) return { winner: "guest" };
  if (guest == null) return { winner: "host" };
  if (host === guest) return { winner: "draw" };
  return { winner: better(game, host, guest) ? "host" : "guest" };
};

/** Parses Gemini's JSON, filling anything missing with "not seen" so a partial reply is never read as a pass. */
export const parseObservation = (value: unknown): Observation => {
  const o = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : -1);
  const pickOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  return {
    codeWordHeard: o.codeWordHeard === true,
    handsShownEmpty: o.handsShownEmpty === true,
    goChimeAtS: num(o.goChimeAtS),
    dogVisible: pickOf(o.dogVisible, ["whole", "mostly", "poor"] as const, "poor"),
    sameDog: pickOf(o.sameDog, ["yes", "no", "unsure", "no_reference"] as const, "unsure"),
    ownerTouchedDogAtS: num(o.ownerTouchedDogAtS),
    soundsAtS: Array.isArray(o.soundsAtS) ? o.soundsAtS.map(num).filter((n) => n >= 0) : [],
    sitStartAtS: num(o.sitStartAtS),
    sitBreakAtS: num(o.sitBreakAtS),
    tricks: Array.isArray(o.tricks)
      ? o.tricks
          .map((t) => (t && typeof t === "object" ? (t as Record<string, unknown>) : {}))
          .map((t) => ({ trick: typeof t.trick === "string" ? t.trick : "", doneAtS: num(t.doneAtS) }))
          .filter((t) => t.trick && t.doneAtS >= 0)
      : [],
    confidence: typeof o.confidence === "number" ? o.confidence : 0,
    summary: typeof o.summary === "string" ? o.summary.slice(0, 400) : "",
  };
};
