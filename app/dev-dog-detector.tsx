import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, router } from "expo-router";
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
import { evaluateDogFraming } from "@/game/detection/dogFraming";
import {
  convertDetectionToRawDogDetection,
  type ExecuTorchDetectionLike,
  pickBestDogDetection,
} from "@/game/detection/executorchDetection";

const DETECTION_THRESHOLD = 0.45;

let didInitExecutorch = false;

const initExecutorchForDogDetector = () => {
  if (didInitExecutorch) return;

  initExecutorch({
    resourceFetcher: ExpoResourceFetcher,
  });

  didInitExecutorch = true;
};

type DetectorFrameInfo = {
  framesSeen: number;
  width: number;
  height: number;
  updatedAt: number;
};

export default function DevDogDetectorScreen() {
  initExecutorchForDogDetector();

  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();

  const frameCountRef = useRef(0);
  const lastUiUpdateAtRef = useRef(0);

  const [detections, setDetections] = useState<ExecuTorchDetectionLike[]>([]);
  const [frameInfo, setFrameInfo] = useState<DetectorFrameInfo>({
    framesSeen: 0,
    width: 0,
    height: 0,
    updatedAt: 0,
  });

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

      setDetections(nextDetections);

      if (now - lastUiUpdateAtRef.current < 250) {
        return;
      }

      lastUiUpdateAtRef.current = now;

      setFrameInfo({
        framesSeen: frameCountRef.current,
        width,
        height,
        updatedAt: now,
      });
    },
    [],
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
            classesOfInterest: ["DOG"],
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

  const bestDogDetection = useMemo(
    () => pickBestDogDetection(detections),
    [detections],
  );

  const rawDogDetection = useMemo(
    () =>
      convertDetectionToRawDogDetection(
        bestDogDetection,
        frameInfo.width,
        frameInfo.height,
      ),
    [bestDogDetection, frameInfo.height, frameInfo.width],
  );

  const dogFramingStatus = useMemo(
    () => evaluateDogFraming(rawDogDetection),
    [rawDogDetection],
  );

  const topDetections = detections.slice(0, 5);

  const modelStatusText = detector.isReady
    ? "Model ready"
    : `Loading model ${Math.round((detector.downloadProgress ?? 0) * 100)}%`;

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Stack.Screen options={{ title: "Dog Detector" }} />

        <Ionicons
          name="camera-outline"
          size={44}
          color={theme.colors.primaryDark}
        />

        <Text style={styles.title}>Camera permission needed</Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => void requestPermission()}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Allow Camera</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Stack.Screen options={{ title: "Dog Detector" }} />
        <Text style={styles.title}>Back camera not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        outputs={[frameOutput]}
        orientationSource="device"
      />

      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <Pressable
            style={styles.iconButton}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Ionicons name="close" size={24} color={theme.colors.white} />
          </Pressable>

          <View style={styles.titleWrap}>
            <Text style={styles.eyebrow}>DOG DETECTOR</Text>
            <Text style={styles.headerTitle}>ExecuTorch On-device Scan</Text>
          </View>
        </View>

        <View style={styles.scannerFrame}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
        </View>

        <View style={styles.bottomPanel}>
          <Text style={styles.statusTitle}>
            {dogFramingStatus.readyToStart
              ? "Dog ready"
              : dogFramingStatus.message}
          </Text>

          <Text style={styles.statusBody}>
            Dog confidence {Math.round(dogFramingStatus.confidence * 100)}%
          </Text>

          <View style={styles.statusGrid}>
            <StatusPill label="Visible" passed={dogFramingStatus.visible} />
            <StatusPill label="Clear" passed={dogFramingStatus.clear} />
            <StatusPill label="Centered" passed={dogFramingStatus.centered} />
            <StatusPill
              label="Distance"
              passed={dogFramingStatus.goodDistance}
            />
          </View>

          <View style={styles.debugBox}>
            <Text style={styles.debugTitle}>{modelStatusText}</Text>

            {detector.error ? (
              <Text style={styles.errorText}>{String(detector.error)}</Text>
            ) : null}

            <Text style={styles.debugText}>
              Frames: {frameInfo.framesSeen} · Size: {frameInfo.width} ×{" "}
              {frameInfo.height}
            </Text>

            <Text style={styles.debugText}>
              Detections: {detections.length} · Last:{" "}
              {frameInfo.updatedAt
                ? new Date(frameInfo.updatedAt).toLocaleTimeString()
                : "-"}
            </Text>

            {topDetections.map((detection, index) => (
              <Text
                key={`${String(detection.label)}-${index}`}
                style={styles.debugText}
              >
                {String(detection.label)}{" "}
                {Math.round((detection.score ?? detection.confidence ?? 0) * 100)}
                %
              </Text>
            ))}
          </View>

          <Text style={styles.noteText}>
            This route runs actual on-device object detection. Main challenge
            recording is not connected yet.
          </Text>
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
  centerScreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.lg,
    fontWeight: "900",
    color: theme.colors.text,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primaryDark,
    paddingHorizontal: theme.spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontWeight: "900",
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
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.44)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: {
    flex: 1,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  headerTitle: {
    color: theme.colors.white,
    fontSize: theme.typography.md,
    fontWeight: "900",
  },
  scannerFrame: {
    position: "absolute",
    alignSelf: "center",
    top: "30%",
    width: 260,
    height: 260,
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
  bottomPanel: {
    position: "absolute",
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: theme.spacing.xl,
    borderRadius: theme.radii.xl,
    backgroundColor: "rgba(0,0,0,0.62)",
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  statusTitle: {
    color: theme.colors.white,
    fontSize: theme.typography.lg,
    fontWeight: "900",
    textAlign: "center",
  },
  statusBody: {
    color: "rgba(255,255,255,0.86)",
    fontSize: theme.typography.md,
    fontWeight: "900",
    textAlign: "center",
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: theme.radii.pill,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 7,
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
  debugBox: {
    borderRadius: theme.radii.lg,
    backgroundColor: "rgba(255,255,255,0.12)",
    padding: theme.spacing.md,
    gap: 4,
  },
  debugTitle: {
    color: theme.colors.white,
    fontSize: theme.typography.xs,
    fontWeight: "900",
  },
  debugText: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    fontWeight: "800",
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 11,
    fontWeight: "900",
  },
  noteText: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    textAlign: "center",
  },
});