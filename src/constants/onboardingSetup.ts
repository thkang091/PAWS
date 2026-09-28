export type TrainingExperience = "brand_new" | "knows_basics" | "experienced";
export type DailyMinutes = 3 | 5 | 10 | 15;
export type Motivation = "treats" | "toys" | "play" | "praise" | "not_sure";

export type ExperienceOption = {
  value: TrainingExperience;
  title: string;
  consequence: string;
  short: string;
};

export const experienceOptions: readonly ExperienceOption[] = [
  {
    value: "brand_new",
    title: "I'm brand new",
    consequence: "Guide me step by step",
    short: "Step by step",
  },
  {
    value: "knows_basics",
    title: "I know the basics",
    consequence: "Keep things simple and practical",
    short: "Simple and practical",
  },
  {
    value: "experienced",
    title: "Pretty experienced",
    consequence: "Get me to practice faster",
    short: "Straight to practice",
  },
];

export const dailyMinuteOptions: readonly DailyMinutes[] = [3, 5, 10, 15];

export const formatMinutes = (minutes: DailyMinutes): string =>
  minutes === 15 ? "15+ min" : `${minutes} min`;

export type MotivationOption = {
  value: Motivation;
  label: string;
};

export const motivationOptions: readonly MotivationOption[] = [
  { value: "treats", label: "Treats" },
  { value: "toys", label: "Toys" },
  { value: "play", label: "Play" },
  { value: "praise", label: "Praise & attention" },
  { value: "not_sure", label: "Not sure yet" },
];

export type Clause = { lead: string; value: string; trail: string };

const EXPERIENCE_CLAUSE: Record<TrainingExperience, Clause> = {
  brand_new: { lead: "guide you ", value: "step by step", trail: "" },
  knows_basics: { lead: "keep things ", value: "simple and practical", trail: "" },
  experienced: { lead: "get you ", value: "practicing fast", trail: "" },
};

const MOTIVATION_CLAUSE: Record<Motivation, Clause> = {
  treats: { lead: "keep {name} working for ", value: "treats", trail: "" },
  toys: { lead: "keep {name} working for ", value: "toys", trail: "" },
  play: { lead: "keep {name} working for ", value: "play", trail: "" },
  praise: { lead: "keep {name} working for ", value: "praise", trail: "" },
  not_sure: { lead: "help you find ", value: "what {name} works for", trail: "" },
};

export const experienceClause = (value: TrainingExperience): Clause =>
  EXPERIENCE_CLAUSE[value];

export const minutesClause = (value: DailyMinutes): Clause => ({
  lead: "",
  value: value === 15 ? "15+ minutes" : `${value} minutes`,
  trail: " a day",
});

export const motivationClause = (value: Motivation): Clause => MOTIVATION_CLAUSE[value];
