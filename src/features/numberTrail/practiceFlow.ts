/**
 * Number Trail practice (phase P2): the steps of a solo walk as pure functions, so the screen only draws them.
 * Your number, a place, an honest search outward in steps, a choice of real courses, the walk, the server's check.
 * Practice is never ranked and never touches races or standings.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { parseTargetNumber, type NumberInputError } from "../../../supabase/functions/tournament/numberInput";
import type { NumberCourse } from "../../../supabase/functions/tournament/numberMatch";
import type { PracticeResult } from "../../../supabase/functions/tournament/numberContract";

export type PracticeStep = "number" | "place" | "search" | "choose" | "walk" | "result";

// ---------- The number ----------

/** Keypad input: at most two characters, digits only. What the player typed, never corrected for them. */
export const typeKey = (current: string, key: string) => {
  if (key === "back") return current.slice(0, -1);
  if (key === "clear") return "";
  if (!/^[0-9]$/.test(key) || current.length >= 2) return current;
  return current + key;
};

export const NUMBER_INPUT_LINES: Record<NumberInputError, string> = {
  empty: "Type a number from 0 to 99.",
  zero: "Type 0 on its own.",
  leading_zero: "No leading zero. Type 7, not 07.",
  too_big: "Up to 99.",
  negative: "Whole numbers from 0 to 99.",
  decimal: "Whole numbers only.",
  not_a_number: "Digits only.",
};

/** The keypad's state: the number when it is one, otherwise the line to show (none while still empty). */
export const numberEntry = (typed: string) => {
  const r = parseTargetNumber(typed);
  if (r.ok === false) return { ok: false as const, number: null, line: typed === "" ? null : NUMBER_INPUT_LINES[r.error] };
  return { ok: true as const, number: r.number, line: r.digits.length === 1 ? "One digit" : "Two digits" };
};

// ---------- The search ----------

/** Searched without asking, nearest first. 3 km only when the player asks for it. */
export const AUTO_RADII = [500, 1_000, 2_000] as const;
export const WIDE_RADIUS = 3_000 as const;
export type Radius = (typeof AUTO_RADII)[number] | typeof WIDE_RADIUS;

export type StageState = "waiting" | "searching" | "none" | "found" | "error";
export type Stage = { radiusM: Radius; state: StageState };

export const radiusLabel = (m: number) => (m < 1_000 ? `${m} m` : `${m / 1_000} km`);

/** The stages shown while searching, from what has happened so far. Nothing is shown as found until the server says so. */
export const searchStages = (done: { radiusM: Radius; found: boolean; error?: boolean }[], searching: Radius | null, wide: boolean): Stage[] => {
  const radii: Radius[] = wide ? [...AUTO_RADII, WIDE_RADIUS] : [...AUTO_RADII];
  return radii.map((radiusM) => {
    const d = done.find((x) => x.radiusM === radiusM);
    if (d) return { radiusM, state: d.error ? "error" : d.found ? "found" : "none" };
    return { radiusM, state: searching === radiusM ? "searching" : "waiting" };
  });
};

/** The next radius to search after `done`, or null: stop when found, when it failed, or when out of automatic steps. */
export const nextRadius = (done: { radiusM: Radius; found: boolean; error?: boolean }[], wide: boolean): Radius | null => {
  const last = done[done.length - 1];
  if (last && (last.found || last.error)) return null;
  const radii: Radius[] = wide ? [...AUTO_RADII, WIDE_RADIUS] : [...AUTO_RADII];
  return radii.find((r) => !done.some((d) => d.radiusM === r)) ?? null;
};

/** After the automatic steps found nothing: offer 3 km once, then say so plainly. */
export const searchOutcome = (done: { radiusM: Radius; found: boolean; error?: boolean }[], wide: boolean): "searching" | "found" | "offer_wider" | "none" | "error" => {
  const last = done[done.length - 1];
  if (last?.error) return "error";
  if (last?.found) return "found";
  if (nextRadius(done, wide) != null) return "searching";
  return wide ? "none" : "offer_wider";
};

// ---------- Results ----------

export const kmText = (m: number) => (m < 1_000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1_000).toFixed(1)} km`);
/** Official course lengths in an online race, where tens of metres matter. */
export const kmPrecise = (m: number) => `${(m / 1_000).toFixed(2)} km`;

/** Walking directions to a course's start in Google Maps (no personal data in the link: only the destination). */
export const directionsUrl = (to: { latitude: number; longitude: number }) => `https://www.google.com/maps/dir/?api=1&destination=${to.latitude.toFixed(6)},${to.longitude.toFixed(6)}&travelmode=walking`;

/** What the result screen says, from the server's check only. */
export const practiceSummary = (r: PracticeResult, number: string) => {
  const missingDigits = [...new Set(r.missing.map((m) => m.digit))];
  const title = r.eligible ? "Number complete" : "Not complete yet";
  const line = r.eligible
    ? `You walked ${number} on real streets.`
    : !r.atStart
      ? "Your walk didn't reach the start flag, so nothing counted."
      : r.gps.jumps > 0
        ? "Your GPS jumped, so part of the walk can't be checked."
        : missingDigits.length
          ? `Some of digit ${missingDigits.map((k) => number[k - 1]).join(" and ")} is still to walk.`
          : r.finish && !r.finish.reached
            ? "The finish stretch is still to walk."
            : "Part of the course is still to walk.";
  return { title, line, walked: kmText(r.walkedM), minutes: Math.max(0, Math.round(r.activeMs / 60_000)), missing: r.missing.length };
};

// ---------- A walk survives a restart ----------

export type SavedPractice = { practiceId: string; sessionId: string; startedAt: string; number: string; officialM: number; course: NumberCourse };
const KEY = "paws.numbertrail.practice";
export const practiceStore = {
  load: async (): Promise<SavedPractice | null> => {
    try {
      const v = JSON.parse((await AsyncStorage.getItem(KEY)) ?? "null") as SavedPractice | null;
      return v && typeof v.practiceId === "string" && v.course ? v : null;
    } catch {
      return null;
    }
  },
  save: (p: SavedPractice) => AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => undefined),
  clear: () => AsyncStorage.removeItem(KEY).catch(() => undefined),
};
