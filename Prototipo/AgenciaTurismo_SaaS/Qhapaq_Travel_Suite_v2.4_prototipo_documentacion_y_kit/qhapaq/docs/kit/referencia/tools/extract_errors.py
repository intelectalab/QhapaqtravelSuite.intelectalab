#!/usr/bin/env python3
"""Genera kit-ia/referencia/CODIGOS-DE-ERROR.md.

Fuentes (solo lectura):
  - proto/docs/especificaciones/*.md, proto/docs/CONVENCIONES.md: menciones de estados HTTP 4xx/5xx junto a códigos
    de error (`TENANT_SCOPE_VIOLATION`, `QUOTA_EXCEEDED`…) o a IDs de regla usados como `code` (422 `PRD-ACT-CHECKLIST`,
    409 `RT-4`…).
  - kit-ia/api/openapi.json: components.responses / schemas Error y ValidationError, descripciones de operaciones.

Uso: python3 kit-ia/referencia/tools/extract_errors.py
"""
from __future__ import annotations

import json
import re
import sys
from collections import OrderedDict, defaultdict
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from specparse import DOCS_DIR, KIT, MODULE_NAMES, md_escape, spec_files, split_row  # noqa: E402

OUT = KIT / "referencia" / "CODIGOS-DE-ERROR.md"
STATUSES = {"400", "401", "402", "403", "404", "409", "410", "412", "413", "415", "422", "423", "428", "429", "500", "503"}
STATUS_RE = re.compile(r"(?<![\d\-.,/])\b(4\d\d|5\d\d)\b(?![\d\-.,/%]|\s*(?:m\b|px|ms|MB|KB|caracteres|USD|PEN|h\b))")
SNAKE_RE = re.compile(r"`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)`")
RULE_ID = r"(?:[A-Z][A-Z0-9]*-)+(?:\d{1,3}[a-z]?|[A-Z]{3,}[A-Z0-9-]*)"
AFTER_STATUS_RE = re.compile(r"\b(4\d\d)\b\s*(?:con\s+)?(?:`?code`?\s*[:=]?\s*)?[`\"«]?(" + RULE_ID + r")[`\"»]?")
NOT_ERRORS = {"ROLE_UX", "POR_SALIDA", "POR_HABITACION", "POR_TRANSPORTE", "ROUND_HALF_UP", "SIN_CONTROL", "PLAN_RANK",
              "PLAN_LIMITS", "PAY_METHODS", "HOTEL_ADDR", "DEF_TPL", "APP_KEY", "MAX_DISC", "POR_PERSONA", "POR_SERVICIO"}

openapi = json.loads((KIT / "api" / "openapi.json").read_text(encoding="utf-8"))


def clean(s: str, n: int = 260) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= n else s[: n - 1] + "…"


codes = OrderedDict()            # código → {"status": set, "where": [(spec, sec, ctx)]}
rule_codes = defaultdict(list)   # (status, id) → [(spec, sec, ctx)]
status_mentions = defaultdict(lambda: defaultdict(int))


def add_code(code, status, spec, sec, ctx):
    c = codes.setdefault(code, {"status": set(), "where": []})
    if status:
        c["status"].add(status)
    key = (spec, sec)
    if all((w[0], w[1]) != key for w in c["where"]):
        c["where"].append((spec, sec, ctx))


def scan(path: Path, spec: str):
    h2 = h3 = None
    fence = False
    for ln in path.read_text(encoding="utf-8").splitlines():
        if ln.strip().startswith("```"):
            fence = not fence
        if ln.startswith("## "):
            h2, h3 = ln[3:].strip(), None
        elif ln.startswith("### "):
            h3 = ln[4:].strip()
        sec = ("§" + h2 if h2 else "") + (f" › {h3}" if h3 else "")
        sec = re.sub(r"^§(\d+)\. ", r"§\1 ", sec)
        ctx_src = ln
        if ln.lstrip().startswith("|"):
            cells = [c for c in split_row(ln) if c]
            pick = cells[:2] + [c for c in cells[2:] if STATUS_RE.search(c) or SNAKE_RE.search(c)][:1]
            if len(pick) < 3 and len(cells) > 2:
                pick = cells[:3]
            ctx_src = " · ".join(pick)
        sts = [(m.start(), m.group(1)) for m in STATUS_RE.finditer(ln) if m.group(1) in STATUSES]
        for _, s in sts:
            status_mentions[s][spec] += 1
        for m in SNAKE_RE.finditer(ln):
            code = m.group(1)
            if code in NOT_ERRORS:
                continue
            before = [s for pos, s in sts if pos < m.start() and m.start() - pos < 90]
            status = before[-1] if before else (sts[0][1] if sts else "")
            if not status and not re.search(r"error|code|→|rechaz|bloque|devuelve|responde", ln, re.I):
                continue
            add_code(code, status, spec, sec, clean(ctx_src))
        for m in AFTER_STATUS_RE.finditer(ln):
            st, rid = m.group(1), m.group(2)
            if st not in STATUSES or re.fullmatch(r"(PROC|E2E|COT|RES|OP|VOU|LEAD|CLI|PRD|SRV|PRV|TNT|U)-?\d*", rid):
                continue
            if re.match(r"(COT|RES|OP|VOU|LEAD|CLI|SRV|PRV|TNT|OPP|INV|F001|B001)-", rid):
                continue
            ids = [rid]
            tail = ln[m.end():m.end() + 20]
            mm = re.match(r"((?:/\d{2,3})+)", tail)
            if mm and re.search(r"-\d{2,3}$", rid):
                base = rid.rsplit("-", 1)[0]
                ids += [f"{base}-{n}" for n in mm.group(1).strip("/").split("/")]
            for one in ids:
                lst = rule_codes[(st, one)]
                if all((w[0], w[1]) != (spec, sec) for w in lst):
                    lst.append((spec, sec, clean(ctx_src)))


for p in spec_files():
    scan(p, p.name[:2])
scan(DOCS_DIR / "CONVENCIONES.md", "CONV")

# códigos presentes en el contrato
contract_codes = defaultdict(set)
blob_sources = [("components.responses", json.dumps(openapi["components"]["responses"], ensure_ascii=False)),
                ("components.parameters", json.dumps(openapi["components"]["parameters"], ensure_ascii=False)),
                ("components.schemas.Error", json.dumps(openapi["components"]["schemas"].get("Error"), ensure_ascii=False))]
for src, blob in blob_sources:
    for m in re.finditer(r"`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)`|\"([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\"", blob):
        c = m.group(1) or m.group(2)
        if c not in NOT_ERRORS:
            contract_codes[c].add(src)
op_codes = defaultdict(set)
for path, item in openapi["paths"].items():
    for meth, op in item.items():
        if isinstance(op, dict) and "description" in op:
            for m in SNAKE_RE.finditer(op["description"]):
                if m.group(1) not in NOT_ERRORS:
                    op_codes[m.group(1)].add(f"{meth.upper()} {path}")

# ------------------------------------------------------------------ salida
L = []
A = L.append
A("# Códigos de error de la API")
A("")
A("> Generado por `kit-ia/referencia/tools/extract_errors.py` a partir de `proto/docs/especificaciones/*.md`, "
  "`proto/docs/CONVENCIONES.md` y `kit-ia/api/openapi.json`. Las secciones 1–2 son el marco fijo; las tablas 3–5 se "
  "regeneran desde las especificaciones.")
A("")
A("## 1. Formato estándar de error")
A("")
A("Fuente: spec 00 §6 («Formato de error (todas las API)»), CONVENCIONES §3 y `components.schemas.Error` / "
  "`ValidationError` del contrato.")
A("")
A("**Errores de autorización, estado y negocio** (`Error`; obligatorios: `error`, `message`):")
A("")
A("```json")
A('{ "error": "FORBIDDEN", "code": "SEC-BR-09", "message": "Este registro pertenece a la cartera de otro asesor…",')
A('  "required_permissions": ["quotes.view"], "correlation_id": "c-8812a", "details": {} }')
A("```")
A("")
A("**Errores de validación** (`ValidationError`, HTTP 422; obligatorios: `message`, `errors`):")
A("")
A("```json")
A('{ "message": "Los datos no son válidos.", "code": "PRD-BR-002",')
A('  "errors": { "travel_date": ["La fecha de viaje debe ser posterior a hoy."] }, "correlation_id": "c-77e1" }')
A("```")
A("")
A("| Campo | Tipo | Uso |")
A("|---|---|---|")
A("| `error` | string | Categoría estable para el frontend: `FORBIDDEN`, `RESOURCE_NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `TENANT_SUSPENDED`… (ver §3). No va en `ValidationError`. |")
A("| `code` | string | Código de la regla de negocio que se violó (`SEC-BR-09`, `QTE-BR-12`, `RT-4`, `PRD-BR-002`, `STALE_VERSION`…). Opcional en errores puramente técnicos. |")
A("| `message` | string | Mensaje en español, apto para mostrar al usuario, sin datos personales ni trazas. |")
A("| `errors` | objeto `campo → [mensajes]` | Solo 422 de validación (`FormRequest`). Claves = nombres de campo del cuerpo (snake_case; notación con punto para arreglos: `passengers.0.doc_number`). |")
A("| `required_permissions` | string[] | En 403 por permiso: permisos que habilitarían la acción (cualquiera de ellos). |")
A("| `correlation_id` | string | Id de la solicitud (header `X-Request-Id` / log). Se registra en `audit_logs` cuando el error se audita (accesos denegados, SEC-BR-07). |")
A("| `details` | objeto | Datos adicionales del conflicto: checklist fallido (`PRD-ACT-CHECKLIST`), cupos libres, límite del plan, `lock_version` vigente… |")
A("")
A("Reglas de emisión (SEC-BR-03/07/14/16/17/24/25, CONVENCIONES §3):")
A("")
A("- El backend es la autoridad: un botón oculto en la UI siempre se revalida y responde 403 si llega por otra vía (RT-17).")
A("- Todo 403 de pantalla o endpoint se audita como `acceso_denegado` (SEC-BR-07). Exportaciones denegadas: `exportar_denegado`.")
A("- Recurso de otro tenant → **404** (no se revela que existe). Intento explícito de fijar otro tenant → **403** `TENANT_SCOPE_VIOLATION`.")
A("- Respuestas 429 incluyen `Retry-After`, `X-RateLimit-Limit` y `X-RateLimit-Remaining` (`components.responses.TooManyRequests`).")
A("- Una notificación fallida nunca convierte en error una operación ya confirmada (SEC-BR-22).")
A("- Implementación de referencia: `App\\Domain\\Shared\\Errors\\ApiException` (`forbidden`, `notFound`, `conflict`, `unprocessable`) "
  "en `kit-ia/ejemplos/backend` si está presente, y la expectativa Pest `toBeApiError(status, code)`.")
A("")
A("## 2. Códigos HTTP usados por el sistema")
A("")
A("| HTTP | `error` | Significado en Qhapaq | Ejemplos de `code` | Fuente |")
A("|---|---|---|---|---|")
rows = [
    ("400", "BAD_REQUEST", "Petición mal formada que no llega al FormRequest (JSON inválido, firma de webhook ilegible, parámetros de consulta imposibles).", "—", "specs (uso puntual)"),
    ("401", "UNAUTHENTICATED", "Sin token, token vencido o revocado (logout, baja, cambio de rol, reset MFA). El cliente debe volver al login.", "—", "00 §4, `responses.Unauthorized`"),
    ("402", "PAYMENT_REQUIRED", "Tenant suspendido por falta de pago: solo se permiten `/billing/*` y el login.", "`PAYMENT_REQUIRED`", "13 §6, `responses.PaymentRequired`"),
    ("403", "FORBIDDEN", "Sin permiso (`required_permissions`), fuera del alcance del rol (ownership de Ventas, usuario externo), feature o regla fuera del plan, scope de API key faltante, MFA no verificado, tenant suspendido.", "`SEC-BR-09`, `SCOPE_OWNERSHIP`, `FEATURE_NOT_IN_PLAN`, `RULE_NOT_IN_PLAN`, `TENANT_SCOPE_VIOLATION`, `TENANT_SUSPENDED`, `MFA_REQUIRED`", "00 §5, `responses.Forbidden`"),
    ("404", "RESOURCE_NOT_FOUND", "No existe **o pertenece a otro tenant** (RLS + global scope; misma respuesta en ambos casos, SEC-BR-02).", "`RESOURCE_NOT_FOUND`", "00 SEC-BR-02, `responses.NotFound`"),
    ("409", "CONFLICT", "Conflicto de estado (transición no permitida), de disponibilidad/cupo, de versión optimista (`If-Match` ≠ `lock_version`) o clave de idempotencia aún en proceso.", "`STALE_VERSION`, `IDEMPOTENCY_IN_PROGRESS`, `RT-3`, `RT-4`, `QUOTE_CHANGED`, `AVAIL_CHANGED`", "CONVENCIONES §3, `responses.Conflict`"),
    ("410", "GONE", "Solo como respuesta **recibida** en webhooks salientes: el endpoint del suscriptor devolvió 410 → la suscripción se deshabilita (13 §8).", "—", "13 §8"),
    ("412 / 428", "—", "**No usados por las especificaciones.** Un `If-Match` desactualizado responde **409** (`STALE_VERSION`). Supuesto/Por definir: si falta `If-Match` en una ruta que lo exige, responder 428 `PRECONDITION_REQUIRED` o 422; decidir y documentar en 00 §11. Para la ausencia de `Idempotency-Key` el backlog propone 422 `IDEMPOTENCY_KEY_REQUIRED` (supuesto).", "—", "Por definir"),
    ("422", "VALIDATION_FAILED / BUSINESS_RULE", "Validación de campos (`errors`) o regla de negocio (`code` de la regla). Misma `Idempotency-Key` con cuerpo distinto también es 422.", "`PRD-BR-002`, `PRD-ACT-CHECKLIST`, `IDEMPOTENCY_KEY_REUSED`, `RT-14`, `CAT-AV-03`", "CONVENCIONES §3, `responses.UnprocessableEntity`"),
    ("423", "—", "**No usado por las especificaciones** (recurso bloqueado). Los bloqueos de periodo cerrado o de recurso tomado se expresan como 409/422 con `code` de regla. Por definir si se adopta.", "—", "Por definir"),
    ("429", "RATE_LIMITED / QUOTA_EXCEEDED", "Rate limit Redis (login 5/min por IP+email, API 120/min por usuario, exportaciones 10/h, API pública según plan) o cuota del plan agotada (mensajes, llamadas API).", "`RATE_LIMITED`, `QUOTA_EXCEEDED`", "00 SEC-BR-25, 13 §5, `responses.TooManyRequests`"),
    ("500 / 503", "SERVER_ERROR", "Error no controlado (se registra con `correlation_id`; nunca expone trazas). 5xx de proveedores externos (OSE, pasarela) se reintenta en cola, no se propaga al usuario.", "—", "specs (integraciones)"),
]
for r in rows:
    A("| " + " | ".join(r) + " |")
A("")
A("Menciones de cada estado HTTP por especificación (conteo automático; ayuda a ubicar dónde se define cada caso):")
A("")
specs_sorted = sorted({s for d in status_mentions.values() for s in d})
A("| HTTP | " + " | ".join(specs_sorted) + " | Total |")
A("|---|" + "---|" * (len(specs_sorted) + 1))
for st in sorted(status_mentions):
    d = status_mentions[st]
    A(f"| {st} | " + " | ".join(str(d.get(s, "")) for s in specs_sorted) + f" | {sum(d.values())} |")
A("")

A("## 3. Códigos de error simbólicos (`error` / `code` en MAYÚSCULAS)")
A("")
A("Códigos con nombre propio que aparecen en las especificaciones o en el contrato. *HTTP* = estado con el que aparecen "
  "asociados en el texto (vacío si la spec no lo dice: Por definir).")
A("")
A("| Código | HTTP | Módulo(s) | Cuándo ocurre (extracto de la especificación) | En el contrato |")
A("|---|---|---|---|---|")
all_codes = OrderedDict((k, v) for k, v in codes.items())
for c in contract_codes:
    all_codes.setdefault(c, {"status": set(), "where": []})
for c in op_codes:
    all_codes.setdefault(c, {"status": set(), "where": []})
manual_status = {"FORBIDDEN": "403", "RATE_LIMITED": "429", "QUOTA_EXCEEDED": "429", "PAYMENT_REQUIRED": "402",
                 "FEATURE_NOT_IN_PLAN": "403", "SCOPE_OWNERSHIP": "403", "STALE_VERSION": "409",
                 "STALE_VERSION": "409", "RESOURCE_NOT_FOUND": "404", "TENANT_SCOPE_VIOLATION": "403"}
for code in sorted(all_codes):
    v = all_codes[code]
    st = ", ".join(sorted(v["status"])) or manual_status.get(code, "")
    mods = ", ".join(sorted({w[0] for w in v["where"]})) or "—"
    ctx = " <br>".join(f"*{w[0]} {md_escape(w[1])}*: {md_escape(w[2])}" for w in v["where"][:3]) or "—"
    inc = []
    if code in contract_codes:
        inc.append(", ".join(sorted(contract_codes[code])))
    if code in op_codes:
        ops = sorted(op_codes[code])
        inc.append(f"{len(ops)} operación(es): " + ", ".join(f"`{o}`" for o in ops[:3]) + (" …" if len(ops) > 3 else ""))
    A(f"| `{code}` | {st} | {mods} | {ctx} | {md_escape('; '.join(inc)) or '—'} |")
A("")
A("Nota: el conflicto de versión (`If-Match` desactualizado) usa el código `STALE_VERSION` en todas las fuentes "
  "(spec 00 SEC-BR-17, contrato, backlog y pruebas Pest). Unificado en la v2.4 del kit.")
A("")

A("## 4. IDs de regla devueltos como `code`")
A("")
A("Casos en que la especificación indica explícitamente el estado HTTP seguido del ID de regla (p. ej. «422 `RT-14`», "
  "«409 RT-4»). Cualquier otra regla de `REGLAS-DE-NEGOCIO.md` se devuelve igual: 422 si es validación de negocio, "
  "409 si es conflicto de estado/disponibilidad, 403 si es de alcance o permiso.")
A("")
A("| HTTP | `code` | Módulo | Cuándo ocurre (extracto) |")
A("|---|---|---|---|")
for (st, rid) in sorted(rule_codes, key=lambda k: (k[1], k[0])):
    for spec, sec, ctx in rule_codes[(st, rid)][:2]:
        A(f"| {st} | `{rid}` | {spec} · {MODULE_NAMES.get(spec, spec)} | *{md_escape(sec)}*: {md_escape(ctx)} |")
A("")

A("## 5. Errores por módulo (resumen)")
A("")
per_mod = defaultdict(set)
for code, v in codes.items():
    for w in v["where"]:
        per_mod[w[0]].add(f"`{code}`")
for (st, rid), lst in rule_codes.items():
    for w in lst:
        per_mod[w[0]].add(f"{st} `{rid}`")
A("| Spec | Módulo | Códigos |")
A("|---|---|---|")
for spec in sorted(per_mod):
    A(f"| {spec} | {MODULE_NAMES.get(spec, 'Convenciones' if spec == 'CONV' else spec)} | {', '.join(sorted(per_mod[spec]))} |")
A("")
OUT.write_text("\n".join(L) + "\n", encoding="utf-8")
print(f"códigos simbólicos: {len(all_codes)} · reglas como code: {len(rule_codes)} · estados: {sorted(status_mentions)}")
