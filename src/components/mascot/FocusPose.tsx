import { memo } from "react";
import Svg, { G, Path } from "react-native-svg";

import { FOCUS_POSES, type FocusPoseKey } from "@/components/mascot/focusPosePaths";
import { accent, mascot } from "@/constants/design";

export const FocusPose = memo(({ pose, width }: { pose: FocusPoseKey; width: number }) => {
  const layers = FOCUS_POSES[pose];
  return (
    <Svg width={width} height={width / layers.aspect} viewBox={layers.viewBox}>
      <G transform={layers.transform}>
        {layers.prop.map((d, i) => (
          <Path key={`p${i}`} d={d} fill={accent.deep} />
        ))}
        {layers.coat.map((d, i) => (
          <Path key={`c${i}`} d={d} fill={mascot.coat} />
        ))}
        {layers.ink.map((d, i) => (
          <Path key={`i${i}`} d={d} fill={mascot.ink} />
        ))}
      </G>
    </Svg>
  );
});

FocusPose.displayName = "FocusPose";
