import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { joinRoomChannel } from "@/services/roomChannel";
import { getNumberRaceState, numberMatchOfRoom, numberTrailDeployed, type NumberBroadcast, type RaceState } from "@/services/numberRaceService";
import { EMPTY_CURSOR, betterOffset, clockOffset, isNewer, onBroadcast, takeEvents, type SyncCursor } from "@/features/numberTrail/raceSync";
import type { NumberEvent } from "../../supabase/functions/tournament/numberContract";

export const ntKeys = {
  available: ["numberTrail", "available"] as const,
  match: (roomId: string) => ["numberTrail", "match", roomId] as const,
  state: (matchId: string) => ["numberTrail", "state", matchId] as const,
};

/** Whether Number Trail is set up on this backend. Undefined while checking. */
export const useNumberTrailAvailable = () =>
  useQuery({ queryKey: ntKeys.available, queryFn: numberTrailDeployed, staleTime: 5 * 60_000, retry: 1 });

/** Slow fallback refresh, in case a broadcast is missed; faster while racing. */
const POLL_MS = { idle: 10_000, racing: 6_000 } as const;

/**
 * A Number Trail room, kept in step for this player. The server's number_race_state is the only truth: broadcasts on
 * the room's private channel only say "event N happened", and this hook then reloads (asking for events after the last
 * one it has). A reconnect, a return to the foreground or the slow poll do the same, so a repeated, late or missed
 * event never leaves the screen wrong. Presence on the channel shows who is connected; no location ever goes on it.
 */
export const useNumberRace = (roomId: string | undefined, onEvents?: (fresh: NumberEvent[], state: RaceState) => void) => {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(false);
  const cursor = useRef<SyncCursor>(EMPTY_CURSOR);
  const offset = useRef<{ offsetMs: number; rttMs: number } | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const onEventsRef = useRef(onEvents);
  onEventsRef.current = onEvents;

  const match = useQuery({ queryKey: ntKeys.match(roomId ?? ""), queryFn: () => numberMatchOfRoom(roomId ?? ""), enabled: Boolean(roomId), staleTime: 0 });
  const matchId = match.data ?? null;

  const state = useQuery({
    queryKey: ntKeys.state(matchId ?? ""),
    enabled: Boolean(matchId),
    staleTime: 0,
    queryFn: async () => {
      const after = cursor.current.matchId === matchId ? Math.max(0, cursor.current.seen) : 0;
      const r = await getNumberRaceState(matchId!, after);
      offset.current = betterOffset(offset.current, { offsetMs: clockOffset(r.state.serverNow, r.sentAt, r.receivedAt), rttMs: r.receivedAt - r.sentAt });
      setOffsetMs(offset.current.offsetMs);
      return r.state;
    },
    // A slower, older reply never replaces a newer one.
    structuralSharing: (old: unknown, next: unknown) => (isNewer(old as RaceState | undefined, next as RaceState) ? (next as RaceState) : (old as RaceState)),
    refetchInterval: (q) => {
      const s = (q.state.data as RaceState | undefined)?.match.status;
      return s === "active" || s === "verifying" || s === "countdown" ? POLL_MS.racing : POLL_MS.idle;
    },
    retry: (count, error) => count < 2 && !["not_in_match", "match_not_found", "not_deployed"].includes((error as { code?: string })?.code ?? ""),
  });

  // Events that are news, once each, in order.
  useEffect(() => {
    const s = state.data;
    if (!s) return;
    const { fresh, cursor: next } = takeEvents(cursor.current, s);
    cursor.current = next;
    if (fresh.length) onEventsRef.current?.(fresh, s);
  }, [state.data]);

  const reloadMatch = useCallback(() => void queryClient.invalidateQueries({ queryKey: ntKeys.match(roomId ?? "") }), [queryClient, roomId]);
  const reload = useCallback(() => {
    if (matchId) void queryClient.invalidateQueries({ queryKey: ntKeys.state(matchId) });
  }, [queryClient, matchId]);

  const userId = state.data?.me.userId;
  // Through refs, so a new match id doesn't leave and rejoin the room's channel.
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const reloadMatchRef = useRef(reloadMatch);
  reloadMatchRef.current = reloadMatch;
  useEffect(() => {
    if (!roomId || !userId) return;
    const leave = joinRoomChannel(roomId, userId, {
      onNumber: (payload) => {
        const msg = payload as unknown as NumberBroadcast;
        if (cursor.current.matchId && msg.matchId !== cursor.current.matchId) {
          reloadMatchRef.current(); // a new race in this room (play again)
          return;
        }
        if (onBroadcast(cursor.current, msg).kind === "reload") reloadRef.current();
      },
      // Room changes (joins, leaves, settings) arrive as the room's own ping.
      onChanged: () => {
        reloadRef.current();
        reloadMatchRef.current();
      },
      onPresence: (ids) => setOnline(new Set(ids)),
      onStatus: (isLive) => {
        setLive(isLive);
        if (isLive) reloadRef.current();
      },
    });
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        reloadRef.current();
        reloadMatchRef.current();
      }
    });
    return () => {
      sub.remove();
      leave();
    };
  }, [roomId, userId]);

  return {
    matchId,
    state: state.data,
    loading: match.isLoading || (Boolean(matchId) && state.isLoading),
    error: ((match.error ?? state.error) as { code?: string } | null)?.code ?? null,
    noMatch: match.isSuccess && !matchId,
    offsetMs,
    online,
    live,
    refresh: () => {
      reloadMatch();
      reload();
    },
  };
};
