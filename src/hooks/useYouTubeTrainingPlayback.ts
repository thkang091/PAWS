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
  const [showControls, setShowControls] = useState(false);
  const selectedRate = useRef(0.6);
  const selectedMuted = useRef(true);
  const playerReady = useRef(false);
  const sequence = useRef(0);
  const expectedRequest = useRef(0);
  // Frozen bootstrap props: changing the active source must not replace the
  // iframe srcDoc / native WebView source. Only retry/settings/navigation do.
  const [document, setDocument] = useState(() => ({
    segment, at: reviewAt, rate: 0.6, muted: true, revision: 0,
  }));
  const [command, setCommand] = useState<YouTubeCommand | null>(null);
  const appState = useRef(AppState.currentState);
  const embedKey = String(document.revision);
  const currentEmbedKey = useRef(embedKey);
  currentEmbedKey.current = embedKey;
  const pause = useCallback(() => {
    pendingSeek.current = null;
    setCommand({ sequence: ++sequence.current, type: "pause" });
  }, []);
  const allowPlayback = useCallback(() => {
    setCommand({ sequence: ++sequence.current, type: "allowPlayback" });
  }, []);
  const loadAt = useCallback((at: number) => {
    const target = segments[youtubeSegmentIndexAt(segments, at)];
    if (!target) return;
    expectedRequest.current = ++sequence.current;
    setCommand({ sequence: expectedRequest.current, type: "play", segment: target, at: youtubeSourceTime(target, at) });
  }, [segments]);
  const resetDocument = useCallback((at: number) => {
    const index = youtubeSegmentIndexAt(segments, at);
    pendingSeek.current = null; playerReady.current = false; expectedRequest.current = 0;
    setSegmentIndex(index); setTime(at); setReady(false); setError(null); setCommand(null);
    setDocument(previous => ({ segment: segments[index] ?? null, at, rate: selectedRate.current,
      muted: selectedMuted.current, revision: previous.revision + 1 }));
  }, [segments]);
  const seek = useCallback((at: number) => {
    if (!segments.length || !enabled) return;
    const index = youtubeSegmentIndexAt(segments, at);
    setTime(at); setSegmentIndex(index); setReady(false);
    if (error) {
      resetDocument(at);
      pendingSeek.current = at;
    } else if (playerReady.current) loadAt(at);
    else pendingSeek.current = at; // Keep only the latest cue during initial load.
  }, [segments, enabled, error, loadAt, resetDocument]);
  const playWhole = useCallback(() => seek(0), [seek]);
  const retry = useCallback(() => resetDocument(segment?.clipStartSeconds ?? 0), [resetDocument, segment]);
  const context = useRef({ segments, pageKey, reviewAt });
  useEffect(() => {
    if (context.current.segments === segments && context.current.pageKey === pageKey && context.current.reviewAt === reviewAt) return;
    context.current = { segments, pageKey, reviewAt };
    selectedMuted.current = true;
    resetDocument(reviewAt);
  }, [segments, pageKey, reviewAt, resetDocument]);
  const toggleControls = useCallback(() => {
    // YouTube controls are configured on creation. Re-cue at the same moment
    // without autoplay, preserving speed and the viewer's mute preference.
    resetDocument(time);
    setShowControls(value => !value);
  }, [time, resetDocument]);
  const onEvent = useCallback((event: YouTubeEvent) => {
    if (currentEmbedKey.current !== embedKey) return;
    if (event.request !== undefined && event.request !== expectedRequest.current) return;
    if (event.type === "ready") {
      playerReady.current = true; setError(null);
      if (pendingSeek.current !== null) {
        const at = pendingSeek.current; pendingSeek.current = null;
        loadAt(at);
      } else setReady(true);
    }
    if (event.type === "rate") selectedRate.current = event.rate;
    if (event.type === "mute") selectedMuted.current = event.muted;
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
  }, [segment, segments, segmentIndex, enabled, navigation, seek, lesson, embedKey, loadAt]);
  useEffect(() => {
    if (!enabled || !segment || ready || error) return;
    const timer = setTimeout(() => setError("YouTube is taking longer than expected. Retry or open the original video."), 15000);
    return () => clearTimeout(timer);
  }, [enabled, segment, ready, error, document.revision, command]);
  useEffect(() => {
    if (!enabled) pause();
    const unsubscribe = navigation.addListener("blur", pause);
    const unsubscribeFocus = navigation.addListener("focus", () => {
      if (enabled && (appState.current === null || appState.current === "active")) allowPlayback();
    });
    const subscription = AppState.addEventListener("change", state => {
      appState.current = state;
      if (state !== "active") pause();
      else if (enabled && navigation.isFocused()) allowPlayback();
    });
    return () => { unsubscribe(); unsubscribeFocus(); subscription.remove(); };
  }, [enabled, navigation, pause, allowPlayback]);
  return { time, ready, loading: !ready, error, seek, playWhole, pause, retry, showControls, toggleControls,
    segment, segmentIndex, segments,
    // Preserve the existing YouTube flow: watching is optional, not a completion action.
    hasCompleted: true, currentCue: lesson ? clipCueAt(lesson, time) : null,
    embedProps: document.segment ? { segment: document.segment, initialAt: youtubeSourceTime(document.segment, document.at),
      command, onEvent, showControls, playbackRate: document.rate, muted: document.muted,
      title: `${segment?.channel ?? document.segment.channel} training example` } : null,
    embedKey };
}
