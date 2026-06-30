import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";

import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";

export default function ChallengeSubmitScreen() {
  const { gameId, videoUri, scriptId, durationMs } = useLocalSearchParams<{
    gameId: string;
    videoUri?: string | string[];
    scriptId?: string;
    durationMs?: string;
  }>();

  const resolvedVideoUri = Array.isArray(videoUri) ? videoUri[0] : videoUri;

  const fileName = useMemo(() => {
    if (!resolvedVideoUri) return "No video file";
    return resolvedVideoUri.split("/").pop() ?? resolvedVideoUri;
  }, [resolvedVideoUri]);

  const handleBackToChallenge = () => {
    router.replace(`/game/${gameId}`);
  };

  const handleRetake = () => {
    router.replace(`/game/${gameId}/play?mode=challenge`);
  };

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

          <Text style={styles.eyebrow}>Challenge Submit</Text>

          <Text style={styles.title}>
            {resolvedVideoUri ? "Video captured" : "No video found"}
          </Text>

          <Text style={styles.body}>
            {resolvedVideoUri
              ? "Your recording is ready. The next step will upload this video, then charge silver after the upload succeeds."
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
              Backend submit connection will be added here next.
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              style={styles.secondaryBtn}
              onPress={handleRetake}
              accessibilityRole="button"
            >
              <Ionicons
                name="refresh-outline"
                size={17}
                color={theme.colors.primaryDark}
              />
              <Text style={styles.secondaryBtnText}>Retake</Text>
            </Pressable>

            <Pressable
              style={styles.primaryBtn}
              onPress={handleBackToChallenge}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>Back to Challenge</Text>
            </Pressable>
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
});