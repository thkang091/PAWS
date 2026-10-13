type TrainingClipAssets = { source: number; poster: number };

// All acquired curriculum clips now use the official YouTube player. Keep the
// native-provider interface for legacy callers, without bundling offline MP4s.
// Historical exports/registries stay on disk for provenance and rollback.
const nativeClips: Record<string, Record<number, TrainingClipAssets>> = {};

export function getTrainingClipAssets(skillCode?: string, levelNumber?: number | null): TrainingClipAssets | null {
  return skillCode && levelNumber ? nativeClips[skillCode]?.[levelNumber] ?? null : null;
}
