# Number Trail: digit engine (N1), race backend (N2) and the game (N3)

Number Trail replaces Follow the Shape. Each match assigns a two-digit number. Players walk it, digit by digit, along
real pedestrian streets; the first server-verified finish wins. This document covers Phase N1: the digit templates,
building digits from the real network, plan validation, feasible-number selection and GPS completion checking.
Nothing here is deployed, and Follow the Shape is still in the app until Phase N3.

All code is pure TypeScript shared by the phone, the `tournament` edge function and the tests:

| Module | Role |
| --- | --- |
| `supabase/functions/tournament/digits.ts` | Seven-segment templates, reading segments back as a digit, route inspection (how each digit is walked), difficulty |
| `supabase/functions/tournament/numberRoutes.ts` | `generateDigitRoutes` (DigitRouteGenerator), `planNumberRoutes` (TwoDigitRoutePlanner), `validateNumberPlan` (DigitRouteValidator), `chooseNumber` |
| `supabase/functions/tournament/numberRace.ts` | `raceProgress` (NumberRaceEngine): coverage, digit order, GPS checks |

The network is the one Follow the Shape already uses: a published PAWS road area near the start, else OpenStreetMap
converted by `osm.ts` (`osm-walk-v1`), with the same walkability rules, warnings and attribution. Nothing was rebuilt.

## Digits

Segments A to G sit on a frame of two stacked cells (`w` wide, `hh` tall each) with corners TL, TR, ML, MR, BL, BR.
The digit table is exactly the brief's. A digit is drawn with its required segments and no others.

Walking a digit in one go is route inspection on the seven-segment graph. Digits with at most two odd corners have an
Euler walk and repeat nothing. 3 and 4 have four odd corners, so the cheapest stroke is walked twice; the repeat stays
on the digit's own streets, so no extra line is drawn. Every possible start corner gets its best walk.

Difficulty = strokes walked (repeats included) plus turns, over both digits: easy up to 11 (11, 17, 41), medium up to
18, hard above (88, 38, 68). Difficulty only filters feasible numbers; it never admits an infeasible one.

## Building digits from the real network (`number-trail-v1`)

The search starts from the network, not from a drawn digit:

1. **Real corners.** At each junction, nearest to the player first, the generator takes pairs of streets that meet at
   65 to 115 degrees. It follows each street straight out (every point within a narrow corridor, always moving
   forward) to the junctions it really reaches. Those distances set the frame's width and half-height (50 m minimum,
   at most 16% of the target length, half-height over width between 0.5 and 2). A straight street alone can frame a 1.
2. **Upright, never mirrored.** The frame may turn up to 45 degrees to follow the streets, but never flips.
3. **Corners on junctions.** Every frame corner must land on a real junction within `max(15 m, 22%)` of the cell.
4. **Segments on streets.** A segment exists only when connected walkable edges join its two corner junctions inside
   a corridor of `max(10 m, 15%)` of its length around its line, walking at most 1.3 times the straight length. It's a
   shortest path restricted to that corridor: never a straight line, never a gap.
5. **Clean strokes.** A digit's segments share only their corners: no shared edges or junctions.
6. **Read back.** The real geometry is sampled along all seven template segments. A segment is present when 80% of its
   line lies along the walked streets, absent when no more than 20% of its middle does, ambiguous otherwise. The digit
   is kept only when that reading is exactly the intended digit.
7. **Readability (0 to 100)** from corner offsets, how far streets wander from the lines, extra length, proportions
   and skew. Below 80 is not offered.

The search checks at most 9,000 distinct frames, nearest streets first, so it stays inside an edge function's CPU
allowance. It keeps up to 160 placements per digit, at most 4 within any 50 m, so the places to choose from are spread
out.

## Planning numbers

For each number 00 to 99 the planner pairs a placement of the first digit (reachable from the player within 450 m)
with one of the second. A pair is kept only when:

- the start is a junction within 120 m on a connected piece of network at least twice the race length (station plazas
  and footpath islands are skipped);
- the digits share no street, their frames don't overlap, and their strokes stay at least `max(25 m, 30% of a cell)`
  apart;
- digit two reads after digit one: further along digit one's "right", within about half a digit height, and within 40
  degrees of due east of it on the map;
- the heights match within 0.65 to 1.55 times;
- a real connector exists between digit one's last corner and digit two's first corner, over streets that belong to
  neither digit. It runs at most 450 m (or 30% of the target), and at most 45 m of it may lie within GPS range of a
  stroke;
- the race (digit one, connector, digit two) is 45% to 110% of the time asked at 1.1 m/s.

Layouts are `side_by_side` (adjacent, aligned, similar size and angle) or `separate` (apart but still reading in
order); the UI must say which. Each plan records `headingDeg`, the digits' shared lean, so the map can turn to show the
number upright. The walk to the start keeps off both digits where it can, and isn't timed.

Every plan passes `validateNumberPlan` before it is offered. It checks: two-character number; every step an existing
walkable edge joined end to end; parts in order; strokes from corner to corner exactly matching the walk; repeats on
the same streets; no shared streets; connector off the strokes; the geometry reading back as the digit; and lengths
matching the edges.

`chooseNumber(plans, random, difficulty?)` picks uniformly from feasible numbers only. With none it returns null, and
the app shows "No number routes available in this area. Try another location or walking distance."

## Completion (`number-race-v1`)

- Only the digits' own stroke edges earn coverage. The connector and the walk to the start earn nothing.
- Coverage comes from pairs of consecutive good fixes (accuracy 20 m or better) that are both within 15 m of a stroke
  edge and move along it. The stretch between their projections is merged into that edge's walked intervals, so
  standing still, re-sent fixes and walking a street twice never count twice.
- Digit two earns nothing until digit one is complete.
- A digit is complete at 90% of its stroke length, every segment at 75% or more, and every corner passed within 20 m.
- Fixes more than 35 m apart, or across a pause, earn nothing between them. Faster than 6 m/s (per pair, or over 10
  seconds) earns nothing. A sustained jump over 100 m makes the finish ineligible until reviewed; a lone spike is
  dropped as a glitch. Unwitnessed gaps over 25% of the race need review.
- Fixes from before the race or the future are ignored, so a replayed old walk earns nothing.

GPS can be faked. These rules catch impossible movement and broken tracks; they don't prove where a phone was.

## Tests

- `numberDigits.test.ts`: the table for all ten digits, read-back, all 100 numbers as text with leading zeros, walks
  and repeats for each digit, difficulty bands.
- `numberRoutes.test.ts`: for each digit, a town whose only streets are that digit draws it, finds nothing it can't
  draw, and loses it when any segment is cut. Also: grid planning, independent validation, no invented geometry,
  part order, connector off strokes, reading order, measured lengths, determinism, turned grids and heading, random
  pick only from feasible numbers, difficulty filter, infeasible areas, no network, no public start, start islands,
  and ten validator tampering cases.
- `numberRace.test.ts`: for each digit, a realistic walk finishes; one digit alone, 70%, corner hopping, a parallel
  street and impossible speed don't. Also: digit order, connector excluded, repeats and re-sent fixes, jumps,
  spikes, pauses, replays, accuracy, crossing a stroke, per-street progress.
- `numberRealValidation.test.ts` (runs with `PAWS_OSM_DIR`): real extracts, every plan checked against the raw
  OpenStreetMap source, honest simulated walks, and random picks.

Synthetic networks appear only in tests (`src/__tests__/fixtures`); `osmRoutes.test.ts` fails if production code
references them.

## Real-network validation (2026-11-06)

Real OpenStreetMap extracts (© OpenStreetMap contributors, ODbL), planned from the given point. "Numbers" means
feasible numbers out of 100. All plans passed the validator and raw-source checks, and sampled honest walks finished.

| Area | Kind | Minutes | Numbers | Side by side | Digits drawable | Time (Node) |
| --- | --- | --- | --- | --- | --- | --- |
| San Francisco, Outer Sunset | grid (85 x 175 m blocks) | 15 | 0 | 0 | 1, 7 | 0.1 s |
| San Francisco, Outer Sunset | grid | 25 | 16 | 14 | all | 2.5 s* |
| Seoul, Yeonnam-dong | irregular | 15 | 41 | 19 | all | 1.2 s* |
| Seoul, Yeonnam-dong | irregular | 25 | 49 | 15 | all | 1.7 s* |
| Seoul, Gangnam station | disconnected superblocks | 15 / 25 | 0 / 0 | 0 | all | 0.2 / 0.7 s |
| Irvine, Woodbridge | suburban | 15 / 25 | 2 / 1 | 1 / 0 | 0, 1, 4, 7, 8 | 0.1 / 0.2 s |
| Brooklyn, Park Slope | grid (long blocks) | 15 / 25 | 4 / 12 | 1 / 5 | 1, 3, 4, 7 / all | 0.6 / 3.2 s* |
| Portland, Sellwood | grid | 15 / 25 | 5 / 36 | 5 / 24 | all | 1.0 / 2.1 s* |
| Brooklyn, Prospect Park | park trails | 15 / 25 | 0 / 0 | 0 | 1, 7 / 1, 4, 7 | 0.1 / 0.7 s |
| Portland, Sellwood (wide) | grid | 40 | 86 | 69 | all | 3.5 s* |

\* Measured inside Jest, with ts-jest overhead. The same plans in plain Node took 0.06 to 1.2 s; Deno is unmeasured.

What this shows: numbers depend on the streets. Regular grids with near-square blocks do best. Long blocks, curving
park paths, cul-de-sacs and superblocks without mapped sidewalks give few or none, and the app says so instead of
forcing a shape.

## Known limits and open items

- **Deno CPU time is unmeasured.** Supabase edge functions allow about 2 s of CPU per request. Node takes up to 1.2 s
  on the densest extract. Measure in Deno before deploying; if needed, cache plans per area and walking time.
- **Map overlay.** Plans were drawn over the OpenStreetMap source data, not yet over Google Maps in the app (Phase
  N3/N4).
- **Leaning digits.** Grids up to 45 degrees off north give leaning digits; the live map should turn by `headingDeg`.
- **Field walking.** No real walk has been checked against these rules.
- **Not built yet:** the UI and Follow the Shape removal (N3).

---

# Phase N2: the nearby race backend

Number Trail is a nearby room game (`multiplayer_rooms.game_type = 'number_trail'`, 2 to 10 players), reusing the
existing QR rooms: create, join by QR token or code, ready, host controls, leave, remove, cancel, reopen. Cross-city
online racing stays off (`mode` is checked to be `nearby`): equal courses in different cities can't be shown yet.
Nothing is deployed, and no screen reaches it yet.

| Piece | Where |
| --- | --- |
| Lifecycle, host actions, receipts, finish order, results, events, RLS | `supabase/migrations/20270107110000_number_trail_game.sql` (enum value), `20270107120000_number_trail.sql` |
| Judging a walk, course, phases, finish-order model | `supabase/functions/tournament/numberMatch.ts` |
| Edge actions (prepare, walk, progress, finish, state) | `supabase/functions/tournament/numberService.ts`, wired in `tournament/index.ts` |
| API types, error codes | `supabase/functions/tournament/numberContract.ts` |
| Phone: typed calls, sync, screen states, copy | `src/services/numberRaceService.ts`, `src/features/numberTrail/raceSync.ts`, `raceView.ts`, `raceCopy.ts` |

N1 changed only additively: `planNumberRoutes` takes a deadline (`timeout`, never a partial set), `numberStartNode`
exposes the start junction for cache keys, and `pathCoverage` measures the connector with the digits' own GPS rules.

## Lifecycle

`waiting -> preparing_routes -> ready -> countdown -> active <-> verifying -> completed`, and any live state to
`cancelled`. `ready -> preparing_routes` draws a new number; `ready -> waiting` follows a settings change;
`preparing_routes -> waiting` records why there's no number. A trigger enforces the table on every update by every
role, and freezes the number, times and course from the countdown on (`match_locked`, `assignment_locked`). Results are
insert-only (`result_locked`).

- **Prepare** (host, edge function): loads the real network (PAWS area, else OpenStreetMap, as in N1), finds the start
  junction, and looks up `number_trail_plan_cache` by network fingerprint, start junction, minutes and algorithm. On a
  miss it plans with a 1.5 s deadline; a timeout returns `preparation_timeout`, recoverable and never cached. The number
  is drawn uniformly from feasible numbers (filtered by difficulty; "new number" excludes the last one), checked again
  by `validateNumberPlan` against the current network, and stored with a preparation token so an abandoned run can't
  overwrite a newer one. No feasible number means `no_number_routes` and the match goes back to waiting; nothing is
  ever substituted. The host's point is used for the search only; the race starts at the public junction.
- **Start** (host, SQL): everyone present and ready gets an assignment with the same course digest. The database clock
  sets `countdown_at`, `starts_at = countdown_at + countdown` (5 to 120 s) and `ends_at = starts_at + 2 x minutes + 15`.
- **Active**: the first race write or state read after `starts_at` moves the match on (`number_tick`).
- **Ends**: at the first verified finish (winner), or at `ends_at` with nobody (`no_finisher`). Results become final
  when every finish received before the end has been settled.

## Judging a walk (`number-match-v1`)

The server judges only stored points against the stored course, from the database start time.

1. A walk counts from the first fix (accuracy 30 m or better) within 50 m of the start junction after the start.
   Waiting at digit one gains nothing.
2. Digits are judged by N1's engine: 90% per digit, 75% per segment, every corner, digit one before digit two, no
   credit across gaps, pauses or impossible speed, old fixes ignored.
3. Between the digits: no jump, unwitnessed distance at most max(60 m, 30% of the connector), and for connectors of
   60 m or more at least half of the planned connector followed. The connector never earns digit coverage.
4. Reasons, most important first: `not_at_start`, `digit_one_incomplete`, `connector_invalid`,
   `digit_two_incomplete`, `gps_review` (jump or gaps), `too_few_points`; plus `replayed_walk` from the database.

Progress phases (`DIGIT_1_PENDING` to `INVALID_COMPLETION`) come from N1's progress plus the connector check, with
the latest finish attempt on top. Progress is re-checked at most every 5 s per player, from every stored point.

## Who wins

1. A finish request takes a receipt number from one sequence, under the match row lock, before the walk is checked.
   Receipt time is the database clock at that moment. It's the order the server received finishes, not the instant
   anyone physically finished; a slow connection can cost a place.
2. The walk is judged on points received by that receipt.
3. Verified finishes are placed in receipt order, and only when every earlier receipt has been settled, so a slow
   check never lets a later finish overtake. A player is placed once.
4. The first placed finish wins and completes the match. Receipts are strictly ordered, so there are no ties;
   finishes within 2 s of the winner's receipt are reported as a photo finish.
5. A check that never reports back can be run again after 60 s (by the retry or anyone's state read), and is given up
   after 10 minutes (`verification_expired`; the player may hand in again).
6. Same request key, same attempt: retries return what was decided. One pending attempt per player; 5 s between
   attempts; at most 20 per race.
7. An identical verified track from another match is refused as `replayed_walk`.

Non-finishers rank after finishers by digits done, then coverage; equal walks share a place.

## Realtime

Every change gets the match's next sequence number, a row in `number_trail_events`, and a broadcast (event `number`)
on the room's private channel `room:<roomId>`: match id, sequence, kind, user id, small payload. Never coordinates.
Only room members can listen; nobody but the server can broadcast (RLS on `realtime.messages`). Kinds: PLAYER_JOINED,
PLAYER_LEFT, PLAYER_READY, SETTINGS_CHANGED, ROUTE_PREPARING, ROUTE_READY, ROUTE_FAILED, COUNTDOWN_STARTED,
MATCH_STARTED, DIGIT_1_COMPLETED, DIGIT_2_COMPLETED, FINISH_VERIFYING, FINISH_REJECTED, PLAYER_FINISHED,
MATCH_COMPLETED, RESULTS_FINAL, MATCH_CANCELLED.

Broadcasts are hints. Phones reload `number_state` (canonical, with events after their last sequence), ignore
repeats and stale replies, reload from the last seen event on a gap, announce a winner once per match from the
reloaded state, and compute the countdown from the server clock (offset from the fastest round trip).

## API

| Call | How | Who |
| --- | --- | --- |
| createNumberRace | rpc `create_room('number_trail', ...)`, `number_create_match` | host |
| joinNumberRace, setNumberReady, leaveNumberRace | rpc `join_room`, `set_room_ready`, `leave_room` | player |
| setNumberSettings | rpc `number_set_settings` (15/25/40 min, difficulty, countdown) | host |
| prepareNumberRace | edge `number_prepare { matchId, latitude, longitude }` | host |
| startNumberRace, cancelNumberRace | rpc `number_start`, `number_cancel` | host |
| startNumberWalk | edge `number_walk { matchId }` | racer |
| submitNumberProgress | edge `number_progress { matchId, points }` | racer |
| submitNumberFinish | edge `number_finish { matchId, requestKey, points? }` | racer |
| getNumberRaceState | edge `number_state { matchId, afterSeq }` | member |
| playNumberRaceAgain | rpc `reopen_room`, `number_create_match` | host |

Every user id comes from the verified JWT. Service-role functions take it from the edge function and are revoked from
players. Error codes are listed in `numberContract.ts`, with player-facing lines in `raceCopy.ts`.

## Privacy

Raw GPS stays in `gps_points` (owner-only). Others see a phase, digit coverage and placement, never coordinates. The
course is public street geometry, shown to the room's members. Cancelled races delete their points; finished races'
points go after 30 days (`purge_number_trail`, to schedule with pg_cron).

## Tests (Phase N2)

- `supabase/tests/number_trail.sql` (real PostgreSQL + PostGIS): creation, duplicates, host-only actions, membership,
  capacity, transitions, server start time, number assignment, leading zeros, locks after start, progress ownership,
  finish idempotency, first valid finish wins, invalid first doesn't, receipt order under out-of-order checks, lost
  checks, retries after success, result immutability, one winner, time limit, leaving, cancelling, play again, walks,
  points, events and broadcasts, catch-up, private channel, no coordinates, RLS, plan cache.
- `supabase/tests/local/number_concurrency.sh` (parallel sessions): double start, simultaneous ticks, raced retry,
  seven simultaneous finishes, parallel out-of-order settles, rollback, mixed writes.
- `src/__tests__/numberRaceDb.test.ts` (the edge function's service code on the local database, real OpenStreetMap
  Sellwood when `PAWS_OSM_DIR` is set): timeout, prepare and cache, reconnects, start, seven walks, lost check
  recovered, one winner by receipt, identical final state for everyone, no routes, routing down.
- `numberMatch.test.ts`, `numberRaceSync.test.ts`, `numberRaceView.test.ts`: walk judgement, phases, finish policy,
  lifecycle parity with the SQL, prepare rules, sync, countdown, screen states and copy.

## Runtime (2026-11-06, Node 20, the prepare path as the edge function runs it)

Planning from a stored network: 0.03 to 1.05 s wall, up to 1.7 s process CPU (Outer Sunset, 25 min). A cached plan:
20 ms or less. A finish check on a full 40-minute walk: 2 to 23 ms. Cached plans are up to about 750 KB.
**Deno on Supabase is not measured.** Supabase allows about 2 s of CPU per request, so the first plan of a dense area
may be close to it; later draws there come from the cache. Measure with `supabase functions serve` before deploying.

## Deploying (needs the owner)

1. `npx supabase@latest db push --project-ref ytitmpodghiehzlmrhte` (the two 2027-01-07 migrations, after the
   2026-12 ones still pending).
2. `npx supabase@latest functions deploy tournament --project-ref ytitmpodghiehzlmrhte`.
3. Schedule `purge_number_trail(30)` with pg_cron.
4. Measure Deno CPU on a dense area before turning the screens on in N3.

---

# Phase N3: the game in the app

Number Trail is now in the PAWS Tournament hub (Nearby tab) and Follow the Shape is gone from every screen and route.
Its six screens were moved, not deleted (they were uncommitted work), to `archive/follow-the-shape/`, outside the
TypeScript project. The OpenStreetMap routing they used stays, and Number Trail uses it. Historical
`shape_submissions` are untouched. No migration was needed.

## Screens and flow

| Screen | Route / component | What it does |
| --- | --- | --- |
| Hub card | `TournamentGameCard` + `TournamentArt` (`number_trail`) | 42 drawn as street strokes. Shows "Unavailable" when the backend's Number Trail functions are missing (checked live with `number_room_match`), never a fake count |
| Details | `app/game/number-trail/index.tsx` | Hero 42 that draws itself once (illustration, marked "Example"), facts, four steps, fairness and safety lines, Create / Join |
| Create | `app/game/number-trail/create.tsx` + `MeetingPointPicker` | Meeting point on Google Maps (centre pin), walking time, difficulty, name, players 2 to 10, countdown, safety promise |
| Join | existing `app/game/room/join.tsx` (QR, code, invite link) | The room screen redirects Number Trail rooms to their own screen |
| Room | `app/game/number-trail/room/[id].tsx` | Picks the screen from the server's state; owns the GPS walk from the countdown on |
| Lobby | `NtLobby` | Code and invite, the honest state of finding a number (indeterminate trail, real errors with New spot / other times), settings, players with presence and ready |
| Reveal + countdown | `NtReveal` | The server's number drawn in walking order (once per number per phone), the real course on the map turned upright by `headingDeg`, distance, time, difficulty, start flag, ready players, Start or New number; countdown from the server clock |
| Live race | `NtLive` + `CourseMap` | Course map (digit one solid gold, link dashed ink, digit two green with a white dotted centre; checked streets heavier), HUD with number, stage, connection and race time; one status banner at a time; progress checked by PAWS next to this phone's estimate; Pause, Route, Help, Exit; Hand in when both digits are done |
| Finish check | `FinishSheet` in `NtLive` | Checking, number completed (place from the server), waiting on an earlier finish, not counted yet with the exact part left, can't be verified, not sent (retry with the same key) |
| Results | `NtResults` | Winner with a one-time celebration, photo-finish note, your place, time to hand in, distance this phone recorded, your course map (only you see it), everyone ranked by the server, Play again (host), Share (text only), Back |

## GPS and sync

- `useNumberWalk`: the GPS walk.
  - Real GPS fixes, screened as in every PAWS walk, saved on the phone per match so a restart loses nothing.
  - Points go out in batches (one request at a time); points the server already confirmed are never sent again.
  - Pausing or leaving the app starts a new segment, so nothing is drawn or counted across the gap.
  - Hand in uses the same request key on every retry.
  - The off-route note (more than 35 m from every course street, twice) is gentle and never a failure.
  - This phone's estimate is shown as an estimate.
- `gpsStatus.ts`: GPS status from the tracker's real lifecycle. Standing still is no longer "Looking for GPS": the watch
  only reports movement, so the tracker asks the GPS directly every 15 s, and as long as those answers arrive the
  status is "Waiting for you to move". "Lost" needs 45 s with no fix at all.
- `useNumberRace`: race state and live updates.
  - The canonical state comes from `number_state`.
  - It uses the room's private channel (events and presence), a server-clock offset from the fastest round trip, and
    reloads on foreground and reconnect.
  - Events arrive once each and stale replies are ignored.
  - The winner is announced once per match per phone, remembered on the device.
- Other players appear as phases and neutral lines ("Alex handed in"); their positions are never shown.

## Deno runtime (2026-11-06)

Deno 2.9.8 on Apple silicon, the shipped modules, planning from the stored network, one fresh process per run (cold)
and repeats (warm). Supabase edge functions allow about 2 s of CPU per request.

| Area | Min | Numbers | Plan cold (ms) | Plan warm max (ms) | Cache hit (ms) | Finish check (ms) | Peak heap (MB) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SF Outer Sunset | 15 / 25 / 40 | 0 / 16 / 60 | 42 / 792 / 931 | 44 / 690 / 950 | 7 / 7 / 8 | - / 4 / 11 | 11 / 20 / 32 |
| Seoul Yeonnam | 15 / 25 / 40 | 41 / 49 / 20 | 370 / 533 / 525 | 326 / 455 / 487 | 10 | 2 / 3 / 5 | 53 / 80 / 60 |
| Seoul Gangnam | 15 / 25 / 40 | 0 / 0 / 1 | 79 / 261 / 346 | 79 / 277 / 333 | 5 to 6 | - / - / 5 | 42 / 28 / 31 |
| Irvine Woodbridge | 15 / 25 / 40 | 2 / 1 / 0 | 48 / 81 / 109 | 23 / 56 / 75 | 3 to 4 | 3 / 4 / - | 34 / 21 / 32 |
| Brooklyn Park Slope | 15 / 25 / 40 | 4 / 12 / 64 | 211 / 896 / 1060 | 191 / 904 / 1009 | 7 to 8 | 4 / 6 / 11 | 68 / 84 / 111 |
| Portland Sellwood | 15 / 25 / 40 | 5 / 36 / 86 | 368 / 757 / 931 | 356 / 654 / 871 | 4 to 6 | 3 / 4 / 3 | 47 / 68 / 82 |
| Brooklyn Prospect Park | 15 / 25 / 40 | 0 / 0 / 0 | 53 / 218 / 265 | 38 / 209 / 270 | 5 to 7 | - | 33 / 42 / 36 |

No run hit the 1.5 s planning deadline. The slowest plan (1.06 s) leaves headroom under the 2 s limit, and every later
draw at the same start comes from the cache. Whole-process CPU (Deno start-up, TypeScript, garbage collection threads)
was up to 1.9 s; how much of that Supabase counts is not verified here. `deno check` passes for the `tournament` and
`rooms` functions. Not measured: the deployed Supabase runtime itself, and Overpass fetch time (network, not CPU).

## Verification status (N3)

- **Implemented:** every screen above, the walk, sync and the Follow the Shape removal.
- **Unit tested:** `numberTrailUi.test.ts` (GPS status, glyph, removal), plus the N2 suites. Full Jest: 1,562 passed.
- **Database tested:** unchanged backend; the full local harness passes (SQL, concurrency, the race end to end).
- **Runtime tested:** Deno benchmarks and `deno check` above.
- **Simulator verified (iPhone 15 Pro, iOS 17.5):**
  - Screens checked: the hub card (Unavailable, because the backend isn't deployed), details, lobby, lobby failure,
    reveal, live (digit 1, digit 2 with weak GPS, both done), finish check and results.
  - Lobby, reveal, live and results were viewed through a temporary visual-only route with a real course planned
    from the OpenStreetMap Sellwood extract. The route was deleted afterwards.
  - Not visually checked: the countdown overlay, the create screen's map picker, and the reconnecting and stationary
    banners.
- **Not done:**
  - A real multi-phone race against a deployed backend.
  - Android (no emulator on this machine).
  - Field walks.
  - Deployment.

## 1 to 99, practice and online (phases P1 to P5, 2026-11-07)

### Numbers 1 to 99 (P1)

- `numberInput.ts` `parseTargetNumber` is the one parser, on the phone and the server. It accepts the canonical
  numbers 1 to 99 only: 1 to 9 are one digit, 10 to 99 two. It refuses, with a reason, empty input, 0, leading zeros
  ("07"), more than 99, decimals, negatives and letters. Nothing is corrected for the player.
- A single-digit course has one digit, no connector, and the phase `NUMBER_COMPLETE` when the digit is walked.
- `findNumberRoutes` finds courses for exactly the number asked, within one radius. They are ranked by walking
  distance on the graph to their first corner, never straight-line, and several alternatives are offered. When none
  exists the answer is an honest `no_number_routes`; another number is never substituted.
- **The search is not monotonic in radius.** The frame budget (9,000 frames) is spent nearest-node first, and a wider
  region gives each nearby node more frames, so a 1 km search can miss a course a 500 m search finds (seen in Park
  Slope, for 42). Practice and online both widen 500 m, 1 km, 2 km and stop at the first find. 3 km is offered only
  on request. 5 km is not offered: the stored walk areas are capped at 3 km.

### Exact length and the finish stretch (P3)

A digit's length is set by the block size, so on real streets two digits plus a shortest connector almost never land
within ±2% of a fixed target. Before this change the first real-street run found almost nothing in the band.

Online courses (`exact: true`) are therefore digits plus connector, up to 40% short of the target, plus a **finish
stretch**. That is the shortest real walk from the last digit's end to a finish corner, chosen so the course is within
0.8% of the target. The stretch:
- never uses a stroke or the connector;
- never runs alongside a stroke (the connector's 45 m rule);
- prefers corners leading away from the number;
- is validated like everything else (`finish_repeats`, continuity, lengths);
- is drawn on the map as a solid ink line to a checkered flag;
- counts in the PostGIS official length (`number_course_official` returns `finishM`);
- is judged like the connector. The walk must reach the finish corner along it, or the hand-in is refused as
  `finish_incomplete` (recoverable) or `finish_invalid`. The phase while on it is `FINISH_IN_PROGRESS`.

Practice and nearby races never get a finish stretch. A uniform synthetic grid (every block exactly 90 m) can have no
corner at the right distance, and that is an honest no.

**Start at digit one.** Practice and online courses start at digit one's first corner (`startAtFirstDigit`). The walk
there is drawn but not timed, and online check-in is against that corner.

### Practice (P2)

`app/game/number-trail/practice.tsx` runs these steps:
1. Number: keypad and glyph preview.
2. Where to look: near me, or a spot on the map.
3. Search: honest stages per radius ("Found", "None", "Not checked").
4. Choose a route: map preview, PAWS lengths, walk to the start, Google Maps directions.
5. Walk: `NtPracticeLive`, using the same GPS queue and saving as a race via `useNumberWalk`'s endpoint-agnostic
   `WalkApi`.
6. Result: from the server's check only, naming the digit or stretch still to walk.

Practice is never ranked and never touches races or standings. A walk in progress survives leaving the screen.

### Online cross-city (P3, P4)

Lifecycle: `waiting` → host "Find routes" → `course_search`. Each player searches their own streets; the server
stores candidates with PostGIS lengths. Then host "Match routes" → `course_matching` → `ready` (matched or friendly)
or back to `course_search` (not fair). Each player checks in at their own start (accuracy ≤ 30 m, within 60 m;
checked, not stored), then one server countdown starts everyone.

`NumberCourseEquivalenceValidator` (`numberEquivalence.ts`) checks, at 2% of the target:
- the same number;
- every course within ±2% of the target, and a spread of at most 2%;
- each digit, the connector and the finish stretch within 6 percentage points of the target, so digit-by-digit
  proportions match;
- repeated traversal within 5%;
- equal strokes per digit, and turns within 2;
- readability at least 80, and within 15.

Street crossings, elevation and surface are not in the data, so they are listed as unknown, never assumed equal.
The database re-checks distance from PostGIS and refuses a ranked set outside tolerance. A friendly (unranked) race
needs only the length. Nobody sees another player's route or position: only names, search status, official lengths
(shown to 10 m) and at-start flags.

Known limits:
- The host chooses the number; there is no random common number online.
- Ranked or friendly is fixed when the race is created. To change it, cancel and create again.

### Cross-city fairness on real streets (N4B)

`numberCrossCity.test.ts` runs on OpenStreetMap extracts (gated on `PAWS_OSM_DIR`). It covers numbers 1, 2, 3, 9, 10,
12, 27, 42, 63, 80, 88, 99 at 1.0, 1.5 and 2.5 km, from a 1 km radius. Every candidate is checked against:
- the raw OSM ways;
- the validator;
- the ±0.8% target.

Every matched set is re-checked and walked to an eligible finish.

| Pair | Cases | Courses on both sides | Matched | Refused |
| --- | --- | --- | --- | --- |
| Portland Sellwood (grid) vs Seoul Yeonnam (irregular) | 36 | 7 | 2 (10 and 12 at 1 km, spread 1 m and 5 m) | 5, structure |
| Portland Sellwood (grid) vs San Francisco Sunset (grid) | 36 | 13 | 0 | 12 structure, 1 readability |

Each area has its own block size, so the same digit is a different length in each. At equal total length, one course
is then mostly digit and the other mostly finish stretch. The matcher refuses that, as the spec requires ("digit by
digit length proportions"). Choosing more alternatives does not help: every Sellwood "3" is about 936 m and every
Sunset "3" about 1,150 to 1,250 m.

**Expect ranked cross-city races to be refused often.** The UI says so plainly ("Not fair yet") and offers another
spot. Friendly races match on length alone. Loosening the 6-point rule would be a product decision, not a fix.

### Performance (Deno 2.9.8, Apple silicon)

| Measure | Result |
| --- | --- |
| `findNumberRoutes` (4 areas × 6 requests × 3 radii, including exact) | 95 to 707 ms, median 252 ms |
| Network parse | 27 to 163 ms |
| Course build | ≤ 4 ms |
| `matchCourses` | 0.3 ms |

Everything is inside the 1.5 s planning deadline. The deployed runtime is not measured.

### Field checklist (NOT YET DONE: nothing below has been verified)

1. Two phones, two cities (or two neighbourhoods), one online race:
   - Both search from a public spot and the routes match.
   - Both check in at their own start and the countdown starts both.
   - Each walks their own course and the finish stretch is required.
   - The first verified hand-in wins, and the results show each course length.
2. Practice on a real street: the search widens honestly, directions open, and a full walk is complete. A walk that
   stops one stroke early names that digit.
3. GPS:
   - weak signal, tunnels and tall buildings;
   - standing still at the start;
   - walking on the other side of the street;
   - phone locked or app backgrounded (it pauses, nothing is filled in).
4. Network:
   - airplane mode mid-walk (points are saved on the phone and sent later);
   - a hand-in during a dropout (the same request key on retry, never a second attempt).
5. Real streets: check each course's crossings and pedestrian safety on site. Synthetic graphs prove nothing about
   safety.
6. Small and large iPhones, and Android (no emulator was available here).

### Verification status (P1 to P5)

- **Implemented:**
  - parser, finder, finish stretch, single digits;
  - practice and online backend (migration `20270114120000`);
  - edge actions, client service;
  - practice, online create, online lobby, practice walk, results.
- **Unit tested:**
  - `numberFinder` (31);
  - `numberEquivalence` (Tests A to E plus the finish stretch);
  - `numberPlayUi` (15);
  - `numberMatch`, `numberRaceView`, `numberTrailUi`.
- **Database tested, local PostgreSQL 17 + PostGIS:**
  - `number_trail_online.sql`: official length including the finish stretch, practice, Tests A, B and D, check-in,
    synchronized start, privacy, RLS, unranked;
  - `numberPlayDb.test.ts`: find, practice walk with a lost-reply retry, a two-city race matched, own-start check-in,
    finish stretch enforced, one winner;
  - the full harness from a fresh cluster.
- **Runtime tested:** Deno benchmarks above, and `deno check` of the `tournament` function.
- **Simulator verified (iPhone 15 Pro, iOS 17.5):**
  - Viewed through a temporary route with real Sellwood courses (deleted afterwards): online live with a finish
    stretch, single-digit practice walk, route chooser, both result states, and the online lobby setup, search,
    not-fair and matched states.
  - The real practice route: keypad (leading-zero refusal, one and two digits), "Where to look", the map picker, and
    an honest "Search stopped" from the real backend, which has no Number Trail.
  - Checked at default and XXXL text size.
  - Not checked: dark mode (the app is light only), reduced motion on device (code paths use `useReducedMotion`),
    smaller and larger iPhones, Android.
- **Not done:** field tests, a real multi-phone race, deployment.

## Location first: 0 to 99 discovery, route gallery, fair racing (phases L1 to L5, 2026-11-07)

Share location, then see which numbers your streets can draw. Pure engine: `supabase/functions/tournament/numberDiscovery.ts`
(`discoverNumbers`, `listNumberRoutes`, `routeIdOf`, `sameCourse`), served by `numberDiscoveryService.ts`
(`number_discover`, `number_routes`). Migration `20270121120000_number_trail_discovery.sql`.

- States per number: AVAILABLE, NOT_FOUND_IN_CHECKED_AREA, NOT_YET_CHECKED, CHECKING, CHECK_FAILED. Radii 500 m, 1 km,
  2 km, 3 km. A larger radius keeps every earlier find; `checkedRadiusM` only grows over rings that were fully searched.
- Routes: every distinct placement, deduplicated by `routeIdOf` (number plus sorted stroke edges) and by 80 percent
  shared stroke edges, 12 per page in a stable order.
- Discovery cache key is public network data only (version, network fingerprint, start node, radius). No position is stored.
- Online: each player's numbers are checked on their own streets (no position shared); the common numbers come from SQL;
  the host picks one (server checked: `number_not_common`); a shared course is recorded as `shared-course-v1`.
  Different courses still go through the equivalence check. Results stay server authoritative.

Measured on real OpenStreetMap: Yeonnam 1 km, 72 numbers available; number 23 has four distinct routes
(1,098 to 1,181 m). Sellwood 98, 99, 100 at 500 m, 1 km, 2 km (monotone). Simulator (local dev server, simulated
location near Union Square, San Francisco): 500 m gave 97 of 100, 1 km gave 100 of 100; galleries for 0, 1, 8 and 93
opened. Multiplayer was verified by the database end to end tests, not on two simulators.

Development server (never deployed): `scripts/number-trail-dev-server.ts` runs the real service code against the
local test cluster. The app uses it only in a development build with `EXPO_PUBLIC_NUMBER_TRAIL_DEV_URL` set in the
gitignored `.env.local`. It reads the caller id from the session token without verifying it, so it listens on
127.0.0.1 only.
