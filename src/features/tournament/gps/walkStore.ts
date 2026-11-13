import AsyncStorage from "@react-native-async-storage/async-storage";

import type { TrackPoint } from "../../../../supabase/functions/tournament/geo";

/**
 * The walk in progress, kept on this phone only, so a lost connection or a restart does not lose it. It is removed
 * the moment the walk is handed in or cancelled. Raw routes are never put in cloud-synced storage.
 */

const KEY = "paws.tournament.walk.v1";

export type StoredWalk = {
  sessionId: string;
  tournamentId: string;
  startedAt: string;
  points: TrackPoint[];
  sentThrough: number;
  nextSeq: number;
  segment: number;
  activeMs: number;
  paused: boolean;
};

export const walkStore = {
  async load(): Promise<StoredWalk | null> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return null;
      const walk = JSON.parse(raw) as StoredWalk;
      return walk && typeof walk.sessionId === "string" && Array.isArray(walk.points) ? walk : null;
    } catch {
      return null;
    }
  },
  async save(walk: StoredWalk) {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(walk));
    } catch {
      // Full storage only costs the restart safety net; the walk itself keeps going.
    }
  },
  async clear() {
    await AsyncStorage.removeItem(KEY).catch(() => undefined);
  },
};
