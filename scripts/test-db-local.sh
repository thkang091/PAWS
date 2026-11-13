#!/usr/bin/env bash
# Runs every PAWS migration and SQL test against a throwaway local PostgreSQL + PostGIS cluster.
#
#   scripts/test-db-local.sh            fresh cluster, migrations, SQL tests, concurrency tests, then stop
#   scripts/test-db-local.sh --keep     leave the cluster running afterwards (socket path is printed)
#
# The cluster lives in $PAWS_TEST_PGDATA (default: a temp folder) and listens only on a unix socket in a short /tmp
# folder (no TCP port). It trusts local connections and is deleted on the next run. It never touches a Supabase
# project or any other Postgres on this machine. Needs Homebrew postgresql@17 and postgis.
set -euo pipefail
# Postgres refuses to start on macOS without a valid locale in the environment.
export LC_ALL="${LC_ALL:-en_US.UTF-8}" LANG="${LANG:-en_US.UTF-8}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PAWS_PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
DATA="${PAWS_TEST_PGDATA:-${TMPDIR:-/tmp}/paws-pgtest}"
PORT=54329
KEEP=0
[[ "${1:-}" == "--keep" ]] && KEEP=1

# Unix socket paths are limited to 103 bytes on macOS, so the socket gets its own short folder.
SOCK="$(mktemp -d /tmp/pawspg.XXXXXX)"
export PGHOST="$SOCK" PGPORT="$PORT" PGUSER=postgres PGDATABASE=paws_test
PSQL=("$PGBIN/psql" -X -q -v ON_ERROR_STOP=1)

stop() { "$PGBIN/pg_ctl" -D "$DATA/db" -m fast stop >/dev/null 2>&1 || true; }
cleanup() { stop; rm -rf "$SOCK"; }
if [[ $KEEP -eq 0 ]]; then trap cleanup EXIT; fi

stop
rm -rf "$DATA"
mkdir -p "$DATA"
"$PGBIN/initdb" -D "$DATA/db" -U postgres --auth=trust --no-instructions >/dev/null
"$PGBIN/pg_ctl" -D "$DATA/db" -l "$DATA/server.log" -w \
  -o "-c listen_addresses='' -c unix_socket_directories='$SOCK' -c port=$PORT -c fsync=off -c timezone=UTC" start >/dev/null
"$PGBIN/createdb" paws_test
"${PSQL[@]}" -c "alter database paws_test set search_path = \"\$user\", public, extensions"

echo "== Supabase stand-in"
"${PSQL[@]}" -f "$ROOT/supabase/tests/local/supabase_shim.sql"

echo "== Migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  if ! out=$("${PSQL[@]}" -f "$f" 2>&1); then
    echo "FAILED: $(basename "$f")"
    echo "$out" | tail -20
    exit 1
  fi
done
echo "   $(ls "$ROOT"/supabase/migrations/*.sql | wc -l | tr -d ' ') applied"

status=0
echo "== SQL tests"
for t in "$ROOT"/supabase/tests/*.sql; do
  if grep -q "requires-seed-data" "$t"; then echo "   skip  $(basename "$t") (needs existing app data)"; continue; fi
  if out=$("${PSQL[@]}" -f "$t" 2>&1); then
    echo "   pass  $(basename "$t")"
  else
    echo "   FAIL  $(basename "$t")"
    echo "$out" | grep -E "ERROR|NOTICE|CONTEXT" | head -12 | sed 's/^/         /'
    status=1
  fi
done

echo "== Concurrency"
if PSQL_BIN="$PGBIN/psql" bash "$ROOT/supabase/tests/local/concurrency.sh"; then :; else status=1; fi

echo "== Number Trail concurrency"
if PSQL_BIN="$PGBIN/psql" bash "$ROOT/supabase/tests/local/number_concurrency.sh"; then :; else status=1; fi

echo "== Number Trail race end to end (edge function service code on this database)"
if (cd "$ROOT" && PAWS_TEST_PGHOST="$SOCK" PAWS_TEST_PGPORT="$PORT" PAWS_PSQL="$PGBIN/psql" npx jest src/__tests__/numberRaceDb.test.ts --silent >"$DATA/number_e2e.log" 2>&1); then
  echo "   pass  number race e2e: prepare, cache, start, seven walks checked, lost check recovered, one winner by receipt"
else
  echo "   FAIL  number race e2e"; tail -40 "$DATA/number_e2e.log" | sed 's/^/         /'; status=1
fi

echo "== Number Trail practice and online end to end"
if (cd "$ROOT" && PAWS_TEST_PGHOST="$SOCK" PAWS_TEST_PGPORT="$PORT" PAWS_PSQL="$PGBIN/psql" npx jest src/__tests__/numberPlayDb.test.ts --silent >"$DATA/number_play_e2e.log" 2>&1); then
  echo "   pass  number play e2e: find, practice walk, two-city online race matched, own-start check-in, finish stretch"
else
  echo "   FAIL  number play e2e"; tail -40 "$DATA/number_play_e2e.log" | sed 's/^/         /'; status=1
fi

echo "== Walking routes end to end"
if (cd "$ROOT" && PSQL_BIN="$PGBIN/psql" bash supabase/tests/local/routes_e2e.sh); then :; else status=1; fi

if [[ -n "${PAWS_OSM_DIR:-}" ]]; then
  echo "== Real OpenStreetMap areas end to end"
  if (cd "$ROOT" && PSQL_BIN="$PGBIN/psql" bash supabase/tests/local/osm_e2e.sh); then :; else status=1; fi
fi

if [[ $KEEP -eq 1 ]]; then echo "Cluster left running: PGHOST=$SOCK PGPORT=$PORT psql -U postgres paws_test"; fi
exit $status
