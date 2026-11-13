import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeartIcon, TrophyIcon } from "phosphor-react-native";

import { DetailShell } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { PoseImage } from "@/features/photoPose/components/PoseParts";
import { countLabel, poseError } from "@/features/photoPose/copy";
import { usePhotoChallenges, useResults } from "@/hooks/usePhotoPose";
import type { ResultRow } from "@/services/mediaService";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

const MEDAL = [accent.deep, "#E4E2DC", "#EBCFAE"] as const;

/** Final results: the community's favourite, the podium, everyone else, and where you finished. */
export default function PoseResultsScreen() {
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const challenges = usePhotoChallenges();
  const c = (challenges.data ?? []).find((x) => x.challengeId === challengeId) ?? null;
  const results = useResults(challengeId);
  const rows = results.data?.rows ?? [];
  const [first, ...rest] = rows;
  const podium = rest.slice(0, 2);
  const others = rows.filter((r) => r.rank > 3);
  const mine = rows.find((r) => r.isMine) ?? null;

  return (
    <DetailShell title="Results" glyph={<TrophyIcon size={20} color={accent.band} weight="fill" />} back="/game/tournament/photo-pose">
      {c ? <Text style={styles.title}>{c.title}</Text> : null}
      {results.data ? (
        <Text style={styles.lead}>{`${countLabel(results.data.total, "photo", "photos")}, ${countLabel(results.data.totalVotes, "vote", "votes")}. The most votes wins. Ties go to the earlier photo.`}</Text>
      ) : null}

      {results.isPending ? (
        <View style={styles.loading}>
          <ActivityIndicator color={text.secondary} />
        </View>
      ) : results.isError ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{poseError((results.error as { code?: string }).code)}</Text>
          <RaisedButton tone="white" label="Try again" onPress={() => void results.refetch()} style={styles.retry} />
        </View>
      ) : !first ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No photos were entered in this challenge.</Text>
        </View>
      ) : (
        <>
          {mine && mine.rank > 3 ? (
            <View style={styles.mine}>
              <Text style={styles.mineRank}>{`#${mine.rank}`}</Text>
              <Text style={styles.mineText}>{`You finished ${ordinal(mine.rank)} with ${countLabel(mine.votes, "vote", "votes")}.`}</Text>
            </View>
          ) : null}

          <Animated.View entering={reduceMotion ? FadeIn : FadeInDown.duration(motion.duration.reveal).easing(motion.easing.out)} style={styles.winner}>
            <PoseImage url={first.url} failed={!first.url} rounded={28} accessibilityLabel={`Winner: ${first.dogName ?? "entry"}`} />
            <View style={styles.crown}>
              <TrophyIcon size={18} color={text.primary} weight="fill" />
              <Text style={styles.crownText}>{first.isMine ? "You won" : "Winner"}</Text>
            </View>
            <View style={styles.winnerFoot}>
              <Text style={styles.winnerName} numberOfLines={1}>
                {first.dogName ?? " "}
              </Text>
              <Votes n={first.votes} />
            </View>
          </Animated.View>

          {podium.length ? (
            <View style={styles.podium}>
              {podium.map((r, i) => (
                <Animated.View key={r.id} entering={reduceMotion ? undefined : FadeIn.delay(160 + i * motion.stagger).duration(motion.duration.enter)} style={styles.podiumItem}>
                  <PoseImage url={r.url} failed={!r.url} rounded={20} />
                  <Medal rank={r.rank} />
                  <View style={styles.podiumFoot}>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {r.isMine ? "You" : (r.dogName ?? " ")}
                    </Text>
                    <Votes n={r.votes} small />
                  </View>
                </Animated.View>
              ))}
            </View>
          ) : null}

          {others.length ? (
            <View style={styles.list}>
              {others.map((r) => (
                <Row key={r.id} r={r} />
              ))}
            </View>
          ) : null}
        </>
      )}
      <View style={{ height: insets.bottom }} />
    </DetailShell>
  );
}

const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
};

const Votes = ({ n, small }: { n: number; small?: boolean }) => (
  <View style={styles.votes} accessibilityLabel={countLabel(n, "vote", "votes")}>
    <HeartIcon size={small ? 13 : 16} color={accent.band} weight="fill" />
    <Text style={[styles.votesText, small && styles.votesSmall]}>{n}</Text>
  </View>
);

const Medal = ({ rank }: { rank: number }) => (
  <View style={[styles.medal, { backgroundColor: MEDAL[rank - 1] ?? bg.subtle }]}>
    <Text style={styles.medalText}>{rank}</Text>
  </View>
);

const Row = ({ r }: { r: ResultRow }) => (
  <View style={[styles.row, r.isMine && styles.rowMine]}>
    <Text style={styles.rowRank}>{r.rank}</Text>
    <PoseImage url={r.url} failed={!r.url} aspect={1} rounded={12} style={styles.rowThumb} />
    <Text style={styles.rowName} numberOfLines={1}>
      {r.isMine ? "You" : (r.dogName ?? "Entry")}
    </Text>
    <Votes n={r.votes} small />
  </View>
);

const styles = StyleSheet.create({
  title: { ...type.sectionTitle, fontWeight: "800", color: text.primary, marginTop: space.xs },
  lead: { ...type.supporting, color: text.secondary, marginTop: space.xs },
  loading: { height: 300, alignItems: "center", justifyContent: "center" },
  empty: { paddingVertical: space.sectionLg, alignItems: "center", gap: space.md },
  emptyText: { ...type.supporting, color: text.secondary, textAlign: "center" },
  retry: { alignSelf: "stretch" },
  mine: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg, padding: space.lg, borderRadius: radius.card, backgroundColor: accent.soft },
  mineRank: { ...type.sectionTitle, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  mineText: { ...type.supporting, color: text.primary, flex: 1 },
  winner: { marginTop: space.xl },
  crown: { position: "absolute", top: space.md, left: space.md, flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: accent.deep },
  crownText: { fontSize: 13, fontWeight: "800", color: text.primary },
  winnerFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.md },
  winnerName: { ...type.pageTitle, fontWeight: "800", color: text.primary, flex: 1 },
  votes: { flexDirection: "row", alignItems: "center", gap: 4 },
  votesText: { fontSize: 17, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  votesSmall: { fontSize: 14 },
  podium: { flexDirection: "row", gap: space.md, marginTop: space.xl },
  podiumItem: { flex: 1 },
  medal: { position: "absolute", top: 8, left: 8, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  medalText: { fontSize: 13, fontWeight: "800", color: text.primary },
  podiumFoot: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm },
  podiumName: { ...type.cardTitle, fontWeight: "700", color: text.primary, flex: 1 },
  list: { marginTop: space.xl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border.default },
  rowMine: { backgroundColor: accent.soft, marginHorizontal: -space.sm, paddingHorizontal: space.sm, borderRadius: radius.control },
  rowRank: { width: 28, ...type.supporting, fontWeight: "800", color: text.secondary, fontVariant: ["tabular-nums"], textAlign: "center" },
  rowThumb: { width: 44 },
  rowName: { ...type.cardTitle, fontWeight: "700", color: text.primary, flex: 1 },
});
