jest.mock("react-native", () => ({ AppState: { currentState: "active", addEventListener: jest.fn() } }));
jest.mock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: {} }));
jest.mock("../lib/supabase", () => ({ getSupabaseClient: jest.fn() }));
jest.mock("../providers/AuthProvider", () => ({ useAuth: jest.fn() }));

import { DuelRoomController } from "../features/game/flow/useDuelRoom";
import type { DuelRoomSnapshot } from "../features/game/flow/duelRoomApi";

const USER = "11111111-1111-4111-8111-111111111111";
const FRIEND = "22222222-2222-4222-8222-222222222222";
const ROOM = "33333333-3333-4333-8333-333333333333";
const DOG = "44444444-4444-4444-8444-444444444444";
const REQUEST = "55555555-5555-4555-8555-555555555555";
const KEY = `paws:duel:active_room:${USER}`;
const snapshot = (revision = 1, phase: DuelRoomSnapshot["room"]["phase"] = "waiting"): DuelRoomSnapshot => ({
  meUserId: USER,
  room: { id: ROOM, code: "ABC234", hostUserId: USER, phase, selectedGame: phase === "playing" ? "paws-says" : null, revision, expiresAt: "2099-01-01T00:00:00Z" },
  players: [
    { userId: USER, dogId: DOG, name: "My dog", ready: phase !== "waiting", lastSeenAt: new Date().toISOString() },
    { userId: FRIEND, dogId: FRIEND, name: "Their dog", ready: phase !== "waiting", lastSeenAt: new Date().toISOString() },
  ],
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
function setup(storedRoom: string | null = null) {
  const values = new Map<string, string>(storedRoom ? [[KEY, storedRoom]] : []);
  const storage = {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { values.delete(key); }),
  };
  const api = {
    create: jest.fn(async (_dog: string, _request: string) => snapshot()),
    join: jest.fn(async (_code: string, _dog: string) => snapshot()),
    get: jest.fn(async (_room: string) => snapshot()),
    ready: jest.fn(async (_room: string, _ready: boolean) => snapshot(3)),
    select: jest.fn(async (_room: string) => snapshot(3, "selecting")),
    start: jest.fn(async (_room: string) => snapshot(4, "playing")),
    heartbeat: jest.fn(async (_room: string) => snapshot(2)),
    reset: jest.fn(async (_room: string) => snapshot(5)),
    leave: jest.fn(async (_room: string) => undefined),
  };
  const views: Array<DuelRoomController["current"]> = [];
  const nextId = jest.fn(() => REQUEST);
  const controller = new DuelRoomController(USER, api, storage, view => views.push(view), nextId);
  return { controller, api, storage, values, views, nextId };
}
async function created() {
  const context = setup();
  await context.controller.restore();
  expect(await context.controller.create(DOG)).toBe(true);
  return context;
}

test("a double tap issues one create, and retry after timeout reuses its request ID", async () => {
  const { controller, api, nextId, values } = setup();
  await controller.restore();
  const pending = deferred<DuelRoomSnapshot>();
  api.create.mockImplementationOnce(() => pending.promise);
  const first = controller.create(DOG);
  expect(await controller.create(DOG)).toBe(false);
  pending.reject(new Error("Network timeout"));
  expect(await first).toBe(false);
  expect(await controller.create(DOG)).toBe(true);
  expect(api.create.mock.calls).toEqual([[DOG, REQUEST], [DOG, REQUEST]]);
  expect(nextId).toHaveBeenCalledTimes(1);
  expect(values.get(KEY)).toBe(ROOM);
  controller.dispose();
});

test("a late create response after unmount cannot resurrect the room or persist it", async () => {
  const { controller, api, values } = setup();
  await controller.restore();
  const pending = deferred<DuelRoomSnapshot>();
  api.create.mockImplementationOnce(() => pending.promise);
  const creating = controller.create(DOG);
  for (let flush = 0; flush < 12 && api.create.mock.calls.length === 0; flush += 1) await Promise.resolve();
  expect(api.create).toHaveBeenCalledTimes(1);
  controller.dispose();
  pending.resolve(snapshot());
  expect(await creating).toBe(false);
  expect(controller.current.snapshot).toBeNull();
  expect(values.has(KEY)).toBe(false);
});

test("an interrupted creation is resumed with its saved request ID after remount", async () => {
  const original = setup();
  await original.controller.restore();
  original.api.create.mockRejectedValueOnce(new Error("Network timeout"));
  expect(await original.controller.create(DOG)).toBe(false);
  original.controller.dispose();
  const resumed = new DuelRoomController(USER, original.api, original.storage, () => undefined, original.nextId);
  expect(await resumed.restore()).toBe(true);
  expect(original.api.create.mock.calls).toEqual([[DOG, REQUEST], [DOG, REQUEST]]);
  expect(original.nextId).toHaveBeenCalledTimes(1);
  expect(original.values.get(KEY)).toBe(ROOM);
  expect(original.values.has(`paws:duel:pending_create:${USER}`)).toBe(false);
  resumed.dispose();
});

test("an interrupted join resumes its saved code and dog after remount", async () => {
  const original = setup();
  await original.controller.restore();
  original.api.join.mockRejectedValueOnce(new Error("Network timeout")).mockResolvedValueOnce(snapshot(2, "selecting"));
  expect(await original.controller.join("abc234", DOG)).toBe(false);
  original.controller.dispose();
  const resumed = new DuelRoomController(USER, original.api, original.storage, () => undefined);
  expect(await resumed.restore()).toBe(true);
  expect(original.api.join.mock.calls).toEqual([["ABC234", DOG], ["ABC234", DOG]]);
  expect(original.values.get(KEY)).toBe(ROOM);
  expect(original.values.has(`paws:duel:pending_join:${USER}`)).toBe(false);
  expect(original.api.ready).toHaveBeenCalledWith(ROOM, false);
  expect(resumed.current.snapshot?.room.phase).toBe("waiting");
  resumed.dispose();
});

test("old revisions and a response for another room cannot replace the bound room", async () => {
  const { controller, api } = await created();
  api.get.mockResolvedValueOnce(snapshot(0));
  expect(await controller.refresh()).toBe(false);
  expect(controller.current.snapshot?.room.revision).toBe(1);
  const wrongRoom = snapshot(50);
  wrongRoom.room.id = FRIEND;
  api.get.mockResolvedValueOnce(wrongRoom);
  expect(await controller.refresh()).toBe(false);
  expect(controller.current.snapshot?.room.id).toBe(ROOM);
  expect(controller.current.snapshot?.room.revision).toBe(1);
  controller.dispose();
});

test("a snapshot for another authenticated user is rejected before binding or persistence", async () => {
  const { controller, api, values } = setup();
  await controller.restore();
  api.create.mockResolvedValueOnce({ ...snapshot(), meUserId: FRIEND });
  expect(await controller.create(DOG)).toBe(false);
  expect(controller.current.snapshot).toBeNull();
  expect(values.has(KEY)).toBe(false);
  controller.dispose();
});

test("failed leave keeps the room and persisted ID; successful leave clears both", async () => {
  const { controller, api, values } = await created();
  api.leave.mockRejectedValueOnce(new Error("Network timeout"));
  expect(await controller.leave()).toBe(false);
  expect(controller.current.snapshot?.room.id).toBe(ROOM);
  expect(values.get(KEY)).toBe(ROOM);
  expect(await controller.leave()).toBe(true);
  expect(controller.current.snapshot).toBeNull();
  expect(values.has(KEY)).toBe(false);
  controller.dispose();
});

test("recovery clears own Ready on the server before exposing a selecting snapshot", async () => {
  const { controller, api, views } = await created();
  api.get.mockRejectedValueOnce(new Error("Network unavailable"));
  expect(await controller.refresh()).toBe(false);
  expect(controller.current.connected).toBe(false);
  api.get.mockResolvedValueOnce(snapshot(2, "selecting"));
  api.ready.mockResolvedValueOnce(snapshot(3, "waiting"));
  const start = views.length;
  expect(await controller.refresh()).toBe(true);
  expect(api.ready).toHaveBeenCalledWith(ROOM, false);
  expect(views.slice(start).some(view => view.connected && view.snapshot?.room.phase === "selecting")).toBe(false);
  expect(controller.current.snapshot?.players.find(player => player.userId === USER)?.ready).toBe(false);
  controller.dispose();
});

test("connection loss during a Ready mutation is reconciled before its response becomes visible", async () => {
  const { controller, api, views } = await created();
  const pending = deferred<DuelRoomSnapshot>();
  api.ready.mockImplementationOnce(() => pending.promise).mockResolvedValueOnce(snapshot(4));
  const ready = controller.ready(true);
  await Promise.resolve();
  controller.connectionLost();
  const start = views.length;
  pending.resolve(snapshot(3, "selecting"));
  expect(await ready).toBe(true);
  expect(api.ready.mock.calls).toEqual([[ROOM, true], [ROOM, false]]);
  expect(views.slice(start).some(view => view.connected && view.snapshot?.room.phase === "selecting")).toBe(false);
  controller.dispose();
});

test("an already playing round survives reconnect without unready or reset", async () => {
  const { controller, api } = await created();
  controller.connectionLost();
  api.get.mockResolvedValueOnce(snapshot(4, "playing"));
  expect(await controller.refresh()).toBe(true);
  expect(controller.current.snapshot?.room.phase).toBe("playing");
  expect(api.ready).not.toHaveBeenCalled();
  expect(api.reset).not.toHaveBeenCalled();
  controller.dispose();
});

test("restore retains a room ID on network failure, but removes a missing room", async () => {
  const recovering = setup(ROOM);
  recovering.api.heartbeat.mockRejectedValueOnce(new Error("Offline"));
  expect(await recovering.controller.restore()).toBe(false);
  expect(recovering.values.get(KEY)).toBe(ROOM);
  expect(recovering.controller.current.roomId).toBe(ROOM);
  expect(recovering.controller.current.restoring).toBe(false);
  recovering.controller.dispose();
  const missing = setup(ROOM);
  missing.api.heartbeat.mockRejectedValueOnce(new Error("DUEL_ROOM_NOT_FOUND"));
  expect(await missing.controller.restore()).toBe(false);
  expect(missing.values.has(KEY)).toBe(false);
  expect(missing.controller.current.roomId).toBeNull();
  missing.controller.dispose();
});

test("a closed room clears the local binding and informs the remaining player", async () => {
  const { controller, api, values } = await created();
  api.get.mockResolvedValueOnce(snapshot(2, "closed"));
  expect(await controller.refresh()).toBe(false);
  expect(controller.current.snapshot).toBeNull();
  expect(controller.current.error).toContain("host left");
  expect(values.has(KEY)).toBe(false);
  controller.dispose();
});

test("backgrounding clears Ready best effort, and polling does not heartbeat in the background", async () => {
  const { controller, api } = await created();
  controller.setActive(false);
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(api.ready).toHaveBeenCalledWith(ROOM, false);
  expect(await controller.refresh(true)).toBe(false);
  expect(api.heartbeat).not.toHaveBeenCalled();
  expect(controller.current.connected).toBe(false);
  controller.dispose();
});

test("invalid codes and missing dog profiles fail without any network request", async () => {
  const { controller, api } = setup();
  await controller.restore();
  expect(await controller.create(null)).toBe(false);
  expect(controller.current.error).toContain("dog’s profile");
  expect(await controller.join("ABC", DOG)).toBe(false);
  expect(controller.current.error).toBe("Enter a 6-character game code.");
  expect(api.create).not.toHaveBeenCalled();
  expect(api.join).not.toHaveBeenCalled();
  controller.dispose();
});
