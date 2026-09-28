import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Check, Lock } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon, motion, radius, space, text, type } from "@/constants/design";

export type NodeState = "done" | "current" | "available" | "locked";

export const NODE_SIZE = 62;

const BREATH_MS = 1700;

type ChapterNodeProps = {
  index: number;
  state: NodeState;
  label: string;
  onPress: () => void;
  x: number;
  y: number;
};

export const ChapterNode = ({ index, state, label, onPress, x, y }: ChapterNodeProps) => {
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);

  useEffect(() => {
    if (state !== "current" || reduceMotion) {
      breath.value = 0;
      return;
    }
    breath.value = withDelay(
      motion.duration.reveal,
      withRepeat(
        withSequence(
          withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: BREATH_MS, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [breath, reduceMotion, state]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.34 * (1 - breath.value),
    transform: [{ scale: 1 + breath.value * 0.28 }],
  }));

  const locked = state === "locked";
  const dimmed = state === "available" || locked;

  return (
    <View style={[styles.row, { left: x - NODE_SIZE / 2, top: y - NODE_SIZE / 2 }]}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`Step ${index + 1}. ${label}. ${
          state === "done" ? "Completed" : state === "current" ? "Next up" : state === "available" ? "Not started" : "Locked"
        }`}
        accessibilityState={{ disabled: locked }}
        disabled={locked}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
      >
        <View style={styles.markerBox}>
          {state === "current" ? <Animated.View style={[styles.halo, haloStyle]} /> : null}
          <View
            style={[
              styles.marker,
              state === "done" && styles.markerDone,
              state === "current" && styles.markerCurrent,
              dimmed && styles.markerLocked,
            ]}
          >
            {state === "done" ? (
              <Check size={icon.feature} color={bg.surface} weight="bold" />
            ) : state === "current" ? (
              <Text style={styles.step}>{index + 1}</Text>
            ) : state === "available" ? (
              <Text style={styles.stepAvailable}>{index + 1}</Text>
            ) : (
              <Lock size={icon.standard} color={text.tertiary} weight="fill" />
            )}
          </View>
        </View>
      </PressScale>

      <View style={[styles.label, dimmed && styles.labelLocked]}>
        <Text style={[styles.labelText, dimmed && styles.labelTextLocked]} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    right: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  markerBox: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    backgroundColor: accent.deep,
  },
  marker: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: bg.surface,
  },
  markerDone: {
    backgroundColor: text.primary,
  },
  markerCurrent: {
    backgroundColor: accent.deep,
  },
  markerLocked: {
    backgroundColor: bg.subtle,
    borderColor: border.soft,
  },
  step: {
    ...type.sectionTitle,
    fontWeight: "700",
    color: text.primary,
  },
  stepAvailable: {
    ...type.sectionTitle,
    fontWeight: "700",
    color: text.tertiary,
  },
  label: {
    flexShrink: 1,
    marginHorizontal: space.md,
    backgroundColor: bg.surface,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  labelLocked: {
    backgroundColor: "rgba(255, 255, 255, 0.72)",
  },
  labelText: {
    ...type.cardTitle,
    fontWeight: "600",
    color: text.primary,
  },
  labelTextLocked: {
    fontWeight: "500",
    color: text.secondary,
  },
});
