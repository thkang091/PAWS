import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useNavigation } from "expo-router";
import { clipCueAt, type TrainingClipLesson } from "@/features/train/media/doorwayWaitLesson";
import { youtubeLocalTime, youtubeSourceTime, youtubeSegmentIndexAt, type YouTubeSegment } from "@/features/train/media/trainingYouTube";
import type { YouTubeCommand, YouTubeEvent } from "@/features/train/media/youtubePlayerHtml";

// Provider adapter only. The lesson screen owns all presentation and actions.
export function useYouTubeTrainingPlayback(lesson: TrainingClipLesson | null, segments: readonly YouTubeSegment[],
  enabled: boolean, reviewAt = 0, pageKey?: string) {
  const navigation = useNavigation();
  const [segmentIndex, setSegmentIndex] = useState(() => youtubeSegmentIndexAt(segments, reviewAt));
  const segment = segments[segmentIndex] ?? null;
  const pendingSeek = useRef<number | null>(null);
  const [time, setTime] = useState(reviewAt);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [initialAt, setInitialAt] = useState(reviewAt);
  const [initialRate, setInitialRate] = useState(0.6);
  const selectedRate = useRef(0.6);
  const [command, setCommand] = useState<YouTubeCommand | null>(null);
  const appState = useRef(AppState.currentState);
  const embedKey = `${segment?.videoId}:${segment?.startSeconds}:${pageKey ?? ""}:${attempt}`;
  const currentEmbedKey = useRef(embedKey);
  currentEmbedKey.current = embedKey;
  const pause = useCallback(() => { pendingSeek.current = null; setCommand(previous => ({ sequence: (previous?.sequence ?? 0) + 1, type: "pause" })); }, []);
  const seek = useCallback((at: number) => {
    if (!segments.length || !enabled) return;
    const index = youtubeSegmentIndexAt(segments, at);
    const target = segments[index];
    setTime(at);
    if (index === segmentIndex && ready && !error) {
      setCommand(previous => ({ sequence: (previous?.sequence ?? 0) + 1, type: "play", at: youtubeSourceTime(target, at) }));
    } else {
      pendingSeek.current = at;
      setSegmentIndex(index); setReady(false); setError(null); setCommand(null);
      setInitialAt(at); setInitialRate(selectedRate.current); setAttempt(n => n + 1);
    }
  }, [ready, segments, segmentIndex, enabled, error]);
  const playWhole = useCallback(() => seek(0), [seek]);
  const retry = useCallback(() => {
    pendingSeek.current = null; setReady(false); setError(null); setCommand(null);
    setInitialAt(segment?.clipStartSeconds ?? 0); setTime(segment?.clipStartSeconds ?? 0); setAttempt(n => n + 1);
  }, [segment]);
  useEffect(() => {
    pendingSeek.current = null; setSegmentIndex(youtubeSegmentIndexAt(segments, reviewAt));
    setReady(false); setError(null); setTime(reviewAt); setInitialAt(reviewAt); setCommand(null); setAttempt(n => n + 1);
  }, [segments, pageKey, reviewAt]);
  const toggleControls = useCallback(() => {
    // YouTube controls are configured on creation. Re-cue at the same moment
    // without autoplay, preserving the selected speed across the new document.
    setReady(false); setError(null); setCommand(null);
    pendingSeek.current = null;
    setInitialAt(time); setInitialRate(selectedRate.current);
    setShowControls(value => !value); setAttempt(value => value + 1);
  }, [time]);
  const onEvent = useCallback((event: YouTubeEvent) => {
    if (currentEmbedKey.current !== embedKey) return;
    if (event.type === "ready") {
      setReady(true); setError(null);
      if (segment && pendingSeek.current !== null) {
        const at = pendingSeek.current; pendingSeek.current = null;
        setCommand(previous => ({ sequence: (previous?.sequence ?? 0) + 1, type: "play", at: youtubeSourceTime(segment, at) }));
      }
    }
    if (event.type === "rate") selectedRate.current = event.rate;
    if (event.type === "time" && segment) setTime(youtubeLocalTime(segment, event.seconds));
    if (event.type === "ended" && segment && enabled && navigation.isFocused()
      && (appState.current === null || appState.current === "active")) {
      const next = segments[segmentIndex + 1];
      if (next) seek(next.clipStartSeconds ?? 0);
      else setTime(lesson?.duration ?? youtubeLocalTime(segment, segment.endSeconds));
    }
    if (event.type === "error") {
      setError(event.code === -2 ? (__DEV__ ? "This development app needs to be rebuilt and reinstalled with WebView. Reloading Metro is not enough. You can open the original below." : "Update PAWS to watch here, or open the original on YouTube.")
        : event.code === 101 || event.code === 150 ? "This video cannot play inside PAWS. Open it on YouTube."
        : event.code === 100 ? "This video is no longer available."
        : event.code === 153 ? "YouTube could not identify this app. Please open the original video."
        : "YouTube couldn't load. Check your connection, then retry or open the original video.");
    }
  }, [segment, segments, segmentIndex, enabled, navigation, seek, lesson, embedKey]);
  useEffect(() => {
    if (!enabled || !segment || ready || error) return;
    const timer = setTimeout(() => setError("YouTube is taking longer than expected. Retry or open the original video."), 15000);
    return () => clearTimeout(timer);
  }, [enabled, segment, ready, error, attempt]);
  useEffect(() => {
    if (!enabled) pause();
    const unsubscribe = navigation.addListener("blur", pause);
    const subscription = AppState.addEventListener("change", state => { appState.current = state; if (state !== "active") pause(); });
    return () => { unsubscribe(); subscription.remove(); };
  }, [enabled, navigation, pause]);
  return { time, ready, loading: !ready, error, seek, playWhole, pause, retry, showControls, toggleControls,
    segment, segmentIndex, segments,
    // Preserve the existing YouTube flow: watching is optional, not a completion action.
    hasCompleted: true, currentCue: lesson ? clipCueAt(lesson, time) : null,
    embedProps: segment ? { segment, initialAt: youtubeSourceTime(segment, initialAt), command, onEvent, showControls, playbackRate: initialRate } : null,
    embedKey };
}
