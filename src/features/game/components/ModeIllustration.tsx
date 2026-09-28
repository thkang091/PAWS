import { memo } from "react";
import Svg, { G, Path } from "react-native-svg";

import type { CompanionFill } from "@/features/train/components/companionPaths";
import { MODE_ART, type ModeKey } from "@/features/game/components/modePaths";
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

export const modeAspect = (mode: ModeKey) => MODE_ART[mode].aspect;

export const ModeIllustration = memo(({ mode, width }: { mode: ModeKey; width: number }) => {
  const art = MODE_ART[mode];

  return (
    <Svg width={width} height={width / art.aspect} viewBox={art.viewBox}>
      <G transform={art.transform}>
        {art.layers.map((layer, index) => (
          <Path key={index} d={layer.d} fill={FILL[layer.fill]} />
        ))}
      </G>
    </Svg>
  );
});

ModeIllustration.displayName = "ModeIllustration";
