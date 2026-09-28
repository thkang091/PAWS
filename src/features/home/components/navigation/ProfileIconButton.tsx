import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { theme } from "@/constants/theme";

export const ProfileIconButton = ({ label }: { label?: string }) => (
  <Pressable
    style={styles.button}
    onPress={() => router.push("/(tabs)/profile")}
    accessibilityRole="button"
    accessibilityLabel="Open profile"
  >
    {label ? (
      <Text style={styles.initial}>{label.slice(0, 1).toUpperCase()}</Text>
    ) : (
      <Ionicons name="person-outline" size={18} color={theme.colors.primaryDark} />
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexShrink: 0,
  },
  initial: {
    color: theme.colors.primaryDark,
    fontSize: theme.typography.sm,
    fontWeight: "900",
  },
});
