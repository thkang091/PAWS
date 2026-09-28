import type { DogAgeBucket, TogetherDuration } from "@/constants/onboardingOptions";

const AGE_YEARS: Record<DogAgeBucket, number> = {
  puppy: 0.5,
  young_adult: 3,
  senior: 8,
  unsure: 3,
};

export const ageYearsForBucket = (bucket: DogAgeBucket): number => AGE_YEARS[bucket];

const DAYS_TOGETHER: Record<TogetherDuration, number> = {
  just_home: 0,
  under_a_month: 14,
  a_few_months: 90,
  a_year_plus: 365,
};

export const ownedSinceForDuration = (
  duration: TogetherDuration,
  today: Date = new Date(),
): string => {
  const date = new Date(today);
  date.setDate(date.getDate() - DAYS_TOGETHER[duration]);
  return date.toISOString().slice(0, 10);
};
