import { memo, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import {
  WALK_BANDS,
  asDuration as minutesLabel,
  type DayStack,
  type WalkBand,
} from "@/features/care/components/activityData";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

const H = 150;
const HEADROOM = 30;
const STUB = 5;
const BAR = 26;
const GAP = space.xs;
const LABEL_W = 72;

const BAND_TINT: Record<WalkBand, string> = {
  morning: accent.band,
  midday: accent.deep,
  evening: accent.primary,
};


export const WeekStack = memo(
  ({
    stacks,
    selectedDay,
    goal,
    onSelectDay,
  }: {
    stacks: readonly DayStack[];
    selectedDay: number;
    goal: number;
    onSelectDay: (dayIndex: number) => void;
  }) => {
    const reduceMotion = useReducedMotion();
    const [width, setWidth] = useState(0);
    const max = Math.max(...stacks.map((stack) => stack.total), goal, 1);
    const heightOf = (minutes: number) => (minutes > 0 ? Math.max(STUB, (minutes / max) * H) : STUB);

    const selectedIndex = Math.max(
      0,
      stacks.findIndex((stack) => stack.dayIndex === selectedDay),
    );
    const selected = stacks[selectedIndex];
    const column = width > 0 ? (width - GAP * (stacks.length - 1)) / stacks.length : 0;

    const x = useSharedValue(0);
    const y = useSharedValue(0);
    useEffect(() => {
      if (column === 0) return;
      const nextX = selectedIndex * (column + GAP) + column / 2 - LABEL_W / 2;
      const nextY = HEADROOM + H - heightOf(selected.total) - 24;
      const spring = { duration: motion.spring.duration, dampingRatio: 0.82 };
      x.value = reduceMotion ? nextX : withSpring(nextX, spring);
      y.value = reduceMotion ? nextY : withSpring(nextY, spring);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [column, selectedIndex, selected.total, max, reduceMotion]);

    const floatStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: x.value }, { translateY: y.value }],
    }));

    const goalY = HEADROOM + H - (goal / max) * H;
    const empty = stacks.every((stack) => stack.total === 0);

    return (
      <View>
        <View
          style={styles.frame}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        >
          {goal > 0 && width > 0 ? (
            <View style={[styles.goal, { top: goalY - 8 }]} pointerEvents="none">
              <Svg width={width} height={16}>
                <Line
                  x1={0}
                  y1={8}
                  x2={width}
                  y2={8}
                  stroke={text.primary}
                  strokeOpacity={0.28}
                  strokeWidth={1}
                  strokeDasharray="3 5"
                />
              </Svg>
              <Text style={styles.goalLabel}>Goal {minutesLabel(goal)}</Text>
            </View>
          ) : null}

          <View style={styles.plot}>
            {stacks.map((stack, index) => (
              <Column
                key={stack.key}
                stack={stack}
                height={heightOf(stack.total)}
                order={index}
                selected={index === selectedIndex}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onSelectDay(stack.dayIndex);
                }}
              />
            ))}
          </View>

          {column > 0 && !empty ? (
            <Animated.View style={[styles.float, floatStyle]} pointerEvents="none">
              <Text style={styles.floatText} numberOfLines={1}>
                {selected.total > 0 ? minutesLabel(selected.total) : "Rest day"}
              </Text>
            </Animated.View>
          ) : null}
        </View>

        {empty ? (
          <Text style={styles.empty}>No walks logged this week yet.</Text>
        ) : (
          <View style={styles.legend}>
            {WALK_BANDS.map((band) => (
              <View key={band.key} style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: BAND_TINT[band.key] }]} />
                <Text style={styles.legendLabel}>{band.label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  },
);

WeekStack.displayName = "WeekStack";

const Column = ({
  stack,
  height,
  order,
  selected,
  onPress,
}: {
  stack: DayStack;
  height: number;
  order: number;
  selected: boolean;
  onPress: () => void;
}) => {
  const reduceMotion = useReducedMotion();

  const grow = useDerivedValue(
    () =>
      reduceMotion
        ? 1
        : withDelay(
            order * 40,
            withTiming(1, { duration: motion.duration.enter, easing: motion.easing.out }),
          ),
    [reduceMotion, order],
  );

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.value }] }));

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${stack.label}${stack.today ? ", today" : ""}, ${stack.total} active minutes. Show this day.`}
      scaleTo={0.94}
      style={styles.slot}
      onPress={onPress}
    >
      <View style={styles.track}>
        <Animated.View style={[styles.bar, { height }, style]}>
          {stack.total === 0 ? <View style={styles.stub} /> : null}
          {[...WALK_BANDS]
            .reverse()
            .filter((band) => stack.bands[band.key] > 0)
            .map((band, index) => (
              <View
                key={band.key}
                style={[
                  { flex: stack.bands[band.key], backgroundColor: BAND_TINT[band.key] },
                  index > 0 && styles.banded,
                ]}
              />
            ))}
        </Animated.View>
      </View>

      <View style={[styles.dayChip, selected && styles.dayChipSelected]}>
        <Text
          style={[
            styles.dayLabel,
            stack.today && styles.dayLabelToday,
            selected && styles.dayLabelSelected,
          ]}
        >
          {stack.label}
        </Text>
      </View>
      <View style={[styles.todayDot, !stack.today && styles.todayDotHidden]} />
    </PressScale>
  );
};

const styles = StyleSheet.create({
  frame: { paddingTop: HEADROOM },
  plot: { flexDirection: "row", alignItems: "flex-end", gap: GAP },
  slot: { flex: 1, alignItems: "center" },
  track: { height: H, justifyContent: "flex-end", alignItems: "center" },
  bar: {
    width: BAR,
    borderRadius: radius.pill,
    overflow: "hidden",
    transform: [{ scaleY: 0 }],
    transformOrigin: "bottom",
  },
  stub: { flex: 1, backgroundColor: border.soft },
  banded: { borderTopWidth: 2, borderTopColor: bg.canvas },

  goal: { position: "absolute", left: 0, right: 0, height: 16 },
  goalLabel: {
    position: "absolute",
    right: 0,
    top: -10,
    ...type.caption,
    fontSize: 11,
    color: text.tertiary,
    backgroundColor: bg.canvas,
    paddingLeft: 6,
  },

  float: { position: "absolute", top: 0, left: 0, width: LABEL_W, alignItems: "center" },
  floatText: {
    ...type.caption,
    fontWeight: "700",
    color: text.primary,
    fontVariant: ["tabular-nums"],
  },

  dayChip: {
    marginTop: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  dayChipSelected: { backgroundColor: accent.primary },
  dayLabel: { ...type.caption, color: text.tertiary },
  dayLabelToday: { color: text.primary },
  dayLabelSelected: { color: text.primary, fontWeight: "600" },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    backgroundColor: accent.band,
  },
  todayDotHidden: { backgroundColor: "transparent" },

  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: space.lg,
    marginTop: space.xl,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 6, height: 14, borderRadius: 3 },
  legendLabel: { ...type.caption, color: text.secondary },

  empty: { ...type.supporting, color: text.secondary, textAlign: "center", marginTop: space.lg },
});
