import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, StyleSheet, Switch, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
} from "react-native-reanimated";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { useKeepAwake } from "expo-keep-awake";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { CameraIcon, HandIcon, SpeakerHighIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { CoinGlyph } from "@/components/ui/StatGlyphs";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { GAMES, REASONS, SIT_TIERS, TRICK_INFO, errorText, formatClock, formatScore, ordinal } from "@/features/game/arena/arenaCopy";
import { arenaKeys, useDuels, useMyArena } from "@/hooks/useArena";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { queryKeys } from "@/constants/queryKeys";
import {
  ArenaError,
  setReplayPublic,
  startAttempt,
  submitAttempt,
  uploadClip,
  type ArenaAttempt,
  type ArenaGame,
  type ArenaResult,
} from "@/services/arenaService";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

type Phase = "setup" | "starting" | "code" | "countdown" | "live" | "uploading" | "judging" | "result" | "failed";

const SOUND_FILES = {
  go: require("../../assets/sounds/arena/go.wav"),
  tick: require("../../assets/sounds/arena/tick.wav"),
  done: require("../../assets/sounds/arena/done.wav"),
  squeak: require("../../assets/sounds/arena/squeak.wav"),
  doorbell: require("../../assets/sounds/arena/doorbell.wav"),
  bounce: require("../../assets/sounds/arena/bounce.wav"),
  whistle: require("../../assets/sounds/arena/whistle.wav"),
} as const;
type SoundKey = keyof typeof SOUND_FILES;

const SOUND_LABEL: Record<string, string> = { squeak: "Squeak!", doorbell: "Ding dong!", bounce: "Bounce!", whistle: "Whistle!" };

/** How long the code word stays up before the countdown. */
const CODE_MS = 4_500;
const BEAT_MS = 900;
/** Recording needs a moment to really start before anything worth keeping happens. */
const WARMUP_MS = 800;

/** Every sound loaded once, played from the start each time. */
const useSounds = () => {
  const players = useRef<Partial<Record<SoundKey, AudioPlayer>>>({});
  useEffect(() => {
    const all = players.current;
    (Object.keys(SOUND_FILES) as SoundKey[]).forEach((k) => {
      all[k] = createAudioPlayer(SOUND_FILES[k]);
    });
    return () => (Object.values(all) as AudioPlayer[]).forEach((p) => p.remove());
  }, []);
  return useCallback((key: SoundKey) => {
    const p = players.current[key];
    if (!p) return;
    void p.seekTo(0).then(() => p.play());
  }, []);
};

/** Speaker on while the camera records: the sounds have to be on the clip. */
const speakerOn = () => setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true, interruptionMode: "mixWithOthers" }).catch(() => undefined);

export default function ArenaPlayScreen() {
  useKeepAwake();
  const params = useLocalSearchParams<{ game?: string; duelId?: string }>();
  const game: ArenaGame = params.game === "trick_combo" ? "trick_combo" : "longest_sit";
  const duelId = params.duelId || undefined;
  const info = GAMES[game];
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const dog = useCurrentDog();
  const dogId = dog.data?.id;
  const name = dog.data?.name ?? "your dog";
  const mine = useMyArena(duelId ? undefined : dogId, game);
  const duels = useDuels(duelId ? dogId : undefined);
  const duel = duels.data?.find((d) => d.id === duelId);

  const [camPermission, requestCam] = useCameraPermissions();
  const [micPermission, requestMic] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("setup");
  const [attempt, setAttempt] = useState<ArenaAttempt | null>(null);
  const [count, setCount] = useState(3);
  const [goAt, setGoAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [cue, setCue] = useState<string | null>(null);
  const [result, setResult] = useState<ArenaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const recording = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const clip = useRef<{ uri: string; ext: "mov" | "mp4" | null } | null>(null);
  const phaseRef = useRef<Phase>("setup");
  phaseRef.current = phase;
  const play = useSounds();

  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const recordingNow = phase === "code" || phase === "countdown" || phase === "live";

  // The clock only ticks while playing.
  useEffect(() => {
    if (phase !== "live") return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [phase]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: arenaKeys.all });
    if (dogId) void queryClient.invalidateQueries({ queryKey: queryKeys.wallet(dogId) });
  };

  const judge = async (a: ArenaAttempt) => {
    const c = clip.current;
    if (!c) return;
    try {
      if (!c.ext) {
        setPhase("uploading");
        c.ext = await uploadClip(a, c.uri);
      }
      setPhase("judging");
      const r = await submitAttempt(a.id, c.ext);
      void Haptics.notificationAsync(r.status === "scored" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      setResult(r);
      setPhase("result");
      refresh();
    } catch (e) {
      setError((e as ArenaError).code ?? "server_error");
      setPhase("failed");
    }
  };

  const stop = async () => {
    if (!recordingNow || !attempt) return;
    clearTimers();
    play("done");
    cameraRef.current?.stopRecording();
    const a = attempt;
    setPhase("uploading");
    const done = await recording.current?.catch(() => undefined);
    recording.current = null;
    if (!done?.uri) {
      setError("upload_failed");
      setPhase("failed");
      return;
    }
    clip.current = { uri: done.uri, ext: null };
    await judge(a);
  };
  const stopRef = useRef(stop);
  stopRef.current = stop;

  // Leaving the app ends the recording; what was filmed is still sent.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && (phaseRef.current === "code" || phaseRef.current === "countdown" || phaseRef.current === "live")) void stopRef.current();
    });
    return () => sub.remove();
  }, []);

  const begin = async () => {
    if (!dogId || !cameraReady || !cameraRef.current) return;
    setError(null);
    setPhase("starting");
    let a: ArenaAttempt;
    try {
      a = await startAttempt(dogId, game, duelId);
    } catch (e) {
      setError((e as ArenaError).code ?? "server_error");
      setPhase("setup");
      return;
    }
    setAttempt(a);
    setResult(null);
    setShared(false);
    clip.current = null;
    await speakerOn();
    recording.current = cameraRef.current.recordAsync({ maxDuration: Math.ceil((a.plan.capMs + 25_000) / 1000) });
    // The camera can take over the audio route as it starts; put the speaker back.
    later(WARMUP_MS - 200, () => void speakerOn());
    later(WARMUP_MS, () => setPhase("code"));
    const countFrom = WARMUP_MS + CODE_MS;
    [3, 2, 1].forEach((n, i) =>
      later(countFrom + i * BEAT_MS, () => {
        setCount(n);
        setPhase("countdown");
        play("tick");
        void Haptics.selectionAsync();
      }),
    );
    later(countFrom + 3 * BEAT_MS, () => {
      const at = Date.now();
      play("go");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGoAt(at);
      setNow(at);
      setPhase("live");
      if (a.plan.kind === "longest_sit") {
        a.plan.chimes.forEach((c) =>
          later(c.atMs, () => {
            play(c.sound);
            setCue(SOUND_LABEL[c.sound] ?? null);
            later(1400, () => setCue(null));
          }),
        );
      }
      later(a.plan.capMs + 1_000, () => void stopRef.current());
    });
  };

  const reset = () => {
    clearTimers();
    setAttempt(null);
    setResult(null);
    setError(null);
    setGoAt(null);
    clip.current = null;
    setPhase("setup");
    void mine.refetch();
    void duels.refetch();
  };

  const close = () => {
    if (recordingNow) {
      clearTimers();
      cameraRef.current?.stopRecording();
    }
    router.back();
  };

  const permitted = Boolean(camPermission?.granted && micPermission?.granted);
  const askPermissions = async () => {
    // Once refused, iOS won't ask again; only Settings can turn it back on.
    if ((camPermission && !camPermission.granted && !camPermission.canAskAgain) || (micPermission && !micPermission.granted && !micPermission.canAskAgain)) {
      void Linking.openSettings();
      return;
    }
    const cam = camPermission?.granted ? camPermission : await requestCam();
    if (cam.granted && !micPermission?.granted) await requestMic();
  };

  const elapsed = goAt ? now - goAt : 0;
  const plan = attempt?.plan;
  const triesNote = duelId
    ? duel
      ? duel.theirScoreMs != null
        ? `Beat ${formatScore(game, duel.theirScoreMs)} from ${duel.opponentName ?? "them"}`
        : duel.opponentName
          ? `Duel with ${duel.opponentName}`
          : "Duel"
      : "Duel"
    : mine.data
      ? `${mine.data.triesLeft} of ${mine.data.triesPerDay} tries left today`
      : undefined;

  return (
    <View style={styles.screen}>
      {permitted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="front"
          mode="video"
          videoQuality="480p"
          videoBitrate={1_500_000}
          mirror
          onCameraReady={() => setCameraReady(true)}
          onMountError={(e) => setCameraError(e.message)}
        />
      ) : null}
      {phase === "setup" || phase === "starting" ? <View pointerEvents="none" style={[styles.frame, { top: insets.top + 76 }]} /> : null}

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <PressScale accessibilityRole="button" accessibilityLabel="Close" style={styles.round} onPress={close}>
          <XIcon size={20} color="#FFFFFF" weight="bold" />
        </PressScale>
        <View style={styles.titlePill}>
          <Text style={styles.titleText}>{info.title}</Text>
        </View>
        {recordingNow ? (
          <Animated.View entering={FadeIn.duration(motion.duration.enter)} style={styles.rec}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>REC</Text>
          </Animated.View>
        ) : (
          <View style={styles.roundSpacer} />
        )}
      </View>

      {phase === "code" && attempt ? (
        <View style={styles.center} pointerEvents="none">
          <Animated.View entering={reduceMotion ? FadeIn : ZoomIn.duration(motion.duration.enter).easing(motion.easing.out).withInitialValues({ transform: [{ scale: 0.92 }], opacity: 0 })} style={styles.codeCard}>
            <Text style={styles.codeEyebrow}>SAY OUT LOUD</Text>
            <Text style={styles.codeWord} adjustsFontSizeToFit numberOfLines={1}>
              {attempt.codeWord}
            </Text>
            <View style={styles.codeHands}>
              <HandIcon size={20} color={text.primary} weight="fill" />
              <Text style={styles.codeHandsText}>Then show both open hands</Text>
            </View>
          </Animated.View>
        </View>
      ) : null}

      {phase === "countdown" ? (
        <View style={styles.center} pointerEvents="none">
          <Animated.Text key={count} entering={reduceMotion ? FadeIn : ZoomIn.duration(220).easing(motion.easing.out).withInitialValues({ transform: [{ scale: 1.25 }], opacity: 0 })} style={styles.count}>
            {count}
          </Animated.Text>
        </View>
      ) : null}

      {phase === "live" && plan ? (
        <>
          <View style={[styles.liveTop, { top: insets.top + 64 }]} pointerEvents="none">
            <Text style={styles.clock}>{plan.kind === "trick_combo" ? `${(elapsed / 1000).toFixed(1)}` : formatClock(elapsed)}</Text>
            {plan.kind === "longest_sit" ? <Tiers elapsed={elapsed} /> : <Text style={styles.limit}>{`Limit ${formatClock(plan.capMs)}`}</Text>}
          </View>
          {cue ? (
            <View style={styles.center} pointerEvents="none">
              <Animated.View entering={reduceMotion ? FadeIn : ZoomIn.duration(180).withInitialValues({ transform: [{ scale: 0.9 }], opacity: 0 })} exiting={FadeOut.duration(160)} style={styles.cue}>
                <SpeakerHighIcon size={20} color={text.primary} weight="fill" />
                <Text style={styles.cueText}>{cue}</Text>
              </Animated.View>
            </View>
          ) : null}
          <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}>
            {plan.kind === "trick_combo" ? (
              <View style={styles.tricks}>
                {plan.tricks.map((t, i) => {
                  const trick = TRICK_INFO[t];
                  return (
                    <Animated.View key={`${t}-${i}`} entering={reduceMotion ? undefined : FadeIn.delay(i * 70).duration(motion.duration.enter)} style={styles.trick}>
                      <Text style={styles.trickNo}>{i + 1}</Text>
                      {trick ? <trick.Icon size={26} color="#FFFFFF" weight="fill" /> : null}
                      <Text style={styles.trickLabel}>{trick?.label ?? t}</Text>
                    </Animated.View>
                  );
                })}
              </View>
            ) : null}
            <RaisedButton
              tone="white"
              label={plan.kind === "trick_combo" ? "Done" : "Stop"}
              sub={plan.kind === "trick_combo" ? "Tap after the last trick" : `Tap when ${name} gets up`}
              onPress={() => void stop()}
            />
          </View>
        </>
      ) : null}

      {phase === "setup" || phase === "starting" ? (
        <Animated.View entering={reduceMotion ? undefined : SlideInDown.duration(motion.duration.reveal).easing(motion.easing.drawer)} style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <Text style={styles.sheetEyebrow}>{info.direction.toUpperCase()}</Text>
          <Text style={styles.sheetTitle}>Prop the phone up, facing you both.</Text>
          <View style={styles.steps}>
            <Step n={1} line={`You and ${name} in the frame, sound on`} />
            <Step n={2} line="Say the code word and show your hands" />
            <Step n={3} line={info.goal} />
          </View>
          {permitted && !cameraReady && !cameraError ? <Text style={styles.waitLine}>Starting the camera.</Text> : null}
          {cameraError ? <Text style={styles.error}>{`The camera didn't start. ${cameraError}`}</Text> : null}
          {error ? <Text style={styles.error}>{errorText(error)}</Text> : null}
          {permitted ? (
            <RaisedButton
              label={phase === "starting" ? "Getting ready" : "I'm ready"}
              sub={triesNote}
              busy={phase === "starting"}
              disabled={!cameraReady || !dogId || (mine.data?.triesLeft === 0 && !duelId) || (duel ? !duel.myTurnOpen : false)}
              onPress={() => void begin()}
            />
          ) : (
            <RaisedButton label="Allow camera and microphone" icon={<CameraIcon size={20} color={text.primary} weight="fill" />} onPress={() => void askPermissions()} />
          )}
        </Animated.View>
      ) : null}

      {phase === "uploading" || phase === "judging" ? (
        <Animated.View entering={FadeIn.duration(motion.duration.enter)} style={styles.dim}>
          <View style={styles.waitCard}>
            <Dots />
            <Text style={styles.waitTitle}>{phase === "uploading" ? "Sending the clip" : "Checking the clip"}</Text>
            <Text style={styles.waitNote}>{phase === "uploading" ? "Keep PAWS open." : "Timing every second. About a minute."}</Text>
          </View>
        </Animated.View>
      ) : null}

      {phase === "failed" ? (
        <Animated.View entering={FadeIn.duration(motion.duration.enter)} style={styles.dim}>
          <View style={[styles.sheet, styles.sheetFloat, { paddingBottom: insets.bottom + space.lg }]}>
            <Text style={styles.sheetTitle}>The clip didn't go through.</Text>
            <Text style={styles.resultLine}>{errorText(error ?? undefined)}</Text>
            {attempt && clip.current ? <RaisedButton label="Send it again" onPress={() => void judge(attempt)} /> : null}
            <RaisedButton tone="white" label="Back" onPress={reset} />
          </View>
        </Animated.View>
      ) : null}

      {phase === "result" && result ? (
        <View style={styles.dim}>
          <Animated.View entering={reduceMotion ? FadeIn : SlideInDown.duration(motion.duration.reveal).easing(motion.easing.drawer)} style={[styles.sheet, styles.sheetFloat, { paddingBottom: insets.bottom + space.lg }]}>
            <Result
              game={game}
              result={result}
              name={name}
              shared={shared}
              onShare={(value) => {
                setShared(value);
                if (result.attemptId) void setReplayPublic(result.attemptId, value).then(refresh).catch(() => setShared(!value));
              }}
            />
            <View style={styles.resultButtons}>
              {(!duelId && (mine.data?.triesLeft ?? 0) > 0) || (duelId && result.duel?.myTurnOpen) ? (
                <RaisedButton label="Play again" sub={duelId ? undefined : `${Math.max(0, (mine.data?.triesLeft ?? 1) - 1)} left today`} onPress={reset} style={styles.flex} />
              ) : null}
              <RaisedButton tone="white" label="Done" onPress={() => router.back()} style={styles.flex} />
            </View>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const Step = ({ n, line }: { n: number; line: string }) => (
  <View style={styles.step}>
    <Text style={styles.stepNo}>{n}</Text>
    <Text style={styles.stepLine}>{line}</Text>
  </View>
);

/** Bronze, Silver, Gold along one bar; the next one to reach is named. */
const Tiers = ({ elapsed }: { elapsed: number }) => {
  const top = SIT_TIERS[SIT_TIERS.length - 1].ms;
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: withTiming(Math.min(1, elapsed / top), { duration: 120 }) }] }), [elapsed]);
  const next = SIT_TIERS.find((t) => elapsed < t.ms);
  return (
    <View style={styles.tiers}>
      <View style={styles.tierTrack}>
        <Animated.View style={[styles.tierFill, fill]} />
        {SIT_TIERS.map((t) => (
          <View key={t.label} style={[styles.tierMark, { left: `${(t.ms / top) * 100}%` }, elapsed >= t.ms && styles.tierMarkOn]} />
        ))}
      </View>
      <Text style={styles.tierNote}>{next ? `${next.label} at ${formatClock(next.ms)}` : "Gold. Keep going."}</Text>
    </View>
  );
};

const Dots = () => {
  const reduceMotion = useReducedMotion();
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          entering={reduceMotion ? undefined : FadeIn.delay(i * 120)}
          style={[styles.dot, { opacity: 0.35 + i * 0.3 }]}
        />
      ))}
    </View>
  );
};

const Result = ({
  game,
  result,
  name,
  shared,
  onShare,
}: {
  game: ArenaGame;
  result: ArenaResult;
  name: string;
  shared: boolean;
  onShare: (value: boolean) => void;
}) => {
  if (result.status !== "scored") {
    return (
      <>
        <Text style={styles.sheetEyebrow}>{GAMES[game].title.toUpperCase()}</Text>
        <Text style={styles.sheetTitle}>{result.status === "invalid" ? "This one didn't count." : "No score this time."}</Text>
        <Text style={styles.resultLine}>{(result.reason && REASONS[result.reason]) || "Try again with the whole dog in view and the sound on."}</Text>
      </>
    );
  }
  const duel = result.duel;
  const duelLine = duel
    ? duel.result === "won"
      ? `${name} won the duel.`
      : duel.result === "lost"
        ? `${duel.opponentName ?? "They"} won this one.`
        : duel.result === "draw"
          ? "A draw."
          : duel.opponentName
            ? `Waiting for ${duel.opponentName}.`
            : "Waiting for someone to join."
    : null;
  return (
    <>
      <Text style={styles.sheetEyebrow}>{GAMES[game].title.toUpperCase()}</Text>
      <Animated.Text entering={ZoomIn.duration(motion.duration.reveal).easing(motion.easing.out).withInitialValues({ transform: [{ scale: 0.9 }], opacity: 0 })} style={styles.score}>
        {formatScore(game, result.scoreMs)}
      </Animated.Text>
      <View style={styles.badges}>
        {result.personalBest ? (
          <View style={styles.badge}>
            <CoinGlyph size={18} tone="silver" />
            <Text style={styles.badgeText}>{`Personal best  +${result.silver ?? 0}`}</Text>
          </View>
        ) : null}
        {result.rank ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{`${ordinal(result.rank)} this week`}</Text>
          </View>
        ) : null}
      </View>
      {duelLine ? <Text style={styles.resultLine}>{duelLine}</Text> : null}
      {!duel && result.attemptId ? (
        <View style={styles.shareRow}>
          <View style={styles.flex}>
            <Text style={styles.shareTitle}>Show the replay on the board</Text>
            <Text style={styles.shareNote}>Needed for weekly gold.</Text>
          </View>
          <Switch value={shared} onValueChange={onShare} trackColor={{ true: accent.band, false: border.default }} />
        </View>
      ) : null}
    </>
  );
};

const FILL = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;
const SHADOW = { textShadowColor: "rgba(0,0,0,0.45)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12 };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#141413" },
  flex: { flex: 1 },
  frame: {
    position: "absolute",
    left: space.xxl,
    right: space.xxl,
    bottom: "42%",
    borderRadius: 28,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.7)",
  },
  top: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.38)", alignItems: "center", justifyContent: "center" },
  roundSpacer: { width: 64 },
  titlePill: { paddingHorizontal: space.md, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.38)", justifyContent: "center" },
  titleText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  rec: { width: 64, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.38)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF453A" },
  recText: { fontSize: 12, fontWeight: "800", letterSpacing: 1, color: "#FFFFFF" },

  center: { ...FILL, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xxl },
  codeCard: { alignSelf: "stretch", backgroundColor: accent.primary, borderRadius: 28, paddingVertical: space.xxl, paddingHorizontal: space.xl, alignItems: "center" },
  codeEyebrow: { ...type.eyebrow, color: text.secondary },
  codeWord: { fontSize: 52, lineHeight: 60, fontWeight: "800", letterSpacing: 1, color: text.primary, marginTop: space.sm },
  codeHands: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md },
  codeHandsText: { ...type.supporting, fontWeight: "600", color: text.primary },
  count: { fontSize: 168, lineHeight: 180, fontWeight: "800", color: "#FFFFFF", fontVariant: ["tabular-nums"], ...SHADOW },

  liveTop: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  clock: { fontSize: 88, lineHeight: 96, fontWeight: "800", color: "#FFFFFF", fontVariant: ["tabular-nums"], letterSpacing: -2, ...SHADOW },
  limit: { fontSize: 14, fontWeight: "700", color: "rgba(255,255,255,0.85)", ...SHADOW },
  tiers: { width: 220, alignItems: "center", gap: space.sm, marginTop: space.xs },
  tierTrack: { alignSelf: "stretch", height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.28)", overflow: "visible" },
  tierFill: { ...FILL, borderRadius: 4, backgroundColor: accent.deep, transformOrigin: "left" },
  tierMark: { position: "absolute", top: -3, width: 14, height: 14, marginLeft: -7, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.5)", borderWidth: 2, borderColor: "#FFFFFF" },
  tierMarkOn: { backgroundColor: accent.band },
  tierNote: { fontSize: 13, fontWeight: "700", color: "#FFFFFF", ...SHADOW },
  cue: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: accent.deep, borderRadius: radius.pill, paddingHorizontal: space.xl, height: 48 },
  cueText: { fontSize: 18, fontWeight: "800", color: text.primary },

  bottom: { position: "absolute", left: space.lg, right: space.lg, bottom: 0, gap: space.md },
  tricks: { flexDirection: "row", gap: space.sm },
  trick: { flex: 1, alignItems: "center", gap: 4, paddingVertical: space.md, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.45)" },
  trickNo: { fontSize: 12, fontWeight: "800", color: "rgba(255,255,255,0.7)", fontVariant: ["tabular-nums"] },
  trickLabel: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },

  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: bg.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.xxl, paddingTop: space.xxl, gap: space.md },
  sheetFloat: { gap: space.md },
  sheetEyebrow: { ...type.eyebrow, color: text.tertiary },
  sheetTitle: { ...type.sectionTitle, fontWeight: "700", color: text.primary },
  steps: { gap: space.sm, marginBottom: space.sm },
  step: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepNo: { width: 24, height: 24, borderRadius: 12, overflow: "hidden", backgroundColor: accent.primary, textAlign: "center", lineHeight: 24, fontSize: 12, fontWeight: "800", color: text.primary },
  stepLine: { ...type.supporting, color: text.primary, flex: 1 },
  error: { ...type.supporting, color: "#B4442C" },
  waitLine: { ...type.supporting, color: text.secondary },

  dim: { ...FILL, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  waitCard: { backgroundColor: bg.surface, borderRadius: 28, paddingHorizontal: space.xxl, paddingVertical: space.xxl, alignItems: "center", gap: space.sm, marginHorizontal: space.xxl },
  waitTitle: { ...type.sectionTitle, fontWeight: "700", color: text.primary },
  waitNote: { ...type.supporting, color: text.secondary },
  dots: { flexDirection: "row", gap: 6, marginBottom: space.xs },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: accent.band },

  score: { fontSize: 64, lineHeight: 70, fontWeight: "800", letterSpacing: -1.5, color: text.primary, fontVariant: ["tabular-nums"] },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: accent.primary },
  badgeText: { fontSize: 13, fontWeight: "700", color: text.primary, fontVariant: ["tabular-nums"] },
  resultLine: { ...type.body, color: text.secondary },
  shareRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  shareTitle: { ...type.supporting, fontWeight: "600", color: text.primary },
  shareNote: { ...type.caption, color: text.secondary },
  resultButtons: { flexDirection: "row", gap: space.md, marginTop: space.sm },
});
