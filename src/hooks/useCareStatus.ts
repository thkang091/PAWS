import { useMemo } from "react";

import { useMedications, useTodayMedicationLogs, useVaccinations } from "@/hooks/useCareHealth";
import type { CareArea } from "@/features/care/components/healthData";
import { useProfileDraft } from "@/features/profile/state/profileDraft";

const daysUntil = (iso: string): number => Math.floor((new Date(iso).getTime() - Date.now()) / 86400000);

const NONE_RECORDED = "None recorded";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pretty = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

export const useCareStatusAreas = (dogId?: string): { areas: CareArea[]; loading: boolean } => {
  const medications = useMedications(dogId);
  const medicationLogsToday = useTodayMedicationLogs(dogId);
  const vaccinations = useVaccinations(dogId);
  const draft = useProfileDraft();

  const areas = useMemo<CareArea[]>(() => {
    const activeMeds = medications.data ?? [];
    const givenTodayIds = new Set((medicationLogsToday.data ?? []).map((log) => log.medicationId));
    const medsGiven = activeMeds.filter((med) => givenTodayIds.has(med.id)).length;
    const medicationArea: CareArea = activeMeds.length === 0
      ? { key: "medication", label: "Medication", status: "None active", detail: "No active medications on record", state: "ontrack", progress: 1, href: "/care/medications" }
      : {
          key: "medication",
          label: "Medication",
          status: medsGiven === activeMeds.length ? "Given today" : "Needs attention",
          detail: medsGiven === activeMeds.length
            ? `All ${activeMeds.length} medication${activeMeds.length === 1 ? "" : "s"} given today`
            : `${activeMeds.length - medsGiven} of ${activeMeds.length} still due today`,
          state: medsGiven === activeMeds.length ? "ontrack" : "attention",
          progress: medsGiven / activeMeds.length,
          href: "/care/medications",
        };

    const vax = vaccinations.data ?? [];
    const overdue = vax.find((v) => v.nextDueDate && daysUntil(v.nextDueDate) < 0);
    const upcoming = vax
      .filter((v) => v.nextDueDate)
      .sort((a, b) => (a.nextDueDate ?? "").localeCompare(b.nextDueDate ?? ""))[0];
    const vaccinationArea: CareArea = vax.length === 0
      ? { key: "vaccinations", label: "Vaccinations", status: "Not on record", detail: "No vaccinations logged yet", state: "attention", progress: 0, href: "/care/vaccinations" }
      : overdue
        ? { key: "vaccinations", label: "Vaccinations", status: "Overdue", detail: `${overdue.vaccineName} was due ${pretty(overdue.nextDueDate!)}`, state: "attention", progress: 0.5, href: "/care/vaccinations" }
        : { key: "vaccinations", label: "Vaccinations", status: "Up to date", detail: upcoming?.nextDueDate ? `Next due ${pretty(upcoming.nextDueDate)}` : "All recorded vaccinations are current", state: "ontrack", progress: 0.92, href: "/care/vaccinations" };

    const conditions = draft.resolve("health", "Known conditions", NONE_RECORDED);
    const allergies = draft.resolve("health", "Allergies", NONE_RECORDED);
    const conditionsClear = conditions === NONE_RECORDED;
    const allergiesClear = allergies === NONE_RECORDED;
    const conditionsArea: CareArea =
      conditionsClear && allergiesClear
        ? {
            key: "conditions",
            label: "Conditions & allergies",
            status: "None recorded",
            detail: "No conditions or allergies on file",
            state: "ontrack",
            progress: 1,
            href: "/profile/health",
          }
        : {
            key: "conditions",
            label: "Conditions & allergies",
            status: "On file",
            detail: [
              !conditionsClear ? conditions : null,
              !allergiesClear ? allergies : null,
            ]
              .filter(Boolean)
              .join(" · "),
            state: "ontrack",
            progress: 1,
            href: "/profile/health",
          };

    return [medicationArea, vaccinationArea, conditionsArea];
  }, [medications.data, medicationLogsToday.data, vaccinations.data, draft]);

  const loading = medications.isLoading || vaccinations.isLoading;

  return { areas, loading };
};

export const careStatusSummary = (areas: readonly CareArea[]) => {
  const onTrack = areas.filter((area) => area.state === "ontrack").length;
  return {
    onTrack,
    total: areas.length,
    verdict: onTrack === areas.length ? "Great" : onTrack >= areas.length - 1 ? "Good" : "Check in",
  };
};
