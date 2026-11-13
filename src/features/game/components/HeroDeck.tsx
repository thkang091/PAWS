import { useEffect } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, ClipPath, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { PressScale } from "@/components/ui/PressScale";
import { layout, space, text } from "@/constants/design";

export type HeroSlide = {
  key: string;
  badge: string;
  title: string;
  line: string;
  meta?: string | null;
  /** Two shades for the card's gradient, top-left to bottom-right. */
  from: string;
  to: string;
  ink: string;
  soft: string;
  art: React.ReactNode;
  cta: string;
  onPress: () => void;
};

const H = 232;
const BUTTON = 66;
const NOTCH = BUTTON / 2 + 9;
const R = 28;
const GAP = 12;

/** A rounded card with a half-circle bite out of the bottom edge, where the button sits. */
const shape = (w: number) => {
  const cx = w / 2;
  return [
    `M ${R} 0 H ${w - R} A ${R} ${R} 0 0 1 ${w} ${R} V ${H - R} A ${R} ${R} 0 0 1 ${w - R} ${H}`,
    `H ${cx + NOTCH} A ${NOTCH} ${NOTCH} 0 0 0 ${cx - NOTCH} ${H}`,
    `H ${R} A ${R} ${R} 0 0 1 0 ${H - R} V ${R} A ${R} ${R} 0 0 1 ${R} 0 Z`,
  ].join(" ");
};

/**
 * The news at the top of Game: this month's challenge first, then what's new. One slide at a time, snapping; the
 * button sits in a notch cut from the card, with rings spreading from it.
 */
export const HeroDeck = ({ slides }: { slides: readonly HeroSlide[] }) => {
  const { width } = useWindowDimensions();
  const cardW = width - layout.gutter * 2;
  const step = cardW + GAP;
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
        contentContainerStyle={{ paddingHorizontal: layout.gutter, gap: GAP }}
      >
        {slides.map((s, i) => (
          <Slide key={s.key} slide={s} index={i} x={x} step={step} width={cardW} />
        ))}
      </Animated.ScrollView>
      {slides.length > 1 ? (
        <View pointerEvents="none" style={[styles.dots, { right: layout.gutter + space.lg }]}>
          {slides.map((s, i) => (
            <Dot key={s.key} index={i} x={x} step={step} />
          ))}
        </View>
      ) : null}
    </View>
  );
};

const Slide = ({ slide, index, x, step, width }: { slide: HeroSlide; index: number; x: SharedValue<number>; step: number; width: number }) => {
  const reduceMotion = useReducedMotion();
  const range = [(index - 1) * step, index * step, (index + 1) * step];
  // The art drifts against the swipe and the copy settles a beat later: depth without a timer.
  const art = useAnimatedStyle(() =>
    reduceMotion ? {} : { transform: [{ translateX: interpolate(x.value, range, [60, 0, -60], Extrapolation.CLAMP) }, { rotate: `${interpolate(x.value, range, [10, 0, -10], Extrapolation.CLAMP)}deg` }] },
  );
  const copy = useAnimatedStyle(() => (reduceMotion ? {} : { opacity: interpolate(x.value, range, [0.3, 1, 0.3], Extrapolation.CLAMP), transform: [{ translateX: interpolate(x.value, range, [24, 0, -24], Extrapolation.CLAMP) }] }));
  const id = `hero-${slide.key}`;
  return (
    <View style={{ width, height: H + BUTTON / 2 + 4 }}>
      <Svg width={width} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={slide.from} />
            <Stop offset="1" stopColor={slide.to} />
          </LinearGradient>
          <ClipPath id={`${id}-c`}>
            <Path d={shape(width)} />
          </ClipPath>
        </Defs>
        <Path d={shape(width)} fill={`url(#${id}-g)`} />
        {/* Rings spreading from the notch, inside the card only. */}
        <Circle cx={width / 2} cy={H} r={NOTCH + 22} stroke="rgba(255,255,255,0.22)" strokeWidth={14} fill="none" clipPath={`url(#${id}-c)`} />
        <Circle cx={width / 2} cy={H} r={NOTCH + 52} stroke="rgba(255,255,255,0.12)" strokeWidth={12} fill="none" clipPath={`url(#${id}-c)`} />
        <Circle cx={width * 0.86} cy={H * 0.18} r={86} fill="rgba(255,255,255,0.10)" clipPath={`url(#${id}-c)`} />
      </Svg>

      <View style={[styles.content, { width, height: H }]}>
        <Animated.View style={[styles.copy, copy]}>
          <View style={styles.badge}>
            <Text style={[styles.badgeText, { color: slide.to }]} numberOfLines={1}>
              {slide.badge}
            </Text>
          </View>
          <Text style={[styles.title, { color: slide.ink }]} numberOfLines={2}>
            {slide.title}
          </Text>
          <Text style={[styles.line, { color: slide.soft }]} numberOfLines={2}>
            {slide.line}
          </Text>
          {slide.meta ? <Text style={[styles.meta, { color: slide.soft }]}>{slide.meta}</Text> : null}
        </Animated.View>
        <Animated.View style={[styles.art, art]} pointerEvents="none">
          {slide.art}
        </Animated.View>
      </View>

      <JoinButton label={slide.cta} accessibilityLabel={`${slide.cta.replace("!", "")}: ${slide.title}`} left={width / 2 - BUTTON / 2} onPress={slide.onPress} />
    </View>
  );
};

/** The round button in the notch. A soft ring breathes out of it, slowly, so the eye finds it. */
const JoinButton = ({ label, accessibilityLabel, left, onPress }: { label: string; accessibilityLabel: string; left: number; onPress: () => void }) => {
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    breath.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) }), -1, false);
    return () => cancelAnimation(breath);
  }, [breath, reduceMotion]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - breath.value), transform: [{ scale: 1 + breath.value * 0.45 }] }));
  return (
    <View style={[styles.join, { left, top: H - BUTTON / 2 }]}>
      {reduceMotion ? null : <Animated.View style={[styles.joinRing, ring]} pointerEvents="none" />}
      <PressScale accessibilityRole="button" accessibilityLabel={accessibilityLabel} scaleTo={0.9} style={styles.joinButton} onPress={onPress}>
        <Text style={styles.joinText}>{label}</Text>
      </PressScale>
    </View>
  );
};

const Dot = ({ index, x, step }: { index: number; x: SharedValue<number>; step: number }) => {
  const style = useAnimatedStyle(() => {
    const t = interpolate(x.value, [(index - 1) * step, index * step, (index + 1) * step], [0, 1, 0], Extrapolation.CLAMP);
    return { opacity: 0.45 + t * 0.55, transform: [{ scale: 0.8 + t * 0.4 }] };
  });
  return <Animated.View style={[styles.dot, style]} />;
};

const styles = StyleSheet.create({
  content: { flexDirection: "row", padding: space.xl, paddingBottom: NOTCH + space.sm },
  copy: { flex: 1.25, gap: 6 },
  badge: { alignSelf: "flex-start", height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "#FFFFFF", justifyContent: "center", marginBottom: 4 },
  badgeText: { fontSize: 12, fontWeight: "800" },
  title: { fontSize: 25, lineHeight: 28, fontWeight: "800", letterSpacing: -0.7 },
  line: { fontSize: 14, lineHeight: 19, fontWeight: "600" },
  meta: { fontSize: 12, fontWeight: "800", marginTop: 2, opacity: 0.95 },
  art: { flex: 1, alignItems: "center", justifyContent: "center", marginRight: -space.sm },
  join: { position: "absolute", width: BUTTON, height: BUTTON, alignItems: "center", justifyContent: "center" },
  joinRing: { position: "absolute", width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2, backgroundColor: "#FCD46F" },
  joinButton: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    backgroundColor: "#FCD46F",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#8A5A00",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  joinText: { fontSize: 15, fontWeight: "800", color: text.primary, letterSpacing: -0.2 },
  dots: { position: "absolute", top: space.xl + 8, flexDirection: "row", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFFFFF" },
});
