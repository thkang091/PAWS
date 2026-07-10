import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { theme } from "@/constants/theme";
import { useTournamentEvent, useTournamentLeaderboard } from "@/hooks/useTournaments";

const MEDAL_COLORS: Record<number, string> = {
  1: theme.colors.gold,
  2: theme.colors.silver,
  3: "#CD7F32",
};

const MEDAL_ICONS: Record<number, keyof typeof Ionicons.glyphMap> = {
  1: "medal-outline",
  2: "medal-outline",
  3: "medal-outline",
};

const LEADERBOARD_LABEL: Record<string, string> = {
  active: "Live Leaderboard",
  reviewing: "Provisional Leaderboard",
  settled: "Final Results",
};

export default function TournamentLeaderboardScreen() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();

  const tournament = useTournamentEvent(tournamentId);
  const { data: rows, isLoading, isRefetching, refetch, error } =
    useTournamentLeaderboard(tournamentId);

  const t = tournament.data;
  const leaderboardLabel =
    LEADERBOARD_LABEL[t?.status ?? ""] ?? "Leaderboard";

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredContainer}>
          <LoadingState message="Loading leaderboard..." />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredContainer}>
          <ErrorState
            message="Leaderboard could not load."
            onRetry={() => void refetch()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const leaderboard = rows ?? [];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
          }
        >
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
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>{t?.title ?? "Tournament"}</Text>
              <Text style={styles.headerSub}>{leaderboardLabel}</Text>
            </View>
          </View>

          {leaderboard.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="trophy-outline" size={32} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>No results yet</Text>
              <Text style={styles.emptyBody}>
                The leaderboard will appear once participants submit their attempts.
              </Text>
            </View>
          ) : (
            <>
              {/* Top 3 Podium */}
              {leaderboard.length >= 3 ? (
                <View style={styles.podium}>
                  {/* 2nd Place */}
                  <View style={styles.podiumCol}>
                    <View style={[styles.podiumMedal, { backgroundColor: `${MEDAL_COLORS[2]}22` }]}>
                      <Ionicons name={MEDAL_ICONS[2]} size={24} color={MEDAL_COLORS[2]} />
                    </View>
                    <Text style={styles.podiumName} numberOfLines={1}>{leaderboard[1].dogName}</Text>
                    <Text style={[styles.podiumScore, { color: MEDAL_COLORS[2] }]}>{leaderboard[1].score.toFixed(1)}</Text>
                    <View style={styles.podiumRank}>
                      <Text style={[styles.podiumRankText, { color: MEDAL_COLORS[2] }]}>2</Text>
                    </View>
                  </View>

                  {/* 1st Place */}
                  <View style={[styles.podiumCol, styles.podiumColFirst]}>
                    <View style={[styles.podiumMedal, styles.podiumMedalFirst, { backgroundColor: `${MEDAL_COLORS[1]}22` }]}>
                      <Ionicons name="trophy" size={32} color={MEDAL_COLORS[1]} />
                    </View>
                    <Text style={styles.podiumName} numberOfLines={1}>{leaderboard[0].dogName}</Text>
                    <Text style={[styles.podiumScore, { color: MEDAL_COLORS[1] }]}>{leaderboard[0].score.toFixed(1)}</Text>
                    <View style={styles.podiumRank}>
                      <Text style={[styles.podiumRankText, { color: MEDAL_COLORS[1] }]}>1</Text>
                    </View>
                  </View>

                  {/* 3rd Place */}
                  <View style={styles.podiumCol}>
                    <View style={[styles.podiumMedal, { backgroundColor: `${MEDAL_COLORS[3]}22` }]}>
                      <Ionicons name={MEDAL_ICONS[3]} size={24} color={MEDAL_COLORS[3]} />
                    </View>
                    <Text style={styles.podiumName} numberOfLines={1}>{leaderboard[2].dogName}</Text>
                    <Text style={[styles.podiumScore, { color: MEDAL_COLORS[3] }]}>{leaderboard[2].score.toFixed(1)}</Text>
                    <View style={styles.podiumRank}>
                      <Text style={[styles.podiumRankText, { color: MEDAL_COLORS[3] }]}>3</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Full Ranked List */}
              <View style={styles.listCard}>
                <Text style={styles.listTitle}>
                  {t?.status === "settled" ? "Final Rankings" : "Rankings"}
                </Text>

                <View style={styles.list}>
                  {leaderboard.map((row, index) => {
                    const medalColor = MEDAL_COLORS[row.rank] ?? undefined;
                    const showMedal = row.rank <= 3;

                    return (
                      <View
                        key={row.entryId}
                        style={[
                          styles.listRow,
                          row.isCurrentUser && styles.listRowHighlight,
                          index === leaderboard.length - 1 && styles.listRowLast,
                        ]}
                      >
                        <View style={[styles.listRank, showMedal && { backgroundColor: `${medalColor}22` }]}>
                          <Text style={[styles.listRankText, showMedal && { color: medalColor }]}>
                            {row.rank}
                          </Text>
                        </View>

                        <View style={styles.listCenter}>
                          <Text style={[styles.listDogName, row.isCurrentUser && styles.listDogNameHighlight]} numberOfLines={1}>
                            {row.dogName}{row.isCurrentUser ? " (you)" : ""}
                          </Text>
                          <Text style={styles.listDate}>
                            {new Date(row.submittedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </Text>
                        </View>

                        <Text style={[styles.listScore, showMedal && { color: medalColor }]}>
                          {row.score.toFixed(1)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Footer note */}
              <Text style={styles.footerNote}>
                Tournament results and prize settlement are handled by the backend.
                The mobile app never awards prizes directly.
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
  },
  scrollContent: {
    flexGrow: 1,
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
  },
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
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.colors.text,
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: theme.typography.xs,
    fontWeight: "800",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  podium: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  podiumCol: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: theme.spacing.md,
  },
  podiumColFirst: {
    paddingBottom: theme.spacing.lg,
  },
  podiumMedal: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  podiumMedalFirst: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  podiumName: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.text,
    textAlign: "center",
  },
  podiumScore: {
    fontSize: theme.typography.md,
    fontWeight: "900",
  },
  podiumRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.cardMuted,
  },
  podiumRankText: {
    fontSize: theme.typography.xs,
    fontWeight: "900",
  },
  listCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  listTitle: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  list: {
    gap: 1,
    backgroundColor: theme.colors.border,
    borderRadius: theme.radii.md,
    overflow: "hidden",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  listRowHighlight: {
    backgroundColor: theme.colors.primarySoft,
  },
  listRowLast: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  listRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  listRankText: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.textMuted,
  },
  listCenter: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  listDogName: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.text,
  },
  listDogNameHighlight: {
    color: theme.colors.primaryDark,
  },
  listDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: "600",
  },
  listScore: {
    fontSize: theme.typography.md,
    fontWeight: "900",
    color: theme.colors.text,
    minWidth: 48,
    textAlign: "right",
  },
  footerNote: {
    fontSize: theme.typography.xs,
    color: theme.colors.textSubtle,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: theme.spacing.md,
  },
  emptyCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.md,
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
});