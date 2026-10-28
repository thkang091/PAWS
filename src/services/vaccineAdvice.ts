import { askGeminiJson, tidy } from "@/services/gemini";

/**
 * Which lifestyle (non-core) vaccines fit this dog, from Gemini reading the profile: where it lives, where it goes
 * (day-care, dog parks, hiking), who it lives with, its age and health. It can also name vaccines outside the usual
 * list when the dog's situation calls for them (for example canine coronavirus where it is routine, or rattlesnake in
 * the US Southwest). It never changes the core shots and never diagnoses.
 */
export type VaccineFit = { key: string; fit: "yes" | "maybe" | "no"; why: string };
export type ExtraVaccine = { name: string; when: string; why: string };
export type VaccineAdvice = { fits: VaccineFit[]; extras: ExtraVaccine[] };

const SYSTEM = [
  "You help a dog guardian in PAWS, a dog care app, see which lifestyle vaccines a vet is likely to suggest for their dog.",
  "Core vaccines (rabies, DHPP, leptospirosis) are given to every dog; do not discuss them.",
  "For each LIFESTYLE key given, say fit: yes (the profile clearly points to it), maybe (worth asking the vet), or no (nothing in the profile suggests it). why: one sentence under 14 words naming the detail from the profile that decided it.",
  "extras: up to 2 other vaccines a vet in the dog's region commonly adds that are not in the list (for example canine coronavirus in South Korea, rattlesnake in the US Southwest). Only if the profile or region supports it. name under 4 words, when under 6 words, why under 14 words.",
  "Plain words, no markdown, never use dashes to join sentences. Never give doses.",
].join("\n");

const SCHEMA = {
  type: "OBJECT",
  properties: {
    fits: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { key: { type: "STRING" }, fit: { type: "STRING", enum: ["yes", "maybe", "no"] }, why: { type: "STRING" } }, required: ["key", "fit", "why"] },
    },
    extras: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { name: { type: "STRING" }, when: { type: "STRING" }, why: { type: "STRING" } }, required: ["name", "when", "why"] },
    },
  },
  required: ["fits", "extras"],
};

export const vaccineAdvice = async (
  lifestyle: readonly { key: string; label: string }[],
  dog: { name: string; brief: string; region: string | null },
): Promise<VaccineAdvice | null> => {
  const reply = await askGeminiJson<Partial<VaccineAdvice>>({
    system: SYSTEM,
    prompt: [
      `PROFILE:\n${dog.brief}`,
      dog.region ? `REGION: ${dog.region}` : "",
      `LIFESTYLE KEYS: ${lifestyle.map((l) => `${l.key} (${l.label})`).join(", ")}`,
      `Dog's name: ${dog.name}.`,
    ]
      .filter(Boolean)
      .join("\n"),
    schema: SCHEMA,
    maxTokens: 500,
    timeoutMs: 15000,
  });
  if (reply.state !== "ready") return null;
  const keys = new Set(lifestyle.map((l) => l.key));
  return {
    fits: (reply.value.fits ?? []).filter((f) => keys.has(f.key)).map((f) => ({ key: f.key, fit: f.fit, why: tidy(f.why) })),
    extras: (reply.value.extras ?? []).slice(0, 2).map((e) => ({ name: tidy(e.name), when: tidy(e.when), why: tidy(e.why) })),
  };
};
