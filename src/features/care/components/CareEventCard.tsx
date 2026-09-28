import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";
import type { CareEvent } from "@/types/domain";

export const CareEventCard = ({ event, onDelete }: { event: CareEvent; onDelete: () => void }) => (
  <AppCard>
    <View style={styles.stack}>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.copy}>{event.eventType} • {new Date(event.startTime).toLocaleString()}</Text>
      {event.description ? <Text style={styles.copy}>{event.description}</Text> : null}
      <AppButton title="Delete" variant="ghost" onPress={onDelete} />
    </View>
  </AppCard>
);

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.sm },
  title: { color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900" },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.sm, lineHeight: 20 },
});
