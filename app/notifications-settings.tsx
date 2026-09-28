import { useEffect, useMemo, useState } from "react";
import { AppState, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import {
  BellRingingIcon,
  BellSimpleSlashIcon,
  CaretLeftIcon,
  MinusIcon,
  PlusIcon,
} from "phosphor-react-native";

import { goBack } from "@/features/care/components/DetailShell";
import { RoutineIcon } from "@/features/care/components/routineIcon";
import { minutesOf, prettyTime } from "@/features/care/components/careSetupAnswers";
import { nowMinutes, splitTime, untilLabel, useNow, useTodayCare } from "@/features/care/components/todayCare";
import { PressScale } from "@/components/ui/PressScale";
import { useCareRoutineCompletions, useCareRoutines } from "@/hooks/useCareEvents";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import {
  useNotificationPreferences,
  useSaveNotificationPreferences,
} from "@/hooks/useNotificationPreferences";
import { requestNotificationPermissions } from "@/services/notificationService";
import { toggleReminder, useCareOnboarding, useMutedReminders } from "@/features/care/state/careOnboarding";
import type { NotificationPreferences } from "@/types/domain";
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

const DEFAULTS: NotificationPreferences = {
  dogMomentReminder: true,
  dailyQuestReminder: true,
  trainingReminder: true,
  streakAtRiskReminder: true,
  careEventReminder: true,
  weeklyRecap: true,
  reminderTime: "18:00",
};

const OTHER: Array<[keyof Omit<NotificationPreferences, "reminderTime">, string, string]> = [
  ["trainingReminder", "Training", "A nudge to practise today's lesson"],
  ["dailyQuestReminder", "Daily quest", "When a new quest is ready"],
  ["streakAtRiskReminder", "Streak at risk", "Only if the day is nearly over"],
  ["dogMomentReminder", "Dog moment", "A prompt to save today's photo"],
  ["careEventReminder", "Care events", "Vet visits and dated care"],
  ["weeklyRecap", "Weekly recap", "Sunday evening summary"],
];

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const shift = (time: string, delta: number) => {
  const next = Math.min(22 * 60 + 30, Math.max(6 * 60, minutesOf(time) + delta));
  return `${String(Math.floor(next / 60)).padStart(2, "0")}:${next % 60 === 0 ? "00" : "30"}`;
};

type Permission = "granted" | "denied" | "undetermined" | "unsupported";

const usePermission = () => {
  const [status, setStatus] = useState<Permission>(Platform.OS === "web" ? "unsupported" : "undetermined");

  useEffect(() => {
    if (Platform.OS === "web") return;
    const read = () =>
      void Notifications.getPermissionsAsync()
        .then((result) => setStatus(result.status as Permission))
        .catch(() => setStatus("unsupported"));
    read();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") read();
    });
    return () => sub.remove();
  }, []);

  const ask = async () => {
    const granted = await requestNotificationPermissions().catch(() => false);
    setStatus(granted ? "granted" : "denied");
  };

  return { status, ask };
};

export default function NotificationsSettingsScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const name = dog.data?.name ?? "your dog";

  const clock = useNow();
  const minuteNow = nowMinutes(clock);
  const routines = useCareRoutines(dogId);
  const completions = useCareRoutineCompletions(dogId, isoDate(clock));
  const doneIds = useMemo(
    () => new Set((completions.data ?? []).map((c) => c.routineId)),
    [completions.data],
  );
  const { choice } = useCareOnboarding();
  const muted = useMutedReminders();
  const items = useTodayCare(routines.data, doneIds, choice);
  const timed = items.filter((item) => item.time);
  const live = timed.filter((item) => !muted.includes(item.key));
  const laterToday = live.find((item) => minutesOf(item.time as string) >= minuteNow);
  const next = laterToday ?? live[0];
  const tomorrow = !laterToday && Boolean(next);

  const permission = usePermission();

  const prefs = useNotificationPreferences();
  const save = useSaveNotificationPreferences();
  const [values, setValues] = useState<NotificationPreferences>(DEFAULTS);
  useEffect(() => {
    if (prefs.data) setValues(prefs.data);
  }, [prefs.data]);

  const update = (patch: Partial<NotificationPreferences>) => {
    void Haptics.selectionAsync();
    const merged = { ...values, ...patch };
    setValues(merged);
    save.mutate(merged);
  };

  const enter = (order: number) =>
    reduceMotion
      ? undefined
      : FadeInDown.duration(motion.duration.enter)
          .delay(order * motion.stagger)
          .easing(motion.easing.out);

  const nextTime = next?.time ? splitTime(next.time) : null;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.roundButton}
          onPress={() => goBack("/(tabs)/care")}
        >
          <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
        </PressScale>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.page }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text entering={enter(0)} style={styles.pageTitle}>
          Notifications
        </Animated.Text>

        <Animated.View entering={enter(1)} style={styles.hero}>
          {next && nextTime ? (
            <>
              <View style={styles.heroTop}>
                <Text style={styles.heroEyebrow}>NEXT REMINDER</Text>
                <View style={styles.heroChip}>
                  <Text style={styles.heroChipText}>
                    {tomorrow ? "Tomorrow" : untilLabel(next.time as string, minuteNow)}
                  </Text>
                </View>
              </View>
              <View style={styles.heroTimeRow}>
                <Text style={styles.heroClock}>{nextTime.clock}</Text>
                <Text style={styles.heroMeridiem}>{nextTime.meridiem}</Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={1}>
                {next.title} · {name}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.heroEyebrow}>NEXT REMINDER</Text>
              <Text style={styles.heroEmpty}>
                {timed.length === 0
                  ? "Nothing timed yet. Set walk or meal times in Care."
                  : "Every reminder is muted. Turn one on below."}
              </Text>
            </>
          )}
        </Animated.View>

        {permission.status === "denied" || permission.status === "undetermined" ? (
          <Animated.View entering={enter(2)} style={styles.permission}>
            <BellRingingIcon size={iconSize.feature} color={text.primary} weight="regular" />
            <View style={styles.permissionCopy}>
              <Text style={styles.permissionTitle}>
                {permission.status === "denied" ? "Notifications are off" : "Let reminders through"}
              </Text>
              <Text style={styles.permissionBody}>
                {permission.status === "denied"
                  ? "Turn them on for PAWS in Settings to get these on time."
                  : "PAWS only sends the times you see below."}
              </Text>
            </View>
            {permission.status === "undetermined" ? (
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Allow notifications"
                style={styles.allow}
                onPress={() => void permission.ask()}
              >
                <Text style={styles.allowText}>Allow</Text>
              </PressScale>
            ) : null}
          </Animated.View>
        ) : null}

        <Animated.Text entering={enter(3)} style={styles.sectionTitle}>
          Today&rsquo;s care
        </Animated.Text>

        {timed.length === 0 ? (
          <Text style={styles.muted}>Walk, meal and medication times will appear here.</Text>
        ) : (
          <View style={styles.group}>
            {timed.map((item, index) => {
              const on = !muted.includes(item.key);
              const past = minutesOf(item.time as string) < minuteNow;
              const time = splitTime(item.time as string);
              return (
                <Animated.View
                  key={item.key}
                  entering={enter(4 + index)}
                  style={[styles.reminder, index > 0 && styles.divider]}
                >
                  <View style={styles.reminderTime}>
                    <Text style={[styles.clock, past && styles.clockPast]}>{time.clock}</Text>
                    <Text style={[styles.meridiem, past && styles.clockPast]}>{time.meridiem}</Text>
                  </View>
                  <View style={styles.reminderIcon}>
                    <RoutineIcon iconKey={item.iconKey} size={iconSize.standard} color={text.primary} />
                  </View>
                  <View style={styles.reminderCopy}>
                    <Text style={styles.reminderTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Animated.Text
                      key={on ? "on" : "off"}
                      entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
                      style={styles.reminderMeta}
                      numberOfLines={1}
                    >
                      {on ? `Daily at ${prettyTime(item.time as string)}` : "Muted"}
                    </Animated.Text>
                  </View>
                  <Switch
                    accessibilityLabel={`${item.title} reminder at ${prettyTime(item.time as string)}`}
                    value={on}
                    trackColor={{ false: border.default, true: accent.deep }}
                    ios_backgroundColor={border.default}
                    onValueChange={(nextOn) => {
                      void Haptics.selectionAsync();
                      toggleReminder(item.key);
                      if (nextOn && permission.status === "undetermined") void permission.ask();
                    }}
                  />
                </Animated.View>
              );
            })}
          </View>
        )}

        <Text style={styles.sectionTitle}>Everything else</Text>

        <View style={styles.group}>
          <View style={styles.reminder}>
            <View style={styles.reminderCopy}>
              <Text style={styles.reminderTitle}>Daily nudge</Text>
              <Text style={styles.reminderMeta}>When training nudges arrive</Text>
            </View>
            <View style={styles.stepper}>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Half an hour earlier"
                scaleTo={0.9}
                style={styles.stepButton}
                onPress={() => update({ reminderTime: shift(values.reminderTime, -30) })}
              >
                <MinusIcon size={iconSize.inline} color={text.primary} weight="bold" />
              </PressScale>
              <Animated.Text
                key={values.reminderTime}
                entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
                style={styles.stepValue}
              >
                {prettyTime(values.reminderTime.slice(0, 5))}
              </Animated.Text>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Half an hour later"
                scaleTo={0.9}
                style={styles.stepButton}
                onPress={() => update({ reminderTime: shift(values.reminderTime, 30) })}
              >
                <PlusIcon size={iconSize.inline} color={text.primary} weight="bold" />
              </PressScale>
            </View>
          </View>

          {OTHER.map(([key, label, hint]) => (
            <View key={key} style={[styles.reminder, styles.divider]}>
              <View style={styles.reminderCopy}>
                <Text style={styles.reminderTitle}>{label}</Text>
                <Text style={styles.reminderMeta}>{hint}</Text>
              </View>
              <Switch
                accessibilityLabel={label}
                value={values[key]}
                trackColor={{ false: border.default, true: accent.deep }}
                ios_backgroundColor={border.default}
                onValueChange={(nextOn) => update({ [key]: nextOn })}
              />
            </View>
          ))}
        </View>

        {prefs.isError || save.isError ? (
          <View style={styles.offline}>
            <BellSimpleSlashIcon size={iconSize.inline} color={text.tertiary} weight="regular" />
            <Text style={styles.muted}>Saved on this phone. It will sync when you are back online.</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  header: { paddingHorizontal: layout.gutter, paddingBottom: space.sm },
  roundButton: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { paddingHorizontal: layout.gutter },
  pageTitle: { ...type.pageTitle, color: text.primary, marginTop: space.md },

  hero: {
    marginTop: space.xxl,
    padding: space.xl,
    borderRadius: radius.sheet - 8,
    backgroundColor: accent.primary,
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroEyebrow: { ...type.eyebrow, color: text.primary },
  heroChip: {
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  heroChipText: { ...type.caption, fontWeight: "600", color: text.primary },
  heroTimeRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: space.lg },
  heroClock: {
    fontSize: 56,
    lineHeight: 58,
    letterSpacing: -2,
    fontWeight: "700",
    color: text.primary,
    fontVariant: ["tabular-nums"],
  },
  heroMeridiem: { ...type.sectionTitle, color: text.primary, marginBottom: 8 },
  heroTitle: { ...type.body, fontWeight: "500", color: text.primary, marginTop: space.xs },
  heroEmpty: { ...type.body, color: text.secondary, marginTop: space.md },

  permission: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
  },
  permissionCopy: { flex: 1 },
  permissionTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  permissionBody: { ...type.caption, color: text.secondary, marginTop: 2 },
  allow: {
    paddingHorizontal: space.lg,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  allowText: { ...type.button, color: text.primary },

  sectionTitle: {
    ...type.sectionTitle,
    color: text.primary,
    marginTop: space.section,
    marginBottom: space.md,
  },
  group: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
    overflow: "hidden",
  },
  reminder: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    minHeight: 64,
  },
  divider: { borderTopWidth: 1, borderTopColor: border.soft },
  reminderTime: { width: 48, alignItems: "flex-end" },
  clock: {
    fontSize: 17,
    lineHeight: 19,
    letterSpacing: -0.3,
    fontWeight: "600",
    color: text.primary,
    fontVariant: ["tabular-nums"],
  },
  clockPast: { color: text.tertiary },
  meridiem: { ...type.caption, color: text.secondary },
  reminderIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderCopy: { flex: 1 },
  reminderTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  reminderMeta: { ...type.caption, color: text.tertiary, marginTop: 2 },

  stepper: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.default,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: {
    ...type.cardTitle,
    fontWeight: "600",
    color: text.primary,
    minWidth: 68,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },

  muted: { ...type.supporting, color: text.secondary, flexShrink: 1 },
  offline: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg },
});
