import type { ComponentType } from "react";
import {
  ArrowLineDownIcon,
  ArrowsClockwiseIcon,
  ChairIcon,
  HandIcon,
  PawPrintIcon,
  SparkleIcon,
  type IconProps,
} from "phosphor-react-native";

import type { ArenaGame } from "@/services/arenaService";

export const GAMES: Record<ArenaGame, { title: string; short: string; goal: string; direction: string }> = {
  longest_sit: { title: "Longest Sit", short: "Sit", goal: "Hold the sit while the sounds try to break it.", direction: "Longest wins" },
  trick_combo: { title: "Trick Combo", short: "Combo", goal: "Four tricks, in order, as fast as you can.", direction: "Fastest wins" },
};

export const TRICK_INFO: Record<string, { label: string; Icon: ComponentType<IconProps> }> = {
  sit: { label: "Sit", Icon: ChairIcon },
  down: { label: "Down", Icon: ArrowLineDownIcon },
  spin: { label: "Spin", Icon: ArrowsClockwiseIcon },
  paw: { label: "Paw", Icon: PawPrintIcon },
  touch: { label: "Touch", Icon: HandIcon },
  bow: { label: "Bow", Icon: SparkleIcon },
};

/** Sit: minutes and seconds. Combo: seconds to a tenth. */
export const formatScore = (game: ArenaGame, ms: number | null | undefined) => {
  if (ms == null) return "-";
  if (game === "trick_combo") return `${(ms / 1000).toFixed(1)}s`;
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const formatClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const ordinal = (n: number) => {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${tail}`;
};

/** Sit tiers shown on the live timer. */
export const SIT_TIERS = [
  { label: "Bronze", ms: 30_000 },
  { label: "Silver", ms: 60_000 },
  { label: "Gold", ms: 120_000 },
] as const;

/** Why a clip did not score, in a line the owner can act on. */
export const REASONS: Record<string, string> = {
  code_not_heard: "We couldn't hear the code word. Say it clearly, close to the phone.",
  hands_not_shown: "Show both open hands to the camera before GO.",
  no_go_chime: "The GO chime wasn't on the clip. Keep the sound on and the phone unmuted.",
  dog_not_visible: "Keep the whole dog in the frame the entire time.",
  unclear: "The clip was too unclear to time. Try brighter light and a steadier phone.",
  sounds_off: "The game sounds didn't line up with the clip. Keep the volume up and the phone close.",
  other_dog: "That doesn't look like the dog on this profile.",
  never_sat: "We didn't see a sit after GO.",
  touched: "The dog was held or placed by hand. Cue only, no touching.",
  no_tricks: "We didn't see the first trick after GO.",
  missed_trick: "A trick was missing or out of order.",
  too_slow: "Over the 60 second limit.",
  too_short: "The clip was too short.",
  too_long: "The clip was longer than this game allows.",
  longer_than_session: "The clip was longer than the time since you started, so it can't count.",
  old_clip: "This clip was recorded before the attempt started.",
  duplicate_clip: "This exact clip was already sent.",
  unreadable: "The video file couldn't be read. Try again.",
  late: "The attempt ran out of time before the clip arrived.",
};

export const ERRORS: Record<string, string> = {
  no_tries_left: "No tries left today. Come back tomorrow.",
  turn_over: "Your turn in this duel is done.",
  duel_over: "This duel has ended.",
  duel_not_found: "No duel with that code.",
  duel_closed: "Someone already joined this duel, or it ended.",
  own_duel: "That's your own duel. Send the code to a friend.",
  bad_code: "Codes are six letters and numbers.",
  too_many_duels: "You have five open duels. Finish one first.",
  judge_unavailable: "The judge is busy. Send the clip again.",
  judge_unconfigured: "Scoring isn't switched on yet.",
  attempt_expired: "This attempt ran out of time.",
  upload_failed: "The clip didn't upload. Check your connection and send it again.",
  upload_missing: "The clip didn't arrive. Send it again.",
  not_deployed: "Games aren't set up on the server yet.",
  network: "No connection. Try again.",
  timeout: "That took too long. Try again.",
};

export const errorText = (code: string | undefined) => (code && ERRORS[code]) || "Something went wrong. Try again.";
