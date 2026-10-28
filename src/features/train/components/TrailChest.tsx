import { memo } from "react";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

export const CHEST_WIDTH = 88;
export const CHEST_HEIGHT = 81;

const PALETTE = {
  locked: { lid: "#F4F3EF", lidEdge: "#CFCBC1", body: "#E3E0D8", bodyEdge: "#C2BEB3", band: "#FFFFFF", lock: "#A9A59A", inside: "#C2BEB3" },
  earned: { lid: "#FCD46F", lidEdge: "#E9A73E", body: "#F6C350", bodyEdge: "#D18E2A", band: "#FFE9A8", lock: "#B87818", inside: "#8A5A1E" },
} as const;

/**
 * A reward chest that sits on the path between lessons. Grey and shut until every lesson before it is done, then gold
 * with the lid thrown back. Drawn on the same raised lip as the steps so it belongs to the path.
 */
export const TrailChest = memo(({ earned }: { earned: boolean }) => {
  const c = PALETTE[earned ? "earned" : "locked"];
  return (
    <Svg width={CHEST_WIDTH} height={CHEST_HEIGHT} viewBox="0 0 64 59">
      <Ellipse cx={32} cy={55.5} rx={25} ry={3.2} fill="#000000" opacity={0.07} />

      {earned ? (
        // Lid thrown back: its underside shows behind the opening.
        <>
          <Path d="M9 25 13 7.5a3 3 0 0 1 2.9-2.3h32.2a3 3 0 0 1 2.9 2.3L55 25Z" fill={c.lidEdge} />
          <Path d="M12.5 22 15.6 9.4h32.8l3.1 12.6Z" fill={c.inside} opacity={0.35} />
          <Rect x={16} y={5.2} width={5} height={19} fill={c.band} opacity={0.55} />
          <Rect x={43} y={5.2} width={5} height={19} fill={c.band} opacity={0.55} />
        </>
      ) : null}

      {/* Body on its lip. */}
      <Rect x={8} y={27} width={48} height={26} rx={4.5} fill={c.bodyEdge} />
      <Rect x={8} y={27} width={48} height={22.5} rx={4.5} fill={c.body} />

      {earned ? (
        <>
          <Rect x={10} y={25} width={44} height={7} rx={2} fill={c.inside} />
          <Circle cx={22} cy={27.4} r={2.4} fill="#FFF3C4" />
          <Circle cx={29} cy={26.6} r={2.6} fill="#FFE08A" />
          <Circle cx={36.5} cy={27.2} r={2.4} fill="#FFF3C4" />
          <Circle cx={43} cy={27.6} r={2.1} fill="#FFE08A" />
        </>
      ) : (
        <>
          <Path d="M6 29V18.5A10.5 10.5 0 0 1 16.5 8h31A10.5 10.5 0 0 1 58 18.5V29Z" fill={c.lid} />
          <Rect x={6} y={25} width={52} height={5} rx={2} fill={c.lidEdge} />
        </>
      )}

      {/* Metal bands and the lock plate. */}
      <Rect x={16} y={earned ? 32 : 8.4} width={5} height={earned ? 17.5 : 41} fill={c.band} opacity={0.7} />
      <Rect x={43} y={earned ? 32 : 8.4} width={5} height={earned ? 17.5 : 41} fill={c.band} opacity={0.7} />
      <Rect x={27} y={earned ? 31 : 21.5} width={10} height={12} rx={2.6} fill={c.band} />
      <Circle cx={32} cy={earned ? 35.6 : 26.1} r={1.8} fill={c.lock} />
      <Rect x={31.2} y={earned ? 35.6 : 26.1} width={1.6} height={4} rx={0.8} fill={c.lock} />
    </Svg>
  );
});
TrailChest.displayName = "TrailChest";
