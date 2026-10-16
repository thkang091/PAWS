import { useMemo } from "react";

import { ageInMonths } from "@/constants/carePlanByAge";
import { useHealthRecord } from "@/features/care/state/healthRecord";
import { useFoodPlan, type FeedingProfile } from "@/features/care/state/foodPlan";
import { useProfileDraft } from "@/features/profile/state/profileDraft";
import { activityFromWalking, goalFrom, stageOf, type Activity, type Basis } from "@/features/care/food/foodPlanMath";
import { useExerciseLogsBetween, useMedications } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useFoodRules } from "@/hooks/useFood";
import { useWeightLogs } from "@/hooks/useWeightLogs";
import { preferredWeightUnit } from "@/lib/units";

/** A weigh-in older than this is worth confirming before working out portions. */
export const STALE_WEIGHT_DAYS = 60;

const ENERGY_ACTIVITY: Record<string, Activity> = { "Couch potato": "low", Steady: "moderate", Busy: "high", "Non-stop": "high" };

/**
 * Everything PAWS already knows that feeding depends on, from the dog record, weigh-ins, the health record,
 * medications and the can't-eat list. `profile` overrides it with the owner's Food Plan answers.
 */
export const useDogBasis = (profileOverride?: FeedingProfile) => {
  const dog = useCurrentDog();
  const dogId = dog.data?.id;
  const weights = useWeightLogs(dogId);
  const meds = useMedications(dogId);
  const rules = useFoodRules(dogId);
  const record = useHealthRecord();
  const store = useFoodPlan();
  const profileDraft = useProfileDraft();
  const profile = profileOverride ?? store.profile;
  // The last seven days of walks (tracked with PAWS or logged in the check-in) set how active the dog really is.
  const now = new Date();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const weekTo = iso(now);
  const weekFrom = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  const week = useExerciseLogsBetween(dogId, weekFrom, weekTo);

  return useMemo(() => {
    const name = dog.data?.name ?? "your dog";
    const gender = dog.data?.gender;
    const his = gender === "male" ? "his" : gender === "female" ? "her" : "their";
    const he = gender === "male" ? "he" : gender === "female" ? "she" : "they";

    const ageUnsure = profileDraft.isEdited("basics", "ageUnsure") && Boolean(profileDraft.resolve("basics", "ageUnsure", ""));
    const ageMonths = ageUnsure ? null : ageInMonths(dog.data?.birthday ?? null, dog.data?.ageYears ?? null);
    const stage = stageOf(ageMonths) ?? profile.stage;

    const latest = (weights.data ?? [])[0] ?? null;
    const weightKg = latest
      ? Math.round((latest.weightUnit === "kg" ? latest.weightValue : latest.weightValue * 0.4536) * 10) / 10
      : null;
    const weighedDaysAgo = latest ? Math.floor((Date.now() - new Date(latest.recordedAt).getTime()) / 86_400_000) : null;

    // Only an energy the owner actually gave counts (onboarding or Profile); the record's level can be a default.
    const energyAnswer = profileDraft.isEdited("know", "energy") ? profileDraft.resolve("know", "energy", "") : "";
    const knownActivity = ENERGY_ACTIVITY[energyAnswer] ?? null;
    const logs = week.data ?? [];
    const walkedDays = new Set(logs.filter((l) => l.durationMinutes > 0).map((l) => l.logDate)).size;
    const minutesPerDay = Math.round(logs.reduce((sum, l) => sum + (l.durationMinutes || 0), 0) / 7);
    const walking = walkedDays >= 3 ? { minutesPerDay, days: walkedDays, level: activityFromWalking(minutesPerDay) } : null;
    const activity = walking?.level ?? profile.activity ?? knownActivity ?? null;

    const conditions = record.items.filter((item) => item.kind === "condition").map((item) => item.name);
    const allergyNames = [
      ...record.items.filter((item) => item.kind === "allergy").map((item) => item.name),
      ...(rules.data ?? []).filter((rule) => rule.kind === "allergy" || rule.kind === "intolerance").map((rule) => rule.name),
    ];
    const allergies = [...new Map(allergyNames.map((n) => [n.toLowerCase(), n])).values()];
    const medNames = (meds.data ?? []).filter((m) => m.isActive).map((m) => m.medicationName);

    const basis: Basis = {
      name,
      ageMonths,
      stage,
      weightKg,
      bodyCondition: profile.bodyCondition,
      activity,
      neutered: profile.neutered,
      goal: profile.goal ?? (profile.bodyCondition ? goalFrom(profile.bodyCondition) : null),
      conditions,
      allergies,
      meds: medNames,
    };

    // What still has to be asked before portions can be worked out.
    const missing = {
      stage: stage == null,
      weight: weightKg == null,
      bodyCondition: profile.bodyCondition == null,
      neutered: stage !== "puppy" && profile.neutered == null,
      activity: activity == null,
    };

    return {
      basis,
      his,
      he,
      missing,
      ready: !Object.values(missing).some(Boolean),
      weighedDaysAgo,
      /** Pounds or kilograms, as the owner last weighed. */
      weightUnit: preferredWeightUnit(latest?.weightUnit),
      knownActivity,
      /** This week's walking, when there is enough of it to set the activity level. */
      walking,
      loading: dog.isLoading || weights.isLoading,
    };
  }, [dog.data, dog.isLoading, weights.data, weights.isLoading, meds.data, rules.data, record.items, profile, week.data, profileDraft]);
};
