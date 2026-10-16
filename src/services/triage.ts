import { askGeminiJson, tidy } from "@/services/gemini";

/**
 * Emergency triage for what a guardian describes, fitted to this dog. Fixed rules set a floor for true red flags
 * (they are read with negation, so "no blood" is not blood); Gemini then grades everything else against the dog's
 * profile: its weight (toxic doses), age, conditions and medicines. It can ask one short question when the answer
 * would change what to do (how much was eaten, gum colour), and it never rates below the rules or diagnoses.
 */
export type TriageLevel = "now" | "call" | "today" | "watch";

export type Triage = {
  level: TriageLevel;
  headline: string;
  /** One sentence on why, in terms of this dog. */
  why: string;
  steps: readonly string[];
  avoid: readonly string[];
  /** What to say when calling the vet. */
  tell: readonly string[];
  /** Signs that mean go in sooner. */
  watch: readonly string[];
  /** Toxin risk for this dog's weight, when something was eaten. */
  toxin: { risk: "low" | "moderate" | "high" | "unknown"; note: string } | null;
  /** A question whose answer would change the advice, with short answers to tap. */
  ask: { question: string; options: readonly string[] } | null;
  source: "gemini" | "rules";
};

export type TriageDog = { name: string; weightKg: number | null; stage: "puppy" | "adult" | "senior"; brief?: string };

export const LEVEL_RANK: Record<TriageLevel, number> = { watch: 0, today: 1, call: 2, now: 3 };
const higher = (a: TriageLevel, b: TriageLevel) => (LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b);

const NEGATION = /\b(no|not|never|without|isn'?t|wasn'?t|aren'?t|didn'?t|doesn'?t|hasn'?t|haven'?t|none|nothing)\b[^.,;!?]{0,24}$/i;

/** True when the pattern appears and is not negated just before it ("no blood", "not breathing hard"). */
export const mentions = (text: string, pattern: RegExp) => {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const global = new RegExp(pattern.source, flags);
  for (const match of text.matchAll(global)) {
    const before = text.slice(Math.max(0, (match.index ?? 0) - 40), match.index ?? 0);
    if (!NEGATION.test(before)) return true;
  }
  return false;
};

/** Go now, whatever else is true. */
const GO_NOW =
  /\b(seizur\w*|seizing|collaps\w*|unresponsive|unconscious|not breathing|can'?t breathe|struggling to breathe|gasping|blue (gums|tongue)|pale (gums|white)|white gums|bloat\w*|swollen (belly|stomach|abdomen)|retching|dry heav\w*|hit by (a )?(car|vehicle)|heat ?stroke|choking|xylitol|rat (poison|bait)|antifreeze|can'?t (stand|walk)|bleeding (heavily|a lot|won'?t stop)|vomit\w* blood|blood\w* vomit|straining to pee|can'?t pee|no urine)\b/i;

/** Needs a vet's view now, by phone at least. */
const CALL_NOW = /\b(chocolate|grapes?|raisins?|onions?|garlic|ibuprofen|tylenol|acetaminophen|advil|pills?|medication|marijuana|cannabis|lily|lilies|poison\w*|toxic|swallowed|eye (injur\w*|swollen)|snake ?bite|bee sting.*(face|swell)|swelling (face|muzzle)|hives|blood|bloody)\b/i;

export const triageFloor = (text: string): TriageLevel => {
  if (mentions(text, GO_NOW)) return "now";
  if (mentions(text, CALL_NOW)) return "call";
  return "watch";
};

/** Plain advice from the rules alone, for when Gemini cannot be reached. */
export const ruleTriage = (text: string, dog: TriageDog, minimum: TriageLevel = "watch"): Triage => {
  const level = higher(triageFloor(text), minimum);
  const young = dog.stage !== "adult";
  // A puppy or senior with anything more than a mild sign is worth a same-day call.
  const graded: TriageLevel = level === "watch" && young && /vomit|diarrh|not eating|won'?t eat|letharg|weak|limp/i.test(text) ? "today" : level;
  const base = { avoid: ["Human medicines of any kind", "Food or water if a vet may sedate"], toxin: null, ask: null, source: "rules" as const };
  if (graded === "now")
    return {
      ...base,
      level: graded,
      headline: "Go to an emergency vet now",
      why: `What you described can get worse fast. Call on the way so they are ready for ${dog.name}.`,
      steps: [`Keep ${dog.name} calm, warm and still`, "Bring any packaging or what was eaten", "Call the clinic on the way"],
      tell: [`${dog.name}'s weight${dog.weightKg ? `, about ${dog.weightKg} kg` : ""}`, "What happened and when", "Any medicines given today"],
      watch: [],
    };
  if (graded === "call")
    return {
      ...base,
      level: graded,
      headline: "Call a vet or poison line now",
      why: `It depends on what and how much, and on ${dog.name}'s size. A quick call tells you whether to go in.`,
      steps: ["Take away anything left", "Note the time and the amount", "Keep the packaging"],
      avoid: ["Making them vomit unless told to", "Human medicines of any kind"],
      tell: ["What it was and how much", "When it happened", `${dog.name}'s weight`],
      watch: ["Vomiting or shaking", "Very tired or wobbly", "Breathing changes"],
    };
  if (graded === "today")
    return {
      ...base,
      level: graded,
      headline: "Call your vet today",
      why: `${dog.stage === "puppy" ? "Puppies" : "Older dogs"} can go downhill faster, so this is worth a same-day call.`,
      steps: ["Offer small sips of water", "Rest somewhere quiet", "Note each episode and the time"],
      tell: ["When it started", "How often it has happened", "Eating and drinking today"],
      watch: ["Not drinking at all", "Blood anywhere", "Getting weaker"],
    };
  return {
    ...base,
    level: graded,
    headline: "Watch closely at home",
    why: `This often settles on its own. Check ${dog.name} again in a couple of hours.`,
    steps: ["Keep the usual routine, quietly", "Check again in 2 hours", "Log it in tonight's check-in"],
    tell: [],
    watch: ["It gets worse or spreads", "Not eating or drinking", "Any sign of pain"],
  };
};

const SYSTEM = [
  "You are the first-aid triage helper in PAWS, a dog care app. A guardian describes what is happening right now. You are not a vet and never diagnose.",
  "Grade it for THIS dog using the PROFILE (weight, age, life stage, breed, conditions, medicines, allergies). The same event can be minor for one dog and serious for another.",
  "level: now (emergency vet now: breathing trouble, collapse, seizure, bloat, heavy bleeding, toxic dose, heatstroke, can't urinate, hit by car, severe pain); call (phone a vet or the pet poison line now for advice: possible toxin, sudden swelling, eye injury, blood); today (see or call the usual vet within 24 hours); watch (home care, mild and single, dog otherwise acting normal).",
  "Be proportionate: do not send every problem to the emergency vet. Use the dog's details to decide, and say which detail mattered.",
  "For something eaten, estimate the risk for this dog's weight when an amount is given (for example chocolate type and grams). If the amount or type is missing and it would change the level, ask for it.",
  "ask: at most one short question, only if the answer would change the level or the steps, with 2 to 4 short answers. Otherwise null fields (empty question).",
  "headline: under 7 words, an instruction. why: one sentence under 25 words that names the dog and the detail that drove the level.",
  "steps: up to 4 things to do right now, under 12 words each. avoid: up to 3 things not to do. tell: up to 3 things to say when calling the vet. watch: up to 3 signs that mean go in sooner.",
  "Never suggest human medicines or doses. Never suggest inducing vomiting unless a vet says so. Plain words, no markdown, never use dashes to join sentences.",
].join("\n");

const SCHEMA = {
  type: "OBJECT",
  properties: {
    level: { type: "STRING", enum: ["now", "call", "today", "watch"] },
    headline: { type: "STRING" },
    why: { type: "STRING" },
    steps: { type: "ARRAY", items: { type: "STRING" } },
    avoid: { type: "ARRAY", items: { type: "STRING" } },
    tell: { type: "ARRAY", items: { type: "STRING" } },
    watch: { type: "ARRAY", items: { type: "STRING" } },
    toxinRisk: { type: "STRING", enum: ["none", "low", "moderate", "high", "unknown"] },
    toxinNote: { type: "STRING" },
    askQuestion: { type: "STRING" },
    askOptions: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["level", "headline", "why", "steps", "avoid", "tell", "watch", "toxinRisk", "toxinNote", "askQuestion", "askOptions"],
};

type Reply = {
  level?: TriageLevel;
  headline?: string;
  why?: string;
  steps?: string[];
  avoid?: string[];
  tell?: string[];
  watch?: string[];
  toxinRisk?: string;
  toxinNote?: string;
  askQuestion?: string;
  askOptions?: string[];
};

/** Triage what was described, plus any follow-up answers already given. */
export const triage = async (
  description: string,
  answers: readonly { question: string; answer: string }[],
  dog: TriageDog,
  /** The least this can be, e.g. from a situation the guardian tapped. */
  minimum: TriageLevel = "watch",
): Promise<Triage> => {
  const all = [description, ...answers.map((a) => a.answer)].join(". ");
  const floor = higher(triageFloor(all), minimum);
  const fallback = ruleTriage(all, dog, minimum);
  const reply = await askGeminiJson<Reply>({
    system: SYSTEM,
    prompt: [
      dog.brief ? `PROFILE:\n${dog.brief}\n` : `DOG: ${dog.name}, ${dog.stage}${dog.weightKg ? `, ${dog.weightKg} kg` : ""}.`,
      `HAPPENING NOW: "${description.slice(0, 500)}"`,
      ...answers.map((a) => `Q: ${a.question} A: ${a.answer}`),
      answers.length >= 2 ? "Do not ask anything more." : "",
    ]
      .filter(Boolean)
      .join("\n"),
    schema: SCHEMA,
    maxTokens: 700,
    timeoutMs: 15000,
  });
  if (reply.state !== "ready" || !reply.value.level || !reply.value.headline) return fallback;
  const v = reply.value;
  const level = higher(v.level!, floor);
  const list = (items: unknown, max: number) => (Array.isArray(items) ? items.map((i) => tidy(String(i))).filter(Boolean).slice(0, max) : []);
  const risk = v.toxinRisk && v.toxinRisk !== "none" ? (v.toxinRisk as "low" | "moderate" | "high" | "unknown") : null;
  const options = list(v.askOptions, 4);
  return {
    level,
    // When the rules raised the level, their headline matches it; otherwise Gemini's.
    headline: level === v.level ? tidy(v.headline!) : fallback.headline,
    why: tidy(v.why || fallback.why),
    steps: list(v.steps, 4),
    avoid: list(v.avoid, 3),
    tell: list(v.tell, 3),
    watch: list(v.watch, 3),
    toxin: risk ? { risk, note: tidy(v.toxinNote ?? "") } : null,
    ask: v.askQuestion && options.length >= 2 && answers.length < 2 ? { question: tidy(v.askQuestion), options } : null,
    source: "gemini",
  };
};
