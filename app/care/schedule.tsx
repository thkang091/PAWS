import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withTiming,
} from "react-native-reanimated";
import { router } from "expo-router";

import { AppointmentCard } from "@/features/care/components/AppointmentCard";
import { goBack } from "@/features/care/components/DetailShell";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BellIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  PawPrintIcon,
  PlusIcon,
  SparkleIcon,
} from "phosphor-react-native";

import { CareDog } from "@/features/care/components/CareDog";
import { MARKER, RoutineMarker, type RoutineState } from "@/features/care/components/RoutineMarker";
import { RoutineIcon } from "@/features/care/components/routineIcon";
import { PressScale } from "@/components/ui/PressScale";
import {
  useCareRoutineCompletions,
  useCareRoutines,
  useCompleteCareRoutine,
} from "@/hooks/useCareEvents";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useCareAppointment, useCarePlan } from "@/features/care/state/careOnboarding";
import type { CareRoutine } from "@/types/domain";
import {
  accent,
  bg,
  border,
  elevation,
  icon as iconSize,
  layout,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

const RAIL = MARKER + space.md;
const BOTTOM = 132;

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const longDate = (d: Date) =>
  d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const weekAround = (today: Date) => {
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};

export default function CareScheduleScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";

  const [span, setSpan] = useState<"daily" | "weekly">("daily");
  const today = useMemo(() => new Date(), []);
  const todayIso = isoDate(today);

  const routines = useCareRoutines(dogId);
  const completions = useCareRoutineCompletions(dogId, todayIso);
  const complete = useCompleteCareRoutine(dogId, todayIso);

  const doneIds = useMemo(
    () => new Set((completions.data ?? []).map((c) => c.routineId)),
    [completions.data],
  );

  const planned = useCarePlan();
  const appointment = useCareAppointment();
  const [unreachable, setUnreachable] = useState<string | null>(null);

  const list = useMemo(
    () => [...(routines.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [routines.data],
  );

  const nowId = list.find((r) => !doneIds.has(r.id))?.id;

  const stateOf = (r: CareRoutine): RoutineState =>
    doneIds.has(r.id) ? "done" : r.id === nowId ? "now" : "waiting";

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.sm, paddingBottom: BOTTOM + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.roundButton}
            onPress={() => goBack("/(tabs)/care")}
          >
            <ArrowLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
          </PressScale>
          <View style={styles.headerActions}>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              style={styles.roundButton}
              onPress={() => router.push("/notifications-settings")}
            >
              <BellIcon size={iconSize.nav} color={text.primary} weight="regular" />
            </PressScale>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Profile"
              style={styles.roundButton}
              onPress={() => router.push("/profile")}
            >
              <PawPrintIcon size={iconSize.nav} color={text.primary} weight="fill" />
            </PressScale>
          </View>
        </View>

        <View style={styles.title}>
          <View style={styles.titleCopy}>
            <Text style={styles.h1}>Care schedule</Text>
            <Text style={styles.sub}>Tracking your pet routine.</Text>
          </View>
          <CareDog art="walk" width={120} />
        </View>

        <View style={styles.controls}>
          <Segmented span={span} onChange={setSpan} reduceMotion={reduceMotion} />
          <View style={styles.datePill}>
            <CalendarBlankIcon size={iconSize.inline} color={text.secondary} weight="regular" />
            <Text style={styles.dateText}>{longDate(today)}</Text>
            <CaretDownIcon size={iconSize.inline} color={text.tertiary} weight="bold" />
          </View>
        </View>

        {appointment ? (
          <View style={styles.appointment}>
            <AppointmentCard
              appointment={appointment}
              reduceMotion={reduceMotion}
              onUnreachable={setUnreachable}
            />
            {unreachable ? <Text style={styles.unreachable}>{unreachable}</Text> : null}
          </View>
        ) : null}

        {list.length === 0 && planned.length > 0 ? (
          <View style={styles.timeline}>
            {planned.map((routine, index) => (
              <Animated.View
                key={routine.key}
                entering={
                  reduceMotion
                    ? undefined
                    : FadeInDown.duration(motion.duration.enter).delay(index * motion.stagger)
                }
              >
                <PlannedRow
                  time={routine.time}
                  title={routine.title}
                  detail={routine.detail}
                  last={index === planned.length - 1}
                />
              </Animated.View>
            ))}
          </View>
        ) : list.length === 0 ? (
          <FirstRun name={dog.data?.name ?? "your dog"} />
        ) : span === "daily" ? (
          <View style={styles.timeline}>
            {list.map((routine, index) => (
              <Animated.View
                key={routine.id}
                layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter)}
                entering={
                  reduceMotion
                    ? undefined
                    : FadeInDown.duration(motion.duration.enter).delay(index * motion.stagger)
                }
              >
                <RoutineRow
                  routine={routine}
                  state={stateOf(routine)}
                  last={index === list.length - 1}
                  reduceMotion={reduceMotion}
                  onComplete={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    complete.mutate(routine.id);
                  }}
                  pending={complete.isPending}
                />
              </Animated.View>
            ))}
          </View>
        ) : (
          <WeeklyView today={today} total={list.length} doneToday={doneIds.size} />
        )}
      </ScrollView>

      <View style={[styles.fabDock, { paddingBottom: insets.bottom + space.xl }]} pointerEvents="box-none">
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Add routine"
          style={styles.fab}
          onPress={() => router.push("/care/event-form")}
        >
          <PlusIcon size={iconSize.button} color={text.primary} weight="bold" />
          <Text style={styles.fabText}>Add routine</Text>
        </PressScale>
      </View>
    </View>
  );
}

const Segmented = ({
  span,
  onChange,
  reduceMotion,
}: {
  span: "daily" | "weekly";
  onChange: (s: "daily" | "weekly") => void;
  reduceMotion: boolean;
}) => {
  const [slots, setSlots] = useState<Record<string, { x: number; width: number }>>({});
  const target = useDerivedValue(
    () =>
      reduceMotion
        ? (span === "daily" ? 0 : 1)
        : withTiming(span === "daily" ? 0 : 1, {
            duration: motion.duration.select,
            easing: motion.easing.inOut,
          }),
    [span, reduceMotion],
  );
  const daily = slots.daily;
  const weekly = slots.weekly;
  const pill = useAnimatedStyle(() => {
    if (!daily || !weekly) return { width: 0 };
    const t = target.value;
    return {
      width: daily.width + (weekly.width - daily.width) * t,
      transform: [{ translateX: daily.x + (weekly.x - daily.x) * t }],
    };
  }, [daily, weekly]);

  return (
    <View style={styles.segment}>
      {(["daily", "weekly"] as const).map((key) => (
        <Pressable
          key={key}
          accessibilityRole="tab"
          accessibilityState={{ selected: span === key }}
          style={styles.segmentTab}
          onLayout={(e) => {
            const { x, width } = e.nativeEvent.layout;
            setSlots((current) =>
              current[key]?.x === x && current[key]?.width === width
                ? current
                : { ...current, [key]: { x, width } },
            );
          }}
          onPress={() => {
            if (span === key) return;
            void Haptics.selectionAsync();
            onChange(key);
          }}
        >
          <Text style={[styles.segmentText, span === key && styles.segmentTextOn]}>
            {key === "daily" ? "Daily" : "Weekly"}
          </Text>
        </Pressable>
      ))}
      <Animated.View style={[styles.segmentUnderline, pill]} pointerEvents="none" />
    </View>
  );
};

const RoutineRow = ({
  routine,
  state,
  last,
  reduceMotion,
  onComplete,
  pending,
}: {
  routine: CareRoutine;
  state: RoutineState;
  last: boolean;
  reduceMotion: boolean;
  onComplete: () => void;
  pending: boolean;
}) => (
  <View style={styles.row}>
    <View style={styles.railColumn}>
      <RoutineMarker state={state} />
      {!last ? <View style={styles.railLine} /> : null}
    </View>

    <View style={styles.rowBody}>
      {routine.reminderTime ? <Text style={styles.time}>{routine.reminderTime}</Text> : null}

      <View style={[styles.card, state === "now" ? styles.cardNow : styles.cardQuiet]}>
        <View style={styles.cardHead}>
          <View style={[styles.cardIcon, state === "now" && styles.cardIconNow]}>
            <RoutineIcon iconKey={routine.iconKey} size={iconSize.standard} color={text.primary} />
          </View>

          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {routine.title}
            </Text>
            {routine.description ? (
              <Text
                style={[styles.cardDesc, state === "now" && styles.cardDescNow]}
                numberOfLines={state === "now" ? 3 : 2}
              >
                {routine.description}
              </Text>
            ) : null}
          </View>

          {state === "done" ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>Completed</Text>
            </View>
          ) : state === "now" ? (
            <View style={[styles.chip, styles.chipNow]}>
              <Text style={styles.chipText}>Now</Text>
            </View>
          ) : (
            <View style={styles.box} />
          )}

          {state === "now" ? (
            <Animated.View
              entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
              style={styles.cardArt}
              pointerEvents="none"
            >
              <CareDog art="ball" width={96} />
            </Animated.View>
          ) : null}
        </View>

        {state === "now" ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`Mark ${routine.title} as done`}
            disabled={pending}
            style={[styles.cta, pending && styles.ctaPending]}
            onPress={onComplete}
          >
            <Text style={styles.ctaText}>Mark as done</Text>
          </PressScale>
        ) : null}
      </View>
    </View>
  </View>
);

const WeeklyView = ({
  today,
  total,
  doneToday,
}: {
  today: Date;
  total: number;
  doneToday: number;
}) => {
  const week = useMemo(() => weekAround(today), [today]);
  const todayIso = isoDate(today);

  return (
    <View style={styles.week}>
      {week.map((d) => {
        const isToday = isoDate(d) === todayIso;
        const past = d < today && !isToday;
        return (
          <View key={isoDate(d)} style={[styles.weekRow, isToday && styles.weekRowToday]}>
            <Text style={[styles.weekDay, isToday && styles.weekDayToday]}>
              {d.toLocaleDateString(undefined, { weekday: "long" })}
            </Text>
            <Text style={styles.weekCount}>
              {isToday
                ? `${doneToday} of ${total} done`
                : past
                  ? "Not set"
                  : `${total} planned`}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const FirstRun = ({ name }: { name: string }) => {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
      style={styles.firstRun}
    >
      <View style={styles.firstRunDisc}>
        <SparkleIcon size={26} color={text.primary} weight="regular" />
      </View>
      <Text style={styles.firstRunTitle}>Build {name}&rsquo;s day</Text>
      <Text style={styles.firstRunBody}>
        Answer three questions, or press through and take what PAWS suggests for the breed. It
        takes about a minute and you can change any of it later.
      </Text>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`Set up ${name}'s daily routine`}
        scaleTo={0.97}
        style={styles.firstRunButton}
        onPress={() => router.push("/care/setup")}
      >
        <Text style={styles.firstRunButtonText}>Set up the routine</Text>
        <ArrowRightIcon size={iconSize.button} color={text.primary} weight="bold" />
      </PressScale>
    </Animated.View>
  );
};

const PlannedRow = ({
  time,
  title,
  detail,
  last,
}: {
  time: string;
  title: string;
  detail: string;
  last: boolean;
}) => (
  <View style={styles.plannedRow}>
    <Text style={styles.plannedTime}>{time}</Text>
    <View style={styles.plannedRail}>
      <View style={styles.plannedDot} />
      {!last ? <View style={styles.plannedLine} /> : null}
    </View>
    <View style={styles.plannedCopy}>
      <Text style={styles.plannedTitle}>{title}</Text>
      <Text style={styles.plannedDetail}>{detail}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  appointment: { marginTop: space.xl, gap: space.sm },
  unreachable: { ...type.caption, color: text.secondary },

  plannedRow: { flexDirection: "row", alignItems: "stretch", minHeight: 64 },
  plannedTime: {
    width: 52,
    paddingTop: 14,
    ...type.caption,
    fontWeight: "600",
    color: text.secondary,
    fontVariant: ["tabular-nums"],
  },
  plannedRail: { width: 24, alignItems: "center", paddingTop: 16 },
  plannedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: accent.deep,
    backgroundColor: bg.canvas,
  },
  plannedLine: { flex: 1, width: 1, backgroundColor: border.soft, marginTop: 4 },
  plannedCopy: { flex: 1, paddingVertical: space.md, paddingLeft: space.xs },
  plannedTitle: { ...type.cardTitle, color: text.primary },
  plannedDetail: { ...type.supporting, color: text.tertiary, marginTop: 2 },

  screen: { flex: 1, backgroundColor: bg.canvas },
  content: { paddingHorizontal: layout.gutter },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerActions: { flexDirection: "row", gap: space.sm },
  roundButton: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
    justifyContent: "center",
  },

  title: { flexDirection: "row", alignItems: "center", marginTop: space.lg },
  titleCopy: { flex: 1 },
  h1: { ...type.pageTitle, color: text.primary },
  sub: { ...type.supporting, color: text.secondary, marginTop: space.xs },

  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    marginTop: space.xl,
  },
  segment: { flexDirection: "row", gap: space.lg, paddingBottom: space.sm },
  segmentUnderline: {
    position: "absolute",
    left: 0,
    bottom: 0,
    height: 2,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  segmentTab: { paddingVertical: 2 },
  segmentText: { ...type.cardTitle, color: text.tertiary },
  segmentTextOn: { color: text.primary, fontWeight: "600" },

  datePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
  },
  dateText: { ...type.supporting, color: text.primary },

  timeline: { marginTop: space.xl },
  row: { flexDirection: "row" },
  railColumn: { width: RAIL, alignItems: "center" },
  railLine: { flex: 1, width: 1, backgroundColor: border.default, marginVertical: space.xs },
  rowBody: { flex: 1, paddingBottom: space.lg },

  time: { ...type.caption, fontWeight: "500", color: text.secondary, marginBottom: space.sm },

  card: { borderRadius: radius.card, overflow: "hidden" },
  cardQuiet: { backgroundColor: bg.subtle },
  cardNow: {
    backgroundColor: bg.surface,
    borderWidth: 1,
    borderColor: border.soft,
    ...elevation,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    padding: space.lg,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: bg.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconNow: { backgroundColor: accent.primary },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  cardDesc: { ...type.caption, color: text.secondary, marginTop: 2 },
  cardDescNow: { paddingRight: 68 },
  cardArt: { position: "absolute", right: 0, bottom: 0 },

  chip: {
    paddingVertical: 4,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: bg.surface,
    borderWidth: 1,
    borderColor: border.soft,
  },
  chipNow: { backgroundColor: accent.primary, borderColor: "transparent" },
  chipText: { ...type.caption, fontWeight: "600", color: text.primary },

  box: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: border.default,
  },

  cta: {
    margin: space.lg,
    marginTop: 0,
    paddingVertical: space.lg,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
  },
  ctaPending: { opacity: 0.6 },
  ctaText: { ...type.cardTitle, fontWeight: "700", color: text.primary },

  week: { marginTop: space.xl, gap: space.sm },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
  },
  weekRowToday: { backgroundColor: accent.primary, borderColor: "transparent" },
  weekDay: { ...type.cardTitle, fontWeight: "500", color: text.secondary },
  weekDayToday: { color: text.primary, fontWeight: "600" },
  weekCount: { ...type.caption, color: text.tertiary },

  firstRun: {
    marginTop: space.xl,
    padding: space.xl,
    borderRadius: radius.card,
    backgroundColor: accent.deep,
  },
  firstRunDisc: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: bg.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  firstRunTitle: { ...type.pageTitle, color: text.primary, marginTop: space.lg },
  firstRunBody: { ...type.supporting, color: text.primary, opacity: 0.78, marginTop: space.sm },
  firstRunButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: layout.controlHeight,
    borderRadius: radius.pill,
    backgroundColor: bg.canvas,
    marginTop: space.xl,
  },
  firstRunButtonText: { ...type.cardTitle, fontWeight: "700", color: text.primary },

  fabDock: {
    position: "absolute",
    right: layout.gutter,
    bottom: 0,
    alignItems: "flex-end",
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    ...elevation,
  },
  fabText: { ...type.cardTitle, fontWeight: "700", color: text.primary },
});
