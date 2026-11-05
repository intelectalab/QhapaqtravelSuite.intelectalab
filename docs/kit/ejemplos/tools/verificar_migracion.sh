#!/usr/bin/env bash
# Verifica que las migraciones de ejemplo reproducen EXACTAMENTE la tabla del SQL validado.
#   1) Cluster PostgreSQL temporal; carga 00 → 01 → 10 → 20 → 30 → 40 → 90 (esquema de referencia).
#   2) pg_dump -s -t booking_reservations  → antes.sql (columnas, CHECK, índices, triggers, RLS, políticas, grants).
#   3) Ejecuta down() de las migraciones (cascade solo para las FKs de OTRAS tablas) y luego up() en orden.
#   4) pg_dump otra vez → despues.sql. Deben ser idénticos (diff vacío).
# Uso: PGBIN=/usr/lib/postgresql/16/bin ./kit-ia/ejemplos/tools/verificar_migracion.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
KIT="$(cd "$HERE/../.." && pwd)"
DBDIR="$KIT/database"
MIG="$KIT/ejemplos/backend/database/migrations"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
TABLE="${TABLE:-booking_reservations}"
TMP="$(mktemp -d)"; PORT="${PORT:-55441}"
AS=""; if [ "$(id -u)" = "0" ]; then AS="runuser -u postgres --"; chown postgres "$TMP"; chmod -R o+rX "$KIT/database" "$MIG"; fi
$AS "$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust -E UTF8 >/dev/null
$AS "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null
trap '$AS "$PGBIN/pg_ctl" -D "$TMP/data" -m fast stop >/dev/null; rm -rf "$TMP"' EXIT
PSQL=("$PGBIN/psql" -h "$TMP" -p "$PORT" -U postgres -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -d postgres -c "create database mig_check"
for f in 00_extensions_and_functions 01_platform 10_fase0 20_fase1 30_fase2 40_fase3 90_rls; do
  "${PSQL[@]}" -d mig_check -f "$DBDIR/$f.sql" >/dev/null 2>"$TMP/err.log" || { echo "FALLO en $f.sql"; grep -v NOTICE "$TMP/err.log"; exit 1; }
done
DUMP=("$PGBIN/pg_dump" -h "$TMP" -p "$PORT" -U postgres -s -t "$TABLE" mig_check)
"${DUMP[@]}" | grep -v '^--' | grep -v '^SET \|^SELECT pg_catalog\|^\\restrict\|^\\unrestrict' > "$TMP/antes.sql"

# Extrae las sentencias up()/down() de cada migración (nowdoc <<<'SQL' … SQL y DB::statement("…")).
python3 "$HERE/extraer_sql_migracion.py" down $(ls -r "$MIG"/*.php) > "$TMP/down.sql"
python3 "$HERE/extraer_sql_migracion.py" up   $(ls "$MIG"/*.php)    > "$TMP/up.sql"
# down() no usa cascade a propósito; aquí se agrega solo para soltar las FKs que OTRAS tablas tienen hacia esta.
sed -i "s/drop table if exists $TABLE;/drop table if exists $TABLE cascade;/" "$TMP/down.sql"
"${PSQL[@]}" -d mig_check -f "$TMP/down.sql" >/dev/null 2>&1
"${PSQL[@]}" -d mig_check -f "$TMP/up.sql" >/dev/null 2>"$TMP/err.log" || { echo "FALLO al aplicar up()"; cat "$TMP/err.log"; exit 1; }

"${DUMP[@]}" | grep -v '^--' | grep -v '^SET \|^SELECT pg_catalog\|^\\restrict\|^\\unrestrict' > "$TMP/despues.sql"
if diff -u "$TMP/antes.sql" "$TMP/despues.sql"; then
  echo "OK  $TABLE: la migración reproduce el SQL ($(grep -c . "$TMP/antes.sql") líneas de DDL idénticas: columnas, CHECK, índices, FKs, triggers, RLS, políticas, grants)"
else
  echo "DIFERENCIAS en $TABLE"; exit 1
fi
