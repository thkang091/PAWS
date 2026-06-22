import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { theme } from "@/constants/theme";

type SelectChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: ReactNode;
};

export const SelectChip = ({ label, selected, onPress, icon }: SelectChipProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ selected }}
    onPress={onPress}
    style={({ pressed }) => [
      styles.chip,
      selected && styles.selected,
      pressed && styles.pressed,
    ]}
  >
    <View style={styles.content}>
      {icon}
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.card,
  },
  selected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sm,
    fontWeight: "800",
  },
  selectedLabel: {
    color: theme.colors.primaryDark,
  },
});
