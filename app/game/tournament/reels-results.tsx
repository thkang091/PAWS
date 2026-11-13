import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, useReducedMotion } from "react-native-reanimated";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaretLeftIcon, CrownSimpleIcon, HeartIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { goBack } from "@/features/care/components/DetailShell";
import { ReelPlayer } from "@/features/dogReels/components/ReelPlayer";
import { reelError } from "@/features/dogReels/copy";
import { useReelChallenges, useResults } from "@/hooks/usePhotoPose";
import type { ResultRow } from "@/services/mediaService";
import { accent, bg, layout, motion, radius, space, text, type } from "@/constants/design";

/** Results: the winning clip playing, then everyone by votes. Only the votes decide; nobody's clip is judged. */
export default function ReelResultsScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { challengeId } = useLocalSearchParams<{ challengeId?: string }>();
  const challenges = useReelChallenges();
  const c = (challenges.data ?? []).find((x) => x.challengeId === challengeId) ?? null;
  const results = useResults(challengeId);
  const [open, setOpen] = useState<ResultRow | null>(null);
  const rows = results.data?.rows ?? [];
  const winner = rows[0] ?? null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.section }} showsVerticalScrollIndicator={false}>
        <PressScale accessibilityRole="button" accessibilityLabel="Back" style={styles.back} onPress={() => goBack("/game/tournament/reels")}>
          <CaretLeftIcon size={22} color={text.primary} weight="bold" />
        </PressScale>
        <Text style={styles.title}>{c?.title ?? "Results"}</Text>
        {results.data ? <Text style={styles.line}>{`${results.data.total} clips, ${results.data.totalVotes} votes`}</Text> : null}

        {results.error ? (
          <Text style={styles.empty}>{reelError((results.error as { code?: string }).code)}</Text>
        ) : !winner ? (
          <Text style={styles.empty}>{results.isPending ? "Loading results" : "No clips this week."}</Text>
        ) : (
          <>
            <Animated.View entering={reduceMotion ? FadeIn.duration(motion.duration.enter) : FadeInDown.duration(260).easing(motion.easing.out).withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })} style={styles.winner}>
              <ReelPlayer url={winner.url} poster={winner.posterUrl} style={StyleSheet.absoluteFill} />
              <View style={styles.winnerShade} />
              <View style={styles.crown}>
                <CrownSimpleIcon size={16} color={text.primary} weight="fill" />
                <Text style={styles.crownText}>Winner</Text>
              </View>
              <View style={styles.winnerFoot}>
                <Text style={styles.winnerName}>{winner.isMine ? "You" : (winner.dogName ?? "")}</Text>
                <View style={styles.votes}>
                  <HeartIcon size={14} color="#FFFFFF" weight="fill" />
                  <Text style={styles.votesText}>{winner.votes}</Text>
                </View>
              </View>
            </Animated.View>
            {rows.slice(1).map((r, i) => (
              <Animated.View key={r.id} entering={reduceMotion ? FadeIn.duration(180) : FadeInDown.delay(80 + i * 40).duration(220).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })}>
                <PressScale accessibilityRole="button" accessibilityLabel={`Number ${r.rank}: ${r.isMine ? "you" : (r.dogName ?? "a dog")}, ${r.votes} votes. Watch`} scaleTo={0.98} style={[styles.row, r.isMine && styles.rowMine]} onPress={() => setOpen(r)}>
                  <Text style={styles.rank}>{r.rank}</Text>
                  <View style={styles.thumb}>{r.posterUrl ? <Image source={{ uri: r.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
                  <Text style={styles.name} numberOfLines={1}>
                    {r.isMine ? "You" : (r.dogName ?? "")}
                  </Text>
                  <HeartIcon size={14} color={text.tertiary} weight="fill" />
                  <Text style={styles.count}>{r.votes}</Text>
                </PressScale>
              </Animated.View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={open != null} animationType="fade" onRequestClose={() => setOpen(null)}>
        {open ? (
          <View style={styles.viewer}>
            <ReelPlayer url={open.url} poster={open.posterUrl} style={StyleSheet.absoluteFill} />
            <PressScale accessibilityRole="button" accessibilityLabel="Close" style={[styles.close, { top: insets.top + space.sm }]} onPress={() => setOpen(null)}>
              <XIcon size={20} color="#FFFFFF" weight="bold" />
            </PressScale>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  back: { width: layout.iconButton, height: layout.iconButton, borderRadius: radius.pill, borderWidth: 1, borderColor: "#E8E7E2", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 32, lineHeight: 36, fontWeight: "800", letterSpacing: -1, color: text.primary, marginTop: space.lg },
  line: { ...type.supporting, fontWeight: "700", color: text.secondary, marginTop: 4 },
  empty: { ...type.supporting, color: text.secondary, textAlign: "center", marginTop: space.section },
  winner: { height: 440, borderRadius: 30, overflow: "hidden", marginTop: space.xl, marginBottom: space.lg, justifyContent: "space-between" },
  winnerShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 120, backgroundColor: "rgba(0,0,0,0.3)" },
  crown: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", margin: space.lg, height: 32, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: accent.deep },
  crownText: { fontSize: 13, fontWeight: "800", color: text.primary },
  winnerFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", margin: space.lg },
  winnerName: { fontSize: 26, fontWeight: "800", color: "#FFFFFF" },
  votes: { flexDirection: "row", alignItems: "center", gap: 5, height: 32, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0.4)" },
  votesText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.sm, paddingRight: space.lg, borderRadius: 20, backgroundColor: bg.subtle, marginTop: space.sm },
  rowMine: { backgroundColor: accent.soft },
  rank: { width: 28, textAlign: "center", fontSize: 18, fontWeight: "800", color: text.tertiary, fontVariant: ["tabular-nums"] },
  thumb: { width: 44, height: 64, borderRadius: 12, overflow: "hidden", backgroundColor: "#1C1B1A" },
  name: { flex: 1, fontSize: 16, fontWeight: "800", color: text.primary },
  count: { fontSize: 15, fontWeight: "800", color: text.secondary, fontVariant: ["tabular-nums"] },
  viewer: { flex: 1, backgroundColor: "#0E0E0D" },
  close: { position: "absolute", left: layout.gutter, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
});
