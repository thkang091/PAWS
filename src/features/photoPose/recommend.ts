/**
 * Which published poses to suggest next, worked out on the phone from rows already in the database. No Gemini call,
 * no dog details. Signals: the player's own filters (vibe, props, easy only), poses they have already entered,
 * how recently a pose was published, and variety: each pick makes the next pose of the same vibe less likely, so
 * the list moves between funny, cute, matching, creative and trick-based ideas instead of repeating one.
 */

import type { PoseCategory, PoseDifficulty } from "../../../supabase/functions/media/poses";

export type LibraryPose = {
  id: string;
  title: string;
  description: string;
  category: PoseCategory;
  difficulty: PoseDifficulty;
  setupMinutes: number;
  requiredObjects: string[];
  referencePath: string | null;
  publishedAt: string | null;
  entered: boolean;
};

export type PosePrefs = { vibes: PoseCategory[]; noProps: boolean; easyOnly: boolean };
export const DEFAULT_PREFS: PosePrefs = { vibes: [], noProps: false, easyOnly: false };

export const RECOMMEND_WEIGHTS = { fresh: 3, vibe: 2.5, easy: 1, medium: 0.5, noObjects: 0.5, recent: 1, sameVibe: 2.5 } as const;

const DAY = 86_400_000;

/** A pose's own score before variety is applied. Filtered-out poses get null. */
export const baseScore = (p: LibraryPose, prefs: PosePrefs, now: number): number | null => {
  if (prefs.noProps && p.requiredObjects.length > 0) return null;
  if (prefs.easyOnly && p.difficulty !== "easy") return null;
  const w = RECOMMEND_WEIGHTS;
  let s = 0;
  if (!p.entered) s += w.fresh;
  if (prefs.vibes.includes(p.category)) s += w.vibe;
  s += p.difficulty === "easy" ? w.easy : p.difficulty === "medium" ? w.medium : 0;
  if (!p.requiredObjects.length) s += w.noObjects;
  if (p.publishedAt && now - Date.parse(p.publishedAt) < 30 * DAY) s += w.recent;
  return s;
};

/** Greedy picks: best score first, each pick lowering the score of poses with the same vibe. Ties go to the newer. */
export const recommendPoses = (library: readonly LibraryPose[], prefs: PosePrefs, now: number, limit = 6, exclude: readonly string[] = []) => {
  const pool = library
    .filter((p) => !exclude.includes(p.id))
    .map((p) => ({ p, s: baseScore(p, prefs, now) }))
    .filter((x): x is { p: LibraryPose; s: number } => x.s !== null);
  const picked: LibraryPose[] = [];
  const used = new Map<PoseCategory, number>();
  while (picked.length < limit && pool.length) {
    let best = 0;
    for (let i = 1; i < pool.length; i += 1) {
      const score = (x: (typeof pool)[number]) => x.s - (used.get(x.p.category) ?? 0) * RECOMMEND_WEIGHTS.sameVibe;
      const a = score(pool[i]);
      const b = score(pool[best]);
      if (a > b || (a === b && Date.parse(pool[i].p.publishedAt ?? "0") > Date.parse(pool[best].p.publishedAt ?? "0"))) best = i;
    }
    const [{ p }] = pool.splice(best, 1);
    picked.push(p);
    used.set(p.category, (used.get(p.category) ?? 0) + 1);
  }
  return picked;
};
