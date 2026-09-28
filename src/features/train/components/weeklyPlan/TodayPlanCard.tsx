import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { WeeklyPlanProgress } from "@/features/train/components/weeklyPlan/WeeklyPlanProgress";
import { theme } from "@/constants/theme";
import type { WeeklyPlan } from "@/types/domain";

export const TodayPlanCard = ({ plan, dogName }: { plan: WeeklyPlan; dogName: string }) => {
  const today = new Date().toISOString().slice(0, 10);
  const todayItems = plan.items.filter((item) => item.scheduledDate === today);
  const remaining = todayItems.filter((item) => item.status !== "completed");
  return (
    <AppCard>
      <View style={styles.stack}>
        <Text style={styles.title}>Today with {dogName}</Text>
        <WeeklyPlanProgress items={todayItems.length > 0 ? todayItems : plan.items} />
        <Text style={styles.copy}>{remaining.length} remaining today</Text>
        <AppButton title="Open full plan" onPress={() => router.push("/weekly-plan")} />
      </View>
    </AppCard>
  );
};

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.md },
  title: { color: theme.colors.text, fontSize: theme.typography.xl, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.sm },
});
