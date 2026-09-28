import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Image } from "expo-image";
import { MicrophoneIcon } from "phosphor-react-native";

import { accent, motion, radius, space, text, type } from "@/constants/design";

export type UserTurnView = {
  text: string;
  imageUri?: string;
  voice?: { durationMs: number; levels: readonly number[]; transcribing: boolean };
};

const clock = (ms: number) => {
  const s = Math.max(1, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const UserBubble = memo(
  ({ turn, animate, reduceMotion }: { turn: UserTurnView; animate: boolean; reduceMotion: boolean }) => (
    <Animated.View
      entering={
        animate && !reduceMotion
          ? FadeIn.duration(motion.duration.enter)
              .easing(motion.easing.out)
              .withInitialValues({ transform: [{ scale: 0.92 }, { translateY: 8 }] })
          : undefined
      }
      style={styles.row}
    >
      <View style={styles.bubble}>
        {turn.imageUri ? (
          <Image
            source={{ uri: turn.imageUri }}
            style={[styles.photo, !turn.text && !turn.voice && styles.photoAlone]}
            contentFit="cover"
            transition={160}
            accessibilityLabel="Photo you sent"
          />
        ) : null}

        {turn.voice?.transcribing ? (
          <View style={styles.wave} accessibilityLabel="Transcribing your voice note">
            {turn.voice.levels.map((value, index) => (
              <View key={index} style={[styles.bar, { transform: [{ scaleY: Math.max(0.12, value) }] }]} />
            ))}
          </View>
        ) : turn.text ? (
          <Animated.Text
            entering={turn.voice && !reduceMotion ? FadeIn.duration(motion.duration.enter) : undefined}
            style={styles.text}
          >
            {turn.text}
          </Animated.Text>
        ) : null}

        {turn.voice ? (
          <View style={styles.voiceMeta}>
            <MicrophoneIcon size={12} color={text.primary} weight="fill" />
            <Text style={styles.voiceMetaText}>
              {turn.voice.transcribing ? "Listening back" : "Voice"}, {clock(turn.voice.durationMs)}
            </Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  ),
);

UserBubble.displayName = "UserBubble";

const styles = StyleSheet.create({
  row: { alignItems: "flex-end", transformOrigin: "bottom right" },
  bubble: {
    maxWidth: "82%",
    backgroundColor: accent.deep,
    borderRadius: 24,
    borderBottomRightRadius: 8,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    overflow: "hidden",
  },
  text: { ...type.body, fontSize: 16.5, lineHeight: 23, color: text.primary },
  photo: {
    width: 232,
    height: 232,
    borderRadius: radius.card,
    marginBottom: space.sm,
    marginHorizontal: -space.sm,
    marginTop: -space.xs,
  },
  photoAlone: { marginBottom: -space.xs },
  wave: { flexDirection: "row", alignItems: "center", gap: 3, height: 28, width: 180 },
  bar: { flex: 1, height: 28, borderRadius: 2, backgroundColor: "rgba(28,27,26,0.55)" },
  voiceMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  voiceMetaText: { ...type.caption, fontWeight: "600", color: "rgba(28,27,26,0.62)" },
});
