> **Retired.** Number Trail replaced Follow the Shape in the app (Phase N3, 2026-11-06). Its screens are archived in
> `archive/follow-the-shape/`; the OpenStreetMap routing described here is still used by Number Trail.

# Follow the Shape: verification report (phases 2.5A to 2.5C)

What exists, what was tested and how, and what still needs a person walking outside. Nothing here has been deployed.

## How the game works now

1. **Choose a shape** (`app/game/tournament/shapes.tsx`): heart, triangle, square, diamond, star, lightning. Each card says what the shape needs from local paths; none promises to fit everywhere.
2. **Walk settings** (`shape-setup.tsx`): a start (your location, or anywhere you move the map), 15, 25 or 40 minutes (about 1.0, 1.7 or 2.6 km), footpaths and park trails first, avoid stairs.
3. **Route discovery** (`shape-routes.tsx`): up to three routes on a real pedestrian network (a published PAWS area, otherwise OpenStreetMap), each with an estimated shape match, warnings from the map data, distance, time, loop flag and how new it is to you, compared on one map in three line patterns. When nothing fits, the screen says why and offers a change of shape, length or start. It never invents a route.
4. **Walk** (`shape-walk.tsx`): the picked route under your GPS line, distance, time, route %, estimated match, GPS quality, pause and resume, finish. After three fixes more than 40 m off the route, a warning appears and a marker shows the nearest point on the route. No line is drawn to it, because the way back must be on public paths.
5. **Score** (`tournament` function, `submit`): server only, see below.
6. **Results** (`shape-result.tsx`): target, your route, your walk (as shapes, with no map), shape match, route walked, final score, distance, time, place in your difficulty tier, personal best. Sharing sends text only.

## Official score

`shape-route-score-v1` (`supabase/functions/tournament/routeScore.ts`), computed on the server from stored GPS points:

- **Eligible walk:** the same checks as before, from `matchShape`: enough points, the shape's minimum distance, no GPS gaps, no impossible speed, under three hours. The walk must have a picked route linked at the start (`link_route_session`), in the same tournament, owned by the walker.
- **Route walked:** each route step is matched with the Steal Your Road rules (12 m corridor, accuracy filter, progress can't run ahead of distance walked). A step is fully walked at 70% coverage. At least half the route must be walked, and at least 75% of the visited steps in route order (either direction), or the walk is held back as "not yet".
- **Final score:** 70% shape similarity (frechet-v1) plus 30% (route walked × in order), out of 100. Speed never scores. GPS jumps earn nothing: they fail eligibility, and coverage can't skip ahead.
- **Fairness:** players choose their shape, so leaderboards rank within the shape's difficulty tier (easy, medium, hard). Route candidates must already reach the shape's minimum match to be offered. Players with richer path networks still get better-fitting routes; that's documented, not hidden.

## Verification status

| Area | Status | Evidence |
| --- | --- | --- |
| Route engine: only walkable, connected, eligible edges; no straight-line joins | Unit tested | `src/__tests__/shapeRoutes.test.ts` (18 tests: rivers with and without bridges, private, no-foot and highway edges, building shortcuts, separate streets, dead ends, parallel sidewalks, duplicates, overlap, recent routes, impossible shapes, invalid starts) |
| Route variety: options under 40% shared, recent walks deprioritized, fewer options rather than fake ones | Unit tested | same file, tests 10 to 12 |
| Scoring: completion, order, jumps, pauses, off-route, speed | Unit tested | `src/__tests__/routeScore.test.ts` (12 tests) |
| Pedestrian tags, `walk_eligible`, published-only graph, owner-only routes, no stored position | Database tested | `supabase/tests/shape_routes.sql` on PostgreSQL 17 + PostGIS 3.7 |
| Linking a walk to its route, tiered submission, one route per walk, no client scoring | Database tested | `supabase/tests/shape_play.sql` |
| Graph from PostGIS to generator to stored candidates | Database tested | `supabase/tests/local/routes_e2e.sh` |
| Shape picker, walk settings, route discovery (success, failure, error states) | Simulator tested | iPhone 15 Pro simulator. Route cards were reviewed with real OpenStreetMap routes (Sellwood squares, Yeonnam hearts) loaded through a temporary hook, since removed; they line up with Google's streets. The error state is the real response from the undeployed backend. An earlier review used a synthetic grid; that preview was never in shipped code |
| Active walk screen with a route, results with route parts | Not simulator tested | needs a deployed backend and an assigned route |
| `tournament` edge function (`routes`, `start` with route, `submit`) | Typechecked only | no Deno or Supabase runtime here; never executed |
| Android | Not tested | no Android SDK or emulator on this machine |
| Real pedestrian networks | Tested on real data (offline) | OpenStreetMap extracts of six areas in four cities: every offered route checked edge by edge against the source data (`docs/walking-routes.md`, Real-network validation); two areas taken through PostGIS end to end. Not yet run through the deployed edge function |
| Field walking (GPS, safety, realistic times) | NOT VERIFIED | needs people walking outside |

**Deployment: blocked** until the migrations (including `20261231120000_osm_walk_routes.sql`) and the `tournament` function are deployed with your authorization, an Overpass instance suitable for production traffic is chosen, and the field checklist below passes in at least one area.

## Field test checklist

Run in each environment that will be offered: a residential neighbourhood, a dense city grid, a park with trails, a disconnected suburban network, and an area with limited pedestrian access.

**Data, before anyone walks**

- [ ] Import the area from a licensed source; record the source, licence and attribution.
- [ ] On the review map, verify only paths you have walked or confirmed as public and dog-friendly. Mark private, unsafe, closed and unknown paths unsafe or disabled.
- [ ] Check every bridge and crossing exists as an edge, and that no edge crosses water, buildings or fences without a real crossing.
- [ ] Publish. Confirm `walk_graph_near` returns no private, highway, pending or unsafe edges.

**Routes (from at least three starts per area, all six shapes, all three lengths)**

- [ ] Every option follows paths you can actually walk on the ground, and every junction on the route is a real junction.
- [ ] Loops end within sight of the start.
- [ ] Distance on the card is within 15% of a measured walk, and time is realistic with a dog.
- [ ] The three options are clearly different on the ground.
- [ ] A shape that can't fit is refused with a reason, never forced.
- [ ] Starting inside a private estate or a park with no checked path gives "Start somewhere public".
- [ ] After walking a route, asking again from the same start offers different routes first.

**Walking (with a dog, phone in a pocket or hand)**

- [ ] The GPS line follows the route; route % rises steadily.
- [ ] Pause, then resume 100 m later: the gap is not filled in.
- [ ] Leave the route by 60 m or more: the warning and marker appear within three fixes, and clear when you return.
- [ ] Under trees or between tall buildings, weak GPS is reported and those fixes don't count.
- [ ] Walk only half the route: hand-in is held back as "not yet", and you can keep walking.
- [ ] Complete the route: the server score matches the estimate within a few points, and the leaderboard updates in your tier.
- [ ] Sharing sends text only; no map or coordinates are shared.

**Privacy**

- [ ] Another account can't read your route requests, picks, routes or submissions.
- [ ] Route requests store only a public start junction (check the table).
