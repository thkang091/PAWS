import { StyleSheet, Text, View } from "react-native";

import { theme } from "@/constants/theme";
import type { StatusTone } from "@/types/domain";

type BadgeProps = {
  label: string;
  tone?: StatusTone;
};

export const Badge = ({ label, tone = "neutral" }: BadgeProps) => (
  <View style={[styles.badge, styles[tone]]}>
    <Text style={[styles.text, styles[`${tone}Text`]]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  text: {
    fontSize: theme.typography.xs,
    fontWeight: "800",
  },
  neutral: {
    backgroundColor: theme.colors.cardMuted,
  },
  success: {
    backgroundColor: theme.colors.successSoft,
  },
  warning: {
    backgroundColor: theme.colors.warningSoft,
  },
  error: {
    backgroundColor: theme.colors.errorSoft,
  },
  neutralText: {
    color: theme.colors.textMuted,
  },
  successText: {
    color: theme.colors.success,
  },
  warningText: {
    color: theme.colors.warning,
  },
  errorText: {
    color: theme.colors.error,
  },
});
