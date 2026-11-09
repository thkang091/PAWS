import type { PlayLocation } from "./gameFlow";

/** Local screen preview only. These transitions do not establish a network room. */
export type DuelFriend = {
  name: string;
  ownerLabel?: string;
  ready: boolean;
};

export type DuelRoomState = {
  location: PlayLocation;
  room: { code: string; role: "host" | "guest"; location: PlayLocation } | null;
  friend: DuelFriend | null;
  selectedGame: "paws-says" | null;
  selfReady: boolean;
  connection: "connected" | "reconnecting";
  starting: boolean;
};

export type DuelRoomAction =
  | { type: "location"; location: PlayLocation }
  | { type: "create"; code: string }
  | { type: "join"; code: string }
  | { type: "friend-connect"; friend: Omit<DuelFriend, "ready"> }
  | { type: "friend-disconnect" }
  | { type: "select-game"; game: "paws-says" }
  | { type: "preview-host-select-game"; game: "paws-says" }
  | { type: "self-ready"; ready: boolean }
  | { type: "friend-ready"; ready: boolean }
  | { type: "reconnect" }
  | { type: "retry" }
  | { type: "start" }
  | { type: "reset-round" }
  | { type: "leave" };

export function createDuelRoomState(location: PlayLocation = "together"): DuelRoomState {
  return { location, room: null, friend: null, selectedGame: null, selfReady: false, connection: "connected", starting: false };
}

export function sanitizeRoomCode(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
}

/** A display token for the local preview, not a secret or a server-issued invite. */
export function createPreviewRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

/** The UI supplies its explicit development fixture; arbitrary codes never imply a live join. */
export function validatePreviewRoomCode(value: string, expectedCode: string): string | null {
  const code = sanitizeRoomCode(value);
  if (code.length !== 6) return "Enter a 6-character room code.";
  return code === sanitizeRoomCode(expectedCode) ? null : "Preview game not found. Check the code.";
}

export function canReadyDuel(state: DuelRoomState): boolean {
  return !!state.room && !!state.friend && state.connection === "connected" && !state.starting;
}

/** Readiness opens game selection and remains visible while the game is launching. */
export function areDuelPlayersReady(state: DuelRoomState): boolean {
  return !!state.room && !!state.friend && state.connection === "connected" && state.selfReady && state.friend.ready;
}

export function canChooseDuelGame(state: DuelRoomState): boolean {
  return areDuelPlayersReady(state) && state.room?.role === "host" && !state.starting;
}

export function canStartDuel(state: DuelRoomState): boolean {
  return canChooseDuelGame(state) && !!state.selectedGame;
}

function clearReadiness(state: DuelRoomState): DuelRoomState {
  return { ...state, selfReady: false, friend: state.friend ? { ...state.friend, ready: false } : null, selectedGame: null, starting: false };
}

export function duelRoomReducer(state: DuelRoomState, action: DuelRoomAction): DuelRoomState {
  switch (action.type) {
    case "location":
      return state.room ? state : { ...state, location: action.location };
    case "create":
    case "join": {
      // Reopening an invitation must not recreate or overwrite an occupied room.
      // Remote uses matchmaking, not the Same place code-room preview.
      if (state.room || state.location !== "together") return state;
      const code = sanitizeRoomCode(action.code);
      if (code.length !== 6) return state;
      return { ...createDuelRoomState(state.location), room: { code, role: action.type === "create" ? "host" : "guest", location: state.location } };
    }
    case "friend-connect":
      if (!state.room || state.friend || state.starting) return state;
      return { ...state, friend: { ...action.friend, ready: false }, selfReady: false, selectedGame: null, connection: "connected" };
    case "friend-disconnect":
      return { ...state, friend: null, selfReady: false, selectedGame: null, connection: "connected", starting: false };
    case "select-game":
      return canChooseDuelGame(state) ? { ...state, selectedGame: action.game } : state;
    case "preview-host-select-game":
      // A separate development event models the other participant's host action.
      if (state.room?.role !== "guest" || !areDuelPlayersReady(state) || state.starting) return state;
      return { ...state, selectedGame: action.game };
    case "self-ready":
      return canReadyDuel(state) ? { ...state, selfReady: action.ready, selectedGame: action.ready ? state.selectedGame : null } : state;
    case "friend-ready":
      return canReadyDuel(state) && state.friend
        ? { ...state, friend: { ...state.friend, ready: action.ready }, selectedGame: action.ready ? state.selectedGame : null }
        : state;
    case "reconnect":
      return state.room && state.friend ? { ...clearReadiness(state), connection: "reconnecting" } : state;
    case "retry":
      // In this local preview, retry models recovery without restoring Ready.
      return state.connection === "reconnecting" ? { ...clearReadiness(state), connection: "connected" } : state;
    case "start":
      return canStartDuel(state) ? { ...state, starting: true } : state;
    case "reset-round":
      return clearReadiness(state);
    case "leave":
      return createDuelRoomState(state.location);
  }
}
