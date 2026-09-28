import { StyleSheet, Text } from "react-native";

import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";

export const DogTagCard = ({ tag }: { tag: string }) => (
  <AppCard>
    <Text style={styles.label}>Dog Tag</Text>
    <Text style={styles.tag}>{tag}</Text>
  </AppCard>
);

const styles = StyleSheet.create({
  label: { color: theme.colors.textMuted, fontSize: theme.typography.sm, fontWeight: "800" },
  tag: { color: theme.colors.primaryDark, fontSize: theme.typography.xl, fontWeight: "900", marginTop: theme.spacing.xs },
});
