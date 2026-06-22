import { StyleSheet, Text } from "react-native";

import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";

export const CareCalendar = () => (
  <AppCard>
    <Text style={styles.title}>{new Date().toLocaleString(undefined, { month: "long", year: "numeric" })}</Text>
    <Text style={styles.copy}>Calendar grid interactions will expand from the real care-event list below.</Text>
  </AppCard>
);

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.sm, lineHeight: 20, marginTop: theme.spacing.sm },
});
