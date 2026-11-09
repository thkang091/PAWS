# Same place room SQL verification

Executed on 2026-11-06 using PostgreSQL 18.6 in `@electric-sql/pglite@0.5.15`.
The current migration loaded unchanged and all **53 assertions passed**.
The machine-readable result, exact file hashes, and execution time are in
`sql-pglite-verification.json` beside this report.

## Coverage

- Auth is required. A player must own the supplied dog; the server supplies its name.
- RLS and RPC membership checks deny outsiders; direct client table writes are denied.
- Two distinct seats are enforced by the database. Rejoining does not consume another seat.
- Create retries, active-room resumption, and delayed retries of a resumed request key preserve the original room.
- Only the current player's Ready state changes. Both players must be present and ready before selection.
- Only the host can select or start; an unsupported game and starting without a selection are rejected.
- Start is idempotent and revisions advance for actual transitions.
- Reset, unready, guest departure, host closure, stale presence, and room expiry clear or close the appropriate state.
- All synthetic users, profiles, dogs, rooms, players, and create-request aliases were absent after transaction rollback.

## Execution

The QA dependency, bootstrap, and runner are isolated under the ignored
`.expo/duel-db-qa` directory. No app dependency was added for PGlite.

```powershell
npm install --prefix .expo/duel-db-qa --save-exact --no-audit --no-fund @electric-sql/pglite@0.5.15
node .expo/duel-db-qa/run-duel-sql.cjs
```

The bootstrap provides minimal synthetic `auth.users`, `profiles`, and `dogs`
tables, `anon`/`authenticated` roles, and `auth.uid()` backed by the per-test
`request.jwt.claim.sub` setting. Tests execute as the authenticated role where
appropriate. No production data or credentials were used.

## Limits

PGlite runs actual PostgreSQL in a single connection. This validates SQL behavior
and constraints but does not simulate simultaneous sessions competing for locks.
The unique-seat and repeat-request checks do not constitute a concurrency stress test.

Hosted PostgREST/JWT processing, Supabase Realtime delivery, and two-device camera
or network behavior were not exercised. No `supabase_realtime` publication exists
in this isolated database; the migration's existing conditional skipped it.
No migration statements were removed or replaced for this test. No hosted
database changes, deployment, commit, push, or merge were performed.
