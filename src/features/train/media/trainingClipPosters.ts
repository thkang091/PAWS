import { TRAINING_YOUTUBE_POSTERS } from "./trainingYouTubePosters.generated";

// Artwork only: migrated lessons never import the historical MP4 registries.
const posters: Record<string, Record<number, number>> = {
  "1-1": {
    1: require("../../../../assets/training/doorway-wait/level-1.jpg"),
    2: require("../../../../assets/training/doorway-wait/level-2.jpg"),
    3: require("../../../../assets/training/doorway-wait/level-3.jpg"),
    4: require("../../../../assets/training/doorway-wait/level-4.jpg"),
    5: require("../../../../assets/training/doorway-wait/level-5.jpg"),
  },
  "1-2": {
    1: require("../../../../assets/training/furniture-boundary/level-1.jpg"),
    2: require("../../../../assets/training/furniture-boundary/level-2.jpg"),
    3: require("../../../../assets/training/furniture-boundary/level-3.jpg"),
    4: require("../../../../assets/training/furniture-boundary/level-4.jpg"),
    5: require("../../../../assets/training/furniture-boundary/level-5.jpg"),
  },
  "1-3": {
    1: require("../../../../assets/training/drop-it/level-1.jpg"),
    2: require("../../../../assets/training/drop-it/level-2.jpg"),
    3: require("../../../../assets/training/drop-it/level-3.jpg"),
    4: require("../../../../assets/training/drop-it/level-4.jpg"),
    5: require("../../../../assets/training/drop-it/level-5.jpg"),
  },
  "1-4": {
    1: require("../../../../assets/training/potty-routine/level-1.jpg"),
    2: require("../../../../assets/training/potty-routine/level-2.jpg"),
    3: require("../../../../assets/training/potty-routine/level-3.jpg"),
    4: require("../../../../assets/training/potty-routine/level-4.jpg"),
    5: require("../../../../assets/training/potty-routine/level-5.jpg"),
  },
  "1-5": {
    1: require("../../../../assets/training/quiet-moments/level-1.jpg"),
    2: require("../../../../assets/training/quiet-moments/level-2.jpg"),
    3: require("../../../../assets/training/quiet-moments/level-3.jpg"),
    4: require("../../../../assets/training/quiet-moments/level-4.jpg"),
    5: require("../../../../assets/training/quiet-moments/level-5.jpg"),
  },
  ...TRAINING_YOUTUBE_POSTERS,
};

export function getTrainingClipPoster(skillCode?: string, level?: number | null) {
  return skillCode && level ? posters[skillCode]?.[level] : undefined;
}

// Focal positions were chosen from the actual preparation frames (dog faces/bodies).
export function getTrainingPosterPosition(skillCode?: string) {
  const positions: Record<string, string> = { "1-1": "66%", "1-2": "72%", "1-3": "53%", "1-4": "64%", "1-5": "54%" };
  return { left: positions[skillCode ?? ""] ?? "50%", top: "50%" };
}
