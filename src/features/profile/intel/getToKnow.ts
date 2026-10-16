import { getBreedEnergyTier } from "@/constants/careHealth";
import type { LifeStage, Size } from "@/features/care/intel/careIntel";

/**
 * Getting to know the dog: a short set of questions, chosen for this dog. Everyone gets the core few (energy, what
 * motivates, people, dogs, alone time, triggers, handling); breed, age and size add the ones that matter for them
 * (house training for a puppy, changes with age for a senior, heat for a flat-faced breed, scent for a hound).
 * Each question says what it tailors, so it is clear why it is worth answering.
 */
export type Area = "care" | "train";

export type KnowOption = { label: string; sub?: string };

export type KnowQuestion = {
  id: string;
  /** The short name shown on Profile once answered. */
  short: string;
  prompt: (name: string) => string;
  /** What the answer changes, shown above the options. */
  why: string;
  area: Area;
  options: readonly KnowOption[];
  multi?: boolean;
  /** For multi-select: this option clears the others. */
  none?: string;
};

export type KnowDog = { breed: string | null; stage: LifeStage; size: Size };

const has = (breed: string | null, pattern: RegExp) => Boolean(breed && pattern.test(breed));
const BRACHY = /pug|bulldog|boxer|shih tzu|boston|pekingese|cavalier|lhasa|french/i;
const HERDING = /collie|shepherd|heeler|cattle dog|australian|corgi|sheltie|kelpie|malinois/i;
const SCENT = /beagle|basset|hound|bloodhound|coonhound|dachshund|harrier|foxhound/i;
const NORTHERN = /husky|malamute|samoyed|akita|shiba|spitz/i;
const BARKY = /terrier|chihuahua|pomeranian|yorkie|yorkshire|maltese|papillon|schnauzer|beagle|shih tzu/i;

const CORE: readonly KnowQuestion[] = [
  {
    id: "energy",
    short: "Energy",
    prompt: (n) => `How much energy does ${n} have on a normal day?`,
    why: "Sets the walk goal and calories",
    area: "care",
    options: [
      { label: "Couch potato", sub: "Happy with short walks" },
      { label: "Steady", sub: "A walk or two and done" },
      { label: "Busy", sub: "Needs a real outlet every day" },
      { label: "Non-stop", sub: "Never seems tired" },
    ],
  },
  {
    id: "motivation",
    short: "Works for",
    prompt: (n) => `What makes ${n} work hardest?`,
    why: "Picks the rewards in every lesson",
    area: "train",
    multi: true,
    options: [{ label: "Food" }, { label: "Toys" }, { label: "Praise and fuss" }, { label: "Sniffing time" }],
  },
  {
    id: "people",
    short: "New people",
    prompt: (n) => `How is ${n} with people they have not met?`,
    why: "Shapes the social lessons",
    area: "train",
    options: [
      { label: "Seeks them out", sub: "Everyone is a friend" },
      { label: "Friendly once settled" },
      { label: "Wary", sub: "Keeps a distance" },
      { label: "Barks or hides" },
    ],
  },
  {
    id: "dogs",
    short: "Other dogs",
    prompt: () => `And with other dogs?`,
    why: "Plans walk routes and leash work",
    area: "train",
    options: [
      { label: "Plays well" },
      { label: "Fine on a short hello" },
      { label: "Pulls or barks on the leash" },
      { label: "Avoids them" },
    ],
  },
  {
    id: "triggers",
    short: "Sets off",
    prompt: (n) => `Does anything set ${n} off?`,
    why: "Things to plan walks and lessons around",
    area: "train",
    multi: true,
    none: "Nothing really",
    options: [
      { label: "The doorbell" },
      { label: "Other dogs" },
      { label: "Strangers" },
      { label: "Bikes or cars" },
      { label: "Loud noises" },
      { label: "Nothing really" },
    ],
  },
];

const PUPPY: readonly KnowQuestion[] = [
  {
    id: "housetraining",
    short: "House training",
    prompt: (n) => `Where is ${n} with house training?`,
    why: "Sets potty breaks and the first lessons",
    area: "train",
    options: [{ label: "Fully trained" }, { label: "Mostly, a few accidents" }, { label: "Still learning" }, { label: "Just started" }],
  },
  {
    id: "chewing",
    short: "Chews",
    prompt: (n) => `What does ${n} chew that they should not?`,
    why: "Teething tips and safe chews",
    area: "care",
    multi: true,
    none: "Nothing much",
    options: [{ label: "Furniture" }, { label: "Shoes" }, { label: "Hands" }, { label: "Cables" }, { label: "Nothing much" }],
  },
];

const SENIOR: KnowQuestion = {
  id: "aging",
  short: "Changes lately",
  prompt: (n) => `Have you noticed any changes in ${n} lately?`,
  why: "Adjusts walks and vet checks for age",
  area: "care",
  multi: true,
  none: "No changes",
  options: [
    { label: "Slower on walks" },
    { label: "Trouble with stairs" },
    { label: "Sleeping more" },
    { label: "Hearing or sight" },
    { label: "Seems confused" },
    { label: "No changes" },
  ],
};

const BREED_QUESTIONS: readonly { when: (d: KnowDog) => boolean; q: KnowQuestion }[] = [
  {
    when: (d) => has(d.breed, BRACHY),
    q: {
      id: "heat",
      short: "Heat",
      prompt: (n) => `How does ${n} cope with heat and hard play?`,
      why: "Flat-faced breeds overheat fast. Keeps walks safe",
      area: "care",
      options: [{ label: "No trouble" }, { label: "Pants hard" }, { label: "Struggles to breathe" }],
    },
  },
  {
    when: (d) => has(d.breed, HERDING) || (d.breed ? getBreedEnergyTier(d.breed) === "very_high" : false),
    q: {
      id: "herding",
      short: "Herding",
      prompt: (n) => `Does ${n} chase, herd or nip at moving things?`,
      why: "Adds brain games to burn energy",
      area: "train",
      options: [{ label: "Often" }, { label: "Sometimes" }, { label: "Never" }],
    },
  },
  {
    when: (d) => has(d.breed, SCENT),
    q: {
      id: "scent",
      short: "On a scent",
      prompt: (n) => `When ${n} catches a scent outside...`,
      why: "Hounds follow their nose. Sets recall training",
      area: "train",
      options: [{ label: "Still comes when called" }, { label: "Comes eventually" }, { label: "Gone, nose down" }],
    },
  },
  {
    when: (d) => has(d.breed, NORTHERN),
    q: {
      id: "escape",
      short: "Escapes",
      prompt: (n) => `Has ${n} ever slipped a leash or got out of the yard?`,
      why: "Northern breeds roam. Safety gear and recall",
      area: "care",
      options: [{ label: "Never" }, { label: "Once or twice" }, { label: "Escape artist" }],
    },
  },
  {
    when: (d) => has(d.breed, BARKY) || d.size === "small",
    q: {
      id: "barking",
      short: "Barking",
      prompt: (n) => `How much does ${n} bark?`,
      why: "Quiet cues go into the plan if needed",
      area: "train",
      options: [{ label: "Rarely" }, { label: "At noises" }, { label: "A lot" }],
    },
  },
  {
    when: (d) => d.size === "large" || d.size === "giant",
    q: {
      id: "jumping",
      short: "Jumping up",
      prompt: (n) => `Does ${n} jump up on people?`,
      why: "Big dogs knock people over. Manners first",
      area: "train",
      options: [{ label: "Never" }, { label: "When excited" }, { label: "Every time" }],
    },
  },
];

/** The questions for this dog, in order: core first, then the ones their breed and age add. */
export const questionsFor = (dog: KnowDog): KnowQuestion[] => {
  const extra = [
    ...(dog.stage === "puppy" ? PUPPY : []),
    ...(dog.stage === "senior" ? [SENIOR] : []),
    ...BREED_QUESTIONS.filter((b) => b.when(dog)).map((b) => b.q),
  ];
  // Energy, motivation and the dog's own extras are the most useful, so they come first.
  return [CORE[0], CORE[1], ...extra, ...CORE.slice(2)];
};

/** What a breed is usually like, to mark the typical answer. */
export const typicalEnergy = (breed: string | null): string | null => {
  if (!breed) return null;
  const tier = getBreedEnergyTier(breed);
  return tier === "very_high" ? "Non-stop" : tier === "high" ? "Busy" : tier === "low" ? "Couch potato" : "Steady";
};

export const SECTION = "know";

/** What PAWS does differently because of the answers, in a line each. */
export const tailoring = (answers: Readonly<Record<string, string>>, name: string): string[] => {
  const a = (id: string) => answers[id] ?? "";
  const out: string[] = [];
  if (/Non-stop|Busy/.test(a("energy"))) out.push(`Longer walks and brain games, so ${name} gets a real outlet`);
  if (/Couch potato/.test(a("energy"))) out.push(`Shorter walks, with calories kept in check`);
  if (a("motivation")) out.push(`Lessons reward with ${a("motivation").toLowerCase()}`);
  if (/Pulls|Avoids/.test(a("dogs"))) out.push(`Quieter routes and leash work around other dogs`);
  if (/Very upset|Fusses/.test(a("alone"))) out.push(`Alone-time training is added to the plan`);
  if (a("triggers") && !/Nothing/.test(a("triggers"))) out.push(`Plans around ${a("triggers").toLowerCase()}`);
  if (a("handling") && !/None/.test(a("handling"))) out.push(`Gentler steps for ${a("handling").toLowerCase()}`);
  if (/Still learning|Just started|accidents/.test(a("housetraining"))) out.push(`More potty breaks and house training lessons`);
  if (a("aging") && !/No changes/.test(a("aging"))) out.push(`Easier walks and a closer eye at vet checks`);
  if (/Pants|Struggles/.test(a("heat"))) out.push(`Cooler walk times on warm days`);
  if (/Gone|eventually/.test(a("scent"))) out.push(`Recall practice before any off-leash time`);
  if (/Often|Sometimes/.test(a("herding"))) out.push(`Chase and herding games that use the instinct well`);
  if (/A lot/.test(a("barking"))) out.push(`A quiet cue in the training plan`);
  if (/excited|Every time/.test(a("jumping"))) out.push(`Polite greetings first in training`);
  return out;
};

// ---------- The basics, asked first when the record does not have them ----------

export const BREED_CHOICES: readonly string[] = [
  "Mixed breed",
  "Labrador Retriever",
  "Golden Retriever",
  "French Bulldog",
  "Poodle",
  "Beagle",
  "German Shepherd",
  "Dachshund",
  "Something else",
];

/** Age ranges and the whole years stored for each. Under a year counts as a puppy. */
export const AGE_CHOICES: readonly { label: string; years: number }[] = [
  { label: "Under 1 year", years: 0 },
  { label: "1 to 3 years", years: 2 },
  { label: "4 to 7 years", years: 5 },
  { label: "8 to 10 years", years: 9 },
  { label: "11 or older", years: 12 },
];
