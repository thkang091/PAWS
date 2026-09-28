import { StyleSheet, Text, View } from "react-native";
import { useEffect, useRef } from "react";
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

import { PawsDog } from "@/components/mascot/PawsDog";
import { PressScale } from "@/components/ui/PressScale";
import type { AgeBucketOption } from "@/constants/onboardingOptions";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

type AgeCardProps = {
  option: AgeBucketOption;
  selected: boolean;
  onSelect: () => void;
};

export const AgeCard = ({ option, selected, onSelect }: AgeCardProps) => {
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(1);
  const wasSelected = useRef(selected);

  useEffect(() => {
    const justChosen = !wasSelected.current && selected;
    wasSelected.current = selected;
    if (!justChosen || reduceMotion) return;
    pop.value = withSequence(
      withTiming(1.02, { duration: 110, easing: motion.easing.out }),
      withSpring(1, motion.spring),
    );
  }, [selected, reduceMotion]);

  const progress = useDerivedValue(
    () => withTiming(selected ? 1 : 0, { duration: motion.duration.select, easing: motion.easing.out }),
    [selected],
  );

  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [bg.surface, accent.primary]),
    borderColor: interpolateColor(progress.value, [0, 1], [border.soft, accent.primary]),
    transform: reduceMotion ? [] : [{ scale: pop.value }],
  }));

  const detailStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [text.tertiary, text.secondary]),
  }));

  return (
    <PressScale
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={option.detail ? `${option.title}, ${option.detail}` : option.title}
      onPress={() => {
        void Haptics.selectionAsync();
        onSelect();
      }}
      style={styles.press}
    >
      <Animated.View style={[styles.card, surfaceStyle]}>
        <View style={styles.art}>
          <PawsDog size={66} pose={option.pose} curious={option.curious} />
        </View>
        <Text
          style={styles.title}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
        >
          {option.title}
        </Text>
        {option.detail ? (
          <Animated.Text
            style={[styles.detail, detailStyle]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            {option.detail}
          </Animated.Text>
        ) : null}
      </Animated.View>
    </PressScale>
  );
};

const styles = StyleSheet.create({
  press: {
    flex: 1,
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    paddingVertical: space.lg,
    paddingHorizontal: space.xs,
    alignItems: "center",
    minHeight: 132,
  },
  art: {
    height: 53,
    justifyContent: "flex-end",
    marginBottom: space.sm,
  },
  title: {
    ...type.caption,
    fontSize: 13,
    fontWeight: "500",
    color: text.primary,
    textAlign: "center",
  },
  detail: {
    ...type.caption,
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
  },
});
