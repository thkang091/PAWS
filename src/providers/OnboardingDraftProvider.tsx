import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { DogAgeBucket, TogetherDuration } from "@/constants/onboardingOptions";
import type {
  DailyMinutes,
  Motivation,
  TrainingExperience,
} from "@/constants/onboardingSetup";
import type { EnergyLevel, ObedienceLevel, SelectedOwnerGoal } from "@/types/domain";

export type OnboardingDraft = {
  name: string;
  ageBucket: DogAgeBucket | null;
  together: TogetherDuration | null;
  selectedTrainingGoals: SelectedOwnerGoal[];
  experience: TrainingExperience | null;
  dailyMinutes: DailyMinutes | null;
  motivation: Motivation | null;
  obedienceLevel: ObedienceLevel;
  energyLevel: EnergyLevel;
};

const initialDraft: OnboardingDraft = {
  name: "",
  ageBucket: null,
  together: null,
  selectedTrainingGoals: [],
  experience: null,
  dailyMinutes: null,
  motivation: null,
  obedienceLevel: "beginner",
  energyLevel: "moderate",
};

type OnboardingContextValue = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export const useOnboardingDraft = (): OnboardingContextValue => {
  const value = useContext(OnboardingContext);
  if (!value) {
    throw new Error("useOnboardingDraft must be used inside OnboardingDraftProvider.");
  }
  return value;
};

export const OnboardingDraftProvider = ({ children }: { children: ReactNode }) => {
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      draft,
      update: (patch) => setDraft((current) => ({ ...current, ...patch })),
    }),
    [draft],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};
