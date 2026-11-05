#!/usr/bin/env python3
"""
compare_contract.py — Compara el OpenAPI generado desde el código Laravel (dedoc/scramble) contra el contrato
kit-ia/api/openapi.yaml, a nivel de operaciones (método + plantilla de ruta).

Uso (CI):
  php artisan scramble:export --path=build/openapi.generated.json
  python3 kit-ia/api/compare_contract.py build/openapi.generated.json --phase 1 [--strict-extra] [--prefix /api/v1]

- Falla (exit 1) si falta en el código alguna operación del contrato con x-phase <= --phase.
- Con --strict-extra, falla también si el código expone operaciones que no están en el contrato.
- Los nombres de parámetros de ruta no se comparan ({id} ≡ {code}); los tipos y cuerpos se revisan con oasdiff.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import yaml

HERE = Path(__file__).resolve().parent
METHODS = ("get", "post", "put", "patch", "delete")


def load(p: Path) -> dict:
    text = p.read_text(encoding="utf-8")
    return json.loads(text) if p.suffix == ".json" else yaml.safe_load(text)


def tpl(path: str) -> str:
    return re.sub(r"\{[^}]+\}", "{}", path.rstrip("/")) or "/"


def ops(doc: dict, prefix: str = "") -> dict:
    out = {}
    for path, item in (doc.get("paths") or {}).items():
        for m in METHODS:
            if m in item:
                full = (prefix.rstrip("/") + "/" + path.lstrip("/")) if prefix else path
                out[(m.upper(), tpl(full))] = item[m]
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("generated", type=Path, help="OpenAPI exportado por Scramble (json o yaml)")
    ap.add_argument("--contract", type=Path, default=HERE / "openapi.yaml")
    ap.add_argument("--phase", type=int, default=3, help="exigir operaciones con x-phase <= N (0–3)")
    ap.add_argument("--prefix", default=None, help="prefijo a anteponer a las rutas generadas (por defecto, path de servers[0].url)")
    ap.add_argument("--strict-extra", action="store_true", help="fallar si el código expone rutas fuera del contrato")
    a = ap.parse_args()

    contract = load(a.contract)
    gen = load(a.generated)
    prefix = a.prefix
    if prefix is None:
        servers = gen.get("servers") or []
        prefix = urlparse(servers[0]["url"]).path if servers else ""
    c_ops = ops(contract)
    g_ops = ops(gen, prefix)

    required = {k: v for k, v in c_ops.items() if int(v.get("x-phase", 0)) <= a.phase}
    missing = sorted(k for k in required if k not in g_ops)
    extra = sorted(k for k in g_ops if k not in c_ops)

    print(f"Contrato: {len(c_ops)} operaciones · exigidas (fase <= {a.phase}): {len(required)} · "
          f"generadas: {len(g_ops)} · implementadas del alcance: {len(required) - len(missing)}")
    if missing:
        print(f"\n✗ Faltan en el código ({len(missing)}):")
        for m, p in missing:
            op = required[(m, p)]
            print(f"  {m:6} {p}  [F{op.get('x-phase')}] {op.get('operationId')} · {op.get('x-spec')}")
    if extra:
        print(f"\n{'✗' if a.strict_extra else '!'} En el código pero no en el contrato ({len(extra)}):")
        for m, p in extra:
            print(f"  {m:6} {p}")
    fail = bool(missing) or (a.strict_extra and bool(extra))
    print("\n" + ("✗ Contrato NO cumplido" if fail else "✓ Contrato cumplido para el alcance indicado"))
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
