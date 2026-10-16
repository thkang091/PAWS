import AsyncStorage from "@react-native-async-storage/async-storage";

import { onWipe } from "@/lib/cloudKv";

/**
 * A small on-device cache for answers from slow outside services (the gift card catalog, product searches), so a
 * screen can show the last answer at once and refresh behind it. Kept on this phone only, never synced; an account
 * reset clears it.
 */
const PREFIX = "paws.cache.v1:";

type Entry<T> = { at: number; value: T };

export const readCache = async <T>(key: string, maxAgeMs: number): Promise<{ value: T; at: number } | null> => {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    return Date.now() - entry.at <= maxAgeMs ? entry : null;
  } catch {
    return null;
  }
};

export const writeCache = <T>(key: string, value: T) => {
  const entry: Entry<T> = { at: Date.now(), value };
  void AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry)).catch(() => undefined);
};

onWipe(() => {
  void AsyncStorage.getAllKeys()
    .then((keys) => AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PREFIX))))
    .catch(() => undefined);
});
