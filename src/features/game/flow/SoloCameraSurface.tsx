import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { CameraIcon, CameraSlashIcon } from "phosphor-react-native";
import { PressScale } from "@/components/ui/PressScale";
import { accent, layout, radius, scene, space, text } from "@/constants/design";

export type SoloCameraSurfaceProps = {
  active: boolean;
  onReadyChange: (ready: boolean) => void;
  facing: "back" | "front";
  showHint?: boolean;
};

export default function SoloCameraSurface({ active, onReadyChange, facing }: SoloCameraSurfaceProps) {
  const [permission, requestPermission, getPermission] = useCameraPermissions({ get: false });
  const [mountError, setMountError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const mounted = useRef(true);
  const callback = useRef(onReadyChange);
  const lastReady = useRef<boolean | null>(null);
  const previewKey = `${facing}:${retry}`;
  const current = useRef({ active: active && foreground && !checkingPermission, granted: permission?.granted, previewKey });
  callback.current = onReadyChange;
  current.current = { active: active && foreground && !checkingPermission, granted: permission?.granted, previewKey };

  const reportReady = useCallback((value: boolean) => {
    if (lastReady.current === value) return;
    lastReady.current = value;
    callback.current(value);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      reportReady(false);
    };
  }, [reportReady]);

  useEffect(() => {
    setReady(false);
    reportReady(false);
  }, [active, foreground, permission?.granted, previewKey, reportReady]);

  useEffect(() => {
    // Keep listening while the parent pauses the surface for app backgrounding.
    const subscription = AppState.addEventListener("change", (state) => {
      const isForeground = state === "active";
      setForeground(isForeground);
      if (!isForeground) {
        current.current.active = false;
        reportReady(false);
        setReady(false);
      }
    });
    return () => subscription.remove();
  }, [reportReady]);

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
    void getPermission().then(() => {
      if (!cancelled) setRetry((value) => value + 1);
    }).catch(() => {
      if (!cancelled) setMountError("Camera access could not be checked. Try again.");
    }).finally(() => {
      if (!cancelled) setCheckingPermission(false);
    });
    return () => { cancelled = true; };
  }, [active, foreground, getPermission, reportReady]);

  const canPreview = active && foreground && !checkingPermission && permission?.granted && !mountError;
  useEffect(() => {
    if (!canPreview || ready) return;
    const timer = setTimeout(() => {
      setMountError("The camera did not open. Try again or use a phone with a camera.");
      reportReady(false);
    }, 12000);
    return () => clearTimeout(timer);
  }, [canPreview, ready, previewKey, reportReady]);

  const retryCamera = async () => {
    if (requesting) return;
    reportReady(false);
    setRequesting(true);
    setMountError(null);
    try {
      await getPermission();
      if (mounted.current) setRetry((value) => value + 1);
    } catch {
      if (mounted.current) setMountError("Camera access could not be checked. Try again.");
    } finally {
      if (mounted.current) setRequesting(false);
    }
  };

  const allowCamera = async () => {
    if (requesting) return;
    setRequesting(true);
    setMountError(null);
    try {
      await requestPermission();
    } catch {
      if (mounted.current) setMountError("Camera access could not be requested. Try again.");
    } finally {
      if (mounted.current) setRequesting(false);
    }
  };

  const openSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      if (mounted.current) setMountError("Open your phone settings and allow camera access for PAWS.");
    }
  };

  const blocked = permission && !permission.granted && !permission.canAskAgain;
  const title = !active ? "Camera paused" : mountError ? "Camera unavailable" : checkingPermission || !permission ? "Checking camera access" : !permission.granted ? "Turn on your camera" : "Opening camera";
  const description = !active ? "Your camera is paused while this screen is away." : mountError ?? (!permission?.granted ? "Allow camera access to see your dog in the frame." : "Keep your dog’s whole body in view.");

  return <View style={styles.surface}>
    {canPreview ? <CameraView key={previewKey} style={StyleSheet.absoluteFill} facing={facing} active={active} mode="picture"
      onCameraReady={() => {
        if (!mounted.current || !current.current.active || !current.current.granted || current.current.previewKey !== previewKey) return;
        setReady(true);
        reportReady(true);
      }}
      onMountError={() => {
        if (!mounted.current || !current.current.active || current.current.previewKey !== previewKey) return;
        setReady(false);
        reportReady(false);
        setMountError("The camera could not open. Close other camera apps and try again.");
      }} /> : null}
    {active && (!canPreview || !ready) ? <View style={styles.fallback} pointerEvents="box-none">
      <View style={styles.message}>
        {mountError ? <CameraSlashIcon size={30} color={text.inverse} /> : <CameraIcon size={30} color={text.inverse} />}
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {active && !checkingPermission && permission && !permission.granted ? <PressScale
          accessibilityRole="button" accessibilityState={{ disabled: requesting }} disabled={requesting}
          onPress={() => void (blocked ? openSettings() : allowCamera())} style={[styles.button, requesting && styles.disabled]}>
          <Text style={styles.buttonText}>{requesting ? "Opening…" : blocked ? "Open settings" : "Allow camera"}</Text>
        </PressScale> : null}
        {active && mountError ? <PressScale accessibilityRole="button" accessibilityState={{ disabled: requesting }} disabled={requesting}
          onPress={() => void retryCamera()} style={styles.retry}>
          <Text style={styles.retryText}>{requesting ? "Checking…" : "Try again"}</Text>
        </PressScale> : null}
      </View>
    </View> : null}
  </View>;
}

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