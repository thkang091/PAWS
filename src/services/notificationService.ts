import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { Platform } from "react-native";

import { getClientOrThrow, throwIfError } from "@/services/serviceUtils";
import type { CareRoutine, NotificationPreferences } from "@/types/domain";

export const initNotifications = () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
};

export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
};

const routineNotifId = (routineKey: string) => `care_routine__${routineKey}`;

export const scheduleRoutineReminder = async (
  routineKey: string,
  title: string,
  reminderTime: string,
): Promise<void> => {
  const [hStr, mStr] = reminderTime.split(":");
  const hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);
  if (isNaN(hour) || isNaN(minute)) return;

  await Notifications.cancelScheduledNotificationAsync(routineNotifId(routineKey)).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: routineNotifId(routineKey),
    content: {
      title: "Time for your dog's routine",
      body: title,
      sound: true,
      data: { routineKey },
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
};

export const cancelRoutineReminder = async (routineKey: string): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(routineNotifId(routineKey)).catch(() => {});
};

export const rescheduleAllRoutineReminders = async (routines: CareRoutine[]): Promise<void> => {
  if (Platform.OS === "web") return;

  const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of allScheduled) {
    if (notif.identifier.startsWith("care_routine__")) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier).catch(() => {});
    }
  }

  for (const routine of routines) {
    if (routine.reminderTime) {
      await scheduleRoutineReminder(routine.routineKey, routine.title, routine.reminderTime);
    }
  }
};

export type CareReminder = { key: string; title: string; time: string; label: string };

export const syncCareReminders = async (reminders: readonly CareReminder[], dogName: string): Promise<void> => {
  if (Platform.OS === "web") return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.identifier.startsWith("care_today__")) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier).catch(() => {});
    }
  }

  for (const reminder of reminders) {
    const [hour, minute] = reminder.time.split(":").map((part) => parseInt(part, 10));
    if (isNaN(hour) || isNaN(minute)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `care_today__${reminder.key}`,
      content: {
        title: `${reminder.title} · ${reminder.label}`,
        body: `Time for ${dogName}'s ${reminder.title.toLowerCase()}.`,
        sound: true,
        data: { reminderKey: reminder.key },
      },
      trigger: { type: SchedulableTriggerInputTypes.DAILY, hour, minute },
    }).catch(() => {});
  }
};

const CHECKIN_DAYS_AHEAD = 7;
/** A nudge this long after the check-in time if it is still open. */
const LATE_NUDGE_MINUTES = 90;
const MORNING_HOUR = 9;

const keyOf = (at: Date) => `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;

/**
 * The evening check-in reminder, then two follow-ups if it goes unanswered: a nudge later that evening, and a note
 * the next morning that says how many days have gone by, so a quiet week never passes unnoticed. Everything for a
 * day is cancelled as soon as that day is answered or skipped (this re-runs whenever the record changes).
 */
export const syncCheckInReminders = async (opts: {
  enabled: boolean;
  time: string;
  /** Days answered or skipped on purpose. */
  coveredDates: readonly string[];
  since: string | null;
  dogName: string;
}): Promise<void> => {
  if (Platform.OS === "web") return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.identifier.startsWith("checkin")) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier).catch(() => {});
    }
  }
  if (!opts.enabled) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  const [hour, minute] = opts.time.split(":").map((part) => parseInt(part, 10));
  if (isNaN(hour) || isNaN(minute)) return;
  const now = Date.now();
  const covered = new Set(opts.coveredDates);
  const name = opts.dogName;

  // Missed days in a row by the end of a given day, if nothing more is answered before then.
  const runThrough = (day: Date) => {
    let run = 0;
    const at = new Date(day);
    while (run < 60) {
      const key = keyOf(at);
      if (covered.has(key) || (opts.since && key < opts.since)) break;
      run += 1;
      at.setDate(at.getDate() - 1);
    }
    return run;
  };

  const schedule = (identifier: string, date: Date, title: string, body: string, day: string) =>
    Notifications.scheduleNotificationAsync({
      identifier,
      content: { title, body, sound: true, data: { checkIn: day } },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date },
    }).catch(() => {});

  for (let offset = -1; offset < CHECKIN_DAYS_AHEAD; offset++) {
    const evening = new Date();
    evening.setDate(evening.getDate() + offset);
    evening.setHours(hour, minute, 0, 0);
    const day = keyOf(evening);
    if (covered.has(day) || (opts.since && day < opts.since)) continue;

    if (evening.getTime() > now) {
      await schedule(`checkin__${day}`, evening, `How is ${name} today?`, "Four quick questions: eating, energy, bathroom and anything odd.", day);
    }

    const late = new Date(evening.getTime() + LATE_NUDGE_MINUTES * 60_000);
    if (late.getTime() > now && late.getDate() === evening.getDate()) {
      await schedule(`checkin_late__${day}`, late, `${name}'s check-in is still open`, "Under a minute, and the day is saved.", day);
    }

    const morning = new Date(evening);
    morning.setDate(morning.getDate() + 1);
    morning.setHours(MORNING_HOUR, 0, 0, 0);
    if (morning.getTime() > now) {
      const run = runThrough(evening);
      await schedule(
        `checkin_missed__${day}`,
        morning,
        run > 1 ? `${run} days without a check-in` : `Yesterday's check-in was missed`,
        run > 1 ? `Gaps hide changes in ${name}'s health. Catch up in a few taps.` : `Fill in how ${name} was yesterday. It takes seconds.`,
        day,
      );
    }
  }
};

export type MedicationReminder = {
  id: string;
  name: string;
  dose: string | null;
  frequency: string;
  startDate: string;
  time: string;
};

export const syncMedicationReminders = async (meds: readonly MedicationReminder[], dogName: string): Promise<void> => {
  if (Platform.OS === "web") return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.identifier.startsWith("med__")) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier).catch(() => {});
    }
  }

  for (const med of meds) {
    const [hour, minute] = med.time.split(":").map((part) => parseInt(part, 10));
    if (isNaN(hour) || isNaN(minute)) continue;
    const [y, m, d] = med.startDate.split("-").map(Number);
    const start = new Date(y, m - 1, d);
    const trigger =
      med.frequency === "weekly"
        ? { type: SchedulableTriggerInputTypes.WEEKLY as const, weekday: start.getDay() + 1, hour, minute }
        : med.frequency === "monthly"
          ? { type: SchedulableTriggerInputTypes.MONTHLY as const, day: Math.min(start.getDate(), 28), hour, minute }
          : { type: SchedulableTriggerInputTypes.DAILY as const, hour, minute };
    await Notifications.scheduleNotificationAsync({
      identifier: `med__${med.id}`,
      content: {
        title: `${med.name} for ${dogName}`,
        body: med.dose ? `Time to give ${med.dose}.` : "Time for the next dose.",
        sound: true,
        data: { medicationId: med.id },
      },
      trigger,
    }).catch(() => {});
  }
};

const fallbackPreferences: NotificationPreferences = {
  dogMomentReminder: true,
  dailyQuestReminder: true,
  trainingReminder: true,
  streakAtRiskReminder: true,
  careEventReminder: true,
  weeklyRecap: true,
  reminderTime: "18:00",
};

export const getNotificationPreferences = async (): Promise<NotificationPreferences> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("notification_preferences").select("*").maybeSingle();
  throwIfError(error);
  if (!data) return fallbackPreferences;
  return {
    dogMomentReminder: data.dog_moment_reminder,
    dailyQuestReminder: data.daily_quest_reminder,
    trainingReminder: data.training_reminder,
    streakAtRiskReminder: data.streak_at_risk_reminder,
    careEventReminder: data.care_event_reminder,
    weeklyRecap: data.weekly_recap,
    reminderTime: data.reminder_time,
  };
};

export const saveNotificationPreferences = async (preferences: NotificationPreferences): Promise<NotificationPreferences> => {
  const client = getClientOrThrow();
  const user = await client.auth.getUser();
  throwIfError(user.error);
  const ownerId = user.data.user?.id;
  if (!ownerId) throw new Error("Authentication required.");
  const { error } = await client.from("notification_preferences").upsert({
    owner_id: ownerId,
    dog_moment_reminder: preferences.dogMomentReminder,
    daily_quest_reminder: preferences.dailyQuestReminder,
    training_reminder: preferences.trainingReminder,
    streak_at_risk_reminder: preferences.streakAtRiskReminder,
    care_event_reminder: preferences.careEventReminder,
    weekly_recap: preferences.weeklyRecap,
    reminder_time: preferences.reminderTime,
  });
  throwIfError(error);
  return preferences;
};

const doseNotifId = (kind: string) => `dose__${kind}`;

/** One reminder on the morning a preventive dose or check is next due. Replaces any earlier one for the same kind. */
export const scheduleDoseReminder = async (kind: string, date: string, title: string, body: string): Promise<void> => {
  if (Platform.OS === "web") return;
  await Notifications.cancelScheduledNotificationAsync(doseNotifId(kind)).catch(() => {});
  const [y, m, d] = date.split("-").map(Number);
  const at = new Date(y, m - 1, d, 9, 0, 0);
  if (at.getTime() <= Date.now()) return;
  if (!(await requestNotificationPermissions())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: doseNotifId(kind),
    content: { title, body, sound: true, data: { careKind: kind } },
    trigger: { type: SchedulableTriggerInputTypes.DATE, date: at },
  }).catch(() => {});
};

export const cancelDoseReminder = async (kind: string): Promise<void> => {
  if (Platform.OS === "web") return;
  await Notifications.cancelScheduledNotificationAsync(doseNotifId(kind)).catch(() => {});
};
