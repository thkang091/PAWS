import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, useAnimatedStyle, useReducedMotion, withTiming } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { ArrowsOutSimpleIcon, CellSignalLowIcon, FlagIcon, SignpostIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { ShapeGlyph } from "@/features/tournament/components/ShapeGlyph";
import { TerritoryMap } from "@/features/tournament/components/TerritoryMap";
import { TournamentRulesModal } from "@/features/tournament/components/TournamentRulesModal";
import { SHAPE_ISSUE_TEXT, errorText, formatDistance, formatDuration, formatPoints } from "@/features/tournament/format";
import { useTerritoryWalk } from "@/features/tournament/gps/useTerritoryWalk";
import { shapeChoices } from "@/features/tournament/shapeFlow";
import { tournamentKeys } from "@/hooks/useTournaments";
import { getAssignedRoute, getOpenAssignment } from "@/services/tournamentService";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { DEFAULT_SHAPE_RULES, matchShape, type ShapeMatch } from "../../../supabase/functions/tournament/shape";
import { nearestOnRoute, offRoute, routeProgress, scoreRouteWalk } from "../../../supabase/functions/tournament/routeScore";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

/** A quicker estimate while walking; the official score uses the full rules on the server. */
const PREVIEW_RULES = { ...DEFAULT_SHAPE_RULES, samples: 32 };

/**
 * Walking a shape along the route you picked. The map shows the route (from the real pedestrian network) under your
 * own line as you go; the target sits in a small card you can open up. Route progress and the match are estimates;
 * only the server's score counts.
 */
export default function ShapeWalkScreen() {
  useKeepAwake();
  const params = useLocalSearchParams<{ id?: string; assignment?: string }>();
  const id = params.id;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const dog = useCurrentDog();
  // A walk always follows a picked route. Coming back to an open walk finds its route on the server.
  const open = useQuery({ queryKey: ["openAssignment", id], queryFn: () => getOpenAssignment(id ?? ""), enabled: Boolean(id && !params.assignment) });
  const assignmentId = params.assignment || open.data?.id || null;
  const assigned = useQuery({ queryKey: ["assignedRoute", assignmentId], queryFn: () => getAssignedRoute(assignmentId ?? ""), enabled: Boolean(assignmentId), staleTime: Infinity });
  useEffect(() => {
    if (!params.assignment && open.isSuccess && !open.data) router.replace({ pathname: "/game/tournament/shapes", params: { id: id ?? "" } });
  }, [open.isSuccess, open.data, params.assignment, id]);
  const legs = useMemo(() => assigned.data?.legs ?? [], [assigned.data]);
  const routeLine = useMemo(() => legs.flatMap((l, i) => l.coords.slice(i ? 1 : 0).map(([lng, lat]) => ({ latitude: lat, longitude: lng }))), [legs]);
  const preset = shapeChoices().find((c) => c.key === assigned.data?.shapeKey) ?? null;
  const shape = preset ? { name: preset.name, closed: preset.closed, minDistanceM: preset.minDistanceM, points: preset.points } : null;
  const w = useTerritoryWalk({ tournamentId: id, dogId: dog.data?.id ?? null, assignmentId });
  const [briefing, setBriefing] = useState(true);
  const [big, setBig] = useState(false);
  const [review, setReview] = useState<{ match: ShapeMatch; serverIssues?: string[]; recoverable: boolean; estimate?: number | null } | null>(null);
  const [handing, setHanding] = useState(false);

  const walking = w.phase === "tracking" || w.phase === "paused" || w.phase === "submitting";
  const target = useMemo(() => (shape ? { closed: shape.closed, minDistanceM: shape.minDistanceM, points: shape.points } : null), [shape]);

  // Re-estimated every dozen points (about a minute of walking), not on every fix.
  const estimateKey = Math.floor(w.points.length / 12);
  const estimate = useMemo(() => (target && w.points.length >= 12 ? matchShape(w.points, target, PREVIEW_RULES) : null), [estimateKey, target]);
  const needM = shape ? Math.max(0, shape.minDistanceM - w.distanceM) : 0;
  // Route progress every few fixes, with the same rules the server scores by.
  const progressKey = Math.floor(w.points.length / 4);
  const progress = useMemo(() => (legs.length ? routeProgress(w.points, legs) : null), [progressKey, legs]); // eslint-disable-line react-hooks/exhaustive-deps
  const off = useMemo(() => (legs.length && w.phase === "tracking" ? offRoute(w.points, legs) : { off: false, distanceM: 0 }), [w.points.length, legs, w.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const returnPoint = off.off && w.position ? nearestOnRoute(w.position, legs) : null;
  useEffect(() => {
    if (off.off) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [off.off]);

  const start = async () => {
    setBriefing(false);
    await w.begin();
  };

  const finish = () => {
    if (!target) return;
    if (w.phase === "tracking") w.pause();
    const match = matchShape(w.points, target);
    const route = progress ? scoreRouteWalk(match.score, progress) : null;
    const issues = [...match.issues, ...(match.ok && route && !route.ok ? route.issues : [])];
    setReview({ match, serverIssues: issues.length ? issues : undefined, recoverable: issues.every((i) => i === "too_short" || i === "too_few_points" || i.startsWith("route_")), estimate: route?.ok ? route.final : null });
  };

  const handIn = async () => {
    setHanding(true);
    const reply = await w.finish();
    setHanding(false);
    if (!reply) return;
    if (reply.status === "recorded") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void queryClient.invalidateQueries({ queryKey: tournamentKeys.all });
      router.replace({ pathname: "/game/tournament/shape-result", params: { submissionId: reply.submissionId, rank: reply.rank ? String(reply.rank) : "", total: reply.total ? String(reply.total) : "" } });
      return;
    }
    setReview((r) => (r ? { ...r, serverIssues: reply.issues, recoverable: reply.recoverable } : r));
  };

  const keepWalking = () => {
    setReview(null);
    if (w.phase === "paused") w.resume();
  };

  const endWalk = () =>
    Alert.alert("End this walk?", "Your route will be deleted and nothing is handed in.", [
      { text: "Keep walking", style: "cancel" },
      { text: "End walk", style: "destructive", onPress: () => void w.cancel().then(() => router.back()) },
    ]);

  const issues = review ? review.serverIssues ?? review.match.issues : [];
  const blocked = w.access === "denied" || w.access === "blocked";

  return (
    <View style={styles.screen}>
      <TerritoryMap segments={w.segments} start={w.start} position={w.position} follow={walking && !review} topInset={insets.top + 150} bottomInset={review ? 380 : 200} route={routeLine} returnPoint={returnPoint} />

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.topRow}>
          <PressScale accessibilityRole="button" accessibilityLabel={walking ? "End walk" : "Close"} style={styles.round} onPress={() => (walking ? endWalk() : router.back())}>
            <XIcon size={20} color={text.primary} weight="bold" />
          </PressScale>
          {walking ? (
            <View style={styles.chip}>
              <View style={[styles.chipDot, w.phase === "paused" && styles.chipDotPaused]} />
              <Text style={styles.chipText}>{w.phase === "paused" ? "Paused" : w.offline ? "Walking, saved on phone" : "Walking"}</Text>
            </View>
          ) : (
            <View />
          )}
          <View style={styles.roundSpacer} />
        </View>
        {walking ? (
          <View style={styles.stats}>
            <Stat label="Distance" value={formatDistance(w.distanceM)} />
            <View style={styles.statRule} />
            <Stat label="Time" value={formatDuration(w.activeMs)} />
            <View style={styles.statRule} />
            <Stat label="Route" value={progress ? `${Math.round(progress.completion * 100)}%` : "-"} />
            <View style={styles.statRule} />
            <Stat label="Est. match" value={estimate && estimate.ok ? formatPoints(estimate.score) : "-"} />
          </View>
        ) : null}
        {walking && off.off && !w.warning ? (
          <Animated.View entering={FadeIn.duration(motion.duration.select)} exiting={FadeOut.duration(motion.duration.exit)} style={styles.warning} accessibilityRole="alert">
            <SignpostIcon size={18} color={text.primary} weight="fill" />
            <Text style={styles.warningText}>{`About ${off.distanceM} m off your route. The orange dot is the nearest point on it; get back by public paths.`}</Text>
          </Animated.View>
        ) : null}
        {walking && w.warning ? (
          <Animated.View entering={FadeIn.duration(motion.duration.select)} exiting={FadeOut.duration(motion.duration.exit)} style={styles.warning}>
            <CellSignalLowIcon size={18} color={text.primary} weight="bold" />
            <Text style={styles.warningText}>{w.warning === "no_signal" ? "Looking for GPS. Head somewhere open." : "Weak GPS. Those steps won't count."}</Text>
          </Animated.View>
        ) : null}
      </View>

      {walking && shape && !review ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.row}>
            <PressScale accessibilityRole="button" accessibilityLabel={`Target: ${shape.name}. Tap to enlarge`} style={styles.mini} onPress={() => setBig(true)}>
              <ShapeGlyph points={shape.points} closed={shape.closed} size={76} strokeWidth={3} />
              <View style={styles.miniCorner}>
                <ArrowsOutSimpleIcon size={12} color={text.primary} weight="bold" />
              </View>
            </PressScale>
            <Progress needM={needM} minM={shape.minDistanceM} name={shape.name} completion={progress?.completion ?? 0} />
          </View>
          {w.error ? <Text style={styles.inlineError}>{errorText(w.error)}</Text> : null}
          <View style={styles.controls}>
            <RaisedButton tone="white" height={64} label={w.phase === "paused" ? "Resume" : "Pause"} onPress={() => (w.phase === "paused" ? w.resume() : w.pause())} style={styles.flex} />
            <RaisedButton height={64} label="Finish" icon={<FlagIcon size={20} color={text.primary} weight="fill" />} onPress={finish} style={styles.flex} />
          </View>
        </View>
      ) : null}

      {!walking && !briefing ? (
        <View style={[styles.idle, { paddingBottom: insets.bottom + space.lg }]}>
          {w.phase === "starting" ? <Text style={styles.idleTitle}>Finding you</Text> : null}
          {blocked ? (
            <>
              <Text style={styles.idleTitle}>Location is off for PAWS</Text>
              <Text style={styles.idleLine}>Your shape is drawn from your walk, so PAWS needs your location while this screen is open.</Text>
              {w.access === "blocked" ? <RaisedButton label="Open Settings" onPress={() => void Linking.openSettings()} /> : <RaisedButton label="Try again" onPress={() => void start()} />}
            </>
          ) : w.error ? (
            <>
              <Text style={styles.idleLine}>{errorText(w.error)}</Text>
              <RaisedButton label="Try again" onPress={() => void start()} />
            </>
          ) : null}
        </View>
      ) : null}

      {review && shape ? (
        <Animated.View entering={reduceMotion ? FadeIn : SlideInDown.duration(motion.duration.reveal).easing(motion.easing.drawer)} style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.reviewTop}>
            <View style={styles.compare}>
              <ShapeGlyph points={review.match.target.length ? review.match.target : shape.points} closed={shape.closed} route={review.match.route} size={120} strokeWidth={3} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.sheetEyebrow}>{issues.length ? "NOT READY YET" : "ESTIMATED SCORE"}</Text>
              {issues.length ? (
                <Text style={styles.sheetTitle}>{SHAPE_ISSUE_TEXT[issues[0] as keyof typeof SHAPE_ISSUE_TEXT] ?? "This walk can't be scored."}</Text>
              ) : (
                <Text style={styles.score}>{formatPoints(review.estimate ?? review.match.score)}</Text>
              )}
              <Text style={styles.sheetLine}>{`${formatDistance(review.match.distanceM)} walked`}</Text>
            </View>
          </View>
          {!issues.length ? <Text style={styles.sheetLine}>{`Shape ${formatPoints(review.match.score)}, route ${progress ? Math.round(progress.completion * 100) : 0}% walked. PAWS scores it again on the server.`}</Text> : null}
          {w.error ? <Text style={styles.inlineError}>{errorText(w.error)}</Text> : null}
          {!issues.length ? <RaisedButton label="Hand in my shape" busy={handing || w.phase === "submitting"} onPress={() => void handIn()} /> : null}
          {review.recoverable || !issues.length ? <RaisedButton tone={issues.length ? "yellow" : "white"} label="Keep walking" onPress={keepWalking} /> : null}
          {issues.length && !review.recoverable ? <RaisedButton tone="white" label="End without a score" onPress={endWalk} /> : null}
        </Animated.View>
      ) : null}

      <Modal visible={big} transparent animationType="fade" onRequestClose={() => setBig(false)}>
        <Pressable style={styles.bigScrim} accessibilityLabel="Close" onPress={() => setBig(false)}>
          {shape ? (
            <View style={styles.bigCard}>
              <Text style={styles.bigTitle}>{shape.name}</Text>
              <ShapeGlyph points={estimate?.target.length ? estimate.target : shape.points} closed={shape.closed} route={estimate?.route.length ? estimate.route : null} size={260} strokeWidth={5} />
              <Text style={styles.sheetLine}>{estimate?.route.length ? "Dashed: the target. Solid: your walk so far, turned to fit." : "Any size, anywhere, facing any way."}</Text>
            </View>
          ) : null}
        </Pressable>
      </Modal>

      <TournamentRulesModal visible={w.checked && briefing && !walking && !w.restorable} safetyOnly onClose={() => router.back()} onStart={() => void start()} />
      {w.restorable && briefing ? (
        <View style={styles.dim}>
          <View style={styles.restore}>
            <Text style={styles.sheetTitle}>You have a walk in progress</Text>
            <Text style={styles.sheetLine}>{`${w.restorable.points.length} points saved on this phone. Pick it up where you left off.`}</Text>
            <RaisedButton label="Continue walk" onPress={() => void start()} />
            <RaisedButton tone="white" label="End it" onPress={() => void w.cancel()} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const Progress = ({ needM, minM, name, completion }: { needM: number; minM: number; name: string; completion: number }) => {
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: withTiming(Math.min(1, completion), { duration: 300 }) }] }), [completion]);
  const line = needM > 0 ? `Walk ${Math.ceil(needM)} m more to count` : completion < 0.5 ? "Cover at least half the route" : `Finish when your ${name.toLowerCase()} is done`;
  return (
    <View style={styles.progress}>
      <Text style={styles.progressText}>{line}</Text>
      <View style={styles.track} accessible accessibilityLabel={`Route ${Math.round(completion * 100)} percent walked. Minimum ${minM} metres.`}>
        <Animated.View style={[styles.trackFill, fill]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.stage },
  flex: { flex: 1 },
  top: { position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: space.lg, gap: space.sm },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: bg.surface, alignItems: "center", justifyContent: "center" },
  roundSpacer: { width: 44 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: bg.surface },
  chipDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2F8F4E" },
  chipDotPaused: { backgroundColor: accent.band },
  chipText: { fontSize: 13, fontWeight: "700", color: text.primary },
  stats: { flexDirection: "row", alignItems: "center", paddingVertical: space.md, borderRadius: 22, backgroundColor: bg.surface },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.caption, color: text.secondary },
  statRule: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: border.default },
  warning: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: 14, backgroundColor: accent.deep },
  warningText: { ...type.supporting, fontWeight: "700", color: text.primary, flex: 1 },
  bottom: { position: "absolute", left: space.lg, right: space.lg, bottom: 0, gap: space.md },
  row: { flexDirection: "row", gap: space.sm, alignItems: "stretch" },
  mini: { width: 88, height: 88, borderRadius: 20, backgroundColor: bg.surface, alignItems: "center", justifyContent: "center" },
  miniCorner: { position: "absolute", right: 6, top: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center" },
  progress: { flex: 1, justifyContent: "center", padding: space.md, borderRadius: 20, backgroundColor: bg.surface, gap: space.sm },
  progressText: { ...type.supporting, fontWeight: "700", color: text.primary },
  track: { height: 6, borderRadius: 3, backgroundColor: bg.subtle, overflow: "hidden" },
  trackFill: { height: 6, borderRadius: 3, backgroundColor: accent.band, transformOrigin: "left" },
  controls: { flexDirection: "row", gap: space.md },
  inlineError: { ...type.supporting, color: "#B4442C" },
  idle: { position: "absolute", left: space.lg, right: space.lg, bottom: 0, gap: space.md, padding: space.xl, borderRadius: 28, backgroundColor: bg.surface },
  idleTitle: { ...type.sectionTitle, fontWeight: "700", color: text.primary },
  idleLine: { ...type.supporting, color: text.secondary },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, gap: space.md, paddingHorizontal: space.xxl, paddingTop: space.xxl, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: bg.surface },
  reviewTop: { flexDirection: "row", gap: space.lg, alignItems: "center" },
  compare: { width: 120, height: 120, borderRadius: 20, backgroundColor: accent.soft, alignItems: "center", justifyContent: "center" },
  sheetEyebrow: { ...type.eyebrow, color: text.tertiary },
  sheetTitle: { ...type.cardTitle, fontSize: 17, fontWeight: "700", color: text.primary, marginTop: 4 },
  sheetLine: { ...type.supporting, color: text.secondary },
  score: { fontSize: 44, lineHeight: 50, fontWeight: "800", letterSpacing: -1.2, color: text.primary, fontVariant: ["tabular-nums"] },
  bigScrim: { flex: 1, backgroundColor: "rgba(28,27,26,0.45)", alignItems: "center", justifyContent: "center", padding: space.xxl },
  bigCard: { alignItems: "center", gap: space.md, padding: space.xl, borderRadius: 28, backgroundColor: bg.surface },
  bigTitle: { ...type.sectionTitle, fontWeight: "700", color: text.primary },
  dim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(28,27,26,0.4)", justifyContent: "flex-end" },
  restore: { margin: space.lg, padding: space.xl, gap: space.md, borderRadius: 28, backgroundColor: bg.surface },
});
