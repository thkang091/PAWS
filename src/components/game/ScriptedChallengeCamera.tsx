// 카메라, 녹화, instruction overlay 엔진

import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import type {
  ChallengeInstructionStep,
  ChallengeScript,
} from "@/data/challengeGames/scripts/overlayinstruction";
import {
  createMockDogDetection,
  evaluateDogFraming,
  type DogFramingStatus,
} from "@/game/detection/dogFraming";

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
  autoStart?: boolean;
  onExit: () => void;
  onComplete: (result: ChallengeCaptureResult) => void;
};

const AUTO_RESULT_DELAY_MS = 5000;
const SETUP_HOLD_TO_START_MS = 1400;
const AUTO_START_CAMERA_DELAY_MS = 800;

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

export const ScriptedChallengeCamera = ({
  script,
  gameTitle,
  mode,
  autoStart = false,
  onExit,
  onComplete,
}: ScriptedChallengeCameraProps) => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] =
    useMicrophonePermissions();

  const cameraRef = useRef<CameraView | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const recordingStartedRef = useRef(false);
const completionSentRef = useRef(false);
const autoStartTriggeredRef = useRef(false);
const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setupStartedAtRef = useRef<number | null>(null);
  const setupHoldStartedAtRef = useRef<number | null>(null);

  const [started, setStarted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finished, setFinished] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const [setupActive, setSetupActive] = useState(!autoStart);
  const [setupStatus, setSetupStatus] = useState<
    "searching" | "ready" | "starting"
  >("searching");
  const [setupProgress, setSetupProgress] = useState(0);

  const [dogFramingStatus, setDogFramingStatus] =
    useState<DogFramingStatus>(() =>
      evaluateDogFraming({
        visible: false,
        confidence: 0,
      }),
    );

  const [isRecording, setIsRecording] = useState(false);
  const [videoUri, setVideoUri] = useState<string | undefined>();
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const currentStep = useMemo(
    () => getCurrentStep(script.steps, elapsedMs),
    [elapsedMs, script.steps],
  );

  const remainingMs = Math.max(script.totalDurationMs - elapsedMs, 0);
  const progress = Math.min(elapsedMs / script.totalDurationMs, 1);

  const hasCameraPermission = Boolean(cameraPermission?.granted);
  const hasMicrophonePermission = Boolean(microphonePermission?.granted);

  useEffect(() => {
    const requestPermissions = async () => {
      if (!cameraPermission?.granted) {
        await requestCameraPermission();
      }

      if (!microphonePermission?.granted) {
        await requestMicrophonePermission();
      }
    };

    void requestPermissions();
  }, [
    cameraPermission?.granted,
    microphonePermission?.granted,
    requestCameraPermission,
    requestMicrophonePermission,
  ]);

  useEffect(() => {
  return () => {
    if (autoStartTimerRef.current) {
      clearTimeout(autoStartTimerRef.current);
      autoStartTimerRef.current = null;
    }
  };
}, []);

  const stopRecordingSafely = () => {
    try {
      cameraRef.current?.stopRecording();
    } catch {
      // stopRecording can throw if recording has already stopped.
    }
  };

  const resetSetup = () => {
    setupStartedAtRef.current = null;
    setupHoldStartedAtRef.current = null;

    setSetupActive(false);
    setSetupStatus("searching");
    setSetupProgress(0);
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
      if (!cameraRef.current || !cameraReady) {
  setRecordingError("Camera is warming up. Please try again.");
  return;
}

      if (!hasCameraPermission || !hasMicrophonePermission) {
        setRecordingError("Camera and microphone permissions are required.");
        return;
      }

      setIsRecording(true);
      setRecordingError(null);

      const video = await cameraRef.current.recordAsync({
        maxDuration: Math.ceil(script.totalDurationMs / 1000) + 1,
      });

      if (video?.uri) {
        setVideoUri(video.uri);
      } else {
        setRecordingError("Recording finished, but no video file was saved.");
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
    if (recordingStartedRef.current) return;

    recordingStartedRef.current = true;
    completionSentRef.current = false;

    resetSetup();

    finishedRef.current = false;
    startedAtRef.current = Date.now();

    setElapsedMs(0);
    setFinished(false);
    setStarted(true);
    setVideoUri(undefined);
    setRecordingError(null);

    void startRecording();
  };

  useEffect(() => {
  if (!autoStart) return;
  if (autoStartTriggeredRef.current) return;
  if (started || finished) return;
  if (!hasCameraPermission || !hasMicrophonePermission) return;
  if (!cameraReady) return;

  autoStartTriggeredRef.current = true;

  autoStartTimerRef.current = setTimeout(() => {
    handleStart();
  }, AUTO_START_CAMERA_DELAY_MS);

  return () => {
    if (autoStartTimerRef.current) {
      clearTimeout(autoStartTimerRef.current);
      autoStartTimerRef.current = null;
    }
  };
}, [
  autoStart,
  started,
  finished,
  cameraReady,
  hasCameraPermission,
  hasMicrophonePermission,
]);

  useEffect(() => {
    if (!setupActive || started || finished) return;
    if (!hasCameraPermission || !hasMicrophonePermission) return;

    const timer = setInterval(() => {
      if (!setupStartedAtRef.current) {
        setupStartedAtRef.current = Date.now();
      }

      const setupElapsed = Date.now() - setupStartedAtRef.current;

      const detection = createMockDogDetection(setupElapsed);
      const nextFramingStatus = evaluateDogFraming(detection);

      setDogFramingStatus(nextFramingStatus);

      const isDogFramed = nextFramingStatus.readyToStart;

      if (!isDogFramed) {
        setupHoldStartedAtRef.current = null;
        setSetupStatus("searching");
        setSetupProgress(0);
        return;
      }

      if (!setupHoldStartedAtRef.current) {
        setupHoldStartedAtRef.current = Date.now();
      }

      const holdElapsed = Date.now() - setupHoldStartedAtRef.current;
      const nextProgress = Math.min(holdElapsed / SETUP_HOLD_TO_START_MS, 1);

      setSetupProgress(nextProgress);
      setSetupStatus(nextProgress >= 1 ? "starting" : "ready");

      if (holdElapsed >= SETUP_HOLD_TO_START_MS) {
        clearInterval(timer);
        handleStart();
      }
    }, 100);

    return () => clearInterval(timer);
  }, [
    setupActive,
    started,
    finished,
    hasCameraPermission,
    hasMicrophonePermission,
  ]);

  const handleRestart = () => {
    stopRecordingSafely();

    recordingStartedRef.current = false;
    completionSentRef.current = false;
    autoStartTriggeredRef.current = false;
    finishedRef.current = false;
    startedAtRef.current = null;
    setupStartedAtRef.current = Date.now();
    setupHoldStartedAtRef.current = null;

    setElapsedMs(0);
    setFinished(false);
    setStarted(false);
    setIsRecording(false);
    setCameraReady(false);
    setVideoUri(undefined);
    setRecordingError(null);

    setSetupStatus("searching");
    setSetupProgress(0);
    setSetupActive(!autoStart);

    if (autoStartTimerRef.current) {
  clearTimeout(autoStartTimerRef.current);
  autoStartTimerRef.current = null;
}
  };

  const handleExit = () => {
  stopRecordingSafely();

  if (autoStartTimerRef.current) {
    clearTimeout(autoStartTimerRef.current);
    autoStartTimerRef.current = null;
  }

  recordingStartedRef.current = false;
  completionSentRef.current = false;
  autoStartTriggeredRef.current = false;

  resetSetup();
  onExit();
};

  const handleComplete = () => {
    if (completionSentRef.current) return;

    if (mode === "challenge" && !videoUri) {
      setRecordingError("Video is still saving. Please wait or try again.");
      return;
    }

    completionSentRef.current = true;

    onComplete({
      mode,
      scriptId: script.id,
      videoUri,
      durationMs: script.totalDurationMs,
    });
  };

  useEffect(() => {
    if (!finished) return;
    if (mode !== "challenge") return;
    if (!videoUri) return;
    if (completionSentRef.current) return;

    const timeout = setTimeout(() => {
      handleComplete();
    }, AUTO_RESULT_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [finished, mode, videoUri]);

  const handlePrimaryCompleteAction = () => {
    if (mode === "practice") {
      onExit();
      return;
    }

    handleComplete();
  };

  if (!cameraPermission || !microphonePermission) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <Text style={styles.permissionTitle}>Preparing camera...</Text>
      </SafeAreaView>
    );
  }

  if (!hasCameraPermission || !hasMicrophonePermission) {
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
            PAWS needs camera and microphone access to record challenge videos
            with live instructions.
          </Text>

          <Pressable
            style={styles.permissionBtn}
            onPress={async () => {
              if (!cameraPermission?.granted) {
                await requestCameraPermission();
              }

              if (!microphonePermission?.granted) {
                await requestMicrophonePermission();
              }
            }}
            accessibilityRole="button"
          >
            <Text style={styles.permissionBtnText}>Allow Camera & Mic</Text>
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
  ratio="16:9"
  videoQuality="1080p"
  onCameraReady={() => {
    setCameraReady(true);
  }}
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
            autoStart ? (
    <View style={styles.autoStartCard}>
      <Text style={styles.autoStartTitle}>
  {cameraReady ? "Starting recording..." : "Preparing camera..."}
</Text>
      <Text style={styles.autoStartBody}>
  Keep your dog in frame. Recording will begin in a moment.
</Text>
    </View>
  ):(


            <View style={styles.scannerWrap}>
              <Text style={styles.scannerTitle}>Frame your dog</Text>

              <View
                style={[
                  styles.scannerFrame,
                  setupStatus !== "searching" && styles.scannerFrameReady,
                ]}
              >
                <View style={[styles.corner, styles.cornerTopLeft]} />
                <View style={[styles.corner, styles.cornerTopRight]} />
                <View style={[styles.corner, styles.cornerBottomLeft]} />
                <View style={[styles.corner, styles.cornerBottomRight]} />

                <View
                  style={[
                    styles.scannerCenterDot,
                    setupStatus !== "searching" &&
                      styles.scannerCenterDotReady,
                  ]}
                >
                  <Ionicons
                    name={
                      setupStatus === "searching"
                        ? "scan-outline"
                        : setupStatus === "ready"
                          ? "checkmark"
                          : "play"
                    }
                    size={28}
                    color={
                      setupStatus === "searching"
                        ? "rgba(255,255,255,0.82)"
                        : theme.colors.primaryDark
                    }
                  />
                </View>
              </View>

              <View style={styles.scannerInstructionPanel}>
                <Text style={styles.scannerInstructionTitle}>
                  {setupStatus === "starting"
                    ? "Starting!"
                    : setupStatus === "ready"
                      ? "Hold still..."
                      : dogFramingStatus.message}
                </Text>

                <Text style={styles.scannerInstructionText}>
                  {setupStatus === "searching"
                    ? `Confidence ${Math.round(
                        dogFramingStatus.confidence * 100,
                      )}%`
                    : setupStatus === "ready"
                      ? "Great. Keep your dog inside the guide frame."
                      : "Recording will begin automatically."}
                </Text>

                <View style={styles.scannerProgressTrack}>
                  <View
                    style={[
                      styles.scannerProgressFill,
                      { width: `${setupProgress * 100}%` },
                    ]}
                  />
                </View>

                <Text style={styles.scannerHint}>
                  No button needed. PAWS starts when your dog is ready.
                </Text>
              </View>
            </View>

                  )
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
                      ? "Video captured. submitting result..."
                      : recordingError
                        ? "Recording had an issue. Please try again."
                        : "Saving video..."
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
                    {mode === "practice" ? "Return to Challenge" : "Submit Video"}
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
    backgroundColor: "rgba(0,0,0,0.18)",
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
  scannerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 64,
    gap: theme.spacing.md,
  },
  scannerTitle: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.white,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  scannerFrame: {
    width: 250,
    height: 250,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  scannerFrameReady: {
    transform: [{ scale: 1.02 }],
  },
  corner: {
    position: "absolute",
    width: 42,
    height: 42,
    borderColor: "#76B7FF",
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scannerCenterDot: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(0,0,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  scannerCenterDotReady: {
    backgroundColor: "rgba(220,235,219,0.92)",
    borderColor: "rgba(220,235,219,1)",
  },
  scannerInstructionPanel: {
    width: "88%",
    maxWidth: 360,
    borderRadius: theme.radii.xl,
    backgroundColor: "rgba(0,0,0,0.38)",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: "center",
    gap: 7,
  },
  scannerInstructionTitle: {
    fontSize: theme.typography.md,
    fontWeight: "900",
    color: theme.colors.white,
    textAlign: "center",
  },
  scannerInstructionText: {
    fontSize: theme.typography.xs,
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
    lineHeight: 18,
  },
  scannerProgressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.24)",
    overflow: "hidden",
    marginTop: 2,
  },
  scannerProgressFill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: theme.colors.accent,
  },
  scannerHint: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.62)",
    textAlign: "center",
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
  autoStartCard: {
  width: "88%",
  maxWidth: 360,
  alignSelf: "center",
  borderRadius: theme.radii.xl,
  backgroundColor: "rgba(0,0,0,0.48)",
  paddingVertical: theme.spacing.xl,
  paddingHorizontal: theme.spacing.lg,
  alignItems: "center",
  gap: theme.spacing.sm,
},
autoStartTitle: {
  color: theme.colors.white,
  fontSize: theme.typography.lg,
  fontWeight: "900",
  textAlign: "center",
},
autoStartBody: {
  color: "rgba(255,255,255,0.78)",
  fontSize: theme.typography.sm,
  fontWeight: "700",
  textAlign: "center",
  lineHeight: 20,
},
});