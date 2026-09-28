import { StyleSheet, Text } from "react-native";

import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";
import type { TrainingCategory } from "@/types/domain";

export const categoryLabels: Record<TrainingCategory, string> = {
  basics: "Basics",
  obedience: "Obedience",
  fun_tricks: "Fun tricks",
  outdoor_skills: "Outdoor skills",
  social_skills: "Social skills",
};

export const TrainingCategoryCard = ({ category, count }: { category: TrainingCategory; count: number }) => (
  <AppCard>
    <Text style={styles.title}>{categoryLabels[category]}</Text>
    <Text style={styles.copy}>{count} skills</Text>
  </AppCard>
);

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: theme.typography.md, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.sm, marginTop: theme.spacing.xs },
});
