import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View, type ScrollView } from "react-native";
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
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  BellIcon,
  BowlFoodIcon,
  ForkKnifeIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ClockCounterClockwiseIcon,
  HeartIcon,
  PawPrintIcon,
  PersonSimpleWalkIcon,
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
import { CareDog } from "@/features/care/components/CareDog";
import { CareSetupFlow } from "@/features/care/components/CareSetupFlow";
import { WeekStrip } from "@/features/care/components/WeekStrip";
import { TodayCareList } from "@/features/care/components/TodayCareList";
import { CheckInGate } from "@/features/care/components/CheckInGate";
import { DailyHealthCheckSheet } from "@/features/care/components/DailyHealthCheckSheet";
import { minutesOf } from "@/features/care/components/careSetupAnswers";
import { useCheckInHistory, useCheckInSettings, useTodayCheckIn, type Appetite } from "@/features/care/state/dailyCheckIn";
import { nowMinutes, useNow, useTodayCare, type TodayItem } from "@/features/care/components/todayCare";
import { prettyTime, type AreaKey } from "@/features/care/components/careSetupAnswers";
import { requestNotificationPermissions, syncCareReminders, syncCheckInReminders } from "@/services/notificationService";
import { PawsMark } from "@/features/welcome/components/PawsMark";
import { PressScale } from "@/components/ui/PressScale";
import { useCareRoutineCompletions, useCareRoutines } from "@/hooks/useCareEvents";
import { useCareProfile, useExerciseLogsBetween, useTodayExerciseLogs } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import {
  toggleReminder,
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

const greetingFor = (hour: number) =>
  hour < 12 ? "Good morning," : hour < 18 ? "Good afternoon," : "Good evening,";

const weekAround = (today: Date) => {
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};

export default function CareTabScreen() {
  const onboarding = useCareOnboarding();
  const [revealing, setRevealing] = useState(false);

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

  return <CareTab revealing={revealing} />;
}

function CareTab({ revealing }: { revealing: boolean }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";

  const today = useMemo(() => new Date(), []);
  const todayIso = isoDate(today);
  const week = useMemo(() => weekAround(today), [today]);

  const [selectedDay, setSelectedDay] = useState(today.getDay());
  const [scope, setScope] = useState<ActivityScope>("weekly");

  const routines = useCareRoutines(dogId);
  const completions = useCareRoutineCompletions(dogId, todayIso);
  const exercise = useTodayExerciseLogs(dogId);

  const doneIds = useMemo(
    () => new Set((completions.data ?? []).map((c) => c.routineId)),
    [completions.data],
  );

  const { choice } = useCareOnboarding();
  const areas = useCareAreas();
  const muted = useMutedReminders();
  const clock = useNow();
  const minuteNow = nowMinutes(clock);

  const routineItems = useTodayCare(routines.data, doneIds, choice);
  const checkIn = useCheckInSettings();
  const { entry: checkInEntry } = useTodayCheckIn();
  const todayItems = useMemo<TodayItem[]>(() => {
    if (!checkIn.enabled) return routineItems;
    const item: TodayItem = {
      key: "checkin",
      routineId: null,
      iconKey: "heartbeat",
      title: "Check-in",
      detail: checkInEntry ? "Answered today" : "About a minute",
      time: checkIn.time,
      done: Boolean(checkInEntry),
    };
    return [...routineItems, item].sort((a, b) =>
      a.time && b.time ? minutesOf(a.time) - minutesOf(b.time) : a.time ? -1 : b.time ? 1 : 0,
    );
  }, [routineItems, checkIn.enabled, checkIn.time, checkInEntry]);

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [firstAnswer, setFirstAnswer] = useState<Appetite | null>(null);
  const [laterThisVisit, setLaterThisVisit] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLaterThisVisit(false);
    }, []),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") setLaterThisVisit(false);
    });
    return () => sub.remove();
  }, []);
  const [setupArea, setSetupArea] = useState<AreaKey | null>(null);

  const activeToday = (exercise.data ?? []).length > 0;
  const fed = todayItems.some((item) => item.iconKey === "bowl-mix" && item.done);

  const reminderSignature = todayItems
    .filter((item) => item.key !== "checkin" && item.time && !muted.includes(item.key))
    .map((item) => `${item.key}@${item.time}`)
    .join("|");

  useEffect(() => {
    const reminders = todayItems
      .filter((item) => item.key !== "checkin" && item.time && !muted.includes(item.key))
      .map((item) => ({
        key: item.key,
        title: item.title,
        time: item.time as string,
        label: prettyTime(item.time as string),
      }));
    void syncCareReminders(reminders, dog.data?.name ?? "your dog").catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminderSignature, dog.data?.name]);

  const checkInHistory = useCheckInHistory();
  const answeredSignature = checkInHistory.map((entry) => entry.date).join("|");
  const checkInMuted = muted.includes("checkin");

  useEffect(() => {
    if (!checkIn.hydrated) return;
    void syncCheckInReminders({
      enabled: checkIn.enabled && !checkInMuted,
      time: checkIn.time,
      answeredDates: checkInHistory.map((entry) => entry.date),
      dogName: dog.data?.name ?? "your dog",
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn.hydrated, checkIn.enabled, checkIn.time, checkInMuted, answeredSignature, dog.data?.name]);

  const openSetup = (area: AreaKey) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSetupArea(area);
  };

  const onToggleReminder = (key: string, turningOn: boolean) => {
    toggleReminder(key);
    if (turningOn) void requestNotificationPermissions().catch(() => false);
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

  const heroStyle = useAnimatedStyle(() => ({
    height: heroHeight.value * (1 - open.value),
    opacity: 1 - Math.min(1, open.value * 1.7),
    transform: [{ translateY: -open.value * 12 }],
  }));

  const stripStyle = useAnimatedStyle(() => ({
    height: stripHeight.value * (1 - stripAway.value),
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
      const away = to === "health" || to === "feed" ? 1 : 0;
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
  const todayIndex = week.findIndex((d) => isoDate(d) === todayIso);

  const gateOn =
    checkIn.hydrated &&
    checkIn.enabled &&
    !checkInEntry &&
    minuteNow >= minutesOf(checkIn.time) &&
    !laterThisVisit &&
    !setupArea &&
    !(duty && !duty.deferred);

  const dimStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(gateOn ? 0.24 : 1, { duration: motion.duration.reveal, easing: motion.easing.out }),
    }),
    [gateOn],
  );

  const openCheckIn = (appetite: Appetite | null) => {
    setFirstAnswer(appetite);
    setCheckInOpen(true);
  };

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
          style={[styles.heroClip, heroMeasured && heroStyle]}
          pointerEvents={phase === "care" ? "auto" : "none"}
          onLayout={(e) => {
            if (heroMeasured) return;
            heroHeight.value = e.nativeEvent.layout.height;
            setHeroMeasured(true);
          }}
        >
          <Animated.View entering={enter(0)} style={styles.hero}>
            <View style={styles.heroCopy}>
              <Text style={styles.greeting}>{greetingFor(today.getHours())}</Text>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {dog.data?.name ?? "there"}!
                </Text>
                <HeartIcon size={iconSize.standard} color={accent.deep} weight="fill" />
              </View>
            </View>
            <CareDog art="walk" width={HERO_ART} />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[styles.stripClip, stripMeasured && stripStyle]}
          pointerEvents={detail === "health" && phase !== "care" ? "none" : "auto"}
        >
          <Animated.View
            entering={enter(1)}
            layout={settle}
            style={dimStyle}
            pointerEvents={gateOn ? "none" : "auto"}
            onLayout={(e) => {
              const height = e.nativeEvent.layout.height;
              if (height <= 0) return;
              stripHeight.value = height;
              if (!stripMeasured) setStripMeasured(true);
            }}
          >
            <WeekStrip
              days={week}
              selectedIndex={
                phase === "care"
                  ? todayIndex
                  : week.findIndex((d) => d.getDay() === selectedDay)
              }
              todayIndex={todayIndex}
              onSelect={(index) => {
                void Haptics.selectionAsync();
                setSelectedDay(week[index].getDay());
                setScope("daily");
                if (phase === "care") go("activity");
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
              {gateOn ? (
                <CheckInGate
                  dogName={dog.data?.name ?? "your dog"}
                  time={checkIn.time}
                  onAnswer={(appetite) => openCheckIn(appetite)}
                  onLater={() => setLaterThisVisit(true)}
                />
              ) : null}

              <Animated.View style={dimStyle} pointerEvents={gateOn ? "none" : "auto"}>
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

              {!appointment && duty?.deferred ? (
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
                  items={todayItems}
                  now={minuteNow}
                  nowLabel={prettyTime(
                    `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`,
                  )}
                  muted={muted}
                  reduceMotion={reduceMotion}
                  onToggleReminder={onToggleReminder}
                  onPressItem={(item) => {
                    if (item.key === "checkin" && !item.done) openCheckIn(null);
                  }}
                  startOrder={3}
                />
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
                  onOpenSchedule={() => router.push("/care/schedule")}
                  onStartWalk={() => router.push("/care/walk")}
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

      <DailyHealthCheckSheet
        open={checkInOpen}
        initialAppetite={firstAnswer}
        onClose={() => {
          setCheckInOpen(false);
          setLaterThisVisit(true);
        }}
      />

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

const HERO_ART = 148;

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

  heroClip: { overflow: "hidden" },
  hero: { flexDirection: "row", alignItems: "center", marginTop: space.lg },
  heroCopy: { flex: 1 },
  greeting: { ...type.supporting, color: text.secondary },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { ...type.hero, color: text.primary, flexShrink: 1 },

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
