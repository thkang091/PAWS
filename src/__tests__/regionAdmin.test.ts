import {
  IMPORT_LIMITS,
  blockingGraphErrors,
  canPublish,
  canReview,
  convexHull,
  nearestRoad,
  nextPending,
  parseRoadGeoJson,
  prohibitedTags,
  tagsOf,
  publishChecklist,
  regionStage,
  reviewCounts,
  type ReviewRoad,
} from "@/features/rooms/regionAdmin";
import { importErrorText, importWarningText } from "@/features/rooms/regionCopy";

// A small street grid near a park: about 100 m per block.
const LAT = 37.77;
const LNG = -122.42;
const D = 0.0009;
const line = (coords: number[][], name?: string) => ({ type: "Feature", properties: name ? { name } : {}, geometry: { type: "LineString", coordinates: coords } });
const grid = () => [
  line([[LNG, LAT], [LNG + D, LAT]], "First St"),
  line([[LNG + D, LAT], [LNG + 2 * D, LAT]], "First St"),
  line([[LNG, LAT], [LNG, LAT + D]], "Oak Ave"),
  line([[LNG + D, LAT], [LNG + D, LAT + D]], "Elm Ave"),
  line([[LNG, LAT + D], [LNG + D, LAT + D]], "Second St"),
];
const fc = (features: unknown[], extra: Record<string, unknown> = {}) => JSON.stringify({ type: "FeatureCollection", features, ...extra });
const codes = (r: ReturnType<typeof parseRoadGeoJson>) => r.errors.map((e) => e.code);

describe("pedestrian tags", () => {
  it("reads OpenStreetMap-style tags and keeps unknowns unknown", () => {
    expect(tagsOf({ highway: "Footway", footway: "sidewalk", access: "yes" })).toEqual({ access: "yes", foot: null, pathType: "sidewalk" });
    expect(tagsOf({ highway: "residential" })).toEqual({ access: null, foot: null, pathType: "residential" });
    expect(tagsOf(null)).toEqual({ access: null, foot: null, pathType: null });
  });

  it("flags private, no-foot and highway roads, and carries tags into the import", () => {
    expect(prohibitedTags({ access: "private", foot: null, pathType: "service" })).toBe(true);
    expect(prohibitedTags({ access: null, foot: "no", pathType: "path" })).toBe(true);
    expect(prohibitedTags({ access: null, foot: null, pathType: "motorway_link" })).toBe(true);
    expect(prohibitedTags({ access: null, foot: null, pathType: "footway" })).toBe(false);
    const tagged = (props: Record<string, string>, coords: number[][]) => ({ type: "Feature", properties: props, geometry: { type: "LineString", coordinates: coords } });
    const r = parseRoadGeoJson(fc([...grid(), tagged({ highway: "service", access: "private" }, [[LNG, LAT + D], [LNG + D, LAT]])]));
    expect(r.ok).toBe(true);
    expect(r.warnings).toContainEqual({ code: "prohibited_roads", features: [6] });
    expect(r.edges[5]).toMatchObject({ access: "private", pathType: "service" });
    expect(r.edges[0]).not.toHaveProperty("access");
  });
});

describe("GeoJSON road import", () => {
  it("imports a clean grid as a connected graph with counts", () => {
    const r = parseRoadGeoJson(fc(grid()));
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.stats.roads).toBe(5);
    expect(r.stats.junctions).toBe(5);
    expect(r.stats.pieces).toBe(1);
    expect(r.stats.lengthM).toBeGreaterThan(400); // 3 blocks of ~79 m east-west, 2 of ~100 m north-south
    expect(r.stats.lengthM).toBeLessThan(480);
    expect(r.edges[0].name).toBe("First St");
    expect(r.outline.length).toBeGreaterThanOrEqual(4);
    expect(r.outline[0]).toEqual(r.outline[r.outline.length - 1]);
    expect(r.center?.latitude).toBeCloseTo(LAT + D / 2, 5);
  });

  it("splits MultiLineStrings into one road per part", () => {
    const multi = { type: "Feature", properties: { name: "Loop" }, geometry: { type: "MultiLineString", coordinates: [[[LNG, LAT], [LNG + D, LAT]], [[LNG + D, LAT], [LNG + D, LAT + D]]] } };
    const r = parseRoadGeoJson(fc([multi]));
    expect(r.ok).toBe(true);
    expect(r.stats.roads).toBe(2);
    expect(r.stats.junctions).toBe(3);
  });

  it("rejects files that are too large before parsing", () => {
    expect(codes(parseRoadGeoJson("", IMPORT_LIMITS.maxBytes + 1))).toEqual(["too_large"]);
  });

  it("rejects text that isn't JSON", () => {
    expect(codes(parseRoadGeoJson("{nope"))).toEqual(["not_json"]);
  });

  it("rejects anything but a FeatureCollection", () => {
    expect(codes(parseRoadGeoJson(JSON.stringify(grid()[0])))).toEqual(["not_feature_collection"]);
    expect(codes(parseRoadGeoJson(JSON.stringify({ type: "FeatureCollection" })))).toEqual(["not_feature_collection"]);
  });

  it("accepts CRS84 and EPSG:4326 but rejects projected coordinates", () => {
    expect(parseRoadGeoJson(fc(grid(), { crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } } })).ok).toBe(true);
    expect(parseRoadGeoJson(fc(grid(), { crs: { type: "name", properties: { name: "EPSG:4326" } } })).ok).toBe(true);
    expect(codes(parseRoadGeoJson(fc(grid(), { crs: { type: "name", properties: { name: "EPSG:3857" } } })))).toEqual(["unsupported_crs"]);
  });

  it("reports out of range or missing coordinates with their feature numbers", () => {
    const r = parseRoadGeoJson(fc([...grid(), line([[LNG, 95], [LNG, LAT]]), line([[LNG, LAT], ["x", LAT]] as never)]));
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual([{ code: "bad_coordinates", features: [6, 7] }]);
    expect(importErrorText(r.errors[0])).toContain("Features 6, 7.");
  });

  it("rejects roads with fewer than two distinct points", () => {
    const r = parseRoadGeoJson(fc([...grid(), line([[LNG, LAT], [LNG, LAT]])]));
    expect(codes(r)).toEqual(["too_few_points"]);
  });

  it("rejects roads whose endpoints meet, so every road has two junctions", () => {
    const r = parseRoadGeoJson(fc([...grid(), line([[LNG, LAT], [LNG + D, LAT + D], [LNG + D, LAT], [LNG, LAT]])]));
    expect(r.errors).toEqual([{ code: "closed_road", features: [6] }]);
  });

  it("rejects duplicate geometry, in either direction", () => {
    const r = parseRoadGeoJson(fc([...grid(), line([[LNG + D, LAT], [LNG, LAT]])]));
    expect(r.errors).toEqual([{ code: "duplicate_road", features: [6] }]);
  });

  it("rejects areas too big to walk", () => {
    const r = parseRoadGeoJson(fc([...grid(), line([[LNG + 0.1, LAT], [LNG + 0.1 + D, LAT]])]));
    expect(codes(r)).toContain("too_spread_out");
  });

  it("says when there are no roads at all", () => {
    const point = { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [LNG, LAT] } };
    const r = parseRoadGeoJson(fc([point]));
    expect(codes(r)).toEqual(["no_roads"]);
  });

  it("skips non-road features with a warning instead of failing", () => {
    const point = { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [LNG, LAT] } };
    const r = parseRoadGeoJson(fc([...grid(), point]));
    expect(r.ok).toBe(true);
    expect(r.warnings).toContainEqual({ code: "skipped_features", features: [6] });
  });

  it("warns about disconnected pieces, isolated and very short roads", () => {
    const far = line([[LNG + 3 * D, LAT + 3 * D], [LNG + 4 * D, LAT + 3 * D]]);
    const stub = line([[LNG + 2 * D, LAT], [LNG + 2 * D + 0.00003, LAT]]);
    const r = parseRoadGeoJson(fc([...grid(), far, stub]));
    expect(r.ok).toBe(true);
    const w = r.warnings.map((x) => x.code);
    expect(w).toEqual(expect.arrayContaining(["disconnected", "isolated_roads", "short_roads"]));
    expect(r.warnings.find((x) => x.code === "isolated_roads")?.features).toContain(6);
    expect(r.warnings.find((x) => x.code === "short_roads")?.features).toEqual([7]);
    expect(importWarningText(r.warnings.find((x) => x.code === "disconnected")!)).toBe("The roads form separate pieces.");
  });

  it("never marks an imported road as anything but pending", () => {
    const r = parseRoadGeoJson(fc(grid()));
    // The import payload has no status at all; the server defaults every road to pending.
    expect(r.edges.every((e) => !("status" in e))).toBe(true);
  });

  it("outlines the area with a closed convex hull", () => {
    const hull = convexHull([[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]]);
    expect(hull).toHaveLength(5);
    expect(hull).not.toContainEqual([0.5, 0.5]);
    expect(convexHull([[0, 0], [1, 1]])).toEqual([]);
  });
});

const road = (id: string, status: ReviewRoad["status"], start = `${id}a`, end = `${id}b`, coords: [number, number][] = [[LNG, LAT], [LNG + D, LAT + Number(id.replace(/\D/g, "") || 0) * 0.0001]]): ReviewRoad => ({
  id,
  status,
  startNodeId: start,
  endNodeId: end,
  coords,
  lengthM: 100,
});

describe("road review", () => {
  it("counts review progress", () => {
    const c = reviewCounts([road("r1", "pending"), road("r2", "verified"), road("r3", "unsafe"), road("r4", "disabled"), road("r5", "verified")]);
    expect(c).toEqual({ total: 5, reviewed: 4, pending: 1, verified: 2, unsafe: 1, disabled: 1 });
  });

  it("derives In review from a draft with reviewed roads", () => {
    expect(regionStage("draft", { reviewed: 0 })).toBe("draft");
    expect(regionStage("draft", { reviewed: 3 })).toBe("in_review");
    expect(regionStage("published", { reviewed: 3 })).toBe("published");
    expect(regionStage("disabled", { reviewed: 0 })).toBe("disabled");
  });

  it("only lets organizers change roads, and only in drafts", () => {
    expect(canReview(true, "draft")).toBe(true);
    expect(canReview(false, "draft")).toBe(false);
    expect(canReview(true, "published")).toBe(false);
    expect(canReview(true, "disabled")).toBe(false);
  });

  it("steps to the next pending road and wraps round", () => {
    const roads = [road("r1", "verified"), road("r2", "pending"), road("r3", "verified"), road("r4", "pending")];
    expect(nextPending(roads, null)).toBe("r2");
    expect(nextPending(roads, "r2")).toBe("r4");
    expect(nextPending(roads, "r4")).toBe("r2");
    expect(nextPending([road("r1", "verified")], null)).toBeNull();
  });

  it("finds the road a tap meant, within reach only", () => {
    const roads = [
      { id: "a", coords: [[LNG, LAT], [LNG + D, LAT]] as [number, number][] },
      { id: "b", coords: [[LNG, LAT + D], [LNG + D, LAT + D]] as [number, number][] },
    ];
    expect(nearestRoad({ latitude: LAT + 0.00005, longitude: LNG + D / 2 }, roads)?.id).toBe("a");
    expect(nearestRoad({ latitude: LAT + D - 0.00005, longitude: LNG + D / 2 }, roads)?.id).toBe("b");
    expect(nearestRoad({ latitude: LAT + D / 2, longitude: LNG + D / 2 }, roads, 20)).toBeNull();
  });
});

describe("publishing", () => {
  const ready = { isOrganizer: true, status: "draft" as const, source: "OpenStreetMap", license: "ODbL 1.0", roads: [road("r1", "verified"), road("r2", "verified"), road("r3", "verified"), road("r4", "unsafe")] };
  const failing = (input: Parameters<typeof publishChecklist>[0]) => publishChecklist(input).filter((i) => !i.ok).map((i) => i.check);

  it("allows publishing when every check passes", () => {
    expect(canPublish(publishChecklist(ready))).toBe(true);
  });

  it("blocks anyone who isn't an organizer", () => {
    expect(failing({ ...ready, isOrganizer: false })).toEqual(["organizer"]);
  });

  it("blocks regions that aren't drafts", () => {
    expect(failing({ ...ready, status: "published" })).toEqual(["draft"]);
    expect(failing({ ...ready, status: "disabled" })).toEqual(["draft"]);
  });

  it("requires source and licence", () => {
    expect(failing({ ...ready, source: " ", license: "" })).toEqual(["source", "license"]);
  });

  it("requires every road reviewed", () => {
    expect(failing({ ...ready, roads: [...ready.roads, road("r9", "pending")] })).toEqual(["reviewed"]);
    expect(failing({ ...ready, roads: [] })).toEqual(["reviewed", "verified"]);
  });

  it("requires at least three verified roads", () => {
    expect(failing({ ...ready, roads: [road("r1", "verified"), road("r2", "verified"), road("r3", "disabled")] })).toEqual(["verified"]);
  });

  it("blocks duplicate and looping verified roads, but not hidden ones", () => {
    const same: [number, number][] = [[LNG, LAT], [LNG + D, LAT]];
    const dup = [...ready.roads, road("d1", "verified", "x", "y", same), road("d2", "verified", "y", "x", [...same].reverse() as [number, number][])];
    expect(blockingGraphErrors(dup).duplicates).toEqual(["d2"]);
    expect(failing({ ...ready, roads: dup })).toEqual(["no_duplicates"]);
    const loop = [...ready.roads, road("l7", "verified", "n1", "n1")];
    expect(failing({ ...ready, roads: loop })).toEqual(["no_loops"]);
    expect(canPublish(publishChecklist({ ...ready, roads: [...ready.roads, road("l8", "disabled", "n1", "n1")] }))).toBe(true);
  });
});
