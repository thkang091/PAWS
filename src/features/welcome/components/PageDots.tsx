import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

import { accent, border, space } from "@/constants/design";

const DOT = 8;
const PILL = 26;

const Dot = ({ index, progress }: { index: number; progress: SharedValue<number> }) => {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(progress.value - index);
    return {
      width: interpolate(distance, [0, 1], [PILL, DOT], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(
        Math.min(distance, 1),
        [0, 1],
        [accent.deep, border.default],
      ),
    };
  });

  return <Animated.View style={[styles.dot, style]} />;
};

export const PageDots = ({
  count,
  progress,
}: {
  count: number;
  progress: SharedValue<number>;
}) => (
  <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {Array.from({ length: count }, (_, index) => (
      <Dot key={index} index={index} progress={progress} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: space.sm,
  },
  dot: {
    height: DOT,
    borderRadius: DOT / 2,
  },
});
