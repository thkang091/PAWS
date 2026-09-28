import { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { FEED_ART } from "@/features/care/components/feedPaths";
import { motion } from "@/constants/design";

export const feedArtAspect = FEED_ART.aspect;

export const FeedArt = memo(({ width, cheer }: { width: number; cheer: number }) => {
  const reduceMotion = useReducedMotion();
  const height = width / FEED_ART.aspect;

  const bob = useSharedValue(0);

  useEffect(() => {
    if (cheer === 0 || reduceMotion) return;
    bob.value = withSequence(
      withTiming(1, { duration: 180, easing: motion.easing.out }),
      withSpring(0, { duration: 620, dampingRatio: 0.55 }),
    );
  }, [bob, cheer, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -bob.value * 10 }, { scale: 1 + bob.value * 0.035 }],
  }));

  return (
    <Animated.View style={[styles.root, { width, height }, style]}>
      <Svg width={width} height={height} viewBox={FEED_ART.viewBox}>
        <G transform={FEED_ART.transform}>
          {FEED_ART.layers.map((layer, index) => (
            <Path key={index} d={layer.d} fill={layer.fill} />
          ))}
        </G>
      </Svg>
    </Animated.View>
  );
});

FeedArt.displayName = "FeedArt";

const styles = StyleSheet.create({
  root: { alignSelf: "flex-end" },
});
