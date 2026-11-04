import { Redirect, Stack, useGlobalSearchParams, usePathname } from "expo-router";
import { TOURNAMENT_ENABLED } from "@/features/game/flow/gameFlow";

export default function GameLayout() {
  const { mode } = useGlobalSearchParams<{ mode?: string | string[] }>();
  const pathname = usePathname();
  const tournament = Array.isArray(mode) ? mode.includes("tournament") : mode === "tournament";
  if (!TOURNAMENT_ENABLED && tournament && pathname !== "/game/tournament") {
    return <Redirect href="/game/tournament" />;
  }
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="[gameId]" options={{ headerShown: true, title: "Challenge" }} />
  </Stack>;
}
