import { StyleSheet, View } from "react-native";

import { CoinBadge } from "@/components/ui/CoinBadge";
import type { WalletSummary as WalletSummaryType } from "@/types/domain";

export const WalletSummary = ({ wallet }: { wallet: WalletSummaryType }) => (
  <View style={styles.row}>
    <CoinBadge currency="silver" amount={wallet.silverBalance} label="silver" />
    <CoinBadge currency="gold" amount={wallet.goldBalance} label="gold" />
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
});
