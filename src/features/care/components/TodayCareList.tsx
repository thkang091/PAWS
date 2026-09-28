import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { BellSimpleIcon, BellSimpleSlashIcon, CheckIcon } from "phosphor-react-native";

import { RoutineIcon } from "@/features/care/components/routineIcon";
import {
  positionsFor,
  splitTime,
  untilLabel,
  type TodayItem,
  type TodayPosition,
} from "@/features/care/components/todayCare";
import { prettyTime } from "@/features/care/components/careSetupAnswers";
import { PressScale } from "@/components/ui/PressScale";
import {
  accent,
  bg,
  border,
  icon as iconSize,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

const TIME_COL = 58;
const RAIL = 22;
const DOT = 10;

export const TodayCareList = ({
  items,
  now,
  nowLabel,
  muted,
  reduceMotion,
  onToggleReminder,
  onPressItem,
  startOrder = 0,
}: {
  onPressItem?: (item: TodayItem) => void;
  items: readonly TodayItem[];
  now: number;
  nowLabel: string;
  muted: readonly string[];
  reduceMotion: boolean;
  onToggleReminder: (key: string, turningOn: boolean) => void;
  startOrder?: number;
}) => {
  const positions = positionsFor(items, now);
  const firstUpcoming = positions.findIndex((p) => p !== "past");
  const hasPast = positions.includes("past");
  const markerAt = hasPast ? (firstUpcoming === -1 ? items.length : firstUpcoming) : -1;

  const enter = (order: number) =>
    reduceMotion
      ? undefined
      : FadeInDown.duration(motion.duration.enter)
          .delay((startOrder + order) * motion.stagger)
          .easing(motion.easing.out);

  return (
    <View>
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {index === markerAt ? <NowMarker label={nowLabel} reduceMotion={reduceMotion} /> : null}
          <Animated.View entering={enter(index)}>
            <Row
              item={item}
              position={positions[index]}
              now={now}
              first={index === 0 && markerAt !== 0}
              last={index === items.length - 1 && markerAt !== items.length}
              muted={muted.includes(item.key)}
              reduceMotion={reduceMotion}
              onToggleReminder={onToggleReminder}
              onPress={onPressItem ? () => onPressItem(item) : undefined}
            />
          </Animated.View>
        </Fragment>
      ))}
      {markerAt === items.length ? <NowMarker label={nowLabel} reduceMotion={reduceMotion} last /> : null}
    </View>
  );
};

const NowMarker = ({
  label,
  reduceMotion,
  last = false,
}: {
  label: string;
  reduceMotion: boolean;
  last?: boolean;
}) => (
  <View style={styles.nowRow} accessibilityRole="text" accessibilityLabel={`Now, ${label}`}>
    <View style={styles.timeCol}>
      <View style={styles.nowPill}>
        <Text style={styles.nowPillText}>Now</Text>
      </View>
    </View>
    <View style={styles.railCol}>
      <View style={styles.railLine} />
      <Animated.View
        entering={reduceMotion ? undefined : ZoomIn.duration(motion.duration.enter).easing(motion.easing.out)}
        style={styles.nowHalo}
      >
        <View style={styles.nowDot} />
      </Animated.View>
      {last ? <View style={styles.railGap} /> : <View style={styles.railLine} />}
    </View>
    <Text style={styles.nowText}>{label}</Text>
  </View>
);

const Row = ({
  item,
  position,
  now,
  first,
  last,
  muted,
  reduceMotion,
  onToggleReminder,
  onPress,
}: {
  onPress?: () => void;
  item: TodayItem;
  position: TodayPosition;
  now: number;
  first: boolean;
  last: boolean;
  muted: boolean;
  reduceMotion: boolean;
  onToggleReminder: (key: string, turningOn: boolean) => void;
}) => {
  const isNext = position === "next";
  const faded = position === "past" && !item.done;
  const time = item.time ? splitTime(item.time) : null;
  const reminderOn = Boolean(item.time) && !muted;

  const a11y = [
    item.title,
    item.time ? prettyTime(item.time) : "any time",
    item.detail,
    item.done ? "done" : isNext ? untilLabel(item.time ?? "", now).toLowerCase() : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={styles.row}>
      <View style={styles.timeCol} accessibilityElementsHidden importantForAccessibility="no">
        {time ? (
          <>
            <Text style={[styles.clock, faded && styles.clockPast, isNext && styles.clockNext]}>
              {time.clock}
            </Text>
            <Text style={[styles.meridiem, faded && styles.clockPast]}>{time.meridiem}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.clock, styles.clockPast, styles.anyTime]}>Any</Text>
            <Text style={[styles.meridiem, styles.clockPast]}>time</Text>
          </>
        )}
      </View>

      <View style={styles.railCol}>
        {first ? <View style={styles.railGap} /> : <View style={styles.railLine} />}
        <View
          style={[
            styles.dot,
            item.done && styles.dotDone,
            isNext && !item.done && styles.dotNext,
          ]}
        />
        {last ? <View style={styles.railGap} /> : <View style={styles.railLine} />}
      </View>

      <PressScale
        style={[styles.card, isNext && styles.cardNext]}
        accessible
        accessibilityLabel={a11y}
        accessibilityRole={onPress ? "button" : undefined}
        scaleTo={onPress ? 0.985 : 1}
        onPress={onPress}
      >
        <View style={[styles.iconDisc, isNext && styles.iconDiscNext]}>
          <RoutineIcon iconKey={item.iconKey} size={iconSize.standard} color={text.primary} />
        </View>

        <View style={styles.copy}>
          {isNext && item.time ? (
            <Text style={styles.eyebrow} numberOfLines={1}>
              NEXT · {untilLabel(item.time, now).toUpperCase()}
            </Text>
          ) : null}
          <Text
            style={[styles.title, (item.done || faded) && styles.titleQuiet]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={styles.detail} numberOfLines={1}>
            {item.detail}
          </Text>
        </View>

        {item.time ? (
          <PressScale
            accessibilityRole="switch"
            accessibilityState={{ checked: reminderOn }}
            accessibilityLabel={`Reminder for ${item.title} at ${prettyTime(item.time)}`}
            hitSlop={8}
            scaleTo={0.9}
            style={[styles.bell, reminderOn && isNext && styles.bellNext]}
            onPress={() => {
              void Haptics.selectionAsync();
              onToggleReminder(item.key, !reminderOn);
            }}
          >
            <Animated.View
              key={reminderOn ? "on" : "off"}
              entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
            >
              {reminderOn ? (
                <BellSimpleIcon
                  size={iconSize.inline + 2}
                  color={position === "past" || item.done ? text.tertiary : text.primary}
                  weight="fill"
                />
              ) : (
                <BellSimpleSlashIcon size={iconSize.inline + 2} color={text.tertiary} weight="regular" />
              )}
            </Animated.View>
          </PressScale>
        ) : null}

        <View style={[styles.box, item.done && styles.boxDone]}>
          {item.done ? (
            <Animated.View
              entering={reduceMotion ? undefined : ZoomIn.duration(motion.duration.select).easing(motion.easing.out)}
            >
              <CheckIcon size={13} color={text.primary} weight="bold" />
            </Animated.View>
          ) : null}
        </View>
      </PressScale>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "stretch" },

  timeCol: {
    width: TIME_COL,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: space.xs,
  },
  clock: {
    fontSize: 17,
    lineHeight: 19,
    letterSpacing: -0.3,
    fontWeight: "600",
    color: text.primary,
    fontVariant: ["tabular-nums"],
  },
  clockNext: { fontSize: 19, lineHeight: 21, fontWeight: "700" },
  clockPast: { color: text.tertiary },
  anyTime: { fontSize: 15 },
  meridiem: { ...type.caption, color: text.secondary, marginTop: 1 },

  railCol: { width: RAIL, alignItems: "center" },
  railLine: { flex: 1, width: 1, backgroundColor: border.default },
  railGap: { flex: 1 },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: border.strong,
    backgroundColor: bg.canvas,
  },
  dotDone: { borderColor: accent.deep, backgroundColor: accent.deep },
  dotNext: { borderColor: text.primary, backgroundColor: bg.canvas, borderWidth: 3, width: 12, height: 12, borderRadius: 6 },

  card: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginLeft: space.xs,
    marginVertical: space.xs,
    paddingVertical: space.md,
    paddingLeft: space.md,
    paddingRight: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.surface,
  },
  cardNext: {
    backgroundColor: accent.primary,
    borderColor: accent.primary,
    paddingVertical: space.lg,
  },
  iconDisc: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  iconDiscNext: { backgroundColor: bg.canvas },
  copy: { flex: 1 },
  eyebrow: { ...type.eyebrow, fontSize: 11, color: text.primary, marginBottom: 2 },
  title: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  titleQuiet: { color: text.secondary },
  detail: { ...type.caption, color: text.tertiary, marginTop: 2 },

  bell: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  bellNext: { backgroundColor: bg.canvas },
  box: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: border.default,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: bg.canvas,
  },
  boxDone: { backgroundColor: accent.deep, borderColor: accent.deep },

  nowRow: { flexDirection: "row", alignItems: "stretch", height: 34 },
  nowPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  nowPillText: { ...type.eyebrow, fontSize: 11, letterSpacing: 0.6, color: text.primary },
  nowHalo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  nowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: accent.deep },
  nowText: {
    ...type.caption,
    alignSelf: "center",
    marginLeft: space.sm,
    color: text.secondary,
    fontVariant: ["tabular-nums"],
  },
});
