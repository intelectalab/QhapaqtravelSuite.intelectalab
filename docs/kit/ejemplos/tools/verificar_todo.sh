#!/usr/bin/env bash
# Ejecuta todas las verificaciones de kit-ia/ejemplos (regenerar primero lo generado y luego validar).
#   1) Regenera critical-ops.ts (web y mobile) desde api/openapi.json y las migraciones de ejemplo desde database/*.sql.
#   2) PHP: sintaxis (php -l, PHP 8.4) + tablas/columnas contra el SQL.
#   3) Migración: reproduce exactamente booking_reservations en PostgreSQL (pg_dump antes = después).
#   4) TypeScript: tsc --noEmit estricto de web/ y mobile/ con los tipos generados del contrato.
#   5) Mermaid de GUIA-TECNICA.md (si hay Chromium y mermaid disponibles).
# Uso: PGBIN=/usr/lib/postgresql/17/bin ./kit-ia/ejemplos/tools/verificar_todo.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
python3 "$HERE/generar_operaciones_criticas.py"
python3 "$HERE/generar_migracion.py" booking_reservations --sql 20_fase1.sql --fecha 2026_02_01_000500
python3 "$HERE/generar_migracion.py" booking_reservations --sql 30_fase2.sql --fecha 2026_03_01_000500 --solo-alter
python3 "$HERE/verificar_backend.py"
bash "$HERE/verificar_migracion.sh"
bash "$HERE/verificar_typescript.sh" "${TS_WORKDIR:-$(mktemp -d)}"
if [ -n "${MERMAID_JS:-}" ] || [ -f /tmp/mk/node_modules/mermaid/dist/mermaid.min.js ]; then
  node "$HERE/validar_mermaid.cjs"
fi
