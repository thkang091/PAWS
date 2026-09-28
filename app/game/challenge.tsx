import { useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useScrollViewOffset,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CaretLeftIcon, GearSixIcon, LockSimpleIcon } from "phosphor-react-native";

import { GameArt, gameArtAspect } from "@/features/game/components/GameArt";
import type { GameKey } from "@/features/game/components/gamePaths";
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

type Game = {
  key: GameKey;
  title: string;
  skill: string;
  note?: string;
  open: boolean;
};

const GAMES: readonly Game[] = [
  {
    key: "treat",
    title: "Find the Treat",
    skill: "Sniffing",
    note: "3 minutes · start here",
    open: true,
  },
  { key: "pattern", title: "Pattern Paws", skill: "Focus", open: false },
  { key: "hidden", title: "Hidden Toy", skill: "Memory", open: false },
  { key: "bubble", title: "Bubble Chase", skill: "Reaction", open: false },
];

const BASE = 1.05;
const RAIL = 30;
const NODE = 18;
const DASH = 4;
const DASH_GAP = 5;

export default function ChallengeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);

  const artWidth = useMemo(
    () => Math.min(Math.round((width - layout.gutter * 2 - RAIL - space.md) * 0.42), 140),
    [width],
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.roundButton}
          onPress={() => router.back()}
        >
          <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
        </PressScale>

        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={styles.roundButton}
          onPress={() => router.push("/profile/settings")}
        >
          <GearSixIcon size={iconSize.nav} color={text.primary} weight="regular" />
        </PressScale>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + space.block },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        <Animated.Text
          entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
          style={styles.title}
        >
          Games
        </Animated.Text>

        <View style={styles.list}>
          {GAMES.map((game, index) => (
            <Row
              key={game.key}
              game={game}
              index={index}
              first={index === 0}
              last={index === GAMES.length - 1}
              artWidth={artWidth}
              scrollY={scrollY}
              reduceMotion={reduceMotion}
            />
          ))}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const Row = ({
  game,
  index,
  first,
  last,
  artWidth,
  scrollY,
  reduceMotion,
}: {
  game: Game;
  index: number;
  first: boolean;
  last: boolean;
  artWidth: number;
  scrollY: SharedValue<number>;
  reduceMotion: boolean;
}) => {
  const artHeight = artWidth / gameArtAspect(game.key);

  const rowY = useSharedValue(0);

  const pressed = useSharedValue(0);
  const drift = useAnimatedStyle(() => {
    if (reduceMotion) return { transform: [{ scale: BASE }] };
    const travelled = scrollY.value - rowY.value;
    const shift = Math.max(-5, Math.min(5, travelled * 0.05));
    return { transform: [{ scale: BASE + pressed.value * 0.06 }, { translateY: shift }] };
  });

  const node = useSharedValue(reduceMotion ? 1 : 0);
  const nodeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.4 + node.value * 0.6 }],
    opacity: node.value,
  }));

  const refuse = useSharedValue(0);
  const refuseStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: refuse.value }],
  }));

  return (
    <Animated.View
      onLayout={(e) => {
        rowY.value = e.nativeEvent.layout.y;
      }}
      entering={
        reduceMotion
          ? undefined
          : FadeIn.duration(motion.duration.enter)
              .delay(index * motion.stagger)
              .withInitialValues({ opacity: 0, transform: [{ translateX: 20 }] })
              .withCallback(() => {
                "worklet";
                node.value = withDelay(80, withSpring(1, motion.spring));
              })
      }
      style={[styles.row, !first && styles.ruled]}
    >
      <View style={styles.rail}>
        <Dashes hidden={first} height={(artHeight + space.lg * 2 - NODE) / 2} />
        <Animated.View
          style={[styles.node, game.open ? styles.nodeOpen : styles.nodeShut, nodeStyle]}
        />
        <Dashes hidden={last} height={(artHeight + space.lg * 2 - NODE) / 2} />
      </View>

      <PressScale
        accessibilityRole="button"
        accessibilityState={{ disabled: !game.open }}
        accessibilityLabel={
          game.open
            ? `${game.title}. ${game.skill}. ${game.note ?? ""}`
            : `${game.title}. ${game.skill}. Locked. Finish the game above first.`
        }
        scaleTo={game.open ? 0.98 : 1}
        style={styles.body}
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
        onPress={() => {
          if (!game.open) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            refuse.value = withSequence(
              withTiming(-3, { duration: 60, easing: motion.easing.out }),
              withTiming(3, { duration: 80, easing: motion.easing.inOut }),
              withTiming(0, { duration: 90, easing: motion.easing.out }),
            );
            return;
          }
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push(`/game/${game.key}`);
        }}
      >
        <Animated.View style={[styles.frame, { width: artWidth, height: artHeight }, refuseStyle]}>
          <Animated.View style={drift}>
            <GameArt game={game.key} width={artWidth} />
          </Animated.View>
        </Animated.View>

        <View style={styles.copy}>
          <Text style={[styles.name, !game.open && styles.nameShut]} numberOfLines={2}>
            {game.title}
          </Text>
          <Text style={styles.skill} numberOfLines={1}>
            {game.skill}
          </Text>
          {game.note ? <Text style={styles.note}>{game.note}</Text> : null}
        </View>

        {!game.open ? (
          <LockSimpleIcon size={iconSize.inline} color={border.strong} weight="fill" />
        ) : null}
      </PressScale>
    </Animated.View>
  );
};

const Dashes = ({ height, hidden }: { height: number; hidden: boolean }) => {
  const count = hidden ? 0 : Math.max(0, Math.floor(height / (DASH + DASH_GAP)));
  return (
    <View style={[styles.dashes, { height }]}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.dash} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.gutter,
    paddingBottom: space.sm,
  },
  roundButton: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
    justifyContent: "center",
  },

  content: { paddingHorizontal: layout.gutter },
  title: { ...type.pageTitle, fontSize: 34, color: text.primary, textAlign: "center" },

  list: { marginTop: space.xxl },
  row: { flexDirection: "row", alignItems: "stretch" },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },

  rail: { width: RAIL, alignItems: "center" },
  dashes: { width: RAIL, alignItems: "center", overflow: "hidden" },
  dash: {
    width: 1.5,
    height: DASH,
    marginBottom: DASH_GAP,
    borderRadius: 1,
    backgroundColor: border.default,
  },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 2,
  },
  nodeOpen: { backgroundColor: accent.deep, borderColor: accent.deep },
  nodeShut: { backgroundColor: bg.canvas, borderColor: border.default },

  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingVertical: space.lg,
    paddingLeft: space.md,
  },
  frame: { borderRadius: radius.card, overflow: "hidden" },

  copy: { flex: 1 },
  name: { ...type.sectionTitle, fontWeight: "600", color: text.primary },
  nameShut: { color: text.secondary },
  skill: { ...type.supporting, color: text.tertiary, marginTop: 2 },
  note: { ...type.caption, color: text.secondary, marginTop: 6 },
});
