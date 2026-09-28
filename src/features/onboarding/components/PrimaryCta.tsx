import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { ArrowRight } from "phosphor-react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, icon, layout, motion, radius, space, text, type } from "@/constants/design";

type PrimaryCtaProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export const PrimaryCta = ({ label, onPress, disabled = false, loading = false }: PrimaryCtaProps) => {
  const inactive = disabled || loading;
  const reduceMotion = useReducedMotion();

  const progress = useDerivedValue(
    () => withTiming(inactive ? 0 : 1, { duration: motion.duration.select, easing: motion.easing.out }),
    [inactive],
  );

  const pressed = useSharedValue(0);
  const settle = useSharedValue(1);
  const wasInactive = useRef(inactive);

  useEffect(() => {
    const woke = wasInactive.current && !inactive;
    wasInactive.current = inactive;
    if (!woke || reduceMotion) return;
    settle.value = withSequence(
      withTiming(0.985, { duration: 90, easing: motion.easing.out }),
      withSpring(1, motion.spring),
    );
  }, [inactive, reduceMotion]);

  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [bg.subtle, accent.deep]),
    transform: reduceMotion ? [] : [{ scale: settle.value }],
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    transform: reduceMotion ? [] : [{ translateX: pressed.value * 5 }],
  }));

  const contentColor = inactive ? text.disabled : text.primary;

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPressIn={() => {
        pressed.value = withTiming(1, {
          duration: motion.duration.pressIn,
          easing: motion.easing.out,
        });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, {
          duration: motion.duration.pressOut,
          easing: motion.easing.out,
        });
      }}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <Animated.View style={[styles.button, surfaceStyle]}>
        {loading ? (
          <ActivityIndicator color={text.secondary} />
        ) : (
          <>
            <Text style={[styles.label, { color: contentColor }]}>{label.toUpperCase()}</Text>
            <Animated.View style={[styles.arrow, arrowStyle]}>
              <ArrowRight size={icon.button} color={contentColor} weight="regular" />
            </Animated.View>
          </>
        )}
      </Animated.View>
    </PressScale>
  );
};

const styles = StyleSheet.create({
  button: {
    height: layout.controlHeight,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xxl,
    flexDirection: "row",
  },
  label: {
    ...type.button,
  },
  arrow: {
    position: "absolute",
    right: space.xxl,
  },
});
