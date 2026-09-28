import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import type { ActivityHour } from "@/features/care/components/activityData";
import { accent, border, motion, radius, space, text, type } from "@/constants/design";

const H = 84;
const MIN = 0.07;

export const HourBars = memo(({ hours }: { hours: readonly ActivityHour[] }) => (
  <View>
    <View style={styles.plot}>
      {hours.map((hour, index) => (
        <Bar key={index} value={hour.value} order={index} />
      ))}
    </View>
    <View style={styles.axis}>
      {hours.map((hour, index) => (
        <View key={index} style={styles.tick}>
          {hour.label ? (
            <Text style={styles.tickLabel} numberOfLines={1}>
              {hour.label}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  </View>
));

HourBars.displayName = "HourBars";

const Bar = ({ value, order }: { value: number; order: number }) => {
  const reduceMotion = useReducedMotion();
  const height = Math.max(value, MIN);
  const quiet = value < 0.08;

  const grow = useDerivedValue(
    () =>
      reduceMotion
        ? height
        : withDelay(
            order * 30,
            withTiming(height, { duration: motion.duration.enter, easing: motion.easing.out }),
          ),
    [height, reduceMotion, order],
  );

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.value }] }));

  return (
    <View style={styles.slot}>
      <Animated.View style={[styles.bar, quiet && styles.barQuiet, style]} />
    </View>
  );
};

const styles = StyleSheet.create({
  plot: { flexDirection: "row", alignItems: "flex-end", height: H, gap: space.sm },
  slot: { flex: 1, height: H, justifyContent: "flex-end" },
  bar: {
    height: H,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    transform: [{ scaleY: 0 }],
    transformOrigin: "bottom",
  },
  barQuiet: { backgroundColor: border.soft },

  axis: { flexDirection: "row", gap: space.sm, marginTop: space.md, height: 16 },
  tick: { flex: 1 },
  tickLabel: {
    position: "absolute",
    left: 0,
    width: 56,
    ...type.caption,
    color: text.tertiary,
  },
});
