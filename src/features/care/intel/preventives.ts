import type { CareKind } from "@/features/care/intel/careIntel";

/**
 * Common parasite preventives in the US, with how long one dose protects and what it covers. Picking one sets the next
 * due date for every kind it covers, so a monthly Simparica Trio clears flea and tick, heartworm and worms together.
 * `everyDays: null` means the product has no fixed schedule (a one-off dewormer); the life-stage interval applies.
 */
export type DoseForm = "chew" | "topical" | "collar" | "injection" | "tablet";

export type Preventive = { id: string; name: string; form: DoseForm; everyDays: number | null; covers: readonly CareKind[] };

export const PREVENTIVES: readonly Preventive[] = [
  { id: "nexgard", name: "NexGard", form: "chew", everyDays: 30, covers: ["flea_tick"] },
  { id: "simparica", name: "Simparica", form: "chew", everyDays: 30, covers: ["flea_tick"] },
  { id: "credelio", name: "Credelio", form: "chew", everyDays: 30, covers: ["flea_tick"] },
  { id: "bravecto", name: "Bravecto", form: "chew", everyDays: 84, covers: ["flea_tick"] },
  { id: "frontline", name: "Frontline Plus", form: "topical", everyDays: 30, covers: ["flea_tick"] },
  { id: "advantix", name: "K9 Advantix II", form: "topical", everyDays: 30, covers: ["flea_tick"] },
  { id: "seresto", name: "Seresto", form: "collar", everyDays: 240, covers: ["flea_tick"] },
  { id: "simparica-trio", name: "Simparica Trio", form: "chew", everyDays: 30, covers: ["flea_tick", "heartworm_prev", "deworm"] },
  { id: "nexgard-plus", name: "NexGard PLUS", form: "chew", everyDays: 30, covers: ["flea_tick", "heartworm_prev", "deworm"] },
  { id: "credelio-quattro", name: "Credelio Quattro", form: "chew", everyDays: 30, covers: ["flea_tick", "heartworm_prev", "deworm"] },
  { id: "heartgard-plus", name: "Heartgard Plus", form: "chew", everyDays: 30, covers: ["heartworm_prev", "deworm"] },
  { id: "interceptor-plus", name: "Interceptor Plus", form: "chew", everyDays: 30, covers: ["heartworm_prev", "deworm"] },
  { id: "proheart-6", name: "ProHeart 6", form: "injection", everyDays: 182, covers: ["heartworm_prev"] },
  { id: "proheart-12", name: "ProHeart 12", form: "injection", everyDays: 365, covers: ["heartworm_prev"] },
  { id: "drontal-plus", name: "Drontal Plus", form: "tablet", everyDays: null, covers: ["deworm"] },
  { id: "panacur", name: "Panacur", form: "tablet", everyDays: null, covers: ["deworm"] },
];

/** Products for a kind: ones made for it first, then combinations that also cover it. */
export const preventivesFor = (kind: CareKind) => {
  const mine = PREVENTIVES.filter((p) => p.covers.includes(kind));
  return [...mine.filter((p) => p.covers[0] === kind && p.covers.length === 1), ...mine.filter((p) => !(p.covers[0] === kind && p.covers.length === 1))];
};

export const isPreventiveKind = (kind: CareKind) => kind === "flea_tick" || kind === "heartworm_prev" || kind === "deworm";

export const FORM_LABEL: Record<DoseForm, string> = {
  chew: "Chew",
  topical: "On the skin",
  collar: "Collar",
  injection: "Shot",
  tablet: "Tablet",
};

/** Short names for what else a combination covers. */
export const COVER_WORD: Partial<Record<CareKind, string>> = {
  flea_tick: "fleas and ticks",
  heartworm_prev: "heartworm",
  deworm: "worms",
};

/** "1 month", "12 weeks", "8 months", "1 year". */
export const lastsLabel = (days: number) => {
  if (days >= 360) return `${Math.round(days / 365)} year`;
  if (days % 28 === 0 && days < 120 && days !== 28) return `${days / 7} weeks`;
  const months = Math.round(days / 30.4);
  return `${months} ${months === 1 ? "month" : "months"}`;
};

/** Choices when the product is not in the list. */
export const LASTS: readonly { days: number | null; label: string }[] = [
  { days: 30, label: "1 month" },
  { days: 84, label: "3 months" },
  { days: 182, label: "6 months" },
  { days: 240, label: "8 months" },
  { days: 365, label: "1 year" },
  { days: null, label: "Not sure" },
];
