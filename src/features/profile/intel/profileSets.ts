import type { Size } from "@/features/care/intel/careIntel";
import { questionsFor, typicalEnergy, type KnowDog, type KnowQuestion } from "@/features/profile/intel/getToKnow";

/**
 * Everything PAWS asks about the dog after onboarding, in five sets ordered by how much they change what PAWS may
 * recommend: the basics and life stage, health and safety limits, home and routine, the training baseline and goals,
 * then personality. Each set is short, says why it matters, and is answered at the guardian's pace from Profile.
 */
export type SetKey = "basics" | "safety" | "home" | "baseline" | "personality";

/** Basics questions that write straight to the dog's record instead of the answer store. */
export type Special = "breed" | "age" | "sex" | "weight";

export type SetQuestion = KnowQuestion & { special?: Special };

export type ProfileSet = {
  key: SetKey;
  title: string;
  /** One line on what this set changes. */
  why: string;
  /** Where its answers are stored in the profile draft. */
  section: string;
};

export const SETS: readonly ProfileSet[] = [
  { key: "basics", title: "Basics & life stage", why: "Life stage sets the whole care and training strategy", section: "basics" },
  { key: "safety", title: "Health & safety", why: "Limits PAWS never recommends past", section: "safety" },
  { key: "home", title: "Home & routine", why: "Where and how the dog lives shapes every plan", section: "home" },
  { key: "baseline", title: "Training baseline", why: "What the dog knows and needs help with builds the plan", section: "baseline" },
  { key: "personality", title: "Personality", why: "How to teach and reward this dog", section: "know" },
];

export const setByKey = (key: string) => SETS.find((s) => s.key === key) ?? null;

// ---------- Life stage ----------

/** When a dog is grown, by size: small dogs mature by a year, giants take up to two. */
const ADULT_AT_MONTHS: Record<Size, number> = { small: 12, medium: 12, large: 18, giant: 24 };
const SENIOR_AT_MONTHS: Record<Size, number> = { small: 120, medium: 96, large: 84, giant: 72 };

export type StageLabel = "Puppy" | "Young adult" | "Adult" | "Senior";

/** The four AAHA life stages, sized: a large breed stays a puppy longer and becomes senior sooner. */
export const lifeStageLabel = (months: number | null, size: Size): StageLabel | null => {
  if (months == null) return null;
  if (months < ADULT_AT_MONTHS[size]) return "Puppy";
  if (months >= SENIOR_AT_MONTHS[size]) return "Senior";
  return months < 36 ? "Young adult" : "Adult";
};

export const STAGE_FOCUS: Record<StageLabel, { care: string; train: string }> = {
  Puppy: { care: "Vaccines, growth food and parasite control", train: "Short lessons, socialising, potty and chewing" },
  "Young adult": { care: "Fitness, weight and dental habits", train: "Impulse control and manners in busy places" },
  Adult: { care: "Weight, dental and yearly screening", train: "Keeping skills sharp and fixing problem habits" },
  Senior: { care: "Mobility, muscle and twice-yearly screening", train: "Gentle brain games and low-impact exercise" },
};

// ---------- The sets ----------

const BASICS: readonly SetQuestion[] = [
  { id: "breed", special: "breed", short: "Breed", prompt: (n) => `What breed is ${n}?`, why: "Shapes size, energy and what PAWS asks", area: "care", options: [] },
  { id: "age", special: "age", short: "Age", prompt: (n) => `How old is ${n}?`, why: "Puppy, adult or senior plans", area: "care", options: [] },
  {
    id: "sex",
    special: "sex",
    short: "Sex",
    prompt: (n) => `Is ${n} a boy or a girl?`,
    why: "Some health checks differ by sex",
    area: "care",
    options: [{ label: "Boy" }, { label: "Girl" }],
  },
  {
    id: "fixed",
    short: "Spayed or neutered",
    prompt: (n) => `Is ${n} spayed or neutered?`,
    why: "Changes daily calories by up to a fifth",
    area: "care",
    options: [{ label: "Yes" }, { label: "Not yet" }, { label: "Not sure" }],
  },
  { id: "weight", special: "weight", short: "Weight", prompt: (n) => `About how much does ${n} weigh?`, why: "Sets food amounts and medicine doses", area: "care", options: [] },
];

const adultSize = (unit: "kg" | "lb"): SetQuestion => ({
  id: "adultSize",
  short: "Grown size",
  prompt: (n) => `How big will ${n} be fully grown?`,
  why: "Large puppies grow longer and need different food",
  area: "care",
  options: [
    { label: "Small", sub: unit === "lb" ? "Under 22 lb" : "Under 10 kg" },
    { label: "Medium", sub: unit === "lb" ? "22 to 55 lb" : "10 to 25 kg" },
    { label: "Large", sub: unit === "lb" ? "55 to 100 lb" : "25 to 45 kg" },
    { label: "Giant", sub: unit === "lb" ? "Over 100 lb" : "Over 45 kg" },
    { label: "Not sure" },
  ],
});

const SAFETY: readonly SetQuestion[] = [
  {
    id: "mobility",
    short: "Moving",
    prompt: (n) => `How does ${n} move these days?`,
    why: "Keeps exercise safe",
    area: "care",
    multi: true,
    none: "Moves freely",
    options: [
      { label: "Stiff after rest" },
      { label: "Limps sometimes" },
      { label: "Avoids stairs or jumps" },
      { label: "Healing from an injury" },
      { label: "Moves freely" },
    ],
  },
  {
    id: "pain",
    short: "Pain signs",
    prompt: (n) => `Any signs of pain in ${n}?`,
    why: "Changes what is safe",
    area: "care",
    multi: true,
    none: "None seen",
    options: [{ label: "Guards or licks a spot" }, { label: "Yelps when touched" }, { label: "Restless at night" }, { label: "None seen" }],
  },
  {
    id: "limits",
    short: "Vet limits",
    prompt: (n) => `Has a vet set any limits for ${n}?`,
    why: "PAWS never goes past these",
    area: "care",
    multi: true,
    none: "No limits",
    options: [
      { label: "No hard exercise" },
      { label: "No jumping or stairs" },
      { label: "Prescription diet" },
      { label: "Weight loss plan" },
      { label: "Rest after surgery" },
      { label: "No limits" },
    ],
  },
];

const HOME: readonly SetQuestion[] = [
  {
    id: "home",
    short: "Home",
    prompt: (n) => `Where does ${n} live?`,
    why: "Barking, potty and exercise advice depend on it",
    area: "train",
    options: [{ label: "Apartment or condo" }, { label: "House with a yard" }, { label: "House, no yard" }],
  },
  {
    id: "household",
    short: "Lives with",
    prompt: (n) => `Who else lives with ${n}?`,
    why: "Shapes manners and safety tips at home",
    area: "train",
    multi: true,
    none: "Just adults",
    options: [{ label: "Other dogs" }, { label: "Cats" }, { label: "Children under 12" }, { label: "Older adults" }, { label: "Just adults" }],
  },
  {
    id: "aloneHours",
    short: "Alone for",
    prompt: (n) => `On a weekday, how long is ${n} usually alone?`,
    why: "Plans alone-time training and midday breaks",
    area: "train",
    options: [{ label: "Rarely alone" }, { label: "Up to 2 hours" }, { label: "2 to 4 hours" }, { label: "4 to 8 hours" }, { label: "More than 8 hours" }],
  },
  {
    id: "outings",
    short: "Goes to",
    prompt: (n) => `Where else does ${n} go?`,
    why: "Adds tick, water and social tips",
    area: "care",
    multi: true,
    none: "Mostly local walks",
    options: [{ label: "Dog park" }, { label: "Daycare" }, { label: "Hiking or woods" }, { label: "Swimming" }, { label: "Car trips" }, { label: "Mostly local walks" }],
  },
];

export const NEEDS: readonly string[] = ["Pulling", "Recall", "Reactivity", "Barking", "Jumping up", "Home alone", "Potty", "Crate", "Handling"];

const BASELINE: readonly SetQuestion[] = [
  {
    id: "knows",
    short: "Already knows",
    prompt: (n) => `What does ${n} already know?`,
    why: "Lessons skip what is already solid",
    area: "train",
    multi: true,
    none: "Nothing yet",
    options: [{ label: "Sit" }, { label: "Down" }, { label: "Stay" }, { label: "Come" }, { label: "Leave it" }, { label: "Loose leash walking" }, { label: "Place or mat" }, { label: "Nothing yet" }],
  },
  {
    id: "needs",
    short: "Needs help with",
    prompt: (n) => `What does ${n} need help with?`,
    why: "Builds the training plan around it",
    area: "train",
    multi: true,
    none: "Nothing right now",
    options: [...NEEDS.map((label) => ({ label })), { label: "Nothing right now" }],
  },
];

/** One quick follow-up for each problem picked, so the plan knows how big it is. */
const followUp = (need: string): SetQuestion => {
  const special: Record<string, readonly { label: string }[]> = {
    Recall: [{ label: "Reliable everywhere" }, { label: "Good indoors only" }, { label: "Unreliable outside" }, { label: "Does not come" }],
    Reactivity: [{ label: "Only up close" }, { label: "At a distance too" }, { label: "Most of the time" }],
    Pulling: [{ label: "Only near distractions" }, { label: "Often" }, { label: "Almost every walk" }],
  };
  return {
    id: `sev_${need.toLowerCase().replace(/\s+/g, "_")}`,
    short: need,
    prompt: (n) => (need === "Recall" ? `How is ${n}'s recall?` : `${need}: how often?`),
    why: "Sets where the plan starts",
    area: "train",
    options: special[need] ?? [{ label: "Now and then" }, { label: "Often" }, { label: "Almost every time" }],
  };
};

const GOAL = (needs: readonly string[]): SetQuestion => ({
  id: "goal",
  short: "First goal",
  prompt: () => "Which would make the biggest difference first?",
  why: "It becomes step one of the plan",
  area: "train",
  options: needs.map((label) => ({ label })),
});

/** The questions in a set, given what is known so far. Follow-ups appear only for what was picked. */
export const questionsIn = (
  key: SetKey,
  dog: KnowDog & { months: number | null },
  answers: Readonly<Record<string, string>>,
  unit: "kg" | "lb" = "lb",
): SetQuestion[] => {
  if (key === "basics") return [...BASICS, ...(dog.months != null && dog.months < 18 ? [adultSize(unit)] : [])];
  if (key === "safety") return [...SAFETY];
  if (key === "home") return [...HOME];
  if (key === "personality") return questionsFor(dog);
  const needs = (answers.needs ?? "").split(", ").filter((n) => NEEDS.includes(n));
  return [...BASELINE, ...needs.slice(0, 4).map(followUp), ...(needs.length > 1 ? [GOAL(needs)] : [])];
};

// ---------- What the answers produce ----------

const MODULES: Record<string, string> = {
  Pulling: "Loose-leash foundations",
  Recall: "Recall around distractions",
  Reactivity: "Calm passing at a distance",
  Barking: "A quiet cue and settling",
  "Jumping up": "Polite greetings",
  "Home alone": "Calm alone time, in small steps",
  Potty: "Potty routine",
  Crate: "Loving the crate",
  Handling: "Happy handling for vet and grooming",
};

/** A training plan in order: engagement first, the chosen goal next, then the rest. */
export const trainingPlan = (answers: Readonly<Record<string, string>>): string[] => {
  const needs = (answers.needs ?? "").split(", ").filter((n) => NEEDS.includes(n));
  if (!needs.length) return [];
  const goal = answers.goal && needs.includes(answers.goal) ? answers.goal : needs[0];
  const ordered = [goal, ...needs.filter((n) => n !== goal)];
  const knowsSettle = /Place/.test(answers.knows ?? "");
  return ["Engagement and focus", ...ordered.map((n) => MODULES[n]), ...(knowsSettle ? [] : ["Settle outdoors"])];
};

export { typicalEnergy };
