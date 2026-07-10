import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";

import {
  TournamentEntryCTA,
  TournamentLeaderboardPreview,
  TournamentPrizeRow,
  TournamentStatusPill,
} from "@/components/game/tournament";
import { ErrorState } from "@/components/ui/ErrorState";
import { GoldBar } from "@/components/ui/GoldBar";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { theme } from "@/constants/theme";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import {
  useJoinTournamentMutation,
  useMyTournamentEntry,
  useTournamentEvent,
  useTournamentLeaderboard,
} from "@/hooks/useTournaments";
import { useWallet } from "@/hooks/useWallet";

export default function TournamentDetailScreen() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();

  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";

  const tournament = useTournamentEvent(tournamentId);
  const wallet = useWallet(dogId);
  const entry = useMyTournamentEntry(tournamentId, dogId);
  const leaderboard = useTournamentLeaderboard(tournamentId);
  const joinMutation = useJoinTournamentMutation();

  const [joinFeedback, setJoinFeedback] = useState<string | null>(null);

  const t = tournament.data;

  const isLoading =
    tournament.isLoading || wallet.isLoading || entry.isLoading;
  const hasError = tournament.error;

  const handleJoin = async () => {
    if (!t || !dogId) return;
    setJoinFeedback(null);
    const result = await joinMutation.mutateAsync({ tournamentId: t.id, dogId });
    if ("error" in result) {
      setJoinFeedback(result.error);
    }
  };

  const formatDateFull = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <ScreenContainer centered>
        <LoadingState message="Loading tournament..." />
      </ScreenContainer>
    );
  }

  if (hasError || !t) {
    return (
      <ScreenContainer centered>
        <ErrorState
          message={tournament.error instanceof Error ? tournament.error.message : "Tournament not found."}
          onRetry={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenContainer scroll>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Tournament</Text>
        </View>

        {/* ── Overview ── */}
        <View style={styles.sectionLabel}>
          <Ionicons name="information-circle-outline" size={14} color={theme.colors.primaryDark} />
          <Text style={styles.sectionLabelText}>Overview</Text>
        </View>

        <View style={styles.heroCard}>
          <TournamentStatusPill status={t.status} />

          <Text style={styles.heroTitle}>{t.title}</Text>
          <Text style={styles.heroSub}>{t.description}</Text>

          <View style={styles.heroMeta}>
            <View style={styles.metaPill}>
              <Ionicons name="people-outline" size={13} color={theme.colors.textMuted} />
              <Text style={styles.metaPillText}>
                {t.participantCount}/{t.maxParticipants} entered
              </Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons
                name={t.entryCurrency === "gold" ? "trophy-outline" : "cash-outline"}
                size={13}
                color={theme.colors.textMuted}
              />
              <Text style={styles.metaPillText}>
                {t.entryCost} {t.entryCurrency === "gold" ? "Gold" : "Silver"} entry
              </Text>
            </View>
          </View>
        </View>

        {/* ── Schedule ── */}
        <View style={styles.sectionLabel}>
          <Ionicons name="calendar-outline" size={14} color={theme.colors.primaryDark} />
          <Text style={styles.sectionLabelText}>Schedule</Text>
        </View>

        <View style={styles.timingCard}>
          <View style={styles.timingRow}>
            <Ionicons name="calendar-outline" size={15} color={theme.colors.primaryDark} />
            <View style={styles.timingCopy}>
              <Text style={styles.timingLabel}>Registration</Text>
              <Text style={styles.timingValue}>
                {formatDateFull(t.registrationOpensAt)} – {formatDateFull(t.registrationClosesAt)}
              </Text>
            </View>
          </View>
          <View style={styles.timingRow}>
            <Ionicons name="timer-outline" size={15} color={theme.colors.accent} />
            <View style={styles.timingCopy}>
              <Text style={styles.timingLabel}>Competition Active</Text>
              <Text style={styles.timingValue}>
                {formatDateFull(t.startsAt)} – {formatDateFull(t.endsAt)}
              </Text>
            </View>
          </View>
          <View style={styles.timingRow}>
            <Ionicons name="repeat-outline" size={15} color={theme.colors.textMuted} />
            <View style={styles.timingCopy}>
              <Text style={styles.timingLabel}>Max Attempts</Text>
              <Text style={styles.timingValue}>
                {t.maxAttemptsPerEntry} per entry
              </Text>
            </View>
          </View>
        </View>

        {/* ── Entry ── */}
        <View style={styles.sectionLabel}>
          <Ionicons name="enter-outline" size={14} color={theme.colors.primaryDark} />
          <Text style={styles.sectionLabelText}>Entry</Text>
        </View>

        {/* Entry CTA */}
        <TournamentEntryCTA
          tournament={t}
          entry={entry.data ?? null}
          onJoin={handleJoin}
        />

        {/* Join feedback */}
        {joinFeedback ? (
          <View style={styles.feedbackCard}>
            <Ionicons name="information-circle-outline" size={18} color={theme.colors.warning} />
            <Text style={styles.feedbackText}>{joinFeedback}</Text>
          </View>
        ) : null}

        {/* Actions when active and entered */}
        {t.status === "active" && entry.data ? (
          <Pressable
            style={styles.submitBtn}
            onPress={() => {
              // TODO: Route to challenge recording flow (Phase 2).
              //   Reuse the existing game/[gameId]/play flow, creating a
              //   tournament_attempts row on submission.
              //   Do NOT route into recording unless the app has a safe
              //   tournament context mechanism.
              setJoinFeedback(
                "Tournament submissions will connect to the existing challenge recording flow in Phase 2.",
              );
            }}
            accessibilityRole="button"
          >
            <Ionicons name="videocam-outline" size={18} color={theme.colors.white} />
            <Text style={styles.submitBtnText}>Submit Attempt</Text>
          </Pressable>
        ) : null}

        {/* ── Prizes ── */}
        <View style={styles.sectionLabel}>
          <GoldBar size={12} />
          <Text style={styles.sectionLabelText}>Prizes</Text>
        </View>

        <View style={styles.sectionCard}>
          <TournamentPrizeRow
            prizeFirst={t.prizeFirst}
            prizeSecond={t.prizeSecond}
            prizeThird={t.prizeThird}
          />
        </View>

        {/* ── Leaderboard Preview ── */}
        <View style={styles.sectionLabel}>
          <Ionicons name="trophy-outline" size={14} color={theme.colors.gold} />
          <Text style={styles.sectionLabelText}>Leaderboard</Text>
        </View>

        <View style={styles.sectionCard}>
          <TournamentLeaderboardPreview rows={leaderboard.data ?? []} />

          <Pressable
            style={styles.fullLeaderboardBtn}
            onPress={() =>
              router.push(
                `/game/tournament/${t.id}/leaderboard`,
              )
            }
            accessibilityRole="button"
            accessibilityLabel="View full leaderboard"
          >
            <Text style={styles.fullLeaderboardBtnText}>
              View Full Leaderboard
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={theme.colors.primaryDark}
            />
          </Pressable>
        </View>

        {/* ── How It Works / Rules ── */}
        <View style={styles.sectionLabel}>
          <Ionicons name="information-circle-outline" size={14} color={theme.colors.primaryDark} />
          <Text style={styles.sectionLabelText}>How It Works</Text>
        </View>

        <View style={styles.rulesCard}>
          <View style={styles.ruleStep}>
            <View style={[styles.ruleNum, { backgroundColor: theme.colors.primarySoft }]}>
              <Text style={[styles.ruleNumText, { color: theme.colors.primaryDark }]}>1</Text>
            </View>
            <Text style={styles.ruleBody}>
              <Text style={styles.ruleBold}>Join during registration.</Text>{' '}
              Pay the entry fee and secure your spot before registration closes.
            </Text>
          </View>

          <View style={styles.ruleStep}>
            <View style={[styles.ruleNum, { backgroundColor: theme.colors.accentSoft }]}>
              <Text style={[styles.ruleNumText, { color: "#6B6B00" }]}>2</Text>
            </View>
            <Text style={styles.ruleBody}>
              <Text style={styles.ruleBold}>Submit your best attempt</Text>{' '}
              during the active competition period. You can submit up to{' '}
              {t.maxAttemptsPerEntry} times.
            </Text>
          </View>

          <View style={styles.ruleStep}>
            <View style={[styles.ruleNum, { backgroundColor: theme.colors.goldSoft }]}>
              <Text style={[styles.ruleNumText, { color: theme.colors.gold }]}>3</Text>
            </View>
            <Text style={styles.ruleBody}>
              <Text style={styles.ruleBold}>Best verified score counts.</Text>{' '}
              Only your highest-scoring attempt is used for ranking.
            </Text>
          </View>

          <View style={styles.ruleStep}>
            <View style={[styles.ruleNum, { backgroundColor: theme.colors.successSoft }]}>
              <Text style={[styles.ruleNumText, { color: theme.colors.success }]}>4</Text>
            </View>
            <Text style={styles.ruleBody}>
              <Text style={styles.ruleBold}>Top 3 win prizes.</Text>{' '}
              Gold and badges are awarded to the highest-ranked participants.
            </Text>
          </View>

          <View style={styles.ruleStep}>
            <View style={[styles.ruleNum, { backgroundColor: theme.colors.warningSoft }]}>
              <Text style={[styles.ruleNumText, { color: theme.colors.warning }]}>5</Text>
            </View>
            <Text style={styles.ruleBody}>
              <Text style={styles.ruleBold}>Scores are reviewed.</Text>{' '}
              PAWS admin reviews results before prizes are settled. Results are
              final once published.
            </Text>
          </View>
        </View>

        {/* Footer note */}
        <Text style={styles.footerNote}>
          Tournament results and prize settlement are handled by the backend.
          The mobile app never awards prizes directly.
        </Text>
      </ScreenContainer>
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
  timingCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.soft,
  },
  timingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  timingCopy: {
    flex: 1,
    gap: 1,
  },
  timingLabel: {
    fontSize: theme.typography.xs,
    fontWeight: "800",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  timingValue: {
    fontSize: theme.typography.sm,
    fontWeight: "700",
    color: theme.colors.text,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.soft,
  },
  sectionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionLabelText: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rulesCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.soft,
  },
  ruleStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  ruleNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  ruleNumText: {
    fontSize: theme.typography.xs,
    fontWeight: "900",
  },
  ruleBody: {
    flex: 1,
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    lineHeight: 18,
    paddingTop: 4,
  },
  ruleBold: {
    fontWeight: "900",
    color: theme.colors.text,
  },
  feedbackCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.warningSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.warning,
  },
  feedbackText: {
    flex: 1,
    fontSize: theme.typography.xs,
    color: theme.colors.warning,
    fontWeight: "800",
    lineHeight: 17,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primaryDark,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: 14,
    ...theme.shadows.soft,
  },
  submitBtnText: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.white,
  },
  fullLeaderboardBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    marginTop: theme.spacing.xs,
  },
  fullLeaderboardBtnText: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },
  footerNote: {
    fontSize: theme.typography.xs,
    color: theme.colors.textSubtle,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: theme.spacing.md,
  },
});
