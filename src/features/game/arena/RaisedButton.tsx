import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { accent, bg, border, text } from "@/constants/design";

const LIP = 5;

const TONES = {
  yellow: { face: accent.deep, lip: "#E1AE45", ink: text.primary, sub: "rgba(28,27,26,0.62)" },
  white: { face: bg.surface, lip: border.default, ink: text.primary, sub: text.secondary },
  dark: { face: "#2A2926", lip: "#0F0F0E", ink: "#FFFFFF", sub: "rgba(255,255,255,0.66)" },
} as const;

/**
 * The game's main button: a raised face on a darker lip, the same as the steps on the Train path. Pressed, the face
 * sinks onto the lip.
 */
export const RaisedButton = ({
  label,
  sub,
  icon,
  tone = "yellow",
  disabled,
  busy,
  height = 60,
  style,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  sub?: string;
  icon?: ReactNode;
  tone?: keyof typeof TONES;
  disabled?: boolean;
  busy?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
  accessibilityLabel?: string;
}) => {
  const reduceMotion = useReducedMotion();
  const sink = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: sink.value * (LIP - 1) }] }));
  const t = TONES[tone];
  const off = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (sub ? `${label}. ${sub}` : label)}
      accessibilityState={{ disabled: Boolean(off), busy: Boolean(busy) }}
      disabled={off}
      style={[{ height: height + LIP }, style]}
      onPressIn={() => {
        sink.value = reduceMotion ? 1 : withTiming(1, { duration: 70 });
      }}
      onPressOut={() => {
        sink.value = reduceMotion ? 0 : withSpring(0, { damping: 14, stiffness: 320 });
      }}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
    >
      <View style={[styles.lip, { top: LIP, height, backgroundColor: t.lip }, off && styles.off]} />
      <Animated.View style={[styles.face, { height, backgroundColor: t.face }, off && styles.off, face]}>
        {busy ? (
          <ActivityIndicator color={t.ink} />
        ) : (
          <>
            {icon}
            <View style={styles.copy}>
              <Text style={[styles.label, { color: t.ink }]} numberOfLines={1}>
                {label}
              </Text>
              {sub ? (
                <Text style={[styles.sub, { color: t.sub }]} numberOfLines={1}>
                  {sub}
                </Text>
              ) : null}
            </View>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  lip: { position: "absolute", left: 0, right: 0, borderRadius: 20 },
  face: { borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 20 },
  copy: { alignItems: "center" },
  label: { fontSize: 17, lineHeight: 22, fontWeight: "800", letterSpacing: -0.2 },
  sub: { fontSize: 12, lineHeight: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
  off: { opacity: 0.5 },
});
