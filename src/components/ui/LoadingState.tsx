import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { theme } from "@/constants/theme";

type LoadingStateProps = {
  message?: string;
};

export const LoadingState = ({ message = "Loading PAWS..." }: LoadingStateProps) => (
  <View accessibilityRole="progressbar" style={styles.container}>
    <ActivityIndicator color={theme.colors.primary} size="large" />
    <Text style={styles.message}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: theme.spacing.lg,
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  message: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.md,
    fontWeight: "700",
  },
});
