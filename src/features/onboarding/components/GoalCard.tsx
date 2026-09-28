import { StyleSheet, Text, View } from "react-native";
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

type GoalCardProps = {
  title: string;
  subtitle: string;
  rank: number | null;
  onToggle: () => void;
};

export const GoalCard = ({ title, subtitle, rank, onToggle }: GoalCardProps) => {
  const selected = rank !== null;
  const reduceMotion = useReducedMotion();

  const progress = useDerivedValue(
    () => withTiming(selected ? 1 : 0, { duration: motion.duration.select, easing: motion.easing.out }),
    [selected],
  );

  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [bg.surface, accent.primary]),
    borderColor: interpolateColor(progress.value, [0, 1], [border.soft, accent.primary]),
  }));

  const markStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotion ? [] : [{ scale: 0.8 + progress.value * 0.2 }],
  }));

  return (
    <PressScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={() => {
        void Haptics.selectionAsync();
        onToggle();
      }}
    >
      <Animated.View style={[styles.card, surfaceStyle]}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Animated.View style={[styles.mark, markStyle]}>
          <Text style={styles.rank}>{rank}</Text>
        </Animated.View>
      </Animated.View>
    </PressScale>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 76,
  },
  copy: {
    flex: 1,
    marginRight: space.lg,
  },
  title: {
    ...type.cardTitle,
    color: text.primary,
  },
  subtitle: {
    ...type.supporting,
    fontSize: 13,
    color: text.secondary,
    marginTop: 3,
  },
  mark: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: text.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  rank: {
    ...type.caption,
    fontSize: 12,
    fontWeight: "600",
    color: text.inverse,
    lineHeight: 14,
  },
});
