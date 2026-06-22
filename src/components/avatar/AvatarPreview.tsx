import { StyleSheet, Text, View } from "react-native";

import { MascotFallback } from "@/components/mascot/MascotFallback";
import { theme } from "@/constants/theme";

export const AvatarPreview = ({ label = "PAWS avatar" }: { label?: string }) => (
  <View style={styles.preview}>
    <MascotFallback size={96} />
    <Text style={styles.label}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  preview: { alignItems: "center", gap: theme.spacing.md },
  label: { color: theme.colors.textMuted, fontSize: theme.typography.sm, fontWeight: "800" },
});
