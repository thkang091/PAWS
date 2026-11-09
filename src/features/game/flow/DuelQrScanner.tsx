import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Platform, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";

import { accent, bg, radius, space, text } from "@/constants/design";
import { GameButton, ui } from "./GameFlowUI";
import { PlayroomSheet } from "./PlayroomSheet";

type ScannerProps = {
  visible: boolean;
  onClose: () => void;
  onScan: (code: string) => void | Promise<unknown>;
  busy: boolean;
  error?: string;
};

/** Room QR payloads are raw codes, not links or arbitrary text to sanitize. */
export function parseDuelQrCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

export function DuelQrScanner({ visible, ...props }: ScannerProps) {
  // Closing unmounts the camera immediately and gives every new scan a fresh lock.
  return visible ? <ScannerSession {...props} /> : null;
}

function ScannerSession({ onClose, onScan, busy, error }: Omit<ScannerProps, "visible">) {
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState !== "background" && AppState.currentState !== "inactive");
  const [localError, setLocalError] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [scanned, setScanned] = useState(false);
  const [dismissedError, setDismissedError] = useState<string | undefined>();
  const scanLock = useRef(false);
  const permissionLock = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", state => {
      setAppActive(state === "active");
      if (state === "active") void getPermission().catch(() => {
        if (mounted.current) setLocalError("Couldn’t check camera access. Try again.");
      });
    });
    return () => { mounted.current = false; subscription.remove(); };
  }, [getPermission]);

  // A new request may fail with the same message as the previous request.
  useEffect(() => { if (busy) setDismissedError(undefined); }, [busy]);

  const allowCamera = async () => {
    if (permissionLock.current) return;
    permissionLock.current = true;
    setRequestingPermission(true);
    setLocalError("");
    try { await requestPermission(); }
    catch { if (mounted.current) setLocalError("Couldn’t open the camera. Try again or enter the code."); }
    finally {
      permissionLock.current = false;
      if (mounted.current) setRequestingPermission(false);
    }
  };

  const openSettings = async () => {
    setLocalError("");
    try { await Linking.openSettings(); }
    catch { if (mounted.current) setLocalError("Open your device settings to allow camera access, or enter the code."); }
  };

  const handleScan = ({ data }: BarcodeScanningResult) => {
    if (scanLock.current || busy || !appActive) return;
    scanLock.current = true;
    setScanned(true);
    setLocalError("");
    setDismissedError(error);
    const code = parseDuelQrCode(data);
    if (!code) {
      setLocalError("This QR doesn’t contain a 6-character game code.");
      return;
    }
    try {
      void Promise.resolve(onScan(code)).catch(() => {
        if (mounted.current) setLocalError("Couldn’t join. Try again or enter the code.");
      });
    } catch {
      setLocalError("Couldn’t join. Try again or enter the code.");
    }
  };

  const scanAgain = () => {
    scanLock.current = false;
    setScanned(false);
    setLocalError("");
    setCameraError("");
    setDismissedError(error);
  };

  const message = localError || cameraError || (error !== dismissedError ? error : "");

  return <PlayroomSheet visible title="Scan a room QR" onClose={onClose}>
    {!permission ? <View style={styles.status} accessibilityLiveRegion="polite">
      <ActivityIndicator color={text.primary} /><Text style={ui.caption}>Checking camera access…</Text>
    </View> : !permission.granted ? <>
      <Text style={ui.body}>{permission.canAskAgain
        ? "Allow the camera to scan your friend’s game code."
        : "Camera access is off. Allow it in settings, or enter the game code."}</Text>
      {permission.canAskAgain ? <GameButton label={requestingPermission ? "Opening camera…" : "Allow camera"}
        disabled={requestingPermission} onPress={() => void allowCamera()} />
        : Platform.OS !== "web" ? <GameButton label="Open settings" secondary onPress={() => void openSettings()} />
        : <Text style={ui.caption}>Allow camera access in your browser’s site settings.</Text>}
    </> : <>
      <Text style={ui.caption}>Point your camera at your friend’s QR.</Text>
      <View style={styles.cameraShell} testID="duel-qr-scanner">
        {appActive && !cameraError ? <CameraView style={StyleSheet.absoluteFill} facing="back" mute
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanned || busy ? undefined : handleScan}
          onMountError={() => setCameraError("Couldn’t open the camera. Try again or enter the code.")} /> : null}
        <View style={styles.scanGuide} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        {!appActive ? <Text style={styles.cameraStatus}>Camera paused</Text> : null}
      </View>
    </>}
    {busy ? <View style={styles.status} accessibilityLiveRegion="polite">
      <ActivityIndicator color={text.primary} /><Text style={ui.caption}>Joining game…</Text>
    </View> : message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{message}</Text> : null}
    {!busy && permission?.granted && (scanned || cameraError) ? <GameButton label="Scan again" onPress={scanAgain} /> : null}
    <GameButton label="Enter game code" secondary disabled={busy} onPress={onClose} />
  </PlayroomSheet>;
}

const styles = StyleSheet.create({
  cameraShell: { height: 250, backgroundColor: bg.subtle, borderRadius: radius.card, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  scanGuide: { width: 176, height: 176, borderWidth: 2, borderColor: accent.deep, borderRadius: radius.input },
  cameraStatus: { position: "absolute", color: text.secondary },
  status: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  error: { ...ui.caption, color: "#A14937" },
});
