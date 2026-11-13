import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { PlayCircleIcon, TrophyIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { CoinGlyph } from "@/components/ui/StatGlyphs";
import { DetailShell } from "@/features/care/components/DetailShell";
import { SegmentedTabs } from "@/features/profile/components/SegmentedTabs";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { ReplaySheet } from "@/features/game/arena/ReplaySheet";
import { GAMES, TRICK_INFO, errorText, formatScore, ordinal } from "@/features/game/arena/arenaCopy";
import { arenaKeys, useArenaBoard, useLastWeekPrize, useMyArena } from "@/hooks/useArena";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { queryKeys } from "@/constants/queryKeys";
import { claimWeek, currentWeek, type ArenaGame, type BoardRow } from "@/services/arenaService";
import { weeklyTricks } from "../../supabase/functions/arena/logic";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

const OPTIONS = [
  { key: "longest_sit", label: "Longest Sit" },
  { key: "trick_combo", label: "Trick Combo" },
] as const;

const MEDAL = ["#F6C350", "#C9CED6", "#D9A47A"];
const PRIZE_GOLD = [15, 10, 5];

/** Days until the board resets on Monday (UTC). */
const daysLeft = () => {
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7;
  return 7 - day;
};

/**
 * Tournament: one weekly board per game. Your best, your place, this week's tricks and the button to play, then the
 * board itself. Last week's top three can claim their gold here.
 */
export default function ArenaScreen() {
  const [game, setGame] = useState<ArenaGame>("longest_sit");
  const [replay, setReplay] = useState<{ id: string; title: string } | null>(null);
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const dog = useCurrentDog();
  const dogId = dog.data?.id;
  const board = useArenaBoard(game);
  const mine = useMyArena(dogId, game);
  const prize = useLastWeekPrize(dogId, game);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const info = GAMES[game];
  const myRow = board.data?.find((r) => r.is_mine);
  const tricks = weeklyTricks(currentWeek());
  const setupError = (board.error ?? mine.error) as { code?: string } | null;
  const left = daysLeft();

  const claim = async () => {
    if (!dogId) return;
    setClaiming(true);
    setClaimError(null);
    try {
      await claimWeek(dogId, game, prize.week);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void queryClient.invalidateQueries({ queryKey: arenaKeys.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet(dogId) });
    } catch (e) {
      const code = (e as { code?: string }).code;
      setClaimError(code === "replay_not_public" ? "Show that week's replay on the board to claim." : errorText(code));
    } finally {
      setClaiming(false);
    }
  };

  return (
    <DetailShell title="Weekly boards" glyph={<TrophyIcon size={20} color={accent.band} weight="fill" />} back="/game/duel">
      <SegmentedTabs options={OPTIONS} value={game} onChange={(g) => setGame(g)} />

      <View style={styles.heroLip}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{`THIS WEEK · ${left === 1 ? "LAST DAY" : `${left} DAYS LEFT`}`}</Text>
          <View style={styles.heroRow}>
            <View style={styles.flex}>
              <Text style={styles.heroLabel}>{`${dog.data?.name ?? "Your"} best`}</Text>
              <Text style={[styles.best, !myRow && styles.bestEmpty]}>{myRow ? formatScore(game, myRow.score_ms) : "No score yet"}</Text>
            </View>
            {myRow ? (
              <View style={styles.place}>
                <Text style={styles.placeNo}>{ordinal(myRow.rank)}</Text>
                <Text style={styles.placeOf}>{`of ${board.data?.length ?? 0}`}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.goal}>{info.goal}</Text>
          {game === "trick_combo" ? (
            <View style={styles.trickRow}>
              {tricks.map((t) => {
                const trick = TRICK_INFO[t];
                return (
                  <View key={t} style={styles.trickChip}>
                    <trick.Icon size={20} color={text.primary} weight="fill" />
                    <Text style={styles.trickText}>{trick.label}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          <RaisedButton
            label="Play"
            sub={mine.data ? `${mine.data.triesLeft} of ${mine.data.triesPerDay} tries left today` : undefined}
            disabled={!dogId || mine.data?.triesLeft === 0 || Boolean(setupError)}
            onPress={() => router.push({ pathname: "/game/play", params: { game } })}
            style={styles.play}
          />
        </View>
      </View>

      {prize.eligible && !prize.claimed && prize.row ? (
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)} style={styles.prize}>
          <CoinGlyph size={28} tone="gold" />
          <View style={styles.flex}>
            <Text style={styles.prizeTitle}>{`${ordinal(prize.row.rank)} last week`}</Text>
            <Text style={styles.prizeNote}>{claimError ?? `${PRIZE_GOLD[prize.row.rank - 1]} gold is yours.`}</Text>
          </View>
          <PressScale accessibilityRole="button" accessibilityLabel="Claim gold" style={styles.claim} disabled={claiming} onPress={() => void claim()}>
            <Text style={styles.claimText}>{claiming ? "Claiming" : "Claim"}</Text>
          </PressScale>
        </Animated.View>
      ) : null}

      <View style={styles.boardHead}>
        <Text style={styles.section}>Leaderboard</Text>
        <Text style={styles.direction}>{info.direction}</Text>
      </View>

      {setupError ? (
        <Text style={styles.empty}>{errorText(setupError.code)}</Text>
      ) : board.isLoading ? (
        <Text style={styles.empty}>Loading the board.</Text>
      ) : !board.data?.length ? (
        <Text style={styles.empty}>No scores yet this week. The first one takes the top spot.</Text>
      ) : (
        <View style={styles.board}>
          {board.data.map((row, i) => (
            <BoardLine
              key={row.dog_id}
              row={row}
              game={game}
              first={i === 0}
              onReplay={row.replay_public || row.is_mine ? () => setReplay({ id: row.attempt_id, title: `${row.dog_name} · ${formatScore(game, row.score_ms)}` }) : undefined}
            />
          ))}
        </View>
      )}

      <ReplaySheet attemptId={replay?.id ?? null} title={replay?.title ?? ""} onClose={() => setReplay(null)} />
    </DetailShell>
  );
}

const BoardLine = ({ row, game, first, onReplay }: { row: BoardRow; game: ArenaGame; first: boolean; onReplay?: () => void }) => (
  <PressScale
    accessibilityRole={onReplay ? "button" : "text"}
    accessibilityLabel={`${ordinal(row.rank)}. ${row.dog_name}. ${formatScore(game, row.score_ms)}${onReplay ? ". Watch replay" : ""}`}
    disabled={!onReplay}
    scaleTo={0.98}
    style={[styles.line, !first && styles.lineRule, row.is_mine && styles.lineMine]}
    onPress={onReplay}
  >
    <View style={[styles.rank, row.rank <= 3 && { backgroundColor: MEDAL[row.rank - 1] }]}>
      <Text style={[styles.rankText, row.rank <= 3 && styles.rankTop]}>{row.rank}</Text>
    </View>
    <Text style={[styles.name, row.is_mine && styles.nameMine]} numberOfLines={1}>
      {row.dog_name}
    </Text>
    <Text style={styles.lineScore}>{formatScore(game, row.score_ms)}</Text>
    <View style={styles.replaySlot}>{onReplay ? <PlayCircleIcon size={22} color={accent.band} weight="fill" /> : null}</View>
  </PressScale>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heroLip: { marginTop: space.xl, borderRadius: radius.sheet, backgroundColor: "#E4E0B0", paddingBottom: 5 },
  hero: { borderRadius: radius.sheet, backgroundColor: accent.primary, padding: space.xl },
  eyebrow: { ...type.eyebrow, color: text.secondary },
  heroRow: { flexDirection: "row", alignItems: "flex-end", marginTop: space.md },
  heroLabel: { ...type.supporting, color: text.secondary },
  best: { fontSize: 40, lineHeight: 46, fontWeight: "800", letterSpacing: -1, color: text.primary, fontVariant: ["tabular-nums"] },
  bestEmpty: { fontSize: 26, lineHeight: 32, letterSpacing: -0.4, marginTop: 2 },
  place: { alignItems: "flex-end" },
  placeNo: { fontSize: 28, lineHeight: 32, fontWeight: "800", color: text.primary },
  placeOf: { ...type.caption, color: text.secondary, fontVariant: ["tabular-nums"] },
  goal: { ...type.supporting, color: text.primary, marginTop: space.md },
  trickRow: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  trickChip: { flex: 1, alignItems: "center", gap: 4, paddingVertical: space.sm, borderRadius: 14, backgroundColor: bg.surface },
  trickText: { fontSize: 13, fontWeight: "700", color: text.primary },
  play: { marginTop: space.xl },

  prize: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface },
  prizeTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  prizeNote: { ...type.caption, color: text.secondary, marginTop: 2 },
  claim: { height: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: accent.deep, justifyContent: "center" },
  claimText: { fontSize: 14, fontWeight: "800", color: text.primary },

  boardHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.section, marginBottom: space.md },
  section: { ...type.sectionTitle, color: text.primary },
  direction: { ...type.caption, fontWeight: "700", color: text.tertiary },
  empty: { ...type.supporting, color: text.secondary, paddingVertical: space.lg },
  board: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface, overflow: "hidden", marginBottom: space.section },
  line: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, height: 56 },
  lineRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  lineMine: { backgroundColor: accent.soft },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: bg.subtle },
  rankText: { fontSize: 13, fontWeight: "800", color: text.secondary, fontVariant: ["tabular-nums"] },
  rankTop: { color: text.primary },
  name: { ...type.cardTitle, color: text.primary, flex: 1 },
  nameMine: { fontWeight: "700" },
  lineScore: { fontSize: 16, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  replaySlot: { width: 22, alignItems: "center" },
});
