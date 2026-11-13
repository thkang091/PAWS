/**
 * Follow the Shape choices and labels as pure data: which shapes are offered, how each route option is described,
 * and what to say (and offer) when no route fits. Screens render these; tests pin them down.
 */
import { SHAPE_PRESETS, type ShapePreset } from "../../../supabase/functions/tournament/shapes";
import { ROUTE_RULES, targetLengthM } from "../../../supabase/functions/tournament/routes";
import type { RouteOutcome, RouteWarning } from "@/services/tournamentService";

export const SHAPE_ORDER = ["heart", "triangle", "square", "diamond", "star", "lightning"] as const;
export type ShapeKey = (typeof SHAPE_ORDER)[number];

/** What each shape needs from the paths around you, so nobody expects a star on a street grid. */
export const SHAPE_NOTE: Record<ShapeKey, string> = {
  heart: "Two round lobes and a point. Needs curving or crossing paths.",
  triangle: "Three sides. Needs a path that cuts a corner.",
  square: "Four turns around a block. Street grids suit it.",
  diamond: "A tall square on its point. Needs diagonal paths.",
  star: "Five points. Needs lots of crossing paths.",
  lightning: "A zigzag from here to somewhere else. Not a loop.",
};

export const DIFFICULTY_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;

export const shapeChoices = (): (ShapePreset & { key: ShapeKey; note: string })[] =>
  SHAPE_ORDER.map((key) => {
    const preset = SHAPE_PRESETS.find((s) => s.key === key);
    if (!preset) throw new Error(`missing shape preset ${key}`);
    return { ...preset, key, note: SHAPE_NOTE[key] };
  });

export const MINUTES = ROUTE_RULES.minutes as readonly (15 | 25 | 40)[];

/** "about 1.0 km" for a walking time, at the pace routes are built for. */
export const distanceLabel = (minutes: number) => `about ${(targetLengthM(minutes) / 1000).toFixed(1)} km`;

/** How new a route is to you, from its overlap with your recent walks (0 to 1). */
export const noveltyLabel = (recentOverlap: number) =>
  recentOverlap <= 0.2 ? "New for you" : recentOverlap <= ROUTE_RULES.maxRecentOverlap ? "Partly walked" : "Walked recently";

/** The estimated shape match in words, for route cards. Routes below a shape's minimum are never offered. */
export const matchLabel = (estimate: number) => (estimate >= 90 ? "Very close" : estimate >= 78 ? "Close" : "Loose");

/** What the map data says about a route, in two or three words each. */
export const WARNING_LABEL: Record<RouteWarning, string> = {
  busy_road: "Busy road",
  rail_crossing: "Rail crossing",
  no_sidewalk: "No sidewalk",
  unmarked_crossing: "Unmarked crossing",
  no_sidewalk_mapped: "Sidewalk unmapped",
  steps: "Steps",
  unpaved: "Unpaved",
};

/** Three line styles that differ in pattern, not only colour. */
export const ROUTE_LINES: readonly { letter: string; color: string; dash: number[] | undefined }[] = [
  { letter: "A", color: "#1C1B1A", dash: undefined },
  { letter: "B", color: "#C2700F", dash: [12, 8] },
  { letter: "C", color: "#2F6FDE", dash: [2, 8] },
];

export type OutcomeAction = "change_shape" | "change_length" | "change_start" | "try_again";

/** What to say when there's no route, and what the player can change. Never an invented route. */
export const OUTCOME_COPY: Record<Exclude<RouteOutcome, "ok">, { title: string; body: string; actions: OutcomeAction[] }> = {
  no_network: {
    title: "No walking paths mapped here",
    body: "There are no public walking paths on the map near this start. Try starting somewhere else.",
    actions: ["change_start"],
  },
  no_public_start: {
    title: "Start somewhere public",
    body: "There's no public walking path within 120 m of this start. Pick a start on a street or park path.",
    actions: ["change_start"],
  },
  no_feasible_route: {
    title: "No suitable walking route found here",
    body: "Try another shape, starting location, or walking distance.",
    actions: ["change_length", "change_start", "change_shape"],
  },
  shape_not_possible: {
    title: "No suitable walking route found here",
    body: "The paths here don't make a loop that looks enough like this shape. Try another shape, starting location, or walking distance.",
    actions: ["change_shape", "change_start", "change_length"],
  },
};

export const ACTION_LABEL: Record<OutcomeAction, string> = {
  change_shape: "Choose another shape",
  change_length: "Change the length",
  change_start: "Change the start",
  try_again: "Try again",
};
