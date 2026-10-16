import { useMemo } from "react";

import { useCareIntel } from "@/features/care/intel/useCareIntel";
import { questionsFor, SECTION, type KnowQuestion } from "@/features/profile/intel/getToKnow";
import { setField, useProfileDraft } from "@/features/profile/state/profileDraft";
import { useCurrentDog } from "@/hooks/useCurrentDog";

/** The dog's questions and what has been answered so far. Answers live in the synced profile draft. */
export const useKnow = () => {
  const dog = useCurrentDog();
  const intel = useCareIntel();
  const draft = useProfileDraft();
  const breed = dog.data?.breed?.trim() || null;

  return useMemo(() => {
    const questions: KnowQuestion[] = questionsFor({ breed, stage: intel.stage, size: intel.size });
    const answers: Record<string, string> = {};
    for (const q of questions) if (draft.isEdited(SECTION, q.id)) answers[q.id] = draft.resolve(SECTION, q.id, "");
    const answered = questions.filter((q) => answers[q.id]);
    // Breed and age decide which questions matter, so they are asked first when missing.
    const basics = [...(breed ? [] : (["breed"] as const)), ...(dog.data && dog.data.birthday == null && dog.data.ageYears == null ? (["age"] as const) : [])];
    return {
      name: dog.data?.name ?? "your dog",
      breed,
      stage: intel.stage,
      questions,
      answers,
      dogId: dog.data?.id ?? null,
      basics,
      answered: answered.length,
      total: questions.length + basics.length,
      next: questions.find((q) => !answers[q.id]) ?? null,
    };
  }, [dog.data?.name, breed, intel.stage, intel.size, draft]);
};

export const saveAnswer = (id: string, value: string) => setField(SECTION, id, value);
