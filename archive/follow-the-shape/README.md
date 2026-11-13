# Follow the Shape (retired screens)

Number Trail replaced Follow the Shape in Phase N3 (2026-11-06). These were its screens, moved here out of `app/` so no
route reaches them. They are kept, not deleted, because they were uncommitted work. They are outside the TypeScript
project (`tsconfig.json` includes only `app`, `src` and root files) and are not built into the app.

Still in use and untouched: the OpenStreetMap network (`supabase/functions/tournament/osm.ts`), route generation and
scoring (`routes.ts`, `routeScore.ts`), their tables and the `routes` / `submit` edge actions, and historical
`shape_submissions`. Delete this folder once nobody needs the old screens.
