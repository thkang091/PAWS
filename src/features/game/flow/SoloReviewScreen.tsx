import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, BackHandler, Easing, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView, type VideoPlayerStatus } from "expo-video";
import { ClockIcon, FilmStripIcon } from "phosphor-react-native";
import { useReducedMotion } from "react-native-reanimated";
import { accent, bg, pastel, text, type } from "@/constants/design";
import { GameButton, GameHeading, GameNote, GameScreen, MissingGame, TextAction, ui } from "./GameFlowUI";
import { formatGameTime, soloTimeLimitSeconds, type PlayGame } from "./gameFlow";
import { useGameFlowParams } from "./SoloScreens";
import { discardSoloRecording, getSoloRecording, type SoloRecording } from "./soloRecording";

const DEMO_REVIEW_MS = 3600;
type RouteParams = ReturnType<typeof useGameFlowParams>["routeParams"];

export default function SoloReviewScreen() {
  const { game, params, routeParams } = useGameFlowParams();
  if (!game) return <MissingGame />;
  const recording = getSoloRecording(params.recordingId);
  if (!recording || recording.gameId !== game.id || recording.target !== routeParams.target ||
    recording.durationSeconds > soloTimeLimitSeconds(game.id)) {
    return <GameScreen label={game.title} centered onBack={() => router.dismissTo("/game/challenge")}
      footer={<GameButton label="Set up camera" onPress={() => router.dismissTo({ pathname: "/game/prepare", params: routeParams })} />}>
      <GameHeading title="No recording to review" />
    </GameScreen>;
  }
  return <RecordedRoundReview key={recording.id} game={game} recording={recording} routeParams={routeParams} />;
}

function RecordedRoundReview({ game, recording, routeParams }: {
  game: PlayGame; recording: SoloRecording; routeParams: RouteParams;
}) {
  const player = useVideoPlayer(recording.uri, value => {
    value.loop = false;
    value.allowsExternalPlayback = false;
  });
  const [status, setStatus] = useState<VideoPlayerStatus>(player.status);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [duration, setDuration] = useState(recording.durationSeconds);
  const [reviewing, setReviewing] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const reviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewingRef = useRef(false);
  const focused = useRef(false);
  const reduceMotion = useReducedMotion();
  const playbackFailed = status === "error" || loadTimedOut;

  const pause = useCallback(() => {
    try { player.pause(); } catch { /* The hook may have already released the native player on unmount. */ }
  }, [player]);

  const stopReview = useCallback(() => {
    if (reviewTimer.current !== null) clearTimeout(reviewTimer.current);
    reviewTimer.current = null;
    reviewingRef.current = false;
    progress.stopAnimation();
  }, [progress]);

  const leave = useCallback(() => {
    pause();
    stopReview();
    router.dismissTo("/game/challenge");
  }, [pause, stopReview]);

  useEffect(() => {
    setStatus(player.status);
    if (Number.isFinite(player.duration) && player.duration > 0) setDuration(player.duration);
    const statusListener = player.addListener("statusChange", event => setStatus(event.status));
    const durationListener = player.addListener("sourceLoad", event => {
      if (Number.isFinite(event.duration) && event.duration > 0) setDuration(event.duration);
    });
    return () => { statusListener.remove(); durationListener.remove(); };
  }, [player]);

  useEffect(() => {
    if (status === "readyToPlay") { setLoadTimedOut(false); return; }
    if (status === "error") return;
    const timer = setTimeout(() => setLoadTimedOut(true), 15000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (discardTimer.current !== null) clearTimeout(discardTimer.current);
    return () => {
      // Let VideoView unmount and useVideoPlayer release its file first. A new
      // effect cancels this during Fast Refresh instead of discarding the clip.
      discardTimer.current = setTimeout(() => discardSoloRecording(recording.id), 0);
    };
  }, [recording.id]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    setReviewing(false);
    progress.setValue(0);
    const appState = AppState.addEventListener("change", state => {
      if (state !== "active") {
        pause();
        stopReview();
        setReviewing(false);
        progress.setValue(0);
      }
    });
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      leave();
      return true;
    });
    return () => {
      focused.current = false;
      pause();
      stopReview();
      appState.remove();
      back.remove();
    };
  }, [leave, pause, progress, stopReview]));

  const retake = () => {
    pause();
    stopReview();
    router.dismissTo({ pathname: "/game/prepare", params: routeParams });
  };

  const submit = () => {
    if (status !== "readyToPlay" || playbackFailed || reviewingRef.current || !focused.current ||
      (AppState.currentState !== null && AppState.currentState !== "active")) return;
    pause();
    reviewingRef.current = true;
    setReviewing(true);
    progress.setValue(reduceMotion ? 0.65 : 0);
    if (!reduceMotion) Animated.timing(progress, {
      toValue: 1, duration: DEMO_REVIEW_MS, easing: Easing.linear, useNativeDriver: false,
    }).start();
    // Recording is real; this existing review/result flow is still a demo.
    reviewTimer.current = setTimeout(() => {
      reviewTimer.current = null;
      if (!focused.current || !reviewingRef.current ||
        (AppState.currentState !== null && AppState.currentState !== "active")) return;
      reviewingRef.current = false;
      router.replace({ pathname: "/game/result", params: { ...routeParams, outcome: "complete" } });
    }, DEMO_REVIEW_MS);
  };

  return <GameScreen label={game.title} onBack={leave} centered={reviewing}
    footer={reviewing ? undefined : <><GameButton label="Submit" disabled={status !== "readyToPlay" || playbackFailed} onPress={submit} /><TextAction label="Retake round" onPress={retake} /></>}>
    {reviewing ? <>
      <View style={styles.reviewCard}>
        <View style={styles.reviewIcon}><FilmStripIcon size={25} color={text.primary} /></View>
        <Text accessibilityRole="header" style={ui.sectionTitle}>Review preview</Text>
        <View accessible accessibilityRole="progressbar" accessibilityLabel="Demo review in progress"
          accessibilityState={{ busy: true }} style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
        </View>
      </View>
      <GameNote>AI review is not connected yet. A sample result opens next.</GameNote>
    </> : <>
      <GameHeading title="Review your round" />
      <View style={styles.clip}>
        <View style={styles.videoFrame}>
          <VideoView player={player} style={styles.video} contentFit="contain" nativeControls
            fullscreenOptions={{ enable: false }} allowsPictureInPicture={false} />
          {playbackFailed ? <View style={styles.videoMessage}>
            <FilmStripIcon size={28} color={text.inverse} />
            <Text style={styles.videoMessageText}>Video unavailable. Retake this round.</Text>
          </View> : status !== "readyToPlay" ? <View style={styles.videoMessage} pointerEvents="none">
            <ActivityIndicator color={accent.primary} accessibilityLabel="Loading recording" />
          </View> : null}
        </View>
        <View style={styles.clipMeta}>
          <View style={ui.row}><ClockIcon size={16} color={text.secondary} /><Text style={ui.rowTitle}>{formatGameTime(duration)}</Text></View>
          <Text style={ui.small}>On this device</Text>
        </View>
      </View>
      <GameNote>AI review is not connected yet. Submit shows a sample result.</GameNote>
    </>}
  </GameScreen>;
}

const styles = StyleSheet.create({
  clip: { gap: 12 },
  videoFrame: { width: "100%", height: 330, borderRadius: 24, backgroundColor: "#17211B", overflow: "hidden" },
  video: { width: "100%", height: "100%" },
  videoMessage: { ...StyleSheet.absoluteFill, gap: 12, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#17211B" },
  videoMessageText: { ...type.supporting, color: text.inverse, textAlign: "center" },
  clipMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewCard: { alignItems: "center", gap: 12, paddingHorizontal: 24, paddingVertical: 30, borderRadius: 26, backgroundColor: pastel.butter },
  reviewIcon: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.8)", marginBottom: 4 },
  progressTrack: { width: "100%", height: 8, borderRadius: 4, backgroundColor: bg.canvas, overflow: "hidden", marginTop: 12 },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: accent.deep },
});
