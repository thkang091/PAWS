import { StyleSheet, Text, View } from "react-native";

import { ProgressBar } from "@/components/ui/ProgressBar";
import { theme } from "@/constants/theme";

export const OnboardingProgress = ({ step, total }: { step: number; total: number }) => (
  <View style={styles.container}>
    <Text style={styles.label}>Step {step} of {total}</Text>
    <ProgressBar accessibilityLabel="Onboarding progress" progress={step / total} />
  </View>
);

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm },
  label: { color: theme.colors.textMuted, fontSize: theme.typography.sm, fontWeight: "800" },
});
