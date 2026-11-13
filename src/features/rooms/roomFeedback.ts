import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";

/**
 * This phone's room feedback: sound effects and vibration, set in the room and kept on the phone (never synced).
 * There is no background music track in PAWS yet, so there is no music switch.
 */
export type RoomPrefs = { sound: boolean; vibration: boolean };
const KEY = "paws.rooms.prefs.v1";
const DEFAULTS: RoomPrefs = { sound: true, vibration: true };

let current: RoomPrefs = DEFAULTS;
let loaded = false;
const listeners = new Set<(p: RoomPrefs) => void>();

const load = async () => {
  if (loaded) return current;
  try {
    current = { ...DEFAULTS, ...(JSON.parse((await AsyncStorage.getItem(KEY)) ?? "{}") as Partial<RoomPrefs>) };
  } catch {
    current = DEFAULTS;
  }
  loaded = true;
  return current;
};

const SOUNDS = {
  join: require("../../../assets/sounds/arena/doorbell.wav"),
  start: require("../../../assets/sounds/arena/whistle.wav"),
  tap: require("../../../assets/sounds/arena/tick.wav"),
} as const;
type SoundKey = keyof typeof SOUNDS;
const players: Partial<Record<SoundKey, AudioPlayer>> = {};

export const roomFeedback = {
  /** A light tap, when vibration is on. */
  tap() {
    if (current.vibration) void Haptics.selectionAsync();
  },
  success() {
    if (current.vibration) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  /** A short sound effect, when sound is on. */
  play(key: SoundKey) {
    if (!current.sound) return;
    try {
      const p = players[key] ?? (players[key] = createAudioPlayer(SOUNDS[key]));
      p.seekTo(0);
      p.play();
    } catch {
      // Audio unavailable: silence is fine.
    }
  },
};

export const useRoomPrefs = () => {
  const [prefs, setPrefs] = useState<RoomPrefs>(current);
  useEffect(() => {
    void load().then(setPrefs);
    listeners.add(setPrefs);
    return () => void listeners.delete(setPrefs);
  }, []);
  const set = useCallback((patch: Partial<RoomPrefs>) => {
    current = { ...current, ...patch };
    for (const l of listeners) l(current);
    void AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => undefined);
  }, []);
  return { prefs, set };
};
