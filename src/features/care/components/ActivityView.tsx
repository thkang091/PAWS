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
import { ArmchairIcon, CaretLeftIcon, CaretRightIcon, FootprintsIcon, PersonSimpleWalkIcon, StairsIcon } from "phosphor-react-native";

import { HourBars } from "@/features/care/components/HourBars";
import { StepRing } from "@/features/care/components/StepRing";
import { PEEK_WIDTH, PeekDog } from "@/features/care/components/PeekDog";
import { WalkPlanner } from "@/features/care/components/WalkPlanner";
import { WalkStack } from "@/features/care/components/WalkStack";
import { WeekStack } from "@/features/care/components/WeekStack";
import {
  asDuration,
  asKm,
  isoDay,
  paceOf,
  type ActivityWeek,
} from "@/features/care/components/activityData";
import { enter as rise } from "@/features/care/food/enter";
import { MOBILITY_NOUN, type Mobility } from "@/features/care/intel/careIntel";
import { useCareIntel } from "@/features/care/intel/useCareIntel";
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
    onStartWalk: () => void;
  }) => {
    const reduceMotion = useReducedMotion();
    const intel = useCareIntel();
    const weekly = scope === "weekly";
    const totals = activity.totals;
    const day = activity.days.find((item) => item.date.getDay() === selectedDay) ?? activity.days[0];
    const isToday = isoDay(day.date) === isoDay(new Date());

    const minutes = weekly ? totals.minutes : day.minutes;
    const goal = Math.max(1, weekly ? goalMinutes * 7 : goalMinutes);
    const km = weekly ? totals.km : day.km;

    const selectedDate = week.find((d) => d.getDay() === selectedDay) ?? week[0];
    const dayIndex = week.findIndex((d) => d.getDay() === selectedDay);
    const range = weekly
      ? `${shortDate(week[0])} – ${shortDate(week[week.length - 1])}`
      : `${DAY_LABEL[selectedDate.getDay()]} ${shortDate(selectedDate)}`;


    const enter = (order: number) =>
      reduceMotion
        ? undefined
        : FadeIn.duration(motion.duration.enter).delay(order * motion.stagger);

    const bandEnter = reduceMotion
      ? undefined
      : (weekly ? FadeInRight : FadeInLeft).duration(motion.duration.enter);

    const reached = minutes >= goal;
    const heading = weekly ? "So far this week" : isToday ? "Today" : day.label;

    return (
      <View>
        <Animated.View entering={enter(0)} style={styles.scopeRow}>
          <ScopeTabs scope={scope} onChange={onScope} />

          {weekly ? (
            <View style={styles.range} accessibilityLabel={range}>
              <Text style={styles.rangeText}>{range}</Text>
            </View>
          ) : (
            <DayStepper
              label={range}
              canBack={dayIndex > 0}
              canForward={dayIndex >= 0 && dayIndex < week.length - 1 && isoDay(week[dayIndex + 1]) <= isoDay(new Date())}
              onBack={() => onSelectDay(week[dayIndex - 1].getDay())}
              onForward={() => onSelectDay(week[dayIndex + 1].getDay())}
            />
          )}
        </Animated.View>

        {/* Health's rhythm: a section title, one line under it, then a butter card holding a white panel. */}
        <Animated.View key={`hero-${scope}`} entering={bandEnter}>
          <Text style={[styles.sectionTitle, styles.sectionFirst]}>{heading}</Text>
          <Text style={styles.lede}>{`${intel.name} needs ${asDuration(goalMinutes)} a day.`}</Text>

          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <StepRing value={minutes} goal={goal} unit="min" />
              <View style={styles.heroCopy}>
                <Text style={styles.headline}>{reached ? "Goal reached" : `${asDuration(goal - minutes)} to go`}</Text>
                <Text style={styles.heroSub}>
                  {weekly
                    ? `${totals.activeDays} of 7 days active`
                    : day.walks.length
                      ? `${day.walks.length} ${day.walks.length === 1 ? "walk" : "walks"}`
                      : isToday
                        ? "No walk yet"
                        : "Nothing logged"}
                </Text>
              </View>
              <PeekDog onStart={onStartWalk} hint="Drag the dog left, or tap, to start a walk now." />
            </View>

            <View style={styles.panel}>
              <Figure value={km == null ? "None" : asKm(km)} unit={km == null ? undefined : "km"} label="Distance" quiet={km == null} />
              <View style={styles.figureRule} />
              <Figure value={asDuration(minutes)} label="Time" />
              <View style={styles.figureRule} />
              {weekly ? (
                <Figure value={String(totals.walks)} label="Walks" />
              ) : (
                <Figure
                  value={day.pace ?? paceOf(day.minutes, day.km) ?? "None"}
                  unit={day.pace ? "/km" : undefined}
                  label="Pace"
                  quiet={!day.pace && !paceOf(day.minutes, day.km)}
                />
              )}
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <WalkPlanner />
        </Animated.View>

        <Animated.View
          layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter)}
        >
          <Animated.View key={scope} entering={bandEnter}>
            <Text style={styles.sectionTitle}>{weekly ? "Every day" : day.walks.length === 1 ? "The walk" : "The walks"}</Text>
            <Text style={styles.lede}>{weekly ? "Tap a day to open it." : "Where the minutes came from."}</Text>
            <View style={styles.box}>
              {weekly ? (
                <WeekStack stacks={activity.stacks} selectedDay={selectedDay} goal={goalMinutes} onSelectDay={onSelectDay} />
              ) : (
                <>
                  <WalkStack walks={day.walks} emptyText={isToday ? "No walks yet today." : `Nothing logged on ${day.label}.`} />
                  {day.walks.length > 0 ? (
                    <View style={styles.boxSplit}>
                      <Text style={styles.boxLabel}>Time of day</Text>
                      <HourBars hours={day.hours} />
                    </View>
                  ) : null}
                </>
              )}
            </View>
          </Animated.View>
        </Animated.View>

        <Animated.View entering={enter(3)}>
          <Movement mobility={intel.mobility} />
        </Animated.View>
      </View>
    );
  },
);

/** One day at a time: the date between two quiet arrows. Days after today stay out of reach. */
const DayStepper = ({ label, canBack, canForward, onBack, onForward }: { label: string; canBack: boolean; canForward: boolean; onBack: () => void; onForward: () => void }) => (
  <View style={styles.stepper}>
    <PressScale accessibilityRole="button" accessibilityLabel="Previous day" accessibilityState={{ disabled: !canBack }} disabled={!canBack} hitSlop={8} scaleTo={0.88} style={styles.stepperButton} onPress={onBack}>
      <CaretLeftIcon size={14} color={canBack ? text.primary : text.disabled} weight="bold" />
    </PressScale>
    <Text style={styles.rangeText}>{label}</Text>
    <PressScale accessibilityRole="button" accessibilityLabel="Next day" accessibilityState={{ disabled: !canForward }} disabled={!canForward} hitSlop={8} scaleTo={0.88} style={styles.stepperButton} onPress={onForward}>
      <CaretRightIcon size={14} color={canForward ? text.primary : text.disabled} weight="bold" />
    </PressScale>
  </View>
);

/**
 * Movement, read from the evening check-in. Activity shows the trend; when something persists, Care home raises it as
 * the most important thing and Health owns what to do about it.
 */
const Movement = ({ mobility }: { mobility: Mobility }) => {
  const reduceMotion = useReducedMotion();
  const seen = (n: number) => (n === 0 ? null : `${n} of the last ${mobility.checkIns} check-ins`);
  const rows =
    mobility.status === "unknown"
      ? [{ key: "none", Glyph: PersonSimpleWalkIcon, title: "Not tracked yet", status: "The evening check-in asks about it", flag: false }]
      : [
          {
            key: "mobility",
            Glyph: PersonSimpleWalkIcon,
            title: "Mobility",
            status:
              mobility.status === "normal"
                ? "Normal"
                : mobility.status === "concern" && mobility.streak && mobility.streak.days >= 3
                  ? `${MOBILITY_NOUN[mobility.streak.sign][0].toUpperCase()}${MOBILITY_NOUN[mobility.streak.sign].slice(1)}, ${mobility.streak.days} days running`
                  : mobility.status === "concern"
                    ? "Limping more than once this week"
                    : "Something to watch",
            flag: mobility.status === "concern",
          },
          { key: "stiff", Glyph: ArmchairIcon, title: "Getting up", status: seen(mobility.counts.stiff) ?? "No stiffness", flag: false },
          { key: "limping", Glyph: FootprintsIcon, title: "Limping", status: seen(mobility.counts.limping) ?? "None reported", flag: false },
          {
            key: "stairs",
            Glyph: StairsIcon,
            title: "Stairs and jumping",
            status: seen(mobility.counts.stairs + mobility.counts.reluctant > 0 ? Math.max(mobility.counts.stairs, mobility.counts.reluctant) : 0) ?? "Moving freely",
            flag: false,
          },
        ];
  return (
    <View>
      <Text style={styles.sectionTitle}>Movement</Text>
      <Text style={styles.lede}>From the evening check-in, over the last week.</Text>
      <View style={styles.list}>
        {rows.map((row, i) => {
          const attention = row.flag || (row.key !== "mobility" && !/^No |^None|^Moving|^Normal/.test(row.status) && mobility.status !== "unknown");
          return (
            <Animated.View
              key={row.key}
              entering={reduceMotion ? undefined : rise({ y: 8 }, { delay: 80 + i * 50, duration: motion.duration.enter })}
              style={[styles.listRow, i > 0 && styles.ruled]}
              accessible
              accessibilityLabel={`${row.title}. ${row.status}`}
            >
              <View style={[styles.disc, attention && styles.discOn]}>
                <row.Glyph size={iconSize.standard} color={text.primary} weight="regular" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <View style={styles.statusRow}>
                  {attention ? <View style={styles.flag} /> : null}
                  <Text style={[styles.status, attention && styles.statusOn]} numberOfLines={1}>
                    {row.status}
                  </Text>
                </View>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
};

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
    marginTop: space.xl,
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

  flex: { flex: 1 },
  hero: { padding: space.xxl, borderRadius: radius.card + 8, backgroundColor: accent.soft },
  heroTop: { flexDirection: "row", alignItems: "center", gap: space.lg, minHeight: 150, paddingRight: PEEK_WIDTH - layout.gutter - space.xl + space.sm },
  heroCopy: { flex: 1 },
  headline: { ...type.pageTitle, fontSize: 24, lineHeight: 28, color: text.primary, fontVariant: ["tabular-nums"] },
  heroSub: { ...type.supporting, color: text.secondary, marginTop: 4 },
  panel: { flexDirection: "row", alignItems: "stretch", marginTop: space.xl, paddingVertical: space.lg, paddingHorizontal: space.lg, borderRadius: radius.card, backgroundColor: bg.canvas },
  figure: { flex: 1 },
  figureRule: { width: 1, backgroundColor: border.soft, marginHorizontal: space.md },
  figureValue: { ...type.cardTitle, fontSize: 18, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },
  figureQuiet: { color: text.tertiary },
  figureUnit: { ...type.caption, fontWeight: "500", color: text.secondary },
  figureLabel: { ...type.caption, color: text.tertiary, marginTop: 2 },

  lede: { ...type.supporting, color: text.secondary, marginTop: 4, marginBottom: space.xl },
  box: { paddingVertical: space.xl, paddingHorizontal: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft },
  boxSplit: { marginTop: space.xl, paddingTop: space.xl, borderTopWidth: 1, borderTopColor: border.soft },
  boxLabel: { ...type.caption, color: text.secondary, marginBottom: space.sm },

  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  listRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.lg, backgroundColor: bg.canvas },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  disc: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  discOn: { backgroundColor: accent.primary },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  flag: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: accent.band },
  status: { ...type.caption, color: text.tertiary, flexShrink: 1 },
  statusOn: { color: text.primary, fontWeight: "600" },

  sectionTitle: { ...type.sectionTitle, fontSize: 22, lineHeight: 27, color: text.primary, marginTop: space.block },
  sectionFirst: { marginTop: space.section },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.xs, height: 36, paddingHorizontal: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft },
  stepperButton: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
