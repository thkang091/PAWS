import { memo, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { CheckIcon } from "phosphor-react-native";

import { TIME_SLOTS, minutesOf, prettyTime } from "@/features/care/components/careSetupAnswers";
import { PressScale } from "@/components/ui/PressScale";
import {
  accent,
  border,
  icon as iconSize,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

const PARTS = [
  { key: "morning", label: "Morning", until: 12 * 60 },
  { key: "afternoon", label: "Afternoon", until: 17 * 60 },
  { key: "evening", label: "Evening", until: 24 * 60 },
] as const;

const REACH = 3;

const Cell = memo(
  ({
    time,
    on,
    marked,
    distance,
    nonce,
    bloomDelay,
    reduceMotion,
    onPress,
  }: {
    time: string;
    on: boolean;
    marked: boolean;
    distance: number | null;
    nonce: number;
    bloomDelay: number;
    reduceMotion: boolean;
    onPress: () => void;
  }) => {
    const fill = useSharedValue(on ? 1 : 0);
    const lift = useSharedValue(0);

    useEffect(() => {
      if (reduceMotion) {
        fill.value = on ? 1 : 0;
        return;
      }
      fill.value = on
        ? withDelay(bloomDelay, withSpring(1, motion.spring))
        : withTiming(0, { duration: motion.duration.exit, easing: motion.easing.out });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fill, on, reduceMotion]);

    useEffect(() => {
      if (reduceMotion || distance === null || distance === 0 || nonce === 0) return;
      lift.value = withDelay(
        distance * 34,
        withSequence(
          withTiming(1, { duration: 110, easing: motion.easing.out }),
          withTiming(0, { duration: 190, easing: motion.easing.out }),
        ),
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nonce]);

    const tile = useAnimatedStyle(() => ({
      opacity: fill.value,
      transform: [{ scale: 0.72 + 0.28 * fill.value }],
    }));

    const body = useAnimatedStyle(() => ({
      transform: [{ translateY: -3 * lift.value }],
    }));

    return (
      <Animated.View style={[styles.cell, body]}>
        <PressScale
          accessibilityRole="checkbox"
          accessibilityState={{ checked: on }}
          accessibilityLabel={
            marked ? `${prettyTime(time)}. Suits most dogs.` : prettyTime(time)
          }
          scaleTo={0.88}
          style={styles.hit}
          onPress={onPress}
        >
          <Animated.View style={[styles.tile, tile]} />
          <Text style={[styles.label, on && styles.labelOn]}>{time}</Text>
          {marked && !on ? <View style={styles.dot} /> : null}
        </PressScale>
      </Animated.View>
    );
  },
);

Cell.displayName = "Cell";

export const TimeGrid = ({
  slots,
  suggested = [],
  times = TIME_SLOTS,
  animateIn = true,
  reduceMotion,
  onToggle,
  onSuggest,
}: {
  slots: readonly string[];
  suggested?: readonly string[];
  times?: readonly string[];
  animateIn?: boolean;
  reduceMotion: boolean;
  onToggle: (time: string) => void;
  onSuggest?: () => void;
}) => {
  const [wave, setWave] = useState({ at: -1, nonce: 0 });
  const [burst, setBurst] = useState<readonly string[]>([]);

  const matches =
    suggested.length > 0 &&
    suggested.length === slots.length &&
    suggested.every((time) => slots.includes(time));

  const parts = PARTS.map((part, index) => ({
    ...part,
    times: times.filter((time) => {
      const minutes = minutesOf(time);
      return minutes < part.until && (index === 0 || minutes >= PARTS[index - 1].until);
    }),
  })).filter((part) => part.times.length > 0);

  return (
    <View>
      {parts.map((part, partIndex) => (
        <Animated.View
          key={part.key}
          entering={
            reduceMotion || !animateIn
              ? undefined
              : FadeInDown.duration(motion.duration.enter).delay(partIndex * 70)
          }
          style={styles.part}
        >
          <Text style={styles.partLabel}>{part.label}</Text>
          <View style={styles.rule} />

          <View style={styles.field}>
            {part.times.map((time) => {
              const index = times.indexOf(time);
              const gap = wave.at < 0 ? null : Math.abs(index - wave.at);
              return (
                <Cell
                  key={time}
                  time={time}
                  on={slots.includes(time)}
                  marked={suggested.includes(time)}
                  distance={gap !== null && gap <= REACH ? gap : null}
                  nonce={wave.nonce}
                  bloomDelay={Math.max(0, burst.indexOf(time)) * 90}
                  reduceMotion={reduceMotion}
                  onPress={() => {
                    setBurst([]);
                    setWave((current) => ({ at: index, nonce: current.nonce + 1 }));
                    onToggle(time);
                  }}
                />
              );
            })}
          </View>
        </Animated.View>
      ))}

      {suggested.length > 0 && onSuggest ? (
        <PressScale
          accessibilityRole="button"
          accessibilityState={{ selected: matches }}
          accessibilityLabel={`Use ${suggested.map(prettyTime).join(" and ")}. What suits most dogs.`}
          scaleTo={0.98}
          style={styles.advice}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setBurst(matches ? [] : [...suggested].sort());
            onSuggest();
          }}
        >
          <View style={styles.adviceMark}>
            {matches ? (
              <CheckIcon size={iconSize.inline} color={text.primary} weight="bold" />
            ) : (
              <View style={styles.adviceDot} />
            )}
          </View>
          <View style={styles.adviceCopy}>
            <Text style={styles.adviceTitle}>
              {matches ? "Using " : "Use "}
              {suggested.map(prettyTime).join(" and ")}
            </Text>
            <Text style={styles.adviceNote}>What suits most dogs</Text>
          </View>
        </PressScale>
      ) : null}
    </View>
  );
};

const CELL_H = 46;

const styles = StyleSheet.create({
  part: { marginTop: space.xxl },
  partLabel: {
    ...type.cardTitle,
    fontSize: 17,
    fontWeight: "600",
    color: text.primary,
  },
  rule: {
    height: 1,
    backgroundColor: border.soft,
    marginTop: space.sm,
    marginBottom: space.xs,
  },
  field: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 6}%`, height: CELL_H },
  hit: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tile: {
    position: "absolute",
    top: 4,
    left: 2,
    right: 2,
    bottom: 4,
    borderRadius: radius.control,
    backgroundColor: accent.primary,
  },
  label: { ...type.supporting, fontSize: 15, fontWeight: "500", color: text.secondary },
  labelOn: { color: text.primary, fontWeight: "700" },
  dot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: accent.band,
  },

  advice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    marginTop: space.xl,
  },
  adviceMark: { width: 18, alignItems: "center", paddingTop: 6 },
  adviceDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: accent.band },
  adviceCopy: { flex: 1 },
  adviceTitle: { ...type.supporting, fontWeight: "600", color: text.primary },
  adviceNote: { ...type.caption, color: text.tertiary, marginTop: 1 },
});
