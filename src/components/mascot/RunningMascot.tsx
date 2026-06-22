import { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { MascotFallback } from "@/components/mascot/MascotFallback";

type RunningMascotProps = {
  duration?: number;
  size?: number;
  onAnimationComplete?: () => void;
  loop?: boolean;
};

export const RunningMascot = ({
  duration = 5000,
  size = 112,
  onAnimationComplete,
  loop = false,
}: RunningMascotProps) => {
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(-size);
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateX.value = -size;
    translateY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 220, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      true,
    );

    const destination = width + size;
    const finish = (completed?: boolean) => {
      if (completed && onAnimationComplete) {
        runOnJS(onAnimationComplete)();
      }
    };

    translateX.value = loop
      ? withRepeat(
          withTiming(destination, { duration, easing: Easing.linear }),
          -1,
          false,
        )
      : withTiming(destination, { duration, easing: Easing.linear }, finish);
  }, [duration, loop, onAnimationComplete, size, translateX, translateY, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <View pointerEvents="none" style={[styles.track, { height: size + 24 }]}>
      <Animated.View style={[styles.mascot, animatedStyle]}>
        <MascotFallback size={size} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    alignSelf: "stretch",
    justifyContent: "center",
    overflow: "hidden",
  },
  mascot: {
    position: "absolute",
    left: 0,
  },
});
