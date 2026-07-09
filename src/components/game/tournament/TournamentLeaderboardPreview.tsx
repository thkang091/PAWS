import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import type { TournamentLeaderboardRow } from "@/types/tournament";

type Props = {
  rows: TournamentLeaderboardRow[];
};

const MEDAL_COLORS: Record<number, string> = {
  1: theme.colors.gold,
  2: theme.colors.silver,
  3: "#CD7F32",
};

export const TournamentLeaderboardPreview = ({ rows }: Props) => {
  if (rows.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="trophy-outline" size={28} color={theme.colors.textMuted} />
        <Text style={styles.emptyTitle}>No results yet</Text>
        <Text style={styles.emptyBody}>
          The leaderboard will appear once participants submit their attempts.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {rows.slice(0, 3).map((row) => {
        const medalColor = MEDAL_COLORS[row.rank];

        return (
          <View
            key={row.entryId}
            style={[
              styles.row,
              row.isCurrentUser && styles.rowHighlight,
            ]}
          >
            <View
              style={[
                styles.rankCircle,
                { backgroundColor: `${medalColor}22` },
              ]}
            >
              <Text style={[styles.rankText, { color: medalColor }]}>
                {row.rank}
              </Text>
            </View>

            <View style={styles.rowCenter}>
              <Text
                style={[
                  styles.dogName,
                  row.isCurrentUser && styles.dogNameHighlight,
                ]}
                numberOfLines={1}
              >
                {row.dogName}
                {row.isCurrentUser ? " (you)" : ""}
              </Text>
              <Text style={styles.submittedText}>
                {new Date(row.submittedAt).toLocaleDateString()}
              </Text>
            </View>

            <Text style={[styles.score, { color: medalColor }]}>
              {row.score.toFixed(1)}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  rowHighlight: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  rankCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rankText: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
  },
  rowCenter: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  dogName: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.text,
  },
  dogNameHighlight: {
    color: theme.colors.primaryDark,
  },
  submittedText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: "600",
  },
  score: {
    fontSize: theme.typography.md,
    fontWeight: "900",
    minWidth: 48,
    textAlign: "right",
  },
  emptyCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  emptyTitle: {
    fontSize: theme.typography.md,
    fontWeight: "900",
    color: theme.colors.text,
  },
  emptyBody: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
});