import { StyleSheet, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

export const Chip = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => {
  const progress = useDerivedValue(
    () => withTiming(selected ? 1 : 0, { duration: motion.duration.select, easing: motion.easing.out }),
    [selected],
  );

  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [bg.surface, accent.primary]),
    borderColor: interpolateColor(progress.value, [0, 1], [border.soft, accent.primary]),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [text.secondary, text.primary]),
  }));

  return (
    <PressScale
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
    >
      <Animated.View style={[styles.chip, surfaceStyle]}>
        <Animated.Text style={[styles.label, labelStyle]}>{label}</Animated.Text>
      </Animated.View>
    </PressScale>
  );
};

type SelectChipRowProps<T extends string> = {
  options: ReadonlyArray<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
};

export const SelectChipRow = <T extends string>({
  options,
  value,
  onChange,
}: SelectChipRowProps<T>) => (
  <View style={styles.row}>
    {options.map((option) => (
      <Chip
        key={option.value}
        label={option.label}
        selected={value === option.value}
        onPress={() => onChange(option.value)}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  chip: {
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...type.supporting,
    fontSize: 15,
    fontWeight: "500",
  },
});
