import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, BackHandler, Modal, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { ArrowsClockwiseIcon, ArrowRightIcon, CheckIcon, InfoIcon, StopIcon, TimerIcon, XIcon } from "phosphor-react-native";
import { PressScale } from "@/components/ui/PressScale";
import { accent, text, type } from "@/constants/design";
import { GameButton, MissingGame, ui } from "./GameFlowUI";
import { formatGameTime, soloTimeLimitSeconds, type PlayGame } from "./gameFlow";
import { useGameFlowParams } from "./SoloScreens";
import SoloCameraSurface from "./SoloCameraSurface";

type Phase = "setup" | "countdown" | "running" | "reviewing" | "interrupted";
const COUNTDOWN_SECONDS = 5;
const now = () => performance.now();
const INK = "#FFFFFF";

export default function SoloCameraScreen() {
  const { game, routeParams } = useGameFlowParams();
  if (!game) return <MissingGame />;
  return <SoloCameraRound key={`${game.id}:${routeParams.target}`} game={game} initialTarget={routeParams.target} />;
}

function SoloCameraRound({ game, initialTarget }: { game: PlayGame; initialTarget: string }) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const compact = height < 700 || width < 360;
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("setup");
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [cameraReady, setCameraReady] = useState(false);
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [target, setTarget] = useState(initialTarget);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [about, setAbout] = useState(false);
  const startedAt = useRef(0);
  const countdownAt = useRef(0);
  const phaseRef = useRef<Phase>("setup");
  const changePhase = useCallback((next: Phase) => { phaseRef.current = next; setPhase(next); }, []);
  const isActive = phase === "countdown" || phase === "running";
  const isSpot = game.id === "spot-sprint";
  const isCombo = game.id === "trick-combo";
  const timeLimit = soloTimeLimitSeconds(game.id);
  const remaining = Math.max(0, Math.ceil(timeLimit - elapsed));

  const finish = useCallback((seconds: number) => {
    // Both expiry and the button use the same guard, so only one review opens.
    if (phaseRef.current !== "running") return;
    changePhase("reviewing");
    setLeaving(false);
    setAbout(false);
    router.replace({ pathname: "/game/review", params: {
      gameId: game.id, mode: "solo", target,
      elapsed: String(Math.max(0.1, Math.min(timeLimit, seconds))),
    } });
  }, [changePhase, game.id, target, timeLimit]);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    setForeground(AppState.currentState === "active");
    setStatusBarStyle("light");
    setElapsed(0);
    setCountdown(COUNTDOWN_SECONDS);
    setLeaving(false);
    changePhase("setup");
    return () => { phaseRef.current = "interrupted"; setFocused(false); setStatusBarStyle("dark"); };
  }, [changePhase]));

  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      setForeground(state === "active");
      if (state !== "active" && ["running", "countdown"].includes(phaseRef.current)) changePhase("interrupted");
    });
    return () => subscription.remove();
  }, [changePhase]);

  useEffect(() => {
    if (!focused || !foreground || !isActive) return;
    const tick = () => {
      if (AppState.currentState !== "active") return;
      if (phaseRef.current === "countdown") {
        const remaining = Math.max(0, COUNTDOWN_SECONDS - Math.floor((now() - countdownAt.current) / 1000));
        setCountdown(remaining);
        if (remaining === 0) { startedAt.current = now(); changePhase("running"); }
      } else if (phaseRef.current === "running") {
        const seconds = Math.min(timeLimit, (now() - startedAt.current) / 1000);
        setElapsed(seconds);
        if (seconds >= timeLimit) finish(seconds);
      }
    };
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [focused, foreground, isActive, changePhase, finish, timeLimit]);

  useEffect(() => {
    if (isActive && !cameraReady) changePhase("interrupted");
  }, [cameraReady, isActive, changePhase]);

  useEffect(() => {
    if (Platform.OS === "web" || !focused) return;
    if (phase === "countdown") AccessibilityInfo.announceForAccessibility("Get into position. Round starts in five seconds.");
    if (phase === "running") AccessibilityInfo.announceForAccessibility(isCombo ? "Go. Complete Sit, Paw, then Spin." : "Go. " + game.cues[0]);
  }, [phase, focused, game, isCombo]);

  const close = useCallback(() => router.dismissTo({ pathname: "/game/play/[gameId]", params: { gameId: game.id, mode: "solo" } }), [game.id]);
  const requestClose = useCallback(() => {
    if (["running", "countdown"].includes(phaseRef.current)) setLeaving(true);
    else close();
  }, [close]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { requestClose(); return true; });
    return () => subscription.remove();
  }, [requestClose]));

  const start = () => {
    if (!cameraReady || !foreground || phaseRef.current !== "setup") return;
    setElapsed(0);
    setCountdown(COUNTDOWN_SECONDS);
    countdownAt.current = now();
    changePhase("countdown");
  };
  const reset = () => { setElapsed(0); setCountdown(COUNTDOWN_SECONDS); changePhase("setup"); };

  const instruction = isSpot ? "Keep the starting point and target in view." : "Keep your dog’s whole body in view.";
  const cue = isSpot ? "To your " + (target === "platform" ? "platform!" : "mat!") : "Sit & stay";
  return <View style={styles.screen}>
    {/* Expo controls status bar colors on focus; native-stack styling requires a different iOS configuration. */}
    <Stack.Screen options={{ gestureEnabled: !isActive }} />
    <SoloCameraSurface active={focused && foreground && phase !== "reviewing" && phase !== "interrupted"} facing={facing} onReadyChange={setCameraReady} showHint={phase === "setup"} />
    <LinearGradient pointerEvents="none" colors={["rgba(13,20,17,0.85)", "rgba(13,20,17,0)"]} style={[styles.topShade, { height: compact ? 255 : 300 }]} />
    <LinearGradient pointerEvents="none" colors={["rgba(13,20,17,0)", "rgba(13,20,17,0.93)"]} style={styles.bottomShade} />
    <View style={[styles.chrome, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) }]} pointerEvents="box-none">
      <View style={styles.header}>
        <PressScale accessibilityRole="button" accessibilityLabel="Close camera" onPress={requestClose} style={styles.iconButton}><XIcon size={22} color={INK} /></PressScale>
        <View style={styles.headerTitle}><Text style={styles.gameTitle} numberOfLines={1}>{game.title}</Text>
          <PressScale accessibilityRole="button" accessibilityLabel="About this camera preview" onPress={() => setAbout(true)} style={styles.previewTag}>
            <Text style={styles.previewText}>Preview · not recording</Text><InfoIcon size={13} color="#E8EBE5" />
          </PressScale>
        </View>
        {phase === "setup" && Platform.OS !== "web" ? <PressScale accessibilityRole="button" accessibilityLabel="Switch camera"
          onPress={() => { setCameraReady(false); setFacing(current => current === "back" ? "front" : "back"); }} style={styles.iconButton}><ArrowsClockwiseIcon size={22} color={INK} /></PressScale>
          : <View style={styles.headerSpacer} />}
      </View>

      {phase === "setup" && cameraReady ? <View pointerEvents="none" style={[styles.setupInstruction, compact && styles.instructionCompact]}>
        <Text style={styles.instructionTitle}>{isSpot ? "Frame the whole route" : "Find a clear spot"}</Text>
        <Text style={styles.supporting}>{instruction}</Text>
      </View> : phase === "running" ? <View style={[styles.liveInstructions, compact && styles.instructionCompact]}>
        <View style={[styles.timerPill, remaining <= 3 && styles.timerEnding]} accessible accessibilityLabel="Time remaining" accessibilityValue={{ text: `${remaining} seconds` }}>
          <TimerIcon size={16} color={INK} /><Text style={styles.timer}>{formatGameTime(remaining)}</Text><Text style={styles.previewText}>left</Text>
        </View>
        {isCombo ? <View style={styles.comboSequence} accessibilityLabel="Complete in order: Sit, Paw, Spin">
          {game.cues.map((command, index) => <View key={command + index} style={styles.comboItem}>
            <View style={styles.commandNumber}><Text style={styles.number}>{index + 1}</Text></View><Text style={[styles.comboCommand, compact && styles.comboCompact]}>{command}</Text>
            {index < game.cues.length - 1 ? <ArrowRightIcon size={15} color="#BDC6BA" /> : null}
          </View>)}
        </View> : <Text style={[styles.command, compact && styles.commandCompact]}>{cue}</Text>}
        <Text style={styles.supporting}>{isCombo ? "Complete all three in order." : isSpot ? "Reach the target, then sit." : "End the round when your dog gets up."}</Text>
      </View> : null}

      <View style={styles.openFrame} pointerEvents="none">
        {phase === "setup" && cameraReady ? <View style={styles.frameGuide}>
          <View style={[styles.corner, styles.topLeft]} /><View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} /><View style={[styles.corner, styles.bottomRight]} />
          {isSpot ? <View style={styles.targetGuide}><Text style={styles.targetGuideText}>Keep your {target === "platform" ? "platform" : "mat"} in view</Text></View> : null}
        </View> : null}
      </View>

      <View style={[styles.controls, compact && styles.controlsCompact]}>
        {phase === "setup" ? cameraReady ? <>
          {isSpot ? <View style={styles.targetRow} accessibilityRole="radiogroup" accessibilityLabel="Target type">
            {(["mat", "platform"] as const).map(value => <PressScale key={value} accessibilityRole="radio" accessibilityLabel={value === "mat" ? "Mat" : "Low platform"}
              accessibilityState={{ checked: target === value }} aria-checked={target === value} onPress={() => setTarget(value)} style={[styles.targetOption, target === value && styles.targetSelected]}>
              {target === value ? <CheckIcon size={15} color={text.primary} weight="bold" /> : null}<Text style={[styles.targetText, target === value && styles.selectedText]}>{value === "mat" ? "Mat" : "Low platform"}</Text>
            </PressScale>)}
          </View> : null}
          <View style={styles.startHint}><TimerIcon size={16} color="#E1E6DC" /><Text style={styles.supporting}>5 sec to get ready · {timeLimit} sec to play</Text></View>
          <GameButton label="Start round" disabled={!cameraReady} onPress={start} />
          {!compact ? <Text style={styles.smallNote}>Prop up your phone. Leave room for all four paws.</Text> : null}
        </> : null : phase === "countdown" ? <PressScale accessibilityRole="button" accessibilityLabel="Cancel countdown" onPress={reset} style={styles.secondaryButton}><Text style={styles.secondaryText}>Cancel countdown</Text></PressScale>
          : phase === "running" ? <>
            <PressScale accessibilityRole="button" accessibilityLabel="End round" onPress={() => finish((now() - startedAt.current) / 1000)} style={styles.endButton}><StopIcon size={17} weight="fill" color={text.primary} /><Text style={styles.endText}>End round</Text></PressScale>
            <Text style={styles.smallNote}>Ends automatically at 00:00. You can stop early.</Text>
          </> : phase === "interrupted" ? <><GameButton label="Back to camera setup" onPress={reset} /><Text style={styles.smallNote}>Check your camera before starting again.</Text></> : null}
      </View>
    </View>

    {phase === "countdown" ? <View pointerEvents="none" style={styles.centerOverlay} accessibilityLiveRegion="polite">
      <Text style={styles.centerLabel}>Get into position</Text><Text style={styles.countdown}>{countdown}</Text><Text style={styles.centerHelp}>Your round starts at zero.</Text>
    </View> : phase === "running" && elapsed < 0.7 ? <View pointerEvents="none" style={styles.centerOverlay}><Text style={styles.go}>Go!</Text></View>
      : phase === "interrupted" ? <View pointerEvents="none" style={styles.centerOverlay}>
        <Text style={styles.centerTitle}>Round interrupted</Text>
        <Text style={styles.centerHelp}>Let’s get your camera ready again.</Text>
      </View> : null}

    <Modal visible={leaving || about} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={() => { setLeaving(false); setAbout(false); }}>
      <View style={ui.scrim}><View style={ui.dialog} accessibilityViewIsModal>
        <Text style={ui.sectionTitle}>{about ? "Camera flow preview" : "Leave this round?"}</Text>
        <Text style={ui.body}>{about ? "Try the setup, countdown and game screens. Camera preview is available on your phone. Recording, AI review and saving will be connected next." : "Your current round will not be saved."}</Text>
        <GameButton label={about ? "Got it" : "Keep playing"} onPress={() => { setAbout(false); setLeaving(false); }} />
        {!about ? <GameButton label="Leave round" secondary onPress={() => { changePhase("interrupted"); setLeaving(false); close(); }} /> : null}
      </View></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#26342D" },
  topShade: { position: "absolute", top: 0, left: 0, right: 0 },
  bottomShade: { position: "absolute", bottom: 0, left: 0, right: 0, height: "38%" },
  chrome: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" },
  headerSpacer: { width: 44 },
  headerTitle: { flex: 1, alignItems: "center", gap: 2 },
  gameTitle: { ...type.cardTitle, color: INK },
  previewTag: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 32 },
  previewText: { ...type.caption, color: "#E8EBE5" },
  setupInstruction: { alignItems: "center", gap: 8, paddingTop: 32 },
  instructionCompact: { paddingTop: 16 },
  instructionTitle: { ...type.sectionTitle, color: INK, textAlign: "center" },
  supporting: { ...type.supporting, color: "#F1F3ED", textAlign: "center" },
  openFrame: { flex: 1, minHeight: 70, marginVertical: 26 },
  frameGuide: { flex: 1, marginHorizontal: 5 },
  corner: { position: "absolute", width: 24, height: 24, borderColor: "rgba(244,242,192,0.65)" },
  topLeft: { top: 0, left: 0, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderTopLeftRadius: 12 },
  topRight: { top: 0, right: 0, borderTopWidth: 1.5, borderRightWidth: 1.5, borderTopRightRadius: 12 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderBottomLeftRadius: 12 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderBottomRightRadius: 12 },
  targetGuide: { position: "absolute", bottom: 22, alignSelf: "center", paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16, backgroundColor: "rgba(16,28,21,0.55)" },
  targetGuideText: { ...type.caption, color: "#F2F3D7" },
  controls: { gap: 16, width: "100%", maxWidth: 440, alignSelf: "center" },
  controlsCompact: { gap: 12 },
  startHint: { flexDirection: "row", gap: 7, justifyContent: "center", alignItems: "center" },
  smallNote: { ...type.caption, color: "#E0E5DB", textAlign: "center" },
  secondaryButton: { minHeight: 56, borderRadius: 28, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", backgroundColor: "rgba(16,28,21,0.35)", justifyContent: "center", alignItems: "center" },
  secondaryText: { ...type.body, color: INK, fontWeight: "500" },
  endButton: { minHeight: 56, borderRadius: 28, backgroundColor: accent.primary, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  endText: { ...type.body, fontWeight: "600", color: text.primary },
  textButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  liveInstructions: { alignItems: "center", gap: 14, paddingTop: 26 },
  timerPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22 },
  timerEnding: { backgroundColor: "rgba(255,211,103,0.24)" },
  timer: { fontSize: 20, lineHeight: 24, fontWeight: "500", color: INK, fontVariant: ["tabular-nums"] },
  command: { fontSize: 34, lineHeight: 39, fontWeight: "600", letterSpacing: -0.6, color: INK, textAlign: "center" },
  commandCompact: { fontSize: 28, lineHeight: 33 },
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
  centerLabel: { ...type.sectionTitle, color: INK, textAlign: "center" },
  countdown: { fontSize: 112, lineHeight: 124, letterSpacing: -4, fontWeight: "500", color: accent.primary, fontVariant: ["tabular-nums"] },
  go: { fontSize: 72, lineHeight: 86, letterSpacing: -2, fontWeight: "600", color: accent.primary },
  centerHelp: { ...type.supporting, color: "#EDF0E8", textAlign: "center" },
  centerTitle: { ...type.pageTitle, color: INK, textAlign: "center" },
  doneDisc: { width: 52, height: 52, borderRadius: 26, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center", marginBottom: 4 },
});
