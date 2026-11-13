import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { Extrapolation, interpolate, interpolateColor, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";

import { PressScale } from "@/components/ui/PressScale";
import { ModeIllustration, modeAspect } from "@/features/game/components/ModeIllustration";
import type { ModeKey } from "@/features/game/components/modePaths";
import { space } from "@/constants/design";

export type DeckCard = {
  key: string;
  title: string;
  /** One line of real news (a record, what's live, what's waiting). */
  headline: string;
  badge: string;
  color: string;
  ink: string;
  /** Secondary text on this colour, tinted from it rather than grey. */
  soft: string;
  art: ModeKey;
  onPress: () => void;
};

const GAP = 14;
const CARD_H = 340;

/**
 * Modes, one card each, centered with the neighbours peeking. Each card is the mode's own picture: badge, name, one
 * line of news, the illustration filling the bottom. The card in front is full size; its art drifts a little slower
 * than the card, and the dots inside it follow the scroll. Nothing here runs on a timer.
 */
export const ModeDeck = ({ cards }: { cards: readonly DeckCard[] }) => {
  const { width } = useWindowDimensions();
  const cardW = Math.round(width * 0.74);
  const step = cardW + GAP;
  const side = (width - cardW) / 2;
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });
  return (
    <View>
      <Animated.ScrollView
        horizontal
        decelerationRate="fast"
        snapToInterval={step}
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: side, gap: GAP, paddingVertical: space.sm }}
      >
        {cards.map((c, i) => (
          <Card key={c.key} card={c} index={i} x={x} step={step} width={cardW} />
        ))}
      </Animated.ScrollView>
      <View pointerEvents="none" style={[styles.dots, { top: space.sm + CARD_H - 28 }]}>
        {cards.map((c, i) => (
          <Dot key={c.key} index={i} x={x} step={step} inks={cards.map((k) => k.ink)} />
        ))}
      </View>
    </View>
  );
};

const Card = ({ card, index, x, step, width }: { card: DeckCard; index: number; x: SharedValue<number>; step: number; width: number }) => {
  const reduceMotion = useReducedMotion();
  const range = [(index - 1) * step, index * step, (index + 1) * step];
  const lift = useAnimatedStyle(() => (reduceMotion ? {} : { transform: [{ scale: interpolate(x.value, range, [0.92, 1, 0.92], Extrapolation.CLAMP) }] }));
  const drift = useAnimatedStyle(() => (reduceMotion ? {} : { transform: [{ translateX: interpolate(x.value, range, [-30, 0, 30], Extrapolation.CLAMP) }] }));
  const artW = width - space.lg * 2;
  const artH = Math.min(CARD_H * 0.48, artW / modeAspect(card.art));
  return (
    <Animated.View style={[{ width, height: CARD_H }, lift]}>
      <PressScale accessibilityRole="button" accessibilityLabel={`${card.title}. ${card.badge}. ${card.headline}`} scaleTo={0.98} style={[styles.card, { backgroundColor: card.color }]} onPress={card.onPress}>
        <View style={styles.glow} />
        <View style={styles.badge}>
          <Text style={[styles.badgeText, { color: card.color === "#FCD46F" ? "#8A5A00" : card.color }]} numberOfLines={1}>
            {card.badge}
          </Text>
        </View>
        <Text style={[styles.title, { color: card.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {card.title}
        </Text>
        <Text style={[styles.headline, { color: card.soft }]} numberOfLines={2}>
          {card.headline}
        </Text>
        <Animated.View style={[styles.art, { height: artH }, drift]} pointerEvents="none">
          <ModeIllustration mode={card.art} width={artH * modeAspect(card.art)} />
        </Animated.View>
      </PressScale>
    </Animated.View>
  );
};

/** A dot in the colour of the card in front (white on dark cards, ink on light ones), following the scroll. */
const Dot = ({ index, x, step, inks }: { index: number; x: SharedValue<number>; step: number; inks: string[] }) => {
  const stops = inks.map((_, i) => i * step);
  const style = useAnimatedStyle(() => {
    const t = interpolate(x.value, [(index - 1) * step, index * step, (index + 1) * step], [0, 1, 0], Extrapolation.CLAMP);
    return { opacity: 0.4 + t * 0.6, transform: [{ scale: 1 + t * 0.35 }], backgroundColor: inks.length > 1 ? interpolateColor(x.value, stops, inks) : inks[0] };
  });
  return <Animated.View style={[styles.dot, style]} />;
};

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: 30, padding: space.xl, overflow: "hidden" },
  glow: { position: "absolute", width: 280, height: 280, borderRadius: 140, right: -100, bottom: -110, backgroundColor: "rgba(255,255,255,0.14)" },
  badge: { alignSelf: "flex-start", height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "#FFFFFF", justifyContent: "center" },
  badgeText: { fontSize: 13, fontWeight: "800" },
  title: { fontSize: 30, lineHeight: 34, fontWeight: "800", letterSpacing: -1, marginTop: space.md },
  headline: { fontSize: 14, lineHeight: 19, fontWeight: "700", marginTop: 4 },
  art: { position: "absolute", left: space.lg, right: space.lg, bottom: 34, alignItems: "center", justifyContent: "flex-end" },
  dots: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 9 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
