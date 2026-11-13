/**
 * DogPhotoPoseDiscoveryService, the pure part: what PAWS asks Gemini for, how every answer is checked, and which ideas
 * are kept. Shared by the `media` edge function (which calls Gemini with the server's key) and the app's tests.
 *
 *   buildDiscoveryRequest   the generateContent body: a versioned JSON schema, the rules, ideas to avoid
 *   parseDiscovery          validate every idea against "pose-concept-v1", screen it for safety, drop repeats
 *   validatePose            one idea, field by field; anything malformed is rejected with its reasons
 *   screenSafety            reject what is unsafe for a dog, flag what an organizer should look at
 *   dedupe                  near-repeats of each other or of ideas PAWS already has are dropped
 *   buildReferenceRequest   the prompt for an example photo from an image model
 *
 * Gemini's ideas are inspiration, not evidence of a trend: trend fields are always cleared, because PAWS has no
 * authorized trend data source. Every idea starts as "suggested" whatever the model says; only an organizer
 * approves or publishes.
 */

import { BASE_CRITERIA, type Criterion, type CriterionKind } from "./entryCheck.ts";

export const POSE_SCHEMA_VERSION = "pose-concept-v1";
export const POSE_PROMPT_VERSION = "pose-discovery-v1";
export const REFERENCE_PROMPT_VERSION = "pose-reference-v1";

export const POSE_CATEGORIES = ["funny", "cute", "matching", "creative", "trick"] as const;
export type PoseCategory = (typeof POSE_CATEGORIES)[number];
export const POSE_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type PoseDifficulty = (typeof POSE_DIFFICULTIES)[number];

/** What an organizer can ask for. "mixed" asks for a spread of categories. */
export const POSE_THEMES = ["mixed", ...POSE_CATEGORIES] as const;
export type PoseTheme = (typeof POSE_THEMES)[number];
export type BatchDifficulty = "easy" | "medium" | "mixed";

export const BATCH_LIMITS = { min: 5, max: 10 } as const;

/** The always-present safety note. Dogs can always walk out of a pose. */
export const LEAVE_NOTE = "Let your dog leave the pose whenever they want.";

/** One idea, as PAWS stores it. */
export type PoseConcept = {
  sourceId: string;
  title: string;
  description: string;
  category: PoseCategory;
  difficulty: PoseDifficulty;
  setupMinutes: number;
  participants: number;
  requiredObjects: string[];
  dogRequirements: string[];
  ownerPosition: string;
  dogPosition: string;
  cameraAngle: string;
  framing: string;
  instructions: string[];
  criteria: Criterion[];
  safetyNotes: string[];
  safetyFlags: string[];
  visualReferencePrompt: string;
  shareability: string;
  fingerprint: string;
  trendSource: null;
  trendVerifiedAt: null;
  reviewStatus: "suggested";
};

export type Rejection = { title: string; reasons: string[] };

// ---------- Validation ----------

const str = (v: unknown, min: number, max: number) => (typeof v === "string" && v.trim().length >= min && v.trim().length <= max ? v.trim().replace(/\s+/g, " ") : null);
const strList = (v: unknown, min: number, max: number, each: number) => {
  if (!Array.isArray(v) || v.length < min || v.length > max) return null;
  const out = v.map((x) => str(x, 1, each));
  return out.every((x): x is string => x !== null) ? out : null;
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

/** Accepts 5, "5", "5 minutes", "about 5 min". */
const minutes = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number((v.match(/\d+/) ?? [])[0]) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 30 ? n : null;
};

const KINDS: readonly CriterionKind[] = ["dog_visible", "owner_visible", "same_frame", "pose"];

/** The model's criteria plus the three base checks, each with a stable id. */
const criteriaOf = (v: unknown): Criterion[] | null => {
  if (!Array.isArray(v) || v.length < 1 || v.length > 6) return null;
  const pose: Criterion[] = [];
  for (const item of v) {
    const label = str(typeof item === "string" ? item : (item as { label?: unknown })?.label, 6, 120);
    const kindRaw = typeof item === "string" ? "pose" : (item as { kind?: unknown })?.kind;
    const kind = KINDS.includes(kindRaw as CriterionKind) ? (kindRaw as CriterionKind) : "pose";
    if (!label) return null;
    if (kind !== "pose") continue;
    const id = `pose_${slug(label)}`.slice(0, 40);
    if (!pose.some((c) => c.id === id)) pose.push({ id, label, kind });
  }
  if (!pose.length) return null;
  return [...BASE_CRITERIA, ...pose.slice(0, 3)];
};

/** One idea from the model, checked field by field against pose-concept-v1. */
/** `ok` with the idea, or not `ok` with the reasons. One flat shape, so callers under any compiler settings can read it. */
export type PoseCheck = { ok: boolean; pose: PoseConcept | null; title: string; reasons: string[] };

export const validatePose = (raw: unknown): PoseCheck => {
  const r = (raw ?? {}) as Record<string, unknown>;
  const reasons: string[] = [];
  const need = <T,>(value: T | null, field: string): T => {
    if (value === null) reasons.push(`invalid ${field}`);
    return value as T;
  };
  const title = need(str(r.title, 3, 48), "title");
  const description = need(str(r.short_description, 10, 200), "short_description");
  const category = need(POSE_CATEGORIES.includes(r.pose_category as PoseCategory) ? (r.pose_category as PoseCategory) : null, "pose_category");
  const difficulty = need(POSE_DIFFICULTIES.includes(r.difficulty as PoseDifficulty) ? (r.difficulty as PoseDifficulty) : null, "difficulty");
  const setupMinutes = need(minutes(r.estimated_setup_time), "estimated_setup_time");
  const participants = need(Number.isInteger(r.required_participants) && (r.required_participants as number) >= 1 && (r.required_participants as number) <= 2 ? (r.required_participants as number) : null, "required_participants");
  const requiredObjects = need(strList(r.required_objects ?? [], 0, 4, 40), "required_objects");
  const dogRequirements = need(strList(r.dog_requirements ?? [], 0, 4, 80), "dog_requirements");
  const ownerPosition = need(str(r.owner_position, 3, 200), "owner_position");
  const dogPosition = need(str(r.dog_position, 3, 200), "dog_position");
  const cameraAngle = need(str(r.camera_angle, 3, 160), "camera_angle");
  const framing = need(str(r.framing_instructions, 3, 200), "framing_instructions");
  const instructions = need(strList(r.step_by_step_instructions, 2, 8, 160), "step_by_step_instructions");
  const criteria = need(criteriaOf(r.objective_verification_criteria), "objective_verification_criteria");
  const safetyNotes = need(strList(r.safety_considerations, 1, 5, 160), "safety_considerations");
  const visualReferencePrompt = need(str(r.visual_reference_prompt, 20, 700), "visual_reference_prompt");
  const shareability = need(str(r.shareability_rationale ?? "", 0, 240), "shareability_rationale");
  if (participants !== null && participants > 1) reasons.push("needs more than one person");
  if (reasons.length) return { ok: false, pose: null, title: typeof r.title === "string" ? r.title.slice(0, 48) : "Untitled", reasons };

  const notes = safetyNotes.some((n) => /leave|walk away|disengage|stop/i.test(n)) ? safetyNotes : [...safetyNotes, LEAVE_NOTE].slice(-5);
  const pose: PoseConcept = {
    sourceId: str(r.id, 1, 60) ?? slug(title),
    title,
    description,
    category,
    difficulty,
    setupMinutes,
    participants,
    requiredObjects,
    dogRequirements,
    ownerPosition,
    dogPosition,
    cameraAngle,
    framing,
    instructions,
    criteria,
    safetyNotes: notes,
    safetyFlags: [],
    visualReferencePrompt,
    shareability,
    fingerprint: fingerprint(title),
    // No authorized trend source: Gemini's ideas are never presented as verified trends.
    trendSource: null,
    trendVerifiedAt: null,
    reviewStatus: "suggested",
  };
  return { ok: true, pose, title, reasons: [] };
};

// ---------- Safety ----------

/** Never offered: risky for the dog, or needs the dog to be held or forced. */
const REJECT: readonly [RegExp, string][] = [
  [/\bjump(s|ing)?\b(?!\s*(for joy|in))/i, "jumping"],
  [/\bleap(s|ing)?\b/i, "jumping"],
  [/\bbalanc(e|es|ing)\b/i, "balancing"],
  [/\bhind legs\b|\bstand(s|ing)? up on (its|their|his|her) back legs\b/i, "standing on hind legs"],
  [/\b(lift|lifts|lifting|pick|picks|picking|carry|carries|carrying|hold|holds|holding)\s+(up\s+)?(the|your)\s+dog\b/i, "lifting or holding the dog"],
  [/\bhold(s|ing)? (the|your) dog('s)? (still|in place|down|paws?|head)\b/i, "holding the dog in place"],
  [/\brestrain(t|ed|ing)?\b|\btie(d)? (up|down)\b|\bmuzzle\b|\btape\b/i, "restraint"],
  [/\b(on|onto) (a |the |your )?([a-z]+ )?(table|counter|countertop|ledge|railing|roof|wall|shelf|ladder)s?\b/i, "raised or unsafe surface"],
  [/\bchocolate\b|\bgrapes?\b|\braisins?\b|\bonions?\b|\bxylitol\b|\bmacadamia\b|\balcohol\b|\bwine\b|\bbeer\b/i, "food that is toxic to dogs"],
  [/\b(two|three|several|multiple|other) (people|persons|helpers)\b|\bsecond person\b|\bhelper holds\b/i, "needs extra people"],
  [/\bfire\b|\bcandles?\b|\bfireworks?\b|\bsparklers?\b|\bknife\b|\bscissors\b|\bballoons?\b/i, "dangerous object"],
  [/\bin (the )?(traffic|road|street)\b/i, "traffic"],
];

/** Allowed, but an organizer must confirm before approving. */
const FLAG: readonly [RegExp, string][] = [
  [/\bcostumes?\b|\bdress(ed)? up\b|\boutfits?\b|\bwigs?\b/i, "costume: the dog must be comfortable and free to shake it off"],
  [/\bhats?\b|\bsunglasses\b|\bglasses\b|\bbow ties?\b|\bbandanas?\b|\bscar(f|ves)\b|\baccessor(y|ies)\b/i, "accessory: comfortable, loose and quick to remove"],
  [/\bwater\b|\bpool\b|\blake\b|\bbath\b|\bsea\b|\bbeach\b/i, "water nearby"],
  [/\bstairs?\b|\bstaircase\b|\bsofa\b|\bcouch\b|\bbed\b/i, "furniture or steps: keep it low and familiar"],
  [/\bcar\b|\bbike\b|\bscooter\b|\bskateboard\b/i, "vehicle nearby"],
  [/\broll over\b|\bplay dead\b|\bbeg\b|\bspin\b|\bweave\b|\bbow\b(?! tie)/i, "needs a trained trick"],
  [/\bhug(s|ging)?\b|\bsqueez/i, "close contact: many dogs dislike hugs"],
  [/\bstare|\beye contact\b|\bnose to nose\b|\bface to face\b/i, "face to face: some dogs find it stressful"],
  [/\bsnow\b|\bhot\b|\bsun\b|\bheat\b/i, "weather: watch heat and cold"],
];

const textOf = (p: PoseConcept) =>
  [p.title, p.description, p.ownerPosition, p.dogPosition, p.framing, p.cameraAngle, ...p.instructions, ...p.requiredObjects, ...p.dogRequirements, p.visualReferencePrompt].join(" \n ");

export type SafetyVerdict = { verdict: "ok" | "flag" | "reject"; reasons: string[] };

export const screenSafety = (p: PoseConcept): SafetyVerdict => {
  const t = textOf(p);
  const rejected = [...new Set(REJECT.filter(([re]) => re.test(t)).map(([, why]) => why))];
  if (rejected.length) return { verdict: "reject", reasons: rejected };
  const flags = [...new Set(FLAG.filter(([re]) => re.test(t)).map(([, why]) => why))];
  if (p.difficulty === "hard") flags.push("hard: most owners can't recreate it quickly");
  if (p.dogRequirements.length > 2) flags.push("asks a lot of the dog");
  if (p.setupMinutes > 15) flags.push("long setup");
  return { verdict: flags.length ? "flag" : "ok", reasons: flags };
};

// ---------- Repeats ----------

const STOP = new Set(["the", "a", "an", "and", "of", "to", "with", "your", "my", "dog", "dogs", "owner", "pose", "duo", "together", "same", "in", "on", "for", "photo", "pup", "pups", "puppy", "&", "x"]);

export const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .map((w) => w.replace(/(ing|es|s)$/, ""))
    .filter((w) => w.length > 1 && !STOP.has(w));

/** A short key for a title: its meaningful words, sorted. "Matching Head Tilts" and "Head tilt match" collide. */
export const fingerprint = (title: string) => [...new Set(tokens(title))].sort().join("-") || slug(title);

const jaccard = (a: readonly string[], b: readonly string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let both = 0;
  A.forEach((x) => B.has(x) && (both += 1));
  return both / (A.size + B.size - both);
};

export type KnownPose = { title: string; fingerprint?: string; dogPosition?: string; ownerPosition?: string };

export const DEDUPE_RULES = { title: 0.6, pose: 0.55 } as const;

/** Is this idea a near-repeat of one we know? Same fingerprint, very similar title, or the same arrangement. */
export const isRepeat = (p: Pick<PoseConcept, "title" | "fingerprint" | "dogPosition" | "ownerPosition">, known: KnownPose) => {
  if (p.fingerprint === (known.fingerprint ?? fingerprint(known.title))) return true;
  if (jaccard(tokens(p.title), tokens(known.title)) >= DEDUPE_RULES.title) return true;
  if (known.dogPosition && known.ownerPosition) {
    const a = tokens(`${p.title} ${p.dogPosition} ${p.ownerPosition}`);
    const b = tokens(`${known.title} ${known.dogPosition} ${known.ownerPosition}`);
    if (jaccard(a, b) >= DEDUPE_RULES.pose) return true;
  }
  return false;
};

/** Keeps the first of each near-repeat, and drops anything PAWS already has (in any status, rejected included). */
export const dedupe = (poses: readonly PoseConcept[], known: readonly KnownPose[]) => {
  const kept: PoseConcept[] = [];
  const dropped: Rejection[] = [];
  for (const p of poses) {
    if (known.some((k) => isRepeat(p, k)) || kept.some((k) => isRepeat(p, k))) dropped.push({ title: p.title, reasons: ["repeat of an existing idea"] });
    else kept.push(p);
  }
  return { kept, dropped };
};

// ---------- The Gemini request ----------

const S = (description?: string) => ({ type: "STRING", ...(description ? { description } : {}) });
const LIST = (description?: string) => ({ type: "ARRAY", items: { type: "STRING" }, ...(description ? { description } : {}) });

/** pose-concept-v1 as a Gemini response schema. Field names match the spec PAWS validates against. */
export const POSE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    poses: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: S("short kebab-case id"),
          title: S("2 to 5 words, cute and memorable"),
          short_description: S("one sentence, under 160 characters"),
          pose_category: { type: "STRING", enum: [...POSE_CATEGORIES] },
          difficulty: { type: "STRING", enum: [...POSE_DIFFICULTIES] },
          estimated_setup_time: { type: "INTEGER", description: "minutes" },
          required_participants: { type: "INTEGER", description: "people in the photo; always 1, the owner" },
          required_objects: LIST("everyday objects, or empty"),
          dog_requirements: LIST("what the dog needs to already do, or empty"),
          owner_position: S(),
          dog_position: S(),
          camera_angle: S(),
          framing_instructions: S(),
          step_by_step_instructions: LIST("2 to 6 short steps"),
          objective_verification_criteria: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { label: S("something visibly true in a finished photo"), kind: { type: "STRING", enum: ["pose"] } },
              required: ["label", "kind"],
            },
          },
          safety_considerations: LIST(),
          visual_reference_prompt: S("a description of the finished photo for an illustrator"),
          shareability_rationale: S(),
          trend_source: { type: "STRING", nullable: true },
          trend_verified_at: { type: "STRING", nullable: true },
          review_status: { type: "STRING", enum: ["suggested"] },
        },
        required: [
          "id", "title", "short_description", "pose_category", "difficulty", "estimated_setup_time", "required_participants",
          "required_objects", "dog_requirements", "owner_position", "dog_position", "camera_angle", "framing_instructions",
          "step_by_step_instructions", "objective_verification_criteria", "safety_considerations", "visual_reference_prompt",
          "shareability_rationale", "review_status",
        ],
      },
    },
  },
  required: ["poses"],
} as const;

const THEME_LINE: Record<PoseTheme, string> = {
  mixed: "Mix the categories: funny, cute, matching, creative and easy trick-based ideas.",
  funny: "Funny: playful mimicry, comic timing, harmless visual jokes and illusions.",
  cute: "Cute: wholesome, cosy, affectionate moments the dog enjoys.",
  matching: "Matching: the owner mirrors the dog's posture, gesture, gaze or accessories.",
  creative: "Creative: framing tricks, forced perspective, doorways, shadows, reflections, everyday props.",
  trick: "Trick-based: only tricks many pet dogs already know (sit, down, paw, look), never new or physical tricks.",
};

export type DiscoveryInput = { theme: PoseTheme; difficulty: BatchDifficulty; count: number; avoid: readonly string[] };

export const clampCount = (n: number) => Math.min(BATCH_LIMITS.max, Math.max(BATCH_LIMITS.min, Math.round(Number.isFinite(n) ? n : BATCH_LIMITS.min)));

export const buildDiscoveryPrompt = ({ theme, difficulty, count, avoid }: DiscoveryInput) =>
  [
    `Suggest ${clampCount(count)} original photo poses that a dog and its owner can recreate together in one photo.`,
    "Inspired by the style of popular social media dog photos (matching poses, funny mimicry, wholesome moments, simple illusions), but original. Do not name or copy specific creators, posts or accounts, and do not claim any idea is currently trending.",
    THEME_LINE[theme],
    difficulty === "mixed" ? "Mostly easy, some medium. Never hard." : `Difficulty: ${difficulty}.`,
    "",
    "Every pose must:",
    "- show exactly one dog and one adult owner together in one frame (the photo is taken with a timer or by a friend who is not in it)",
    "- be recognisable at a glance and look fun, cute or surprising",
    "- need only everyday objects, or none, at home or in a dog-friendly public place",
    "- let the dog stay in a natural, comfortable position it chooses, and walk away at any time",
    "- avoid jumping, balancing, standing on hind legs, lifting or holding the dog in place, restraints, forced costumes, raised surfaces, food that is unsafe for dogs, and complex training",
    "- have 2 to 6 short steps and 1 to 3 objective criteria that are visibly true in a finished photo (positions and directions, never cuteness)",
    "- be visually distinct from every other pose in this list",
    avoid.length ? `\nAlready in the PAWS library, do not repeat these or close variations:\n${avoid.slice(0, 80).map((t) => `- ${t}`).join("\n")}` : "",
    "\nLeave trend_source and trend_verified_at null. Set review_status to \"suggested\".",
  ].join("\n");

export const buildDiscoveryRequest = (input: DiscoveryInput) => ({
  contents: [{ role: "user", parts: [{ text: buildDiscoveryPrompt(input) }] }],
  generationConfig: { temperature: 1, responseMimeType: "application/json", responseSchema: POSE_RESPONSE_SCHEMA },
});

/** Validate, screen and dedupe a whole batch. A response that isn't the schema's JSON rejects the batch. */
export const parseDiscovery = (text: string | null | undefined, known: readonly KnownPose[], difficulty: BatchDifficulty = "mixed") => {
  let raw: unknown;
  try {
    raw = JSON.parse(text ?? "");
  } catch {
    return { ok: false as const, error: "invalid_json", accepted: [] as PoseConcept[], rejected: [] as Rejection[] };
  }
  const list = (raw as { poses?: unknown })?.poses;
  if (!Array.isArray(list)) return { ok: false as const, error: "schema_mismatch", accepted: [] as PoseConcept[], rejected: [] as Rejection[] };
  const rejected: Rejection[] = [];
  const valid: PoseConcept[] = [];
  for (const item of list.slice(0, BATCH_LIMITS.max * 2)) {
    const v = validatePose(item);
    if (!v.ok || !v.pose) {
      rejected.push({ title: v.title, reasons: v.reasons });
      continue;
    }
    const pose = v.pose;
    if (difficulty !== "mixed" && pose.difficulty !== difficulty) {
      rejected.push({ title: pose.title, reasons: [`asked for ${difficulty}, got ${pose.difficulty}`] });
      continue;
    }
    if (difficulty === "mixed" && pose.difficulty === "hard") {
      rejected.push({ title: pose.title, reasons: ["too hard to recreate"] });
      continue;
    }
    const s = screenSafety(pose);
    if (s.verdict === "reject") {
      rejected.push({ title: pose.title, reasons: s.reasons.map((r) => `unsafe: ${r}`) });
      continue;
    }
    valid.push({ ...pose, safetyFlags: s.reasons });
  }
  const { kept, dropped } = dedupe(valid, known);
  return { ok: true as const, error: null, accepted: kept.slice(0, BATCH_LIMITS.max), rejected: [...rejected, ...dropped] };
};

// ---------- Reference images ----------

/** The PAWS look for example photos: warm, bright, real, uncluttered. */
export const REFERENCE_STYLE =
  "Photorealistic candid lifestyle photograph. Soft natural daylight, warm cream and butter-yellow tones, clean uncluttered background, shallow depth of field. Exactly one adult and exactly one dog, both fully in frame, anatomically correct (one head, four legs and one tail for the dog; two arms and two hands for the person), relaxed and happy. The dog is in a natural, comfortable position. No text, logos, watermarks or brand names.";

export const buildReferencePrompt = (p: Pick<PoseConcept, "title" | "visualReferencePrompt" | "ownerPosition" | "dogPosition" | "cameraAngle" | "framing">) =>
  [
    `Example photo for a dog and owner photo challenge called "${p.title}".`,
    p.visualReferencePrompt,
    `Owner: ${p.ownerPosition}`,
    `Dog: ${p.dogPosition}`,
    `Camera: ${p.cameraAngle}. ${p.framing}`,
    REFERENCE_STYLE,
  ].join("\n");

export const buildReferenceRequest = (p: Parameters<typeof buildReferencePrompt>[0]) => ({
  contents: [{ role: "user", parts: [{ text: buildReferencePrompt(p) }] }],
  generationConfig: { responseModalities: ["IMAGE"] },
});

/** The first image in a generateContent response, or null. Never invents one. */
export const extractImage = (response: unknown): { mimeType: string; base64: string } | null => {
  const parts = (response as { candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[] })?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const d = part?.inlineData;
    if (d && typeof d.data === "string" && d.data.length > 1000 && (d.mimeType === "image/png" || d.mimeType === "image/jpeg")) return { mimeType: d.mimeType, base64: d.data };
  }
  return null;
};

/** Extra checks for a generated example: it must look physically real, not just show the pose. */
export const REFERENCE_CRITERIA: readonly Criterion[] = [
  { id: "ref_one_dog", label: "Exactly one dog, with a natural body (one head, four legs, one tail)", kind: "pose" },
  { id: "ref_one_person", label: "Exactly one person, with a natural body (two arms, two hands)", kind: "pose" },
];

// ---------- Editing ----------

/** The fields an organizer edits, checked with the same limits as Gemini's answers. */
export const validateEdit = (e: { title: string; description: string; framing: string; instructions: string[]; safetyNotes: string[] }) => {
  const errors: string[] = [];
  if (!str(e.title, 3, 48)) errors.push("title");
  if (!str(e.description, 10, 200)) errors.push("description");
  if (!str(e.framing, 3, 200)) errors.push("framing");
  if (!strList(e.instructions.filter((s) => s.trim()), 2, 8, 160)) errors.push("instructions");
  if (!strList(e.safetyNotes.filter((s) => s.trim()), 1, 5, 160)) errors.push("safetyNotes");
  return errors;
};
