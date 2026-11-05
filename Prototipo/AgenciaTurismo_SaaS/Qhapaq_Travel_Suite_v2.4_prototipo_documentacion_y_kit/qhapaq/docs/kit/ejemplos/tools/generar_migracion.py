#!/usr/bin/env python3
"""
Genera una migración de Laravel 12 que reproduce EXACTAMENTE una tabla de kit-ia/database/*.sql
(columnas, CHECK, UNIQUE parciales, FKs, índices, triggers, comentarios) y su RLS de 90_rls.sql.

Uso:
  python3 kit-ia/ejemplos/tools/generar_migracion.py booking_reservations \
      --sql 20_fase1.sql --fecha 2026_02_01_000500 \
      --out kit-ia/ejemplos/backend/database/migrations

- Solo toma sentencias del archivo indicado en --sql (la fase donde nace la tabla). Las columnas que otra fase
  agrega (`alter table x add column`) van en su propia migración: generar con --sql 30_fase2.sql --solo-alter.
- Las FKs hacia tablas de fases futuras viven en la migración de esa fase (database/README.md §2).
- Regla del kit: si el modelo cambia, se edita primero el .sql, se valida con database/tests/validate.sh y
  DESPUÉS se regenera la migración (README §6). No editar la migración generada a mano.
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

KIT = Path(__file__).resolve().parents[2]          # kit-ia/
DB = KIT / "database"


def split_statements(sql: str) -> list[str]:
    """Separa por ';' de fin de sentencia, respetando bloques $$ … $$ y comentarios de línea."""
    out, buf, in_dollar = [], [], False
    for line in sql.splitlines():
        stripped = line.strip()
        if not in_dollar and (stripped.startswith("--") or stripped == ""):
            continue
        buf.append(line)
        if line.count("$$") % 2 == 1:
            in_dollar = not in_dollar
        if not in_dollar and stripped.endswith(";"):
            out.append("\n".join(buf).strip())
            buf = []
    return out


def statements_for(table: str, sql_file: Path, solo_alter: bool) -> list[str]:
    t = re.escape(table)
    patterns = [
        rf"^create table {t}\s*\(",
        rf"^create (unique )?index \S+ on {t}\b",
        rf"^alter table {t} add constraint ",
        rf"^alter table {t} add column ",
        rf"^create trigger \S+ .* on {t} for each",
        rf"^comment on table {t} is ",
        rf"^comment on column {t}\.",
        rf"^do \$\$ begin perform app_create_monthly_partitions\('{t}'",
    ]
    if solo_alter:
        patterns = [p for p in patterns if "create table" not in p and "comment on table" not in p]
    rx = [re.compile(p, re.IGNORECASE | re.DOTALL) for p in patterns]
    return [s for s in split_statements(sql_file.read_text(encoding="utf-8")) if any(r.search(s) for r in rx)]


def rls_mode(table: str) -> str | None:
    m = re.search(rf"app_enable_tenant_rls\('{re.escape(table)}', '(\w+)'\)", (DB / "90_rls.sql").read_text(encoding="utf-8"))
    return m.group(1) if m else None


def php_nowdoc(sql: str) -> str:
    body = "\n".join("            " + line if line else "" for line in sql.splitlines())
    # DB::statement usa sentencias preparadas: un '?' literal (operadores jsonb, regex) se tomaría como parámetro.
    method = "unprepared" if "?" in sql else "statement"
    return f"        DB::{method}(<<<'SQL'\n{body}\n            SQL);"


def render(table: str, stmts: list[str], mode: str | None, sql_name: str, solo_alter: bool) -> str:
    klass = "".join(p.capitalize() for p in table.split("_"))
    up = "\n\n".join(php_nowdoc(s) for s in stmts)
    rls = (f"\n\n        // RLS en la MISMA migración (02-ARQUITECTURA §8): ENABLE + FORCE + tenant_isolation ({mode}) + platform_access.\n"
           f"        DB::statement(\"select app_enable_tenant_rls('{table}', '{mode}')\");") if mode and not solo_alter else ""
    if solo_alter:
        cols = re.findall(rf"alter table {re.escape(table)} add column (\w+)", "\n".join(stmts), re.IGNORECASE)
        down = "\n".join(f"        DB::statement('alter table {table} drop column if exists {c}');" for c in cols) or "        // sin columnas"
    else:
        down = f"        DB::statement('drop table if exists {table}');"
    return f"""<?php

declare(strict_types=1);

/*
| GENERADO por kit-ia/ejemplos/tools/generar_migracion.py desde kit-ia/database/{sql_name} — NO editar a mano.
| Tabla: {table}. Reproduce el SQL validado (columnas, CHECK, UNIQUE, FK, índices, triggers, comentarios){' y su RLS' if mode and not solo_alter else ''}.
| Se usa DB::statement porque el Schema Builder no expresa CHECK con listas, UNIQUE parciales, defaults con
| funciones (app_uuid_v7(), app_current_tenant_id()) ni triggers (database/README.md §6).
| Ejecutar con la conexión dueña del esquema: php artisan migrate --database=pgsql_owner
*/

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Support\\Facades\\DB;

return new class extends Migration
{{
    public function up(): void
    {{
{up}{rls}
    }}

    public function down(): void
    {{
        // Las FKs de otras tablas hacia esta se crean (y se borran) en sus propias migraciones posteriores.
{down}
    }}
}};
"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("table")
    ap.add_argument("--sql", default="20_fase1.sql")
    ap.add_argument("--fecha", default="2026_02_01_000500")
    ap.add_argument("--out", default=str(KIT / "ejemplos" / "backend" / "database" / "migrations"))
    ap.add_argument("--solo-alter", action="store_true")
    a = ap.parse_args()

    stmts = statements_for(a.table, DB / a.sql, a.solo_alter)
    if not stmts:
        raise SystemExit(f"No hay sentencias para {a.table} en {a.sql}")
    name = f"{a.fecha}_{'add_columns_to' if a.solo_alter else 'create'}_{a.table}_table.php"
    out = Path(a.out) / name
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render(a.table, stmts, rls_mode(a.table), a.sql, a.solo_alter), encoding="utf-8")
    rls = "" if a.solo_alter else f" + RLS {rls_mode(a.table)}"
    print(f"{out.relative_to(KIT.parent)}: {len(stmts)} sentencias{rls}")


if __name__ == "__main__":
    main()
