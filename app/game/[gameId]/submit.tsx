import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";
import { queryKeys } from "@/constants/queryKeys";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { submitTournamentVideo } from "@/services/tournamentService";

type SubmitPhase = "ready" | "uploading" | "verifying" | "complete" | "error";

export default function ChallengeSubmitScreen() {
  const { gameId, videoUri, scriptId, durationMs, tournamentId } = useLocalSearchParams<{
    gameId: string;
    videoUri?: string | string[];
    scriptId?: string;
    durationMs?: string;
    tournamentId?: string | string[];
  }>();

  const resolvedVideoUri = Array.isArray(videoUri) ? videoUri[0] : videoUri;
  const resolvedTournamentId = Array.isArray(tournamentId)
    ? tournamentId[0]
    : tournamentId;
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<SubmitPhase>("ready");
  const [feedback, setFeedback] = useState<string | null>(null);

  const fileName = useMemo(() => {
    if (!resolvedVideoUri) return "No video file";
    return resolvedVideoUri.split("/").pop() ?? resolvedVideoUri;
  }, [resolvedVideoUri]);

  const handleBackToChallenge = () => {
    if (resolvedTournamentId) {
      router.replace(`/game/tournament/${resolvedTournamentId}`);
      return;
    }
    router.replace(`/game/${gameId}`);
  };

  const handleRetake = () => {
    router.replace({
      pathname: "/game/[gameId]/play",
      params: {
        gameId,
        mode: "challenge",
        ...(resolvedTournamentId
          ? { tournamentId: resolvedTournamentId }
          : {}),
      },
    });
  };

  const handleTournamentSubmit = async () => {
    if (
      !resolvedTournamentId ||
      !resolvedVideoUri ||
      !dogId ||
      (phase !== "ready" && phase !== "error")
    ) {
      return;
    }

    try {
      setFeedback(null);
      setPhase("uploading");
      const result = await submitTournamentVideo(
        resolvedTournamentId,
        dogId,
        gameId,
        resolvedVideoUri,
        {
          onUploaded: () => setPhase("verifying"),
          onVerifying: () => setPhase("verifying"),
        },
      );
      setPhase("complete");
      setFeedback(
        result.verdict === "PASS"
          ? `Verified provisional score: ${result.attempt.provisionalScore ?? 0}. PAWS admin review is still required.`
          : result.verdict === "NEEDS_REVIEW"
            ? "Verification needs human review. Your attempt is now in the PAWS admin queue."
            : "The verifier did not confirm a pass. PAWS admin will review the attempt before rankings are final.",
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.tournamentEntry(resolvedTournamentId, dogId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.tournamentLeaderboard(resolvedTournamentId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.tournamentEvent(resolvedTournamentId),
        }),
      ]);
    } catch (error) {
      setPhase("error");
      setFeedback(
        error instanceof Error
          ? error.message
          : "Tournament submission failed. Please try again.",
      );
    }
  };

  const isTournament = Boolean(resolvedTournamentId);
  const busy = phase === "uploading" || phase === "verifying";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenContainer centered>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={resolvedVideoUri ? "cloud-upload-outline" : "alert-circle-outline"}
              size={44}
              color={resolvedVideoUri ? theme.colors.primaryDark : theme.colors.error}
            />
          </View>

          <Text style={styles.eyebrow}>
            {isTournament ? "Tournament Attempt" : "Challenge Submit"}
          </Text>

          <Text style={styles.title}>
            {resolvedVideoUri ? "Video captured" : "No video found"}
          </Text>

          <Text style={styles.body}>
            {resolvedVideoUri
              ? isTournament
                ? "Your recording is ready. Upload it for trusted verification and PAWS admin review. No additional entry fee will be charged."
                : "Your recording is ready. The next step will upload this video, then charge silver after the upload succeeds."
              : "The challenge finished, but PAWS could not find the recorded video file."}
          </Text>

          {resolvedVideoUri ? (
            <View style={styles.debugBox}>
              <Text style={styles.debugLabel}>Temporary debug info</Text>
              <Text style={styles.debugText}>Game ID: {gameId}</Text>
              <Text style={styles.debugText}>Script ID: {scriptId ?? "unknown"}</Text>
              <Text style={styles.debugText}>
                Duration: {durationMs ?? "unknown"} ms
              </Text>
              <Text style={styles.debugText} numberOfLines={3}>
                File: {fileName}
              </Text>
            </View>
          ) : null}

          <View style={styles.statusCard}>
            <Ionicons
              name="construct-outline"
              size={18}
              color={theme.colors.primaryDark}
            />
            <Text style={styles.statusText}>
              {feedback ??
                (isTournament
                  ? phase === "uploading"
                    ? "Uploading tournament video..."
                    : phase === "verifying"
                      ? "Running trusted verification..."
                      : "Best verified attempt counts provisionally. Final scores require PAWS admin review."
                  : "Backend submit connection will be added here next.")}
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              style={styles.secondaryBtn}
              onPress={handleRetake}
              disabled={busy || phase === "complete"}
              accessibilityRole="button"
            >
              <Ionicons
                name="refresh-outline"
                size={17}
                color={theme.colors.primaryDark}
              />
              <Text style={styles.secondaryBtnText}>Retake</Text>
            </Pressable>

            {isTournament && phase !== "complete" ? (
              <Pressable
                style={[styles.primaryBtn, busy && styles.disabledBtn]}
                onPress={handleTournamentSubmit}
                disabled={busy || !resolvedVideoUri || !dogId}
                accessibilityRole="button"
              >
                <Text style={styles.primaryBtnText}>
                  {phase === "uploading"
                    ? "Uploading..."
                    : phase === "verifying"
                      ? "Verifying..."
                      : phase === "error"
                        ? "Try Again"
                        : "Submit for Review"}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.primaryBtn}
                onPress={handleBackToChallenge}
                accessibilityRole="button"
              >
                <Text style={styles.primaryBtnText}>
                  {isTournament ? "Back to Tournament" : "Back to Challenge"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.md,
    ...theme.shadows.soft,
  },
  iconCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: theme.typography.xs,
    fontWeight: "900",
    color: theme.colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    textAlign: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: theme.colors.text,
    textAlign: "center",
    letterSpacing: -0.8,
  },
  body: {
    fontSize: theme.typography.sm,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 21,
  },
  debugBox: {
    width: "100%",
    backgroundColor: theme.colors.cardMuted,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    gap: 5,
  },
  debugLabel: {
    fontSize: theme.typography.xs,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 2,
  },
  debugText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textMuted,
  },
  statusCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
  },
  statusText: {
    flex: 1,
    fontSize: theme.typography.xs,
    fontWeight: "800",
    color: theme.colors.primaryDark,
    lineHeight: 18,
  },
  buttonRow: {
    width: "100%",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.cardMuted,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: theme.spacing.md,
  },
  secondaryBtnText: {
    color: theme.colors.primaryDark,
    fontSize: theme.typography.sm,
    fontWeight: "900",
  },
  primaryBtn: {
    flex: 1.35,
    minHeight: 52,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
  },
  primaryBtnText: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontWeight: "900",
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
