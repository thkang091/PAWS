import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useNavigation } from "expo-router";
import { useVideoPlayer, type VideoSource } from "expo-video";
import { clipCueAt, type TrainingClipLesson } from "@/features/train/media/doorwayWaitLesson";

export function useTrainingClipPlayback(lesson: TrainingClipLesson | null, source: VideoSource, enabled: boolean, pageKey?: string) {
  const navigation = useNavigation();
  const player = useVideoPlayer(source, (p) => {
    p.muted = true;
    p.loop = false;
    p.timeUpdateEventInterval = 0.1;
    p.staysActiveInBackground = false;
  });
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  // Completion belongs to this clip/session, independently of the current
  // playhead. Replaying or seeking cannot relock an already watched Level.
  const playbackKey = `${lesson?.id ?? ""}:${pageKey ?? ""}`;
  const [completedPlaybackKey, setCompletedPlaybackKey] = useState<string | null>(null);
  const hasCompleted = completedPlaybackKey === playbackKey;
  const pending = useRef<number | null>(null);

  const pause = useCallback(() => {
    pending.current = null;
    player.pause();
    setPlaying(false);
  }, [player]);

  const seek = useCallback((at: number) => {
    if (!lesson || !enabled) return;
    const target = Math.max(0, Math.min(at, lesson.duration));
    setEnded(false);
    setTime(target);
    // Android reports idle after reaching the end; seeking the loaded clip
    // restarts it without waiting for a ready event that cannot arrive alone.
    if (player.status === "readyToPlay" || (player.status === "idle" && player.duration > 0)) {
      pending.current = null;
      player.currentTime = target;
      player.play();
    } else {
      pending.current = target;
    }
  }, [enabled, lesson, player]);
  const playWhole = useCallback(() => seek(0), [seek]);

  useEffect(() => {
    // Keep cue timestamps in source-video time so seeking and captions stay
    // synchronized while the demonstration plays more slowly.
    player.playbackRate = 0.6;
    setTime(0);
    setPlaying(false);
    setEnded(false);
    setError(null);
    setLoading(player.status !== "readyToPlay");
    pending.current = null;
    const subscriptions = [
      player.addListener("statusChange", ({ status, error: playerError }) => {
        setLoading(status === "loading" || (status === "idle" && player.duration === 0));
        setError(status === "error" ? playerError?.message ?? "Video unavailable" : null);
        if (status === "readyToPlay" && pending.current !== null) {
          player.currentTime = pending.current;
          pending.current = null;
          player.play();
        }
      }),
      player.addListener("playingChange", ({ isPlaying }) => setPlaying(isPlaying)),
      player.addListener("timeUpdate", ({ currentTime }) => setTime(currentTime)),
      player.addListener("playToEnd", () => {
        setPlaying(false);
        setEnded(true);
        setCompletedPlaybackKey(playbackKey);
        setTime(lesson?.duration ?? player.duration);
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [player, lesson, playbackKey]);

  useEffect(() => {
    if (enabled && navigation.isFocused()) playWhole();
    else pause();
  }, [enabled, pageKey, navigation, playWhole, pause]);

  // Expo owns player disposal. Never pause from an unmount cleanup.
  useEffect(() => {
    const blur = navigation.addListener("blur", pause);
    const focus = navigation.addListener("focus", () => { if (enabled) seek(player.currentTime); });
    return () => { blur(); focus(); };
  }, [navigation, enabled, pause, player, seek]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") pause();
      else if (enabled && navigation.isFocused()) seek(player.currentTime);
    });
    return () => sub.remove();
  }, [enabled, navigation, pause, player, seek]);

  const retry = useCallback(async () => {
    pause();
    setError(null);
    setLoading(true);
    try { await player.replaceAsync(source); playWhole(); }
    catch { setError("Video unavailable"); setLoading(false); }
  }, [pause, player, playWhole, source]);

  return { player, time, playing, loading, error, ended, hasCompleted, pause, playWhole, seek, retry,
    currentCue: lesson ? clipCueAt(lesson, time) : null };
}

export type TrainingClipPlayback = ReturnType<typeof useTrainingClipPlayback>;
