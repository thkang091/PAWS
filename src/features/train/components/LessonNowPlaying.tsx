import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import type { LessonCue } from "@/features/train/components/lessonScript";
import { PressScale } from "@/components/ui/PressScale";
import { accent, border, motion, radius, space, text, type } from "@/constants/design";

export type LessonNowPlayingProps = {
  stepNumber: number;
  stepCount: number;
  stepTitle: string;
  cues: readonly LessonCue[];
  spoken: number;
  progress: SharedValue<number>;
  remaining: string;
  onSeek: (seconds: number) => void;
};

type Row = { y: number; h: number };

const stamp = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export const LessonNowPlaying = ({
  stepNumber,
  stepCount,
  stepTitle,
  cues,
  spoken,
  progress,
  remaining,
  onSeek,
}: LessonNowPlayingProps) => {
  const reduceMotion = useReducedMotion();

  const [rows, setRows] = useState<Row[]>([]);

  const headY = useSharedValue(0);
  const headH = useSharedValue(0);

  useEffect(() => {
    const row = rows[spoken];
    if (!row) return;
    if (reduceMotion) {
      headY.value = row.y;
      headH.value = row.h;
      return;
    }
    const travel = { duration: motion.duration.enter, easing: motion.easing.inOut };
    headY.value = withTiming(row.y, travel);
    headH.value = withTiming(row.h, travel);
  }, [headH, headY, reduceMotion, rows, spoken]);

  const head = useAnimatedStyle(() => ({
    opacity: headH.value > 0 ? 1 : 0,
    height: headH.value,
    transform: [{ translateY: headY.value }],
  }));

  return (
    <Animated.View
      style={styles.root}
      layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)}
      accessibilityLiveRegion="polite"
    >
      <Animated.View
        key={stepNumber}
        entering={
          reduceMotion
            ? undefined
            : FadeIn.duration(motion.duration.enter).withInitialValues({
                opacity: 0,
                transform: [{ translateX: -20 }],
              })
        }
      >
        <Text style={styles.eyebrow} numberOfLines={1}>
          STEP {stepNumber} OF {stepCount} · {stepTitle.toUpperCase()}
        </Text>

        <View style={styles.script}>
          <Animated.View style={[styles.head, head]} pointerEvents="none" />

          {cues.map((cue, index) => {
            const lit = index === spoken;
            return (
              <View
                key={cue.at}
                onLayout={(e) => {
                  const { y, height } = e.nativeEvent.layout;
                  setRows((current) => {
                    if (current[index]?.y === y && current[index]?.h === height) return current;
                    const next = [...current];
                    next[index] = { y, h: height };
                    return next;
                  });
                }}
              >
                <PressScale
                  accessibilityRole="button"
                  accessibilityState={{ selected: lit, disabled: lit }}
                  accessibilityLabel={
                    lit
                      ? `Now playing: ${cue.text}`
                      : `Go back to ${stamp(cue.at)}. ${cue.text}`
                  }
                  disabled={lit}
                  scaleTo={0.985}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onSeek(cue.at);
                  }}
                >
                  <View style={styles.line}>
                    <Text style={[styles.stamp, lit && styles.stampLit]}>{stamp(cue.at)}</Text>
                    <Text style={[styles.cue, lit && styles.cueLit]}>{cue.text}</Text>
                  </View>
                </PressScale>
              </View>
            );
          })}
        </View>
      </Animated.View>

      <View style={styles.meter}>
        <View style={styles.track}>
          <Fill progress={progress} />
        </View>
        <Text style={styles.remaining}>{remaining}</Text>
      </View>
    </Animated.View>
  );
};

const Fill = ({ progress }: { progress: SharedValue<number> }) => {
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(progress.value, 0.001) }],
  }));
  return <Animated.View style={[styles.fill, style]} />;
};

const styles = StyleSheet.create({
  root: { paddingTop: 2 },
  eyebrow: { ...type.eyebrow, color: text.tertiary },

  script: { marginTop: space.md, marginLeft: -space.md },
  head: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: radius.control,
    backgroundColor: accent.primary,
  },

  line: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 7,
  },
  stamp: {
    ...type.caption,
    lineHeight: 25,
    fontWeight: "500",
    color: text.tertiary,
    fontVariant: ["tabular-nums"],
  },
  stampLit: { color: text.primary, fontWeight: "600" },
  cue: {
    flex: 1,
    fontSize: 18,
    lineHeight: 25,
    letterSpacing: -0.2,
    fontWeight: "400",
    color: text.secondary,
  },
  cueLit: { fontWeight: "600", color: text.primary },

  meter: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl },
  track: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: border.soft,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    transform: [{ scaleX: 0 }],
    width: "100%",
    transformOrigin: "left",
  },
  remaining: { ...type.caption, color: text.tertiary, fontVariant: ["tabular-nums"] },
});
