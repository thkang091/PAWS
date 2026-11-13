import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn, useAnimatedStyle, useReducedMotion, withTiming } from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import { CheckIcon, CornersOutIcon, CrosshairIcon, InfoIcon, PauseIcon, PlayIcon, SignOutIcon, WarningIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { ROUTES } from "@/features/rooms/lobbyRules";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { CourseMap, type CourseMapHandle } from "@/features/numberTrail/components/CourseMap";
import { NumberGlyph } from "@/features/numberTrail/components/NumberGlyph";
import { ConnectionPill, IndeterminateTrail } from "@/features/numberTrail/components/RacePieces";
import { GPS_LABELS, gpsNeedsAttention } from "@/features/numberTrail/gpsStatus";
import { FINISH_REASONS, FINISH_STATE_LABELS, SAFETY_LINE, numberErrorText, phaseLabel } from "@/features/numberTrail/raceCopy";
import { courseRows, finishView, handInPhase, stageOf } from "@/features/numberTrail/raceView";
import { raceElapsedMs } from "@/features/numberTrail/raceSync";
import { NT } from "@/features/numberTrail/theme";
import type { useNumberWalk } from "@/features/numberTrail/useNumberWalk";
import { leaveNumberRace, type FinishReply, type RaceState } from "@/services/numberRaceService";
import type { OwnProgress, ProgressPhase } from "../../../../supabase/functions/tournament/numberMatch";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

type Walk = ReturnType<typeof useNumberWalk<FinishReply>>;
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const ago = (at: number | null, now: number) => (at == null ? null : now - at < 10_000 ? "just now" : `${Math.round((now - at) / 1000)} s ago`);

/** Parts of a digit the server hasn't seen walked yet, as a count. */
const sectionsLeft = (p: OwnProgress | null, k: 0 | 1) => (p ? Object.values(p.segments?.[k] ?? {}).filter((v) => (v ?? 0) < 0.75).length : 0);

/**
 * The race. A full map of the assigned course with only what matters on top: the number and where you are in it,
 * GPS and connection, progress the server has checked (and this phone's estimate, labelled as one), and large
 * controls at the bottom, clear of the course.
 */
export const NtLive = ({ state, offsetMs, live, walk, onChanged }: { state: RaceState; offsetMs: number; live: boolean; walk: Walk; onChanged: () => void }) => {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const map = useRef<CourseMapHandle | null>(null);
  const course = state.course!;
  const number = state.match.number!;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // The newest server check: from the last progress reply or the last state reload.
  const fromState = state.me.progress && "digits" in state.me.progress ? (state.me.progress as unknown as OwnProgress & { phase: ProgressPhase; verifiedAt: string | null }) : null;
  const server = useMemo(() => {
    const a = walk.server;
    if (a && (!fromState || a.progress.throughSeq >= fromState.throughSeq)) return { progress: a.progress, phase: a.phase, at: a.at };
    if (fromState) return { progress: fromState as OwnProgress, phase: fromState.phase, at: fromState.verifiedAt ? Date.parse(fromState.verifiedAt) : null };
    return null;
  }, [walk.server, fromState]);
  const phase: ProgressPhase = server?.phase ?? "DIGIT_1_PENDING";
  const single = course.digits.length === 1;
  const stage = stageOf(phase, course.digits.length);
  const rows = courseRows(course);

  // Bars never move backwards on screen.
  const shown = useRef({ one: 0, link: 0, two: 0, finish: 0 });
  const finishProgress = (server?.progress as (OwnProgress & { finish?: number }) | undefined)?.finish ?? 0;
  const checked = {
    one: Math.max(shown.current.one, server?.progress.digits[0]?.coverage ?? 0),
    link: Math.max(shown.current.link, server?.progress.connector ?? 0),
    two: Math.max(shown.current.two, server?.progress.digits[1]?.coverage ?? 0),
    finish: Math.max(shown.current.finish, finishProgress),
  };
  shown.current = checked;
  const est = walk.estimate;
  const oneDone = Boolean(server?.progress.digits[0]?.complete);
  const twoDone = Boolean(server?.progress.digits[1]?.complete);
  const allDigits = single ? oneDone : twoDone;
  const finishReached = allDigits && phase !== "FINISH_IN_PROGRESS";
  const rowState = {
    one: { color: NT.one, checked: checked.one, estimate: est?.digits[0]?.coverage ?? 0, done: oneDone },
    link: { color: text.tertiary, checked: checked.link, estimate: est?.connector ?? 0, done: twoDone || (checked.link >= 0.5 && checked.two > 0) },
    two: { color: NT.two, checked: checked.two, estimate: est?.digits[1]?.coverage ?? 0, done: twoDone },
    finish: { color: NT.finish, checked: finishReached ? 1 : checked.finish, estimate: (est as { finish?: number } | null)?.finish ?? 0, done: finishReached },
  } as const;

  // A small moment when the server confirms a digit, once each.
  const [moment, setMoment] = useState<string | null>(null);
  const celebrated = useRef({ one: oneDone, two: twoDone });
  useEffect(() => {
    if (oneDone && !celebrated.current.one) {
      celebrated.current.one = true;
      setMoment(single ? "Digit complete" : "First digit complete");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!single) map.current?.focusDigit(1);
    }
    if (twoDone && !celebrated.current.two) {
      celebrated.current.two = true;
      setMoment("Second digit complete");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [oneDone, twoDone, single]);
  useEffect(() => {
    if (!moment) return;
    const id = setTimeout(() => setMoment(null), 2_400);
    return () => clearTimeout(id);
  }, [moment]);

  // ---------- Finishing ----------
  const [finishing, setFinishing] = useState(false);
  const [reply, setReply] = useState<FinishReply | { ok: false; error: string } | null>(null);
  const [sheet, setSheet] = useState(false);
  const fv = finishView(state);
  const pendingOnServer = state.me.lastAttempt?.status === "pending" || (state.me.lastAttempt?.status === "verified" && !state.me.lastAttempt.finishOrder);
  const dismissed = useRef(false);
  useEffect(() => {
    if (pendingOnServer && !dismissed.current) setSheet(true);
  }, [pendingOnServer]);
  const handIn = async () => {
    setSheet(true);
    setFinishing(true);
    setReply(null);
    const r = await walk.finish();
    setReply(r);
    setFinishing(false);
    if (r.ok && r.status === "finished") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (r.ok && r.status === "rejected") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onChanged();
  };
  const canHandIn = handInPhase(phase) || (est ? handInPhase(est.phase as ProgressPhase) && est.phase !== "INVALID_COMPLETION" : false);

  // ---------- What to tell the walker, one thing at a time ----------
  const notAtStart = !(server?.progress.atStart ?? false) && !(est?.atStart ?? false) && !walk.nearStart;
  const banner: { text: string; tone: "warn" | "info" } | null = gpsNeedsAttention(walk.gps)
    ? { text: GPS_LABELS[walk.gps], tone: "warn" }
    : walk.paused
      ? { text: walk.pausedByApp ? "Paused while PAWS was closed. Resume to keep counting." : "Paused. Nothing counts until you resume.", tone: "info" }
      : notAtStart && phase === "DIGIT_1_PENDING" && !single
        ? { text: "Go to the flag first. Your walk counts from there.", tone: "info" }
        : walk.offRoute
          ? { text: phase === "FINISH_IN_PROGRESS" ? "Off the route. Head back to the finish stretch." : oneDone && !single ? "Off the route. Head back to the green streets." : "Off the route. Head back to the gold streets.", tone: "info" }
          : walk.offline
            ? { text: `No connection. ${walk.pending} steps saved on this phone.`, tone: "info" }
            : walk.gps === "still"
              ? { text: GPS_LABELS.still, tone: "info" }
              : null;

  const leave = () =>
    Alert.alert("Leave the race?", "You won't be able to finish this race.", [
      { text: "Keep racing", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => void leaveNumberRace(state.room.id).catch(() => undefined).finally(() => router.replace((state.match.mode === "online" ? "/game/tournament?mode=online" : ROUTES.nearby) as never)) },
    ]);
  const [help, setHelp] = useState(false);
  const elapsed = raceElapsedMs(state.match.startsAt, offsetMs, now);
  // The map frames the course in the space the panel actually leaves.
  const [panelH, setPanelH] = useState(260 + insets.bottom);

  return (
    <View style={styles.flex}>
      <CourseMap
        ref={map}
        course={course}
        walked={server?.progress.edges as Record<string, number>[] | undefined}
        focus={oneDone && !single ? 1 : null}
        position={walk.position}
        track={walk.segments}
        padding={{ top: insets.top + 120, right: 80, bottom: panelH + 16, left: 32 }}
      />

      {/* Top: the number and where you are in it. */}
      <View style={[styles.hud, { top: insets.top + space.sm }]} accessible accessibilityLabel={`Number ${number}. ${stage.label}. ${phaseLabel(phase, course.digits.length)}`}>
        <View style={styles.hudNumber}>
          <Text style={styles.hudEyebrow}>NUMBER</Text>
          <NumberGlyph value={number} height={34} link={false} stroke={0.34} />
        </View>
        <View style={styles.flexOnly}>
          <Text style={styles.hudStage}>{stage.label}</Text>
          <Text style={styles.hudPhase} numberOfLines={1}>
            {phaseLabel(phase, course.digits.length)}
          </Text>
        </View>
        <View style={styles.hudRight}>
          <ConnectionPill live={live} dark />
          <Text style={styles.hudClock}>{clock(elapsed)}</Text>
        </View>
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

      {/* Map controls: on the right, clear of the course card and the bottom panel. */}
      <View style={[styles.controls, { bottom: panelH + space.md }]}>
        <MapButton label="Show the whole course" onPress={() => map.current?.fitAll()}>
          <CornersOutIcon size={20} color={text.primary} weight="bold" />
        </MapButton>
        <MapButton label={`Show digit ${stage.focus + 1}`} onPress={() => map.current?.focusDigit(stage.focus)}>
          <Text style={[styles.mapDigit, { color: stage.focus ? NT.two : accent.band }]}>{number[stage.focus] ?? number[0]}</Text>
        </MapButton>
        <MapButton label="Centre on me" disabled={!walk.position} onPress={() => walk.position && map.current?.centreOn(walk.position)}>
          <CrosshairIcon size={20} color={walk.position ? text.primary : text.disabled} weight="bold" />
        </MapButton>
      </View>

      {/* Bottom panel: progress, then controls. */}
      <View style={[styles.panel, { paddingBottom: insets.bottom + space.md }]} onLayout={(e) => setPanelH(Math.round(e.nativeEvent.layout.height))}>
        {rows.map((r) => (
          <ProgressRow key={r.key} label={r.label} thin={r.thin} {...rowState[r.key]} />
        ))}
        <Text style={styles.checkedNote}>{server?.at ? `PAWS checked ${ago(server.at, now)}. Faint bars: this phone's guess.` : "PAWS checks your walk every few seconds as you go."}</Text>

        {canHandIn ? (
          <RaisedButton label="Hand in walk" sub="PAWS checks the whole walk" busy={finishing} onPress={() => void handIn()} style={styles.handIn} />
        ) : null}
        <View style={styles.actions}>
          <ActionButton label={walk.paused ? "Resume" : "Pause"} onPress={walk.paused ? walk.resume : walk.pause}>
            {walk.paused ? <PlayIcon size={20} color={text.primary} weight="fill" /> : <PauseIcon size={20} color={text.primary} weight="fill" />}
          </ActionButton>
          <ActionButton label="Route" onPress={() => map.current?.fitAll()}>
            <CornersOutIcon size={20} color={text.primary} weight="bold" />
          </ActionButton>
          <ActionButton label="Help" onPress={() => setHelp(true)}>
            <InfoIcon size={20} color={text.primary} weight="bold" />
          </ActionButton>
          <ActionButton label="Exit" onPress={leave}>
            <SignOutIcon size={20} color="#B4442C" weight="bold" />
          </ActionButton>
        </View>
      </View>

      <FinishSheet
        visible={sheet}
        sending={finishing}
        reply={reply}
        view={fv}
        progress={server?.progress ?? null}
        number={number}
        onRetry={() => void handIn()}
        onClose={() => {
          dismissed.current = pendingOnServer;
          setSheet(false);
          setReply(null);
        }}
      />
      <HelpSheet visible={help} rules={helpRules(course)} onClose={() => setHelp(false)} />
    </View>
  );
};

export const ProgressRow = ({ label, color, checked, estimate, done, thin = false }: { label: string; color: string; checked: number; estimate: number; done: boolean; thin?: boolean }) => {
  const reduceMotion = useReducedMotion();
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: reduceMotion ? checked : withTiming(checked, { duration: 240, easing: motion.easing.out }) }] }), [checked, reduceMotion]);
  const ghost = Math.max(checked, Math.min(1, estimate));
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${done ? "done" : `${Math.round(checked * 100)} percent checked`}`}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={[styles.track, thin && styles.trackThin]}>
        <View style={[styles.ghost, { width: `${ghost * 100}%`, backgroundColor: color }]} />
        <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
      </View>
      <View style={styles.rowEnd}>{done ? <CheckIcon size={16} color={text.primary} weight="bold" /> : <Text style={styles.rowPct}>{`${Math.round(checked * 100)}%`}</Text>}</View>
    </View>
  );
};

export const MapButton = ({ label, disabled, onPress, children }: { label: string; disabled?: boolean; onPress: () => void; children: React.ReactNode }) => (
  <PressScale accessibilityRole="button" accessibilityLabel={label} disabled={disabled} style={styles.mapButton} onPress={onPress}>
    {children}
  </PressScale>
);

export const ActionButton = ({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) => (
  <PressScale accessibilityRole="button" accessibilityLabel={label} style={styles.action} onPress={onPress}>
    {children}
    <Text style={styles.actionText}>{label}</Text>
  </PressScale>
);

/** The finish check: received, being checked, then the official answer, never a guess. */
const FinishSheet = ({ visible, sending, reply, view, progress, number, onRetry, onClose }: {
  visible: boolean;
  sending: boolean;
  reply: FinishReply | { ok: false; error: string } | null;
  view: ReturnType<typeof finishView>;
  progress: OwnProgress | null;
  number: string;
  onRetry: () => void;
  onClose: () => void;
}) => {
  const insets = useSafeAreaInsets();
  let title = FINISH_STATE_LABELS.verifying;
  let body = "PAWS is checking every street of your walk. This takes a moment.";
  let working = sending;
  let canClose = false;
  let retry = false;
  if (!sending && reply && !reply.ok) {
    title = "Not sent yet";
    body = numberErrorText(reply.error);
    retry = true;
    canClose = true;
  } else if (!sending && reply?.ok && reply.status === "rejected") {
    const r = FINISH_REASONS[reply.reason] ?? FINISH_REASONS.digit_two_incomplete;
    const left = reply.reason === "digit_two_incomplete" ? sectionsLeft(progress, 1) : reply.reason === "digit_one_incomplete" ? sectionsLeft(progress, 0) : 0;
    const k = reply.reason === "digit_one_incomplete" ? 0 : 1;
    title = r.title;
    body = left ? `There ${left === 1 ? "is still a section" : `are still ${left} sections`} of digit ${number[k]} to walk. It's the faint part on the map.` : r.body;
    canClose = true;
  } else if (!sending && reply?.ok && reply.status === "finished") {
    title = reply.won ? "Number completed! You won" : "Number completed!";
    body = reply.won ? "Your walk was checked and you're first." : `Your walk was checked. You finished ${ordinal(reply.placement)}.`;
    canClose = true;
  } else if (!sending && (reply?.ok && reply.status === "verified_waiting" || view.state === "waiting_on_earlier")) {
    title = FINISH_STATE_LABELS.waiting_on_earlier;
    body = "Someone handed in just before you. Your place is decided as soon as their check is done.";
    working = true;
  } else if (!sending && view.state === "verifying") {
    working = true;
  } else if (!sending && view.state === "accepted") {
    title = "Number completed!";
    body = `Your walk was checked. You finished ${ordinal(view.placement ?? 1)}.`;
    canClose = true;
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={canClose ? onClose : undefined}>
      <View style={styles.scrim}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal accessibilityLiveRegion="polite">
          <View style={styles.sheetHead}>
            <NumberGlyph value={number} height={44} link={false} stroke={0.32} />
            {canClose ? (
              <PressScale accessibilityRole="button" accessibilityLabel="Close" style={styles.close} onPress={onClose}>
                <XIcon size={18} color={text.primary} weight="bold" />
              </PressScale>
            ) : null}
          </View>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Text style={styles.sheetBody}>{body}</Text>
          {working ? (
            <View style={styles.working}>
              <IndeterminateTrail width={160} />
            </View>
          ) : null}
          {retry ? <RaisedButton label="Try again" onPress={onRetry} style={styles.sheetCta} /> : canClose ? <RaisedButton tone="white" label="Back to the race" onPress={onClose} style={styles.sheetCta} /> : null}
          {working && !sending ? (
            // The check runs on the server either way; the answer also arrives on the map screen.
            <PressScale accessibilityRole="button" style={styles.minimize} onPress={onClose}>
              <Text style={styles.minimizeText}>Back to the map</Text>
            </PressScale>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

/** How a course counts, in the order it is walked: one or two digits, and the finish stretch where there is one. */
export const helpRules = (course: { digits: unknown[]; finish?: unknown[] | null }, practice = false) => {
  const two = course.digits.length > 1;
  return [
    "Start at the flag. Your walk counts from there.",
    two ? "Walk the gold digit first, then follow the dashed link to the green digit." : "Walk the gold digit, corner to corner.",
    "Cover each digit's streets and pass every corner. Nearly all of it is needed.",
    ...(course.finish?.length ? ["Then walk the solid line to the checkered flag. It makes every course the same length."] : []),
    "Pauses and lost GPS never fill in a gap. Walking faster than a dog walk doesn't count.",
    practice ? "When you reach the end, hand in. PAWS checks it the same way as a race." : two ? "When both digits are done, hand in. The first walk PAWS checks wins." : "When the digit is done, hand in. The first walk PAWS checks wins.",
  ];
};

export const HelpSheet = ({ visible, rules, onClose }: { visible: boolean; rules: string[]; onClose: () => void }) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>How it counts</Text>
            <PressScale accessibilityRole="button" accessibilityLabel="Close" style={styles.close} onPress={onClose}>
              <XIcon size={18} color={text.primary} weight="bold" />
            </PressScale>
          </View>
          {rules.map((r, i) => (
            <View key={r} style={styles.rule}>
              <Text style={styles.ruleNum}>{i + 1}</Text>
              <Text style={styles.ruleText}>{r}</Text>
            </View>
          ))}
          <Text style={styles.ruleSafety}>{SAFETY_LINE}</Text>
        </View>
      </View>
    </Modal>
  );
};

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: bg.subtle },
  flexOnly: { flex: 1 },
  hud: { position: "absolute", left: space.md, right: space.md, flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: 22, backgroundColor: bg.surface, borderWidth: 1, borderColor: border.soft, shadowColor: "#1C1B1A", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  hudNumber: { alignItems: "center", paddingRight: space.md, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: border.default },
  hudEyebrow: { fontSize: 9, fontWeight: "800", letterSpacing: 1.4, color: text.tertiary, marginBottom: 2 },
  hudStage: { fontSize: 17, fontWeight: "800", color: text.primary, letterSpacing: -0.2 },
  hudPhase: { ...type.caption, color: text.secondary, marginTop: 1 },
  hudRight: { alignItems: "flex-end", gap: 4 },
  hudClock: { fontSize: 15, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  banner: { position: "absolute", left: space.lg, right: space.lg, flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: bg.surface, borderWidth: 1, borderColor: border.soft },
  bannerWarn: { backgroundColor: accent.deep, borderColor: accent.band },
  bannerText: { fontSize: 14, fontWeight: "700", color: text.primary, flex: 1 },
  moment: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: space.sm, paddingLeft: 8, paddingRight: space.lg, height: 48, borderRadius: radius.pill, backgroundColor: text.primary },
  momentCheck: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#2F8F4E", alignItems: "center", justifyContent: "center" },
  momentText: { fontSize: 15, fontWeight: "800", color: text.inverse },
  controls: { position: "absolute", right: space.md, gap: space.sm },
  mapButton: { width: 48, height: 48, borderRadius: 16, backgroundColor: bg.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: border.soft },
  mapDigit: { fontSize: 20, fontWeight: "900" },
  panel: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space.lg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: bg.surface, gap: 10, shadowColor: "#1C1B1A", shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  rowLabel: { width: 64, fontSize: 14, fontWeight: "800", color: text.primary },
  track: { flex: 1, height: 12, borderRadius: 6, backgroundColor: bg.subtle, overflow: "hidden" },
  trackThin: { height: 6, borderRadius: 3 },
  ghost: { position: "absolute", left: 0, top: 0, bottom: 0, opacity: 0.25 },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, right: 0, transformOrigin: "left" },
  rowEnd: { width: 40, alignItems: "flex-end" },
  rowPct: { fontSize: 13, fontWeight: "800", color: text.secondary, fontVariant: ["tabular-nums"] },
  checkedNote: { ...type.caption, color: text.secondary },
  handIn: { marginTop: 4 },
  actions: { flexDirection: "row", gap: space.sm, marginTop: 4 },
  action: { flex: 1, height: 58, borderRadius: 16, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center", gap: 2 },
  actionText: { fontSize: 12, fontWeight: "800", color: text.primary },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28,27,26,0.32)" },
  sheet: { paddingHorizontal: space.xxl, paddingTop: space.xl, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: bg.surface },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  sheetTitle: { fontSize: 24, lineHeight: 29, fontWeight: "800", letterSpacing: -0.4, color: text.primary, marginTop: space.lg },
  sheetBody: { ...type.body, color: text.secondary, marginTop: space.sm },
  working: { alignItems: "center", marginTop: space.xl, marginBottom: space.md },
  sheetCta: { marginTop: space.xl },
  minimize: { alignSelf: "center", marginTop: space.sm, paddingVertical: space.sm, paddingHorizontal: space.lg },
  minimizeText: { ...type.supporting, fontWeight: "700", color: text.secondary },
  rule: { flexDirection: "row", gap: space.md, marginTop: space.md },
  ruleNum: { width: 22, fontSize: 15, fontWeight: "900", color: accent.band },
  ruleText: { ...type.body, color: text.primary, flex: 1 },
  ruleSafety: { ...type.caption, color: text.secondary, marginTop: space.lg },
});
