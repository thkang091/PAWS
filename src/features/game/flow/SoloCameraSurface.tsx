import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AppState, Linking, Platform, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { requireOptionalNativeModule } from "expo-modules-core";
import { CameraIcon, CameraSlashIcon } from "phosphor-react-native";
import { PressScale } from "@/components/ui/PressScale";
import { accent, layout, radius, scene, space, text } from "@/constants/design";

export type SoloCameraSurfaceProps = {
  active: boolean;
  onReadyChange: (ready: boolean) => void;
  facing: "back" | "front";
  trackingEnabled?: boolean;
  trackingResetToken?: number;
  onTrackingUpdate?: (event: unknown) => void;
};

// Older development builds and Android retain a manual guide and normal recording.
export const soloTrackingAvailable = (() => {
  if (Platform.OS !== "ios") return false;
  try { return requireOptionalNativeModule("ExpoCamera")?.pawsTrackingVersion === 1; }
  catch { return false; }
})();

export type SoloCameraHandle = {
  record: (options: { maxDuration: number }) => Promise<{ uri: string }>;
  stop: () => void;
};

type PendingRecording = {
  camera: CameraView;
  stopRetry: ReturnType<typeof setInterval> | null;
  stopDeadline: number | null;
};

function clearStopRetry(recording: PendingRecording | null) {
  if (recording?.stopRetry != null) clearInterval(recording.stopRetry);
  if (recording) recording.stopRetry = null;
}

const SoloCameraSurface = forwardRef<SoloCameraHandle, SoloCameraSurfaceProps>(function SoloCameraSurface({ active, onReadyChange, facing, trackingEnabled = false, trackingResetToken = 0, onTrackingUpdate }, ref) {
  const [permission, requestPermission, getPermission] = useCameraPermissions({ get: false });
  const [microphone, requestMicrophone, getMicrophone] = useMicrophonePermissions({ get: false });
  const [mountError, setMountError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const mounted = useRef(true);
  const camera = useRef<CameraView>(null);
  const recording = useRef<PendingRecording | null>(null);
  const requestInFlight = useRef(false);
  const callback = useRef(onReadyChange);
  const lastReady = useRef<boolean | null>(null);
  const previewKey = `${facing}:${retry}`;
  const granted = !!permission?.granted && !!microphone?.granted;
  const current = useRef({ active: active && foreground && !checkingPermission, granted, previewKey, ready, trackingEnabled });
  callback.current = onReadyChange;
  current.current = { active: active && foreground && !checkingPermission, granted, previewKey, ready, trackingEnabled };

  const reportReady = useCallback((value: boolean) => {
    current.current.ready = value;
    if (lastReady.current === value) return;
    lastReady.current = value;
    callback.current(value);
  }, []);

  const stop = useCallback(() => {
    const pending = recording.current;
    if (!pending) return;
    const attemptStop = () => {
      try { pending.camera.stopRecording(); } catch {
        // A camera that was already unmounted rejects its pending recording itself.
      }
    };
    attemptStop();
    if (!mounted.current || pending.stopRetry !== null) return;
    const deadline = pending.stopDeadline ?? performance.now() + 10_000;
    pending.stopDeadline = deadline;
    if (performance.now() >= deadline) return;
    // iOS prepares its recording asynchronously without exposing a started event.
    // Retain an early stop request until this exact recording has finished.
    pending.stopRetry = setInterval(() => {
      if (!mounted.current || recording.current !== pending || performance.now() >= deadline) {
        clearStopRetry(pending);
        return;
      }
      attemptStop();
    }, 200);
  }, []);

  useImperativeHandle(ref, () => ({
    async record({ maxDuration }) {
      const instance = camera.current;
      if (!mounted.current || !current.current.active || !current.current.granted || !current.current.ready || !instance) {
        throw new Error("Camera is not ready. Try again.");
      }
      if (!Number.isFinite(maxDuration) || maxDuration <= 0) throw new Error("Invalid recording duration.");
      if (recording.current?.camera === instance) throw new Error("A recording is already in progress.");
      // A new native camera can retry even if a retired view never settles its promise.
      if (recording.current) {
        stop();
        clearStopRetry(recording.current);
      }
      const pending: PendingRecording = { camera: instance, stopRetry: null, stopDeadline: null };
      recording.current = pending;
      try {
        const clip = await instance.recordAsync({ maxDuration });
        if (!clip?.uri?.trim()) throw new Error("No video was recorded. Try again.");
        return { uri: clip.uri };
      } finally {
        clearStopRetry(pending);
        if (recording.current === pending) recording.current = null;
      }
    },
    stop,
  }), [stop]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop();
      clearStopRetry(recording.current);
      reportReady(false);
    };
  }, [reportReady, stop]);

  useEffect(() => {
    if (!active || !foreground) stop();
  }, [active, foreground, stop]);

  useEffect(() => {
    setReady(false);
    reportReady(false);
  }, [active, foreground, granted, previewKey, reportReady]);

  useEffect(() => {
    // Keep listening while the parent pauses the surface for app backgrounding.
    const subscription = AppState.addEventListener("change", (state) => {
      const isForeground = state === "active";
      setForeground(isForeground);
      if (!isForeground) {
        current.current.active = false;
        stop();
        reportReady(false);
        setReady(false);
      }
    });
    return () => subscription.remove();
  }, [reportReady, stop]);

  useEffect(() => {
    let cancelled = false;
    reportReady(false);
    setReady(false);
    if (!active || !foreground) {
      setCheckingPermission(false);
      return;
    }

    // Reading status never prompts. This also runs after returning from Settings,
    // even if the parent toggled active while our AppState event was in flight.
    setCheckingPermission(true);
    setMountError(null);
    void Promise.all([getPermission(), getMicrophone()]).then(() => {
      if (!cancelled) setRetry((value) => value + 1);
    }).catch(() => {
      if (!cancelled) setMountError("Access could not be checked. Try again.");
    }).finally(() => {
      if (!cancelled) setCheckingPermission(false);
    });
    return () => { cancelled = true; };
  }, [active, foreground, getPermission, getMicrophone, reportReady]);

  const canPreview = active && foreground && !checkingPermission && granted && !mountError;
  useEffect(() => {
    if (!canPreview || ready) return;
    const timer = setTimeout(() => {
      setMountError("The camera did not open. Try again.");
      reportReady(false);
    }, 12000);
    return () => clearTimeout(timer);
  }, [canPreview, ready, previewKey, reportReady]);

  const retryCamera = async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    reportReady(false);
    setRequesting(true);
    setMountError(null);
    try {
      await Promise.all([getPermission(), getMicrophone()]);
      if (mounted.current) setRetry((value) => value + 1);
    } catch {
      if (mounted.current) setMountError("Access could not be checked. Try again.");
    } finally {
      requestInFlight.current = false;
      if (mounted.current) setRequesting(false);
    }
  };

  const allowRecording = async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setRequesting(true);
    setMountError(null);
    try {
      const cameraPermission = permission?.granted ? permission : await requestPermission();
      if (mounted.current && cameraPermission.granted && !microphone?.granted) await requestMicrophone();
    } catch {
      if (mounted.current) setMountError("Access could not be requested. Try again.");
    } finally {
      requestInFlight.current = false;
      if (mounted.current) setRequesting(false);
    }
  };

  const openSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      if (mounted.current) setMountError("Allow camera and microphone access in your phone settings.");
    }
  };

  const blocked = (permission && !permission.granted && !permission.canAskAgain) ||
    (microphone && !microphone.granted && !microphone.canAskAgain);
  const checking = checkingPermission || !permission || !microphone;
  const title = mountError ? "Camera unavailable" : checking ? "Checking access…" : !permission.granted ? "Allow camera access" : !microphone.granted ? "Allow microphone access" : "Opening camera…";
  const description = mountError ?? (!checking && !granted ? "Camera and microphone access is needed to record." : null);

  const trackingProps = soloTrackingAvailable ? {
    pawsTrackingEnabled: trackingEnabled && canPreview,
    pawsTrackingResetToken: trackingResetToken,
    onPawsTrackingUpdate: (event: unknown) => {
      if (!mounted.current || !current.current.active || !current.current.trackingEnabled || current.current.previewKey !== previewKey) return;
      onTrackingUpdate?.(event);
    },
  } : {};

  return <View style={styles.surface}>
    {canPreview ? <CameraView ref={camera} key={previewKey} {...trackingProps} style={StyleSheet.absoluteFill} facing={facing} active={active} mode="video" videoQuality="720p" mute={false} autofocus="on"
      onCameraReady={() => {
        if (!mounted.current || !current.current.active || !current.current.granted || current.current.previewKey !== previewKey) return;
        setReady(true);
        reportReady(true);
      }}
      onMountError={() => {
        if (!mounted.current || !current.current.active || current.current.previewKey !== previewKey) return;
        setReady(false);
        reportReady(false);
        setMountError("Close other camera apps and try again.");
      }} /> : null}
    {active && (!canPreview || !ready) ? <View style={styles.fallback} pointerEvents="box-none">
      <View style={styles.message}>
        {mountError ? <CameraSlashIcon size={30} color={text.inverse} /> : <CameraIcon size={30} color={text.inverse} />}
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        {active && !checking && !granted ? <PressScale
          accessibilityRole="button" accessibilityState={{ disabled: requesting }} disabled={requesting}
          onPress={() => void (blocked ? openSettings() : allowRecording())} style={[styles.button, requesting && styles.disabled]}>
          <Text style={styles.buttonText}>{requesting ? "Opening…" : blocked ? "Open settings" : "Allow access"}</Text>
        </PressScale> : null}
        {active && mountError ? <PressScale accessibilityRole="button" accessibilityState={{ disabled: requesting }} disabled={requesting}
          onPress={() => void retryCamera()} style={styles.retry}>
          <Text style={styles.retryText}>{requesting ? "Checking…" : "Try again"}</Text>
        </PressScale> : null}
      </View>
    </View> : null}
  </View>;
});

export default SoloCameraSurface;

const styles = StyleSheet.create({
  surface: { ...StyleSheet.absoluteFill, backgroundColor: scene.hair },
  fallback: { ...StyleSheet.absoluteFill, justifyContent: "center", alignItems: "center", paddingHorizontal: space.section },
  message: { width: "100%", maxWidth: 300, alignItems: "center", gap: space.md, padding: space.xxl, borderRadius: radius.card, backgroundColor: "rgba(28,27,26,0.76)" },
  title: { color: text.inverse, fontSize: 20, lineHeight: 25, fontWeight: "600", textAlign: "center" },
  description: { color: "#E7E6DE", fontSize: 14, lineHeight: 21, textAlign: "center" },
  button: { minHeight: layout.controlHeight, width: "100%", backgroundColor: accent.deep, borderRadius: radius.pill, paddingHorizontal: space.xl, alignItems: "center", justifyContent: "center", marginTop: space.sm },
  buttonText: { color: text.primary, fontSize: 15, fontWeight: "700" },
  retry: { minHeight: layout.iconButton, paddingHorizontal: space.xl, alignItems: "center", justifyContent: "center" },
  retryText: { color: text.inverse, fontSize: 14, fontWeight: "600" },
  disabled: { opacity: 0.55 },
});
