import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { FlameIcon, MoonStarsIcon, WarningCircleIcon } from "phosphor-react-native";

import { FocusCard } from "@/features/care/components/FocusCard";
import { MISSED } from "@/features/care/components/WeekMarks";
import { prettyTime } from "@/features/care/components/careSetupAnswers";
import { enableDailyCheckIn, setCheckInTime, useCheckInSettings } from "@/features/care/state/dailyCheckIn";
import type { ConsistencyDay } from "@/features/care/intel/consistency";
import { useConsistency } from "@/features/care/state/useConsistency";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, radius, scene, space, text, type } from "@/constants/design";

const EVENING = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"];

/** Whether the check-in record is news today: a miss, a pause, or a streak worth celebrating. */
export const useKeepingUpNews = () => {
  const settings = useCheckInSettings();
  const c = useConsistency();
  if (!settings.hydrated) return null;
  if (!settings.enabled) return { alert: false, label: "Check-ins are paused" };
  if (c.missedThisWeek > 0) return { alert: c.level === "slipping", label: `${c.missedThisWeek} check-ins missed this week` };
  if (c.streak >= 2) return { alert: false, label: `${c.streak} days in a row` };
  return null;
};

/**
 * The check-in record as one of the news cards on Care home, in exactly their shape. The week is seven small dots on
 * the detail line (red for a miss). When it is slipping, "Change time" swaps that line for three nearby times, so
 * the card never grows.
 */
export const KeepingUp = ({ name }: { name: string }) => {
  const settings = useCheckInSettings();
  const c = useConsistency();
  const [picking, setPicking] = useState(false);

  if (!settings.hydrated) return null;

  if (!settings.enabled) {
    return (
      <FocusCard
        reduceMotion
        art={false}
        focus={{
          key: "checkins-paused",
          eyebrow: "CHECK-INS",
          title: "Check-ins are paused",
          detail: `${name}'s days are not being tracked`,
          Glyph: MoonStarsIcon,
          action: {
            label: "Turn on",
            run: () => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              enableDailyCheckIn(settings.time);
            },
          },
        }}
      />
    );
  }

  const missed = c.missedThisWeek;
  const slipping = c.level === "slipping";
  // Three nearby times that fit on one line: an hour earlier, half an hour earlier, half an hour later. "Done" keeps it.
  const at = Math.max(0, EVENING.indexOf(settings.time));
  const nearby = [EVENING[at - 2], EVENING[at - 1], EVENING[at + 1], EVENING[at + 2]].filter((t): t is string => Boolean(t)).slice(0, 3);
  const short = (t: string) => prettyTime(t).replace(/\s?(am|pm)$/i, "");

  const detailNode = picking ? (
    <View style={styles.times} accessibilityLabel="Evening check-in time">
      {nearby.map((t) => {
        const on = t === settings.time;
        return (
          <PressScale
            key={t}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={prettyTime(t)}
            scaleTo={0.94}
            style={[styles.time, on && styles.timeOn]}
            onPress={() => {
              if (!on) {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setCheckInTime(t);
              }
              setPicking(false);
            }}
          >
            <Text style={[styles.timeText, on && styles.timeTextOn]}>{short(t)}</Text>
          </PressScale>
        );
      })}
    </View>
  ) : (
    <MiniWeek week={c.week} label={missed > 0 ? "this week" : `every evening at ${prettyTime(settings.time)}`} />
  );

  return (
    <FocusCard
      reduceMotion
      art={false}
      detailNode={detailNode}
      focus={{
        key: "checkins",
        alert: missed > 0,
        eyebrow: "CHECK-INS",
        // The label already says CHECK-INS, so the title stays one line like every other card.
        title: missed > 0 ? `${missed} missed` : `${c.streak} days in a row`,
        detail: missed > 0 ? "this week" : "",
        Glyph: missed > 0 ? WarningCircleIcon : FlameIcon,
        action: slipping
          ? {
              label: picking ? "Done" : "Change time",
              run: () => {
                void Haptics.selectionAsync();
                setPicking((v) => !v);
              },
            }
          : undefined,
      }}
    />
  );
};

const DOT: Record<ConsistencyDay["mark"], object> = {
  kept: { backgroundColor: scene.sageDeep },
  rest: { backgroundColor: border.default },
  missed: { backgroundColor: MISSED },
  today: { borderWidth: 1.5, borderColor: text.primary },
  off: { backgroundColor: bg.subtle },
};

/** The week in seven dots: sage kept, red missed, grey rest, a ring for today. */
const MiniWeek = ({ week, label }: { week: readonly ConsistencyDay[]; label: string }) => (
  <View style={styles.mini} accessibilityLabel={`${week.filter((d) => d.mark === "missed").length} missed this week`}>
    <View style={styles.dots}>
      {week.map((d) => (
        <View key={d.date} style={[styles.dot, DOT[d.mark], d.catchUp && styles.dotLate]} />
      ))}
    </View>
    <Text style={styles.miniLabel} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  mini: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  dotLate: { backgroundColor: accent.soft, borderWidth: 1.5, borderColor: scene.sageDeep },
  miniLabel: { ...type.supporting, color: text.secondary, flexShrink: 1 },
  times: { flexDirection: "row", gap: 6 },
  time: { height: 26, minWidth: 44, paddingHorizontal: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  timeOn: { backgroundColor: text.primary, borderColor: text.primary },
  timeText: { ...type.caption, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },
  timeTextOn: { color: text.inverse },
});
