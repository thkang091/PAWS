import { memo } from "react";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

import type { ProductKey } from "@/components/shop/shopData";
import { accent, scene } from "@/constants/design";

type Shape = { d: string; fill: string };
type Drawing = { fills: readonly Shape[]; lines: readonly string[] };

const INK = scene.ink;

const BONE =
  "M30 36 C23 36 18 41 18 47 C18 50 20 53 23 54.5 C20 56 18 59 18 62 C18 68 23 73 30 73 C36 73 40 69 41 63 H59 C60 69 64 73 70 73 C77 73 82 68 82 62 C82 59 80 56 77 54.5 C80 53 82 50 82 47 C82 41 77 36 70 36 C64 36 60 40 59 46 H41 C40 40 36 36 30 36 Z";

const ART: Record<ProductKey, Drawing> = {
  kibble: {
    fills: [
      { d: "M26 36 L34 22 H66 L74 36 Z", fill: scene.tan },
      { d: "M26 36 H74 V84 A4 4 0 0 1 70 88 H30 A4 4 0 0 1 26 84 Z", fill: scene.ball },
      { d: "M36 50 H64 V70 H36 Z", fill: scene.cream },
    ],
    lines: [
      "M26 36 L34 22 H66 L74 36 Z",
      "M26 36 H74 V84 A4 4 0 0 1 70 88 H30 A4 4 0 0 1 26 84 Z",
      "M36 50 H64 V70 H36 Z",
      "M44 62 a3 3 0 1 0 0.1 0 M52 58 a3 3 0 1 0 0.1 0",
    ],
  },
  ball: {
    fills: [{ d: "M50 22 A28 28 0 1 1 49.9 22 Z", fill: scene.ball }],
    lines: [
      "M50 22 A28 28 0 1 1 49.9 22 Z",
      "M30 32 C40 44 40 56 30 68",
      "M70 32 C60 44 60 56 70 68",
    ],
  },
  bone: {
    fills: [{ d: BONE, fill: scene.cream }],
    lines: [BONE],
  },
  bed: {
    fills: [
      { d: "M14 62 C14 34 28 24 50 24 C72 24 86 34 86 62 Z", fill: scene.forest },
      { d: "M12 58 H88 V74 A8 8 0 0 1 80 82 H20 A8 8 0 0 1 12 74 Z", fill: scene.forest },
      { d: "M24 54 H76 A9 9 0 0 1 76 72 H24 A9 9 0 0 1 24 54 Z", fill: scene.cream },
    ],
    lines: [
      "M14 62 C14 34 28 24 50 24 C72 24 86 34 86 62",
      "M12 58 H88 V74 A8 8 0 0 1 80 82 H20 A8 8 0 0 1 12 74 Z",
      "M24 54 H76 A9 9 0 0 1 76 72 H24 A9 9 0 0 1 24 54 Z",
    ],
  },
  bandana: {
    fills: [
      { d: "M14 36 C30 27 70 27 86 36 L50 86 Z", fill: accent.deep },
      { d: "M38 18 L50 32 L62 18 L55 12 L50 22 L45 12 Z", fill: scene.tan },
      { d: "M44 48 a3.2 3.2 0 1 0 .1 0 M56 48 a3.2 3.2 0 1 0 .1 0 M50 44 a3.2 3.2 0 1 0 .1 0 M50 54 c4 0 6 2.4 6 4.4 0 1.8-2 2.8-6 2.8 s-6-1-6-2.8 c0-2 2-4.4 6-4.4 z", fill: scene.cream },
    ],
    lines: [
      "M14 36 C30 27 70 27 86 36 L50 86 Z",
      "M38 18 L50 32 L62 18 L55 12 L50 22 L45 12 Z",
    ],
  },
  recovery: {
    fills: [
      { d: "M40 20 H60 V30 H40 Z", fill: scene.tan },
      { d: "M36 30 H64 V84 A4 4 0 0 1 60 88 H40 A4 4 0 0 1 36 84 Z", fill: scene.cream },
      { d: "M36 48 H64 V68 H36 Z", fill: scene.aqua },
    ],
    lines: [
      "M40 20 H60 V30 H40 Z",
      "M36 30 H64 V84 A4 4 0 0 1 60 88 H40 A4 4 0 0 1 36 84 Z",
      "M36 48 H64 V68 H36 Z",
    ],
  },
  flea: {
    fills: [
      { d: "M22 34 H78 V84 A4 4 0 0 1 74 88 H26 A4 4 0 0 1 22 84 Z", fill: scene.aqua },
      { d: "M22 34 H78 V46 H22 Z", fill: scene.cream },
      { d: "M34 58 H66 V72 H34 Z", fill: scene.cream },
    ],
    lines: [
      "M22 34 H78 V84 A4 4 0 0 1 74 88 H26 A4 4 0 0 1 22 84 Z",
      "M22 46 H78",
      "M34 58 H66 V72 H34 Z",
    ],
  },
  spray: {
    fills: [
      { d: "M42 34 H62 V84 A4 4 0 0 1 58 88 H46 A4 4 0 0 1 42 84 Z", fill: scene.cream },
      { d: "M42 52 H62 V70 H42 Z", fill: scene.forest },
      { d: "M46 22 H58 V34 H46 Z M58 24 H72 V30 H58 Z", fill: scene.tan },
    ],
    lines: [
      "M42 34 H62 V84 A4 4 0 0 1 58 88 H46 A4 4 0 0 1 42 84 Z",
      "M46 22 H58 V34 H46 Z",
      "M58 24 H72 V30 H58 Z",
      "M42 52 H62 V70 H42 Z",
    ],
  },
};

export const ProductArt = memo(({ product, size }: { product: ProductKey; size: number }) => {
  const drawing = ART[product];

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {drawing.fills.map((shape, index) => (
        <Path key={index} d={shape.d} fill={shape.fill} />
      ))}
      <G fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        {drawing.lines.map((d, index) => (
          <Path key={index} d={d} />
        ))}
      </G>
    </Svg>
  );
});

ProductArt.displayName = "ProductArt";

export const Coin = memo(({ size = 16 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={10.5} fill={accent.deep} stroke={INK} strokeWidth={1.6} />
    <G fill={INK}>
      <Circle cx={8.6} cy={10.2} r={1.5} />
      <Circle cx={12} cy={8.9} r={1.6} />
      <Circle cx={15.4} cy={10.2} r={1.5} />
      <Path d="M12 12.4c2.6 0 4 1.6 4 3.1 0 1.3-1.3 2-4 2s-4-.7-4-2c0-1.5 1.4-3.1 4-3.1z" />
    </G>
  </Svg>
));

Coin.displayName = "Coin";
