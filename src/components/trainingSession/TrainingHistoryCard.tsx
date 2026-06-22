import { StyleSheet, Text } from "react-native";

import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";

export const TrainingHistoryCard = ({ title, completedAt }: { title: string; completedAt: string }) => (
  <AppCard>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.copy}>{new Date(completedAt).toLocaleString()}</Text>
  </AppCard>
);

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: theme.typography.md, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.sm, marginTop: theme.spacing.xs },
});
