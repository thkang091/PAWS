import { StyleSheet, Text, View } from "react-native";

import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";
import type { ActivityDefinition } from "@/types/activityVerification";

const baseChecks = [
  "Dog detected in frame",
  "Only one dog visible",
  "Full body inside frame",
  "Paws visible",
  "Lighting is bright enough",
  "Camera is steady",
];

export const CameraQualityGate = ({ definition, strict }: { definition: ActivityDefinition; strict: boolean }) => {
  const objectCheck = definition.qualityRequirements.requiredObject ? [`${definition.qualityRequirements.requiredObject} visible`] : [];
  const startingPoseCheck = definition.requiredStartingPose ? [`Start with ${definition.requiredStartingPose.replaceAll("_", " ")}`] : [];
  const checks = [...baseChecks, ...objectCheck, ...startingPoseCheck];

  return (
    <AppCard>
      <Text style={styles.title}>Camera readiness</Text>
      <Text style={styles.copy}>
        {strict
          ? "Ranked and AI-scored activities use stricter recording rules."
          : "For routine logging, these checks are guidance instead of a hard block."}
      </Text>
      <View style={styles.grid}>
        {checks.map((check) => <Text key={check} style={styles.check}>• {check}</Text>)}
      </View>
    </AppCard>
  );
};

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.sm, lineHeight: 20, marginTop: theme.spacing.sm },
  grid: { gap: theme.spacing.xs, marginTop: theme.spacing.md },
  check: { color: theme.colors.text, fontSize: theme.typography.sm, fontWeight: "700" },
});
