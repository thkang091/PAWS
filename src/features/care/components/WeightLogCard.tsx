import { StyleSheet, Text } from "react-native";

import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";
import type { WeightLog } from "@/types/domain";

export const WeightLogCard = ({ log }: { log: WeightLog }) => (
  <AppCard>
    <Text style={styles.title}>{log.weightValue} {log.weightUnit}</Text>
    <Text style={styles.copy}>{new Date(log.recordedAt).toLocaleDateString()}</Text>
    {log.note ? <Text style={styles.copy}>{log.note}</Text> : null}
  </AppCard>
);

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: theme.typography.xl, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.sm, lineHeight: 20, marginTop: theme.spacing.xs },
});
