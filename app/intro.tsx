import { useCallback, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { RunningMascot } from "@/components/mascot/RunningMascot";
import { AppButton } from "@/components/ui/AppButton";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useCurrentPlanSelection } from "@/hooks/usePlanSelection";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

export default function IntroScreen() {
  const opacity = useSharedValue(0);
  const profileQuery = useCurrentProfile();
  const dogQuery = useCurrentDog();
  const planQuery = useCurrentPlanSelection();

  useEffect(() => {
    opacity.value = withDelay(250, withTiming(1, { duration: 900 }));
  }, [opacity]);

  const titleStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const decideNextRoute = useCallback(() => {
    const profile = profileQuery.data;
    const dog = dogQuery.data;
    const planId = planQuery.data;

    if (!dog || !profile?.onboardingCompleted) {
      router.replace("/onboarding");
      return;
    }
    if (!planId) {
      router.replace("/plan-selection");
      return;
    }
    if (!profile.tutorialCompleted) {
      router.replace("/tutorial");
      return;
    }
    router.replace("/(tabs)/train");
  }, [dogQuery.data, planQuery.data, profileQuery.data]);

  if (profileQuery.isLoading || dogQuery.isLoading || planQuery.isLoading) {
    return (
      <ScreenContainer centered>
        <LoadingState message="Checking your PAWS setup..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer padded={false}>
      <View style={styles.container}>
        <Animated.View style={[styles.titleWrap, titleStyle]}>
          <Text style={styles.logo}>PAWS</Text>
          <Text style={styles.subtitle}>Tiny daily wins for a very good training life.</Text>
        </Animated.View>
        <RunningMascot duration={5000} onAnimationComplete={decideNextRoute} size={118} />
        {__DEV__ ? (
          <View style={styles.skip}>
            <AppButton title="Skip intro" variant="ghost" onPress={decideNextRoute} />
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", gap: theme.spacing.xxxl, backgroundColor: theme.colors.background },
  titleWrap: { alignItems: "center", paddingHorizontal: theme.spacing.xl, gap: theme.spacing.sm },
  logo: { color: theme.colors.primaryDark, fontSize: theme.typography.display, fontWeight: "900", letterSpacing: 0 },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.typography.md, lineHeight: 22, textAlign: "center" },
  skip: { alignItems: "center" },
});
