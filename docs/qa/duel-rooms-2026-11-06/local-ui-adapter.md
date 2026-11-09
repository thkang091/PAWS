# Local SQL-backed UI QA adapter

The temporary server binds only to `127.0.0.1:18945`. It loads the unchanged
Duel migration into isolated PGlite PostgreSQL. Every Duel RPC runs the actual
SQL function in a serialized transaction under `SET LOCAL ROLE authenticated`,
with `auth.uid()` set from the local session's user. Duel state is not simulated.

The adapter provides synthetic anonymous auth, completed profiles, owned dogs,
and harmless empty bootstrap collections so the existing app can reach Duel.
Auth tokens are signed with an ephemeral local key and expire after one day.
No hosted services or production credentials are involved. Restarting the adapter
clears its synthetic users and rooms, so browser sessions must then be reset.

For this isolated Metro instance only:

```powershell
$env:EXPO_NO_DOTENV = '1'
$env:EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:18945'
$env:EXPO_PUBLIC_SUPABASE_ANON_KEY = 'local-duel-qa-only-not-a-production-key'
```

The installed Supabase client's Phoenix join and heartbeat messages receive
authenticated acknowledgements, allowing the unchanged app hook to remain
connected. Subscription room membership is checked by RLS. No database change
events are emitted; the app's existing polling fetches changes through actual
SQL. This does not validate hosted Supabase Realtime delivery.

`http-adapter-contract.json` records 28 passing assertions through independent
Supabase clients and the actual `DuelRoomApi.ts`. They cover auth, refresh, owned
dog bootstrap, create retry, wrong-dog/outsider rejection, RLS, two seats,
subscription and heartbeat stability, both Ready, host-only selection, start,
reset, leave, and local-origin CORS. No request bodies or auth tokens are logged.

Local implementation and command:

```powershell
node .expo/duel-db-qa/serve-ui-qa.cjs
node .expo/duel-db-qa/test-ui-adapter.cjs
```

The server remains running for UI QA until the parent task requests cleanup.
It is a temporary verification fixture, not a replacement backend or deployable
authentication service. App files and root dependencies were not changed for it.
