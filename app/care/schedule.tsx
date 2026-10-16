import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, useReducedMotion, withTiming } from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowLeftIcon, PlusIcon } from "phosphor-react-native";

import { AppointmentCard } from "@/features/care/components/AppointmentCard";
import { goBack } from "@/features/care/components/DetailShell";
import { MISSED } from "@/features/care/components/WeekMarks";
import { TodayCareList } from "@/features/care/components/TodayCareList";
import { nowMinutes, useNow, type TodayItem } from "@/features/care/components/todayCare";
import { enter } from "@/features/care/food/enter";
import { extendCarePlan, useCareAppointment } from "@/features/care/state/careOnboarding";
import { useCheckInByDate } from "@/features/care/state/dailyCheckIn";
import { useCareDay } from "@/features/care/state/useCareDay";
import { useConsistency } from "@/features/care/state/useConsistency";
import { PressScale } from "@/components/ui/PressScale";
import { useCareRoutineCompletions, useRemoveCareRoutine } from "@/hooks/useCareEvents";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { accent, bg, border, icon as iconSize, layout, motion, radius, scene, space, text, type } from "@/constants/design";

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const LETTER = ["S", "M", "T", "W", "T", "F", "S"];

const weekAround = (today: Date) => {
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};

/**
 * The schedule: this week across the top, the chosen day below. Today is the exact list Care home shows (same
 * items, same ticks); a past day shows what was done; a later day shows what is planned. Hold anything to take it
 * out of the day. Everything added here becomes a real walk, meal, check-in time or routine.
 */
export default function CareScheduleScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const clock = useNow();
  const today = useMemo(() => new Date(clock.getFullYear(), clock.getMonth(), clock.getDate()), [clock]);
  const todayIso = isoDate(today);
  const week = useMemo(() => weekAround(today), [today]);
  const [selected, setSelected] = useState(todayIso);

  const day = useCareDay(dogId, todayIso);
  const removeRoutine = useRemoveCareRoutine(dogId);
  const appointment = useCareAppointment();
  const [unreachable, setUnreachable] = useState<string | null>(null);
  const checkIns = useCheckInByDate();
  const consistency = useConsistency();

  // Another day: the same plan, with what was done that day from the server (routines) and the check-in record.
  const past = selected < todayIso;
  const otherCompletions = useCareRoutineCompletions(dogId, selected);
  const items = useMemo<TodayItem[]>(() => {
    if (selected === todayIso) return day.items;
    const done = new Set((otherCompletions.data ?? []).map((c) => c.routineId));
    return day.todayItems.map((item) => ({
      ...item,
      done: past ? (item.key === "checkin" ? Boolean(checkIns[selected]) : Boolean(item.routineId && done.has(item.routineId))) : false,
    }));
  }, [selected, todayIso, day.items, day.todayItems, otherCompletions.data, checkIns, past]);

  const doneCount = items.filter((i) => i.done).length;
  const summary = selected === todayIso ? `${doneCount} of ${items.length} done` : past ? `${doneCount} done` : `${items.length} planned`;
  const heading =
    selected === todayIso ? "Today" : new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  const remove = (item: TodayItem) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // The check-in is moved, not removed: the add screen sets its time.
    if (item.key === "checkin") return router.push("/care/routine-form" as never);
    if (item.iconKey === "pill" && !item.routineId) return router.push("/care/medications" as never);
    const plan = day.choice;
    const time = item.time;
    const fromPlan = plan && time && ((item.iconKey === "walk" && plan.walkTimes?.includes(time)) || (item.iconKey === "bowl-mix" && plan.mealTimes?.includes(time)));
    Alert.alert(`Remove ${item.title.toLowerCase()}?`, fromPlan ? "Only this time comes off the day." : "It comes off every day.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          if (fromPlan && plan && time) {
            if (item.iconKey === "walk") extendCarePlan("walks", { walkTimes: (plan.walkTimes ?? []).filter((t) => t !== time) });
            else extendCarePlan("meals", { mealTimes: (plan.mealTimes ?? []).filter((t) => t !== time), mealsPerDay: Math.max(1, (plan.mealTimes?.length ?? 1) - 1) });
          } else if (item.routineId) removeRoutine.mutate(item.routineId);
        },
      },
    ]);
  };

  const markOf = (iso: string) => consistency.week.find((d) => d.date === iso)?.mark ?? null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        <PressScale accessibilityRole="button" accessibilityLabel="Back" style={styles.round} onPress={() => goBack("/(tabs)/care")}>
          <ArrowLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
        </PressScale>

        <Text style={styles.h1} accessibilityRole="header">
          Schedule
        </Text>

        <View style={styles.week}>
          {week.map((d) => {
            const iso = isoDate(d);
            return (
              <DayChip
                key={iso}
                letter={LETTER[d.getDay()]}
                date={d.getDate()}
                on={iso === selected}
                today={iso === todayIso}
                mark={iso < todayIso ? markOf(iso) : null}
                progress={iso === todayIso ? day.items.filter((i) => i.done).length / Math.max(1, day.items.length) : null}
                onPress={() => {
                  if (iso === selected) return;
                  void Haptics.selectionAsync();
                  setSelected(iso);
                }}
              />
            );
          })}
        </View>

        {appointment && appointment.dayKey === selected ? (
          <View style={styles.appointment}>
            <AppointmentCard appointment={appointment} reduceMotion={reduceMotion} onUnreachable={setUnreachable} />
            {unreachable ? <Text style={styles.unreachable}>{unreachable}</Text> : null}
          </View>
        ) : null}

        <View style={styles.dayHead}>
          <Text style={styles.dayTitle}>{heading}</Text>
          <Text style={styles.daySummary}>{summary}</Text>
        </View>

        <Animated.View key={selected} entering={reduceMotion ? undefined : enter({ y: 8 }, { duration: motion.duration.enter })}>
          {items.length ? (
            <TodayCareList
              items={items}
              now={selected === todayIso ? nowMinutes(clock) : -1}
              reduceMotion={reduceMotion}
              readOnly={selected !== todayIso}
              onToggle={day.toggle}
              onOpen={(item) => {
                if (item.key === "checkin") day.toggle(item);
                else if (item.iconKey === "walk") router.push("/care/plan-walk?mode=now" as never);
              }}
              onLongPress={remove}
            />
          ) : (
            <Text style={styles.empty}>Nothing planned yet.</Text>
          )}
        </Animated.View>
        {items.length ? <Text style={styles.hint}>Hold anything to remove it.</Text> : null}
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.lg }]} pointerEvents="box-none">
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Add to the day"
          scaleTo={0.96}
          style={styles.add}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/care/routine-form" as never);
          }}
        >
          <PlusIcon size={iconSize.button} color={text.primary} weight="bold" />
          <Text style={styles.addText}>Add</Text>
        </PressScale>
      </View>
    </View>
  );
}

/** One day of the week: its letter and date, a ring for today's progress, a dot for how a past day went. */
const DayChip = ({
  letter,
  date,
  on,
  today,
  mark,
  progress,
  onPress,
}: {
  letter: string;
  date: number;
  on: boolean;
  today: boolean;
  mark: string | null;
  progress: number | null;
  onPress: () => void;
}) => {
  const reduceMotion = useReducedMotion();
  const lit = useDerivedValue(() => (reduceMotion ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: motion.duration.select, easing: motion.easing.out })), [on]);
  const fill = useAnimatedStyle(() => ({ opacity: lit.value, transform: [{ scale: 0.9 + lit.value * 0.1 }] }));
  return (
    <PressScale accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${today ? "Today, " : ""}${letter} ${date}`} scaleTo={0.92} style={styles.day} onPress={onPress}>
      <Text style={[styles.dayLetter, today && styles.dayLetterToday]}>{letter}</Text>
      <View style={styles.dayNumberWrap}>
        <Animated.View style={[styles.dayOn, fill]} pointerEvents="none" />
        <Text style={[styles.dayNumber, on && styles.dayNumberOn]}>{date}</Text>
      </View>
      <View style={[styles.dayDot, mark === "kept" && styles.dotKept, mark === "missed" && styles.dotMissed, progress != null && progress > 0 && styles.dotToday]} />
    </PressScale>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  content: { paddingHorizontal: layout.gutter },
  round: { width: layout.iconButton, height: layout.iconButton, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  h1: { ...type.pageTitle, fontSize: 34, lineHeight: 40, color: text.primary, marginTop: space.xl },

  week: { flexDirection: "row", justifyContent: "space-between", marginTop: space.xl },
  day: { alignItems: "center", gap: 6, width: 42 },
  dayLetter: { ...type.caption, fontWeight: "600", color: text.tertiary },
  dayLetterToday: { color: text.primary },
  dayNumberWrap: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  dayOn: { position: "absolute", width: 40, height: 40, borderRadius: 20, backgroundColor: text.primary },
  dayNumber: { ...type.cardTitle, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },
  dayNumberOn: { color: text.inverse },
  dayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "transparent" },
  dotKept: { backgroundColor: scene.sageDeep },
  dotMissed: { backgroundColor: MISSED },
  dotToday: { backgroundColor: accent.band },

  appointment: { marginTop: space.xl },
  unreachable: { ...type.caption, color: text.secondary, marginTop: space.sm },

  dayHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.xxl, marginBottom: space.lg },
  dayTitle: { ...type.sectionTitle, color: text.primary },
  daySummary: { ...type.supporting, color: text.tertiary, fontVariant: ["tabular-nums"] },
  empty: { ...type.body, color: text.secondary },
  hint: { ...type.caption, color: text.tertiary, textAlign: "center", marginTop: space.xl },

  dock: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "flex-end", paddingHorizontal: layout.gutter },
  add: { flexDirection: "row", alignItems: "center", gap: space.sm, height: 52, paddingHorizontal: space.xl, borderRadius: radius.pill, backgroundColor: accent.deep, borderWidth: 1, borderColor: border.soft },
  addText: { ...type.cardTitle, fontWeight: "700", color: text.primary },
});
