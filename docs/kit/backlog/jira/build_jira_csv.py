#!/usr/bin/env python3
"""Genera los CSV de importación a Jira desde ../backlog-completo.csv (KipuControl v2.5).

Salida (en esta carpeta):
  kipucontrol-jira-cloud.csv                  Jira Cloud: épicas + historias, historias enlazadas con `Parent`.
  kipucontrol-jira-datacenter-1-epicas.csv    Jira Data Center/Server: primero las épicas…
  kipucontrol-jira-datacenter-2-historias.csv …luego las historias, enlazadas con `Epic Link` (nombre de la épica).

Descripción en formato wiki de Jira. v2.5 corrige el generador anterior:
  - escapa `{ } [ ] * ^ ~ + \\` para que Jira no los lea como macros ni formato (antes `{id}` rompía 156 rutas);
  - convierte `código` de Markdown a {{monoespacio}};
  - separa los criterios solo por « | » seguido de «N)», así `owner=me|none|any` ya no parte un criterio en cuatro;
  - la definición de terminado usa 1440 y 400 px, igual que backlog/FORMATO.md.

Uso:  python3 docs/kit/backlog/jira/build_jira_csv.py           (escribe los 3 CSV)
      python3 docs/kit/backlog/jira/build_jira_csv.py --check   (falla si los CSV versionados no coinciden)
"""
from __future__ import annotations

import csv
import io
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKLOG = HERE.parent / "backlog-completo.csv"
PROJECT_LABEL = "kipucontrol"
FASES = {"0": "Fase 0 · Fundaciones", "1A": "Fase 1A · MVP comercial", "1B": "Fase 1B · MVP operativo",
         "2": "Fase 2 · Canales y campo", "3": "Fase 3 · SaaS y crecimiento"}
FASE_MD = {"0": "fase-0", "1A": "fase-1a", "1B": "fase-1b", "2": "fase-2", "3": "fase-3"}
PRIORITY = {"P0": "Highest", "P1": "High", "P2": "Medium"}
EPIC_ID_BASE, STORY_ID_BASE = 1, 1000
DOD = [
    "Pruebas escritas antes del código y en verde (Pest contra PostgreSQL y Redis reales; Playwright si hay pantalla).",
    "Tablas y endpoints idénticos a `docs/kit/database/` y `docs/kit/api/openapi.yaml` (`make openapi-check`).",
    "Permiso del contrato probado con un rol sin permiso (403) y con otro tenant (404).",
    "`data-testid` de `docs/kit/tests/e2e/SELECTORES.md` presentes; pantalla revisada a 1440 y 400 px, claro y oscuro.",
    "Diferencias con la especificación registradas en su §11 y en `docs/CHANGELOG.md`.",
    "Commit con el ID de la historia.",
]

_ESC = re.compile(r"([\\{}\[\]*^~+])")


def esc(text: str) -> str:
    """Escapa los caracteres que el wiki de Jira interpreta como macro, enlace o formato."""
    return _ESC.sub(r"\\\1", text)


def wiki(text: str) -> str:
    """Texto libre: `código` → {{código}} y el resto escapado."""
    parts = re.split(r"`([^`]+)`", text)
    return "".join(esc(p) if i % 2 == 0 else "{{" + esc(p) + "}}" for i, p in enumerate(parts))


def split_top(text: str) -> list[str]:
    """Separa por «, » fuera de paréntesis (las notas entre paréntesis pueden llevar comas)."""
    out, depth, cur = [], 0, ""
    i = 0
    while i < len(text):
        c = text[i]
        depth += c == "("
        depth -= c == ")"
        if depth == 0 and text.startswith(", ", i):
            out.append(cur)
            cur, i = "", i + 2
            continue
        cur += c
        i += 1
    out.append(cur)
    return [x.strip() for x in out if x.strip()]


def mono_list(value: str) -> str:
    if value.strip() in ("", "—"):
        return "—"
    return ", ".join("{{" + esc(x.replace("`", "")) + "}}" for x in split_top(value))


def criteria(value: str) -> list[str]:
    items = re.split(r"\s\|\s(?=\d+\)\s)", value.strip())
    return [re.sub(r"^\d+\)\s*", "", x).strip() for x in items if x.strip()]


def deps_of(value: str) -> list[str]:
    return [d.strip() for d in value.split(",") if d.strip() not in ("", "—")]


def module_label(row: dict) -> str:
    if row["fase"] == "0":
        return "epica-" + row["epica_id"].lower()
    return row["id"].split("-")[1].lower()


def build() -> dict[str, str]:
    rows = list(csv.DictReader(open(BACKLOG, encoding="utf-8")))
    ids = {r["id"] for r in rows}
    epics: dict[str, dict] = {}
    for r in rows:
        e = epics.setdefault(r["epica_id"], {"id": r["epica_id"], "name": r["epica"], "fase": r["fase"].upper(), "stories": []})
        e["stories"].append(r["id"])
    epic_issue = {eid: EPIC_ID_BASE + n for n, eid in enumerate(epics)}
    story_issue = {r["id"]: STORY_ID_BASE + n for n, r in enumerate(rows)}
    for r in rows:
        for d in deps_of(r["dependencias"]):
            if d not in ids:
                raise SystemExit(f"{r['id']}: dependencia «{d}» no es un ID de historia")
    max_deps = max(len(deps_of(r["dependencias"])) for r in rows)
    n_labels = 4

    def header(link_col: str) -> list[str]:
        return (["Issue Id", link_col, "Issue Type", "Summary", "Epic Name", "Description", "Priority", "Fix Version"]
                + ["Labels"] * n_labels + ["Bloqueado por"] * max_deps + ["Historia (ID kit)"])

    def epic_row(e: dict, link_value: str = "") -> list:
        title = f"{e['id']} · {e['name']}"
        first, last = e["stories"][0], e["stories"][-1]
        desc = (f"h3. {esc(e['name'])}\n\n*Fase:* {FASES[e['fase']]}\n"
                + (f"*Historias:* {len(e['stories'])} ({first} … {last})\n" if len(e["stories"]) > 1 else f"*Historias:* 1 ({first})\n")
                + f"\nDetalle completo de cada historia en el kit: {{{{docs/kit/backlog/{FASE_MD[e['fase']]}.md}}}} (sección {e['id']}).")
        labels = [PROJECT_LABEL, FASE_MD[e["fase"]], "epica", ""]
        return ([epic_issue[e["id"]], link_value, "Epic", title, title, desc, "", FASES[e["fase"]]]
                + labels + [""] * max_deps + [e["id"]])

    def story_row(r: dict, link_value) -> list:
        fase = r["fase"].upper()
        deps = deps_of(r["dependencias"])
        crit = "\n".join("# " + wiki(c) for c in criteria(r["criterios_aceptacion"])) or "—"
        desc = "\n".join([
            f"*{r['id']}* · {FASES[fase]} · Épica {r['epica_id']} · Prioridad {r['prioridad']}", "",
            "h3. Historia", wiki(r["historia"]), "",
            "h3. Especificación", wiki(r["especificacion"]), "",
            "h3. Tablas", mono_list(r["tablas"]), "",
            "h3. Endpoints", mono_list(r["endpoints"]), "",
            "h3. Pantallas", wiki(r["pantallas"]) if r["pantallas"].strip() else "—", "",
            "h3. Criterios de aceptación", crit, "",
            "h3. Pruebas", wiki(r["pruebas"]) if r["pruebas"].strip() else "—", "",
            "h3. Depende de", ", ".join(deps) or "—", "",
            "h3. Definición de terminado", "\n".join("# " + wiki(x) for x in DOD), "",
            f"Implementación con Claude Code: {{{{/implementar-historia {r['id']}}}}}",
        ])
        labels = [PROJECT_LABEL, FASE_MD[fase], module_label(r), r["prioridad"].lower()]
        blocked = [story_issue[d] for d in deps] + [""] * (max_deps - len(deps))
        return ([story_issue[r["id"]], link_value, "Story", f"{r['id']} · {r['titulo']}", "", desc,
                 PRIORITY[r["prioridad"]], FASES[fase]] + labels + blocked + [r["id"]])

    def to_csv(header_row: list, data: list[list]) -> str:
        out = io.StringIO()
        w = csv.writer(out, lineterminator="\n")
        w.writerow(header_row)
        w.writerows(data)
        return out.getvalue()

    epic_name = {eid: f"{eid} · {e['name']}" for eid, e in epics.items()}
    cloud = [epic_row(e) for e in epics.values()] + [story_row(r, epic_issue[r["epica_id"]]) for r in rows]
    dc1 = [epic_row(e) for e in epics.values()]
    dc2 = [story_row(r, epic_name[r["epica_id"]]) for r in rows]
    for line in cloud:
        if len(line[5]) > 32767:
            raise SystemExit(f"Descripción demasiado larga para Jira: {line[3]}")
    return {
        "kipucontrol-jira-cloud.csv": to_csv(header("Parent"), cloud),
        "kipucontrol-jira-datacenter-1-epicas.csv": to_csv(header("Epic Link"), dc1),
        "kipucontrol-jira-datacenter-2-historias.csv": to_csv(header("Epic Link"), dc2),
    }


def main(argv: list[str]) -> int:
    files = build()
    if "--check" in argv:
        bad = [n for n, c in files.items() if not (HERE / n).exists() or (HERE / n).read_text(encoding="utf-8") != c]
        if bad:
            print("CSV de Jira desactualizados:", ", ".join(bad))
            return 1
        print("CSV de Jira al día.")
        return 0
    for name, content in files.items():
        (HERE / name).write_text(content, encoding="utf-8")
    rows = list(csv.DictReader(open(BACKLOG, encoding="utf-8")))
    n_links = sum(len(deps_of(r["dependencias"])) for r in rows)
    n_epics = len({r["epica_id"] for r in rows})
    print(f"✓ {n_epics} épicas, {len(rows)} historias y {n_links} vínculos de bloqueo en {', '.join(files)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
