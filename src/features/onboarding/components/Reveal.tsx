import { useEffect, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { motion } from "@/constants/design";

type RevealProps = {
  children: ReactNode;
  index?: number;
  offset?: number;
  style?: StyleProp<ViewStyle>;
};

export const Reveal = ({ children, index = 0, offset = 0, style }: RevealProps) => {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    progress.value = withDelay(
      offset + index * motion.stagger,
      withTiming(1, { duration: motion.duration.enter, easing: motion.easing.out }),
    );
  }, [index, offset, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotion ? [] : [{ translateY: (1 - progress.value) * 10 }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
};
