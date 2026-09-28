import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { StopIcon } from "phosphor-react-native";

import { accent, layout, motion, radius, space, text, type } from "@/constants/design";

const HOLD_MS = 1100;

export const HoldToEnd = ({ onEnd }: { onEnd: () => void }) => {
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(0);
  const press = useSharedValue(0);
  const [holding, setHolding] = useState(false);
  const [width, setWidth] = useState(0);

  const finish = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setHolding(false);
    onEnd();
  };

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const shellStyle = useAnimatedStyle(() =>
    reduceMotion ? {} : { transform: [{ scale: 1 - press.value * 0.03 }] },
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="End the walk"
      accessibilityHint="Press and hold to end"
      accessibilityActions={[{ name: "activate" }]}
      onAccessibilityAction={finish}
      onPressIn={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setHolding(true);
        press.value = withTiming(1, { duration: motion.duration.pressIn, easing: motion.easing.out });
        fill.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear }, (done) => {
          if (done) runOnJS(finish)();
        });
      }}
      onPressOut={() => {
        setHolding(false);
        press.value = withTiming(0, { duration: motion.duration.pressOut, easing: motion.easing.out });
        if (fill.value < 1) {
          fill.value = withTiming(0, { duration: 200, easing: motion.easing.out });
        }
      }}
      style={styles.hit}
    >
      <Animated.View
        style={[styles.shell, shellStyle]}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        <Label holding={holding} tone={text.inverse} />
        <Animated.View style={[styles.fill, fillStyle]}>
          <View style={[styles.fillInner, { width }]}>
            <Label holding={holding} tone={text.primary} />
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
};

const Label = ({ holding, tone }: { holding: boolean; tone: string }) => (
  <View style={styles.label}>
    <StopIcon size={18} color={tone} weight="fill" />
    <Text style={[styles.text, { color: tone }]}>{holding ? "Keep holding" : "Hold to end"}</Text>
  </View>
);

const styles = StyleSheet.create({
  hit: { flex: 1 },
  shell: {
    height: layout.controlHeight + 4,
    borderRadius: radius.pill,
    backgroundColor: text.primary,
    overflow: "hidden",
    justifyContent: "center",
  },
  fill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    backgroundColor: accent.deep,
  },
  fillInner: { height: "100%", justifyContent: "center" },
  label: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  text: { ...type.cardTitle, fontWeight: "700", color: text.inverse },
});
