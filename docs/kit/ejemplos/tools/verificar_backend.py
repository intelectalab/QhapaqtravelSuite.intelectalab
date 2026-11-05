#!/usr/bin/env python3
"""
Verificación estática de los ejemplos PHP contra el esquema SQL del kit (sin Laravel instalado).

1. `php -l` de cada archivo (sintaxis PHP 8.4 real).
2. Tablas usadas (`DB::table('x')`, joins, `$table = 'x'`, `lockRows('x')`) existen en kit-ia/database/*.sql.
3. Columnas usadas existen en su tabla:
   - claves de arrays de insert()/update()/forceFill() sobre DB::table('x') o modelos con $table;
   - where/orderBy/value/pluck/sum/whereIn/get([...]) en cadenas DB::table('x'…);
   - referencias `alias.columna` resueltas con los alias de DB::table('t as a') / join('t as a').
   - claves de $casts y $fillable de los modelos.
4. Clases App\\ importadas que NO están en ejemplos/ (deben existir en el proyecto: modelos, middleware F0…).

Uso: python3 kit-ia/ejemplos/tools/verificar_backend.py   (código de salida 1 si hay errores)
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

KIT = Path(__file__).resolve().parents[2]
SRC = KIT / "ejemplos" / "backend"
SQL_FILES = sorted((KIT / "database").glob("[0-9]*.sql"))


def load_schema() -> dict[str, set[str]]:
    schema: dict[str, set[str]] = {}
    for f in SQL_FILES:
        text = f.read_text(encoding="utf-8")
        for m in re.finditer(r"^create table (\w+) \((.*?)^\)", text, re.M | re.S):
            cols = set()
            for line in m.group(2).splitlines():
                line = line.strip()
                if not line or line.startswith("constraint") or line.startswith("--"):
                    continue
                cols.add(line.split()[0])
            schema.setdefault(m.group(1), set()).update(cols)
        for m in re.finditer(r"^alter table (\w+) add column (\w+)", text, re.M):
            schema.setdefault(m.group(1), set()).add(m.group(2))
    return schema


SCHEMA = load_schema()
errors: list[str] = []
checked = {"files": 0, "tables": set(), "columns": 0}
QUERY_METHODS = r"(?:where|orWhere|whereIn|whereNotIn|whereNull|whereNotNull|orderBy|value|pluck|sum|max|min|groupBy|increment)"


def check_col(table: str, col: str, where: str) -> None:
    if col in ("*",) or table not in SCHEMA:
        return
    checked["columns"] += 1
    if col not in SCHEMA[table]:
        errors.append(f"{where}: columna `{table}.{col}` no existe en el SQL")


def statements(php: str) -> list[str]:
    # Corte grosero por ';' fuera de strings: suficiente para cadenas del query builder.
    return re.split(r";\s*\n", php)


for path in sorted(SRC.rglob("*.php")):
    rel = path.relative_to(KIT)
    checked["files"] += 1
    res = subprocess.run(["php", "-l", str(path)], capture_output=True, text=True)
    if res.returncode != 0:
        errors.append(f"{rel}: {res.stdout.strip()} {res.stderr.strip()}")
    php = path.read_text(encoding="utf-8")

    # Modelos: $table + $casts + $fillable
    mt = re.search(r"protected \$table = '(\w+)'", php)
    if mt:
        table = mt.group(1)
        checked["tables"].add(table)
        if table not in SCHEMA:
            errors.append(f"{rel}: tabla `{table}` no existe")
        casts = re.search(r"function casts\(\): array\s*\{\s*return \[(.*?)\];", php, re.S)
        if casts:
            for c in re.findall(r"^\s*'(\w+)' =>", casts.group(1), re.M):
                check_col(table, c, f"{rel} $casts")
        fill = re.search(r"\$fillable = \[(.*?)\];", php, re.S)
        if fill:
            for c in re.findall(r"'(\w+)'", fill.group(1)):
                check_col(table, c, f"{rel} $fillable")

    for st in statements(php):
        tables = re.findall(r"(?:DB::(?:connection\([^)]*\)->)?table|join|leftJoin|lockRows)\('(\w+)(?: as (\w+))?'", st)
        if not tables:
            continue
        aliases = {}
        for t, a in tables:
            checked["tables"].add(t)
            if t not in SCHEMA:
                errors.append(f"{rel}: tabla `{t}` no existe en el SQL")
            aliases[a or t] = t
        base = tables[0][0]
        # alias.columna
        for a, c in re.findall(r"'(\w+)\.(\w+)'", st):
            if a in aliases:
                check_col(aliases[a], c, str(rel))
        if len(tables) == 1 and not tables[0][1]:
            for c in re.findall(rf"->{QUERY_METHODS}\('(\w+)'", st):
                check_col(base, c, str(rel))
            for blk in re.findall(r"->(?:insert|insertGetId|update)\(\[(.*?)\]\)", st, re.S):
                for k in re.findall(r"^\s*'(\w+)' =>", blk, re.M):
                    check_col(base, k, str(rel))
            for blk in re.findall(r"->(?:get|first)\(\[(.*?)\]\)", st, re.S):
                for k in re.findall(r"'(\w+)'", blk):
                    check_col(base, k, str(rel))

# Forzado de columnas en la Action de conversión (forceFill sobre Reservation = booking_reservations)
conv = (SRC / "app/Domain/Bookings/Actions/ConvertQuoteToReservation.php").read_text(encoding="utf-8")
m = re.search(r"\$reservation->forceFill\(\[(.*?)\]\);", conv, re.S)
if m:
    for k in re.findall(r"^\s*'(\w+)' =>", m.group(1), re.M):
        check_col("booking_reservations", k, "ConvertQuoteToReservation forceFill(Reservation)")
m = re.search(r"\$quote->forceFill\(\[(.*?)\]\)", conv, re.S)
if m:
    for k in re.findall(r"'(\w+)' =>", m.group(1)):
        check_col("quote_quotes", k, "ConvertQuoteToReservation forceFill(Quote)")
svc = (SRC / "app/Domain/Bookings/Actions/Support/ServicesFromQuoteItem.php").read_text(encoding="utf-8")
for blk in re.findall(r"(?:\$base = \[|\$rows\[\] = \[|return \[\[)(.*?)\n\s*\]", svc, re.S):
    for k in re.findall(r"^\s*'(\w+)' =>", blk, re.M):
        check_col("booking_reservation_services", k, "ServicesFromQuoteItem (fila de servicio)")

# Clases App\ importadas que no están en ejemplos/
defined = set()
for path in SRC.rglob("*.php"):
    txt = path.read_text(encoding="utf-8")
    ns = re.search(r"^namespace ([\w\\]+);", txt, re.M)
    for cls in re.findall(r"^(?:final |abstract |readonly )*(?:class|interface|trait|enum) (\w+)", txt, re.M):
        if ns:
            defined.add(ns.group(1) + "\\" + cls)
external = set()
for path in SRC.rglob("*.php"):
    txt = path.read_text(encoding="utf-8")
    for u in re.findall(r"^use (App\\[\w\\]+);", txt, re.M) + re.findall(r"\\?(App\\[\w\\]+)::class", txt):
        if u not in defined:
            external.add(u)

print(f"Archivos PHP: {checked['files']} · tablas verificadas: {len(checked['tables'])} · referencias de columna: {checked['columns']}")
print("Clases App\\ que el proyecto debe aportar (no incluidas en ejemplos/):")
for e in sorted(external):
    print("   -", e)
if errors:
    print("\nERRORES:")
    for e in errors:
        print("  ✗", e)
    sys.exit(1)
print("OK: sintaxis PHP válida y todas las tablas/columnas existen en kit-ia/database/*.sql")
