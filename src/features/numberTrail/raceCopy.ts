/**
 * Number Trail words (Phase N2 contract, for the N3 screens). Short, calm, second person; one fact and the next step.
 * Never urges speed: the race is won by walking the number, not by rushing. No em dashes.
 */
import type { ProgressPhase } from "../../../supabase/functions/tournament/numberMatch";
import type { FinishState } from "./raceView";

export const NUMBER_TAGLINE = "Walk the number. Finish first.";

/** Server error codes, as a line the player can act on. */
export const NUMBER_ERRORS: Record<string, string> = {
  no_number_routes: "No number routes available in this area. Try another location or walking distance.",
  no_network: "We couldn't find walkable streets here. Try another location.",
  no_public_start: "There's no public street corner close enough to start from. Move the meeting point to a street.",
  no_routes_for_difficulty: "No numbers at this difficulty here. Try another difficulty or walking time.",
  preparation_timeout: "Finding a number took too long. Try again.",
  preparation_in_progress: "A number is already being found. One moment.",
  routing_unavailable: "Street maps aren't reachable right now. Try again in a minute.",
  routing_busy: "Street maps are busy. Try again in a minute.",
  room_not_found: "No room with that code.",
  room_closed: "That room has closed or already started.",
  room_full: "That room is full.",
  match_full: "There are more players than places. Raise the limit or ask someone to leave.",
  match_not_found: "This race no longer exists.",
  match_not_ready: "Pick a number before starting.",
  match_not_editable: "The race has started, so its settings are fixed.",
  match_not_active: "The race hasn't started yet.",
  match_over: "Time's up for this race.",
  match_completed: "This race is over.",
  match_cancelled: "The host cancelled this race.",
  already_started: "The race has already started.",
  not_everyone_ready: "Wait until everyone is ready.",
  not_enough_players: "You need at least two players.",
  not_the_host: "Only the host can do that.",
  not_your_turn_to_start: "Someone else starts this game.",
  not_in_match: "You're not in this race.",
  not_in_room: "You've left this room.",
  invalid_session: "This walk isn't yours.",
  session_closed: "Your walk was closed. Reopen it to keep going.",
  no_walk: "Start your walk first.",
  already_finished: "You've already finished.",
  verification_pending: "Still checking your walk.",
  slow_down: "Give it a few seconds, then try again.",
  too_many_attempts: "Too many hand-ins for this race.",
  not_found: "That's no longer available.",
  candidate_expired: "That route has expired. Search again.",
  bad_number: "Choose a whole number from 0 to 99.",
  bad_category: "Choose a distance.",
  match_exists: "This room already has a race.",
  courses_not_matched: "Routes couldn't be matched fairly.",
  not_everyone_at_start: "Waiting for everyone to reach their start.",
  number_not_common: "Not everyone can walk that number. Pick one from the list.",
  not_deployed: "Number Trail isn't set up on the server yet.",
  network: "No connection. Your walk is saved on this phone.",
  timeout: "That took too long. Try again.",
};
export const numberErrorText = (code: string | null | undefined) => (code && NUMBER_ERRORS[code]) || "Something went wrong. Try again.";

/** Why a finish didn't count, and what to do. */
export const FINISH_REASONS: Record<string, { title: string; body: string }> = {
  not_at_start: { title: "Start at the meeting corner", body: "Your walk counts from the start corner. Head there, then walk the number." },
  digit_one_incomplete: { title: "First digit not finished", body: "Walk the rest of the first digit, then hand in again." },
  digit_two_incomplete: { title: "Second digit not finished", body: "Walk the rest of the second digit, then hand in again." },
  connector_invalid: { title: "The link between digits didn't count", body: "Your walk between the digits was missing or off the planned streets." },
  finish_incomplete: { title: "Finish stretch not done", body: "Walk the marked stretch to the finish corner, then hand in." },
  finish_invalid: { title: "The finish stretch didn't count", body: "Your walk to the finish was missing or off the marked streets." },
  gps_review: { title: "Your GPS jumped", body: "Part of your walk moved faster than walking pace, so it can't be verified." },
  too_few_points: { title: "Not enough GPS yet", body: "Keep location on and walk a little further." },
  replayed_walk: { title: "This walk was used before", body: "A walk can only count in one race." },
  verification_expired: { title: "We couldn't finish checking", body: "Hand in again to check your walk." },
};

/** Visible labels and the screen reader announcement for each phase. */
export const PHASE_LABELS: Record<ProgressPhase, string> = {
  DIGIT_1_PENDING: "Walk to the first digit",
  DIGIT_1_IN_PROGRESS: "Walking the first digit",
  DIGIT_1_COMPLETE: "First digit done",
  CONNECTOR_IN_PROGRESS: "On to the second digit",
  DIGIT_2_IN_PROGRESS: "Walking the second digit",
  DIGIT_2_COMPLETE: "Hand in when you're ready",
  NUMBER_COMPLETE: "Hand in when you're ready",
  FINISH_IN_PROGRESS: "Walk the finish stretch",
  FINISH_PENDING_VERIFICATION: "Checking your walk",
  VERIFIED_COMPLETE: "Finished",
  INVALID_COMPLETION: "Not counted yet",
};
export const notAtStartLabel = "Go to the start corner";

/** The phase line for this course: a single digit has no "first" or "second". */
export const phaseLabel = (phase: ProgressPhase, digits: number) =>
  digits > 1 ? PHASE_LABELS[phase] : phase === "DIGIT_1_PENDING" ? "Start at the flag" : phase === "DIGIT_1_IN_PROGRESS" ? "Walking the digit" : PHASE_LABELS[phase];

export const LOBBY_BLOCKERS: Record<string, { host: string; player: string }> = {
  preparing: { host: "Finding a number on these streets", player: "The host is finding a number" },
  no_number: { host: "Pick a number to race", player: "Waiting for the host to pick a number" },
  need_players: { host: "Invite at least one more player", player: "Waiting for more players" },
  waiting_ready: { host: "Waiting for everyone to be ready", player: "Tap Ready when you're at the start" },
};

export const LAYOUT_LABELS = { side_by_side: "Side by side", separate: "Apart. Read left to right", single: "One digit" } as const;

export const FINISH_STATE_LABELS: Record<FinishState, string> = {
  verifying: "Checking your walk",
  accepted: "Verified",
  waiting_on_earlier: "Verified. Waiting on an earlier finish",
  incomplete: "Not counted yet",
  gps_invalid: "Can't be verified",
  already_completed: "This race is over",
};

/** Other players' events: neutral until the server has decided. */
export const eventLine = (kind: string, name: string, payload: Record<string, unknown> = {}) => {
  switch (kind) {
    case "PLAYER_JOINED":
      return `${name} joined`;
    case "PLAYER_LEFT":
      return `${name} left`;
    case "DIGIT_1_COMPLETED":
      return `${name} finished the first digit`;
    case "DIGIT_2_COMPLETED":
      return `${name} finished both digits`;
    case "FINISH_VERIFYING":
      return `${name} handed in`;
    case "PLAYER_FINISHED":
      return payload.placement === 1 ? `${name} won` : `${name} finished`;
    case "MATCH_CANCELLED":
      return "The host cancelled the race";
    case "COURSE_SEARCH_STARTED":
      return "Find your route on your own streets";
    case "PLAYER_COURSE_FOUND":
      return `${name} found a route`;
    case "PLAYER_COURSE_FAILED":
      return `${name} has no route yet`;
    case "COURSES_MATCHED":
      return "Routes matched";
    case "COURSES_UNMATCHED":
      return "Routes didn't match";
    case "PLAYER_AT_START":
      return `${name} is at their start`;
    case "PLAYER_NUMBERS_CHECKED":
      return `${name} checked their streets`;
    case "NUMBER_CHOSEN":
      return typeof payload.number === "string" ? `The race is ${payload.number}` : null;
    case "COURSE_SHARED":
      return "One course for everyone";
    default:
      return null;
  }
};

export const RESULT_LINES = {
  won: "You won",
  winner: (name: string) => `${name} won`,
  noFinisher: "Time's up. Nobody finished",
  photoFinish: "Photo finish. Places go by when PAWS received each finish.",
  settling: "Places after the winner are still being checked",
  orderNote: "Finish order is the order the server received verified finishes.",
};

export const SAFETY_LINE = "Walk at your dog's pace. Cross only where it's safe.";
