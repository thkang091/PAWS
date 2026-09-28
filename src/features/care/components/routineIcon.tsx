import type { ColorValue } from "react-native";
import {
  BarbellIcon,
  BowlFoodIcon,
  BrainIcon,
  DropIcon,
  HeartbeatIcon,
  type Icon as PhosphorIcon,
  PawPrintIcon,
  PersonSimpleWalkIcon,
  PillIcon,
} from "phosphor-react-native";

const BY_KEY: Record<string, PhosphorIcon> = {
  walk: PersonSimpleWalkIcon,
  "bowl-mix": BowlFoodIcon,
  water: DropIcon,
  brain: BrainIcon,
  star: BarbellIcon,
  pill: PillIcon,
  heartbeat: HeartbeatIcon,
};

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
