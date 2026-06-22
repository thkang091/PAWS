import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { useAccountStatus } from "@/hooks/useAccountStatus";
import { theme } from "@/constants/theme";

export const SaveProgressBanner = ({ forceVisible = false }: { forceVisible?: boolean }) => {
  const [dismissed, setDismissed] = useState(false);
  const status = useAccountStatus();

  if (dismissed || (!forceVisible && !status.data?.isAnonymous)) return null;

  return (
    <AppCard>
      <View style={styles.stack}>
        <Text style={styles.title}>Save your progress</Text>
        <Text style={styles.copy}>Link an account so you can keep your dog’s memories, streaks, and rewards if you change phones.</Text>
        <View style={styles.actions}>
          <AppButton title="Save progress" onPress={() => router.push("/account/link")} />
          <AppButton title="Maybe later" variant="ghost" onPress={() => setDismissed(true)} />
        </View>
      </View>
    </AppCard>
  );
};

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.md },
  title: { color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.sm, lineHeight: 20 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
});
