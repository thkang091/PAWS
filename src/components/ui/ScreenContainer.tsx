import { ScrollView, StyleSheet, View } from "react-native";
import type { PropsWithChildren } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";

type ScreenContainerProps = PropsWithChildren<{
  scroll?: boolean;
  padded?: boolean;
  centered?: boolean;
}>;

export const ScreenContainer = ({
  children,
  scroll = false,
  padded = true,
  centered = false,
}: ScreenContainerProps) => {
  const contentStyle = [styles.content, padded && styles.padded, centered && styles.centered];

  return (
    <SafeAreaView style={styles.safeArea}>
      {scroll ? (
        <ScrollView contentContainerStyle={contentStyle}>{children}</ScrollView>
      ) : (
        <View style={contentStyle}>{children}</View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    gap: theme.spacing.lg,
  },
  padded: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
});
