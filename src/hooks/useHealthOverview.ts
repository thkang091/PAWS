import { useMemo } from "react";

import { VACCINE_SCHEDULE } from "@/constants/careHealth";
import { summarize } from "@/features/care/health/checkInSummary";
import { dueOn, isFinished, todayKey } from "@/features/care/health/medPlan";
import { useCheckInByDate, useCheckInSettings } from "@/features/care/state/dailyCheckIn";
import { useMedicationLogsBetween, useMedications, useVaccinations } from "@/hooks/useCareHealth";

export type RingKey = "checkins" | "medication" | "vaccines";

export type Ring = {
  key: RingKey;
  label: string;
  done: number;
  total: number;
  value: string;
  detail: string;
  state: "good" | "attention" | "none";
  href: string;
};

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const thisWeek = () => {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return dayKey(d);
  });
};

export const useHealthOverview = (dogId?: string) => {
  const today = todayKey();
  const settings = useCheckInSettings();
  const byDate = useCheckInByDate();
  const medications = useMedications(dogId);
  const medLogs = useMedicationLogsBetween(dogId, today, today);
  const vaccinations = useVaccinations(dogId);

  return useMemo(() => {
    const days = thisWeek().filter((key) => key <= today);
    const answered = days.filter((key) => byDate[key]);
    const steady = answered.filter((key) => summarize(byDate[key]).every((stat) => stat.ok));
    const checkins: Ring = !settings.enabled
      ? { key: "checkins", label: "Check-ins", done: 0, total: 0, value: "Off", detail: "Turn on the evening check-in", state: "none", href: "checkin" }
      : {
          key: "checkins",
          label: "Check-ins",
          done: answered.length,
          total: days.length,
          value: `${answered.length} of ${days.length}`,
          detail:
            answered.length === 0
              ? "None answered this week"
              : steady.length === answered.length
                ? "All normal this week"
                : `${answered.length - steady.length} ${answered.length - steady.length === 1 ? "day" : "days"} with something off`,
          state: answered.length === days.length && steady.length === answered.length ? "good" : "attention",
          href: "checkin",
        };

    const meds = (medications.data ?? []).filter((med) => !isFinished(med) && dueOn(med, today));
    const given = new Set((medLogs.data ?? []).map((log) => log.medicationId));
    const givenCount = meds.filter((med) => given.has(med.id)).length;
    const medication: Ring =
      meds.length === 0
        ? {
            key: "medication",
            label: "Medication",
            done: 0,
            total: 0,
            value: "None due",
            detail: (medications.data ?? []).length ? "Nothing scheduled today" : "No medications on record",
            state: "none",
            href: "/care/medications",
          }
        : {
            key: "medication",
            label: "Medication",
            done: givenCount,
            total: meds.length,
            value: `${givenCount} of ${meds.length}`,
            detail: givenCount === meds.length ? "All given today" : `${meds.length - givenCount} still to give today`,
            state: givenCount === meds.length ? "good" : "attention",
            href: "/care/medications",
          };

    const core = VACCINE_SCHEDULE.filter((item) => item.required);
    const records = vaccinations.data ?? [];
    const covered = core.filter((item) => {
      const latest = records.find((record) => record.vaccineKey === item.key);
      return Boolean(latest?.nextDueDate && latest.nextDueDate >= today);
    });
    const missing = core.filter((item) => !covered.includes(item)).map((item) => item.name.replace(/\s*\(.*\)$/, ""));
    const vaccines: Ring = {
      key: "vaccines",
      label: "Core vaccines",
      done: covered.length,
      total: core.length,
      value: `${covered.length} of ${core.length}`,
      detail: missing.length === 0 ? "All core shots current" : `${missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}`} ${missing.length === 1 ? "needs" : "need"} a record`,
      state: missing.length === 0 ? "good" : "attention",
      href: "/care/vaccinations",
    };

    const rings = [checkins, medication, vaccines];
    const needs = rings.filter((ring) => ring.state === "attention");
    const headline =
      needs.length === 0 ? "On track" : needs.length === 1 ? `${needs[0].label} needs you` : `${needs.length} things need you`;

    return {
      rings,
      headline,
      needs: needs.length,
      loading: medications.isLoading || vaccinations.isLoading,
    };
  }, [today, settings.enabled, byDate, medications.data, medications.isLoading, medLogs.data, vaccinations.data, vaccinations.isLoading]);
};
