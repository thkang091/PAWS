/**
 * PAWS care intelligence: the quiet layer that turns who the dog is (age, size, breed) and what has happened (care log,
 * check-ins) into what matters now. It has no screen of its own; Health, Feed, Activity and Care home all read from it.
 * Pure functions only, so the rules are testable and the same everywhere.
 */

// ---------- Life stage ----------

export type Size = "small" | "medium" | "large" | "giant";
export type LifeStage = "puppy" | "adult" | "senior";

const GIANT = /great dane|mastiff|newfoundland|saint bernard|st\.? bernard|leonberger|wolfhound|bernese|great pyrenees/i;
const LARGE = /retriever|labrador|shepherd|rottweiler|boxer|husky|doberman|malamute|standard poodle|vizsla|weimaraner|pointer|ridgeback|akita|collie/i;
const SMALL = /chihuahua|pomeranian|yorkshire|yorkie|maltese|shih tzu|dachshund|pug|toy|miniature|papillon|havanese|bichon|jack russell|french bulldog|cavalier|terrier/i;

export const sizeOf = (breed: string | null | undefined, weightKg: number | null): Size => {
  if (breed && GIANT.test(breed)) return "giant";
  if (breed && LARGE.test(breed)) return "large";
  if (breed && SMALL.test(breed)) return "small";
  if (weightKg == null) return "medium";
  return weightKg < 10 ? "small" : weightKg < 25 ? "medium" : weightKg < 45 ? "large" : "giant";
};

/** Bigger dogs age faster: the age (in years) at which care shifts to senior checks. */
export const SENIOR_AT_YEARS: Record<Size, number> = { small: 10, medium: 8, large: 7, giant: 6 };

export const lifeStageOf = (ageMonths: number | null, size: Size): LifeStage => {
  if (ageMonths == null) return "adult";
  if (ageMonths < 12) return "puppy";
  return ageMonths >= SENIOR_AT_YEARS[size] * 12 ? "senior" : "adult";
};

// ---------- Preventive care ----------

export type CareKind =
  | "flea_tick"
  | "heartworm_prev"
  | "deworm"
  | "brushing"
  | "dental_cleaning"
  | "wellness_exam"
  | "bloodwork"
  | "urinalysis"
  | "fecal"
  | "heartworm_test"
  // Records only: things that happened, with no schedule of their own.
  | "dental_procedure"
  | "vaccine_cert"
  | "imaging"
  | "vet_note";

export type CareArea = "parasites" | "dental" | "exams";

export const CARE_LABEL: Record<CareKind, string> = {
  flea_tick: "Flea and tick",
  heartworm_prev: "Heartworm prevention",
  deworm: "Deworming",
  brushing: "Tooth brushing",
  dental_cleaning: "Dental cleaning",
  wellness_exam: "Wellness exam",
  bloodwork: "Bloodwork",
  urinalysis: "Urinalysis",
  fecal: "Fecal test",
  heartworm_test: "Heartworm test",
  dental_procedure: "Dental procedure",
  vaccine_cert: "Vaccine certificate",
  imaging: "Imaging",
  vet_note: "Vet notes",
};

/** Days between doses or visits for each stage; null means not needed at this stage. */
const INTERVAL: Partial<Record<CareKind, Record<LifeStage, number | null>>> = {
  flea_tick: { puppy: 30, adult: 30, senior: 30 },
  heartworm_prev: { puppy: 30, adult: 30, senior: 30 },
  deworm: { puppy: 30, adult: 90, senior: 90 },
  dental_cleaning: { puppy: null, adult: 365, senior: 365 },
  wellness_exam: { puppy: 30, adult: 365, senior: 182 },
  bloodwork: { puppy: null, adult: 365, senior: 182 },
  urinalysis: { puppy: null, adult: null, senior: 365 },
  fecal: { puppy: 90, adult: 365, senior: 365 },
  heartworm_test: { puppy: null, adult: 365, senior: 365 },
};

/** The usual interval for a kind at a stage, before any product says otherwise. */
export const usualEvery = (kind: CareKind, stage: LifeStage) => INTERVAL[kind]?.[stage] ?? null;

export const AREA_KINDS: Record<CareArea, readonly CareKind[]> = {
  parasites: ["flea_tick", "heartworm_prev", "deworm"],
  dental: ["brushing", "dental_cleaning"],
  exams: ["wellness_exam", "bloodwork", "urinalysis", "fecal", "heartworm_test"],
};

/** The kinds this dog needs in an area right now; a puppy does not need bloodwork, a senior gains urinalysis. */
export const kindsFor = (area: CareArea, stage: LifeStage): CareKind[] =>
  AREA_KINDS[area].filter((kind) => kind === "brushing" || INTERVAL[kind]?.[stage] != null);

export type Due = {
  kind: CareKind;
  status: "unknown" | "ok" | "soon" | "due";
  last: string | null;
  next: string | null;
  /** Negative when overdue. */
  daysLeft: number | null;
  everyDays: number | null;
};

const DAY = 86_400_000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`).getTime();
export const isoOf = (time: number) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export type LogEntry = {
  id: string;
  kind: CareKind;
  date: string;
  result?: string | null;
  note?: string | null;
  /** The product given, e.g. "NexGard". */
  product?: string | null;
  /** How long this dose protects for; overrides the usual interval (a Seresto collar lasts 8 months). */
  everyDays?: number | null;
  /** Other kinds the same dose takes care of (Simparica Trio also covers heartworm and worms). */
  covers?: readonly CareKind[] | null;
  /** Whether to send a reminder on the next due date. */
  remind?: boolean;
};

/** Entries that count for a kind: logged as it, or a combination product that covers it. Newest first. */
export const entriesFor = (kind: CareKind, log: readonly LogEntry[]) =>
  log.filter((e) => e.kind === kind || e.covers?.includes(kind)).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));

/** When each kind is next due, from the most recent log entry. Brushing is a habit: judged on the last seven days. */
export const dueFor = (kind: CareKind, log: readonly LogEntry[], stage: LifeStage, today: string): Due => {
  const mine = entriesFor(kind, log);
  const last = mine[0]?.date ?? null;

  if (kind === "brushing") {
    const week = mine.filter((e) => parse(today) - parse(e.date) < 7 * DAY && parse(e.date) <= parse(today)).length;
    return { kind, status: last == null ? "unknown" : week >= 3 ? "ok" : "due", last, next: null, daysLeft: null, everyDays: 1 };
  }

  const every = mine[0]?.everyDays ?? INTERVAL[kind]?.[stage] ?? null;
  if (every == null) return { kind, status: "ok", last, next: null, daysLeft: null, everyDays: null };
  if (!last) return { kind, status: "unknown", last: null, next: null, daysLeft: null, everyDays: every };
  // Calendar arithmetic, not milliseconds: adding 240 × 24 h across the November clock change lands a day early.
  const [y, m, d] = last.split("-").map(Number);
  const next = new Date(y, m - 1, d + every).getTime();
  const daysLeft = Math.round((next - parse(today)) / DAY);
  const soonWithin = every <= 31 ? 3 : every <= 120 ? 7 : 30;
  return { kind, status: daysLeft < 0 ? "due" : daysLeft <= soonWithin ? "soon" : "ok", last, next: isoOf(next), daysLeft, everyDays: every };
};

/** One line for an area on the Care plan list: the most pressing thing in it. */
export const areaSummary = (area: CareArea, log: readonly LogEntry[], stage: LifeStage, today: string) => {
  const dues = kindsFor(area, stage).map((kind) => dueFor(kind, log, stage, today));
  const overdue = dues.filter((d) => d.status === "due");
  const soon = dues.filter((d) => d.status === "soon");
  const unknown = dues.filter((d) => d.status === "unknown");
  if (overdue.length) return { attention: true, text: overdue.length === 1 ? `${CARE_LABEL[overdue[0].kind]} is due` : `${overdue.length} things are due` };
  if (soon.length) {
    const days = Math.max(0, soon[0].daysLeft ?? 0);
    const when = days === 0 ? "is due today" : days === 1 ? "is due tomorrow" : `in ${days} days`;
    return { attention: days === 0, text: `${CARE_LABEL[soon[0].kind]} ${when}` };
  }
  if (unknown.length === dues.length) return { attention: false, text: "Add when each was last done" };
  if (unknown.length) return { attention: false, text: `${unknown.length} not recorded yet` };
  return { attention: false, text: "All up to date" };
};

// ---------- Mobility ----------

export type MobilitySign = "stiff" | "limping" | "stairs" | "reluctant";

export const MOBILITY_LABEL: Record<MobilitySign, string> = {
  stiff: "Trouble getting up",
  limping: "Limping",
  stairs: "Avoiding stairs",
  reluctant: "Less willing to walk or jump",
};

export const MOBILITY_NOUN: Record<MobilitySign, string> = {
  stiff: "stiffness",
  limping: "a limp",
  stairs: "trouble with stairs",
  reluctant: "less willingness to move",
};

export type Mobility = {
  status: "unknown" | "normal" | "watch" | "concern";
  /** The sign seen on the most consecutive recent check-ins, if it is still going. */
  streak: { sign: MobilitySign; days: number } | null;
  /** How many of the last seven check-ins mentioned each sign. */
  counts: Record<MobilitySign, number>;
  checkIns: number;
};

/**
 * Read the last week of check-ins. Watch when anything was mentioned; concern when one sign has run three check-ins in a
 * row up to now, or a limp has come up twice.
 */
export const mobilityOf = (entries: readonly { date: string; mobility?: readonly MobilitySign[] | null }[], today: string): Mobility => {
  const recent = entries
    .filter((e) => Array.isArray(e.mobility) && parse(today) - parse(e.date) < 7 * DAY && parse(e.date) <= parse(today))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const counts: Record<MobilitySign, number> = { stiff: 0, limping: 0, stairs: 0, reluctant: 0 };
  for (const e of recent) for (const s of e.mobility ?? []) counts[s] += 1;
  if (!recent.length) return { status: "unknown", streak: null, counts, checkIns: 0 };

  let streak: Mobility["streak"] = null;
  const live = parse(today) - parse(recent[0].date) <= 2 * DAY;
  if (live) {
    for (const sign of Object.keys(counts) as MobilitySign[]) {
      let days = 0;
      for (const e of recent) {
        if (e.mobility?.includes(sign)) days += 1;
        else break;
      }
      if (days > (streak?.days ?? 0)) streak = { sign, days };
    }
  }
  const any = Object.values(counts).some((n) => n > 0);
  const concern = (streak != null && streak.days >= 3) || counts.limping >= 2;
  return { status: concern ? "concern" : any ? "watch" : "normal", streak, counts, checkIns: recent.length };
};

// ---------- Body condition ----------

export type MuscleCondition = "normal" | "mild" | "moderate" | "severe";

export const MUSCLE_LABEL: Record<MuscleCondition, string> = {
  normal: "Normal",
  mild: "Mild loss",
  moderate: "Moderate loss",
  severe: "Severe loss",
};

/** The 9-point body condition score, and the three-way band the food maths uses. */
export const bcsBand = (bcs: number): "thin" | "ideal" | "heavy" => (bcs <= 3 ? "thin" : bcs <= 5 ? "ideal" : "heavy");
export const bcsFromBand = (band: "thin" | "ideal" | "heavy" | null): number | null => (band === "thin" ? 3 : band === "ideal" ? 5 : band === "heavy" ? 7 : null);
export const BCS_WORDS: Record<number, string> = {
  1: "Very thin",
  2: "Very thin",
  3: "Thin",
  4: "Ideal",
  5: "Ideal",
  6: "Above ideal",
  7: "Heavy",
  8: "Very heavy",
  9: "Very heavy",
};
