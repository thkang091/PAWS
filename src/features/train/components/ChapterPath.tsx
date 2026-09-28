import { useEffect } from "react";
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { accent, motion, scene } from "@/constants/design";

const AnimatedPath = Animated.createAnimatedComponent(Path);

export const PATH_WIDTH = 10;

export const buildTrail = (points: ReadonlyArray<{ x: number; y: number }>): string => {
  if (points.length === 0) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    const mid = (from.y + to.y) / 2;
    d += ` C ${from.x} ${mid} ${to.x} ${mid} ${to.x} ${to.y}`;
  }
  return d;
};

const trailLength = (points: ReadonlyArray<{ x: number; y: number }>): number => {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.hypot(dx, dy) * 1.12;
  }
  return Math.max(total, 1);
};

type ChapterPathProps = {
  points: ReadonlyArray<{ x: number; y: number }>;
  width: number;
  height: number;
  progress: number;
};

export const ChapterPath = ({ points, width, height, progress }: ChapterPathProps) => {
  const d = buildTrail(points);
  const length = trailLength(points);
  const drawn = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    drawn.value = reduceMotion
      ? progress
      : withDelay(
          motion.stagger * 2,
          withTiming(progress, {
            duration: motion.duration.reveal,
            easing: motion.easing.out,
          }),
        );
  }, [drawn, progress, reduceMotion]);

  const walkedProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - drawn.value),
  }));

  if (!d) return null;

  return (
    <Svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
      <Path
        d={d}
        stroke={scene.trail}
        strokeWidth={PATH_WIDTH}
        strokeLinecap="round"
        fill="none"
      />
      <AnimatedPath
        d={d}
        stroke={accent.deep}
        strokeWidth={PATH_WIDTH}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={length}
        animatedProps={walkedProps}
      />
    </Svg>
  );
};
