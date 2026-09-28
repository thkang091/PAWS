import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { DogIcon } from "phosphor-react-native";

import { accent, motion, radius, space, text, type } from "@/constants/design";

type Block =
  | { kind: "prose"; text: string }
  | { kind: "move"; number: string; text: string }
  | { kind: "ask"; text: string };

const toBlocks = (value: string): Block[] => {
  const lines = value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return lines.map((line, index) => {
    const numbered = line.match(/^(\d+)\.\s+(.*)$/);
    if (numbered) return { kind: "move", number: numbered[1], text: numbered[2] };
    if (index === lines.length - 1 && line.endsWith("?") && lines.length > 1) {
      return { kind: "ask", text: line };
    }
    return { kind: "prose", text: line };
  });
};

const rise = (index: number, reduceMotion: boolean) =>
  reduceMotion
    ? undefined
    : FadeIn.duration(280)
        .delay(index * 70)
        .easing(motion.easing.out)
        .withInitialValues({ transform: [{ translateY: 10 }] });

export const CoachReply = memo(
  ({ value, animate, reduceMotion }: { value: string; animate: boolean; reduceMotion: boolean }) => {
    const blocks = toBlocks(value);
    return (
      <View style={styles.reply} accessibilityRole="text">
        {blocks.map((block, index) => (
          <Animated.View
            key={index}
            entering={animate ? rise(index, reduceMotion) : undefined}
            style={block.kind === "move" ? styles.move : block.kind === "ask" ? styles.askWrap : undefined}
          >
            {block.kind === "move" ? (
              <>
                <Text style={styles.moveNumber}>{block.number}</Text>
                <Text style={[styles.prose, styles.moveText]}>{block.text}</Text>
              </>
            ) : (
              <Text style={block.kind === "ask" ? styles.ask : styles.prose}>{block.text}</Text>
            )}
          </Animated.View>
        ))}
      </View>
    );
  },
);

CoachReply.displayName = "CoachReply";

export const CoachMark = ({ breathing, reduceMotion, size = 30 }: { breathing: boolean; reduceMotion: boolean; size?: number }) => {
  const breath = useSharedValue(1);
  useEffect(() => {
    if (!breathing || reduceMotion) {
      cancelAnimation(breath);
      breath.value = withTiming(1, { duration: motion.duration.select });
      return;
    }
    breath.value = withRepeat(
      withTiming(0.88, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, [breath, breathing, reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));
  return (
    <Animated.View style={[styles.mark, { width: size, height: size }, style]}>
      <DogIcon size={size * 0.58} color={text.primary} weight="bold" />
    </Animated.View>
  );
};

export const CoachThinking = ({ label, reduceMotion }: { label: string; reduceMotion: boolean }) => {
  const glow = useSharedValue(0.45);
  useEffect(() => {
    if (reduceMotion) return;
    glow.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(glow);
  }, [glow, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
      style={styles.thinking}
      accessibilityLabel={label}
    >
      <CoachMark breathing reduceMotion={reduceMotion} size={26} />
      <Animated.Text style={[styles.thinkingText, style]}>{label}</Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  reply: { gap: space.md, paddingRight: space.lg },
  prose: { ...type.body, fontSize: 17, lineHeight: 26, color: text.primary },
  move: { flexDirection: "row", gap: space.md },
  moveNumber: {
    ...type.body,
    fontSize: 20,
    lineHeight: 26,
    width: 18,
    fontWeight: "700",
    color: accent.band,
    fontVariant: ["tabular-nums"],
  },
  moveText: { flex: 1 },
  askWrap: { marginTop: space.xs },
  ask: { ...type.body, fontSize: 17, lineHeight: 26, fontWeight: "600", color: text.primary },

  mark: {
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  thinking: { flexDirection: "row", alignItems: "center", gap: space.md },
  thinkingText: { ...type.supporting, fontWeight: "500", color: text.secondary },
});
