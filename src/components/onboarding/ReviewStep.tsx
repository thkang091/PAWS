import { StyleSheet, Text, View } from "react-native";

import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";
import type { OnboardingFormValues } from "@/validation/onboardingSchemas";

export const ReviewStep = ({ values }: { values: OnboardingFormValues }) => (
  <AppCard>
    <View style={styles.stack}>
      <Text style={styles.title}>{values.name || "Your dog"}</Text>
      <Text style={styles.copy}>{values.breed || "Breed not set"} • {values.gender}</Text>
      <Text style={styles.copy}>Goals selected: {values.goalKeys.length}</Text>
      <Text style={styles.copy}>Known skills: {values.existingSkillIds.length}</Text>
      <Text style={styles.copy}>Skills to teach: {values.targetSkillIds.length}</Text>
      <Text style={styles.copy}>Concerns: {values.concernKeys.length || "None selected"}</Text>
      <Text style={styles.copy}>Energy: {values.energyLevel}</Text>
    </View>
  </AppCard>
);

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.sm },
  title: { color: theme.colors.text, fontSize: theme.typography.xl, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.md, lineHeight: 22 },
});
