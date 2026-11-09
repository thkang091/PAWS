import {
  areDuelPlayersReady, canChooseDuelGame, canReadyDuel, canStartDuel, createDuelRoomState,
  createPreviewRoomCode, duelRoomReducer, sanitizeRoomCode, validatePreviewRoomCode,
  type DuelRoomAction, type DuelRoomState,
} from "../features/game/flow/duelRoomState";

const transition = (state: DuelRoomState, ...actions: DuelRoomAction[]) => actions.reduce(duelRoomReducer, state);
const host = () => transition(createDuelRoomState(), { type: "create", code: "Q7F9KN" });
const connectedHost = () => transition(host(), { type: "friend-connect", friend: { name: "Test dog", ownerLabel: "Test participant" } });
const readyHost = () => transition(connectedHost(), { type: "self-ready", ready: true }, { type: "friend-ready", ready: true });
const selectedHost = () => transition(readyHost(), { type: "select-game", game: "paws-says" });

test("entry has no invented room, participant, selection or readiness", () => {
  const state = createDuelRoomState();
  expect(state).toMatchObject({ location: "together", room: null, friend: null, selectedGame: null, selfReady: false });
  expect(canChooseDuelGame(state)).toBe(false);
  expect(canReadyDuel(state)).toBe(false);
  expect(areDuelPlayersReady(state)).toBe(false);
  expect(canStartDuel(state)).toBe(false);
});

test("Same place creation and duplicate create preserve the room and location", () => {
  const state = host();
  expect(state.room).toEqual({ code: "Q7F9KN", role: "host", location: "together" });
  expect(duelRoomReducer(state, { type: "create", code: "Z8J6WR" })).toBe(state);
  expect(duelRoomReducer(state, { type: "location", location: "remote" })).toBe(state);
  expect(state.friend).toBeNull();
});

test.each(["create", "join"] as const)("Remote rejects legacy %s room actions without inventing a match", action => {
  const remote = createDuelRoomState("remote");
  const attempted = duelRoomReducer(remote, { type: action, code: "Q7F9KN" });
  expect(attempted).toBe(remote);
  const progressed = transition(attempted,
    { type: "friend-connect", friend: { name: "Test opponent" } },
    { type: "select-game", game: "paws-says" },
    { type: "preview-host-select-game", game: "paws-says" },
    { type: "self-ready", ready: true },
    { type: "friend-ready", ready: true },
    { type: "start" },
  );
  expect(progressed).toBe(remote);
  expect(canChooseDuelGame(progressed)).toBe(false);
  expect(canReadyDuel(progressed)).toBe(false);
  expect(areDuelPlayersReady(progressed)).toBe(false);
  expect(canStartDuel(progressed)).toBe(false);
  const samePlace = duelRoomReducer(progressed, { type: "location", location: "together" });
  expect(samePlace).toEqual(createDuelRoomState());
  expect(duelRoomReducer(samePlace, { type: action, code: "Q7F9KN" }).room).toMatchObject({ location: "together", code: "Q7F9KN" });
  expect(duelRoomReducer(samePlace, { type: "location", location: "remote" })).toEqual(remote);
});

test("connection does not select a game or make either participant ready", () => {
  const waiting = host();
  expect(duelRoomReducer(waiting, { type: "select-game", game: "paws-says" })).toBe(waiting);
  expect(duelRoomReducer(waiting, { type: "self-ready", ready: true })).toBe(waiting);
  const state = connectedHost();
  expect(state.friend?.ready).toBe(false);
  expect(state.selectedGame).toBeNull();
  expect(state.selfReady).toBe(false);
  expect(canChooseDuelGame(state)).toBe(false);
  expect(canReadyDuel(state)).toBe(true);
  expect(duelRoomReducer(state, { type: "select-game", game: "paws-says" })).toBe(state);
});

test.each(["self-ready", "friend-ready"] as const)("%s arriving first waits for the other player before game selection", first => {
  const state = connectedHost();
  const oneReady = duelRoomReducer(state, { type: first, ready: true });
  expect(oneReady.selfReady).toBe(first === "self-ready");
  expect(oneReady.friend?.ready).toBe(first === "friend-ready");
  expect(areDuelPlayersReady(oneReady)).toBe(false);
  expect(canChooseDuelGame(oneReady)).toBe(false);
  expect(canStartDuel(oneReady)).toBe(false);
  expect(duelRoomReducer(oneReady, { type: "select-game", game: "paws-says" })).toBe(oneReady);
  const both = duelRoomReducer(oneReady, { type: first === "self-ready" ? "friend-ready" : "self-ready", ready: true });
  expect(areDuelPlayersReady(both)).toBe(true);
  expect(canChooseDuelGame(both)).toBe(true);
  expect(both.selectedGame).toBeNull();
  expect(canStartDuel(both)).toBe(false);
  expect(both.starting).toBe(false);
  expect(duelRoomReducer(both, { type: "start" })).toBe(both);
});

test("host selection keeps both players ready and enables a separate start action", () => {
  const original = readyHost();
  const selected = duelRoomReducer(original, { type: "select-game", game: "paws-says" });
  expect(selected.room).toBe(original.room);
  expect(selected.friend).toBe(original.friend);
  expect(selected.selfReady).toBe(true);
  expect(selected.selectedGame).toBe("paws-says");
  expect(areDuelPlayersReady(selected)).toBe(true);
  expect(canStartDuel(selected)).toBe(true);
  expect(selected.starting).toBe(false);
});

test.each(["self-ready", "friend-ready"] as const)("cancelling %s invalidates the choice before a fresh selection", participant => {
  const original = selectedHost();
  const unready = duelRoomReducer(original, { type: participant, ready: false });
  expect(unready.selectedGame).toBeNull();
  expect(unready.selfReady).toBe(participant !== "self-ready");
  expect(unready.friend?.ready).toBe(participant !== "friend-ready");
  expect(areDuelPlayersReady(unready)).toBe(false);
  expect(canChooseDuelGame(unready)).toBe(false);
  expect(canStartDuel(unready)).toBe(false);
  const readyAgain = duelRoomReducer(unready, { type: participant, ready: true });
  expect(areDuelPlayersReady(readyAgain)).toBe(true);
  expect(readyAgain.selectedGame).toBeNull();
  expect(canStartDuel(readyAgain)).toBe(false);
});

test("only a ready host can start, and a second start is ignored", () => {
  const waiting = readyHost();
  expect(duelRoomReducer(waiting, { type: "start" })).toBe(waiting);
  const started = duelRoomReducer(selectedHost(), { type: "start" });
  expect(started.starting).toBe(true);
  expect(areDuelPlayersReady(started)).toBe(true);
  expect(canReadyDuel(started)).toBe(false);
  expect(canStartDuel(started)).toBe(false);
  expect(duelRoomReducer(started, { type: "start" })).toBe(started);
  expect(duelRoomReducer(started, { type: "select-game", game: "paws-says" })).toBe(started);
  expect(duelRoomReducer(started, { type: "self-ready", ready: false })).toBe(started);
});

test("guest cannot choose or start; simulated host selection is a separate event", () => {
  const guest = transition(createDuelRoomState(), { type: "join", code: "Q7F9KN" }, { type: "friend-connect", friend: { name: "Host dog" } });
  expect(guest.room?.role).toBe("guest");
  expect(canChooseDuelGame(guest)).toBe(false);
  expect(duelRoomReducer(guest, { type: "select-game", game: "paws-says" })).toBe(guest);
  expect(duelRoomReducer(guest, { type: "preview-host-select-game", game: "paws-says" })).toBe(guest);
  const readyGuest = transition(guest, { type: "self-ready", ready: true }, { type: "friend-ready", ready: true });
  expect(areDuelPlayersReady(readyGuest)).toBe(true);
  expect(canChooseDuelGame(readyGuest)).toBe(false);
  expect(duelRoomReducer(readyGuest, { type: "select-game", game: "paws-says" })).toBe(readyGuest);
  const selectedGuest = duelRoomReducer(readyGuest, { type: "preview-host-select-game", game: "paws-says" });
  expect(selectedGuest.selectedGame).toBe("paws-says");
  expect(areDuelPlayersReady(selectedGuest)).toBe(true);
  expect(canStartDuel(selectedGuest)).toBe(false);
  expect(duelRoomReducer(selectedGuest, { type: "start" })).toBe(selectedGuest);
});

test("reconnecting preserves both positions but requires readiness and selection again", () => {
  const original = selectedHost();
  const reconnecting = duelRoomReducer(original, { type: "reconnect" });
  expect(reconnecting.room).toBe(original.room);
  expect(reconnecting.friend?.name).toBe(original.friend?.name);
  expect(reconnecting.selectedGame).toBeNull();
  expect(reconnecting.selfReady).toBe(false);
  expect(reconnecting.friend?.ready).toBe(false);
  expect(canChooseDuelGame(reconnecting)).toBe(false);
  expect(canReadyDuel(reconnecting)).toBe(false);
  expect(areDuelPlayersReady(reconnecting)).toBe(false);
  expect(canStartDuel(reconnecting)).toBe(false);
  expect(duelRoomReducer(reconnecting, { type: "start" })).toBe(reconnecting);
  expect(duelRoomReducer(reconnecting, { type: "select-game", game: "paws-says" })).toBe(reconnecting);
  expect(duelRoomReducer(reconnecting, { type: "self-ready", ready: true })).toBe(reconnecting);
  expect(duelRoomReducer(reconnecting, { type: "friend-ready", ready: true })).toBe(reconnecting);
  const recovered = duelRoomReducer(reconnecting, { type: "retry" });
  expect(recovered.connection).toBe("connected");
  expect(recovered.selfReady).toBe(false);
  expect(recovered.friend?.ready).toBe(false);
  expect(recovered.selectedGame).toBeNull();
  expect(canReadyDuel(recovered)).toBe(true);
  expect(canStartDuel(recovered)).toBe(false);
});

test("friend leaving invalidates selection and readiness; replacement arrives unready", () => {
  const left = duelRoomReducer(selectedHost(), { type: "friend-disconnect" });
  expect(left.room).not.toBeNull();
  expect(left.friend).toBeNull();
  expect(left.selectedGame).toBeNull();
  expect(left.selfReady).toBe(false);
  const replacement = duelRoomReducer(left, { type: "friend-connect", friend: { name: "Another test dog" } });
  expect(replacement.friend?.ready).toBe(false);
  expect(replacement.selectedGame).toBeNull();
});

test("returning from a round keeps the room but requires fresh readiness and selection", () => {
  const original = duelRoomReducer(selectedHost(), { type: "start" });
  const next = duelRoomReducer(original, { type: "reset-round" });
  expect(next.room).toBe(original.room);
  expect(next.friend?.name).toBe(original.friend?.name);
  expect(next.selfReady).toBe(false);
  expect(next.friend?.ready).toBe(false);
  expect(next.selectedGame).toBeNull();
  expect(next.starting).toBe(false);
  expect(canReadyDuel(next)).toBe(true);
  expect(areDuelPlayersReady(next)).toBe(false);
});

test("leaving clears the room and permits selecting Remote again", () => {
  const state = duelRoomReducer(readyHost(), { type: "leave" });
  expect(state).toEqual(createDuelRoomState());
  expect(duelRoomReducer(state, { type: "location", location: "remote" })).toEqual(createDuelRoomState("remote"));
});

test("code validation accepts only the provided local fixture, with no magic example code", () => {
  expect(sanitizeRoomCode(" q7-f9 kn extra ")).toBe("Q7F9KN");
  expect(validatePreviewRoomCode("q7f9kn", "Q7F9KN")).toBeNull();
  expect(validatePreviewRoomCode("", "Q7F9KN")).toBe("Enter a 6-character room code.");
  expect(validatePreviewRoomCode("PAWS24", "Q7F9KN")).toBe("Preview game not found. Check the code.");
  expect(createPreviewRoomCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  expect(duelRoomReducer(createDuelRoomState(), { type: "create", code: "bad" }).room).toBeNull();
});
