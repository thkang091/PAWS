import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useNavigation } from "expo-router";
import { useVideoPlayer, type VideoSource } from "expo-video";
import { clipCueAt, type TrainingClipLesson } from "@/features/train/media/doorwayWaitLesson";
import { prepareTrainingClip } from "@/features/train/media/prepareTrainingClip";

export function useTrainingClipPlayback(lesson: TrainingClipLesson | null, source: VideoSource, enabled: boolean, pageKey?: string) {
  const navigation = useNavigation();
  const player = useVideoPlayer(null, (p) => {
    p.muted = true;
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
    p.staysActiveInBackground = false;
    p.playbackRate = 0.6;
    p.bufferOptions = { preferredForwardBufferDuration: 5, waitsToMinimizeStalling: true };
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
  const playRequested = useRef(false);
  const sourceReady = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const loadQueue = useRef<Promise<void>>(Promise.resolve());
  const [retryCount, setRetryCount] = useState(0);

  const playPending = useCallback((readyEvent = false) => {
    if (!sourceReady.current || pending.current === null || !enabledRef.current || !navigation.isFocused()) return;
    if (!readyEvent && player.status !== "readyToPlay" && !(player.status === "idle" && player.duration > 0)) return;
    player.currentTime = pending.current;
    pending.current = null;
    // Loading a new media element can restore its default rate. Apply the
    // lesson settings at the actual playback boundary, after readiness.
    player.playbackRate = 0.6;
    player.muted = true;
    player.play();
  }, [navigation, player]);

  const pause = useCallback(() => {
    playRequested.current = false;
    pending.current = null;
    player.pause();
    setPlaying(false);
  }, [player]);

  const seek = useCallback((at: number) => {
    if (!lesson || !enabled) return;
    playRequested.current = true;
    const target = Math.max(0, Math.min(at, lesson.duration));
    setEnded(false);
    setTime(target);
    // Android reports idle after reaching the end; seeking the loaded clip
    // restarts it without waiting for a ready event that cannot arrive alone.
    pending.current = target;
    playPending();
  }, [enabled, lesson, playPending]);
  const playWhole = useCallback(() => seek(0), [seek]);

  const onFirstFrameRender = useCallback(() => {
    // On web, VideoView can reapply src after replaceAsync, cancelling play().
    // Resume only an outstanding play request when that view finishes loading.
    if (!sourceReady.current || !playRequested.current || !enabledRef.current || !navigation.isFocused()) return;
    player.playbackRate = 0.6;
    player.muted = true;
    player.play();
  }, [navigation, player]);

  useEffect(() => {
    // Keep cue timestamps in source-video time so seeking and captions stay
    // synchronized while the demonstration plays more slowly.
    player.playbackRate = 0.6;
    setTime(0);
    setPlaying(false);
    setEnded(false);
    setError(null);
    setLoading(!sourceReady.current || player.status !== "readyToPlay");
    pending.current = null;
    const subscriptions = [
      player.addListener("statusChange", ({ status, error: playerError }) => {
        if (!sourceReady.current) return;
        setLoading(status === "loading" || (status === "idle" && player.duration === 0));
        setError(status === "error" ? playerError?.message ?? "Video unavailable" : null);
        // Expo Web emits this event before updating player.status. Trust the
        // event so a queued autoplay is not stranded after a Level change.
        if (status === "readyToPlay") playPending(true);
      }),
      player.addListener("playingChange", ({ isPlaying }) => setPlaying(isPlaying)),
      player.addListener("timeUpdate", ({ currentTime }) => { if (sourceReady.current) setTime(currentTime); }),
      player.addListener("playToEnd", () => {
        if (!sourceReady.current) return;
        playRequested.current = false;
        setPlaying(false);
        setEnded(true);
        setCompletedPlaybackKey(playbackKey);
        setTime(lesson?.duration ?? player.duration);
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [player, lesson, playbackKey, playPending]);

  useEffect(() => {
    let cancelled = false;
    sourceReady.current = false;
    player.pause();
    setLoading(Boolean(source));
    setError(null);
    // Download during the preparation screen. Serialize native replacements so
    // rapid Level changes cannot install an older source over the current one.
    const load = async () => {
      if (cancelled) return;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const localSource = await Promise.race([
          prepareTrainingClip(source),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Video download timed out")), 45000); }),
        ]);
        if (cancelled) return;
        const replace = async () => { if (!cancelled) await player.replaceAsync(localSource); };
        loadQueue.current = loadQueue.current.then(replace, replace);
        await loadQueue.current;
        if (cancelled) return;
        sourceReady.current = Boolean(source);
        player.playbackRate = 0.6;
        setLoading(Boolean(source) && player.status !== "readyToPlay");
        if (player.status === "error") {
          setError("Video unavailable");
          setLoading(false);
        } else playPending();
      } catch {
        if (!cancelled) { setError("Video unavailable"); setLoading(false); }
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [player, source, retryCount, playPending]);

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

  const retry = useCallback(() => {
    pause();
    playRequested.current = enabled;
    setError(null);
    setLoading(true);
    pending.current = enabled ? 0 : null;
    setRetryCount((count) => count + 1);
  }, [pause, enabled]);

  return { player, time, playing, loading, error, ended, hasCompleted, pause, playWhole, seek, retry, onFirstFrameRender,
    currentCue: lesson ? clipCueAt(lesson, time) : null };
}

export type TrainingClipPlayback = ReturnType<typeof useTrainingClipPlayback>;
