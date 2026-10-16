import { withDelay, withTiming, type EntryExitAnimationFunction } from "react-native-reanimated";

import { motion } from "@/constants/design";

const EASE = motion.easing.out;

type From = { x?: number; y?: number; scale?: number; rotate?: number };

/**
 * An entrance that moves as well as fades. `FadeIn.withInitialValues({ transform })` only animates opacity, so the
 * offset is dropped in one frame when the fade ends; this animates the offset, scale and turn back to rest.
 */
export const enter = (
  from: From,
  { delay = 0, duration = motion.duration.reveal }: { delay?: number; duration?: number } = {},
): EntryExitAnimationFunction => {
  const x = from.x ?? 0;
  const y = from.y ?? 0;
  const scale = from.scale ?? 1;
  const turn = `${from.rotate ?? 0}deg`;
  return () => {
    "worklet";
    const config = { duration, easing: EASE };
    return {
      initialValues: { opacity: 0, transform: [{ translateX: x }, { translateY: y }, { scale }, { rotate: turn }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, config)),
        transform: [
          { translateX: withDelay(delay, withTiming(0, config)) },
          { translateY: withDelay(delay, withTiming(0, config)) },
          { scale: withDelay(delay, withTiming(1, config)) },
          { rotate: withDelay(delay, withTiming("0deg", config)) },
        ],
      },
    };
  };
};
