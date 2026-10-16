import { StyleSheet, Text, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { CheckIcon, MoonIcon } from "phosphor-react-native";

import { enter } from "@/features/care/food/enter";
import type { ConsistencyDay } from "@/features/care/intel/consistency";
import { accent, bg, border, motion, scene, text, type } from "@/constants/design";

const LETTER = ["S", "M", "T", "W", "T", "F", "S"];
export const MISSED = "#C2412D";

const dayOf = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};

const LABEL: Record<ConsistencyDay["mark"], string> = {
  kept: "checked in",
  rest: "skipped",
  missed: "missed",
  today: "today, not yet",
  off: "before check-ins",
};

/**
 * Seven days of check-ins as marks: a filled check for kept, a dashed red ring for missed, a moon for a night skipped
 * on purpose, an open ring for today. Missed days are the only thing in red, so a gap is the first thing you see.
 */
export const WeekMarks = ({ week, size = 32, animate = true, focus }: { week: readonly ConsistencyDay[]; size?: number; animate?: boolean; focus?: string }) => {
  const reduceMotion = useReducedMotion();
  const glyph = Math.round(size * 0.44);
  return (
    <View
      style={styles.row}
      accessibilityRole="summary"
      accessibilityLabel={`Last 7 days: ${week.map((d) => LABEL[d.mark]).join(", ")}`}
    >
      {week.map((day, i) => (
        <Animated.View
          key={`${day.date}-${day.mark}`}
          entering={reduceMotion || !animate ? undefined : enter({ scale: 0.7 }, { delay: 60 + i * 35, duration: motion.duration.enter })}
          style={[styles.day, focus && day.date !== focus && styles.dim]}
        >
          <View
            style={[
              styles.mark,
              { width: size, height: size, borderRadius: size / 2 },
              day.mark === "kept" && (day.catchUp ? styles.keptLate : styles.kept),
              day.mark === "missed" && styles.missed,
              day.mark === "rest" && styles.rest,
              day.mark === "today" && styles.today,
              day.mark === "off" && styles.off,
              day.date === focus && styles.focus,
            ]}
          >
            {day.mark === "kept" ? <CheckIcon size={glyph} color={day.catchUp ? text.primary : text.inverse} weight="bold" /> : null}
            {day.mark === "rest" ? <MoonIcon size={glyph} color={text.secondary} weight="fill" /> : null}
          </View>
          <Text style={[styles.letter, day.mark === "missed" && styles.letterMissed, day.mark === "today" && styles.letterToday]}>{LETTER[dayOf(day.date)]}</Text>
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between" },
  day: { alignItems: "center", gap: 6 },
  mark: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: border.default },
  kept: { backgroundColor: scene.sageDeep, borderColor: scene.sageDeep },
  keptLate: { backgroundColor: accent.soft, borderColor: scene.sageDeep },
  missed: { borderColor: MISSED, borderStyle: "dashed", borderWidth: 2 },
  rest: { backgroundColor: bg.subtle, borderColor: bg.subtle },
  today: { borderColor: text.primary, borderWidth: 2 },
  off: { borderColor: bg.subtle, backgroundColor: bg.canvas },
  dim: { opacity: 0.45 },
  focus: { transform: [{ scale: 1.18 }] },
  letter: { ...type.caption, fontSize: 11, color: text.tertiary },
  letterMissed: { color: MISSED, fontWeight: "700" },
  letterToday: { color: text.primary, fontWeight: "700" },
});
