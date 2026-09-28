import {
  BREED_EXERCISE_DATA,
  DEFAULT_EXERCISE_MINUTES,
  getBreedEnergyTier,
} from "@/constants/careHealth";
import type { CareRoutineDraft } from "@/services/careService";

export type EnergyTier = "low" | "medium" | "high" | "very_high";

const TIER_COPY: Record<EnergyTier, string> = {
  low: "take it easy",
  medium: "like a steady day",
  high: "need a real outlet",
  very_high: "need a job to do",
};

const ACTIVITY_FACTOR: Record<EnergyTier, number> = {
  low: 1.4,
  medium: 1.6,
  high: 1.7,
  very_high: 1.9,
};

const WALKS_PER_DAY: Record<EnergyTier, number> = {
  low: 2,
  medium: 2,
  high: 3,
  very_high: 3,
};

const KCAL_PER_GRAM = 3.5;

const matchBreed = (breed: string) => {
  const normalized = (breed ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const head = normalized.split("_").filter((part) => part.length >= 3)[0];
  if (!head) return undefined;
  const entry = Object.entries(BREED_EXERCISE_DATA).find(
    ([key]) => normalized.includes(key) || key.includes(head),
  );
  return entry?.[1];
};

export const ROUTINE_LIBRARY: readonly (CareRoutineDraft & { why: string })[] = [
  {
    routineKey: "walk",
    title: "Walk",
    description: "The day's main outing",
    why: "The one routine every dog needs, whatever the breed.",
    iconKey: "walk",
    silverReward: 10,
    sortOrder: 0,
  },
  {
    routineKey: "feeding",
    title: "Meals",
    description: "Breakfast and dinner",
    why: "Logging meals is how PAWS keeps weight and portions honest.",
    iconKey: "bowl-mix",
    silverReward: 5,
    sortOrder: 1,
  },
  {
    routineKey: "water",
    title: "Fresh water",
    description: "Refill and rinse the bowl",
    why: "Easy to forget, and the first thing a vet asks about.",
    iconKey: "water",
    silverReward: 5,
    sortOrder: 2,
  },
  {
    routineKey: "mental_stimulation",
    title: "Sniffing or puzzles",
    description: "Fifteen minutes of thinking",
    why: "A tired brain settles a dog that a tired body will not.",
    iconKey: "brain",
    silverReward: 10,
    sortOrder: 3,
  },
  {
    routineKey: "training_practice",
    title: "Training practice",
    description: "One short session",
    why: "Five good minutes a day beats an hour at the weekend.",
    iconKey: "star",
    silverReward: 10,
    sortOrder: 4,
  },
];

export type CarePlan = {
  breedLabel: string | null;
  tier: EnergyTier;
  tierCopy: string;
  exerciseMinutes: number;
  walksPerDay: number;
  mealsPerDay: number;
  portionGrams: number;
  dailyGrams: number;
  routineKeys: readonly string[];
};

export const recommendedPlan = (breed: string, weightKg?: number | null): CarePlan => {
  const match = matchBreed(breed ?? "");
  const tier: EnergyTier = match
    ? (getBreedEnergyTier(breed ?? "") as EnergyTier)
    : "medium";

  const exerciseMinutes = match
    ? Math.round((match.minutesMin + match.minutesMax) / 2 / 5) * 5
    : DEFAULT_EXERCISE_MINUTES;

  const kg = weightKg && weightKg > 0 ? weightKg : 20;
  const rer = 70 * Math.pow(kg, 0.75);
  const daily = (rer * ACTIVITY_FACTOR[tier]) / KCAL_PER_GRAM;
  const mealsPerDay = 2;
  const dailyGrams = Math.round(daily / 5) * 5;

  return {
    breedLabel: match?.label ?? null,
    tier,
    tierCopy: TIER_COPY[tier],
    exerciseMinutes,
    walksPerDay: WALKS_PER_DAY[tier],
    mealsPerDay,
    portionGrams: Math.round(dailyGrams / mealsPerDay / 5) * 5,
    dailyGrams,
    routineKeys:
      tier === "very_high"
        ? ["walk", "feeding", "water", "mental_stimulation", "training_practice"]
        : tier === "high"
          ? ["walk", "feeding", "water", "mental_stimulation"]
          : ["walk", "feeding", "water"],
  };
};

export const PLAN_DISCLAIMER =
  "A starting point from your dog's breed and weight, not veterinary advice. Change anything you like.";
