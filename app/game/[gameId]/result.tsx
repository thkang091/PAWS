//게임 결과 화면
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";

import { useQueryClient } from "@tanstack/react-query";

import { SilverNoticeModal } from "@/components/game/SilverNoticeModal";
import { LoadingState } from "@/components/ui/LoadingState";
import { queryKeys } from "@/constants/queryKeys";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useChallengeGamesForDog } from "@/hooks/useGameCatalog";
import { useWallet } from "@/hooks/useWallet";
import { startChallengeGameAttempt } from "@/services/gameService";

import { GoldBar } from "@/components/ui/GoldBar";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";
import {
  getChallengeResultConfigByGameId,
  getChallengeScoreByGameId,
  getGoldForScore,
} from "@/data/challengeGames/scripts";

export default function ChallengeResultScreen() {

    const dog = useCurrentDog();
const dogId = dog.data?.id ?? "";

const wallet = useWallet(dogId);
const games = useChallengeGamesForDog(dogId);
const queryClient = useQueryClient();

const [chargingRetry, setChargingRetry] = useState(false);
const [silverNoticeVisible, setSilverNoticeVisible] = useState(false);

const game = (games.data ?? []).find((item) => item.id === gameId);
  const { gameId, mode } = useLocalSearchParams<{
    gameId: string;
    mode?: string;
  }>();

  const resultConfig = getChallengeResultConfigByGameId(gameId);
  const isChallenge = mode === "challenge";

  const score = getChallengeScoreByGameId(gameId, mode);
  const goldEarned = getGoldForScore(score, mode);

  const silver = wallet.data?.silverBalance ?? 0;
const entryCost = game?.economy.silverCoinEntryCost ?? 10;
const canAffordRetry = silver >= entryCost;

if (dog.isLoading || wallet.isLoading || games.isLoading) {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenContainer centered>
        <LoadingState message="Loading result..." />
      </ScreenContainer>
    </>
  );
}

  const handleTryAgain = async () => {
  const retryMode = mode ?? "practice";

  if (retryMode !== "challenge") {
    router.replace(`/game/${gameId}/play?mode=practice`);
    return;
  }

  if (chargingRetry) return;

  if (!canAffordRetry) {
    setSilverNoticeVisible(true);
    return;
  }

  try {
    setChargingRetry(true);

    await startChallengeGameAttempt(dogId, gameId);

    await queryClient.invalidateQueries({
      queryKey: queryKeys.wallet(dogId),
    });

    router.replace(`/game/${gameId}/play?mode=challenge`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (
      message.toLowerCase().includes("silver") ||
      message.toLowerCase().includes("insufficient")
    ) {
      setSilverNoticeVisible(true);
      return;
    }

    console.warn("Failed to retry challenge attempt:", error);
    setSilverNoticeVisible(true);
  } finally {
    setChargingRetry(false);
  }
};

  const handleBackToGames = () => {
    router.replace("/game");
  };

  if (!isChallenge) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />

        <ScreenContainer scroll>
          <View style={styles.header}>
            <Pressable
              style={styles.backBtn}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </Pressable>

            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>Practice</Text>
              <Text style={styles.headerSub}>{resultConfig.title}</Text>
            </View>
          </View>

          <View style={styles.practiceCard}>
            <View style={styles.practiceIcon}>
              <Ionicons
                name="checkmark"
                size={46}
                color={theme.colors.primaryDark}
              />
            </View>

            <Text style={styles.practiceEyebrow}>Practice Complete</Text>
            <Text style={styles.practiceTitle}>{resultConfig.title}</Text>

            <Text style={styles.practiceBody}>
              Nice work. No silver was used and no score was submitted.
            </Text>
          </View>

          <View style={styles.ctaRow}>
            <Pressable
              style={styles.secondaryBtn}
              onPress={handleTryAgain}
              accessibilityRole="button"
            >
              <Ionicons
                name="refresh-outline"
                size={18}
                color={theme.colors.primaryDark}
              />
              <Text style={styles.secondaryBtnText}>Retry</Text>
            </Pressable>

            <Pressable
              style={styles.primaryBtn}
              onPress={handleBackToGames}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>Back to Games</Text>
            </Pressable>
          </View>
        </ScreenContainer>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenContainer scroll>
        <View style={styles.header}>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Result</Text>
            <Text style={styles.headerSub}>{resultConfig.title}</Text>
          </View>
        </View>

        <View style={styles.scoreCard}>
          <View style={styles.resultIcon}>
            <Ionicons
              name={score >= 90 ? "trophy" : "checkmark"}
              size={42}
              color={theme.colors.primaryDark}
            />
          </View>

          <Text style={styles.resultEyebrow}>Challenge Complete</Text>

          <Text style={styles.gameTitle}>{resultConfig.title}</Text>
          <Text style={styles.gameSummary}>{resultConfig.shortSummary}</Text>

          <View style={styles.scoreRow}>
            <Text style={styles.scoreText}>{score}</Text>
            <View style={styles.scoreCopy}>
              <Text style={styles.scoreLabel}>out of 100</Text>
              <Text style={styles.scoreMode}>Submitted score</Text>
            </View>
          </View>

          <View style={styles.scoreBar}>
            <View style={[styles.scoreFill, { width: `${score}%` }]} />
          </View>
        </View>

        <View style={styles.leaderboardCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons
              name="podium-outline"
              size={18}
              color={theme.colors.primaryDark}
            />
            <Text style={styles.sectionTitle}>Leaderboard preview</Text>
          </View>

          <View style={styles.leaderboardTop}>
            <View style={styles.leaderboardCopy}>
              <Text style={styles.leaderboardLabel}>
                {resultConfig.leaderboardLabel}
              </Text>
              <Text style={styles.leaderboardSub}>
                Current mock rank for this challenge.
              </Text>
            </View>

            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>
                #{resultConfig.mockRank}
              </Text>
            </View>
          </View>

          <View style={styles.tierRow}>
            <Text style={styles.tierLabel}>Mock reward tier</Text>
            <Text style={styles.tierValue}>{resultConfig.goldTierLabel}</Text>
          </View>
        </View>

        <View style={styles.rewardCard}>
          <Text style={styles.sectionTitle}>Reward</Text>

          <View style={styles.rewardRow}>
            <View style={styles.rewardLeft}>
              <GoldBar size={24} />
              <View>
                <Text style={styles.rewardTitle}>Gold earned</Text>
                <Text style={styles.rewardSub}>
                  Mock reward based on score tier
                </Text>
              </View>
            </View>

            <Text style={styles.goldAmount}>+{goldEarned}</Text>
          </View>
        </View>

        <View style={styles.ctaRow}>
          <Pressable
            style={styles.secondaryBtn}
            onPress={handleTryAgain}
            accessibilityRole="button"
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color={theme.colors.primaryDark}
            />
            <Text style={styles.secondaryBtnText}>
  {chargingRetry ? "Starting..." : "Try Again"}
</Text>
          </Pressable>

          <Pressable
            style={styles.primaryBtn}
            onPress={handleBackToGames}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>Back to Games</Text>
          </Pressable>
        </View>
      </ScreenContainer>

      <SilverNoticeModal
        visible={silverNoticeVisible}
        onClose={() => setSilverNoticeVisible(false)}
        message={`You need ${entryCost} silver to try this challenge again.`}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    fontWeight: "700",
  },

  practiceCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.md,
    ...theme.shadows.soft,
  },
  practiceIcon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
  },
  practiceEyebrow: {
    fontSize: theme.typography.xs,
    color: theme.colors.primaryDark,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  practiceTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: theme.colors.text,
    textAlign: "center",
    letterSpacing: -0.7,
  },
  practiceBody: {
    fontSize: theme.typography.sm,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },

  scoreCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.sm,
    ...theme.shadows.soft,
  },
  resultIcon: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
  },
  resultEyebrow: {
    fontSize: theme.typography.xs,
    color: theme.colors.primaryDark,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  gameTitle: {
    fontSize: 25,
    fontWeight: "900",
    color: theme.colors.text,
    textAlign: "center",
    letterSpacing: -0.6,
  },
  gameSummary: {
    fontSize: theme.typography.sm,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  scoreText: {
    fontSize: 72,
    fontWeight: "900",
    color: theme.colors.text,
    letterSpacing: -3,
    lineHeight: 78,
  },
  scoreCopy: {
    gap: 2,
  },
  scoreLabel: {
    fontSize: theme.typography.sm,
    color: theme.colors.textMuted,
    fontWeight: "800",
  },
  scoreMode: {
    fontSize: theme.typography.xs,
    color: theme.colors.primaryDark,
    fontWeight: "900",
  },
  scoreBar: {
    width: "100%",
    height: 10,
    borderRadius: 99,
    backgroundColor: theme.colors.cardMuted,
    overflow: "hidden",
    marginTop: theme.spacing.sm,
  },
  scoreFill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: theme.colors.primaryDark,
  },

  leaderboardCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.soft,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sectionTitle: {
    fontSize: theme.typography.md,
    fontWeight: "900",
    color: theme.colors.text,
  },
  leaderboardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  leaderboardCopy: {
    flex: 1,
    gap: 2,
  },
  leaderboardLabel: {
    fontSize: theme.typography.sm,
    color: theme.colors.text,
    fontWeight: "900",
  },
  leaderboardSub: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    lineHeight: 17,
  },
  rankBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: theme.colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rankBadgeText: {
    fontSize: theme.typography.md,
    fontWeight: "900",
    color: theme.colors.white,
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
  },
  tierLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    fontWeight: "800",
  },
  tierValue: {
    fontSize: theme.typography.xs,
    color: theme.colors.primaryDark,
    fontWeight: "900",
  },

  rewardCard: {
    backgroundColor: theme.colors.goldSoft,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  rewardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    flex: 1,
  },
  rewardTitle: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.text,
  },
  rewardSub: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    lineHeight: 17,
  },
  goldAmount: {
    fontSize: 34,
    fontWeight: "900",
    color: theme.colors.gold,
    letterSpacing: -1,
  },

  ctaRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryBtnText: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },
  primaryBtn: {
    flex: 1.25,
    minHeight: 54,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primaryDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  primaryBtnText: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.white,
  },
});