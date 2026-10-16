import { useState } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";

import { VACCINE_SCHEDULE } from "@/constants/careHealth";
import { UNUSUAL } from "@/features/care/components/DailyHealthCheckSheet";
import { CARE_LABEL, dueFor, entriesFor } from "@/features/care/intel/careIntel";
import { useCareIntel } from "@/features/care/intel/useCareIntel";
import { useCheckInHistory } from "@/features/care/state/dailyCheckIn";
import { useHealthRecord } from "@/features/care/state/healthRecord";
import { FACT_LABEL, factText, useMedicalFacts, type FactKey } from "@/features/profile/state/medicalFacts";
import { useProfileDraft } from "@/features/profile/state/profileDraft";
import { shareMedicalPdf, type MedicalPdf } from "@/services/medicalPdf";
import { useMedications, useVaccinations } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useWeightLogs } from "@/hooks/useWeightLogs";

export const FACTS: readonly FactKey[] = ["sensitivities", "surgeries", "injuries", "mobility", "dental", "skin"];

const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const fullDate = (iso: string) => `${LONG_MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;

/**
 * The record a vet reads, as one shareable PDF: the same document from the medical record and from Health records,
 * built from real data only (identity, allergies with label aliases, conditions in a vet's terms, medicines,
 * vaccines, prevention, visits, history, and signs noted at home in the last 14 days).
 */
export const useVetRecord = () => {
  const dog = useCurrentDog();
  const name = dog.data?.name ?? "your dog";
  const intel = useCareIntel();
  const record = useHealthRecord();
  const facts = useMedicalFacts();
  const vaccinations = useVaccinations(dog.data?.id);
  const medications = useMedications(dog.data?.id);
  const weights = useWeightLogs(dog.data?.id);
  const checkIns = useCheckInHistory();
  const draft = useProfileDraft();
  const [exporting, setExporting] = useState(false);

  const conditions = record.items.filter((i) => i.kind === "condition");
  const allergies = record.items.filter((i) => i.kind === "allergy");
  const meds = (medications.data ?? []).filter((m) => m.isActive);
  const shots = vaccinations.data ?? [];
  const missingCore = VACCINE_SCHEDULE.filter((v) => v.required && !shots.some((r) => r.vaccineKey === v.key));

  const build = (): MedicalPdf => {
    const d = dog.data;
    const latest = (weights.data ?? [])[0];
    const fixed = facts.surgeries?.picks.find((p) => p === "Spayed" || p === "Neutered");
    const idRows = (["Microchip number", "Microchip registry", "Registration", "Vet", "Insurance"] as const)
      .filter((label) => draft.isEdited("about", label))
      .map((label) => [label === "Vet" ? "Usual vet" : label, draft.resolve("about", label, "")] as const)
      .filter(([, v]) => v && v !== "Not recorded");
    const label = (kind: (typeof intel.log)[number]["kind"]) => CARE_LABEL[kind];
    const today = new Date();
    const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14).toISOString().slice(0, 10);
    return {
      dog: {
        name,
        breed: d?.breed || null,
        sex: d?.gender && d.gender !== "unknown" ? `${d.gender.charAt(0).toUpperCase()}${d.gender.slice(1)}${fixed ? `, ${fixed.toLowerCase()}` : ""}` : fixed ?? null,
        born: d?.birthday ? fullDate(d.birthday.slice(0, 10)) : null,
        age: d?.ageYears != null ? `${d.ageYears} ${d.ageYears === 1 ? "year" : "years"}` : null,
        weight: latest ? `${latest.weightValue} ${latest.weightUnit} (${fullDate(latest.recordedAt.slice(0, 10))})` : null,
        stage: intel.stage.charAt(0).toUpperCase() + intel.stage.slice(1),
      },
      ids: idRows,
      allergies: allergies.map((a) => ({ name: a.name, note: a.note, alsoListedAs: a.insight?.alsoListedAs ?? [] })),
      // A vet reads the standard term; the owner's own words stay beside it.
      conditions: conditions.map((c) => {
        const term = c.insight?.name && c.insight.name.toLowerCase() !== c.name.toLowerCase() ? c.insight.name : null;
        return { name: term ?? c.name, note: [term ? `Described by the owner as "${c.name}"` : "", c.note].filter(Boolean).join(". ") };
      }),
      medications: meds.map((m) => [m.medicationName, m.dosage ?? "", m.frequency.replace(/_/g, " "), fullDate(m.startDate.slice(0, 10))]),
      vaccinations: [...shots]
        .sort((a, b) => (a.dateGiven < b.dateGiven ? 1 : -1))
        .map((v) => [v.vaccineName, fullDate(v.dateGiven.slice(0, 10)), v.nextDueDate ? fullDate(v.nextDueDate.slice(0, 10)) : "", v.vetName ?? ""]),
      prevention: (["flea_tick", "heartworm_prev", "deworm"] as const).flatMap((kind) => {
        const due = dueFor(kind, intel.log, intel.stage, intel.today);
        if (!due.last) return [];
        return [[label(kind), entriesFor(kind, intel.log)[0]?.product ?? "", fullDate(due.last), due.next ? fullDate(due.next) : ""]];
      }),
      visits: intel.log
        .filter((e) => e.kind !== "brushing" && e.kind !== "flea_tick" && e.kind !== "heartworm_prev" && e.kind !== "deworm")
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((e) => [fullDate(e.date), label(e.kind), e.result ?? "", e.note ?? ""]),
      history: FACTS.flatMap((k) => {
        const written = factText(facts[k]);
        return written ? [[FACT_LABEL[k], written] as const] : [];
      }),
      recentSigns: checkIns
        .filter((c) => c.date >= cutoff && c.unusual.length)
        .map((c) => [fullDate(c.date), c.unusual.map((u) => UNUSUAL.find((x) => x.key === u)?.label ?? u).join(", "), c.unusualNote]),
      review: facts.review ? { vet: facts.review.vet, clinic: facts.review.clinic, date: fullDate(facts.review.date) } : null,
      owner: null,
      preparedOn: fullDate(intel.today),
    };
  };

  const share = async () => {
    if (exporting) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExporting(true);
    try {
      await shareMedicalPdf(build());
    } catch {
      Alert.alert("Could not make the PDF", "Try again in a moment.");
    } finally {
      setExporting(false);
    }
  };

  return {
    exporting,
    share,
    /** One line on what the PDF holds, for the card that shares it. */
    counts: { conditions: conditions.length, allergies: allergies.length, meds: meds.length, shots: shots.length, missingCore: missingCore.length },
    reviewed: facts.review ?? null,
  };
};
