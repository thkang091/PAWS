import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ArrowCounterClockwiseIcon } from "phosphor-react-native";

import { bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

const HOLD_MS = 1600;
const DANGER = "#C2412D";

/**
 * Start over, behind a press-and-hold: a fill sweeps across while the finger stays down, and letting go early snaps it
 * back. Nothing this destructive should happen on a single tap.
 */
export const HoldToReset = ({ name, onConfirm }: { name: string; onConfirm: () => Promise<void> }) => {
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const run = async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setBusy(true);
    setFailed(null);
    try {
      await onConfirm();
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "Could not reset. Try again.");
      fill.value = withTiming(0, { duration: 200, easing: motion.easing.out });
      setBusy(false);
    }
  };

  const start = () => {
    if (busy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fill.value = withTiming(1, { duration: reduceMotion ? 800 : HOLD_MS, easing: Easing.linear }, (done) => {
      if (done) runOnJS(run)();
    });
  };
  const release = () => {
    if (busy || fill.value >= 1) return;
    cancelAnimation(fill);
    fill.value = withTiming(0, { duration: 200, easing: motion.easing.out });
  };

  const sweep = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Start over</Text>
      <Text style={styles.body}>{`Deletes ${name} and every record, plan and setting, then opens onboarding as a first launch. Your sign-in stays.`}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hold to reset everything"
        accessibilityHint="Press and hold until the bar fills"
        accessibilityState={{ busy }}
        disabled={busy}
        onPressIn={start}
        onPressOut={release}
        style={styles.button}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.fill, sweep]} />
        {busy ? <ActivityIndicator color={text.inverse} /> : <ArrowCounterClockwiseIcon size={18} color={text.primary} weight="bold" />}
        <Text style={[styles.label, busy && styles.labelBusy]}>{busy ? "Resetting" : "Hold to reset"}</Text>
      </Pressable>
      {failed ? <Text style={styles.error}>{failed}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: space.section, padding: space.xl, borderRadius: radius.card + 4, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.canvas },
  title: { ...type.sectionTitle, color: text.primary },
  body: { ...type.supporting, color: text.secondary, marginTop: space.xs },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: layout.controlHeight,
    marginTop: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: DANGER,
    overflow: "hidden",
  },
  fill: { backgroundColor: DANGER, transformOrigin: "left" },
  label: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  labelBusy: { color: text.inverse },
  error: { ...type.caption, color: DANGER, marginTop: space.sm },
});
