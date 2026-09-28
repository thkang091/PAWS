import { StyleSheet, Text } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { Badge } from "@/components/ui/Badge";
import { theme } from "@/constants/theme";
import type { WeeklyPlanItem } from "@/types/domain";

export const WeeklyPlanItemCard = ({ item, onComplete, loading }: { item: WeeklyPlanItem; onComplete?: () => void; loading?: boolean }) => (
  <AppCard>
    <Badge label={item.itemType} />
    <Text style={styles.title}>{item.title}</Text>
    {item.description ? <Text style={styles.copy}>{item.description}</Text> : null}
    {item.estimatedMinutes ? <Text style={styles.meta}>{item.estimatedMinutes} min</Text> : null}
    {onComplete ? <AppButton title={item.status === "completed" ? "Completed" : "Mark complete"} disabled={item.status === "completed"} loading={loading} onPress={onComplete} /> : null}
  </AppCard>
);

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: theme.typography.md, fontWeight: "900", marginTop: theme.spacing.sm },
  copy: { color: theme.colors.textMuted, fontSize: theme.typography.sm, lineHeight: 20, marginTop: theme.spacing.xs },
  meta: { color: theme.colors.secondary, fontSize: theme.typography.xs, fontWeight: "800", marginVertical: theme.spacing.sm },
});
