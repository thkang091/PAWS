import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInLeft, FadeInRight, SlideInDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaretLeftIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon as iconSize, layout, motion, radius, space, text, type } from "@/constants/design";

export const FlowSheet = ({
  open,
  title,
  lede,
  step,
  total,
  direction,
  primary,
  onBack,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  lede?: string;
  step: number;
  total: number;
  direction: 1 | -1;
  primary: { label: string; disabled?: boolean; busy?: boolean; onPress: () => void };
  onBack: () => void;
  onClose: () => void;
  children: ReactNode;
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? undefined : (direction > 0 ? FadeInRight : FadeInLeft).duration(motion.duration.enter);
  const off = primary.disabled || primary.busy;

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)} style={styles.scrim}>
        <Pressable style={styles.scrimHit} onPress={onClose} accessibilityLabel="Close" />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Animated.View
            entering={reduceMotion ? undefined : SlideInDown.duration(motion.duration.reveal).easing(motion.easing.drawer)}
            style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}
          >
            <View style={styles.grabber} />
            <View style={styles.top}>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={step === 0 ? "Close" : "Previous step"}
                style={styles.round}
                onPress={step === 0 ? onClose : onBack}
              >
                {step === 0 ? (
                  <XIcon size={iconSize.standard} color={text.primary} weight="bold" />
                ) : (
                  <CaretLeftIcon size={iconSize.standard} color={text.primary} weight="bold" />
                )}
              </PressScale>
              {total > 1 ? (
                <View style={styles.progress} accessibilityLabel={`Step ${step + 1} of ${total}`}>
                  {Array.from({ length: total }, (_, index) => (
                    <View key={index} style={[styles.segment, index <= step && styles.segmentOn]} />
                  ))}
                </View>
              ) : (
                <View style={styles.progress} />
              )}
              <View style={styles.spacer} />
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Animated.View key={step} entering={enter}>
                <Text style={styles.title}>{title}</Text>
                {lede ? <Text style={styles.lede}>{lede}</Text> : null}
                {children}
              </Animated.View>
            </ScrollView>

            <PressScale
              accessibilityRole="button"
              accessibilityLabel={primary.label}
              accessibilityState={{ disabled: Boolean(off) }}
              disabled={off}
              scaleTo={0.97}
              style={[styles.primary, off && styles.primaryOff]}
              onPress={primary.onPress}
            >
              <Text style={[styles.primaryText, off && styles.primaryTextOff]}>
                {primary.busy ? "Saving" : primary.label}
              </Text>
            </PressScale>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
};

export const FieldLabel = ({ children }: { children: string }) => <Text style={styles.label}>{children}</Text>;

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(28,27,26,0.4)", justifyContent: "flex-end" },
  scrimHit: { flex: 1 },
  sheet: {
    maxHeight: "92%",
    backgroundColor: bg.canvas,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: layout.gutter,
    paddingTop: space.md,
  },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: border.default, alignSelf: "center" },
  top: { flexDirection: "row", alignItems: "center", gap: space.lg, marginTop: space.md },
  round: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  spacer: { width: 36, height: 36 },
  progress: { flex: 1, flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: bg.subtle },
  segmentOn: { backgroundColor: accent.deep },
  body: { marginTop: space.lg },
  bodyContent: { paddingBottom: space.lg },
  title: { ...type.pageTitle, color: text.primary },
  lede: { ...type.supporting, color: text.secondary, marginTop: space.sm, lineHeight: 21 },
  label: { ...type.cardTitle, fontWeight: "600", color: text.primary, marginTop: space.xxl, marginBottom: space.md },
  primary: {
    height: layout.controlHeight,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.md,
  },
  primaryOff: { backgroundColor: bg.subtle },
  primaryText: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  primaryTextOff: { color: text.disabled },
});
