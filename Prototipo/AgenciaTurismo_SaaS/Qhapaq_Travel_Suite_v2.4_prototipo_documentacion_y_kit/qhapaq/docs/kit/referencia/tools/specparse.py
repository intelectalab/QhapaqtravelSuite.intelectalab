"""Utilidades compartidas para leer las especificaciones Markdown (proto/docs/especificaciones/*.md).

Recorre cada archivo línea a línea, conserva la ruta de encabezados vigente y devuelve las tablas Markdown
con su sección («§5.2 Reglas del módulo») para que los extractores trabajen sobre filas ya separadas.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

KIT = Path(__file__).resolve().parents[2]           # carpeta del kit (kit-ia/ o docs/kit/)
ROOT = KIT.parent                                    # proyecto original o docs/ del espacio de trabajo
# Dos estructuras soportadas: original (proto/docs/especificaciones) y espacio de trabajo (docs/especificaciones).
DOCS_DIR = ROOT / "proto" / "docs" if (ROOT / "proto" / "docs" / "especificaciones").is_dir() else ROOT
SPECS_DIR = DOCS_DIR / "especificaciones"

MODULE_NAMES = {
    "00": "Transversal (seguridad y RBAC)", "01": "CRM", "02": "Catálogo", "03": "Cotizaciones", "04": "Reservas",
    "05": "Operaciones y móvil", "06": "Extranet de proveedores", "07": "Finanzas", "08": "Canales y portales",
    "09": "Administración y reportes", "10": "Aprobaciones e inbox", "11": "Cupos y documentos de viaje",
    "12": "Tesorería y reclamaciones", "13": "Plataforma SaaS y API", "14": "Marketing y metas",
    "15": "Sitio web público", "16": "Motor de reservas y centro de reglas",
    "17": "Reglas, comunicaciones, monedas, reseñas e integración web", "18": "Reseñas propias",
}


@dataclass
class Table:
    file: str
    spec: str            # "04"
    section: str         # "§5 Reglas de negocio › v2.1 — Reglas…"
    h2: str
    header: list[str]
    rows: list[list[str]] = field(default_factory=list)
    line: int = 0


def split_row(line: str) -> list[str]:
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    cells, cur, in_code = [], "", False
    i = 0
    while i < len(s):
        ch = s[i]
        if ch == "`":
            in_code = not in_code
        if ch == "\\" and i + 1 < len(s) and s[i + 1] == "|":
            cur += "|"
            i += 2
            continue
        if ch == "|" and not in_code:
            cells.append(cur.strip())
            cur = ""
        else:
            cur += ch
        i += 1
    cells.append(cur.strip())
    return cells


def section_label(h2: str, h3: str | None) -> str:
    def clean(h):
        return re.sub(r"^#+\s*", "", h).strip()
    a = clean(h2) if h2 else ""
    m = re.match(r"(\d+)\.\s*(.*)", a)
    lab = f"§{m.group(1)} {m.group(2)}" if m else a
    if h3:
        b = clean(h3)
        m3 = re.match(r"(\d+\.\d+)\s*(.*)", b)
        lab += f" › §{m3.group(1)} {m3.group(2)}" if m3 else f" › {b}"
    return lab


def spec_files() -> list[Path]:
    return sorted(SPECS_DIR.glob("[0-9][0-9]-*.md"))


def iter_tables(path: Path):
    lines = path.read_text(encoding="utf-8").splitlines()
    spec = path.name[:2]
    h2 = h3 = None
    in_fence = False
    i = 0
    while i < len(lines):
        ln = lines[i]
        if ln.strip().startswith("```"):
            in_fence = not in_fence
            i += 1
            continue
        if not in_fence and ln.startswith("## "):
            h2, h3 = ln, None
        elif not in_fence and ln.startswith("### "):
            h3 = ln
        if (not in_fence and ln.lstrip().startswith("|") and i + 1 < len(lines)
                and re.match(r"^\s*\|?\s*:?-{2,}", lines[i + 1])):
            t = Table(path.name, spec, section_label(h2 or "", h3), h2 or "", split_row(ln), line=i + 1)
            j = i + 2
            while j < len(lines) and lines[j].lstrip().startswith("|"):
                t.rows.append(split_row(lines[j]))
                j += 1
            yield t
            i = j
            continue
        i += 1


def iter_lines(path: Path):
    """(nº de línea, sección, h2, línea) para buscar menciones fuera de tablas."""
    h2 = h3 = None
    for n, ln in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if ln.startswith("## "):
            h2, h3 = ln, None
        elif ln.startswith("### "):
            h3 = ln
        yield n, section_label(h2 or "", h3), h2 or "", ln


def md_escape(s: str) -> str:
    return (s or "").replace("|", "\\|").replace("\n", " ")
