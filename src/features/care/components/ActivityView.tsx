import { memo, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { CalendarBlankIcon } from "phosphor-react-native";

import { HourBars } from "@/features/care/components/HourBars";
import { StepRing } from "@/features/care/components/StepRing";
import { PEEK_WIDTH, PeekDog } from "@/features/care/components/PeekDog";
import { WalkPlanner } from "@/features/care/components/WalkPlanner";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { WalkStack } from "@/features/care/components/WalkStack";
import { WeekStack } from "@/features/care/components/WeekStack";
import {
  asDuration,
  asKm,
  isoDay,
  paceOf,
  type ActivityWeek,
} from "@/features/care/components/activityData";
import { CountUp } from "@/features/profile/components/CountUp";
import { PressScale } from "@/components/ui/PressScale";
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

export type ActivityScope = "daily" | "weekly";

const SCOPES: readonly { key: ActivityScope; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
];

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const shortDate = (d: Date) => `${d.getDate()} ${MONTH[d.getMonth()]}`;

export const ActivityView = memo(
  ({
    week,
    selectedDay,
    scope,
    onScope,
    onSelectDay,
    onOpenSchedule,
    onStartWalk,
    activity,
    goalMinutes,
  }: {
    activity: ActivityWeek;
    goalMinutes: number;
    week: readonly Date[];
    selectedDay: number;
    scope: ActivityScope;
    onScope: (scope: ActivityScope) => void;
    onSelectDay: (dayIndex: number) => void;
    onOpenSchedule: () => void;
    onStartWalk: () => void;
  }) => {
    const reduceMotion = useReducedMotion();
    const weekly = scope === "weekly";
    const totals = activity.totals;
    const day = activity.days.find((item) => item.date.getDay() === selectedDay) ?? activity.days[0];
    const isToday = isoDay(day.date) === isoDay(new Date());

    const minutes = weekly ? totals.minutes : day.minutes;
    const goal = Math.max(1, weekly ? goalMinutes * 7 : goalMinutes);
    const km = weekly ? totals.km : day.km;

    const selectedDate = week.find((d) => d.getDay() === selectedDay) ?? week[0];
    const range = weekly
      ? `${shortDate(week[0])} – ${shortDate(week[week.length - 1])}`
      : `${DAY_LABEL[selectedDate.getDay()]} ${shortDate(selectedDate)}`;

    const dog = useCurrentDog();
    const dogName = dog.data?.name ?? "your dog";

    const enter = (order: number) =>
      reduceMotion
        ? undefined
        : FadeIn.duration(motion.duration.enter).delay(order * motion.stagger);

    const bandEnter = reduceMotion
      ? undefined
      : (weekly ? FadeInRight : FadeInLeft).duration(motion.duration.enter);

    return (
      <View>
        <Animated.View entering={enter(0)} style={styles.scopeRow}>
          <ScopeTabs scope={scope} onChange={onScope} />

          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`${range}. Open the schedule.`}
            scaleTo={0.96}
            onPress={onOpenSchedule}
          >
            <View style={styles.range}>
              <Text style={styles.rangeText}>{range}</Text>
              <CalendarBlankIcon size={iconSize.inline} color={text.secondary} weight="regular" />
            </View>
          </PressScale>
        </Animated.View>

        <Animated.View entering={enter(1)} style={styles.card}>
          <StepRing value={minutes} goal={goal} unit="Active min" />

          <View style={styles.cardStats}>
            <CardStat label="Goal" text={asDuration(goal)} />
            {minutes >= goal ? (
              <CardStat label="Over the goal" text={`+${asDuration(minutes - goal)}`} beaten />
            ) : (
              <CardStat label="To go" text={asDuration(goal - minutes)} />
            )}
            {weekly ? (
              <CardStat label="Active days" value={totals.activeDays} unit="of 7" />
            ) : (
              <CardStat label={day.walks.length === 1 ? "Walk" : "Walks"} value={day.walks.length} />
            )}
          </View>
          <PeekDog onStart={onStartWalk} hint="Drag the dog left, or tap, to start a walk now." />
        </Animated.View>

        <Animated.View entering={enter(2)} style={styles.figures}>
          <Figure
            value={km == null ? "Not logged" : asKm(km)}
            unit={km == null ? undefined : "km"}
            label="Distance"
            quiet={km == null}
          />
          <View style={styles.figureRule} />
          <Figure value={asDuration(minutes)} label="Time" />
          <View style={styles.figureRule} />
          {weekly ? (
            <Figure value={String(totals.walks)} label="Walks" />
          ) : (
            <Figure
              value={day.pace ?? paceOf(day.minutes, day.km) ?? (day.km == null ? "Not logged" : "Too short")}
              unit={day.pace ? "/km" : undefined}
              label="Pace"
              quiet={!day.pace}
            />
          )}
        </Animated.View>

        <Animated.View entering={enter(3)}>
          <WalkPlanner dogName={dogName} goalMinutes={goalMinutes} />
        </Animated.View>

        <Animated.View
          layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter)}
        >
          <Animated.View key={scope} entering={bandEnter}>
            {weekly ? (
              <>
                <Text style={styles.sectionTitle}>This week</Text>
                <View style={styles.chartTight}>
                  <WeekStack
                    stacks={activity.stacks}
                    selectedDay={selectedDay}
                    goal={goalMinutes}
                    onSelectDay={onSelectDay}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>
                  {day.walks.length === 1 ? "The walk" : "The walks"}
                </Text>
                <View style={styles.chart}>
                  <WalkStack
                    walks={day.walks}
                    emptyText={isToday ? "No walks yet today." : `Nothing logged on ${day.label}.`}
                  />
                </View>

                {day.walks.length > 0 ? (
                  <>
                    <Text style={styles.sectionTitle}>Time of day</Text>
                    <View style={styles.chart}>
                      <HourBars hours={day.hours} />
                    </View>
                  </>
                ) : null}
              </>
            )}
          </Animated.View>

        </Animated.View>
      </View>
    );
  },
);

ActivityView.displayName = "ActivityView";

export const ScopeTabs = ({
  scope,
  onChange,
}: {
  scope: ActivityScope;
  onChange: (scope: ActivityScope) => void;
}) => {
  const reduceMotion = useReducedMotion();
  const [slots, setSlots] = useState<Record<string, { x: number; width: number }>>({});

  const x = useSharedValue(0);
  const width = useSharedValue(0);

  useEffect(() => {
    const slot = slots[scope];
    if (!slot) return;
    const timing = { duration: motion.duration.select, easing: motion.easing.out };
    x.value = reduceMotion ? slot.x : withTiming(slot.x, timing);
    width.value = reduceMotion ? slot.width : withTiming(slot.width, timing);
  }, [reduceMotion, scope, slots, width, x]);

  const underline = useAnimatedStyle(() => ({
    width: width.value,
    transform: [{ translateX: x.value }],
  }));

  return (
    <View style={styles.tabs}>
      {SCOPES.map((item) => {
        const active = item.key === scope;
        return (
          <PressScale
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            scaleTo={0.95}
            style={styles.tab}
            onPress={() => {
              if (active) return;
              void Haptics.selectionAsync();
              onChange(item.key);
            }}
            onLayout={(event) => {
              const { x: left, width: w } = event.nativeEvent.layout;
              setSlots((current) =>
                current[item.key]?.x === left && current[item.key]?.width === w
                  ? current
                  : { ...current, [item.key]: { x: left, width: w } },
              );
            }}
          >
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
          </PressScale>
        );
      })}

      <Animated.View style={[styles.underline, underline]} pointerEvents="none" />
    </View>
  );
};

const CardStat = ({
  label,
  value,
  text: written,
  unit,
  beaten = false,
}: {
  label: string;
  value?: number;
  text?: string;
  unit?: string;
  beaten?: boolean;
}) => (
  <View
    style={styles.cardStat}
    accessibilityLabel={`${label}: ${written ?? value}${unit ? ` ${unit}` : ""}`}
  >
    <Text style={[styles.cardStatLabel, beaten && styles.cardStatLabelBeaten]}>{label}</Text>
    <View style={styles.cardStatRow}>
      {written != null ? (
        <Text style={styles.cardStatValue}>{written}</Text>
      ) : (
        <CountUp value={value ?? 0} grouped style={styles.cardStatValue} />
      )}
      {unit ? <Text style={styles.cardStatUnit}>{unit}</Text> : null}
    </View>
  </View>
);

const Figure = ({
  value,
  unit,
  label,
  quiet = false,
}: {
  value: string;
  unit?: string;
  label: string;
  quiet?: boolean;
}) => (
  <View style={styles.figure} accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ""}`}>
    <Text
      style={[styles.figureValue, quiet && styles.figureQuiet]}
      numberOfLines={1}
    >
      {value}
      {unit ? <Text style={styles.figureUnit}> {unit}</Text> : null}
    </Text>
    <Text style={styles.figureLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({

  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    marginTop: space.section,
  },

  tabs: { flexDirection: "row", gap: space.lg, paddingBottom: space.sm },
  tab: { paddingVertical: 2 },
  tabLabel: { ...type.cardTitle, color: text.tertiary },
  tabLabelActive: { color: text.primary, fontWeight: "600" },
  underline: {
    position: "absolute",
    left: 0,
    bottom: 0,
    height: 2,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },

  range: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
  },
  rangeText: { ...type.supporting, color: text.secondary, fontVariant: ["tabular-nums"] },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    marginTop: space.xl,
    padding: space.xl,
    paddingRight: PEEK_WIDTH - layout.gutter + space.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.surface,
  },
  cardStats: { flex: 1, gap: space.md },
  cardStat: {},
  cardStatLabel: { ...type.caption, color: text.tertiary },
  cardStatLabelBeaten: { color: text.secondary, fontWeight: "600" },
  cardStatRow: { flexDirection: "row", alignItems: "baseline", gap: 3, marginTop: 1 },
  cardStatValue: {
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    fontWeight: "700",
    color: text.primary,
    fontVariant: ["tabular-nums"],
    padding: 0,
  },
  cardStatUnit: { ...type.caption, fontWeight: "500", color: text.secondary },

  figures: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: space.xl,
    paddingVertical: space.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: border.soft,
  },
  figure: { flex: 1 },
  figureRule: { width: 1, backgroundColor: border.soft, marginHorizontal: space.lg },
  figureValue: {
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    fontWeight: "700",
    color: text.primary,
    fontVariant: ["tabular-nums"],
  },
  figureQuiet: { ...type.supporting, fontWeight: "600", color: text.tertiary, lineHeight: 24 },
  figureUnit: { ...type.caption, fontWeight: "500", color: text.secondary },
  figureLabel: { ...type.caption, color: text.tertiary, marginTop: 2 },

  sectionTitle: { ...type.sectionTitle, color: text.primary, marginTop: space.section },
  chart: { marginTop: space.lg },
  chartTight: { marginTop: space.xs },
});
