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

  if (tournament.status === "settled") {
    return (
      <View style={[styles.ctaCard, styles.ctaSettled]}>
        <Ionicons name="trophy-outline" size={20} color={theme.colors.gold} />
        <Text style={styles.ctaSettledText}>Tournament Complete</Text>
      </View>
    );
  }

  if (entry) {
    return (
      <View style={[styles.ctaCard, styles.ctaEntered]}>
        <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
        <View style={styles.ctaCopy}>
          <Text style={styles.ctaEnteredTitle}>You're entered!</Text>
          <Text style={styles.ctaEnteredSub}>
            {tournament.status === "active"
              ? `Submit your best attempt. ${tournament.maxAttemptsPerEntry} max.`
              : "Waiting for the tournament to start."}
          </Text>
        </View>
      </View>
    );
  }

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

  return null;
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
  ctaEntered: {
    backgroundColor: theme.colors.successSoft,
    borderColor: theme.colors.success,
  },
  ctaSettled: {
    backgroundColor: theme.colors.goldSoft,
    borderColor: theme.colors.gold,
    justifyContent: "center",
  },
  ctaCopy: {
    flex: 1,
    gap: 2,
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
  ctaSettledText: {
    fontSize: theme.typography.md,
    fontWeight: "900",
    color: theme.colors.gold,
  },
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