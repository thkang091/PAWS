import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { BasicDogInfoStep } from "@/components/onboarding/BasicDogInfoStep";
import { EnergyLevelStep } from "@/components/onboarding/EnergyLevelStep";
import { ObedienceStep } from "@/components/onboarding/ObedienceStep";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";
import { TrainingGoalSelectionStep } from "@/components/onboarding/TrainingGoalSelectionStep";
import { RunningMascot } from "@/components/mascot/RunningMascot";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { queryKeys } from "@/constants/queryKeys";
import { theme } from "@/constants/theme";
import { useTrainingSkills } from "@/hooks/useTrainingSkills";
import { getErrorMessage } from "@/lib/errors";
import { createDogProfile } from "@/services/onboardingService";
import type { SelectedOwnerGoal } from "@/types/domain";
import { onboardingSchema, type OnboardingFormValues } from "@/validation/onboardingSchemas";

const totalSteps = 3;

const initialValues: OnboardingFormValues = {
  name: "",
  gender: "unknown",
  birthday: null,
  ageYears: null,
  breed: "",
  ownedSince: null,
  adoptionDate: null,
  obedienceLevel: "beginner",
  energyLevel: "moderate",
  goalKeys: [],
  selectedTrainingGoals: [] as SelectedOwnerGoal[],
  existingSkillIds: [],
  targetSkillIds: [],
  concernKeys: [],
  concernOtherNote: null,
};

const stepCopy = [
  ["Meet your dog", "Start with the basics PAWS needs to personalize your plan."],
  ["Training goals", "Choose what to work on — pick as many as you like."],
  ["Your dog's level", "Help us set the right pace from day one."],
] as const;

export default function OnboardingScreen() {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<OnboardingFormValues>(initialValues);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const skillsQuery = useTrainingSkills();
  const queryClient = useQueryClient();
  const createDog = useMutation({
    mutationFn: createDogProfile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentDog });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      router.replace("/personalizing");
    },
  });

  const selectedCopy = stepCopy[step - 1];

  const validateStep = (): boolean => {
    if (step === 1 && (!values.name.trim() || !values.breed.trim() || (!values.birthday && values.ageYears === null))) {
      setValidationMessage("Add a name, breed, and either birthday or approximate age.");
      return false;
    }
    if (step === 2 && values.selectedTrainingGoals.length === 0) {
      setValidationMessage("Choose at least one training goal.");
      return false;
    }
    setValidationMessage(null);
    return true;
  };

  const submit = () => {
    const parsed = onboardingSchema.safeParse(values);
    if (!parsed.success) {
      setValidationMessage(parsed.error.issues[0]?.message ?? "Please review the form.");
      return;
    }
    createDog.mutate(parsed.data);
  };

  const goNext = () => {
    if (!validateStep()) return;
    if (step === totalSteps) {
      submit();
      return;
    }
    setStep((current) => current + 1);
  };

  if (skillsQuery.isLoading) {
    return (
      <ScreenContainer centered>
        <LoadingState message="Loading training catalog..." />
      </ScreenContainer>
    );
  }

  if (skillsQuery.error) {
    return (
      <ScreenContainer centered>
        <ErrorState message="Training catalog could not load." onRetry={() => void skillsQuery.refetch()} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <OnboardingProgress step={step} total={totalSteps} />
        <SectionHeader title={selectedCopy[0]} subtitle={selectedCopy[1]} />
        <RunningMascot duration={3600} loop size={54} />
        <AppCard>
          {step === 1 ? <BasicDogInfoStep values={values} setValues={setValues} /> : null}
          {step === 2 ? (
            <TrainingGoalSelectionStep
              selectedGoals={values.selectedTrainingGoals}
              onChange={(selectedTrainingGoals) => setValues({ ...values, selectedTrainingGoals })}
            />
          ) : null}
          {step === 3 ? (
            <View style={styles.levelStep}>
              <Text style={styles.levelSectionLabel}>Training level</Text>
              <ObedienceStep
                value={values.obedienceLevel}
                onChange={(obedienceLevel) => setValues({ ...values, obedienceLevel })}
              />
              <Text style={[styles.levelSectionLabel, { marginTop: theme.spacing.md }]}>Energy level</Text>
              <EnergyLevelStep
                value={values.energyLevel}
                onChange={(energyLevel) => setValues({ ...values, energyLevel })}
              />
            </View>
          ) : null}
        </AppCard>
        {validationMessage ? <Text style={styles.error}>{validationMessage}</Text> : null}
        {createDog.error ? <Text style={styles.error}>{getErrorMessage(createDog.error, "Dog profile creation failed. Please retry.")}</Text> : null}
        <View style={styles.actions}>
          <AppButton title="Back" variant="ghost" disabled={step === 1 || createDog.isPending} onPress={() => setStep((current) => Math.max(1, current - 1))} />
          <AppButton title={step === totalSteps ? "Create profile" : "Continue"} loading={createDog.isPending} onPress={goNext} />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  keyboard: { gap: theme.spacing.lg },
  actions: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.md },
  error: { color: theme.colors.error, fontSize: theme.typography.sm, fontWeight: "700" },
  levelStep: { gap: theme.spacing.sm },
  levelSectionLabel: {
    fontSize: theme.typography.xs,
    fontWeight: "900",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: theme.spacing.xs,
  },
});
