import { SECTIONS23_ASSETS } from "./sections23Assets.generated";
import { SECTION4_ASSETS } from "./section4Assets.generated";
import { SECTION5_ASSETS } from "./section5Assets.generated";
import { SECTION6_ASSETS } from "./section6Assets.generated";

export function getTrainingClipAssets(skillCode?: string, levelNumber?: number | null) {
  if (!levelNumber) return null;
  if (skillCode && SECTION5_ASSETS[skillCode]) return SECTION5_ASSETS[skillCode][levelNumber] ?? null;
  if (skillCode && SECTION6_ASSETS[skillCode]) return SECTION6_ASSETS[skillCode][levelNumber] ?? null;
  if (skillCode && SECTION4_ASSETS[skillCode]) return SECTION4_ASSETS[skillCode][levelNumber] ?? null;
  if (skillCode && SECTIONS23_ASSETS[skillCode]) return SECTIONS23_ASSETS[skillCode][levelNumber] ?? null;
  return null;
}
