import { StyleSheet, Text, View } from "react-native";

import { AppCard } from "@/components/ui/AppCard";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { theme } from "@/constants/theme";
import type { TrainingProgress, TrainingSkill } from "@/types/domain";

export const TrainingSkillCard = ({ skill, progress, onPress }: { skill: TrainingSkill; progress?: TrainingProgress; onPress: () => void }) => (
  <AppCard onPress={onPress} accessibilityLabel={`Open ${skill.name}`}>
    <View style={styles.stack}>
      <View style={styles.row}>
        <Text style={styles.title}>{skill.name}</Text>
        <Badge label={`${skill.estimatedMinutes} min`} />
      </View>
      <Text style={styles.copy}>{skill.description}</Text>
      <ProgressBar accessibilityLabel={`${skill.name} progress`} progress={(progress?.completionPercentage ?? 0) / 100} />
      <Text style={styles.reward}>{skill.silverReward} silver • {skill.bondXpReward} XP</Text>
    </View>
  </AppCard>
);

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.md },
  title: { flex: 1, color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.sm, lineHeight: 20 },
  reward: { color: theme.colors.secondary, fontSize: theme.typography.sm, fontWeight: "800" },
});
