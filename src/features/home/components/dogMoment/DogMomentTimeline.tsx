import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { theme } from "@/constants/theme";
import type { DogMoment } from "@/types/domain";

export const DogMomentTimeline = ({ moments }: { moments: DogMoment[] }) => {
  if (moments.length === 0) {
    return <EmptyState title="No Dog Moments yet" description="Add today’s favorite photo to start your memory timeline." />;
  }

  return (
    <View style={styles.stack}>
      {moments.map((moment) => (
        <AppCard key={moment.id}>
          {moment.imageUrl ? <Image source={{ uri: moment.imageUrl }} style={styles.image} contentFit="cover" /> : null}
          <Text style={styles.date}>{moment.momentDate}</Text>
          {moment.caption ? <Text style={styles.caption}>{moment.caption}</Text> : null}
        </AppCard>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.lg },
  image: { height: 220, borderRadius: theme.radii.md, marginBottom: theme.spacing.md },
  date: { color: theme.colors.text, fontSize: theme.typography.md, fontWeight: "900" },
  caption: { color: theme.colors.textMuted, fontSize: theme.typography.sm, marginTop: theme.spacing.xs },
});
