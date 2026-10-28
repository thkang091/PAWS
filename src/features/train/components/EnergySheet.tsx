import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { EnergyGlyph } from "@/components/ui/StatGlyphs";
import Animated, { FadeIn, SlideInDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon, layout, motion, radius, space, text, type } from "@/constants/design";
import type { TrainingEnergy } from "@/types/domain";

export function EnergySheet({ energy, busy, error, onClose, onRefill }: {
  energy?: TrainingEnergy;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onRefill: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const close = () => { if (!busy) onClose(); };

  return (
    <Modal transparent visible animationType="none" onRequestClose={close}>
      <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close energy" disabled={busy} />
        <Animated.View
          entering={reduceMotion ? undefined : SlideInDown.duration(motion.duration.enter).easing(motion.easing.drawer)}
          style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}
          accessibilityViewIsModal
        >
          <View style={styles.grip} />
          <View style={styles.heading}>
            <Text style={styles.title}>Energy</Text>
            <PressScale onPress={close} disabled={busy} style={styles.close} accessibilityRole="button" accessibilityLabel="Close energy">
              <XIcon size={icon.standard} color={text.primary} />
            </PressScale>
          </View>
          <View style={styles.balance}>
            <EnergyGlyph size={40} />
            <Text style={styles.amount}>{energy ? `${energy.remaining} / ${energy.base}` : "—"}</Text>
          </View>
          <Text style={styles.copy}>Refill your energy and keep training.</Text>
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Refill energy for free"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={onRefill}
            style={[styles.primary, busy && styles.busy]}
          >
            {busy ? <ActivityIndicator color={text.primary} /> : <Text style={styles.primaryText}>Refill for free</Text>}
          </PressScale>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28,27,26,0.28)" },
  sheet: { backgroundColor: bg.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: layout.gutter, paddingTop: space.md },
  grip: { width: 40, height: 4, borderRadius: radius.pill, backgroundColor: border.default, alignSelf: "center" },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: space.lg },
  title: { ...type.sectionTitle, color: text.primary },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  balance: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.md, paddingVertical: space.xl },
  amount: { ...type.pageTitle, color: text.primary, fontVariant: ["tabular-nums"] },
  copy: { ...type.supporting, color: text.secondary, textAlign: "center", marginBottom: space.lg },
  error: { ...type.caption, color: text.primary, textAlign: "center", marginBottom: space.md },
  primary: { height: layout.controlHeight, borderRadius: radius.pill, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
  busy: { opacity: 0.65 },
  primaryText: { ...type.cardTitle, color: text.primary, fontWeight: "700" },
});
