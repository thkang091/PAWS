import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { ConfigurationRequiredScreen } from "@/components/config/ConfigurationRequiredScreen";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { AppProvider } from "@/providers/AppProvider";
import { useAuth } from "@/providers/AuthProvider";
import { initNotifications } from "@/services/notificationService";

const RootNavigator = () => {
  const {
    configurationError,
    error,
    isLoading,
    missingVariables,
    retry,
  } = useAuth();

  if (configurationError) {
    return (
      <ConfigurationRequiredScreen
        message={configurationError}
        missingVariables={missingVariables}
      />
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer centered>
        <LoadingState message="Starting your PAWS session..." />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer centered>
        <ErrorState message={error} onRetry={retry} />
      </ScreenContainer>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#FFF8EC" },
        headerShadowVisible: false,
        headerTintColor: "#2E4633",
        headerTitleStyle: { fontWeight: "900" },
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="intro" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="personalizing" options={{ headerShown: false }} />
      <Stack.Screen name="plan-selection" options={{ headerShown: false }} />
      <Stack.Screen name="tutorial" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="rewards" options={{ title: "Rewards" }} />
      <Stack.Screen name="game/[gameId]" options={{ title: "Challenge" }} />
      <Stack.Screen name="train/[skillId]" options={{ title: "Training" }} />
      <Stack.Screen name="train/activity/[dayId]" options={{ title: "Training Activity" }} />
      <Stack.Screen name="train/reference-setup/[assetType]" options={{ title: "Reference Setup", headerShown: false }} />
      <Stack.Screen name="training/history" options={{ title: "Training History" }} />
      <Stack.Screen name="training/session/[skillId]" options={{ title: "Guided Session" }} />
      <Stack.Screen name="activity/[activityId]" options={{ title: "Verify Activity" }} />
      <Stack.Screen name="weekly-plan" options={{ title: "Weekly Plan" }} />
      <Stack.Screen name="avatar-shop" options={{ title: "Avatar Shop" }} />
      <Stack.Screen name="inventory" options={{ title: "Inventory" }} />
      <Stack.Screen name="notifications-settings" options={{ title: "Notifications" }} />
      <Stack.Screen name="account/link" options={{ title: "Save Progress" }} />
      <Stack.Screen name="profile/edit" options={{ title: "Edit Profile" }} />
      <Stack.Screen name="care/event-form" options={{ title: "Care Event" }} />
      <Stack.Screen name="care/weight-log" options={{ title: "Weight Log" }} />
      <Stack.Screen name="care/vaccinations" options={{ title: "Vaccinations" }} />
      <Stack.Screen name="care/medications" options={{ title: "Medications" }} />
      <Stack.Screen name="care/exercise" options={{ title: "Exercise Log" }} />
      <Stack.Screen name="care/grooming" options={{ title: "Grooming" }} />
      <Stack.Screen name="dog-moment/calendar" options={{ title: "Moment Calendar" }} />
      <Stack.Screen name="dog-moment/recap" options={{ title: "Monthly Recap" }} />
      <Stack.Screen name="dog-moment/share" options={{ title: "Share Moment" }} />
      <Stack.Screen name="dev-test" options={{ headerShown: false }} />
    </Stack>
  );
};

export default function RootLayout() {
  useEffect(() => {
    initNotifications();
  }, []);

  return (
    <AppProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AppProvider>
  );
}
