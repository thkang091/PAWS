import type { ImportErrorCode, ImportIssue, ImportWarningCode, PublishCheck, RegionStage, RoadStatus } from "@/features/rooms/regionAdmin";
import { IMPORT_LIMITS, MIN_VERIFIED_ROADS } from "@/features/rooms/regionAdmin";

export const STAGE_LABEL: Record<RegionStage, string> = { draft: "Draft", in_review: "In review", published: "Published", disabled: "Disabled" };

export const ROAD_LABEL: Record<RoadStatus, string> = { pending: "Pending", verified: "Verified", unsafe: "Unsafe", disabled: "Disabled" };

/** One line per review choice, shown under the buttons so nobody marks a road without knowing what it means. */
export const ROAD_MEANING: Record<RoadStatus, string> = {
  pending: "Not looked at yet. Pending roads block publishing.",
  verified: "Walkable on public paths with a dog. Players can capture it.",
  unsafe: "A hazard: no pavement, a fast road, private land. Never shown to players.",
  disabled: "Not a hazard, just not part of the game. Never shown to players.",
};

const IMPORT_ERROR: Record<ImportErrorCode, string> = {
  too_large: `The file is over ${IMPORT_LIMITS.maxBytes / 1_000_000} MB. Split it into smaller areas.`,
  not_json: "This isn't valid JSON.",
  not_feature_collection: "The file must be a GeoJSON FeatureCollection.",
  unsupported_crs: "Coordinates must be longitude and latitude (WGS 84). Reproject the file first.",
  no_roads: "No LineString or MultiLineString roads were found.",
  bad_coordinates: "Some coordinates are missing or out of range.",
  too_few_points: "Some roads have fewer than two distinct points.",
  closed_road: "Some roads start and end at the same point. Split them in two.",
  duplicate_road: "Some roads repeat another road exactly.",
  too_many_roads: `Over ${IMPORT_LIMITS.maxRoads.toLocaleString("en")} roads. Split the area.`,
  too_spread_out: `The roads span more than ${IMPORT_LIMITS.maxSpanM / 1000} km. Keep an area walkable.`,
};

const IMPORT_WARNING: Record<ImportWarningCode, string> = {
  skipped_features: "Points and polygons were skipped.",
  short_roads: "Some roads are under 10 m. Check they're real.",
  long_roads: "Some roads are over 1.5 km. They're hard to capture.",
  isolated_roads: "Some roads don't touch any other road.",
  disconnected: "The roads form separate pieces.",
  prohibited_roads: "Some roads are private, closed to walkers, or highways. They can't be verified or walked.",
};

const featureList = (features: readonly number[]) => {
  if (!features.length) return "";
  const shown = features.slice(0, 5).join(", ");
  return features.length > 5 ? ` Features ${shown} and ${features.length - 5} more.` : ` ${features.length === 1 ? "Feature" : "Features"} ${shown}.`;
};

export const importErrorText = (issue: ImportIssue<ImportErrorCode>) => `${IMPORT_ERROR[issue.code]}${featureList(issue.features)}`;
export const importWarningText = (issue: ImportIssue<ImportWarningCode>) => `${IMPORT_WARNING[issue.code]}${featureList(issue.features)}`;

export const CHECK_LABEL: Record<PublishCheck, string> = {
  organizer: "Signed in as an organizer",
  draft: "Area is a draft",
  source: "Source recorded",
  license: "Licence recorded",
  reviewed: "Every road reviewed",
  verified: `At least ${MIN_VERIFIED_ROADS} verified roads`,
  no_duplicates: "No verified road repeats another",
  no_loops: "No verified road loops onto one junction",
};

/** "3 days ago", "today". Coarse on purpose: a list row only needs to tell fresh from stale. */
export const updatedAgo = (iso: string, now = Date.now()) => {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days) || days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 30) return `Updated ${days} days ago`;
  return `Updated ${new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short" })}`;
};
