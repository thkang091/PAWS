import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import { CheckIcon, CornersOutIcon, CrosshairIcon, InfoIcon, PauseIcon, PlayIcon, SignOutIcon, WarningIcon } from "phosphor-react-native";

import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { CourseMap, type CourseMapHandle } from "@/features/numberTrail/components/CourseMap";
import { NumberGlyph } from "@/features/numberTrail/components/NumberGlyph";
import { ActionButton, HelpSheet, MapButton, ProgressRow, helpRules } from "@/features/numberTrail/components/NtLive";
import { GPS_LABELS, gpsNeedsAttention } from "@/features/numberTrail/gpsStatus";
import { numberErrorText, phaseLabel } from "@/features/numberTrail/raceCopy";
import { courseRows, handInPhase, stageOf } from "@/features/numberTrail/raceView";
import type { SavedPractice } from "@/features/numberTrail/practiceFlow";
import { NT } from "@/features/numberTrail/theme";
import { useNumberWalk, type WalkApi } from "@/features/numberTrail/useNumberWalk";
import { finishPractice, submitPracticeProgress, type PracticeResult } from "@/services/numberRaceService";
import type { OwnProgress, ProgressPhase } from "../../../../supabase/functions/tournament/numberMatch";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

type PracticeFinish = { ok: true; result: PracticeResult; officialM: number };

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * A practice walk: the race map and progress, on your own. Nobody else is in it and nothing is ranked. The server
 * checks the walk the same way as a race, so "complete" means the same thing here.
 */
export const NtPracticeLive = ({ practice, onFinished, onQuit }: { practice: SavedPractice; onFinished: (r: PracticeFinish) => void; onQuit: () => void }) => {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const map = useRef<CourseMapHandle | null>(null);
  const { course, number } = practice;
  const api = useMemo<WalkApi<PracticeFinish | { ok: false; error: string }>>(
    () => ({
      // The walk was opened when the practice began; this phone resumes it.
      open: async () => ({ sessionId: practice.sessionId, lastSeq: 0, resumed: false }),
      progress: async (id, points) => {
        const r = await submitPracticeProgress(id, points);
        return { storedThrough: r.storedThrough, verified: true, phase: r.phase as ProgressPhase, progress: r.progress as unknown as OwnProgress };
      },
      finish: async (id, _key, points) => {
        const r = await finishPractice(id, points);
        return { ok: true, result: r.result, officialM: r.officialM };
      },
      done: (r) => r.ok,
    }),
    [practice.sessionId],
  );
  const walk = useNumberWalk({ matchId: practice.practiceId, racing: true, startsAt: practice.startedAt, course, api });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const server = walk.server;
  const phase: ProgressPhase = server?.phase ?? "DIGIT_1_PENDING";
  const single = course.digits.length === 1;
  const stage = stageOf(phase, course.digits.length);
  const rows = courseRows(course);
  const p = server?.progress as (OwnProgress & { finish?: number }) | undefined;
  const est = walk.estimate as (OwnProgress & { finish?: number }) | null;
  const oneDone = Boolean(p?.digits[0]?.complete);
  const twoDone = Boolean(p?.digits[1]?.complete);
  const allDigits = single ? oneDone : twoDone;
  const finishReached = allDigits && phase !== "FINISH_IN_PROGRESS";
  const shown = useRef({ one: 0, link: 0, two: 0, finish: 0 });
  const checked = {
    one: Math.max(shown.current.one, p?.digits[0]?.coverage ?? 0),
    link: Math.max(shown.current.link, p?.connector ?? 0),
    two: Math.max(shown.current.two, p?.digits[1]?.coverage ?? 0),
    finish: Math.max(shown.current.finish, finishReached ? 1 : (p?.finish ?? 0)),
  };
  shown.current = checked;
  const rowState = {
    one: { color: NT.one, checked: checked.one, estimate: est?.digits[0]?.coverage ?? 0, done: oneDone },
    link: { color: text.tertiary, checked: checked.link, estimate: est?.connector ?? 0, done: twoDone || (checked.link >= 0.5 && checked.two > 0) },
    two: { color: NT.two, checked: checked.two, estimate: est?.digits[1]?.coverage ?? 0, done: twoDone },
    finish: { color: NT.finish, checked: checked.finish, estimate: est?.finish ?? 0, done: finishReached },
  } as const;

  // One small moment per digit, when the server confirms it.
  const [moment, setMoment] = useState<string | null>(null);
  const celebrated = useRef({ one: oneDone, two: twoDone });
  useEffect(() => {
    const say = (m: string) => {
      setMoment(m);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };
    if (oneDone && !celebrated.current.one) {
      celebrated.current.one = true;
      say(single ? "Digit complete" : "First digit complete");
      if (!single) map.current?.focusDigit(1);
    }
    if (twoDone && !celebrated.current.two) {
      celebrated.current.two = true;
      say("Second digit complete");
    }
  }, [oneDone, twoDone, single]);
  useEffect(() => {
    if (!moment) return;
    const id = setTimeout(() => setMoment(null), 2_400);
    return () => clearTimeout(id);
  }, [moment]);

  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = handInPhase(phase) && phase !== "INVALID_COMPLETION";
  const end = async () => {
    setEnding(true);
    setError(null);
    const r = await walk.finish();
    setEnding(false);
    if (r.ok) {
      void Haptics.notificationAsync(r.result.eligible ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      onFinished(r);
    } else setError(numberErrorText(r.error));
  };
  const endEarly = () =>
    Alert.alert("End this walk?", "PAWS checks what you've walked so far. You can start a new practice after.", [
      { text: "Keep walking", style: "cancel" },
      { text: "End and check", onPress: () => void end() },
    ]);

  const notAtStart = !(p?.atStart ?? false) && !(est?.atStart ?? false) && !walk.nearStart;
  const banner: { text: string; tone: "warn" | "info" } | null = error
    ? { text: error, tone: "warn" }
    : gpsNeedsAttention(walk.gps)
      ? { text: GPS_LABELS[walk.gps], tone: "warn" }
      : walk.paused
        ? { text: walk.pausedByApp ? "Paused while PAWS was closed. Resume to keep counting." : "Paused. Nothing counts until you resume.", tone: "info" }
        : notAtStart && phase === "DIGIT_1_PENDING" && !single
          ? { text: "Go to the flag first. Your walk counts from there.", tone: "info" }
          : walk.offRoute
            ? { text: "Off the route. Head back to the course.", tone: "info" }
            : walk.offline
              ? { text: `No connection. ${walk.pending} steps saved on this phone.`, tone: "info" }
              : null;
  const [help, setHelp] = useState(false);
  const [panelH, setPanelH] = useState(260 + insets.bottom);
  const elapsed = now - Date.parse(practice.startedAt);

  return (
    <View style={styles.flex}>
      <CourseMap
        ref={map}
        course={course}
        walked={p?.edges as Record<string, number>[] | undefined}
        focus={oneDone && !single ? 1 : null}
        position={walk.position}
        track={walk.segments}
        padding={{ top: insets.top + 120, right: 80, bottom: panelH + 16, left: 32 }}
      />

      <View style={[styles.hud, { top: insets.top + space.sm }]} accessible accessibilityLabel={`Practice. Number ${number}. ${stage.label}. ${phaseLabel(phase, course.digits.length)}`}>
        <View style={styles.hudNumber}>
          <Text style={styles.hudEyebrow}>PRACTICE</Text>
          <NumberGlyph value={number} height={34} link={false} stroke={0.34} />
        </View>
        <View style={styles.flexOnly}>
          <Text style={styles.hudStage}>{stage.label}</Text>
          <Text style={styles.hudPhase} numberOfLines={1}>
            {phaseLabel(phase, course.digits.length)}
          </Text>
        </View>
        <Text style={styles.hudClock}>{clock(elapsed)}</Text>
      </View>

      {banner ? (
        <Animated.View key={banner.text} entering={reduceMotion ? undefined : FadeInDown.duration(220).easing(motion.easing.out)} exiting={reduceMotion ? undefined : FadeOut.duration(160)} style={[styles.banner, banner.tone === "warn" && styles.bannerWarn, { top: insets.top + 96 }]} accessibilityLiveRegion="polite">
          {banner.tone === "warn" ? <WarningIcon size={16} color={text.primary} weight="fill" /> : null}
          <Text style={styles.bannerText}>{banner.text}</Text>
        </Animated.View>
      ) : null}

      {moment ? (
        <Animated.View entering={reduceMotion ? FadeIn.duration(160) : ZoomIn.duration(motion.duration.enter).easing(motion.easing.out).withInitialValues({ transform: [{ scale: 0.92 }] })} exiting={FadeOut.duration(160)} style={[styles.moment, { top: insets.top + 150 }]} accessibilityLiveRegion="assertive">
          <View style={styles.momentCheck}>
            <CheckIcon size={18} color={text.inverse} weight="bold" />
          </View>
          <Text style={styles.momentText}>{moment}</Text>
        </Animated.View>
      ) : null}

      <View style={[styles.controls, { bottom: panelH + space.md }]}>
        <MapButton label="Show the whole course" onPress={() => map.current?.fitAll()}>
          <CornersOutIcon size={20} color={text.primary} weight="bold" />
        </MapButton>
        <MapButton label="Centre on me" disabled={!walk.position} onPress={() => walk.position && map.current?.centreOn(walk.position)}>
          <CrosshairIcon size={20} color={walk.position ? text.primary : text.disabled} weight="bold" />
        </MapButton>
      </View>

      <View style={[styles.panel, { paddingBottom: insets.bottom + space.md }]} onLayout={(e) => setPanelH(Math.round(e.nativeEvent.layout.height))}>
        {rows.map((r) => (
          <ProgressRow key={r.key} label={r.label} thin={r.thin} {...rowState[r.key]} />
        ))}
        <Text style={styles.note}>{server ? "Solid bars: checked by PAWS. Faint bars: this phone's guess." : "PAWS checks your walk every few seconds as you go."}</Text>
        {complete ? <RaisedButton label="Finish practice" sub="PAWS checks the whole walk" busy={ending} onPress={() => void end()} style={styles.cta} /> : null}
        <View style={styles.actions}>
          <ActionButton label={walk.paused ? "Resume" : "Pause"} onPress={walk.paused ? walk.resume : walk.pause}>
            {walk.paused ? <PlayIcon size={20} color={text.primary} weight="fill" /> : <PauseIcon size={20} color={text.primary} weight="fill" />}
          </ActionButton>
          <ActionButton label="Help" onPress={() => setHelp(true)}>
            <InfoIcon size={20} color={text.primary} weight="bold" />
          </ActionButton>
          <ActionButton label={complete ? "Quit" : "End"} onPress={complete ? onQuit : endEarly}>
            <SignOutIcon size={20} color="#B4442C" weight="bold" />
          </ActionButton>
        </View>
      </View>
      <HelpSheet visible={help} rules={helpRules(course, true)} onClose={() => setHelp(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: bg.subtle },
  flexOnly: { flex: 1 },
  hud: { position: "absolute", left: space.md, right: space.md, flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: 22, backgroundColor: bg.surface, borderWidth: 1, borderColor: border.soft, shadowColor: "#1C1B1A", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  hudNumber: { alignItems: "center", paddingRight: space.md, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: border.default },
  hudEyebrow: { fontSize: 9, fontWeight: "800", letterSpacing: 1.4, color: text.tertiary, marginBottom: 2 },
  hudStage: { fontSize: 17, fontWeight: "800", color: text.primary, letterSpacing: -0.2 },
  hudPhase: { ...type.caption, color: text.secondary, marginTop: 1 },
  hudClock: { fontSize: 15, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  banner: { position: "absolute", left: space.lg, right: space.lg, flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: bg.surface, borderWidth: 1, borderColor: border.soft },
  bannerWarn: { backgroundColor: accent.deep, borderColor: accent.band },
  bannerText: { fontSize: 14, fontWeight: "700", color: text.primary, flex: 1 },
  moment: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: space.sm, paddingLeft: 8, paddingRight: space.lg, height: 48, borderRadius: radius.pill, backgroundColor: text.primary },
  momentCheck: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#2F8F4E", alignItems: "center", justifyContent: "center" },
  momentText: { fontSize: 15, fontWeight: "800", color: text.inverse },
  controls: { position: "absolute", right: space.md, gap: space.sm },
  panel: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space.lg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: bg.surface, gap: 10, shadowColor: "#1C1B1A", shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
  note: { ...type.caption, color: text.secondary },
  cta: { marginTop: 4 },
  actions: { flexDirection: "row", gap: space.sm, marginTop: 4 },
});
