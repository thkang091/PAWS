import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { metersBetween, screenFix, summarizeTrack, type GpsFix, type TrackPoint } from "../../../supabase/functions/tournament/geo";
import { ownProgress, verifyRace, type NumberCourse, type OwnProgress, type ProgressPhase } from "../../../supabase/functions/tournament/numberMatch";
import { LocationTracking, type LocationAccess } from "@/features/tournament/gps/locationTracking";
import { confirm, pendingPoints } from "@/features/tournament/gps/walkQueue";
import { GPS_STATUS_RULES, gpsStatusOf } from "@/features/numberTrail/gpsStatus";
import { nextFinishKey } from "@/features/numberTrail/raceSync";
import { NumberRaceError, startNumberWalk, submitNumberFinish, submitNumberProgress, type FinishReply } from "@/services/numberRaceService";

type LatLng = { latitude: number; longitude: number };

/**
 * Where a walk is sent. A race (the default) and a practice walk use different server actions but the same GPS
 * handling, saving and offline queue. `id` is the match or the practice.
 */
export type WalkApi<F = FinishReply> = {
  open: (id: string) => Promise<{ sessionId: string; lastSeq: number; resumed: boolean }>;
  progress: (id: string, points: readonly TrackPoint[]) => Promise<{ storedThrough: number; verified: boolean; phase?: ProgressPhase; progress?: OwnProgress }>;
  finish: (id: string, requestKey: string, points: readonly TrackPoint[]) => Promise<F>;
  /** The walk is over for good once this reply comes back (the phone's copy can go). */
  done: (reply: F) => boolean;
  refused?: (reply: F) => boolean;
};

export const RACE_WALK: WalkApi<FinishReply> = {
  open: (id) => startNumberWalk(id),
  progress: async (id, points) => {
    const r = await submitNumberProgress(id, points);
    return r.verified ? { storedThrough: r.storedThrough, verified: true, phase: r.phase, progress: r.progress } : { storedThrough: r.storedThrough, verified: false };
  },
  finish: (id, key, points) => submitNumberFinish(id, key, points),
  done: (r) => r.ok && r.status === "finished",
  refused: (r) => r.ok && r.status === "rejected",
};

/** Send when this many points wait, or on the timer. At most this many per request. */
const SEND_AT = 15;
const SEND_EVERY_MS = 8_000;
const BATCH = 120;
const SAVE_EVERY_MS = 10_000;
/** Farther than this from every course street, twice in a row: off the route (a gentle note, never a failure). */
const OFF_ROUTE_M = 35;

type Stored = { matchId: string; sessionId: string; points: TrackPoint[]; sentThrough: number; nextSeq: number; segment: number; finish: { key: string; refused: boolean } | null };
const KEY = (matchId: string) => `paws.numbertrail.walk.${matchId}`;
const store = {
  load: async (matchId: string): Promise<Stored | null> => {
    try {
      const w = JSON.parse((await AsyncStorage.getItem(KEY(matchId))) ?? "null") as Stored | null;
      return w && w.matchId === matchId && Array.isArray(w.points) ? w : null;
    } catch {
      return null;
    }
  },
  save: (w: Stored) => AsyncStorage.setItem(KEY(w.matchId), JSON.stringify(w)).catch(() => undefined),
  clear: (matchId: string) => AsyncStorage.removeItem(KEY(matchId)).catch(() => undefined),
};

const nearestM = (p: LatLng, lines: readonly (readonly (readonly [number, number])[])[]) => {
  let best = Infinity;
  const k = 111_320 * Math.cos((p.latitude * Math.PI) / 180);
  for (const line of lines)
    for (let i = 1; i < line.length; i++) {
      const [ax, ay] = [(line[i - 1][0] - p.longitude) * k, (line[i - 1][1] - p.latitude) * 110_540];
      const [bx, by] = [(line[i][0] - p.longitude) * k, (line[i][1] - p.latitude) * 110_540];
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(ax + dx * t, ay + dy * t));
    }
  return best;
};

/**
 * This player's walk in a Number Trail race: real GPS in, screened fixes kept on the phone (and saved, so a restart
 * loses nothing), sent in batches to the server, which stores them and re-checks progress. What this hook works out
 * itself (the estimate, off-route) is shown as an estimate; only the server's check is official.
 */
export const useNumberWalk = <F = FinishReply>({
  matchId,
  racing,
  startsAt,
  course,
  onServerProgress,
  api = RACE_WALK as unknown as WalkApi<F>,
}: {
  matchId: string | null;
  racing: boolean;
  startsAt: string | null;
  course: NumberCourse | null;
  onServerProgress?: () => void;
  api?: WalkApi<F>;
}) => {
  const apiRef = useRef(api);
  apiRef.current = api;
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [position, setPosition] = useState<(LatLng & { accuracyM: number | null }) | null>(null);
  const [access, setAccess] = useState<LocationAccess | null>(null);
  const [servicesOn, setServicesOn] = useState<boolean | null>(null);
  const [paused, setPaused] = useState(false);
  const [pausedByApp, setPausedByApp] = useState(false);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [server, setServer] = useState<{ progress: OwnProgress; phase: ProgressPhase; at: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [offRoute, setOffRoute] = useState(false);

  const walk = useRef<Stored | null>(null);
  const started = useRef<number | null>(null);
  const lastFixAt = useRef<number | null>(null);
  const lastAccuracy = useRef<number | null>(null);
  const lastMovedAt = useRef<number | null>(null);
  const sending = useRef<Promise<boolean> | null>(null);
  const lastSave = useRef(0);
  const away = useRef(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onServerRef = useRef(onServerProgress);
  onServerRef.current = onServerProgress;

  const lines = useMemo(
    () => (course ? [...course.digits.flatMap((d) => d.edges.map((e) => e.coords)), ...course.connector.map((e) => e.coords), ...(course.finish ?? []).map((e) => e.coords), ...course.approach.map((e) => e.coords)] : []),
    [course],
  );

  const save = useCallback((force = false) => {
    const w = walk.current;
    if (!w || (!force && Date.now() - lastSave.current < SAVE_EVERY_MS)) return;
    lastSave.current = Date.now();
    void store.save(w);
  }, []);

  /** Sends what is waiting, one request at a time. With `all`, keeps going until nothing is left or the network fails. */
  const flush = useCallback(
    (all = false): Promise<boolean> => {
      if (sending.current) return sending.current;
      const run = async () => {
        try {
          for (;;) {
            const w = walk.current;
            if (!w || !matchId) return true;
            const batch = pendingPoints(w.points, w.sentThrough).slice(0, BATCH);
            if (!batch.length) return true;
            const reply = await apiRef.current.progress(matchId, batch);
            w.sentThrough = confirm(w.sentThrough, Math.max(reply.storedThrough, batch[batch.length - 1].seq));
            setOffline(false);
            setPending(pendingPoints(w.points, w.sentThrough).length);
            save(true);
            if (reply.verified && reply.progress && reply.phase) {
              const { progress, phase } = reply;
              // An older check arriving late never replaces a newer one.
              setServer((cur) => (cur && cur.progress.throughSeq > progress.throughSeq ? cur : { progress, phase, at: Date.now() }));
              onServerRef.current?.();
            }
            if (!all) return pendingPoints(w.points, w.sentThrough).length === 0;
          }
        } catch (e) {
          const code = (e as NumberRaceError).code;
          if (code === "network" || code === "timeout" || code === "server_error" || code === "slow_down") setOffline(true);
          else setError(code ?? "server_error");
          return false;
        } finally {
          sending.current = null;
        }
      };
      sending.current = run();
      return sending.current;
    },
    [matchId, save],
  );

  const onFix = useCallback(
    (fix: GpsFix) => {
      lastFixAt.current = Date.now();
      lastAccuracy.current = fix.accuracyM;
      setPosition({ latitude: fix.latitude, longitude: fix.longitude, accuracyM: fix.accuracyM });
      if (lines.length && (fix.accuracyM ?? 99) <= 25) {
        away.current = nearestM(fix, lines) > OFF_ROUTE_M ? away.current + 1 : 0;
        setOffRoute(away.current >= 2);
      }
      const w = walk.current;
      if (!w || pausedRef.current) return;
      const previous = w.points[w.points.length - 1] ?? null;
      if (screenFix(previous, fix, Date.now(), w.segment) !== "accept") return;
      lastMovedAt.current = Date.now();
      w.points = [...w.points, { ...fix, seq: w.nextSeq, segment: w.segment }];
      w.nextSeq += 1;
      setPoints(w.points);
      setPending(pendingPoints(w.points, w.sentThrough).length);
      save();
      if (pendingPoints(w.points, w.sentThrough).length >= SEND_AT) void flush();
    },
    [flush, lines, save],
  );

  // Open (or resume) the walk once the countdown starts; restore anything this phone kept.
  useEffect(() => {
    if (!racing || !matchId || walk.current) return;
    let cancelled = false;
    void (async () => {
      const granted = await LocationTracking.requestAccess();
      setAccess(granted);
      setServicesOn(await LocationTracking.servicesOn());
      try {
        const s = await apiRef.current.open(matchId);
        if (cancelled) return;
        const local = await store.load(matchId);
        walk.current =
          local && local.sessionId === s.sessionId
            ? { ...local, sentThrough: Math.max(local.sentThrough, s.lastSeq), nextSeq: Math.max(local.nextSeq, s.lastSeq + 1), segment: local.segment + 1 }
            : { matchId, sessionId: s.sessionId, points: [], sentThrough: s.lastSeq, nextSeq: s.lastSeq + 1, segment: s.resumed ? 1 : 0, finish: null };
        started.current = Date.now();
        setPoints(walk.current.points);
        setPending(pendingPoints(walk.current.points, walk.current.sentThrough).length);
        save(true);
      } catch (e) {
        setError((e as NumberRaceError).code ?? "server_error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [racing, matchId, save]);

  // GPS while racing and not paused. The watch reports movement; a direct check every few seconds confirms the signal
  // while standing still.
  useEffect(() => {
    if (!racing || paused || access !== "granted") return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    LocationTracking.watch(onFix)
      .then((s) => (cancelled ? s() : (stop = s)))
      .catch(() => setServicesOn(false));
    const confirmId = setInterval(() => {
      if (lastFixAt.current && Date.now() - lastFixAt.current < GPS_STATUS_RULES.confirmEveryMs - 1_000) return;
      void LocationTracking.current().then((fix) => {
        if (fix && !cancelled) onFix(fix);
      });
      void LocationTracking.servicesOn().then(setServicesOn);
    }, GPS_STATUS_RULES.confirmEveryMs);
    return () => {
      cancelled = true;
      clearInterval(confirmId);
      stop?.();
    };
  }, [racing, paused, access, onFix]);

  useEffect(() => {
    if (!racing) return;
    const send = setInterval(() => void flush(), SEND_EVERY_MS);
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      clearInterval(send);
      clearInterval(tick);
    };
  }, [racing, flush]);

  const pause = useCallback((byApp = false) => {
    if (pausedRef.current) return;
    setPaused(true);
    setPausedByApp(byApp);
    save(true);
    void flush();
  }, [flush, save]);

  const resume = useCallback(() => {
    const w = walk.current;
    if (!pausedRef.current) return;
    // A new stretch: nothing is drawn or counted across the pause.
    if (w) w.segment += 1;
    setPaused(false);
    setPausedByApp(false);
    save(true);
  }, [save]);

  // Foreground only: leaving PAWS pauses the walk instead of guessing across the gap.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active" && racing && !pausedRef.current) pause(true);
      if (s !== "active") save(true);
    });
    return () => sub.remove();
  }, [pause, racing, save]);

  /** Hands in: sends what's left, then asks the server to check the whole walk. The same key on every retry. */
  const finish = useCallback(async (): Promise<F | { ok: false; error: string }> => {
    const w = walk.current;
    if (!w || !matchId) return { ok: false, error: "no_walk" };
    await flush(true);
    w.finish = { key: nextFinishKey(w.finish, () => Math.random().toString(36).slice(2, 12)), refused: false };
    save(true);
    try {
      const reply = await apiRef.current.finish(matchId, w.finish.key, pendingPoints(w.points, w.sentThrough).slice(0, 300));
      if (apiRef.current.refused?.(reply)) w.finish.refused = true;
      if (apiRef.current.done(reply)) await store.clear(matchId);
      save(true);
      onServerRef.current?.();
      return reply;
    } catch (e) {
      // A lost reply keeps the same key, so the retry is the same attempt, never a second one.
      return { ok: false, error: (e as NumberRaceError).code ?? "server_error" };
    }
  }, [flush, matchId, save]);

  // This phone's estimate, every few points. Never shown as official.
  const estimateKey = Math.floor(points.length / 4);
  const estimate = useMemo(() => {
    if (!course || !startsAt || points.length < 2) return null;
    return ownProgress(verifyRace(points, course, { raceStartMs: Date.parse(startsAt), nowMs: Date.now() }));
  }, [estimateKey, course, startsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const segments = useMemo(() => {
    const out: LatLng[][] = [];
    let cur: LatLng[] = [];
    let seg = points[0]?.segment;
    for (const p of points) {
      if (p.segment !== seg) {
        if (cur.length) out.push(cur);
        cur = [];
        seg = p.segment;
      }
      cur.push({ latitude: p.latitude, longitude: p.longitude });
    }
    if (cur.length) out.push(cur);
    return out;
  }, [points]);

  const gps = gpsStatusOf({ access, servicesOn, paused, startedAt: started.current, lastFixAt: lastFixAt.current, lastAccuracyM: lastAccuracy.current, lastMovedAt: lastMovedAt.current, now });
  const distanceM = useMemo(() => summarizeTrack(points).distanceM, [points]);
  const nearStart = position && course ? metersBetween(position, course.start) <= 50 : false;

  return { points, segments, position, gps, paused, pausedByApp, offline, pending, error, server, estimate, offRoute, distanceM, nearStart, pause: () => pause(false), resume, finish, flush, clearError: () => setError(null) };
};
