import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { RankingIcon } from "phosphor-react-native";

import { DetailShell } from "@/features/care/components/DetailShell";
import { TournamentLeaderboard } from "@/features/tournament/components/TournamentLeaderboard";
import { TournamentStatusBadge } from "@/features/tournament/components/TournamentStatusBadge";
import { errorText, formatBoardValue, formatPeriod } from "@/features/tournament/format";
import { useTournamentBoard } from "@/hooks/useTournaments";
import { accent, bg, border, radius, space, text, type } from "@/constants/design";

/** The full board for one tournament: the period, whether it is final, your place, then every checked territory. */
export default function TournamentLeaderboardScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const board = useTournamentBoard(id);
  const data = board.data;
  const setupError = (board.error as { code?: string } | null)?.code;

  return (
    <DetailShell title="Leaderboard" glyph={<RankingIcon size={20} color={accent.band} weight="fill" />} back="/game/tournament">
      {data ? (
        <>
          <View style={styles.head}>
            <View style={styles.headTop}>
              <TournamentStatusBadge kind={data.finalized ? "finished" : data.tournament.phase === "active" ? "live" : "upcoming"} label={data.finalized ? "Final results" : data.tournament.phase === "active" ? "In progress" : "Not started"} />
              <Text style={styles.period}>{formatPeriod(data.tournament.startsAt, data.tournament.endsAt)}</Text>
            </View>
            <Text style={styles.name}>{data.tournament.name}</Text>
            <Text style={styles.rule}>{data.unit === "points" ? "Closest match to the shape wins. Ties go to whoever finished first." : "Largest checked territory wins. Ties go to whoever claimed first."}</Text>
          </View>

          <View style={[styles.mine, data.mine && styles.mineOn]}>
            {data.mine ? (
              <>
                <Text style={styles.mineRank}>{data.mine.rank}</Text>
                <View style={styles.flex}>
                  <Text style={styles.mineTitle}>{`Your place, of ${data.total}`}</Text>
                  <Text style={styles.mineArea}>{formatBoardValue(data.unit, data.mine.value)}</Text>
                </View>
              </>
            ) : (
              <Text style={styles.mineTitle}>You're not on the board yet. Claim a territory to join it.</Text>
            )}
          </View>

          {data.rows.length ? <TournamentLeaderboard rows={data.rows} unit={data.unit} /> : <Text style={styles.empty}>No territories claimed yet.</Text>}
          {data.total > data.rows.length ? <Text style={styles.more}>{`Showing the top ${data.rows.length} of ${data.total}.`}</Text> : null}
        </>
      ) : (
        <Text style={styles.empty}>{setupError ? errorText(setupError) : "Loading the board."}</Text>
      )}
    </DetailShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { marginTop: space.md },
  headTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  period: { ...type.caption, fontWeight: "700", color: text.secondary },
  name: { fontSize: 22, lineHeight: 27, fontWeight: "800", letterSpacing: -0.4, color: text.primary, marginTop: space.md },
  rule: { ...type.supporting, color: text.secondary, marginTop: 4 },
  mine: { flexDirection: "row", alignItems: "center", gap: space.lg, marginVertical: space.xl, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface },
  mineOn: { backgroundColor: accent.primary, borderColor: accent.primary },
  mineRank: { fontSize: 40, lineHeight: 44, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"], minWidth: 44, textAlign: "center" },
  mineTitle: { ...type.supporting, color: text.primary, flex: 1 },
  mineArea: { fontSize: 20, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  empty: { ...type.supporting, color: text.secondary, marginTop: space.lg },
  more: { ...type.caption, color: text.secondary, marginTop: space.md, marginBottom: space.section },
});
