import { memo } from "react";
import Svg, { G, Path } from "react-native-svg";

import { CARE_ART, type CareArtKey } from "@/features/care/components/carePaths";
import type { CompanionFill } from "@/features/train/components/companionPaths";
import { accent, scene } from "@/constants/design";

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

export const careArtAspect = (art: CareArtKey) => CARE_ART[art].aspect;

export const CareDog = memo(({ art, width }: { art: CareArtKey; width: number }) => {
  const drawing = CARE_ART[art];

  return (
    <Svg width={width} height={width / drawing.aspect} viewBox={drawing.viewBox}>
      <G transform={drawing.transform}>
        {drawing.layers.map((layer, index) => (
          <Path key={index} d={layer.d} fill={FILL[layer.fill]} />
        ))}
      </G>
    </Svg>
  );
});

CareDog.displayName = "CareDog";
