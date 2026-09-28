import { StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { FocusPose } from "@/components/mascot/FocusPose";
import type { FocusPoseKey } from "@/components/mascot/focusPosePaths";
import { PressScale } from "@/components/ui/PressScale";
import {
  accent,
  motion,
  pastel,
  radius,
  space,
  text,
  type,
  type PastelTint,
} from "@/constants/design";

const ART_WIDTH = 84;

const REST_BORDER = "rgba(28, 27, 26, 0.07)";

type FocusCardProps = {
  title: string;
  blurb: string;
  pose: FocusPoseKey;
  tint: PastelTint;
  selected: boolean;
  onPress: () => void;
};

export const FocusCard = ({ title, blurb, pose, tint, selected, onPress }: FocusCardProps) => {
  const progress = useDerivedValue(
    () =>
      withTiming(selected ? 1 : 0, {
        duration: motion.duration.select,
        easing: motion.easing.out,
      }),
    [selected],
  );

  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [pastel[tint], accent.primary]),
    borderColor: interpolateColor(progress.value, [0, 1], [REST_BORDER, text.primary]),
  }), [tint]);

  return (
    <PressScale
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${blurb}`}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={styles.press}
    >
      <Animated.View style={[styles.card, surfaceStyle]}>
        <View style={styles.art}>
          <FocusPose pose={pose} width={ART_WIDTH} />
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.blurb} numberOfLines={3}>
          {blurb}
        </Text>
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
    paddingVertical: space.md,
    paddingHorizontal: 10,
    minHeight: 178,
  },
  art: {
    alignItems: "center",
    marginBottom: space.sm,
  },
  title: {
    ...type.supporting,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: text.primary,
  },
  blurb: {
    ...type.caption,
    fontSize: 11,
    lineHeight: 15,
    color: text.secondary,
    marginTop: 3,
  },
});
