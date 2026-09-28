import { memo, useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";

import { CheckIcon } from "phosphor-react-native";

import { minutesOf, prettyTime } from "@/features/care/components/careSetupAnswers";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

export type DayEvent = {
  key: string;
  time: string;
  label: string;
  state?: "done" | "next" | "todo";
  tag?: string;
};

const NODE = 104;

export const DayTimeline = memo(
  ({
    events,
    highlight,
  }: {
    events: readonly DayEvent[];
    highlight?: string | null;
  }) => {
    const reduceMotion = useReducedMotion();
    const rail = useRef<ScrollView>(null);

    const clockLike = events.every((event) => /^\d{1,2}:\d{2}$/.test(event.time));
    const ordered = clockLike
      ? [...events].sort((a, b) => minutesOf(a.time) - minutesOf(b.time))
      : [...events];
    const index = ordered.findIndex((event) => event.key === highlight);
    const lastDone = ordered.reduce(
      (found, event, position) => (event.state === "done" ? position : found),
      -1,
    );

    useEffect(() => {
      if (index < 0) return;
      rail.current?.scrollTo({
        x: Math.max(0, index * NODE - NODE),
        animated: !reduceMotion,
      });
    }, [index, reduceMotion]);

    if (ordered.length === 0) return null;

    return (
      <ScrollView
        ref={rail}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.viewport}
        contentContainerStyle={styles.rail}
      >
        {ordered.map((event, position) => {
          const on = event.key === highlight || event.state === "next";
          const done = event.state === "done";
          const filledIn = position <= lastDone;
          const filledOut = position < lastDone;
          return (
            <Animated.View
              key={event.key}
              layout={
                reduceMotion ? undefined : LinearTransition.duration(motion.duration.reveal)
              }
              entering={
                reduceMotion
                  ? undefined
                  : FadeIn.duration(motion.duration.enter).withInitialValues({
                      opacity: 0,
                      transform: [{ scale: 0.8 }, { translateY: 10 }],
                    })
              }
              style={styles.node}
            >
              <View style={styles.track}>
                <View
                  style={[
                    styles.line,
                    filledIn && styles.lineFilled,
                    position === 0 && styles.lineHidden,
                  ]}
                />
                <View style={styles.dotWrap}>
                  {on ? <View style={styles.halo} pointerEvents="none" /> : null}
                  <View style={[styles.dot, done && styles.dotDone, on && styles.dotOn]}>
                    {done ? (
                      <CheckIcon size={12} color={text.primary} weight="bold" />
                    ) : on ? (
                      <View style={styles.dotCore} />
                    ) : null}
                  </View>
                </View>
                <View
                  style={[
                    styles.line,
                    filledOut && styles.lineFilled,
                    position === ordered.length - 1 && styles.lineHidden,
                  ]}
                />
              </View>

              <Text style={[styles.time, (on || done) && styles.timeOn]}>
                {clockLike ? prettyTime(event.time) : event.time}
              </Text>
              <Text style={styles.label} numberOfLines={1}>
                {event.label}
              </Text>

              {on ? (
                <Animated.View
                  entering={
                    reduceMotion ? undefined : FadeIn.duration(motion.duration.select)
                  }
                  style={styles.chip}
                >
                  <Text style={styles.chipText}>
                    {event.tag ?? (event.state === "next" ? "Next up" : "Just added")}
                  </Text>
                </Animated.View>
              ) : done ? (
                <View style={styles.chipSpacer}>
                  <Text style={styles.doneText}>Done</Text>
                </View>
              ) : (
                <View style={styles.chipSpacer} />
              )}
            </Animated.View>
          );
        })}
      </ScrollView>
    );
  },
);

DayTimeline.displayName = "DayTimeline";

const DOT = 22;
const HALO = 38;

const styles = StyleSheet.create({
  viewport: { marginHorizontal: -24 },
  rail: { paddingHorizontal: 24 - (NODE - 72) / 2 },

  node: { width: NODE, alignItems: "center" },
  track: { flexDirection: "row", alignItems: "center", alignSelf: "stretch" },
  line: { flex: 1, height: 2, backgroundColor: border.soft },
  lineFilled: { backgroundColor: accent.deep },
  lineHidden: { backgroundColor: "transparent" },
  dotWrap: { width: HALO, height: HALO, alignItems: "center", justifyContent: "center" },
  halo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: HALO / 2,
    backgroundColor: accent.soft,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: border.default,
    backgroundColor: bg.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  dotOn: { borderColor: accent.deep, borderWidth: 3, backgroundColor: bg.canvas },
  dotDone: { borderColor: accent.deep, backgroundColor: accent.deep },
  dotCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: accent.deep },

  time: {
    ...type.caption,
    fontWeight: "600",
    color: text.secondary,
    marginTop: space.md,
    fontVariant: ["tabular-nums"],
  },
  timeOn: { color: text.primary },
  label: { ...type.caption, color: text.tertiary, marginTop: 2 },

  chip: {
    marginTop: 6,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  chipText: { ...type.caption, fontWeight: "600", color: text.primary },
  chipSpacer: { height: 20, justifyContent: "center" },
  doneText: { ...type.caption, color: text.tertiary },
});
