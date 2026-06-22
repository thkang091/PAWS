import { Modal, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";
import type { DogMoment } from "@/types/domain";

export const DogMomentDetailModal = ({ moment, onClose }: { moment: DogMoment | null; onClose: () => void }) => (
  <Modal transparent animationType="fade" visible={Boolean(moment)}>
    <View style={styles.overlay}>
      <AppCard>
        {moment?.imageUrl ? <Image source={{ uri: moment.imageUrl }} style={styles.image} contentFit="cover" /> : null}
        <Text style={styles.title}>{moment?.momentDate}</Text>
        {moment?.caption ? <Text style={styles.copy}>{moment.caption}</Text> : null}
        <AppButton title="Close" onPress={onClose} />
      </AppCard>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", padding: theme.spacing.xl, backgroundColor: "rgba(36,50,38,0.32)" },
  image: { height: 260, borderRadius: theme.radii.md, marginBottom: theme.spacing.md },
  title: { color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.md, lineHeight: 22, marginVertical: theme.spacing.md },
});
