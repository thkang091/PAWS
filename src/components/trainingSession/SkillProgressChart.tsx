import { StyleSheet, Text, View } from "react-native";

import { ProgressBar } from "@/components/ui/ProgressBar";
import { theme } from "@/constants/theme";
import type { TrainingProgress } from "@/types/domain";

export const SkillProgressChart = ({ progress }: { progress: TrainingProgress[] }) => (
  <View style={styles.stack}>
    {progress.map((item) => (
      <View key={item.id}>
        <Text style={styles.label}>{item.skillId.slice(0, 8)} • {item.completionPercentage}%</Text>
        <ProgressBar accessibilityLabel="Skill progress" progress={item.completionPercentage / 100} />
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.md },
  label: { color: theme.colors.textMuted, fontSize: theme.typography.xs, marginBottom: theme.spacing.xs },
});
