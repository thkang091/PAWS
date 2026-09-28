import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { BehavioralConcernsStep } from "@/features/profile/components/BehavioralConcernsStep";
import { EnergyLevelStep } from "@/features/profile/components/EnergyLevelStep";
import { ExistingSkillsStep } from "@/features/profile/components/ExistingSkillsStep";
import { ObedienceStep } from "@/features/profile/components/ObedienceStep";
import { OwnerGoalsStep } from "@/features/profile/components/OwnerGoalsStep";
import { TargetSkillsStep } from "@/features/profile/components/TargetSkillsStep";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { queryKeys } from "@/constants/queryKeys";
import { theme } from "@/constants/theme";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { getDogRelationships, updateDogProfile, type DogProfileUpdate } from "@/services/profileService";
import type { EnergyLevel, ObedienceLevel, TrainingSkill } from "@/types/domain";

const NO_LEGACY_SKILLS: TrainingSkill[] = [];

export default function ProfileEditScreen() {
  const dog = useCurrentDog();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [obedienceLevel, setObedienceLevel] = useState<ObedienceLevel>("beginner");
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>("moderate");
  const [goalKeys, setGoalKeys] = useState<string[]>([]);
  const [existingSkillIds, setExistingSkillIds] = useState<string[]>([]);
  const [targetSkillIds, setTargetSkillIds] = useState<string[]>([]);
  const [concernKeys, setConcernKeys] = useState<string[]>([]);
  const [concernOtherNote, setConcernOtherNote] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (values: DogProfileUpdate) => updateDogProfile(dog.data?.id ?? "", values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentDog });
      if (dog.data?.id) void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(dog.data.id) });
      router.back();
    },
  });

  useEffect(() => {
    if (!dog.data) return;
    setName(dog.data.name);
    setBreed(dog.data.breed);
    setObedienceLevel(dog.data.obedienceLevel);
    setEnergyLevel(dog.data.energyLevel);
    getDogRelationships(dog.data.id).then((relationships) => {
      setGoalKeys(relationships.goals);
      setExistingSkillIds(relationships.existingSkillIds);
      setTargetSkillIds(relationships.targetSkillIds);
      setConcernKeys(relationships.concerns.map((item) => item.key));
      setConcernOtherNote(relationships.concerns.find((item) => item.key === "other")?.customNote ?? null);
    }).catch(() => undefined);
  }, [dog.data]);

  if (dog.isLoading) return <ScreenContainer centered><LoadingState message="Loading profile editor..." /></ScreenContainer>;

  return (
    <ScreenContainer scroll>
      <SectionHeader title="Edit Profile" subtitle="Update real dog profile fields and normalized preferences." />
      <AppCard>
        <View style={styles.stack}>
          <AppTextInput label="Dog name" value={name} onChangeText={setName} />
          <AppTextInput label="Breed" value={breed} onChangeText={setBreed} />
          <ObedienceStep value={obedienceLevel} onChange={setObedienceLevel} />
          <EnergyLevelStep value={energyLevel} onChange={setEnergyLevel} />
          <OwnerGoalsStep selected={goalKeys} onChange={setGoalKeys} />
          <ExistingSkillsStep skills={NO_LEGACY_SKILLS} selectedIds={existingSkillIds} onChange={setExistingSkillIds} />
          <TargetSkillsStep skills={NO_LEGACY_SKILLS} selectedIds={targetSkillIds} onChange={setTargetSkillIds} />
          <BehavioralConcernsStep selected={concernKeys} otherNote={concernOtherNote} onChange={setConcernKeys} onOtherNoteChange={setConcernOtherNote} />
          {save.error ? <Text style={styles.error}>{save.error.message}</Text> : null}
          <AppButton title="Save profile" loading={save.isPending} onPress={() => save.mutate({ name, breed, obedience_level: obedienceLevel, energy_level: energyLevel, goalKeys, existingSkillIds, targetSkillIds, concernKeys, concernOtherNote })} />
        </View>
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.lg },
  error: { color: theme.colors.error, fontSize: theme.typography.sm, fontWeight: "700" },
});
