import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { shortDay } from "@/features/care/components/careLogParts";
import { enter } from "@/features/care/food/enter";
import { addDays, daysBetween } from "@/features/care/state/careDose";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

const DAYS_BACK = 365;
const DAY_W = 52;
const STRIP_PAD = space.lg;

/** A choice pill: outlined, ink when picked. */
export const Pill = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
  <PressScale
    accessibilityRole="radio"
    accessibilityState={{ selected: on }}
    accessibilityLabel={label}
    scaleTo={0.95}
    style={[styles.pill, on && styles.pillOn]}
    onPress={() => {
      void Haptics.selectionAsync();
      onPress();
    }}
  >
    <Text style={[styles.pillText, on && styles.pillTextOn]}>{label}</Text>
  </PressScale>
);

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const QUICK = [
  { label: "Yesterday", back: 1 },
  { label: "A week ago", back: 7 },
  { label: "2 weeks ago", back: 14 },
  { label: "A month ago", back: 30 },
  { label: "3 months ago", back: 91 },
];

export const dayTitle = (iso: string, today: string) => {
  const back = daysBetween(iso, today);
  if (back === 0) return "Today";
  if (back === 1) return "Yesterday";
  const [y, m, d] = iso.split("-").map(Number);
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(y, m - 1, d).getDay()];
  return `${wd}, ${shortDay(iso)}`;
};

const agoText = (back: number) =>
  back < 2 ? null : back < 14 ? `${back} days ago` : back < 60 ? `${Math.round(back / 7)} weeks ago` : `${Math.round(back / 30.4)} months ago`;

/** A swipeable strip of past days (today on the right) with shortcuts for the usual answers. */
export const WhenPicker = ({
  today,
  value,
  onChange,
  reduceMotion,
  quick = true,
  compact = false,
  bleed = layout.gutter,
}: {
  today: string;
  value: string;
  onChange: (iso: string) => void;
  reduceMotion: boolean;
  /** Show the "A week ago" style shortcuts under the strip. */
  quick?: boolean;
  /** Inside a row editor: no big date heading (the row already shows it) and a tighter top. */
  compact?: boolean;
  /** How far the strip reaches past the parent's padding to the edges, so it scrolls edge to edge. */
  bleed?: number;
}) => {
  const list = useRef<FlatList<string>>(null);
  const [width, setWidth] = useState(0);
  const days = useMemo(() => Array.from({ length: DAYS_BACK + 1 }, (_, i) => addDays(today, i - DAYS_BACK)), [today]);
  const back = daysBetween(value, today);

  const center = (iso: string, animated: boolean) => {
    const index = days.indexOf(iso);
    if (index < 0 || !width) return;
    list.current?.scrollToOffset({ offset: Math.max(0, STRIP_PAD + index * DAY_W - (width - DAY_W) / 2), animated });
  };

  useEffect(() => {
    if (width) center(value, false);
    // Only on first layout; later moves animate from the tap that caused them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const pick = (iso: string) => {
    void Haptics.selectionAsync();
    onChange(iso);
    center(iso, !reduceMotion);
  };

  return (
    <View style={!compact && styles.when}>
      {compact ? null : (
        <Animated.View key={value} entering={reduceMotion ? undefined : enter({ y: 6 }, { duration: motion.duration.select })} style={styles.readout}>
          <Text style={styles.readoutDay}>{dayTitle(value, today)}</Text>
          {agoText(back) ? <Text style={styles.readoutAgo}>{agoText(back)}</Text> : null}
        </Animated.View>
      )}

      <View
        style={[styles.stripWrap, { marginHorizontal: -bleed }, compact && styles.stripCompact]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width ? (
          <FlatList
            ref={list}
            horizontal
            data={days}
            keyExtractor={(d) => d}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
            getItemLayout={(_, index) => ({ length: DAY_W, offset: STRIP_PAD + DAY_W * index, index })}
            initialNumToRender={20}
            windowSize={7}
            renderItem={({ item }) => <DayCell iso={item} today={today} on={item === value} onPress={() => pick(item)} />}
          />
        ) : null}
      </View>

      {quick ? (
        <View style={[styles.chips, styles.quick]}>
          {QUICK.map((q) => (
            <Pill key={q.label} label={q.label} on={back === q.back} onPress={() => pick(addDays(today, -q.back))} />
          ))}
        </View>
      ) : null}
    </View>
  );
};

const DayCell = ({ iso, today, on, onPress }: { iso: string; today: string; on: boolean; onPress: () => void }) => {
  const [y, m, d] = iso.split("-").map(Number);
  const isToday = iso === today;
  const month = d === 1 ? MONTH[m - 1] : null;
  return (
    <PressScale
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={dayTitle(iso, today)}
      scaleTo={0.92}
      style={styles.day}
      onPress={onPress}
    >
      <Text style={[styles.dayMonth, !month && styles.hidden]}>{month ?? "."}</Text>
      <Text style={[styles.dayWeek, isToday && styles.dayWeekToday]}>{isToday ? "Today" : WEEKDAY[new Date(y, m - 1, d).getDay()]}</Text>
      <View style={[styles.dayDisc, on && styles.dayDiscOn]}>
        <Text style={[styles.dayNum, on && styles.dayNumOn]}>{d}</Text>
      </View>
    </PressScale>
  );
};

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  pill: {
    height: 38,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.canvas,
    justifyContent: "center",
  },
  pillOn: { backgroundColor: text.primary, borderColor: text.primary },
  pillText: { ...type.supporting, color: text.primary },
  pillTextOn: { color: text.inverse, fontWeight: "600" },
  when: { marginTop: space.xl },
  readout: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  readoutDay: { fontSize: 28, lineHeight: 34, letterSpacing: -0.5, fontWeight: "600", color: text.primary },
  readoutAgo: { ...type.supporting, color: text.tertiary },
  stripWrap: { marginTop: space.lg, height: 92 },
  stripCompact: { marginTop: 0 },
  strip: { paddingHorizontal: STRIP_PAD },
  day: { width: DAY_W, alignItems: "center" },
  dayMonth: { ...type.caption, fontSize: 11, fontWeight: "700", color: accent.band, height: 16 },
  dayWeek: { ...type.caption, fontSize: 11, color: text.tertiary, marginTop: 2 },
  dayWeekToday: { color: text.primary, fontWeight: "700" },
  dayDisc: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", marginTop: 6 },
  dayDiscOn: { backgroundColor: text.primary },
  dayNum: { fontSize: 17, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },
  dayNumOn: { color: text.inverse },
  quick: { marginTop: space.lg },
  hidden: { opacity: 0 },
});
