import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { theme } from "@/constants/theme";

type ProgressBarProps = {
  progress: number;
  accessibilityLabel: string;
};

export const ProgressBar = ({ progress, accessibilityLabel }: ProgressBarProps) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const animatedProgress = useSharedValue(clampedProgress);

  useEffect(() => {
    animatedProgress.value = withTiming(clampedProgress, { duration: 350 });
  }, [animatedProgress, clampedProgress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animatedProgress.value * 100}%`,
  }));

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clampedProgress * 100) }}
      style={styles.track}
    >
      <Animated.View style={[styles.fill, animatedStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: 10,
    overflow: "hidden",
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primarySoft,
  },
  fill: {
    height: "100%",
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary,
  },
});
