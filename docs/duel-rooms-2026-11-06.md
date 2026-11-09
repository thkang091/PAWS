# Duel / Same place room implementation — 2026-11-06

## Result and activation status

The current PAWS app now uses a shared, database-backed Same place room flow instead of local preview participants. Create/Join, room-code QR, two seats, Ready, host selection/start, leave, restore, and reconnection are implemented in local source. The local PostgreSQL-backed integration and rendered app checks pass.

**The migration is now applied to the actual PAWS project `ytitmpodghiehzlmrhte`.** After the user's explicit DB approval and Supabase reconnection, the reviewed migration was applied successfully as hosted version `20261107030212` / `duel_same_place_rooms`. No existing Duel tables or functions conflicted with it. Create/Join and Ready/select/start passed with real authenticated clients, and actual Realtime updates were verified.

The authorized DB migration was applied. No commit, push, merge, or application deployment was performed. The iPhone development server on port 18942 was restarted with its HTTPS tunnel after it was found stopped, and the updated iOS bundle returned HTTP 200. Its temporary tunnel dependency is isolated in ignored `.expo/iphone-tools`; application dependencies were not changed for this restart. Remote and matchmaking remain unimplemented.

### Hosted activation

The user completed the Supabase reconnection for the correct organization. Hosted schema and migration history were inspected before applying only the reviewed Duel migration. Three tables have RLS, direct client writes are denied, all nine public RPCs have the intended execute grants, and `duel_rooms` is published for Realtime UPDATE events.

The first hosted test exposed a subscription initialization race: the default channel acknowledgment can arrive before PostgreSQL Changes is ready. `useDuelRoom.ts` now sets `postgres_changes_options: { wait: true, timeout: 15000 }` so the subscribed callback follows database subscription readiness. The corrected hosted run passed **37 assertions and received 17 real Realtime UPDATE events**. Related controller/API tests passed **43/43**, and TypeScript passed.

The first and final runs used six fresh anonymous QA users through the normal auth/onboarding APIs. All sessions were signed out and only the recorded QA user IDs were removed, with cascading removal of their profiles, dogs, rooms, players, and create-request records. Existing user records were not modified. Evidence is in `qa/duel-rooms-2026-11-06/hosted-client-verification.json` and `hosted-migration-verification.json`.

Duel-specific advisor findings were reviewed: anonymous sign-ins are intentional in the current app and still require room membership; unauthenticated `anon` cannot execute room RPCs or read these tables. The private idempotency table intentionally has no client policies or grants. Newly created supporting indexes were retained. References: [anonymous sign-in policies](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins), [policy-free RLS tables](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [new/unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). Existing non-Duel advisories remain outside this change.

The reviewed migration SHA-256 remains `bd955cdcfe15035e2893a74d8349f17c24d0a933c6a223ed14689c19d5bfb7f8`.

## UI changes

- The entry heading remains **Play together**. A created/joined room displays **Your room / Invite a friend. Play together.** Both Ready changes it to **Game lobby / You’re both ready. Pick a game.**
- The room's initial QR size now derives from the stable outer frame and its actual footer height, not the entry screen's earlier ScrollView height. This removes the temporary alternate layout immediately after Create.
- Participant positions stay fixed across entry, invitation, and selection. A hidden Join header no longer erases the last measured participant height.
- Create/Join remain pending until the server confirms membership. Duplicate taps cannot create duplicate operations. Errors remain in the relevant form or room.
- Both Ready opens game selection automatically. Only the host can choose/start; both screens enter the existing game route after the server starts the room.
- Host departure closes the room for both players; guest departure frees only the guest seat. A remotely closed room also dismisses an open Leave sheet. Returning from play resets the round, with an explicit retry if that reset fails.
- The room QR contains the actual six-character server code. The QR scanner validates raw codes, guards duplicate scans, and provides camera permission, retry, and typed-code paths.

## Implementation

The reference was the local `C:/Users/Minjae/Desktop/drinking-game-app`: authenticated room RPCs, member access, code/QR invitations, room updates, and server-confirmed leave. PAWS adds a strict two-player limit and server-authoritative Ready/select/start rules.

| File | Change |
| --- | --- |
| `src/features/game/flow/DuelPlayroom.tsx` | Room heading, first-frame layout, real room hook, shared state transitions, leave/reset recovery |
| `src/features/game/flow/DuelLobbyPanels.tsx` | Real QR, scanner entry, pending/host-only controls |
| `src/features/game/flow/DuelQrScanner.tsx` | Camera permission and strict QR scanning flow |
| `src/features/game/flow/duelRoomApi.ts` | Typed RPC boundary, snapshot validation, error copy, presentation adapter |
| `src/features/game/flow/useDuelRoom.ts` | Auth-scoped controller, serialized mutations, revision/response guards, persisted room and pending request recovery, Realtime/poll/heartbeat |
| `src/features/game/flow/GameFlowUI.tsx` | Duel-specific information copy describing live rooms |
| `package.json`, `package-lock.json` | Pinned `react-native-qrcode-svg@6.3.21`; existing SVG/camera native modules reused |
| `supabase/migrations/20261106223109_duel_same_place_rooms.sql` | Room/player tables, RLS, checked RPCs, idempotency, two-seat constraints, presence and expiry |
| `supabase/tests/duel_same_place_rooms.sql` | SQL authorization and state-transition checks |
| `src/__tests__/duelRoomController.test.ts`, `src/__tests__/duelRoomApi.test.ts` | Request races, restore, reconnect, failure and RPC-boundary tests |

The controller refetches on room updates, polls every 3 seconds, and heartbeats every 20 seconds while active. Presence expires after 90 seconds. Network recovery clears the player's Ready status before restoring a selection state. Pending Create/Join requests survive a reload even when the server succeeded before the client received its response.

## Verification

- Entire existing Jest run: **81 suites / 1,206 tests passed**. The subsequently added API suite passed **29 additional tests** (1,235 total across these runs).
- TypeScript and `git diff --check` passed.
- Unmodified migration executed on PostgreSQL 18.6 through isolated PGlite: **53 SQL assertions passed**; all SQL test fixtures rolled back.
- Two independent Supabase clients against the local SQL-backed HTTP adapter: **28 contract assertions passed**.
- Actual rendered app in two isolated browser contexts: Create → code Join → both Ready → host selection → both game routes → return/reset → guest leave/rejoin → host closure passed.
- Wrong room code remained on the Join form with a useful error. Reload restored the same room. An offline/recovery cycle cleared Ready correctly.
- Create transition frame capture at 390 × 844 found **one room QR layout**: y=497.90625, height=176, no temporary compact layout. Participant header stayed at y=60, height=345.90625 before and after creation.
- No vertical overflow in tested entry/room layouts at 390 × 844 or room layout at 360 × 720.
- Independently decoded the rendered screenshot QR as its exact visible code, `4THD62`.
- Existing iPhone server generated the updated **iOS bundle successfully (HTTP 200)**.
- Game main, tab layout, mode artwork, bottom navigation, and shared design tokens match all **six original SHA-256 hashes**.

### Screenshots and evidence

- [Created room](qa/duel-rooms-2026-11-06/02-created.png)
- [Joined host room](qa/duel-rooms-2026-11-06/04-connected-host.png)
- [Join form](qa/duel-rooms-2026-11-06/03-join.png)
- [Both Ready / host selection](qa/duel-rooms-2026-11-06/07-selected-host.png)
- [Guest selection view](qa/duel-rooms-2026-11-06/08-selected-guest.png)
- [Leave confirmation](qa/duel-rooms-2026-11-06/09-leave-sheet.png)
- [Small viewport](qa/duel-rooms-2026-11-06/11-created-360.png)
- [Invalid code](qa/duel-rooms-2026-11-06/12-invalid-code.png)
- [Reconnect](qa/duel-rooms-2026-11-06/13-reconnecting.png)
- [Unchanged Game main](qa/duel-rooms-2026-11-06/14-game-main.png)
- Machine-readable results: `qa/duel-rooms-2026-11-06/` (`ui-*-report.json`, `http-adapter-contract.json`, `sql-pglite-verification.json`, `rendered-qr-decode.json`, `game-main-unchanged.json`, `ios-bundle.json`).

### Verification limits

Screenshots show the real app with synthetic QA users and the actual migration running on local PostgreSQL. Authentication/profile fixtures and WebSocket subscription acknowledgments in those screenshot checks came from the isolated localhost adapter; room state was produced by SQL, not mocked React state. Subsequent hosted tests separately verified actual Auth/PostgREST/RPC and Realtime delivery. Concurrent database lock stress and native two-phone camera scanning remain unverified. The existing game camera/scoring experience was not expanded into a synchronized multiplayer game engine.

Cua Driver could not launch the browser in background mode or prepare the existing personal browser profile without its separate authorization. Rendering checks used an isolated headless Chrome profile; the personal Chrome session was not altered. The temporary web-only maps shim and Metro config were removed after QA.
