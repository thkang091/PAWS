import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { accent, motion, radius, space, text, type } from "@/constants/design";

export type HeadlineWord = {
  text: string;
  accent?: boolean;
  suffix?: string;
};

const AccentBar = ({ delay }: { delay: number }) => {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: motion.duration.flourish, easing: motion.easing.out }),
    );
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: progress.value };
    return { opacity: 1, transform: [{ scaleX: progress.value }] };
  });

  return <Animated.View style={[styles.bar, animatedStyle]} />;
};

type AccentHeadlineProps = {
  words: HeadlineWord[];
  barDelay?: number;
  trailing?: ReactNode;
};

export const AccentHeadline = ({ words, barDelay = 420, trailing }: AccentHeadlineProps) => (
  <View
    accessibilityRole="header"
    accessibilityLabel={words.map((w) => `${w.text}${w.suffix ?? ""}`).join(" ")}
    style={styles.row}
  >
    {words.map((word, index) => {
      const isLast = index === words.length - 1;
      return (
        <View key={`${word.text}-${index}`} style={styles.item}>
          <View>
            <Text style={styles.text}>{word.text}</Text>
            {word.accent ? <AccentBar delay={barDelay} /> : null}
          </View>
          {word.suffix ? <Text style={styles.text}>{word.suffix}</Text> : null}
          {isLast && trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginRight: 10,
  },
  text: {
    ...type.hero,
    color: text.primary,
  },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -4,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
    transformOrigin: "left",
  },
  trailing: {
    marginLeft: space.sm,
    marginBottom: space.md,
  },
});
