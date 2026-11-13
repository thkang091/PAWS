#!/usr/bin/env bash
# End to end on real OpenStreetMap data, on the throwaway cluster only. Needs PAWS_OSM_DIR with Overpass extracts and
# an areas.txt (`name lat lng`), as used by src/__tests__/osmRealValidation.test.ts. For each area listed in
# PAWS_OSM_E2E_AREAS: the extract is converted (osm.ts), stored with store_osm_walk_area, served back by
# osm_walk_graph_near, routed on by the TypeScript generator and checked, recorded through
# record_shape_route_request, picked, and read back with assignment_route. Run from the repo root.
set -euo pipefail
PSQL=("${PSQL_BIN:-psql}" -X -q -t -A -v ON_ERROR_STOP=1)
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
fail() { echo "   FAIL  osm e2e ($1): $2"; exit 1; }

for name in ${PAWS_OSM_E2E_AREAS:-seoul_yeonnam portland_sellwood}; do
  read -r _ lat lng < <(grep "^$name " "$PAWS_OSM_DIR/areas.txt")
  PAWS_OSM_FILE="$PAWS_OSM_DIR/$name.json" PAWS_OSM_LAT=$lat PAWS_OSM_LNG=$lng PAWS_OSM_EXPORT="$WORK/edges.json" \
    npx jest src/__tests__/osmDbRoundTrip.test.ts --silent >"$WORK/jest.log" 2>&1 || { tail -20 "$WORK/jest.log"; fail "$name" "convert"; }
  user=$("${PSQL[@]}" -c "insert into auth.users (id, email) values (gen_random_uuid(), 'osm-e2e-$name@test.paws') returning id" | head -1)
  "${PSQL[@]}" -c "select public.store_osm_walk_area($lat, $lng, 900, 'osm-walk-v1', pg_read_file('$WORK/edges.json')::jsonb, '{}'::jsonb)" >/dev/null
  "${PSQL[@]}" -c "select public.osm_walk_graph_near($lat, $lng, 700, 'osm-walk-v1')" > "$WORK/graph.json"
  PAWS_OSM_GRAPH="$WORK/graph.json" PAWS_OSM_OUT="$WORK/candidates.json" PAWS_OSM_LAT=$lat PAWS_OSM_LNG=$lng \
    npx jest src/__tests__/osmDbRoundTrip.test.ts --silent >"$WORK/jest.log" 2>&1 || { tail -30 "$WORK/jest.log"; fail "$name" "generator on the stored network"; }
  result=$("${PSQL[@]}" <<SQL | tail -1
do \$\$
declare
  r jsonb := public.record_shape_route_request('$user', null, 'square', 15, null, 'ok', 'shape-route-v2+osm-walk-v1', pg_read_file('$WORK/candidates.json')::jsonb);
  c uuid := (r -> 'candidateIds' ->> 0)::uuid;
  a uuid;
  route jsonb;
  legs_m float8;
begin
  perform set_config('request.jwt.claim.sub', '$user', true);
  a := public.assign_shape_route(c);
  route := public.assignment_route(a);
  select sum((l ->> 'lengthM')::float8) into legs_m from jsonb_array_elements(route -> 'legs') l;
  if route ->> 'source' <> 'osm' or jsonb_array_length(route -> 'legs') <> (select cardinality(edge_keys) from public.shape_route_candidates where id = c) then
    raise exception 'route read back wrong';
  end if;
  if abs(legs_m - (select length_m from public.shape_route_candidates where id = c)) > 1 then raise exception 'length changed in storage'; end if;
  perform set_config('paws.e2e', jsonb_array_length(r -> 'candidateIds') || ' loops, ' || jsonb_array_length(route -> 'legs') || ' legs, ' || round(legs_m) || ' m', false);
end;
\$\$;
select current_setting('paws.e2e');
SQL
) || fail "$name" "database round trip"
  echo "   pass  osm e2e $name: real OpenStreetMap network stored, served back, routed and picked ($result)"
done
