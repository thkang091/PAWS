import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "@/constants/theme";
import type { TournamentEntry, TournamentEvent } from "@/types/tournament";

type Props = {
  tournament: TournamentEvent;
  entry: TournamentEntry | null;
  onJoin: () => Promise<void>;
};

export const TournamentEntryCTA = ({ tournament, entry, onJoin }: Props) => {
  const [joining, setJoining] = useState(false);

  // ── Cancelled ──
  if (tournament.status === "cancelled") {
    return (
      <View style={[styles.ctaCard, styles.ctaCancelled]}>
        <Ionicons name="close-circle-outline" size={20} color={theme.colors.error} />
        <Text style={styles.ctaCancelledText}>Tournament Cancelled</Text>
      </View>
    );
  }

  // ── Settled ──
  if (tournament.status === "settled") {
    return (
      <View style={[styles.ctaCard, styles.ctaSettled]}>
        <Ionicons name="trophy-outline" size={20} color={theme.colors.gold} />
        <Text style={styles.ctaSettledText}>Tournament Complete</Text>
      </View>
    );
  }

  // ── Reviewing ──
  if (tournament.status === "reviewing") {
    return (
      <View style={[styles.ctaCard, styles.ctaReviewing]}>
        <Ionicons name="search-outline" size={20} color={theme.colors.warning} />
        <View style={styles.ctaCopy}>
          <Text style={styles.ctaReviewingTitle}>Under Review</Text>
          <Text style={styles.ctaReviewingSub}>
            Submissions are closed. Judges are reviewing entries and finalizing scores.
          </Text>
        </View>
      </View>
    );
  }

  // ── Draft / Scheduled ──
  if (tournament.status === "draft" || tournament.status === "scheduled") {
    return (
      <View style={[styles.ctaCard, styles.ctaInfo]}>
        <Ionicons name="calendar-outline" size={20} color={theme.colors.primaryDark} />
        <View style={styles.ctaCopy}>
          <Text style={styles.ctaInfoTitle}>Coming Soon</Text>
          <Text style={styles.ctaInfoSub}>
            Registration hasn't opened yet. Check back when the tournament is live.
          </Text>
        </View>
      </View>
    );
  }

  // ── User has an entry ──
  if (entry) {
    return (
      <View style={[styles.ctaCard, styles.ctaEntered]}>
        <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
        <View style={styles.ctaCopy}>
          <Text style={styles.ctaEnteredTitle}>You're entered!</Text>
          <Text style={styles.ctaEnteredSub}>
            {tournament.status === "active"
              ? `Submit your best attempt. ${tournament.maxAttemptsPerEntry} max.`
              : tournament.status === "registration_open"
                ? "Waiting for the tournament to start."
                : "Entry confirmed."}
          </Text>
          <Text style={styles.devNote}>
            [Dev Mode] Join is simulated locally. No wallet charge applied.
          </Text>
        </View>
      </View>
    );
  }

  // ── Registration open + not joined ──
  if (tournament.status === "registration_open") {
    const handleJoin = async () => {
      setJoining(true);
      try {
        await onJoin();
      } finally {
        setJoining(false);
      }
    };

    return (
      <Pressable
        style={({ pressed }) => [
          styles.joinBtn,
          pressed && { opacity: 0.85 },
        ]}
        onPress={handleJoin}
        disabled={joining}
        accessibilityRole="button"
        accessibilityLabel={`Join ${tournament.title} for ${tournament.entryCost} ${tournament.entryCurrency}`}
      >
        {joining ? (
          <Text style={styles.joinBtnText}>Joining...</Text>
        ) : (
          <>
            <Ionicons name="enter-outline" size={18} color={theme.colors.white} />
            <Text style={styles.joinBtnText}>
              Join for {tournament.entryCost} {tournament.entryCurrency === "gold" ? "Gold" : "Silver"}
            </Text>
          </>
        )}
      </Pressable>
    );
  }

  // ── Registration closed / active not joined / fallback ──
  return (
    <View style={[styles.ctaCard, styles.ctaClosed]}>
      <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textMuted} />
      <View style={styles.ctaCopy}>
        <Text style={styles.ctaClosedTitle}>Registration Closed</Text>
        <Text style={styles.ctaClosedSub}>
          {tournament.status === "active"
            ? "Registration for this tournament has ended. Check back for the next event."
            : "This tournament is no longer accepting entries."}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  ctaCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ctaCopy: {
    flex: 1,
    gap: 2,
  },
  // Entered
  ctaEntered: {
    backgroundColor: theme.colors.successSoft,
    borderColor: theme.colors.success,
  },
  ctaEnteredTitle: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.success,
  },
  ctaEnteredSub: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    lineHeight: 17,
  },
  devNote: {
    fontSize: 10,
    color: theme.colors.textSubtle,
    fontWeight: "600",
    marginTop: 4,
    fontStyle: "italic",
  },
  // Settled
  ctaSettled: {
    backgroundColor: theme.colors.goldSoft,
    borderColor: theme.colors.gold,
    justifyContent: "center",
  },
  ctaSettledText: {
    fontSize: theme.typography.md,
    fontWeight: "900",
    color: theme.colors.gold,
  },
  // Reviewing
  ctaReviewing: {
    backgroundColor: theme.colors.warningSoft,
    borderColor: theme.colors.warning,
  },
  ctaReviewingTitle: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.warning,
  },
  ctaReviewingSub: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    lineHeight: 17,
  },
  // Cancelled
  ctaCancelled: {
    backgroundColor: theme.colors.errorSoft,
    borderColor: theme.colors.error,
    justifyContent: "center",
  },
  ctaCancelledText: {
    fontSize: theme.typography.md,
    fontWeight: "900",
    color: theme.colors.error,
  },
  // Draft / Scheduled
  ctaInfo: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  ctaInfoTitle: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },
  ctaInfoSub: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    lineHeight: 17,
  },
  // Registration closed
  ctaClosed: {
    backgroundColor: theme.colors.cardMuted,
    borderColor: theme.colors.border,
  },
  ctaClosedTitle: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.textMuted,
  },
  ctaClosedSub: {
    fontSize: theme.typography.xs,
    color: theme.colors.textSubtle,
    lineHeight: 17,
  },
  // Join button
  joinBtn: {
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
  joinBtnText: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    color: theme.colors.white,
  },
});