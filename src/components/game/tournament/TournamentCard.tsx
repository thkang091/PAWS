import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { TournamentStatusPill } from "@/components/game/tournament/TournamentStatusPill";
import { GoldBar } from "@/components/ui/GoldBar";
import { theme } from "@/constants/theme";
import type { TournamentEvent } from "@/types/tournament";

type Props = {
  tournament: TournamentEvent;
};

const daysUntil = (iso: string): string | null => {
  const now = new Date();
  const target = new Date(iso);
  const diff = Math.ceil(
    (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff < 0) return null;
  if (diff === 0) return "Ends today";
  if (diff === 1) return "Ends tomorrow";
  return `Ends in ${diff} days`;
};

export const TournamentCard = ({ tournament }: Props) => {
  const isOpen = tournament.status === "registration_open";
  const isActive = tournament.status === "active";
  const isSettled = tournament.status === "settled";
  const isReviewing = tournament.status === "reviewing";

  const handlePress = () => {
    router.push(`/game/tournament/${tournament.id}`);
  };

  const timeHint = isOpen
    ? daysUntil(tournament.registrationClosesAt)
    : isActive
      ? daysUntil(tournament.endsAt)
      : isSettled
        ? "Results published"
        : isReviewing
          ? "Under review"
          : null;

  const timeIcon = isSettled
    ? ("checkmark-circle-outline" as const)
    : isReviewing
      ? ("search-outline" as const)
      : ("timer-outline" as const);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${tournament.title} — ${tournament.status}`}
    >
      <View style={styles.cardTop}>
        <TournamentStatusPill status={tournament.status} />

        <View style={styles.entryCostBadge}>
          <Ionicons
            name={
              tournament.entryCurrency === "gold"
                ? "trophy-outline"
                : "cash-outline"
            }
            size={12}
            color={theme.colors.silver}
          />
          <Text style={styles.entryCostText}>
            {tournament.entryCost}{" "}
            {tournament.entryCurrency === "gold" ? "Gold" : "Silver"}
          </Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {tournament.title}
      </Text>

      <Text style={styles.subtitle} numberOfLines={2}>
        {tournament.description}
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Ionicons
            name="people-outline"
            size={13}
            color={theme.colors.textMuted}
          />
          <Text style={styles.statText}>
            {tournament.participantCount}/{tournament.maxParticipants}
          </Text>
        </View>

        <View style={[styles.stat, { flexShrink: 1, minWidth: 0 }]}>
          <Ionicons
            name="trophy-outline"
            size={13}
            color={theme.colors.gold}
          />
          <Text
            style={[styles.statText, { color: theme.colors.gold }]}
            numberOfLines={1}
          >
            {tournament.prizeFirst}
          </Text>
        </View>
      </View>

      <View style={styles.dateRow}>
        {timeHint ? (
          <View style={styles.stat}>
            <Ionicons name={timeIcon} size={12} color={theme.colors.textMuted} />
            <Text style={[styles.statText, styles.dateText]}>{timeHint}</Text>
          </View>
        ) : null}

        <GoldBar size={10} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadows.soft,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  entryCostBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.silverSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  entryCostText: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.silver,
  },
  title: {
    fontSize: theme.typography.md,
    fontWeight: "900",
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    lineHeight: 17,
  },
  statsRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    marginTop: 2,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: theme.typography.xs,
    fontWeight: "700",
    color: theme.colors.textMuted,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  dateText: {
    fontSize: 11,
  },
});