import { memo } from "react";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";
import Svg, { G, Path } from "react-native-svg";

import {
  COMPANION_POSES,
  type CompanionFill,
  type CompanionPoseKey,
} from "@/features/train/components/companionPaths";
import { accent, motion, scene } from "@/constants/design";

const FILL: Record<CompanionFill, string> = {
  cream: scene.cream,
  forest: scene.forest,
  skin: scene.skin,
  tan: scene.tan,
  aqua: scene.aqua,
  spark: accent.deep,
  hair: scene.hair,
  ink: scene.ink,
};

export const companionAspect = (pose: CompanionPoseKey) => COMPANION_POSES[pose].aspect;

export const TrainCompanion = memo(
  ({ pose, width }: { pose: CompanionPoseKey; width: number }) => {
    const art = COMPANION_POSES[pose];
    const reduceMotion = useReducedMotion();

    return (
      <Animated.View
        key={pose}
        entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
        exiting={reduceMotion ? undefined : FadeOut.duration(motion.duration.exit)}
      >
        <Svg width={width} height={width / art.aspect} viewBox={art.viewBox}>
          <G transform={art.transform}>
            {art.layers.map((layer, index) => (
              <Path key={index} d={layer.d} fill={FILL[layer.fill]} />
            ))}
          </G>
        </Svg>
      </Animated.View>
    );
  },
);

TrainCompanion.displayName = "TrainCompanion";
