import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Small things this phone remembers about Number Trail, never synced: the host's meeting point for a match (the server
 * never stores it), and which matches' winners were already announced here, so a reconnect never celebrates twice.
 */
const AREA = (matchId: string) => `paws.numbertrail.area.${matchId}`;
const ANNOUNCED = "paws.numbertrail.announced.v1";
const ROUTE = (matchId: string) => `paws.numbertrail.route.${matchId}`;

export type Area = { latitude: number; longitude: number };

export const ntStore = {
  async area(matchId: string): Promise<Area | null> {
    try {
      const raw = await AsyncStorage.getItem(AREA(matchId));
      const a = raw ? (JSON.parse(raw) as Area) : null;
      return a && Number.isFinite(a.latitude) && Number.isFinite(a.longitude) ? a : null;
    } catch {
      return null;
    }
  },
  async setArea(matchId: string, a: Area) {
    await AsyncStorage.setItem(AREA(matchId), JSON.stringify({ latitude: a.latitude, longitude: a.longitude })).catch(() => undefined);
  },
  /** The host's chosen route for a race ("Race it"), offered as the shared course in the lobby. */
  async sharedRoute(matchId: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(ROUTE(matchId));
    } catch {
      return null;
    }
  },
  async setSharedRoute(matchId: string, candidateId: string) {
    await AsyncStorage.setItem(ROUTE(matchId), candidateId).catch(() => undefined);
  },
  async announced(): Promise<Set<string>> {
    try {
      return new Set(JSON.parse((await AsyncStorage.getItem(ANNOUNCED)) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  },
  async markAnnounced(matchId: string) {
    const set = await ntStore.announced();
    set.add(matchId);
    await AsyncStorage.setItem(ANNOUNCED, JSON.stringify([...set].slice(-50))).catch(() => undefined);
  },
};
