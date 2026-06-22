import { Modal, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";

export const AnonymousAccountWarningModal = ({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <Modal transparent animationType="fade" visible={visible}>
    <View style={styles.overlay}>
      <AppCard>
        <Text style={styles.title}>Anonymous progress can be lost</Text>
        <Text style={styles.copy}>If you sign out before linking an account, you may permanently lose access to this dog profile, memories, streaks, and rewards.</Text>
        <AppButton title="Save progress first" onPress={() => router.push("/account/link")} />
        <AppButton title="Cancel" variant="secondary" onPress={onCancel} />
        <AppButton title="Sign out anyway" variant="ghost" onPress={onConfirm} />
      </AppCard>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", padding: theme.spacing.xl, backgroundColor: "rgba(36,50,38,0.32)" },
  title: { color: theme.colors.text, fontSize: theme.typography.xl, fontWeight: "900", marginBottom: theme.spacing.md },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.md, lineHeight: 22, marginBottom: theme.spacing.lg },
});
