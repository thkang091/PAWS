import { StyleSheet, Text } from "react-native";

import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";
import type { DogMoment } from "@/types/domain";

export const OnThisDayCard = ({ moment }: { moment?: DogMoment }) => (
  <AppCard>
    <Text style={styles.title}>On this day</Text>
    <Text style={styles.copy}>{moment ? moment.caption ?? "A quiet favorite from your timeline." : "No memory from this day yet. Add today’s Dog Moment to build future recaps."}</Text>
  </AppCard>
);

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.sm, lineHeight: 20, marginTop: theme.spacing.sm },
});
