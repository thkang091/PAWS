import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { AppButton } from "@/components/ui/AppButton";
import { theme } from "@/constants/theme";

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
};

export const ErrorState = ({ message, onRetry }: ErrorStateProps) => (
  <View style={styles.container}>
    <MaterialCommunityIcons
      color={theme.colors.error}
      name="alert-circle-outline"
      size={theme.iconSizes.xl}
    />
    <Text style={styles.title}>Something needs another try</Text>
    <Text style={styles.message}>{message}</Text>
    {onRetry ? <AppButton title="Retry" onPress={onRetry} /> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.xl,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.md,
    lineHeight: 22,
    textAlign: "center",
  },
});
