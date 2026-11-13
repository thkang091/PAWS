#!/usr/bin/env bash
# End to end for walking routes, on the throwaway cluster only: a published test grid in PostGIS, the graph exported
# by walk_graph_near, the TypeScript generator run on it (Jest), and its candidates stored back through the
# database's own eligibility check. Expects PGHOST/PGPORT/PGUSER/PGDATABASE and PSQL_BIN; run from the repo root.
set -euo pipefail
PSQL=("${PSQL_BIN:-psql}" -X -q -t -A -v ON_ERROR_STOP=1)
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
fail() { echo "   FAIL  routes e2e: $1"; exit 1; }

user=$("${PSQL[@]}" <<'SQL' | tail -1
do $$
declare
  org uuid := gen_random_uuid();
  L constant float8 := -122.46; B constant float8 := 37.74; D constant float8 := 0.001;
  nodes jsonb := '[]'::jsonb; edges jsonb := '[]'::jsonb; region uuid; e record;
begin
  insert into auth.users (id, email) values (org, 'e2e-org@test.paws');
  insert into public.tournament_organizers (user_id) values (org);
  perform set_config('request.jwt.claim.sub', org::text, true);
  for c in 0..6 loop for r in 0..6 loop
    nodes := nodes || jsonb_build_object('key', c || '_' || r, 'latitude', B + r * D, 'longitude', L + c * D);
    if c < 6 then edges := edges || jsonb_build_object('startKey', c || '_' || r, 'endKey', (c + 1) || '_' || r, 'pathType', 'residential',
      'coords', jsonb_build_array(jsonb_build_array(L + c * D, B + r * D), jsonb_build_array(L + (c + 1) * D, B + r * D))); end if;
    if r < 6 then edges := edges || jsonb_build_object('startKey', c || '_' || r, 'endKey', c || '_' || (r + 1), 'pathType', 'footway',
      'coords', jsonb_build_array(jsonb_build_array(L + c * D, B + r * D), jsonb_build_array(L + c * D, B + (r + 1) * D))); end if;
  end loop; end loop;
  edges := edges || jsonb_build_object('startKey', '1_1', 'endKey', '5_5', 'name', 'Gated drive', 'access', 'private',
    'coords', jsonb_build_array(jsonb_build_array(L + D, B + D), jsonb_build_array(L + 5 * D, B + 5 * D)));
  region := (public.create_competition_region('E2E grid', B, L, 'PAWS test fixture', 'Test data, not a real street', '')).id;
  perform public.import_road_graph(region, nodes, edges);
  for e in select id, access from public.road_edges where region_id = region loop
    perform public.set_road_edge_status(e.id, case when e.access = 'private' then 'unsafe' else 'verified' end, '');
  end loop;
  perform public.publish_competition_region(region);
end;
$$;
insert into auth.users (id, email) values (gen_random_uuid(), 'e2e-walker@test.paws') returning id;
SQL
)
"${PSQL[@]}" -c "select public.walk_graph_near(37.743, -122.457, 2500)" > "$WORK/graph.json"
private=$("${PSQL[@]}" -c "select id from public.road_edges where name = 'Gated drive'")

PAWS_ROUTE_GRAPH="$WORK/graph.json" PAWS_ROUTE_OUT="$WORK/candidates.json" PAWS_ROUTE_FORBIDDEN="$private" \
  npx jest src/__tests__/shapeRoutesDb.test.ts --silent >"$WORK/jest.log" 2>&1 || { tail -30 "$WORK/jest.log"; fail "generator on the PostGIS graph"; }

stored=$("${PSQL[@]}" -c "select jsonb_array_length(public.record_shape_route_request('$user', null, 'square', 15, null, 'ok', 'shape-route-v1', '$(cat "$WORK/candidates.json")'::jsonb) -> 'candidateIds')")
expected=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$WORK/candidates.json','utf8')).length)")
[[ "$stored" == "$expected" && "$stored" -ge 1 ]] || fail "stored $stored of $expected candidates"
echo "   pass  routes e2e: PostGIS graph -> generator -> $stored walkable square loops accepted by the database"
