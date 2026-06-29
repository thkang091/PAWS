//카메라, 녹화, instruction overlay 엔진

import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import type {
  ChallengeInstructionStep,
  ChallengeScript,
} from "@/data/challengeGames/scripts/overlayinstruction";

export type ChallengeMode = "practice" | "challenge";

export type ChallengeCaptureResult = {
  mode: ChallengeMode;
  scriptId: string;
  videoUri?: string;
  durationMs: number;
};

type ScriptedChallengeCameraProps = {
  script: ChallengeScript;
  gameTitle?: string;
  mode: ChallengeMode;
  onExit: () => void;
  onComplete: (result: ChallengeCaptureResult) => void;
};

const getCurrentStep = (
  steps: ChallengeInstructionStep[],
  elapsedMs: number,
) => {
  return (
    steps.find((step) => elapsedMs >= step.startMs && elapsedMs < step.endMs) ??
    steps[steps.length - 1]
  );
};

const formatSeconds = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return seconds.toString().padStart(2, "0");
};

const AUTO_RESULT_DELAY_MS = 5000;

export const ScriptedChallengeCamera = ({
  script,
  gameTitle,
  mode,
  onExit,
  onComplete,
}: ScriptedChallengeCameraProps) => {
  const [permission, requestPermission] = useCameraPermissions();

  const cameraRef = useRef<CameraView | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const finishedRef = useRef(false);

  const [started, setStarted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finished, setFinished] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [videoUri, setVideoUri] = useState<string | undefined>();
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const currentStep = useMemo(
    () => getCurrentStep(script.steps, elapsedMs),
    [elapsedMs, script.steps],
  );

  const remainingMs = Math.max(script.totalDurationMs - elapsedMs, 0);
  const progress = Math.min(elapsedMs / script.totalDurationMs, 1);

  const stopRecordingSafely = () => {
    try {
      cameraRef.current?.stopRecording();
    } catch {
      // stopRecording can throw if recording has already stopped.
    }
  };

  const finishChallenge = () => {
    if (finishedRef.current) return;

    finishedRef.current = true;
    setElapsedMs(script.totalDurationMs);
    setFinished(true);
    setIsRecording(false);
    stopRecordingSafely();
  };

  useEffect(() => {
    if (!started || finished) return;

    const timer = setInterval(() => {
      if (!startedAtRef.current) return;

      const nextElapsed = Date.now() - startedAtRef.current;

      if (nextElapsed >= script.totalDurationMs) {
        finishChallenge();
        clearInterval(timer);
        return;
      }

      setElapsedMs(nextElapsed);
    }, 100);

    return () => clearInterval(timer);
  }, [finished, script.totalDurationMs, started]);

  const startRecording = async () => {
    try {
      if (!cameraRef.current) {
        setRecordingError("Camera is not ready yet.");
        return;
      }

      setIsRecording(true);
      setRecordingError(null);

      const video = await cameraRef.current.recordAsync({
        maxDuration: Math.ceil(script.totalDurationMs / 1000) + 1,
      });

      if (video?.uri) {
        setVideoUri(video.uri);
      }
    } catch (error) {
      if (!finishedRef.current) {
        const message =
          error instanceof Error
            ? error.message
            : "Recording failed. Please try again.";
        setRecordingError(message);
      }
    } finally {
      setIsRecording(false);
    }
  };

  const handleStart = () => {
    finishedRef.current = false;
    startedAtRef.current = Date.now();

    setElapsedMs(0);
    setFinished(false);
    setStarted(true);
    setVideoUri(undefined);
    setRecordingError(null);

    void startRecording();
  };

  const handleRestart = () => {
    stopRecordingSafely();

    finishedRef.current = false;
    startedAtRef.current = null;

    setElapsedMs(0);
    setFinished(false);
    setStarted(false);
    setIsRecording(false);
    setVideoUri(undefined);
    setRecordingError(null);
  };

  const handleExit = () => {
    stopRecordingSafely();
    onExit();
  };

  const handleComplete = () => {
    onComplete({
      mode,
      scriptId: script.id,
      videoUri,
      durationMs: script.totalDurationMs,
    });
  };
useEffect(() => {
  if (!finished || mode !== "challenge") return;

  const timeout = setTimeout(() => {
    onComplete({
      mode,
      scriptId: script.id,
      videoUri,
      durationMs: script.totalDurationMs,
    });
  }, AUTO_RESULT_DELAY_MS);

  return () => clearTimeout(timeout);
}, [
  finished,
  mode,
  onComplete,
  script.id,
  script.totalDurationMs,
  videoUri,
]);
  const handlePrimaryCompleteAction = () => {
  if (mode === "practice") {
    onExit();
    return;
  }

  handleComplete();
};

  if (!permission) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <Text style={styles.permissionTitle}>Preparing camera...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <View style={styles.permissionCard}>
          <Ionicons
            name="camera-outline"
            size={42}
            color={theme.colors.primaryDark}
          />
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            PAWS needs camera access to run challenge games with live
            instructions.
          </Text>

          <Pressable
            style={styles.permissionBtn}
            onPress={() => void requestPermission()}
            accessibilityRole="button"
          >
            <Text style={styles.permissionBtnText}>Allow Camera</Text>
          </Pressable>

          <Pressable
            style={styles.permissionBackBtn}
            onPress={onExit}
            accessibilityRole="button"
          >
            <Text style={styles.permissionBackText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="video"
      />

      <View style={styles.scrim} />

      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <Pressable
            style={styles.iconBtn}
            onPress={handleExit}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="close" size={24} color={theme.colors.white} />
          </Pressable>

          <View style={styles.topCenter}>
            <Text style={styles.modeText}>
              {mode === "practice" ? "Practice Mode" : "Challenge Mode"}
            </Text>
            <Text style={styles.gameTitle} numberOfLines={1}>
              {gameTitle ?? script.title}
            </Text>
          </View>

          <View style={styles.timerPill}>
            <Ionicons name="time-outline" size={14} color={theme.colors.white} />
            <Text style={styles.timerText}>{formatSeconds(remainingMs)}</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.centerContent}>
          {!started ? (
            <View style={styles.startCard}>
              <Text style={styles.startEyebrow}>Ready?</Text>
              <Text style={styles.startTitle}>{script.title}</Text>
              <Text style={styles.startBody}>
                Keep your dog visible. PAWS will record the clip while
                instructions appear on screen.
              </Text>

              <Pressable
                style={styles.startBtn}
                onPress={handleStart}
                accessibilityRole="button"
              >
                <Ionicons
                  name="play"
                  size={18}
                  color={theme.colors.primaryDark}
                />
                <Text style={styles.startBtnText}>
                  {mode === "practice" ? "Start Practice" : "Start Challenge"}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View
              style={[
                styles.instructionCard,
                finished && styles.instructionCardDone,
              ]}
            >
              <Text style={styles.stepLabel}>
  {finished ? "Complete" : currentStep.label}
</Text>

<Text style={styles.stepHelper}>
  {finished
    ? mode === "challenge"
      ? videoUri
        ? "Video captured. Opening result soon..."
        : recordingError
          ? "Recording had an issue. Opening result soon..."
          : "Finishing recording..."
      : "Practice complete. Return to the challenge page when ready."
    : currentStep.helperText}
</Text>

              {finished ? (
                <View style={styles.completeIcon}>
                  <Ionicons
                    name="checkmark"
                    size={34}
                    color={theme.colors.primaryDark}
                  />
                </View>
              ) : null}

              {recordingError ? (
                <Text style={styles.errorText}>{recordingError}</Text>
              ) : null}
            </View>
          )}
        </View>

        {started ? (
          <View style={styles.bottomBar}>
            {finished ? (
              <>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={handleRestart}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="refresh-outline"
                    size={17}
                    color={theme.colors.white}
                  />
                  <Text style={styles.secondaryBtnText}>Try Again</Text>
                </Pressable>

                <Pressable
  style={styles.primaryBtn}
  onPress={handlePrimaryCompleteAction}
  accessibilityRole="button"
>
  <Text style={styles.primaryBtnText}>
    {mode === "practice" ? "Return to Challenge" : "See Result"}
  </Text>
  <Ionicons
    name={mode === "practice" ? "arrow-back" : "arrow-forward"}
    size={17}
    color={theme.colors.primaryDark}
  />
</Pressable>
              </>
            ) : (
              <View style={styles.recordingPill}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>
                  {isRecording ? "Recording" : "Camera Preview Active"}
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  overlay: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.42)",
    alignItems: "center",
    justifyContent: "center",
  },
  topCenter: {
    flex: 1,
    minWidth: 0,
  },
  modeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "rgba(255,255,255,0.75)",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  gameTitle: {
    fontSize: theme.typography.md,
    fontWeight: "900",
    color: theme.colors.white,
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderRadius: theme.radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  timerText: {
    color: theme.colors.white,
    fontSize: theme.typography.xs,
    fontWeight: "900",
  },
  progressTrack: {
    height: 6,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.28)",
    marginTop: theme.spacing.md,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: theme.colors.accent,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 72,
  },
  startCard: {
    backgroundColor: "rgba(255,252,246,0.94)",
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.md,
  },
  startEyebrow: {
    fontSize: theme.typography.xs,
    fontWeight: "900",
    color: theme.colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  startTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: theme.colors.text,
    textAlign: "center",
    letterSpacing: -0.8,
  },
  startBody: {
    fontSize: theme.typography.sm,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  startBtn: {
    marginTop: theme.spacing.sm,
    minHeight: 52,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  startBtnText: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },
  instructionCard: {
    backgroundColor: "rgba(255,252,246,0.94)",
    borderRadius: theme.radii.xl,
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.md,
  },
  instructionCardDone: {
    backgroundColor: "rgba(220,235,219,0.96)",
  },
  stepLabel: {
    fontSize: 44,
    fontWeight: "900",
    color: theme.colors.text,
    textAlign: "center",
    letterSpacing: -1.2,
  },
  stepHelper: {
    fontSize: theme.typography.md,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 23,
  },
  completeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.xs,
    fontWeight: "800",
    textAlign: "center",
  },
  bottomBar: {
    position: "absolute",
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: theme.spacing.xl,
    flexDirection: "row",
    gap: theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  recordingDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.error,
  },
  recordingText: {
    color: theme.colors.white,
    fontSize: theme.typography.xs,
    fontWeight: "800",
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: theme.radii.pill,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(0,0,0,0.35)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryBtnText: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontWeight: "900",
  },
  primaryBtn: {
    flex: 1.25,
    minHeight: 52,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  primaryBtnText: {
    color: theme.colors.primaryDark,
    fontSize: theme.typography.sm,
    fontWeight: "900",
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  permissionCard: {
    width: "100%",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.md,
    ...theme.shadows.soft,
  },
  permissionTitle: {
    fontSize: theme.typography.lg,
    fontWeight: "900",
    color: theme.colors.text,
    textAlign: "center",
  },
  permissionBody: {
    fontSize: theme.typography.sm,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  permissionBtn: {
    width: "100%",
    minHeight: 52,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionBtnText: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontWeight: "900",
  },
  permissionBackBtn: {
    paddingVertical: theme.spacing.sm,
  },
  permissionBackText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.xs,
    fontWeight: "800",
  },
});