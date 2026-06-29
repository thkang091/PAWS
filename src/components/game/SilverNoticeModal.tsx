import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "@/constants/theme";

type SilverNoticeModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
};

export const SilverNoticeModal = ({
  visible,
  onClose,
  title = "Not enough silver",
  message = "Complete Train or Care activities to earn more silver.",
}: SilverNoticeModalProps) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons
              name="cash-outline"
              size={34}
              color={theme.colors.silver}
            />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.closeBtnText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.38)",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "rgba(255,252,246,0.96)",
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.md,
    ...theme.shadows.soft,
  },
  iconWrap: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: theme.colors.silverSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.text,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  message: {
    fontSize: theme.typography.sm,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  closeBtn: {
    marginTop: theme.spacing.sm,
    width: "100%",
    minHeight: 50,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontWeight: "900",
  },
});