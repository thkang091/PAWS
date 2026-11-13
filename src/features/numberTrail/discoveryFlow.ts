/**
 * Location-first Number Trail (phase L3): what the screens show, as pure functions of what the server said. A number
 * is selectable only when the server found a verified route for it; nothing here guesses or fills in.
 */
import type { AvailabilityStatus, NumberAvailability } from "../../../supabase/functions/tournament/numberDiscovery";
import type { EdgeWarning } from "../../../supabase/functions/tournament/osm";

export type { AvailabilityStatus, NumberAvailability };

export const ALL_NUMBERS: readonly string[] = Array.from({ length: 100 }, (_, i) => String(i));
export const RADII = [500, 1_000, 2_000, 3_000] as const;
export type Radius = (typeof RADII)[number];
export const DEFAULT_RADIUS: Radius = 1_000;

export const radiusText = (m: number) => (m < 1_000 ? `${m} m` : `${m / 1_000} km`);
export const kmText = (m: number) => (m < 1_000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1_000).toFixed(1)} km`);

export type CellTone = "available" | "none" | "unchecked" | "checking" | "failed";

/** One grid cell. Each state differs in fill, border and words, never colour alone. */
export const cellView = (n: NumberAvailability) => {
  const routes = n.routes === 1 ? "1 route" : n.more ? `${n.routes}+ routes` : `${n.routes} routes`;
  switch (n.status) {
    case "AVAILABLE":
      return { tone: "available" as CellTone, sub: routes, selectable: true, a11y: `${n.number}, available, ${routes} found` };
    case "NOT_FOUND_IN_CHECKED_AREA":
      return { tone: "none" as CellTone, sub: "None", selectable: true, a11y: `${n.number}, no route in the checked area` };
    case "CHECKING":
      return { tone: "checking" as CellTone, sub: "Checking", selectable: false, a11y: `${n.number}, checking` };
    case "CHECK_FAILED":
      return { tone: "failed" as CellTone, sub: "Failed", selectable: false, a11y: `${n.number}, the check failed` };
    default:
      return { tone: "unchecked" as CellTone, sub: "Not checked", selectable: false, a11y: `${n.number}, not checked yet` };
  }
};

/** Every number in a given state, before any reply: the request is in flight for all of them. */
export const allAs = (status: AvailabilityStatus): NumberAvailability[] => ALL_NUMBERS.map((number) => ({ number, status, routes: 0, more: false, nearestApproachM: null }));

/** The honest line under the title while and after scanning. */
export const scanSummary = (numbers: readonly NumberAvailability[], running: boolean, checkedRadiusM: number | null, radiusM: number) => {
  const available = numbers.filter((n) => n.status === "AVAILABLE").length;
  const checked = numbers.filter((n) => n.status === "AVAILABLE" || n.status === "NOT_FOUND_IN_CHECKED_AREA").length;
  const failed = numbers.some((n) => n.status === "CHECK_FAILED");
  const partialArea = checkedRadiusM != null && checkedRadiusM < radiusM - 25;
  const line = failed
    ? "The streets couldn't be checked. Try again."
    : running
      ? checked
        ? `Checking nearby streets. ${checked} of 100 checked.`
        : "Checking nearby streets."
      : checked < 100
        ? `${checked} of 100 checked. The rest weren't checked yet.`
        : partialArea
          ? `All 100 checked within ${radiusText(Math.round(checkedRadiusM! / 10) * 10)}. Dense streets; the edge of ${radiusText(radiusM)} wasn't fully searched.`
          : `All 100 checked within ${radiusText(radiusM)}.`;
  return { available, checked, failed, line, done: !running && checked === 100 };
};

/** Route names in walking-distance order: A, B, ... Z, then AA. */
export const routeName = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(65 + Math.floor(i / 26) - 1)}${String.fromCharCode(65 + (i % 26))}`);

export const WARNING_LABELS: Record<EdgeWarning, string> = {
  no_sidewalk_mapped: "Sidewalk not mapped in places",
  no_sidewalk: "Stretches without a sidewalk",
  steps: "Steps",
  unpaved: "Unpaved paths",
  unmarked_crossing: "Unmarked crossings",
  rail_crossing: "Rail crossing",
  busy_road: "Busy road nearby",
};

/** Where the search came from: the phone's GPS, or a spot picked on the map (never presented as GPS). */
export type SearchPlace = { latitude: number; longitude: number; manual: boolean; accuracyM?: number | null };
export const placeLabel = (p: SearchPlace) => (p.manual ? "Picked spot (not your GPS)" : p.accuracyM != null && p.accuracyM > 50 ? `Your location, about ${Math.round(p.accuracyM)} m accurate` : "Your location");

/** GPS too vague to search from honestly. */
export const POOR_ACCURACY_M = 150;
