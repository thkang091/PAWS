import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import type { TournamentStatus } from "@/types/tournament";

type Props = {
  status: TournamentStatus;
};

const STATUS_META: Record<
  TournamentStatus,
  { label: string; icon: keyof typeof Ionicons.glyphMap; bg: string; text: string }
> = {
  draft: { label: "Draft", icon: "create-outline", bg: theme.colors.cardMuted, text: theme.colors.textMuted },
  scheduled: { label: "Scheduled", icon: "calendar-outline", bg: theme.colors.primarySoft, text: theme.colors.primaryDark },
  registration_open: { label: "Registration Open", icon: "enter-outline", bg: theme.colors.successSoft, text: theme.colors.success },
  registration_closed: { label: "Registration Closed", icon: "lock-closed-outline", bg: theme.colors.warningSoft, text: theme.colors.warning },
  active: { label: "Active", icon: "play-circle-outline", bg: theme.colors.accentSoft, text: "#6B6B00" },
  reviewing: { label: "Reviewing", icon: "search-outline", bg: theme.colors.warningSoft, text: theme.colors.warning },
  settled: { label: "Settled", icon: "trophy-outline", bg: theme.colors.goldSoft, text: theme.colors.gold },
  cancelled: { label: "Cancelled", icon: "close-circle-outline", bg: theme.colors.errorSoft, text: theme.colors.error },
};

export const TournamentStatusPill = ({ status }: Props) => {
  const meta = STATUS_META[status] ?? STATUS_META.draft;

  return (
    <View style={[styles.pill, { backgroundColor: meta.bg }]}>
      <Ionicons name={meta.icon} size={13} color={meta.text} />
      <Text style={[styles.label, { color: meta.text }]}>{meta.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: theme.typography.xs,
    fontWeight: "900",
  },
});