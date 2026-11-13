import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CaretLeftIcon, GlobeHemisphereWestIcon, HashIcon, MapPinIcon, QrCodeIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { goBack } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { roomErrorText } from "@/features/rooms/roomCopy";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { joinRoom, tokenFromLink } from "@/services/roomService";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

const CODE_LENGTH = 6;

/**
 * Join a room. Online: type the code. Nearby: scan the host's QR (or type the code if the host allows it). An
 * invitation link joins straight away. The server checks the invitation, the room and capacity; joining twice just
 * opens the room.
 */
export default function JoinRoomScreen() {
  const params = useLocalSearchParams<{ mode?: string; t?: string }>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const online = params.mode === "online";
  const [how, setHow] = useState<"scan" | "code">(online ? "code" : "scan");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const lastScan = useRef<string | null>(null);
  const input = useRef<TextInput | null>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const join = useCallback(
    async (via: { token?: string; code?: string }) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        const res = await joinRoom({ ...via, dogId: dog.data?.id ?? null, displayName: dog.data?.name ?? "Player" });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({ pathname: "/game/room/[id]", params: { id: res.roomId } });
      } catch (e) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(roomErrorText((e as { code?: string }).code));
        lastScan.current = null;
        // A short, damped shake says "not that one" without a dialog.
        if (!reduceMotion) shake.value = withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 70 }), withTiming(-4, { duration: 60 }), withTiming(0, { duration: 60 }));
      } finally {
        setBusy(false);
      }
    },
    [busy, dog.data?.id, dog.data?.name, reduceMotion, shake],
  );

  // Arrived through an invitation link.
  useEffect(() => {
    if (params.t && dog.data !== undefined) void join({ token: params.t });
  }, [params.t, dog.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScan = (data: string) => {
    if (busy || data === lastScan.current) return;
    lastScan.current = data;
    const token = tokenFromLink(data);
    if (!token) {
      setError("That isn't a PAWS room code.");
      return;
    }
    void join({ token });
  };

  const typed = (v: string) => {
    const next = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
    setCode(next);
    setError(null);
    if (next.length === CODE_LENGTH) {
      Keyboard.dismiss();
      void join({ code: next });
    }
  };

  const cameraBlocked = permission && !permission.granted && !permission.canAskAgain;

  return (
    <View style={styles.screen}>
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <PressScale accessibilityRole="button" accessibilityLabel="Back" style={styles.back} onPress={() => goBack(`/game/tournament?mode=${online ? "online" : "nearby"}`)}>
          <CaretLeftIcon size={22} color={text.primary} weight="bold" />
        </PressScale>
        <View style={styles.tag}>
          {online ? <GlobeHemisphereWestIcon size={14} color="#FFFFFF" weight="bold" /> : <MapPinIcon size={14} color="#FFFFFF" weight="bold" />}
          <Text style={styles.tagText}>{online ? "Online" : "Nearby"}</Text>
        </View>
        <View style={styles.spacer} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title} accessibilityRole="header">
          Join game
        </Text>

        {how === "scan" ? (
          <Animated.View key="scan" entering={FadeIn.duration(motion.duration.select)} exiting={FadeOut.duration(motion.duration.exit)} style={styles.scanner}>
            {permission?.granted ? (
              <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={busy ? undefined : (r) => onScan(r.data)} />
            ) : (
              <View style={styles.ask}>
                <QrCodeIcon size={40} color={accent.deep} weight="bold" />
                <Text style={styles.askText}>The camera only reads the room's QR.</Text>
                {cameraBlocked ? <RaisedButton label="Open Settings" onPress={() => void Linking.openSettings()} /> : <RaisedButton label="Allow camera" onPress={() => void requestPermission()} />}
              </View>
            )}
            {permission?.granted ? <View style={styles.frame} pointerEvents="none" /> : null}
          </Animated.View>
        ) : (
          <Animated.View key="code" entering={reduceMotion ? FadeIn.duration(motion.duration.select) : FadeInDown.duration(motion.duration.enter).easing(motion.easing.out).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })}>
            <Pressable accessibilityRole="none" onPress={() => input.current?.focus()}>
              <Animated.View style={[styles.slots, shakeStyle]}>
                {Array.from({ length: CODE_LENGTH }, (_, i) => {
                  const ch = code[i] ?? "";
                  const current = i === code.length && !busy;
                  return (
                    <View key={i} style={[styles.slot, ch ? styles.slotFilled : null, current && styles.slotCurrent, error ? styles.slotError : null]}>
                      <Text style={styles.slotText}>{ch}</Text>
                    </View>
                  );
                })}
              </Animated.View>
            </Pressable>
            <TextInput
              ref={input}
              value={code}
              onChangeText={typed}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              autoFocus
              maxLength={CODE_LENGTH}
              style={styles.hidden}
              accessibilityLabel="Room code, six letters and numbers"
              caretHidden
            />
          </Animated.View>
        )}

        <View style={styles.status}>
          {busy ? <Text style={styles.statusText}>Joining</Text> : error ? <Text style={[styles.statusText, styles.errorText]} accessibilityLiveRegion="polite">{error}</Text> : null}
        </View>
      </View>

      {!online ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={how === "scan" ? "Enter a code instead" : "Scan a QR instead"}
            style={styles.switch}
            onPress={() => {
              setError(null);
              setHow((h) => (h === "scan" ? "code" : "scan"));
            }}
          >
            {how === "scan" ? <HashIcon size={18} color={text.primary} weight="bold" /> : <QrCodeIcon size={18} color={text.primary} weight="bold" />}
            <Text style={styles.switchText}>{how === "scan" ? "Enter a code" : "Scan QR"}</Text>
          </PressScale>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: layout.gutter },
  back: { width: layout.iconButton, height: layout.iconButton, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  spacer: { width: layout.iconButton, height: layout.iconButton },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, height: 30, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: text.primary },
  tagText: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
  body: { flex: 1, paddingHorizontal: layout.gutter },
  title: { fontSize: 36, lineHeight: 40, fontWeight: "800", letterSpacing: -1.2, color: text.primary, marginTop: space.xl, marginBottom: space.xl },
  scanner: { aspectRatio: 1, borderRadius: 32, overflow: "hidden", backgroundColor: text.primary, alignItems: "center", justifyContent: "center" },
  frame: { width: "62%", aspectRatio: 1, borderRadius: 28, borderWidth: 3, borderColor: accent.deep },
  ask: { padding: space.xl, gap: space.lg, alignItems: "center", alignSelf: "stretch" },
  askText: { ...type.body, fontWeight: "600", color: "#FFFFFF", textAlign: "center" },
  slots: { flexDirection: "row", gap: 8 },
  slot: { flex: 1, aspectRatio: 0.78, borderRadius: 16, backgroundColor: bg.subtle, borderWidth: 2, borderColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  slotFilled: { backgroundColor: bg.surface, borderColor: border.default },
  slotCurrent: { borderColor: text.primary, backgroundColor: bg.surface },
  slotError: { borderColor: "#D9826B" },
  slotText: { fontSize: 30, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  hidden: { position: "absolute", opacity: 0, height: 1, width: 1 },
  status: { minHeight: 44, justifyContent: "center", marginTop: space.lg },
  statusText: { ...type.supporting, fontWeight: "700", color: text.secondary, textAlign: "center" },
  errorText: { color: "#B4442C" },
  bottom: { alignItems: "center", paddingHorizontal: layout.gutter },
  switch: { flexDirection: "row", alignItems: "center", gap: 8, height: 48, paddingHorizontal: space.xl, borderRadius: radius.pill, backgroundColor: bg.subtle },
  switchText: { fontSize: 15, fontWeight: "800", color: text.primary },
});
