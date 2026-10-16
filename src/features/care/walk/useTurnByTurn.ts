import { useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";

import { distanceKm, type NavStep } from "@/features/care/walk/routePlanner";
import type { LatLng } from "@/features/care/walk/walkRoutes";

/** Within this of a turn, the turn counts as taken. */
const REACHED_KM = 0.025;

export type TurnState = {
  /** The street you are on now. */
  current: NavStep | null;
  /** The turn coming up; null on the last stretch. */
  upcoming: NavStep | null;
  /** Metres to the end of the current stretch, where the next turn is. */
  meters: number | null;
  finished: boolean;
};

/** Follows Google's walking steps against live GPS, one turn at a time. */
export const useTurnByTurn = (steps: readonly NavStep[] | undefined, position: LatLng | null, active: boolean): TurnState => {
  const [index, setIndex] = useState(0);
  const last = useRef(0);
  const list = steps ?? [];

  useEffect(() => {
    if (!active || !position || list.length === 0) return;
    let next = last.current;
    while (next < list.length && distanceKm(position, list[next].end) <= REACHED_KM) next++;
    if (next !== last.current) {
      last.current = next;
      setIndex(next);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [position, active, list]);

  const current = list[index] ?? null;
  return {
    current,
    upcoming: list[index + 1] ?? null,
    meters: current && position ? Math.round(distanceKm(position, current.end) * 1000) : null,
    finished: list.length > 0 && index >= list.length,
  };
};
