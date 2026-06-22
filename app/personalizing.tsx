import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { router } from "expo-router";

import { RunningMascot } from "@/components/mascot/RunningMascot";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";
import { todayKey, useInitializeDailyQuests } from "@/hooks/useDailyQuests";
import { useCurrentDog } from "@/hooks/useCurrentDog";

const copy = ["Learning about your dog...", "Preparing the first quests...", "Choosing a good place to begin..."];

export default function PersonalizingScreen() {
  const dogQuery = useCurrentDog();
  const dogId = dogQuery.data?.id ?? "";
  const initialize = useInitializeDailyQuests(dogId, todayKey());
  const [progress, setProgress] = useState(0.05);
  const [copyIndex, setCopyIndex] = useState(0);
  const started = useMemo(() => ({ value: false }), []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((value) => Math.min(0.95, value + 0.08));
      setCopyIndex((value) => (value + 1) % copy.length);
    }, 900);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!dogId || started.value) return;
    started.value = true;
    const startedAt = Date.now();
    initialize.mutate(undefined, {
      onSuccess: () => {
        const remaining = Math.max(0, 2800 - (Date.now() - startedAt));
        setTimeout(() => {
          setProgress(1);
          router.replace("/plan-selection");
        }, remaining);
      },
    });
  }, [dogId, initialize, started]);

  if (dogQuery.isLoading) {
    return (
      <ScreenContainer centered>
        <LoadingState message="Finding your dog profile..." />
      </ScreenContainer>
    );
  }

  if (!dogQuery.data) {
    return (
      <ScreenContainer centered>
        <ErrorState message="Create a dog profile before personalization." onRetry={() => router.replace("/onboarding")} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer centered>
      <AppCard>
        <Text style={styles.title}>Personalizing PAWS</Text>
        <RunningMascot duration={3000} loop size={88} />
        <Text style={styles.copy}>{copy[copyIndex]}</Text>
        <ProgressBar accessibilityLabel="Personalization progress" progress={progress} />
        {initialize.error ? <ErrorState message={initialize.error.message} onRetry={() => initialize.mutate()} /> : null}
        {initialize.error ? <AppButton title="Retry" onPress={() => initialize.mutate()} /> : null}
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: theme.typography.xl, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.md, lineHeight: 22, marginVertical: theme.spacing.lg },
});
