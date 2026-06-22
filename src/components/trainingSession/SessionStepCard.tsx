import { StyleSheet, Text } from "react-native";

import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";

export const SessionStepCard = ({ step, index, total }: { step: string; index: number; total: number }) => (
  <AppCard>
    <Text style={styles.kicker}>Step {index + 1} of {total}</Text>
    <Text style={styles.step}>{step}</Text>
  </AppCard>
);

const styles = StyleSheet.create({
  kicker: { color: theme.colors.secondary, fontSize: theme.typography.sm, fontWeight: "900" },
  step: { color: theme.colors.text, fontSize: theme.typography.xl, fontWeight: "900", lineHeight: 30, marginTop: theme.spacing.md },
});
