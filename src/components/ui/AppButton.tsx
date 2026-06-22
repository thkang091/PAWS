import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { theme } from "@/constants/theme";

type AppButtonVariant = "primary" | "secondary" | "ghost";

type AppButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: AppButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  accessibilityLabel?: string;
};

export const AppButton = ({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  accessibilityLabel,
}: AppButtonProps) => {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? theme.colors.white : theme.colors.primary} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.text, styles[`${variant}Text`]]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  primary: {
    backgroundColor: theme.colors.primary,
  },
  secondary: {
    backgroundColor: theme.colors.secondarySoft,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  text: {
    fontSize: theme.typography.md,
    fontWeight: "700",
  },
  primaryText: {
    color: theme.colors.white,
  },
  secondaryText: {
    color: theme.colors.primaryDark,
  },
  ghostText: {
    color: theme.colors.primary,
  },
});
