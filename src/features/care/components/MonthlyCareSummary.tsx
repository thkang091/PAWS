import { StyleSheet, Text } from "react-native";

import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";
import type { CareEvent, WeightLog } from "@/types/domain";

export const MonthlyCareSummary = ({ events, weightLogs }: { events: CareEvent[]; weightLogs: WeightLog[] }) => (
  <AppCard>
    <Text style={styles.title}>Monthly care summary</Text>
    <Text style={styles.copy}>{events.length} care events logged</Text>
    <Text style={styles.copy}>{weightLogs.length} weight entries</Text>
    <Text style={styles.note}>PAWS organizes owner-entered information and is not veterinary advice.</Text>
  </AppCard>
);

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.sm, marginTop: theme.spacing.xs },
  note: { color: theme.colors.warning, fontSize: theme.typography.xs, lineHeight: 18, marginTop: theme.spacing.md },
});
