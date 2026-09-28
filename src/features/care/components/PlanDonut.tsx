import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import Animated, {
  FadeIn,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { accent, border, motion, scene, text, type } from "@/constants/design";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const MEAL_TINTS = [accent.band, accent.deep, scene.tan, scene.ball] as const;

const SIZE = 188;
const STROKE = 22;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const GAP = STROKE + 6;

export const PlanDonut = memo(
  ({
    parts,
    active,
    kcal,
  }: {
    parts: readonly { key: string; grams: number; tint: string }[];
    active: boolean;
    kcal: number | null;
  }) => {
    const reduceMotion = useReducedMotion();
    const sweep = useSharedValue(reduceMotion ? 1 : 0);

    useEffect(() => {
      if (!active) return;
      if (reduceMotion) {
        sweep.value = 1;
        return;
      }
      sweep.value = 0;
      sweep.value = withTiming(1, { duration: 900, easing: motion.easing.out });
    }, [active, reduceMotion, sweep]);

    const total = parts.reduce((sum, part) => sum + part.grams, 0);
    const gap = parts.length > 1 ? GAP : 0;
    let cursor = 0;
    const arcs = parts.map((part) => {
      const share = total > 0 ? (part.grams / total) * C : 0;
      const arc = { ...part, start: cursor + gap / 2, len: Math.max(0.5, share - gap) };
      cursor += share;
      return arc;
    });

    return (
      <View
        style={styles.root}
        accessibilityRole="image"
        accessibilityLabel={`${total} grams a day across ${parts.length} ${parts.length === 1 ? "meal" : "meals"}`}
      >
        <Svg width={SIZE} height={SIZE}>
          <G transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={border.soft}
              strokeWidth={STROKE}
              fill="none"
            />
            {arcs.map((arc) => (
              <Arc key={arc.key} start={arc.start} len={arc.len} tint={arc.tint} sweep={sweep} />
            ))}
          </G>
        </Svg>

        <View style={styles.center} pointerEvents="none">
          <Animated.Text
            key={total}
            entering={
              reduceMotion
                ? undefined
                : FadeIn.duration(220).withInitialValues({ opacity: 0, transform: [{ scale: 0.92 }] })
            }
            style={styles.total}
          >
            {total}
          </Animated.Text>
          <Text style={styles.unit}>g a day</Text>
          {kcal ? <Text style={styles.kcal}>{kcal.toLocaleString()} kcal</Text> : null}
        </View>
      </View>
    );
  },
);

PlanDonut.displayName = "PlanDonut";

const Arc = ({
  start,
  len,
  tint,
  sweep,
}: {
  start: number;
  len: number;
  tint: string;
  sweep: SharedValue<number>;
}) => {
  const reduceMotion = useReducedMotion();
  const from = useSharedValue(start);
  const size = useSharedValue(len);

  useEffect(() => {
    const timing = { duration: reduceMotion ? 0 : 420, easing: motion.easing.inOut };
    from.value = withTiming(start, timing);
    size.value = withTiming(len, timing);
  }, [from, len, reduceMotion, size, start]);

  const props = useAnimatedProps(() => {
    const drawn = Math.max(0, Math.min(size.value, sweep.value * C - from.value));
    return {
      strokeDasharray: [drawn, C],
      strokeDashoffset: -from.value,
      strokeOpacity: drawn < 0.6 ? 0 : 1,
    };
  });

  return (
    <AnimatedCircle
      cx={SIZE / 2}
      cy={SIZE / 2}
      r={R}
      stroke={tint}
      strokeWidth={STROKE}
      strokeLinecap="round"
      fill="none"
      animatedProps={props}
    />
  );
};

const styles = StyleSheet.create({
  root: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  center: { position: "absolute", alignItems: "center" },
  total: {
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1.6,
    fontWeight: "700",
    color: text.primary,
    fontVariant: ["tabular-nums"],
  },
  unit: { ...type.supporting, color: text.secondary, marginTop: -2 },
  kcal: { ...type.caption, color: text.tertiary, marginTop: 2 },
});
