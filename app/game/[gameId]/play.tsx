import { useMemo, useState } from "react";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text, View } from "react-native";

import {
  ScriptedChallengeCamera,
  type ChallengeCaptureResult,
} from "@/components/game/ScriptedChallengeCamera";
import VisionDogFramingGate from "@/components/game/VisionDogFramingGate";
import { theme } from "@/constants/theme";
import { getChallengeScriptByGameId } from "@/data/challengeGames/scripts";

type PlayPhase = "framing" | "transitioning" | "recording";

export default function ChallengePlayScreen() {
  const params = useLocalSearchParams<{
    gameId?: string | string[];
    mode?: string | string[];
    tournamentId?: string | string[];
  }>();

  const gameId = useMemo(() => {
    const rawGameId = params.gameId;
    return Array.isArray(rawGameId) ? rawGameId[0] : rawGameId ?? "";
  }, [params.gameId]);

  const mode = useMemo(() => {
    const rawMode = params.mode;
    return Array.isArray(rawMode) ? rawMode[0] : rawMode;
  }, [params.mode]);

  const challengeMode = mode === "challenge" ? "challenge" : "practice";
  const tournamentId = useMemo(() => {
    const rawTournamentId = params.tournamentId;
    return Array.isArray(rawTournamentId)
      ? rawTournamentId[0]
      : rawTournamentId;
  }, [params.tournamentId]);
  const script = getChallengeScriptByGameId(gameId);

  const [phase, setPhase] = useState<PlayPhase>("framing");

  const handleExit = () => {
    router.back();
  };

  const handleFramingReady = () => {
    setPhase("transitioning");

    setTimeout(() => {
      setPhase("recording");
    }, 350);
  };

  const handleComplete = (result: ChallengeCaptureResult) => {
    console.log("Challenge capture result:", result);

    if (challengeMode !== "challenge") {
      router.replace(`/game/${gameId}`);
      return;
    }

    if (!result.videoUri) {
      console.warn("Challenge recording completed without a videoUri.");
      router.replace(`/game/${gameId}`);
      return;
    }

    router.replace({
      pathname: "/game/[gameId]/submit",
      params: {
        gameId,
        videoUri: result.videoUri,
        scriptId: result.scriptId,
        durationMs: String(result.durationMs),
        ...(tournamentId ? { tournamentId } : {}),
      },
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      {phase === "framing" ? (
        <VisionDogFramingGate
          title={script.title}
          onExit={handleExit}
          onReady={handleFramingReady}
        />
      ) : null}

      {phase === "transitioning" ? (
        <SafeAreaView style={styles.transitionScreen}>
          <View style={styles.transitionCard}>
            <Text style={styles.transitionTitle}>Starting challenge...</Text>
            <Text style={styles.transitionBody}>
              Keep your dog in frame. Recording will begin now.
            </Text>
          </View>
        </SafeAreaView>
      ) : null}

      {phase === "recording" ? (
        <ScriptedChallengeCamera
          script={script}
          gameTitle={script.title}
          mode={challengeMode}
          autoStart
          onExit={handleExit}
          onComplete={handleComplete}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  transitionScreen: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  transitionCard: {
    width: "100%",
    borderRadius: theme.radii.xl,
    backgroundColor: "rgba(255,255,255,0.12)",
    padding: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  transitionTitle: {
    color: theme.colors.white,
    fontSize: theme.typography.xl,
    fontWeight: "900",
    textAlign: "center",
  },
  transitionBody: {
    color: "rgba(255,255,255,0.72)",
    fontSize: theme.typography.sm,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20,
  },
});
