import { StyleSheet, Text, View } from "react-native";

import { theme } from "@/constants/theme";

type MascotFallbackProps = {
  size: number;
};

export const MascotFallback = ({ size }: MascotFallbackProps) => (
  <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={[styles.emoji, { fontSize: size * 0.55 }]}>🐶</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondarySoft,
    borderColor: theme.colors.card,
    borderWidth: 4,
    ...theme.shadows.raised,
  },
  emoji: {
    includeFontPadding: false,
  },
});
