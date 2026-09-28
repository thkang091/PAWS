import { useEffect, type ReactNode } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { motion } from "@/constants/design";

const TRAVEL = 18;

type QuestionBlockProps = {
  children: ReactNode;
  onMeasure?: (y: number) => void;
  onRevealed?: () => void;
  style?: StyleProp<ViewStyle>;
};

export const QuestionBlock = ({
  children,
  onMeasure,
  onRevealed,
  style,
}: QuestionBlockProps) => {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: motion.duration.reveal,
      easing: motion.easing.out,
    });
    onRevealed?.();
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotion ? [] : [{ translateY: (1 - progress.value) * TRAVEL }],
  }));

  const handleLayout = (event: LayoutChangeEvent) => onMeasure?.(event.nativeEvent.layout.y);

  return (
    <Animated.View style={[style, animatedStyle]} onLayout={handleLayout}>
      {children}
    </Animated.View>
  );
};
