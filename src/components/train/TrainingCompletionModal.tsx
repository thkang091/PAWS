import { Modal, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";
import type { DogStatus } from "@/types/domain";

export const TrainingCompletionModal = ({
  visible,
  silverEarned,
  xpEarned,
  status,
  onClose,
}: {
  visible: boolean;
  silverEarned: number;
  xpEarned: number;
  status?: DogStatus;
  onClose: () => void;
}) => (
  <Modal animationType="fade" transparent visible={visible}>
    <View style={styles.overlay}>
      <AppCard>
        <Text style={styles.title}>Session complete</Text>
        <Text style={styles.copy}>Earned {silverEarned} silver and {xpEarned} Bond XP.</Text>
        {status ? <Text style={styles.copy}>Focus {status.focus} • Discipline {status.discipline} • Social {status.social}</Text> : null}
        <AppButton title="Nice" onPress={onClose} />
      </AppCard>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", padding: theme.spacing.xl, backgroundColor: "rgba(36,50,38,0.28)" },
  title: { color: theme.colors.text, fontSize: theme.typography.xl, fontWeight: "900", marginBottom: theme.spacing.md },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.md, lineHeight: 22, marginBottom: theme.spacing.md },
});
