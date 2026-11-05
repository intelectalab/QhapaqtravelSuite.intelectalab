#!/usr/bin/env bash
# Regenera todo el material de referencia: colección Postman, reglas, errores, eventos, permisos, glosario,
# diccionario de datos + diagramas ER y máquinas de estado.
# Funciona en la estructura original (proto/ + kit-ia/) y en el espacio de trabajo (docs/ + docs/kit/).
# Requisitos: Python 3, Node con playwright (npm i -D playwright) y binarios de PostgreSQL (PGBIN=/usr/lib/postgresql/17/bin).
set -euo pipefail
KIT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$KIT/.."
python3 "$KIT/api/postman/build_postman.py"
python3 "$KIT/referencia/tools/extract_rules.py"
python3 "$KIT/referencia/tools/extract_errors.py"
python3 "$KIT/referencia/tools/extract_events.py"
python3 "$KIT/referencia/tools/build_glossary.py"
node "$KIT/referencia/tools/extract_access.js"
python3 "$KIT/database/referencia/build_reference.py"
python3 "$KIT/referencia/tools/build_state_machines.py"
