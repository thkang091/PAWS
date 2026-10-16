import { CARE_LABEL, isoOf, usualEvery, type CareKind, type LifeStage, type LogEntry } from "@/features/care/intel/careIntel";
import { logCare, removeCareEntry } from "@/features/care/state/careLog";
import { cancelDoseReminder, scheduleDoseReminder } from "@/services/notificationService";

const DAY = 86_400_000;

/** Kinds that are a visit or test to book, not a dose to give. */
export const VISIT_KINDS: readonly CareKind[] = ["wellness_exam", "bloodwork", "urinalysis", "fecal", "heartworm_test", "dental_cleaning"];

export const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + days).getTime());
};

export const daysBetween = (from: string, to: string) => {
  const at = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  return Math.round((at(to) - at(from)) / DAY);
};

/** The date the next dose or visit is due after one on `date`, or null when it has no schedule at this stage. */
export const nextDueAfter = (kind: CareKind, date: string, everyDays: number | null | undefined, stage: LifeStage) => {
  const every = everyDays ?? usualEvery(kind, stage);
  return every == null ? null : addDays(date, every);
};

export type Dose = {
  kind: CareKind;
  date: string;
  stage: LifeStage;
  dogName: string;
  product?: string | null;
  everyDays?: number | null;
  covers?: readonly CareKind[] | null;
  result?: string | null;
  note?: string | null;
  remind: boolean;
};

/**
 * Log a dose or visit and keep its reminder in step: one notification on the morning it is next due, filed under the
 * kind it was logged as. Kinds a combination product also covers drop their own reminders, so nothing fires twice.
 */
export const saveDose = (dose: Dose) => {
  const { kind, date, stage, dogName, remind, ...extra } = dose;
  const id = logCare(kind, date, { ...extra, remind });
  for (const other of dose.covers ?? []) if (other !== kind) void cancelDoseReminder(other);
  const next = nextDueAfter(kind, date, dose.everyDays, stage);
  if (remind && next) {
    const what = dose.product ?? CARE_LABEL[kind];
    void scheduleDoseReminder(kind, next, `${what} for ${dogName}`, VISIT_KINDS.includes(kind) ? "Time to book the next one." : "Time for the next dose.");
  } else void cancelDoseReminder(kind);
  return id;
};

export const undoDose = (id: string, kind: CareKind) => {
  removeCareEntry(id);
  void cancelDoseReminder(kind);
};

/** After an edit, put the reminder for this entry's kind back in step with its date, product and switch. */
export const syncDoseReminder = (entry: LogEntry, stage: LifeStage, dogName: string) => {
  const next = nextDueAfter(entry.kind, entry.date, entry.everyDays, stage);
  if (entry.remind && next) {
    const what = entry.product ?? CARE_LABEL[entry.kind];
    void scheduleDoseReminder(entry.kind, next, `${what} for ${dogName}`, VISIT_KINDS.includes(entry.kind) ? "Time to book the next one." : "Time for the next dose.");
  } else void cancelDoseReminder(entry.kind);
};
