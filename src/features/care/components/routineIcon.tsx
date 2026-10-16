import type { ColorValue } from "react-native";
import {
  BarbellIcon,
  BathtubIcon,
  BowlFoodIcon,
  BrainIcon,
  DropIcon,
  EarIcon,
  HeartbeatIcon,
  type Icon as PhosphorIcon,
  PawPrintIcon,
  PersonSimpleWalkIcon,
  PillIcon,
  ScissorsIcon,
  TennisBallIcon,
  ToothIcon,
} from "phosphor-react-native";

const BY_KEY: Record<string, PhosphorIcon> = {
  walk: PersonSimpleWalkIcon,
  "bowl-mix": BowlFoodIcon,
  water: DropIcon,
  brain: BrainIcon,
  star: BarbellIcon,
  pill: PillIcon,
  heartbeat: HeartbeatIcon,
  tooth: ToothIcon,
  ball: TennisBallIcon,
  bath: BathtubIcon,
  scissors: ScissorsIcon,
  ear: EarIcon,
  paw: PawPrintIcon,
};

/** The glyph for a routine's icon key, for screens that style it themselves. */
export const routineGlyph = (iconKey: string): PhosphorIcon => BY_KEY[iconKey] ?? PawPrintIcon;

export const RoutineIcon = ({
  iconKey,
  size,
  color,
}: {
  iconKey: string;
  size: number;
  color: ColorValue;
}) => {
  const Glyph = BY_KEY[iconKey] ?? PawPrintIcon;
  return <Glyph size={size} color={String(color)} weight="regular" />;
};
