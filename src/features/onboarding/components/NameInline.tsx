import { useEffect, useRef } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withTiming,
} from "react-native-reanimated";

import { accent, motion, radius, text, type } from "@/constants/design";

const PLACEHOLDER = "your dog";

type NameInlineProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  autoFocus?: boolean;
};

export const NameInline = ({ value, onChangeText, onSubmit, autoFocus }: NameInlineProps) => {
  const input = useRef<TextInput>(null);
  const reduceMotion = useReducedMotion();
  const filled = value.length > 0;

  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => input.current?.focus(), motion.duration.enter + 80);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  const fill = useDerivedValue(
    () => withTiming(filled ? 1 : 0, { duration: motion.duration.select, easing: motion.easing.out }),
    [filled],
  );

  const barStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + fill.value * 0.5,
    transform: reduceMotion ? [] : [{ scaleY: 0.6 + fill.value * 0.4 }],
  }));

  return (
    <View>
      <Text style={[styles.text, styles.ghost]} numberOfLines={1}>
        {value || PLACEHOLDER}
      </Text>

      <TextInput
        ref={input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={PLACEHOLDER}
        placeholderTextColor={text.tertiary}
        style={[styles.text, styles.input]}
        selectionColor={text.primary}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="next"
        maxLength={24}
        accessibilityLabel="Your dog's name"
        submitBehavior="blurAndSubmit"
      />

      <Animated.View style={[styles.bar, barStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  text: {
    ...type.hero,
    color: text.primary,
    padding: 0,
    margin: 0,
    includeFontPadding: false,
  },
  ghost: {
    opacity: 0,
  },
  input: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -4,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
    transformOrigin: "bottom",
  },
});
