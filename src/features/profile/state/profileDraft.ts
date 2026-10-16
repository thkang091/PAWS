import { useCallback, useSyncExternalStore } from "react";
import { onWipe, syncedStorage as AsyncStorage } from "@/lib/cloudKv";

/** Profile edits persist on the device, so microchip numbers and contacts survive a restart. */
const KEY = "paws.profileDraft.v1";

type Overrides = Readonly<Record<string, string>>;

let overrides: Overrides = {};
let hydrated = false;
const listeners = new Set<() => void>();

void AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (raw) overrides = { ...(JSON.parse(raw) as Overrides), ...overrides };
  })
  .catch(() => undefined)
  .finally(() => {
    hydrated = true;
    listeners.forEach((listener) => listener());
  });

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const snapshot = () => overrides;

export const fieldKey = (section: string, label: string) => `${section}.${label}`;

export const setField = (section: string, label: string, value: string) => {
  overrides = { ...overrides, [fieldKey(section, label)]: value };
  listeners.forEach((listener) => listener());
  void AsyncStorage.setItem(KEY, JSON.stringify(overrides)).catch(() => undefined);
};

/** True once saved edits have loaded, so nothing decides from an empty draft. */
export const useProfileDraftHydrated = () => useSyncExternalStore(subscribe, () => hydrated, () => hydrated);

export const useProfileDraft = () => {
  const values = useSyncExternalStore(subscribe, snapshot, snapshot);

  const resolve = useCallback(
    (section: string, label: string, original: string) =>
      values[fieldKey(section, label)] ?? original,
    [values],
  );

  const isEdited = useCallback(
    (section: string, label: string) => fieldKey(section, label) in values,
    [values],
  );

  return { resolve, isEdited, setField };
};

// A reset of the account empties this store too.
onWipe(() => {
  overrides = {};
  listeners.forEach((listener) => listener());
});
