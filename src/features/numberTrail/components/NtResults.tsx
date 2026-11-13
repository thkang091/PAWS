import { useEffect, useState } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Svg, { Line } from "react-native-svg";
import { CrownSimpleIcon, ShareNetworkIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { CourseMap } from "@/features/numberTrail/components/CourseMap";
import { NumberGlyph } from "@/features/numberTrail/components/NumberGlyph";
import { Avatar, DigitDots } from "@/features/numberTrail/components/RacePieces";
import { RESULT_LINES, numberErrorText } from "@/features/numberTrail/raceCopy";
import { resultsView } from "@/features/numberTrail/raceView";
import { NT } from "@/features/numberTrail/theme";
import { playNumberRaceAgain, type RaceState } from "@/services/numberRaceService";
import type { OwnProgress } from "../../../../supabase/functions/tournament/numberMatch";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const clock = (ms: number | null) => {
  if (ms == null) return null;
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** A few rays behind the winner's number, once. Reduced motion: none. */
const Burst = () => (
  <Svg width={260} height={160} viewBox="-130 -80 260 160" style={StyleSheet.absoluteFill as never} pointerEvents="none">
    {Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return <Line key={i} x1={Math.cos(a) * 100} y1={Math.sin(a) * 62} x2={Math.cos(a) * 124} y2={Math.sin(a) * 77} stroke={i % 2 ? NT.two : accent.band} strokeWidth={4} strokeLinecap="round" opacity={0.5} />;
    })}
  </Svg>
);

/**
 * The official result, from the server's placements only: the winner, everyone's place in the order the server
 * received verified finishes, and your own result with the course. Celebrates once per match on this phone.
 */
export const NtResults = ({ state, celebrate, walkedM, onChanged }: { state: RaceState; celebrate: boolean; walkedM: number; onChanged: () => void }) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const r = resultsView(state);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = r.rows.find((x) => x.isMe) ?? null;
  const iWon = Boolean(mine?.isWinner);
  const number = state.match.number ?? "--";
  const progress = state.me.progress && "edges" in state.me.progress ? (state.me.progress as unknown as OwnProgress) : null;
  const animate = celebrate && !reduceMotion;
  useEffect(() => {
    if (celebrate) void Haptics.notificationAsync(iWon ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
  }, [celebrate, iWon]);

  const headline = r.outcome === "no_finisher" ? RESULT_LINES.noFinisher : iWon ? RESULT_LINES.won : r.winner ? RESULT_LINES.winner(r.winner.name) : "Results";
  const share = () => {
    // Text only: a place and a number, never a route or a location.
    const line = mine?.finished ? `I finished Number Trail ${number} in ${ordinal(mine.placement)} place on PAWS.` : `We raced Number Trail ${number} on PAWS. ${headline}.`;
    void Share.share({ message: line });
  };
  const again = async () => {
    setBusy(true);
    setError(null);
    try {
      await playNumberRaceAgain(state.room.id, { minutes: state.match.minutes, difficulty: state.match.difficulty });
      onChanged();
    } catch (e) {
      setError(numberErrorText((e as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + space.xl, paddingBottom: 170 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {animate && r.outcome === "winner" ? (
            <Animated.View entering={ZoomIn.delay(200).duration(motion.duration.flourish).easing(motion.easing.out).withInitialValues({ transform: [{ scale: 0.8 }] })} style={styles.burst}>
              <Burst />
            </Animated.View>
          ) : null}
          <NumberGlyph value={number} height={104} draw={animate} stroke={0.27} />
        </View>
        <Animated.Text entering={animate ? FadeInDown.delay(700).duration(motion.duration.enter).easing(motion.easing.out) : undefined} style={styles.headline} accessibilityRole="header">
          {headline}
        </Animated.Text>
        {r.photoFinish ? <Text style={styles.photo}>{RESULT_LINES.photoFinish}</Text> : null}
        {!r.final ? <Text style={styles.settling}>{RESULT_LINES.settling}</Text> : null}

        {mine ? (
          <Animated.View entering={animate ? FadeInDown.delay(820).duration(motion.duration.enter).easing(motion.easing.out) : undefined} style={styles.mine}>
            <View style={styles.mineTop}>
              <View>
                <Text style={styles.minePlace}>{ordinal(mine.placement)}</Text>
                <Text style={styles.mineLabel}>your place</Text>
              </View>
              <View style={styles.mineStatus}>
                <Text style={[styles.badge, mine.finished ? styles.badgeOk : styles.badgeNo]}>{mine.finished ? "Verified finish" : "Not finished"}</Text>
              </View>
            </View>
            <View style={styles.facts}>
              <Fact label="Number" value={number} />
              <Fact label="Time to hand in" value={clock(mine.elapsedMs) ?? "No finish"} />
              <Fact label="You walked" value={`${(walkedM / 1000).toFixed(1)} km`} />
            </View>
            {state.course ? (
              <View style={styles.miniMap} pointerEvents="none">
                <CourseMap course={state.course} walked={progress?.edges} padding={{ top: 24, right: 24, bottom: 24, left: 24 }} interactive={false} showApproach={false} />
              </View>
            ) : null}
            <Text style={styles.mapNote}>Streets you walked are drawn solid. Only you see this map.</Text>
          </Animated.View>
        ) : null}

        <Text style={styles.section}>Everyone</Text>
        {state.online ? (
          <Text style={styles.order}>
            {state.online.equivalence?.status === "matched"
              ? `Each walked their own ${(state.online.targetM / 1000).toFixed(1)} km course, matched within ${Math.round(state.online.spreadShare * state.online.targetM)} m.`
              : `Each walked their own ${(state.online.targetM / 1000).toFixed(1)} km course. Friendly: shapes weren't matched.`}
          </Text>
        ) : null}
        <View style={styles.list}>
          {r.rows.map((row, i) => {
            const p = state.players.find((x) => x.userId === row.userId);
            const digits = state.course?.digits.length ?? 2;
            const courseM = state.online?.players.find((x) => x.userId === row.userId)?.officialM ?? null;
            return (
              <Animated.View key={row.userId} entering={animate ? FadeIn.delay(900 + i * 40).duration(motion.duration.enter) : undefined} style={[styles.rowItem, i > 0 && styles.rowRule, row.isWinner && styles.rowWin]} accessible accessibilityLabel={`${ordinal(row.placement)}, ${row.name}${row.isMe ? ", you" : ""}. ${row.finished ? "Verified finish" : `${row.digitsDone} of ${digits} digits`}`}>
                <Text style={[styles.rank, row.isWinner && styles.rankWin]}>{row.placement}</Text>
                <Avatar name={row.name} size={36} />
                <View style={styles.flexOnly}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {row.isMe ? `${row.name} (you)` : row.name}
                    </Text>
                    {row.isWinner ? <CrownSimpleIcon size={15} color={accent.band} weight="fill" /> : null}
                  </View>
                  <Text style={styles.note}>
                    {(row.finished ? `Verified finish${row.finishOrder ? `, ${ordinal(row.finishOrder)} in` : ""}` : p?.status === "left" ? "Left the race" : row.digitsDone ? `${row.digitsDone} of ${digits} digits` : "Didn't finish") +
                      (courseM ? ` · ${(courseM / 1000).toFixed(2)} km course` : "")}
                  </Text>
                </View>
                {row.finished ? <Text style={styles.time}>{clock(row.elapsedMs)}</Text> : <DigitDots done={row.digitsDone} total={digits} />}
              </Animated.View>
            );
          })}
        </View>
        <Text style={styles.order}>{RESULT_LINES.orderNote}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.barRow}>
          <PressScale accessibilityRole="button" accessibilityLabel="Share result" style={styles.share} onPress={share}>
            <ShareNetworkIcon size={22} color={text.primary} weight="bold" />
          </PressScale>
          {r.canPlayAgain ? (
            <RaisedButton style={styles.flexOnly} label="Play again" busy={busy} onPress={() => void again()} />
          ) : (
            <RaisedButton style={styles.flexOnly} tone="white" label="Back to the room" onPress={() => router.replace({ pathname: "/game/room/[id]", params: { id: state.room.id } })} />
          )}
        </View>
        {r.canPlayAgain ? (
          <PressScale accessibilityRole="button" style={styles.back} onPress={() => router.replace({ pathname: "/game/room/[id]", params: { id: state.room.id } })}>
            <Text style={styles.backText}>Back to the room</Text>
          </PressScale>
        ) : !state.me.isHost ? (
          <Text style={styles.wait}>Another race starts from the room.</Text>
        ) : null}
      </View>
    </View>
  );
};

const Fact = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.fact}>
    <Text style={styles.factValue}>{value}</Text>
    <Text style={styles.factLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: bg.stage },
  flexOnly: { flex: 1 },
  body: { paddingHorizontal: layout.gutter },
  hero: { alignItems: "center", justifyContent: "center", height: 160 },
  burst: { position: "absolute", width: 260, height: 160 },
  headline: { fontSize: 34, lineHeight: 39, fontWeight: "900", letterSpacing: -0.9, color: text.primary, textAlign: "center", marginTop: space.md },
  photo: { ...type.supporting, color: text.secondary, textAlign: "center", marginTop: space.sm },
  settling: { ...type.caption, color: text.secondary, textAlign: "center", marginTop: space.sm },
  mine: { marginTop: space.xl, padding: space.lg, borderRadius: 24, backgroundColor: bg.surface, borderWidth: 1, borderColor: border.soft },
  mineTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mineLabel: { ...type.supporting, fontWeight: "600", color: text.secondary, marginTop: -2 },
  minePlace: { fontSize: 44, lineHeight: 48, fontWeight: "900", color: text.primary, letterSpacing: -1 },
  mineStatus: { alignItems: "flex-end" },
  badge: { overflow: "hidden", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, fontSize: 12, fontWeight: "800" },
  badgeOk: { backgroundColor: "#E2F1E7", color: "#1F6B3A" },
  badgeNo: { backgroundColor: bg.subtle, color: text.secondary },
  facts: { flexDirection: "row", marginTop: space.lg, borderRadius: radius.card, backgroundColor: bg.subtle },
  fact: { flex: 1, alignItems: "center", paddingVertical: space.md },
  factValue: { fontSize: 17, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  factLabel: { ...type.caption, color: text.secondary, marginTop: 2, textAlign: "center" },
  miniMap: { height: 170, borderRadius: radius.card, overflow: "hidden", marginTop: space.md, backgroundColor: bg.subtle },
  mapNote: { ...type.caption, color: text.secondary, marginTop: space.sm },
  section: { ...type.sectionTitle, fontWeight: "800", color: text.primary, marginTop: space.section, marginBottom: space.md },
  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface, overflow: "hidden" },
  rowItem: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, minHeight: 64, paddingVertical: space.sm },
  rowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  rowWin: { backgroundColor: accent.soft },
  rank: { width: 22, fontSize: 18, fontWeight: "900", color: text.secondary, fontVariant: ["tabular-nums"], textAlign: "center" },
  rankWin: { color: accent.band },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { ...type.cardTitle, fontWeight: "700", color: text.primary, flexShrink: 1 },
  note: { ...type.caption, color: text.secondary, marginTop: 1 },
  time: { fontSize: 15, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  order: { ...type.caption, color: text.secondary, marginTop: space.sm },
  error: { ...type.supporting, color: "#B4442C", marginTop: space.md },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  barRow: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  share: { width: 64, height: 64, borderRadius: 18, borderWidth: 1, borderColor: border.default, alignItems: "center", justifyContent: "center", backgroundColor: bg.surface },
  back: { alignSelf: "center", paddingVertical: space.sm, marginTop: 4 },
  backText: { ...type.supporting, fontWeight: "700", color: text.secondary },
  wait: { ...type.caption, color: text.secondary, textAlign: "center", marginTop: space.sm },
});
