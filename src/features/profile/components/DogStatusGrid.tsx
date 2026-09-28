import { StyleSheet, Text, View } from "react-native";

import { AppCard } from "@/components/ui/AppCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { theme } from "@/constants/theme";
import type { DogStatus } from "@/types/domain";

const labels: Array<[keyof DogStatus, string]> = [
  ["focus", "Focus"],
  ["discipline", "Discipline"],
  ["social", "Social"],
  ["energy", "Energy"],
  ["intelligence", "Intelligence"],
];

export const DogStatusGrid = ({ status }: { status: DogStatus }) => (
  <View style={styles.grid}>
    {labels.map(([key, label]) => (
      <AppCard key={key}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{status[key]}</Text>
        <ProgressBar accessibilityLabel={`${label} status`} progress={status[key] / 100} />
      </AppCard>
    ))}
  </View>
);

const styles = StyleSheet.create({
  grid: { gap: theme.spacing.md },
  label: { color: theme.colors.textMuted, fontSize: theme.typography.sm, fontWeight: "800" },
  value: { color: theme.colors.text, fontSize: theme.typography.xl, fontWeight: "900", marginVertical: theme.spacing.sm },
});
