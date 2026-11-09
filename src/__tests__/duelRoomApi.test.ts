import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DUEL_STALE_MS, DuelRoomApi, duelErrorCode, duelErrorMessage,
  duelStateFromSnapshot, normalizeDuelCode, parseDuelSnapshot,
  type DuelRoomSnapshot,
} from "../features/game/flow/duelRoomApi";

const USER = "11111111-1111-4111-8111-111111111111";
const FRIEND = "22222222-2222-4222-8222-222222222222";
const ROOM = "33333333-3333-4333-8333-333333333333";
const DOG = "44444444-4444-4444-8444-444444444444";
const OUTSIDER = "55555555-5555-4555-8555-555555555555";
const NOW = Date.parse("2026-11-06T20:00:00Z");

function snapshot(): DuelRoomSnapshot {
  return {
    meUserId: USER,
    room: { id: ROOM, code: "ABC234", hostUserId: USER, phase: "selecting",
      selectedGame: "paws-says", revision: 4, expiresAt: "2026-11-06T22:00:00Z" },
    players: [
      { userId: USER, dogId: DOG, name: "My dog", ready: true, lastSeenAt: new Date(NOW).toISOString() },
      { userId: FRIEND, dogId: FRIEND, name: "Their dog", ready: true, lastSeenAt: new Date(NOW).toISOString() },
    ],
  };
}

describe("untrusted room snapshots", () => {
  test("a member snapshot is accepted, but an active snapshot naming an outsider is rejected", () => {
    expect(parseDuelSnapshot(snapshot()).meUserId).toBe(USER);
    expect(() => parseDuelSnapshot({ ...snapshot(), meUserId: OUTSIDER })).toThrow("DUEL_ROOM_NOT_FOUND");
    expect(() => parseDuelSnapshot({ ...snapshot(), players: [] })).toThrow("DUEL_ROOM_NOT_FOUND");
  });

  test.each([
    ["invalid room identity", (value: any) => { value.room.id = "not-a-uuid"; }],
    ["unrecognized phase", (value: any) => { value.room.phase = "matching"; }],
    ["unsupported selected game", (value: any) => { value.room.selectedGame = "other-game"; }],
    ["non-integer revision", (value: any) => { value.room.revision = 1.5; }],
    ["over-capacity room", (value: any) => { value.players.push({ ...value.players[1], userId: OUTSIDER }); }],
    ["string Ready flag", (value: any) => { value.players[1].ready = "true"; }],
    ["missing display name", (value: any) => { value.players[1].name = ""; }],
  ])("rejects %s instead of exposing it to the lobby", (_label, mutate) => {
    const value = snapshot();
    mutate(value);
    expect(() => parseDuelSnapshot(value)).toThrow();
  });

  test("the RPC boundary validates successful response bodies", async () => {
    const abortSignal = jest.fn().mockResolvedValue({ data: { room: null }, error: null });
    const client = { rpc: jest.fn(() => ({ abortSignal })) } as unknown as SupabaseClient;
    await expect(new DuelRoomApi(client).get(ROOM)).rejects.toThrow();
  });

  test("closed rooms clear all lobby state even when an old snapshot contains Ready players", () => {
    const value = snapshot();
    value.room.phase = "closed";
    expect(duelStateFromSnapshot(value, true, NOW)).toMatchObject({
      room: null, friend: null, selectedGame: null, selfReady: false, starting: false,
    });
  });
});

describe("room code input", () => {
  test("normalizes letter case and surrounding whitespace only", () => {
    expect(normalizeDuelCode(" \tabc234\n")).toBe("ABC234");
  });

  test.each(["", "ABC23", "ABC2345", "ABC 234", "AB-234", "https://example.com/ABC234", "ＡＢＣ234"])(
    "rejects %j without silently truncating or stripping interior characters", value => {
      expect(normalizeDuelCode(value)).toBeNull();
    },
  );

  test("invalid input is rejected before sending a join RPC", async () => {
    const rpc = jest.fn();
    const api = new DuelRoomApi({ rpc } as unknown as SupabaseClient);
    await expect(api.join("ABC234EXTRA", DOG)).rejects.toThrow("6-character game code");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("connection-aware lobby state", () => {
  test("Ready remains visible just before the stale threshold", () => {
    const value = snapshot();
    value.players[1].lastSeenAt = new Date(NOW - DUEL_STALE_MS + 1).toISOString();
    expect(duelStateFromSnapshot(value, true, NOW)).toMatchObject({
      selfReady: true, friend: { name: "Their dog", ready: true }, connection: "connected",
    });
  });

  test("a stale peer hides both Ready flags without losing the two participants or room", () => {
    const value = snapshot();
    value.players[1].lastSeenAt = new Date(NOW - DUEL_STALE_MS).toISOString();
    expect(duelStateFromSnapshot(value, true, NOW)).toMatchObject({
      room: { code: "ABC234", role: "host" }, selfReady: false,
      friend: { name: "Their dog", ready: false }, connection: "reconnecting",
    });
    expect(value.players.every(player => player.ready)).toBe(true);
  });

  test("a lost local connection also suppresses Ready while preserving the guest role", () => {
    const value = snapshot();
    value.meUserId = FRIEND;
    expect(duelStateFromSnapshot(value, false, NOW)).toMatchObject({
      room: { role: "guest" }, selfReady: false,
      friend: { name: "My dog", ready: false }, connection: "reconnecting",
    });
  });
});

describe("actionable errors", () => {
  test("maps a server room error without exposing raw database details", () => {
    const error = { code: "P0001", message: "DUEL_ROOM_FULL", details: "private database context" };
    expect(duelErrorCode(error)).toBe("DUEL_ROOM_FULL");
    expect(duelErrorMessage(error)).toBe("This room is full.");
  });

  test.each(["PGRST202", "42883"])("identifies an unavailable migration from %s", code => {
    expect(duelErrorMessage({ code })).toBe("Game rooms aren’t available on this server yet.");
  });

  test.each([null, "network failure", { message: 503 }, { code: "UNKNOWN", message: "raw private detail" }])(
    "handles unexpected error shape %j with connection guidance", error => {
      expect(duelErrorCode(error)).toBeNull();
      expect(duelErrorMessage(error)).toBe("Couldn’t connect to the room. Check your connection and try again.");
    },
  );
});
