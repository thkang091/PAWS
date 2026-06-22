import { StyleSheet, Text } from "react-native";
import { Image } from "expo-image";

import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";
import type { DogMoment } from "@/types/domain";

export const ShareableMomentCard = ({ moment }: { moment: DogMoment }) => (
  <AppCard>
    {moment.imageUrl ? <Image source={{ uri: moment.imageUrl }} style={styles.image} contentFit="cover" /> : null}
    <Text style={styles.title}>PAWS Moment</Text>
    <Text style={styles.copy}>{moment.caption ?? moment.momentDate}</Text>
  </AppCard>
);

const styles = StyleSheet.create({
  image: { height: 360, borderRadius: theme.radii.lg, marginBottom: theme.spacing.md },
  title: { color: theme.colors.primaryDark, fontSize: theme.typography.xl, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.md, lineHeight: 22, marginTop: theme.spacing.sm },
});
