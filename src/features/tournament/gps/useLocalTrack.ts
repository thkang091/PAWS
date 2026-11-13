import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { screenFix, summarizeTrack, type GpsFix, type TrackPoint } from "../../../../supabase/functions/tournament/geo";
import { LocationTracking, type LocationAccess } from "@/features/tournament/gps/locationTracking";

/** No fix for this long means the signal is gone. */
const NO_SIGNAL_MS = 20_000;

/**
 * A walk kept on this phone only: the same GPS hardware and screening as tournament walks, but nothing is sent while
 * walking. Find the Mafia hands the finished walk to the server once, which keeps only which checkpoints it reached.
 */
export const useLocalTrack = (active: boolean, paused = false) => {
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [position, setPosition] = useState<GpsFix | null>(null);
  const [access, setAccess] = useState<LocationAccess | null>(null);
  const [weak, setWeak] = useState(false);
  const [lost, setLost] = useState(false);
  const ref = useRef<TrackPoint[]>([]);
  const lastFix = useRef(0);
  // Each resume starts a new stretch, so a line is never drawn, or counted, across a pause.
  const segment = useRef(0);
  const wasPaused = useRef(paused);
  useEffect(() => {
    if (wasPaused.current && !paused) segment.current += 1;
    wasPaused.current = paused;
  }, [paused]);

  const onFix = useCallback((fix: GpsFix) => {
    lastFix.current = Date.now();
    setLost(false);
    setPosition(fix);
    const previous = ref.current[ref.current.length - 1] ?? null;
    const verdict = screenFix(previous, fix, Date.now(), segment.current);
    setWeak(verdict === "poor_accuracy");
    if (verdict !== "accept") return;
    ref.current = [...ref.current, { ...fix, seq: ref.current.length + 1, segment: segment.current }];
    setPoints(ref.current);
  }, []);

  useEffect(() => {
    if (!active || paused) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    void (async () => {
      const granted = await LocationTracking.requestAccess();
      setAccess(granted);
      if (granted !== "granted" || cancelled) return;
      lastFix.current = Date.now();
      const s = await LocationTracking.watch(onFix).catch(() => null);
      if (cancelled) s?.();
      else stop = s;
    })();
    const id = setInterval(() => setLost(Date.now() - lastFix.current > NO_SIGNAL_MS), 2_000);
    return () => {
      cancelled = true;
      clearInterval(id);
      stop?.();
    };
  }, [active, paused, onFix]);

  const distanceM = useMemo(() => summarizeTrack(points).distanceM, [points]);
  return { points, position: position ? { latitude: position.latitude, longitude: position.longitude } : null, access, weak, lost, distanceM };
};
