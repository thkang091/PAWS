import { memo } from "react";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

import { accent, scene } from "@/constants/design";

const INK = scene.ink;

type Plate = { d: string; fill: string };
type Drawing = { fills: readonly Plate[]; lines: readonly string[] };

const BOTTLE = "M32 40 H68 A6 6 0 0 1 74 46 V84 A6 6 0 0 1 68 90 H32 A6 6 0 0 1 26 84 V46 A6 6 0 0 1 32 40 Z";
const PUMP = "M46 40 V30 H54 V40";
const NOZZLE = "M54 26 H68 A4 4 0 0 1 68 34 H62";
const LABEL = "M32 56 H68 V72 H32 Z";

const BLADE_A = "M30 26 C44 40 56 52 62 60 C64 63 62 67 58 66 C50 64 38 54 28 42 Z";
const BLADE_B = "M70 26 C56 40 44 52 38 60 C36 63 38 67 42 66 C50 64 62 54 72 42 Z";
const HANDLE_A = "M40 70 C32 74 30 84 38 88 C46 92 54 84 50 76 Z";
const HANDLE_B = "M60 70 C68 74 70 84 62 88 C54 92 46 84 50 76 Z";

const DROPPER = "M40 34 H60 A5 5 0 0 1 65 39 V84 A6 6 0 0 1 59 90 H41 A6 6 0 0 1 35 84 V39 A5 5 0 0 1 40 34 Z";
const CAP = "M44 22 H56 V34 H44 Z";

const BRUSH_HANDLE = "M26 74 C40 66 62 50 76 40 C80 37 84 41 81 45 C68 56 46 73 32 81 C28 84 23 78 26 74 Z";
const BRISTLES = "M74 30 C78 27 86 33 84 38 C82 43 76 44 73 41 C70 38 71 32 74 30 Z";

const BODY = "M36 38 H64 A6 6 0 0 1 70 44 V82 A8 8 0 0 1 62 90 H38 A8 8 0 0 1 30 82 V44 A6 6 0 0 1 36 38 Z";
const COMB = "M32 26 H68 V38 H32 Z";
const SWITCH = "M44 52 H56 V60 H44 Z";

const SPINE = "M22 34 H78 A6 6 0 0 1 84 40 V48 H16 V40 A6 6 0 0 1 22 34 Z";

const teeth = () =>
  Array.from({ length: 13 }, (_, i) => {
    const x = 20 + i * 5;
    return `M${x} 48 V84`;
  });

const DRAWINGS: Record<string, Drawing> = {
  bath: {
    fills: [
      { d: BOTTLE, fill: scene.cream },
      { d: LABEL, fill: accent.deep },
      { d: NOZZLE, fill: scene.tan },
    ],
    lines: [BOTTLE, PUMP, NOZZLE, LABEL],
  },
  nail_trim: {
    fills: [
      { d: BLADE_A, fill: scene.cream },
      { d: BLADE_B, fill: scene.cream },
      { d: HANDLE_A, fill: accent.deep },
      { d: HANDLE_B, fill: accent.deep },
    ],
    lines: [BLADE_A, BLADE_B, HANDLE_A, HANDLE_B],
  },
  ear_clean: {
    fills: [
      { d: DROPPER, fill: scene.cream },
      { d: CAP, fill: scene.forest },
      { d: "M38 58 H62 V74 H38 Z", fill: accent.primary },
    ],
    lines: [DROPPER, CAP, "M38 58 H62 V74 H38 Z"],
  },
  teeth_brush: {
    fills: [
      { d: BRUSH_HANDLE, fill: scene.cream },
      { d: BRISTLES, fill: accent.deep },
    ],
    lines: [BRUSH_HANDLE, BRISTLES],
  },
  haircut: {
    fills: [
      { d: BODY, fill: scene.cream },
      { d: COMB, fill: scene.tan },
      { d: SWITCH, fill: accent.deep },
    ],
    lines: [BODY, COMB, SWITCH],
  },
  flea_tick: {
    fills: [{ d: SPINE, fill: accent.deep }],
    lines: [SPINE, ...teeth()],
  },
};

export const KitArt = memo(({ item, size = 56 }: { item: string; size?: number }) => {
  const art = DRAWINGS[item] ?? DRAWINGS.bath;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G>
        {art.fills.map((plate, index) => (
          <Path key={`f${index}`} d={plate.d} fill={plate.fill} />
        ))}
        {art.lines.map((d, index) => (
          <Path
            key={`l${index}`}
            d={d}
            fill="none"
            stroke={INK}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </G>
    </Svg>
  );
});

KitArt.displayName = "KitArt";

export const ClinicMark = memo(({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Path
      d="M50 12 C33 12 20 25 20 42 C20 62 42 82 48 87 A3 3 0 0 0 52 87 C58 82 80 62 80 42 C80 25 67 12 50 12 Z"
      fill={accent.deep}
    />
    <Path
      d="M50 12 C33 12 20 25 20 42 C20 62 42 82 48 87 A3 3 0 0 0 52 87 C58 82 80 62 80 42 C80 25 67 12 50 12 Z"
      fill="none"
      stroke={INK}
      strokeWidth={4}
      strokeLinejoin="round"
    />
    <Rect x="44" y="30" width="12" height="28" rx="2" fill={scene.cream} />
    <Rect x="36" y="38" width="28" height="12" rx="2" fill={scene.cream} />
    <Circle cx="50" cy="44" r="0.5" fill={INK} />
  </Svg>
));

ClinicMark.displayName = "ClinicMark";
