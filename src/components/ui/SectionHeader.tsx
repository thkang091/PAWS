import { StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { theme } from "@/constants/theme";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export const SectionHeader = ({ title, subtitle, action }: SectionHeaderProps) => (
  <View style={styles.container}>
    <View style={styles.copy}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
    {action}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.lg,
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.xl,
    fontWeight: "900",
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.md,
    lineHeight: 22,
  },
});
