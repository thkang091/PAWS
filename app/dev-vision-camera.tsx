import { useCallback, useEffect, useRef, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import {
  createMockDogDetection,
  evaluateDogFraming,
  type DogFramingStatus,
} from "@/game/detection/dogFraming";

type FrameDebugInfo = {
  framesSeen: number;
  width: number;
  height: number;
  pixelFormat: string;
  updatedAt: number;
};

const HOLD_TO_READY_MS = 1400;

const createInitialDogFramingStatus = (): DogFramingStatus =>
  evaluateDogFraming({
    visible: false,
    confidence: 0,
  });

export default function DevVisionCameraScreen() {
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();

  const lastUiUpdateAtRef = useRef(0);
  const frameCountRef = useRef(0);
  const framingStartedAtRef = useRef<number | null>(null);
  const holdStartedAtRef = useRef<number | null>(null);

  const [frameDebugInfo, setFrameDebugInfo] = useState<FrameDebugInfo>({
    framesSeen: 0,
    width: 0,
    height: 0,
    pixelFormat: "-",
    updatedAt: 0,
  });

  const [dogFramingStatus, setDogFramingStatus] =
    useState<DogFramingStatus>(createInitialDogFramingStatus);

  const [holdProgress, setHoldProgress] = useState(0);

  useEffect(() => {
    if (!hasPermission) {
      void requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const updateFrameDebugInfo = useCallback(
    (width: number, height: number, pixelFormat: string) => {
      frameCountRef.current += 1;

      const now = Date.now();

      if (!framingStartedAtRef.current) {
        framingStartedAtRef.current = now;
      }

      const elapsedMs = now - framingStartedAtRef.current;
      const detection = createMockDogDetection(elapsedMs);
      const nextFramingStatus = evaluateDogFraming(detection);

      setDogFramingStatus(nextFramingStatus);

      if (nextFramingStatus.readyToStart) {
        if (!holdStartedAtRef.current) {
          holdStartedAtRef.current = now;
        }

        const holdElapsed = now - holdStartedAtRef.current;
        setHoldProgress(Math.min(holdElapsed / HOLD_TO_READY_MS, 1));
      } else {
        holdStartedAtRef.current = null;
        setHoldProgress(0);
      }

      // Avoid re-rendering the debug UI on every single camera frame.
      if (now - lastUiUpdateAtRef.current < 250) {
        return;
      }

      lastUiUpdateAtRef.current = now;

      setFrameDebugInfo({
        framesSeen: frameCountRef.current,
        width,
        height,
        pixelFormat,
        updatedAt: now,
      });
    },
    [],
  );

  const frameOutput = useFrameOutput({
    pixelFormat: "yuv",
    onFrame: useCallback(
      (frame: Frame) => {
        "worklet";

        try {
          scheduleOnRN(
            updateFrameDebugInfo,
            frame.width,
            frame.height,
            String(frame.pixelFormat ?? "-"),
          );
        } finally {
          frame.dispose();
        }
      },
      [updateFrameDebugInfo],
    ),
  });

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Stack.Screen options={{ title: "VisionCamera Canary" }} />

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
        <Stack.Screen options={{ title: "VisionCamera Canary" }} />
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
            <Text style={styles.eyebrow}>FRAMING CANARY</Text>
            <Text style={styles.headerTitle}>VisionCamera Dog Framing</Text>
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
            {holdProgress >= 1
              ? "Ready to start"
              : dogFramingStatus.readyToStart
                ? "Hold still..."
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

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(holdProgress * 100)}%` },
              ]}
            />
          </View>

          <View style={styles.debugBox}>
            <Text style={styles.debugText}>
              Frames seen: {frameDebugInfo.framesSeen}
            </Text>

            <Text style={styles.debugText}>
              Size: {frameDebugInfo.width} × {frameDebugInfo.height}
            </Text>

            <Text style={styles.debugText}>
              Pixel format: {frameDebugInfo.pixelFormat}
            </Text>

            <Text style={styles.debugText}>
              Last UI update:{" "}
              {frameDebugInfo.updatedAt
                ? new Date(frameDebugInfo.updatedAt).toLocaleTimeString()
                : "-"}
            </Text>
          </View>

          <Text style={styles.noteText}>
            VisionCamera frames are now driving the dog framing readiness logic.
            No AI model is running yet.
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
    backgroundColor: "rgba(0,0,0,0.58)",
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
  debugBox: {
    borderRadius: theme.radii.lg,
    backgroundColor: "rgba(255,255,255,0.12)",
    padding: theme.spacing.md,
    gap: 4,
  },
  debugText: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    fontWeight: "800",
  },
  noteText: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    textAlign: "center",
  },
});