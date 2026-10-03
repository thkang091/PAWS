import { useCallback, useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Ellipse, Path } from "react-native-svg";
import { PawsDogHero } from "@/components/mascot/PawsDog";
import { accent, pastel, text } from "@/constants/design";

// Fixed paths keep the celebration consistent on every visit. The dog stays
// still; a party popper by its raised paw sends a single burst of confetti.
const CONFETTI = [
  { x: -56, y: -68, lift: 32, spin: -110, color: accent.deep },
  { x: -35, y: -88, lift: 26, spin: 150, color: accent.band },
  { x: -12, y: -105, lift: 16, spin: -70, color: pastel.mint },
  { x: 16, y: -97, lift: 30, spin: 120, color: accent.deep },
  { x: 40, y: -77, lift: 24, spin: -150, color: pastel.sky },
  { x: 67, y: -99, lift: 18, spin: 190, color: accent.band },
  { x: 112, y: -63, lift: 28, spin: -90, color: accent.deep },
  { x: 150, y: -45, lift: 18, spin: 130, color: pastel.mint },
  { x: -52, y: -24, lift: 45, spin: 200, color: pastel.sky },
  { x: -25, y: -48, lift: 35, spin: -130, color: accent.deep },
] as const;

export function CelebratingPawsDog() {
  const reduceMotion = useReducedMotion();
  const burst = useSharedValue(reduceMotion ? 1 : 0);
  const celebrate = useCallback(() => {
    cancelAnimation(burst);
    burst.value = reduceMotion ? 1 : 0;
    if (!reduceMotion) burst.value = withDelay(220, withTiming(1, { duration: 1400 }));
  }, [burst, reduceMotion]);
  useEffect(() => {
    celebrate();
    return () => cancelAnimation(burst);
  }, [burst, celebrate]);

  return <Pressable style={styles.art} accessibilityRole="button" accessibilityLabel="Replay the PAWS dog's celebration" onPress={celebrate}>
    <View style={styles.dog} pointerEvents="none"><PawsDogHero width={220} /></View>
    <Svg width={264} height={206} viewBox="0 0 264 206" style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Party cone follows the direction of the mascot's raised front paw. */}
      <Path d="M73 132 Q83 148 100 161 Q98 142 91 122 Z" fill={accent.deep} stroke={text.primary} strokeWidth={2.4} strokeLinejoin="round" />
      <Path d="M82 144 L94 135 M91 153 L98 147" fill="none" stroke={accent.band} strokeWidth={4} />
      <Ellipse cx={82} cy={127} rx={11} ry={4.5} transform="rotate(-30 82 127)" fill={accent.soft} stroke={text.primary} strokeWidth={2.2} />
    </Svg>
    {CONFETTI.map((piece, index) => <ConfettiPiece key={index} piece={piece} index={index} burst={burst} />)}
  </Pressable>;
}

function ConfettiPiece({ piece, index, burst }: { piece: typeof CONFETTI[number]; index: number; burst: SharedValue<number> }) {
  const animated = useAnimatedStyle(() => {
    const p = burst.value;
    return {
      opacity: Math.min(1, p * 12) * (1 - Math.max(0, p - 0.65) * 1.3),
      transform: [
        { translateX: piece.x * p },
        { translateY: piece.y * p - piece.lift * 4 * p * (1 - p) },
        { rotate: `${piece.spin * p}deg` },
        { scale: 0.45 + 0.55 * p },
      ],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.confetti, {
    backgroundColor: piece.color,
    width: index % 3 === 0 ? 5 : 7,
    height: index % 3 === 0 ? 12 : 6,
    borderRadius: index % 3 === 2 ? 4 : 1,
  }, animated]} />;
}

const styles = StyleSheet.create({
  art: { width: 264, maxWidth: "100%", height: 206 },
  dog: { position: "absolute", bottom: 16, left: 22 },
  confetti: { position: "absolute", left: 78, top: 121 },
});
