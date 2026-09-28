import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from "react-native-reanimated";

import { bg, border, layout, space, text, type } from "@/constants/design";

export const HEADER_HEIGHT = 52;

export const ScrollHeader = ({
  scrollY,
  title,
  appearAt,
  insetTop,
  left,
  right,
}: {
  scrollY: SharedValue<number>;
  title: string;
  appearAt: number;
  insetTop: number;
  left?: ReactNode;
  right?: ReactNode;
}) => {
  const reduceMotion = useReducedMotion();
  const from = Math.max(appearAt - 80, 0);

  const surface = useAnimatedStyle(() => ({
    opacity: reduceMotion
      ? 1
      : interpolate(scrollY.value, [from, appearAt], [0, 1], {
          extrapolateLeft: Extrapolation.CLAMP,
          extrapolateRight: Extrapolation.CLAMP,
        }),
  }));

  const label = useAnimatedStyle(() => {
    const progress = reduceMotion
      ? 1
      : interpolate(scrollY.value, [from, appearAt], [0, 1], {
          extrapolateLeft: Extrapolation.CLAMP,
          extrapolateRight: Extrapolation.CLAMP,
        });
    return { opacity: progress, transform: [{ translateY: (1 - progress) * 7 }] };
  });

  return (
    <>
      <Animated.View
        style={[styles.surface, { height: insetTop + HEADER_HEIGHT }, surface]}
        pointerEvents="none"
      />
      <View style={[styles.bar, { top: insetTop }]} pointerEvents="box-none">
        <View style={styles.slot}>{left}</View>
        <Animated.Text style={[styles.title, label]} numberOfLines={1}>
          {title}
        </Animated.Text>
        <View style={styles.slot}>{right}</View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  surface: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: bg.canvas,
    borderBottomWidth: 1,
    borderBottomColor: border.soft,
    zIndex: 2,
  },
  bar: {
    position: "absolute",
    left: layout.gutter,
    right: layout.gutter,
    height: HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    zIndex: 3,
  },
  slot: { minWidth: 44, flexDirection: "row", alignItems: "center" },
  title: {
    ...type.cardTitle,
    fontWeight: "600",
    color: text.primary,
    flex: 1,
    textAlign: "center",
  },
});
