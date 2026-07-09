import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GoldBar } from "@/components/ui/GoldBar";
import { theme } from "@/constants/theme";

type PrizeInfo = {
  label: string;
  value: string;
  place: 1 | 2 | 3;
};

type Props = {
  prizeFirst: string;
  prizeSecond: string;
  prizeThird: string;
};

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

export const TournamentPrizeRow = ({
  prizeFirst,
  prizeSecond,
  prizeThird,
}: Props) => {
  const prizes: PrizeInfo[] = [
    { place: 1, label: "1st Prize", value: prizeFirst },
    { place: 2, label: "2nd Prize", value: prizeSecond },
    { place: 3, label: "3rd Prize", value: prizeThird },
  ];

  return (
    <View style={styles.container}>
      {prizes.map((prize) => (
        <View key={prize.place} style={styles.prizeCard}>
          <View
            style={[
              styles.medalCircle,
              { backgroundColor: `${MEDAL_COLORS[prize.place]}22` },
            ]}
          >
            <Ionicons
              name={MEDAL_ICONS[prize.place]}
              size={18}
              color={MEDAL_COLORS[prize.place]}
            />
          </View>
          <View style={styles.prizeCopy}>
            <Text style={styles.prizeLabel}>{prize.label}</Text>
            <View style={styles.prizeValueRow}>
              <GoldBar size={10} />
              <Text style={[styles.prizeValue, { color: MEDAL_COLORS[prize.place] }]}>
                {prize.value}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
  },
  prizeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  medalCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  prizeCopy: {
    flex: 1,
    gap: 3,
  },
  prizeLabel: {
    fontSize: theme.typography.xs,
    fontWeight: "800",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  prizeValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  prizeValue: {
    fontSize: theme.typography.sm,
    fontWeight: "900",
    flexShrink: 1,
  },
});