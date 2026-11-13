# Team battles: Steal Your Territory and Steal Your Road

How the two nearby team games work, where their data comes from, how organizers prepare road areas, what is tested, and how to deploy. Written for PAWS engineers and organizers.

## Who decides what

| Concern | Owner |
| --- | --- |
| Basemap drawn under the game (streets, labels) | Google Maps (`react-native-maps`, `PROVIDER_GOOGLE`) |
| Which roads can be captured, their geometry and junctions | PAWS road graph in Supabase (`road_nodes`, `road_edges`), imported and checked by organizers |
| Whether a walk covered a road or closed a loop | `supabase/functions/rooms` edge function, using the shared pure modules `rooms/battle.ts` and `tournament/geo.ts` |
| Ownership, scores, the match clock, the winner | Postgres functions (`commit_territory_claim`, `commit_road_capture`, `battle_advance`), service role only |
| What a phone shows | Whatever `battle_state` returns. Realtime only says "something changed". |

The road graph is independent of Google. Never trace roads from Google tiles or copy Google geometry into the graph; import from a source whose licence allows it (see Licensing). Google Maps is used only as the visual backdrop, subject to the Google Maps Platform Terms of Service.

## Steal Your Territory

- Walk a loop of at least 200 m that ends within 25 m of its start. The edge function rebuilds the loop from the points (accuracy, speed, gaps and self-crossing checks from `tournament/geo.ts`), then calls `commit_territory_claim`.
- PostGIS takes the enemy area the loop covers (`ST_Difference`) and merges the loop into the claiming team's area (`ST_Union`, then `ST_MakeValid`, stored as MultiPolygon). Areas are measured on the spheroid (`ST_Area(geography, true)`).
- A team's score is the area it holds now, not everything it ever captured. Ground is never held by both teams.
- The edge function refuses loops enclosing under 200 m²; the database refuses anything under 50 m², self-crossing, or not a polygon. If the match has a play area, loops outside it are refused.

## Steal Your Road

- Only verified roads of a published road area can be captured.
- The phone and the edge function both match the walk to roads with `matchRoads`: points within 12 m of a road count toward it, points that sit between two parallel roads (within 4 m of each other's distance, away from a junction) count for neither, imprecise fixes (over 15 m) are ignored, along-road progress can't run ahead of the distance actually walked, and overlapping stretches are counted once.
- At 70% coverage the road is captured. A road just captured can't be taken back for 120 seconds. A road your team already holds earns nothing again.
- Score: 1 point per 10 m held, plus 20% of the largest connected network's points once it has 3 or more roads. Losing a connecting road splits the network and the bonus is recalculated for both teams.

## Match lifecycle

`preparing` → `countdown` → `active` → `finalizing` → `completed`, or `cancelled` by the host. Times come from the server: `starts_at` and `ends_at` are set by `start_battle`, and any player's phone nudges `battle_advance` when a boundary passes (repeats do nothing). A claim at or after `ends_at` is refused. Teams are copied to `battle_team_members` at the start and can't change during the match.

## Realtime and reconnection

Every committed change increments `battle_matches.seq` and writes one row to `battle_match_events` with that number, so events are stored, gapless and ordered. Database triggers broadcast a small "room changed" message on the private `room:<id>` channel. Phones then reload `battle_state`, which carries scores, ownership and the latest 20 events.

The phone's reconciliation (`src/features/rooms/battleEvents.ts`) shows each new event once, in sequence order, never replays history on first load, ignores duplicates, and ignores a slow reply older than what is on screen. After a long disconnect, events older than the 20-event window are not replayed as alerts, but the scoreboard and map are correct because they come from the reloaded state. A match that completed while the phone was offline opens on the result.

## Road areas

### Supported GeoJSON

- A `FeatureCollection`, up to 2 MB and 2,000 roads.
- Each road is a `LineString`, or a `MultiLineString` (each part becomes its own road). Points and polygons are skipped with a warning.
- Coordinates are WGS 84 longitude, latitude (`[lng, lat]`). A `crs` member is accepted only if it names CRS84 or EPSG:4326; anything else must be reprojected first.
- A road's name is read from `properties.name`, then `ref`, then `title`.

The import refuses (with feature numbers):

- coordinates that are missing, not numbers, or out of range
- roads with fewer than two distinct points
- roads whose two ends are the same point (split them in two)
- a road that repeats another exactly, in either direction
- areas wider than 6 km corner to corner

It warns, for the reviewer to look at:

- roads under 10 m or over 1.5 km
- roads that touch no other road
- a network in separate pieces
- skipped non-road features

### Node and edge structure

The phone builds the graph before saving (`buildGraph` in `rooms/battle.ts`): road ends within 3 m of each other become one junction (node). Each road becomes one edge from its start node to its end node, keeping its full geometry and its length in metres. `import_road_graph` stores nodes by key and edges with `ST_Length(geography)`. Every edge starts as `pending`.

### Import

1. Organizer opens Steal Your Road, then Manage road areas, then New road area.
2. Name the area, choose the GeoJSON file (or paste it), and check the preview: roads, junctions, total length, pieces, and the outline.
3. Record the source, licence and attribution. These are required.
4. Save draft. The area and its roads are created on the server.

### Review

On the review map, tap each road (or step through them with Review next road) and mark it:

- **Verified**: walkable on public paths with a dog. Only verified roads can be captured.
- **Unsafe**: a hazard, such as no pavement, a fast road, or private land. Never shown to players.
- **Disabled**: fine, but not part of the game. Never shown to players.

Notes are saved with the review. Only drafts can be reviewed. A published area is locked: disable it, then reopen it as a draft to change roads.

### Publication checks

The publish button stays disabled until the checklist passes, and the server checks again (`publish_competition_region`):

- the caller is an organizer
- the area is a draft
- source and licence are recorded
- no road is pending
- at least 3 roads are verified
- no verified road repeats another (`duplicate_roads`)
- no verified road starts and ends at the same junction (`road_loops`)

Publishing draws the area boundary around the verified roads (convex hull, buffered 50 m). The area appears in the Steal Your Road lobby only after the server confirms. Disabling is refused while a match is being played on the area; open rooms that picked it lose the pick.

Organizers are rows in `tournament_organizers`, added in the SQL editor.

### Licensing and attribution

- PAWS ships no road data. Every area comes from a file an organizer imports.
- The organizer must record the source and licence, and must have the right to use the data for this purpose. Check the licence terms of the source yourself; this document does not grant or confirm any rights.
- If a licence requires attribution, enter it in Attribution. It is shown to players in the lobby and on the game details screen.
- Common open sources (for example, OpenStreetMap under the ODbL) have attribution and share-alike conditions. Read the source's own licence and attribution guidance before publishing.

## GPS precision limits

- Phone GPS is commonly off by 5 to 15 m in the open and worse near tall buildings, under trees, or indoors. Fixes worse than 30 m (territory) or 15 m (roads) are ignored.
- Two parallel paths closer than about 8 m can't be told apart; points between them count for neither, so such roads are hard to capture. Consider disabling one of them during review.
- Very short roads (under about 20 m) can be captured by a few fixes; very long ones (over 1.5 km) are hard to cover in one walk.
- Tracking is foreground only. Leaving the app pauses tracking and starts a new segment; gaps are never filled with straight lines.

## Testing

| What | How | Where |
| --- | --- | --- |
| Pure rules (coverage, scoring, lifecycle, import validation, lobby rules, reconciliation) | Jest | `src/__tests__/teamBattles.test.ts`, `regionAdmin.test.ts`, `lobbyRules.test.ts`, `battleEvents.test.ts` |
| Every migration, territory and road SQL, RLS with several identities, publishing | Real PostgreSQL 17 + PostGIS 3.7 | `supabase/tests/team_battles.sql` |
| Parallel sessions: serialization, raced retries, rollback, bursts, parallel road captures | Real PostgreSQL, separate `psql` sessions | `supabase/tests/local/concurrency.sh` |

Run the database tests locally (needs Homebrew `postgresql@17` and `postgis`):

```bash
scripts/test-db-local.sh
```

It creates a throwaway cluster on a unix socket (no TCP), loads a small stand-in for Supabase's `auth`, `storage`, `realtime` and `cron` schemas (`supabase/tests/local/supabase_shim.sql`), applies every migration, runs the SQL tests, then the concurrency script, and stops the cluster. It never connects to a Supabase project. The stand-in is not Supabase: Realtime delivery, PostgREST, Storage and the edge function runtime are not exercised by it.

## Deploying (needs authorization; never run against production without it)

From the project root, against the PAWS project (`ytitmpodghiehzlmrhte`):

1. Review the pending migrations: `20261028120000_arena_games`, `20261105120000_tournaments`, `20261112120000_tournament_phase2`, `20261119120000_team_battles`, `20261126120000_region_admin`.
2. Apply them: `npx supabase@latest db push --project-ref ytitmpodghiehzlmrhte`
3. Deploy the functions: `npx supabase@latest functions deploy rooms tournament arena --project-ref ytitmpodghiehzlmrhte`
4. In the dashboard, keep Realtime private channels enabled (the `room:<id>` policies rely on them).
5. Add organizers: `insert into public.tournament_organizers (user_id) values ('<user uuid>');`
6. Optionally run `supabase/tests/team_battles.sql` in the SQL editor of a staging project. It rolls everything back, but it does create test users inside its transaction, so don't run it on production.

The service role key is used only inside edge functions (`SUPABASE_SERVICE_ROLE_KEY` is provided by the Supabase runtime). It must never be bundled in the app.
