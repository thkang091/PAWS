import { StyleSheet, Text } from "react-native";

import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";
import type { DogMoment } from "@/types/domain";

export const MonthlyRecapCard = ({ moments }: { moments: DogMoment[] }) => (
  <AppCard>
    <Text style={styles.title}>Monthly recap</Text>
    <Text style={styles.big}>{moments.length}</Text>
    <Text style={styles.copy}>private memories saved this month</Text>
  </AppCard>
);

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900" },
  big: { color: theme.colors.primaryDark, fontSize: theme.typography.display, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.sm },
});
