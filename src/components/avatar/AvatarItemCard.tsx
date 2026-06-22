import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { EquippedItemBadge } from "@/components/avatar/EquippedItemBadge";
import { theme } from "@/constants/theme";
import type { AvatarItem } from "@/types/domain";

export const AvatarItemCard = ({
  item,
  owned,
  equipped,
  onPurchase,
  onEquip,
  loading,
}: {
  item: AvatarItem;
  owned: boolean;
  equipped: boolean;
  onPurchase: () => void;
  onEquip: () => void;
  loading: boolean;
}) => (
  <AppCard>
    <View style={styles.stack}>
      <View style={styles.row}>
        <Text style={styles.title}>{item.name}</Text>
        <EquippedItemBadge equipped={equipped} />
      </View>
      <Text style={styles.copy}>{item.slotType.replaceAll("_", " ")} • {item.silverCost} silver</Text>
      <AppButton title={owned ? "Equip" : "Purchase"} disabled={equipped} loading={loading} onPress={owned ? onEquip : onPurchase} />
    </View>
  </AppCard>
);

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.md },
  title: { flex: 1, color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.sm },
});
