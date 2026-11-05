#!/usr/bin/env python3
"""
build_openapi.py — Genera el contrato OpenAPI 3.1 de Qhapaq Travel Suite a partir de las
19 especificaciones de módulo (proto/docs/especificaciones/00…18-*.md).

Entradas:
  - §6 (API REST) de cada especificación: tablas markdown «Método | Endpoint | Permiso | Descripción | Idempotente/lock».
  - §3 (Modelo de datos) de cada especificación: tablas «columna | tipo | null | notas» → components.schemas.

Salidas (en este mismo directorio):
  - openapi.yaml / openapi.json  (contrato validado con openapi-spec-validator)
  - ENDPOINTS.md                  (índice por fase y módulo + resumen + conflictos)

Uso:
  python3 kit-ia/api/build_openapi.py            # genera y valida
  python3 kit-ia/api/build_openapi.py --check    # además falla (exit 1) si el contrato generado difiere del versionado

El script es determinista: misma entrada ⇒ misma salida (sin fechas ni aleatoriedad).
Todas las decisiones de interpretación (alias de rutas, expansiones ambiguas, mapeos de recurso,
fases) están en las constantes de la sección «REGLAS» y se reportan en ENDPOINTS.md.
"""
from __future__ import annotations

import copy
import json
import re
import sys
from collections import OrderedDict, defaultdict
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent                       # /home/claude/agencia-viajes
import os as _os
# Ubicación de las specs: variable QHAPAQ_SPECS_DIR, o estructura original (proto/docs/especificaciones),
# o estructura del repositorio de docs (docs/kit/api → docs/especificaciones).
SPECS_DIR = Path(_os.environ["QHAPAQ_SPECS_DIR"]) if _os.environ.get("QHAPAQ_SPECS_DIR") else next(
    (d for d in (ROOT / "proto" / "docs" / "especificaciones", ROOT / "especificaciones") if d.is_dir()),
    ROOT / "proto" / "docs" / "especificaciones")
CONTRACT_VERSION = "1.0.0"
SOURCE_DOCS_VERSION = "v2.2"

HTTP_METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE")

# ════════════════════════════════════════════════════════════════════════════════════════
# REGLAS (todas las decisiones de interpretación viven aquí)
# ════════════════════════════════════════════════════════════════════════════════════════

TAGS = OrderedDict([
    ("00", ("Núcleo", "Auth, sesión (/me), búsqueda global, solicitudes de acceso (spec 00).")),
    ("01", ("CRM", "Leads, oportunidades, actividades, clientes 360, postventa y fidelización (spec 01).")),
    ("02", ("Catálogo", "Productos, sub-recursos, salidas, holds, tarifas, temporadas, pricing, destinos, servicios y proveedores (spec 02).")),
    ("03", ("Cotizaciones", "Cotizaciones, versiones, aprobación interna, envío, portal por token y conversión (spec 03).")),
    ("04", ("Reservas", "Reservas, pasajeros, servicios, cambios, reprogramación, cancelación (spec 04).")),
    ("05", ("Operaciones y móvil", "Órdenes operativas, asignaciones, rooming, vouchers, incidencias, app operador y app pasajero (spec 05).")),
    ("06", ("Extranet de proveedores", "Portal del proveedor y contraparte de back-office (spec 06).")),
    ("07", ("Finanzas", "CxC, pagos, CxP, comisiones, rentabilidad, facturación electrónica, conciliación y cierre (spec 07).")),
    ("08", ("Canales y portales", "B2B, e-commerce, CMS, portal del cliente y del pasajero (spec 08).")),
    ("09", ("Administración y reportes", "Plataforma (tenants), usuarios, sedes, roles, configuración, notificaciones, integraciones, jobs, auditoría y reportes (spec 09).")),
    ("10", ("Aprobaciones e inbox", "Bandeja de aprobaciones unificada y bandeja omnicanal (spec 10).")),
    ("11", ("Cupos y documentos de viaje", "Allotments y documentos de viaje del pasajero (spec 11).")),
    ("12", ("Tesorería y reclamaciones", "Caja y bancos, caja chica, flujo de caja y Libro de Reclamaciones (spec 12).")),
    ("13", ("Plataforma SaaS y API", "Suscripción, facturación de plataforma, entitlements, API keys, webhooks y OAuth (spec 13).")),
    ("14", ("Marketing y metas", "Segmentos, plantillas, campañas, automatizaciones, consentimientos y metas comerciales (spec 14).")),
    ("15", ("Sitio web público", "API pública /public: catálogo, carrito, checkout, captación y cuenta del cliente (spec 15).")),
    ("16", ("Motor de reservas", "Disponibilidad, cotización y reserva pública; configuración del motor por producto (spec 16).")),
    ("17", ("Reglas, comunicaciones y monedas", "Centro de reglas, mensajes al pasajero, monedas, reseñas externas e integración web/widget (spec 17).")),
    ("18", ("Reseñas propias", "Reseñas verificadas: moderación, solicitudes y alta del pasajero (spec 18).")),
])

PHASES = {
    0: "Fase 0 · Fundaciones",
    1: "Fase 1 · MVP",
    2: "Fase 2 · Canales y campo",
    3: "Fase 3 · SaaS y crecimiento",
}

# Prefijo base para endpoints relativos (los que no empiezan por /api/v1).
SPEC_BASE = {"07": "/api/v1/finance"}          # 07 §6: «Prefijo /api/v1/finance»
DEFAULT_BASE = "/api/v1"

# Alias de rutas: variantes que una spec usa para un prefijo que otra spec define como canónico.
PATH_ALIASES = [
    ("/api/v1/fin/", "/api/v1/finance/",
     "06 §6 usa `/fin/supplier-invoices`; 07 §6 fija el prefijo `/api/v1/finance`."),
    ("/api/v1/operations/", "/api/v1/ops/",
     "05 §6.9 (v2.1) usa `/operations/…`; 05 §6.1–6.6 fija `/ops/…`."),
    ("/api/v1/customer/reservations/", "/api/v1/portal/customer/reservations/",
     "15 §6.6 usa `/customer/reservations/{code}/companions`; 08 §6.7 define la misma operación en `/portal/customer/…`."),
]

# Expansiones de celdas con varias rutas que la heurística general no resuelve bien.
# clave = (spec, texto crudo de la celda Endpoint) → lista de (método|None, ruta absoluta o relativa)
CELL_OVERRIDES = {
    ("00", "`/api/v1/platform/auth/login` · `/mfa/verify`"): [
        (None, "/api/v1/platform/auth/login"), (None, "/api/v1/platform/auth/mfa/verify")],
    ("10", "`/api/v1/integrations/whatsapp/webhook` · `/email/inbound` · `/public/contact`"): [
        (None, "/api/v1/integrations/whatsapp/webhook"), (None, "/api/v1/integrations/email/inbound"),
        (None, "/api/v1/public/contact")],
    ("14", "`/api/v1/integrations/email/webhooks` · `/whatsapp/webhooks/messages`"): [
        (None, "/api/v1/integrations/email/webhooks"), (None, "/api/v1/integrations/whatsapp/webhooks/messages")],
    ("08", "`/api/v1/portal/passenger/messages/{id}/read` · `/read-all`"): [
        (None, "/api/v1/portal/passenger/messages/{id}/read"), (None, "/api/v1/portal/passenger/messages/read-all")],
    ("13", "`/api/v1/integrations/oauth-apps` (+ `/{id}/secret`)"): [
        ("GET", "/api/v1/integrations/oauth-apps"), ("POST", "/api/v1/integrations/oauth-apps"),
        ("POST", "/api/v1/integrations/oauth-apps/{id}/secret"), ("DELETE", "/api/v1/integrations/oauth-apps/{id}")],
    ("08", "`/api/v1/channels/portal-preview/clients/{clientId}/…`"): [
        (None, "/api/v1/channels/portal-preview/clients/{clientId}/{portalPath}")],
    ("12", "`/api/v1/crm/claim-book/reports?group=type|sede|month` · POST `/exports`"): [
        (None, "/api/v1/crm/claim-book/reports?group=type|sede|month"), ("POST", "/api/v1/crm/claim-book/exports")],
}
OVERRIDE_NOTES = {
    ("08", "`/api/v1/channels/portal-preview/clients/{clientId}/…`"):
        "La spec usa `…` (mismos GET del portal del cliente en solo lectura). Se modela como `{portalPath}` (supuesto).",
    ("13", "`/api/v1/integrations/oauth-apps` (+ `/{id}/secret`)"):
        "«Registro, rotación y revocación»: rotación = POST `/{id}/secret`, revocación = DELETE `/{id}` (supuesto).",
    ("12", "`/api/v1/crm/claim-book/reports?group=type|sede|month` · POST `/exports`"):
        "«POST `/exports`» se interpreta como `/crm/claim-book/exports` (hermano de `reports`).",
    ("08", "`/api/v1/portal/passenger/messages/{id}/read` · `/read-all`"):
        "`/read-all` se interpreta a nivel de colección (`/messages/read-all`), igual que `/me/notifications/read-all`.",
}

# Abreviaturas de permisos declaradas en cada spec.
PERM_ABBREV = {
    "02": {"view": "catalog.products.view", "create": "catalog.products.create", "update": "catalog.products.update",
           "activate": "catalog.products.activate", "rates": "catalog.products.manage_rates",
           "avail": "catalog.products.manage_availability", "profit": "catalog.products.view_profitability",
           "publish": "catalog.products.publish", "prov": "catalog.providers.manage",
           "ruta proveedores": "catalog.providers.manage ∨ finance.payables ∨ catalog.products.update"},
    "16": {"view": "catalog.products.view", "update": "catalog.products.update",
           "manage_availability": "catalog.products.manage_availability", "manage_rates": "catalog.products.manage_rates"},
    "07": {"OP": "finance.payments.register"},
    "01": {"lectura": "crm.clients.manage | finance.receivables"},
    "11-docs": {},
    "11": {"manage": "catalog.allotments.manage",
           "lectura": "catalog.allotments.manage | catalog.products.view_profitability"},
    "14": {"manage": "crm.targets.manage", "view": "crm.targets.view"},
}

# Dominios propios de cada spec (primer segmento tras /api/v1) — decide la fuente primaria al deduplicar.
SPEC_DOMAINS = {
    "00": {"auth", "me", "search", "access-requests"}, "01": {"crm", "dashboard", "exports"}, "02": {"catalog"},
    "03": {"quotes"}, "04": {"reservations", "pax-feedback"}, "05": {"ops", "mobile"}, "06": {"supplier"},
    "07": {"finance"}, "08": {"channels", "b2b", "cms", "portal"},
    "09": {"platform", "iam", "settings", "notifications", "integrations", "jobs", "audit-events", "reports",
           "dashboard", "integration-errors"},
    "10": {"approvals", "approval-rules", "inbox"}, "11": set(), "12": {"treasury"},
    "13": {"billing", "platform", "integrations", "docs"}, "14": {"marketing"},
    "15": {"public", "webhooks"}, "16": set(), "17": {"admin"}, "18": {"reviews", "review-requests", "passenger"},
}

# Scopes de API key / OAuth (catálogo SCOPES del prototipo, modules/plataforma.js) y rutas que los aceptan
# (tabla API_EP del prototipo + descripción de cada scope). El resto de rutas: solo Sanctum (supuesto).
API_SCOPES = OrderedDict([
    ("catalog:read", "Leer catálogo, productos y tarifas públicas"),
    ("availability:read", "Consultar disponibilidad y salidas"),
    ("crm:read", "Leer leads, clientes y oportunidades"),
    ("crm:write", "Crear/actualizar leads y clientes"),
    ("quotes:read", "Leer cotizaciones"),
    ("quotes:write", "Crear cotizaciones y versiones"),
    ("reservations:read", "Leer reservas y pasajeros"),
    ("reservations:write", "Crear/modificar reservas"),
    ("payments:read", "Leer pagos y cuentas por cobrar"),
    ("invoices:read", "Leer comprobantes electrónicos"),
    ("operations:read", "Leer órdenes operativas y vouchers"),
    ("webhooks:manage", "Gestionar webhooks por API"),
])
SCOPE_ROUTES = {
    ("GET", "/api/v1/catalog/products"): "catalog:read",
    ("GET", "/api/v1/catalog/products/{}"): "catalog:read",
    ("GET", "/api/v1/catalog/products/{}/availability"): "availability:read",
    ("GET", "/api/v1/catalog/departures"): "availability:read",
    ("GET", "/api/v1/crm/leads"): "crm:read", ("GET", "/api/v1/crm/leads/{}"): "crm:read",
    ("GET", "/api/v1/crm/clients"): "crm:read", ("GET", "/api/v1/crm/clients/{}"): "crm:read",
    ("GET", "/api/v1/crm/opportunities"): "crm:read", ("GET", "/api/v1/crm/opportunities/{}"): "crm:read",
    ("POST", "/api/v1/crm/leads"): "crm:write", ("PATCH", "/api/v1/crm/leads/{}"): "crm:write",
    ("POST", "/api/v1/crm/clients"): "crm:write", ("PATCH", "/api/v1/crm/clients/{}"): "crm:write",
    ("GET", "/api/v1/quotes"): "quotes:read", ("GET", "/api/v1/quotes/{}"): "quotes:read",
    ("POST", "/api/v1/quotes"): "quotes:write", ("POST", "/api/v1/quotes/{}/versions"): "quotes:write",
    ("GET", "/api/v1/reservations"): "reservations:read", ("GET", "/api/v1/reservations/{}"): "reservations:read",
    ("POST", "/api/v1/reservations"): "reservations:write",
    ("GET", "/api/v1/finance/payments"): "payments:read", ("GET", "/api/v1/finance/payments/{}"): "payments:read",
    ("GET", "/api/v1/finance/receivables"): "payments:read", ("GET", "/api/v1/finance/receivables/{}"): "payments:read",
    ("GET", "/api/v1/finance/invoices"): "invoices:read", ("GET", "/api/v1/finance/invoices/{}"): "invoices:read",
    ("GET", "/api/v1/ops/orders"): "operations:read", ("GET", "/api/v1/ops/orders/{}"): "operations:read",
    ("GET", "/api/v1/ops/vouchers"): "operations:read", ("GET", "/api/v1/ops/vouchers/{}"): "operations:read",
    ("GET", "/api/v1/integrations/webhooks"): "webhooks:manage", ("POST", "/api/v1/integrations/webhooks"): "webhooks:manage",
    ("PATCH", "/api/v1/integrations/webhooks/{}"): "webhooks:manage",
    ("DELETE", "/api/v1/integrations/webhooks/{}"): "webhooks:manage",
}

# Mapeo segmento de ruta → tabla (§3). Clave: (padre, segmento) | (dominio, segmento) | segmento.
RESOURCE_MAP = {
    "reservations": "booking_reservations", "quotes": "quote_quotes",
    ("quotes", "versions"): "quote_versions", ("products", "versions"): "catalog_product_versions",
    ("reservations", "passengers"): "booking_passengers", ("reservations", "services"): "booking_services",
    ("reservations", "changes"): "booking_changes", ("reservations", "cancel-requests"): "booking_cancel_requests",
    ("reservations", "pax-feedback"): "channel_pax_feedback", "pax-feedback": "channel_pax_feedback",
    ("reservations", "pax-messages"): "notif_pax_messages",
    "approvals": "collab_approval_requests", "info-requests": "collab_approval_info_requests",
    "approval-rules": "collab_approval_rules", "claim-book": "crm_claims",
    "pax-templates": "notif_pax_message_templates", "pax-messages": "notif_pax_messages",
    ("ops", "orders"): "ops_orders", ("ecommerce", "orders"): "channel_ecom_orders",
    ("shop", "orders"): "channel_ecom_orders", ("public", "orders"): "channel_ecom_orders",
    "rooming-rooms": "ops_rooming_rooms", ("rooming-lists", "rooms"): "ops_rooming_rooms",
    "order-tasks": "ops_order_tasks", ("orders", "tasks"): "ops_order_tasks",
    ("orders", "assignments"): "ops_assignments", ("orders", "evidences"): "ops_evidences",
    ("incidents", "evidences"): "ops_evidences",
    "devices": "ops_mobile_devices", "categories": "catalog_product_categories",
    "departures": "catalog_product_departures", "holds": "catalog_availability_holds",
    "agencies": "channel_b2b_agencies", "contents": "cms_contents", "subscription": "subscriptions",
    ("billing", "invoices"): "platform_invoices", ("platform", "invoices"): "platform_invoices",
    ("finance", "invoices"): "fin_invoices", ("payables", "invoices"): "supplier_invoices",
    ("treasury", "accounts"): "fin_treasury_accounts", ("treasury", "movements"): "fin_treasury_movements",
    ("accounts", "movements"): "fin_treasury_movements", "transfers": "fin_treasury_transfers",
    "counts": "fin_cash_counts", "replenishments": "fin_cash_replenishments",
    ("petty-cash", "sessions"): "fin_cash_sessions", "expenses": "fin_expense_receipts",
    "revaluations": "fin_fx_revaluations", "reviews": "crm_own_reviews", "review-requests": "crm_review_requests",
    ("marketing", "templates"): "mkt_templates", ("notifications", "templates"): "notif_templates",
    ("inbox", "messages"): "collab_messages", ("conversations", "messages"): "collab_messages",
    ("notifications", "messages"): "notif_messages", ("notifications", "rules"): "notif_event_rules",
    "conversations": "collab_conversations", "booking-rules": "sys_booking_rules",
    "rule-overrides": "catalog_product_rule_overrides", "pax-rules": "catalog_pax_rules",
    "payment-policy": "catalog_payment_policies", "legs": "catalog_accommodation_legs",
    ("legs", "hotels"): "catalog_accommodation_hotels", ("catalog", "addons"): "catalog_product_addons",
    ("products", "addons"): "catalog_product_addons", "carts": "channel_web_carts",
    ("current", "items"): "channel_web_cart_items", "wishlist": "channel_wishlist_items",
    "api-keys": "integration_api_keys", ("integrations", "webhooks"): "integration_webhooks",
    "integrations": "integration_adapters", "jobs": "sys_scheduled_jobs", ("reports", "exports"): "report_exports",
    "sales-targets": "crm_sales_targets", "sequences": "sys_sequences", ("iam", "users"): "iam_users",
    "sedes": "iam_sedes", "tenants": "tenants", "plans": "plans", "allotments": "catalog_allotments",
    ("allotments", "requests"): "catalog_allotment_requests", ("allotments", "charges"): "catalog_allotment_charges",
    "supplier-requests": "ops_supplier_requests", ("catalog", "rate-requests"): "supplier_rate_requests",
    ("supplier", "rate-requests"): "supplier_rate_requests", "tickets": "channel_support_tickets",
    "receivables": "fin_receivables", ("finance", "payments"): "fin_payments", ("receivables", "payments"): "fin_payments",
    "payables": "fin_payables", "payouts": "fin_payable_payouts", "commissions": "fin_commissions",
    "commission-rules": "fin_commission_rules", "bank-accounts": "fin_bank_accounts", "bank-lines": "fin_bank_lines",
    "costs": "fin_payables", "settlement-requests": "channel_b2b_settlement_requests",
    "credit-movements": "channel_b2b_credit_movements", "price-lists": "channel_b2b_price_lists",
    "promotions": "catalog_product_promotions", "b2b-rates": "catalog_product_b2b_rates",
    "segments": "mkt_segments", "campaigns": "mkt_campaigns", "recipients": "mkt_campaign_recipients",
    "automations": "mkt_automations", "consents": "mkt_consents", ("consents", "events"): "mkt_consent_events",
    "incidents": "ops_incidents", ("ops", "evidences"): "ops_evidences", "vouchers": "ops_vouchers",
    "assignments": "ops_assignments", "rooming-lists": "ops_rooming_lists", "leads": "crm_leads",
    "clients": "crm_clients", "opportunities": "crm_opportunities", "activities": "crm_activities",
    "cases": "crm_cases", "surveys": "crm_surveys", ("clients", "contacts"): "crm_client_contacts",
    "pipeline-stages": "crm_pipeline_stages", "products": "catalog_products", "destinations": "catalog_destinations",
    "providers": "catalog_providers", ("catalog", "services"): "catalog_services", "seasons": "catalog_seasons",
    ("catalog", "rates"): "catalog_rates", ("products", "rates"): "catalog_rates",
    "price-rules": "catalog_price_rules", "product-types": "catalog_product_types",
    "availability-ranges": "catalog_availability_ranges", "audit-events": "audit_events",
    "integration-errors": "integration_errors", "access-requests": "iam_access_requests",
    ("passenger", "feedback"): "channel_pax_feedback", ("supplier", "incidents"): "ops_incidents",
    ("supplier", "requests"): "ops_supplier_requests", "rate-requests": "supplier_rate_requests",
    "supplier-responses": "supplier_request_responses", "supplier-invoices": "supplier_invoices",
    "fx-rates": "sys_fx_rates", ("finance", "fx-rates"): "sys_fx_rates", ("settings", "fx-rates"): "sys_fx_rates",
    "trip-messages": "channel_trip_messages", ("passenger", "messages"): "channel_trip_messages",
    "webhook-deliveries": "integration_webhook_deliveries",
    ("features", "plans"): "plan_features", ("allotments", "days"): "catalog_allotment_days",
    # sin tabla propia en §3 (evita falsos positivos del mapeo genérico)
    ("itineraries", "days"): "", ("days", "items"): "", ("products", "policies"): "", ("sessions", "messages"): "",
}
# Prefijo de tabla esperado por dominio (primer segmento) para el mapeo genérico segmento → tabla.
DOMAIN_PREFIX = {"crm": "crm_", "catalog": "catalog_", "quotes": "quote_", "reservations": "booking_", "ops": "ops_",
                 "mobile": "ops_", "supplier": "supplier_", "finance": "fin_", "channels": "channel_", "b2b": "channel_b2b_",
                 "cms": "cms_", "iam": "iam_", "notifications": "notif_", "integrations": "integration_",
                 "approvals": "collab_", "inbox": "collab_", "treasury": "fin_", "marketing": "mkt_", "public": "channel_",
                 "admin": "sys_", "settings": "sys_"}
# Segmentos raíz que no representan un recurso propio (no se infiere x-resource de ellos).
NO_ROOT_RESOURCE = {"integrations", "platform", "notifications", "settings", "admin", "billing", "public", "me"}
# Nombre canónico de parámetro forzado por prefijo de plantilla (tiene prioridad sobre el voto por frecuencia).
PARAM_NAME_OVERRIDES = {"/api/v1/webhooks/payments/{}": "{gateway}"}   # webhook de la pasarela (07/08/13/15)
# Sub-recursos 1:1 (GET/PUT devuelven un objeto, no una lista).
SINGLETONS = {"pax-rules", "payment-policy", "subscription"}

# Columnas que nunca se exponen por la API.
HIDDEN_COLUMNS = re.compile(r"^(tenant_id|password|password_hash|remember_token|secret|secret_encrypted|"
                            r"token_hash|key_hash|recovery_codes|totp_secret|secret_enc)$")
READONLY_COLUMNS = {"id", "created_at", "updated_at", "created_by", "updated_by", "deleted_at"}

# ════════════════════════════════════════════════════════════════════════════════════════
# Utilidades de parsing markdown
# ════════════════════════════════════════════════════════════════════════════════════════

def split_row(line: str) -> list[str]:
    """Divide una fila de tabla markdown respetando `\\|` y pipes dentro de backticks."""
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|") and not s.endswith("\\|"):
        s = s[:-1]
    cells, cur, in_tick, i = [], [], False, 0
    while i < len(s):
        ch = s[i]
        if ch == "\\" and i + 1 < len(s) and s[i + 1] == "|":
            cur.append("|"); i += 2; continue
        if ch == "`":
            in_tick = not in_tick
        if ch == "|" and not in_tick:
            cells.append("".join(cur).strip()); cur = []
        else:
            cur.append(ch)
        i += 1
    cells.append("".join(cur).strip())
    return cells


def section(text: str, num: int) -> list[str]:
    lines, out, on = text.splitlines(), [], False
    for ln in lines:
        if re.match(rf"^## {num}\.", ln):
            on = True; continue
        if on and re.match(r"^## \d+\.", ln):
            break
        if on:
            out.append(ln)
    return out


def clean(s: str) -> str:
    s = s.replace("**", "").replace("`", "")
    return re.sub(r"\s+", " ", s).strip()


def camel(words: list[str]) -> str:
    parts = []
    for w in words:
        for p in re.split(r"[-_.\s]+", w):
            if p:
                parts.append(p)
    if not parts:
        return "root"
    return parts[0].lower() + "".join(p[:1].upper() + p[1:] for p in parts[1:])


def pascal(name: str) -> str:
    return "".join(p[:1].upper() + p[1:] for p in re.split(r"[_\-\s]+", name) if p)


def singular(word: str) -> str:
    if word.endswith("ies"):
        return word[:-3] + "y"
    if word.endswith(("sses", "uses")):
        return word[:-2]
    if word.endswith("s") and not word.endswith(("ss", "us", "is")):
        return word[:-1]
    return word


def schema_name(table: str) -> str:
    parts = table.split("_")
    parts[-1] = singular(parts[-1])
    return pascal("_".join(parts))


def template(path: str) -> str:
    return re.sub(r"\{[^}]+\}", "{}", path)


# ════════════════════════════════════════════════════════════════════════════════════════
# §3 Modelo de datos → schemas
# ════════════════════════════════════════════════════════════════════════════════════════

TABLE_TOKEN = re.compile(r"`([a-z][a-z0-9_]*)`")


def heading_table(line: str) -> str | None:
    m = TABLE_TOKEN.search(line)
    if m and "_" in m.group(1) or (m and m.group(1) in {"tenants", "plans", "subscriptions"}):
        return m.group(1)
    m = re.match(r"^#+\s+(?:[\d.]+\s+)?([a-z][a-z0-9_]+)\b", line)
    if m and "_" in m.group(1):
        return m.group(1)
    return None


def parse_tables(spec: str, fname: str, text: str, tables: dict, notes: list):
    lines = section(text, 3)
    last_heading, last_text = None, None
    i = 0
    while i < len(lines):
        ln = lines[i]
        st = ln.strip()
        if st.startswith("#"):
            last_heading, last_text = st, st
            i += 1; continue
        if st.startswith("|"):
            header = [c.lower() for c in split_row(st)]
            first = clean(header[0]) if header else ""
            is_cols = bool(re.match(r"^(columna|columna / clave)$", first)) or first.endswith(" columna")
            if not is_cols:
                while i < len(lines) and lines[i].strip().startswith("|"):
                    i += 1
                continue
            # nombre de tabla
            tname = None
            m = TABLE_TOKEN.search(split_row(st)[0])
            if first.endswith(" columna") and m:
                tname = m.group(1)
            if not tname and last_text and not last_text.startswith("#") and re.match(r"^(\*\*)?\s*(v[\d.]+\s*·\s*)?`", last_text):
                tname = heading_table(last_text)
            if not tname and last_text and last_text.startswith("**"):
                tname = heading_table(last_text)
            if not tname and last_heading:
                tname = heading_table(last_heading)
            idx_type = next((k for k, h in enumerate(header) if clean(h).startswith("tipo")), 1)
            idx_null = next((k for k, h in enumerate(header) if clean(h) == "null"), None)
            idx_notes = next((k for k, h in enumerate(header) if clean(h).startswith("notas")), len(header) - 1)
            i += 1
            cols = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = split_row(lines[i])
                i += 1
                if cells and re.match(r"^:?-{3,}", cells[0]):
                    continue
                if len(cells) <= idx_type:
                    continue
                raw_names = clean(cells[0])
                names = [n.strip() for n in re.split(r"\s*/\s*|,\s*", raw_names) if n.strip()]
                types = [t.strip() for t in re.split(r"\s+/\s+", clean(cells[idx_type]))] if cells[idx_type] else [""]
                nulls = [n.strip() for n in re.split(r"\s+/\s+", clean(cells[idx_null]))] if idx_null is not None and idx_null < len(cells) else ["?"]
                note = cells[idx_notes] if idx_notes < len(cells) else ""
                for k, nm in enumerate(names):
                    if not re.match(r"^[a-z_][a-z0-9_]*$", nm):
                        continue
                    ty = types[k] if len(types) == len(names) else types[0]
                    nu = nulls[k] if len(nulls) == len(names) else nulls[0]
                    cols.append((nm, ty, nu, note))
            if not tname:
                notes.append(f"{spec} §3: tabla sin nombre reconocible antes de «{last_text[:60] if last_text else ''}» (omitida)")
                continue
            t = tables.setdefault(tname, {"spec": spec, "columns": OrderedDict(), "specs": []})
            if fname not in t["specs"]:
                t["specs"].append(fname)
            for c in cols:
                t["columns"].setdefault(c[0], c)
            continue
        if st:
            last_text = st
        i += 1


def enum_from_notes(note: str) -> list[str] | None:
    if "CHECK" not in note:
        return None
    m = re.search(r"CHECK[^`(]*?(?:\(\s*[a-z_]+\s+)?IN\s*\(([^)]*)\)", note)
    if not m:
        m = re.search(r"CHECK\s*`?\(?\s*[a-z_]*\s*IN\s*\(([^)]*)\)", note)
    if m:
        vals = re.findall(r"['`]([^'`]+)['`]", m.group(1))
        if not vals:
            vals = [v.strip() for v in m.group(1).split(",")]
        vals = [v for v in vals if v and len(v) <= 60]
        return vals or None
    m = re.search(r"CHECK\s+`([^`]+)`", note)
    if m and "," in m.group(1) and not re.search(r"[<>=~@]", m.group(1)):
        vals = [v.strip() for v in m.group(1).split(",") if v.strip()]
        if all(re.match(r"^[\w\- ]+$", v) for v in vals):
            return vals
    return None


def col_schema(name: str, ty: str, nullable: str, note: str) -> dict:
    t = ty.lower().strip()
    arr = t.endswith("[]")
    base = t[:-2] if arr else t
    s: dict
    if base.startswith("uuid"):
        s = {"type": "string", "format": "uuid"}
    elif base.startswith(("numeric", "decimal")):
        s = {"type": "string", "format": "decimal", "pattern": r"^-?\d+(\.\d+)?$"}
    elif base.startswith(("timestamptz", "timestamp")):
        s = {"type": "string", "format": "date-time"}
    elif base == "date" or base.startswith("date "):
        s = {"type": "string", "format": "date"}
    elif base.startswith("time"):
        s = {"type": "string", "format": "time"}
    elif base.startswith(("jsonb", "json")):
        s = {"type": "array", "items": {"type": "object"}} if note.strip().startswith(("`[", "[")) else {"type": "object"}
    elif base.startswith(("bool",)):
        s = {"type": "boolean"}
    elif base.startswith(("smallint", "integer", "int", "bigint", "serial")):
        s = {"type": "integer"}
    elif base.startswith(("varchar", "char", "text", "citext", "inet", "cidr", "bpchar")):
        s = {"type": "string"}
        m = re.search(r"\((\d+)\)", base)
        if m:
            s["maxLength"] = int(m.group(1))
        if name == "currency" and base.startswith("char(3)"):
            s["pattern"] = "^[A-Z]{3}$"
        ev = enum_from_notes(note)
        if ev and not arr:
            s["enum"] = ev
    elif base.startswith(("bytea",)):
        s = {"type": "string", "contentEncoding": "base64"}
    elif base.startswith(("daterange", "tstzrange", "int4range", "interval", "point")):
        s = {"type": "string"}
    else:
        s = {}
    if arr:
        s = {"type": "array", "items": s or {}}
    if base.startswith(("numeric", "decimal")) and name in ("fx_rate", "rate"):
        s["description"] = "Decimal como string (numeric)."
    desc = clean(note)
    if desc:
        s["description"] = (s.get("description", "") + " " + desc).strip()[:300]
    if name in READONLY_COLUMNS:
        s["readOnly"] = True
    if nullable.lower().startswith(("sí", "si", "yes")) and "type" in s:
        s["type"] = [s["type"], "null"]
        if "enum" in s:
            s["enum"] = s["enum"] + [None]
    return s


def build_schemas(tables: dict) -> dict:
    out = OrderedDict()
    for tname in sorted(tables):
        t = tables[tname]
        props, required = OrderedDict(), []
        for nm, ty, nu, note in t["columns"].values():
            if HIDDEN_COLUMNS.match(nm):
                continue
            props[nm] = col_schema(nm, ty, nu, note)
            if nu.lower().startswith("no"):
                required.append(nm)
        if not props:
            continue
        sch = {"type": "object", "x-table": tname,
               "x-spec": ", ".join(f"{s} §3" for s in t["specs"]), "properties": props}
        if required:
            sch["required"] = required
        out[schema_name(tname)] = sch
    return out


def input_schema(full: dict) -> dict:
    props = OrderedDict((k, {kk: vv for kk, vv in v.items() if kk != "readOnly"})
                        for k, v in full["properties"].items()
                        if not v.get("readOnly") and k not in ("code", "lock_version"))
    return {"type": "object", "x-table": full["x-table"],
            "description": "Campos escribibles (sin `required`: la obligatoriedad real la fija el FormRequest; supuesto).",
            "properties": props}


# ════════════════════════════════════════════════════════════════════════════════════════
# §6 API REST → endpoints
# ════════════════════════════════════════════════════════════════════════════════════════

TOKEN_RE = re.compile(r"`([^`]+)`|\b(GET|POST|PUT|PATCH|DELETE|WS)\b(?![^`]*`\s*\|)")


def tokenize_endpoint_cell(cell: str):
    toks = []
    for m in re.finditer(r"`([^`]+)`|\b(GET|POST|PUT|PATCH|DELETE|WS)\b", cell):
        if m.group(1) is not None:
            inner = m.group(1).strip()
            mm = re.match(r"^(GET|POST|PUT|PATCH|DELETE)\s+(/.*)$", inner)
            if mm:
                toks.append(("method", mm.group(1)))
                toks.append(("path", mm.group(2)))
            else:
                toks.append(("path", inner))
        else:
            toks.append(("method", m.group(2)))
    if not any(t[0] == "path" for t in toks):
        for m in re.finditer(r"(/[^\s·|,]+)", cell):
            toks.append(("path", m.group(1)))
    return toks


def strip_query(p: str):
    if "?" in p:
        a, q = p.split("?", 1)
        return a, q
    return p, ""


def segs_of(p: str) -> list[str]:
    return [s for s in p.split("/") if s]


def resolve_suffix(suffix: str, first: str, prev: str) -> str:
    """Resuelve una ruta abreviada («/reset», «/{id}/pdf», «/versions/{v}») contra la ruta anterior de la celda."""
    sfx = segs_of(suffix)
    prev_s = segs_of(re.sub(r"\[[^\]]*\]", "", strip_query(prev)[0]))
    first_s = segs_of(re.sub(r"\[[^\]]*\]", "", strip_query(first)[0]))
    if not sfx:
        return prev
    if sfx[0].startswith("{"):
        return "/" + "/".join(first_s + sfx)
    if sfx[0] in prev_s:
        k = len(prev_s) - 1 - prev_s[::-1].index(sfx[0])
        return "/" + "/".join(prev_s[:k] + sfx)
    k = len(sfx)
    return "/" + "/".join(prev_s[:-k] + sfx)


def is_absolute(p: str, first: str) -> bool:
    if p.startswith("/api/"):
        return True
    s0 = segs_of(p)[0] if segs_of(p) else ""
    f0 = segs_of(first)[0] if segs_of(first) else ""
    if f0 == "api":
        f_after = segs_of(first)[2] if len(segs_of(first)) > 2 else ""
        return s0 in (f_after, "public", "webhooks", "mobile", "me")
    return s0 == f0 or s0 in ("public", "webhooks")


def expand_optional(p: str) -> list[tuple[str, str]]:
    m = re.match(r"^(.*)\[(/[^\]]+)\](.*)$", p)
    if not m:
        return [(p, "plain")]
    return [(m.group(1) + m.group(3), "collection"), (m.group(1) + m.group(2) + m.group(3), "item")]


ENUM_PARAMS: dict = {}


def normalize_path(p: str, spec: str, alias_log: list) -> str:
    p = p.strip().rstrip(".,;")
    m = re.search(r"\{([a-z_]+(?:\|[a-z_]+)+)\}", p)
    if m:
        vals = m.group(1).split("|")
        p = p.replace(m.group(0), "{provider}")
        ENUM_PARAMS[template(p)] = {"provider": vals}
    if not p.startswith("/api/"):
        p = SPEC_BASE.get(spec, DEFAULT_BASE) + p
    for old, new, why in PATH_ALIASES:
        if p.startswith(old):
            alias_log.append((spec, p, p.replace(old, new, 1), why))
            p = p.replace(old, new, 1)
    return p.rstrip("/")


def distribute_methods(methods: list[str], entries: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """entries: [(path_with_query, role)] role ∈ plain|collection|item. Devuelve [(method, path)]."""
    out = []
    if len(methods) <= 1 or len(entries) <= 1:
        for p, _ in entries:
            for m in methods:
                out.append((m, p))
        return out
    paths = [strip_query(p)[0] for p, _ in entries]
    roles = []
    for (p, role), bare in zip(entries, paths):
        if role != "plain":
            roles.append(role); continue
        others = [o for o in paths if o != bare]
        if any(o.startswith(bare + "/{") and o.count("/") == bare.count("/") + 1 for o in others):
            roles.append("collection")
        elif bare.endswith("}") and any(bare.startswith(o + "/{") for o in others):
            roles.append("item")
        elif any(bare.startswith(o + "/") for o in others) and not bare.endswith("}"):
            roles.append("action")
        else:
            roles.append("plain")
    has_coll = "collection" in roles
    for (p, _), role in zip(entries, roles):
        if role == "collection":
            ms = [m for m in methods if m in ("GET", "POST")]
        elif role == "item":
            ms = [m for m in methods if m in ("PUT", "PATCH", "DELETE")] + (["GET"] if "GET" in methods and not has_coll else [])
        elif role == "action":
            ms = [m for m in methods if m == "POST"] or methods
        else:
            ms = methods
        for m in ms:
            out.append((m, p))
    return out


def split_perm_by_method(perm: str, methods: list[str]) -> dict:
    m = re.match(r"^\s*GET\s+(.+?);\s*escritura\s+(.+)$", perm)
    if m:
        return {mm: (m.group(1) if mm == "GET" else m.group(2)) for mm in methods}
    if len(methods) > 1 and " / " in perm:
        parts = [p.strip() for p in perm.split(" / ")]
        if len(parts) == len(methods):
            return dict(zip(methods, parts))
        if len(parts) == 2:
            return {mm: (parts[0] if mm == "GET" else parts[1]) for mm in methods}
    return {mm: perm for mm in methods}


def expand_abbrev(perm: str, spec: str) -> str:
    ab = PERM_ABBREV.get(spec, {})
    s = perm.replace("`", "")
    for k in sorted(ab, key=len, reverse=True):
        s = re.sub(rf"(?<![\w.]){re.escape(k)}(?![\w.])", ab[k], s)
    return s


BASE_QUALIFIERS = re.compile(r"\s*(\(\+?\s*own\)|\+\s*own|\+\s*propietario|\+\s*policy|\+\s*Policy[^|]*|\+\s*CRM-BR-\d+|\+\s*visibilidad)\s*", re.I)


def parse_spec_api(spec: str, fname: str, text: str, alias_log: list, override_log: list, channels: list):
    rows = []
    lines = section(text, 6)
    sub = "§6"
    header = None
    prev_perm = None
    prev_perm_any = None
    prev_path = None
    for ln in lines:
        st = ln.strip()
        hm = re.match(r"^###\s+(.*)$", st)
        if hm:
            title = hm.group(1).strip()
            sub = "§" + title if re.match(r"^\d", title) else "§6 " + title
            header, prev_perm, prev_perm_any = None, None, None
            continue
        if not st.startswith("|"):
            continue
        cells = split_row(st)
        if header is None or (cells and clean(cells[0]).lower() in ("método", "metodo")):
            if cells and clean(cells[0]).lower() in ("método", "metodo"):
                header = [clean(c).lower() for c in cells]
                prev_perm, prev_perm_any = None, None
            continue
        if cells and re.match(r"^:?-{3,}", cells[0]):
            continue
        col = {h: (cells[k] if k < len(cells) else "") for k, h in enumerate(header)}
        mcell = clean(col.get("método", ""))
        ecell = col.get("endpoint", "")
        perm = col.get("permiso", "")
        desc = col.get("descripción", "")
        idem = next((v for h, v in col.items() if h.startswith(("idem", "idempot"))), "")
        methods = [m for m in re.findall(r"GET|POST|PUT|PATCH|DELETE", mcell)]
        if not methods:
            if mcell.lower() == "canal" or "WS" in ecell:
                channels.append({"spec": fname, "channel": clean(ecell), "auth": clean(perm), "description": clean(desc)})
            continue
        # permiso: idem
        perm_c = clean(perm)
        external_row = bool(re.search(r"/public/|webhook", ecell))
        ref_perm = prev_perm_any if (external_row and prev_perm_any) else prev_perm
        if re.match(r"^(idem|ídem)\b", perm_c, re.I) and ref_perm:
            base = BASE_QUALIFIERS.sub(" ", ref_perm).strip()
            perm_c = re.sub(r"^(idem|ídem)", base, perm_c, flags=re.I)
        ab_spec = spec
        if spec == "11" and "allotments" not in ecell:
            ab_spec = "11-docs"
        perm_c = expand_abbrev(perm_c, ab_spec) if ab_spec in PERM_ABBREV else perm_c
        if re.search(r"[a-z_]+\.[a-z_]+", perm_c):
            prev_perm = perm_c
        prev_perm_any = perm_c
        # rutas
        key = (spec, ecell.strip())
        if key in CELL_OVERRIDES:
            entries_raw = CELL_OVERRIDES[key]
            override_log.append((fname, sub, clean(ecell), OVERRIDE_NOTES.get(key, "Expansión explícita (CELL_OVERRIDES).")))
        else:
            toks = tokenize_endpoint_cell(ecell)
            entries_raw, first, prev = [], None, None
            pending = None
            for k, (kind, val) in enumerate(toks):
                if kind == "method":
                    if val == "WS":
                        pending = "WS"; continue
                    nxt = toks[k + 1] if k + 1 < len(toks) else None
                    if nxt is None or nxt[0] == "method":
                        if prev:
                            entries_raw.append((val, prev))
                        pending = None
                    else:
                        pending = val
                    continue
                if pending == "WS" or not (val.startswith("/") or val.startswith("…") or val.startswith("...")):
                    if pending == "WS" or val.startswith("private-"):
                        channels.append({"spec": fname, "channel": val, "auth": clean(perm), "description": clean(desc)})
                    pending = None
                    continue
                if val.startswith(("…", "...")):
                    rest = val.lstrip("…").lstrip(".")
                    base_p = prev_path or ""
                    rs_ = segs_of(rest)
                    bs_ = segs_of(base_p)
                    if rs_ and rs_[0] in bs_:
                        k_ = len(bs_) - 1 - bs_[::-1].index(rs_[0])
                        full = "/" + "/".join(bs_[:k_] + rs_)
                    else:
                        full = "/" + "/".join(bs_ + rs_)
                    override_log.append((fname, sub, clean(val), f"`…` resuelto contra la fila anterior → `{full}`"))
                elif first is None or is_absolute(val, first):
                    full = val
                else:
                    full = resolve_suffix(val, first, prev)
                if first is None:
                    first = full
                entries_raw.append((pending, full))
                prev = full
                pending = None
        # expandir opcionales y métodos
        plain_entries, fixed = [], []
        for mth, p in entries_raw:
            for pp, role in expand_optional(p):
                if mth:
                    fixed.append((mth, pp))
                else:
                    plain_entries.append((pp, role))
        pairs = distribute_methods(methods, plain_entries) + fixed
        # permiso por método (y por ruta cuando «a / b» coincide con nº de rutas de un solo método)
        perm_by_m = split_perm_by_method(perm_c, sorted(set(m for m, _ in pairs), key=HTTP_METHODS.index))
        per_path_perm = None
        if len(methods) == 1 and " / " in perm_c:
            parts = [x.strip() for x in perm_c.split(" / ")]
            distinct_paths = list(OrderedDict.fromkeys(p for _, p in pairs))
            if len(parts) == len(distinct_paths) and len(parts) > 1:
                per_path_perm = dict(zip(distinct_paths, parts))
        for mth, p in pairs:
            bare, q = strip_query(p)
            full = normalize_path(bare, spec, alias_log)
            rows.append({
                "method": mth, "path": full, "query": q, "spec": spec, "file": fname, "section": sub,
                "permission": (per_path_perm or {}).get(p, perm_by_m.get(mth, perm_c)),
                "description": clean(desc), "idem": clean(idem), "raw_endpoint": clean(ecell),
            })
        if entries_raw:
            prev_path = strip_query(entries_raw[-1][1])[0]
    return rows


# ════════════════════════════════════════════════════════════════════════════════════════
# Reglas por endpoint: fase, idempotencia, lock, seguridad, recurso
# ════════════════════════════════════════════════════════════════════════════════════════

def phase_of(spec: str, path: str, section_: str) -> int:
    p = path[len("/api/v1"):]
    if spec == "00":
        return 0
    if spec == "09":
        if p.startswith("/reports/schedules"):
            return 3
        if p.startswith(("/reports", "/dashboard")):
            return 1
        return 0
    if spec in ("01", "02", "03"):
        return 1
    if spec == "04":
        if "v2.1" in section_ and "/passengers/" not in p:
            return 2
        return 1
    if spec == "05":
        if p.startswith("/mobile") or p.startswith("/ops/rooming/prefill"):
            return 2
        return 1
    if spec == "06":
        return 2
    if spec == "07":
        if re.match(r"^/finance/(invoices|bank-lines|bank-statements|reconciliation)", p) or "/invoice-draft" in p \
                or p.startswith("/integrations/fiscal"):
            return 2
        return 1
    if spec == "08":
        if p.startswith("/passenger/reviews"):
            return 3
        if p.startswith(("/portal/client", "/channels/portal-preview")):
            return 1
        return 2
    if spec in ("10", "11"):
        return 2
    if spec == "12":
        return 1 if "claim-book" in p else 2
    if spec in ("13", "14", "18"):
        return 3
    if spec == "15":
        return 3 if p.startswith("/public/reviews") else 2
    if spec == "16":
        if re.match(r"^/catalog/products/\{[^}]+\}/(availability-ranges|operation|availability|pax-rules)", p):
            return 1
        return 2
    if spec == "17":
        if re.search(r"review-sources|external-reviews|review-invitations|^/public/reviews", p):
            return 3
        return 2
    return 1


SERVER_LOCK = re.compile(r"lock\s+(redis|salida|salidas|de cuenta|producto|§|sobre)|cache::lock|locks ordenados|"
                         r"lock redis|redis lock|\block\s+\(lista\)", re.I)


def needs_if_match(row: dict) -> bool:
    txt = row["idem"] + " " + row["description"]
    if re.search(r"lock_version|If-Match", txt):
        return True
    rest = SERVER_LOCK.sub(" ", row["idem"])
    if re.search(r"\block\b", rest, re.I):
        return True
    if re.search(r"\block\s+\(lista\)", row["idem"]):
        return True
    return False


CRITICAL = [
    (r"/convert$", "conversión"), (r"^/api/v1/finance/payments$", "registro de pago"),
    (r"/payments$", "pago"), (r"/pay$", "pago"), (r"^/api/v1/ops/vouchers$", "emisión de voucher"),
    (r"^/api/v1/finance/invoices$", "emisión de comprobante"), (r"/checkout/orders$", "checkout"),
    (r"^/api/v1/public/bookings$", "reserva pública"), (r"^/api/v1/reservations$", "crear reserva"),
    (r"^/api/v1/b2b/reservations$", "reserva B2B"), (r"/payouts$", "pago a proveedor"),
]


def is_webhook(path: str) -> bool:
    return bool(re.search(r"/webhooks?(/|$)|/email/inbound$", path)) and "/integrations/webhooks" not in path \
        and "/webhook-deliveries" not in path


def idempotency(row: dict) -> tuple[str, str | None]:
    """Devuelve ('required'|'optional'|'none', motivo)."""
    txt = row["idem"] + " " + row["description"]
    path, mth = row["path"], row["method"]
    if mth == "GET":
        return "none", None
    if is_webhook(path) and row["method"] in ("POST", "GET"):
        return "webhook", "idempotente por id de evento del proveedor" + (f" ({clean(row['idem'])})" if clean(row["idem"]) else "")
    if re.search(r"Idempotency-Key`?\*?\*?\s*(recomendado|opcional)", txt, re.I):
        return "optional", "spec: recomendado/opcional"
    if re.search(r"Idempotency-Key", txt) or re.search(r"(^|[\s;+(])Idem(?![a-zá])", row["idem"]):
        return "required", "spec"
    for rx, why in CRITICAL:
        if mth == "POST" and re.search(rx, path):
            return "required", f"operación crítica ({why}) según CONVENCIONES §3"
    return "none", None


def security_for(row: dict) -> tuple[list, str]:
    path, perm = row["path"], row["permission"].lower()
    p = path[len("/api/v1"):]
    if is_webhook(path) and row["method"] in ("POST", "GET"):
        if row["method"] == "GET" and "verify" in perm:
            return [{}], "verify-token"
        return [{"providerSignature": []}], "webhook"
    if p.startswith("/platform/auth"):
        return [{}], "public"
    if p.startswith("/platform"):
        return [{"platformSanctum": []}], "platform"
    if p.startswith("/public/me") or (p.startswith("/public/auth/logout")):
        return [{"sanctum": []}], "customer"
    if p.startswith("/public/"):
        if "carrito" in perm:
            return [{"widgetKey": [], "cartToken": []}], "public"
        if "token del pedido" in perm:
            return [{"widgetKey": [], "orderToken": []}, {"sanctum": []}], "public"
        return [{"widgetKey": []}], "public"
    if p == "/docs/openapi.json":
        return [{}], "public"
    if re.search(r"^(público|pública|publico)\b", perm) or perm.startswith("público (token)") \
            or (perm.startswith("público") and "/" not in perm):
        return [{}], "public"
    return [{"sanctum": []}], "sanctum"


def resource_of(path: str, tables: dict):
    """Devuelve (kind, table|None). kind ∈ collection|item|singleton|item_action|collection_action."""
    s = segs_of(path)[2:]  # sin api/v1
    if not s:
        return "collection_action", None

    def tbl(k: int):
        seg = s[k]
        if seg.startswith("{"):
            return None
        parent = next((x for x in reversed(s[:k]) if not x.startswith("{")), None)
        dom = s[0]
        for key in ((parent, seg), (dom, seg), seg):
            if key in RESOURCE_MAP:
                t = RESOURCE_MAP[key]
                return t if t in tables else None
        if k == 0:
            return None
        snake = seg.replace("-", "_")
        pref = DOMAIN_PREFIX.get(dom)
        cands = [t for t in tables if t == snake or (t.endswith("_" + snake) and pref and t.startswith(pref))]
        if len(cands) == 1:
            return cands[0]
        return None

    last = len(s) - 1
    if s[last].startswith("{"):
        if last >= 1 and not s[last - 1].startswith("{"):
            t = tbl(last - 1)
            return ("item", t) if t else ("item_action", None)
        return "item_action", None
    t = tbl(last)
    if t:
        return ("singleton" if s[last] in SINGLETONS else "collection"), t
    for k in range(last - 1, -1, -1):
        if s[k].startswith("{"):
            if k >= 1 and not s[k - 1].startswith("{"):
                return "item_action", tbl(k - 1)
            return "item_action", None
        if k == last - 1 and not (k == 0 and s[0] in NO_ROOT_RESOURCE):
            tk = tbl(k) if k > 0 else RESOURCE_MAP.get(s[0])
            if tk and tk in tables:
                return "collection_action", tk
    return "collection_action", None


def body_from_description(desc: str) -> dict | None:
    """`{a, b: x|y, c?}` al inicio/medio de la descripción → schema inline con esas propiedades."""
    start = desc.find("{")
    if start < 0:
        return None
    depth, end = 0, None
    for k in range(start, len(desc)):
        if desc[k] == "{":
            depth += 1
        elif desc[k] == "}":
            depth -= 1
            if depth == 0:
                end = k; break
    if end is None:
        return None
    inner = desc[start + 1:end]
    parts, cur, d = [], [], 0
    for ch in inner:
        if ch in "{[(":
            d += 1
        elif ch in "}])":
            d -= 1
        if ch == "," and d == 0:
            parts.append("".join(cur)); cur = []
        else:
            cur.append(ch)
    parts.append("".join(cur))
    props = OrderedDict()
    for part in parts:
        part = part.strip()
        m = re.match(r"^([a-z_][a-z0-9_]*)(\[\])?\??\s*(?::\s*(.*))?$", part, re.S)
        if not m:
            continue
        name, is_arr, val = m.group(1), m.group(2), (m.group(3) or "").strip()
        sch: dict = {}
        if is_arr:
            sch = {"type": "array", "items": {}}
        elif val and re.match(r"^[a-z_]+(\s*\|\s*[a-z_]+)+$", val):
            sch = {"type": "string", "enum": [v.strip() for v in val.split("|")]}
        elif val.startswith("{"):
            sch = {"type": "object"}
        elif val == "bool":
            sch = {"type": "boolean"}
        props[name] = sch
    if len(props) < 1:
        return None
    return {"type": "object", "properties": props, "additionalProperties": True}


def query_params_from(row: dict) -> list[dict]:
    params = OrderedDict()
    q = row["query"]
    if q:
        for part in q.split("&"):
            if not part:
                continue
            name, _, val = part.partition("=")
            name = name.strip()
            if not re.match(r"^[a-z_\[\]|]+$", name):
                continue
            if "|" in name and "[" in name:   # filter[type|category]
                base = name.split("[")[0]
                for sub_ in re.findall(r"\[([^\]]+)\]", name)[0].split("|"):
                    params[f"{base}[{sub_}]"] = {}
                continue
            sch = {"type": "string"}
            if val and re.match(r"^[A-Za-z0-9_]+(\|[A-Za-z0-9_]+)+$", val):
                sch["enum"] = val.split("|")
            params[name] = sch
    for m in re.finditer(r"filter\[([A-Za-z_|/]+)\]", row["description"]):
        for sub_ in re.split(r"[|/]", m.group(1)):
            if len(sub_) >= 1 and re.match(r"^[a-z_]+$", sub_):
                params.setdefault(f"filter[{sub_}]", {"type": "string"})
    out = []
    for n, sch in params.items():
        out.append({"name": n, "in": "query", "required": False, "schema": sch or {"type": "string"}})
    return out


def path_param_schema(name: str) -> dict:
    n = name.lower()
    if n in ("date",):
        return {"type": "string", "format": "date"}
    if n == "period":
        return {"type": "string", "pattern": r"^\d{4}-\d{2}$"}
    if n == "v":
        return {"type": "integer", "minimum": 1}
    return {"type": "string"}


PARAM_DESC = {
    "id": "Identificador del recurso (UUID v7). Supuesto: el backend acepta también el `code` legible vía route model binding.",
    "code": "Código legible único por tenant (p. ej. `LEAD-0231`, `COT-2026-00191`).",
}


# ════════════════════════════════════════════════════════════════════════════════════════
# Construcción del documento
# ════════════════════════════════════════════════════════════════════════════════════════

def base_document() -> dict:
    return {
        "openapi": "3.1.0",
        "info": {
            "title": "Qhapaq Travel Suite API",
            "version": CONTRACT_VERSION,
            "summary": "Contrato REST del SaaS multi-tenant para agencias de viajes y operadores turísticos.",
            "description": (
                "Contrato generado por `kit-ia/api/build_openapi.py` a partir de la §6 (API REST) y la §3 (modelo de datos) "
                f"de las 19 especificaciones ({SOURCE_DOCS_VERSION}). No editar a mano: corregir la spec o las reglas del script.\n\n"
                "Convenciones (CONVENCIONES.md §3): prefijo `/api/v1`; listados con `filter[...]`, `sort`, `include`, "
                "`page[size]`, `page[cursor]`; montos como string decimal + `currency`; errores 422 con `errors` y 409/422 "
                "con `code` de regla; `Idempotency-Key` en operaciones críticas (TTL 24 h); `If-Match` con `lock_version` "
                "en recursos con concurrencia optimista (conflicto → 409).\n\n"
                "Extensiones: `x-permission` (permiso requerido, texto normalizado de la spec), `x-permissions` (códigos), "
                "`x-spec` (archivo y sección de origen), `x-spec-also` (otras specs que declaran el mismo endpoint), "
                "`x-phase` (0–3), `x-resource` (tabla §3), `x-idempotency`, `x-api-key-scope`."),
            "contact": {"name": "Equipo interno Qhapaq Travel Suite"},
            "license": {"name": "Propietario — uso interno", "identifier": "LicenseRef-Proprietary"},
        },
        "servers": [
            {"url": "http://localhost:8000", "description": "Local (Laravel `php artisan serve` / Sail). Tenant por host o token."},
            {"url": "https://api.staging.qhapaq.cloud", "description": "Staging (supuesto de dominio; tenant resuelto desde token/API key/host)."},
        ],
        "security": [{"sanctum": []}],
        "tags": [{"name": v[0], "description": v[1], "x-spec": k} for k, v in TAGS.items()],
        "paths": OrderedDict(),
        "components": {
            "securitySchemes": {
                "sanctum": {"type": "http", "scheme": "bearer", "bearerFormat": "Sanctum",
                            "description": "Token personal de Laravel Sanctum (BFF Next.js, apps Expo, portales). Abilities: "
                                           "`mfa:verify`, `supplier`, `customer`, etc. Tenant resuelto desde el token."},
                "platformSanctum": {"type": "http", "scheme": "bearer", "bearerFormat": "Sanctum (guard platform)",
                                    "description": "Token del guard `platform` (Super Admin, MFA siempre)."},
                "widgetKey": {"type": "apiKey", "in": "header", "name": "X-Qhapaq-Key",
                              "description": "Clave pública (publishable key) del widget/sitio del tenant para `/api/v1/public/*`. "
                                             "Se valida junto con el `Origin` (dominios verificados) y rate limit Redis. "
                                             "Rotación: `POST /api/v1/channels/widget/rotate-key`."},
                "cartToken": {"type": "apiKey", "in": "cookie", "name": "ah_cart",
                              "description": "Token opaco del carrito (cookie HttpOnly, SameSite=Lax, 30 días; 15 §3.1)."},
                "orderToken": {"type": "apiKey", "in": "header", "name": "X-Order-Token",
                               "description": "Token de acceso al pedido (navegador que compró o `POST /public/orders/lookup`). "
                                              "Nombre del header: supuesto."},
                "tenantApiKey": {"type": "http", "scheme": "bearer", "bearerFormat": "qts_live_… / qts_test_…",
                                 "description": "API key del tenant (guard `api-key`, 13 §5 API-BR-01). Autentica al tenant, no a un "
                                                "usuario. Scopes requeridos por ruta (lista en `x-scopes`); IP allowlist opcional.",
                                 "x-scopes": dict(API_SCOPES)},
                "oauth2": {"type": "oauth2", "description": "Aplicaciones OAuth 2.0 (Laravel Passport, Authorization Code + PKCE).",
                           "flows": {"authorizationCode": {
                               "authorizationUrl": "/oauth/authorize", "tokenUrl": "/oauth/token",
                               "scopes": dict(API_SCOPES)}}},
                "providerSignature": {"type": "apiKey", "in": "header", "name": "X-Signature",
                                      "description": "Firma HMAC del proveedor externo (pasarela, OSE/PSE, Meta, SES/FCM). El nombre "
                                                     "real del header depende del proveedor (p. ej. `X-Hub-Signature-256`)."},
            },
            "parameters": {
                "IdempotencyKey": {"name": "Idempotency-Key", "in": "header", "required": True,
                                   "description": "Clave única por intento lógico (UUID v4/v7). Se guarda en `sys_idempotency_keys` "
                                                  "(TTL 24 h) y la respuesta se cachea en Redis; reintentos con la misma clave "
                                                  "devuelven la misma respuesta; misma clave con otro cuerpo → 422.",
                                   "schema": {"type": "string", "minLength": 8, "maxLength": 255}},
                "IdempotencyKeyOptional": {"name": "Idempotency-Key", "in": "header", "required": False,
                                           "description": "Recomendado por la spec (no obligatorio).",
                                           "schema": {"type": "string", "minLength": 8, "maxLength": 255}},
                "IfMatch": {"name": "If-Match", "in": "header", "required": True,
                            "description": "`lock_version` vigente del recurso (entero o ETag `W/\"<lock_version>\"`). "
                                           "Si no coincide → 409 `STALE_VERSION`.",
                            "schema": {"type": "string"}},
                "FilterDeep": {"name": "filter", "in": "query", "required": False, "style": "deepObject", "explode": True,
                               "description": "Filtros `filter[campo]=valor`. `filter[owner]=me` se fuerza en servidor para Ventas.",
                               "schema": {"type": "object", "additionalProperties": {"type": "string"}}},
                "Sort": {"name": "sort", "in": "query", "required": False,
                         "description": "Campos separados por coma; prefijo `-` = descendente (p. ej. `-created_at`).",
                         "schema": {"type": "string"}},
                "Include": {"name": "include", "in": "query", "required": False,
                            "description": "Relaciones a incluir, separadas por coma.", "schema": {"type": "string"}},
                "PageSize": {"name": "page[size]", "in": "query", "required": False,
                             "schema": {"type": "integer", "minimum": 1, "maximum": 100, "default": 25}},
                "PageCursor": {"name": "page[cursor]", "in": "query", "required": False,
                               "description": "Cursor opaco devuelto en `meta.next_cursor`.", "schema": {"type": "string"}},
            },
            "headers": {
                "RetryAfter": {"description": "Segundos hasta poder reintentar.", "schema": {"type": "integer"}},
                "RateLimitLimit": {"schema": {"type": "integer"}},
                "RateLimitRemaining": {"schema": {"type": "integer"}},
                "Location": {"schema": {"type": "string", "format": "uri"}},
            },
            "schemas": OrderedDict([
                ("Error", {"type": "object", "required": ["error", "message"],
                           "properties": {
                               "error": {"type": "string", "examples": ["FORBIDDEN"]},
                               "code": {"type": "string", "description": "Código de regla de negocio (p. ej. `SEC-BR-09`, `QTE-BR-12`, `RT-4`)."},
                               "message": {"type": "string"},
                               "required_permissions": {"type": "array", "items": {"type": "string"}},
                               "correlation_id": {"type": "string"},
                               "details": {"type": "object", "additionalProperties": True}}}),
                ("ValidationError", {"type": "object", "required": ["message", "errors"],
                                     "properties": {
                                         "message": {"type": "string"},
                                         "code": {"type": "string", "description": "Código de regla cuando la validación es de negocio (p. ej. `PRD-BR-002`)."},
                                         "errors": {"type": "object", "additionalProperties": {"type": "array", "items": {"type": "string"}}},
                                         "correlation_id": {"type": "string"}}}),
                ("Money", {"type": "object", "required": ["amount", "currency"],
                           "properties": {"amount": {"type": "string", "format": "decimal", "pattern": r"^-?\d+(\.\d+)?$"},
                                          "currency": {"type": "string", "pattern": "^[A-Z]{3}$"},
                                          "fx_rate": {"type": "string", "format": "decimal"}}}),
                ("CursorMeta", {"type": "object",
                                "properties": {"per_page": {"type": "integer"}, "next_cursor": {"type": ["string", "null"]},
                                               "prev_cursor": {"type": ["string", "null"]},
                                               "kpis": {"type": "object", "additionalProperties": True}}}),
                ("CursorLinks", {"type": "object", "properties": {"first": {"type": ["string", "null"]},
                                                                  "prev": {"type": ["string", "null"]},
                                                                  "next": {"type": ["string", "null"]}}}),
                ("GenericObject", {"type": "object", "additionalProperties": True,
                                   "description": "Estructura no tipada todavía en la spec (read model, KPIs, preview)."}),
                ("DataEnvelope", {"type": "object", "properties": {"data": {}, "meta": {"type": "object", "additionalProperties": True}}}),
                ("ActionBody", {"type": "object", "additionalProperties": True,
                                "description": "Cuerpo de acción (p. ej. `{reason}`, `{note}`); ver descripción de la operación."}),
                ("JobAccepted", {"type": "object", "properties": {
                    "data": {"type": "object", "properties": {"id": {"type": "string"}, "status": {"type": "string"},
                                                              "export_id": {"type": "string"}}, "additionalProperties": True}}}),
            ]),
            "responses": {
                "Unauthorized": {"description": "No autenticado, token vencido o revocado.",
                                 "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}},
                "Forbidden": {"description": "Sin permiso (`required_permissions`), fuera de alcance (`SCOPE_OWNERSHIP`), "
                                             "feature no incluida en el plan (`FEATURE_NOT_IN_PLAN`) o scope de API key faltante.",
                              "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}},
                "NotFound": {"description": "No existe o pertenece a otro tenant (RLS).",
                             "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}},
                "Conflict": {"description": "Conflicto de estado, disponibilidad o `lock_version` (con `code` de regla).",
                             "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}},
                "UnprocessableEntity": {"description": "Validación de campos (`errors`) o regla de negocio (`code`).",
                                        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ValidationError"}}}},
                "TooManyRequests": {"description": "Rate limit o cuota (`RATE_LIMITED` / `QUOTA_EXCEEDED`).",
                                    "headers": {"Retry-After": {"$ref": "#/components/headers/RetryAfter"},
                                                "X-RateLimit-Limit": {"$ref": "#/components/headers/RateLimitLimit"},
                                                "X-RateLimit-Remaining": {"$ref": "#/components/headers/RateLimitRemaining"}},
                                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}},
                "PaymentRequired": {"description": "Tenant suspendido por falta de pago (`PAYMENT_REQUIRED`); solo `/billing/*` y login.",
                                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}},
                "NoContent": {"description": "Sin contenido."},
                "Accepted": {"description": "Aceptado; se procesa en cola (Horizon).",
                             "content": {"application/json": {"schema": {"$ref": "#/components/schemas/JobAccepted"}}}},
                "Redirect": {"description": "Redirección a URL firmada temporal.",
                             "headers": {"Location": {"$ref": "#/components/headers/Location"}}},
            },
        },
    }


def summarize(desc: str, method: str, path: str) -> str:
    """«<MÉTODO> <ruta sin /api/v1> — <primera frase de la spec>» (acotado a 120 caracteres)."""
    route = f"{method} {path[len('/api/v1'):] or '/'}"
    d = re.sub(r"\s+", " ", desc).strip()
    first = re.split(r"(?<=[.;])\s|\s→\s|\s\(|:\s", d)[0].strip(" .;") if d else ""
    if not first or first.startswith(("{", "[", "`")) or len(first) < 3:
        return route
    out = f"{route} — {first}"
    return out if len(out) <= 120 else out[:119] + "…"


def perm_codes(perm: str) -> list[str]:
    codes = re.findall(r"\b([a-z_]+(?:\.[a-z_]+)+)\b", perm)
    return list(OrderedDict.fromkeys(c for c in codes if not re.match(r"^(sys|app|booking|channel)\.", c) or c.count(".") >= 2))


def op_id(method: str, path: str, kind: str) -> str:
    s = segs_of(path)[2:]
    words = [x for x in s if not x.startswith("{")]
    words = [re.sub(r"\{[^}]+\}", "", w).replace(".pdf", "Pdf") for w in words]
    last_param = bool(s) and s[-1].startswith("{")
    if method == "GET":
        verb = "list" if kind == "collection" else ("show" if last_param or kind == "singleton" else "get")
    elif method == "POST":
        verb = "create" if kind == "collection" else ""
    elif method == "PATCH":
        verb = "update"
    elif method == "PUT":
        verb = "replace" if (last_param or kind == "singleton") else "put"
    else:
        verb = "delete"
    return camel(([verb] if verb else []) + words)


def main(argv: list[str]) -> int:
    alias_log, override_log, channels, table_notes = [], [], [], []
    tables: dict = {}
    rows: list = []
    spec_files = sorted(SPECS_DIR.glob("[0-9][0-9]-*.md"))
    assert len(spec_files) == 19, f"se esperaban 19 specs, hay {len(spec_files)}"
    for f in spec_files:
        spec = f.name[:2]
        text = f.read_text(encoding="utf-8")
        parse_tables(spec, f.name, text, tables, table_notes)
        rows.extend(parse_spec_api(spec, f.name, text, alias_log, override_log, channels))

    schemas = build_schemas(tables)
    table_to_schema = {s["x-table"]: n for n, s in schemas.items()}
    raw_count = len(rows)

    # ── Normalizar nombres de parámetros por prefijo de plantilla ─────────────────────────
    name_votes: dict = defaultdict(lambda: defaultdict(int))
    for r in rows:
        segs = r["path"].split("/")
        for k, sg in enumerate(segs):
            if sg.startswith("{") and sg.endswith("}"):
                prefix = template("/".join(segs[:k + 1]))
                name_votes[prefix][sg] += 1
    param_renames = []

    def canon_path(p: str) -> str:
        segs = p.split("/")
        for k, sg in enumerate(segs):
            m = re.match(r"^\{([^}]+)\}(.*)$", sg)
            if m:
                prefix = template("/".join(segs[:k] + ["{" + m.group(1) + "}"]))
                votes = name_votes.get(prefix)
                if prefix in PARAM_NAME_OVERRIDES:
                    segs[k] = PARAM_NAME_OVERRIDES[prefix] + m.group(2)
                elif votes:
                    best = sorted(votes.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
                    if best != "{" + m.group(1) + "}":
                        segs[k] = best + m.group(2)
        # nombres duplicados dentro de la misma ruta → sufijo
        seen, out = set(), []
        for sg in segs:
            m = re.match(r"^\{([^}]+)\}(.*)$", sg)
            if m:
                nm = m.group(1)
                base, n = nm, 2
                while nm in seen:
                    nm = f"{base}{n}"; n += 1
                seen.add(nm)
                sg = "{" + nm + "}" + m.group(2)
            out.append(sg)
        return "/".join(out)

    for r in rows:
        cp = canon_path(r["path"])
        if cp != r["path"]:
            param_renames.append((r["file"], r["section"], r["method"], r["path"], cp))
            r["orig_path"] = r["path"]
            r["path"] = cp

    # ── Deduplicar (método + plantilla) ────────────────────────────────────────────────────
    groups: "OrderedDict[tuple, list]" = OrderedDict()
    for r in rows:
        groups.setdefault((r["method"], template(r["path"])), []).append(r)
    canonical_path_for_tpl: dict = {}
    conflicts = []
    endpoints = []
    for (mth, tpl), rs in groups.items():
        dom = segs_of(tpl)[2] if len(segs_of(tpl)) > 2 else ""
        ranked = sorted(rs, key=lambda r: (0 if dom in SPEC_DOMAINS.get(r["spec"], set()) else 1,
                                           1 if r["query"] else 0, rows.index(r)))
        primary = ranked[0]
        if tpl.startswith("/api/v1/public/"):
            primary = next((r for r in rs if r["spec"] == "15"), next((r for r in rs if r["spec"] == "16"), primary))
        others = [r for r in rs if r is not primary]
        path = canonical_path_for_tpl.setdefault(tpl, primary["path"])
        ep = dict(primary)
        ep["path"] = path
        ep["sources"] = rs
        ep["phase"] = phase_of(primary["spec"], primary["path"], primary["section"])
        idems = [idempotency(r) for r in rs]
        order = {"required": 3, "webhook": 2, "optional": 1, "none": 0}
        ep["idempotency"] = max(idems, key=lambda x: order[x[0]])
        ep["if_match"] = any(needs_if_match(r) for r in rs)
        qparams = []
        for r in rs:
            qparams.extend(query_params_from(r))
        ep["qparams"] = qparams
        endpoints.append(ep)
        if others:
            perms = OrderedDict((re.sub(r"\s+", " ", r["permission"].replace("`", "").lower()).strip(), r)
                                for r in rs if r["permission"].strip())
            distinct_perm = len(perms) > 1
            idem_set = set(i[0] for i in idems)
            lock_set = set(needs_if_match(r) for r in rs)
            what = []
            if distinct_perm:
                what.append("permiso: " + " ≠ ".join(f"«{r['permission']}» ({r['file'][:2]})" for r in perms.values()))
                ep["permission"] = " | ".join(OrderedDict.fromkeys(r["permission"] for r in [primary] + others
                                                                   if r["permission"].strip()))
                ep["permission_conflict"] = True
            if len(idem_set) > 1:
                what.append("idempotencia: " + ", ".join(f"{i[0]} ({r['file'][:2]})" for i, r in zip(idems, rs))
                            + f" → se aplica «{ep['idempotency'][0]}»")
            if len(lock_set) > 1:
                what.append("If-Match: declarado solo en " + ", ".join(r["file"][:2] for r in rs if needs_if_match(r))
                            + " → se exige")
            phases = sorted(set(phase_of(r["spec"], r["path"], r["section"]) for r in rs))
            if len(phases) > 1:
                what.append(f"fase: {phases} → {ep['phase']} (la de la spec dueña del dominio)")
            conflicts.append({"method": mth, "path": path, "specs": [f"{r['file'][:2]} {r['section']}" for r in rs],
                              "issues": what})

    # ── Construir paths ───────────────────────────────────────────────────────────────────
    doc = base_document()
    doc["components"]["schemas"].update(schemas)
    used_input = {}
    op_ids: dict = {}
    phase_order = sorted(endpoints, key=lambda e: (min(int(r["spec"]) for r in e["sources"]), rows.index(e["sources"][0])))
    for ep in phase_order:
        mth, path = ep["method"], ep["path"]
        kind, table = resource_of(path, tables)
        ep["kind"], ep["table"] = kind, table
        sname = table_to_schema.get(table) if table else None
        tag = TAGS[ep["spec"]][0]
        ep["tag"] = tag
        # parámetros
        params = []
        for pname in re.findall(r"\{([^}]+)\}", path):
            psch = path_param_schema(pname)
            ev = ENUM_PARAMS.get(template(path), {}).get(pname)
            if ev:
                psch = {"type": "string", "enum": ev}
            params.append({"name": pname, "in": "path", "required": True,
                           "description": PARAM_DESC.get(pname, f"Parámetro de ruta `{pname}`."),
                           "schema": psch})
        is_list = mth == "GET" and (kind == "collection" or re.search(r"\b(Lista|Listado|Listar|Historial)\b", ep["description"])
                                    or any(p["name"].startswith("filter[") for p in ep["qparams"]))
        ep["is_list"] = bool(is_list)
        qnames = set()
        for qp in ep["qparams"]:
            if qp["name"] not in qnames and qp["name"] not in ("sort", "include", "page[size]", "page[cursor]", "page"):
                params.append(qp); qnames.add(qp["name"])
        if is_list:
            if not any(n.startswith("filter[") for n in qnames):
                params.append({"$ref": "#/components/parameters/FilterDeep"})
            params += [{"$ref": "#/components/parameters/Sort"}, {"$ref": "#/components/parameters/Include"},
                       {"$ref": "#/components/parameters/PageSize"}, {"$ref": "#/components/parameters/PageCursor"}]
        idem_kind, idem_why = ep["idempotency"]
        if idem_kind == "required":
            params.append({"$ref": "#/components/parameters/IdempotencyKey"})
        elif idem_kind == "optional":
            params.append({"$ref": "#/components/parameters/IdempotencyKeyOptional"})
        lock_by_schema = bool(sname and "lock_version" in schemas[sname]["properties"] and mth in ("PATCH", "PUT", "DELETE")
                              and kind in ("item", "singleton"))
        if (ep["if_match"] or lock_by_schema) and mth != "GET":
            params.append({"$ref": "#/components/parameters/IfMatch"})
            ep["if_match"] = True
        # seguridad
        sec, sec_kind = security_for(ep)
        ep["sec_kind"] = sec_kind
        scope = SCOPE_ROUTES.get((mth, template(path)))
        if scope and sec_kind == "sanctum":
            sec = [{"sanctum": []}, {"tenantApiKey": [scope]}, {"oauth2": [scope]}]
        # request body
        op: dict = OrderedDict()
        op["tags"] = [tag]
        op["summary"] = summarize(ep["description"], mth, path)
        also = [f"{r['file']} {r['section']}" for r in ep["sources"] if r is not ep["sources"][0] or r["file"] != ep["file"]]
        also = [a for a in OrderedDict.fromkeys(also) if a != f"{ep['file']} {ep['section']}"]
        desc_parts = [ep["description"] or "(sin descripción en la spec)"]
        if ep["idem"] and ep["idem"] not in ("—", "-"):
            desc_parts.append(f"**Idempotencia / lock (spec):** {ep['idem']}")
        for r in ep["sources"]:
            if r["file"] != ep["file"] and r["description"] and r["description"] != ep["description"]:
                desc_parts.append(f"**También en {r['file']} {r['section']}:** {r['description']}")
        op["description"] = "\n\n".join(desc_parts)
        base_id = op_id(mth, path, kind)
        oid = base_id
        if oid in op_ids:
            pnames = [camel(["by", p]) for p in re.findall(r"\{([^}]+)\}", path)]
            oid = base_id + "".join(x[:1].upper() + x[1:] for x in pnames) if pnames else base_id
            n = 2
            while oid in op_ids:
                oid = f"{base_id}{n}"; n += 1
        op_ids[oid] = path
        op["operationId"] = oid
        if params:
            op["parameters"] = params
        if sec != [{"sanctum": []}]:
            op["security"] = sec
        multipart = bool(re.search(r"multipart|Multipart", ep["description"]))
        if mth in ("POST", "PUT", "PATCH"):
            body_schema = None
            required_body = True
            if kind in ("collection", "item", "singleton") and sname and not re.search(r"\b(preview|simulate|validate)\b", path):
                iname = sname + "Input"
                if iname not in used_input:
                    used_input[iname] = input_schema(schemas[sname])
                body_schema = {"$ref": f"#/components/schemas/{iname}"}
            else:
                inline = body_from_description(ep["description"])
                if inline:
                    body_schema = inline
                else:
                    body_schema = {"$ref": "#/components/schemas/ActionBody"}
                    required_body = idem_kind == "required"
            if multipart:
                op["requestBody"] = {"required": True, "content": {"multipart/form-data": {"schema": {
                    "type": "object", "properties": {"file": {"type": "string", "contentMediaType": "application/octet-stream"}},
                    "additionalProperties": True}}}}
            else:
                op["requestBody"] = {"required": required_body, "content": {"application/json": {"schema": body_schema}}}
        # responses
        responses: dict = OrderedDict()
        ref_item = {"$ref": f"#/components/schemas/{sname}"} if sname else {"$ref": "#/components/schemas/GenericObject"}
        if mth == "DELETE":
            responses["204"] = {"$ref": "#/components/responses/NoContent"}
        elif "302" in ep["description"]:
            responses["302"] = {"$ref": "#/components/responses/Redirect"}
        elif "202" in ep["description"] or (mth == "POST" and re.search(r"\b(job|encola|Encola)\b", ep["description"]) and kind != "collection"):
            responses["202"] = {"$ref": "#/components/responses/Accepted"}
        elif is_list:
            items = ref_item if kind == "collection" else {"$ref": "#/components/schemas/GenericObject"}
            responses["200"] = {"description": "Listado paginado por cursor.", "content": {"application/json": {"schema": {
                "type": "object", "required": ["data"],
                "properties": {"data": {"type": "array", "items": items},
                               "meta": {"$ref": "#/components/schemas/CursorMeta"},
                               "links": {"$ref": "#/components/schemas/CursorLinks"}}}}}}
        else:
            if mth == "GET":
                data = ref_item if kind in ("item", "singleton") else {"$ref": "#/components/schemas/GenericObject"}
            elif kind in ("collection", "item", "singleton", "item_action"):
                data = ref_item
            else:
                data = {"$ref": "#/components/schemas/GenericObject"}
            code = "201" if (mth == "POST" and kind == "collection") else "200"
            if mth == "POST" and re.fullmatch(r"/api/v1/quotes/\{[^}]+\}/convert", path):
                # Conversión cotización → reserva: crea la reserva (spec 04 §4.3, Pest ConvertQuoteIdempotencyTest)
                code, data = "201", {"$ref": "#/components/schemas/BookingReservation"}
            responses[code] = {"description": "Creado." if code == "201" else "OK.",
                               "content": {"application/json": {"schema": {
                                   "type": "object", "properties": {"data": data,
                                                                    "meta": {"type": "object", "additionalProperties": True}}}}}}
            if code == "201" and path.endswith("/convert") and path.startswith("/api/v1/quotes/"):
                responses["200"] = {"description": "La cotización ya estaba convertida: devuelve la misma reserva (idempotente).",
                                    "content": responses["201"]["content"]}
        if sec_kind not in ("public", "verify-token"):
            responses["401"] = {"$ref": "#/components/responses/Unauthorized"}
            responses["403"] = {"$ref": "#/components/responses/Forbidden"}
        if re.search(r"\{", path):
            responses["404"] = {"$ref": "#/components/responses/NotFound"}
        if mth != "GET":
            responses["409"] = {"$ref": "#/components/responses/Conflict"}
            responses["422"] = {"$ref": "#/components/responses/UnprocessableEntity"}
        responses["429"] = {"$ref": "#/components/responses/TooManyRequests"}
        op["responses"] = responses
        # extensiones
        op["x-permission"] = ep["permission"] or "—"
        codes = perm_codes(ep["permission"])
        if codes:
            op["x-permissions"] = codes
        op["x-spec"] = f"{ep['file']} {ep['section']}"
        if also:
            op["x-spec-also"] = also
        op["x-phase"] = ep["phase"]
        if table:
            op["x-resource"] = table
        if idem_kind != "none":
            op["x-idempotency"] = {"mode": idem_kind, "source": idem_why or ""}
        if scope and sec_kind == "sanctum":
            op["x-api-key-scope"] = scope
        doc["paths"].setdefault(path, OrderedDict())[mth.lower()] = op

    doc["components"]["schemas"].update(OrderedDict(sorted(used_input.items())))
    doc["x-realtime-channels"] = channels
    # ordenar métodos dentro de cada path
    for p, ops in doc["paths"].items():
        doc["paths"][p] = OrderedDict(sorted(ops.items(), key=lambda kv: HTTP_METHODS.index(kv[0].upper())))

    # ── Serializar ─────────────────────────────────────────────────────────────────────────
    plain = json.loads(json.dumps(doc, ensure_ascii=False))

    class NoAlias(yaml.SafeDumper):
        def ignore_aliases(self, data):
            return True

    yaml_text = yaml.dump(plain, Dumper=NoAlias, sort_keys=False, allow_unicode=True, width=120)
    json_text = json.dumps(plain, ensure_ascii=False, indent=2) + "\n"

    check = "--check" in argv
    if check:
        cur = (HERE / "openapi.json").read_text(encoding="utf-8") if (HERE / "openapi.json").exists() else ""
        if cur != json_text:
            print("✗ openapi.json no está al día: ejecute build_openapi.py y versione el resultado.")
            return 1
    (HERE / "openapi.yaml").write_text(yaml_text, encoding="utf-8")
    (HERE / "openapi.json").write_text(json_text, encoding="utf-8")

    # ── Validar ────────────────────────────────────────────────────────────────────────────
    from openapi_spec_validator import validate
    from openapi_spec_validator.readers import read_from_filename
    spec_dict, _ = read_from_filename(str(HERE / "openapi.yaml"))
    validate(spec_dict)

    # ── ENDPOINTS.md ───────────────────────────────────────────────────────────────────────
    write_endpoints_md(endpoints, conflicts, alias_log, override_log, param_renames, tables, schemas, raw_count,
                       channels, table_notes)
    n_ops = sum(len(v) for v in doc["paths"].values())
    print(f"✓ openapi.yaml/json válidos (OpenAPI 3.1): {n_ops} operaciones en {len(doc['paths'])} paths; "
          f"{raw_count} filas leídas de §6; {len(conflicts)} endpoints repetidos entre specs; "
          f"{len(schemas)} esquemas de tabla (+{len(used_input)} *Input).")
    return 0


def write_endpoints_md(endpoints, conflicts, alias_log, override_log, param_renames, tables, schemas, raw_count,
                       channels, table_notes):
    L = []
    by_phase = defaultdict(lambda: defaultdict(list))
    for e in endpoints:
        by_phase[e["phase"]][e["tag"]].append(e)
    total = len(endpoints)
    L.append("# Índice de endpoints — Qhapaq Travel Suite API v" + CONTRACT_VERSION)
    L.append("")
    L.append("> Generado por `build_openapi.py` desde la §6 de las 19 especificaciones. No editar a mano.")
    L.append("")
    L.append("## Resumen")
    L.append("")
    L.append(f"- **Operaciones únicas (método + ruta):** {total} (de {raw_count} filas expandidas en las §6; "
             f"{raw_count - total} repeticiones deduplicadas).")
    L.append(f"- **Paths:** {len(set(e['path'] for e in endpoints))} · **Esquemas de tabla (§3):** {len(schemas)} "
             f"(de {len(tables)} tablas detectadas).")
    methods = defaultdict(int)
    for e in endpoints:
        methods[e["method"]] += 1
    L.append("- **Por método:** " + " · ".join(f"{m} {methods[m]}" for m in HTTP_METHODS))
    idem_req = sum(1 for e in endpoints if e["idempotency"][0] == "required")
    idem_opt = sum(1 for e in endpoints if e["idempotency"][0] == "optional")
    idem_wh = sum(1 for e in endpoints if e["idempotency"][0] == "webhook")
    L.append(f"- **Idempotency-Key:** {idem_req} obligatorias · {idem_opt} recomendadas · {idem_wh} webhooks "
             "(idempotentes por id de evento del proveedor, sin header).")
    L.append(f"- **If-Match (lock_version):** {sum(1 for e in endpoints if e['if_match'])}")
    seck = defaultdict(int)
    for e in endpoints:
        seck[e["sec_kind"]] += 1
    L.append("- **Autenticación:** " + " · ".join(f"{k} {v}" for k, v in sorted(seck.items())))
    L.append(f"- **Listados con parámetros estándar** (`filter`, `sort`, `include`, `page[size]`, `page[cursor]`): "
             f"{sum(1 for e in endpoints if e['is_list'])}")
    L.append(f"- **Aceptan API key / OAuth del tenant (scopes):** {sum(1 for e in endpoints if SCOPE_ROUTES.get((e['method'], template(e['path']))) and e['sec_kind']=='sanctum')}")
    L.append("")
    L.append("| Fase | Operaciones | GET | POST | PUT | PATCH | DELETE |")
    L.append("|---|---:|---:|---:|---:|---:|---:|")
    for ph in sorted(by_phase):
        eps = [e for t in by_phase[ph].values() for e in t]
        c = defaultdict(int)
        for e in eps:
            c[e["method"]] += 1
        L.append(f"| {PHASES[ph]} | {len(eps)} | " + " | ".join(str(c[m]) for m in HTTP_METHODS) + " |")
    L.append(f"| **Total** | **{total}** | " + " | ".join(f"**{methods[m]}**" for m in HTTP_METHODS) + " |")
    L.append("")
    L.append("| Módulo (tag) | F0 | F1 | F2 | F3 | Total |")
    L.append("|---|---:|---:|---:|---:|---:|")
    tag_names = [v[0] for v in TAGS.values()]
    for tn in tag_names:
        row = [len(by_phase[ph].get(tn, [])) for ph in range(4)]
        if sum(row):
            L.append(f"| {tn} | " + " | ".join(str(x) for x in row) + f" | {sum(row)} |")
    L.append("")
    L.append("Leyenda: 🔑 `Idempotency-Key` obligatoria · (🔑) recomendada · 🪝 webhook idempotente por id de evento · "
             "🔒 `If-Match` · 🌐 pública (`/public` con clave de widget o sin auth) · 🧩 acepta API key/OAuth con scope.")
    L.append("")
    for ph in sorted(by_phase):
        L.append(f"## {PHASES[ph]}")
        L.append("")
        for tn in tag_names:
            eps = by_phase[ph].get(tn)
            if not eps:
                continue
            L.append(f"### {tn} ({len(eps)})")
            L.append("")
            L.append("| Método | Ruta | Permiso | Spec | Marcas |")
            L.append("|---|---|---|---|---|")
            for e in sorted(eps, key=lambda x: (x["path"], HTTP_METHODS.index(x["method"]))):
                marks = []
                ik = e["idempotency"][0]
                marks.append({"required": "🔑", "optional": "(🔑)", "webhook": "🪝"}.get(ik, ""))
                if e["if_match"]:
                    marks.append("🔒")
                if e["sec_kind"] in ("public", "verify-token"):
                    marks.append("🌐")
                if SCOPE_ROUTES.get((e["method"], template(e["path"]))) and e["sec_kind"] == "sanctum":
                    marks.append("🧩 `" + SCOPE_ROUTES[(e["method"], template(e["path"]))] + "`")
                specs = ", ".join(OrderedDict.fromkeys(f"{r['file'][:2]} {r['section'].split(' ')[0]}" for r in e["sources"]))
                perm = e["permission"].replace("|", "\\|") or "—"
                L.append(f"| {e['method']} | `{e['path']}` | {perm} | {specs} | {' '.join(m for m in marks if m)} |")
            L.append("")
    L.append("## Conflictos y deduplicación")
    L.append("")
    L.append(f"{len(conflicts)} operaciones aparecen en más de una fila/spec. Se conserva la fuente del dominio dueño "
             "(o la primera) y su fase, la idempotencia/lock más estricta y, si el permiso difiere, "
             "se documenta la unión (`a | b`) para decidir en la implementación.")
    L.append("")
    real = [c for c in conflicts if c["issues"]]
    L.append(f"### Con diferencias ({len(real)})")
    L.append("")
    L.append("| Método | Ruta | Fuentes | Diferencia |")
    L.append("|---|---|---|---|")
    for c in real:
        issues = "<br>".join(i.replace("|", "\\|") for i in c["issues"])
        L.append(f"| {c['method']} | `{c['path']}` | {'; '.join(c['specs'])} | {issues} |")
    L.append("")
    same = [c for c in conflicts if not c["issues"]]
    L.append(f"### Repetidos idénticos ({len(same)})")
    L.append("")
    for c in same:
        L.append(f"- {c['method']} `{c['path']}` — {'; '.join(c['specs'])}")
    L.append("")
    L.append("### Alias de ruta aplicados")
    L.append("")
    seen = set()
    for spec, old, new, why in alias_log:
        if (old, new) in seen:
            continue
        seen.add((old, new))
        L.append(f"- `{old}` → `{new}` ({spec}). {why}")
    L.append("")
    L.append("### Nombres de parámetros de ruta unificados")
    L.append("")
    L.append("Mismo recurso con distinto nombre de parámetro entre specs (`{id}`/`{code}`…). Se usa el nombre más frecuente en ese "
             "prefijo. **Supuesto:** el backend resuelve el recurso por UUID o por `code` (route model binding).")
    L.append("")
    seen = set()
    for f, sec, m, old, new in param_renames:
        if (old, new) in seen:
            continue
        seen.add((old, new))
        L.append(f"- {m} `{old}` → `{new}` ({f[:2]} {sec.split(' ')[0]})")
    L.append("")
    L.append("### Expansiones de celdas abreviadas (supuestos)")
    L.append("")
    seen = set()
    for f, sec, cell, why in override_log:
        if (f, cell) in seen:
            continue
        seen.add((f, cell))
        L.append(f"- {f[:2]} {sec.split(' ')[0]} — `{cell}`: {why}")
    L.append("")
    L.append("### Rutas ambiguas (resolver con restricciones de ruta en Laravel)")
    L.append("")
    L.append("Pares cruzados: una misma URL podría satisfacer ambas y ninguna es más específica. Resolver con restricciones "
             "(`->whereUuid('id')`, `->where('tenant', …)`) o renombrando en la spec. Los casos literal-vs-parámetro simples "
             "(`/quotes/kpis` vs `/quotes/{id}`) no se listan: basta registrar la ruta literal antes que la parametrizada.")
    L.append("")
    tpls = sorted(set(e["path"] for e in endpoints))
    amb = []
    for a_i, a in enumerate(tpls):
        sa = segs_of(a)
        for b in tpls[a_i + 1:]:
            sb = segs_of(b)
            if len(sa) != len(sb) or template(a) == template(b):
                continue
            ok, a_lit, b_lit = True, False, False
            for x, y in zip(sa, sb):
                px, py = x.startswith("{"), y.startswith("{")
                if px and py:
                    continue
                if px != py:
                    a_lit |= py
                    b_lit |= px
                    continue
                if x != y:
                    ok = False
                    break
            if ok and a_lit and b_lit:   # cruzadas: ninguna es más específica que la otra
                amb.append((a, b))
    for a, b in amb:
        L.append(f"- `{a}` ↔ `{b}`")
    if not amb:
        L.append("- (ninguna)")
    L.append("")
    L.append("### Otros supuestos del contrato")
    L.append("")
    L.append("- Scopes de API key/OAuth: solo se declaran en las rutas de la tabla «Endpoints públicos del tenant» del prototipo "
             "y en las lecturas/escrituras equivalentes que describe cada scope; el resto de rutas acepta solo Sanctum.")
    L.append("- Webhooks entrantes: no exigen `Idempotency-Key` (el proveedor no la envía); la deduplicación es por id de "
             "evento del proveedor (`x-idempotency.mode = webhook`).")
    L.append("- `requestBody` de alta/edición usa `<Recurso>Input` (columnas escribibles de §3, sin `required`); la "
             "obligatoriedad real la definen los FormRequest. Acciones usan el cuerpo que describe la spec (`{…}`) o `ActionBody`.")
    L.append("- Respuestas envueltas en `data` (JsonResource). Tipos PostgreSQL → JSON Schema: uuid→string/uuid, "
             "numeric→string decimal, timestamptz→date-time, date→date, jsonb→object, CHECK IN (…)→enum.")
    L.append("- Cabeceras `X-Order-Token` y `X-Signature` y el dominio de staging son nombres propuestos (la spec no los fija).")
    if table_notes:
        L.append("")
        L.append("### Avisos del parser de §3")
        L.append("")
        for n in table_notes:
            L.append(f"- {n}")
    L.append("")
    L.append("## Canales en tiempo real (Reverb)")
    L.append("")
    for c in channels:
        L.append(f"- `{c['channel']}` — {c['auth']} — {c['description']} ({c['spec'][:2]})")
    L.append("")
    (HERE / "ENDPOINTS.md").write_text("\n".join(L), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
