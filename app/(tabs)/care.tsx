import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, type ScrollView } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  SlideInRight,
  SlideOutRight,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  CameraIcon,
  CheckCircleIcon,
  FirstAidKitIcon,
  HeartbeatIcon,
  ScissorsIcon,
  SyringeIcon,
  BowlFoodIcon,
  ForkKnifeIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ClockCounterClockwiseIcon,
  HeartIcon,
  PersonSimpleWalkIcon,
  BugIcon,
  ToothIcon,
  StethoscopeIcon,
  PlusIcon,
} from "phosphor-react-native";

import { ActivityView, type ActivityScope } from "@/features/care/components/ActivityView";
import { FeedView } from "@/features/care/components/FeedView";
import { HealthView } from "@/features/care/components/HealthView";
import { buildActivityWeek, isoDay } from "@/features/care/components/activityData";
import { useHealthOverview } from "@/hooks/useHealthOverview";
import { AppointmentCard } from "@/features/care/components/AppointmentCard";
import { VaccineDueCard } from "@/features/care/components/VaccineDueCard";
import { VaccineGate } from "@/features/care/components/VaccineGate";
import { CareSetupFlow } from "@/features/care/components/CareSetupFlow";
import { CareCalendar, dayKeyOf, type MarkKind } from "@/features/care/components/CareCalendar";
import { CareAgenda, type AgendaEvent } from "@/features/care/components/CareAgenda";
import { FocusCard, type Focus } from "@/features/care/components/FocusCard";
import { untilLabel } from "@/features/care/components/todayCare";
import { useGroomingLogs, useVaccinations } from "@/hooks/useCareHealth";
import { isRoutine, occursOn, repeatLabel, usePlannedWalks } from "@/features/care/state/plannedWalks";
import { TodayCareList } from "@/features/care/components/TodayCareList";
import { requestCheckIn } from "@/features/care/components/CheckInLock";
import { CARE_LABEL, MOBILITY_NOUN, dueFor, kindsFor } from "@/features/care/intel/careIntel";
import { useCareIntel } from "@/features/care/intel/useCareIntel";
import { minutesOf } from "@/features/care/components/careSetupAnswers";
import type { Appetite } from "@/features/care/state/dailyCheckIn";
import { nowMinutes, useNow } from "@/features/care/components/todayCare";
import { prettyTime, type AreaKey } from "@/features/care/components/careSetupAnswers";
import { syncCareReminders } from "@/services/notificationService";
import { KeepingUp, useKeepingUpNews } from "@/features/care/components/KeepingUp";
import { useCareDay } from "@/features/care/state/useCareDay";
import { NewsPager, type NewsPage } from "@/features/care/components/NewsPager";
import { CareLocked, useCareLocked } from "@/features/care/components/CareLocked";
import { PawsMark } from "@/features/welcome/components/PawsMark";
import { PressScale } from "@/components/ui/PressScale";
import { useCareProfile, useExerciseLogsBetween, useTodayExerciseLogs } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import {
  useCareAppointment,
  useCareAreas,
  useCareOnboarding,
  useMutedReminders,
  useVaccineDuty,
} from "@/features/care/state/careOnboarding";
import {
  accent,
  bg,
  border,
  icon as iconSize,
  layout,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

const TAB_CLEARANCE = 116;
const SCROLL_LEAD = 260;

type Phase = "care" | "sweeping" | "detail";
type Detail = "activity" | "health" | "feed";

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const weekAround = (today: Date) => {
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};

/** The one red on Care home: the first-aid icon, so it is findable at a glance without shouting. */
const SOS = "#C2412D";

export default function CareTabScreen() {
  const onboarding = useCareOnboarding();
  const [revealing, setRevealing] = useState(false);
  const locked = useCareLocked();
  const dog = useCurrentDog();

  // Unlocking plays the same reveal as finishing setup, so Care visibly opens back up.
  const wasLocked = useRef(locked);
  useEffect(() => {
    if (wasLocked.current && !locked) {
      setRevealing(true);
      const id = setTimeout(() => setRevealing(false), motion.duration.reveal);
      wasLocked.current = locked;
      return () => clearTimeout(id);
    }
    wasLocked.current = locked;
    return undefined;
  }, [locked]);

  if (!onboarding.hydrated) return <View style={styles.screen} />;

  if (!onboarding.completed) {
    return (
      <CareSetupFlow
        bottomInset={TAB_CLEARANCE - 40}
        onDone={() => {
          setRevealing(true);
          setTimeout(() => setRevealing(false), motion.duration.reveal);
        }}
      />
    );
  }

  // A missed check-in shuts Care until it is caught up.
  if (locked) return <CareLocked name={dog.data?.name ?? "your dog"} bottomInset={TAB_CLEARANCE} />;

  // The first frame after unlocking already counts as revealing, so CareTab mounts with its entrance.
  return <CareTab revealing={revealing || wasLocked.current} />;
}

function CareTab({ revealing }: { revealing: boolean }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";

  // Follows the clock across midnight: a tab left open overnight must move to the new day (and the new week).
  const clock = useNow();
  const dayStamp = isoDate(clock);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const today = useMemo(() => new Date(), [dayStamp]);
  const todayIso = isoDate(today);
  const week = useMemo(() => weekAround(today), [today]);

  const [selectedDay, setSelectedDay] = useState(today.getDay());
  const [scope, setScope] = useState<ActivityScope>("weekly");

  const exercise = useTodayExerciseLogs(dogId);
  const areas = useCareAreas();
  const muted = useMutedReminders();
  const minuteNow = nowMinutes(clock);

  // The same list the schedule shows: routines, walks, meals, medicine and the check-in, with what is done.
  const { choice, checkIn, checkInEntry, todayItems, items: listItems, toggle: onToggleItem } = useCareDay(dogId, todayIso);

  const [setupArea, setSetupArea] = useState<AreaKey | null>(null);

  const activeToday = (exercise.data ?? []).length > 0;
  const fed = listItems.some((item) => item.iconKey === "bowl-mix" && item.done);

  const reminderSignature = listItems
    .filter((item) => item.key !== "checkin" && item.time && !item.done && !muted.includes(item.key))
    .map((item) => `${item.key}@${item.time}`)
    .join("|");

  useEffect(() => {
    const reminders = listItems
      .filter((item) => item.key !== "checkin" && item.time && !item.done && !muted.includes(item.key))
      .map((item) => ({
        key: item.key,
        title: item.title,
        time: item.time as string,
        label: prettyTime(item.time as string),
      }));
    void syncCareReminders(reminders, dog.data?.name ?? "your dog").catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminderSignature, dog.data?.name]);

  const openSetup = (area: AreaKey) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSetupArea(area);
  };

  const [phase, setPhase] = useState<Phase>("care");
  const [detail, setDetail] = useState<Detail>("activity");
  const [target, setTarget] = useState<"care" | "detail">("care");
  const [heroMeasured, setHeroMeasured] = useState(false);
  const [stripMeasured, setStripMeasured] = useState(false);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const open = useSharedValue(0);
  const heroHeight = useSharedValue(0);
  const stripAway = useSharedValue(0);
  const stripHeight = useSharedValue(0);

  // At rest the brief sizes itself (it changes through the day); only while sweeping away does it take a set height.
  const heroStyle = useAnimatedStyle(() => ({
    height: heroHeight.value * (1 - open.value),
    opacity: 1 - Math.min(1, open.value * 1.7),
    transform: [{ translateY: -open.value * 12 }],
  }));

  const stripStyle = useAnimatedStyle(() => ({
    // At rest the calendar folds open freely; only the sweep away needs a fixed height to collapse from.
    maxHeight: stripAway.value === 0 ? 100000 : stripHeight.value * (1 - stripAway.value),
    opacity: 1 - Math.min(1, stripAway.value * 1.7),
    transform: [{ translateY: -stripAway.value * 10 }],
  }));

  const careStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - open.value / 0.55),
    transform: [{ translateX: -open.value * 72 }],
  }));

  const activityStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, (open.value - 0.3) / 0.7),
    transform: [{ translateX: (1 - open.value) * 32 }],
  }));

  const go = (to: "care" | Detail) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const travelling = !reduceMotion && scrollY.value > 4;
    if (travelling) {
      (scrollRef.current as unknown as ScrollView | null)?.scrollTo({ y: 0, animated: true });
    }

    const begin = () => {
      const toDetail = to !== "care";
      if (toDetail) setDetail(to);
      setTarget(toDetail ? "detail" : "care");
      setPhase("sweeping");

      const timing = { duration: motion.duration.reveal, easing: motion.easing.out };
      open.value = reduceMotion ? (toDetail ? 1 : 0) : withTiming(toDetail ? 1 : 0, timing);
      // Every detail (Activity included) has its own date controls, so the week strip steps aside.
      const away = to === "care" ? 0 : 1;
      stripAway.value = reduceMotion ? away : withTiming(away, timing);

      timers.current.push(
        setTimeout(
          () => setPhase(toDetail ? "detail" : "care"),
          reduceMotion ? 0 : motion.duration.reveal,
        ),
      );
    };

    if (travelling) timers.current.push(setTimeout(begin, SCROLL_LEAD));
    else begin();
  };

  const enter = (order: number) =>
    reduceMotion ? undefined : FadeInDown.duration(motion.duration.enter).delay(order * motion.stagger);

  const fade = reduceMotion ? undefined : FadeIn.duration(motion.duration.select);
  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.select);

  const appointment = useCareAppointment();
  const duty = useVaccineDuty();
  const [unreachable, setUnreachable] = useState<string | null>(null);
  const overview = useHealthOverview(dogId);
  const weekLogs = useExerciseLogsBetween(dogId, isoDay(week[0]), isoDay(week[week.length - 1]));
  const careProfile = useCareProfile(dogId);
  const activity = useMemo(
    () => buildActivityWeek(week, weekLogs.data ?? [], today),
    [week, weekLogs.data, today],
  );
  const goalMinutes =
    careProfile.data?.dailyExerciseGoalMinutes ?? choice?.exerciseMinutes ?? 60;
  const todayKey = dayKeyOf(clock);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calDay, setCalDay] = useState(todayKey);
  const plannedWalks = usePlannedWalks();
  const intel = useCareIntel();
  const vaccinations = useVaccinations(dogId);
  const grooming = useGroomingLogs(dogId);
  const dogName = dog.data?.name ?? "your dog";

  // This week's rings: minutes walked each day against the daily goal, up to today.
  const rings = useMemo(() => {
    const map = new Map<string, { progress: number }>();
    activity.days.forEach((day) => {
      const key = dayKeyOf(day.date);
      if (key <= todayKey) map.set(key, { progress: goalMinutes > 0 ? day.minutes / goalMinutes : 0 });
    });
    return map;
  }, [activity.days, goalMinutes, todayKey]);

  // Everything with a date that a guardian would want on a calendar.
  const agenda = useMemo<AgendaEvent[]>(() => {
    const events: AgendaEvent[] = [];
    const walkEvent = (walk: (typeof plannedWalks)[number], dayKey: string, routine: boolean): AgendaEvent => ({
      id: routine ? `walk-${walk.id}-${dayKey}` : `walk-${walk.id}`,
      dayKey,
      time: walk.time,
      kind: "walk",
      routine,
      title: `${walk.route?.kind === "free" ? "Free walk" : "Walk"}, ${walk.minutes} min`,
      detail: `${routine ? `${repeatLabel(walk.repeat!)} · ` : ""}${prettyTime(walk.time)}${walk.route && walk.route.kind !== "free" ? ` · ${walk.route.name}` : ""}`,
      Glyph: PersonSimpleWalkIcon,
      onPress: () => router.push(`/care/plan-walk?plan=${walk.id}` as never),
    });
    // Repeating walks land on every day they repeat, from last week to three months out.
    const window = Array.from({ length: 98 }, (_, i) => dayKeyOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7 + i)));
    plannedWalks.forEach((walk) => {
      if (!isRoutine(walk)) events.push(walkEvent(walk, walk.dayKey, false));
      else window.filter((key) => occursOn(walk, key)).forEach((key) => events.push(walkEvent(walk, key, true)));
    });
    // Preventive doses and checks that have a next date.
    (["parasites", "exams", "dental"] as const).forEach((area) =>
      kindsFor(area, intel.stage).forEach((careKind) => {
        const due = dueFor(careKind, intel.log, intel.stage, intel.today);
        if (!due.next || due.kind === "brushing") return;
        events.push({
          id: `care-${careKind}`,
          dayKey: due.next < intel.today ? intel.today : due.next,
          kind: "health",
          title: `${CARE_LABEL[careKind]} ${area === "parasites" ? "dose" : "due"}`,
          detail: due.next < intel.today ? "Overdue" : area === "parasites" ? "Prevention" : "Check-up",
          Glyph: area === "parasites" ? BugIcon : StethoscopeIcon,
          onPress: () => router.push(`/care/log-care?kind=${careKind}` as never),
        });
      }),
    );
    if (appointment) {
      events.push({
        id: "vet",
        dayKey: appointment.dayKey,
        time: appointment.time,
        kind: "vet",
        title: "Vet visit",
        detail: `${prettyTime(appointment.time)} · ${appointment.clinic}`,
        Glyph: FirstAidKitIcon,
      });
    }
    const latestVaccine = new Map<string, NonNullable<typeof vaccinations.data>[number]>();
    (vaccinations.data ?? []).forEach((shot) => {
      const seen = latestVaccine.get(shot.vaccineKey);
      if (!seen || shot.dateGiven > seen.dateGiven) latestVaccine.set(shot.vaccineKey, shot);
    });
    latestVaccine.forEach((shot) => {
      if (!shot.nextDueDate) return;
      events.push({
        id: `vaccine-${shot.vaccineKey}`,
        dayKey: shot.nextDueDate,
        kind: "health",
        title: `${shot.vaccineName} due`,
        detail: "Vaccine",
        Glyph: SyringeIcon,
        onPress: () => router.push("/care/vaccinations" as never),
      });
    });
    const latestGroom = new Map<string, NonNullable<typeof grooming.data>[number]>();
    (grooming.data ?? []).forEach((log) => {
      const seen = latestGroom.get(log.groomingType);
      if (!seen || log.doneDate > seen.doneDate) latestGroom.set(log.groomingType, log);
    });
    latestGroom.forEach((log) => {
      if (!log.nextDueDate) return;
      events.push({
        id: `groom-${log.groomingType}`,
        dayKey: log.nextDueDate,
        title: `${log.groomingType.charAt(0).toUpperCase()}${log.groomingType.slice(1).replace(/_/g, " ")}`,
        kind: "grooming",
        detail: "Grooming",
        Glyph: ScissorsIcon,
      });
    });
    if (duty) {
      events.push({
        id: "to-book",
        dayKey: null,
        kind: "vet",
        title: `${duty.label} to book`,
        detail: "Core vaccines. Find a vet",
        Glyph: SyringeIcon,
        onPress: () => router.push("/care/find-vet"),
      });
    }
    return events;
  }, [plannedWalks, appointment, vaccinations.data, grooming.data, duty, intel, today]);
  const planMarks = useMemo(() => {
    const map = new Map<string, MarkKind[]>();
    agenda.forEach((event) => {
      if (!event.dayKey) return;
      const kinds = map.get(event.dayKey) ?? [];
      if (!kinds.includes(event.kind)) map.set(event.dayKey, [...kinds, event.kind]);
    });
    return map;
  }, [agenda]);
  const dailyNote = useMemo(() => {
    const walks = todayItems.filter((item) => item.iconKey === "walk").length;
    const meals = todayItems.filter((item) => item.iconKey === "bowl-mix").length;
    const parts = [
      walks ? `${walks} ${walks === 1 ? "walk" : "walks"}` : null,
      meals ? `${meals} ${meals === 1 ? "meal" : "meals"}` : null,
      checkIn.enabled ? "a check-in" : null,
    ].filter(Boolean) as string[];
    return parts.length ? parts.join(parts.length > 2 ? ", " : " and ").replace(/, ([^,]*)$/, " and $1") : null;
  }, [todayItems, checkIn.enabled]);


  // The single most important thing right now, in priority order.
  // Everything worth knowing right now, most important first. The first is the hero; the rest are a swipe away.
  const news = useMemo<Focus[]>(() => {
    const out: Focus[] = [];
    const open = listItems.filter((item) => !item.done && item.key !== "checkin");
    const lateItems = open.filter((item) => item.time && minutesOf(item.time) < minuteNow - 30);
    const next = open.find((item) => item.time && minutesOf(item.time) >= minuteNow);
    if (appointment && appointment.dayKey === todayKey) {
      out.push({ key: "vet", eyebrow: "VET TODAY", title: `${appointment.clinic}`, detail: `At ${prettyTime(appointment.time)}`, Glyph: FirstAidKitIcon });
    }
    if (checkIn.enabled && !checkInEntry && minuteNow >= minutesOf(checkIn.time)) {
      out.push({
        key: "checkin",
        eyebrow: "MOST IMPORTANT",
        title: `Check in on ${dogName}`,
        detail: "About a minute",
        Glyph: HeartbeatIcon,
        action: { label: "Answer", run: () => openCheckIn(null) },
      });
    }
    // Movement that has not settled: Activity shows the trend, Care home raises it.
    if (intel.mobility.status === "concern") {
      const streak = intel.mobility.streak;
      out.push({
        key: "mobility",
        eyebrow: "WORTH A LOOK",
        title: streak && streak.days >= 3 ? `${dogName} has had ${MOBILITY_NOUN[streak.sign]} for ${streak.days} days` : `${dogName} has limped more than once`,
        detail: "Worth a word with the vet",
        Glyph: PersonSimpleWalkIcon,
        action: { label: "Book a visit", run: () => router.push("/care/book-visit") },
      });
    }
    if (duty) {
      out.push({
        key: "vaccines",
        eyebrow: "VACCINES",
        title: `Book ${duty.label}`,
        detail: `Keeps ${dogName} protected`,
        Glyph: SyringeIcon,
        action: { label: "Find a vet", run: () => router.push("/care/find-vet") },
      });
    }
    // Preventive care that has come due (a dose, an exam, a cleaning), from the care log and life stage.
    (["parasites", "exams", "dental"] as const)
      .flatMap((area) => kindsFor(area, intel.stage).map((kind) => ({ area, due: dueFor(kind, intel.log, intel.stage, intel.today) })))
      .filter(({ due }) => due.status === "due" && due.kind !== "brushing")
      .slice(0, 2)
      .forEach((overdue) => {
        const senior = intel.stage === "senior" && overdue.due.kind === "wellness_exam";
        out.push({
          key: `care-${overdue.due.kind}`,
          eyebrow: "DUE",
          title: senior ? `${dogName}'s senior wellness exam is due` : `${CARE_LABEL[overdue.due.kind]} is due`,
          detail: `Last done ${overdue.due.last ? new Date(`${overdue.due.last}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "a while ago"}`,
          Glyph: overdue.area === "parasites" ? BugIcon : overdue.area === "dental" ? ToothIcon : StethoscopeIcon,
          action: { label: "Open", run: () => router.push(`/care/preventive?area=${overdue.area}` as never) },
        });
      });
    lateItems.slice(0, 2).forEach((late) =>
      out.push({
        key: `late-${late.key}`,
        eyebrow: `WAS DUE AT ${prettyTime(late.time!).toUpperCase()}`,
        title: late.title,
        detail: late.detail,
        Glyph: late.iconKey === "walk" ? PersonSimpleWalkIcon : late.iconKey === "bowl-mix" ? BowlFoodIcon : CheckCircleIcon,
        action: late.iconKey === "walk"
          ? { label: "Start walk", run: () => router.push("/care/plan-walk?mode=now" as never) }
          : { label: "Mark done", run: () => onToggleItem(late) },
      }),
    );
    if (next) {
      out.push({
        key: `next-${next.key}`,
        eyebrow: `NEXT · ${untilLabel(next.time!, minuteNow).toUpperCase()}`,
        title: next.title,
        detail: `${prettyTime(next.time!)} · ${next.detail}`,
        Glyph: next.iconKey === "walk" ? PersonSimpleWalkIcon : next.iconKey === "bowl-mix" ? BowlFoodIcon : CheckCircleIcon,
        action: next.iconKey === "walk" ? { label: "Start walk", run: () => router.push("/care/plan-walk?mode=now" as never) } : undefined,
      });
    }
    if (!out.length && listItems.length && open.length === 0) {
      out.push({ key: "done", eyebrow: "TODAY", title: "All done for today", detail: `${dogName} is well looked after.`, Glyph: CheckCircleIcon });
    }
    if (!out.length) {
      out.push({
        key: "start",
        eyebrow: "TODAY",
        title: `Plan ${dogName}'s next walk`,
        detail: "Pick a time and a route",
        Glyph: PersonSimpleWalkIcon,
        action: { label: "Plan a walk", run: () => router.push("/care/plan-walk" as never) },
      });
    }
    // The first card is always called the most important.
    out[0] = { ...out[0], eyebrow: out[0].key.startsWith("late-") || out[0].key.startsWith("next-") || out[0].key === "vet" ? out[0].eyebrow : "MOST IMPORTANT" };
    return out.slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listItems, minuteNow, appointment, todayKey, checkIn.enabled, checkIn.time, checkInEntry, duty, dogName, intel]);
  const focus = news[0];
  const keepingUp = useKeepingUpNews();
  // The check-in record sits second: right after the one thing to do now, before the rest of the news.
  const pages = useMemo<NewsPage[]>(() => {
    const cards: NewsPage[] = news.map((item) => ({
      key: item.key,
      label: `${item.eyebrow}. ${item.title}`,
      node: <FocusCard focus={item} reduceMotion={reduceMotion} art={false} />,
    }));
    if (keepingUp) cards.splice(1, 0, { key: "keeping-up", label: keepingUp.label, alert: keepingUp.alert, node: <KeepingUp name={dogName} /> });
    return cards;
  }, [news, keepingUp?.label, keepingUp?.alert, dogName, reduceMotion]);

  // The check-in is one full-screen flow wherever it is opened from.
  const openCheckIn = (_appetite: Appetite | null) => requestCheckIn();

  return (
    <Animated.View
      style={styles.screen}
      entering={
        reduceMotion || !revealing
          ? undefined
          : FadeIn.duration(motion.duration.reveal).withInitialValues({
              opacity: 0,
              transform: [{ translateY: 24 }, { scale: 0.97 }],
            })
      }
    >
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={(e) => {
          scrollY.value = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.sm, paddingBottom: TAB_CLEARANCE + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {phase === "care" ? (
            <Animated.View key="care" entering={fade} style={styles.headerRow}>
              <PawsMark />
              <View style={styles.headerActions}>
                {/* Emergency is one tap from Care home: in a crisis nobody should have to look for it. */}
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel="Emergency and first aid"
                  style={styles.roundButton}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push("/care/emergency" as never);
                  }}
                >
                  <FirstAidKitIcon size={iconSize.nav} color={SOS} weight="fill" />
                </PressScale>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel="Start a walk"
                  style={styles.roundButton}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push("/care/plan-walk?mode=now" as never);
                  }}
                >
                  <PersonSimpleWalkIcon size={iconSize.nav} color={text.primary} weight="regular" />
                </PressScale>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel="Check a food with a photo"
                  style={styles.roundButton}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push("/care/food-check?start=camera" as never);
                  }}
                >
                  <CameraIcon size={iconSize.nav} color={text.primary} weight="regular" />
                </PressScale>
              </View>
            </Animated.View>
          ) : (
            <Animated.View key="activity" entering={fade} style={styles.headerRow}>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Back to care"
                style={styles.roundButton}
                onPress={() => go("care")}
              >
                <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
              </PressScale>

              <View style={styles.headerTitleWrap}>
                {detail === "health" ? (
                  <HeartIcon size={iconSize.standard} color={accent.deep} weight="fill" />
                ) : detail === "feed" ? (
                  <ForkKnifeIcon size={iconSize.standard} color={accent.deep} weight="fill" />
                ) : (
                  <PersonSimpleWalkIcon
                    size={iconSize.standard}
                    color={accent.deep}
                    weight="fill"
                  />
                )}
                <Text style={styles.headerTitle}>
                  {detail === "health" ? "Health" : detail === "feed" ? "Feed" : "Activity"}
                </Text>
              </View>

              <PressScale
                accessibilityRole="button"
                accessibilityLabel={
                  detail === "health"
                    ? "Health records"
                    : detail === "feed"
                      ? "Food checks"
                      : "Exercise history"
                }
                style={styles.roundButton}
                onPress={() =>
                  router.push(
                    detail === "health"
                      ? "/profile/health"
                      : detail === "feed"
                        ? "/care/food-check"
                        : "/care/exercise",
                  )
                }
              >
                <ClockCounterClockwiseIcon
                  size={iconSize.nav}
                  color={text.primary}
                  weight="regular"
                />
              </PressScale>
            </Animated.View>
          )}
        </View>

        <Animated.View
          // Only the sweep uses a set height; at rest the card sizes itself, so it can never get stuck squashed.
          style={[styles.heroClip, heroMeasured && phase !== "care" && heroStyle]}
          pointerEvents={phase === "care" ? "auto" : "none"}
          onLayout={(e) => {
            if (heroMeasured) return;
            heroHeight.value = e.nativeEvent.layout.height;
            setHeroMeasured(true);
          }}
        >
          <Animated.View
            entering={enter(0)}
            style={styles.hero}
            onLayout={(e) => {
              // The brief grows and shrinks with the day, so keep the collapsing clip in step with it. Measure only at
              // rest: mid-sweep the clip is shorter than the card and would teach it a squashed height.
              const height = e.nativeEvent.layout.height;
              if (height > 0 && open.value === 0) heroHeight.value = height;
            }}
          >
            <NewsPager pages={pages} />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[styles.stripClip, stripMeasured && stripStyle]}
          pointerEvents={detail === "health" && phase !== "care" ? "none" : "auto"}
        >
          <Animated.View
            entering={enter(1)}
            layout={settle}

            onLayout={(e) => {
              const height = e.nativeEvent.layout.height;
              if (height <= 0 || stripAway.value !== 0) return;
              stripHeight.value = height;
              if (!stripMeasured) setStripMeasured(true);
            }}
          >
            <CareCalendar
              today={clock}
              open={calendarOpen && phase === "care"}
              selectedKey={
                phase !== "care"
                  ? dayKeyOf(week.find((d) => d.getDay() === selectedDay) ?? today)
                  : calendarOpen
                    ? calDay
                    : todayKey
              }
              rings={rings}
              marks={planMarks}
              onToggle={(next) => {
                if (phase !== "care") return;
                setCalDay(todayKey);
                setCalendarOpen(next);
              }}
              onSelect={(date) => {
                const key = dayKeyOf(date);
                const inWeek = week.some((d) => dayKeyOf(d) === key);
                if (phase === "care" && calendarOpen) {
                  setCalDay(key);
                  return;
                }
                // This week up to today opens that day's walking; a later day opens the calendar on it.
                if (inWeek && key <= todayKey) {
                  setSelectedDay(date.getDay());
                  setScope("daily");
                  if (phase === "care") go("activity");
                  return;
                }
                if (phase !== "care") return;
                setCalDay(key);
                setCalendarOpen(true);
              }}
            />
          </Animated.View>
        </Animated.View>

        <View style={styles.panel}>
          {phase !== "detail" ? (
            <Animated.View
              style={[phase === "sweeping" && target === "detail" && styles.leaving, careStyle]}
              pointerEvents={phase === "care" ? "auto" : "none"}
            >

              <Animated.View>
              {calendarOpen ? (
                <Animated.View key="agenda" entering={fade} style={styles.agenda}>
                  <CareAgenda
                    selectedKey={calDay}
                    todayKey={todayKey}
                    events={agenda}
                    dailyNote={dailyNote}
                    reduceMotion={reduceMotion}
                    onPlanWalk={(key) => router.push(`/care/plan-walk?day=${key}` as never)}
                  />
                </Animated.View>
              ) : (
              <Animated.View key="today" entering={fade}>
              <SectionHead title="Health snapshot" />
              <View style={styles.tiles}>
                <Tile
                  glyph={<HeartIcon size={iconSize.feature} color={text.primary} weight="regular" />}
                  label="Overall"
                  value={overview.needs === 0 ? "On track" : `${overview.needs} to do`}
                  unset={!areas.includes("vaccines")}
                  hint="Check-ins, medication and vaccines"
                  setupHint="Set up vaccinations"
                  onPress={() => (areas.includes("vaccines") ? go("health") : openSetup("vaccines"))}
                />
                <Tile
                  glyph={
                    <PersonSimpleWalkIcon
                      size={iconSize.feature}
                      color={text.primary}
                      weight="regular"
                    />
                  }
                  label="Active today"
                  value={activeToday ? "Yes" : "Not yet"}
                  unset={!areas.includes("walks")}
                  hint="Opens the week's walking"
                  setupHint="Set up walks"
                  onPress={() => {
                    if (!areas.includes("walks")) {
                      openSetup("walks");
                      return;
                    }
                    setScope("weekly");
                    go("activity");
                  }}
                />
                <Tile
                  glyph={
                    <BowlFoodIcon size={iconSize.feature} color={text.primary} weight="regular" />
                  }
                  label="Nutrition"
                  value={fed ? "On track" : "Due"}
                  unset={!areas.includes("meals")}
                  hint="Opens today's feeding"
                  setupHint="Set up meals"
                  onPress={() => (areas.includes("meals") ? go("feed") : openSetup("meals"))}
                />
              </View>

              {!appointment && duty?.deferred && focus.key !== "vaccines" ? (
                <View style={styles.appointment}>
                  <VaccineDueCard
                    duty={duty}
                    reduceMotion={reduceMotion}
                    onPress={() => router.push("/care/find-vet")}
                  />
                </View>
              ) : null}

              {appointment ? (
                <View style={styles.appointment}>
                  <AppointmentCard
                    appointment={appointment}
                    reduceMotion={reduceMotion}
                    onUnreachable={setUnreachable}
                  />
                  {unreachable ? (
                    <Text style={styles.appointmentNote}>{unreachable}</Text>
                  ) : null}
                </View>
              ) : null}

              <SectionHead
                title="Today's care"
                action="View schedule"
                onAction={() => router.push("/care/schedule")}
              />

              {todayItems.length === 0 ? (
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel="Add walks to today's care"
                  style={styles.empty}
                  onPress={() => openSetup("walks")}
                >
                  <View style={styles.emptyDisc}>
                    <PlusIcon size={iconSize.standard} color={text.primary} weight="bold" />
                  </View>
                  <Text style={styles.emptyText}>Nothing timed yet. Add a walk to start the day.</Text>
                </PressScale>
              ) : (
                <TodayCareList
                  items={listItems}
                  now={minuteNow}
                  reduceMotion={reduceMotion}
                  onToggle={onToggleItem}
                  onOpen={(item) => {
                    if (item.key === "checkin") openCheckIn(null);
                    else if (item.iconKey === "walk") router.push("/care/plan-walk?mode=now" as never);
                  }}
                />
              )}
              </Animated.View>
              )}
              </Animated.View>
            </Animated.View>
          ) : null}

          {phase !== "care" ? (
            <Animated.View
              style={[phase === "sweeping" && target === "care" && styles.leaving, activityStyle]}
              pointerEvents={phase === "detail" ? "auto" : "none"}
            >
              {detail === "feed" ? (
                <FeedView dogId={dogId} onOpen={(href) => router.push(href as never)} />
              ) : detail === "health" ? (
                <HealthView
                  dogId={dogId}
                  week={week}
                  onOpen={(href) => router.push(href as never)}
                  onSetUpGrooming={() => openSetup("grooming")}
                />
              ) : (
                <ActivityView
                  activity={activity}
                  goalMinutes={goalMinutes}
                  week={week}
                  selectedDay={selectedDay}
                  scope={scope}
                  onScope={setScope}
                  onSelectDay={(dayIndex) => {
                    setSelectedDay(dayIndex);
                    setScope("daily");
                  }}
                  onStartWalk={() => router.push("/care/plan-walk?mode=now" as never)}
                />
              )}
            </Animated.View>
          ) : null}
        </View>
      </Animated.ScrollView>

      {setupArea ? (
        <Animated.View
          style={styles.setupSheet}
          entering={
            reduceMotion
              ? FadeIn.duration(motion.duration.select)
              : SlideInRight.duration(motion.duration.reveal).easing(motion.easing.drawer)
          }
          exiting={
            reduceMotion
              ? FadeOut.duration(motion.duration.exit)
              : SlideOutRight.duration(220).easing(motion.easing.out)
          }
        >
          <CareSetupFlow
            only={setupArea}
            bottomInset={TAB_CLEARANCE - 40}
            onClose={() => setSetupArea(null)}
            onDone={() => setSetupArea(null)}
          />
        </Animated.View>
      ) : null}


      {duty && !duty.deferred && !setupArea ? (
        <VaccineGate
          duty={duty}
          reduceMotion={reduceMotion}
          onFindVet={() => router.push("/care/find-vet")}
        />
      ) : null}
    </Animated.View>
  );
}

const SectionHead = ({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) => (
  <View style={styles.sectionHead}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {action && onAction ? (
      <PressScale accessibilityRole="button" accessibilityLabel={action} onPress={onAction}>
        <View style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{action}</Text>
          <CaretRightIcon size={iconSize.inline} color={text.secondary} weight="bold" />
        </View>
      </PressScale>
    ) : null}
  </View>
);

const Tile = ({
  glyph,
  label,
  value,
  hint,
  unset = false,
  setupHint,
  onPress,
}: {
  glyph: ReactNode;
  label: string;
  value: string;
  hint: string;
  unset?: boolean;
  setupHint?: string;
  onPress: () => void;
}) => (
  <PressScale
    accessibilityRole="button"
    accessibilityLabel={unset ? `${label}: not set up. ${setupHint ?? ""}` : `${label}: ${value}. ${hint}`}
    scaleTo={0.96}
    style={[styles.tile, unset && styles.tileUnset]}
    onPress={onPress}
  >
    <View style={[styles.tileDisc, unset && styles.tileDiscUnset]}>
      {glyph}
      {unset ? (
        <View style={styles.tileBadge}>
          <PlusIcon size={10} color={text.primary} weight="bold" />
        </View>
      ) : null}
    </View>
    <Text style={styles.tileLabel} numberOfLines={1}>
      {label}
    </Text>
    <Animated.Text key={unset ? "unset" : value} entering={FadeIn.duration(motion.duration.select)} style={styles.tileValue} numberOfLines={1}>
      {unset ? "Set up" : value}
    </Animated.Text>
  </PressScale>
);


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  content: { paddingHorizontal: layout.gutter },

  header: { minHeight: layout.iconButton, justifyContent: "center" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerActions: { flexDirection: "row", gap: space.sm },
  headerTitleWrap: { flexDirection: "row", alignItems: "center", gap: space.sm },
  headerTitle: { ...type.sectionTitle, color: text.primary },
  roundButton: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
    justifyContent: "center",
  },

  agenda: { marginTop: space.lg },
  heroClip: { overflow: "hidden" },
  hero: { paddingTop: space.lg, flexShrink: 0 },

  stripClip: { overflow: "hidden" },

  panel: { minHeight: 420 },
  leaving: { position: "absolute", left: 0, right: 0, top: 0 },

  appointment: { marginTop: space.section, gap: space.sm },
  appointmentNote: { ...type.caption, color: text.secondary },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.section,
    marginBottom: space.lg,
  },
  sectionTitle: { ...type.sectionTitle, color: text.primary },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  sectionActionText: { ...type.supporting, color: text.secondary },

  tiles: { flexDirection: "row", gap: space.md },
  tile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: space.lg,
    paddingHorizontal: space.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
  },
  tileDisc: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  tileUnset: { borderStyle: "dashed", borderColor: border.strong },
  tileDiscUnset: { backgroundColor: bg.subtle },
  tileBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: bg.canvas,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: { ...type.caption, color: text.tertiary, marginTop: space.md },
  tileValue: { ...type.cardTitle, fontWeight: "600", color: text.primary, marginTop: 2 },

  empty: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: border.strong,
  },
  emptyDisc: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { ...type.supporting, color: text.secondary, flex: 1 },

  setupSheet: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: bg.canvas },
});
