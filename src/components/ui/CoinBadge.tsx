import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { theme } from "@/constants/theme";
import { GoldBar } from "./GoldBar";
import type { Currency } from "@/types/domain";

type CoinBadgeProps = {
  currency: Currency;
  amount: number;
  label?: string;
};

export const CoinBadge = ({ currency, amount, label }: CoinBadgeProps) => {
  const isGold = currency === "gold" || currency === "gold_coin";

  return (
    <View style={[styles.badge, isGold ? styles.gold : styles.silver]}>
      {isGold ? (
        <GoldBar size={theme.iconSizes.sm} />
      ) : (
        <MaterialCommunityIcons
          color={theme.colors.silver}
          name="circle-multiple"
          size={theme.iconSizes.sm}
        />
      )}
      <Text style={styles.amount}>{amount.toLocaleString()}</Text>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  silver: {
    backgroundColor: theme.colors.silverSoft,
  },
  gold: {
    backgroundColor: theme.colors.goldSoft,
  },
  amount: {
    color: theme.colors.text,
    fontSize: theme.typography.sm,
    fontWeight: "800",
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.xs,
    fontWeight: "700",
  },
});
