import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { Platform } from "react-native";

import { getClientOrThrow, throwIfError } from "@/services/serviceUtils";
import type { CareRoutine, NotificationPreferences } from "@/types/domain";

// ── Global handler (call once at app startup via initNotifications) ──────────

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

// ── Permissions ──────────────────────────────────────────────────────────────

export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
};

// ── Stable identifier per routine ────────────────────────────────────────────

const routineNotifId = (routineKey: string) => `care_routine__${routineKey}`;

// ── Schedule a single daily reminder ─────────────────────────────────────────

export const scheduleRoutineReminder = async (
  routineKey: string,
  title: string,
  reminderTime: string,   // "HH:MM" 24-hour
): Promise<void> => {
  const [hStr, mStr] = reminderTime.split(":");
  const hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);
  if (isNaN(hour) || isNaN(minute)) return;

  // Cancel any existing notification for this routine first
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

// ── Cancel a single routine's reminder ───────────────────────────────────────

export const cancelRoutineReminder = async (routineKey: string): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(routineNotifId(routineKey)).catch(() => {});
};

// ── Re-sync all reminders after routines are saved ───────────────────────────
// Cancels all existing care_routine__ notifications, then re-schedules
// only routines that have a reminderTime set.

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

// ── Preferences (Supabase) ───────────────────────────────────────────────────

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
