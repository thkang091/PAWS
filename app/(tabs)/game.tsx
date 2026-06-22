import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { GoldBar } from "@/components/ui/GoldBar";

import { ProfileIconButton } from "@/components/navigation/ProfileIconButton";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { trainingGoalCategoryMap } from "@/constants/onboardingOptions";
import { theme } from "@/constants/theme";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useChallengeGamesForDog } from "@/hooks/useGameCatalog";
import { useWallet } from "@/hooks/useWallet";
import type { ChallengeGame, ChallengeGameDifficulty, OwnerTrainingGoal } from "@/types/domain";

// ── Constants ─────────────────────────────────────────────────────────────────

const DIFF_ORDER: ChallengeGameDifficulty[] = ["easy", "medium", "hard", "featured"];
const DIFF_LABEL: Record<ChallengeGameDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  featured: "Featured",
};
const DIFF_COLORS: Record<ChallengeGameDifficulty, { bg: string; text: string; border: string }> = {
  easy:     { bg: theme.colors.primarySoft,  text: theme.colors.primaryDark, border: theme.colors.primary + "55" },
  medium:   { bg: theme.colors.accentSoft,   text: "#6B6B00",                border: "#CDCD4466" },
  hard:     { bg: "#FFE8D6",                  text: "#B85C00",                border: "#FFB07666" },
  featured: { bg: theme.colors.goldSoft,      text: "#9A6200",                border: theme.colors.gold + "66" },
};

const categoryTitle = (category: OwnerTrainingGoal) =>
  trainingGoalCategoryMap.get(category)?.title ?? category.split("_").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ");

const getErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message.trim().length > 0 ? error.message : "Games could not load.";

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function GameTabScreen() {
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const wallet = useWallet(dogId);
  const challengeGames = useChallengeGamesForDog(dogId);
  const [activeFilter, setActiveFilter] = useState<ChallengeGameDifficulty | "all">("all");

  const games = challengeGames.data ?? [];

  const categories = useMemo(
    () => Array.from(new Set(games.map((g) => g.category))),
    [games],
  );

  const filtered = useMemo(
    () => (activeFilter === "all" ? games : games.filter((g) => g.difficulty === activeFilter)),
    [games, activeFilter],
  );

  const groupedByCategory = useMemo(() => {
    const map = new Map<OwnerTrainingGoal, ChallengeGame[]>();
    for (const game of filtered) {
      const list = map.get(game.category) ?? [];
      list.push(game);
      map.set(game.category, list);
    }
    return map;
  }, [filtered]);

  if (dog.isLoading || wallet.isLoading || challengeGames.isLoading) {
    return <ScreenContainer centered><LoadingState message="Loading games..." /></ScreenContainer>;
  }
  if (challengeGames.error) {
    return <ScreenContainer centered><ErrorState message={getErrorMessage(challengeGames.error)} onRetry={() => { void challengeGames.refetch(); }} /></ScreenContainer>;
  }

  const silver = wallet.data?.silverBalance ?? 0;
  const gold   = wallet.data?.goldBalance ?? 0;

  return (
    <ScreenContainer scroll>
      {/* Header */}
      <View style={styles.header}>
        <ProfileIconButton label={dog.data?.name} />
        <View style={styles.headerLeft}>
          <Text style={styles.title} numberOfLines={1}>Challenge Games</Text>
          {dog.data?.name ? <Text style={styles.subtitle}>Tailored to {dog.data.name}'s training goals</Text> : null}
        </View>
        <Pressable style={styles.shopBtn} onPress={() => router.push("/rewards")} accessibilityRole="button" accessibilityLabel="Coupon shop">
          <Ionicons name="ticket-outline" size={16} color={theme.colors.primaryDark} />
          <Text style={styles.shopBtnText}>Shop</Text>
        </Pressable>
      </View>

      {/* Wallet row */}
      <View style={styles.walletRow}>
        <View style={styles.walletCard}>
          <Ionicons name="cash-outline" size={16} color={theme.colors.silver} />
          <View style={styles.walletCopy}>
            <Text style={styles.walletAmount}>{silver.toLocaleString()}</Text>
            <Text style={styles.walletLabel}>Silver</Text>
          </View>
        </View>
        <View style={[styles.walletCard, styles.walletCardGold]}>
          <GoldBar size={18} />
          <View style={styles.walletCopy}>
            <Text style={[styles.walletAmount, styles.walletAmountGold]}>{gold.toLocaleString()}</Text>
            <Text style={styles.walletLabel}>Gold</Text>
          </View>
        </View>
        <View style={styles.walletInfo}>
          <Text style={styles.walletInfoText}>Spend silver to enter. Win gold on PASS.</Text>
        </View>
      </View>

      {/* Difficulty filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(["all", ...DIFF_ORDER] as const).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
            onPress={() => setActiveFilter(f)}
          >
            <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
              {f === "all" ? "All" : DIFF_LABEL[f]}
            </Text>
            {f !== "all" && (
              <Text style={[styles.filterCount, activeFilter === f && styles.filterCountActive]}>
                {games.filter((g) => g.difficulty === f).length}
              </Text>
            )}
          </Pressable>
        ))}
      </ScrollView>

      {/* Empty state */}
      {games.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="game-controller-outline" size={32} color={theme.colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No games yet for your goals</Text>
          <Text style={styles.emptyBody}>Complete training activities to unlock challenge games based on your dog's selected goals.</Text>
        </View>
      ) : null}

      {/* Games grouped by category */}
      {Array.from(groupedByCategory.entries()).map(([category, catGames]) => (
        <View key={category} style={styles.categorySection}>
          <View style={styles.categoryHeader}>
            <Ionicons name="flag-outline" size={14} color={theme.colors.primaryDark} />
            <Text style={styles.categoryLabel}>{categoryTitle(category)}</Text>
            <View style={styles.categoryCount}>
              <Text style={styles.categoryCountText}>{catGames.length}</Text>
            </View>
          </View>
          {catGames.sort((a, b) => DIFF_ORDER.indexOf(a.difficulty) - DIFF_ORDER.indexOf(b.difficulty)).map((game) => (
            <GameCard
              key={game.id}
              game={game}
              silver={silver}
              onStart={() => router.push(`/game/${game.id}`)}
            />
          ))}
        </View>
      ))}


      {/* How it works */}
      <View style={styles.howCard}>
        <Text style={styles.howTitle}>How It Works</Text>
        <View style={styles.howStep}>
          <View style={[styles.howNum, { backgroundColor: theme.colors.silverSoft }]}><Text style={[styles.howNumText, { color: theme.colors.silver }]}>1</Text></View>
          <Text style={styles.howBody}>Spend Silver Coins to enter a challenge</Text>
        </View>
        <View style={styles.howStep}>
          <View style={[styles.howNum, { backgroundColor: theme.colors.accentSoft }]}><Text style={[styles.howNumText, { color: theme.colors.primaryDark }]}>2</Text></View>
          <Text style={styles.howBody}>Record your dog completing the challenge</Text>
        </View>
        <View style={styles.howStep}>
          <View style={[styles.howNum, { backgroundColor: theme.colors.goldSoft }]}><Text style={[styles.howNumText, { color: theme.colors.gold }]}>3</Text></View>
          <Text style={styles.howBody}>Gemini AI reviews and awards Gold Coins on PASS</Text>
        </View>
        <View style={styles.howStep}>
          <View style={[styles.howNum, { backgroundColor: theme.colors.primarySoft }]}><Text style={[styles.howNumText, { color: theme.colors.primaryDark }]}>4</Text></View>
          <Text style={styles.howBody}>Use Gold Coins to unlock coupons in the shop</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

// ── Game Card ─────────────────────────────────────────────────────────────────

const GameCard = ({
  game,
  silver,
  onStart,
}: {
  game: ChallengeGame;
  silver: number;
  onStart: () => void;
}) => {
  const diff = DIFF_COLORS[game.difficulty];
  const canAfford = silver >= game.economy.silverCoinEntryCost;

  return (
    <Pressable
      style={({ pressed }) => [styles.gameCard, pressed && { opacity: 0.88 }]}
      onPress={onStart}
      accessibilityRole="button"
      accessibilityLabel={`View ${game.title}`}
    >
      {/* Top: difficulty badge + entry cost */}
      <View style={styles.gameCardTop}>
        <View style={[styles.diffBadge, { backgroundColor: diff.bg, borderColor: diff.border }]}>
          <Text style={[styles.diffText, { color: diff.text }]}>{DIFF_LABEL[game.difficulty]}</Text>
        </View>
        <View style={styles.entryCostRow}>
          <Ionicons name="cash-outline" size={12} color={theme.colors.silver} />
          <Text style={styles.entryCostText}>{game.economy.silverCoinEntryCost} silver</Text>
        </View>
      </View>

      {/* Title + subtitle */}
      <Text style={styles.gameTitle}>{game.title}</Text>
      <Text style={styles.gameSub} numberOfLines={2}>{game.subtitle}</Text>

      {/* Bottom row: clip + pass reward + start */}
      <View style={styles.gameCardBottom}>
        <View style={styles.clipRow}>
          <Ionicons name="videocam-outline" size={13} color={theme.colors.textMuted} />
          <Text style={styles.clipText}>{game.clipDurationSeconds.min}–{game.clipDurationSeconds.max}s</Text>
        </View>
        <View style={styles.passRow}>
          <GoldBar size={13} />
          <Text style={styles.passText}>+{game.economy.goldCoinPassReward} gold</Text>
        </View>
        <View style={[styles.startBtn, !canAfford && styles.startBtnLocked]}>
          {canAfford ? (
            <Ionicons name="play" size={13} color={theme.colors.white} />
          ) : (
            <Ionicons name="lock-closed-outline" size={13} color={theme.colors.textMuted} />
          )}
          <Text style={[styles.startBtnText, !canAfford && styles.startBtnTextLocked]}>
            {canAfford ? "View" : "Need silver"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm, paddingBottom: theme.spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  headerLeft: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 18, fontWeight: "900", color: theme.colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: theme.typography.xs, color: theme.colors.textMuted },
  shopBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: theme.radii.pill, backgroundColor: theme.colors.accentSoft, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0 },
  shopBtnText: { fontSize: theme.typography.xs, fontWeight: "900", color: theme.colors.primaryDark },

  walletRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, alignItems: "stretch" },
  walletCard: { minWidth: 112, flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.colors.silverSoft, borderRadius: theme.radii.md, paddingHorizontal: 12, paddingVertical: 10 },
  walletCardGold: { backgroundColor: theme.colors.goldSoft },
  walletCopy: { gap: 1 },
  walletAmount: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.silver },
  walletAmountGold: { color: theme.colors.gold },
  walletLabel: { fontSize: 10, fontWeight: "700", color: theme.colors.textMuted },
  walletInfo: { minWidth: 160, flexGrow: 1, justifyContent: "center" },
  walletInfoText: { fontSize: theme.typography.xs, color: theme.colors.textMuted, lineHeight: 16 },

  filterRow: { gap: theme.spacing.sm, paddingBottom: 2 },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: theme.radii.pill, borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: theme.colors.card, paddingHorizontal: 14, paddingVertical: 7 },
  filterChipActive: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark },
  filterText: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.textMuted },
  filterTextActive: { color: "#fff" },
  filterCount: { fontSize: 10, fontWeight: "900", color: theme.colors.textSubtle, backgroundColor: theme.colors.cardMuted, borderRadius: 99, minWidth: 16, textAlign: "center", paddingHorizontal: 4 },
  filterCountActive: { color: "#fff", backgroundColor: "rgba(255,255,255,0.25)" },

  emptyCard: { backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: theme.spacing.xl, alignItems: "center", gap: theme.spacing.md, ...theme.shadows.soft },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.cardMuted, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: theme.typography.md, fontWeight: "900", color: theme.colors.text, textAlign: "center" },
  emptyBody: { fontSize: theme.typography.sm, color: theme.colors.textMuted, textAlign: "center", lineHeight: 20 },

  categorySection: { gap: theme.spacing.md },
  categoryHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  categoryLabel: { fontSize: theme.typography.xs, fontWeight: "900", color: theme.colors.primaryDark, textTransform: "uppercase", letterSpacing: 0.5, flex: 1 },
  categoryCount: { borderRadius: 99, backgroundColor: theme.colors.primarySoft, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  categoryCountText: { fontSize: 11, fontWeight: "900", color: theme.colors.primaryDark },

  gameCard: { backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: theme.spacing.lg, gap: 10, ...theme.shadows.soft },
  gameCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  diffBadge: { borderRadius: theme.radii.pill, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 3 },
  diffText: { fontSize: theme.typography.xs, fontWeight: "900" },
  entryCostRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  entryCostText: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.silver },
  gameTitle: { fontSize: theme.typography.md, fontWeight: "900", color: theme.colors.text },
  gameSub: { fontSize: theme.typography.xs, color: theme.colors.textMuted, lineHeight: 17 },
  gameCardBottom: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: 2 },
  clipRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  clipText: { fontSize: theme.typography.xs, color: theme.colors.textMuted, fontWeight: "700" },
  passRow: { flexDirection: "row", alignItems: "center", gap: 4, flexGrow: 1, minWidth: 88 },
  passText: { fontSize: theme.typography.xs, fontWeight: "800", color: theme.colors.gold },
  startBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primaryDark, paddingHorizontal: 14, paddingVertical: 8 },
  startBtnLocked: { backgroundColor: theme.colors.cardMuted },
  startBtnLoading: { opacity: 0.55 },
  startBtnText: { fontSize: theme.typography.xs, fontWeight: "900", color: "#fff" },
  startBtnTextLocked: { color: theme.colors.textMuted },

  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.colors.errorSoft, borderRadius: theme.radii.md, padding: theme.spacing.md },
  errorText: { flex: 1, fontSize: theme.typography.sm, color: theme.colors.error, fontWeight: "700" },

  howCard: { backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, padding: theme.spacing.lg, gap: theme.spacing.md, ...theme.shadows.soft },
  howTitle: { fontSize: theme.typography.sm, fontWeight: "900", color: theme.colors.text },
  howStep: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  howNum: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  howNumText: { fontSize: theme.typography.xs, fontWeight: "900" },
  howBody: { flex: 1, fontSize: theme.typography.xs, color: theme.colors.textMuted, lineHeight: 18, paddingTop: 4 },
});
