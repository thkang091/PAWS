import { Stack } from "expo-router";

import { bg } from "@/constants/design";
import { OnboardingDraftProvider } from "@/providers/OnboardingDraftProvider";

export default function OnboardingLayout() {
  return (
    <OnboardingDraftProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: bg.canvas },
          animation: "slide_from_right",
        }}
      />
    </OnboardingDraftProvider>
  );
}
