import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { Platform } from "react-native";

import { getClientOrThrow, throwIfError } from "@/services/serviceUtils";
import type { CareRoutine, NotificationPreferences } from "@/types/domain";

export const initNotifications = () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
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

export const syncCheckInReminders = async (opts: {
  enabled: boolean;
  time: string;
  answeredDates: readonly string[];
  dogName: string;
}): Promise<void> => {
  if (Platform.OS === "web") return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.identifier.startsWith("checkin__")) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier).catch(() => {});
    }
  }
  if (!opts.enabled) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  const [hour, minute] = opts.time.split(":").map((part) => parseInt(part, 10));
  if (isNaN(hour) || isNaN(minute)) return;
  const now = Date.now();

  for (let offset = 0; offset < CHECKIN_DAYS_AHEAD; offset++) {
    const at = new Date();
    at.setDate(at.getDate() + offset);
    at.setHours(hour, minute, 0, 0);
    const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
    if (at.getTime() <= now || opts.answeredDates.includes(key)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `checkin__${key}`,
      content: {
        title: `How is ${opts.dogName} today?`,
        body: "Four quick questions: eating, energy, bathroom and anything odd.",
        sound: true,
        data: { checkIn: key },
      },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: at },
    }).catch(() => {});
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
