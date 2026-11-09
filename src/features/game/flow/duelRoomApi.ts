import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { DuelRoomState } from "./duelRoomState";

const snapshotSchema = z.object({
  room: z.object({
    id: z.string().uuid(), code: z.string().regex(/^[A-Z0-9]{6}$/), hostUserId: z.string().uuid(),
    phase: z.enum(["waiting", "selecting", "playing", "closed"]),
    selectedGame: z.literal("paws-says").nullable(), revision: z.number().int().nonnegative(), expiresAt: z.string(),
  }),
  players: z.array(z.object({
    userId: z.string().uuid(), dogId: z.string().uuid(), name: z.string().min(1),
    ready: z.boolean(), lastSeenAt: z.string(),
  })).max(2),
  meUserId: z.string().uuid(),
});

export type DuelRoomSnapshot = z.infer<typeof snapshotSchema>;
export type DuelRoomOperation = "create" | "join" | "ready" | "select" | "start" | "leave" | "restore" | "retry" | "reset";
export const DUEL_STALE_MS = 90_000;

const errorCopy: Record<string, string> = {
  DUEL_AUTH_REQUIRED: "Your session is still connecting. Try again.",
  DUEL_DOG_NOT_FOUND: "Add your dog’s profile before joining a game.",
  DUEL_ROOM_NOT_FOUND: "Room not found. Check the code.",
  DUEL_ROOM_FULL: "This room is full.",
  DUEL_ROOM_CLOSED: "This room has closed. Create or join another game.",
  DUEL_ALREADY_IN_ROOM: "Leave your current room before creating another game.",
  DUEL_FRIEND_REQUIRED: "Wait for your friend to join.",
  DUEL_FRIEND_OFFLINE: "Waiting for your friend to reconnect.",
  DUEL_NOT_READY: "Both players need to be ready.",
  DUEL_HOST_REQUIRED: "Only the host can choose and start the game.",
  DUEL_GAME_REQUIRED: "Choose a game first.",
  DUEL_GAME_INVALID: "This game isn’t available.",
  DUEL_GAME_IN_PROGRESS: "This game has already started.",
  DUEL_INVALID_REQUEST: "Couldn’t complete that request. Try again.",
  DUEL_CREATE_FAILED: "Couldn’t create a room. Try again.",
};

export function duelErrorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    const message = error.message;
    return Object.keys(errorCopy).find(code => message.includes(code)) ?? null;
  }
  return null;
}

export function duelErrorMessage(error: unknown): string {
  const code = duelErrorCode(error);
  if (code) return errorCopy[code];
  if (error && typeof error === "object" && "code" in error && ["PGRST202", "42883"].includes(String(error.code))) {
    return "Game rooms aren’t available on this server yet.";
  }
  return "Couldn’t connect to the room. Check your connection and try again.";
}

export function normalizeDuelCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

/** An idempotency identifier, never a credential or an invitation code. */
export function createDuelRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const value = Math.floor(Math.random() * 16);
    return (c === "x" ? value : (value & 3) | 8).toString(16);
  });
}

export function parseDuelSnapshot(value: unknown): DuelRoomSnapshot {
  const snapshot = snapshotSchema.parse(value);
  if (snapshot.room.phase !== "closed" && !snapshot.players.some(player => player.userId === snapshot.meUserId)) {
    throw new Error("DUEL_ROOM_NOT_FOUND");
  }
  return snapshot;
}

export function duelStateFromSnapshot(snapshot: DuelRoomSnapshot | null, connected: boolean, now = Date.now()): DuelRoomState {
  if (!snapshot || snapshot.room.phase === "closed") return {
    location: "together", room: null, friend: null, selectedGame: null, selfReady: false, connection: "connected", starting: false,
  };
  const me = snapshot.players.find(player => player.userId === snapshot.meUserId);
  const friend = snapshot.players.find(player => player.userId !== snapshot.meUserId);
  const friendOnline = !friend || now - Date.parse(friend.lastSeenAt) < DUEL_STALE_MS;
  const online = connected && friendOnline;
  return {
    location: "together",
    room: { code: snapshot.room.code, role: snapshot.room.hostUserId === snapshot.meUserId ? "host" : "guest", location: "together" },
    friend: friend ? { name: friend.name, ready: online && friend.ready } : null,
    selectedGame: snapshot.room.selectedGame,
    selfReady: online && !!me?.ready,
    connection: online ? "connected" : "reconnecting",
    starting: snapshot.room.phase === "playing",
  };
}

export class DuelRoomApi {
  constructor(private readonly client: SupabaseClient) {}

  private async rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 12_000);
    try {
      const { data, error } = await this.client.rpc(name, args).abortSignal(abort.signal);
      if (error) throw error;
      return data;
    } finally { clearTimeout(timeout); }
  }

  private async snapshot(name: string, args: Record<string, unknown>): Promise<DuelRoomSnapshot> {
    return parseDuelSnapshot(await this.rpc(name, args));
  }

  create(dogId: string, requestId: string) {
    return this.snapshot("create_duel_room", { target_dog_id: dogId, request_key: requestId });
  }
  join(code: string, dogId: string) {
    const normalized = normalizeDuelCode(code);
    if (!normalized) return Promise.reject(new Error("Enter a 6-character game code."));
    return this.snapshot("join_duel_room", { room_code: normalized, target_dog_id: dogId });
  }
  get(roomId: string) { return this.snapshot("get_duel_room", { target_room_id: roomId }); }
  ready(roomId: string, ready: boolean) { return this.snapshot("set_duel_ready", { target_room_id: roomId, is_ready: ready }); }
  select(roomId: string) { return this.snapshot("select_duel_game", { target_room_id: roomId, game_slug: "paws-says" }); }
  start(roomId: string) { return this.snapshot("start_duel_room", { target_room_id: roomId }); }
  heartbeat(roomId: string) { return this.snapshot("heartbeat_duel_room", { target_room_id: roomId }); }
  reset(roomId: string) { return this.snapshot("reset_duel_round", { target_room_id: roomId }); }
  async leave(roomId: string): Promise<void> { await this.rpc("leave_duel_room", { target_room_id: roomId }); }
}
