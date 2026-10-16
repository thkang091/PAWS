import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { accent, pastel } from '@/constants/design';

const COLORS = [accent.deep, accent.band, pastel.mint, pastel.sky, '#E6A3B3'];
// Distributed lanes and staggered starts create a full-screen shower, once per completion.
const PIECES = Array.from({ length: 72 }, (_, index) => ({
  x: ((index * 37) % 72 + 0.5) / 72,
  delay: (index % 12) * 115,
  duration: 3300 + (index % 7) * 220,
  sway: 10 + (index % 4) * 5,
  phase: index * 1.7,
  spin: (index % 2 ? 1 : -1) * (240 + index % 5 * 90),
  color: COLORS[index % COLORS.length],
  width: index % 3 === 0 ? 5 : 8,
  height: index % 3 === 0 ? 12 : 6,
}));

export function LessonConfetti() {
  const reduceMotion = useReducedMotion();
  const elapsed = useSharedValue(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    elapsed.value = 0;
    if (!reduceMotion && size.height > 0) elapsed.value = withTiming(6200, { duration: 6200, easing: Easing.linear });
    return () => cancelAnimation(elapsed);
  }, [elapsed, reduceMotion, size.height]);
  if (reduceMotion) return null;
  return <View testID="lesson-confetti" pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={styles.overlay} onLayout={({ nativeEvent: { layout } }) => setSize(previous => previous.width === layout.width && previous.height === layout.height ? previous : { width: layout.width, height: layout.height })}>
    {size.height > 0 ? PIECES.map((piece, index) => <ConfettiPiece key={index} piece={piece} elapsed={elapsed} width={size.width} height={size.height} />) : null}
  </View>;
}

function ConfettiPiece({ piece, elapsed, width, height }: { piece: typeof PIECES[number]; elapsed: SharedValue<number>; width: number; height: number }) {
  const animated = useAnimatedStyle(() => {
    const progress = Math.max(0, Math.min(1, (elapsed.value - piece.delay) / piece.duration));
    return {
      opacity: elapsed.value < piece.delay || progress >= 1 ? 0 : 0.85,
      transform: [
        { translateX: Math.max(0, Math.min(width - piece.width, piece.x * width + Math.sin(progress * Math.PI * 4 + piece.phase) * piece.sway)) },
        { translateY: -20 + progress * (height + 40) },
        { rotate: `${piece.phase * 30 + progress * piece.spin}deg` },
        { scaleX: 0.45 + Math.abs(Math.cos(progress * Math.PI * 5 + piece.phase)) * 0.55 },
      ],
    };
  });
  return <Animated.View style={[styles.piece, { width: piece.width, height: piece.height, backgroundColor: piece.color }, animated]} />;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  piece: { position: 'absolute', top: 0, left: 0, borderRadius: 1 },
});
