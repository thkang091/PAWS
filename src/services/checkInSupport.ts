import type { DailyCheckIn, UnusualSign } from "@/features/care/state/dailyCheckIn";
import { askGeminiJson, tidy } from "@/services/gemini";
import { mentions } from "@/services/triage";

/**
 * What to do about something unusual logged in the evening check-in. Fixed rules catch emergencies first and set a floor;
 * Gemini then reads the whole picture (the dog, today's answers, the last week) for a plain next step, home care and the
 * signs that mean it is getting worse. It never rates lower than the rules, and it never diagnoses.
 */
export type SupportLevel = "home" | "call" | "urgent";

export type CheckInSupport = {
  level: SupportLevel;
  headline: string;
  summary: string;
  steps: readonly string[];
  watch: readonly string[];
  source: "gemini" | "rules";
};

export type SupportDog = {
  name: string;
  breed: string | null;
  ageYears: number | null;
  weightKg: number | null;
  stage: "puppy" | "adult" | "senior";
  allergies: readonly string[];
  /** The full profile brief from useDogContext, so advice accounts for conditions, medications, food and activity. */
  brief?: string;
};

const SIGN_LABEL: Record<UnusualSign, string> = {
  vomiting: "vomiting",
  coughing: "coughing",
  itching: "itching",
  limping: "limping",
  "eye-ear": "an eye or ear problem",
  skin: "a skin problem",
  other: "something else",
};

const RANK: Record<SupportLevel, number> = { home: 0, call: 1, urgent: 2 };
const higher = (a: SupportLevel, b: SupportLevel) => (RANK[a] >= RANK[b] ? a : b);

/** Red flags that mean a vet now, read with negation so "no blood" or "not retching" do not count. */
const URGENT_WORDS =
  /\b(seizur\w*|seizing|collaps\w*|faint\w*|can'?t breathe|trouble breathing|struggling to breathe|blue gums|pale gums|white gums|bloat\w*|swollen (belly|stomach)|retching|dry heav\w*|unresponsive|hit by|choking|poison\w*|vomit\w* blood|blood\w* vomit|bleeding (heavily|a lot)|ate (chocolate|grapes?|raisins?|xylitol|gum|onions?|garlic|rat poison|antifreeze|ibuprofen|medication|pills?))\b/i;
/** Worth a vet's view within a day, but not by themselves an emergency: a little blood in stool, for instance. */
const CALL_WORDS = /\b(blood|bloody|swollen|swelling|won'?t eat|not eating|hiding|shaking|crying|yelp\w*)\b/i;

/** The floor from fixed rules alone, and why. */
export const ruleLevel = (entry: Pick<DailyCheckIn, "unusual" | "unusualNote" | "appetite" | "energy" | "stool" | "urination">, stage: SupportDog["stage"]) => {
  const note = entry.unusualNote ?? "";
  if (mentions(note, URGENT_WORDS)) return "urgent" as const;
  // Blood with vomiting is an emergency; blood alone (a streak in stool) is a call.
  if (entry.unusual.includes("vomiting") && mentions(note, /\b(blood|bloody)\b/i)) return "urgent" as const;
  if (mentions(note, CALL_WORDS)) return "call" as const;
  if (entry.urination === "difficulty") return "call" as const;
  const signs = entry.unusual.length;
  const unwell = entry.appetite === "skipped" || entry.energy === "low" || entry.stool === "diarrhea";
  if (entry.unusual.includes("vomiting") && unwell) return "call" as const;
  if (signs >= 2 && unwell) return "call" as const;
  if (stage !== "adult" && (entry.unusual.includes("vomiting") || entry.stool === "diarrhea")) return "call" as const;
  return "home" as const;
};

/** Plain advice from the rules, for when Gemini cannot be reached. */
export const ruleSupport = (entry: Pick<DailyCheckIn, "unusual" | "unusualNote" | "appetite" | "energy" | "stool" | "urination">, dog: SupportDog): CheckInSupport => {
  const level = ruleLevel(entry, dog.stage);
  const what = entry.unusual.filter((s) => s !== "other").map((s) => SIGN_LABEL[s]);
  const named = what.length ? what.join(" and ") : "this";
  if (level === "urgent")
    return {
      level,
      headline: "Call a vet now",
      summary: `What you described can be an emergency. Call your vet or the nearest emergency clinic now and tell them what you saw.`,
      steps: ["Keep calm and keep the room quiet", "Do not give food or medicine", "Bring any packaging or what was eaten"],
      watch: [],
      source: "rules",
    };
  if (level === "call")
    return {
      level,
      headline: "Call your vet tomorrow",
      summary:
        dog.stage === "adult"
          ? `${named.charAt(0).toUpperCase()}${named.slice(1)} with other changes today is worth a call, even if ${dog.name} seems fine.`
          : `${dog.stage === "puppy" ? "Puppies" : "Older dogs"} can dehydrate faster, so ${named} today is worth a call even if ${dog.name} seems fine.`,
      steps: ["Offer small sips of water often", "Hold treats and rich food for now", "Note the time of each episode"],
      watch: ["Blood in vomit or stool", "Not drinking at all", "Very tired or weak"],
      source: "rules",
    };
  return {
    level,
    headline: "Keep an eye on it",
    summary: `One day of ${named} is often minor. Note it again tomorrow so PAWS can tell if it keeps going.`,
    steps: ["Keep the usual routine", "Check again in the morning"],
    watch: ["It happens again tomorrow", "Eating or energy drops", "Anything gets worse"],
    source: "rules",
  };
};

const SYSTEM = [
  "You support dog guardians inside PAWS, a dog care app, after they log something unusual in the evening health check-in.",
  "You are not a vet and never diagnose. You help decide the next step and what to do tonight.",
  "level: home (mild, single, dog otherwise normal), call (call the vet within a day: persistent over 24 to 48 hours, several signs together, not eating, puppy or senior, or anything that worries), urgent (go to a vet now: trouble breathing, collapse, seizures, blood, bloated belly or retching, suspected poisoning, straining to pee with nothing coming out, severe pain).",
  "When unsure between two levels, pick the safer one.",
  "headline: under 7 words, an instruction. summary: under 35 words, warm, specific to this dog and what was logged, mention the pattern if it repeats this week.",
  "steps: up to 3 short things to do at home tonight, under 12 words each, safe for any dog. Never suggest human medicines or doses.",
  "watch: up to 3 signs that mean call the vet sooner, under 10 words each.",
  "Use the PROFILE: a condition, medication, age or size can change the level (a senior, a diabetic or a dog on NSAIDs that is vomiting warrants a call sooner).",
  "Call the dog by its name, never 'your dog'. Never suggest a food the dog is allergic to.",
  "Plain words. No markdown. Never use dashes to join sentences.",
].join("\n");

const SCHEMA = {
  type: "OBJECT",
  properties: {
    level: { type: "STRING", enum: ["home", "call", "urgent"] },
    headline: { type: "STRING" },
    summary: { type: "STRING" },
    steps: { type: "ARRAY", items: { type: "STRING" } },
    watch: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["level", "headline", "summary", "steps", "watch"],
};

const describe = (entry: Omit<DailyCheckIn, "date">, history: readonly DailyCheckIn[], dog: SupportDog) => {
  const week = history.slice(0, 7);
  const repeats = entry.unusual
    .map((sign) => ({ sign, days: week.filter((d) => d.unusual.includes(sign)).length }))
    .filter((r) => r.days > 0)
    .map((r) => `${SIGN_LABEL[r.sign]} on ${r.days} of the previous ${week.length} check-ins`);
  return [
    dog.brief ? `PROFILE:\n${dog.brief}\n` : "",
    `DOG: ${dog.name}${dog.breed ? `, ${dog.breed}` : ""}${dog.ageYears != null ? `, ${dog.ageYears} years old` : ""}${dog.weightKg != null ? `, ${dog.weightKg} kg` : ""}, ${dog.stage}.`,
    dog.allergies.length ? `Known allergies: ${dog.allergies.join(", ")}.` : "",
    `TODAY: unusual signs: ${entry.unusual.map((s) => SIGN_LABEL[s]).join(", ") || "none"}.`,
    entry.unusualNote.trim() ? `Guardian's note: "${entry.unusualNote.trim().slice(0, 400)}"` : "",
    `Appetite ${entry.appetite ?? "unknown"}, energy ${entry.energy ?? "unknown"}, stool ${entry.stool ?? "unknown"}, urination ${entry.urination ?? "unknown"}, drinking ${entry.drinking ?? "unknown"}.`,
    entry.mobility?.length ? `Movement: ${entry.mobility.join(", ")}.` : "",
    repeats.length ? `THIS WEEK: ${repeats.join("; ")}.` : "THIS WEEK: nothing like this before.",
  ]
    .filter(Boolean)
    .join("\n");
};

export const supportFor = async (entry: Omit<DailyCheckIn, "date">, history: readonly DailyCheckIn[], dog: SupportDog): Promise<CheckInSupport> => {
  const floor = ruleLevel(entry, dog.stage);
  const fallback = ruleSupport(entry, dog);
  // Red flags still get advice fitted to this dog, but on a short leash: the rules answer if Gemini is slow.
  const reply = await askGeminiJson<Partial<CheckInSupport>>({
    system: SYSTEM,
    prompt: describe(entry, history, dog),
    schema: SCHEMA,
    maxTokens: 600,
    timeoutMs: floor === "urgent" ? 8000 : 20000,
  });
  if (reply.state !== "ready" || !reply.value.headline || !reply.value.level) return fallback;
  const v = reply.value;
  const level = higher(v.level as SupportLevel, floor);
  return {
    level,
    // If the rules raised the level, the rules' headline matches it; otherwise Gemini's.
    headline: level === v.level ? tidy(v.headline!) : fallback.headline,
    summary: tidy(v.summary ?? fallback.summary),
    steps: (v.steps ?? []).map(tidy).filter(Boolean).slice(0, 3),
    watch: (v.watch ?? []).map(tidy).filter(Boolean).slice(0, 3),
    source: "gemini",
  };
};
