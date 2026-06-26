import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { ProfileIconButton } from "@/components/navigation/ProfileIconButton";
import { ErrorState } from "@/components/ui/ErrorState";
import { GoldBar } from "@/components/ui/GoldBar";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { trainingGoalCategoryMap } from "@/constants/onboardingOptions";
import { theme } from "@/constants/theme";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useChallengeGamesForDog } from "@/hooks/useGameCatalog";
import { useProfileDashboard } from "@/hooks/useProfileDashboard";
import { useWallet } from "@/hooks/useWallet";
import type {
  ChallengeGame,
  ChallengeGameDifficulty,
  OwnerTrainingGoal,
} from "@/types/domain";

type GameBucket = "available" | "soon" | "future";

const UNLOCK_LEVEL_BY_DIFFICULTY: Record<ChallengeGameDifficulty, number> = {
  easy: 1,
  medium: 5,
  hard: 10,
  featured: 20,
};

const UNLOCK_TONE_BY_DIFFICULTY: Record<
  ChallengeGameDifficulty,
  { bg: string; text: string; border: string }
> = {
  easy: {
    bg: theme.colors.primarySoft,
    text: theme.colors.primaryDark,
    border: theme.colors.primary + "55",
  },
  medium: {
    bg: theme.colors.accentSoft,
    text: "#7A5B00",
    border: "#D8A33E66",
  },
  hard: {
    bg: "#FFE8D6",
    text: "#B85C00",
    border: "#FFB07666",
  },
  featured: {
    bg: theme.colors.goldSoft,
    text: "#9A6200",
    border: theme.colors.gold + "66",
  },
};

const GAME_BUCKETS: {
  key: GameBucket;
  label: string;
  shortLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}[] = [
  {
    key: "available",
    label: "Available Now",
    shortLabel: "Available",
    icon: "play-circle-outline",
    title: "Available Now",
    subtitle: "Challenges your dog can try today",
  },
  {
    key: "soon",
    label: "Unlock Soon",
    shortLabel: "Soon",
    icon: "sparkles-outline",
    title: "Unlock Soon",
    subtitle: "Build your bond to open these challenges",
  },
  {
    key: "future",
    label: "Future Challenges",
    shortLabel: "Future",
    icon: "trophy-outline",
    title: "Future Challenges",
    subtitle: "More games unlock as your dog grows",
  },
];

const categoryTitle = (category: OwnerTrainingGoal) =>
  trainingGoalCategoryMap.get(category)?.title ??
  category
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");

const getErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "Games could not load.";

const getUnlockLevel = (game: ChallengeGame) =>
  UNLOCK_LEVEL_BY_DIFFICULTY[game.difficulty] ?? 1;

const sortGames = (a: ChallengeGame, b: ChallengeGame) => {
  const levelDiff = getUnlockLevel(a) - getUnlockLevel(b);
  if (levelDiff !== 0) return levelDiff;

  const costDiff =
    a.economy.silverCoinEntryCost - b.economy.silverCoinEntryCost;
  if (costDiff !== 0) return costDiff;

  return a.title.localeCompare(b.title);
};

const getNextUnlockLevel = (games: ChallengeGame[], bondLevel: number) => {
  const lockedLevels = games
    .map(getUnlockLevel)
    .filter((level) => level > bondLevel)
    .sort((a, b) => a - b);

  return lockedLevels[0] ?? null;
};

export default function GameTabScreen() {
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";

  const wallet = useWallet(dogId);
  const dashboard = useProfileDashboard(dogId);
  const challengeGames = useChallengeGamesForDog(dogId);

  const [selectedBucket, setSelectedBucket] =
    useState<GameBucket>("available");

  const games = challengeGames.data ?? [];

  if (
    dog.isLoading ||
    wallet.isLoading ||
    dashboard.isLoading ||
    challengeGames.isLoading
  ) {
    return (
      <ScreenContainer centered>
        <LoadingState message="Loading games..." />
      </ScreenContainer>
    );
  }

  if (challengeGames.error) {
    return (
      <ScreenContainer centered>
        <ErrorState
          message={getErrorMessage(challengeGames.error)}
          onRetry={() => {
            void challengeGames.refetch();
          }}
        />
      </ScreenContainer>
    );
  }

  const silver = wallet.data?.silverBalance ?? 0;
  const gold = wallet.data?.goldBalance ?? 0;
  const bondLevel = dashboard.data?.level ?? 1;

  const nextUnlockLevel = getNextUnlockLevel(games, bondLevel);

  const availableNow = games
    .filter((game) => getUnlockLevel(game) <= bondLevel)
    .sort(sortGames);

  const lockedGames = games
    .filter((game) => getUnlockLevel(game) > bondLevel)
    .sort(sortGames);

  const unlockSoon = lockedGames.slice(0, 3);
  const futureChallenges = lockedGames.slice(3, 6);

  const bucketCounts: Record<GameBucket, number> = {
    available: availableNow.length,
    soon: unlockSoon.length,
    future: futureChallenges.length,
  };

  const selectedGames =
    selectedBucket === "available"
      ? availableNow
      : selectedBucket === "soon"
        ? unlockSoon
        : futureChallenges;

  const selectedBucketMeta =
    GAME_BUCKETS.find((bucket) => bucket.key === selectedBucket) ??
    GAME_BUCKETS[0];

  return (
    <ScreenContainer scroll>
      
      <View style={styles.header}>
  <View style={styles.headerTitleRow}>
    <ProfileIconButton label={dog.data?.name} />

    <Text style={styles.title} numberOfLines={1}>
      Games
    </Text>
  </View>

  <Pressable
    style={styles.shopBtn}
    onPress={() => router.push("/rewards")}
    accessibilityRole="button"
    accessibilityLabel="Coupon shop"
  >
          <Ionicons
            name="ticket-outline"
            size={16}
            color={theme.colors.primaryDark}
          />
          <Text style={styles.shopBtnText}>Gold Shop</Text>
        </Pressable>
      </View>

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
            <Text style={[styles.walletAmount, styles.walletAmountGold]}>
              {gold.toLocaleString()}
            </Text>
            <Text style={styles.walletLabel}>Gold</Text>
          </View>
        </View>
      </View>

      <View style={styles.unlockHintCard}>
        <View>
          <Text style={styles.unlockHintLabel}>Bond Level</Text>
          <Text style={styles.unlockHintTitle}>Lv. {bondLevel}</Text>
        </View>

        <View style={styles.unlockHintDivider} />

        <View style={styles.unlockHintCopy}>
          {nextUnlockLevel ? (
            <>
              <Text style={styles.unlockHintMain}>
                Next games unlock at Lv. {nextUnlockLevel}
              </Text>
              <Text style={styles.unlockHintSub}>
                Train and Care to build your bond.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.unlockHintMain}>
                All current games unlocked
              </Text>
              <Text style={styles.unlockHintSub}>
                Keep playing to earn more Gold.
              </Text>
            </>
          )}
        </View>
      </View>

      {games.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="game-controller-outline"
              size={32}
              color={theme.colors.textMuted}
            />
          </View>
          <Text style={styles.emptyTitle}>No games yet for your goals</Text>
          <Text style={styles.emptyBody}>
            Complete training activities to unlock challenge games based on your
            dog&apos;s selected goals.
          </Text>
        </View>
      ) : null}

      {games.length > 0 ? (
        <>
          <View style={styles.bucketTabs}>
            {GAME_BUCKETS.map((bucket) => {
              const selected = selectedBucket === bucket.key;

              return (
                <Pressable
                  key={bucket.key}
                  style={[styles.bucketTab, selected && styles.bucketTabActive]}
                  onPress={() => setSelectedBucket(bucket.key)}
                  accessibilityRole="button"
                  accessibilityLabel={bucket.label}
                >
                  <Text
                    style={[
                      styles.bucketTabText,
                      selected && styles.bucketTabTextActive,
                    ]}
                  >
                    {bucket.shortLabel}
                  </Text>

                  <View
                    style={[
                      styles.bucketCount,
                      selected && styles.bucketCountActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bucketCountText,
                        selected && styles.bucketCountTextActive,
                      ]}
                    >
                      {bucketCounts[bucket.key]}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {selectedGames.length > 0 ? (
            <GameSection
              icon={selectedBucketMeta.icon}
              title={selectedBucketMeta.title}
              subtitle={selectedBucketMeta.subtitle}
              count={selectedGames.length}
            >
              {selectedGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  silver={silver}
                  bondLevel={bondLevel}
                  onStart={() => router.push(`/game/${game.id}`)}
                  onEarnSilver={() => router.push("/train")}
                  muted={selectedBucket === "future"}
                />
              ))}
            </GameSection>
          ) : (
            <View style={styles.emptyBucketCard}>
              <Ionicons
                name="paw-outline"
                size={28}
                color={theme.colors.textMuted}
              />
              <Text style={styles.emptyBucketTitle}>No challenges here yet</Text>
              <Text style={styles.emptyBucketBody}>
                Keep training and caring for your dog to open more challenges.
              </Text>
            </View>
          )}
        </>
      ) : null}

      <View style={styles.howCard}>
        <Text style={styles.howTitle}>How It Works</Text>

        <View style={styles.howStep}>
          <View
            style={[styles.howNum, { backgroundColor: theme.colors.silverSoft }]}
          >
            <Text style={[styles.howNumText, { color: theme.colors.silver }]}>
              1
            </Text>
          </View>
          <Text style={styles.howBody}>Earn Silver from Train and Care</Text>
        </View>

        <View style={styles.howStep}>
          <View
            style={[
              styles.howNum,
              { backgroundColor: theme.colors.primarySoft },
            ]}
          >
            <Text
              style={[styles.howNumText, { color: theme.colors.primaryDark }]}
            >
              2
            </Text>
          </View>
          <Text style={styles.howBody}>Spend Silver to enter a challenge</Text>
        </View>

        <View style={styles.howStep}>
          <View
            style={[styles.howNum, { backgroundColor: theme.colors.goldSoft }]}
          >
            <Text style={[styles.howNumText, { color: theme.colors.gold }]}>
              3
            </Text>
          </View>
          <Text style={styles.howBody}>Pass the challenge to win Gold</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const GameSection = ({
  icon,
  title,
  subtitle,
  count,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  count: number;
  children: ReactNode;
}) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={15} color={theme.colors.primaryDark} />
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.sectionCount}>
        <Text style={styles.sectionCountText}>{count}</Text>
      </View>
    </View>

    <View style={styles.sectionList}>{children}</View>
  </View>
);

const GameCard = ({
  game,
  silver,
  bondLevel,
  onStart,
  onEarnSilver,
  muted = false,
}: {
  game: ChallengeGame;
  silver: number;
  bondLevel: number;
  onStart: () => void;
  onEarnSilver: () => void;
  muted?: boolean;
}) => {
  const requiredLevel = getUnlockLevel(game);
  const isLevelLocked = bondLevel < requiredLevel;
  const canAfford = silver >= game.economy.silverCoinEntryCost;
  const isPlayable = !isLevelLocked && canAfford;

  const tone = UNLOCK_TONE_BY_DIFFICULTY[game.difficulty];

  const levelsToUnlock = Math.max(requiredLevel - bondLevel, 0);
  const unlockProgress =
    requiredLevel <= 1 ? 1 : Math.min(bondLevel / requiredLevel, 1);

  const actionLabel = isLevelLocked
    ? `Lv. ${requiredLevel} needed`
    : canAfford
      ? "Start"
      : "Earn Silver";

  const actionIcon = isLevelLocked
    ? "lock-closed-outline"
    : canAfford
      ? "play"
      : "arrow-forward-outline";

  const handlePress = () => {
    if (isPlayable) {
      onStart();
      return;
    }

    onEarnSilver();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.gameCard,
        muted && styles.gameCardMuted,
        pressed && { opacity: 0.9 },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${game.title}. ${actionLabel}`}
    >
      <View style={styles.gameCardTop}>
        <View
          style={[
            styles.unlockBadge,
            { backgroundColor: tone.bg, borderColor: tone.border },
          ]}
        >
          <Text style={[styles.unlockBadgeText, { color: tone.text }]}>
            {isLevelLocked ? `Unlocks Lv. ${requiredLevel}` : "Available"}
          </Text>
        </View>

        <View style={styles.entryCostRow}>
          <Ionicons name="cash-outline" size={12} color={theme.colors.silver} />
          <Text style={styles.entryCostText}>
            {game.economy.silverCoinEntryCost} Silver
          </Text>
        </View>
      </View>

      <Text style={styles.gameTitle}>{game.title}</Text>

      <Text style={styles.gameSub} numberOfLines={2}>
        {game.subtitle}
      </Text>

      <Text style={styles.categoryText} numberOfLines={1}>
        {categoryTitle(game.category)}
      </Text>

      {isLevelLocked ? (
        <View style={styles.unlockProgressWrap}>
          <View style={styles.unlockProgressTop}>
            <Text style={styles.unlockProgressText}>
              Bond Lv. {bondLevel} / {requiredLevel}
            </Text>
            <Text style={styles.unlockProgressText}>
              {levelsToUnlock} level{levelsToUnlock === 1 ? "" : "s"} to go
            </Text>
          </View>

          <View style={styles.unlockTrack}>
            <View
              style={[
                styles.unlockFill,
                { width: `${Math.round(unlockProgress * 100)}%` },
              ]}
            />
          </View>

          <Text style={styles.lockHint}>
            Train and Care to unlock this challenge.
          </Text>
        </View>
      ) : null}

      <View style={styles.gameCardBottom}>
        <View style={styles.clipRow}>
          <Ionicons
            name="videocam-outline"
            size={13}
            color={theme.colors.textMuted}
          />
          <Text style={styles.clipText}>
            {game.clipDurationSeconds.min}–{game.clipDurationSeconds.max}s
          </Text>
        </View>

        <View style={styles.passRow}>
          <GoldBar size={13} />
          <Text style={styles.passText}>
            +{game.economy.goldCoinPassReward} Gold
          </Text>
        </View>

        <View
          style={[
            styles.startBtn,
            !isPlayable && styles.startBtnSecondary,
            isLevelLocked && styles.startBtnLocked,
          ]}
        >
          <Ionicons
            name={actionIcon}
            size={13}
            color={isPlayable ? theme.colors.white : theme.colors.primaryDark}
          />
          <Text
            style={[
              styles.startBtnText,
              !isPlayable && styles.startBtnTextSecondary,
            ]}
          >
            {actionLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  header: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing.sm,
  paddingBottom: theme.spacing.md,
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: theme.colors.border,
},

headerTitleRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: theme.spacing.sm,
  flex: 1,
  minWidth: 0,
},

title: {
  fontSize: 20,
  fontWeight: "900",
  color: theme.colors.text,
  letterSpacing: -0.4,
},
  shopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexShrink: 0,
  },
  shopBtnText: {
    fontSize: theme.typography.xs,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },

  walletRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    alignItems: "stretch",
  },
  walletCard: {
    minWidth: 112,
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.silverSoft,
    borderRadius: theme.radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  walletCardGold: {
    backgroundColor: theme.colors.goldSoft,
  },
  walletCopy: {
    gap: 1,
  },
  walletAmount: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.silver,
  },
  walletAmountGold: {
    color: theme.colors.gold,
  },
  walletLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.textMuted,
  },

  unlockHintCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  unlockHintLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  unlockHintTitle: {
    color: theme.colors.primaryDark,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  unlockHintDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: theme.colors.border,
  },
  unlockHintCopy: {
    flex: 1,
    gap: 3,
  },
  unlockHintMain: {
    color: theme.colors.text,
    fontSize: theme.typography.sm,
    fontWeight: "900",
  },
  unlockHintSub: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.xs,
    lineHeight: 17,
  },

  bucketTabs: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  bucketTab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flex: 1,
  },
  bucketTabActive: {
    backgroundColor: theme.colors.primaryDark,
    borderColor: theme.colors.primaryDark,
  },
  bucketTabText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.xs,
    fontWeight: "900",
  },
  bucketTabTextActive: {
    color: theme.colors.white,
  },
  bucketCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.cardMuted,
    paddingHorizontal: 5,
  },
  bucketCountActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  bucketCountText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
  },
  bucketCountTextActive: {
    color: theme.colors.white,
  },

  emptyCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.md,
    ...theme.shadows.soft,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.cardMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: theme.typography.md,
    fontWeight: "900",
    color: theme.colors.text,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: theme.typography.sm,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyBucketCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.sm,
    ...theme.shadows.soft,
  },
  emptyBucketTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.md,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyBucketBody: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sm,
    lineHeight: 20,
    textAlign: "center",
  },

  section: {
    gap: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionCopy: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.xs,
  },
  sectionCount: {
    borderRadius: 99,
    backgroundColor: theme.colors.primarySoft,
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },
  sectionList: {
    gap: theme.spacing.md,
  },

  gameCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: 10,
    ...theme.shadows.soft,
  },
  gameCardMuted: {
    opacity: 0.72,
  },
  gameCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  unlockBadge: {
    borderRadius: theme.radii.pill,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  unlockBadgeText: {
    fontSize: theme.typography.xs,
    fontWeight: "900",
  },
  entryCostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  entryCostText: {
    fontSize: theme.typography.xs,
    fontWeight: "800",
    color: theme.colors.silver,
  },
  gameTitle: {
    fontSize: theme.typography.md,
    fontWeight: "900",
    color: theme.colors.text,
  },
  gameSub: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    lineHeight: 17,
  },
  categoryText: {
    color: theme.colors.primaryDark,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  unlockProgressWrap: {
    backgroundColor: theme.colors.cardMuted,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    gap: 7,
  },
  unlockProgressTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  unlockProgressText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
  },
  unlockTrack: {
    height: 7,
    backgroundColor: theme.colors.border,
    borderRadius: 99,
    overflow: "hidden",
  },
  unlockFill: {
    height: "100%",
    backgroundColor: theme.colors.primary,
    borderRadius: 99,
  },
  lockHint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },

  gameCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: 2,
  },
  clipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  clipText: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    fontWeight: "700",
  },
  passRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexGrow: 1,
    minWidth: 88,
  },
  passText: {
    fontSize: theme.typography.xs,
    fontWeight: "800",
    color: theme.colors.gold,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primaryDark,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  startBtnSecondary: {
    backgroundColor: theme.colors.primarySoft,
  },
  startBtnLocked: {
    backgroundColor: theme.colors.cardMuted,
  },
  startBtnText: {
    fontSize: theme.typography.xs,
    fontWeight: "900",
    color: "#fff",
  },
  startBtnTextSecondary: {
    color: theme.colors.primaryDark,
  },

  howCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.soft,
  },
  howTitle: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.text,
  },
  howStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  howNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  howNumText: {
    fontSize: theme.typography.xs,
    fontWeight: "900",
  },
  howBody: {
    flex: 1,
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    lineHeight: 18,
    paddingTop: 4,
  },
});