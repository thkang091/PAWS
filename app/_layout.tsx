import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { CheckInLock } from "@/features/care/components/CheckInLock";
import { AppProvider } from "@/providers/AppProvider";
import { useAuth } from "@/providers/AuthProvider";
import { initNotifications } from "@/services/notificationService";

const RootNavigator = () => {
  useAuth();

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
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="personalizing" options={{ headerShown: false }} />
      <Stack.Screen name="plan-selection" options={{ headerShown: false }} />
      <Stack.Screen name="tutorial" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="rewards" options={{ title: "Rewards" }} />
      <Stack.Screen name="game/shop" options={{ headerShown: false }} />
      <Stack.Screen name="game/store" options={{ headerShown: false }} />
      <Stack.Screen name="game/challenge" options={{ headerShown: false }} />
      <Stack.Screen name="game/[gameId]" options={{ title: "Challenge" }} />
      <Stack.Screen name="train/lesson-preview" options={{ headerShown: false }} />
      <Stack.Screen
        name="train/help"
        options={{ headerShown: false, presentation: "transparentModal", animation: "none" }}
      />
      <Stack.Screen name="train/lesson/[skillId]" options={{ headerShown: false }} />
      <Stack.Screen name="train/activity/[dayId]" options={{ title: "Training Activity" }} />
      <Stack.Screen name="train/reference-setup/[assetType]" options={{ title: "Reference Setup", headerShown: false }} />
      <Stack.Screen name="training/history" options={{ title: "Training History" }} />
      <Stack.Screen name="activity/[activityId]" options={{ title: "Verify Activity" }} />
      <Stack.Screen name="weekly-plan" options={{ title: "Weekly Plan" }} />
      <Stack.Screen name="avatar-shop" options={{ title: "Avatar Shop" }} />
      <Stack.Screen name="inventory" options={{ title: "Inventory" }} />
      <Stack.Screen name="notifications-settings" options={{ headerShown: false }} />
      <Stack.Screen name="account/link" options={{ headerShown: false }} />
      <Stack.Screen name="auth/callback" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="profile/edit" options={{ title: "Edit Profile" }} />
      <Stack.Screen name="profile/[section]" options={{ headerShown: false }} />
      <Stack.Screen name="profile/progress" options={{ headerShown: false }} />
      <Stack.Screen name="profile/settings" options={{ headerShown: false }} />
      <Stack.Screen name="profile/get-to-know" options={{ headerShown: false }} />
      <Stack.Screen name="care/schedule" options={{ headerShown: false }} />
      <Stack.Screen name="care/find-vet" options={{ headerShown: false }} />
      <Stack.Screen name="care/book-visit" options={{ headerShown: false }} />
      <Stack.Screen name="care/emergency" options={{ headerShown: false }} />
      <Stack.Screen name="care/pharmacy" options={{ headerShown: false }} />
      <Stack.Screen name="care/setup" options={{ headerShown: false }} />
      <Stack.Screen name="care/walk" options={{ headerShown: false }} />
      <Stack.Screen name="care/plan-walk" options={{ headerShown: false }} />
      <Stack.Screen name="care/food-plan" options={{ headerShown: false }} />
      <Stack.Screen name="care/food-browse" options={{ headerShown: false }} />
      <Stack.Screen name="care/food-item" options={{ headerShown: false }} />
      <Stack.Screen name="care/food-change" options={{ headerShown: false }} />
      <Stack.Screen name="care/food-prefs" options={{ headerShown: false }} />
      <Stack.Screen name="care/food-check" options={{ headerShown: false }} />
      <Stack.Screen name="care/food-rules" options={{ headerShown: false }} />
      <Stack.Screen name="care/food-search" options={{ headerShown: false }} />
      <Stack.Screen name="care/routine-form" options={{ headerShown: false }} />
      <Stack.Screen name="care/weight-log" options={{ headerShown: false }} />
      <Stack.Screen name="care/vaccinations" options={{ headerShown: false }} />
      <Stack.Screen name="care/preventive" options={{ headerShown: false }} />
      <Stack.Screen name="care/records" options={{ headerShown: false }} />
      <Stack.Screen name="care/log-care" options={{ headerShown: false }} />
      <Stack.Screen name="care/record" options={{ headerShown: false }} />
      <Stack.Screen name="care/check-in-edit" options={{ headerShown: false }} />
      <Stack.Screen name="care/medications" options={{ headerShown: false }} />
      <Stack.Screen name="care/exercise" options={{ headerShown: false }} />
      <Stack.Screen name="care/grooming" options={{ headerShown: false }} />
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <StatusBar style="dark" />
        <RootNavigator />
        {/* The evening check-in covers every screen once it is due, until it is answered. */}
        <CheckInLock />
      </AppProvider>
    </GestureHandlerRootView>
  );
}
