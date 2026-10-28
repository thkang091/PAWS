import { StyleSheet, Text, View } from "react-native";
import { ClockCounterClockwiseIcon, ListBulletsIcon } from "phosphor-react-native";

import { CoinGlyph, EnergyGlyph, StreakGlyph } from "@/components/ui/StatGlyphs";
import { PressScale } from "@/components/ui/PressScale";
import type { TrainingTopic } from "@/constants/trainingTopics";
import { space } from "@/constants/design";

export type TrainStats = { streak: number | null; energy: number | null; gold: number | null; silver: number | null };

/**
 * The top of Train, in one raised green card: the dog's numbers across the top (streak, energy, gold, silver, history),
 * a rule, then the topic being trained with how far along it is and a button to switch topics.
 */
export const TopicHeader = ({
  topic,
  index,
  count,
  done,
  total,
  stats,
  onEnergy,
  onCoins,
  onHistory,
  onOpenPicker,
}: {
  topic: TrainingTopic;
  index: number;
  count: number;
  done: number;
  total: number;
  stats: TrainStats;
  onEnergy: () => void;
  onCoins: () => void;
  onHistory: () => void;
  onOpenPicker: () => void;
}) => {
  const show = (n: number | null) => (n == null ? "-" : n.toLocaleString());
  return (
    <View style={styles.lip}>
      <View style={styles.card}>
        <View style={styles.stats}>
          <View style={styles.stat} accessible accessibilityLabel={`Streak ${stats.streak ?? 0} days`}>
            <StreakGlyph muted={!stats.streak} />
            <Text style={[styles.statText, !stats.streak && styles.statQuiet]}>{(stats.streak ?? 0).toLocaleString()}</Text>
          </View>
          <PressScale accessibilityRole="button" accessibilityLabel={`Energy ${stats.energy ?? 0}. Refill`} scaleTo={0.92} style={styles.stat} onPress={onEnergy}>
            <EnergyGlyph />
            <Text style={styles.statText}>{show(stats.energy)}</Text>
          </PressScale>
          <PressScale accessibilityRole="button" accessibilityLabel={`${stats.gold ?? 0} gold coins`} scaleTo={0.92} style={styles.stat} onPress={onCoins}>
            <CoinGlyph tone="gold" />
            <Text style={styles.statText}>{show(stats.gold)}</Text>
          </PressScale>
          <PressScale accessibilityRole="button" accessibilityLabel={`${stats.silver ?? 0} silver coins`} scaleTo={0.92} style={styles.stat} onPress={onCoins}>
            <CoinGlyph tone="silver" />
            <Text style={styles.statText}>{show(stats.silver)}</Text>
          </PressScale>
          <PressScale accessibilityRole="button" accessibilityLabel="History" scaleTo={0.9} style={styles.stat} onPress={onHistory} hitSlop={6}>
            <ClockCounterClockwiseIcon size={22} color="rgba(255,255,255,0.86)" weight="bold" />
          </PressScale>
        </View>

        <View style={styles.rule} />

        <View style={styles.topicRow}>
          <PressScale accessibilityRole="button" accessibilityLabel={`${topic.title}. ${done} of ${total} done. Change topic`} scaleTo={0.98} style={styles.topicCopy} onPress={onOpenPicker}>
            <Text style={styles.eyebrow} numberOfLines={1}>{`Topic ${index + 1} · ${done} of ${total} done`.toUpperCase()}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {topic.title}
            </Text>
          </PressScale>
          <PressScale accessibilityRole="button" accessibilityLabel="All topics" scaleTo={0.9} style={styles.listButton} onPress={onOpenPicker}>
            <ListBulletsIcon size={24} color="#FFFFFF" weight="bold" />
          </PressScale>
        </View>
      </View>
    </View>
  );
};

const GREEN = "#657A59";
const GREEN_LIP = "#465641";

const styles = StyleSheet.create({
  lip: { borderRadius: 22, backgroundColor: GREEN_LIP, paddingBottom: 5 },
  card: { borderRadius: 22, backgroundColor: GREEN, overflow: "hidden" },

  stats: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs },
  stat: { flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: space.xs },
  statText: { fontSize: 16, lineHeight: 20, fontWeight: "800", color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  statQuiet: { color: "rgba(255,255,255,0.6)" },

  rule: { height: 2, backgroundColor: GREEN_LIP },

  topicRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingLeft: space.lg, paddingRight: space.md, paddingVertical: space.md },
  topicCopy: { flex: 1 },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: "800", letterSpacing: 0.7, color: "rgba(255,255,255,0.7)", fontVariant: ["tabular-nums"] },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "800", letterSpacing: -0.3, color: "#FFFFFF", marginTop: 2 },
  listButton: { width: 48, height: 48, borderRadius: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.28)", alignItems: "center", justifyContent: "center" },
});
