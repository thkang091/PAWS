import AsyncStorage from "@react-native-async-storage/async-storage";

import { getSupabaseClient } from "@/lib/supabase";

/**
 * Device storage that is also kept in the account. The care stores (log, check-ins, health record, medical facts, food
 * plan, planned walks, profile edits and set-up answers) save to AsyncStorage as before, and each save is copied to
 * Supabase `user_kv`, one row per store per account. On a new phone or after a reinstall the device is empty, so the
 * first read waits briefly for the account copy. Linking an anonymous account keeps the same user, so nothing moves.
 * Until the `user_kv` migration is applied, the cloud side switches itself off and the app works exactly as before.
 */
const SYNCED = new Set([
  "paws.careLog.v1",
  "paws.dailyCheckIn.v1",
  "paws.healthRecord.v1",
  "paws.medicalFacts.v1",
  "paws.foodPlan.v1",
  "paws.plannedWalks.v1",
  "paws.profileDraft.v1",
  "paws.careOnboarding.v1",
  "paws.groomingSetup.v1",
  "paws.walkPlaces.v1",
  "paws.careLocations.v1",
]);

const RESTORE_WAIT_MS = 4000;
const UPLOAD_DELAY_MS = 1200;

let disabled = false;
let restore: Promise<void> | null = null;
const pending = new Map<string, ReturnType<typeof setTimeout>>();

/** The table is missing (migration not applied yet) or the API refuses: stop trying until the next launch. */
const isMissingTable = (error: { code?: string; message?: string } | null) =>
  Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /user_kv/.test(error.message ?? "")));

const table = () => {
  const client = getSupabaseClient();
  // The generated Database types do not know user_kv yet.
  return client ? (client as unknown as { from: (t: string) => any; auth: typeof client.auth }) : null;
};

const ownerId = async () => {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.user.id ?? null;
};

const upload = async (key: string, raw: string) => {
  if (disabled) return;
  const db = table();
  const owner = await ownerId();
  if (!db || !owner) return;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return;
  }
  const { error } = await db.from("user_kv").upsert({ owner_id: owner, key, value, updated_at: new Date().toISOString() }, { onConflict: "owner_id,key" });
  if (isMissingTable(error)) disabled = true;
  else if (error && __DEV__) console.warn(`[cloudKv] upload ${key}: ${error.message}`);
};

const doRestore = async () => {
  const db = table();
  const owner = await ownerId();
  if (!db || !owner) return;
  const { data, error } = await db.from("user_kv").select("key, value");
  if (error) {
    if (isMissingTable(error)) disabled = true;
    else if (__DEV__) console.warn(`[cloudKv] restore: ${error.message}`);
    return;
  }
  const remote = new Map<string, unknown>((data as { key: string; value: unknown }[] | null ?? []).map((row) => [row.key, row.value]));
  for (const key of SYNCED) {
    const local = await AsyncStorage.getItem(key);
    if (local == null && remote.has(key)) {
      // A fresh device: bring the account copy down before the store reads it.
      await AsyncStorage.setItem(key, JSON.stringify(remote.get(key)));
    } else if (local != null && !remote.has(key)) {
      // Data from before syncing existed: back it up once.
      void upload(key, local);
    }
  }
};

/** Start (or join) the one restore per launch, bounded so an offline start never hangs a screen. */
const restored = () => {
  restore ??= doRestore().catch(() => undefined);
  return Promise.race([restore, new Promise<void>((resolve) => setTimeout(resolve, RESTORE_WAIT_MS))]);
};

export const syncedStorage = {
  getItem: async (key: string) => {
    const local = await AsyncStorage.getItem(key);
    if (local != null || !SYNCED.has(key)) {
      if (SYNCED.has(key)) void restored();
      return local;
    }
    await restored();
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, raw: string) => {
    await AsyncStorage.setItem(key, raw);
    if (!SYNCED.has(key) || disabled) return;
    const timer = pending.get(key);
    if (timer) clearTimeout(timer);
    // Saves often come in bursts (a check-in, a plan edit); send the last one.
    pending.set(
      key,
      setTimeout(() => {
        pending.delete(key);
        void upload(key, raw);
      }, UPLOAD_DELAY_MS),
    );
  },
};

// ---------- Wiping (account reset) ----------

const wipers = new Set<() => void>();

/** Stores register how to go back to empty, so a reset clears what is on screen without restarting the app. */
export const onWipe = (reset: () => void) => {
  wipers.add(reset);
};

/** Remove every PAWS key on this device and empty every store. Sign-in (Supabase session) keys are kept. */
export const wipeLocalData = async () => {
  for (const timer of pending.values()) clearTimeout(timer);
  pending.clear();
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith("paws."));
  if (keys.length) await AsyncStorage.multiRemove(keys);
  restore = null;
  wipers.forEach((reset) => reset());
};
