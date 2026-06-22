-- ============================================================
-- Migration 0033 — Add optional reminder_time to care routines
-- ============================================================
-- Stores the user's chosen local reminder time ("HH:MM", 24-hour)
-- for each active care routine. The mobile app uses this value to
-- schedule a daily local notification via expo-notifications.
-- NULL means no reminder is set for that routine.

alter table dog_care_routines
  add column if not exists reminder_time text
    constraint reminder_time_format check (
      reminder_time is null
      or reminder_time ~ '^([01]\d|2[0-3]):[0-5]\d$'
    );
