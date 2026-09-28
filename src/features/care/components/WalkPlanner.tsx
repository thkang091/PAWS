import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOut, LinearTransition, useReducedMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { BellSimpleIcon, CalendarPlusIcon, PlusIcon, XIcon } from "phosphor-react-native";

import { FieldLabel, FlowSheet } from "@/features/care/components/FlowSheet";
import { prettyTime } from "@/features/care/components/careSetupAnswers";
import { cancelPlannedWalk, planWalk, startOf, usePlannedWalks, type PlannedWalk } from "@/features/care/state/plannedWalks";
import { PressScale } from "@/components/ui/PressScale";
import { requestNotificationPermissions } from "@/services/notificationService";
import { accent, bg, border, icon as iconSize, layout, motion, radius, space, text, type } from "@/constants/design";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TIMES: Record<"Morning" | "Afternoon" | "Evening", readonly string[]> = {
  Morning: ["06:30", "07:00", "07:30", "08:00", "09:00"],
  Afternoon: ["12:00", "13:00", "15:00", "16:00"],
  Evening: ["17:30", "18:00", "18:30", "19:00", "20:00"],
};

const LENGTHS = [15, 20, 30, 45, 60];

const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dayWord = (key: string) => {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (key === keyOf(today)) return "Today";
  if (key === keyOf(tomorrow)) return "Tomorrow";
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY[date.getDay()]} ${date.getDate()} ${MONTH[date.getMonth()]}`;
};

const nextDays = () => {
  const today = new Date();
  return Array.from({ length: 10 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    return { key: keyOf(d), top: i === 0 ? "Today" : i === 1 ? "Tmrw" : WEEKDAY[d.getDay()], date: d.getDate() };
  });
};

const nowMinutes = () => new Date().getHours() * 60 + new Date().getMinutes();
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export const WalkPlanner = ({ dogName, goalMinutes }: { dogName: string; goalMinutes: number }) => {
  const reduceMotion = useReducedMotion();
  const walks = usePlannedWalks();
  const [open, setOpen] = useState(false);
  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.select);

  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.title}>Walks ahead</Text>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Plan a walk"
          scaleTo={0.95}
          style={styles.plan}
          onPress={() => {
            void Haptics.selectionAsync();
            setOpen(true);
          }}
        >
          <PlusIcon size={14} color={text.primary} weight="bold" />
          <Text style={styles.planText}>Plan a walk</Text>
        </PressScale>
      </View>

      {walks.length === 0 ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Plan a walk"
          scaleTo={0.985}
          style={styles.empty}
          onPress={() => setOpen(true)}
        >
          <View style={styles.emptyDisc}>
            <CalendarPlusIcon size={iconSize.standard} color={text.primary} weight="regular" />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Nothing planned yet</Text>
            <Text style={styles.rowMeta}>{`Pick a day and time, and PAWS nudges you when it's time to go.`}</Text>
          </View>
        </PressScale>
      ) : (
        <Animated.View layout={settle} style={styles.list}>
          {walks.map((walk, index) => (
            <WalkRow key={walk.id} walk={walk} ruled={index > 0} />
          ))}
        </Animated.View>
      )}

      <PlanSheet open={open} dogName={dogName} goalMinutes={goalMinutes} onClose={() => setOpen(false)} />
    </View>
  );
};

const WalkRow = ({ walk, ruled }: { walk: PlannedWalk; ruled: boolean }) => {
  const reduceMotion = useReducedMotion();
  const start = startOf(walk);
  const soon = start.getTime() - Date.now() < 3 * 60 * 60 * 1000;
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.enter).easing(motion.easing.out)}
      exiting={reduceMotion ? undefined : FadeOut.duration(motion.duration.exit)}
      style={[styles.row, ruled && styles.ruled]}
      accessibilityLabel={`${dayWord(walk.dayKey)} at ${prettyTime(walk.time)}, ${walk.minutes} minutes`}
    >
      <View style={[styles.when, soon && styles.whenSoon]}>
        <Text style={styles.whenTime}>{prettyTime(walk.time).split(" ")[0]}</Text>
        <Text style={styles.whenMeridiem}>{prettyTime(walk.time).split(" ")[1]}</Text>
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{dayWord(walk.dayKey)}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.rowMeta}>{`${walk.minutes} min walk`}</Text>
          <BellSimpleIcon size={12} color={text.tertiary} weight="fill" />
        </View>
      </View>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Remove this walk"
        hitSlop={8}
        scaleTo={0.9}
        style={styles.remove}
        onPress={() => {
          void Haptics.selectionAsync();
          cancelPlannedWalk(walk.id);
        }}
      >
        <XIcon size={14} color={text.tertiary} weight="bold" />
      </PressScale>
    </Animated.View>
  );
};

const PlanSheet = ({
  open,
  dogName,
  goalMinutes,
  onClose,
}: {
  open: boolean;
  dogName: string;
  goalMinutes: number;
  onClose: () => void;
}) => {
  const days = useMemo(() => nextDays(), [open]);
  const [dayKey, setDayKey] = useState(days[0].key);
  const [time, setTime] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(30);

  const isToday = dayKey === days[0].key;
  const past = (slot: string) => isToday && minutesOf(slot) <= nowMinutes() + 10;

  useEffect(() => {
    if (!open) return;
    const firstOpen = Object.values(TIMES).flat().find((slot) => minutesOf(slot) > nowMinutes() + 10);
    setDayKey(firstOpen ? days[0].key : days[1].key);
    setTime(firstOpen ?? "07:30");
    const suggested = LENGTHS.reduce((best, len) => (Math.abs(len - goalMinutes / 2) < Math.abs(best - goalMinutes / 2) ? len : best), 30);
    setMinutes(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (time && past(time)) setTime(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey]);

  const save = async () => {
    if (!time) return;
    await requestNotificationPermissions().catch(() => false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    planWalk({ dayKey, time, minutes }, dogName);
    onClose();
  };

  return (
    <FlowSheet
      open={open}
      title="Plan a walk"
      lede={`PAWS reminds you when it's time, and ${dogName}'s walk is ready to start.`}
      step={0}
      total={1}
      direction={1}
      primary={{
        label: time ? `Plan ${dayWord(dayKey).toLowerCase() === "today" ? "today" : dayWord(dayKey)}, ${prettyTime(time)}` : "Pick a time",
        disabled: !time,
        onPress: () => void save(),
      }}
      onBack={onClose}
      onClose={onClose}
    >
      <FieldLabel>Day</FieldLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {days.map((day) => {
          const on = day.key === dayKey;
          return (
            <PressScale
              key={day.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={dayWord(day.key)}
              scaleTo={0.94}
              style={[styles.day, on && styles.dayOn]}
              onPress={() => {
                void Haptics.selectionAsync();
                setDayKey(day.key);
              }}
            >
              <Text style={[styles.dayTop, on && styles.onText]}>{day.top}</Text>
              <Text style={[styles.dayDate, on && styles.onText]}>{day.date}</Text>
            </PressScale>
          );
        })}
      </ScrollView>

      <FieldLabel>Time</FieldLabel>
      {(Object.keys(TIMES) as (keyof typeof TIMES)[]).filter((part) => TIMES[part].some((slot) => !past(slot))).map((part) => (
        <View key={part} style={styles.part}>
          <Text style={styles.partLabel}>{part}</Text>
          <View style={styles.chips}>
            {TIMES[part].filter((slot) => !past(slot)).map((slot) => {
              const on = slot === time;
              const off = false;
              return (
                <PressScale
                  key={slot}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, disabled: off }}
                  accessibilityLabel={prettyTime(slot)}
                  disabled={off}
                  scaleTo={0.94}
                  style={[styles.chip, on && styles.chipOn, off && styles.chipOff]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setTime(slot);
                  }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn, off && styles.chipTextOff]}>{prettyTime(slot)}</Text>
                </PressScale>
              );
            })}
          </View>
        </View>
      ))}

      <FieldLabel>How long</FieldLabel>
      <View style={styles.chips}>
        {LENGTHS.map((len) => {
          const on = len === minutes;
          return (
            <PressScale
              key={len}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${len} minutes`}
              scaleTo={0.94}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => {
                void Haptics.selectionAsync();
                setMinutes(len);
              }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{`${len} min`}</Text>
            </PressScale>
          );
        })}
      </View>
    </FlowSheet>
  );
};

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.section, marginBottom: space.md },
  title: { ...type.sectionTitle, color: text.primary },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: space.md,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  planText: { ...type.supporting, fontWeight: "700", color: text.primary },

  empty: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: border.default,
  },
  emptyDisc: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: accent.soft,
    alignItems: "center",
    justifyContent: "center",
  },

  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 14, backgroundColor: bg.canvas },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  when: {
    width: 54,
    height: 48,
    borderRadius: radius.control,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  whenSoon: { backgroundColor: accent.deep },
  whenTime: { ...type.cardTitle, fontWeight: "700", color: text.primary, fontVariant: ["tabular-nums"], lineHeight: 18 },
  whenMeridiem: { ...type.caption, fontSize: 11, lineHeight: 13, color: text.secondary },
  rowCopy: { flex: 1 },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  rowMeta: { ...type.caption, color: text.tertiary, lineHeight: 17 },
  remove: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },

  strip: { gap: space.sm, paddingRight: layout.gutter },
  day: {
    width: 56,
    paddingVertical: space.md,
    borderRadius: radius.control,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: border.soft,
  },
  dayOn: { backgroundColor: text.primary, borderColor: text.primary },
  dayTop: { ...type.caption, color: text.tertiary },
  dayDate: { ...type.sectionTitle, color: text.primary, marginTop: 2, fontVariant: ["tabular-nums"] },
  onText: { color: text.inverse },

  part: { marginBottom: space.md },
  partLabel: { ...type.caption, fontWeight: "600", color: text.tertiary, marginBottom: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1.5, borderColor: border.soft },
  chipOn: { backgroundColor: accent.primary, borderColor: accent.deep },
  chipOff: { opacity: 0.35 },
  chipText: { ...type.supporting, color: text.secondary, fontVariant: ["tabular-nums"] },
  chipTextOn: { color: text.primary, fontWeight: "600" },
  chipTextOff: { textDecorationLine: "line-through" },
});
