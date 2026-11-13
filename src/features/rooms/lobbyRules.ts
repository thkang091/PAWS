/**
 * Nearby room rules and routes as pure functions: what stops a host from starting, which screen a room shows, and
 * where each step of a battle game lives. The server checks the same start rules in start_battle and start_mafia.
 */
import type { MatchStatus, RoomGame, Team } from "@/services/roomService";

export const MIN_PLAYERS: Record<RoomGame, number> = { find_mafia: 4, steal_territory: 2, steal_road: 2, number_trail: 2 };
export const MAX_PLAYERS = 10;
export const BATTLE_MINUTES = [10, 15, 20, 30] as const;

export const isBattle = (game: RoomGame | string | null | undefined): game is "steal_territory" | "steal_road" => game === "steal_territory" || game === "steal_road";

type LobbyMember = { ready: boolean; isHost: boolean; team: Team | null };

export const teamCounts = (members: readonly { team: Team | null }[]) => ({
  blue: members.filter((m) => m.team === "blue").length,
  orange: members.filter((m) => m.team === "orange").length,
  none: members.filter((m) => !m.team).length,
});

/** Every player on a team, and both teams have someone. */
export const teamsSet = (members: readonly { team: Team | null }[]) => {
  const c = teamCounts(members);
  return c.none === 0 && c.blue > 0 && c.orange > 0;
};

/** A gentle note when teams differ by more than one player. Uneven teams can still start. */
export const unevenNote = (members: readonly { team: Team | null }[]) => {
  const c = teamCounts(members);
  return c.none === 0 && Math.abs(c.blue - c.orange) > 1 ? `Teams are uneven, ${c.blue} Blue and ${c.orange} Orange.` : null;
};

/**
 * Why the host can't start yet, in the order they'd fix it, or null when the room can start. Road games also need a
 * published road area; `regionPublished` is false when the picked area has since been taken down.
 */
export const startBlocker = (input: { game: RoomGame | null; members: readonly LobbyMember[]; regionId: string | null; regionPublished: boolean; mafiaSetupReady?: boolean; autoSetup?: boolean }) => {
  if (!input.game) return "Pick a game";
  const min = MIN_PLAYERS[input.game];
  const missing = min - input.members.length;
  if (missing > 0) return `Needs ${missing} more ${missing === 1 ? "player" : "players"}`;
  if (input.members.length > MAX_PLAYERS) return `Up to ${MAX_PLAYERS} players`;
  const waiting = input.members.filter((m) => !m.ready && !m.isHost).length;
  if (waiting) return `Waiting for ${waiting} to be ready`;
  // autoSetup: teams are balanced and the nearest road area is picked when the game starts.
  if (isBattle(input.game) && !input.autoSetup) {
    if (input.members.some((m) => !m.team)) return "Put every player on a team";
    if (!teamsSet(input.members)) return "Both teams need a player";
    if (input.game === "steal_road" && (!input.regionId || !input.regionPublished)) return "Pick a road area";
  }
  if (input.game === "find_mafia" && !input.mafiaSetupReady) return "Set the checkpoints first";
  return null;
};

export type RoomView = "loading" | "error" | "closed" | "lobby" | "battle" | "mafia";

/** Which screen a room shows. A battle stays on its own screen through countdown, play and results. */
export const roomView = (input: {
  hasState: boolean;
  errorCode?: string | null;
  game?: RoomGame | null;
  roomStatus?: "open" | "playing" | "finished" | "cancelled";
  match?: { status: MatchStatus } | null;
  mafiaRound?: boolean;
}): RoomView => {
  if (!input.hasState) return input.errorCode ? "error" : "loading";
  if (isBattle(input.game) && input.match && input.roomStatus !== "open" && input.roomStatus !== "cancelled") return "battle";
  if (input.game === "find_mafia" && input.mafiaRound && (input.roomStatus === "playing" || input.roomStatus === "finished")) return "mafia";
  if (input.roomStatus === "cancelled") return "closed";
  return "lobby";
};

/** What the battle screen shows for a match. */
export const battleView = (status: MatchStatus, serverNow: number, startsAt: string): "countdown" | "play" | "result" =>
  status === "completed" || status === "cancelled" ? "result" : status === "countdown" || status === "preparing" || serverNow < Date.parse(startsAt) ? "countdown" : "play";

export const ROUTES = {
  hub: "/game/tournament",
  /** Where leaving a room goes: the Nearby tab (games have no description pages). */
  nearby: "/game/tournament?mode=nearby",
  detail: (_game: "steal_territory" | "steal_road") => "/game/tournament?mode=nearby",
  create: (game: RoomGame) => `/game/room/create?game=${game}`,
  joinScan: "/game/room/join?mode=scan",
  joinCode: "/game/room/join?mode=code",
  regions: "/game/battle/regions",
  newRegion: "/game/battle/regions/new",
  region: (id: string) => `/game/battle/regions/${id}`,
} as const;
