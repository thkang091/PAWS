import { StyleSheet, Text, View } from "react-native";

import { WeeklyPlanItemCard } from "@/features/train/components/weeklyPlan/WeeklyPlanItemCard";
import { theme } from "@/constants/theme";
import type { WeeklyPlanItem } from "@/types/domain";

export const WeeklyPlanDaySection = ({ date, items, onComplete, loading }: { date: string; items: WeeklyPlanItem[]; onComplete: (itemId: string) => void; loading: boolean }) => (
  <View style={styles.stack}>
    <Text style={styles.date}>{new Date(date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</Text>
    {items.map((item) => <WeeklyPlanItemCard key={item.id} item={item} loading={loading} onComplete={() => onComplete(item.id)} />)}
  </View>
);

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.md },
  date: { color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900" },
});
