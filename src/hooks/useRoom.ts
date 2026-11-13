import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { joinRoomChannel } from "@/services/roomChannel";
import { getRoomState, type RoomState } from "@/services/roomService";

export const roomKey = (roomId: string) => ["room", roomId] as const;

/** Fallback refresh, in case a broadcast is missed or Realtime is unavailable. */
const POLL_MS = 8_000;

/**
 * One room, kept in step for everyone in it.
 *
 * The server's copy is the only truth: every change to a room makes the database broadcast "changed, version N" on
 * the room's private channel, with nothing secret in it, and this hook then fetches the state this player is allowed
 * to see. Presence on the same channel shows who is connected. A reconnect, a return to the foreground or the slow
 * poll all trigger the same fetch, so a missed or repeated event never leaves anyone behind.
 *
 * The channel is shared through `joinRoomChannel`, so any number of screens can listen to one room. `live: false`
 * only reads the room (the Mafia route screen, whose room screen underneath already listens).
 */
export const useRoom = (roomId: string | undefined, { live: join = true }: { live?: boolean } = {}) => {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(false);
  const seen = useRef(new Set<string>());

  const query = useQuery({
    queryKey: roomKey(roomId ?? ""),
    queryFn: () => getRoomState(roomId ?? ""),
    enabled: Boolean(roomId),
    refetchInterval: POLL_MS,
    staleTime: 0,
    retry: (count, error) => count < 2 && !["not_in_room", "removed_from_room", "room_not_found", "not_deployed"].includes((error as { code?: string })?.code ?? ""),
  });
  const version = query.data?.room.version ?? -1;
  const versionRef = useRef(version);
  versionRef.current = version;
  const userId = query.data?.me.userId;

  useEffect(() => {
    if (!roomId || !userId || !join) return;
    const refetch = () => void queryClient.invalidateQueries({ queryKey: roomKey(roomId) });
    const leave = joinRoomChannel(roomId, userId, {
      onChanged: (p) => {
        // Events can arrive twice or late; each is used once, and only if it is newer than what is on screen.
        if (typeof p.eventId === "string") {
          if (seen.current.has(p.eventId)) return;
          seen.current.add(p.eventId);
        }
        if (typeof p.version === "number" && p.version <= versionRef.current) return;
        refetch();
      },
      onPresence: (ids) => setOnline(new Set(ids)),
      onStatus: (isLive) => {
        setLive(isLive);
        if (isLive) refetch();
      },
    });
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refetch();
    });
    return () => {
      sub.remove();
      leave();
    };
  }, [roomId, userId, queryClient, join]);

  /** The server's clock minus this phone's, so countdowns agree across phones. */
  const offsetMs = query.data ? Date.parse(query.data.serverNow) - (query.dataUpdatedAt || Date.now()) : 0;

  return { ...query, state: query.data as RoomState | undefined, online, live, offsetMs, refresh: () => void query.refetch() };
};
