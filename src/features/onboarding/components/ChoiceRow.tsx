import { StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { Bone, Heart, House, PawPrint, type Icon as PhosphorIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import type { TogetherIcon } from "@/constants/onboardingOptions";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

const GLYPHS: Record<TogetherIcon, PhosphorIcon> = {
  house: House,
  paw: PawPrint,
  bone: Bone,
  heart: Heart,
};

type ChoiceRowProps = {
  icon?: TogetherIcon;
  label: string;
  selected: boolean;
  onSelect: () => void;
};

export const ChoiceRow = ({ icon, label, selected, onSelect }: ChoiceRowProps) => {
  const Glyph = icon ? GLYPHS[icon] : null;
  const reduceMotion = useReducedMotion();

  const progress = useDerivedValue(
    () => withTiming(selected ? 1 : 0, { duration: motion.duration.select, easing: motion.easing.out }),
    [selected],
  );

  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [bg.surface, accent.primary]),
    borderColor: interpolateColor(progress.value, [0, 1], [border.soft, accent.primary]),
  }));

  const outlineStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const filledStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [border.default, text.primary]),
  }));

  const dotScale = useDerivedValue(
    () => (selected ? withSpring(1, motion.spring) : withTiming(0.5, { duration: motion.duration.exit })),
    [selected],
  );

  const dotStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotion ? [] : [{ scale: dotScale.value }],
  }));

  return (
    <PressScale
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        void Haptics.selectionAsync();
        onSelect();
      }}
    >
      <Animated.View style={[styles.row, surfaceStyle]}>
        {Glyph ? (
          <View style={styles.glyph}>
            <Animated.View style={outlineStyle}>
              <Glyph size={iconSize.feature} color={text.primary} weight="regular" />
            </Animated.View>
            <Animated.View style={[styles.glyphOverlay, filledStyle]}>
              <Glyph size={iconSize.feature} color={text.primary} weight="fill" />
            </Animated.View>
          </View>
        ) : null}
        <Text style={[styles.label, !Glyph && styles.labelFlush]} numberOfLines={2}>
          {label}
        </Text>
        <Animated.View style={[styles.ring, ringStyle]}>
          <Animated.View style={[styles.dot, dotStyle]} />
        </Animated.View>
      </Animated.View>
    </PressScale>
  );
};

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    borderRadius: radius.input,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  glyph: {
    width: 24,
    height: 24,
  },
  glyphOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  label: {
    ...type.cardTitle,
    color: text.primary,
    flex: 1,
    marginLeft: space.lg,
  },
  labelFlush: {
    marginLeft: 0,
  },
  ring: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: radius.pill,
    backgroundColor: text.primary,
  },
});
