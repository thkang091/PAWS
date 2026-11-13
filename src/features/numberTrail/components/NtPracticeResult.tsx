import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn, useReducedMotion } from "react-native-reanimated";

import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { NumberGlyph } from "@/features/numberTrail/components/NumberGlyph";
import { kmText, practiceSummary } from "@/features/numberTrail/practiceFlow";
import type { PracticeResult } from "@/services/numberRaceService";
import { bg, layout, motion, radius, space, text, type } from "@/constants/design";

/** A practice walk's result, from the server's check only. Never ranked. */
export const NtPracticeResult = ({ number, result, officialM, insetBottom, onAgain, onNew }: { number: string; result: PracticeResult; officialM: number; insetBottom: number; onAgain: () => void; onNew: () => void }) => {
  const reduceMotion = useReducedMotion();
  const s = practiceSummary(result, number);
  return (
    <View style={[styles.flex, { paddingBottom: insetBottom + space.md }]}>
      <View style={styles.middle}>
        <View style={styles.top}>
          <Animated.View entering={reduceMotion ? FadeIn.duration(motion.duration.enter) : ZoomIn.duration(motion.duration.enter).easing(motion.easing.out).withInitialValues({ transform: [{ scale: 0.96 }] })}>
            <NumberGlyph value={number} height={140} draw={result.eligible} stroke={0.28} dim={!result.eligible} />
          </Animated.View>
          <Text style={[styles.title, styles.center]} accessibilityLiveRegion="polite">
            {s.title}
          </Text>
          <Text style={[styles.sub, styles.center]}>{s.line}</Text>
        </View>
        <View style={styles.stats}>
          <Stat label="Course" value={kmText(officialM)} />
          <Stat label="You walked" value={s.walked} />
          <Stat label="Moving" value={`${s.minutes} min`} />
        </View>
        <Text style={[styles.fine, styles.center]}>Practice isn't ranked.</Text>
      </View>
      <View style={styles.actions}>
        <RaisedButton label={result.eligible ? "Another number" : "Walk it again"} onPress={result.eligible ? onNew : onAgain} />
        <RaisedButton tone="white" label={result.eligible ? "Walk it again" : "Another number"} onPress={result.eligible ? onAgain : onNew} />
      </View>
    </View>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  middle: { flex: 1, justifyContent: "center" },
  top: { alignItems: "center", paddingHorizontal: layout.gutter, gap: space.md },
  title: { fontSize: 30, lineHeight: 34, fontWeight: "800", letterSpacing: -0.8, color: text.primary },
  sub: { fontSize: 16, lineHeight: 22, fontWeight: "600", color: text.secondary, marginTop: -space.sm },
  center: { textAlign: "center" },
  stats: { flexDirection: "row", gap: space.sm, paddingHorizontal: layout.gutter, marginTop: space.xl },
  stat: { flex: 1, alignItems: "center", paddingVertical: space.lg, borderRadius: radius.card, backgroundColor: bg.subtle },
  statValue: { fontSize: 20, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.caption, color: text.secondary, marginTop: 2 },
  fine: { ...type.caption, color: text.secondary, paddingHorizontal: layout.gutter, marginTop: space.lg },
  actions: { paddingHorizontal: layout.gutter, gap: space.sm },
});
