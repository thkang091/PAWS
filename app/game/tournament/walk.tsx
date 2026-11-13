import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, useAnimatedStyle, useReducedMotion, withTiming } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { CellSignalLowIcon, FlagIcon, NavigationArrowIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { TerritoryMap } from "@/features/tournament/components/TerritoryMap";
import { TournamentRulesModal } from "@/features/tournament/components/TournamentRulesModal";
import { ISSUE_TEXT, errorText, formatArea, formatDistance, formatDuration } from "@/features/tournament/format";
import { useTerritoryWalk } from "@/features/tournament/gps/useTerritoryWalk";
import { tournamentKeys } from "@/hooks/useTournaments";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { GPS_RULES, RECOVERABLE, evaluateTerritory, type Territory, type TerritoryIssue } from "../../../supabase/functions/tournament/geo";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

type Review = { territory: Territory; serverIssues?: TerritoryIssue[]; recoverable: boolean };

/**
 * The walk itself. The map fills the screen; the numbers that matter sit on top; the two big buttons sit where a
 * thumb finds them without looking. Finish opens a review of the territory before anything is sent.
 */
export default function TerritoryWalkScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const dog = useCurrentDog();
  const w = useTerritoryWalk({ tournamentId: id, dogId: dog.data?.id ?? null });
  const [briefing, setBriefing] = useState(true);
  const [review, setReview] = useState<Review | null>(null);
  const [claiming, setClaiming] = useState(false);

  const walking = w.phase === "tracking" || w.phase === "paused" || w.phase === "submitting";
  const canClose = w.distanceM >= GPS_RULES.minDistanceM;
  const atStart = canClose && w.preview.closureM <= GPS_RULES.closureM;

  // A buzz when the loop can close, so nobody has to watch the screen for it.
  const wasAtStart = useRef(false);
  useEffect(() => {
    if (atStart && !wasAtStart.current) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    wasAtStart.current = atStart;
  }, [atStart]);

  const start = async () => {
    setBriefing(false);
    await w.begin();
  };

  const finish = () => {
    if (w.phase === "tracking") w.pause();
    // The full check, crossing included, before anything goes to the server.
    const territory = evaluateTerritory(w.points);
    setReview({ territory, recoverable: territory.issues.every((i) => RECOVERABLE.includes(i)) });
  };

  const claim = async () => {
    setClaiming(true);
    const reply = await w.finish();
    setClaiming(false);
    if (!reply) return;
    if (reply.status === "recorded") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void queryClient.invalidateQueries({ queryKey: tournamentKeys.all });
      router.replace({
        pathname: "/game/tournament/result",
        params: { submissionId: reply.submissionId, tournamentId: id ?? "", rank: reply.rank ? String(reply.rank) : "", total: reply.total ? String(reply.total) : "" },
      });
      return;
    }
    setReview((r) => (r ? { ...r, serverIssues: reply.issues as TerritoryIssue[], recoverable: reply.recoverable } : r));
  };

  const keepWalking = () => {
    setReview(null);
    if (w.phase === "paused") w.resume();
  };

  const endWalk = () =>
    Alert.alert("End this walk?", "Your route will be deleted and no territory is claimed.", [
      { text: "Keep walking", style: "cancel" },
      {
        text: "End walk",
        style: "destructive",
        onPress: () => {
          void w.cancel().then(() => router.back());
        },
      },
    ]);

  const close = () => (walking ? endWalk() : router.back());

  const outline = useMemo(() => {
    const ring = review?.territory.ring ?? [];
    // Only a walk that really closes is filled in; an open one is never drawn shut with a made-up straight edge.
    return review && review.territory.ok && !review.serverIssues?.length ? ring.map(([longitude, latitude]) => ({ latitude, longitude })) : null;
  }, [review]);

  const issues = review ? review.serverIssues ?? review.territory.issues : [];
  const blocked = w.access === "denied" || w.access === "blocked";

  return (
    <View style={styles.screen}>
      <TerritoryMap
        segments={w.segments}
        start={w.start}
        position={w.position}
        outline={outline}
        showFinishRing={canClose && !review}
        follow={walking && !review}
        topInset={insets.top + 150}
        bottomInset={review ? 360 : 200}
      />

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.topRow}>
          <PressScale accessibilityRole="button" accessibilityLabel={walking ? "End walk" : "Close"} style={styles.round} onPress={close}>
            <XIcon size={20} color={text.primary} weight="bold" />
          </PressScale>
          {walking ? <StatusChip paused={w.phase === "paused"} offline={w.offline} /> : <View />}
          <View style={styles.roundSpacer} />
        </View>

        {walking ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)} style={styles.stats}>
            <Stat label="Distance" value={formatDistance(w.distanceM)} />
            <View style={styles.statRule} />
            <Stat label="Time" value={formatDuration(w.activeMs)} />
            <View style={styles.statRule} />
            <Stat label="Area" value={atStart ? formatArea(w.preview.areaM2) : "-"} />
          </Animated.View>
        ) : null}

        {walking && w.warning ? (
          <Animated.View entering={FadeIn.duration(motion.duration.select)} exiting={FadeOut.duration(motion.duration.exit)} style={styles.warning}>
            <CellSignalLowIcon size={18} color={text.primary} weight="bold" />
            <Text style={styles.warningText}>{w.warning === "no_signal" ? "Looking for GPS. Head somewhere open." : "Weak GPS. Those steps won't count."}</Text>
          </Animated.View>
        ) : null}
        {w.pausedByApp && w.phase === "paused" ? (
          <View style={styles.warning}>
            <Text style={styles.warningText}>Paused when you left PAWS. Resume where you stopped.</Text>
          </View>
        ) : null}
      </View>

      {!walking && !briefing ? (
        <View style={[styles.idle, { paddingBottom: insets.bottom + space.lg }]}>
          {w.phase === "starting" ? <Text style={styles.idleTitle}>Finding you</Text> : null}
          {blocked ? (
            <>
              <Text style={styles.idleTitle}>Location is off for PAWS</Text>
              <Text style={styles.idleLine}>The territory is drawn from your walk, so PAWS needs your location while this screen is open.</Text>
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

      {walking && !review ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}>
          <Proximity distanceM={w.distanceM} closureM={w.preview.closureM} atStart={atStart} />
          {w.error ? <Text style={styles.inlineError}>{errorText(w.error)}</Text> : null}
          <View style={styles.controls}>
            <RaisedButton
              tone="white"
              height={64}
              label={w.phase === "paused" ? "Resume" : "Pause"}
              onPress={() => (w.phase === "paused" ? w.resume() : w.pause())}
              style={styles.flex}
            />
            <RaisedButton height={64} label="Finish" icon={<FlagIcon size={20} color={text.primary} weight="fill" />} onPress={finish} style={styles.flex} />
          </View>
        </View>
      ) : null}

      {review ? (
        <Animated.View entering={reduceMotion ? FadeIn : SlideInDown.duration(motion.duration.reveal).easing(motion.easing.drawer)} style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          {issues.length === 0 ? (
            <>
              <Text style={styles.sheetEyebrow}>YOUR TERRITORY</Text>
              <Text style={styles.area}>{formatArea(review.territory.areaM2)}</Text>
              <Text style={styles.sheetLine}>{`${formatDistance(review.territory.distanceM)} walked in ${formatDuration(w.activeMs)}. PAWS checks it again on the server before it counts.`}</Text>
              {w.error ? <Text style={styles.inlineError}>{errorText(w.error)}</Text> : null}
              <RaisedButton label="Claim territory" busy={claiming || w.phase === "submitting"} onPress={() => void claim()} />
              <RaisedButton tone="white" label="Keep walking" onPress={keepWalking} />
            </>
          ) : (
            <>
              <Text style={styles.sheetEyebrow}>{review.recoverable ? "NOT CLOSED YET" : "CAN'T CLAIM THIS WALK"}</Text>
              <Text style={styles.sheetTitle}>{ISSUE_TEXT[issues[0]]}</Text>
              {issues[0] === "not_closed" ? <Text style={styles.sheetLine}>{`About ${Math.round(review.territory.closureM)} m from the start.`}</Text> : null}
              {issues[0] === "too_short" ? <Text style={styles.sheetLine}>{`${formatDistance(review.territory.distanceM)} so far.`}</Text> : null}
              {review.recoverable ? <RaisedButton label="Keep walking" onPress={keepWalking} /> : null}
              <RaisedButton tone="white" label="End without a score" onPress={endWalk} />
            </>
          )}
        </Animated.View>
      ) : null}

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

const StatusChip = ({ paused, offline }: { paused: boolean; offline: boolean }) => (
  <View style={styles.chip}>
    <View style={[styles.chipDot, paused && styles.chipDotPaused]} />
    <Text style={styles.chipText}>{paused ? "Paused" : offline ? "Walking, saved on phone" : "Walking"}</Text>
  </View>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

/** Where you stand on closing the loop: walk further, head back, or you're there. */
const Proximity = ({ distanceM, closureM, atStart }: { distanceM: number; closureM: number; atStart: boolean }) => {
  const need = GPS_RULES.minDistanceM;
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: withTiming(Math.min(1, distanceM / need), { duration: 300 }) }] }), [distanceM]);
  if (distanceM < need) {
    return (
      <View style={styles.prox}>
        <Text style={styles.proxText}>{`Walk ${Math.ceil(need - distanceM)} m more to make a territory`}</Text>
        <View style={styles.proxTrack}>
          <Animated.View style={[styles.proxFill, fill]} />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.prox, styles.proxRow, atStart && styles.proxHome]}>
      {atStart ? <FlagIcon size={18} color={text.primary} weight="fill" /> : <NavigationArrowIcon size={18} color={text.primary} weight="fill" />}
      <Text style={styles.proxText}>{atStart ? "Back at the start. Finish to claim it." : `Start is ${Math.round(closureM)} m away`}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.stage },
  flex: { flex: 1 },
  top: { position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: space.lg, gap: space.sm },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: bg.surface, alignItems: "center", justifyContent: "center", shadowColor: "#1C1B1A", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  roundSpacer: { width: 44 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: bg.surface },
  chipDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2F8F4E" },
  chipDotPaused: { backgroundColor: accent.band },
  chipText: { fontSize: 13, fontWeight: "700", color: text.primary },
  stats: { flexDirection: "row", alignItems: "center", paddingVertical: space.md, borderRadius: 22, backgroundColor: bg.surface, shadowColor: "#1C1B1A", shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.caption, color: text.secondary },
  statRule: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: border.default },
  warning: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: 14, backgroundColor: accent.deep },
  warningText: { ...type.supporting, fontWeight: "700", color: text.primary, flex: 1 },

  bottom: { position: "absolute", left: space.lg, right: space.lg, bottom: 0, gap: space.md },
  controls: { flexDirection: "row", gap: space.md },
  prox: { padding: space.md, borderRadius: 18, backgroundColor: bg.surface, gap: space.sm },
  proxRow: { flexDirection: "row", alignItems: "center" },
  proxHome: { backgroundColor: accent.deep },
  proxText: { ...type.supporting, fontWeight: "700", color: text.primary },
  proxTrack: { height: 6, borderRadius: 3, backgroundColor: bg.subtle, overflow: "hidden" },
  proxFill: { height: 6, borderRadius: 3, backgroundColor: accent.band, transformOrigin: "left" },
  inlineError: { ...type.supporting, color: "#B4442C" },

  idle: { position: "absolute", left: space.lg, right: space.lg, bottom: 0, gap: space.md, padding: space.xl, borderRadius: 28, backgroundColor: bg.surface },
  idleTitle: { ...type.sectionTitle, fontWeight: "700", color: text.primary },
  idleLine: { ...type.supporting, color: text.secondary },

  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, gap: space.md, paddingHorizontal: space.xxl, paddingTop: space.xxl, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: bg.surface },
  sheetEyebrow: { ...type.eyebrow, color: text.tertiary },
  sheetTitle: { ...type.sectionTitle, fontWeight: "700", color: text.primary },
  sheetLine: { ...type.supporting, color: text.secondary },
  area: { fontSize: 44, lineHeight: 50, fontWeight: "800", letterSpacing: -1.2, color: text.primary, fontVariant: ["tabular-nums"] },
  dim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(28,27,26,0.4)", justifyContent: "flex-end" },
  restore: { margin: space.lg, padding: space.xl, gap: space.md, borderRadius: 28, backgroundColor: bg.surface },
});
