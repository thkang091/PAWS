import { StyleSheet, Text, View } from "react-native";

import { AppCard } from "@/components/ui/AppCard";
import { theme } from "@/constants/theme";
import type { DogMoment } from "@/types/domain";

export const DogMomentCalendar = ({ moments }: { moments: DogMoment[] }) => {
  const days = new Set(moments.map((moment) => moment.momentDate));
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(monthStart);
    date.setDate(index + 1);
    const key = date.toISOString().slice(0, 10);
    return { day: index + 1, key, hasMoment: days.has(key) };
  });

  return (
    <AppCard>
      <Text style={styles.title}>{today.toLocaleString(undefined, { month: "long", year: "numeric" })}</Text>
      <View style={styles.grid}>
        {cells.map((cell) => (
          <View key={cell.key} style={[styles.cell, cell.hasMoment && styles.cellActive]}>
            <Text style={[styles.day, cell.hasMoment && styles.dayActive]}>{cell.day}</Text>
          </View>
        ))}
      </View>
    </AppCard>
  );
};

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: "900", marginBottom: theme.spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  cell: { width: 38, height: 38, borderRadius: theme.radii.sm, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.cardMuted },
  cellActive: { backgroundColor: theme.colors.primary },
  day: { color: theme.colors.textMuted, fontSize: theme.typography.sm, fontWeight: "800" },
  dayActive: { color: theme.colors.white },
});
