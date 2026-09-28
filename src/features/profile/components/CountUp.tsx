import { memo, useEffect } from "react";
import { Platform, StyleSheet, TextInput, type StyleProp, type TextStyle } from "react-native";
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { motion } from "@/constants/design";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type CountUpProps = {
  value: number;
  style?: StyleProp<TextStyle>;
  grouped?: boolean;
  delay?: number;
};

export const CountUp = memo(({ value, style, grouped = false, delay = 0 }: CountUpProps) => {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: motion.duration.reveal, easing: motion.easing.out }),
    );
  }, [delay, progress, reduceMotion, value]);

  const animatedProps = useAnimatedProps(() => {
    const current = Math.round(value * progress.value);
    const text = grouped ? current.toLocaleString() : String(current);
    return { text, defaultValue: text } as never;
  }, [grouped, value]);

  const settled = grouped ? value.toLocaleString() : String(value);

  return (
    <AnimatedTextInput
      editable={false}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no"
      underlineColorAndroid="transparent"
      defaultValue={settled}
      animatedProps={animatedProps}
      style={[styles.numeral, style]}
    />
  );
});

CountUp.displayName = "CountUp";

const styles = StyleSheet.create({
  numeral: {
    padding: 0,
    margin: 0,
    ...Platform.select({ android: { includeFontPadding: false, textAlignVertical: "center" } }),
  },
});
