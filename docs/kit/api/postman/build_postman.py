#!/usr/bin/env python3
"""Genera la colección Postman v2.1 de KipuControl desde kit-ia/api/openapi.json.

Uso:  python3 kit-ia/api/postman/build_postman.py
Salida (misma carpeta):
  kipucontrol-api.postman_collection.json   colección (carpetas Fase › módulo/tag)
  local.postman_environment.json       tenant demo TNT-0001 «andes» (andes.localhost:8000)
  tenant-b.postman_environment.json    tenant TNT-0002 «selva» (selva.localhost:8000), prueba de aislamiento

Reglas de generación (resumen; ver README.md):
- Una request por operación del contrato (se valida que el total coincida con el OpenAPI).
- URL {{baseUrl}}/api/v1/… con variables de ruta `:param`; su valor por defecto sale de kit-ia/seeds cuando hay
  una colección que coincide con el segmento anterior (p. ej. /crm/leads/:code → LEAD-0232).
- Headers según `security` de la operación, `Idempotency-Key: {{$guid}}` cuando el contrato declara
  `x-idempotency` (required/optional) o el parámetro IdempotencyKey, `If-Match: {{lockVersion}}` cuando declara IfMatch.
- Cuerpo de ejemplo derivado del esquema (`$ref` resuelto), con valores en español coherentes con las semillas.
- Las FK (`*_id` uuid) se envían como variables de colección `{{client_id}}`… para que el equipo las fije una vez.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import OrderedDict, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
KIT = HERE.parent.parent
OPENAPI = KIT / "api" / "openapi.json"
SEEDS = KIT / "seeds"
EXPECTED_REQUESTS = 1006

METHODS = ("get", "post", "put", "patch", "delete")
PHASE_NAMES = {
    0: "Fase 0 · Fundaciones",
    1: "Fase 1 · MVP comercial y operativo (1A + 1B)",
    2: "Fase 2 · Canales y campo",
    3: "Fase 3 · SaaS y crecimiento",
}
AUTH_FIRST = ["/api/v1/auth/login", "/api/v1/auth/mfa/verify", "/api/v1/platform/auth/login",
              "/api/v1/platform/auth/mfa/verify", "/api/v1/me"]


def load_json(p: Path):
    with open(p, encoding="utf-8") as fh:
        return json.load(fh, object_pairs_hook=OrderedDict)


spec = load_json(OPENAPI)
SCHEMAS = spec["components"]["schemas"]
PARAMS = spec["components"]["parameters"]
GLOBAL_SECURITY = spec.get("security", [])

# ---------------------------------------------------------------- semillas
SEED: dict[str, list] = {}
for f in sorted(SEEDS.glob("*.json")):
    if f.name.startswith("_"):
        continue
    try:
        d = load_json(f)
    except Exception:
        continue
    if isinstance(d, list) and d and isinstance(d[0], dict):
        SEED[f.stem] = d


def camel(s: str) -> str:
    parts = re.split(r"[-_]", s)
    return parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:])


SEG_ALIASES = {  # segmento de URL → colección semilla (solo cuando el nombre no coincide)
    "cases": "claims", "opportunities": "opportunities", "departures": "products", "rates": "products",
    "agencies": "b2bAgencies", "b2b-agencies": "b2bAgencies", "petty-cash": "treasuryAccounts",
    "accounts": "treasuryAccounts", "tickets": "supportTickets", "reviews": "ownReviews",
    "orders": "ecomOrders", "templates": "inboxTemplates", "deliveries": "webhookDeliveries",
    "api-keys": "apiKeys", "oauth-apps": "oauthApps", "travel-docs": "travelDocs", "claim-book": "claimBook",
    "pricing-rules": "pricingRules", "approval-rules": "approvalRules", "provider-requests": "providerRequests",
    "cash-sessions": "cashSessions", "bank-lines": "bankLines", "sales-targets": "salesTargets",
    "sales-teams": "salesTeams", "product-types": "productTypes", "feature-flags": "featureFlags",
    "permission-groups": "permissionGroups", "fx-rates": "fxRateHistory", "rooming-lists": "rooming",
    "assignments": "operations", "pax-messages": "paxMessages", "integrations": "integrations",
}


def seed_for_segment(seg: str):
    for cand in (SEG_ALIASES.get(seg), seg, camel(seg), camel(seg).rstrip("s"), seg.rstrip("s") + "s"):
        if cand and cand in SEED:
            return SEED[cand]
    return None


def path_var_value(path: str, name: str) -> str:
    segs = [s for s in path.split("/") if s]
    try:
        i = segs.index("{" + name + "}")
    except ValueError:
        return f"<{name}>"
    prev = segs[i - 1] if i > 0 else ""
    rows = seed_for_segment(prev)
    if rows:
        row = rows[0]
        if name == "code" and row.get("code"):
            return str(row["code"])
        for k in ("id", "code", "slug", "number"):
            if row.get(k):
                return str(row[k])
    fixed = {"slug": "machu-picchu-full-day", "token": "q7x9-a1b2-convencion", "date": "2026-10-15",
             "period": "2026-09", "v": "1", "channel": "web", "type": "EXCURSIÓN", "tenant": "TNT-0002",
             "plan": "Professional", "gateway": "izipay", "provider": "izipay", "event": "reservation.confirmed",
             "rule_code": "R-HOLD", "permission": "quotes.approve_internal", "section": "general",
             "report": "ventas-por-asesor", "key": "general.timezone", "placement": "home-hero",
             "tab": "resumen", "check": "dns", "portalPath": "mis-viajes", "number": "F001-00001234",
             "account": "TRS-0001", "reservation": "RES-2026-000350", "product": "PRD-001"}
    return fixed.get(name, f"<{name}>")


# ------------------------------------------------------- valores de ejemplo
CLI = SEED.get("clients", [{}])[0]
PRD = SEED.get("products", [{}])[0]
FK_VARS: dict[str, str] = {}


def fake_uuid(name: str) -> str:
    h = hashlib.sha1(name.encode()).hexdigest()
    return f"0192f3a4-{h[0:4]}-7{h[4:7]}-8{h[7:10]}-{h[10:22]}"


NAME_VALUES = [
    (r"(^|_)email", CLI.get("email", "gabriela.rios@correo.pe")),
    (r"phone|whatsapp|mobile", "+51 " + CLI.get("phone", "999 102 334")),
    (r"^(full_)?name$|contact_name|holder_name|pax_name|customer_name", CLI.get("name", "Gabriela Ríos Montoya")),
    (r"company|business_name|legal_name|razon", "Andes Horizonte Travel S.A.C."),
    (r"product_name|title$", PRD.get("name", "Machu Picchu Full Day")),
    (r"ruc|tax_id", "20611234567"),
    (r"doc_number|document_number", "45781236"),
    (r"nationality|country", "Perú"),
    (r"city", "Cusco"),
    (r"destination", "Cusco"),
    (r"currency", "USD"),
    (r"language|locale|lang", "es"),
    (r"timezone|tz$", "America/Lima"),
    (r"reason|motivo", "Solicitud del cliente por cambio de planes"),
    (r"note|comment|observ|message|body|detail", "Registro de prueba desde Postman"),
    (r"description|summary", "Descripción de ejemplo para el entorno local"),
    (r"(^|_)code$", "DEMO-001"),
    (r"slug", "machu-picchu-full-day"),
    (r"url|link|website", "https://andes.localhost:3000/ejemplo"),
    (r"color", "#1560B8"),
    (r"password", "{{password}}"),
    (r"reference", "OP-778812"),
    (r"address", "Av. El Sol 345, Cusco"),
    (r"subject", "Su viaje a Machu Picchu"),
    (r"status", "activo"),
    (r"channel", "Web"),
    (r"source", "Formulario web"),
    (r"method", "Transferencia BCP"),
]


def example_string(name: str, sch: dict) -> str:
    fmt = sch.get("format")
    n = name.lower()
    if fmt == "uuid":
        var = n if n.endswith("_id") or n == "id" else n + "_id"
        FK_VARS.setdefault(var, fake_uuid(var))
        return "{{" + var + "}}"
    if fmt == "date":
        return "2026-12-31" if re.search(r"to|until|end|due|valid", n) else "2026-10-15"
    if fmt == "date-time":
        return "2026-10-15T09:00:00-05:00"
    if fmt == "time":
        return "08:30"
    if fmt == "decimal" or re.search(r"amount|price|cost|total|fee|rate$|balance|pct|percent|factor", n):
        if re.search(r"pct|percent", n):
            return "10.00"
        if re.search(r"fx|factor", n):
            return "3.7400" if "fx" in n else "1.10"
        return "1250.00"
    if fmt in ("email",):
        return CLI.get("email", "gabriela.rios@correo.pe")
    if fmt in ("uri", "url"):
        return "https://andes.localhost:3000/ejemplo"
    if sch.get("pattern") == "^[A-Z]{3}$":
        return "USD"
    for pat, val in NAME_VALUES:
        if re.search(pat, n):
            v = val
            break
    else:
        v = "Ejemplo " + name.replace("_", " ")
    ml = sch.get("maxLength")
    if isinstance(ml, int) and len(v) > ml and not v.startswith("{{"):
        v = v[:ml]
    return v


def example_int(name: str, sch: dict) -> int:
    n = name.lower()
    table = [("pax|adults|adt|seats|qty|quantity", 2), ("chd|child", 1), ("inf", 0), ("night", 3),
             ("day", 3), ("hour", 48), ("minute", 15), ("capacity|max", 12), ("min", 1), ("seq|order|position|sort", 1),
             ("year", 2026), ("month", 10), ("lock_version|version", 1), ("score|rating|stars", 5), ("percent|pct", 10)]
    for pat, v in table:
        if re.search(pat, n):
            val = v
            break
    else:
        val = 1
    if "minimum" in sch:
        val = max(val, sch["minimum"])
    if "maximum" in sch:
        val = min(val, sch["maximum"])
    return val


def resolve(sch: dict) -> dict:
    seen = 0
    while isinstance(sch, dict) and "$ref" in sch and seen < 10:
        sch = SCHEMAS.get(sch["$ref"].split("/")[-1], {})
        seen += 1
    return sch or {}


def example(name: str, sch: dict, depth: int = 0):
    sch = resolve(sch)
    if "examples" in sch and sch["examples"]:
        return sch["examples"][0]
    if "example" in sch:
        return sch["example"]
    enum = [e for e in sch.get("enum", []) if e is not None]
    if enum:
        return enum[0]
    t = sch.get("type")
    if isinstance(t, list):
        t = next((x for x in t if x != "null"), None)
    if t is None and "properties" in sch:
        t = "object"
    if t == "object" or (t is None and not name):
        props = sch.get("properties", {})
        if depth > 2:
            return {}
        return OrderedDict((k, example(k, v, depth + 1)) for k, v in props.items()
                           if not (isinstance(v, dict) and (v.get("readOnly") or k.endswith("_norm")
                                   or "generada" in (v.get("description") or "").lower())))
    if t == "array":
        return [example(name.rstrip("s"), sch.get("items", {}), depth + 1)] if depth < 3 else []
    if t == "integer":
        return example_int(name, sch)
    if t == "number":
        return float(example_int(name, sch))
    if t == "boolean":
        return not bool(re.search(r"^is_placeholder|deleted|disabled|blocked|archived", name))
    if t == "string":
        return example_string(name, sch)
    # propiedad sin tipo (cuerpos inline del contrato): se deduce por el nombre
    return guess_untyped(name)


def guess_untyped(name: str):
    n = name.lower()
    if n.endswith("_ids"):
        var = n[:-1]
        FK_VARS.setdefault(var, fake_uuid(var))
        return ["{{" + var + "}}"]
    if n.endswith("_id") or n == "id":
        FK_VARS.setdefault(n, fake_uuid(n))
        return "{{" + n + "}}"
    if re.search(r"^(is_|has_|enabled|active|confirm|notify|send_|force|accept|consent)", n):
        return True
    if re.search(r"date|_on$|from$|^to$|until", n):
        return example_string(name, {"format": "date"})
    if re.search(r"_at$", n):
        return example_string(name, {"format": "date-time"})
    if re.search(r"amount|price|cost|total|fee|pct|percent", n):
        return example_string(name, {"format": "decimal"})
    if re.search(r"pax|qty|quantity|count|days|hours|minutes|seats|capacity|nights|stars|rating|version", n):
        return example_int(name, {})
    if re.search(r"items|lines|ids|list|rows|passengers", n):
        return []
    if re.search(r"params|config|settings|data|payload|meta|filters|options", n):
        return {}
    return example_string(name, {})


def action_keys(desc: str) -> list[str]:
    m = re.search(r"\{([a-z_][a-z0-9_ ,?|\[\].…]*)\}", desc or "")
    if not m:
        return []
    keys = []
    for k in re.split(r"[,|]", m.group(1)):
        k = k.strip().rstrip("?").strip("[]. …")
        if re.fullmatch(r"[a-z_][a-z0-9_]*", k) and k not in keys:
            keys.append(k)
    return keys


def build_body(op: dict, path: str):
    rb = op.get("requestBody")
    if not rb:
        return None
    content = rb.get("content", {})
    if "multipart/form-data" in content:
        sch = resolve(content["multipart/form-data"]["schema"])
        form = []
        for k, v in sch.get("properties", {}).items():
            if (v or {}).get("contentMediaType") or k == "file":
                form.append({"key": k, "type": "file", "src": [], "description": "Archivo a subir (seleccionar en Postman)."})
            else:
                form.append({"key": k, "value": str(example(k, v)), "type": "text"})
        return {"mode": "formdata", "formdata": form}
    sch = content.get("application/json", {}).get("schema", {})
    ref = sch.get("$ref", "")
    if ref.endswith("/ActionBody") or ref.endswith("/GenericObject"):
        keys = action_keys(op.get("description", ""))
        if not keys:
            last = path.rstrip("/").split("/")[-1]
            if re.search(r"reject|cancel|void|revert|discard|annul|close|suspend|reopen|block", last):
                keys = ["reason"]
            elif re.search(r"approve|confirm|complete|resolve|publish", last):
                keys = ["note"]
        body = OrderedDict((k, guess_untyped(k)) for k in keys)
    else:
        body = example("", sch)
    if path in ("/api/v1/auth/login", "/api/v1/platform/auth/login"):
        body = OrderedDict([("email", "{{email}}" if "platform" not in path else "{{platformEmail}}"),
                            ("password", "{{password}}")])
        if "platform" not in path:
            body["tenant_slug"] = "{{tenantSlug}}"
    if path.endswith("/mfa/verify"):
        body = OrderedDict([("code", "{{totpCode}}")])
    return {"mode": "raw", "raw": json.dumps(body, ensure_ascii=False, indent=2),
            "options": {"raw": {"language": "json"}}}


# ------------------------------------------------------------ headers / auth
def headers_for(op: dict, params: list[dict]) -> list[dict]:
    h = [{"key": "Accept", "value": "application/json"}]
    sec = op.get("security", GLOBAL_SECURITY)
    names = [k for alt in sec for k in alt.keys()] if sec else []
    first = sec[0] if sec else {}
    if "sanctum" in first:
        h.append({"key": "Authorization", "value": "Bearer {{token}}", "description": "Token Sanctum (request «Login»)."})
    elif "platformSanctum" in first:
        h.append({"key": "Authorization", "value": "Bearer {{platformToken}}", "description": "Token del guard platform (Super Admin)."})
    if "widgetKey" in first:
        h.append({"key": "X-KipuControl-Key", "value": "{{widgetKey}}", "description": "Publishable key del tenant (validada con Origin)."})
        h.append({"key": "Origin", "value": "{{siteOrigin}}"})
    if "cartToken" in first:
        h.append({"key": "Cookie", "value": "ah_cart={{cartToken}}", "description": "Token opaco del carrito."})
    if "orderToken" in first:
        h.append({"key": "X-Order-Token", "value": "{{orderToken}}", "description": "Nombre del header: supuesto del contrato."})
    if "providerSignature" in first:
        h.append({"key": "X-Signature", "value": "{{providerSignature}}",
                  "description": "Firma HMAC del proveedor; el nombre real depende del proveedor (supuesto del contrato)."})
    if "tenantApiKey" in names and "sanctum" in first:
        h.append({"key": "Authorization", "value": "Bearer {{apiKey}}", "disabled": True,
                  "description": "Alternativa: API key del tenant (qts_test_…) con el scope indicado en la descripción."})
    refs = [p.get("$ref", "") for p in params]
    xi = (op.get("x-idempotency") or {}).get("mode")
    if any(r.endswith("/IdempotencyKey") for r in refs) or xi == "required":
        h.append({"key": "Idempotency-Key", "value": "{{$guid}}",
                  "description": "Obligatoria. Reutilizar la misma clave para probar reintentos (misma respuesta)."})
    elif any(r.endswith("/IdempotencyKeyOptional") for r in refs) or xi == "optional":
        h.append({"key": "Idempotency-Key", "value": "{{$guid}}", "description": "Recomendada por la spec (opcional)."})
    if any(r.endswith("/IfMatch") for r in refs):
        h.append({"key": "If-Match", "value": "{{lockVersion}}",
                  "description": "lock_version vigente del recurso; si no coincide → 409 (code STALE_VERSION, spec 00 SEC-BR-17)."})
    if op.get("requestBody") and "multipart/form-data" not in op["requestBody"].get("content", {}):
        h.append({"key": "Content-Type", "value": "application/json"})
    return h


def query_params(params: list[dict]) -> list[dict]:
    out = []
    for p in params:
        ref = p.get("$ref")
        if ref:
            p = PARAMS.get(ref.split("/")[-1], {})
        if p.get("in") != "query":
            continue
        name = p["name"]
        if name == "filter":  # deepObject genérico
            out.append({"key": "filter[campo]", "value": "", "disabled": True,
                        "description": p.get("description", "Filtros filter[campo]=valor.")})
            continue
        sch = p.get("schema", {})
        if name == "sort":
            val = "-created_at"
        elif name == "page[size]":
            val = "25"
        elif name in ("page[cursor]", "include"):
            val = ""
        elif name == "filter[owner]":
            val = "me"
        elif name in ("filter[q]", "q"):
            val = "Cusco"
        else:
            v = example(name.replace("filter[", "").rstrip("]"), sch)
            val = "" if isinstance(v, (dict, list)) else str(v).lower() if isinstance(v, bool) else str(v)
            if val.startswith("Ejemplo "):
                val = ""
        out.append({"key": name, "value": val, "disabled": not p.get("required", False),
                    "description": p.get("description", "")})
    return out


LOGIN_TEST = [
    "// Guarda el token en el entorno activo (o en variables de colección si no hay entorno).",
    "pm.test('Login responde 200', () => pm.response.to.have.status(200));",
    "const body = pm.response.json();",
    "const token = body.token || (body.data && body.data.token);",
    "const store = pm.environment.name ? pm.environment : pm.collectionVariables;",
    "if (token) { store.set('{var}', token); }",
    "const needsMfa = body.mfa_required || (body.abilities || (body.data && body.data.abilities) || []).includes('mfa:verify');",
    "store.set('{var}MfaPending', needsMfa ? 'true' : 'false');",
    "if (needsMfa) { console.log('MFA requerido: completar totpCode y ejecutar «MFA verify».'); }",
]
MFA_TEST = [
    "pm.test('MFA verificado', () => pm.response.to.have.status(200));",
    "const body = pm.response.json();",
    "const token = body.token || (body.data && body.data.token);",
    "const store = pm.environment.name ? pm.environment : pm.collectionVariables;",
    "if (token) { store.set('{var}', token); store.set('{var}MfaPending', 'false'); }",
]


def describe(op: dict, method: str, path: str) -> str:
    L = []
    if op.get("description"):
        L.append(op["description"])
        L.append("")
    L.append(f"- **Permiso (x-permission):** `{op.get('x-permission', '—')}`")
    if op.get("x-permissions"):
        L.append("- **Permisos spatie (x-permissions):** " + ", ".join(f"`{p}`" for p in op["x-permissions"]))
    L.append(f"- **Fase (x-phase):** {op.get('x-phase', '—')}")
    L.append(f"- **Especificación (x-spec):** {op.get('x-spec', '—')}")
    if op.get("x-spec-also"):
        also = op["x-spec-also"]
        L.append("- **También en:** " + (", ".join(also) if isinstance(also, list) else str(also)))
    if op.get("x-resource"):
        L.append(f"- **Tabla (x-resource):** `{op['x-resource']}`")
    xi = op.get("x-idempotency")
    if xi:
        L.append(f"- **Idempotencia (x-idempotency):** {xi.get('mode')} — {xi.get('source', '')}")
    if op.get("x-api-key-scope"):
        L.append(f"- **Scope API key/OAuth:** `{op['x-api-key-scope']}`")
    sec = op.get("security", GLOBAL_SECURITY)
    L.append("- **Seguridad:** " + (" · ".join("+".join(a.keys()) or "pública" for a in sec) if sec else "pública"))
    L.append(f"- **operationId:** `{op.get('operationId', '')}` · `{method.upper()} {path}`")
    return "\n".join(L)


def make_request(path: str, method: str, op: dict, path_item: dict) -> dict:
    params = list(path_item.get("parameters", [])) + list(op.get("parameters", []))
    pvars = re.findall(r"\{(\w+)\}", path)
    pm_path = re.sub(r"\{(\w+)\}", r":\1", path)
    segs = [s for s in pm_path.split("/") if s]
    url = {
        "raw": "{{baseUrl}}" + pm_path,
        "host": ["{{baseUrl}}"],
        "path": segs,
    }
    q = query_params(params)
    if q:
        url["query"] = q
        enabled = [f"{x['key']}={x['value']}" for x in q if not x.get("disabled")]
        if enabled:
            url["raw"] += "?" + "&".join(enabled)
    if pvars:
        pdesc = {}
        for p in params:
            if p.get("in") == "path":
                pdesc[p["name"]] = p.get("description", "")
        url["variable"] = [{"key": v, "value": path_var_value(path, v), "description": pdesc.get(v, "")} for v in pvars]
    req = {"method": method.upper(), "header": headers_for(op, params), "url": url,
           "description": describe(op, method, path)}
    body = build_body(op, path)
    if body:
        req["body"] = body
    name = op.get("summary") or f"{method.upper()} {path}"
    item = {"name": name[:120], "request": req, "response": []}
    if path.endswith("/auth/login") and method == "post":
        var = "platformToken" if path.startswith("/api/v1/platform") else "token"
        item["event"] = [{"listen": "test", "script": {"type": "text/javascript",
                                                         "exec": [l.replace("{var}", var) for l in LOGIN_TEST]}}]
    if path.endswith("/mfa/verify") and method == "post":
        var = "platformToken" if path.startswith("/api/v1/platform") else "token"
        item["event"] = [{"listen": "test", "script": {"type": "text/javascript",
                                                         "exec": [l.replace("{var}", var) for l in MFA_TEST]}}]
        req["header"] = [h for h in req["header"] if h["key"] != "Authorization"] + [
            {"key": "Authorization", "value": "Bearer {{" + var + "}}",
             "description": "Token con ability mfa:verify devuelto por el login."}]
    return item


def main() -> int:
    ops = []
    for path, item in spec["paths"].items():
        for m in METHODS:
            if m in item:
                ops.append((path, m, item[m], item))
    total = len(ops)

    first, rest = [], []
    for o in ops:
        (first if (o[0] in AUTH_FIRST and (o[1] == "post" or o[0] == "/api/v1/me")) else rest).append(o)
    first.sort(key=lambda o: AUTH_FIRST.index(o[0]))

    tag_order = [t["name"] for t in spec.get("tags", [])]
    tag_desc = {t["name"]: t.get("description", "") for t in spec.get("tags", [])}
    tree: dict[int, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for path, m, op, it in rest:
        tag = (op.get("tags") or ["Sin módulo"])[0]
        tree[op.get("x-phase", 9)][tag].append(make_request(path, m, op, it))

    items = [{
        "name": "00 · Inicio: autenticación",
        "description": ("Ejecutar primero «POST /auth/login»: su script de prueba guarda `token` en el entorno. "
                        "Si el usuario tiene MFA (Tenant Admin, Finanzas…), completar `totpCode` y ejecutar "
                        "«POST /auth/mfa/verify», que reemplaza el token por el definitivo. Para `/platform/*` usar "
                        "el login de plataforma (guarda `platformToken`)."),
        "item": [make_request(p, m, op, it) for p, m, op, it in first],
    }]
    for ph in sorted(tree):
        tags = tree[ph]
        folder = {"name": PHASE_NAMES.get(ph, f"Fase {ph}"),
                  "description": f"Operaciones con `x-phase = {ph}`.", "item": []}
        for tag in sorted(tags, key=lambda t: tag_order.index(t) if t in tag_order else 99):
            folder["item"].append({"name": tag, "description": tag_desc.get(tag, ""), "item": tags[tag]})
        items.append(folder)

    variables = [
        {"key": "lockVersion", "value": "1", "description": "lock_version leído del recurso para If-Match."},
    ]
    for k in sorted(FK_VARS):
        variables.append({"key": k, "value": FK_VARS[k],
                          "description": "UUID de ejemplo (supuesto). Reemplazar por un id real del tenant."})

    collection = {
        "info": {
            "name": spec["info"]["title"] + " · Postman",
            "_postman_id": "6f1c1e1a-5b7a-4c39-9d1e-0000000000a1",
            "description": (
                "Colección generada por `kit-ia/api/postman/build_postman.py` desde `kit-ia/api/openapi.json` "
                f"(OpenAPI {spec.get('openapi')}, versión {spec['info'].get('version', '')}). "
                f"{total} requests organizadas por fase y módulo. No editar a mano: regenerar.\n\n"
                "Variables de entorno: `baseUrl`, `email`, `password`, `tenantSlug`, `totpCode`, `token` (lo llena el login), "
                "`platformToken`, `widgetKey`, `siteOrigin`, `apiKey`, `cartToken`, `orderToken`, `providerSignature`."),
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "item": items,
        "variable": variables,
    }

    def count(node):
        return sum(count(i) if "item" in i else 1 for i in node["item"])

    n = count(collection)
    out = HERE / "kipucontrol-api.postman_collection.json"
    out.write_text(json.dumps(collection, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def env(name, base, email, slug, origin, note):
        values = [
            ("baseUrl", base, "default"), ("tenantSlug", slug, "default"), ("email", email, "default"),
            ("password", "KipuControl#E2E-2026", "secret"), ("totpCode", "", "default"), ("token", "", "secret"),
            ("tokenMfaPending", "false", "default"), ("platformEmail", "ops@kipucontrol.com", "default"),
            ("platformToken", "", "secret"), ("widgetKey", "pk_test_" + slug, "secret"), ("siteOrigin", origin, "default"),
            ("apiKey", "qts_test_" + slug, "secret"), ("cartToken", "", "secret"), ("orderToken", "", "secret"),
            ("providerSignature", "", "secret"), ("lockVersion", "1", "default"),
        ]
        return {"id": hashlib.md5(name.encode()).hexdigest(), "name": name,
                "values": [{"key": k, "value": v, "type": t, "enabled": True} for k, v, t in values],
                "_postman_variable_scope": "environment", "_postman_note": note}

    (HERE / "local.postman_environment.json").write_text(json.dumps(env(
        "KipuControl · local (andes · TNT-0001)", "http://andes.localhost:8000", "mquispe@andeshorizonte.pe", "andes",
        "http://andes.localhost:3000",
        "Usuarios de kit-ia/seeds/users.json; contraseña = E2E_PASSWORD del E2ESeeder."), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8")
    (HERE / "tenant-b.postman_environment.json").write_text(json.dumps(env(
        "KipuControl · tenant B (selva · TNT-0002)", "http://selva.localhost:8000", "gerencia@selvaviva.pe", "selva",
        "http://selva.localhost:3000",
        "Tenant de aislamiento (E2E-08): los ids del tenant andes deben responder 404."), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8")

    print(f"operaciones en OpenAPI: {total} · requests en colección: {n} · variables FK: {len(FK_VARS)}")
    if n != total or n != EXPECTED_REQUESTS:
        print(f"ERROR: se esperaban {EXPECTED_REQUESTS} requests", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
