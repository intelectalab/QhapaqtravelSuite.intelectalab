"""Utilidades compartidas: cluster PostgreSQL temporal + extracción del catálogo a JSON.

Lo usan `build_reference.py` (diccionario y diagramas ER) y
`../../referencia/tools/build_state_machines.py` (máquinas de estado).
Sin dependencias externas: habla con PostgreSQL a través de `psql`.
"""
import json
import os
import re
import shutil
import subprocess
import tempfile
from contextlib import contextmanager
from pathlib import Path

DB_DIR = Path(__file__).resolve().parent.parent  # kit-ia/database
SQL_FILES = [
    "00_extensions_and_functions",
    "01_platform",
    "10_fase0",
    "20_fase1",
    "30_fase2",
    "40_fase3",
    "90_rls",
]
PHASE_LABEL = {
    "00_extensions_and_functions": "Extensiones y funciones",
    "01_platform": "Plataforma",
    "10_fase0": "Fase 0 · Fundaciones",
    "20_fase1": "Fase 1 · MVP",
    "30_fase2": "Fase 2 · Canales y campo",
    "40_fase3": "Fase 3 · SaaS y crecimiento",
    "90_rls": "RLS",
}


def _find_pgbin(explicit=None):
    cands = [explicit, os.environ.get("PGBIN")] + [f"/usr/lib/postgresql/{v}/bin" for v in (17, 16, 18, 15)]
    for c in cands:
        if c and Path(c, "initdb").exists():
            return c
    raise SystemExit("No se encontró initdb. Indique --pgbin o PGBIN=/usr/lib/postgresql/17/bin")


@contextmanager
def temp_cluster(pgbin=None, port=55447, sql_dir=DB_DIR):
    """initdb → start → carga 00…90 → yield función psql(sql) → stop."""
    pgbin = _find_pgbin(pgbin)
    tmp = tempfile.mkdtemp(prefix="qhapaq_ref_")
    as_ = []
    if os.geteuid() == 0:
        as_ = ["runuser", "-u", "postgres", "--"]
        shutil.chown(tmp, "postgres")
        os.chmod(tmp, 0o755)
    sock = tmp
    run = lambda cmd, **kw: subprocess.run(cmd, check=True, **kw)
    run(as_ + [f"{pgbin}/initdb", "-D", f"{tmp}/data", "-U", "postgres", "-A", "trust", "-E", "UTF8"],
        stdout=subprocess.DEVNULL)
    run(as_ + [f"{pgbin}/pg_ctl", "-D", f"{tmp}/data", "-o", f"-p {port} -k {sock} -c listen_addresses=''",
               "-l", f"{tmp}/pg.log", "-w", "start"], stdout=subprocess.DEVNULL)
    base = [f"{pgbin}/psql", "-h", sock, "-p", str(port), "-U", "postgres", "-X", "-q", "-v", "ON_ERROR_STOP=1"]
    try:
        run(base + ["-d", "postgres", "-c", "create database qhapaq_reference"], stdout=subprocess.DEVNULL)
        for f in SQL_FILES:
            p = subprocess.run(base + ["-d", "qhapaq_reference", "-f", str(Path(sql_dir, f + ".sql"))],
                               stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
            if p.returncode:
                raise SystemExit(f"FALLO al cargar {f}.sql:\n{p.stderr}")
        def psql(sql):
            p = subprocess.run(base + ["-d", "qhapaq_reference", "-A", "-t", "-c", sql],
                               capture_output=True, text=True, check=True)
            return p.stdout
        yield psql
    finally:
        subprocess.run(as_ + [f"{pgbin}/pg_ctl", "-D", f"{tmp}/data", "-m", "fast", "stop"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        shutil.rmtree(tmp, ignore_errors=True)


CATALOG_SQL = r"""
with t as (
  select c.oid, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p') and not c.relispartition
)
select json_build_object(
 'server_version', current_setting('server_version'),
 'tables', (select json_agg(json_build_object(
    'name', t.relname,
    'comment', obj_description(t.oid, 'pg_class'),
    'partitioned', t.relkind = 'p',
    'partition_key', case when t.relkind = 'p' then pg_get_partkeydef(t.oid) end,
    'partitions', (select json_agg(json_build_object('name', pc.relname, 'bound', pg_get_expr(pc.relpartbound, pc.oid)) order by pc.relname)
                   from pg_inherits i join pg_class pc on pc.oid = i.inhrelid where i.inhparent = t.oid),
    'rls_enabled', t.relrowsecurity,
    'rls_forced', t.relforcerowsecurity,
    'policies', (select json_agg(json_build_object('name', p.policyname, 'cmd', p.cmd, 'roles', p.roles::text[], 'using', p.qual, 'check', p.with_check) order by p.policyname)
                 from pg_policies p where p.schemaname = 'public' and p.tablename = t.relname),
    'columns', (select json_agg(json_build_object(
          'name', a.attname, 'num', a.attnum, 'type', format_type(a.atttypid, a.atttypmod),
          'not_null', a.attnotnull,
          'default', pg_get_expr(d.adbin, d.adrelid),
          'identity', nullif(a.attidentity, ''),
          'generated', nullif(a.attgenerated, ''),
          'comment', col_description(t.oid, a.attnum)) order by a.attnum)
       from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped),
    'constraints', (select json_agg(json_build_object(
          'name', k.conname, 'type', k.contype,
          'def', pg_get_constraintdef(k.oid),
          'columns', (select json_agg(a.attname order by x.ord) from unnest(k.conkey) with ordinality x(n, ord)
                      join pg_attribute a on a.attrelid = k.conrelid and a.attnum = x.n),
          'ref_table', case when k.contype = 'f' then k.confrelid::regclass::text end,
          'ref_columns', case when k.contype = 'f' then (select json_agg(a.attname order by x.ord) from unnest(k.confkey) with ordinality x(n, ord)
                      join pg_attribute a on a.attrelid = k.confrelid and a.attnum = x.n) end,
          'on_delete', case when k.contype = 'f' then k.confdeltype::text end,
          'on_update', case when k.contype = 'f' then k.confupdtype::text end,
          'deferrable', k.condeferrable,
          'index', case when k.conindid <> 0 then k.conindid::regclass::text end) order by k.contype, k.conname)
       from pg_constraint k where k.conrelid = t.oid),
    'indexes', (select json_agg(json_build_object(
          'name', ic.relname, 'def', pg_get_indexdef(i.indexrelid),
          'unique', i.indisunique, 'primary', i.indisprimary,
          'predicate', pg_get_expr(i.indpred, i.indrelid),
          'method', am.amname,
          'constraint', (select k.conname from pg_constraint k where k.conindid = i.indexrelid and k.conrelid = i.indrelid limit 1)) order by ic.relname)
       from pg_index i join pg_class ic on ic.oid = i.indexrelid join pg_am am on am.oid = ic.relam
       where i.indrelid = t.oid),
    'triggers', (select json_agg(json_build_object('name', g.tgname, 'def', pg_get_triggerdef(g.oid), 'function', g.tgfoid::regproc::text) order by g.tgname)
       from pg_trigger g where g.tgrelid = t.oid and not g.tgisinternal)
  ) order by t.relname) from t),
 'counts', json_build_object(
   'tables', (select count(*) from t),
   'columns', (select count(*) from pg_attribute a join t on t.oid = a.attrelid where a.attnum > 0 and not a.attisdropped),
   'fks', (select count(*) from pg_constraint k join t on t.oid = k.conrelid where k.contype = 'f'),
   'checks', (select count(*) from pg_constraint k join t on t.oid = k.conrelid where k.contype = 'c'),
   'uniques', (select count(*) from pg_constraint k join t on t.oid = k.conrelid where k.contype = 'u'),
   'excludes', (select count(*) from pg_constraint k join t on t.oid = k.conrelid where k.contype = 'x'),
   'indexes', (select count(*) from pg_index i join t on t.oid = i.indrelid),
   'triggers', (select count(*) from pg_trigger g join t on t.oid = g.tgrelid where not g.tgisinternal),
   'rls_tables', (select count(*) from t where t.relrowsecurity),
   'policies', (select count(*) from pg_policies where schemaname = 'public')
 )
)
"""


def extract_catalog(psql):
    cat = json.loads(psql(CATALOG_SQL))
    for t in cat["tables"]:
        for k in ("columns", "constraints", "indexes", "triggers", "policies", "partitions"):
            t[k] = t.get(k) or []
    annotate_origin(cat)
    return cat


def annotate_origin(cat, sql_dir=DB_DIR):
    """Archivo SQL de origen de cada tabla, columna agregada y restricción agregada (ALTER TABLE)."""
    created, added_cols, added_cons = {}, {}, {}
    re_create = re.compile(r"^\s*create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)", re.I | re.M)
    re_addcol = re.compile(r"alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?(\w+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)", re.I)
    re_addcon = re.compile(r"alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?(\w+)\s+add\s+constraint\s+(\w+)", re.I)
    for f in SQL_FILES:
        txt = Path(sql_dir, f + ".sql").read_text(encoding="utf-8")
        txt = re.sub(r"--[^\n]*", "", txt)
        for m in re_create.finditer(txt):
            created.setdefault(m.group(1), f)
        for m in re_addcol.finditer(txt):
            added_cols[(m.group(1), m.group(2))] = f
        for m in re_addcon.finditer(txt):
            added_cons[(m.group(1), m.group(2))] = f
    for t in cat["tables"]:
        t["origin"] = created.get(t["name"])
        for c in t["columns"]:
            c["origin"] = added_cols.get((t["name"], c["name"]), t["origin"])
        for k in t["constraints"]:
            k["origin"] = added_cons.get((t["name"], k["name"]), t["origin"])


def check_values(defn):
    """Devuelve (columna, [valores]) si el CHECK es exactamente una lista cerrada de valores de una columna
    (`col IN (...)` o `col IS NULL OR col IN (...)`); None en otro caso."""
    lit = r"(?:'(?:[^']|'')*'(?:::[\w ]+)?|-?\d+(?:\.\d+)?)"
    arr = rf"\(+ARRAY\[({lit}(?:, {lit})*)\]\)*(?:::[\w ]+\[\])?\)*"
    col = r"\(*(\w+)\)?(?:::[\w ]+)?"
    m = re.fullmatch(rf"CHECK \(+{col} = ANY {arr}", defn)
    if not m:
        m2 = re.fullmatch(rf"CHECK \(+(\w+) IS NULL\) OR {col} = ANY {arr}", defn)
        if not m2 or m2.group(1) != m2.group(2):
            return None
        name, body = m2.group(1), m2.group(3)
    else:
        name, body = m.group(1), m.group(2)
    vals = [a if a else b for a, b in re.findall(r"'((?:[^']|'')*)'|(-?\d+(?:\.\d+)?)", body)]
    return name, [v.replace("''", "'") for v in vals]
