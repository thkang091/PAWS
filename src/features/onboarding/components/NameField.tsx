import { useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import { XCircle } from "phosphor-react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withTiming,
} from "react-native-reanimated";

import { PressScale } from "@/components/ui/PressScale";
import { bg, border, icon, layout, motion, radius, space, text, type } from "@/constants/design";

type NameFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onSubmitEditing?: () => void;
};

export const NameField = ({ value, onChangeText, placeholder, onSubmitEditing }: NameFieldProps) => {
  const [focused, setFocused] = useState(false);
  const reduceMotion = useReducedMotion();
  const hasValue = value.length > 0;

  const focusProgress = useDerivedValue(
    () => withTiming(focused ? 1 : 0, { duration: motion.duration.select, easing: motion.easing.out }),
    [focused],
  );
  const clearProgress = useDerivedValue(
    () => withTiming(hasValue ? 1 : 0, { duration: motion.duration.select, easing: motion.easing.out }),
    [hasValue],
  );

  const fieldStyle = useAnimatedStyle(() => ({
    borderColor: focusProgress.value > 0.5 ? border.strong : border.soft,
  }));

  const clearStyle = useAnimatedStyle(() => ({
    opacity: clearProgress.value,
    transform: reduceMotion ? [] : [{ scale: 0.9 + clearProgress.value * 0.1 }],
  }));

  return (
    <Animated.View style={[styles.field, fieldStyle]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={text.tertiary}
        style={styles.input}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        maxLength={40}
        accessibilityLabel="Your dog's name"
      />
      <Animated.View style={clearStyle} pointerEvents={hasValue ? "auto" : "none"}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Clear name"
          hitSlop={12}
          onPress={() => onChangeText("")}
          scaleTo={0.9}
        >
          <XCircle size={icon.feature} color={border.strong} weight="fill" />
        </PressScale>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  field: {
    height: layout.controlHeight,
    borderRadius: radius.input,
    borderWidth: 1,
    backgroundColor: bg.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: space.xl,
    paddingRight: space.lg,
  },
  input: {
    flex: 1,
    ...type.body,
    fontSize: 17,
    color: text.primary,
    paddingVertical: 0,
    marginRight: space.sm,
  },
});
