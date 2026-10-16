import { StyleSheet, Text, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { BowlFoodIcon, CalendarCheckIcon, HeartbeatIcon, LockSimpleIcon, PersonSimpleWalkIcon, type IconProps } from "phosphor-react-native";
import type { ComponentType } from "react";

import { requestCatchUp } from "@/features/care/components/CheckInLock";
import { WeekMarks } from "@/features/care/components/WeekMarks";
import { enter } from "@/features/care/food/enter";
import { useCheckInSettings } from "@/features/care/state/dailyCheckIn";
import { useConsistency } from "@/features/care/state/useConsistency";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

/** Care is held shut while a missed check-in can still be caught up. Answering it (or an honest "I don't remember") opens it. */
export const useCareLocked = () => {
  const settings = useCheckInSettings();
  const c = useConsistency();
  return settings.hydrated && settings.enabled && c.catchUp.length > 0;
};

const LOCKED: readonly { label: string; Glyph: ComponentType<IconProps> }[] = [
  { label: "Today's care", Glyph: CalendarCheckIcon },
  { label: "Activity", Glyph: PersonSimpleWalkIcon },
  { label: "Feed", Glyph: BowlFoodIcon },
  { label: "Health", Glyph: HeartbeatIcon },
];

/**
 * What Care shows instead of itself after a missed check-in: the week with its gaps, one way back in, and the parts
 * that are waiting, greyed out with a lock. The lock is the message, so the copy stays to two lines.
 */
export const CareLocked = ({ name, bottomInset = 0 }: { name: string; bottomInset?: number }) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const c = useConsistency();
  const missed = Math.max(c.missedThisWeek, c.catchUp.length);
  const rise = (order: number) => (reduceMotion ? undefined : enter({ y: 12 }, { delay: 60 + order * 50, duration: motion.duration.enter }));

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + bottomInset }]}>
      <Animated.View entering={reduceMotion ? undefined : enter({ scale: 0.8, rotate: -12 }, { duration: 420 })} style={styles.lock}>
        <LockSimpleIcon size={30} color={text.inverse} weight="fill" />
      </Animated.View>

      <Animated.Text entering={rise(1)} style={styles.title} accessibilityRole="header">
        Care is locked
      </Animated.Text>
      <Animated.Text entering={rise(2)} style={styles.lede}>
        {missed <= 1 ? `${name}'s check-in was missed.` : `${missed} of ${name}'s check-ins were missed this week.`}
      </Animated.Text>

      <Animated.View entering={rise(3)} style={styles.week}>
        <WeekMarks week={c.week} size={34} />
      </Animated.View>

      <Animated.View entering={rise(4)}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Catch up to unlock Care"
          scaleTo={0.97}
          style={styles.primary}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            requestCatchUp();
          }}
        >
          <Text style={styles.primaryText}>Catch up to unlock</Text>
        </PressScale>
      </Animated.View>

      <Animated.View entering={rise(5)} style={styles.list} accessibilityLabel="Locked until you catch up">
        {LOCKED.map(({ label, Glyph }, i) => (
          <View key={label} style={[styles.row, i > 0 && styles.rowRule]}>
            <View style={styles.disc}>
              <Glyph size={18} color={text.tertiary} />
            </View>
            <Text style={styles.rowText}>{label}</Text>
            <LockSimpleIcon size={14} color={text.tertiary} weight="fill" />
          </View>
        ))}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas, paddingHorizontal: layout.gutter },
  lock: { width: 64, height: 64, borderRadius: 32, backgroundColor: text.primary, alignItems: "center", justifyContent: "center" },
  title: { ...type.pageTitle, fontSize: 30, lineHeight: 35, color: text.primary, marginTop: space.xl },
  lede: { ...type.body, color: text.secondary, marginTop: space.sm },
  week: { marginTop: space.xxl },
  primary: { height: layout.controlHeight + 4, marginTop: space.xxl, borderRadius: radius.pill, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
  primaryText: { ...type.cardTitle, fontSize: 17, fontWeight: "600", color: text.primary },
  list: { marginTop: space.xxl, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, paddingHorizontal: space.lg },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, height: 56 },
  rowRule: { borderTopWidth: 1, borderTopColor: border.soft },
  disc: { width: 34, height: 34, borderRadius: 17, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  rowText: { ...type.body, color: text.tertiary, flex: 1 },
});
