import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ArrowRightIcon } from "phosphor-react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ModeIllustration, modeAspect } from "@/features/game/components/ModeIllustration";
import type { ModeKey } from "@/features/game/components/modePaths";
import { PressScale } from "@/components/ui/PressScale";
import {
  accent,
  bg,
  border,
  icon as iconSize,
  layout,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

type Mode = { key: ModeKey; title: string; blurb: string; href?: string };

const MODES: readonly Mode[] = [
  { key: "challenge", title: "Challenge", blurb: "Play solo", href: "/game/challenge" },
  { key: "tournament", title: "Tournament", blurb: "Play together" },
  { key: "duel", title: "Duel", blurb: "1 on 1" },
  { key: "lucky", title: "Lucky", blurb: "Spend your coins", href: "/game/shop" },
];

const COLUMN_DROP = 40;
const ARROW = 36;
const COLUMN_GAP = 12;
const TAB_CLEARANCE = 116;

export default function GameTabScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const cardWidth = useMemo(
    () => Math.floor((width - layout.gutter * 2 - COLUMN_GAP) / 2),
    [width],
  );

  const columns = useMemo(
    () => [MODES.filter((_, i) => i % 2 === 0), MODES.filter((_, i) => i % 2 === 1)],
    [],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.lg, paddingBottom: TAB_CLEARANCE + insets.bottom },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Choose your mode</Text>
      <Text style={styles.blurb}>
        Different ways to play.{"\n"}A happier you and your pup.
      </Text>

      <View style={styles.grid}>
        {columns.map((column, columnIndex) => (
          <View
            key={columnIndex}
            style={[
              styles.column,
              { width: cardWidth, marginTop: columnIndex === 1 ? COLUMN_DROP : 0 },
            ]}
          >
            {column.map((mode, rowIndex) => (
              <ModeCard
                key={mode.key}
                mode={mode}
                width={cardWidth}
                onPress={mode.href ? () => router.push(mode.href as never) : undefined}
                order={rowIndex * 2 + columnIndex}
                reduceMotion={reduceMotion}
              />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const ModeCard = ({
  mode,
  width,
  order,
  reduceMotion,
  onPress,
}: {
  mode: Mode;
  width: number;
  order: number;
  reduceMotion: boolean;
  onPress?: () => void;
}) => {
  const pressed = useSharedValue(0);

  const arrowStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {};
    return { transform: [{ translateX: pressed.value * 3 }] };
  }, [reduceMotion]);

  const art = width - space.lg * 2;

  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeInDown.springify().damping(18).mass(0.6).delay(order * 45)
      }
    >
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`${mode.title}. ${mode.blurb}`}
        accessibilityState={{ disabled: !onPress }}
        scaleTo={0.97}
        style={styles.card}
        onPress={onPress}
        onPressIn={() => {
          pressed.value = withTiming(1, {
            duration: motion.duration.pressIn,
            easing: motion.easing.out,
          });
        }}
        onPressOut={() => {
          pressed.value = withTiming(0, {
            duration: motion.duration.pressOut,
            easing: motion.easing.out,
          });
        }}
      >
        <View style={[styles.art, { height: art / modeAspect(mode.key) }]}>
          <ModeIllustration mode={mode.key} width={art} />
        </View>

        <View style={styles.caption}>
          <View style={styles.captionText}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {mode.title}
            </Text>
            <Text style={styles.cardBlurb} numberOfLines={1}>
              {mode.blurb}
            </Text>
          </View>
          <View style={styles.arrow}>
            <Animated.View style={arrowStyle}>
              <ArrowRightIcon size={iconSize.button} color={text.primary} weight="bold" />
            </Animated.View>
          </View>
        </View>
      </PressScale>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: bg.canvas,
  },
  content: {
    paddingHorizontal: layout.gutter,
  },
  title: {
    ...type.pageTitle,
    color: text.primary,
  },
  blurb: {
    ...type.supporting,
    color: text.secondary,
    marginTop: space.sm,
  },
  grid: {
    flexDirection: "row",
    gap: COLUMN_GAP,
    marginTop: space.section,
  },
  column: {
    gap: COLUMN_GAP,
  },
  card: {
    backgroundColor: bg.surface,
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: border.soft,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.lg,
  },
  art: {
    justifyContent: "flex-end",
  },
  caption: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: space.lg,
  },
  captionText: {
    flex: 1,
  },
  cardTitle: {
    ...type.cardTitle,
    fontSize: 15,
    color: text.primary,
  },
  cardBlurb: {
    ...type.caption,
    color: text.secondary,
    marginTop: 2,
  },
  arrow: {
    width: ARROW,
    height: ARROW,
    marginLeft: space.sm,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
