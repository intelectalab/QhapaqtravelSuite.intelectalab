#!/usr/bin/env bash
# Valida el esquema en un cluster PostgreSQL TEMPORAL (initdb → start → 00…90 → smoke test → conteos → stop).
# Uso: PGBIN=/usr/lib/postgresql/17/bin ./tests/validate.sh [directorio_temporal]
# Requiere binarios de PostgreSQL 16/17 con contrib (btree_gist, pg_trgm, citext, pgcrypto).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/17/bin}"
TMP="${1:-$(mktemp -d)}"; PORT="${PORT:-55439}"
AS=""; if [ "$(id -u)" = "0" ]; then AS="runuser -u postgres --"; chown postgres "$TMP"; chmod o+rx "$HERE" "$HERE/tests"; fi
$AS "$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust -E UTF8 >/dev/null
$AS "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null
trap '$AS "$PGBIN/pg_ctl" -D "$TMP/data" -m fast stop >/dev/null' EXIT
PSQL=("$PGBIN/psql" -h "$TMP" -p "$PORT" -U postgres -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -d postgres -c "create database kipucontrol_schema_check"
for f in 00_extensions_and_functions 01_platform 10_fase0 20_fase1 30_fase2 40_fase3 90_rls; do
  "${PSQL[@]}" -d kipucontrol_schema_check -f "$HERE/$f.sql" >/dev/null 2>"$TMP/err.log" || { echo "FALLO en $f.sql"; grep -v NOTICE "$TMP/err.log"; exit 1; }
  echo "ok  $f.sql"
done
"${PSQL[@]}" -d kipucontrol_schema_check -f "$HERE/tests/smoke_test.sql" 2>&1 | grep -E "NOTICE:  OK|ERROR" || true
"${PSQL[@]}" -d kipucontrol_schema_check -At -F ' = ' <<'SQL'
select 'tablas', count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and not c.relispartition;
select 'tablas con RLS', count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relrowsecurity and not c.relispartition;
select 'políticas', count(*) from pg_policies where schemaname = 'public';
select 'índices', count(*) from pg_index i join pg_class c on c.oid = i.indrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not c.relispartition;
select 'FKs', count(*) from pg_constraint k join pg_class c on c.oid = k.conrelid where k.contype = 'f' and c.relnamespace = 'public'::regnamespace and not c.relispartition;
SQL
