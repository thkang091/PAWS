import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import { cleanTrack, evaluateTerritory, type TrackPoint } from "../tournament/geo.ts";
import { networkNear } from "../tournament/network.ts";
import { capturable, matchRoads, type RoadEdge } from "./battle.ts";
import { areaName, areaRadiusM, buildRoadArea, proposeMafiaRoute } from "./autoSetup.ts";
import {
  ROOM_LIMITS,
  assignRoles,
  checkpointsFor,
  clampSettings,
  isAhead,
  outcome,
  phaseAt,
  reportWalk,
  roundTimes,
  tally,
  validateSetup,
  visibleClues,
  type Checkpoint,
  type MafiaRole,
  type RoundStatus,
  type Rng,
} from "./logic.ts";

/**
 * Nearby rooms and Find the Mafia. Joining, leaving, readiness, host controls and votes are SQL functions (they must
 * be atomic); this function does what needs the game rules: starting a round with secret roles, moving it forward
 * on the server clock, checking walks, and building the view each player is allowed to see.
 *
 * POST { action: "state", roomId }                      the room as this player may see it
 * POST { action: "start", roomId }                      host starts a Find the Mafia round
 * POST { action: "advance", roundId }                   move the round on if its time has come; safe to repeat
 * POST { action: "walk", roundId, points, shared }      which of my checkpoints my walk reached
 * POST { action: "territory", matchId, points, requestKey }      check a closed loop, then commit the claim (team battles)
 * POST { action: "road", matchId, edgeId, points, requestKey }   check road coverage, then commit the capture
 * POST { action: "road_area", roomId, latitude, longitude }      the road area Steal Your Road plays (made from OSM if none)
 * POST { action: "mafia_route", roomId, latitude, longitude, walkMinutes }   a proposed Find the Mafia route (not saved)
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
const fail = (error: string, status = 400) => json({ ok: false, error }, status);
/** Never log roles, votes or coordinates. */
const log = (event: string, detail: Record<string, unknown> = {}) => console.error(`[rooms] ${event}`, JSON.stringify(detail));

const rng: Rng = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
};

type Room = { id: string; game_type: string | null; name: string; host_id: string; max_players: number; team_mode: boolean; start_delay_s: number; status: string; code: string; version: number; expires_at: string; battle_minutes: number; region_id: string | null; start_permission?: string; remote_invite?: boolean; play_mode?: string; nt_category?: string; nt_ranked?: boolean };
type Member = { user_id: string; display_name: string; ready: boolean; joined_at: string; left_at: string | null; removed: boolean; dog_id: string | null; team: "blue" | "orange" | null };
type Round = {
  id: string;
  room_id: string;
  status: RoundStatus;
  settings: Record<string, unknown>;
  meet_lat: number | null;
  meet_lng: number | null;
  started_at: string;
  walking_ends_at: string;
  discussion_ends_at: string;
  voting_ends_at: string;
  finished_at: string | null;
  result: Record<string, unknown> | null;
};
type CheckpointRow = { id: string; number: number; label: string; latitude: number; longitude: number; audience: Checkpoint["audience"] };

const timesOf = (r: Round) => ({ startedAt: r.started_at, walkingEndsAt: r.walking_ends_at, discussionEndsAt: r.discussion_ends_at, votingEndsAt: r.voting_ends_at });

const loadRoom = async (admin: SupabaseClient, id: unknown) => {
  if (typeof id !== "string") return null;
  const { data } = await admin.from("multiplayer_rooms").select("*").eq("id", id).maybeSingle();
  return (data as Room | null) ?? null;
};

const membersOf = async (admin: SupabaseClient, roomId: string) => {
  const { data } = await admin.from("room_members").select("*").eq("room_id", roomId).order("joined_at", { ascending: true });
  return (data ?? []) as Member[];
};

const loadRound = async (admin: SupabaseClient, id: unknown) => {
  if (typeof id !== "string") return null;
  const { data } = await admin.from("mafia_rounds").select("*").eq("id", id).maybeSingle();
  return (data as Round | null) ?? null;
};

// ---------- Moving a round on ----------

/** Advances the round to wherever the server clock says it should be. Conditional updates make repeats harmless. */
const settle = async (admin: SupabaseClient, round: Round): Promise<Round> => {
  if (round.status === "finished" || round.status === "cancelled") return round;
  const [members, { data: roleRows }, { data: voteRows }] = await Promise.all([
    membersOf(admin, round.room_id),
    admin.from("mafia_role_assignments").select("user_id, role").eq("round_id", round.id),
    admin.from("mafia_votes").select("voter_id, target_id, cast_at").eq("round_id", round.id),
  ]);
  const roles = (roleRows ?? []) as { user_id: string; role: MafiaRole }[];
  const players = roles.map((r) => r.user_id);
  const present = new Set(members.filter((m) => !m.left_at).map((m) => m.user_id));
  const eligible = players.filter((id) => present.has(id));
  const votes = ((voteRows ?? []) as { voter_id: string; target_id: string; cast_at: string }[]).map((v) => ({ voterId: v.voter_id, targetId: v.target_id, castAt: v.cast_at }));
  const mafiaId = roles.find((r) => r.role === "mafia")?.user_id ?? "";
  const mafiaLeft = Boolean(mafiaId) && !present.has(mafiaId);
  const voted = new Set(votes.map((v) => v.voterId));
  const everyoneVoted = eligible.length > 0 && eligible.every((id) => voted.has(id));

  const next: RoundStatus = mafiaLeft ? "finished" : phaseAt(timesOf(round), Date.now(), everyoneVoted && Date.now() >= Date.parse(round.discussion_ends_at));
  if (!isAhead(next, round.status)) return round;

  const patch: Record<string, unknown> = { status: next };
  if (next === "finished") {
    const allowSelfVote = round.settings?.allowSelfVote === true;
    const t = tally(votes, eligible, players, allowSelfVote);
    const o = outcome(mafiaId, t.accused, mafiaLeft);
    patch.finished_at = new Date().toISOString();
    patch.result = { mafiaId, accusedId: t.accused, totals: t.totals, votesCounted: t.counted, winner: o.winner, reason: o.reason };
  }
  const { data: updated } = await admin.from("mafia_rounds").update(patch).eq("id", round.id).eq("status", round.status).select().maybeSingle();
  if (!updated) return (await loadRound(admin, round.id)) ?? round;
  if (next === "finished") await admin.from("multiplayer_rooms").update({ status: "finished" }).eq("id", round.room_id).eq("status", "playing");
  return updated as Round;
};

// ---------- Actions ----------

const state = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const room = await loadRoom(admin, body.roomId);
  if (!room) return fail("room_not_found", 404);
  // Everything the lobby needs in one round of parallel reads (the lobby polls this; it must stay quick).
  const [members, { data: latest }, setupRes, scoresRes, starterRes, numberRes] = await Promise.all([
    membersOf(admin, room.id),
    admin.from("mafia_rounds").select("*").eq("room_id", room.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    room.host_id === userId ? admin.from("mafia_setups").select("*").eq("room_id", room.id).maybeSingle() : Promise.resolve({ data: null }),
    admin.rpc("room_scores", { p_room_id: room.id }),
    admin.rpc("room_starter", { p_room_id: room.id }),
    room.game_type === "number_trail"
      ? admin.from("number_trail_matches").select("id, mode, status").eq("room_id", room.id).not("status", "in", "(completed,cancelled)").order("created_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const me = members.find((m) => m.user_id === userId);
  if (!me || me.removed) return fail(me?.removed ? "removed_from_room" : "not_in_room", 403);
  let round = latest ? await settle(admin, latest as Round) : null;
  if (round && round.status === "cancelled" && room.status === "open") round = null;
  const finished = round?.status === "finished";
  const freshRoom = round && finished ? (await loadRoom(admin, room.id)) ?? room : room;

  let roundView: Record<string, unknown> | null = null;
  if (round) {
    const [{ data: roleRows }, { data: cpRows }, { data: objectiveRows }, { data: voteRows }, { data: reportRows }] = await Promise.all([
      admin.from("mafia_role_assignments").select("user_id, role").eq("round_id", round.id),
      admin.from("mafia_checkpoints").select("*").eq("round_id", round.id).order("number"),
      admin.from("mafia_objectives").select("role, text").eq("round_id", round.id),
      admin.from("mafia_votes").select("voter_id, target_id").eq("round_id", round.id),
      admin.from("mafia_walk_reports").select("user_id, reached, distance_m, shared").eq("round_id", round.id),
    ]);
    const roles = (roleRows ?? []) as { user_id: string; role: MafiaRole }[];
    const myRole = roles.find((r) => r.user_id === userId)?.role ?? null;
    const checkpoints = (cpRows ?? []) as CheckpointRow[];
    const objectives = (objectiveRows ?? []) as { role: MafiaRole; text: string }[];
    const votes = (voteRows ?? []) as { voter_id: string; target_id: string }[];
    const reports = ((reportRows ?? []) as { user_id: string; reached: number[]; distance_m: number; shared: boolean }[]).map((r) => ({ userId: r.user_id, reached: r.reached, distanceM: r.distance_m, shared: r.shared }));
    const afterWalk = round.status !== "walking";
    const present = new Set(members.filter((m) => !m.left_at).map((m) => m.user_id));

    roundView = {
      id: round.id,
      status: round.status,
      settings: round.settings,
      meet: round.meet_lat != null && round.meet_lng != null ? { latitude: round.meet_lat, longitude: round.meet_lng } : null,
      startedAt: round.started_at,
      walkingEndsAt: round.walking_ends_at,
      discussionEndsAt: round.discussion_ends_at,
      votingEndsAt: round.voting_ends_at,
      players: roles.map((r) => r.user_id),
      eligibleVoters: roles.filter((r) => present.has(r.user_id)).length,
      votesCast: votes.length,
      reportsIn: reports.length,
      // Only this player's own secret, until the end.
      myRole,
      myObjective: objectives.find((o) => o.role === myRole)?.text ?? null,
      myCheckpoints: (finished ? checkpoints : myRole ? checkpointsFor(checkpoints, myRole) : checkpoints.filter((c) => c.audience === "all")).map((c) => ({ ...c })),
      myVote: votes.find((v) => v.voter_id === userId)?.target_id ?? null,
      myReport: reports.find((r) => r.userId === userId) ?? null,
      clues: afterWalk ? visibleClues(reports, checkpoints, finished) : [],
      // Everything, once it is over.
      result: finished ? round.result : null,
      roles: finished ? Object.fromEntries(roles.map((r) => [r.user_id, r.role])) : null,
      objectives: finished ? Object.fromEntries(objectives.map((o) => [o.role, o.text])) : null,
    };
  }

  const setup = setupRes.data ?? null;
  // Wins in this room and who may start now, both worked out by the database from recorded results.
  const scores = (scoresRes.data ?? {}) as Record<string, number>;
  const starterId = (starterRes.data as string | null) ?? freshRoom.host_id;
  const numberMatch = numberRes.data as { id: string; mode: string; status: string } | null;

  return json({
    ok: true,
    serverNow: new Date().toISOString(),
    room: {
      id: freshRoom.id,
      gameType: freshRoom.game_type,
      name: freshRoom.name,
      hostId: freshRoom.host_id,
      maxPlayers: freshRoom.max_players,
      teamMode: freshRoom.team_mode,
      startDelayS: freshRoom.start_delay_s,
      status: freshRoom.status,
      code: freshRoom.code,
      version: freshRoom.version,
      expiresAt: freshRoom.expires_at,
      battleMinutes: freshRoom.battle_minutes,
      regionId: freshRoom.region_id,
      startPermission: freshRoom.start_permission ?? "host",
      remoteInvite: Boolean(freshRoom.remote_invite),
      starterId,
      playMode: freshRoom.play_mode ?? "nearby",
      ntCategory: freshRoom.nt_category ?? "standard",
      ntRanked: freshRoom.nt_ranked ?? true,
    },
    // A Number Trail race under way in this room (its own screens take over).
    numberMatch: numberMatch ? { id: numberMatch.id, mode: numberMatch.mode, status: numberMatch.status } : null,
    me: { userId, isHost: freshRoom.host_id === userId, left: Boolean(me.left_at), canStart: starterId === userId },
    members: members
      .filter((m) => !m.left_at)
      .map((m) => ({ userId: m.user_id, name: m.display_name, ready: m.ready, isHost: m.user_id === freshRoom.host_id, joinedAt: m.joined_at, team: m.team, score: Number(scores[m.user_id] ?? 0) })),
    // Names of everyone who played this round, including anyone who has since left, for the results.
    everyone: Object.fromEntries(members.map((m) => [m.user_id, m.display_name])),
    round: roundView,
    setup,
  });
};

const start = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const room = await loadRoom(admin, body.roomId);
  if (!room) return fail("room_not_found", 404);
  // The room's start rule (host, first or last place), decided by the database.
  const { data: starter } = await admin.rpc("room_starter", { p_room_id: room.id });
  if ((starter ?? room.host_id) !== userId) return fail("not_your_turn_to_start", 403);
  if (room.game_type !== "find_mafia") return fail("not_available", 409);
  if (room.status !== "open" || Date.parse(room.expires_at) <= Date.now()) return fail("room_closed", 409);

  const members = (await membersOf(admin, room.id)).filter((m) => !m.left_at);
  const limits = ROOM_LIMITS.find_mafia;
  if (members.length < limits.min) return fail("not_enough_players", 409);
  if (members.length > Math.min(limits.max, room.max_players)) return fail("room_full", 409);
  if (members.some((m) => !m.ready && m.user_id !== room.host_id && m.user_id !== userId)) return fail("not_everyone_ready", 409);

  const { data: setupRow } = await admin.from("mafia_setups").select("*").eq("room_id", room.id).maybeSingle();
  const setup = setupRow as { meet_lat: number | null; meet_lng: number | null; checkpoints: { label?: string; latitude: number; longitude: number; audience: Checkpoint["audience"] }[]; civilian_objective: string; mafia_objective: string; settings: Record<string, unknown>; confirmed_safe: boolean } | null;
  if (!setup) return fail("no_setup", 409);
  if (!setup.confirmed_safe) return fail("setup_not_confirmed", 409);
  const problem = validateSetup(setup.checkpoints ?? []);
  if (problem) return fail(problem, 409);

  const settings = clampSettings({ ...(setup.settings ?? {}), startDelaySeconds: room.start_delay_s });
  const t = roundTimes(Date.now(), settings);
  const { data: roundRow, error } = await admin
    .from("mafia_rounds")
    .insert({
      room_id: room.id,
      status: "walking",
      settings,
      meet_lat: setup.meet_lat,
      meet_lng: setup.meet_lng,
      started_at: t.startedAt,
      walking_ends_at: t.walkingEndsAt,
      discussion_ends_at: t.discussionEndsAt,
      voting_ends_at: t.votingEndsAt,
    })
    .select()
    .single();
  if (error || !roundRow) {
    // The unique index refuses a second live round, so a double tap on Start does nothing.
    return fail(/duplicate|unique/i.test(error?.message ?? "") ? "already_started" : "start_failed", 409);
  }
  const round = roundRow as Round;

  try {
    const roles = assignRoles(members.map((m) => m.user_id), rng);
    const writes = await Promise.all([
      admin.from("mafia_role_assignments").insert([...roles].map(([user_id, role]) => ({ round_id: round.id, user_id, role }))),
      admin.from("mafia_objectives").insert([
        { round_id: round.id, role: "civilian", text: setup.civilian_objective || "Visit every checkpoint you are shown, in order." },
        { round_id: round.id, role: "mafia", text: setup.mafia_objective || "Reach your secret checkpoint, then blend in by visiting the others." },
      ]),
      admin.from("mafia_checkpoints").insert(
        setup.checkpoints.map((c, i) => ({ round_id: round.id, number: i + 1, label: (c.label || `Checkpoint ${i + 1}`).slice(0, 40), latitude: c.latitude, longitude: c.longitude, audience: c.audience })),
      ),
    ]);
    const failed = writes.find((w) => w.error);
    if (failed?.error) throw new Error(failed.error.message);
    await admin.from("multiplayer_rooms").update({ status: "playing" }).eq("id", room.id).eq("status", "open");
  } catch (e) {
    log("start_failed", { message: e instanceof Error ? e.message : String(e) });
    await admin.from("mafia_rounds").delete().eq("id", round.id);
    return fail("start_failed", 500);
  }
  return json({ ok: true, roundId: round.id });
};

const advance = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const round = await loadRound(admin, body.roundId);
  if (!round) return fail("round_not_found", 404);
  const { data: member } = await admin.from("room_members").select("user_id").eq("room_id", round.room_id).eq("user_id", userId).maybeSingle();
  if (!member) return fail("not_in_room", 403);
  const settled = await settle(admin, round);
  return json({ ok: true, status: settled.status });
};

const walk = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const round = await loadRound(admin, body.roundId);
  if (!round) return fail("round_not_found", 404);
  const { data: roleRow } = await admin.from("mafia_role_assignments").select("role").eq("round_id", round.id).eq("user_id", userId).maybeSingle();
  if (!roleRow) return fail("not_in_round", 403);
  const { data: member } = await admin.from("room_members").select("left_at").eq("room_id", round.room_id).eq("user_id", userId).maybeSingle();
  if (!member || (member as { left_at: string | null }).left_at) return fail("not_in_room", 403);
  // Walks lock two minutes after the walking time ends.
  if (round.status === "finished" || round.status === "cancelled" || Date.now() > Date.parse(round.walking_ends_at) + 2 * 60_000) return fail("walk_locked", 409);

  const raw = Array.isArray(body.points) ? (body.points as Record<string, unknown>[]).slice(0, 3000) : [];
  const points: TrackPoint[] = raw
    .map((p, i) => ({
      seq: Number.isInteger(p?.seq) ? (p.seq as number) : i + 1,
      segment: Number.isInteger(p?.segment) ? (p.segment as number) : 0,
      latitude: Number(p?.latitude),
      longitude: Number(p?.longitude),
      accuracyM: typeof p?.accuracyM === "number" ? (p.accuracyM as number) : null,
      capturedAt: Number(p?.capturedAt),
    }))
    .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Number.isFinite(p.capturedAt));
  const { data: cpRows } = await admin.from("mafia_checkpoints").select("*").eq("round_id", round.id);
  const visible = checkpointsFor((cpRows ?? []) as CheckpointRow[], (roleRow as { role: MafiaRole }).role);
  const startsAt = Date.parse(round.started_at) + Number(round.settings?.startDelaySeconds ?? 0) * 1000;
  const report = reportWalk(points, visible, { startsAt, endsAt: Date.parse(round.walking_ends_at) });
  if (!report.ok) return fail(report.error, 422);

  const { error } = await admin
    .from("mafia_walk_reports")
    .upsert({ round_id: round.id, user_id: userId, reached: report.reached, distance_m: report.distanceM, shared: body.shared !== false, submitted_at: new Date().toISOString() }, { onConflict: "round_id,user_id" });
  if (error) {
    log("walk_failed", { message: error.message });
    return fail("walk_failed", 500);
  }
  return json({ ok: true, reached: report.reached, distanceM: report.distanceM });
};

// ---------- Team battles ----------

type MatchRow = { id: string; room_id: string; game_type: string; status: string; region_id: string | null; starts_at: string | null; ends_at: string | null };

const toPoints = (raw: unknown): TrackPoint[] =>
  (Array.isArray(raw) ? (raw as Record<string, unknown>[]).slice(0, 4000) : [])
    .map((p, i) => ({
      seq: Number.isInteger(p?.seq) ? (p.seq as number) : i + 1,
      segment: Number.isInteger(p?.segment) ? (p.segment as number) : 0,
      latitude: Number(p?.latitude),
      longitude: Number(p?.longitude),
      accuracyM: typeof p?.accuracyM === "number" ? (p.accuracyM as number) : null,
      capturedAt: Number(p?.capturedAt),
    }))
    .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Number.isFinite(p.capturedAt));

const sha256 = async (text: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), (b) => b.toString(16).padStart(2, "0")).join("");

/** Loads a match the caller plays in, and refuses walks recorded outside its server-set window. */
const matchFor = async (admin: SupabaseClient, userId: string, matchId: unknown) => {
  if (typeof matchId !== "string") return null;
  const { data } = await admin.from("battle_matches").select("*").eq("id", matchId).maybeSingle();
  const match = data as MatchRow | null;
  if (!match) return null;
  const { data: member } = await admin.from("battle_team_members").select("team").eq("match_id", match.id).eq("user_id", userId).maybeSingle();
  return member ? { match, team: (member as { team: string }).team } : null;
};

const inWindow = (points: readonly TrackPoint[], match: MatchRow) => {
  if (!match.starts_at || !match.ends_at) return false;
  const start = Date.parse(match.starts_at) - 5_000;
  const end = Math.min(Date.now(), Date.parse(match.ends_at)) + 5_000;
  return points.length > 0 && points.every((p) => p.capturedAt >= start && p.capturedAt <= end);
};

/** Maps a raised database reason to a clean error code. */
const reasonOf = (message: string) => message.match(/[a-z]+(?:_[a-z]+)+/)?.[0] ?? "server_error";

const territory = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const found = await matchFor(admin, userId, body.matchId);
  if (!found) return fail("not_in_match", 403);
  if (found.match.game_type !== "steal_territory") return fail("wrong_game", 409);
  if (typeof body.requestKey !== "string" || body.requestKey.length < 8) return fail("bad_request");
  const points = toPoints(body.points);
  if (!inWindow(points, found.match)) return fail("outside_match", 422);
  // The same checks as Make the Largest Country: 200 m, back within 25 m, one simple loop, no jumps or holes.
  const loop = evaluateTerritory(cleanTrack(points));
  if (!loop.ok) return json({ ok: true, status: "not_yet", issues: loop.issues, closureM: Math.round(loop.closureM), distanceM: Math.round(loop.distanceM) });
  const pointsHash = await sha256(cleanTrack(points).map((p) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)},${p.capturedAt}`).join("|"));
  const { data, error } = await admin.rpc("commit_territory_claim", {
    p_match_id: found.match.id,
    p_user_id: userId,
    p_ring_geojson: JSON.stringify({ type: "Polygon", coordinates: [loop.ring] }),
    p_request_key: body.requestKey,
    p_points_hash: pointsHash,
  });
  if (error) return fail(reasonOf(error.message), 409);
  return json({ ok: true, status: "claimed", ...(data as Record<string, unknown>) });
};

const road = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const found = await matchFor(admin, userId, body.matchId);
  if (!found) return fail("not_in_match", 403);
  if (found.match.game_type !== "steal_road" || !found.match.region_id) return fail("wrong_game", 409);
  if (typeof body.requestKey !== "string" || body.requestKey.length < 8 || typeof body.edgeId !== "string") return fail("bad_request");
  const points = toPoints(body.points);
  if (!inWindow(points, found.match)) return fail("outside_match", 422);
  const { data: roads } = await admin.rpc("region_roads", { p_region_id: found.match.region_id });
  // Matching uses every playable road of the region, so a walk along a nearby parallel path is judged the same way
  // the phone judged it.
  const edges: RoadEdge[] = ((roads ?? []) as { id: string; status: string; startNodeId: string; endNodeId: string; coords: [number, number][]; lengthM: number; name: string | null }[])
    .filter((e) => e.status === "verified")
    .map((e) => ({ id: e.id, startNodeId: e.startNodeId, endNodeId: e.endNodeId, coords: e.coords, lengthM: e.lengthM, name: e.name }));
  if (!edges.some((e) => e.id === body.edgeId)) return fail("road_not_in_game", 409);
  const coverage = matchRoads(points, edges).get(body.edgeId as string);
  if (!capturable(coverage)) return json({ ok: true, status: "rejected", reason: "not_enough", share: coverage?.share ?? 0 });
  const { data, error } = await admin.rpc("commit_road_capture", {
    p_match_id: found.match.id,
    p_user_id: userId,
    p_edge_id: body.edgeId,
    p_coverage: Math.min(1, Math.round(coverage!.share * 10_000) / 10_000),
    p_request_key: body.requestKey,
  });
  if (error) return fail(reasonOf(error.message), 409);
  return json({ ok: true, share: coverage!.share, ...(data as Record<string, unknown>) });
};

const here = (body: Record<string, unknown>) => {
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
};

/** Only whoever may start an open room of this game sets it up. */
const setupRoom = async (admin: SupabaseClient, userId: string, roomId: unknown, game: string, hostOnly: boolean) => {
  const room = await loadRoom(admin, roomId);
  if (!room) return { error: fail("room_not_found", 404) };
  if (hostOnly) {
    if (room.host_id !== userId) return { error: fail("not_the_host", 403) };
  } else {
    const { data: starter } = await admin.rpc("room_starter", { p_room_id: room.id });
    if ((starter ?? room.host_id) !== userId) return { error: fail("not_your_turn_to_start", 403) };
  }
  if (room.game_type !== game) return { error: fail("not_available", 409) };
  if (room.status !== "open" || Date.parse(room.expires_at) <= Date.now()) return { error: fail("room_closed", 409) };
  return { room };
};

/**
 * Steal Your Road's area: a published one near the host (an organizer's first), else one built now from the
 * OpenStreetMap streets around them and published for this and later rooms nearby.
 */
const roadArea = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const found = await setupRoom(admin, userId, body.roomId, "steal_road", false);
  if (found.error) return found.error;
  const at = here(body);
  if (!at) return fail("location_needed");
  const { data: near, error: nearError } = await admin.rpc("road_area_near", { p_latitude: at.latitude, p_longitude: at.longitude, p_radius_m: 400 });
  if (nearError) return fail("server_error", 500);
  if (near) return json({ ok: true, regionId: near, created: false });

  const minutes = found.room.battle_minutes || 15;
  const radius = areaRadiusM(minutes);
  const network = await networkNear(admin, at.latitude, at.longitude, minutes, radius + 150, log);
  if ("error" in network) return fail(network.error, 503);
  // An organizer's area covers this spot but is too small to play: never overrule it with a copy of other data.
  if (network.source !== "osm") return fail("no_roads_here", 422);
  const area = buildRoadArea(network.graph, at, radius);
  if ("error" in area) return fail(area.error, 422);
  const { data: id, error } = await admin.rpc("create_osm_road_area", {
    p_user_id: userId,
    p_name: areaName(area),
    p_center_lat: at.latitude,
    p_center_lng: at.longitude,
    p_nodes: area.nodes,
    p_edges: area.roads.map((r) => ({ startKey: r.startKey, endKey: r.endKey, name: r.name, coords: r.coords, pathType: r.pathType })),
  });
  if (error) return fail(reasonOf(error.message), 422);
  log("road_area_created", { roads: area.roads.length });
  return json({ ok: true, regionId: id, created: true, roads: area.roads.length });
};

/** A Find the Mafia route from the host's spot, for the host to look over and save. Nothing is stored here. */
const mafiaRoute = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const found = await setupRoom(admin, userId, body.roomId, "find_mafia", true);
  if (found.error) return found.error;
  const at = here(body);
  if (!at) return fail("location_needed");
  const minutes = [10, 15, 20].includes(Number(body.walkMinutes)) ? Number(body.walkMinutes) : 15;
  const network = await networkNear(admin, at.latitude, at.longitude, minutes, 800, log);
  if ("error" in network) return fail(network.error, 503);
  const proposal = proposeMafiaRoute(network.graph, at, minutes, rng);
  if ("error" in proposal) return fail(proposal.error, 422);
  return json({ ok: true, ...proposal });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("method_not_allowed", 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return fail("unauthorized", 401);
  const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: who } = await caller.auth.getUser();
  const userId = who?.user?.id;
  if (!userId) return fail("unauthorized", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request");
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    switch (body.action) {
      case "state":
        return await state(admin, userId, body);
      case "start":
        return await start(admin, userId, body);
      case "advance":
        return await advance(admin, userId, body);
      case "walk":
        return await walk(admin, userId, body);
      case "territory":
        return await territory(admin, userId, body);
      case "road":
        return await road(admin, userId, body);
      case "road_area":
        return await roadArea(admin, userId, body);
      case "mafia_route":
        return await mafiaRoute(admin, userId, body);
      default:
        return fail("unknown_action");
    }
  } catch (error) {
    log("unhandled", { action: body.action, message: error instanceof Error ? error.message : String(error) });
    return fail("server_error", 500);
  }
});
