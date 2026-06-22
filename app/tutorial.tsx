import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { queryKeys } from "@/constants/queryKeys";
import { theme } from "@/constants/theme";
import { updateTutorialCompleted } from "@/services/profileService";

const cards = [
  ["Train together", "Complete short lessons and earn silver coins."],
  ["Build your bond", "Earn Bond XP and improve your dog’s status attributes."],
  ["Capture daily moments", "Upload one Dog Moment each day and build a streak."],
  ["Take care consistently", "Complete quests and track activities in the care calendar."],
] as const;

export default function TutorialScreen() {
  const [index, setIndex] = useState(0);
  const queryClient = useQueryClient();
  const complete = useMutation({
    mutationFn: updateTutorialCompleted,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      router.replace("/(tabs)/train");
    },
  });
  const card = cards[index];
  const isLast = index === cards.length - 1;

  return (
    <ScreenContainer centered>
      <SectionHeader title="How PAWS works" subtitle="A quick tour before the daily loop begins." />
      <AppCard>
        <Text style={styles.count}>{index + 1} / {cards.length}</Text>
        <Text style={styles.title}>{card[0]}</Text>
        <Text style={styles.copy}>{card[1]}</Text>
        {complete.error ? <Text style={styles.error}>{complete.error.message}</Text> : null}
        <AppButton title={isLast ? "Start training" : "Next"} loading={complete.isPending} onPress={() => (isLast ? complete.mutate() : setIndex((value) => value + 1))} />
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  count: { color: theme.colors.secondary, fontSize: theme.typography.sm, fontWeight: "900" },
  title: { color: theme.colors.text, fontSize: theme.typography.xxl, fontWeight: "900", marginVertical: theme.spacing.md },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.lg, lineHeight: 26, marginBottom: theme.spacing.xl },
  error: { color: theme.colors.error, fontSize: theme.typography.sm, fontWeight: "700" },
});
