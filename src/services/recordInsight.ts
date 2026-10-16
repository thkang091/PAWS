import { askGeminiJson, tidy } from "@/services/gemini";

/**
 * What a condition or allergy written into the medical record means for this dog, from Gemini. It turns a typed note
 * like "itchy ears a lot" into the term a vet would use, explains it in a sentence, and says what changes day to day.
 * For allergies it lists the other names the allergen hides under on labels. It informs; it never diagnoses.
 */
export type RecordInsight = {
  /** The usual name a vet would write, or the same name when it is already clear. */
  name: string;
  plain: string;
  care: readonly string[];
  askVet: readonly string[];
  /** Allergies only: label words that mean the same thing, e.g. "poultry fat" for chicken. */
  alsoListedAs: readonly string[];
  /** True when what was written sounds like it needs a vet soon rather than a note in the record. */
  seeVetSoon: boolean;
};

const SYSTEM = [
  "You help dog guardians keep a clear medical record in PAWS, a dog care app. They add a condition or an allergy, sometimes in their own words.",
  "You are not a vet and never diagnose or recommend medicines or doses.",
  "name: the standard term a vet would use, in plain title case, under 5 words. Keep the guardian's term if it is already standard. If it is not a medical thing, keep their words.",
  "plain: one or two sentences, under 30 words, what it is in everyday words and why it matters for this dog.",
  "care: up to 3 practical changes to daily care, under 12 words each. For allergies, how to avoid it.",
  "askVet: up to 2 short questions worth asking at the next visit.",
  "alsoListedAs: for food allergies only, up to 6 ingredient names on pet food labels that contain it. Empty otherwise.",
  "seeVetSoon: true only if what they wrote sounds new and serious enough to call a vet this week.",
  "Use the PROFILE to make the care tips fit this dog (its age, size, other conditions, medications and food), and flag a conflict if there is one.",
  "Call the dog by its name. Plain words. No markdown. Never use dashes to join sentences.",
].join("\n");

const SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    plain: { type: "STRING" },
    care: { type: "ARRAY", items: { type: "STRING" } },
    askVet: { type: "ARRAY", items: { type: "STRING" } },
    alsoListedAs: { type: "ARRAY", items: { type: "STRING" } },
    seeVetSoon: { type: "BOOLEAN" },
  },
  required: ["name", "plain", "care", "askVet", "alsoListedAs", "seeVetSoon"],
};

export const insightFor = async (
  kind: "condition" | "allergy",
  item: { name: string; note: string },
  dog: { name: string; breed: string | null; ageYears: number | null; stage: string; brief?: string },
): Promise<RecordInsight | null> => {
  const reply = await askGeminiJson<Partial<RecordInsight>>({
    system: SYSTEM,
    prompt: [
      dog.brief ? `PROFILE:\n${dog.brief}\n` : "",
      `DOG: ${dog.name}${dog.breed ? `, ${dog.breed}` : ""}${dog.ageYears != null ? `, ${dog.ageYears} years old` : ""}, ${dog.stage}.`,
      `ADDED ${kind === "allergy" ? "AN ALLERGY" : "A CONDITION"}: "${item.name.slice(0, 120)}"`,
      item.note.trim() ? `Their note: "${item.note.trim().slice(0, 300)}"` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    schema: SCHEMA,
    maxTokens: 600,
    timeoutMs: 20000,
  });
  if (reply.state !== "ready" || !reply.value.plain) return null;
  const v = reply.value;
  const list = (items: unknown, max: number) => (Array.isArray(items) ? items.map((i) => tidy(String(i))).filter(Boolean).slice(0, max) : []);
  return {
    name: tidy(v.name || item.name),
    plain: tidy(v.plain!),
    care: list(v.care, 3),
    askVet: list(v.askVet, 2),
    alsoListedAs: kind === "allergy" ? list(v.alsoListedAs, 6) : [],
    seeVetSoon: Boolean(v.seeVetSoon),
  };
};
