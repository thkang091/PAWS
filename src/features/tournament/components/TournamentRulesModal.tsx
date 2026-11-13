import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowsCounterClockwiseIcon,
  FlagIcon,
  MapTrifoldIcon,
  ShieldCheckIcon,
  TrafficSignalIcon,
  XIcon,
} from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { GPS_RULES } from "../../../../supabase/functions/tournament/geo";
import { accent, bg, radius, space, text, type } from "@/constants/design";

const RULES = [
  `Walk at least ${GPS_RULES.minDistanceM} m with location on and PAWS open.`,
  `Finish within ${GPS_RULES.closureM} m of where you started to close the shape.`,
  "Walk one loop. A route that crosses itself can't be measured.",
  "Speed doesn't score. Stretches faster than walking pace are left out.",
  "Your best territory in the tournament counts. Ties go to whoever claimed first.",
  "PAWS measures the area on its server from your GPS points. GPS can be wrong by several metres, and the checks can't catch every faked location.",
];

/**
 * How Make the Largest Country works, its rules, and the safety reminder shown before a walk. With `onStart`, the
 * sheet ends in a Start walking button.
 */
export const TournamentRulesModal = ({
  visible,
  onClose,
  onStart,
  safetyOnly = false,
}: {
  visible: boolean;
  onClose: () => void;
  onStart?: () => void;
  safetyOnly?: boolean;
}) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={styles.flex} accessibilityLabel="Close" onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.grip} />
          <View style={styles.head}>
            <Text style={styles.title}>{safetyOnly ? "Before you set off" : "How it works"}</Text>
            <PressScale accessibilityRole="button" accessibilityLabel="Close" style={styles.close} onPress={onClose}>
              <XIcon size={18} color={text.primary} weight="bold" />
            </PressScale>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {!safetyOnly ? (
              <>
                <Step icon={<MapTrifoldIcon size={20} color={text.primary} weight="fill" />} title="Walk a loop" line="Press Start and walk your dog around the area you want to claim." />
                <Step icon={<FlagIcon size={20} color={text.primary} weight="fill" />} title="Come back to the start" line="Return to where you began and the loop closes into a territory." />
                <Step icon={<ArrowsCounterClockwiseIcon size={20} color={text.primary} weight="bold" />} title="Biggest wins" line="The largest checked territory tops the board when the tournament ends." />
                <Text style={styles.section}>Rules</Text>
                {RULES.map((r) => (
                  <View key={r} style={styles.rule}>
                    <View style={styles.bullet} />
                    <Text style={styles.ruleText}>{r}</Text>
                  </View>
                ))}
              </>
            ) : null}
            <View style={styles.safety}>
              <ShieldCheckIcon size={22} color={text.primary} weight="fill" />
              <View style={styles.flex}>
                <Text style={styles.safetyTitle}>Walk safely</Text>
                <Text style={styles.safetyLine}>Stay on paths and pavements, cross only at crossings, and keep your dog on a lead near roads.</Text>
                <Text style={styles.safetyLine}>Don't go onto private property or anywhere that's closed.</Text>
                <Text style={styles.safetyLine}>Keep your eyes up. PAWS buzzes when you're back at the start.</Text>
              </View>
            </View>
            <View style={styles.note}>
              <TrafficSignalIcon size={18} color={text.secondary} weight="fill" />
              <Text style={styles.noteText}>Keep PAWS open while you walk. The screen stays on, and leaving the app pauses the walk.</Text>
            </View>
          </ScrollView>
          {onStart ? <RaisedButton label="Start walking" onPress={onStart} /> : <RaisedButton tone="white" label="Got it" onPress={onClose} />}
        </View>
      </View>
    </Modal>
  );
};

const Step = ({ icon, title, line }: { icon: ReactNode; title: string; line: string }) => (
  <View style={styles.step}>
    <View style={styles.stepIcon}>{icon}</View>
    <View style={styles.flex}>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepLine}>{line}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { flex: 1, backgroundColor: "rgba(28,27,26,0.4)" },
  sheet: { backgroundColor: bg.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.xxl, paddingTop: space.sm, maxHeight: "88%" },
  grip: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#E2E0DA", marginBottom: space.md },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...type.sectionTitle, fontWeight: "700", color: text.primary },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  scroll: { marginTop: space.md },
  scrollBody: { gap: space.md, paddingBottom: space.lg },
  step: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  stepIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center" },
  stepTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  stepLine: { ...type.supporting, color: text.secondary, marginTop: 2 },
  section: { ...type.eyebrow, color: text.tertiary, marginTop: space.sm },
  rule: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: accent.band, marginTop: 8 },
  ruleText: { ...type.supporting, color: text.primary, flex: 1 },
  safety: { flexDirection: "row", gap: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: accent.soft, marginTop: space.sm },
  safetyTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  safetyLine: { ...type.supporting, color: text.primary, marginTop: 4 },
  note: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  noteText: { ...type.caption, color: text.secondary, flex: 1 },
});
