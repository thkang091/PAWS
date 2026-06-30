// 카메라, instruction으로 들어가는 route

import { Stack, router, useLocalSearchParams } from "expo-router";

import {
  ScriptedChallengeCamera,
  type ChallengeCaptureResult,
} from "@/components/game/ScriptedChallengeCamera";
import { getChallengeScriptByGameId } from "@/data/challengeGames/scripts";

export default function ChallengePlayScreen() {
  const { gameId, mode } = useLocalSearchParams<{
    gameId: string;
    mode?: string;
  }>();

  const challengeMode = mode === "challenge" ? "challenge" : "practice";
  const script = getChallengeScriptByGameId(gameId);

  const handleComplete = (result: ChallengeCaptureResult) => {
    if (challengeMode !== "challenge") {
      const videoUri = result.videoUri
        ? encodeURIComponent(result.videoUri)
        : "";

      router.replace(
        `/game/${gameId}/result?mode=practice&scriptId=${result.scriptId}&durationMs=${result.durationMs}&videoUri=${videoUri}`,
      );
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
      },
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScriptedChallengeCamera
        script={script}
        gameTitle={script.title}
        mode={challengeMode}
        onExit={() => router.back()}
        onComplete={handleComplete}
      />
    </>
  );
}