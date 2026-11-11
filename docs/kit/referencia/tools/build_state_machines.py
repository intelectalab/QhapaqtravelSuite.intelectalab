#!/usr/bin/env python3
"""Genera kit-ia/referencia/MAQUINAS-DE-ESTADO.md.

Uso:  python3 kit-ia/referencia/tools/build_state_machines.py [--pgbin DIR] [--no-check]

1. Levanta un cluster PostgreSQL temporal, carga 00→90 y toma del catálogo todas las columnas de estado
   (nombre con status/state/stage y CHECK de lista cerrada de valores).
2. Para cada columna lee las fuentes declaradas en `estados_fuentes.py`: tablas «Desde | Hacia» de la §4 de
   las especificaciones (proto/docs/especificaciones) y transiciones transcritas de la prosa.
3. Escribe una sección por entidad con valores, estados iniciales/terminales, transiciones y un diagrama
   Mermaid `stateDiagram-v2`, y valida la sintaxis de los diagramas con Mermaid (Chromium headless).
"""
import argparse
import json
import re
import subprocess
import sys
import tempfile
from collections import OrderedDict, defaultdict
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
KIT = HERE.parent.parent                       # kit-ia/
ROOT = KIT.parent                              # carpeta del proyecto
SPEC_DIR = ROOT / "proto" / "docs" / "especificaciones" if (ROOT / "proto" / "docs" / "especificaciones").is_dir() else ROOT / "especificaciones"
OUT = HERE.parent / "MAQUINAS-DE-ESTADO.md"
REF_DB = KIT / "database" / "referencia"
sys.path.insert(0, str(REF_DB))
sys.path.insert(0, str(HERE))
import pgcatalog  # noqa: E402
from estados_fuentes import ENTIDADES  # noqa: E402

INIT = "*"
OPENAPI = KIT / "api" / "openapi.json"


def load_endpoints():
    """Operaciones de escritura del contrato agrupadas por `x-resource` (= tabla)."""
    if not OPENAPI.exists():
        return {}
    d = json.loads(OPENAPI.read_text(encoding="utf-8"))
    by = defaultdict(list)
    for path, item in d["paths"].items():
        for m, o in item.items():
            if isinstance(o, dict) and m in ("post", "put", "patch", "delete") and o.get("x-resource"):
                by[o["x-resource"]].append((m.upper(), path, o.get("x-permission", ""), o.get("x-spec", ""), o.get("summary", ""),
                                            bool(o.get("x-idempotency"))))
    return by
STATE_COL = re.compile(r"status|state|stage")


# ----------------------------------------------------------------- lectura de especificaciones
_spec_cache = {}


def spec_file(n):
    files = sorted(SPEC_DIR.glob(f"{n}-*.md"))
    if not files:
        raise SystemExit(f"No existe la especificación {n} en {SPEC_DIR}")
    return files[0]


def spec_lines(n):
    if n not in _spec_cache:
        _spec_cache[n] = spec_file(n).read_text(encoding="utf-8").splitlines()
    return _spec_cache[n]


def section_text(src):
    lines = spec_lines(src["spec"])
    try:
        s4 = next(i for i, l in enumerate(lines) if re.match(r"^## 4\.", l))
    except StopIteration:
        raise SystemExit(f"Spec {src['spec']} sin sección «## 4.»")
    e4 = next((i for i in range(s4 + 1, len(lines)) if re.match(r"^## \d", lines[i])), len(lines))
    if src["sec"] == "4":
        start, level = s4, 2
    else:
        pat = re.compile(r"^(#{3,4}) " + re.escape(src["sec"]) + r"(\b|\s|$)")
        start = next((i for i in range(s4, e4) if pat.match(lines[i])), None)
        if start is None:
            raise SystemExit(f"No se encontró «{src['sec']}» en la §4 de la spec {src['spec']}")
        level = len(pat.match(lines[start]).group(1))
    end = next((i for i in range(start + 1, e4) if re.match(r"^#{1,%d} " % level, lines[i])), e4)
    body = lines[start:end]
    if src.get("row"):
        hdr = None
        for i, l in enumerate(body):
            if l.startswith("|") and hdr is None:
                hdr = body[i:i + 2]
            if l.startswith("| " + src["row"] + " |"):
                return "\n".join((hdr or []) + [l])
        raise SystemExit(f"Fila «{src['row']}» no encontrada en spec {src['spec']} §{src['sec']}")
    if src.get("para"):
        i = next((i for i, l in enumerate(body) if l.startswith(src["para"])), None)
        if i is None:
            raise SystemExit(f"Párrafo «{src['para']}» no encontrado en spec {src['spec']}")
        j = i + 1
        while j < len(body) and body[j].strip() and not body[j].startswith("**"):
            j += 1
        return "\n".join(body[i:j])
    return "\n".join(body)


def heading_of(src):
    lines = spec_lines(src["spec"])
    if src["sec"] == "4":
        h = "§4"
    else:
        h = next((l.lstrip("#").strip() for l in lines if re.match(r"^#{3,4} " + re.escape(src["sec"]) + r"(\b|\s|$)", l)), src["sec"])
        h = re.sub(r"\s*\(.*\)\s*$", "", h).strip()
        h = "§" + h if h[0].isdigit() else h
    extra = f" · {src['row']}" if src.get("row") else (f" · {src['para'].strip('*: ')}" if src.get("para") else "")
    return f"spec {src['spec']} {h}{extra}"


def short_ref(src):
    return f"{src['spec']} §{src['sec']}" if src["sec"] != "4" else f"{src['spec']} §4"


def split_row(line):
    s = line.strip().strip("|").replace("\\|", "\x00")
    return [c.strip().replace("\x00", "|") for c in s.split("|")]


def tables_in(text):
    out, cur = [], []
    for l in text.splitlines() + [""]:
        if l.startswith("|"):
            cur.append(l)
        else:
            if len(cur) >= 3:
                out.append(cur)
            cur = []
    return out


def classify_header(h):
    k = h.lower().strip()
    if k in ("desde", "de"):
        return "desde"
    if k in ("hacia", "a"):
        return "hacia"
    if k.replace(" ", "") == "de→a":
        return "dea"
    if k.startswith("transición"):
        return "transicion"
    if k.startswith(("disparador", "acción", "accion", "disparo", "evento")):
        return "accion"
    if k.startswith(("quién", "quien", "permiso")):
        return "quien"
    if k.startswith(("condición / efectos", "condicion / efectos")):
        return "efectos"
    if k.startswith(("condici", "guardas", "validaci")):
        return "guardas"
    if k.startswith("efecto"):
        return "efectos"
    return None


def parse_tables(src):
    rows = []
    for tb in tables_in(section_text(src)):
        hdr = split_row(tb[0])
        kinds = [classify_header(h) for h in hdr]
        if not ({"desde", "hacia"} <= set(kinds) or "dea" in kinds or "transicion" in kinds):
            continue
        perm_hdr = " ".join(re.findall(r"`([^`]+)`", " ".join(h for h, k in zip(hdr, kinds) if k == "quien")))
        for line in tb[2:]:
            cells = split_row(line)
            r = dict(desde="", hacia="", accion="", quien="", guardas="", efectos="", ref=short_ref(src))
            for k, c in zip(kinds, cells):
                if k == "dea":
                    a, _, b = c.partition("→")
                    r["desde"], r["hacia"] = a.strip(), b.strip()
                elif k == "transicion":
                    if "→" in c:
                        a, _, b = c.partition("→")
                        r["desde"], r["hacia"] = a.strip(), b.strip()
                        if "accion" not in kinds:
                            r["accion"] = c
                    else:
                        r["desde"], r["hacia"], r["accion"] = c, "", c
                        r["sin_flecha"] = True
                elif k:
                    r[k] = (r[k] + " · " + c).strip(" ·") if r[k] else c
            if perm_hdr and perm_hdr not in r["quien"]:
                r["quien"] = (r["quien"] + " · " if r["quien"] else "") + f"`{perm_hdr}`"
            if not r["quien"]:
                perms = re.findall(r"`([a-z_]+(?:\.[a-z_]+)+)`", r["accion"])
                if perms:
                    r["quien"] = ", ".join(f"`{p}`" for p in dict.fromkeys(perms))
            rows.append(r)
    return rows


# ----------------------------------------------------------------- resolución de estados en una celda
def norm(cell):
    return re.sub(r"\s+", " ", cell.replace("`", "").replace("**", "")).strip()


def find_tokens(text, values):
    found = []
    for v in values:
        variants = {v, v.replace("_", " ")}
        for var in variants:
            for m in re.finditer(r"(?<![\w])" + re.escape(var) + r"(?![\w])", text):
                found.append((m.start(), v))
    found.sort()
    seen, out = set(), []
    for _p, v in found:
        if v not in seen:
            seen.add(v)
            out.append(v)
    return out


def resolve(cell, side, values, ent):
    raw = norm(cell)
    low = raw.lower()
    r = dict(states=[], init=False, same=False, none=False, reverse=False, chain=False, nochange=False, generic=False)
    celda = ent.get("celda", {})
    if raw in celda:
        st = celda[raw]
        r["init"] = INIT in st
        r["states"] = [s for s in st if s != INIT]
        r["nochange"] = not st
        r["generic"] = True
        return r
    alias = {k.lower(): v for k, v in ent.get("alias", {}).items()}
    if low in alias:
        st = alias[low]
        r["init"] = INIT in st
        r["states"] = [s for s in st if s != INIT]
        r["nochange"] = not st
        r["generic"] = True
        return r
    if side == "hacia":
        if low in ("—", "-", ""):
            r["none"] = True
            return r
        if low in ("=", "(mismo)", "(igual)", "(misma)", "misma", "mismo", "(sin cambio)", "sin cambio") or low.startswith(("(mism", "(igual", "misma")):
            r["same"] = True
            return r
        if "(nueva)" in low or "nueva solicitud" in low:
            r["init"] = True
    else:
        first = low.split(" ")[0] if low else ""
        if low in ("", "—", "-") or low.startswith(("—", "(nuev", "(sin registro)", "(disponible)")) or first in ("alta", "invitar", "crear"):
            r["init"] = True
    rest = low
    for phrase in sorted(alias, key=len, reverse=True):
        if phrase in rest:
            r["states"] += [s for s in alias[phrase] if s != INIT]
            r["init"] = r["init"] or INIT in alias[phrase]
            rest = rest.replace(phrase, " ")
            r["generic"] = True
    if re.match(r"^(\(?cualquier\w*( estado)?\s*\(?)?(≠|salvo|distinto|no )", low) and (low.startswith(("cualquier", "≠", "no ", "(≠"))):
        excl = find_tokens(raw, values)
        r["states"] = [v for v in values if v not in excl]
        r["generic"] = True
        return r
    if low.startswith("cualquier") and not find_tokens(raw, values):
        r["states"] = list(values)
        r["generic"] = True
        return r
    if rest == low:
        toks = find_tokens(raw, values)
    else:  # se consumió un alias: buscar el resto sin distinguir mayúsculas
        toks = [next(v for v in values if v.lower() == t) for t in find_tokens(rest, [v.lower() for v in values])]
    for t in toks:
        if t not in r["states"]:
            r["states"].append(t)
    r["reverse"] = "viceversa" in low
    r["chain"] = side == "hacia" and "→" in raw and len(r["states"]) >= 2
    if not r["states"] and not r["init"]:
        r["unresolved"] = True
    return r


def leftover(cell, res):
    t = norm(cell)
    for s in res["states"]:
        t = re.sub(r"(?<![\w])" + re.escape(s) + r"(?![\w])", " ", t)
        t = re.sub(r"(?<![\w])" + re.escape(s.replace("_", " ")) + r"(?![\w])", " ", t)
    t = re.sub(r"[—\-/|,·()\s]+|\b(o|y)\b", " ", t).strip()
    return t


# ----------------------------------------------------------------- construcción de cada máquina
def build_entity(key, ent, col, table):
    values = col["values"]
    rows = []
    for src in ent.get("fuentes", []):
        if src.get("tabla"):
            rows += [dict(r, origen="tabla") for r in parse_tables(src)]
    for t in ent.get("t", []):
        rows.append(dict(desde=t["desde"].replace("|", " | ").replace("*", "—"), hacia=t["hacia"].replace("|", " | ").replace("*", "—"),
                         accion=t["accion"], quien=t["quien"], guardas=t["guardas"], efectos=t["efectos"],
                         ref=t["ref"] or ", ".join(short_ref(s) for s in ent.get("fuentes", [])[:1]),
                         origen="prosa", _curada=t))
    edges, dedges = OrderedDict(), OrderedDict()
    out_rows, nochange_rows = [], []
    for r in rows:
        if r.get("_curada"):
            c = r["_curada"]
            F = dict(states=[s for s in c["desde"].split("|") if s != INIT], init=INIT in c["desde"].split("|"))
            H = dict(states=[s for s in c["hacia"].split("|") if s != INIT], init=False, same=False, none=False, reverse=False, chain=False, nochange=False)
            for s in F["states"] + H["states"]:
                if s not in values:
                    raise SystemExit(f"{key}: el estado «{s}» de una transición transcrita no está en el CHECK {values}")
            r["d_fmt"], r["h_fmt"] = fmt_states(F["states"], F["init"]), fmt_states(H["states"], False)
        else:
            if r.get("sin_flecha") and not norm(r["desde"]).lower().startswith(("crear", "alta", "invitar")):
                nochange_rows.append(r)
                continue
            if r.get("sin_flecha"):  # «crear (`activa`)»: alta directa
                F = dict(states=[], init=True)
                H = resolve(r["desde"], "hacia", values, ent)
                H["states"] = [s for s in H["states"]]
            else:
                F = resolve(r["desde"], "desde", values, ent)
                H = resolve(r["hacia"], "hacia", values, ent)
            if H.get("init") and not H.get("same"):
                F = dict(states=[], init=True, generic=False)
            if H.get("none") or H.get("nochange") or F.get("nochange") or (not H["states"] and not H.get("same")) or (not F["states"] and not F.get("init")):
                nochange_rows.append(r)
                continue
            r["d_fmt"] = fmt_states(F["states"], F.get("init"), r["desde"], F)
            r["h_fmt"] = fmt_states(H["states"], False, r["hacia"], H) if not H.get("same") else "(mismo estado)"
        # aristas
        pairs = []
        froms = ([INIT] if F.get("init") else []) + F["states"]
        if H.get("same"):
            pairs = [(f, f) for f in F["states"]]
        elif H.get("chain"):
            for f in froms:
                pairs.append((f, H["states"][0]))
            pairs += list(zip(H["states"], H["states"][1:]))
        else:
            for f in froms:
                for h in H["states"]:
                    if f == h and (len(H["states"]) > 1 or (F.get("generic") and len(F["states"]) > 1)):
                        continue
                    pairs.append((f, h))
                    if H.get("reverse") and f != INIT:
                        pairs.append((h, f))
        r["pairs"] = pairs
        for p in pairs:
            edges.setdefault(p, []).append(r)
        # dibujo: un origen genérico amplio («cualquiera ≠ …», «no cerrada», «abierta») se dibuja como un nodo agrupador
        if F.get("generic") and len(F["states"]) >= 4 and not H.get("same") and not F.get("init"):
            g = ("G", norm(r["desde"]))
            dpairs = [(g, h) for h in H["states"]]
            if H.get("reverse"):
                dpairs += [(h, g) for h in H["states"]]
        else:
            dpairs = pairs
        for p in dpairs:
            dedges.setdefault(p, []).append(r)
        out_rows.append(r)
    return out_rows, nochange_rows, edges, dedges


def fmt_states(states, init, cell=None, res=None):
    parts = (["— (alta)"] if init else []) + [f"`{s}`" for s in states]
    txt = ", ".join(parts) if parts else "—"
    if cell is not None and res is not None:
        lo = leftover(cell, res)
        if lo and (res.get("generic") or lo):
            txt += f" <br>_spec: «{md(norm(cell))}»_"
    return txt


def md(s):
    return (s or "").replace("|", "\\|").replace("\n", " ")


def label(s):
    s = re.sub(r"\(`?[A-Z]{3,6}`?\s*\S*\)", "", s or "")
    s = re.sub(r"[`*\"'#;:{}<>|\[\]]", "", s)
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s+([,.])", r"\1", s).strip(" ,.-·")
    return (s[:34].rstrip() + "…") if len(s) > 35 else s


def mermaid(values, edges, terminales, omit, initial_default=None):
    states = list(values)
    lines = ["stateDiagram-v2"]
    if len(states) <= 4:
        lines.append("  direction LR")
    used, groups = set(), {}

    def node(x):
        if isinstance(x, tuple):
            if x not in groups:
                groups[x] = f"g{len(groups) + 1}"
                txt = re.sub(r"[\"`*:;#{}<>|]", "", x[1]).strip()
                lines.append(f'  state "Desde: {txt}" as {groups[x]}')
            return groups[x]
        return "[*]" if x == INIT else x
    for (f, t), rs in edges.items():
        if (f, t) in omit:
            continue
        lab = label(rs[0]["accion"]) or label(rs[0].get("quien", ""))
        if len(rs) > 1:
            lab = (lab + f" +{len(rs) - 1}").strip()
        a, b = node(f), node(t)
        lines.append(f"  {a} --> {b}" + (f" : {lab}" if lab else ""))
        used.update([f, t])
    if initial_default and not any(f == INIT for f, _ in edges if not isinstance(f, tuple)):
        lines.append(f"  [*] --> {initial_default} : default SQL")
        used.add(initial_default)
    for s in terminales:
        lines.append(f"  {s} --> [*]")
        used.add(s)
    for s in states:
        if s not in used:
            lines.append(f"  {s}")
    if groups:
        lines.append("  classDef grupo fill:#FFFFFF,stroke:#8A9BB3,stroke-dasharray:4 3,color:#4A5568,font-style:italic")
        lines += [f"  class {g} grupo" for g in groups.values()]
    return "\n".join(lines)


# ----------------------------------------------------------------- documento
IMPLEMENTATION_NOTE = """## Cómo implementarlas

- **Enum de PHP con los mismos valores del CHECK.** Un `enum` respaldado por `string` por columna de estado, con los valores **idénticos** a los de la tabla «Valores válidos» de cada sección (son los del `CHECK` de SQL; no traducir ni cambiar mayúsculas). Ejemplo para `quote_quotes.status`:

  ```php
  enum QuoteStatus: string
  {
      case Borrador = 'borrador';
      case Enviada = 'enviada';
      // … un case por cada valor del CHECK
  }
  ```

  Una prueba unitaria compara `QuoteStatus::cases()` con el CHECK (ver `kit-ia/tests/pest/Unit/Quotes/QuoteStateMachineTest.php`, prueba «los estados coinciden con el CHECK»).
- **Cambios solo vía la máquina de estados del dominio.** Cada dominio declara su grafo en `App\\Domain\\<Dominio>\\StateMachines\\<Entidad>StateMachine` (`can($from, $to)`, `assertTransition($from, $to)`, `allowedFrom($from)`, `states()`), tomando las transiciones de este documento. Nunca `update(['status' => …])` directo (backend/CLAUDE.md, CONVENCIONES §2). Una transición no declarada lanza `TransitionNotAllowed` → **409** con `code`; una guarda de negocio incumplida → **409/422** con el `code` de la regla (p. ej. `QTE-BR-16`, `RT-3`).
- **Guardas y efectos en la acción.** La acción de dominio (`App\\Domain\\<Dominio>\\Actions\\…`) valida permiso (`x-permission` del contrato), guardas y `lock_version` (`If-Match` → 409), aplica el cambio y los efectos en **una transacción** con `SET LOCAL app.tenant_id`, y registra los eventos de dominio en `sys_outbox`.
- **Auditoría.** Toda transición escribe `audit_events` con entidad, acción (la indicada en «Efectos», p. ej. `cambio_estado`, `aprobar`), estado anterior → nuevo, actor (o Sistema) y motivo cuando la spec lo exige. Las bitácoras específicas (`fin_status_history`, `crm_case_events`, `collab_approval_events`, `mkt_consent_events`, `ops_incident_logs`…) se escriben además donde existan.
- **Transiciones automáticas** (jobs, webhooks, listeners) pasan por la misma máquina con actor `Sistema`; los jobs multi-tenant despachan un job por tenant.
- **Estados derivados** (vencida por fecha, estado efectivo de agencia, «Por responder» de la extranet, etc.) no se persisten salvo que la sección diga lo contrario: se calculan en lectura.
- **«Transiciones por definir»**: la columna existe con su CHECK pero ninguna spec documenta transiciones. No inventarlas: registrar la decisión en `docs/04-HALLAZGOS-Y-DECISIONES.md` antes de programarlas.
"""


ENDPOINTS = {}


def endpoints_block(table):
    eps = ENDPOINTS.get(table, [])
    if not eps:
        return []
    L = [f"<details><summary>Endpoints de escritura del contrato sobre <code>{table}</code> ({len(eps)}, de <code>api/openapi.yaml</code>)</summary>\n",
         "| Método | Ruta | Permiso (`x-permission`) | Spec | Idempotente |", "|---|---|---|---|---|"]
    for m_, p_, perm, xs, _sum, idem in eps:
        L.append(f"| {m_} | `{p_}` | {md(perm)} | {md(xs)} | {'sí' if idem else ''} |")
    return L + ["\n</details>\n"]


def generate(cat, check_mermaid=True):
    ENDPOINTS.update(load_endpoints())
    tables = {t["name"]: t for t in cat["tables"]}
    cols = []
    for t in cat["tables"]:
        for k in t["constraints"]:
            if k["type"] != "c":
                continue
            r = pgcatalog.check_values(k["def"])
            if r and STATE_COL.search(r[0]):
                col = next(c for c in t["columns"] if c["name"] == r[0])
                cols.append(dict(table=t["name"], column=r[0], values=r[1], default=col["default"], not_null=col["not_null"],
                                 origin=t["origin"], comment=t["comment"] or ""))
    keys = {f"{c['table']}.{c['column']}" for c in cols}
    unknown = sorted(set(ENTIDADES) - keys)
    if unknown:
        raise SystemExit("estados_fuentes.py menciona columnas que no existen con CHECK de estado: " + ", ".join(unknown))

    def sort_key(c):
        k = f"{c['table']}.{c['column']}"
        e = ENTIDADES.get(k)
        spec = e["fuentes"][0]["spec"] if e and e.get("fuentes") else "99"
        return (spec, c["table"], c["column"])

    cols.sort(key=sort_key)
    sections, index_rows, diagrams = [], [], {}
    stats = dict(con=0, sin=0, transiciones=0, aristas=0)
    for n, c in enumerate(cols, 1):
        key = f"{c['table']}.{c['column']}"
        ent = ENTIDADES.get(key)
        default = None
        if c["default"]:
            m = re.match(r"'(.*?)'", c["default"])
            default = m.group(1) if m else None
        anchor = f"m-{c['table']}-{c['column']}".replace("_", "-")
        title = ent["titulo"] if ent else (re.sub(r"\s*\[[^\]]*\]", "", c["comment"]).strip().split(". ")[0].rstrip(".") or c["table"])
        L = [f'<a id="{anchor}"></a>', f"### {n}. {title} — `{key}`\n"]
        L.append(f"| Tabla | Columna | Fase | Nulo | Default |")
        L.append("|---|---|---|---|---|")
        L.append(f"| `{c['table']}` | `{c['column']}` | {pgcatalog.PHASE_LABEL[c['origin']]} (`{c['origin']}.sql`) | {'no' if c['not_null'] else 'sí'} | {('`' + c['default'] + '`') if c['default'] else '—'} |\n")
        L.append("**Valores válidos (CHECK):** " + ", ".join(f"`{v}`" for v in c["values"]) + "\n")
        if not ent or (not ent.get("t") and not any(s.get("tabla") for s in ent.get("fuentes", []))):
            stats["sin"] += 1
            L.append("**Transiciones por definir (solo valores en SQL).** Ninguna especificación documenta las transiciones de esta columna en su §4.\n")
            if default:
                L.append(f"**Estado inicial:** `{default}` (default SQL).\n")
            if ent:
                L.append("**Fuentes revisadas:** " + "; ".join(f"{heading_of(s)} (`{spec_file(s['spec']).name}`)" for s in ent.get("fuentes", [])) + "\n")
                for nt in ent.get("notas", []):
                    L.append(f"- {nt}")
                L.append("")
            L += endpoints_block(c["table"])
            mm = mermaid(c["values"], {}, [], set(), default)
            diagrams[key] = mm
            L.append("```mermaid\n" + mm + "\n```\n")
            index_rows.append(f"| {n} | [{md(title)}](#{anchor}) | `{key}` | {pgcatalog.PHASE_LABEL[c['origin']]} | {len(c['values'])} | Por definir | — |")
            sections.append("\n".join(L))
            continue
        stats["con"] += 1
        rows, nochange, edges, dedges = build_entity(key, ent, c, tables[c["table"]])
        omit = {(INIT if a == "*" else a, b) for a, b in ent.get("omitir_diagrama", [])}
        initials = list(dict.fromkeys(t for (f, t) in edges if f == INIT and (f, t) not in omit))
        terminales = ent.get("terminales", [])
        outgoing = defaultdict(set)
        for (f, t) in edges:
            if f != t:
                outgoing[f].add(t)
        reached = {s for p in edges for s in p if s != INIT}
        sin_salida = [s for s in c["values"] if s in reached and not outgoing[s] and s not in terminales]
        untouched = [s for s in c["values"] if s not in reached]
        stats["transiciones"] += len(rows)
        stats["aristas"] += len([e for e in edges if e not in omit])
        L.append("**Estados iniciales:** " + (", ".join(f"`{s}`" for s in initials) if initials else
                                                (f"`{default}` (default SQL; la spec no documenta el alta)" if default else "no documentados")) + "  ")
        L.append("**Estados terminales:** " + (", ".join(f"`{s}`" for s in terminales) if terminales else "no declarados en la spec") + "  ")
        if sin_salida:
            L.append("**Sin transiciones de salida documentadas:** " + ", ".join(f"`{s}`" for s in sin_salida) + "  ")
        if untouched:
            L.append("**Valores del CHECK sin transiciones documentadas:** " + ", ".join(f"`{s}`" for s in untouched) + " (Por definir)  ")
        L.append("**Fuentes:** " + "; ".join(f"{heading_of(s)} (`{spec_file(s['spec']).name}`)" for s in ent["fuentes"]) + "\n")
        L.append("| Desde | Hacia | Acción / endpoint | Permiso / quién | Guardas | Efectos | Ref. |")
        L.append("|---|---|---|---|---|---|---|")
        for r in rows:
            L.append(f"| {r['d_fmt']} | {r['h_fmt']} | {md(r['accion'])} | {md(r['quien'])} | {md(r['guardas'])} | {md(r['efectos'])} | {md(r['ref'])}{' (prosa)' if r['origen'] == 'prosa' else ''} |")
        L.append("")
        if nochange:
            L.append("**Acciones documentadas que no cambian este estado:**\n")
            for r in nochange:
                desc = " → ".join(x for x in (norm(r["desde"]), norm(r["hacia"])) if x)
                extra = " · ".join(x for x in (r["accion"] if not r.get("sin_flecha") else "", r["quien"], r["guardas"], r["efectos"]) if x)
                L.append(f"- {md(desc)}{(': ' + md(extra)) if extra else ''} ({md(r['ref'])})")
            L.append("")
        if ent.get("notas"):
            L.append("**Notas:**\n")
            L += [f"- {nt}" for nt in ent["notas"]]
            L.append("")
        prose = [s for s in ent["fuentes"] if not s.get("tabla") and ent.get("t")]
        if prose:
            L.append("<details><summary>Texto de la especificación (prosa transcrita arriba)</summary>\n")
            for s in prose:
                txt = section_text(s).strip()
                if len(txt) > 2500:
                    txt = txt[:2500] + " …"
                L.append(f"_{heading_of(s)}:_\n")
                L.append("\n".join("> " + l for l in txt.splitlines()) + "\n")
            L.append("</details>\n")
        L += endpoints_block(c["table"])
        mm = mermaid(c["values"], dedges, terminales, omit, default)
        diagrams[key] = mm
        L.append("```mermaid\n" + mm + "\n```\n")
        index_rows.append(f"| {n} | [{md(title)}](#{anchor}) | `{key}` | {pgcatalog.PHASE_LABEL[c['origin']]} | {len(c['values'])} | {len(rows)} | "
                          + ", ".join(sorted({s['spec'] for s in ent['fuentes']})) + " |")
        sections.append("\n".join(L))

    head = [
        "# Máquinas de estado · KipuControl\n",
        "_Generado por `tools/build_state_machines.py`: valores tomados del catálogo de PostgreSQL (CHECK de cada columna de estado) y transiciones de la §4 de "
        "`proto/docs/especificaciones/00…18-*.md` (tablas «Desde | Hacia» leídas automáticamente y prosa transcrita en `tools/estados_fuentes.py`), "
        "más los endpoints de escritura de `api/openapi.yaml` por tabla (`x-resource`). No editar a mano: corregir la fuente o `estados_fuentes.py` y regenerar con "
        "`python3 kit-ia/referencia/tools/build_state_machines.py` (requiere PostgreSQL 16/17; Node + Playwright + mermaid para validar los diagramas, o `--no-check`)._\n",
        f"**{len(cols)} columnas de estado** con CHECK de lista de valores · {stats['con']} con transiciones documentadas · "
        f"{stats['sin']} con «Transiciones por definir» · {stats['transiciones']} filas de transición · {stats['aristas']} pares desde→hacia distintos.\n",
        "Convenciones de las tablas: «— (alta)» = creación del registro (estado inicial). Cuando la spec usa una expresión "
        "(«cualquiera ≠ …», «no cerrada», «abierta», etiquetas de la extranet), la celda muestra los estados resueltos y debajo el texto original. "
        "«Ref.» indica la sección de origen; «(prosa)» = transcrito de un párrafo, no de una tabla. Lo marcado «Supuesto» o «Por definir» no está fijado por la spec.\n",
        IMPLEMENTATION_NOTE,
        "## Índice\n",
        "| # | Entidad | Tabla.columna | Fase | Valores | Filas de transición | Specs |",
        "|---|---|---|---|---|---|---|",
    ] + index_rows + ["", "## Máquinas por entidad\n"]
    OUT.write_text("\n".join(head) + "\n" + "\n".join(sections) + "\n", encoding="utf-8")
    print(f"Escrito {OUT.relative_to(ROOT)}: {len(cols)} columnas de estado · {stats['con']} documentadas · {stats['sin']} por definir · "
          f"{stats['transiciones']} filas · {stats['aristas']} pares desde→hacia")
    missing = [f"{c['table']}.{c['column']}" for c in cols if f"{c['table']}.{c['column']}" not in OUT.read_text(encoding="utf-8")]
    if missing:
        raise SystemExit("Columnas de estado sin sección: " + ", ".join(missing))
    if check_mermaid:
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(diagrams, f)
        p = subprocess.run(["node", str(REF_DB / "render_mermaid.cjs"), "--check", f.name], capture_output=True, text=True)
        Path(f.name).unlink()
        print(p.stdout.strip() or p.stderr.strip())
        if p.returncode:
            raise SystemExit("Hay diagramas Mermaid con errores de sintaxis.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pgbin")
    ap.add_argument("--port", type=int, default=55448)
    ap.add_argument("--no-check", action="store_true", help="no validar los diagramas Mermaid (no requiere Node)")
    a = ap.parse_args()
    with pgcatalog.temp_cluster(a.pgbin, a.port) as psql:
        cat = pgcatalog.extract_catalog(psql)
    generate(cat, not a.no_check)


if __name__ == "__main__":
    main()
