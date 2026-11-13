import { getClientOrThrow } from "@/services/serviceUtils";
import type { TrackPoint } from "../../supabase/functions/tournament/geo";
import type { MafiaRole, MafiaSettings, RoundStatus } from "../../supabase/functions/rooms/logic";

export type { MafiaRole, MafiaSettings, RoundStatus };

export type RoomGame = "find_mafia" | "steal_territory" | "steal_road" | "number_trail";

export type Team = "blue" | "orange";

/** `score`: wins in this room, from recorded results (0 on servers that predate room scores). */
export type RoomMember = { userId: string; name: string; ready: boolean; isHost: boolean; joinedAt: string; team: Team | null; score?: number };

/** Who may start a game in the room: the host, the player in first place, or the one in last place. */
export type StartPermission = "host" | "first" | "last";
/** Nearby: friends together, QR or code. Online: friends anywhere, Number Trail on their own streets. */
export type PlayMode = "nearby" | "online";
export type NtCategory = "short" | "standard" | "long";

export type MafiaCheckpoint = { id: string; number: number; label: string; latitude: number; longitude: number; audience: "all" | "civilian" | "mafia" };

export type MafiaRoundView = {
  id: string;
  status: RoundStatus;
  settings: Partial<MafiaSettings>;
  meet: { latitude: number; longitude: number } | null;
  startedAt: string;
  walkingEndsAt: string;
  discussionEndsAt: string;
  votingEndsAt: string;
  players: string[];
  eligibleVoters: number;
  votesCast: number;
  reportsIn: number;
  myRole: MafiaRole | null;
  myObjective: string | null;
  myCheckpoints: MafiaCheckpoint[];
  myVote: string | null;
  myReport: { userId: string; reached: number[]; distanceM: number; shared: boolean } | null;
  clues: { userId: string; reached: number[] }[];
  result: { mafiaId: string; accusedId: string | null; totals: Record<string, number>; votesCounted: number; winner: "civilians" | "mafia"; reason: string } | null;
  roles: Record<string, MafiaRole> | null;
  objectives: Partial<Record<MafiaRole, string>> | null;
};

export type MafiaSetup = {
  room_id: string;
  meet_lat: number | null;
  meet_lng: number | null;
  checkpoints: { label: string; latitude: number; longitude: number; audience: "all" | "civilian" | "mafia" }[];
  civilian_objective: string;
  mafia_objective: string;
  settings: Partial<MafiaSettings>;
  confirmed_safe: boolean;
};

export type RoomState = {
  serverNow: string;
  room: {
    id: string;
    /** Null until the host picks a game in the room. */
    gameType: RoomGame | null;
    name: string;
    hostId: string;
    maxPlayers: number;
    teamMode: boolean;
    startDelayS: number;
    status: "open" | "playing" | "finished" | "cancelled";
    code: string;
    version: number;
    expiresAt: string;
    battleMinutes: number;
    regionId: string | null;
    startPermission?: StartPermission;
    remoteInvite?: boolean;
    /** Who may start right now (the database's call). */
    starterId?: string;
    playMode?: PlayMode;
    ntCategory?: NtCategory;
    ntRanked?: boolean;
  };
  /** A Number Trail race under way in this room: its own screens take over. */
  numberMatch?: { id: string; mode: "nearby" | "online"; status: string } | null;
  me: { userId: string; isHost: boolean; left: boolean; canStart?: boolean };
  members: RoomMember[];
  everyone: Record<string, string>;
  round: MafiaRoundView | null;
  setup: MafiaSetup | null;
};

export class RoomError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** Database functions raise short snake_case reasons; keep just the reason. */
// A missing function names itself in the message ("Could not find the function public.x_y"), so check for that first.
const reason = (message: string) => (/schema cache|could not find/i.test(message) ? "not_deployed" : (message.match(/[a-z]+(?:_[a-z]+)+/)?.[0] ?? "server_error"));

const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc(name as never, args as never);
  if (error) throw new RoomError(reason(error.message));
  return data as unknown as T;
};

const call = async <T>(body: Record<string, unknown>, timeout = 20_000): Promise<T> => {
  const client = getClientOrThrow();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeout);
  const { data, error } = await client.functions.invoke("rooms", { body, signal: abort.signal }).finally(() => clearTimeout(timer));
  if (error) {
    const context = (error as { context?: Response }).context;
    if (!context) throw new RoomError(abort.signal.aborted ? "timeout" : "network");
    const payload = typeof context.json === "function" ? await context.json().catch(() => null) : null;
    throw new RoomError((payload?.error as string) ?? (context.status === 404 ? "not_deployed" : "server_error"));
  }
  if (!data?.ok) throw new RoomError((data?.error as string) ?? "server_error");
  return data as T;
};

export type Invite = { token: string; expiresAt: string; code: string };

export const createRoom = (input: {
  /** Null: a room first, the game picked inside it. */
  game: RoomGame | null;
  name: string;
  maxPlayers: number;
  teamMode: boolean;
  startDelayS: number;
  safetyAck: boolean;
  dogId: string | null;
  displayName: string;
  /** "online": a Number Trail room for friends anywhere, joined by code. */
  mode?: PlayMode;
}) =>
  rpc<{ roomId: string } & Invite>("create_room", {
    p_mode: input.mode ?? "nearby",
    p_game: input.game,
    p_name: input.name,
    p_max_players: input.maxPlayers,
    p_team_mode: input.teamMode,
    p_start_delay_s: input.startDelayS,
    p_safety_ack: input.safetyAck,
    p_dog_id: input.dogId,
    p_display_name: input.displayName,
  });

export const joinRoom = (input: { code?: string; token?: string; dogId: string | null; displayName: string }) =>
  rpc<{ roomId: string; alreadyIn: boolean }>("join_room", { p_code: input.code ?? null, p_token: input.token ?? null, p_dog_id: input.dogId, p_display_name: input.displayName });

export const issueInvite = (roomId: string) => rpc<Invite>("issue_room_invite", { p_room_id: roomId });
/** Host: the room's game (while nothing is running). Null puts the room back to picking one. */
export const setRoomGame = (roomId: string, game: RoomGame | null) => rpc<void>("set_room_game", { p_room_id: roomId, p_game: game });
/** Host: who may start, whether the code works from anywhere, and (online) the race's distance and ranking. Unset stays as is. */
export const setRoomOptions = (roomId: string, options: { startPermission?: StartPermission; remoteInvite?: boolean; ntCategory?: NtCategory; ntRanked?: boolean }) =>
  rpc<void>("set_room_options", { p_room_id: roomId, p_start_permission: options.startPermission ?? null, p_remote_invite: options.remoteInvite ?? null, p_nt_category: options.ntCategory ?? null, p_nt_ranked: options.ntRanked ?? null });
export const leaveRoom = (roomId: string) => rpc<void>("leave_room", { p_room_id: roomId });
export const setReady = (roomId: string, ready: boolean) => rpc<void>("set_room_ready", { p_room_id: roomId, p_ready: ready });
export const removeMember = (roomId: string, userId: string) => rpc<void>("remove_room_member", { p_room_id: roomId, p_user_id: userId });
export const cancelRoom = (roomId: string) => rpc<void>("cancel_room", { p_room_id: roomId });
export const reopenRoom = (roomId: string) => rpc<void>("reopen_room", { p_room_id: roomId });
export const castVote = (roundId: string, targetId: string) => rpc<void>("cast_mafia_vote", { p_round_id: roundId, p_target_id: targetId });

export const saveMafiaSetup = (roomId: string, setup: Omit<MafiaSetup, "room_id">) =>
  rpc<void>("save_mafia_setup", {
    p_room_id: roomId,
    p_meet_lat: setup.meet_lat,
    p_meet_lng: setup.meet_lng,
    p_checkpoints: setup.checkpoints,
    p_civilian_objective: setup.civilian_objective,
    p_mafia_objective: setup.mafia_objective,
    p_settings: setup.settings,
    p_confirmed_safe: setup.confirmed_safe,
  });

/** Steal Your Road's area at this spot: a published one nearby, or one the server builds now from the streets here. */
export const roadAreaFor = (roomId: string, at: { latitude: number; longitude: number }) =>
  call<{ regionId: string; created: boolean }>({ action: "road_area", roomId, latitude: at.latitude, longitude: at.longitude }, 70_000);

export type ProposedRoute = {
  meet: { latitude: number; longitude: number };
  checkpoints: { label: string; latitude: number; longitude: number; audience: "all" | "civilian" | "mafia" }[];
  walkM: { civilian: number; mafia: number };
};
/** A Find the Mafia route from real street corners around this spot. Nothing is saved until the host saves it. */
export const proposeMafiaRoute = (roomId: string, at: { latitude: number; longitude: number }, walkMinutes: number) =>
  call<ProposedRoute & { ok: true }>({ action: "mafia_route", roomId, latitude: at.latitude, longitude: at.longitude, walkMinutes }, 70_000);

export const getRoomState = (roomId: string) => call<RoomState & { ok: true }>({ action: "state", roomId });
export const startRound = (roomId: string) => call<{ roundId: string }>({ action: "start", roomId });
export const advanceRound = (roundId: string) => call<{ status: RoundStatus }>({ action: "advance", roundId });

export const submitMafiaWalk = (roundId: string, points: readonly TrackPoint[], shared: boolean) =>
  call<{ reached: number[]; distanceM: number }>(
    {
      action: "walk",
      roundId,
      shared,
      points: points.map((p) => ({ seq: p.seq, segment: p.segment, latitude: p.latitude, longitude: p.longitude, accuracyM: p.accuracyM, capturedAt: p.capturedAt })),
    },
    30_000,
  );

/** The in-app link a QR code carries: only the room's invitation token, never anything private. */
export const inviteLink = (token: string) => `paws://game/room/join?t=${encodeURIComponent(token)}`;

/** Reads an invitation token out of a scanned QR code or pasted link. */
export const tokenFromLink = (text: string) => {
  const match = text.match(/[?&]t=([A-Za-z0-9_-]{16,})/);
  return match ? decodeURIComponent(match[1]) : null;
};

// ---------- Team battles ----------

export type MatchStatus = "preparing" | "countdown" | "active" | "finalizing" | "completed" | "cancelled";

export type BattleResult = {
  winner: Team | "tie";
  scores: Record<Team, number>;
  unit: "m2" | "points";
  claims: number;
  capturedM2: number;
  players: { userId: string; name: string; team: Team; claims: number; gainedM2: number; capturedM2: number; roads: number; roadPoints: number }[];
};

export type BattleEvent = { seq: number; kind: string; team: Team | null; userId: string | null; payload: Record<string, unknown>; at: string };

export type BattleState = {
  serverNow: string;
  match: { id: string; roomId: string; gameType: "steal_territory" | "steal_road"; status: MatchStatus; regionId: string | null; durationMinutes: number; startsAt: string; endsAt: string; seq: number; result: BattleResult | null };
  myTeam: Team | null;
  teams: Record<Team, { score: number; detail: { lengthM?: number; bonus?: number; largestEdges?: number; base?: number } }>;
  members: { userId: string; name: string; team: Team }[];
  territory: Partial<Record<Team, { areaM2: number; geojson: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] } | null }>>;
  roads: { edgeId: string; team: Team; capturedAt: string; seq: number }[];
  events: BattleEvent[];
  myClaims: number;
};

export type RegionRoad = { id: string; name: string | null; status: "pending" | "verified" | "unsafe" | "disabled"; lengthM: number; note: string; startNodeId: string; endNodeId: string; coords: [number, number][] };
export type PublishedRegion = { id: string; name: string; latitude: number; longitude: number; roads: number; attribution: string };

export const setMemberTeam = (roomId: string, userId: string, team: Team | null) => rpc<void>("set_member_team", { p_room_id: roomId, p_user_id: userId, p_team: team });
export const balanceTeams = (roomId: string) => rpc<void>("balance_room_teams", { p_room_id: roomId });
export const setBattleSettings = (roomId: string, minutes: number, regionId: string | null) => rpc<void>("set_battle_settings", { p_room_id: roomId, p_minutes: minutes, p_region_id: regionId });
export const startBattle = (roomId: string) => rpc<string>("start_battle", { p_room_id: roomId });
export const advanceBattle = (matchId: string) => rpc<string>("battle_advance", { p_match_id: matchId });
export const cancelBattle = (matchId: string) => rpc<void>("cancel_battle", { p_match_id: matchId });
export const getBattleState = (matchId: string) => rpc<BattleState>("battle_state", { p_match_id: matchId });
export const publishedRegions = () => rpc<PublishedRegion[]>("published_regions", {});
export const regionRoads = (regionId: string) => rpc<RegionRoad[]>("region_roads", { p_region_id: regionId });

/** The room's latest match, if any; readable by the room's players. */
export const latestMatch = async (roomId: string) => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("battle_matches" as never).select("id, status").eq("room_id", roomId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new RoomError(reason(error.message));
  return (data as unknown as { id: string; status: MatchStatus } | null) ?? null;
};

const pointsBody = (points: readonly TrackPoint[]) =>
  points.map((p) => ({ seq: p.seq, segment: p.segment, latitude: p.latitude, longitude: p.longitude, accuracyM: p.accuracyM, capturedAt: p.capturedAt }));

export type TerritoryReply =
  | { status: "claimed"; claimId: string; gainedM2: number; capturedM2: number; seq: number; repeated: boolean }
  | { status: "not_yet"; issues: string[]; closureM: number; distanceM: number };

/** Hand in a closed loop. The same request key is reused on retry, so a lost reply never claims twice. */
export const submitTerritory = (matchId: string, points: readonly TrackPoint[], requestKey: string) =>
  call<TerritoryReply>({ action: "territory", matchId, points: pointsBody(points), requestKey }, 30_000);

export type RoadReply = { status: "accepted" | "rejected"; reason?: string; points?: number; share?: number; repeated?: boolean };

export const submitRoad = (matchId: string, edgeId: string, points: readonly TrackPoint[], requestKey: string) =>
  call<RoadReply>({ action: "road", matchId, edgeId, points: pointsBody(points), requestKey }, 30_000);

// ---------- Road regions (organizers) ----------

export const isOrganizer = () => rpc<boolean>("is_tournament_organizer", {});

export type RegionSummary = {
  id: string;
  name: string;
  status: "draft" | "published" | "disabled";
  source: string;
  license: string;
  attribution: string;
  notes: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  roads: { total: number; pending: number; verified: number; unsafe: number; disabled: number };
};

/** Every region with its review counts. Organizers only; the server refuses anyone else. */
export const organizerRegions = () => rpc<RegionSummary[]>("organizer_regions", {});

export const createRegion = (input: { name: string; latitude: number; longitude: number; source: string; license: string; attribution: string }) =>
  rpc<{ id: string }>("create_competition_region", { p_name: input.name, p_center_lat: input.latitude, p_center_lng: input.longitude, p_source: input.source, p_license: input.license, p_attribution: input.attribution });

export const importRoadGraph = (regionId: string, nodes: unknown[], edges: unknown[]) => rpc<{ imported: number }>("import_road_graph", { p_region_id: regionId, p_nodes: nodes, p_edges: edges });
export const setRoadStatus = (edgeId: string, status: RegionRoad["status"], note: string) => rpc<void>("set_road_edge_status", { p_edge_id: edgeId, p_status: status, p_note: note });
export const publishRegion = (regionId: string) => rpc<void>("publish_competition_region", { p_region_id: regionId });
export const updateRegion = (regionId: string, input: { name: string; source: string; license: string; attribution: string; notes: string }) =>
  rpc<void>("update_competition_region", { p_region_id: regionId, p_name: input.name, p_source: input.source, p_license: input.license, p_attribution: input.attribution, p_notes: input.notes });
export const disableRegion = (regionId: string) => rpc<void>("disable_competition_region", { p_region_id: regionId });
export const reopenRegion = (regionId: string) => rpc<void>("reopen_competition_region", { p_region_id: regionId });
