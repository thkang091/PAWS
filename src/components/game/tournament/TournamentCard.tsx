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

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  return `${month} ${day}`;
};

export const TournamentCard = ({ tournament }: Props) => {
  const isOpen = tournament.status === "registration_open";
  const isActive = tournament.status === "active";
  const isSettled = tournament.status === "settled";

  const handlePress = () => {
    router.push(`/game/tournament/${tournament.id}`);
  };

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
            name={tournament.entryCurrency === "gold" ? "trophy-outline" : "cash-outline"}
            size={12}
            color={theme.colors.silver}
          />
          <Text style={styles.entryCostText}>
            {tournament.entryCost} {tournament.entryCurrency === "gold" ? "Gold" : "Silver"}
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

        <View style={styles.stat}>
          <Ionicons
            name="trophy-outline"
            size={13}
            color={theme.colors.gold}
          />
          <Text style={[styles.statText, { color: theme.colors.gold }]}>
            Prizes
          </Text>
        </View>
      </View>

      <View style={styles.dateRow}>
        {isOpen ? (
          <View style={styles.stat}>
            <Ionicons
              name="timer-outline"
              size={12}
              color={theme.colors.primaryDark}
            />
            <Text style={[styles.statText, styles.dateText]}>
              Close {formatDate(tournament.registrationClosesAt)}
            </Text>
          </View>
        ) : isActive ? (
          <View style={styles.stat}>
            <Ionicons
              name="timer-outline"
              size={12}
              color={theme.colors.accent}
            />
            <Text style={[styles.statText, styles.dateText]}>
              Ends {formatDate(tournament.endsAt)}
            </Text>
          </View>
        ) : isSettled ? (
          <View style={styles.stat}>
            <Ionicons
              name="checkmark-circle-outline"
              size={12}
              color={theme.colors.success}
            />
            <Text style={[styles.statText, styles.dateText]}>
              Completed {formatDate(tournament.endsAt)}
            </Text>
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