import { StyleSheet, Text } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

type ScaleRowProps = {
  title: string;
  consequence: string;
  selected: boolean;
  onSelect: () => void;
};

export const ScaleRow = ({ title, consequence, selected, onSelect }: ScaleRowProps) => {
  const progress = useDerivedValue(
    () =>
      withTiming(selected ? 1 : 0, {
        duration: motion.duration.select,
        easing: motion.easing.out,
      }),
    [selected],
  );

  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [bg.surface, accent.primary]),
    borderColor: interpolateColor(progress.value, [0, 1], [border.soft, accent.primary]),
  }));

  const consequenceStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [text.secondary, text.primary]),
  }));

  return (
    <PressScale
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${consequence}`}
      onPress={() => {
        void Haptics.selectionAsync();
        onSelect();
      }}
    >
      <Animated.View style={[styles.row, surfaceStyle]}>
        <Text style={styles.title}>{title}</Text>
        <Animated.Text style={[styles.consequence, consequenceStyle]}>
          {consequence}
        </Animated.Text>
      </Animated.View>
    </PressScale>
  );
};

const styles = StyleSheet.create({
  row: {
    borderRadius: radius.card,
    borderWidth: 1,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
  },
  title: {
    ...type.cardTitle,
    color: text.primary,
  },
  consequence: {
    ...type.supporting,
    fontSize: 14,
    marginTop: 4,
  },
});
