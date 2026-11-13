import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import {
  GPS_RULES,
  evaluateTerritory,
  screenFix,
  summarizeTrack,
  type GpsFix,
  type TrackPoint,
} from "../../../../supabase/functions/tournament/geo";
import { LocationTracking, type LocationAccess } from "@/features/tournament/gps/locationTracking";
import { SEND_AT, SEND_EVERY_MS, confirm, nextBatch, pendingPoints } from "@/features/tournament/gps/walkQueue";
import { walkStore, type StoredWalk } from "@/features/tournament/gps/walkStore";
import {
  TournamentError,
  cancelWalk,
  sendPoints,
  setWalkState,
  startWalk,
  submitWalk,
  type SubmitReply,
} from "@/services/tournamentService";

export type WalkPhase = "idle" | "starting" | "tracking" | "paused" | "submitting";
export type WalkWarning = "weak_gps" | "no_signal" | null;
export type LatLng = { latitude: number; longitude: number };

/** No fix for this long while walking means the signal is gone. */
const NO_SIGNAL_MS = 20_000;
const SAVE_EVERY_MS = 10_000;

/**
 * One territory walk: GPS in, screened fixes kept, points sent in batches, the walk saved on the phone between
 * batches. Scoring is the server's; what this hook measures is a preview.
 */
export const useTerritoryWalk = ({ tournamentId, dogId, assignmentId = null }: { tournamentId: string | undefined; dogId: string | null; assignmentId?: string | null }) => {
  const [phase, setPhase] = useState<WalkPhase>("idle");
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [position, setPosition] = useState<GpsFix | null>(null);
  const [warning, setWarning] = useState<WalkWarning>(null);
  const [activeMs, setActiveMs] = useState(0);
  const [access, setAccess] = useState<LocationAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);
  const [restorable, setRestorable] = useState<StoredWalk | null>(null);
  /** True once the phone has been checked for an unfinished walk, so nothing flashes up and away before then. */
  const [checked, setChecked] = useState(false);
  const [pausedByApp, setPausedByApp] = useState(false);

  const walk = useRef<StoredWalk | null>(null);
  const phaseRef = useRef<WalkPhase>("idle");
  phaseRef.current = phase;
  const lastFixAt = useRef(0);
  const sending = useRef<Promise<boolean> | null>(null);
  const lastSave = useRef(0);

  // A walk left unfinished on this phone for this tournament can be picked up again.
  useEffect(() => {
    void walkStore.load().then((stored) => {
      if (stored && stored.tournamentId === tournamentId) setRestorable(stored);
      setChecked(true);
    });
  }, [tournamentId]);

  const save = useCallback((force = false) => {
    const w = walk.current;
    if (!w || (!force && Date.now() - lastSave.current < SAVE_EVERY_MS)) return;
    lastSave.current = Date.now();
    void walkStore.save(w);
  }, []);

  const sync = useCallback(() => {
    const w = walk.current;
    setPending(w ? pendingPoints(w.points, w.sentThrough).length : 0);
  }, []);

  /** Sends what is waiting. With `all`, keeps sending until nothing is left or the network fails. */
  const flush = useCallback(
    (all = false): Promise<boolean> => {
      if (sending.current) return sending.current;
      const run = async () => {
        try {
          for (;;) {
            const w = walk.current;
            if (!w) return true;
            const batch = nextBatch(w.points, w.sentThrough);
            if (!batch.length) return true;
            const reply = await sendPoints(w.sessionId, batch);
            w.sentThrough = confirm(w.sentThrough, Math.max(reply.storedThrough, batch[batch.length - 1].seq));
            setOffline(false);
            sync();
            save(true);
            if (!all) return pendingPoints(w.points, w.sentThrough).length === 0;
          }
        } catch (e) {
          const code = (e as TournamentError).code;
          if (code === "network" || code === "timeout" || code === "server_error") setOffline(true);
          else setError(code ?? "server_error");
          return false;
        } finally {
          sending.current = null;
        }
      };
      sending.current = run();
      return sending.current;
    },
    [save, sync],
  );

  const onFix = useCallback(
    (fix: GpsFix) => {
      lastFixAt.current = Date.now();
      setPosition(fix);
      const w = walk.current;
      if (!w || phaseRef.current !== "tracking") return;
      const previous = w.points[w.points.length - 1] ?? null;
      const verdict = screenFix(previous, fix, Date.now(), w.segment);
      if (verdict === "poor_accuracy") {
        setWarning("weak_gps");
        return;
      }
      if (verdict !== "accept") return;
      setWarning(null);
      const point: TrackPoint = { ...fix, seq: w.nextSeq, segment: w.segment };
      w.nextSeq += 1;
      w.points = [...w.points, point];
      setPoints(w.points);
      sync();
      save();
      if (pendingPoints(w.points, w.sentThrough).length >= SEND_AT) void flush();
    },
    [flush, save, sync],
  );

  // GPS runs for as long as a walk is live (walking, paused or handing in), and restarts if it is ever torn down.
  const live = phase === "tracking" || phase === "paused" || phase === "submitting";
  useEffect(() => {
    if (!live) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    lastFixAt.current = Date.now();
    LocationTracking.watch(onFix)
      .then((s) => (cancelled ? s() : (stop = s)))
      .catch(() => setError("location_off"));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [live, onFix]);

  // The clock counts only while walking; it also notices when fixes stop arriving.
  useEffect(() => {
    if (phase !== "tracking") return;
    const id = setInterval(() => {
      if (walk.current) walk.current.activeMs += 1000;
      setActiveMs((ms) => ms + 1000);
      if (Date.now() - lastFixAt.current > NO_SIGNAL_MS) setWarning("no_signal");
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "tracking" && phase !== "paused") return;
    const id = setInterval(() => void flush(), SEND_EVERY_MS);
    return () => clearInterval(id);
  }, [phase, flush]);

  const pause = useCallback(
    (byApp = false) => {
      const w = walk.current;
      if (!w || phaseRef.current !== "tracking") return;
      w.paused = true;
      setPhase("paused");
      setPausedByApp(byApp);
      save(true);
      void setWalkState(w.sessionId, "paused").catch(() => undefined);
      void flush();
    },
    [flush, save],
  );

  const resume = useCallback(() => {
    const w = walk.current;
    if (!w || phaseRef.current !== "paused") return;
    // A new stretch: the line is not drawn across the pause, and the server never joins the two.
    w.segment += 1;
    w.paused = false;
    setPausedByApp(false);
    setPhase("tracking");
    save(true);
    void setWalkState(w.sessionId, "active").catch(() => undefined);
  }, [save]);

  // Foreground tracking only: leaving PAWS pauses the walk rather than drawing a guess across the gap.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && phaseRef.current === "tracking") pause(true);
      if (state !== "active") save(true);
    });
    return () => sub.remove();
  }, [pause, save]);

  const begin = useCallback(async () => {
    if (!tournamentId) return;
    setError(null);
    const granted = await LocationTracking.requestAccess();
    setAccess(granted);
    if (granted !== "granted") return;
    if (!(await LocationTracking.servicesOn())) {
      setError("location_off");
      return;
    }
    setPhase("starting");
    try {
      const first = await startWalk(tournamentId, dogId, assignmentId);
      let session = first.session;
      const resumed = first.resumed;
      const local = restorable && restorable.sessionId === session.id ? restorable : null;
      if (resumed && !local) {
        // The server has an open walk this phone no longer remembers: close it and start clean.
        await cancelWalk(session.id).catch(() => undefined);
        ({ session } = await startWalk(tournamentId, dogId, assignmentId));
      }
      walk.current = local
        ? { ...local, segment: local.segment + 1, paused: false }
        : { sessionId: session.id, tournamentId, startedAt: session.startedAt, points: [], sentThrough: session.lastSeq, nextSeq: session.lastSeq + 1, segment: 0, activeMs: 0, paused: false };
      if (local) void setWalkState(session.id, "active").catch(() => undefined);
      setRestorable(null);
      setPoints(walk.current.points);
      setActiveMs(walk.current.activeMs);
      sync();
      save(true);
      setPhase("tracking");
    } catch (e) {
      setError((e as TournamentError).code ?? "server_error");
      setPhase("idle");
    }
  }, [assignmentId, dogId, restorable, save, sync, tournamentId]);

  const end = useCallback(async () => {
    walk.current = null;
    await walkStore.clear();
    setPoints([]);
    setActiveMs(0);
    setPending(0);
    setPhase("idle");
  }, []);

  /** Sends everything left, then asks the server to check and score the walk. */
  const finish = useCallback(async (): Promise<SubmitReply | null> => {
    const w = walk.current;
    if (!w) return null;
    const was = phaseRef.current;
    setPhase("submitting");
    setError(null);
    const allSent = await flush(true);
    if (!allSent) {
      setPhase(was);
      setError((current) => current ?? "offline_pending");
      return null;
    }
    try {
      const reply = await submitWalk(w.sessionId);
      if (reply.status === "recorded") {
        await end();
        return reply;
      }
      setPhase(was === "submitting" ? "paused" : was);
      return reply;
    } catch (e) {
      setError((e as TournamentError).code ?? "server_error");
      setPhase(was);
      return null;
    }
  }, [end, flush]);

  /** Ends the walk on this phone at once; the server is told in the background (a missed call is closed on the next Start). */
  const cancel = useCallback(async () => {
    const id = (walk.current ?? restorable)?.sessionId;
    setRestorable(null);
    await end();
    if (id) void cancelWalk(id).catch(() => undefined);
  }, [end, restorable]);

  // Live preview: area and closure without the slow crossing check.
  const previewKey = Math.floor(points.length / 3);
  // Recomputed every few points, which is often enough for a number that changes slowly.
  const preview = useMemo(() => evaluateTerritory(points, GPS_RULES, { checkCrossing: false }), [previewKey]);
  const summary = useMemo(() => summarizeTrack(points), [points]);

  const segments = useMemo(() => {
    const out: LatLng[][] = [];
    let current: LatLng[] = [];
    let seg = points[0]?.segment;
    for (const p of points) {
      if (p.segment !== seg) {
        if (current.length) out.push(current);
        current = [];
        seg = p.segment;
      }
      current.push({ latitude: p.latitude, longitude: p.longitude });
    }
    if (current.length) out.push(current);
    return out;
  }, [points]);

  return {
    phase,
    points,
    segments,
    start: points[0] ? { latitude: points[0].latitude, longitude: points[0].longitude } : null,
    position: position ? { latitude: position.latitude, longitude: position.longitude } : null,
    accuracyM: position?.accuracyM ?? null,
    warning,
    activeMs,
    distanceM: summary.distanceM,
    preview,
    offline,
    pending,
    access,
    error,
    restorable,
    checked,
    pausedByApp,
    begin,
    pause: () => pause(false),
    resume,
    finish,
    cancel,
    clearError: () => setError(null),
  };
};
