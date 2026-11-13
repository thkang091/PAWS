/**
 * One Realtime channel per room, shared by the lobby, the Mafia route screen and the Number Trail race. The fake
 * client behaves like realtime-js 2.x where it matters: asking for a topic again returns the same channel (even while
 * it closes), callbacks can't be added once it has joined, and removing it finishes later.
 */
type Handler = { type: string; event: string; cb: (m: { payload?: unknown }) => void };

class FakeChannel {
  handlers: Handler[] = [];
  joined = false;
  closed = false;
  statusCb: ((s: string) => void) | null = null;
  constructor(public topic: string) {}
  on(type: string, filter: { event: string }, cb: Handler["cb"]) {
    if (this.joined && type === "presence") throw new Error(`cannot add \`presence\` callbacks for ${this.topic} after \`subscribe()\`.`);
    this.handlers.push({ type, event: filter.event, cb });
    return this;
  }
  subscribe(cb: (s: string) => void) {
    if (this.joined) throw new Error("tried to subscribe multiple times");
    this.joined = true;
    this.statusCb = cb;
    queueMicrotask(() => cb("SUBSCRIBED"));
    return this;
  }
  async track() {
    return "ok";
  }
  presenceState() {
    return { u1: [{}], u2: [{}] };
  }
  emit(type: string, event: string, payload?: unknown) {
    for (const h of this.handlers) if (h.type === type && h.event === event) h.cb({ payload });
  }
}

const channels: FakeChannel[] = [];
const created: FakeChannel[] = [];
const client = {
  realtime: { setAuth: async () => undefined },
  getChannels: () => channels,
  channel: (topic: string) => {
    const full = `realtime:${topic}`;
    const found = channels.find((c) => c.topic === full);
    if (found) return found;
    const c = new FakeChannel(full);
    channels.push(c);
    created.push(c);
    return c;
  },
  removeChannel: async (c: FakeChannel) => {
    await new Promise((r) => setTimeout(r, 50));
    c.closed = true;
    channels.splice(channels.indexOf(c), 1);
    return "ok";
  },
};

jest.mock("@/services/serviceUtils", () => ({ getClientOrThrow: () => client }));

import { joinRoomChannel, openRoomChannels } from "@/services/roomChannel";

const flush = () => new Promise((r) => setTimeout(r, 0));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  channels.length = 0;
  created.length = 0;
});

describe("one channel per room, shared", () => {
  it("the lobby and a screen over it listen on one channel, without adding callbacks after it joined", async () => {
    const lobby = { changed: 0, live: false, online: new Set<string>() };
    const leaveLobby = joinRoomChannel("r1", "u1", { onChanged: () => lobby.changed++, onStatus: (l) => (lobby.live = l), onPresence: (ids) => (lobby.online = ids) });
    await flush();
    await flush();
    expect(lobby.live).toBe(true);
    // A second screen joins once the channel is up: same channel, told it is live at once.
    let overLive = false;
    let overChanged = 0;
    const leaveOver = () => undefined;
    const leave2 = joinRoomChannel("r1", "u1", { onChanged: () => overChanged++, onStatus: (l) => (overLive = l) });
    expect(overLive).toBe(true);
    expect(created).toHaveLength(1);
    created[0].emit("broadcast", "changed", { version: 3 });
    created[0].emit("presence", "sync");
    expect([lobby.changed, overChanged]).toEqual([1, 1]);
    expect([...lobby.online].sort()).toEqual(["u1", "u2"]);
    leave2();
    leaveOver();
    leaveLobby();
  });

  it("hands the room from the lobby to the race on the same connection (the redirect)", async () => {
    const leaveLobby = joinRoomChannel("r2", "u1", { onChanged: () => undefined });
    await flush();
    await flush();
    // The lobby unmounts and the race mounts in the same moment.
    leaveLobby();
    const numbers: unknown[] = [];
    const leaveRace = joinRoomChannel("r2", "u1", { onNumber: (p) => numbers.push(p) });
    await wait(1_700);
    expect(created).toHaveLength(1);
    expect(created[0].closed).toBe(false);
    created[0].emit("broadcast", "number", { matchId: "m1", seq: 4 });
    expect(numbers).toEqual([{ matchId: "m1", seq: 4 }]);
    leaveRace();
  });

  it("closes after the last screen leaves, and a later join gets a fresh channel even if the old one is still closing", async () => {
    const leave = joinRoomChannel("r3", "u1", {});
    await flush();
    await flush();
    leave();
    await wait(1_520); // linger is over; the old channel is closing now (removal takes 50 ms)
    expect(openRoomChannels()).toBe(0);
    let live = false;
    const again = joinRoomChannel("r3", "u1", { onStatus: (l) => (live = l) });
    await wait(120);
    expect(created).toHaveLength(2);
    expect(created[0].closed).toBe(true);
    expect(created[1]).not.toBe(created[0]);
    expect(live).toBe(true);
    again();
  });
});
