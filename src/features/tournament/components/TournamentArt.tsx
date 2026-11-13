import { memo } from "react";
import Svg, { Circle, G, Line, Path, Polygon, Rect } from "react-native-svg";

import type { TournamentGame } from "@/services/tournamentService";
import { numberStrokes } from "@/features/numberTrail/glyphGeometry";
import { NT } from "@/features/numberTrail/theme";
import { accent, scene } from "@/constants/design";

/**
 * One flat illustration per game, all drawn on the same 320 x 180 board from the PAWS meadow palette, so the hub
 * reads as one set. Map games look like a small map; photo and video games like their frame.
 */

const W = 320;
const H = 180;
const PAPER = "#FBF8F0";
const STREET = "#FFFFFF";
const BLOCK = "#EFE8D6";
const PARK = scene.meadow;
const INK = scene.ink;

const Streets = () => (
  <G>
    <Rect width={W} height={H} fill={BLOCK} />
    <Path d="M-10 52 L330 34 M-10 128 L330 112 M70 -10 L92 190 M196 -10 L214 190 M268 -10 L290 190" stroke={STREET} strokeWidth={13} strokeLinecap="round" />
    <Path d="M120 70 Q150 56 176 70 L184 100 Q150 112 124 100 Z" fill={PARK} />
  </G>
);

const LargestCountry = () => (
  <G>
    <Streets />
    <Polygon points="58,46 150,30 236,52 262,118 186,150 84,140 40,96" fill={accent.deep} fillOpacity={0.45} stroke={accent.band} strokeWidth={4} strokeLinejoin="round" />
    <Path d="M58 46 L150 30 L236 52 L262 118 L186 150 L84 140 L40 96 Z" fill="none" stroke={INK} strokeWidth={2.5} strokeDasharray="2 9" strokeLinecap="round" />
    <Circle cx={186} cy={150} r={11} fill={INK} />
    <Circle cx={186} cy={150} r={4} fill={STREET} />
    <PawMark x={150} y={90} />
  </G>
);

const FollowShape = () => (
  <G>
    <Streets />
    <Path d="M160 26 L182 74 L234 78 L194 112 L208 160 L160 132 L112 160 L126 112 L86 78 L138 74 Z" fill="none" stroke={INK} strokeWidth={3} strokeDasharray="3 8" strokeLinejoin="round" strokeLinecap="round" />
    <Path d="M160 26 L182 74 L234 78 L194 112" fill="none" stroke={accent.band} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
    <Circle cx={194} cy={112} r={9} fill={accent.band} stroke={STREET} strokeWidth={3} />
  </G>
);

/** Number Trail: a 42 traced along the streets of a small map, digit one gold, digit two green, the link dashed. */
const NumberTrail = () => {
  const g = numberStrokes("42");
  const s = 48; // board units per glyph unit
  const x0 = 178 - (g.width * s) / 2; // clear of the status badge, top left
  const y0 = 100 - (g.height * s) / 2;
  return (
    <G>
      <Rect width={W} height={H} fill={BLOCK} />
      <Path d="M-10 26 L330 26 M-10 90 L330 90 M-10 154 L330 154 M44 -10 L44 190 M114 -10 L114 190 M206 -10 L206 190 M276 -10 L276 190" stroke={STREET} strokeWidth={11} />
      <Rect x={232} y={104} width={36} height={42} rx={6} fill={PARK} />
      <G transform={`translate(${x0} ${y0}) scale(${s})`}>
        <Path d={g.link} stroke={INK} strokeWidth={0.05} strokeDasharray={[0.02, 0.12]} strokeLinecap="round" fill="none" opacity={0.6} />
        <Path d={g.paths[0]} stroke={NT.one} strokeWidth={0.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d={g.paths[1]} stroke={NT.two} strokeWidth={0.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d={g.paths[1]} stroke={STREET} strokeWidth={0.035} strokeDasharray={[0.005, 0.1]} strokeLinecap="round" fill="none" />
        <Circle cx={g.starts[0][0]} cy={g.starts[0][1]} r={0.13} fill={INK} />
        <Circle cx={g.starts[0][0]} cy={g.starts[0][1]} r={0.05} fill={STREET} />
      </G>
    </G>
  );
};

const PhotoPose = () => (
  <G>
    <Rect width={W} height={H} fill={scene.trail} />
    <Rect x={88} y={24} width={144} height={132} rx={22} fill={PAPER} />
    <Path d="M104 52 V40 H116 M204 40 H216 V52 M216 128 V140 H204 M116 140 H104 V128" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
    <Circle cx={160} cy={84} r={26} fill={scene.ball} />
    <Path d="M128 140 Q160 104 192 140 Z" fill={scene.sage} />
    <Circle cx={232} cy={36} r={10} fill={accent.band} />
  </G>
);

const MatchMyDog = () => (
  <G>
    <Rect width={W} height={H} fill={scene.ground} />
    <Rect x={54} y={34} width={96} height={112} rx={20} fill={PAPER} rotation={-6} origin="102, 90" />
    <Rect x={170} y={34} width={96} height={112} rx={20} fill={PAPER} rotation={6} origin="218, 90" />
    <Circle cx={102} cy={84} r={22} fill={scene.ball} />
    <Circle cx={218} cy={84} r={22} fill={scene.ball} />
    <Path d="M150 92 H170 M150 102 H170" stroke={INK} strokeWidth={4} strokeLinecap="round" />
  </G>
);

const DogReels = () => (
  <G>
    <Rect width={W} height={H} fill={scene.sage} />
    <Rect x={70} y={40} width={84} height={112} rx={18} fill={PAPER} opacity={0.6} />
    <Rect x={166} y={40} width={84} height={112} rx={18} fill={PAPER} opacity={0.6} />
    <Rect x={112} y={26} width={96} height={128} rx={20} fill={PAPER} />
    <Path d="M150 72 L178 90 L150 108 Z" fill={INK} />
  </G>
);

const FindMafia = () => (
  <G>
    <Rect width={W} height={H} fill={scene.forest} />
    {[60, 120, 200, 260].map((x, i) => (
      <Circle key={x} cx={x} cy={i % 2 ? 70 : 120} r={20} fill={PAPER} opacity={0.85} />
    ))}
    <Circle cx={160} cy={96} r={34} fill="none" stroke={PAPER} strokeWidth={8} />
    <Line x1={184} y1={120} x2={214} y2={150} stroke={PAPER} strokeWidth={10} strokeLinecap="round" />
    <Path d="M146 88 Q160 76 174 88" stroke={accent.deep} strokeWidth={6} fill="none" strokeLinecap="round" />
  </G>
);

const HEX = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");

const StealTerritory = () => (
  <G>
    <Rect width={W} height={H} fill={BLOCK} />
    {[
      [100, 60], [148, 60], [196, 60], [124, 102], [172, 102], [220, 102], [148, 144], [196, 144],
    ].map(([x, y], i) => (
      <Polygon key={i} points={HEX(x, y, 26)} fill={i === 3 || i === 4 ? accent.deep : i === 2 ? scene.sage : STREET} stroke={BLOCK} strokeWidth={4} />
    ))}
  </G>
);

const StealRoad = () => (
  <G>
    <Rect width={W} height={H} fill={PARK} />
    <Path d="M-10 150 C 80 150, 90 40, 170 60 S 280 120, 340 30" stroke={STREET} strokeWidth={34} fill="none" strokeLinecap="round" />
    <Path d="M-10 150 C 80 150, 90 40, 170 60" stroke={accent.band} strokeWidth={34} fill="none" strokeLinecap="round" opacity={0.9} />
    <Path d="M-10 150 C 80 150, 90 40, 170 60 S 280 120, 340 30" stroke={INK} strokeWidth={3} strokeDasharray="10 12" fill="none" />
  </G>
);

const PawMark = ({ x, y }: { x: number; y: number }) => (
  <G opacity={0.55}>
    <Circle cx={x - 9} cy={y - 8} r={4} fill={INK} />
    <Circle cx={x} cy={y - 12} r={4.4} fill={INK} />
    <Circle cx={x + 9} cy={y - 8} r={4} fill={INK} />
    <Path d={`M${x} ${y - 3} c7 0 11 5 11 9 c0 4 -4 6 -11 6 s-11 -2 -11 -6 c0 -4 4 -9 11 -9 z`} fill={INK} />
  </G>
);

const ART: Record<TournamentGame, () => React.JSX.Element> = {
  largest_country: LargestCountry,
  follow_shape: FollowShape,
  number_trail: NumberTrail,
  photo_pose: PhotoPose,
  seasonal_selfie: PhotoPose,
  match_my_dog: MatchMyDog,
  dog_reels: DogReels,
  find_mafia: FindMafia,
  steal_territory: StealTerritory,
  steal_road: StealRoad,
};

export const TournamentArt = memo(({ game, width, height }: { game: TournamentGame; width: number; height: number }) => {
  const Art = ART[game];
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <Art />
    </Svg>
  );
});
TournamentArt.displayName = "TournamentArt";
