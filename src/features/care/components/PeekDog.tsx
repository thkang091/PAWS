import { useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { layout, motion } from "@/constants/design";

const K = 0.34;
const DOG = { w: Math.round(191 * K), h: Math.round(376 * K) };
const BUBBLE = { w: Math.round(227 * K), h: Math.round(124 * K) };
const LINES = { w: Math.round(44 * K), h: Math.round(101 * K) };
const LEFT = 36;
const TOP = 30;

export const PEEK_WIDTH = DOG.w + LEFT;

const DRAG = 96;
const COMMIT = 0.55;
const SPRING = { duration: 420, dampingRatio: 0.72 };

export const PeekDog = ({ onStart, hint }: { onStart: () => void; hint: string }) => {
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  const leaving = useSharedValue(0);
  const armed = useSharedValue(0);
  const pulse = useSharedValue(0);

  const tick = () => void Haptics.selectionAsync();
  const go = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStart();
  }, [onStart]);

  useFocusEffect(
    useCallback(() => {
      x.value = 0;
      leaving.value = 0;
      armed.value = 0;
    }, [armed, leaving, x]),
  );

  useEffect(() => {
    if (reduceMotion) return;
    x.value = withDelay(900, withSequence(withTiming(-16, { duration: 260, easing: motion.easing.out }), withSpring(0, SPRING)));
    pulse.value = withDelay(900, withSequence(withTiming(1, { duration: 260 }), withTiming(0, { duration: 420 })));
  }, [pulse, reduceMotion, x]);

  const leave = () => {
    "worklet";
    leaving.value = withTiming(1, { duration: 240, easing: motion.easing.out });
    x.value = withTiming(-DRAG * 1.6, { duration: 240, easing: motion.easing.out }, (done) => {
      if (done) runOnJS(go)();
    });
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-14, 14])
    .onUpdate((event) => {
      const raw = event.translationX;
      x.value = raw < 0 ? Math.max(-DRAG * 1.15, raw) : raw * 0.18;
      const past = -x.value / DRAG >= COMMIT ? 1 : 0;
      if (past !== armed.value) {
        armed.value = past;
        runOnJS(tick)();
      }
    })
    .onEnd((event) => {
      const progress = -x.value / DRAG;
      if (progress >= COMMIT || event.velocityX < -700) {
        leave();
      } else {
        armed.value = 0;
        x.value = withSpring(0, SPRING);
      }
    });

  const tap = Gesture.Tap()
    .maxDuration(260)
    .onEnd(() => {
      leave();
    });

  const gesture = Gesture.Exclusive(pan, tap);

  const dogStyle = useAnimatedStyle(() => {
    const p = interpolate(-x.value, [0, DRAG], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: 1 - leaving.value,
      transform: [{ translateX: x.value }, { rotate: `${-p * 9}deg` }, { scale: 1 + p * 0.04 }],
    };
  });

  const bubbleStyle = useAnimatedStyle(() => {
    const p = interpolate(-x.value, [0, DRAG], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: 1 - Math.min(1, leaving.value * 1.6),
      transform: [
        { translateX: x.value * 0.85 },
        { translateY: -p * 8 },
        { rotate: `${-p * 4}deg` },
        { scale: 1 + p * 0.08 + pulse.value * 0.05 },
      ],
    };
  });

  const linesStyle = useAnimatedStyle(() => {
    const p = interpolate(-x.value, [0, DRAG], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: 1 - leaving.value,
      transform: [{ translateX: x.value * 0.9 - p * 10 }, { scale: 1 + p * 0.35 + pulse.value * 0.2 }],
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.root}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Let's walk. Start a walk"
        accessibilityHint={hint}
        accessibilityActions={[{ name: "activate" }]}
        onAccessibilityAction={() => go()}
      >
        <Animated.View style={[styles.lines, linesStyle]} pointerEvents="none">
          <Image source={require("../../../../assets/walk/lines.png")} style={styles.fill} contentFit="contain" />
        </Animated.View>
        <Animated.View style={[styles.dog, dogStyle]}>
          <Image source={require("../../../../assets/walk/dog.png")} style={styles.fill} contentFit="contain" />
        </Animated.View>
        <Animated.View style={[styles.bubble, bubbleStyle]} pointerEvents="none">
          <Image source={require("../../../../assets/walk/bubble.png")} style={styles.fill} contentFit="contain" />
        </Animated.View>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    right: -layout.gutter,
    top: 6,
    width: PEEK_WIDTH,
    height: DOG.h + TOP,
  },
  fill: { width: "100%", height: "100%" },
  dog: { position: "absolute", left: LEFT, top: TOP, width: DOG.w, height: DOG.h, transformOrigin: "right bottom" },
  bubble: { position: "absolute", left: 0, top: 0, width: BUBBLE.w, height: BUBBLE.h, transformOrigin: "right bottom" },
  lines: { position: "absolute", left: LEFT - 22, top: TOP + 20, width: LINES.w, height: LINES.h, transformOrigin: "right center" },
});
