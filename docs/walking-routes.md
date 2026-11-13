# Walking routes for Follow the Shape

How PAWS builds Follow the Shape routes that people can actually walk with a dog, what data that needs, and what is still missing. Gameplay, scoring and the verification status are in `docs/follow-the-shape-verification.md`.

## Routing data audit (2026-11, revised)

| Source | Available | Used for shape routes | Why |
| --- | --- | --- | --- |
| Google Maps SDK (`react-native-maps`) | Yes, key configured | Map display only | It has no pedestrian graph to search. |
| Google Routes API v2, `travelMode: WALK` | Yes. Called from the app in `src/features/care/walk/routePlanner.ts` for Care walks, with the Maps key. No key is set for edge functions. | No | It answers "route from A to B", not "which loops exist here": to make a shape with it you would have to draw the shape's corners first and ask Google to join them, the wrong way round. It returns no edge ids (no edge-level overlap, history or connectivity proof) and no access tags, and the Google Maps Platform Terms limit storing route content, which picked routes, scoring and history need. |
| OpenStreetMap through Overpass | Yes (public `overpass-api.de`, no key) | **Yes**, anywhere no PAWS area is published | A real, licensed (ODbL) pedestrian network with node-level connectivity and the tags needed to judge walkability: `highway`, `footway`, `sidewalk`, `access`, `foot`, `bridge`, `tunnel`, barriers, crossings, railways, water and buildings. |
| PAWS road graph (`road_nodes`, `road_edges`) | Schema yes, data where organizers publish | **Yes**, and it wins | Organizer-imported and checked road by road. Where a published area covers the start (a junction within 400 m), only it is used, so an organizer's "unsafe" can never be overruled by OpenStreetMap. |

**Decision:** shape routes come from a real pedestrian network and nothing else: a published PAWS area where there is one, OpenStreetMap everywhere else. Google Maps stays the backdrop. If neither source answers, the player is told so and no route is offered. There is no synthetic or fallback geometry anywhere in production code (a test scans for it).

### OpenStreetMap rules (`supabase/functions/tournament/osm.ts`, "osm-walk-v1")

- **Walked:** footway (sidewalks and crossings included), path, pedestrian, living_street and steps. Also residential, unclassified and service streets (not driveways, parking aisles or drive-throughs), with a warning when no sidewalk is mapped.
- **Busier roads:** tertiary, secondary and primary only with a sidewalk mapped on the road or explicit foot access. Never motorway or trunk.
- **Cycleways, bridleways and tracks:** only with explicit foot access.
- **Never walked:** private or no access (unless foot access is explicit), `foot=no`, informal or barely visible trails, mountain hiking grades, areas, indoor corridors, fords, construction, disused ways.
- **Connections:** ways join only where they share an OpenStreetMap node. Streets that merely cross on the map (bridges, underpasses) never connect.
- **Barriers:** a locked or private gate, wall, fence, hedge or ford node cuts the way there.
- **Dropped pieces:** a piece that crosses a building outline (unless a mapped passage), a railway away from a node tagged as a crossing, or water without a bridge. Tunnels and culverts are allowed.
- **Warnings kept per edge:** busy road, rail crossing, no sidewalk, unmarked crossing, sidewalk not mapped, steps, unpaved.
- **Storage and attribution:** fetched networks are stored (`osm_walk_edges`, `osm_walk_areas`) and reused for 14 days for the same circle. Routes show "Map data © OpenStreetMap contributors (ODbL 1.0)".

**Before launch:** the public Overpass instance is meant for light use. For real traffic, run your own Overpass (set `OVERPASS_URL` on the `tournament` function) or use a commercial OSM provider.

## The pedestrian graph

The phase 3 graph, extended rather than duplicated (`supabase/migrations/20261203120000_shape_routes.sql`):

| Field | Meaning |
| --- | --- |
| `road_nodes.id`, `road_edges.start_node_id`, `end_node_id` | Stable junction and road ids; road ends within 3 m are one junction |
| `road_edges.geom`, `length_m` | LineString in WGS 84, length on the spheroid |
| `road_edges.status` | `pending`, `verified`, `unsafe`, `disabled`: set by a person |
| `road_edges.access`, `foot`, `path_type` | Tags from the import file (`access`, `foot`, `highway`; `footway=sidewalk` becomes `sidewalk`). Missing tags stay null. |
| `road_edges.walk_eligible` | Generated: verified, and not private, no-foot or a highway |
| `competition_regions.source`, `license`, `attribution` | Where the data came from, recorded per area |

Rules:

- Nothing is eligible until a person verifies it. Unknown access is never treated as verified on its own.
- A road tagged private, `foot=no`, or motorway, trunk or their links can't be verified at all (`prohibited_road`), and isn't eligible even if its status is forced.
- Only published areas are served to the generator (`walk_graph_near`). Drafts and disabled areas never are.

### Getting data in

Use the road area import (Steal Your Road, then Manage road areas). Export the walkable network for one neighbourhood as GeoJSON LineStrings, keeping `highway`, `footway`, `access` and `foot` in each feature's properties. Record the source and licence, and check every road on the review map before publishing. Verify only paths you know are public and walkable with a dog. Mark everything else unsafe or disabled.

Licensing is the organizer's responsibility: use only data you have the right to use, and enter any required attribution. The attribution of every area a route uses is returned with the routes, so it can be shown with the map. Don't trace roads from Google tiles or copy Google route geometry into the graph.

## The generator

`generateShapeRoutes` in `supabase/functions/tournament/routes.ts` is pure TypeScript. The server runs it in the `tournament` edge function (`routes` action); the app can import the same module for previews.

1. **Start.** The nearest walkable junction within 120 m of the chosen point, on a connected piece of network long enough for the walk. If there is none, the result is `no_public_start`, and the player is asked to choose a public start. The player is never snapped across an unknown gap.
2. **Place the shape.** The target's corners are scaled to the walking length, turned in 12 steps, and anchored at each corner. Curvy shapes are sampled to 12 points. That gives up to 480 placements, deterministically.
3. **Route through it.** Each corner snaps to the nearest walkable junction within reach. Consecutive junctions are joined by Dijkstra over walkable edges only, with footways slightly preferred. If two corners aren't connected (a river with no bridge, a gated estate), the placement is dropped. Nothing is ever joined with a straight line.
4. **Hard checks.** Length within 25% of the time asked for. Closed shapes return to the start junction. At most 25% of the length walked twice. Exact duplicates are dropped.
5. **Shape match.** Each candidate is scored with the same Fréchet matcher that scores walks (`pathMatcher` in `shape.ts`; a route scores exactly as a walk along it would). A fast 24-sample pass ranks candidates, then the top 12 get the official 64-sample score. A route must reach that shape's minimum, or the answer is `shape_not_possible`, with the best score reached.
6. **Choose options.** Routes sharing over 60% with a recent completed walk go to the back of the queue. They stay available when nothing else exists. The best routes are then picked greedily, up to three: each must share under 40% of its length with every option already chosen, and must not be the same walk on a parallel path. If fewer than three differ enough, fewer are returned and `limited` is set.

Walking speed for length: 1.1 m/s with stops, so 15 min is about 990 m, 25 min about 1650 m, and 40 min about 2640 m.

### Diversity

`overlapRatio = sharedLength / min(lengthA, lengthB)`, counting each shared edge once. Edges with both ends within 150 m of the start are left out, because every route from the same door shares them. A second check, the mean distance between the two routes resampled by length (`meanGap`, under 35 m means the same walk), catches a loop walked along the parallel sidewalk. Backtracking is the share of length walked more than once.

| Setting | Value | Kind |
| --- | --- | --- |
| Shown options overlap | under 40% | Hard: fewer options rather than near-copies |
| Overlap with recent walks | under 60% preferred | Soft: such routes go last, never replaced by an unsafe one |
| Backtracking | 25% or less | Hard |
| Start connector allowance | 150 m | |

These are initial heuristics in `ROUTE_RULES`, versioned as `shape-route-v1` in `shape_route_algorithms`.

### Shape minimums

Each minimum sits a few points above the best score a different ideal shape gets against that target, measured with the walk matcher. Allowing rotation makes some shapes close relatives.

| Target | Minimum | Closest other shape (ideal) |
| --- | --- | --- |
| Square | 80 | Diamond scores 75 as a square |
| Diamond (taller than wide) | 80 | Square scores 75.5 as a diamond |
| Triangle | 75 | Heart scores 70.3 as a triangle |
| Heart | 75 | Triangle scores 70.4 as a heart |
| Star | 70 | Square scores 58.3 as a star |
| Lightning, Letter S | 70 | Open shapes; closed shapes score 0 |

On a plain street grid this gives square loops (score 100), but no triangle, diamond or star: those need diagonal paths. A notched two-block outline on a grid scores 87 as a heart. The same matcher would score a walk along it 87, so it is offered. If that's too generous, raise the heart minimum and bump the algorithm version.

Lightning and Letter S are open shapes: their routes start and end in different places (`loop: false`).

## Backend interfaces

| Interface | Who | What |
| --- | --- | --- |
| `tournament` function, `action: "routes"` | Signed-in player | `{ shapeKey, minutes: 15/25/40, latitude, longitude, tournamentId?, avoidStairs? }` returns `{ outcome, options[], limited, sources[] }` |
| `assign_shape_route(candidate_id)` | Signed-in player | Picks one of your own options; abandons any earlier open pick |
| `walk_graph_near(lat, lng, radius)` | Service | Eligible edges and nodes from published areas, plus each area's licence and attribution |
| `record_shape_route_request(...)` | Service only | Stores a run and its options, re-checking that every edge is eligible |
| `recent_route_edges(user, limit)` | Service only | A player's completed routes, for the novelty check |
| `purge_shape_routes(days)` | Service only | Deletes options nobody picked after 30 days (schedule daily with pg_cron) |

Tables (owner-only reads, no client writes): `shape_route_algorithms`, `shape_route_requests`, `shape_route_candidates`, `shape_route_assignments`. A request stores the public start junction, never the phone's position. Candidates store edge ids and directions only, because geometry is rebuilt from the graph. Recent history is completed assignments.

## Tests

| What | Where |
| --- | --- |
| Square and triangle loops, a street not connected to the start, a river with and without bridges, private, no-foot and highway edges, a path through a building, parallel sidewalks, dead ends, duplicate and overlapping options, a recently walked route, no feasible shape, an invalid start, unreviewed networks, stairs, scoring consistency, determinism. Every returned route is checked: only walkable edges, joined end to end, closing at the start, with geometry copied from the edges. | `src/__tests__/shapeRoutes.test.ts`, fixtures in `src/__tests__/fixtures/pedestrianGraphs.ts` |
| Tag parsing and prohibited-road warnings | `src/__tests__/regionAdmin.test.ts` |
| Tags stored on import, `walk_eligible`, prohibited roads can't be verified, only published areas served, candidates re-checked, owner-only reads, no client writes, no stored position, one open pick, history and purge | `supabase/tests/shape_routes.sql` (real PostGIS) |
| A published grid exported by `walk_graph_near`, routed by the TypeScript generator, stored back through `record_shape_route_request` | `supabase/tests/local/routes_e2e.sh` with `src/__tests__/shapeRoutesDb.test.ts` |

Run them: `npx jest` and `scripts/test-db-local.sh`.

## Real-network validation (2026-11-06)

`src/__tests__/osmRealValidation.test.ts` runs the generator on real Overpass extracts (843 m radius, fetched 2026-11-06, © OpenStreetMap contributors) for six areas, three shapes and two lengths. For every route it checks, independently, that each edge is a consecutive run of nodes in a real, walkable OpenStreetMap way; that the route is connected junction to junction, closes on the start junction, and is exactly its edges' geometry; that its length recomputed from the path matches; and that options share under 40% length and aren't the same walk on parallel paths.

| Area | Walkable edges | Square 15 / 25 min | Heart 15 / 25 min | Triangle 15 / 25 min |
| --- | --- | --- | --- | --- |
| San Francisco, Outer Sunset (grid) | 1,424 | 92 / 95, 73 | none / 81, 80, 78 | none / none |
| Seoul, Yeonnam-dong (dense, rail park) | 2,357 | 78, 76 / none | 78, 77, 71 / 84, 78, 77 | 75, 70 / none |
| Seoul, Gangnam (superblocks) | 1,449 | 83 / none | none / none | none / none |
| Irvine, Woodbridge (lakes, curving suburb) | 903 | 89 / none | 74 / none | none / none |
| Brooklyn, Park Slope (grid, park) | 2,136 | 100, 100, 96 / 94, 87, 82 | 71, 68 / 84, 84, 84 | none / 69 |
| Portland, Sellwood (grid, river) | 942 | 88, 88, 87 / 99, 98, 96 | 80, 69 / 86, 83, 82 | none / none |

Each number is one offered route's estimated shape match; "none" means the generator honestly found no route (no loop of that length, or none that looks enough like the shape). 42 routes were offered in all, and every one passed every check. Routes were also drawn over the source data and over Google's basemap (Sellwood squares, Yeonnam hearts) and sit on the real streets. Triangles are rare on real networks, as expected.

`supabase/tests/local/osm_e2e.sh` (run by `scripts/test-db-local.sh` when `PAWS_OSM_DIR` is set) takes Yeonnam and Sellwood through the database: stored, served back by `osm_walk_graph_near`, routed, accepted by `record_shape_route_request`, picked, and rebuilt by `assignment_route` with the same length.

What this does not prove: that the paths are safe or open on the ground today, that sidewalks exist where OpenStreetMap doesn't say, or that a route is pleasant with a dog. That needs the field checklist in `docs/follow-the-shape-verification.md`.

## Known limits

- **Data:** OpenStreetMap coverage and tagging vary by place. Missing sidewalk tags are shown as a warning, never assumed either way. Organizer-published areas still win wherever they exist.
- **Shape thresholds:** calibrated on ideal shapes (phase 2.5A). On real grids, loosely heart-like polygons clear the heart minimum (75): the Yeonnam and Park Slope hearts are recognisable only roughly. Raise the heart minimum after field feedback if players find them unconvincing.
- **Scale:** the search is built for a neighbourhood (a few thousand edges within 2.5 km). It takes about 0.2 to 0.6 s per request in tests. Larger areas need a spatial index for corner snapping.
- **Shape variety** depends on the street pattern: grids give squares, and diagonals are needed for triangles and diamonds. Many places will honestly offer only some shapes.
- **Rerouting** is not supported: the walk screen marks the nearest point on the route but never draws a way back, because the phone doesn't hold the graph to route on.
- **Not run:** the edge function, including its live Overpass fetch, has never been run (no Deno here); the same pure code was run in Jest on real extracts. The database side was tested on local PostgreSQL 17 + PostGIS 3.7 through a Supabase stand-in.
