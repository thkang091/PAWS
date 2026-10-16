import { useMemo } from "react";

import { consistencyOf } from "@/features/care/intel/consistency";
import { todayKey, useCheckInByDate, useCheckInSettings, useSkippedDates } from "@/features/care/state/dailyCheckIn";

/** The check-in record as kept, missed and rest days, for the lock, Care home and reminders. */
export const useConsistency = () => {
  const settings = useCheckInSettings();
  const entries = useCheckInByDate();
  const skipped = useSkippedDates();
  const today = todayKey();
  return useMemo(
    () => consistencyOf({ today, since: settings.enabled ? settings.since : null, entries, skipped, settledThrough: settings.settledThrough }),
    [today, settings.enabled, settings.since, settings.settledThrough, entries, skipped],
  );
};
