import { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeIn, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { ArrowsCounterClockwiseIcon, CameraRotateIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { ReelPlayer } from "@/features/dogReels/components/ReelPlayer";
import { CLIP_SECONDS, REEL_ENTRY_TEXT, REEL_HELD_TEXT, reelError } from "@/features/dogReels/copy";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { poseKeys, useReelChallenges } from "@/hooks/usePhotoPose";
import { submitReel, type SubmitResult } from "@/services/mediaService";
import { accent, layout, radius, space, text, type } from "@/constants/design";

type Take = { video: string; still: string };

/**
 * Film a reel: up to 15 seconds, filmed here (never picked from the library, so no location is written into it), with
 * the sound off. A silent still is taken as filming starts: the gallery shows it and the check looks at it.
 */
export default function ReelRecordScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const dog = useCurrentDog();
  const { challengeId } = useLocalSearchParams<{ challengeId?: string }>();
  const challenges = useReelChallenges();
  const c = (challenges.data ?? []).find((x) => x.challengeId === challengeId) ?? null;
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView | null>(null);
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [recording, setRecording] = useState(false);
  const [take, setTake] = useState<Take | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SubmitResult["entry"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progress = useSharedValue(0);
  const still = useRef<string | null>(null);

  // The 15 second bar is time itself: linear, from the moment filming starts.
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  useEffect(() => () => cancelAnimation(progress), [progress]);

  const start = async () => {
    if (!camera.current || recording) return;
    setError(null);
    still.current = null;
    setRecording(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    progress.value = 0;
    progress.value = withTiming(1, { duration: CLIP_SECONDS * 1000, easing: Easing.linear });
    const filming = camera.current.recordAsync({ maxDuration: CLIP_SECONDS });
    // The still, a beat after the start so the dog is moving into frame.
    setTimeout(() => {
      camera.current
        ?.takePictureAsync({ quality: 0.7, shutterSound: false, skipProcessing: false })
        .then((p) => (still.current = p?.uri ?? null))
        .catch(() => undefined);
    }, 700);
    try {
      const out = await filming;
      cancelAnimation(progress);
      setRecording(false);
      if (!out?.uri) return;
      if (!still.current) {
        setError(reelError("still_failed"));
        return;
      }
      setTake({ video: out.uri, still: still.current });
    } catch {
      cancelAnimation(progress);
      setRecording(false);
      setError(reelError("camera_unavailable"));
    }
  };
  const stop = () => {
    camera.current?.stopRecording();
    void Haptics.selectionAsync();
  };

  const send = async () => {
    if (!take || !c) return;
    setSending(true);
    setError(null);
    try {
      const r = await submitReel(c.challengeId, dog.data?.id ?? null, take.video, take.still);
      void Haptics.notificationAsync(r.entry.status === "approved" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      setResult(r.entry);
      await queryClient.invalidateQueries({ queryKey: poseKeys.reels });
    } catch (e) {
      setError(reelError((e as { code?: string }).code));
    } finally {
      setSending(false);
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/game/tournament/reels", params: challengeId ? { challengeId } : {} }));

  // ---------- Sent ----------
  if (result) {
    const t = REEL_ENTRY_TEXT[result.status as Exclude<typeof result.status, "withdrawn">];
    return (
      <View style={[styles.dark, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]}>
        <Animated.View entering={FadeIn.duration(220)} style={styles.sent}>
          {take ? <ReelPlayer url={take.video} poster={take.still} style={styles.sentClip} /> : null}
          <Text style={styles.sentTitle}>{t?.title ?? "Sent"}</Text>
          <Text style={styles.sentLine}>{result.status === "held" && result.heldReason ? REEL_HELD_TEXT[result.heldReason] : t?.line}</Text>
        </Animated.View>
        <View style={styles.actions}>
          {result.status === "held" ? (
            <RaisedButton
              label="Film it again"
              onPress={() => {
                setResult(null);
                setTake(null);
              }}
            />
          ) : null}
          <RaisedButton tone={result.status === "held" ? "white" : "yellow"} label="Done" onPress={close} />
        </View>
      </View>
    );
  }

  // ---------- Preview ----------
  if (take) {
    return (
      <View style={styles.dark}>
        <ReelPlayer url={take.video} poster={take.still} style={StyleSheet.absoluteFill} />
        <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
          <PressScale accessibilityRole="button" accessibilityLabel="Close" style={styles.round} onPress={close}>
            <XIcon size={20} color="#FFFFFF" weight="bold" />
          </PressScale>
        </View>
        <View style={[styles.previewBar, { paddingBottom: insets.bottom + space.lg }]}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <PressScale accessibilityRole="button" accessibilityLabel="Film it again" scaleTo={0.94} style={styles.redo} onPress={() => setTake(null)} disabled={sending}>
              <ArrowsCounterClockwiseIcon size={22} color="#FFFFFF" weight="bold" />
            </PressScale>
            <View style={styles.flex}>
              <RaisedButton label="Send clip" sub={c?.title} busy={sending} onPress={() => void send()} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ---------- Camera ----------
  const blocked = permission && !permission.granted && !permission.canAskAgain;
  return (
    <View style={styles.dark}>
      {permission?.granted ? (
        <CameraView ref={camera} style={StyleSheet.absoluteFill} mode="video" facing={facing} mute videoQuality="720p" />
      ) : (
        <View style={styles.ask}>
          <Text style={styles.askTitle}>Film your dog</Text>
          <Text style={styles.askLine}>PAWS uses the camera only while you film. Sound stays off.</Text>
          {blocked ? <RaisedButton label="Open Settings" onPress={() => void Linking.openSettings()} /> : <RaisedButton label="Allow camera" onPress={() => void requestPermission()} />}
        </View>
      )}

      <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
        <PressScale accessibilityRole="button" accessibilityLabel="Close" style={styles.round} onPress={close} disabled={recording}>
          <XIcon size={20} color="#FFFFFF" weight="bold" />
        </PressScale>
        {c ? (
          <View style={styles.themePill}>
            <Text style={styles.themeText} numberOfLines={1}>
              {c.title}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <PressScale accessibilityRole="button" accessibilityLabel="Switch camera" style={styles.round} onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))} disabled={recording}>
          <CameraRotateIcon size={20} color="#FFFFFF" weight="bold" />
        </PressScale>
      </View>
      <View style={[styles.track, { top: insets.top + 64 }]}>
        <Animated.View style={[styles.fill, bar]} />
      </View>

      {permission?.granted ? (
        <View style={[styles.shutterWrap, { paddingBottom: insets.bottom + space.xl }]}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={recording ? "Stop filming" : `Start filming, up to ${CLIP_SECONDS} seconds`}
            scaleTo={0.92}
            style={styles.shutter}
            onPress={() => (recording ? stop() : void start())}
          >
            <Animated.View style={[styles.shutterCore, recording && styles.shutterStop]} entering={reduceMotion ? undefined : FadeIn.duration(120)} />
          </PressScale>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dark: { flex: 1, backgroundColor: "#0E0E0D" },
  topBar: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: layout.gutter, gap: space.md },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  themePill: { flexShrink: 1, height: 36, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center" },
  themeText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
  track: { position: "absolute", left: layout.gutter, right: layout.gutter, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  fill: { flex: 1, backgroundColor: accent.deep, transformOrigin: "left" },
  shutterWrap: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", gap: space.md },
  shutter: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  shutterCore: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#E5483A" },
  shutterStop: { width: 32, height: 32, borderRadius: 8 },
  ask: { flex: 1, justifyContent: "center", paddingHorizontal: space.xxl, gap: space.md },
  askTitle: { fontSize: 30, fontWeight: "800", letterSpacing: -0.8, color: "#FFFFFF" },
  askLine: { ...type.body, color: "#C9C5BC", marginBottom: space.lg },
  previewBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  redo: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  error: { ...type.supporting, fontWeight: "700", color: "#FFB4A6", textAlign: "center" },
  sent: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xxl, gap: space.md },
  sentClip: { width: 180, height: 320, borderRadius: 24, marginBottom: space.lg },
  sentTitle: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6, color: "#FFFFFF", textAlign: "center" },
  sentLine: { ...type.body, color: "#C9C5BC", textAlign: "center" },
  actions: { paddingHorizontal: layout.gutter, gap: space.md },
});
