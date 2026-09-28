import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { Badge } from "@/components/ui/Badge";
import { theme } from "@/constants/theme";
import type { DailyQuest } from "@/types/domain";

export const DailyQuestCard = ({ quest, loading, onComplete }: { quest: DailyQuest; loading: boolean; onComplete: () => void }) => (
  <AppCard>
    <View style={styles.stack}>
      <View style={styles.row}>
        <Text style={styles.title}>{quest.title ?? "Daily quest"}</Text>
        <Badge label={quest.status} tone={quest.status === "completed" ? "success" : "neutral"} />
      </View>
      <Text style={styles.copy}>{quest.description}</Text>
      <Text style={styles.reward}>{quest.silverReward ?? 0} silver • {quest.bondXpReward ?? 0} XP</Text>
      <AppButton title="Complete quest" disabled={quest.status === "completed"} loading={loading} onPress={onComplete} />
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
