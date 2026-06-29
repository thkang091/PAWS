//게임 상세/입장 화면
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";

import { GoldBar } from "@/components/ui/GoldBar";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useChallengeGamesForDog } from "@/hooks/useGameCatalog";
import { useWallet } from "@/hooks/useWallet";
import { useQueryClient } from "@tanstack/react-query";
import { SilverNoticeModal } from "@/components/game/SilverNoticeModal";
import { queryKeys } from "@/constants/queryKeys";
import { startChallengeGameAttempt } from "@/services/gameService";

const DIFF_COLORS: Record<string, { bg: string; text: string }> = {
  easy: { bg: theme.colors.primarySoft, text: theme.colors.primaryDark },
  medium: { bg: theme.colors.accentSoft, text: "#6B6B00" },
  hard: { bg: "#FFE8D6", text: "#B85C00" },
  featured: { bg: theme.colors.goldSoft, text: "#9A6200" },
};

const formatDifficulty = (difficulty: string) =>
  difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

export default function ChallengeGameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();

  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";

  const wallet = useWallet(dogId);
  const games = useChallengeGamesForDog(dogId);

  const queryClient = useQueryClient();

const [chargingEntry, setChargingEntry] = useState(false);
const [silverNoticeVisible, setSilverNoticeVisible] = useState(false);

  const game = (games.data ?? []).find((g) => g.id === gameId);

  if (dog.isLoading || games.isLoading || wallet.isLoading) {
    return (
      <ScreenContainer centered>
        <LoadingState message="Loading challenge..." />
      </ScreenContainer>
    );
  }

  if (!game) {
    return (
      <ScreenContainer centered>
        <ErrorState
          message="Challenge not found."
          onRetry={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  const silver = wallet.data?.silverBalance ?? 0;
  const canAfford = silver >= game.economy.silverCoinEntryCost;
  const diff = DIFF_COLORS[game.difficulty] ?? DIFF_COLORS.easy;

  const howToPlay =
    game.userInstructions.length > 0
      ? game.userInstructions.slice(0, 3)
      : [
          "Place your dog fully inside the camera view.",
          "Follow the on-screen instruction.",
          "Keep your dog visible until the challenge ends.",
        ];

  const handlePractice = () => {
    router.push(`/game/${game.id}/play?mode=practice`);
  };

  const handleStartChallenge = async () => {
  if (chargingEntry) return;

  if (!canAfford) {
    setSilverNoticeVisible(true);
    return;
  }

  try {
    setChargingEntry(true);

    await startChallengeGameAttempt(dogId, game.id);

    await queryClient.invalidateQueries({
      queryKey: queryKeys.wallet(dogId),
    });

    router.push(`/game/${game.id}/play?mode=challenge`);
  } catch (error) {
  const message =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : "Could not start this challenge.";

  console.warn("Failed to start challenge attempt:", message);

  setSilverNoticeVisible(true);
} finally {
  setChargingEntry(false);
}
};

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

        <Text style={styles.headerTitle}>Challenge</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={[styles.diffChip, { backgroundColor: diff.bg }]}>
            <Text style={[styles.diffChipText, { color: diff.text }]}>
              {formatDifficulty(game.difficulty)}
            </Text>
          </View>

          <View style={styles.costChip}>
            <Ionicons name="cash-outline" size={13} color={theme.colors.silver} />
            <Text style={styles.costChipText}>
              {game.economy.silverCoinEntryCost} silver
            </Text>
          </View>

          <View style={styles.goldChip}>
            <GoldBar size={13} />
            <Text style={styles.goldChipText}>
              Up to +{game.economy.goldCoinPassReward} gold
            </Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>{game.title}</Text>
        <Text style={styles.heroSub}>{game.subtitle}</Text>

        <View style={styles.heroMeta}>
          <View style={styles.metaPill}>
            <Ionicons
              name="videocam-outline"
              size={13}
              color={theme.colors.textMuted}
            />
            <Text style={styles.metaPillText}>
              {game.clipDurationSeconds.min}–{game.clipDurationSeconds.max}s
            </Text>
          </View>

          <View style={styles.metaPill}>
            <Ionicons
              name="camera-outline"
              size={13}
              color={theme.colors.textMuted}
            />
            <Text style={styles.metaPillText}>Live camera</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>How to play</Text>

        {howToPlay.map((instruction, index) => (
          <View key={`${instruction}-${index}`} style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{index + 1}</Text>
            </View>
            <Text style={styles.stepText}>{instruction}</Text>
          </View>
        ))}
      </View>

      <View style={styles.entryCard}>
        <View style={styles.entryTop}>
          <View>
            <Text style={styles.entryLabel}>Entry</Text>
            <Text style={styles.entryTitle}>
              {game.economy.silverCoinEntryCost} silver
            </Text>
          </View>

          <View
            style={[
              styles.balancePill,
              canAfford ? styles.balancePillOk : styles.balancePillLow,
            ]}
          >
            <Ionicons
              name={canAfford ? "checkmark" : "alert-circle-outline"}
              size={14}
              color={canAfford ? theme.colors.primaryDark : theme.colors.error}
            />
            <Text
              style={[
                styles.balancePillText,
                !canAfford && styles.balancePillTextLow,
              ]}
            >
              {canAfford ? `${silver} silver ready` : `Only ${silver} silver`}
            </Text>
          </View>
        </View>

        <Text style={styles.entryBody}>
          Practice mode is free. Challenge mode uses silver immediately and entry fees are non-refundable.
        </Text>
      </View>

      {(game.safetyNotes ?? []).length > 0 ? (
        <View style={styles.safetyCard}>
          <View style={styles.safetyTitleRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={theme.colors.warning}
            />
            <Text style={styles.safetyTitle}>Safety</Text>
          </View>

          {(game.safetyNotes ?? []).slice(0, 2).map((note, index) => (
            <Text key={`${note}-${index}`} style={styles.safetyText}>
              • {note}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.ctaRow}>
        <Pressable
          style={styles.practiceBtn}
          onPress={handlePractice}
          accessibilityRole="button"
        >
          <Ionicons
            name="refresh-outline"
            size={18}
            color={theme.colors.primaryDark}
          />
          <Text style={styles.practiceBtnText}>Practice</Text>
        </Pressable>

        <Pressable
          style={[styles.startBtn, !canAfford && styles.startBtnDisabled]}
          onPress={handleStartChallenge}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.startBtnText,
              !canAfford && styles.startBtnTextDisabled,
            ]}
          >
            {chargingEntry ? "Starting..." : canAfford ? "Start Challenge" : "Need Silver"}
          </Text>
          <Ionicons
            name={canAfford ? "arrow-forward" : "cash-outline"}
            size={18}
            color={canAfford ? theme.colors.white : theme.colors.textMuted}
          />
        </Pressable>
      </View>

      <Text style={styles.footerNote}>
        This demo opens the live camera with step-by-step instructions. Video
        upload, scoring, leaderboard, and gold settlement will be connected next.
      </Text>
    </ScreenContainer>

    <SilverNoticeModal
  visible={silverNoticeVisible}
  onClose={() => setSilverNoticeVisible(false)}
  title={canAfford ? "Could not start challenge" : "Not enough silver"}
  message={
    canAfford
      ? "This challenge could not be started yet. The backend may still require prerequisite training or game setup."
      : `You need ${game.economy.silverCoinEntryCost} silver to start this challenge.`
  }
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
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: theme.colors.text,
    letterSpacing: -0.5,
  },

  heroCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadows.soft,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  diffChip: {
    borderRadius: theme.radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  diffChipText: {
    fontSize: theme.typography.xs,
    fontWeight: "900",
  },
  costChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.silverSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  costChipText: {
    fontSize: theme.typography.xs,
    fontWeight: "800",
    color: theme.colors.silver,
  },
  goldChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.goldSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  goldChipText: {
    fontSize: theme.typography.xs,
    fontWeight: "800",
    color: theme.colors.gold,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.text,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  heroSub: {
    fontSize: theme.typography.sm,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  heroMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: 4,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: theme.colors.cardMuted,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaPillText: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    fontWeight: "700",
  },

  sectionCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.soft,
  },
  sectionTitle: {
    fontSize: theme.typography.md,
    fontWeight: "900",
    color: theme.colors.text,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: {
    fontSize: 11,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },
  stepText: {
    flex: 1,
    fontSize: theme.typography.sm,
    color: theme.colors.text,
    lineHeight: 20,
  },

  entryCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.soft,
  },
  entryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  entryLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  entryTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: theme.colors.text,
    letterSpacing: -0.4,
  },
  balancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexShrink: 0,
  },
  balancePillOk: {
    backgroundColor: theme.colors.primarySoft,
  },
  balancePillLow: {
    backgroundColor: theme.colors.errorSoft,
  },
  balancePillText: {
    fontSize: theme.typography.xs,
    color: theme.colors.primaryDark,
    fontWeight: "900",
  },
  balancePillTextLow: {
    color: theme.colors.error,
  },
  entryBody: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },

  safetyCard: {
    backgroundColor: theme.colors.warningSoft,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: "#FFD6A0",
  },
  safetyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  safetyTitle: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.warning,
  },
  safetyText: {
    fontSize: theme.typography.xs,
    color: "#7A3D00",
    lineHeight: 18,
  },

  ctaRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  practiceBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  practiceBtnText: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },
  startBtn: {
    flex: 1.25,
    minHeight: 54,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primaryDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  startBtnDisabled: {
    backgroundColor: theme.colors.cardMuted,
  },
  startBtnText: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.white,
  },
  startBtnTextDisabled: {
    color: theme.colors.textMuted,
  },
  footerNote: {
    fontSize: theme.typography.xs,
    color: theme.colors.textSubtle,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: theme.spacing.md,
  },
});