import { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { G, Path } from "react-native-svg";

import { accent, motion, text } from "@/constants/design";

export const HeartDoodle = ({ size = 34, delay = 760 }: { size?: number; delay?: number }) => {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: motion.duration.enter, easing: motion.easing.out }),
    );
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotion ? [] : [{ scale: 0.9 + progress.value * 0.1 }],
  }));

  return (
    <Animated.View style={animatedStyle} pointerEvents="none">
      <Svg width={size} height={size * 0.82} viewBox="0 0 34 28">
        <G stroke={text.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path
            d="M12 25 C4 19 2 13 5 8 C8 4 13 5 15 9 C17 4 22 4 24 8 C27 13 21 19 12 25 Z"
            fill={accent.primary}
          />
          <Path d="M27 10 L33 8" fill="none" />
          <Path d="M27 15 L32 16" fill="none" />
        </G>
      </Svg>
    </Animated.View>
  );
};
