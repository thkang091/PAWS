export const SOLO_COUNTDOWN_SECONDS = 3;
const FINALIZE_TIMEOUT_MS = 10_000;

export type SoloRoundPhase = "setup" | "countdown" | "running" | "finishing" | "reviewing" | "interrupted";
export type SoloRoundSnapshot = {
  phase: SoloRoundPhase;
  countdown: number;
  elapsed: number;
  error: string | null;
};

type Clip = { uri: string };
type RecordingJob = { generation: number; stopRequested: boolean };
type Options = {
  timeLimit: number;
  record: () => Promise<Clip>;
  stop: () => void;
  onComplete: (clip: Clip, durationSeconds: number) => void;
  onDiscard: (uri: string) => void;
  now?: () => number;
};

/** Owns capture timing; a round cannot reach review until the native file is ready. */
export function createSoloRoundController(options: Options) {
  if (!Number.isFinite(options.timeLimit) || options.timeLimit <= 0) {
    throw new RangeError("A positive recording time limit is required.");
  }
  const now = options.now ?? (() => performance.now());
  const listeners = new Set<() => void>();
  let snapshot: SoloRoundSnapshot = { phase: "setup", countdown: SOLO_COUNTDOWN_SECONDS, elapsed: 0, error: null };
  let generation = 0;
  let countdownStartedAt = 0;
  let recordingStartedAt = 0;
  let recording: RecordingJob | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let finalizeTimer: ReturnType<typeof setTimeout> | null = null;

  const publish = (change: Partial<SoloRoundSnapshot>) => {
    snapshot = { ...snapshot, ...change };
    listeners.forEach(listener => listener());
  };
  const clearTimers = () => {
    if (timer !== null) clearInterval(timer);
    if (finalizeTimer !== null) clearTimeout(finalizeTimer);
    timer = null;
    finalizeTimer = null;
  };
  const elapsedSeconds = () => Math.min(options.timeLimit, Math.max(0, (now() - recordingStartedAt) / 1000));
  const stopOnce = (job: RecordingJob | null) => {
    if (!job || job.stopRequested) return;
    job.stopRequested = true;
    options.stop();
  };
  const invalidate = () => {
    generation += 1;
    clearTimers();
    const previous = recording;
    recording = null;
    // The camera is also unmounted by the screen. Cleanup must not throw if the
    // native view has already disappeared during backgrounding or navigation.
    try { stopOnce(previous); } catch { /* Native teardown can win this race. */ }
  };
  const interrupt = (message?: string) => {
    invalidate();
    publish({ phase: "interrupted", error: message ?? null });
  };
  const reset = () => {
    invalidate();
    publish({ phase: "setup", countdown: SOLO_COUNTDOWN_SECONDS, elapsed: 0, error: null });
  };
  const finish = () => {
    if (snapshot.phase !== "running") return;
    const job = recording;
    clearTimers();
    publish({ phase: "finishing", elapsed: elapsedSeconds() });
    try {
      stopOnce(job);
    } catch {
      interrupt("Recording could not finish. Try again.");
      return;
    }
    // Keep the camera mounted while its existing promise finalizes the file.
    // A native failure must still offer a way back to setup.
    finalizeTimer = setTimeout(() => {
      if (job?.generation === generation && snapshot.phase === "finishing") {
        interrupt("Recording could not finish. Try again.");
      }
    }, FINALIZE_TIMEOUT_MS);
  };

  const beginRecording = () => {
    const job: RecordingJob = { generation, stopRequested: false };
    recording = job;
    recordingStartedAt = now();
    let pending: Promise<Clip>;
    try {
      pending = options.record();
    } catch {
      interrupt("Recording failed. Try again.");
      return;
    }
    publish({ phase: "running", countdown: 0, elapsed: 0 });
    void pending.then(clip => {
      const uri = typeof clip?.uri === "string" && clip.uri.trim() ? clip.uri : null;
      if (job.generation !== generation) {
        if (uri) options.onDiscard(uri);
        return;
      }
      recording = null;
      clearTimers();
      if (!uri) {
        interrupt("No video was recorded. Try again.");
        return;
      }
      const elapsed = snapshot.phase === "finishing" ? snapshot.elapsed : elapsedSeconds();
      const durationSeconds = Math.min(options.timeLimit, Math.max(0.1, elapsed));
      publish({ phase: "reviewing", elapsed: durationSeconds });
      try {
        options.onComplete({ uri }, durationSeconds);
      } catch {
        options.onDiscard(uri);
        interrupt("The video could not open. Try again.");
      }
    }, () => {
      if (job.generation !== generation) return;
      recording = null;
      interrupt("Recording failed. Try again.");
    });
  };

  const tick = () => {
    if (snapshot.phase === "countdown") {
      const remaining = Math.max(0, SOLO_COUNTDOWN_SECONDS - Math.floor((now() - countdownStartedAt) / 1000));
      if (remaining === 0) beginRecording();
      else if (remaining !== snapshot.countdown) publish({ countdown: remaining });
    } else if (snapshot.phase === "running") {
      const elapsed = elapsedSeconds();
      if (elapsed >= options.timeLimit) finish();
      else publish({ elapsed });
    }
  };
  const start = () => {
    if (snapshot.phase !== "setup") return;
    generation += 1;
    countdownStartedAt = now();
    publish({ phase: "countdown", countdown: SOLO_COUNTDOWN_SECONDS, elapsed: 0, error: null });
    timer = setInterval(tick, 100);
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start,
    reset,
    finish,
    interrupt,
  };
}
