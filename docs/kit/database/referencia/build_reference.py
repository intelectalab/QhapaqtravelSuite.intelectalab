#!/usr/bin/env python3
"""Genera la referencia de base de datos desde el catálogo de PostgreSQL.

Uso (desde cualquier carpeta):
    python3 kit-ia/database/referencia/build_reference.py [--pgbin /usr/lib/postgresql/17/bin] [--no-svg]

Pasos: levanta un cluster temporal (initdb), carga 00→90, lee pg_catalog
(comentarios, columnas, restricciones, índices, triggers, RLS, particiones),
y escribe en esta carpeta:
    DICCIONARIO-DE-DATOS.md      índice por dominio y por fase
    diccionario/<dominio>.md     detalle por tabla
    diccionario.csv              una fila por columna
    er/<dominio>.mmd|.svg        diagramas entidad-relación por dominio (Mermaid)
    er/00-general.mmd|.svg       diagrama de alto nivel entre dominios
    er/index.html                visor autocontenido de los SVG
Al final verifica que los conteos de la salida coinciden con el catálogo.
"""
import argparse
import csv
import html
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.dont_write_bytecode = True
import pgcatalog  # noqa: E402

# ----------------------------------------------------------------- dominios (prefijo real de la tabla)
DOMAINS = [
    # clave, título, descripción, regla (prefijos o nombres exactos)
    ("plataforma", "Plataforma SaaS", "Planes, tenants, suscripciones, facturación SaaS, cupones y medición de uso (sin tenant_id de negocio).",
     ["plans", "plan_", "addons", "addon_", "features", "feature_", "tenants", "tenant_", "platform_", "coupons", "coupon_",
      "subscriptions", "subscription_", "payment_methods", "payment_attempts", "usage_"]),
    ("iam", "Identidad y acceso (iam_)", "Sedes, usuarios, MFA, tokens, roles y permisos (Spatie).",
     ["iam_", "roles", "role_has_permissions", "model_has_", "permissions", "personal_access_tokens"]),
    ("sys", "Sistema (sys_)", "Auditoría, correlativos, idempotencia, outbox, ajustes, documentos, jobs y reglas de reserva.",
     ["sys_", "audit_events"]),
    ("notif", "Notificaciones (notif_)", "Reglas de evento, plantillas, mensajes y lecturas; mensajes al pasajero.", ["notif_"]),
    ("integration", "Integraciones (integration_)", "Adaptadores, errores, API keys, webhooks, OAuth y fuentes de reseñas.",
     ["integration_", "oauth_clients"]),
    ("catalog", "Catálogo (catalog_)", "Productos, versiones, servicios, proveedores, tarifas, salidas, holds, cupos y reglas por producto.", ["catalog_"]),
    ("crm", "CRM (crm_)", "Clientes, leads, oportunidades, actividades, postventa, reclamaciones, metas y reseñas propias.", ["crm_"]),
    ("quote", "Cotizaciones (quote_)", "Cotizaciones, versiones, ítems, aprobaciones, envíos y vistas.", ["quote_"]),
    ("booking", "Reservas (booking_)", "Reservas, pasajeros, servicios, holds, cambios, cancelaciones y snapshots web.", ["booking_"]),
    ("ops", "Operaciones (ops_)", "Órdenes operativas, asignaciones, recursos, rooming, vouchers, incidencias, móvil y documentos de viaje.", ["ops_"]),
    ("supplier", "Extranet de proveedores (supplier_)", "Respuestas, facturas y solicitudes de tarifa del proveedor.", ["supplier_"]),
    ("fin", "Finanzas y tesorería (fin_)", "CxC, pagos, CxP, comisiones, comprobantes, conciliación, cierres, tesorería y monedas.", ["fin_", "fx_"]),
    ("channel", "Canales (channel_)", "B2B, e-commerce, sitio web, widget, portales, tickets, reseñas externas y eventos web.", ["channel_"]),
    ("cms", "Contenidos (cms_)", "Contenidos del CMS y su historial.", ["cms_"]),
    ("collab", "Aprobaciones e inbox (collab_)", "Reglas y solicitudes de aprobación, conversaciones omnicanal y mensajes.", ["collab_"]),
    ("mkt", "Marketing (mkt_)", "Suscriptores, segmentos, plantillas, campañas, consentimientos, atribución y automatizaciones.", ["mkt_"]),
    ("report", "Reportes (report_)", "Exportaciones de reportes.", ["report_"]),
]
PHASE_ORDER = ["01_platform", "10_fase0", "20_fase1", "30_fase2", "40_fase3"]
FK_ACTION = {"a": "NO ACTION", "r": "RESTRICT", "c": "CASCADE", "n": "SET NULL", "d": "SET DEFAULT"}
CONVENTION_COLS = {
    "tenant_id": "Tenant propietario de la fila (RLS).",
    "created_at": "Fecha y hora de creación.",
    "updated_at": "Última actualización (trigger app_set_updated_at).",
    "created_by": "Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema).",
    "updated_by": "Usuario de la última actualización (sin FK).",
    "deleted_at": "Borrado lógico (soft delete).",
    "lock_version": "Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas).",
}


def domain_of(table):
    for key, _t, _d, rules in DOMAINS:
        for r in rules:
            if (r.endswith("_") and table.startswith(r)) or table == r:
                return key
    raise SystemExit(f"Tabla sin dominio asignado: {table}. Agréguela a DOMAINS en build_reference.py")


def domain_title(key):
    return next(t for k, t, _d, _r in DOMAINS if k == key)


def rls_mode(t):
    names = {p["name"] for p in t["policies"]}
    if not t["rls_enabled"]:
        return "plataforma (sin RLS)" if t["origin"] == "01_platform" else "sin RLS"
    if "tenant_self" in names:
        return "plataforma (tenant_self: cada tenant ve su fila)"
    if "tenant_shared_read" in names:
        return "shared (tenant + filas globales de solo lectura)"
    if "tenant_isolation" in names:
        return "tenant"
    return "RLS (" + ", ".join(sorted(names)) + ")"


def rls_short(t):
    m = rls_mode(t)
    return m.split(" (")[0] if not m.startswith("plataforma") else "plataforma"


def md(s):
    """Escapa texto para celdas de tabla Markdown."""
    if s is None:
        return ""
    return str(s).replace("|", "\\|").replace("\n", " ")


def code(s):
    if s is None or s == "":
        return ""
    s = str(s).replace("|", "\\|").replace("\n", " ")
    return f"`{s}`" if "`" not in s else f"``{s}``"


def short_type(t):
    t = t.replace("character varying", "varchar").replace("timestamp with time zone", "timestamptz")
    t = t.replace("timestamp without time zone", "timestamp").replace("time without time zone", "time")
    t = t.replace("character", "char").replace("double precision", "float8")
    return t


# ----------------------------------------------------------------- análisis por tabla
def analyze(cat):
    tables = {t["name"]: t for t in cat["tables"]}
    for t in cat["tables"]:
        t["domain"] = domain_of(t["name"])
        cons = t["constraints"]
        t["pk"] = next((k for k in cons if k["type"] == "p"), None)
        t["fks"] = [k for k in cons if k["type"] == "f"]
        t["checks"] = [k for k in cons if k["type"] == "c"]
        t["excludes"] = [k for k in cons if k["type"] == "x"]
        t["uniques"] = [k for k in cons if k["type"] == "u"]
        con_idx = {k["index"] for k in cons if k.get("index") and k["type"] in ("p", "u", "x")}
        t["unique_indexes"] = [i for i in t["indexes"] if i["unique"] and not i["primary"] and i["name"] not in con_idx]
        t["plain_indexes"] = [i for i in t["indexes"] if not i["unique"] and i["name"] not in con_idx]
        # mapa columna → fk / valores de check
        colfk = defaultdict(list)
        for k in t["fks"]:
            for c, rc in zip(k["columns"], k["ref_columns"]):
                colfk[c].append(f"{k['ref_table']}.{rc}")
        colvals = {}
        for k in t["checks"]:
            r = pgcatalog.check_values(k["def"])
            if r:
                colvals[r[0]] = r[1]
        pkcols = set(t["pk"]["columns"]) if t["pk"] else set()
        uniq_sets = [set(k["columns"]) for k in t["uniques"]] + [set(_index_cols(i["def"])) for i in t["unique_indexes"] if not i["predicate"]]
        for c in t["columns"]:
            c["fk"] = colfk.get(c["name"], [])
            c["values"] = colvals.get(c["name"])
            c["pk"] = c["name"] in pkcols
            c["uk"] = any(s == {c["name"]} or (c["name"] in s and len(s) <= 2 and "tenant_id" in s) for s in uniq_sets)
        t["uniq_sets"] = uniq_sets
    return tables


def _index_cols(defn):
    m = re.search(r"USING \w+ \((.*)\)", defn)
    if not m:
        return []
    inner = m.group(1).split(") WHERE")[0]
    return [x.strip().split(" ")[0] for x in inner.split(",")]


def col_desc(t, c):
    parts = []
    if c["comment"]:
        parts.append(c["comment"])
    elif c["name"] in CONVENTION_COLS:
        parts.append(CONVENTION_COLS[c["name"]])
    if c["pk"]:
        parts.append("PK.")
    if c["fk"]:
        parts.append("FK → " + ", ".join(c["fk"]) + ".")
    if c["values"]:
        parts.append("Valores: " + ", ".join(f"`{v}`" for v in c["values"]) + ".")
    if c["origin"] != t["origin"]:
        parts.append(f"[Agregada en `{c['origin']}.sql`]")
    return " ".join(parts)


def fk_line(k):
    cols = ", ".join(k["columns"])
    rcols = ", ".join(k["ref_columns"])
    extra = f" · ON UPDATE {FK_ACTION[k['on_update']]}" if k["on_update"] != "a" else ""
    defer = " · DEFERRABLE" if k["deferrable"] else ""
    origin = ""
    return f"| `{cols}` | `{k['ref_table']}.{rcols}` | {FK_ACTION[k['on_delete']]}{extra}{defer} | `{k['name']}` |"


def table_md(t):
    out = []
    out.append(f"### `{t['name']}`\n")
    out.append(f"{md(t['comment']) or '_Sin comentario en el esquema._'}\n")
    part = "No"
    if t["partitioned"]:
        n = len(t["partitions"])
        part = f"Sí · `{t['partition_key']}` · {n} particiones (incluida DEFAULT)"
    pols = ", ".join(f"`{p['name']}`" for p in t["policies"]) or "—"
    out.append("| Dominio | Fase (archivo) | RLS | Políticas | Particionado |")
    out.append("|---|---|---|---|---|")
    out.append(f"| {domain_title(t['domain'])} | {pgcatalog.PHASE_LABEL[t['origin']]} (`{t['origin']}.sql`) | {rls_mode(t)}"
               f"{' · FORCE' if t['rls_forced'] else ''} | {pols} | {part} |\n")
    out.append("**Columnas**\n")
    out.append("| # | Columna | Tipo | Nulo | Default | Descripción |")
    out.append("|---|---|---|---|---|---|")
    for i, c in enumerate(t["columns"], 1):
        default = c["default"] or ""
        if c["identity"]:
            default = "identity (" + ("ALWAYS" if c["identity"] == "a" else "BY DEFAULT") + ")"
        if c["generated"]:
            default = "generada: " + default
        out.append(f"| {i} | `{c['name']}` | {code(c['type'])} | {'no' if c['not_null'] else 'sí'} | {code(default)} | {md(col_desc(t, c))} |")
    out.append("")
    out.append(f"**PK:** {('`' + ', '.join(t['pk']['columns']) + '`') if t['pk'] else '—'}\n")
    if t["fks"]:
        out.append("**Claves foráneas**\n")
        out.append("| Columna(s) | Referencia | ON DELETE | Nombre |")
        out.append("|---|---|---|---|")
        out += [fk_line(k) for k in t["fks"]]
        out.append("")
    uniq = [(k["name"], ", ".join(k["columns"]), "", "restricción" + (" DEFERRABLE" if k["deferrable"] else "")) for k in t["uniques"]]
    uniq += [(i["name"], ", ".join(_index_cols(i["def"])), i["predicate"] or "", "índice único" + (f" ({i['method']})" if i["method"] != "btree" else ""))
             for i in t["unique_indexes"]]
    if uniq:
        out.append("**UNIQUE**\n")
        out.append("| Nombre | Columnas / expresión | Condición (parcial) | Tipo |")
        out.append("|---|---|---|---|")
        out += [f"| `{n}` | {code(c)} | {code(w)} | {ty} |" for n, c, w, ty in uniq]
        out.append("")
    if t["checks"]:
        out.append("**CHECK**\n")
        out.append("| Nombre | Definición | Valores permitidos |")
        out.append("|---|---|---|")
        for k in t["checks"]:
            r = pgcatalog.check_values(k["def"])
            vals = f"`{r[0]}`: " + ", ".join(f"`{v}`" for v in r[1]) if r else ""
            out.append(f"| `{k['name']}` | {code(k['def'])} | {md(vals)} |")
        out.append("")
    if t["excludes"]:
        out.append("**EXCLUDE**\n")
        out += [f"- `{k['name']}`: {code(k['def'])}" for k in t["excludes"]]
        out.append("")
    if t["plain_indexes"]:
        out.append("**Índices**\n")
        out.append("| Nombre | Definición |")
        out.append("|---|---|")
        for i in t["plain_indexes"]:
            d = re.sub(r"^CREATE INDEX \S+ ON (ONLY )?public\.\S+ ", "", i["def"])
            out.append(f"| `{i['name']}` | {code(d)} |")
        out.append("")
    if t["triggers"]:
        out.append("**Triggers**\n")
        out.append("| Nombre | Momento y evento | Función |")
        out.append("|---|---|---|")
        for g in t["triggers"]:
            m = re.search(r"TRIGGER \S+ (.*?) ON ", g["def"])
            out.append(f"| `{g['name']}` | {md(m.group(1) if m else g['def'])} | `{g['function']}` |")
        out.append("")
    if t["partitioned"]:
        first = [p["name"] for p in t["partitions"]][:3]
        out.append(f"**Particiones:** {len(t['partitions'])} (p. ej. {', '.join('`'+x+'`' for x in first)} …). "
                   "Se crean con `app_create_monthly_partitions()`; programar un job mensual.\n")
    out.append("[↑ Índice del dominio](#tablas)\n")
    return "\n".join(out)


def write_dictionary(cat, tables, out_dir):
    ddir = out_dir / "diccionario"
    ddir.mkdir(exist_ok=True)
    by_dom = defaultdict(list)
    for t in cat["tables"]:
        by_dom[t["domain"]].append(t)
    gen = f"_Generado por `build_reference.py` desde el catálogo de PostgreSQL {cat['server_version'].split()[0]} tras cargar `00`→`90`. No editar a mano._"
    stats = {}
    for key, title, desc, _r in DOMAINS:
        ts = sorted(by_dom.get(key, []), key=lambda x: (PHASE_ORDER.index(x["origin"]), x["name"]))
        if not ts:
            continue
        ncol = sum(len(t["columns"]) for t in ts)
        nfk = sum(len(t["fks"]) for t in ts)
        stats[key] = (len(ts), ncol, nfk, Counter(t["origin"] for t in ts))
        lines = [f"# Diccionario de datos · {title}\n", gen + "\n", desc + "\n",
                 f"{len(ts)} tablas · {ncol} columnas · {nfk} claves foráneas. Diagrama ER: [`../er/{key}.svg`](../er/{key}.svg) "
                 f"(fuente [`../er/{key}.mmd`](../er/{key}.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).\n",
                 "## Tablas\n", "| Tabla | Fase | RLS | Columnas | FKs | Descripción |", "|---|---|---|---|---|---|"]
        for t in ts:
            lines.append(f"| [`{t['name']}`](#{t['name']}) | {pgcatalog.PHASE_LABEL[t['origin']]} | {rls_short(t)} | {len(t['columns'])} | {len(t['fks'])} | {md((t['comment'] or '')[:160])} |")
        lines.append("\n## Detalle por tabla\n")
        for t in ts:
            lines.append(table_md(t))
        (ddir / f"{key}.md").write_text("\n".join(lines), encoding="utf-8")

    # índice general
    c = cat["counts"]
    L = ["# Diccionario de datos · Qhapaq Travel Suite\n", gen + "\n",
         "Fuente de verdad: `kit-ia/database/*.sql`. Este índice y los archivos de `diccionario/` se regeneran con "
         "`python3 kit-ia/database/referencia/build_reference.py` (ver [README](README.md)).\n",
         "## Cifras del catálogo\n",
         "| Tablas | Columnas | FKs | CHECK | UNIQUE (restricción) | Índices (incl. PK/UNIQUE) | EXCLUDE | Triggers | Tablas con RLS | Políticas |",
         "|---|---|---|---|---|---|---|---|---|---|",
         f"| {c['tables']} | {c['columns']} | {c['fks']} | {c['checks']} | {c['uniques']} | {c['indexes']} | {c['excludes']} | {c['triggers']} | {c['rls_tables']} | {c['policies']} |\n",
         "Modos de RLS: **tenant** = política `tenant_isolation` (`tenant_id = app_current_tenant_id()`, ENABLE + FORCE); "
         "**shared** = además `tenant_shared_read` (lee filas globales con `tenant_id IS NULL`); **plataforma** = tablas de `01_platform.sql` "
         "sin RLS de tenant (acceso por privilegios de `platform_role`; `tenants` usa `tenant_self`); **sin RLS** = tabla de negocio sin políticas. "
         "Todas las tablas con RLS tienen además `platform_access` para `platform_role`.\n",
         "## Por dominio\n",
         "| Dominio | Archivo | Tablas | Columnas | FKs | Plataforma | F0 | F1 | F2 | F3 | Diagrama ER |",
         "|---|---|---|---|---|---|---|---|---|---|---|"]
    for key, title, desc, _r in DOMAINS:
        if key not in stats:
            continue
        n, nc, nf, ph = stats[key]
        cells = " | ".join(str(ph.get(p, "")) for p in PHASE_ORDER)
        L.append(f"| **{title}** — {desc} | [`diccionario/{key}.md`](diccionario/{key}.md) | {n} | {nc} | {nf} | {cells} | [SVG](er/{key}.svg) |")
    L.append(f"\nDiagrama general entre dominios: [`er/00-general.svg`](er/00-general.svg). Visor de todos los diagramas: [`er/index.html`](er/index.html).\n")
    L.append("## Por fase (archivo SQL de origen)\n")
    by_phase = defaultdict(list)
    for t in cat["tables"]:
        by_phase[t["origin"]].append(t)
    for p in PHASE_ORDER:
        ts = sorted(by_phase[p], key=lambda x: (x["domain"], x["name"]))
        L.append(f"### {pgcatalog.PHASE_LABEL[p]} · `{p}.sql` · {len(ts)} tablas\n")
        L.append("| Tabla | Dominio | RLS | Descripción |")
        L.append("|---|---|---|---|")
        for t in ts:
            L.append(f"| [`{t['name']}`](diccionario/{t['domain']}.md#{t['name']}) | {t['domain']} | {rls_short(t)} | {md((t['comment'] or '')[:140])} |")
        added = sorted({(t["name"], c["name"]) for t in cat["tables"] for c in t["columns"] if c["origin"] == p and t["origin"] != p})
        if added:
            g = defaultdict(list)
            for tn, cn in added:
                g[tn].append(cn)
            L.append("\nColumnas que esta fase agrega a tablas de fases previas: " +
                     "; ".join(f"`{tn}` ({', '.join(cs)})" for tn, cs in sorted(g.items())) + ".")
        L.append("")
    L.append("## Columnas de estado (CHECK con lista de valores)\n")
    L.append("Ver también [`../../referencia/MAQUINAS-DE-ESTADO.md`](../../referencia/MAQUINAS-DE-ESTADO.md) (transiciones).\n")
    L.append("| Tabla | Columna | Valores |")
    L.append("|---|---|---|")
    for t in sorted(cat["tables"], key=lambda x: x["name"]):
        for c in t["columns"]:
            if c["values"] and re.search(r"status|state|stage", c["name"]):
                L.append(f"| [`{t['name']}`](diccionario/{t['domain']}.md#{t['name']}) | `{c['name']}` | {', '.join('`'+v+'`' for v in c['values'])} |")
    (out_dir / "DICCIONARIO-DE-DATOS.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    return stats


def write_csv(cat, out_dir):
    n = 0
    with open(out_dir / "diccionario.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["tabla", "columna", "tipo", "nulo", "default", "descripcion", "fk", "dominio", "fase"])
        for t in sorted(cat["tables"], key=lambda x: x["name"]):
            for c in t["columns"]:
                w.writerow([t["name"], c["name"], c["type"], "si" if not c["not_null"] else "no", c["default"] or "",
                            col_desc(t, c), "; ".join(c["fk"]), t["domain"], c["origin"]])
                n += 1
    return n


# ----------------------------------------------------------------- diagramas ER (Mermaid)
KEY_COLS = re.compile(r"^(code|ref|name|title|status|state|stage|kind|type|currency|total_amount|amount|email|slug|service_date|travel_from|valid_from|valid_to|period|version_no)$")
MAX_ATTRS = 14


def er_type(t):
    t = short_type(t)
    t = re.sub(r"\(.*?\)", "", t).replace("[]", "_array").replace(" ", "_")
    return t


def er_domain(key, cat, tables):
    ts = [t for t in cat["tables"] if t["domain"] == key]
    names = {t["name"] for t in ts}
    L = ["erDiagram"]
    external = set()
    rels = defaultdict(list)
    for t in ts:
        for k in t["fks"]:
            if k["columns"] == ["tenant_id"] and key != "plataforma":
                continue
            if k["ref_table"] not in names:
                external.add(k["ref_table"])
            rels[(k["ref_table"], t["name"])].append(k)
    for t in sorted(ts, key=lambda x: x["name"]):
        attrs = []
        for c in t["columns"]:
            keys = []
            if c["pk"]:
                keys.append("PK")
            if c["fk"] and not (c["name"] == "tenant_id" and key != "plataforma"):
                keys.append("FK")
            if c["uk"]:
                keys.append("UK")
            if keys or KEY_COLS.match(c["name"]):
                attrs.append((keys, c))
        extra = len(attrs) - MAX_ATTRS
        if extra > 0:  # prioriza PK/FK
            attrs = [a for a in attrs if "PK" in a[0]] + [a for a in attrs if "FK" in a[0] and "PK" not in a[0]] + [a for a in attrs if not a[0]]
            attrs = attrs[:MAX_ATTRS]
        L.append(f"  {t['name']} {{")
        for keys, c in attrs:
            L.append(f"    {er_type(c['type'])} {c['name']}{(' ' + ','.join(keys)) if keys else ''}")
        if extra > 0:
            L.append(f"    otras mas_{extra}_columnas")
        L.append("  }")
    for e in sorted(external):
        L.append(f"  {e} {{")
        L.append("    uuid id PK")
        L.append("  }")
    for (parent, child), ks in sorted(rels.items()):
        t = tables[child]
        cols = [c for k in ks for c in k["columns"]]
        nullable = all(not next(x for x in t["columns"] if x["name"] == col)["not_null"] for col in cols)
        one = any(set(k["columns"]) in t["uniq_sets"] or (t["pk"] and set(k["columns"]) == set(t["pk"]["columns"])) for k in ks)
        left = "|o" if nullable else "||"
        right = "o|" if one else "o{"
        label = ", ".join(sorted(set(cols)))
        if len(label) > 40:
            label = label[:37] + "..."
        L.append(f'  {parent} {left}--{right} {child} : "{label}"')
    return "\n".join(L) + "\n", len(rels), sum(len(v) for v in rels.values())


def er_overview(cat):
    edges = Counter()
    for t in cat["tables"]:
        for k in t["fks"]:
            if k["columns"] == ["tenant_id"]:
                continue
            src = t["domain"]
            dst = next(x for x in cat["tables"] if x["name"] == k["ref_table"])["domain"]
            if src != dst:
                edges[(src, dst)] += 1
    cnt = Counter(t["domain"] for t in cat["tables"])
    # iam y sys son transversales (usuarios, sedes, documentos, correlativos): sus FKs entrantes se resumen
    # en la etiqueta del nodo para no saturar. El resto se dibuja como relación no dirigida con el total.
    hub = {"iam", "sys"}
    incoming = Counter()
    pairs = Counter()
    for (a, b), n in edges.items():
        if b in hub:
            incoming[b] += n
            continue
        pairs[tuple(sorted((a, b)))] += n
    transversal = ["plataforma", "iam", "sys", "notif", "integration"]
    L = ["flowchart LR"]
    def node(key):
        title = domain_title(key).split(" (")[0]
        extra = f"<br/>← {incoming[key]} FK desde otros dominios" if incoming[key] else ""
        return f'    {key}["{title}<br/>{key}_ · {cnt[key]} tablas{extra}"]'
    L.append('  subgraph T["Transversal y plataforma"]')
    L.append("    direction TB")
    L += [node(k) for k in transversal if cnt[k]]
    L.append("  end")
    L.append('  subgraph N["Dominios de negocio"]')
    L += [node(k) for k, *_ in DOMAINS if cnt[k] and k not in transversal]
    L.append("  end")
    for (a, b), n in sorted(pairs.items()):
        L.append(f'  {a} ---|{n}| {b}')
    L.append("  classDef default fill:#EAF3FC,stroke:#0A3A73,color:#15202E")
    L.append("  style T fill:#F7F9FC,stroke:#C9D3E1")
    L.append("  style N fill:#FFFFFF,stroke:#C9D3E1")
    return "\n".join(L) + "\n", edges


def render_svgs(er_dir, files):
    js = HERE / "render_mermaid.cjs"
    p = subprocess.run(["node", str(js), str(er_dir)] + files, capture_output=True, text=True)
    if p.returncode:
        print(p.stdout, p.stderr)
        raise SystemExit("Fallo el render de Mermaid (ver mensaje).")
    print(p.stdout.strip())


def write_index_html(er_dir, items):
    cards = []
    nav = []
    for key, title, sub in items:
        svg_path = er_dir / f"{key}.svg"
        svg = svg_path.read_text(encoding="utf-8") if svg_path.exists() else "<p>SVG no generado.</p>"
        nav.append(f'<a href="#{key}">{html.escape(title)}</a>')
        cards.append(f'<section id="{key}"><header><h2>{html.escape(title)}</h2><p>{html.escape(sub)} · '
                     f'<a href="{key}.svg">SVG</a> · <a href="{key}.mmd">Mermaid</a></p></header>'
                     f'<div class="svg">{svg}</div></section>')
    page = f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diagramas ER · Qhapaq</title>
<style>
:root{{--navy:#0A3A73;--ink:#15202E;--muted:#5A6B82;--line:#D5DEEA;--bg:#F6F8FB;--card:#fff}}
*{{box-sizing:border-box}}
body{{margin:0;font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg)}}
.top{{background:var(--navy);color:#fff;padding:20px 24px}}
.top h1{{margin:0;font-size:20px;font-weight:700}}
.top p{{margin:6px 0 0;font-size:13px;opacity:.85}}
nav{{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid var(--line);padding:10px 24px;display:flex;flex-wrap:wrap;gap:6px 14px}}
nav a{{color:var(--navy);text-decoration:none;font-size:13px;font-weight:600}}
nav a:hover{{text-decoration:underline}}
main{{padding:16px 24px 48px;max-width:100%}}
section{{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:0 0 20px;overflow:hidden}}
section header{{padding:12px 16px;border-bottom:1px solid var(--line)}}
section h2{{margin:0;font-size:16px;color:var(--navy)}}
section p{{margin:4px 0 0;font-size:12px;color:var(--muted)}}
section p a{{color:var(--navy)}}
.svg{{overflow:auto;max-height:85vh;padding:12px}}
.svg svg{{max-width:none!important;height:auto}}
@media (max-width:640px){{.top,nav,main{{padding-left:16px;padding-right:16px}}}}
</style></head><body>
<div class="top"><h1>Diagramas entidad-relación · Qhapaq Travel Suite</h1>
<p>Generado por build_reference.py desde el catálogo de PostgreSQL. Se omiten las FK a tenants(tenant_id) salvo en Plataforma; se muestran PK, FK, UK y columnas clave.</p></div>
<nav>{''.join(nav)}</nav><main>{''.join(cards)}</main></body></html>"""
    (er_dir / "index.html").write_text(page, encoding="utf-8")


# ----------------------------------------------------------------- verificación
def verify(cat, stats, csv_rows, er_fk_total):
    c = cat["counts"]
    errors = []
    n_tables = sum(s[0] for s in stats.values())
    n_cols = sum(s[1] for s in stats.values())
    n_fks = sum(s[2] for s in stats.values())
    if n_tables != c["tables"]:
        errors.append(f"tablas: diccionario {n_tables} ≠ catálogo {c['tables']}")
    if n_cols != c["columns"] or csv_rows != c["columns"]:
        errors.append(f"columnas: diccionario {n_cols} / CSV {csv_rows} ≠ catálogo {c['columns']}")
    if n_fks != c["fks"]:
        errors.append(f"FKs: diccionario {n_fks} ≠ catálogo {c['fks']}")
    ddir = HERE / "diccionario"
    md_tables = sum(len(re.findall(r"^### `", p.read_text(encoding="utf-8"), re.M)) for p in ddir.glob("*.md"))
    md_fks = sum(len(re.findall(r"^\| `[^`]+` \| `[^`]+\.[^`]+` \| (NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)", p.read_text(encoding="utf-8"), re.M))
                 for p in ddir.glob("*.md"))
    if md_tables != c["tables"]:
        errors.append(f"secciones de tabla en Markdown {md_tables} ≠ {c['tables']}")
    if md_fks != c["fks"]:
        errors.append(f"filas de FK en Markdown {md_fks} ≠ {c['fks']}")
    tenant_fks = sum(1 for t in cat["tables"] for k in t["fks"] if k["columns"] == ["tenant_id"] and t["domain"] != "plataforma")
    if er_fk_total + tenant_fks != c["fks"]:
        errors.append(f"FKs en ER {er_fk_total} + FK tenant_id omitidas {tenant_fks} ≠ {c['fks']}")
    print(f"Verificación: tablas {n_tables}/{c['tables']} · columnas {n_cols} (CSV {csv_rows})/{c['columns']} · "
          f"FKs {n_fks} (MD {md_fks}, ER {er_fk_total} + {tenant_fks} tenant_id)/{c['fks']}")
    if errors:
        raise SystemExit("ERROR de conteos:\n  " + "\n  ".join(errors))
    print("OK: los conteos de la salida coinciden con el catálogo.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pgbin", help="carpeta de binarios de PostgreSQL (default: PGBIN o /usr/lib/postgresql/{17,16}/bin)")
    ap.add_argument("--port", type=int, default=55447)
    ap.add_argument("--no-svg", action="store_true", help="no renderizar SVG (solo .mmd)")
    a = ap.parse_args()

    with pgcatalog.temp_cluster(a.pgbin, a.port) as psql:
        cat = pgcatalog.extract_catalog(psql)
    tables = analyze(cat)
    stats = write_dictionary(cat, tables, HERE)
    csv_rows = write_csv(cat, HERE)

    er_dir = HERE / "er"
    er_dir.mkdir(exist_ok=True)
    items, files, er_fk_total = [], [], 0
    ov, edges = er_overview(cat)
    (er_dir / "00-general.mmd").write_text(ov, encoding="utf-8")
    files.append("00-general")
    items.append(("00-general", "Vista general entre dominios", f"{len(edges)} relaciones entre dominios (FK sin tenant_id)"))
    for key, title, _d, _r in DOMAINS:
        if key not in stats:
            continue
        txt, nrel, nfk = er_domain(key, cat, tables)
        er_fk_total += nfk
        (er_dir / f"{key}.mmd").write_text(txt, encoding="utf-8")
        files.append(key)
        items.append((key, title, f"{stats[key][0]} tablas · {nfk} FK dibujadas en {nrel} relaciones"))
    if not a.no_svg:
        render_svgs(er_dir, files)
    write_index_html(er_dir, items)
    verify(cat, stats, csv_rows, er_fk_total)


if __name__ == "__main__":
    main()
