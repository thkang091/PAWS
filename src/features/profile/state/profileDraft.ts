import { useCallback, useSyncExternalStore } from "react";

type Overrides = Readonly<Record<string, string>>;

let overrides: Overrides = {};
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const snapshot = () => overrides;

export const fieldKey = (section: string, label: string) => `${section}.${label}`;

export const setField = (section: string, label: string, value: string) => {
  overrides = { ...overrides, [fieldKey(section, label)]: value };
  listeners.forEach((listener) => listener());
};

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
