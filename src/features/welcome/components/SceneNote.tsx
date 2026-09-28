import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { motion, scene, type } from "@/constants/design";

type SceneNoteProps = {
  lines: readonly string[];
  tilt: number;
  delay?: number;
};

export const SceneNote = ({ lines, tilt, delay = 520 }: SceneNoteProps) => {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: motion.duration.flourish, easing: motion.easing.out }),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotion
      ? [{ rotate: `${tilt}deg` }]
      : [{ rotate: `${tilt}deg` }, { translateY: (1 - progress.value) * 8 }],
  }));

  return (
    <Animated.View style={style} pointerEvents="none" accessibilityElementsHidden>
      {lines.map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  line: {
    ...type.supporting,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "500",
    letterSpacing: 0.2,
    color: scene.sageDeep,
  },
});
