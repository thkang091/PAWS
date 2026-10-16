import { GraduationCapIcon, HouseLineIcon, IdentificationCardIcon, PawPrintIcon, ShieldCheckIcon, type Icon as PhosphorIcon } from "phosphor-react-native";

import type { SetKey } from "@/features/profile/intel/profileSets";

export const SET_GLYPH: Record<SetKey, PhosphorIcon> = {
  basics: IdentificationCardIcon,
  safety: ShieldCheckIcon,
  home: HouseLineIcon,
  baseline: GraduationCapIcon,
  personality: PawPrintIcon,
};
