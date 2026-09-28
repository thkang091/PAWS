import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { PawsDogFetch } from "@/components/mascot/PawsDog";
import { motion } from "@/constants/design";

const DOG_WIDTH = 138;
const TRAVEL = 16;
const FRAME_WIDTH = DOG_WIDTH + TRAVEL;
const BOB = 4;
const BREATH_MS = 1700;

export const MascotRunner = ({ progress }: { progress: number }) => {
  const reduceMotion = useReducedMotion();
  const bob = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      bob.value = 0;
      return;
    }
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: BREATH_MS, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [reduceMotion]);

  const advance = useDerivedValue(
    () =>
      withTiming(progress, {
        duration: motion.duration.reveal,
        easing: motion.easing.out,
      }),
    [progress],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: advance.value * TRAVEL },
      { translateY: reduceMotion ? 0 : -bob.value * BOB },
    ],
  }));

  return (
    <View style={styles.frame} pointerEvents="none">
      <Animated.View style={animatedStyle}>
        <PawsDogFetch width={DOG_WIDTH} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    width: FRAME_WIDTH,
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },
});
