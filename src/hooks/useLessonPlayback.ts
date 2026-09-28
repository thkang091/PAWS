import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelAnimation,
  useSharedValue,
  withTiming,
  Easing,
  type SharedValue,
} from "react-native-reanimated";

export type PlaybackStatus = "idle" | "playing" | "paused" | "ended";

export type LessonPlayback = {
  status: PlaybackStatus;
  time: number;
  duration: number;
  progress: SharedValue<number>;
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  seek: (seconds: number) => void;
};

const TICK = 100;

export const useLessonPlayback = (duration: number): LessonPlayback => {
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [time, setTime] = useState(0);

  const progress = useSharedValue(0);
  const elapsed = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const runTimer = useCallback(() => {
    stopTimer();
    timer.current = setInterval(() => {
      elapsed.current = Math.min(elapsed.current + TICK / 1000, duration);
      setTime(elapsed.current);

      progress.value = withTiming(elapsed.current / duration, {
        duration: TICK,
        easing: Easing.linear,
      });

      if (elapsed.current >= duration) {
        stopTimer();
        setStatus("ended");
      }
    }, TICK);
  }, [duration, progress, stopTimer]);

  const start = useCallback(() => {
    elapsed.current = 0;
    setTime(0);
    progress.value = 0;
    setStatus("playing");
    runTimer();
  }, [progress, runTimer]);

  const pause = useCallback(() => {
    stopTimer();
    cancelAnimation(progress);
    progress.value = elapsed.current / duration;
    setStatus("paused");
  }, [duration, progress, stopTimer]);

  const resume = useCallback(() => {
    setStatus("playing");
    runTimer();
  }, [runTimer]);

  const restart = useCallback(() => start(), [start]);

  const seek = useCallback(
    (seconds: number) => {
      const to = Math.max(0, Math.min(seconds, duration));
      elapsed.current = to;
      setTime(to);

      cancelAnimation(progress);
      progress.value = withTiming(to / duration, {
        duration: 180,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
      });

      if (status === "playing" || status === "ended") {
        setStatus("playing");
        runTimer();
      }
    },
    [duration, progress, runTimer, status],
  );

  useEffect(() => stopTimer, [stopTimer]);

  return { status, time, duration, progress, start, pause, resume, restart, seek };
};
