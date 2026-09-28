import { memo, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { PressScale } from "@/components/ui/PressScale";
import { accent, motion, radius, space, text, type } from "@/constants/design";

const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const INSET = 3;

export const WeekStrip = memo(
  ({
    days,
    selectedIndex,
    todayIndex,
    onSelect,
  }: {
    days: readonly Date[];
    selectedIndex: number;
    todayIndex: number;
    onSelect: (index: number) => void;
  }) => {
    const reduceMotion = useReducedMotion();
    const [trackWidth, setTrackWidth] = useState(0);
    const cell = trackWidth / Math.max(1, days.length);

    const x = useSharedValue(0);
    const placed = useRef(false);

    useEffect(() => {
      if (cell <= 0) return;
      const to = selectedIndex * cell + INSET;
      if (!placed.current || reduceMotion) {
        placed.current = true;
        x.value = to;
        return;
      }
      x.value = withTiming(to, {
        duration: motion.duration.select,
        easing: motion.easing.inOut,
      });
    }, [cell, reduceMotion, selectedIndex, x]);

    const lozenge = useAnimatedStyle(() => ({
      width: Math.max(0, cell - INSET * 2),
      transform: [{ translateX: x.value }],
    }));

    return (
      <View
        style={styles.track}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        {cell > 0 ? <Animated.View style={[styles.lozenge, lozenge]} pointerEvents="none" /> : null}

        {days.map((date, index) => {
          const selected = index === selectedIndex;
          const today = index === todayIndex;
          return (
            <PressScale
              key={date.toISOString()}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${DAY_LABEL[date.getDay()]} ${date.getDate()}${
                today ? ", today" : ""
              }`}
              scaleTo={0.94}
              style={styles.cell}
              onPress={() => onSelect(index)}
            >
              <Text style={[styles.name, selected && styles.nameOn]}>
                {DAY_LABEL[date.getDay()]}
              </Text>
              <Text style={[styles.date, selected && styles.dateOn]}>{date.getDate()}</Text>
              <View style={[styles.dot, today && !selected && styles.dotOn]} />
            </PressScale>
          );
        })}
      </View>
    );
  },
);

WeekStrip.displayName = "WeekStrip";

const styles = StyleSheet.create({
  track: { flexDirection: "row", paddingTop: space.lg },
  lozenge: {
    position: "absolute",
    top: space.lg,
    bottom: 0,
    left: 0,
    borderRadius: radius.input,
    backgroundColor: accent.primary,
  },
  cell: { flex: 1, alignItems: "center", paddingTop: space.md, paddingBottom: space.sm },
  name: { ...type.caption, color: text.tertiary },
  nameOn: { color: text.primary, fontWeight: "600" },
  date: {
    ...type.cardTitle,
    fontWeight: "600",
    color: text.secondary,
    marginTop: 3,
    fontVariant: ["tabular-nums"],
  },
  dateOn: { color: text.primary },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 5, backgroundColor: "transparent" },
  dotOn: { backgroundColor: accent.deep },
});
