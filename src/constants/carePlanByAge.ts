export type LifeStage = "puppy" | "adult" | "senior";

export const ageInMonths = (birthday: string | null, ageYears: number | null): number | null => {
  if (birthday) {
    const born = new Date(`${birthday}T00:00:00`);
    if (!Number.isNaN(born.getTime())) {
      const now = new Date();
      return Math.max(
        0,
        (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth()),
      );
    }
  }
  return ageYears != null ? Math.round(ageYears * 12) : null;
};

export const stageOf = (months: number | null): LifeStage =>
  months == null ? "adult" : months < 12 ? "puppy" : months < 96 ? "adult" : "senior";

export const stageLabel: Record<LifeStage, string> = {
  puppy: "a puppy",
  adult: "an adult dog",
  senior: "a senior dog",
};

export type PlanItem = {
  key: string;
  label: string;
  when: string;
  why: string;
  required: boolean;
};

const PUPPY_VACCINES: readonly PlanItem[] = [
  {
    key: "dhpp",
    label: "DHPP",
    when: "6, 10 and 14 weeks",
    why: "Distemper and parvo. Parvo kills puppies; this is the one that cannot slip.",
    required: true,
  },
  {
    key: "rabies",
    label: "Rabies",
    when: "12 to 16 weeks",
    why: "Required by law almost everywhere, and needed for boarding and travel.",
    required: true,
  },
  {
    key: "bordetella",
    label: "Kennel cough",
    when: "From 8 weeks",
    why: "Asked for by most groomers, day-cares and boarding kennels.",
    required: false,
  },
  {
    key: "booster",
    label: "First boosters",
    when: "At 12 months",
    why: "The puppy series only holds for a year without them.",
    required: true,
  },
];

const ADULT_VACCINES: readonly PlanItem[] = [
  {
    key: "rabies",
    label: "Rabies",
    when: "Every 3 years",
    why: "Required by law almost everywhere, and needed for boarding and travel.",
    required: true,
  },
  {
    key: "dhpp",
    label: "DHPP",
    when: "Every 3 years",
    why: "Distemper, hepatitis, parvovirus and parainfluenza, in one shot.",
    required: true,
  },
  {
    key: "bordetella",
    label: "Kennel cough",
    when: "Every year",
    why: "Asked for by most groomers, day-cares and boarding kennels.",
    required: false,
  },
  {
    key: "leptospirosis",
    label: "Leptospirosis",
    when: "Every year",
    why: "Worth it for dogs near wildlife, rivers or standing water.",
    required: false,
  },
];

export const vaccinePlan = (stage: LifeStage): readonly PlanItem[] =>
  stage === "puppy" ? PUPPY_VACCINES : ADULT_VACCINES;

const PUPPY_MEDS: readonly PlanItem[] = [
  {
    key: "worming",
    label: "Worming",
    when: "Monthly to 6 months",
    why: "Puppies are born with worms. This is routine, not a problem.",
    required: true,
  },
  {
    key: "flea",
    label: "Flea & tick",
    when: "Monthly, from 8 weeks",
    why: "Check the weight range on the box. Puppy doses are different.",
    required: true,
  },
  {
    key: "heartworm",
    label: "Heartworm",
    when: "Monthly, year round",
    why: "Prevention is simple; treatment is long and hard on the dog.",
    required: true,
  },
];

const ADULT_MEDS: readonly PlanItem[] = [
  {
    key: "flea",
    label: "Flea & tick",
    when: "Monthly",
    why: "Year round in most places, not just over the summer.",
    required: true,
  },
  {
    key: "heartworm",
    label: "Heartworm",
    when: "Monthly, year round",
    why: "Prevention is simple; treatment is long and hard on the dog.",
    required: true,
  },
];

const SENIOR_EXTRA: PlanItem = {
  key: "joints",
  label: "Joint support",
  when: "Daily, if your vet agrees",
  why: "Common from about eight, and easier started before it is needed.",
  required: false,
};

export const medicationPlan = (stage: LifeStage): readonly PlanItem[] =>
  stage === "puppy"
    ? PUPPY_MEDS
    : stage === "senior"
      ? [...ADULT_MEDS, SENIOR_EXTRA]
      : ADULT_MEDS;

export type GroomingKit = {
  key: string;
  label: string;
  every: string;
  kit: string;
  tip: string;
  price: string;
  look: string;
  how: readonly string[];
};

export const GROOMING_KIT: readonly GroomingKit[] = [
  {
    key: "bath",
    label: "Bath",
    every: "Every 3 weeks",
    kit: "Dog shampoo, oatmeal if the skin is sensitive",
    tip: "Human shampoo strips the coat. It is the one substitution that matters.",
    price: "$10–18",
    look: "Soap-free and pH-balanced for dogs. Skip anything scented.",
    how: ["Brush the coat out first. Water mats a tangle in.", "Work from the neck back, and keep it out of the ears.", "Rinse twice. Leftover shampoo is what makes a dog itch."],
  },
  {
    key: "nail_trim",
    label: "Nail trim",
    every: "Every 3 weeks",
    kit: "Scissor-type clippers, or a grinder for dark nails",
    tip: "Keep styptic powder nearby the first few times.",
    price: "$12–25",
    look: "Scissor-type for most dogs. A grinder if the nails are black.",
    how: ["Press the paw pad so the nail comes forward.", "Take the tip only. A little and often beats one big cut.", "On black nails stop when the cut face turns chalky."],
  },
  {
    key: "ear_clean",
    label: "Ear clean",
    every: "Every 2 weeks",
    kit: "Ear cleaning solution and cotton pads",
    tip: "Pads only, never a cotton bud. It pushes wax further in.",
    price: "$8–15",
    look: "A solution that says it dries the canal. Pads, not buds.",
    how: ["Fill the ear until it pools, then let go.", "Massage the base for ten seconds. You will hear it.", "Let the dog shake, then wipe what comes up."],
  },
  {
    key: "teeth_brush",
    label: "Teeth",
    every: "Daily",
    kit: "Dog toothbrush and enzymatic dog toothpaste",
    tip: "Human toothpaste contains xylitol, which is poisonous to dogs.",
    price: "$8–14",
    look: "Enzymatic paste, and a brush that fits your dog\u2019s mouth.",
    how: ["Let them lick the paste off the brush for a few days first.", "Only the outside faces need it.", "Thirty seconds a side is a full clean."],
  },
  {
    key: "haircut",
    label: "Haircut",
    every: "Every 6 weeks",
    kit: "Clippers and blunt-nosed scissors",
    tip: "Most people book this one. There is no prize for doing it yourself.",
    price: "$35–70",
    look: "A quiet clipper. Noise is what ends most home haircuts.",
    how: ["Bath and dry first. Clippers snag on a dirty coat.", "Go with the hair, never against it.", "Leave faces and paws to a groomer until you are confident."],
  },
  {
    key: "flea_tick",
    label: "Flea & tick check",
    every: "Weekly",
    kit: "A fine flea comb",
    tip: "Run it over the base of the tail and behind the ears.",
    price: "$5–10",
    look: "Fine metal teeth, close together. Plastic ones miss.",
    how: ["Comb the base of the tail and behind the ears.", "Dip the comb in soapy water between strokes.", "Black grit that turns red when wet is flea dirt."],
  },
];
