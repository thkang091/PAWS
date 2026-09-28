import { memo } from "react";
import Svg, { G, Path } from "react-native-svg";

import {
  PROFILE_DOG_ASPECT,
  PROFILE_DOG_LAYERS,
  PROFILE_DOG_TRANSFORM,
  PROFILE_DOG_VIEWBOX,
  type ProfileDogFill,
} from "@/features/profile/components/profileDogPaths";
import { accent, scene } from "@/constants/design";

const FILL: Record<ProfileDogFill, string> = {
  cream: scene.cream,
  ink: scene.ink,
  bandana: scene.bandana,
  spark: accent.deep,
};

export const profileDogHeight = (width: number) => width / PROFILE_DOG_ASPECT;

export const ProfileDog = memo(({ width }: { width: number }) => (
  <Svg width={width} height={profileDogHeight(width)} viewBox={PROFILE_DOG_VIEWBOX}>
    <G transform={PROFILE_DOG_TRANSFORM}>
      {PROFILE_DOG_LAYERS.map((layer, index) => (
        <Path key={index} d={layer.d} fill={FILL[layer.fill]} />
      ))}
    </G>
  </Svg>
));

ProfileDog.displayName = "ProfileDog";
