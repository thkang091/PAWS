import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, BackHandler, Modal, Platform, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { CheckIcon, StopIcon } from "phosphor-react-native";
import { useReducedMotion } from "react-native-reanimated";
import { accent, pastel, space, text, type } from "@/constants/design";
import { CameraStage, GameButton, GameScreen, MissingGame, ui } from "./GameFlowUI";
import { formatGameTime, modeHome, PREVIEW_CUE_SECONDS, PREVIEW_MAX_SECONDS } from "./gameFlow";
import { useGameFlowParams } from "./SoloScreens";

type Phase = "countdown" | "running" | "finished" | "interrupted";

export function GameSessionScreen() {
  const { game, mode, routeParams } = useGameFlowParams();
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [comboCue, setComboCue] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const started = useRef(0);
  const countdownStarted = useRef(0);
  const limit = game?.id === "paws-says" ? game.cues.length * PREVIEW_CUE_SECONDS : PREVIEW_MAX_SECONDS;
  const cueIndex = game?.id === "paws-says" ? Math.min(game.cues.length - 1, Math.floor(elapsed / PREVIEW_CUE_SECONDS)) : comboCue;

  useFocusEffect(useCallback(() => {
    setStatusBarStyle("dark");
    return () => setStatusBarStyle("dark");
  }, []));

  useEffect(() => {
    if (Platform.OS !== "ios" || !game) return;
    const message = phase === "running" ? game.cues[cueIndex]
      : phase === "countdown" ? "Get ready. Round starts in three seconds."
      : phase === "finished" ? "Round ended." : "Round interrupted. Restart when ready.";
    AccessibilityInfo.announceForAccessibility(message);
  }, [phase, game, cueIndex]);

  useFocusEffect(useCallback(() => {
    if (!game || (phase !== "running" && phase !== "countdown")) return;
    if (phase === "countdown") countdownStarted.current = Date.now();
    const timer = setInterval(() => {
      if (phase === "countdown") {
        const left = Math.max(0, 3 - Math.floor((Date.now() - countdownStarted.current) / 1000));
        setCountdown(left);
        if (!left) { started.current = Date.now(); setPhase("running"); }
      } else {
        const seconds = Math.min(limit, (Date.now() - started.current) / 1000);
        setElapsed(seconds);
        if (seconds >= limit) setPhase("finished");
      }
    }, 100);
    const subscription = AppState.addEventListener("change", state => {
      if (state !== "active") setPhase("interrupted");
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [phase, limit, game]));

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { setLeaving(true); return true; });
    return () => subscription.remove();
  }, []));

  if (!game) return <MissingGame />;
  const close = () => router.dismissTo(modeHome(mode));
  const restart = () => { setElapsed(0); setComboCue(0); setCountdown(3); setPhase("countdown"); };
  const review = () => router.replace({ pathname: "/game/review", params: { ...routeParams, elapsed: String(Math.max(0.1, Math.min(limit, elapsed))) } });
  const isCombo = game.id === "trick-combo";

  return <GameScreen label={game.title} progress={{ current: 2, total: 4 }} backLabel="Close" onBack={() => setLeaving(true)}
    footer={phase === "interrupted" ? <GameButton label="Restart round" onPress={restart} />
      : phase === "finished" ? <GameButton label="Review round" onPress={review} /> : <>
        {isCombo && phase === "running" && comboCue < game.cues.length - 1
          ? <GameButton label="Next command" onPress={() => setComboCue(current => current + 1)} /> : null}
        <GameButton label="End round" disabled={phase === "countdown"} secondary={isCombo && comboCue < game.cues.length - 1}
          icon={<StopIcon size={16} color={text.primary} weight="fill" />} onPress={() => setPhase("finished")} />
      </>}>
    <CameraStage dark>
      {phase === "countdown" ? <View style={styles.overlay} accessibilityLiveRegion="polite">
        <Text style={[styles.overline, ui.onDark]}>Get ready</Text><Text style={styles.countdown}>{countdown || "Go"}</Text>
      </View> : phase === "finished" ? <View style={styles.overlay}>
        <View style={styles.done}><CheckIcon size={28} color={text.primary} /></View><Text style={styles.cameraTitle}>Round ended</Text>
      </View> : phase === "interrupted" ? <View style={styles.overlay}>
        <Text style={styles.cameraTitle}>Round interrupted</Text><Text style={[styles.cameraBody, ui.onDark]}>Restart when your phone is ready.</Text>
      </View> : undefined}
    </CameraStage>
    <View style={styles.cueArea}>
      <Text style={styles.overline}>{phase === "finished" ? "Elapsed time" : game.cues.length > 1 ? "Command " + (cueIndex + 1) + " / " + game.cues.length : "Your cue"}</Text>
      {phase !== "finished" ? <Text accessibilityLiveRegion="polite" style={styles.command}>{phase === "countdown" ? "Wait for the cue" : phase === "interrupted" ? "Start again" : game.cues[cueIndex]}</Text> : null}
      <Text style={styles.timer} accessibilityLabel={"Round time " + formatGameTime(elapsed)}>{formatGameTime(elapsed)}</Text>
      <Text style={styles.cameraBody}>{game.id === "paws-says" && phase === "running"
        ? "Next cue in " + (PREVIEW_CUE_SECONDS - Math.floor(elapsed) % PREVIEW_CUE_SECONDS) + "s"
        : phase === "finished" ? "AI timing will be confirmed after video review." : "Stop when your dog needs a break."}</Text>
    </View>
    <Modal visible={leaving} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={() => setLeaving(false)}>
      <View style={ui.scrim}><View style={ui.dialog} accessibilityViewIsModal>
        <Text style={ui.sectionTitle}>Leave this round?</Text><Text style={ui.body}>This round will not be saved.</Text>
        <GameButton label="Keep playing" onPress={() => setLeaving(false)} /><GameButton label="Leave round" secondary onPress={close} />
      </View></View>
    </Modal>
  </GameScreen>;
}

const styles = StyleSheet.create({
  overlay: { alignItems: "center", gap: 14, padding: 24 },
  overline: { ...type.caption, color: text.secondary },
  countdown: { fontSize: 92, lineHeight: 108, fontWeight: "500", color: "#F9F8EF", fontVariant: ["tabular-nums"] },
  cameraTitle: { ...type.sectionTitle, color: "#F9F8EF", textAlign: "center" },
  cameraBody: { ...type.caption, color: text.secondary, textAlign: "center" },
  done: { width: 58, height: 58, borderRadius: 29, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center" },
  cueArea: { alignItems: "center", gap: space.sm, padding: space.xl, borderRadius: 26, backgroundColor: pastel.butter },
  command: { ...type.pageTitle, color: text.primary, textAlign: "center" },
  timer: { fontSize: 40, lineHeight: 48, letterSpacing: -1, fontWeight: "500", color: text.primary, fontVariant: ["tabular-nums"] },
});
