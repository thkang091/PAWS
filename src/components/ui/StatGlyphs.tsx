import { memo } from "react";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

/**
 * The four numbers a dog earns (streak, energy, gold, silver) drawn as one family: each shape sits on a darker copy of
 * itself, the same raised lip the path steps have, with a soft highlight on the face. Same 24 grid, same weight, so
 * they line up in a row.
 */

const LIP = 1.6;

export const STAT_TINT = {
  streak: { face: "#FF9A1F", lip: "#D9700A", core: "#FFD23F" },
  energy: { face: "#FFD43B", lip: "#E0A800" },
  gold: { face: "#FCC53A", lip: "#C98A1C", ring: "#E9A73E" },
  silver: { face: "#DDE1E6", lip: "#9AA0A6", ring: "#B5BCC4" },
} as const;

const FLAME = "M12.6 2.2c.5 3.1-1.4 4.8-3 6.5C8 10.3 6.2 12.2 6.2 15.1a5.8 5.8 0 0 0 11.6 0c0-2.7-1.3-4.6-2.6-5.9-.3 1.4-1 2.3-2 2.7.4-3.7-.6-6.9-.6-9.7z";
const FLAME_CORE = "M12.1 12.3c-1 1.3-2.6 2.3-2.6 4.2a2.5 2.5 0 0 0 5 0c0-1.5-.8-2.5-1.4-3.2-.2.6-.6 1-1.1 1.1.1-.8.2-1.4.1-2.1z";
const BOLT = "M13.9 2.4 5.6 13.1c-.4.5 0 1.1.6 1.1h4.6l-1.6 6.9c-.2.8.8 1.2 1.3.6l8.3-10.7c.4-.5 0-1.1-.6-1.1h-4.6l1.6-6.9c.2-.8-.8-1.2-1.3-.6z";

export const StreakGlyph = memo(({ size = 22, muted = false }: { size?: number; muted?: boolean }) => {
  const t = muted ? { face: "#D6D3CA", lip: "#B9B5AA", core: "#ECEAE3" } : STAT_TINT.streak;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Widened a little so the flame carries the same weight as a coin beside it. */}
      <G transform="matrix(1.16 0 0 1.04 -1.92 -0.6)">
        <Path d={FLAME} fill={t.lip} transform={`translate(0 ${LIP})`} />
        <Path d={FLAME} fill={t.face} />
        <Path d={FLAME_CORE} fill={t.core} />
      </G>
    </Svg>
  );
});
StreakGlyph.displayName = "StreakGlyph";

export const EnergyGlyph = memo(({ size = 22 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d={BOLT} fill={STAT_TINT.energy.lip} transform={`translate(0 ${LIP})`} />
    <Path d={BOLT} fill={STAT_TINT.energy.face} />
    <Path d="M12.4 5.6 8.3 11" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.6} strokeLinecap="round" />
  </Svg>
));
EnergyGlyph.displayName = "EnergyGlyph";

/** Gold and silver coins: a rim, an inner ring and a short shine, so a coin reads as a coin at 16px. */
export const CoinGlyph = memo(({ size = 22, tone = "gold" }: { size?: number; tone?: "gold" | "silver" }) => {
  const t = STAT_TINT[tone];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12 + LIP / 2} r={9.4} fill={t.lip} />
      <Circle cx={12} cy={11.2 - LIP / 2} r={9.4} fill={t.face} />
      <Circle cx={12} cy={11.2 - LIP / 2} r={6.2} fill="none" stroke={t.ring} strokeWidth={1.6} />
      <Rect x={10.9} y={6.9} width={2.2} height={7.2} rx={1.1} fill={t.ring} />
      <Path d="M6.4 8.6a6.6 6.6 0 0 1 3.2-3.2" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1.5} strokeLinecap="round" fill="none" />
    </Svg>
  );
});
CoinGlyph.displayName = "CoinGlyph";
