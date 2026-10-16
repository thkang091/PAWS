import { Fragment, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { CheckIcon } from "phosphor-react-native";

import { RoutineIcon } from "@/features/care/components/routineIcon";
import type { TodayItem } from "@/features/care/components/todayCare";
import { minutesOf, prettyTime } from "@/features/care/components/careSetupAnswers";
import { enter } from "@/features/care/food/enter";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

const NODE = 40;
const RAIL = NODE + 8;

/** A short countdown that always fits: "now", "in 25 min", "in 6 h". */
const soon = (minutes: number) => (minutes <= 1 ? "now" : minutes < 60 ? `in ${minutes} min` : `in ${Math.round(minutes / 60)} h`);

/**
 * Today as a timeline. Each item's icon sits on the rail and is its own tick box: tap it and it fills butter
 * with a check, and the rail between finished items fills too, so the line shows how far through the day you are.
 */
export const TodayCareList = ({
  items,
  now,
  reduceMotion,
  onToggle,
  onOpen,
  onLongPress,
  readOnly = false,
}: {
  items: readonly TodayItem[];
  now: number;
  reduceMotion: boolean;
  onToggle: (item: TodayItem) => void;
  onOpen: (item: TodayItem) => void;
  /** Hold a row to manage it (the schedule uses this to remove things from the day). */
  onLongPress?: (item: TodayItem) => void;
  /** Another day: shown as planned or as it went, with nothing to tick or start. */
  readOnly?: boolean;
}) => {
  const timed = items.filter((item) => item.time);
  const nowAt = timed.findIndex((item) => minutesOf(item.time!) >= now);
  const markerAt = timed.length && nowAt !== 0 ? (nowAt === -1 ? timed.length : nowAt) : -1;
  const nextKey = readOnly ? null : (items.find((item) => !item.done && item.time && minutesOf(item.time) >= now)?.key ?? null);
  const clock = `${String(Math.floor(now / 60)).padStart(2, "0")}:${String(now % 60).padStart(2, "0")}`;
  const overdue = readOnly ? [] : items.filter((item) => !item.done && item.key !== "checkin" && item.time && minutesOf(item.time) < now);

  return (
    <View>
      {overdue.length ? (
        <OverdueNudge
          count={overdue.length}
          reduceMotion={reduceMotion}
          onAllDone={() => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Tick them in order, a beat apart, so the rail visibly fills down the day.
            overdue.forEach((item, i) => setTimeout(() => onToggle(item), reduceMotion ? 0 : i * 110));
          }}
        />
      ) : null}
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {index === markerAt ? <NowMarker label={prettyTime(clock)} reduceMotion={reduceMotion} /> : null}
          <Row
            item={item}
            now={now}
            next={item.key === nextKey}
            first={index === 0 && markerAt !== 0}
            last={index === items.length - 1 && markerAt !== items.length}
            prevDone={items[index - 1]?.done ?? false}
            nextDone={items[index + 1]?.done ?? false}
            reduceMotion={reduceMotion}
            readOnly={readOnly}
            onToggle={() => onToggle(item)}
            onOpen={() => onOpen(item)}
            onLongPress={onLongPress ? () => onLongPress(item) : undefined}
          />
        </Fragment>
      ))}
      {markerAt === items.length ? <NowMarker label={prettyTime(clock)} reduceMotion={reduceMotion} /> : null}
    </View>
  );
};

/**
 * A gentle reminder when timed items have slipped past: one quiet line above the list. The count reads in the same
 * amber as the overdue times below, and the action is a plain outlined pill, so it never outshouts the list.
 */
const OverdueNudge = ({ count, reduceMotion, onAllDone }: { count: number; reduceMotion: boolean; onAllDone: () => void }) => (
  <Animated.View
    entering={reduceMotion ? undefined : enter({ y: -6 }, { duration: motion.duration.enter })}
    exiting={reduceMotion ? undefined : FadeOut.duration(motion.duration.exit)}
    style={styles.nudge}
    accessibilityRole="summary"
    accessibilityLabel={`${count} overdue. Mark them done to stay on track.`}
  >
    <View style={styles.nudgeDot} />
    <Text style={styles.nudgeTitle} numberOfLines={1}>{`${count} overdue`}</Text>
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={count === 1 ? "Mark it done" : "Mark all done"}
      hitSlop={10}
      scaleTo={0.94}
      style={styles.nudgeAction}
      onPress={onAllDone}
    >
      <CheckIcon size={12} color={text.primary} weight="bold" />
      <Text style={styles.actionText}>{count === 1 ? "Mark done" : "Mark all done"}</Text>
    </PressScale>
  </Animated.View>
);

const NowMarker = ({ label, reduceMotion }: { label: string; reduceMotion: boolean }) => (
  <Animated.View
    entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
    style={styles.now}
    accessibilityRole="text"
    accessibilityLabel={`Now, ${label}`}
  >
    <View style={styles.nowRail}>
      <View style={styles.nowDot} />
    </View>
    <Text style={styles.nowText}>{`Now · ${label}`}</Text>
    <View style={styles.nowRule} />
  </Animated.View>
);

const Row = ({
  item,
  now,
  next,
  first,
  last,
  prevDone,
  nextDone,
  reduceMotion,
  readOnly,
  onToggle,
  onOpen,
  onLongPress,
}: {
  item: TodayItem;
  now: number;
  next: boolean;
  first: boolean;
  last: boolean;
  prevDone: boolean;
  nextDone: boolean;
  reduceMotion: boolean;
  readOnly: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onLongPress?: () => void;
}) => {
  const late = !readOnly && !item.done && Boolean(item.time) && minutesOf(item.time!) < now;
  const isCheckIn = item.key === "checkin";
  const action = item.done || readOnly ? null : isCheckIn ? "Answer" : item.iconKey === "walk" ? "Start" : null;

  const lower = useDerivedValue(
    () =>
      reduceMotion
        ? item.done && nextDone
          ? 1
          : 0
        : withTiming(item.done && nextDone ? 1 : 0, {
            duration: 300,
            easing: motion.easing.out,
          }),
    [item.done, nextDone],
  );
  const upper = useDerivedValue(
    () =>
      reduceMotion
        ? item.done && prevDone
          ? 1
          : 0
        : withTiming(item.done && prevDone ? 1 : 0, {
            duration: 300,
            easing: motion.easing.out,
          }),
    [item.done, prevDone],
  );
  const lowerFill = useAnimatedStyle(() => ({
    transform: [{ scaleY: lower.value }],
  }));
  const upperFill = useAnimatedStyle(() => ({
    transform: [{ scaleY: upper.value }],
  }));

  const when = item.time ? prettyTime(item.time) : "Any time";
  const meta = item.done
    ? `${when} · done`
    : next && item.time
      ? `${when} · ${soon(minutesOf(item.time) - now)}`
      : late
        ? `${when} · overdue`
        : `${when} · ${item.detail}`;

  const tap = () => {
    if (readOnly) return;
    if (isCheckIn && !item.done) onOpen();
    else onToggle();
  };

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        {first ? (
          <View style={styles.gap} />
        ) : (
          <View style={styles.line}>
            <Animated.View style={[styles.lineFill, upperFill]} />
          </View>
        )}
        <Node item={item} next={next} late={late} reduceMotion={reduceMotion} onPress={tap} />
        {last ? (
          <View style={styles.gap} />
        ) : (
          <View style={styles.line}>
            <Animated.View style={[styles.lineFill, lowerFill]} />
          </View>
        )}
      </View>

      <PressScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done }}
        accessibilityLabel={[item.title, when, item.detail, late ? "overdue" : null].filter(Boolean).join(", ")}
        scaleTo={0.985}
        style={[styles.body, next && styles.bodyNext]}
        onPress={tap}
        onLongPress={onLongPress}
        delayLongPress={350}
      >
        <View style={styles.copy}>
          <Text style={[styles.meta, next && styles.metaNext, late && styles.metaLate]} numberOfLines={1}>
            {meta}
          </Text>
          <Text style={[styles.title, item.done && styles.titleDone]} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
        {action ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`${action} ${item.title}`}
            hitSlop={8}
            scaleTo={0.94}
            style={[styles.action, next && styles.actionNext]}
            onPress={onOpen}
          >
            <Text style={styles.actionText}>{action}</Text>
          </PressScale>
        ) : null}
      </PressScale>
    </View>
  );
};

/** The icon on the rail is the tick box: it springs to butter and the check replaces the icon. */
const Node = ({
  item,
  next,
  late,
  reduceMotion,
  onPress,
}: {
  item: TodayItem;
  next: boolean;
  late: boolean;
  reduceMotion: boolean;
  onPress: () => void;
}) => {
  const on = useDerivedValue(
    () => (reduceMotion ? (item.done ? 1 : 0) : withSpring(item.done ? 1 : 0, { duration: 320, dampingRatio: 0.62 })),
    [item.done],
  );
  const fill = useAnimatedStyle(() => ({
    opacity: Math.min(1, on.value * 1.4),
    transform: [{ scale: 0.6 + on.value * 0.4 }],
  }));
  const mark = useAnimatedStyle(() => ({
    opacity: on.value,
    transform: [{ scale: 0.5 + on.value * 0.5 }],
  }));
  const glyph = useAnimatedStyle(() => ({
    opacity: 1 - on.value,
    transform: [{ scale: 1 - on.value * 0.3 }],
  }));
  // A late item's tick box nods once when it turns late, pointing at where to tap.
  const nod = useSharedValue(1);
  useEffect(() => {
    if (!late || reduceMotion) return;
    nod.value = withDelay(
      500,
      withSequence(withTiming(1.14, { duration: 160, easing: motion.easing.out }), withSpring(1, { duration: 420, dampingRatio: 0.45 })),
    );
  }, [late, nod, reduceMotion]);
  const nodStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nod.value }],
  }));
  return (
    <Animated.View style={nodStyle}>
      <PressScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done }}
        accessibilityLabel={item.done ? `${item.title}, done. Tap to undo.` : `Mark ${item.title} done`}
        hitSlop={6}
        scaleTo={0.88}
        style={[styles.node, next && styles.nodeNext, late && styles.nodeLate]}
        onPress={() => {
          void (item.done ? Haptics.selectionAsync() : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
          onPress();
        }}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.nodeFill, fill]} />
        <Animated.View style={[styles.center, glyph]}>
          <RoutineIcon iconKey={item.iconKey} size={18} color={text.primary} />
        </Animated.View>
        <Animated.View style={[styles.center, mark]}>
          <CheckIcon size={16} color={text.primary} weight="bold" />
        </Animated.View>
      </PressScale>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "stretch" },
  rail: { width: RAIL, alignItems: "center" },
  line: {
    flex: 1,
    width: 2,
    borderRadius: 1,
    backgroundColor: border.soft,
    overflow: "hidden",
  },
  lineFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: accent.deep,
    transformOrigin: "top",
  },
  gap: { flex: 1 },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  nodeNext: {
    backgroundColor: accent.primary,
    borderWidth: 2,
    borderColor: text.primary,
  },
  nodeLate: { borderWidth: 2, borderColor: accent.band },
  nodeFill: { backgroundColor: accent.deep, borderRadius: NODE / 2 },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },

  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginVertical: 4,
    marginLeft: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
  },
  bodyNext: { backgroundColor: accent.soft },
  copy: { flex: 1 },
  meta: {
    ...type.caption,
    color: text.tertiary,
    fontVariant: ["tabular-nums"],
  },
  metaNext: { color: text.primary, fontWeight: "700" },
  metaLate: { color: accent.band, fontWeight: "700" },
  title: {
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
    fontWeight: "600",
    color: text.primary,
    marginTop: 1,
  },
  titleDone: { color: text.tertiary, textDecorationLine: "line-through" },
  action: {
    paddingHorizontal: space.md,
    height: 32,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
  },
  actionNext: { backgroundColor: accent.deep },
  actionText: { ...type.caption, fontWeight: "700", color: text.primary },

  nudge: { flexDirection: "row", alignItems: "center", gap: space.sm, height: 36, marginBottom: space.sm },
  nudgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: accent.band },
  nudgeTitle: { ...type.supporting, fontWeight: "700", color: accent.band, flex: 1 },
  nudgeAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 30,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
  },

  now: { flexDirection: "row", alignItems: "center", height: 24 },
  nowRail: { width: RAIL, alignItems: "center" },
  nowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: accent.band,
    borderWidth: 2,
    borderColor: bg.canvas,
  },
  nowText: {
    ...type.caption,
    fontWeight: "700",
    color: accent.band,
    marginLeft: space.sm,
  },
  nowRule: {
    flex: 1,
    height: 1.5,
    marginLeft: space.sm,
    backgroundColor: accent.band,
    opacity: 0.4,
  },
});
