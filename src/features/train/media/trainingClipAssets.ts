import { DOORWAY_WAIT_POSTERS, DOORWAY_WAIT_SOURCES } from "./doorwayWaitAssets";
import { BASIC_RULES_ASSETS } from "./basicRulesAssets.generated";
import { SECTIONS23_ASSETS } from "./sections23Assets.generated";
import { SECTION4_ASSETS } from "./section4Assets.generated";
import { SECTION5_ASSETS } from "./section5Assets.generated";
import { SECTION6_ASSETS } from "./section6Assets.generated";

const furnitureSources: Record<number, number> = {
  1: require("../../../../assets/training/furniture-boundary/level-1.mp4"),
  2: require("../../../../assets/training/furniture-boundary/level-2.mp4"),
  3: require("../../../../assets/training/furniture-boundary/level-3.mp4"),
  4: require("../../../../assets/training/furniture-boundary/level-4.mp4"),
  5: require("../../../../assets/training/furniture-boundary/level-5.mp4"),
};
const furniturePosters: Record<number, number> = {
  1: require("../../../../assets/training/furniture-boundary/level-1.jpg"),
  2: require("../../../../assets/training/furniture-boundary/level-2.jpg"),
  3: require("../../../../assets/training/furniture-boundary/level-3.jpg"),
  4: require("../../../../assets/training/furniture-boundary/level-4.jpg"),
  5: require("../../../../assets/training/furniture-boundary/level-5.jpg"),
};

export function getTrainingClipAssets(skillCode?: string, levelNumber?: number | null) {
  if (!levelNumber) return null;
  if (skillCode && SECTION5_ASSETS[skillCode]) return SECTION5_ASSETS[skillCode][levelNumber] ?? null;
  if (skillCode && SECTION6_ASSETS[skillCode]) return SECTION6_ASSETS[skillCode][levelNumber] ?? null;
  if (skillCode && SECTION4_ASSETS[skillCode]) return SECTION4_ASSETS[skillCode][levelNumber] ?? null;
  if (skillCode && SECTIONS23_ASSETS[skillCode]) return SECTIONS23_ASSETS[skillCode][levelNumber] ?? null;
  if (skillCode && BASIC_RULES_ASSETS[skillCode]) return BASIC_RULES_ASSETS[skillCode][levelNumber] ?? null;
  const sources = skillCode === "1-1" ? DOORWAY_WAIT_SOURCES : skillCode === "1-2" ? furnitureSources : null;
  const posters = skillCode === "1-1" ? DOORWAY_WAIT_POSTERS : skillCode === "1-2" ? furniturePosters : null;
  const source = sources?.[levelNumber], poster = posters?.[levelNumber];
  return source && poster ? { source, poster } : null;
}
