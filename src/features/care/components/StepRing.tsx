import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { CountUp } from "@/features/profile/components/CountUp";
import { accent, border, motion, text, type } from "@/constants/design";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 128;
const STROKE = 13;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export const StepRing = memo(
  ({
    value,
    goal,
    unit,
  }: {
    value: number;
    goal: number;
    unit: string;
  }) => {
    const reduceMotion = useReducedMotion();
    const target = Math.min(1, value / goal);

    const swept = useSharedValue(reduceMotion ? target : 0);

    useEffect(() => {
      swept.value = reduceMotion
        ? target
        : withTiming(target, {
            duration: motion.duration.flourish,
            easing: motion.easing.out,
          });
    }, [reduceMotion, swept, target]);

    const arc = useAnimatedProps(() => ({
      strokeDasharray: [C * swept.value, C],
    }));

    return (
      <View
        style={styles.root}
        accessibilityRole="image"
        accessibilityLabel={`${value.toLocaleString()} ${unit.toLowerCase()} of a ${goal.toLocaleString()} goal.`}
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
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={accent.deep}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              animatedProps={arc}
            />
          </G>
        </Svg>

        <View style={styles.readout} pointerEvents="none">
          <CountUp value={value} grouped style={styles.count} />
          <Text style={styles.unit}>{unit}</Text>
        </View>
      </View>
    );
  },
);

StepRing.displayName = "StepRing";

const styles = StyleSheet.create({
  root: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  readout: { position: "absolute", alignItems: "center" },
  count: {
    ...type.pageTitle,
    fontSize: 26,
    lineHeight: 30,
    color: text.primary,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  unit: { ...type.caption, color: text.tertiary, marginTop: 1 },
});
