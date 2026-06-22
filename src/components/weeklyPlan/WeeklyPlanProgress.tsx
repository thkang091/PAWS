import { StyleSheet, Text, View } from "react-native";

import { ProgressBar } from "@/components/ui/ProgressBar";
import { theme } from "@/constants/theme";
import type { WeeklyPlanItem } from "@/types/domain";

export const WeeklyPlanProgress = ({ items }: { items: WeeklyPlanItem[] }) => {
  const completed = items.filter((item) => item.status === "completed").length;
  const total = items.length || 1;
  return (
    <View style={styles.stack}>
      <Text style={styles.label}>{completed} of {items.length} activities completed</Text>
      <ProgressBar accessibilityLabel="Weekly plan progress" progress={completed / total} />
    </View>
  );
};

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.sm },
  label: { color: theme.colors.textMuted, fontSize: theme.typography.sm, fontWeight: "800" },
});
