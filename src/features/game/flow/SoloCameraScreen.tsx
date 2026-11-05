import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AccessibilityInfo, ActivityIndicator, AppState, BackHandler, Modal, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { ArrowsClockwiseIcon, ArrowRightIcon, CheckIcon, StopIcon, XIcon } from "phosphor-react-native";
import { PressScale } from "@/components/ui/PressScale";
import { accent, text, type } from "@/constants/design";
import { GameButton, MissingGame, ui } from "./GameFlowUI";
import { formatGameTime, soloTimeLimitSeconds, type PlayGame } from "./gameFlow";
import { useGameFlowParams } from "./SoloScreens";
import SoloCameraSurface, { soloTrackingAvailable, type SoloCameraHandle } from "./SoloCameraSurface";
import { createSoloRoundController } from "./soloRoundController";
import { deleteSoloVideo, saveSoloRecording } from "./soloRecording";
import { createSoloFramingGuide } from "./soloFramingGuide";
import { projectSoloTrackingEvent } from "./soloTrackingGeometry";
import { SoloFramingReticle, SoloFramingStatusRow } from "./SoloFramingOverlay";
import { redGreenLightAt, type RedGreenLight } from "./redGreenLight";

const INK = "#FFFFFF";

export default function SoloCameraScreen() {
  const { game, routeParams } = useGameFlowParams();
  if (!game) return <MissingGame />;
  return <SoloCameraRound key={game.id + ":" + routeParams.target} game={game} initialTarget={routeParams.target} />;
}

function SoloCameraRound({ game, initialTarget }: { game: PlayGame; initialTarget: string }) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const compact = height < 700 || width < 360;
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [cameraReady, setCameraReady] = useState(false);
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [target, setTarget] = useState(initialTarget);
  const [leaving, setLeaving] = useState(false);
  const [viewport, setViewport] = useState({ width, height });
  const [guide] = useState(createSoloFramingGuide);
  const [framing, setFraming] = useState(guide.getSnapshot);
  const [trackingResetToken, setTrackingResetToken] = useState(0);
  const lastTrackingAt = useRef(0);
  const camera = useRef<SoloCameraHandle>(null);
  const targetRef = useRef(target);
  targetRef.current = target;
  const timeLimit = soloTimeLimitSeconds(game.id);
  const [round] = useState(() => createSoloRoundController({
    timeLimit,
    record: async () => {
      if (!camera.current) throw new Error("Camera unavailable");
      return camera.current.record({ maxDuration: timeLimit });
    },
    stop: () => camera.current?.stop(),
    onDiscard: deleteSoloVideo,
    onComplete: (clip, durationSeconds) => {
      const recording = saveSoloRecording({ uri: clip.uri, gameId: game.id, target: targetRef.current, durationSeconds });
      setLeaving(false);
      router.replace({ pathname: "/game/review", params: {
        gameId: game.id, mode: "solo", target: targetRef.current, recordingId: recording.id,
      } });
    },
  }));
  const { phase, countdown, elapsed, error } = useSyncExternalStore(round.subscribe, round.getSnapshot, round.getSnapshot);
  const isActive = phase === "countdown" || phase === "running" || phase === "finishing";
  const remaining = Math.max(0, Math.ceil(timeLimit - elapsed));
  const lightCue = game.id === "red-light-green-light" ? redGreenLightAt(elapsed) : undefined;
  const showingGuide = focused && foreground && cameraReady && phase === "setup";

  useEffect(() => {
    lastTrackingAt.current = performance.now();
    const initial = guide.reset();
    setFraming(soloTrackingAvailable ? initial : guide.update({ state: "unavailable", confidence: 0, timestampMs: lastTrackingAt.current }));
    if (!showingGuide || !soloTrackingAvailable) return;
    const timer = setInterval(() => {
      const receivedAt = performance.now();
      if (receivedAt - lastTrackingAt.current > 1000) {
        setFraming(guide.update({ state: "lost", confidence: 0, timestampMs: receivedAt }, receivedAt));
      }
    }, 250);
    return () => clearInterval(timer);
  }, [showingGuide, facing, trackingResetToken, guide]);

  const receiveTracking = useCallback((event: unknown) => {
    if (!showingGuide) return;
    const receivedAt = performance.now();
    const observation = projectSoloTrackingEvent(event, viewport, receivedAt);
    if (!observation) return;
    lastTrackingAt.current = receivedAt;
    setFraming(guide.update(observation, receivedAt));
  }, [showingGuide, viewport, guide]);

  useEffect(() => {
    if (Platform.OS === "ios" && showingGuide && framing.hint) {
      AccessibilityInfo.announceForAccessibility(framing.hint);
    }
  }, [showingGuide, framing.hint]);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    setForeground(AppState.currentState === "active");
    setStatusBarStyle("light");
    setLeaving(false);
    round.reset();
    return () => {
      round.interrupt();
      setFocused(false);
      setStatusBarStyle("dark");
    };
  }, [round]));

  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      setForeground(state === "active");
      if (state !== "active" && ["countdown", "running", "finishing"].includes(round.getSnapshot().phase)) {
        setLeaving(false);
        round.interrupt();
      }
    });
    return () => subscription.remove();
  }, [round]);

  useEffect(() => {
    if (!cameraReady && (phase === "countdown" || phase === "running")) round.interrupt("Camera disconnected. Try again.");
  }, [cameraReady, phase, round]);

  useEffect(() => {
    if (Platform.OS === "web" || !focused) return;
    if (phase === "countdown") AccessibilityInfo.announceForAccessibility("Recording starts in three seconds.");
    if (phase === "running") AccessibilityInfo.announceForAccessibility(lightCue
      ? lightCue === "green" ? "Green light. Come closer." : "Red light. Stop."
      : "Recording. " + game.cues.join(", "));
  }, [phase, focused, game, lightCue]);

  const close = useCallback(() => {
    round.interrupt();
    router.dismissTo({ pathname: "/game/play/[gameId]", params: { gameId: game.id, mode: "solo" } });
  }, [round, game.id]);
  const requestClose = useCallback(() => {
    if (["countdown", "running", "finishing"].includes(round.getSnapshot().phase)) setLeaving(true);
    else close();
  }, [round, close]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { requestClose(); return true; });
    return () => subscription.remove();
  }, [requestClose]));

  const start = () => {
    if (cameraReady && focused && foreground && Platform.OS !== "web") round.start();
  };

  return <View style={styles.screen} onLayout={({ nativeEvent: { layout } }) => {
    setViewport(current => current.width === layout.width && current.height === layout.height ? current : { width: layout.width, height: layout.height });
  }}>
    {/* Expo owns status bar styling for the current iOS build. */}
    <Stack.Screen options={{ gestureEnabled: !isActive }} />
    <SoloCameraSurface ref={camera} active={focused && foreground && phase !== "reviewing" && phase !== "interrupted"}
      facing={facing} onReadyChange={setCameraReady} trackingEnabled={showingGuide}
      trackingResetToken={trackingResetToken} onTrackingUpdate={receiveTracking} />
    {showingGuide ? <SoloFramingReticle snapshot={framing} width={viewport.width} height={viewport.height} /> : null}
    <LinearGradient pointerEvents="none" colors={["rgba(13,20,17,0.85)", "rgba(13,20,17,0)"]} style={[styles.topShade, { height: compact ? 255 : 300 }]} />
    <LinearGradient pointerEvents="none" colors={["rgba(13,20,17,0)", "rgba(13,20,17,0.93)"]} style={styles.bottomShade} />
    <View style={[styles.chrome, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) }]} pointerEvents="box-none">
      <View style={styles.header}>
        <PressScale accessibilityRole="button" accessibilityLabel="Close camera" onPress={requestClose} style={styles.iconButton}><XIcon size={22} color={INK} /></PressScale>
        <Text style={styles.gameTitle} numberOfLines={1}>{game.title}</Text>
        {phase === "setup" && cameraReady ? <PressScale accessibilityRole="button" accessibilityLabel="Switch camera"
          onPress={() => { setCameraReady(false); setFacing(current => current === "back" ? "front" : "back"); }} style={styles.iconButton}><ArrowsClockwiseIcon size={22} color={INK} /></PressScale>
          : <View style={styles.headerSpacer} />}
      </View>

      {phase === "setup" && cameraReady ? <View pointerEvents="none" style={[styles.setupInstruction, compact && styles.instructionCompact]}>
        <Text style={styles.instructionTitle}>Find a clear spot</Text>
      </View> : phase === "running" ? <View style={[styles.liveInstructions, compact && styles.instructionCompact]}>
        <View style={[styles.timerPill, remaining <= 3 && styles.timerEnding]} accessible
          accessibilityLabel="Recording. Time remaining" accessibilityValue={{ text: remaining + " seconds" }}>
          <View style={styles.recordingDot} /><Text style={styles.timer}>{formatGameTime(remaining)}</Text>
        </View>
        <SoloRoundCue game={game} target={target} compact={compact} light={lightCue} />
      </View> : null}

      <View style={styles.openFrame} pointerEvents="none" />

      <View style={[styles.controls, compact && styles.controlsCompact]}>
        {phase === "setup" && cameraReady ? <>
          <View style={styles.framingFeedback}>
            <SoloFramingStatusRow snapshot={framing} />
            <View style={styles.framingHintRow}>
              <View style={styles.hintSpacer} />
              <Text style={styles.framingHint} accessibilityLiveRegion="polite">{framing.hint ?? " "}</Text>
              {soloTrackingAvailable && (framing.phase === "tracking" || framing.phase === "lost") ?
                <PressScale accessibilityRole="button" accessibilityLabel="Recenter tracking" onPress={() => setTrackingResetToken(value => value + 1)} style={styles.resetTracking}>
                  <ArrowsClockwiseIcon size={17} color="#DEE6D8" />
                </PressScale> : <View style={styles.hintSpacer} />}
            </View>
          </View>
          {game.id === "spot-sprint" ? <View style={styles.targetRow} accessibilityRole="radiogroup" accessibilityLabel="Target type">
            {(["mat", "platform"] as const).map(value => <PressScale key={value} accessibilityRole="radio" accessibilityLabel={value === "mat" ? "Mat" : "Low platform"}
              accessibilityState={{ checked: target === value }} aria-checked={target === value} onPress={() => setTarget(value)} style={[styles.targetOption, target === value && styles.targetSelected]}>
              {target === value ? <CheckIcon size={15} color={text.primary} weight="bold" /> : null}<Text style={[styles.targetText, target === value && styles.selectedText]}>{value === "mat" ? "Mat" : "Low platform"}</Text>
            </PressScale>)}
          </View> : null}
          <GameButton label="Start round" onPress={start} />
        </> : phase === "countdown" ? <PressScale accessibilityRole="button" accessibilityLabel="Cancel countdown" onPress={round.reset} style={styles.secondaryButton}><Text style={styles.secondaryText}>Cancel</Text></PressScale>
          : phase === "running" ? <PressScale accessibilityRole="button" accessibilityLabel="End recording" onPress={round.finish} style={styles.endButton}><StopIcon size={17} weight="fill" color={text.primary} /><Text style={styles.endText}>End round</Text></PressScale>
            : phase === "interrupted" ? <GameButton label="Try again" onPress={round.reset} /> : null}
      </View>
    </View>

    {phase === "countdown" ? <View pointerEvents="none" style={styles.centerOverlay} accessibilityLiveRegion="polite">
      <Text style={styles.countdown}>{countdown}</Text>
    </View> : phase === "running" && elapsed < 0.7 ? <View pointerEvents="none" style={styles.centerOverlay}><Text style={styles.go}>Go!</Text></View>
      : phase === "finishing" ? <View pointerEvents="none" style={styles.centerOverlay} accessible accessibilityLabel="Saving video" accessibilityState={{ busy: true }}>
        <ActivityIndicator size="large" color={accent.primary} />
      </View> : phase === "interrupted" ? <View pointerEvents="none" style={styles.centerOverlay}>
        <Text style={styles.centerTitle}>{error ? "Couldn’t record" : "Round interrupted"}</Text>
        {error ? <Text style={styles.centerHelp}>{error}</Text> : null}
      </View> : null}

    <Modal visible={leaving} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={() => setLeaving(false)}>
      <View style={ui.scrim}><View style={ui.dialog} accessibilityViewIsModal>
        <Text style={ui.sectionTitle}>Leave this round?</Text>
        <Text style={ui.body}>This recording will be discarded.</Text>
        <GameButton label="Keep playing" onPress={() => setLeaving(false)} />
        <GameButton label="Leave round" secondary onPress={() => { setLeaving(false); close(); }} />
      </View></View>
    </Modal>
  </View>;
}

// Only the capture shell is shared. Each game's live instructions can evolve independently.
function SoloRoundCue({ game, target, compact, light }: { game: PlayGame; target: string; compact: boolean; light?: RedGreenLight }) {
  if (game.id === "red-light-green-light") {
    const green = light !== "red";
    return <View style={styles.lightCue} accessible accessibilityLabel={green ? "Green light. Come closer." : "Red light. Stop."}>
      <View style={styles.lightLabel}>
        <View style={[styles.lightIndicator, { backgroundColor: green ? "#A8D9AE" : "#F6AAA3" }]} />
        <Text style={styles.lightName}>{green ? "Green light" : "Red light"}</Text>
      </View>
      <Text style={[styles.command, compact && styles.commandCompact]}>{green ? "Come closer" : "Stop"}</Text>
    </View>;
  }
  if (game.id === "trick-combo") return <View style={styles.comboSequence} accessibilityLabel="Complete in order: Sit, Paw, Spin">
    {game.cues.map((command, index) => <View key={command + index} style={styles.comboItem}>
      <View style={styles.commandNumber}><Text style={styles.number}>{index + 1}</Text></View><Text style={[styles.comboCommand, compact && styles.comboCompact]}>{command}</Text>
      {index < game.cues.length - 1 ? <ArrowRightIcon size={15} color="#BDC6BA" /> : null}
    </View>)}
  </View>;
  const cue = game.id === "spot-sprint" ? "To your " + (target === "platform" ? "platform" : "mat") + "!" : "Sit & stay";
  return <Text style={[styles.command, compact && styles.commandCompact]}>{cue}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#26342D", overflow: "hidden" },
  topShade: { position: "absolute", top: 0, left: 0, right: 0 },
  bottomShade: { position: "absolute", bottom: 0, left: 0, right: 0, height: "38%" },
  chrome: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" },
  headerSpacer: { width: 44 },
  gameTitle: { ...type.cardTitle, flex: 1, color: INK, textAlign: "center" },
  setupInstruction: { alignItems: "center", paddingTop: 32 },
  instructionCompact: { paddingTop: 16 },
  instructionTitle: { ...type.sectionTitle, color: INK, textAlign: "center" },
  openFrame: { flex: 1, minHeight: 70, marginVertical: 26 },
  framingFeedback: { gap: 2 },
  framingHintRow: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  framingHint: { ...type.caption, color: "#EDF2E7", textAlign: "center", flex: 1 },
  hintSpacer: { width: 44 },
  resetTracking: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  controls: { gap: 16, width: "100%", maxWidth: 440, alignSelf: "center" },
  controlsCompact: { gap: 12 },
  secondaryButton: { minHeight: 56, borderRadius: 28, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", backgroundColor: "rgba(16,28,21,0.35)", justifyContent: "center", alignItems: "center" },
  secondaryText: { ...type.body, color: INK, fontWeight: "500" },
  endButton: { minHeight: 56, borderRadius: 28, backgroundColor: accent.primary, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  endText: { ...type.body, fontWeight: "600", color: text.primary },
  liveInstructions: { alignItems: "center", gap: 14, paddingTop: 26 },
  timerPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22 },
  timerEnding: { backgroundColor: "rgba(255,211,103,0.24)" },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF7570" },
  timer: { fontSize: 20, lineHeight: 24, fontWeight: "500", color: INK, fontVariant: ["tabular-nums"] },
  command: { fontSize: 34, lineHeight: 39, fontWeight: "600", letterSpacing: -0.6, color: INK, textAlign: "center" },
  commandCompact: { fontSize: 28, lineHeight: 33 },
  lightCue: { alignItems: "center", gap: 8 },
  lightLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  lightIndicator: { width: 14, height: 14, borderRadius: 7 },
  lightName: { ...type.supporting, color: INK, fontWeight: "600" },
  comboSequence: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, flexWrap: "wrap" },
  comboItem: { flexDirection: "row", alignItems: "center", gap: 7 },
  commandNumber: { width: 21, height: 21, borderRadius: 11, backgroundColor: accent.primary, justifyContent: "center", alignItems: "center" },
  number: { ...type.caption, fontWeight: "600", color: text.primary },
  comboCommand: { fontSize: 24, lineHeight: 30, color: INK, fontWeight: "600" },
  comboCompact: { fontSize: 21, lineHeight: 27 },
  targetRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  targetOption: { flexDirection: "row", gap: 6, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  targetSelected: { backgroundColor: accent.primary, borderColor: accent.primary },
  targetText: { ...type.supporting, color: INK, fontWeight: "500" },
  selectedText: { color: text.primary },
  centerOverlay: { ...StyleSheet.absoluteFill, justifyContent: "center", alignItems: "center", paddingHorizontal: 32, gap: 12 },
  countdown: { fontSize: 112, lineHeight: 124, letterSpacing: -4, fontWeight: "500", color: accent.primary, fontVariant: ["tabular-nums"] },
  go: { fontSize: 72, lineHeight: 86, letterSpacing: -2, fontWeight: "600", color: accent.primary },
  centerHelp: { ...type.supporting, color: "#EDF0E8", textAlign: "center" },
  centerTitle: { ...type.pageTitle, color: INK, textAlign: "center" },
});
