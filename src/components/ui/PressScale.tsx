import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { motion } from "@/constants/design";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressScaleProps = Omit<PressableProps, "style" | "children"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

export const PressScale = ({ children, style, scaleTo = 0.97, disabled, ...rest }: PressScaleProps) => {
  const pressed = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {};
    return { transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }] };
  }, [reduceMotion, scaleTo]);

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        pressed.value = withTiming(1, {
          duration: motion.duration.pressIn,
          easing: motion.easing.out,
        });
        rest.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withTiming(0, {
          duration: motion.duration.pressOut,
          easing: motion.easing.out,
        });
        rest.onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
};
