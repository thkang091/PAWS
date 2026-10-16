import { useMemo } from "react";

import { ageInMonths } from "@/constants/carePlanByAge";
import { sizeOf, type Size } from "@/features/care/intel/careIntel";
import { useCareIntel } from "@/features/care/intel/useCareIntel";
import { useHealthRecord } from "@/features/care/state/healthRecord";
import { lifeStageLabel, questionsIn, SETS, setByKey, STAGE_FOCUS, trainingPlan, type SetKey, type SetQuestion, type StageLabel } from "@/features/profile/intel/profileSets";
import { setField, useProfileDraft } from "@/features/profile/state/profileDraft";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { preferredWeightUnit } from "@/lib/units";
import { useMedications } from "@/hooks/useCareHealth";
import { useWeightLogs } from "@/hooks/useWeightLogs";

export type SetState = {
  key: SetKey;
  title: string;
  why: string;
  section: string;
  questions: SetQuestion[];
  answers: Record<string, string>;
  answered: number;
  total: number;
};

const SIZE_WORD: Record<string, Size> = { Small: "small", Medium: "medium", Large: "large", Giant: "giant" };

/**
 * Every profile question set with what is answered, plus the life stage and the one-paragraph understanding of the
 * dog that Care and Train share. Basics answers come from the dog's real record (breed, age, sex, weight); the rest
 * from the synced profile draft.
 */
export const useProfileSets = () => {
  const dog = useCurrentDog();
  const weights = useWeightLogs(dog.data?.id);
  const intel = useCareIntel();
  const draft = useProfileDraft();
  const record = useHealthRecord();
  const meds = useMedications(dog.data?.id);

  return useMemo(() => {
    const d = dog.data;
    const name = d?.name ?? "your dog";
    const breed = d?.breed?.trim() || null;
    const stored = (section: string, id: string) => (draft.isEdited(section, id) ? draft.resolve(section, id, "") : "");
    // "Not sure" in onboarding saves a placeholder age; until it is answered, the life stage is unknown, not guessed.
    const months = stored("basics", "ageUnsure") ? null : ageInMonths(d?.birthday ?? null, d?.ageYears ?? null);
    const grown = SIZE_WORD[stored("basics", "adultSize")];
    const size: Size = grown ?? intel.size;
    const latest = weights.data?.[0];
    const unit = preferredWeightUnit(latest?.weightUnit);

    const sets: SetState[] = SETS.map((set) => {
      const answers: Record<string, string> = {};
      // Answers stored for this set, including follow-ups that only exist once earlier answers are in.
      const read = (questions: SetQuestion[]) => {
        for (const q of questions) {
          const value =
            q.special === "breed"
              ? breed ?? ""
              : q.special === "age"
                ? months != null
                  ? months < 12
                    ? `${months} ${months === 1 ? "month" : "months"}`
                    : `${Math.floor(months / 12)} ${Math.floor(months / 12) === 1 ? "year" : "years"}`
                  : ""
                : q.special === "sex"
                  ? d?.gender === "male"
                    ? "Boy"
                    : d?.gender === "female"
                      ? "Girl"
                      : ""
                  : q.special === "weight"
                    ? latest
                      ? `${latest.weightValue} ${latest.weightUnit}`
                      : ""
                    : stored(set.section, q.id);
          if (value) answers[q.id] = value;
        }
      };
      read(questionsIn(set.key, { breed, stage: intel.stage, size, months }, answers, unit));
      const questions = questionsIn(set.key, { breed, stage: intel.stage, size, months }, answers, unit);
      read(questions);
      return { ...set, why: set.why.replace(/the dog/g, name).replace(/this dog/g, name), questions, answers, answered: questions.filter((q) => answers[q.id]).length, total: questions.length };
    });

    const get = (key: SetKey) => sets.find((s) => s.key === key)!;
    const stage: StageLabel | null = lifeStageLabel(months, size);
    const all = (key: SetKey, id: string) => get(key).answers[id] ?? "";

    // ---------- How PAWS understands the dog ----------
    const sentences: string[] = [];
    const who = [stage?.toLowerCase(), breed ?? "dog"].filter(Boolean).join(" ");
    const body = [latest ? `about ${latest.weightValue} ${latest.weightUnit}` : null, all("basics", "fixed") === "Yes" ? (d?.gender === "female" ? "spayed" : "neutered") : null]
      .filter(Boolean)
      .join(" and ");
    sentences.push(`${name} is ${/^[aeiou]/i.test(who) ? "an" : "a"} ${who}${body ? `, ${body}` : ""}.`);
    const energy = all("personality", "energy");
    const motivation = all("personality", "motivation");
    const ENERGY: Record<string, string> = { "Couch potato": "Laid-back", Steady: "Steady", Busy: "Busy", "Non-stop": "High-energy" };
    const e = energy ? (ENERGY[energy] ?? energy) : null;
    const m = motivation ? motivation.toLowerCase() : null;
    if (e && m) sentences.push(`${e} and works for ${m}.`);
    else if (e) sentences.push(`${e} on a normal day.`);
    else if (m) sentences.push(`Works for ${m}.`);
    const home = all("home", "home");
    const alone = all("home", "aloneHours");
    if (home || alone) {
      sentences.push(
        [home ? `Lives in ${home.startsWith("Apartment") ? "an apartment" : home === "House with a yard" ? "a house with a yard" : "a house"}${all("home", "area") ? ` in the ${all("home", "area").toLowerCase()}` : ""}` : null, alone && alone !== "Rarely alone" ? `alone ${alone.toLowerCase()} on weekdays` : null]
          .filter(Boolean)
          .join(", ") + ".",
      );
    }
    const needs = all("baseline", "needs");
    if (needs && !/Nothing/.test(needs)) sentences.push(`Needs help with ${needs.toLowerCase()}.`);
    const conditions = record.items.filter((i) => i.kind === "condition").map((i) => i.insight?.name ?? i.name);
    const allergies = record.items.filter((i) => i.kind === "allergy").map((i) => i.name);
    const limits = [all("safety", "mobility"), all("safety", "limits")].filter((x) => x && !/freely|No limits/.test(x));
    const health = [
      conditions.length ? conditions.join(", ") : null,
      allergies.length ? `allergic to ${allergies.join(", ").toLowerCase()}` : null,
      (meds.data ?? []).some((m) => m.isActive) ? "on daily medication" : null,
      limits.length ? limits.join(", ").toLowerCase() : null,
    ].filter(Boolean);
    sentences.push(health.length ? `${health.join("; ").replace(/^./, (c) => c.toUpperCase())}.` : get("safety").answered ? "No health limits on file." : "");

    const answered = sets.reduce((n, s) => n + s.answered, 0);
    const total = sets.reduce((n, s) => n + s.total, 0);

    return {
      name,
      breed,
      months,
      size,
      stage,
      focus: stage ? STAGE_FOCUS[stage] : null,
      sets,
      get,
      understanding: sentences.filter(Boolean).join(" "),
      answered,
      total,
      plan: trainingPlan(get("baseline").answers),
      dogId: d?.id ?? null,
      unit,
      gender: d?.gender ?? null,
    };
  }, [dog.data, weights.data, intel.stage, intel.size, draft, record.items, meds.data]);
};

export const saveSetAnswer = (setKey: SetKey, id: string, value: string) => {
  const set = setByKey(setKey);
  if (set) setField(set.section, id, value);
};

/** Size from breed when nothing else is known, for the basics questions before a weigh-in. */
export const sizeForBreed = (breed: string | null) => sizeOf(breed, null);
