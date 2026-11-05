#!/usr/bin/env python3
"""
Genera ejemplos/web/src/lib/api/critical-ops.ts y ejemplos/mobile/src/api/critical-ops.ts desde
kit-ia/api/openapi.json: qué operaciones exigen `Idempotency-Key` (x-idempotency.mode = required) y cuáles
`If-Match` (parámetro components.parameters.IfMatch). openapi-typescript no emite las extensiones x-*, por eso
se generan aparte (api/README.md §2). Regenerar cuando cambie el contrato:

  python3 kit-ia/ejemplos/tools/generar_operaciones_criticas.py
"""
from __future__ import annotations

import json
from pathlib import Path

KIT = Path(__file__).resolve().parents[2]
spec = json.loads((KIT / "api" / "openapi.json").read_text(encoding="utf-8"))

idem, ifmatch, webhook = [], [], []
for path, item in spec["paths"].items():
    for method, op in item.items():
        if method not in {"get", "post", "put", "patch", "delete"}:
            continue
        key = f"{method.upper()} {path}"
        mode = (op.get("x-idempotency") or {}).get("mode")
        if mode == "required":
            idem.append(key)
        elif mode == "webhook":
            webhook.append(key)
        if any(p.get("$ref", "").endswith("/IfMatch") for p in op.get("parameters", [])):
            ifmatch.append(key)

version = spec.get("info", {}).get("version", "?")


def ts_set(name: str, items: list[str], doc: str) -> str:
    body = "\n".join(f'  "{i}",' for i in sorted(items))
    return f"/** {doc} ({len(items)}) */\nexport const {name}: ReadonlySet<string> = new Set([\n{body}\n]);\n"


content = f"""// GENERADO por kit-ia/ejemplos/tools/generar_operaciones_criticas.py desde kit-ia/api/openapi.json
// (contrato v{version}). NO editar a mano: regenerar cuando cambie el contrato.
// Clave = "MÉTODO /ruta-del-contrato" (igual que `schemaPath` de openapi-fetch).

{ts_set("IDEMPOTENT_OPS", idem, "Operaciones que exigen Idempotency-Key (x-idempotency.mode = required)")}
{ts_set("IF_MATCH_OPS", ifmatch, "Operaciones que exigen If-Match con el lock_version vigente")}
export const opKey = (method: string, schemaPath: string): string => `${{method.toUpperCase()}} ${{schemaPath}}`;
"""

for target in [KIT / "ejemplos/web/src/lib/api/critical-ops.ts", KIT / "ejemplos/mobile/src/api/critical-ops.ts"]:
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    print(f"{target.relative_to(KIT.parent)}: {len(idem)} con Idempotency-Key, {len(ifmatch)} con If-Match (webhooks por id de evento: {len(webhook)})")
