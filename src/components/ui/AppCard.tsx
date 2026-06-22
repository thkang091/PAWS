import { Pressable, StyleSheet, View } from "react-native";
import type { PropsWithChildren } from "react";

import { theme } from "@/constants/theme";

type AppCardProps = PropsWithChildren<{
  onPress?: () => void;
  accessibilityLabel?: string;
}>;

export const AppCard = ({ children, onPress, accessibilityLabel }: AppCardProps) => {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={styles.card}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: theme.spacing.lg,
    ...theme.shadows.soft,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
});
