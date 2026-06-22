import { StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { theme } from "@/constants/theme";
import { AppButton } from "@/components/ui/AppButton";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  actionLabel?: string;
  onActionPress?: () => void;
};

export const EmptyState = ({
  title,
  description,
  icon,
  actionLabel,
  onActionPress,
}: EmptyStateProps) => (
  <View style={styles.container}>
    {icon ? <View style={styles.icon}>{icon}</View> : null}
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.description}>{description}</Text>
    {actionLabel && onActionPress ? (
      <AppButton title={actionLabel} onPress={onActionPress} variant="secondary" />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
  },
  icon: {
    marginBottom: theme.spacing.xs,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.xl,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.md,
    lineHeight: 22,
    textAlign: "center",
  },
});
