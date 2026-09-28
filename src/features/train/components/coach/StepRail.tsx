import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { accent, border, motion, radius, space, text, type } from "@/constants/design";

const GAP = 4;

export const StepRail = ({
  count,
  active,
  label,
  reduceMotion,
}: {
  count: number;
  active: number | null;
  label: string;
  reduceMotion: boolean;
}) => {
  const [width, setWidth] = useState(0);
  const segment = width > 0 ? (width - GAP * (count - 1)) / count : 0;
  const x = useSharedValue(0);
  const shown = useSharedValue(active === null ? 0 : 1);
  const placed = useSharedValue(false);

  useEffect(() => {
    if (segment <= 0 || active === null) {
      shown.value = withTiming(0, { duration: motion.duration.select });
      return;
    }
    const to = active * (segment + GAP);
    if (!placed.value || reduceMotion) {
      x.value = to;
      placed.value = true;
    } else {
      x.value = withTiming(to, { duration: 420, easing: motion.easing.inOut });
    }
    shown.value = withTiming(1, { duration: motion.duration.select });
  }, [active, placed, reduceMotion, segment, shown, x]);

  const lozenge = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: x.value }],
  }));

  return (
    <View>
      <View style={styles.track} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {Array.from({ length: count }, (_, index) => (
          <View key={index} style={[styles.segment, index === count - 1 && styles.last]} />
        ))}
        {segment > 0 ? <Animated.View style={[styles.lozenge, { width: segment }, lozenge]} /> : null}
      </View>
      <Animated.Text key={label} style={styles.label} numberOfLines={1}>
        {label}
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  track: { flexDirection: "row", gap: GAP, height: 6 },
  segment: { flex: 1, borderRadius: radius.pill, backgroundColor: border.soft },
  last: {},
  lozenge: {
    position: "absolute",
    left: 0,
    top: 0,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  label: { ...type.caption, fontWeight: "600", color: text.secondary, marginTop: space.sm },
});
