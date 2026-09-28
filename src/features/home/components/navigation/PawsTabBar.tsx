import { useState } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { PressScale } from "@/components/ui/PressScale";
import {
  accent,
  bg,
  border,
  elevation,
  icon as iconSize,
  motion,
  radius,
  space,
  text,
} from "@/constants/design";

const CHIP = 52;
const BAR_PADDING = 6;

export const PawsTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [rowWidth, setRowWidth] = useState(0);

  const routes = state.routes.filter((route) => {
    const options = descriptors[route.key]?.options;
    if (!options?.tabBarIcon) return false;
    const item = StyleSheet.flatten(options.tabBarItemStyle) as ViewStyle | undefined;
    return item?.display !== "none";
  });

  const activeIndex = routes.findIndex((r) => r.key === state.routes[state.index]?.key);
  const slotWidth = routes.length > 0 ? rowWidth / routes.length : 0;

  const target = useDerivedValue(
    () =>
      reduceMotion
        ? Math.max(0, activeIndex)
        : withTiming(Math.max(0, activeIndex), {
            duration: motion.duration.select,
            easing: motion.easing.inOut,
          }),
    [activeIndex, reduceMotion],
  );

  const chipStyle = useAnimatedStyle(
    () => ({ transform: [{ translateX: target.value * slotWidth }] }),
    [slotWidth],
  );

  return (
    <View
      style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space.lg) }]}
      pointerEvents="box-none"
    >
      <View style={styles.bar}>
        <View
          style={styles.row}
          onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
        >
          {slotWidth > 0 ? (
            <Animated.View
              style={[styles.chipTrack, { width: slotWidth }, chipStyle]}
              pointerEvents="none"
            >
              <View style={styles.chip} />
            </Animated.View>
          ) : null}

          {routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = index === activeIndex;
            const label =
              typeof options.tabBarAccessibilityLabel === "string"
                ? options.tabBarAccessibilityLabel
                : (options.title ?? route.name);

            return (
              <PressScale
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                scaleTo={0.92}
                style={styles.slot}
                onPress={() => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (focused || event.defaultPrevented) return;
                  void Haptics.selectionAsync();
                  navigation.navigate(route.name);
                }}
              >
                <View style={styles.iconBox}>
                  {options.tabBarIcon?.({
                    focused,
                    color: focused ? text.primary : text.secondary,
                    size: iconSize.nav,
                  })}
                </View>
              </PressScale>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: space.xl,
  },
  bar: {
    alignSelf: "stretch",
    backgroundColor: bg.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    padding: BAR_PADDING,
    ...elevation,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  chipTrack: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    width: CHIP,
    height: CHIP,
    borderRadius: 18,
    backgroundColor: accent.deep,
  },
  slot: {
    flex: 1,
  },
  iconBox: {
    height: CHIP,
    alignItems: "center",
    justifyContent: "center",
  },
});
