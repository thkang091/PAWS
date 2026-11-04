import { useCallback, useRef, useState } from "react";
import { Animated, AppState, BackHandler, Easing, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ClockIcon, FilmStripIcon } from "phosphor-react-native";
import { useReducedMotion } from "react-native-reanimated";
import { accent, bg, pastel, text, type } from "@/constants/design";
import { CameraStage, GameButton, GameHeading, GameNote, GameScreen, MissingGame, TextAction, ui } from "./GameFlowUI";
import { formatGameTime, parsePreviewDuration, soloTimeLimitSeconds } from "./gameFlow";
import { useGameFlowParams } from "./SoloScreens";

const DEMO_REVIEW_MS = 3600;

export default function SoloReviewScreen() {
  const { game, params, routeParams } = useGameFlowParams();
  const [reviewing, setReviewing] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const reviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewingRef = useRef(false);
  const focused = useRef(false);
  const reduceMotion = useReducedMotion();
  const parsedElapsed = parsePreviewDuration(params.elapsed);
  const elapsed = game && parsedElapsed !== null && parsedElapsed <= soloTimeLimitSeconds(game.id)
    ? parsedElapsed : null;

  const stopReview = useCallback(() => {
    if (reviewTimer.current !== null) clearTimeout(reviewTimer.current);
    reviewTimer.current = null;
    reviewingRef.current = false;
    progress.stopAnimation();
  }, [progress]);

  const leave = useCallback(() => {
    stopReview();
    router.dismissTo("/game/challenge");
  }, [stopReview]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    setReviewing(false);
    progress.setValue(0);
    const appState = AppState.addEventListener("change", state => {
      if (state !== "active") {
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
      stopReview();
      appState.remove();
      back.remove();
    };
  }, [leave, progress, stopReview]));

  if (!game) return <MissingGame />;

  const retake = () => {
    stopReview();
    router.dismissTo({ pathname: "/game/prepare", params: routeParams });
  };

  const submit = () => {
    if (elapsed === null || reviewingRef.current || !focused.current ||
      (AppState.currentState !== null && AppState.currentState !== "active")) return;
    reviewingRef.current = true;
    setReviewing(true);
    progress.setValue(reduceMotion ? 0.65 : 0);
    if (!reduceMotion) Animated.timing(progress, {
      toValue: 1, duration: DEMO_REVIEW_MS, easing: Easing.linear, useNativeDriver: false,
    }).start();
    // This delay previews the review flow. It does not upload a clip or request an AI verdict.
    reviewTimer.current = setTimeout(() => {
      reviewTimer.current = null;
      if (!focused.current || !reviewingRef.current ||
        (AppState.currentState !== null && AppState.currentState !== "active")) return;
      reviewingRef.current = false;
      router.replace({ pathname: "/game/result", params: { ...routeParams, outcome: "complete" } });
    }, DEMO_REVIEW_MS);
  };

  if (elapsed === null) return <GameScreen label={game.title} centered onBack={leave}
    footer={<GameButton label="Set up camera" onPress={retake} />}>
    <GameHeading title="No round to review" description="Start a round to see the video review flow." />
  </GameScreen>;

  return <GameScreen label={game.title} onBack={leave} centered={reviewing}
    footer={reviewing ? undefined : <><GameButton label="Submit" onPress={submit} /><TextAction label="Retake round" onPress={retake} /></>}>
    {reviewing ? <>
      <View style={styles.reviewCard}>
        <View style={styles.reviewIcon}><FilmStripIcon size={25} color={text.primary} /></View>
        <Text accessibilityRole="header" style={ui.sectionTitle}>AI review</Text>
        <Text style={[ui.caption, styles.centerText]}>Checking your round</Text>
        <View accessible accessibilityRole="progressbar" accessibilityLabel="Demo AI review in progress"
          accessibilityState={{ busy: true }} style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
        </View>
      </View>
      <GameNote>Demo only. No video is uploaded. A sample result opens next.</GameNote>
    </> : <>
      <GameHeading title="Review your round" description="Check the clip, then submit it for review." />
      <View style={styles.clip}>
        <CameraStage compact label="Video preview">
          <View style={styles.emptyClip}><FilmStripIcon size={32} color={text.secondary} weight="light" /><Text style={styles.clipLabel}>No recording attached</Text></View>
        </CameraStage>
        <View style={styles.clipMeta}>
          <View style={ui.row}><ClockIcon size={16} color={text.secondary} /><Text style={ui.rowTitle}>{formatGameTime(elapsed)}</Text></View>
          <Text style={ui.small}>Round duration</Text>
        </View>
      </View>
      <GameNote>Demo only. Submit previews AI review and a sample result. No video or score is saved.</GameNote>
    </>}
  </GameScreen>;
}

const styles = StyleSheet.create({
  clip: { gap: 12 },
  emptyClip: { alignItems: "center", gap: 10 },
  clipLabel: { ...type.caption, color: text.secondary },
  clipMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewCard: { alignItems: "center", gap: 12, paddingHorizontal: 24, paddingVertical: 30, borderRadius: 26, backgroundColor: pastel.butter },
  reviewIcon: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.8)", marginBottom: 4 },
  centerText: { textAlign: "center" },
  progressTrack: { width: "100%", height: 8, borderRadius: 4, backgroundColor: bg.canvas, overflow: "hidden", marginTop: 12 },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: accent.deep },
});
