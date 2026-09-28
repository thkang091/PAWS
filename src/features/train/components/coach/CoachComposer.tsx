import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Linking } from "react-native";
import {
  ArrowUpIcon,
  CameraIcon,
  ImagesIcon,
  MicrophoneIcon,
  TrashIcon,
  XIcon,
} from "phosphor-react-native";

import { LEVELS, useVoiceNote } from "@/features/train/components/coach/useVoiceNote";
import { PressScale } from "@/components/ui/PressScale";
import type { ChatImage, VoiceClip } from "@/services/trainerChat";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

const SIZE = 44;

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const Bar = ({ value, reduceMotion }: { value: number; reduceMotion: boolean }) => {
  const scale = useSharedValue(value);
  useEffect(() => {
    scale.value = reduceMotion ? value : withTiming(value, { duration: 90, easing: motion.easing.out });
  }, [reduceMotion, scale, value]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));
  return <Animated.View style={[styles.bar, style]} />;
};

const RecordingDot = ({ reduceMotion }: { reduceMotion: boolean }) => {
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[styles.recDot, style]} />;
};

export const CoachComposer = ({
  placeholder,
  busy,
  reduceMotion,
  bottomInset,
  inputRef,
  onSend,
  onVoice,
  onNotice,
}: {
  placeholder: string;
  busy: boolean;
  reduceMotion: boolean;
  bottomInset: number;
  inputRef?: React.RefObject<TextInput | null>;
  onSend: (message: { text: string; image?: ChatImage }) => void;
  onVoice: (clip: VoiceClip, levels: readonly number[]) => void;
  onNotice: (message: string | null, action?: { label: string; run: () => void }) => void;
}) => {
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<ChatImage | null>(null);
  const [menu, setMenu] = useState(false);
  const finishing = useRef(false);

  const sendVoice = async () => {
    if (finishing.current) return;
    finishing.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const levels = voice.levels;
    const clip = await voice.finish();
    finishing.current = false;
    if (clip === "short") {
      onNotice("That was too short to hear. Tap the microphone and speak for a moment.");
      return;
    }
    if (clip === "quiet") {
      onNotice("Could not hear a voice in that. Try again a little closer to the phone.");
      return;
    }
    onVoice(clip, levels);
  };

  const voice = useVoiceNote(() => void sendVoice());
  const recording = voice.state === "recording";
  const hasContent = draft.trim().length > 0 || photo !== null;

  const morph = useSharedValue(hasContent ? 1 : 0);
  useEffect(() => {
    morph.value = reduceMotion ? (hasContent ? 1 : 0) : withSpring(hasContent ? 1 : 0, motion.spring);
  }, [hasContent, morph, reduceMotion]);
  const micStyle = useAnimatedStyle(() => ({
    opacity: 1 - morph.value,
    transform: [{ scale: 1 - 0.4 * morph.value }, { rotate: `${-30 * morph.value}deg` }],
  }));
  const sendStyle = useAnimatedStyle(() => ({
    opacity: morph.value,
    transform: [{ scale: 0.6 + 0.4 * morph.value }, { rotate: `${30 * (1 - morph.value)}deg` }],
  }));

  const tint = useSharedValue(0);
  useEffect(() => {
    tint.value = withTiming(recording ? 1 : 0, {
      duration: recording ? motion.duration.enter : motion.duration.exit,
      easing: motion.easing.out,
    });
  }, [recording, tint]);
  const tintStyle = useAnimatedStyle(() => ({ opacity: tint.value }));

  useEffect(() => {
    if (voice.state === "denied") {
      onNotice("PAWS needs the microphone to hear you.", {
        label: "Open Settings",
        run: () => void Linking.openSettings(),
      });
      voice.clearDenied();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.state]);

  const pick = async (source: "camera" | "library") => {
    setMenu(false);
    void Haptics.selectionAsync();
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        onNotice(
          "PAWS needs the camera to take a photo for your coach.",
          permission.canAskAgain ? undefined : { label: "Open Settings", run: () => void Linking.openSettings() },
        );
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.5, base64: true, exif: false };
    try {
      const result =
        source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      const asset = result.canceled ? null : result.assets[0];
      if (!asset?.base64) return;
      setPhoto({ base64: asset.base64, mimeType: asset.mimeType ?? "image/jpeg", uri: asset.uri });
      onNotice(null);
    } catch {
      onNotice(
        source === "camera"
          ? "The camera is not available here. Choose a photo instead."
          : "That photo could not be opened. Try another one.",
      );
    }
  };

  const primary = () => {
    if (busy) return;
    if (hasContent) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSend({ text: draft.trim(), image: photo ?? undefined });
      setDraft("");
      setPhoto(null);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMenu(false);
    onNotice(null);
    void voice.start();
  };

  const swap = reduceMotion ? undefined : FadeIn.duration(motion.duration.select);
  const leave = reduceMotion ? undefined : FadeOut.duration(120);

  return (
    <View style={[styles.dock, { paddingBottom: bottomInset + space.sm }]} pointerEvents="box-none">
      {menu ? (
        <>
          <Pressable style={styles.menuScrim} onPress={() => setMenu(false)} />
          <Animated.View
            entering={
              reduceMotion
                ? undefined
                : FadeIn.duration(motion.duration.select)
                    .easing(motion.easing.out)
                    .withInitialValues({ transform: [{ scale: 0.88 }, { translateY: 8 }] })
            }
            exiting={leave}
            style={styles.menu}
          >
            <PressScale accessibilityRole="button" accessibilityLabel="Take a photo" scaleTo={0.98} style={styles.menuRow} onPress={() => void pick("camera")}>
              <CameraIcon size={iconSize.standard} color={text.primary} weight="regular" />
              <Text style={styles.menuText}>Take a photo</Text>
            </PressScale>
            <View style={styles.menuRule} />
            <PressScale accessibilityRole="button" accessibilityLabel="Choose from your photos" scaleTo={0.98} style={styles.menuRow} onPress={() => void pick("library")}>
              <ImagesIcon size={iconSize.standard} color={text.primary} weight="regular" />
              <Text style={styles.menuText}>Choose from photos</Text>
            </PressScale>
          </Animated.View>
        </>
      ) : null}

      <View style={styles.capsule}>
        <Animated.View pointerEvents="none" style={[styles.tint, tintStyle]} />

        {photo && !recording ? (
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).withInitialValues({ transform: [{ scale: 0.9 }] })}
            exiting={leave}
            style={styles.pending}
          >
            <Image source={{ uri: photo.uri }} style={styles.pendingPhoto} contentFit="cover" />
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              scaleTo={0.9}
              style={styles.pendingRemove}
              onPress={() => {
                void Haptics.selectionAsync();
                setPhoto(null);
              }}
            >
              <XIcon size={11} color={text.inverse} weight="bold" />
            </PressScale>
            <Text style={styles.pendingHint}>Say what is happening in it.</Text>
          </Animated.View>
        ) : null}

        <View style={styles.row}>
          {recording ? (
            <>
              <Animated.View key="cancel" entering={swap} exiting={leave}>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel="Discard voice note"
                  scaleTo={0.9}
                  style={styles.ghost}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    void voice.cancel();
                  }}
                >
                  <TrashIcon size={iconSize.button} color={text.primary} weight="regular" />
                </PressScale>
              </Animated.View>

              <Animated.View key="wave" entering={swap} exiting={leave} style={styles.live}>
                <RecordingDot reduceMotion={reduceMotion} />
                <Text style={styles.timer}>{clock(voice.durationMs)}</Text>
                <View style={styles.waveform} accessibilityLabel="Recording">
                  {voice.levels.slice(-LEVELS).map((value, index) => (
                    <Bar key={index} value={value} reduceMotion={reduceMotion} />
                  ))}
                </View>
              </Animated.View>
            </>
          ) : (
            <>
              <Animated.View key="camera" entering={swap} exiting={leave}>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel="Add a photo"
                  accessibilityState={{ expanded: menu }}
                  scaleTo={0.9}
                  style={[styles.ghost, menu && styles.ghostOn]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setMenu((open) => !open);
                  }}
                >
                  <CameraIcon size={iconSize.button} color={text.primary} weight="regular" />
                </PressScale>
              </Animated.View>

              <Animated.View key="field" entering={swap} exiting={leave} style={styles.fieldWrap}>
                <TextInput
                  ref={inputRef}
                  style={styles.field}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={placeholder}
                  placeholderTextColor={text.tertiary}
                  multiline
                  maxLength={800}
                  onFocus={() => setMenu(false)}
                  accessibilityLabel="Message your coach"
                />
              </Animated.View>
            </>
          )}

          <PressScale
            accessibilityRole="button"
            accessibilityLabel={recording ? "Send voice note" : hasContent ? "Send" : "Record a voice note"}
            accessibilityState={{ disabled: busy && !recording }}
            disabled={busy && !recording}
            scaleTo={0.9}
            onPress={recording ? () => void sendVoice() : primary}
          >
            <View style={[styles.action, (hasContent || recording) && styles.actionOn, busy && !recording && styles.actionBusy]}>
              {recording ? (
                <Animated.View key="send-voice" entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select).withInitialValues({ transform: [{ scale: 0.6 }] })}>
                  <ArrowUpIcon size={iconSize.button} color={text.primary} weight="bold" />
                </Animated.View>
              ) : (
                <>
                  <Animated.View style={[styles.icon, micStyle]}>
                    <MicrophoneIcon size={iconSize.button} color={text.primary} weight="regular" />
                  </Animated.View>
                  <Animated.View style={[styles.icon, sendStyle]}>
                    <ArrowUpIcon size={iconSize.button} color={text.primary} weight="bold" />
                  </Animated.View>
                </>
              )}
            </View>
          </PressScale>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dock: { paddingHorizontal: space.md, paddingTop: space.sm },
  capsule: {
    borderRadius: 30,
    backgroundColor: bg.surface,
    borderWidth: 1,
    borderColor: border.soft,
    padding: 6,
    overflow: "hidden",
    shadowColor: "#1C1B1A",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  tint: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: accent.soft },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 4 },

  ghost: { width: SIZE, height: SIZE, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  ghostOn: { backgroundColor: accent.primary },

  fieldWrap: { flex: 1 },
  field: {
    minHeight: SIZE,
    maxHeight: 128,
    paddingHorizontal: space.sm,
    paddingTop: Platform.OS === "ios" ? 12 : 10,
    paddingBottom: Platform.OS === "ios" ? 12 : 10,
    ...type.body,
    fontSize: 16.5,
    lineHeight: 21,
    color: text.primary,
  },

  action: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  actionOn: { backgroundColor: accent.deep },
  actionBusy: { opacity: 0.45 },
  icon: { position: "absolute" },

  live: { flex: 1, flexDirection: "row", alignItems: "center", height: SIZE, gap: space.sm, paddingHorizontal: space.xs },
  recDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: accent.band },
  timer: { ...type.supporting, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"], width: 36 },
  waveform: { flex: 1, flexDirection: "row", alignItems: "center", gap: 2, height: 30 },
  bar: { flex: 1, height: 30, borderRadius: 2, backgroundColor: text.primary },

  menuScrim: { position: "absolute", top: -2000, left: -200, width: 4000, height: 4000 },
  menu: {
    position: "absolute",
    bottom: SIZE + 26,
    left: space.md,
    width: 224,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.surface,
    transformOrigin: "bottom left",
    shadowColor: "#1C1B1A",
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    zIndex: 5,
  },
  menuRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, height: 50 },
  menuRule: { height: 1, backgroundColor: border.soft, marginHorizontal: space.lg },
  menuText: { ...type.supporting, fontWeight: "600", color: text.primary },

  pending: { flexDirection: "row", alignItems: "center", gap: space.md, padding: 6, paddingBottom: 4 },
  pendingPhoto: { width: 56, height: 56, borderRadius: radius.control + 2 },
  pendingRemove: {
    position: "absolute",
    left: 50,
    top: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: text.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingHint: { ...type.caption, color: text.secondary, flex: 1 },
});
