import { StyleSheet, Text } from "react-native";

import { space, text, type } from "@/constants/design";

export const FieldLabel = ({ children }: { children: string }) => (
  <Text style={styles.label} accessibilityRole="header">
    {children.toUpperCase()}
  </Text>
);

const styles = StyleSheet.create({
  label: {
    ...type.eyebrow,
    color: text.secondary,
    marginBottom: space.md,
  },
});
