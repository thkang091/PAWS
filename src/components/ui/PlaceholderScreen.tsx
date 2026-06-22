import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { Badge } from "@/components/ui/Badge";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { theme } from "@/constants/theme";

type PlaceholderScreenProps = {
  title: string;
  description: string;
  nextPhase: string;
  nextActionLabel?: string;
  onNextAction?: () => void;
};

export const PlaceholderScreen = ({
  title,
  description,
  nextPhase,
  nextActionLabel,
  onNextAction,
}: PlaceholderScreenProps) => (
  <ScreenContainer scroll>
    <SectionHeader title={title} subtitle={description} />
    <AppCard>
      <View style={styles.cardContent}>
        <Badge label="Setup placeholder" tone="neutral" />
        <MaterialCommunityIcons
          color={theme.colors.primary}
          name="paw"
          size={theme.iconSizes.xl}
        />
        <Text style={styles.cardTitle}>Coming in the next build phase</Text>
        <Text style={styles.cardCopy}>{nextPhase}</Text>
        <View style={styles.actions}>
          {nextActionLabel && onNextAction ? (
            <AppButton fullWidth title={nextActionLabel} onPress={onNextAction} />
          ) : null}
          {router.canGoBack() ? (
            <AppButton fullWidth title="Go back" variant="ghost" onPress={() => router.back()} />
          ) : null}
        </View>
      </View>
    </AppCard>
  </ScreenContainer>
);

const styles = StyleSheet.create({
  cardContent: {
    gap: theme.spacing.lg,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.lg,
    fontWeight: "900",
  },
  cardCopy: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.md,
    lineHeight: 22,
  },
  actions: {
    gap: theme.spacing.sm,
  },
});
