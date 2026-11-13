import { memo } from "react";
import Svg, { Path, Rect } from "react-native-svg";

import { NT } from "@/features/numberTrail/theme";

/**
 * A quiet illustrated street grid for intros and celebrations. Clearly a drawing, never presented as a real map or a
 * route you could pick.
 */
export const StreetBoard = memo(({ width, height }: { width: number; height: number }) => (
  <Svg width={width} height={height} viewBox="0 0 320 220" preserveAspectRatio="xMidYMid slice">
    <Rect width={320} height={220} fill={NT.block} />
    <Path d="M-10 30 L330 22 M-10 110 L330 104 M-10 190 L330 186 M40 -10 L46 230 M122 -10 L126 230 M200 -10 L196 230 M282 -10 L276 230" stroke={NT.street} strokeWidth={12} />
    <Rect x={214} y={124} width={46} height={48} rx={8} fill={NT.park} />
    <Rect x={58} y={40} width={50} height={52} rx={8} fill={NT.park} opacity={0.6} />
  </Svg>
));
StreetBoard.displayName = "StreetBoard";
