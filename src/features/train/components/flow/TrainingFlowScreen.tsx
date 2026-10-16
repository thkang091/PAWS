import { useRef, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { XIcon } from "phosphor-react-native";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, layout, radius, space, text, type } from "@/constants/design";

/** Presentation only. The caller owns navigation, persistence, and Energy. */
export function TrainingFlowScreen({ label, onClose, children, footer, progress, contentKey, revealEnd = false, centered = false }: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  progress?: { current: number; total: number };
  contentKey?: string;
  revealEnd?: boolean;
  centered?: boolean;
}) {
  const scroll = useRef<ScrollView>(null);
  const reduceMotion = useReducedMotion();
  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}>
      <PressScale accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
        <XIcon size={24} color={text.primary} />
      </PressScale>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.close} />
    </View>
    {progress ? <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel="Review progress" accessibilityValue={{ min: 0, max: progress.total, now: progress.current }}>
      {Array.from({ length: progress.total }, (_, index) => <View key={index} style={[styles.segment, index < progress.current && styles.filled]} />)}
    </View> : null}
    <ScrollView key={contentKey} ref={scroll} contentContainerStyle={[styles.content, centered && styles.centered]} showsVerticalScrollIndicator={false} onContentSizeChange={() => { if (revealEnd) scroll.current?.scrollToEnd({ animated: !reduceMotion }); }}>{children}</ScrollView>
    <View style={styles.footer}>{footer}</View>
  </SafeAreaView>;
}

export function TrainingFlowButton({ label, onPress, disabled = false, secondary = false }: {
  label: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <PressScale accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={styles.buttonText}>{label}</Text>
  </PressScale>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: layout.gutter - space.sm, paddingVertical: space.sm },
  close: { width: layout.iconButton, height: layout.iconButton, alignItems: "center", justifyContent: "center" },
  label: { ...type.supporting, color: text.secondary, flex: 1, textAlign: "center" },
  progress: { flexDirection: "row", gap: space.sm, paddingHorizontal: layout.gutter, paddingBottom: space.md },
  segment: { flex: 1, height: 5, borderRadius: radius.pill, backgroundColor: border.soft },
  filled: { backgroundColor: accent.deep },
  content: { flexGrow: 1, padding: layout.gutter, gap: space.xl },
  centered: { justifyContent: "center" },
  footer: { paddingHorizontal: layout.gutter, paddingTop: space.md, paddingBottom: space.lg, gap: space.sm, borderTopWidth: 1, borderTopColor: border.soft },
  button: { minHeight: layout.controlHeight, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
  secondary: { backgroundColor: bg.canvas, borderWidth: 1, borderColor: border.soft },
  disabled: { opacity: 0.45 },
  buttonText: { ...type.cardTitle, fontWeight: "700", color: text.primary, textAlign: "center" },
});
