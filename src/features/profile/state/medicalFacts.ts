import { useSyncExternalStore } from "react";
import { onWipe, syncedStorage as AsyncStorage } from "@/lib/cloudKv";

import { setField } from "@/features/profile/state/profileDraft";

/**
 * The standing parts of the medical record that are not lists: sensitivities, surgeries, injuries, mobility, dental,
 * skin and coat. Each keeps the quick choices picked and any details typed, and mirrors a plain sentence into the
 * profile draft so the emergency brief and other readers see the same text.
 */
export type FactKey = "sensitivities" | "surgeries" | "injuries" | "mobility" | "dental" | "skin";
export type Fact = { picks: readonly string[]; detail: string; updatedAt: number };

export const FACT_LABEL: Record<FactKey, string> = {
  sensitivities: "Sensitivities",
  surgeries: "Surgeries",
  injuries: "Injuries",
  mobility: "Mobility",
  dental: "Dental",
  skin: "Skin & coat",
};

/** Quick choices for each field. The first is the all-clear answer and clears the others. */
export const FACT_OPTIONS: Record<FactKey, readonly string[]> = {
  sensitivities: ["None", "Sensitive stomach", "Rich food", "Grass or pollen", "Some shampoos", "Loud noises"],
  surgeries: ["None", "Spayed", "Neutered", "Dental extraction", "Lump removed", "Knee (cruciate)", "Other surgery"],
  injuries: ["None", "Sprain", "Broken bone", "Cut or bite", "Paw pad injury", "Back injury"],
  mobility: ["No concerns", "Stiff after rest", "Arthritis", "Hip dysplasia", "Slower on walks", "Avoids stairs"],
  dental: ["Healthy", "Mild tartar", "Gum redness", "Needs a cleaning", "Missing teeth"],
  skin: ["Healthy", "Seasonal shedding", "Dry or flaky", "Itchy", "Hot spots", "Lumps to watch"],
};

const KEY = "paws.medicalFacts.v1";
/** A vet's review of the printed record, entered by the guardian after the visit. */
export type VetReview = { vet: string; clinic: string; date: string; at: number };
type State = Readonly<Partial<Record<FactKey, Fact>> & { review?: VetReview }>;

let state: State = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

void AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (raw) state = { ...(JSON.parse(raw) as State), ...state };
  })
  .catch(() => undefined)
  .finally(emit);

/** "Neutered, Dental extraction. Done in 2023" */
export const factText = (fact: Fact | undefined) => {
  if (!fact) return null;
  const parts = [fact.picks.join(", "), fact.detail.trim()].filter(Boolean);
  return parts.length ? parts.join(". ") : null;
};

export const saveFact = (key: FactKey, picks: readonly string[], detail: string) => {
  const fact: Fact = { picks, detail: detail.trim(), updatedAt: Date.now() };
  const empty = !picks.length && !fact.detail;
  const next = { ...state };
  if (empty) delete next[key];
  else next[key] = fact;
  state = next;
  emit();
  setField("health", FACT_LABEL[key], factText(fact) ?? "Not recorded");
  void AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
};

export const saveVetReview = (review: Omit<VetReview, "at"> | null) => {
  const next = { ...state };
  if (review) next.review = { ...review, at: Date.now() };
  else delete next.review;
  state = next;
  emit();
  void AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
};

export const useMedicalFacts = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );

// A reset of the account empties this store too.
onWipe(() => {
  state = {};
  emit();
});
