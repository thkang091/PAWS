import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { PawPrintIcon } from "phosphor-react-native";

import { accent, border, motion, space, text, type } from "@/constants/design";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 168;
const STROKE = 15;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const GAP = 11;

export const CareStatusRing = memo(
  ({
    segments,
    verdict,
    onTrack,
    total,
  }: {
    segments: readonly boolean[];
    verdict: string;
    onTrack: number;
    total: number;
  }) => {
    const reduceMotion = useReducedMotion();
    const count = segments.length;
    const span = 360 / count - GAP;
    const arc = (span / 360) * C;

    const readout = useSharedValue(reduceMotion ? 1 : 0);
    useEffect(() => {
      if (reduceMotion) {
        readout.value = 1;
        return;
      }
      readout.value = withDelay(
        count * 70 + 120,
        withTiming(1, { duration: motion.duration.enter, easing: motion.easing.out }),
      );
    }, [count, readout, reduceMotion]);

    const readoutStyle = useAnimatedStyle(() => ({
      opacity: readout.value,
      transform: [{ scale: 0.94 + readout.value * 0.06 }],
    }));

    return (
      <View
        style={styles.root}
        accessibilityRole="image"
        accessibilityLabel={`Care status ${verdict}. ${onTrack} of ${total} areas on track.`}
      >
        <Svg width={SIZE} height={SIZE}>
          <G transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {segments.map((on, index) => (
              <Arc
                key={index}
                index={index}
                on={on}
                arc={arc}
                start={((index * (360 / count) + GAP / 2) / 360) * C}
                reduceMotion={reduceMotion}
              />
            ))}
          </G>
        </Svg>

        <Animated.View style={[styles.center, readoutStyle]} pointerEvents="none">
          <PawPrintIcon size={22} color={text.primary} weight="fill" />
          <Text style={styles.verdict}>{verdict}</Text>
          <Text style={styles.count}>
            {onTrack} of {total}
          </Text>
          <Text style={styles.caption}>on track</Text>
        </Animated.View>
      </View>
    );
  },
);

CareStatusRing.displayName = "CareStatusRing";

const Arc = ({
  index,
  on,
  arc,
  start,
  reduceMotion,
}: {
  index: number;
  on: boolean;
  arc: number;
  start: number;
  reduceMotion: boolean;
}) => {
  const drawn = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      drawn.value = 1;
      return;
    }
    drawn.value = withDelay(
      index * 70,
      withTiming(1, { duration: motion.duration.flourish, easing: motion.easing.out }),
    );
  }, [drawn, index, reduceMotion]);

  const props = useAnimatedProps(() => ({
    strokeDasharray: [arc * drawn.value, C],
  }));

  return (
    <AnimatedCircle
      cx={SIZE / 2}
      cy={SIZE / 2}
      r={R}
      stroke={on ? accent.deep : border.soft}
      strokeWidth={STROKE}
      strokeLinecap="round"
      fill="none"
      strokeDashoffset={-start}
      animatedProps={props}
    />
  );
};

const styles = StyleSheet.create({
  root: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  center: { position: "absolute", alignItems: "center" },
  verdict: {
    ...type.pageTitle,
    fontSize: 26,
    lineHeight: 30,
    color: text.primary,
    marginTop: space.xs,
  },
  count: { ...type.cardTitle, fontWeight: "600", color: text.primary, marginTop: 1 },
  caption: { ...type.caption, color: text.tertiary },
});
