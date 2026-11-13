import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Redirect, router } from "expo-router";

import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { useSeasonalChallenges } from "@/hooks/usePhotoPose";
import { bg, space, text } from "@/constants/design";

/**
 * This month's Seasonal Selfie, wherever a link only knows the game (Best of the week): opens the challenge itself,
 * or its vote once entries have closed. Says so plainly when there is none to open.
 */
export default function SeasonalScreen() {
  const seasonal = useSeasonalChallenges();
  const current =
    (seasonal.data ?? [])
      .filter((c) => !c.private && (c.phase === "entries" || c.phase === "voting"))
      .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0] ?? null;

  if (current) return <Redirect href={{ pathname: current.phase === "voting" ? "/game/tournament/pose-vote" : "/game/tournament/pose", params: { challengeId: current.challengeId } }} />;

  return (
    <View style={styles.screen}>
      {seasonal.isPending ? (
        <ActivityIndicator color={text.primary} />
      ) : (
        <>
          <Text style={styles.title}>{seasonal.isError ? "Couldn't open this month's selfie" : "No seasonal selfie right now"}</Text>
          <Text style={styles.line}>{seasonal.isError ? "Check your connection and try again." : "A new one opens on the first of the month."}</Text>
          <View style={styles.button}>
            <RaisedButton tone="white" label={seasonal.isError ? "Try again" : "Back"} onPress={() => (seasonal.isError ? void seasonal.refetch() : router.back())} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl, gap: space.sm, backgroundColor: bg.canvas },
  title: { fontSize: 24, lineHeight: 29, fontWeight: "800", letterSpacing: -0.5, color: text.primary, textAlign: "center" },
  line: { fontSize: 15, lineHeight: 21, fontWeight: "600", color: text.secondary, textAlign: "center" },
  button: { alignSelf: "stretch", marginTop: space.lg },
});
