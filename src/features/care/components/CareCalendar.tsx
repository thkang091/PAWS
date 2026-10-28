import { memo, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { CalendarBlankIcon, CaretLeftIcon, CaretRightIcon, CaretUpIcon } from "phosphor-react-native";

import { enter } from "@/features/care/food/enter";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, motion, radius, scene, space, text, type } from "@/constants/design";

const ROW = 60;
const RING = 40;
const STROKE = 3;
const R = (RING - STROKE) / 2;
const C = 2 * Math.PI * R;
const NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const dayKeyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** How a day in this week went: walked minutes against the daily goal. */
export type DayRing = { progress: number };

/** What sits on a day: each kind gets its own colour so a glance tells a vet visit from a walk. */
export type MarkKind = "walk" | "health" | "grooming" | "vet";
export const MARK_COLOR: Record<MarkKind, string> = {
  walk: accent.band,
  health: scene.sageDeep,
  grooming: scene.tan,
  vet: text.primary,
};
const MARK_ORDER: readonly MarkKind[] = ["vet", "health", "grooming", "walk"];

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MAX_WEEKS = 12;

const parseKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const mondayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));

const weekTitle = (offset: number, start: Date) => {
  if (offset === 0) return "This week";
  if (offset === 1) return "Next week";
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return start.getMonth() === end.getMonth()
    ? `${SHORT[start.getMonth()]} ${start.getDate()} to ${end.getDate()}`
    : `${SHORT[start.getMonth()]} ${start.getDate()} to ${SHORT[end.getMonth()]} ${end.getDate()}`;
};

const monthGrid = (year: number, month: number) => {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const rows = Math.ceil((lead + days) / 7);
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => new Date(year, month, 1 - lead + r * 7 + c)),
  );
};

/**
 * This week as rings (how much the dog walked each day). "Calendar" unfolds the rest of the month around this week,
 * iOS Calendar style; swipe sideways while open to browse months. Days with plans carry a dot.
 */
export const CareCalendar = memo(
  ({
    today,
    open,
    selectedKey,
    rings,
    marks,
    onToggle,
    onSelect,
  }: {
    today: Date;
    open: boolean;
    selectedKey: string;
    rings: ReadonlyMap<string, DayRing>;
    marks: ReadonlyMap<string, readonly MarkKind[]>;
    onToggle: (open: boolean) => void;
    onSelect: (date: Date) => void;
  }) => {
    const reduceMotion = useReducedMotion();
    // Month offset while open, week offset while closed: closed, the strip swipes week by week.
    const [offset, setOffset] = useState(0);
    const [weekOffset, setWeekOffset] = useState(0);
    const [direction, setDirection] = useState(1);
    // The month grid is only used while the calendar is open or folding; closed, the week is drawn on its own, so a
    // lost transform can never leave a hidden (transparent) row on screen.
    const [unfolded, setUnfolded] = useState(open);
    useEffect(() => {
      if (open) {
        setUnfolded(true);
        return;
      }
      const id = setTimeout(() => setUnfolded(false), reduceMotion ? 0 : 360);
      return () => clearTimeout(id);
    }, [open, reduceMotion]);

    useEffect(() => {
      if (!open) {
        setOffset(0);
        return;
      }
      // Open on the month of the day that was picked, which may be in a later week.
      const picked = parseKey(selectedKey);
      setOffset((picked.getFullYear() - today.getFullYear()) * 12 + picked.getMonth() - today.getMonth());
      setWeekOffset(0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const base = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const grid = useMemo(() => monthGrid(base.getFullYear(), base.getMonth()), [base.getFullYear(), base.getMonth()]);
    const todayKey = dayKeyOf(today);
    const home = useMemo(() => monthGrid(today.getFullYear(), today.getMonth()), [today]);
    const homeRow = Math.max(0, home.findIndex((row) => row.some((d) => dayKeyOf(d) === todayKey)));
    const homeKeys = useMemo(() => new Set(home[homeRow].map(dayKeyOf)), [home, homeRow]);

    const progress = useDerivedValue(
      () => (reduceMotion ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: 340, easing: motion.easing.drawer })),
      [open],
    );
    const rows = useDerivedValue(
      () => (reduceMotion ? grid.length : withTiming(grid.length, { duration: 240, easing: motion.easing.out })),
      [grid.length],
    );
    const frame = useAnimatedStyle(() => ({ height: ROW + (rows.value - 1) * ROW * progress.value }));
    // homeRow is a dependency: when the date rolls into a new week the strip must follow, or it shows a hidden row.
    const slide = useAnimatedStyle(() => ({ transform: [{ translateY: -homeRow * ROW * (1 - progress.value) }] }), [homeRow]);
    const others = useAnimatedStyle(() => ({ opacity: progress.value }));

    const shift = (by: number) => {
      void Haptics.selectionAsync();
      setDirection(by);
      setOffset((value) => value + by);
    };
    const shiftWeek = (by: number) => {
      const next = Math.max(0, Math.min(MAX_WEEKS, weekOffset + by));
      if (next === weekOffset) return;
      void Haptics.selectionAsync();
      setDirection(next > weekOffset ? 1 : -1);
      setWeekOffset(next);
    };
    const onSwipe = (by: number) => (open ? shift(by) : shiftWeek(by));
    const swipe = Gesture.Pan()
      .activeOffsetX([-18, 18])
      .failOffsetY([-12, 12])
      .onEnd((event) => {
        if (Math.abs(event.translationX) > 50 || Math.abs(event.velocityX) > 500) runOnJS(onSwipe)(event.translationX < 0 ? 1 : -1);
      });

    const thisMonday = mondayOf(today);
    const weekStart = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + weekOffset * 7);
    const week = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));
    const title = open
      ? `${MONTHS[base.getMonth()]}${base.getFullYear() !== today.getFullYear() ? ` ${base.getFullYear()}` : ""}`
      : weekTitle(weekOffset, weekStart);
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    const renderDay = (date: Date, quietOutside: boolean) => {
      const key = dayKeyOf(date);
      const past = date.getTime() < startToday;
      const ring = rings.get(key);
      const live = !past || Boolean(ring);
      const selected = key === selectedKey;
      const isToday = key === todayKey;
      const kinds = marks.get(key) ?? [];
      return (
        <PressScale
          key={key}
          accessibilityRole="button"
          accessibilityState={{ selected, disabled: !live }}
          accessibilityLabel={`${date.getDate()} ${MONTHS[date.getMonth()]}${isToday ? ", today" : ""}${
            ring ? `, walked ${Math.round(ring.progress * 100)} percent of the goal` : ""
          }${kinds.length ? `, ${kinds.length === 1 ? "1 plan" : `${kinds.length} plans`}` : ""}`}
          disabled={!live}
          scaleTo={0.9}
          style={styles.cell}
          onPress={() => {
            void Haptics.selectionAsync();
            onSelect(date);
          }}
        >
          <View style={[styles.pad, selected && styles.padOn]}>
            <Day date={date} ring={ring} future={!past && !isToday && homeKeys.has(key)} isToday={isToday} quiet={quietOutside || !live} />
            <Marks kinds={kinds} />
          </View>
        </PressScale>
      );
    };

    const slideIn = reduceMotion ? undefined : enter({ x: direction * 28 }, { duration: 240 });

    return (
      <View style={styles.root}>
        <View style={styles.head}>
          <Animated.Text key={title} entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)} style={styles.title}>
            {title}
          </Animated.Text>
          {open ? (
            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)} style={styles.nav}>
              {offset !== 0 ? (
                <PressScale accessibilityRole="button" accessibilityLabel="Back to this month" scaleTo={0.94} style={styles.todayChip} onPress={() => shift(-offset)}>
                  <Text style={styles.todayChipText}>Today</Text>
                </PressScale>
              ) : null}
              <PressScale accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={6} scaleTo={0.9} style={styles.round} onPress={() => shift(-1)}>
                <CaretLeftIcon size={15} color={text.primary} weight="bold" />
              </PressScale>
              <PressScale accessibilityRole="button" accessibilityLabel="Next month" hitSlop={6} scaleTo={0.9} style={styles.round} onPress={() => shift(1)}>
                <CaretRightIcon size={15} color={text.primary} weight="bold" />
              </PressScale>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Close the calendar"
                hitSlop={6}
                scaleTo={0.9}
                style={[styles.round, styles.roundDark]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onToggle(false);
                }}
              >
                <CaretUpIcon size={15} color={text.inverse} weight="bold" />
              </PressScale>
            </Animated.View>
          ) : (
            <View style={styles.nav}>
              {weekOffset !== 0 ? (
                <Animated.View entering={reduceMotion ? undefined : enter({ scale: 0.9 }, { duration: motion.duration.select })} exiting={reduceMotion ? undefined : FadeOut.duration(motion.duration.exit)}>
                  <PressScale accessibilityRole="button" accessibilityLabel="Back to this week" scaleTo={0.94} style={styles.todayChip} onPress={() => shiftWeek(-weekOffset)}>
                    <Text style={styles.todayChipText}>Today</Text>
                  </PressScale>
                </Animated.View>
              ) : null}
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Open the calendar"
                scaleTo={0.95}
                style={styles.open}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onToggle(true);
                }}
              >
                <CalendarBlankIcon size={15} color={text.primary} weight="bold" />
                <Text style={styles.openText}>Calendar</Text>
              </PressScale>
            </View>
          )}
        </View>

        <View style={styles.names}>
          {NAMES.map((name) => (
            <Text key={name} style={styles.name}>
              {name}
            </Text>
          ))}
        </View>

        <GestureDetector gesture={swipe}>
          <Animated.View style={[styles.frame, frame]}>
            {!open && (!unfolded || weekOffset !== 0) ? (
              <Animated.View key={`w${weekOffset}`} entering={weekOffset === 0 && direction > 0 ? undefined : slideIn} style={styles.row}>
                {week.map((date) => renderDay(date, false))}
              </Animated.View>
            ) : (
              // Only a month change slides in; opening must keep the vertical unfold transform untouched.
              <Animated.View key={`m${offset}`} entering={offset !== 0 ? slideIn : undefined} style={offset === 0 ? slide : undefined}>
                {grid.map((row, r) => (
                  <Animated.View key={r} style={[styles.row, offset === 0 && r !== homeRow && others]}>
                    {row.map((date) => renderDay(date, date.getMonth() !== base.getMonth() && (open || offset !== 0)))}
                  </Animated.View>
                ))}
              </Animated.View>
            )}
          </Animated.View>
        </GestureDetector>
      </View>
    );
  },
);

CareCalendar.displayName = "CareCalendar";

/** Up to three dots under a date, one per kind of plan, in a fixed order so the colours read the same every day. */
const Marks = ({ kinds }: { kinds: readonly MarkKind[] }) => {
  const shown = MARK_ORDER.filter((k) => kinds.includes(k)).slice(0, 3);
  return (
    <View style={styles.marks}>
      {shown.map((k) => (
        <View key={k} style={[styles.mark, { backgroundColor: MARK_COLOR[k] }]} />
      ))}
    </View>
  );
};

/** A date inside its ring: full sage when the goal was met, ink for today so far, dashed when nothing was walked. */
const Day = ({
  date,
  ring,
  future,
  isToday,
  quiet,
}: {
  date: Date;
  ring: DayRing | undefined;
  future: boolean;
  isToday: boolean;
  quiet: boolean;
}) => {
  const p = Math.min(1, ring?.progress ?? 0);
  const met = p >= 1;
  const empty = ring && !isToday && p === 0;
  const arc = met ? scene.sageDeep : isToday ? text.primary : accent.band;
  return (
    <View style={styles.day}>
      {ring || future ? (
        <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            stroke={empty ? border.strong : border.soft}
            strokeWidth={STROKE}
            strokeDasharray={empty ? "2 5" : undefined}
            strokeLinecap="round"
            fill="none"
          />
          {ring && p > 0 ? (
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              stroke={arc}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${Math.max(0.02, p) * C} ${C}`}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              fill="none"
            />
          ) : null}
        </Svg>
      ) : null}
      <Text style={[styles.date, future && styles.dateFuture, isToday && styles.dateToday, quiet && styles.dateQuiet]}>{date.getDate()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { paddingTop: space.xl },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 34 },
  title: { ...type.sectionTitle, fontWeight: "700", color: text.primary },
  open: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
  },
  openText: { ...type.caption, fontWeight: "700", color: text.primary },
  nav: { flexDirection: "row", alignItems: "center", gap: space.xs },
  todayChip: { paddingHorizontal: space.md, height: 32, justifyContent: "center", borderRadius: radius.pill, backgroundColor: accent.primary },
  todayChipText: { ...type.caption, fontWeight: "700", color: text.primary },
  round: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: bg.subtle },
  roundDark: { backgroundColor: text.primary },
  names: { flexDirection: "row", marginTop: space.md },
  name: { flex: 1, textAlign: "center", ...type.caption, fontWeight: "600", color: text.tertiary },
  frame: { overflow: "hidden", marginTop: 2 },
  row: { flexDirection: "row", height: ROW },
  cell: { flex: 1, alignItems: "center", justifyContent: "center" },
  pad: { alignItems: "center", paddingTop: 4, paddingBottom: 2, paddingHorizontal: 3, borderRadius: 16 },
  padOn: { backgroundColor: accent.primary },
  day: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  date: { ...type.cardTitle, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },
  dateFuture: { color: text.secondary, fontWeight: "500" },
  dateToday: { fontWeight: "800", color: text.primary },
  dateQuiet: { color: text.disabled },
  marks: { flexDirection: "row", gap: 2, height: 5, marginTop: 2 },
  mark: { width: 5, height: 5, borderRadius: 2.5 },
});
