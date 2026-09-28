import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInLeft, FadeInRight } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { CaretLeftIcon, CaretRightIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import {
  accent,
  bg,
  icon as iconSize,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

const MONTH = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HEADS = ["M", "T", "W", "T", "F", "S", "S"];

export const dayKeyOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

export const dayLabelOf = (date: Date) =>
  `${WEEKDAY[date.getDay()]} ${date.getDate()} ${SHORT[date.getMonth()]}`;

export type PickedDay = { key: string; label: string };

export const MonthPicker = ({
  selected,
  reduceMotion,
  onPick,
  range = "future",
}: {
  selected: string | null;
  reduceMotion: boolean;
  onPick: (day: PickedDay) => void;
  range?: "future" | "past";
}) => {
  const today = useMemo(() => new Date(), []);
  const todayKey = dayKeyOf(today);

  const [cursor, setCursor] = useState(() => {
    if (!selected) return { year: today.getFullYear(), month: today.getMonth() };
    const [year, month] = selected.split("-").map(Number);
    return { year, month: month - 1 };
  });
  const [direction, setDirection] = useState(1);

  const atToday = cursor.year === today.getFullYear() && cursor.month === today.getMonth();
  const atStart = range === "future" && atToday;
  const atEnd = range === "past" && atToday;
  const blocked = (key: string) => (range === "future" ? key < todayKey : key > todayKey);

  const weeks = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const lead = (first.getDay() + 6) % 7;
    const length = new Date(cursor.year, cursor.month + 1, 0).getDate();

    const cells = [
      ...Array.from({ length: lead }, (_, i) => ({ blank: true as const, key: `b${i}` })),
      ...Array.from({ length }, (_, i) => {
        const date = new Date(cursor.year, cursor.month, i + 1);
        return { blank: false as const, key: dayKeyOf(date), label: dayLabelOf(date), day: i + 1 };
      }),
    ];
    while (cells.length % 7 !== 0) cells.push({ blank: true as const, key: `t${cells.length}` });

    return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  }, [cursor.month, cursor.year]);

  const step = (by: number) => {
    if ((by < 0 && atStart) || (by > 0 && atEnd)) return;
    void Haptics.selectionAsync();
    setDirection(by);
    setCursor((current) => {
      const next = new Date(current.year, current.month + by, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const labelEnter = reduceMotion
    ? undefined
    : (direction > 0 ? FadeInRight : FadeInLeft)
        .duration(motion.duration.select)
        .withInitialValues({ transform: [{ translateX: direction > 0 ? 12 : -12 }] });

  const gridEnter = reduceMotion ? undefined : FadeIn.duration(motion.duration.enter);

  return (
    <View>
      <View style={styles.head}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          accessibilityState={{ disabled: atStart }}
          disabled={atStart}
          scaleTo={0.9}
          style={[styles.arrow, atStart && styles.arrowOff]}
          onPress={() => step(-1)}
        >
          <CaretLeftIcon size={iconSize.standard} color={text.primary} weight="bold" />
        </PressScale>

        <Animated.Text key={`${cursor.year}-${cursor.month}`} entering={labelEnter} style={styles.month}>
          {MONTH[cursor.month]} {cursor.year}
        </Animated.Text>

        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: atEnd }}
          disabled={atEnd}
          scaleTo={0.9}
          style={[styles.arrow, atEnd && styles.arrowOff]}
          onPress={() => step(1)}
        >
          <CaretRightIcon size={iconSize.standard} color={text.primary} weight="bold" />
        </PressScale>
      </View>

      <View style={styles.heads}>
        {HEADS.map((letter, index) => (
          <Text key={index} style={styles.headText}>
            {letter}
          </Text>
        ))}
      </View>

      <Animated.View key={`${cursor.year}-${cursor.month}`} entering={gridEnter} style={styles.grid}>
        {weeks.map((week, index) => (
          <View key={index} style={styles.week}>
            {week.map((cell) =>
              cell.blank ? (
                <View key={cell.key} style={styles.cell} />
              ) : (
                <PressScale
                  key={cell.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selected === cell.key, disabled: blocked(cell.key) }}
                  accessibilityLabel={cell.label}
                  disabled={blocked(cell.key)}
                  scaleTo={0.88}
                  style={styles.cell}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onPick({ key: cell.key, label: cell.label });
                  }}
                >
                  <View style={[styles.day, selected === cell.key && styles.dayOn]}>
                    <Text
                      style={[
                        styles.dayText,
                        blocked(cell.key) && styles.dayPast,
                        cell.key === todayKey && styles.dayToday,
                        selected === cell.key && styles.dayTextOn,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </View>
                </PressScale>
              ),
            )}
          </View>
        ))}
      </Animated.View>
    </View>
  );
};

const CELL = 40;

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.xs,
  },
  arrow: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowOff: { opacity: 0.35 },
  month: { ...type.cardTitle, fontSize: 17, fontWeight: "600", color: text.primary },

  heads: { flexDirection: "row" },
  headText: {
    ...type.caption,
    color: text.tertiary,
    flex: 1,
    textAlign: "center",
  },

  grid: { marginTop: space.xs },
  week: { flexDirection: "row" },
  cell: { flex: 1, height: CELL, alignItems: "center", justifyContent: "center" },
  day: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  dayOn: { backgroundColor: accent.primary },
  dayText: { ...type.supporting, color: text.primary },
  dayPast: { color: text.disabled },
  dayToday: { fontWeight: "700", textDecorationLine: "underline" },
  dayTextOn: { color: text.primary, fontWeight: "600" },
});
