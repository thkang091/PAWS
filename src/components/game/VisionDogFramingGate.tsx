import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Camera,
  type Frame,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
} from "react-native-vision-camera";
import { scheduleOnRN } from "react-native-worklets";
import {
  initExecutorch,
  models,
  useObjectDetection,
} from "react-native-executorch";
import { ExpoResourceFetcher } from "react-native-executorch-expo-resource-fetcher";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import {
  evaluateDogFraming,
  type DogFramingStatus,
} from "@/game/detection/dogFraming";
import {
  convertDetectionToRawDogDetection,
  type ExecuTorchDetectionLike,
  pickBestDogDetection,
} from "@/game/detection/executorchDetection";

type VisionDogFramingGateProps = {
  title: string;
  onExit: () => void;
  onReady: () => void;
};

type DetectorFrameInfo = {
  framesSeen: number;
  width: number;
  height: number;
  updatedAt: number;
};

const DETECTION_THRESHOLD = 0.04;
const HOLD_TO_READY_MS = 3000;
const READY_PROGRESS_DECAY_RATE = 0.18;
const SHOW_DEV_DOG_DEBUG = __DEV__;

// 게임 녹화 화면 카메라 배율값, 현재는 인식 화면과 같도록 설정되어 있음
const PRECHECK_PREVIEW_SCALE = 1.5;
let didInitExecutorch = false;

const initExecutorchForGate = () => {
  if (didInitExecutorch) return;

  initExecutorch({
    resourceFetcher: ExpoResourceFetcher,
  });

  didInitExecutorch = true;
};

const createInitialDogFramingStatus = (): DogFramingStatus =>
  evaluateDogFraming({
    visible: false,
    confidence: 0,
  });

export default function VisionDogFramingGate({
  title,
  onExit,
  onReady,
}: VisionDogFramingGateProps) {
  initExecutorchForGate();

  const device = useCameraDevice("back", {
  physicalDevices: ["wide-angle"],
});
  const { hasPermission, requestPermission } = useCameraPermission();

  const frameCountRef = useRef(0);
  const lastUiUpdateAtRef = useRef(0);
  const lastFrameAtRef = useRef<number | null>(null);
  const readyAccumulatedMsRef = useRef(0);
  const readySentRef = useRef(false);

  const [detections, setDetections] = useState<ExecuTorchDetectionLike[]>([]);
  const [frameInfo, setFrameInfo] = useState<DetectorFrameInfo>({
    framesSeen: 0,
    width: 0,
    height: 0,
    updatedAt: 0,
  });
  const [dogFramingStatus, setDogFramingStatus] =
    useState<DogFramingStatus>(createInitialDogFramingStatus);
  const [holdProgress, setHoldProgress] = useState(0);

  const detector = useObjectDetection({
    model: models.object_detection.ssdlite_320_mobilenet_v3_large(),
  });

  useEffect(() => {
    if (!hasPermission) {
      void requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const updateDetectionsOnReact = useCallback(
    (
      nextDetections: ExecuTorchDetectionLike[],
      width: number,
      height: number,
    ) => {
      frameCountRef.current += 1;

      const now = Date.now();

      const bestDogDetection = pickBestDogDetection(nextDetections);
      const rawDogDetection = convertDetectionToRawDogDetection(
        bestDogDetection,
        width,
        height,
      );
      const nextFramingStatus = evaluateDogFraming(rawDogDetection);

      const deltaMs =
        lastFrameAtRef.current === null
          ? 0
          : Math.min(now - lastFrameAtRef.current, 500);

      lastFrameAtRef.current = now;

      if (nextFramingStatus.readyToStart) {
        readyAccumulatedMsRef.current = Math.min(
          HOLD_TO_READY_MS,
          readyAccumulatedMsRef.current + deltaMs,
        );
      } else {
        readyAccumulatedMsRef.current = Math.max(
          0,
          readyAccumulatedMsRef.current - deltaMs * READY_PROGRESS_DECAY_RATE,
        );
      }

      const nextHoldProgress = Math.min(
        readyAccumulatedMsRef.current / HOLD_TO_READY_MS,
        1,
      );

      if (nextHoldProgress >= 1 && !readySentRef.current) {
        readySentRef.current = true;
        onReady();
      }

      if (now - lastUiUpdateAtRef.current < 180 && !readySentRef.current) {
        return;
      }

      lastUiUpdateAtRef.current = now;

      setDetections(nextDetections);
      setDogFramingStatus(nextFramingStatus);
      setHoldProgress(nextHoldProgress);
      setFrameInfo({
        framesSeen: frameCountRef.current,
        width,
        height,
        updatedAt: now,
      });
    },
    [onReady],
  );

  const runOnFrame = detector.runOnFrame;

  const frameOutput = useFrameOutput({
    pixelFormat: "rgb",
    dropFramesWhileBusy: true,
    onFrame: useCallback(
      (frame: Frame) => {
        "worklet";

        try {
          if (!runOnFrame) return;

          const isFrontCamera = false;

          const result = runOnFrame(frame, isFrontCamera, {
            detectionThreshold: DETECTION_THRESHOLD,
          });

          if (result) {
            scheduleOnRN(
              updateDetectionsOnReact,
              result as ExecuTorchDetectionLike[],
              frame.width,
              frame.height,
            );
          }
        } finally {
          frame.dispose();
        }
      },
      [runOnFrame, updateDetectionsOnReact],
    ),
  });

  const modelStatusText = detector.isReady
    ? "Model ready"
    : `Loading model ${Math.round((detector.downloadProgress ?? 0) * 100)}%`;

  const topDetectionText =
    detections
      .slice(0, 4)
      .map((detection) => {
        const label = String(detection.label ?? "-");
        const score = Math.round(
          ((detection.score ?? detection.confidence ?? 0) as number) * 100,
        );

        return `${label} ${score}%`;
      })
      .join(" · ") || "No labels";

  const statusTitle = useMemo(() => {
  if (!detector.isReady) return "Preparing camera AI...";
  if (readySentRef.current) return "Starting recording...";
  if (holdProgress >= 1) return "Starting recording...";
  if (dogFramingStatus.readyToStart) return "Great. Hold still...";

  return dogFramingStatus.message;
}, [
  detector.isReady,
  dogFramingStatus.message,
  dogFramingStatus.readyToStart,
  holdProgress,
]);

  const handleDevBypass = () => {
    if (!__DEV__) return;
    if (readySentRef.current) return;

    readySentRef.current = true;
    onReady();
  };

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <Ionicons
          name="camera-outline"
          size={44}
          color={theme.colors.primaryDark}
        />

        <Text style={styles.permissionTitle}>Camera permission needed</Text>

        <Text style={styles.permissionBody}>
          PAWS needs camera access to detect whether your dog is ready before
          recording starts.
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
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <Text style={styles.permissionTitle}>Back camera not found</Text>

        <Pressable
          style={styles.permissionBackBtn}
          onPress={onExit}
          accessibilityRole="button"
        >
          <Text style={styles.permissionBackText}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.cameraPreviewClip}>
  <Camera
    style={[
      StyleSheet.absoluteFill,
      {
        transform: [{ scale: PRECHECK_PREVIEW_SCALE }],
      },
    ]}
    device={device}
    isActive={!readySentRef.current}
    outputs={[frameOutput]}
    orientationSource="device"
  />
</View>

      <View style={styles.scrim} />

      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <Pressable
            style={styles.iconBtn}
            onPress={onExit}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="close" size={24} color={theme.colors.white} />
          </Pressable>

          <View style={styles.topCenter}>
            <Text style={styles.modeText}>Dog Scanner</Text>
            <Text style={styles.gameTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>

          <View style={styles.modelPill}>
            <Text style={styles.modelPillText}>
              {detector.isReady ? "AI" : "..."}
            </Text>
          </View>
        </View>

        <View style={styles.centerContent}>
          <View style={styles.scannerWrap}>
            <Text style={styles.scannerTitle}>Frame your dog</Text>

            <View
              style={[
                styles.scannerFrame,
                dogFramingStatus.readyToStart && styles.scannerFrameReady,
              ]}
            >
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />

              <View
                style={[
                  styles.scannerCenterDot,
                  dogFramingStatus.readyToStart &&
                    styles.scannerCenterDotReady,
                ]}
              >
                <Ionicons
                  name={
                    dogFramingStatus.readyToStart ? "checkmark" : "scan-outline"
                  }
                  size={28}
                  color={
                    dogFramingStatus.readyToStart
                      ? theme.colors.primaryDark
                      : "rgba(255,255,255,0.82)"
                  }
                />
              </View>
            </View>




            <View style={styles.instructionPanel}>
  <Text style={styles.statusTitle}>{statusTitle}</Text>

  <Text style={styles.statusBody}>
    {dogFramingStatus.readyToStart
      ? "Recording will begin automatically."
      : "PAWS checks that your dog is in view before recording."}
  </Text>

  <View style={styles.progressTrack}>
    <View
      style={[
        styles.progressFill,
        { width: `${Math.round(holdProgress * 100)}%` },
      ]}
    />
  </View>

  <Text style={styles.progressHint}>
    {holdProgress > 0
      ? `${Math.round(holdProgress * 100)}% ready`
      : "Point the camera at your dog."}
  </Text>

  {detector.error ? (
    <Text style={styles.errorText}>
      Camera AI could not start. Please try again.
    </Text>
  ) : null}

  {SHOW_DEV_DOG_DEBUG ? (
    <View style={styles.devDebugArea}>
      <View style={styles.statusGrid}>
        <StatusPill label="Visible" passed={dogFramingStatus.visible} />
        <StatusPill
          label="Centered"
          passed={dogFramingStatus.centered}
        />
        <StatusPill
          label="Distance"
          passed={dogFramingStatus.goodDistance}
        />
      </View>

      <Text style={styles.debugText}>
        {modelStatusText} · Frames {frameInfo.framesSeen} · Detections{" "}
        {detections.length}
      </Text>

      <Text style={styles.debugText}>{topDetectionText}</Text>

      <Pressable
        style={styles.devBypassBtn}
        onPress={handleDevBypass}
        accessibilityRole="button"
      >
        <Ionicons
          name="flask-outline"
          size={14}
          color={theme.colors.primaryDark}
        />
        <Text style={styles.devBypassText}>DEV: Dog detected</Text>
      </Pressable>
    </View>
  ) : null}
</View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

type StatusPillProps = {
  label: string;
  passed: boolean;
};

const StatusPill = ({ label, passed }: StatusPillProps) => {
  return (
    <View style={[styles.statusPill, passed && styles.statusPillPassed]}>
      <Ionicons
        name={passed ? "checkmark-circle" : "ellipse-outline"}
        size={14}
        color={passed ? theme.colors.primaryDark : "rgba(255,255,255,0.7)"}
      />

      <Text
        style={[styles.statusPillText, passed && styles.statusPillTextPassed]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraPreviewClip: {
  ...StyleSheet.absoluteFill,
  overflow: "hidden",
  backgroundColor: "#000",
},
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.16)",
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
  modelPill: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.42)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  modelPillText: {
    color: theme.colors.white,
    fontSize: theme.typography.xs,
    fontWeight: "900",
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
  instructionPanel: {
    width: "88%",
    maxWidth: 380,
    borderRadius: theme.radii.xl,
    backgroundColor: "rgba(0,0,0,0.44)",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: "center",
    gap: 8,
  },
  statusTitle: {
    color: theme.colors.white,
    fontSize: theme.typography.md,
    fontWeight: "900",
    textAlign: "center",
  },
  statusBody: {
    color: "rgba(255,255,255,0.84)",
    fontSize: theme.typography.xs,
    fontWeight: "800",
    textAlign: "center",
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    justifyContent: "center",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: theme.radii.pill,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  statusPillPassed: {
    backgroundColor: "rgba(220,235,219,0.92)",
  },
  statusPillText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    fontWeight: "900",
  },
  statusPillTextPassed: {
    color: theme.colors.primaryDark,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.24)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: theme.colors.accent,
  },
  debugText: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  devBypassBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: "rgba(220,235,219,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 2,
  },
  devBypassText: {
    color: theme.colors.primaryDark,
    fontSize: 11,
    fontWeight: "900",
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
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
  progressHint: {
  color: "rgba(255,255,255,0.68)",
  fontSize: 11,
  fontWeight: "800",
  textAlign: "center",
},
devDebugArea: {
  width: "100%",
  alignItems: "center",
  gap: 7,
  marginTop: 4,
},

});