#!/usr/bin/env python3
"""Extrae todas las reglas de negocio con ID de las especificaciones y genera:

  kit-ia/referencia/REGLAS-DE-NEGOCIO.md
  kit-ia/referencia/REGLAS-DE-NEGOCIO.csv

Fuentes:
  - Tablas «| ID | Regla … | Dónde … |» de cualquier sección de proto/docs/especificaciones/NN-*.md
    (la §5 y las tablas «v2.1 — Reglas» de otras secciones).
  - Párrafos en negrita «**PRC-01 …**» (algoritmo de precios, 03 §5.1).
  - Catálogo de reglas activables: kit-ia/seeds/settings.json → bookingRules (32) + plans.json (reglas por plan)
    + tablas de efecto por regla (16 §5.1, 15 §5.1, 17 §5, 08 §5.7, 15 §5.2).

Uso: python3 kit-ia/referencia/tools/extract_rules.py
"""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import OrderedDict, defaultdict
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from specparse import KIT, MODULE_NAMES, iter_lines, iter_tables, md_escape, spec_files  # noqa: E402

OUT = KIT / "referencia"
ID_RE = re.compile(r"\b(?:[A-Z][A-Z0-9]*-)+\d{1,3}[a-z]?(?:-\d{2,3})?\b")
RT_WORD_RE = re.compile(r"\b(?:RT|Regla transversal)\s+(\d{1,2})\b")
RCODE_RE = re.compile(r"\bR-[A-Z][A-Z0-9-]*[A-Z0-9]\b")

settings = json.loads((KIT / "seeds" / "settings.json").read_text(encoding="utf-8"))
CATALOG = settings["bookingRules"]
CAT_IDS = [r["id"] for r in CATALOG]
plans = json.loads((KIT / "seeds" / "plans.json").read_text(encoding="utf-8"))
PLAN_RULES = {p["id"]: set(p.get("rules", [])) for p in plans}


def layers(where: str) -> str:
    w = where or ""
    tags = []
    checks = [
        ("FormRequest", r"FormRequest|\bFR\b|Request\b|Validator|validate"),
        ("Policy", r"Polic|\bP\b|permiso|Gate|ability|scope\b|Scope"),
        ("Middleware", r"[Mm]iddleware|RateLimiter|Guard|guard|Exception handler|Idempotency-Key|API 403"),
        ("Controller", r"Controller|\bAPI\b"),
        ("Service", r"Service|\bS\b|Engine|Resolver|Calculator|Logger|Throttler|transacci|Pricing|lock|Lock|BE\.|Adapter|Create[A-Z]"),
        ("Job/Listener", r"\b[Jj]ob\b|\bJ\b|Job\b|Listener|Observer|Scheduler|cron|evento|Event"),
        ("Query/Read model", r"Query|[Rr]ead model|[Vv]ista|cache"),
        ("BD", r"\bDB\b|CHECK|UNIQUE|[Cc]onstraint|trigger|[ÍíIi]ndice|RLS|exclusion|FK\b|Sin endpoint|SoftDeletes|[Ss]oft delete|BD\b|[Cc]olumna generada|sys_sequences|FOR UPDATE"),
        ("Resource", r"Resource"),
        ("App móvil", r"\bApp\b|\bapp\b|SQLite"),
        ("UI", r"\bUI\b|Frontend|front|Next|prototipo"),
        ("Infraestructura", r"Infra|Arquitectura"),
        ("Otra especificación", r"^Doc "),
    ]
    for name, pat in checks:
        if re.search(pat, w):
            tags.append(name)
    return " · ".join(tags) if tags else "Por definir"


def ids_in(cell: str) -> list[str]:
    found = []
    for m in ID_RE.finditer(cell):
        found.append(m.group(0))
    for m in RT_WORD_RE.finditer(cell):
        found.append(f"RT-{int(m.group(1))}")
    norm = []
    for x in found:
        x = re.sub(r"^RT-0(\d)$", r"RT-\1", x)
        if x not in norm:
            norm.append(x)
    return norm


def pick(header: list[str], *prefixes) -> int | None:
    for i, h in enumerate(header):
        hl = h.lower()
        if any(hl.startswith(p) for p in prefixes):
            return i
    return None


rules = []          # reglas con ID
r_effects = defaultdict(list)   # R-code → [(spec, sección, comportamiento, dónde/si apagada)]

for path in spec_files():
    for t in iter_tables(path):
        h = [x.strip() for x in t.header]
        h0 = h[0].lower() if h else ""
        # tablas de efecto de reglas activables (sin columna ID)
        if h0 == "regla" and len(h) >= 2 and not h[1].startswith("`"):
            for r in t.rows:
                codes = [c for c in RCODE_RE.findall(r[0]) if c in CAT_IDS]
                for c in codes:
                    r_effects[c].append((t.spec, t.section, f"{h[1]}: {r[1] if len(r) > 1 else ''}",
                                         f"{h[2]}: {r[2]}" if len(h) > 2 and len(r) > 2 else ""))
            continue
        if h0 in ("elemento", "lugar") and "R-OWN-REVIEWS" in t.section:
            for r in t.rows:
                r_effects["R-OWN-REVIEWS"].append((t.spec, t.section, f"{r[0]}: {r[1] if len(r) > 1 else ''}", ""))
            continue
        if h0 != "id":
            continue
        i_rule = pick(h, "regla")
        if i_rule is None:
            continue
        i_where = pick(h, "dónde", "donde")
        if i_where is None:
            i_where = len(h) - 1
        extra = [i for i in range(len(h)) if i not in (0, i_rule, i_where)]
        prev_where = ""
        for r in t.rows:
            if len(r) < 2:
                continue
            idcell = r[0]
            codes = [c for c in RCODE_RE.findall(idcell) if c in CAT_IDS]
            ids = ids_in(idcell)
            if codes and not ids:
                # fila de comportamiento de una regla activable (p. ej. 17 §5)
                for c in codes:
                    r_effects[c].append((t.spec, t.section, " — ".join(x for x in [r[i_rule]] + [r[i] for i in extra if i < len(r)] if x),
                                         r[i_where] if i_where < len(r) else ""))
                continue
            if not ids:
                continue
            text = r[i_rule] if i_rule < len(r) else ""
            behaviour = " ".join(f"{h[i]}: {r[i]}" for i in extra if i < len(r) and r[i])
            where = r[i_where] if i_where < len(r) else ""
            if where.strip().lower() in ("idem", "ídem", "igual", "id."):
                where = prev_where
            prev_where = where
            ids = [i for i in ids if not i.startswith(("PROC-", "E2E-"))] + [i for i in ids if i.startswith(("PROC-", "E2E-"))]
            blob = " ".join(r)
            act = [c for c in OrderedDict.fromkeys(RCODE_RE.findall(blob)) if c in CAT_IDS]
            label = re.sub(r"\s+", " ", re.sub(ID_RE, "", re.sub(RT_WORD_RE, "", idcell))).strip(" /()·,")
            rules.append(OrderedDict(
                id=ids[0], alias=" / ".join(ids[1:]), etiqueta=label,
                modulo=MODULE_NAMES.get(t.spec, t.spec), especificacion=t.file, seccion=t.section, linea=t.line,
                regla=text, comportamiento=behaviour, donde_se_valida=where, capa=layers(where),
                activable=" ".join(act), tipo="regla"))
    # reglas en negrita (PRC-xx)
    for n, sec, h2, ln in iter_lines(path):
        m = re.match(r"^\*\*((?:PRC)-\d+)\s+([^*]+)\*\*(.*)$", ln)
        if m:
            rules.append(OrderedDict(
                id=m.group(1), alias="", etiqueta=m.group(2).strip(), modulo=MODULE_NAMES.get(path.name[:2]),
                especificacion=path.name, seccion=sec, linea=n,
                regla=(m.group(2).strip() + ": " + m.group(3).strip(" :")).strip(), comportamiento="",
                donde_se_valida="Service (PricingService; autoridad backend)", capa="Service",
                activable="", tipo="algoritmo"))

# ------------------------------------------------------------ catálogo R-
def min_plan(rid, declared):
    for p in ("Starter", "Professional", "Enterprise"):
        if rid in PLAN_RULES.get(p, set()):
            return p
    return declared


catalog_rows = []
for r in CATALOG:
    catalog_rows.append(OrderedDict(
        id=r["id"], alias="", etiqueta=r["name"], modulo="Centro de reglas (activable)",
        especificacion="16-motor-de-reservas-y-reglas.md; 17-reglas-comunicaciones-monedas-resenas-integracion-web.md",
        seccion=f"Grupo: {r['group']}", linea="", regla=r["desc"],
        comportamiento=" | ".join(f"[{s}] {e}" for s, _sec, e, _w in r_effects.get(r["id"], [])),
        donde_se_valida="BookingEngine::on() / RuleRegistry (Service) + sys_booking_rules", capa="Service · BD",
        activable=r["id"], tipo="activable",
        plan_minimo=r.get("minPlan", ""), plan_segun_planes=min_plan(r["id"], r.get("minPlan", "")),
        habilitada_demo="sí" if r.get("enabled") else "no", override_producto="sí" if r.get("productOverride") else "no",
        parametros=json.dumps(r.get("params", {}), ensure_ascii=False), alcance=", ".join(r.get("scope", []))))

# referencias cruzadas: reglas que mencionan cada R-
refs = defaultdict(list)
for x in rules:
    for c in x["activable"].split():
        refs[c].append(x["id"])

# ------------------------------------------------------------ CSV
fields = ["id", "alias", "tipo", "modulo", "especificacion", "seccion", "linea", "etiqueta", "regla", "comportamiento",
          "donde_se_valida", "capa", "activable", "plan_minimo", "override_producto", "parametros", "alcance"]
with open(OUT / "REGLAS-DE-NEGOCIO.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    for x in rules + catalog_rows:
        w.writerow({k: x.get(k, "") for k in fields})

# ------------------------------------------------------------ Markdown
by_spec = defaultdict(list)
for x in rules:
    by_spec[x["especificacion"]].append(x)
prefixes = defaultdict(int)
for x in rules:
    prefixes[re.sub(r"-\d+[a-z]?(-\d+)?$", "", x["id"])] += 1
uniq = len({x["id"] for x in rules})

# índice RT
rt = defaultdict(list)
for x in rules:
    for i in [x["id"]] + [a for a in x["alias"].split(" / ") if a]:
        if i.startswith("RT-"):
            rt[int(i[3:])].append(x)

L = []
L.append("# Reglas de negocio — catálogo de referencia")
L.append("")
L.append("> Generado por `kit-ia/referencia/tools/extract_rules.py` desde `proto/docs/especificaciones/*.md` y "
         "`kit-ia/seeds/settings.json` (`bookingRules`) + `plans.json`. No editar a mano: corregir la especificación y regenerar. "
         "La versión tabular completa (con columna de comportamiento) está en `REGLAS-DE-NEGOCIO.csv`.")
L.append("")
L.append(f"**Cifras:** {len(rules)} filas de regla ({uniq} IDs distintos; una misma regla puede repetirse en varias "
         f"especificaciones con matices propios) en {len(by_spec)} especificaciones · {len(catalog_rows)} reglas activables "
         f"del centro de reglas · {len(rt)} reglas transversales (RT-n) referenciadas.")
L.append("")
L.append("## 1. Cómo leer este catálogo")
L.append("")
L.append("- **ID**: identificador principal tal como aparece en la especificación (primera clave de la celda). Los alias "
         "(`RT-n`, `PRD-BR-nnn` de la documentación inicial, etc.) se listan en la columna *Alias*.")
L.append("- **Dónde se valida**: texto literal de la especificación. *Capa* lo normaliza: `FormRequest` (validación de "
         "entrada), `Policy` (autorización/alcance), `Middleware`, `Service` (servicio de dominio, transacción, locks), "
         "`Job/Listener`, `BD` (CHECK, UNIQUE, índices parciales, triggers, RLS), `Resource` (serialización condicional), "
         "`UI`. Abreviaturas de las specs: **FR** = FormRequest, **P** = Policy, **S** = Service, **DB** = constraint, **J** = Job.")
L.append("- **Activable**: reglas del centro de reglas (`R-…`, tabla `sys_booking_rules`) que gobiernan la regla. "
         "Si la regla activable está apagada para el tenant o el producto (override), el comportamiento desaparece "
         "(`BookingEngine::on(rule, product)`).")
L.append("- Una regla citada solo como referencia (sin fila propia) no se duplica aquí; búsquela por su ID en la columna *Alias*.")
L.append("")
L.append("### Prefijos de ID")
L.append("")
L.append("| Prefijo | Filas | Prefijo | Filas | Prefijo | Filas |")
L.append("|---|---|---|---|---|---|")
pf = sorted(prefixes.items(), key=lambda kv: (-kv[1], kv[0]))
for i in range(0, len(pf), 3):
    cells = []
    for k, v in pf[i:i + 3]:
        cells += [f"`{k}`", str(v)]
    while len(cells) < 6:
        cells += ["", ""]
    L.append("| " + " | ".join(cells) + " |")
L.append("")

L.append("## 2. Catálogo de reglas activables (centro de reglas)")
L.append("")
L.append(f"Fuente: `kit-ia/seeds/settings.json → bookingRules` ({len(CATALOG)} reglas) · tabla `sys_booking_rules` "
         "(por tenant, `code`, `enabled`, `params`, `params_schema`, `product_override`, `min_plan`) y catálogo de "
         "plataforma `sys_booking_rule_catalog` + `plan_rule_entitlements`. Las especificaciones 16 §3.1 y 01_platform.sql "
         "hablan de 31 reglas; la semilla trae 32 porque v2.2 agregó `R-OWN-REVIEWS` (spec 18).")
L.append("")
L.append("| Código | Grupo | Nombre | Plan mínimo | Override por producto | Activa en demo | Parámetros (valores demo) | Canales | Reglas con ID que la citan |")
L.append("|---|---|---|---|---|---|---|---|---|")
for r, c in zip(CATALOG, catalog_rows):
    mp = c["plan_minimo"]
    if c["plan_segun_planes"] != mp:
        mp += f" (plans.json: {c['plan_segun_planes']})"
    params = ", ".join(f"`{k}={json.dumps(v, ensure_ascii=False)}`" for k, v in r.get("params", {}).items()) or "—"
    cites = ", ".join(sorted(set(refs.get(r["id"], [])))) or "—"
    L.append(f"| `{r['id']}` | {r['group']} | {md_escape(r['name'])} | {mp} | {c['override_producto']} | "
             f"{c['habilitada_demo']} | {params} | {', '.join(r.get('scope', []))} | {cites} |")
L.append("")
L.append("### 2.1 Qué hace cada regla activable en cada módulo")
L.append("")
for r in CATALOG:
    eff = r_effects.get(r["id"], [])
    L.append(f"**`{r['id']}` — {r['name']}.** {r['desc']}")
    L.append("")
    if eff:
        for s, sec, e, wtxt in eff:
            extra = f" ({md_escape(wtxt)})" if wtxt else ""
            L.append(f"- *{s} {sec}*: {md_escape(e)}{extra}")
    else:
        L.append("- Sin tabla de efecto específica en las especificaciones (ver descripción).")
    L.append("")

L.append("## 3. Reglas transversales (RT-n)")
L.append("")
L.append("Numeración heredada de la documentación inicial: `RT-n` = regla transversal n de DOC-PROC-001 §30 («Regla transversal n»). Cada módulo la aplica con su propio ID; "
         "esta tabla agrupa dónde aparece cada una.")
L.append("")
L.append("| RT | Texto (primera aparición) | Aparece como |")
L.append("|---|---|---|")
for n in sorted(rt):
    xs = rt[n]
    first = next((x for x in xs if x["id"] == f"RT-{n}"), xs[0])
    where = ", ".join(sorted({f"{x['id']} ({x['especificacion'][:2]})" for x in xs}))
    L.append(f"| RT-{n} | {md_escape(first['regla'])[:300]} | {where} |")
L.append("")

L.append("## 4. Reglas por especificación")
L.append("")
for spec in sorted(by_spec):
    xs = by_spec[spec]
    L.append(f"### {spec[:2]} · {MODULE_NAMES.get(spec[:2], spec)} (`{spec}`) — {len(xs)} reglas")
    L.append("")
    L.append("| ID | Alias | Sección | Regla | Dónde se valida | Capa | Activable |")
    L.append("|---|---|---|---|---|---|---|")
    for x in xs:
        txt = x["regla"]
        if x["etiqueta"] and x["tipo"] == "regla":
            txt = f"*({x['etiqueta']})* " + txt
        L.append(f"| `{x['id']}` | {md_escape(x['alias'])} | {md_escape(x['seccion'])} | {md_escape(txt)} | "
                 f"{md_escape(x['donde_se_valida'])} | {x['capa']} | {' '.join('`'+a+'`' for a in x['activable'].split())} |")
    L.append("")

L.append("## 5. Supuestos y notas")
L.append("")
L.append("- La columna *Capa* es una normalización automática del texto «Dónde se valida»; ante duda manda el texto literal.")
L.append("- Reglas con el mismo ID en dos especificaciones (p. ej. `RT-4 / PRD-BR-012` en Reservas y en Canales) se listan "
         "en ambas porque cada spec agrega su mensaje o su punto de validación.")
L.append("- El plan mínimo sale de `bookingRules[].minPlan`; si `plans.json` incluye la regla en un plan inferior se indica entre paréntesis.")
L.append("- Los parámetros mostrados son los valores de la semilla demo; los rangos válidos los fija `params_schema` (17 §3.1, CR-01).")
(OUT / "REGLAS-DE-NEGOCIO.md").write_text("\n".join(L) + "\n", encoding="utf-8")
print(f"reglas: {len(rules)} filas · {uniq} IDs · activables: {len(catalog_rows)} · RT: {len(rt)} · specs: {len(by_spec)}")
