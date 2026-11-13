import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { accent, bg, radius, text } from "@/constants/design";

export type BadgeKind = "live" | "open" | "upcoming" | "finished" | "cancelled" | "soon" | "none";

const TONES: Record<BadgeKind, { bg: string; ink: string; dot?: string }> = {
  live: { bg: accent.deep, ink: text.primary, dot: "#2F8F4E" },
  open: { bg: bg.surface, ink: text.primary, dot: accent.band },
  upcoming: { bg: bg.surface, ink: text.primary },
  finished: { bg: bg.subtle, ink: text.secondary },
  cancelled: { bg: bg.subtle, ink: text.secondary },
  soon: { bg: "rgba(255,255,255,0.92)", ink: text.secondary },
  none: { bg: "rgba(255,255,255,0.92)", ink: text.secondary },
};

/** Where a tournament or game stands, as a small pill. A live one has a slow breathing dot. */
export const TournamentStatusBadge = ({ kind, label }: { kind: BadgeKind; label: string }) => {
  const t = TONES[kind];
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (kind !== "live" || reduceMotion) return;
    pulse.value = withRepeat(withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [kind, pulse, reduceMotion]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]} accessibilityLabel={label}>
      {t.dot ? <Animated.View style={[styles.dot, { backgroundColor: t.dot }, kind === "live" && dotStyle]} /> : null}
      <Text style={[styles.label, { color: t.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 6, height: 26, paddingHorizontal: 10, borderRadius: radius.pill, alignSelf: "flex-start" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontSize: 12, fontWeight: "800", letterSpacing: 0.2 },
});
