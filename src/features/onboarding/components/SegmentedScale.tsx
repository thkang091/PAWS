import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

const TRACK_INSET = 4;

type SegmentedScaleProps<T extends string | number> = {
  options: readonly T[];
  format: (option: T) => string;
  value: T | null;
  onChange: (option: T) => void;
  accessibilityLabel?: string;
};

export const SegmentedScale = <T extends string | number>({
  options,
  format,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedScaleProps<T>) => {
  const [width, setWidth] = useState(0);
  const reduceMotion = useReducedMotion();

  const index = value === null ? -1 : options.indexOf(value);
  const slot = width > 0 ? (width - TRACK_INSET * 2) / options.length : 0;

  const position = useDerivedValue(
    () =>
      withTiming(Math.max(index, 0), {
        duration: motion.duration.select,
        easing: motion.easing.out,
      }),
    [index],
  );
  const shown = useDerivedValue(
    () =>
      withTiming(index < 0 ? 0 : 1, {
        duration: motion.duration.select,
        easing: motion.easing.out,
      }),
    [index],
  );

  const thumbStyle = useAnimatedStyle(() => ({
    width: slot,
    opacity: shown.value,
    transform: reduceMotion ? [] : [{ translateX: TRACK_INSET + position.value * slot }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={styles.track}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.thumb, thumbStyle]} pointerEvents="none" />
      {options.map((option, i) => (
        <Stop
          key={String(option)}
          label={format(option)}
          selected={i === index}
          onPress={() => {
            void Haptics.selectionAsync();
            onChange(option);
          }}
        />
      ))}
    </View>
  );
};

const Stop = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => {
  const progress = useDerivedValue(
    () =>
      withTiming(selected ? 1 : 0, {
        duration: motion.duration.select,
        easing: motion.easing.out,
      }),
    [selected],
  );

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [text.secondary, text.primary]),
  }));

  return (
    <PressScale
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.98}
      style={styles.stop}
    >
      <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
        {label}
      </Animated.Text>
    </PressScale>
  );
};

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    height: 56,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.surface,
    padding: TRACK_INSET,
    alignItems: "stretch",
  },
  thumb: {
    position: "absolute",
    top: TRACK_INSET,
    bottom: TRACK_INSET,
    left: 0,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  stop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...type.supporting,
    fontSize: 15,
    fontWeight: "500",
    paddingHorizontal: space.xs,
  },
});
