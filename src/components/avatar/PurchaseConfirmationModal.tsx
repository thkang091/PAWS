import { Modal, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";

export const PurchaseConfirmationModal = ({ visible, itemName, onCancel, onConfirm, loading }: { visible: boolean; itemName: string; onCancel: () => void; onConfirm: () => void; loading: boolean }) => (
  <Modal transparent visible={visible} animationType="fade">
    <View style={styles.overlay}>
      <AppCard>
        <Text style={styles.title}>Purchase {itemName}?</Text>
        <Text style={styles.copy}>Silver will be deducted only after the server confirms the purchase.</Text>
        <AppButton title="Purchase" loading={loading} onPress={onConfirm} />
        <AppButton title="Cancel" variant="ghost" onPress={onCancel} />
      </AppCard>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", padding: theme.spacing.xl, backgroundColor: "rgba(36,50,38,0.32)" },
  title: { color: theme.colors.text, fontSize: theme.typography.xl, fontWeight: "900", marginBottom: theme.spacing.sm },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.md, lineHeight: 22, marginBottom: theme.spacing.lg },
});
