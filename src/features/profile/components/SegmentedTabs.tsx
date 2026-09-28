import { memo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

import * as Haptics from "expo-haptics";

import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

type SegmentedTabsProps<T extends string> = {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
};

const TRACK_PAD = 4;

const SegmentedTabsInner = <T extends string>({
  options,
  value,
  onChange,
}: SegmentedTabsProps<T>) => {
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(
    options.findIndex((option) => option.key === value),
    0,
  );
  const segment = trackWidth > 0 ? (trackWidth - TRACK_PAD * 2) / options.length : 0;

  const position = useDerivedValue(
    () =>
      reduceMotion
        ? index
        : withSpring(index, {
            duration: motion.spring.duration,
            dampingRatio: motion.spring.dampingRatio,
          }),
    [index, reduceMotion],
  );

  const select = (key: T) => {
    if (key === value) return;
    void Haptics.selectionAsync();
    onChange(key);
  };

  const chip = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: position.value * segment }],
  }));

  return (
    <View
      style={styles.track}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {segment > 0 ? <Animated.View style={[styles.chip, chip]} /> : null}

      {options.map((option, optionIndex) => (
        <Segment
          key={option.key}
          label={option.label}
          selected={option.key === value}
          index={optionIndex}
          position={position}
          onPress={() => select(option.key)}
        />
      ))}
    </View>
  );
};

export const SegmentedTabs = memo(SegmentedTabsInner) as typeof SegmentedTabsInner;

const Segment = ({
  label,
  selected,
  index,
  position,
  onPress,
}: {
  label: string;
  selected: boolean;
  index: number;
  position: SharedValue<number>;
  onPress: () => void;
}) => {
  const tone = useAnimatedStyle(() => {
    const distance = Math.min(Math.abs(position.value - index), 1);
    return {
      color: interpolateColor(distance, [0, 1], [text.primary, text.secondary]),
    };
  });

  return (
    <PressScale
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      scaleTo={0.96}
      style={styles.segment}
      onPress={onPress}
    >
      <Animated.Text style={[styles.label, selected && styles.labelSelected, tone]}>
        {label}
      </Animated.Text>
    </PressScale>
  );
};

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: TRACK_PAD,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.canvas,
  },
  chip: {
    position: "absolute",
    top: TRACK_PAD,
    left: TRACK_PAD,
    bottom: TRACK_PAD,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.md,
  },
  label: { ...type.supporting, fontWeight: "500" },
  labelSelected: { fontWeight: "600" },
});
