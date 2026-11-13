import type { RealtimeChannel } from "@supabase/supabase-js";

import { getClientOrThrow } from "@/services/serviceUtils";

/**
 * One Realtime channel per room, shared by every screen that listens to it.
 *
 * The database pings a room's private channel `room:<id>` ("changed" for the room, "number" for a Number Trail race).
 * Realtime keeps one channel per topic: asking for the topic again returns the same channel, even one that is still
 * closing, and callbacks can't be added to a joined channel. So screens never open the channel themselves. They join
 * here and get their callbacks from one set of handlers registered once. When the last screen leaves, the channel
 * stays open a moment longer, so handing a room from one screen to the next (lobby to race) keeps the same connection.
 */

export type RoomListener = {
  onChanged?: (payload: Record<string, unknown>) => void;
  onNumber?: (payload: Record<string, unknown>) => void;
  onPresence?: (userIds: Set<string>) => void;
  /** Called with true each time the channel (re)connects, so screens can reload what they may have missed. */
  onStatus?: (live: boolean) => void;
};

type Entry = {
  channel: RealtimeChannel | null;
  listeners: Set<RoomListener>;
  live: boolean;
  online: Set<string>;
  closing: ReturnType<typeof setTimeout> | null;
  ready: Promise<void>;
};

const LINGER_MS = 1_500;
const entries = new Map<string, Entry>();

const open = (roomId: string, userId: string): Entry => {
  const topic = `room:${roomId}`;
  const entry: Entry = { channel: null, listeners: new Set(), live: false, online: new Set(), closing: null, ready: Promise.resolve() };
  entry.ready = (async () => {
    const client = getClientOrThrow();
    // A channel on this topic still closing from before would be handed back by Realtime: let it finish first.
    const stale = client.getChannels().find((c) => c.topic === `realtime:${topic}`);
    if (stale) await client.removeChannel(stale).catch(() => undefined);
    await client.realtime.setAuth().catch(() => undefined);
    if (entries.get(topic) !== entry) return;
    const channel = client.channel(topic, { config: { private: true, presence: { key: userId } } });
    const each = (fn: (l: RoomListener) => void) => entry.listeners.forEach(fn);
    channel
      .on("broadcast", { event: "changed" }, ({ payload }) => each((l) => l.onChanged?.((payload ?? {}) as Record<string, unknown>)))
      .on("broadcast", { event: "number" }, ({ payload }) => each((l) => l.onNumber?.((payload ?? {}) as Record<string, unknown>)))
      .on("presence", { event: "sync" }, () => {
        entry.online = new Set(Object.keys(channel.presenceState()));
        each((l) => l.onPresence?.(entry.online));
      });
    entry.channel = channel;
    channel.subscribe(async (status) => {
      entry.live = status === "SUBSCRIBED";
      each((l) => l.onStatus?.(entry.live));
      if (status === "SUBSCRIBED") await channel.track({ at: Date.now() }).catch(() => undefined);
    });
  })();
  entries.set(topic, entry);
  return entry;
};

/** Listens to a room's channel. Returns the function that stops listening. */
export const joinRoomChannel = (roomId: string, userId: string, listener: RoomListener) => {
  const topic = `room:${roomId}`;
  const entry = entries.get(topic) ?? open(roomId, userId);
  if (entry.closing) {
    clearTimeout(entry.closing);
    entry.closing = null;
  }
  entry.listeners.add(listener);
  // A screen joining a channel that is already up hears where it stands at once.
  if (entry.live) listener.onStatus?.(true);
  if (entry.online.size) listener.onPresence?.(entry.online);

  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size || entry.closing) return;
    entry.closing = setTimeout(() => {
      entry.closing = null;
      if (entry.listeners.size || entries.get(topic) !== entry) return;
      entries.delete(topic);
      void entry.ready.then(() => {
        if (entry.channel) void getClientOrThrow().removeChannel(entry.channel).catch(() => undefined);
      });
    }, LINGER_MS);
  };
};

/** For tests: how many rooms have a channel open or lingering. */
export const openRoomChannels = () => entries.size;
