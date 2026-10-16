import { useMemo } from "react";

import { BCS_WORDS, MOBILITY_NOUN, entriesFor } from "@/features/care/intel/careIntel";
import { useCareIntel } from "@/features/care/intel/useCareIntel";
import { useProfileSets } from "@/features/profile/intel/useProfileSets";
import { typicalEnergy } from "@/features/profile/intel/getToKnow";
import { useDogBasis } from "@/features/care/food/useDogBasis";
import { useCheckInHistory } from "@/features/care/state/dailyCheckIn";
import { useFoodPlan } from "@/features/care/state/foodPlan";
import { useHealthRecord } from "@/features/care/state/healthRecord";
import { FACT_LABEL, factText, useMedicalFacts, type FactKey } from "@/features/profile/state/medicalFacts";
import { useMedications } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";

/**
 * Everything PAWS knows about the dog, as one brief for Gemini that Care and Train share (food check, check-in
 * support, record explanations, the training coach). It is grouped in priority order, so safety limits always win
 * and what the guardian has seen beats what is typical for the breed.
 */
export type DogContext = {
  name: string;
  breed: string | null;
  ageYears: number | null;
  stage: "puppy" | "adult" | "senior";
  weightKg: number | null;
  allergies: readonly string[];
  /** The brief itself, ready to paste into a prompt. */
  brief: string;
};

const FACTS: readonly FactKey[] = ["sensitivities", "surgeries", "injuries", "mobility", "dental", "skin"];

export const useDogContext = (): DogContext => {
  const dog = useCurrentDog();
  const { basis, walking } = useDogBasis();
  const intel = useCareIntel();
  const record = useHealthRecord();
  const facts = useMedicalFacts();
  const meds = useMedications(dog.data?.id);
  const food = useFoodPlan();
  const history = useCheckInHistory();
  const sets = useProfileSets();

  return useMemo(() => {
    const d = dog.data;
    const name = d?.name ?? "the dog";
    const ageYears = basis.ageMonths != null ? Math.floor(basis.ageMonths / 12) : (d?.ageYears ?? null);
    const stage = intel.stage;
    const conditions = record.items
      .filter((i) => i.kind === "condition")
      .map((i) => `${i.insight?.name && i.insight.name.toLowerCase() !== i.name.toLowerCase() ? `${i.insight.name} (owner's words: ${i.name})` : i.name}${i.note ? `, ${i.note}` : ""}`);
    const allergies = basis.allergies;
    const activeMeds = (meds.data ?? []).filter((m) => m.isActive).map((m) => [m.medicationName, m.dosage, m.frequency.replace(/_/g, " ")].filter(Boolean).join(" "));
    const history7 = history.slice(0, 7);
    const off = (key: "appetite" | "energy" | "stool") => history7.filter((c) => c[key] && c[key] !== "normal").length;
    const signs = history7.flatMap((c) => c.unusual.map((u) => (u === "other" && c.unusualNote ? c.unusualNote : u)));
    const prevention = (["flea_tick", "heartworm_prev"] as const)
      .map((k) => entriesFor(k, intel.log)[0])
      .filter(Boolean)
      .map((e) => `${e!.product ?? e!.kind.replace("_", " ")} last given ${e!.date}`);
    const written = FACTS.flatMap((k) => {
      const t = factText(facts[k]);
      return t ? [`${FACT_LABEL[k]}: ${t}`] : [];
    });
    const bcs = food.profile.bcs;

    const set = (key: Parameters<typeof sets.get>[0]) => sets.get(key);
    const answered = (key: Parameters<typeof sets.get>[0], skip: readonly string[] = []) =>
      set(key)
        .questions.filter((q) => set(key).answers[q.id] && !skip.includes(q.id))
        .map((q) => `${q.short.toLowerCase()}: ${set(key).answers[q.id].toLowerCase()}`)
        .join("; ");
    const safety = answered("safety");
    const tendency = d?.breed ? typicalEnergy(d.breed) : null;

    // Sections in the order they win when they disagree. Breed comes last: what the guardian sees beats what is typical.
    const section = (title: string, rows: readonly string[]) => (rows.filter(Boolean).length ? [`${title}`, ...rows.filter(Boolean)] : []);
    const lines = [
      "PRIORITY when these disagree: 1 safety and medical, 2 current care state, 3 observed behaviour, 4 home and routine, 5 training, 6 preferences, 7 breed tendencies. Never suggest anything a safety limit rules out. Observed behaviour beats breed tendency.",
      `DOG: ${name}${d?.breed ? `, ${d.breed}` : ""}${d?.gender && d.gender !== "unknown" ? `, ${d.gender}${basis.neutered === true ? " (neutered or spayed)" : ""}` : ""}. ${sets.stage ? `Life stage: ${sets.stage.toLowerCase()}` : `Stage: ${stage}`}${ageYears != null ? `, ${ageYears} years` : ""}, ${sets.size} size.`,
      ...section("1 SAFETY AND MEDICAL:", [
        conditions.length ? `Conditions: ${conditions.join("; ")}.` : "Conditions: none recorded.",
        allergies.length ? `Allergies and intolerances: ${allergies.join(", ")}.` : "Allergies: none recorded.",
        activeMeds.length ? `Current medications: ${activeMeds.join("; ")}.` : "",
        safety ? `${safety}.` : "",
        written.length ? `History: ${written.join(". ")}.` : "",
        intel.mobility.status === "concern" || intel.mobility.status === "watch"
          ? `Movement in check-ins: ${intel.mobility.streak ? MOBILITY_NOUN[intel.mobility.streak.sign] : "some signs"} (${intel.mobility.status}).`
          : "",
      ]),
      ...section("2 CURRENT CARE:", [
        basis.weightKg != null ? `Weight ${basis.weightKg} kg${bcs ? `, body condition ${bcs}/9 (${BCS_WORDS[bcs].toLowerCase()})` : ""}${basis.goal ? `, goal ${basis.goal}` : ""}.` : "",
        food.plan ? `Food: ${food.plan.food.product.name}${food.plan.treats.length ? `; treats ${food.plan.treats.map((t) => t.product.name).join(", ")}` : ""}.` : "",
        walking ? `Walking: about ${walking.minutesPerDay} minutes a day this week (${walking.level}).` : "",
        history7.length
          ? `Last ${history7.length} check-ins: appetite off ${off("appetite")} times, energy off ${off("energy")}, stool off ${off("stool")}${signs.length ? `, unusual: ${signs.slice(0, 6).join(", ")}` : ""}.`
          : "",
        prevention.length ? `Parasite prevention: ${prevention.join("; ")}.` : "",
      ]),
      ...section("3 OBSERVED BEHAVIOUR (from the guardian):", [answered("personality", ["motivation"]) ? `${answered("personality", ["motivation"])}.` : ""]),
      ...section("4 HOME AND ROUTINE:", [answered("home") ? `${answered("home")}.` : ""]),
      ...section("5 TRAINING:", [answered("baseline") ? `${answered("baseline")}.` : "", sets.plan.length ? `Plan order: ${sets.plan.join(", ")}.` : ""]),
      ...section("6 PREFERENCES:", [set("personality").answers.motivation ? `Works for: ${set("personality").answers.motivation.toLowerCase()}.` : ""]),
      ...section("7 BREED TENDENCIES (lowest priority):", [tendency ? `${d!.breed}s are often ${tendency.toLowerCase()} energy. Use only if nothing above says otherwise.` : ""]),
    ].filter(Boolean);

    return {
      name,
      breed: d?.breed ?? null,
      ageYears,
      stage,
      weightKg: basis.weightKg,
      allergies,
      brief: lines.join("\n"),
    };
  }, [dog.data, basis, walking, intel, record.items, facts, meds.data, food.profile.bcs, food.plan, history, sets]);
};
