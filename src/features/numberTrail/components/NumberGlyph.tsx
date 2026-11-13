import { memo, useEffect, useMemo } from "react";
import Svg, { G, Path } from "react-native-svg";
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { GLYPH, GLYPH_SINGLE, digitPair, digitSingle, linkPath } from "@/features/numberTrail/glyphGeometry";
import { NT } from "@/features/numberTrail/theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const DrawnPath = ({ d, length, color, width, draw, delay, duration }: { d: string; length: number; color: string; width: number; draw: boolean; delay: number; duration: number }) => {
  const progress = useSharedValue(draw ? 0 : 1);
  useEffect(() => {
    if (!draw) return;
    progress.value = 0;
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Easing.bezier(0.77, 0, 0.175, 1) }));
  }, [draw, delay, duration, progress]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.value) }));
  return <AnimatedPath d={d} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={[length, length]} animatedProps={props} />;
};

/** Digit two's dotted centre, faded in once the digit has finished drawing. */
const Centre = ({ d, width, animate, delay }: { d: string; width: number; animate: boolean; delay: number }) => {
  const o = useSharedValue(animate ? 0 : 0.9);
  useEffect(() => {
    if (!animate) return;
    o.value = 0;
    o.value = withDelay(delay, withTiming(0.9, { duration: 260, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
  }, [animate, delay, o]);
  const props = useAnimatedProps(() => ({ opacity: o.value }));
  return <AnimatedPath d={d} stroke={NT.twoCentre} strokeWidth={width * 0.16} strokeDasharray={[width * 0.02, width * 0.5]} strokeLinecap="round" fill="none" animatedProps={props} />;
};

/**
 * A number drawn the way Number Trail draws it on streets: digit one solid gold, digit two green with a dotted white
 * centre, and a dashed link between them; a number from 1 to 9 is one gold digit. Leading zeros stay. With `draw`,
 * each digit traces itself in walking order once; reduced motion shows it complete.
 */
export const NumberGlyph = memo(
  ({ value, height, draw = false, link = true, stroke = 0.3, dim = false }: { value: string; height: number; draw?: boolean; link?: boolean; stroke?: number; dim?: boolean }) => {
    const reduceMotion = useReducedMotion();
    const animate = draw && !reduceMotion;
    const single = value.length === 1;
    const digits = useMemo(() => (single ? ([digitSingle(value), null] as const) : digitPair(value)), [value, single]);
    const vbW = single ? GLYPH_SINGLE.width : GLYPH.width;
    const vbH = GLYPH.height;
    const [a, b] = digits;
    // The link dips below the digits, like a street between two blocks, from where digit one ends to where two starts.
    const linkD = b ? linkPath(a.end, b.start, vbH) : "";
    return (
      <Svg width={(height * vbW) / vbH} height={height} viewBox={`0 0 ${vbW} ${vbH}`} accessibilityRole="image" accessibilityLabel={`Number ${value}`}>
        <G opacity={dim ? 0.4 : 1}>
          {link && b ? <Path d={linkD} stroke={NT.link} strokeWidth={stroke * 0.22} strokeDasharray={[stroke * 0.1, stroke * 0.55]} strokeLinecap="round" fill="none" opacity={0.55} /> : null}
          <DrawnPath d={a.d} length={a.length} color={NT.one} width={stroke} draw={animate} delay={0} duration={520} />
          {b ? <DrawnPath d={b.d} length={b.length} color={NT.two} width={stroke} draw={animate} delay={640} duration={520} /> : null}
          {b ? <Centre d={b.d} width={stroke} animate={animate} delay={1160} /> : null}
        </G>
      </Svg>
    );
  },
);
NumberGlyph.displayName = "NumberGlyph";
