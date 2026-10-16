import { VACCINE_SCHEDULE } from "@/constants/careHealth";
import { askGeminiJson, tidy } from "@/services/gemini";

/**
 * Turns whatever is written on a vaccine card ("Nobivac DAPPv+L4", "5-in-1", "Vanguard Plus 5/CV-L", "kennel cough
 * spray") into what PAWS tracks: which of the listed vaccines it covers, and how often it usually repeats. A local
 * reading answers instantly from common names; Gemini then confirms it and catches brand names the local list misses.
 */
export type VaccineKey = "rabies" | "dhpp" | "leptospirosis" | "bordetella" | "lyme" | "influenza";

export const VACCINE_KEYS: readonly VaccineKey[] = ["rabies", "dhpp", "leptospirosis", "bordetella", "lyme", "influenza"];

export type VaccineRead = {
  /** The name as a vet would write it. */
  name: string;
  covers: VaccineKey[];
  /** Usual repeat for an adult dog, in months; null for a one-off. */
  months: number | null;
  /** One short line on what it is. */
  note: string | null;
  /** False when what was typed is not a vaccine at all (a flea tablet, a dewormer). */
  isVaccine: boolean;
  source: "local" | "ai";
};

/** Other names each listed vaccine goes by, for search and the instant reading. */
export const ALIASES: Record<VaccineKey, readonly string[]> = {
  rabies: ["rabies", "imrab", "defensor", "rabvac", "purevax rabies"],
  dhpp: ["dhpp", "da2pp", "dapp", "dhlpp", "dappv", "da2ppv", "dhppi", "distemper", "parvo", "adenovirus", "hepatitis", "parainfluenza", "5 in 1", "5-in-1", "6 in 1", "7 in 1"],
  leptospirosis: ["lepto", "leptospira", "l4", "l2", "dhlpp", "dappv+l", "cv-l", "/l"],
  bordetella: ["bordetella", "kennel cough", "bronchiseptica", "intranasal", "bronchi-shield", "nobivac kc", "kc"],
  lyme: ["lyme", "borrelia", "recombitek lyme", "duramune lyme", "nobivac lyme", "vanguard crlyme"],
  influenza: ["influenza", "dog flu", "canine flu", "h3n2", "h3n8", "civ", "flu"],
};

const INTERVAL: Record<VaccineKey, number> = Object.fromEntries(VACCINE_SCHEDULE.map((v) => [v.key, v.intervalMonths])) as Record<VaccineKey, number>;

const NOT_VACCINES = /bravecto|nexgard|simparica|credelio|frontline|advantage|revolution|heartgard|interceptor|sentinel|proheart|dewormer|drontal|panacur|apoquel|cytopoint/i;

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** An alias must start a word ("parainfluenza" is not influenza); short ones (l4, kc, flu) must also end one. */
const matches = (text: string, alias: string) =>
  new RegExp(`(^|[^a-z])${escape(alias)}${alias.length <= 3 ? "([^a-z0-9]|$)" : ""}`).test(text);

/** Listed vaccines whose name or other names match the query, for the search box. */
export const searchKeys = (query: string): VaccineKey[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [...VACCINE_KEYS];
  return VACCINE_KEYS.filter((key) => {
    const listed = VACCINE_SCHEDULE.find((v) => v.key === key)?.name.toLowerCase() ?? key;
    return listed.includes(q) || ALIASES[key].some((alias) => alias.startsWith(q) || (q.length > 3 && matches(q, alias)));
  });
};

/** The instant reading, from names alone. */
export const quickRead = (typed: string): VaccineRead => {
  const text = typed.trim().toLowerCase();
  const isVaccine = !NOT_VACCINES.test(text);
  const covers = isVaccine ? VACCINE_KEYS.filter((key) => ALIASES[key].some((alias) => matches(text, alias))) : [];
  const months = covers.length ? Math.min(...covers.map((key) => INTERVAL[key])) : 12;
  return { name: typed.trim(), covers, months, note: null, isVaccine, source: "local" };
};

const SYSTEM = [
  "You read what a dog guardian typed from a vaccine card or vet invoice, for PAWS, a dog care app. It may be a brand, a combo code or everyday words.",
  "Map it onto these tracked keys: rabies; dhpp (distemper, adenovirus or hepatitis, parvovirus, parainfluenza, any DAPP or DA2PP combo); leptospirosis (any L2 or L4 or the L in DHLPP); bordetella (kennel cough, any route); lyme (Borrelia); influenza (H3N2 or H3N8).",
  "covers: every key the product protects against. Empty if none of them (for example a rattlesnake or giardia vaccine).",
  "name: the product or vaccine name as a vet would write it, title case, under 6 words.",
  "months: the usual repeat for an adult dog after the puppy series, per the label or common practice (12, 36, 6). Use 0 for a one-off.",
  "note: one plain sentence under 14 words saying what it protects against. No dashes, no markdown.",
  "isVaccine: false if it is a medicine rather than a vaccine (flea, tick, heartworm, dewormer, allergy), and then say so in note.",
].join("\n");

const SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    covers: { type: "ARRAY", items: { type: "STRING", enum: [...VACCINE_KEYS] } },
    months: { type: "INTEGER" },
    note: { type: "STRING" },
    isVaccine: { type: "BOOLEAN" },
  },
  required: ["name", "covers", "months", "note", "isVaccine"],
};

export const readVaccine = async (typed: string): Promise<VaccineRead | null> => {
  const reply = await askGeminiJson<{ name?: string; covers?: string[]; months?: number; note?: string; isVaccine?: boolean }>({
    system: SYSTEM,
    prompt: `TYPED: "${typed.trim().slice(0, 120)}"`,
    schema: SCHEMA,
    maxTokens: 200,
    timeoutMs: 15000,
  });
  if (reply.state !== "ready") return null;
  const v = reply.value;
  const covers = (v.covers ?? []).filter((key): key is VaccineKey => (VACCINE_KEYS as readonly string[]).includes(key));
  return {
    name: tidy(v.name || typed.trim()),
    covers: [...new Set(covers)],
    months: v.months && v.months > 0 ? v.months : null,
    note: v.note ? tidy(v.note) : null,
    isVaccine: v.isVaccine !== false,
    source: "ai",
  };
};
