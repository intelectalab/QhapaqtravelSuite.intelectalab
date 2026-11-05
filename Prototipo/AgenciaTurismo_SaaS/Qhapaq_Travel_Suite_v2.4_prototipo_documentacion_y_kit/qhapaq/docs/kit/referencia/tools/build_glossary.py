#!/usr/bin/env python3
"""Genera kit-ia/referencia/GLOSARIO.md.

Las definiciones son curadas (lista TERMS de este archivo, redactadas a partir de las especificaciones); la columna
«Dónde aparece» se calcula buscando cada término en proto/docs/especificaciones/*.md, y las tablas citadas se
verifican contra kit-ia/database/*.sql (si una tabla no existe, el script avisa y la marca con «⚠»).

Uso: python3 kit-ia/referencia/tools/build_glossary.py
"""
from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from specparse import KIT, MODULE_NAMES, md_escape, spec_files  # noqa: E402

OUT = KIT / "referencia" / "GLOSARIO.md"
SQL_TABLES = set()
for f in sorted((KIT / "database").glob("*.sql")):
    SQL_TABLES |= set(re.findall(r"create table (?:if not exists )?([a-z_][a-z0-9_]*)", f.read_text(encoding="utf-8")))

# (término, categoría, definición, regex de búsqueda, tablas / código relacionados)
TERMS = [
    # ---------------- Negocio turístico
    ("Tenant", "Plataforma", "Agencia de viajes u operador que contrata el SaaS. Todos sus datos llevan `tenant_id` y quedan aislados por global scope + RLS de PostgreSQL; se resuelve desde el token y el subdominio (`andes.localhost`).", r"\btenants?\b", "tenants, app.tenant_id"),
    ("Sede", "Plataforma", "Oficina o sucursal del tenant (p. ej. Lima, Cusco). Agrupa usuarios, cajas chicas y series; el plan limita cuántas se pueden crear.", r"\bsedes?\b", "iam_sedes"),
    ("Plan / entitlement", "Plataforma", "Plan comercial del SaaS (Starter, Professional, Enterprise) y los derechos que otorga: módulos, límites (usuarios, sedes, almacenamiento, mensajes, API) y reglas activables. Precedencia: override > add-on > plan.", r"entitlement|\bplan(es)?\b", "plans, plan_features, plan_limits, feature_overrides, plan_rule_entitlements"),
    ("Producto", "Catálogo", "Unidad vendible del catálogo (excursión, full day, paquete, traslado, hotel, actividad…). Ciclo de vida DRAFT → REVIEW → APPROVED → ACTIVE (y SUSPENDED / INACTIVE); solo ACTIVE se cotiza y reserva (PRD-BR-002).", r"\bproductos?\b", "catalog_products, catalog_product_versions"),
    ("Product 360 / Reserva 360 / Cliente 360", "UI", "Vistas de detalle con pestañas que concentran toda la información de un producto, una reserva o un cliente (configuración, historial, documentos, finanzas).", r"360", "—"),
    ("Componente", "Catálogo", "Servicio o producto que forma parte de un producto compuesto (p. ej. tren + bus + entrada + guía en Machu Picchu Full Day); define proveedor y costo.", r"componentes?", "catalog_product_items"),
    ("Servicio (de proveedor)", "Catálogo", "Prestación unitaria que entrega un proveedor (habitación, traslado, entrada, guiado) con costo y vigencia; los productos se arman con servicios.", r"\bservicios?\b", "catalog_services, catalog_service_cost_history"),
    ("Proveedor", "Catálogo", "Hotel, transportista, operador, guía externo, restaurante o entidad (p. ej. Ministerio de Cultura) que presta servicios; tiene contrato, condiciones de pago y acceso a la extranet.", r"proveedor(es)?", "catalog_providers, catalog_provider_contacts"),
    ("Destino", "Catálogo", "Jerarquía geográfica País › Departamento › Ciudad › Zona › Lugar › Atracción usada en productos, leads y el sitio web.", r"destinos?", "catalog_destinations, catalog_destination_contents"),
    ("Tarifa (rate)", "Catálogo", "Precio y costo de un producto por segmento (Adulto, Niño, B2B…), canal, moneda y vigencia; base del precio sugerido en cotizaciones.", r"\btarifas?\b", "catalog_rates, catalog_rate_conditions"),
    ("Temporada / factor de temporada", "Catálogo", "Rango de fechas con un factor multiplicador de precio (alta, baja, feriados) y prioridad; el precio de una línea se ajusta por `factor(fecha) / factor(temporada de la tarifa)` (PRC-01).", r"temporadas?", "catalog_seasons, catalog_product_seasons"),
    ("Markup / margen", "Precios", "Recargo sobre el costo (`base × markupPct/100 + markupFixed`) que da el precio de venta; margen = (precio − costo) / precio. Márgenes y utilidad solo son visibles con permisos de rentabilidad (SEC-BR-13).", r"markup|m[aá]rgen(es)?", "catalog_price_rules"),
    ("Precio desde (from_price)", "Catálogo", "Precio mínimo vigente que se muestra en listados y en el sitio web; se recalcula al cambiar tarifas.", r"from_price|precio desde", "catalog_products.from_price"),
    ("Salida (departure)", "Catálogo", "Fecha programada de un producto con capacidad propia (`capacity`, `sold`); en el modelo POR_SALIDA no se confirma si `capacity − sold < pax` (RT-4).", r"\bsalidas?\b|departure", "catalog_product_departures"),
    ("Modelo de disponibilidad", "Catálogo", "Cómo controla el inventario cada producto: SIN_CONTROL, CUPOS, CAPACIDAD, POR_PROVEEDOR, POR_ACTIVIDAD, POR_TRANSPORTE, POR_HABITACION, POR_SALIDA, POR_FECHA.", r"availability_model|POR_SALIDA|SIN_CONTROL", "catalog_products.availability_model"),
    ("Rango de disponibilidad", "Motor de reservas", "Periodo disponible, cerrado/ocupado o agotado de un producto con capacidad por día (p. ej. disponible 02–06 oct, ocupado 07–09 oct); gobernado por R-AVAIL-RANGES.", r"rangos? de (disponibilidad|fechas)|availability_ranges", "catalog_availability_ranges"),
    ("Hold (bloqueo de cupo)", "Reservas", "Retención temporal de cupos mientras se confirma una venta (carrito web, cotización en conversión, pagar después). Vence a los `hold_minutes` (R-HOLD) y un job lo libera (JOB-01).", r"\bholds?\b", "catalog_availability_holds, booking_inventory_holds"),
    ("Cupo / allotment", "Cupos", "Inventario contratado con un proveedor (habitaciones, asientos) garantizado por fecha, distinto de las salidas propias y de los holds; se consume al confirmar servicios.", r"allotments?|\bcupos?\b", "catalog_allotments, catalog_allotment_days, catalog_allotment_consumptions"),
    ("Release (liberación de cupo)", "Cupos", "Fecha límite antes del servicio en que los cupos contratados no vendidos se devuelven al proveedor (job JOB-10 ReleaseAllotments); después puede aplicar penalidad por no uso.", r"\brelease\b|liberaci[oó]n", "catalog_allotment_days, catalog_allotment_charges"),
    ("Pick-up report", "Cupos", "Reporte del ritmo de ventas frente al cupo contratado por fecha (PROC-060).", r"pick-?up report", "—"),
    ("Pax / ADT / CHD / INF", "Reservas", "Pasajeros (pax) por tipo: adulto (ADT), niño (CHD) e infante (INF); el tipo se calcula por edad a la fecha del viaje según las reglas de pasajeros del producto.", r"\bpax\b|\bADT\b|\bCHD\b", "booking_passengers.pax_type, catalog_pax_rules"),
    ("Titular", "Reservas", "Pasajero responsable de la reserva (uno por reserva, RES-V21-04); los demás son acompañantes.", r"titular", "booking_passengers"),
    ("Acompañantes / datos nominativos", "Reservas", "Datos de cada pasajero (nombre, documento, nacionalidad, nacimiento) exigidos al reservar o antes del viaje (R-COMPANIONS); obligatorios para entradas nominativas (R-NOMINATIVE).", r"acompañantes|nominativ", "booking_passengers"),
    ("MAPI", "Operaciones", "Machu Picchu: sus entradas son nominativas (Ministerio de Cultura) y no se emiten sin documento validado del pasajero (DOC-BR-010).", r"\bMAPI\b", "—"),
    ("Cotización / versión", "Cotizaciones", "Propuesta de precio a un cliente con líneas, pax, moneda y vigencia; cada cambio crea una versión. Solo una versión `aprobada` genera reserva (RT-3) y es inmutable (RT-7).", r"cotizaci[oó]n(es)?", "quote_quotes, quote_versions, quote_items"),
    ("Aprobación interna", "Cotizaciones", "Visto bueno de Manager/Tenant Admin requerido antes de enviar una cotización con descuento o margen fuera de política (QTE-BR-11/12).", r"aprobaci[oó]n interna|approve_internal", "quote_internal_approvals, collab_approval_requests"),
    ("Conversión (cotización → reserva)", "Reservas", "Paso idempotente que crea la reserva desde la versión aprobada, re-verifica disponibilidad dentro de la transacción y genera CxC 40/60 (PROC-025).", r"conversi[oó]n|convert", "booking_reservations.quote_id"),
    ("Reserva", "Reservas", "Venta confirmada o en proceso con pasajeros y servicios; estados borrador → confirmada → en_operacion → completada (y pendientes, reprogramada, cancelada).", r"\breservas?\b", "booking_reservations, booking_reservation_services"),
    ("Snapshot", "Reservas", "Copia congelada de precios, políticas y configuración al momento de cotizar o reservar; cambios posteriores del catálogo no alteran la venta.", r"snapshot", "booking_reservation_web_snapshots, catalog_product_versions"),
    ("Penalidad", "Reservas", "Monto retenido al cancelar según la política snapshot (por días antes del viaje); nunca supera el total y los servicios ejecutados se retienen al 100 % (RES-BR-31).", r"penalidad", "booking_cancellations"),
    ("Reprogramación", "Reservas", "Cambio de fecha de una reserva con diferencia tarifaria por temporada; anula vouchers y reinicia asignaciones (RES-BR-20…24).", r"reprogram", "booking_changes"),
    ("Orden operativa", "Operaciones", "Documento de ejecución de una reserva confirmada: tareas, asignaciones de guías/conductores/vehículos, solicitudes a proveedores y rooming.", r"orden(es)? operativa", "ops_orders, ops_order_tasks"),
    ("Asignación", "Operaciones", "Recurso (guía, conductor, vehículo) asignado a un servicio; el recurso la confirma desde la app del operador.", r"asignaci[oó]n(es)?", "ops_assignments, ops_assignment_checkins"),
    ("Solicitud a proveedor", "Extranet", "Pedido de confirmación de un servicio al proveedor; este confirma con código, rechaza con motivo o propone alternativa desde la extranet.", r"solicitud(es)? a proveedor|supplier_requests", "ops_supplier_requests, supplier_request_responses"),
    ("Rooming list", "Operaciones", "Lista de habitaciones y huéspedes enviada al hotel; un pasajero no puede figurar en dos habitaciones del mismo intervalo (RT-13).", r"rooming", "ops_rooming_lists, ops_rooming_rooms, ops_rooming_guests"),
    ("Voucher", "Operaciones", "Documento que acredita un servicio ante el proveedor o el pasajero; solo se emite con servicio confirmado (RT-11), se versiona y se anula al reprogramar.", r"vouchers?", "ops_vouchers, ops_voucher_versions"),
    ("Incidencia / SLA", "Operaciones", "Evento durante la operación (retraso, accidente, reclamo) con severidad, responsable y plazo de atención (SLA) vigilado por job.", r"incidencias?|\bSLA\b", "ops_incidents, ops_incident_logs"),
    ("Documentos de viaje", "Operaciones", "Checklist documental por pasajero (pasaporte, DNI, visas, menores) validado antes del viaje; bloquea emisiones nominativas si falta.", r"documentos? de viaje|travel_doc", "ops_travel_doc_items"),
    ("Recojo (pickup)", "Motor de reservas", "Punto de partida del pasajero (hotel, aeropuerto con vuelo y hora); obligatorio si R-PICKUP está activa.", r"recojo|pickup", "catalog_pickup_points"),
    ("Tramo de alojamiento", "Motor de reservas", "Ciudad del itinerario con noches y hoteles/tipos de habitación elegibles (R-LODGING).", r"tramos?|accommodation_legs", "catalog_accommodation_legs, catalog_accommodation_hotels, catalog_accommodation_room_types"),
    ("Adicionales (add-ons)", "Motor de reservas", "Extras opcionales por tipo de pasajero (entradas, comidas, extensiones) que se suman al precio (R-ADDONS).", r"adicionales|addons?", "catalog_product_addons"),
    ("Centro de reglas / regla activable", "Motor de reservas", "Interruptores `R-…` por tenant (32 en la semilla) con parámetros y excepción por producto; el motor los consulta con `BookingEngine::on(regla, producto)`.", r"centro de reglas|R-[A-Z]", "sys_booking_rules, catalog_product_rule_overrides"),
    ("BookingEngine", "Motor de reservas", "Servicio de dominio que calcula estado del día, cotización (líneas, ajustes, pago) y validación de pasajeros; idéntico al `BE` del prototipo.", r"BookingEngine|\bBE\.", "—"),
    # ---------------- Comercial
    ("Lead", "CRM", "Contacto interesado aún no calificado (formulario web, WhatsApp, referido); pasa por cola comercial, contacto, calificación y conversión a cliente + oportunidad.", r"\bleads?\b", "crm_leads, crm_lead_qualifications"),
    ("Cola comercial", "CRM", "Leads sin asignar (`owner_id` NULL) que un asesor puede «tomar» de forma atómica (CRM-BR-08).", r"cola comercial", "crm_leads.owner_id"),
    ("Oportunidad / embudo", "CRM", "Negocio en curso con un cliente, con etapas del pipeline, monto esperado y resultado ganado/perdido.", r"oportunidad(es)?|pipeline|embudo", "crm_opportunities, crm_pipeline_stages"),
    ("Cartera / ownership", "Seguridad", "Registros cuyo `owner_id` es el asesor; el rol Ventas solo ve y gestiona su cartera (SEC-BR-09).", r"cartera|ownership", "columna owner_id"),
    ("Postventa / NPS", "CRM", "Seguimiento después del viaje: encuesta NPS (0–10), detección de detractores (caso automático) y fidelización.", r"postventa|\bNPS\b", "crm_surveys, crm_cases"),
    ("Libro de reclamaciones", "Tesorería y reclamaciones", "Registro obligatorio en Perú (normativa INDECOPI) de quejas y reclamos con plazo legal de respuesta; accesible a clientes y pasajeros.", r"libro de reclamaciones", "crm_claim_book_settings, crm_cases"),
    ("Meta comercial", "Marketing y metas", "Objetivo de ventas por asesor/equipo y período con avance y bono (MET-BR).", r"metas?\b", "crm_sales_targets, crm_sales_target_adjustments"),
    ("Campaña / segmento", "Marketing y metas", "Envío masivo por email/WhatsApp a un segmento de contactos con consentimiento, prueba previa y atribución de ventas.", r"campañas?|segmentos?", "mkt_campaigns, mkt_segments, mkt_consents"),
    ("B2B / agencia asociada", "Canales", "Venta a otras agencias con tarifa neta asignada, convenio con vigencia y línea de crédito; la agencia opera en su propio portal (RT-14).", r"\bB2B\b", "channel_b2b_agencies, channel_b2b_credit_movements"),
    ("Tarifa neta", "Canales", "Precio B2B que paga la agencia asociada antes de su comisión o margen de reventa.", r"tarifa neta|netas?\b", "catalog_product_b2b_rates, channel_b2b_price_lists"),
    ("E-commerce / checkout", "Canales", "Venta directa en el sitio web: carrito con holds, pago en línea total/adelanto y creación automática de reserva y CxC.", r"e-?commerce|checkout", "channel_ecom_orders, channel_web_carts"),
    ("Widget / publishable key", "Canales", "Componente embebible en webs de terceros autenticado con clave pública `X-Qhapaq-Key` validada contra dominios verificados.", r"widget|publishable", "channel_widget_config, channel_widget_domains"),
    ("CMS", "Canales", "Gestor de contenidos del sitio (páginas, blog, banners) con flujo editorial borrador → revisión → publicado.", r"\bCMS\b", "cms_contents, cms_content_events"),
    ("Portal del cliente / del pasajero", "Canales", "Experiencias externas: el cliente ve sus cotizaciones, viajes, documentos y pagos; el pasajero su itinerario, vouchers y alertas (también en app).", r"portal del (cliente|pasajero)|portal-(cliente|pasajero)", "channel_portal_access_links"),
    ("Extranet de proveedores", "Extranet", "Portal del proveedor para responder solicitudes, rooming lists, vouchers, incidencias y ver pagos.", r"extranet", "supplier_*"),
    ("Inbox omnicanal", "Aprobaciones e inbox", "Bandeja unificada de conversaciones (WhatsApp, email, chat web) con plantillas, asignación y creación de leads.", r"inbox|omnicanal", "collab_conversations, collab_messages"),
    ("Ventana de 24 h (WhatsApp)", "Aprobaciones e inbox", "Regla de Meta: fuera de las 24 h desde el último mensaje del cliente solo se pueden enviar plantillas aprobadas (INB-BR-02).", r"ventana (de )?24", "collab_reply_templates"),
    ("Reseña propia / externa", "Reseñas", "Opinión verificada que el pasajero deja tras el viaje (R-OWN-REVIEWS), frente a reseñas importadas de TripAdvisor/Google.", r"reseñas?", "crm_own_reviews, channel_external_reviews"),
    # ---------------- Finanzas
    ("CxC (cuenta por cobrar)", "Finanzas", "Obligación de cobro al cliente (anticipo, saldo, penalidad); todo pago debe aplicarse a una CxC (RT-9).", r"\bCxC\b|receivables?", "fin_receivables"),
    ("CxP (cuenta por pagar)", "Finanzas", "Obligación de pago a un proveedor por servicios de una reserva; se paga con payouts.", r"\bCxP\b|payables?", "fin_payables, fin_payable_payouts"),
    ("Anticipo / saldo", "Finanzas", "División del cobro de una reserva (40 % / 60 % al convertir; % configurable en el sitio con R-DEPOSIT) con vencimientos.", r"anticipo|saldo", "fin_receivables.kind"),
    ("Payout", "Finanzas", "Pago efectivo a un proveedor que reduce el saldo de una CxP.", r"payouts?", "fin_payable_payouts"),
    ("Liquidación", "Finanzas", "Cierre económico de una reserva u operación: costos reales, CxP y rentabilidad final; también liquidación de comisiones a asesores/agencias.", r"liquidaci[oó]n|settlement", "fin_settlements, fin_commissions"),
    ("Comisión", "Finanzas", "Importe que se paga a asesores o agencias B2B según reglas (porcentaje, metas, bonos).", r"comisi[oó]n(es)?", "fin_commission_rules, fin_commissions"),
    ("Rentabilidad", "Finanzas", "Precio menos costo por reserva/servicio; visible solo con `finance.profitability` o permisos equivalentes.", r"rentabilidad", "fin_settlements"),
    ("Comprobante electrónico (factura / boleta / nota)", "Finanzas", "Documento fiscal SUNAT: factura (con RUC), boleta (consumidor final), notas de crédito/débito; series y correlativos sin huecos.", r"comprobantes?|factura|boleta", "fin_invoices, fin_invoice_lines, fin_document_series"),
    ("SUNAT / UBL / CDR", "Finanzas", "SUNAT es la autoridad tributaria peruana; UBL 2.1 es el XML del comprobante; CDR es la constancia de recepción (aceptado, observado, rechazado).", r"SUNAT|\bUBL\b|\bCDR\b", "fin_fiscal_events"),
    ("OSE / PSE", "Finanzas", "Operador de Servicios Electrónicos (valida y emite el CDR en nombre de SUNAT) o Proveedor de Servicios Electrónicos (genera/firma/envía por cuenta del emisor). El proveedor concreto está por definir.", r"\bOSE\b|\bPSE\b", "fin_fiscal_events, integration_adapters"),
    ("IGV", "Finanzas", "Impuesto General a las Ventas (18 %); 0 % en exportación de servicios a clientes no domiciliados (PRC-07).", r"\bIGV\b", "sys_settings (taxPct)"),
    ("RUC / DNI / CE", "Finanzas", "Documentos peruanos: RUC (11 dígitos, empresas y personas con negocio), DNI (8 dígitos), carné de extranjería.", r"\bRUC\b|\bDNI\b", "crm_clients"),
    ("Tipo de cambio (TC / FX)", "Monedas", "Conversión PEN/USD (y monedas de referencia) congelada en cada documento (RT-15); proveedor diario con alerta de variación.", r"tipo de cambio|\bfx\b|\bTC\b", "fin_fx_rates, fin_currencies, fx_rate_providers"),
    ("Moneda base / de cobro", "Monedas", "La base es la moneda contable del tenant (PEN); las de cobro son las aceptadas para pagar (PEN, USD); otras solo se muestran (R-MULTICURRENCY).", r"moneda (base|de cobro)", "fin_currencies"),
    ("Conciliación bancaria", "Finanzas", "Cruce de movimientos del extracto bancario importado con pagos y payouts del sistema; cierre por cuenta y periodo.", r"conciliaci[oó]n", "fin_bank_statements, fin_bank_lines, fin_reconciliation_closures"),
    ("Cierre de periodo", "Finanzas", "Bloqueo contable de un mes tras un checklist; impide emitir o registrar con fechas del periodo cerrado (FIN-BR-48).", r"cierre (contable|de periodo)|period_close", "fin_period_closes, fin_period_close_checks"),
    ("Tesorería / caja chica / arqueo", "Tesorería", "Posición de bancos y cajas por sede: sesiones de caja, gastos, arqueos (conteo físico), reposiciones y transferencias.", r"tesorer[ií]a|caja chica|arqueo", "fin_treasury_accounts, fin_cash_sessions, fin_cash_counts"),
    ("Dunning", "Plataforma", "Cobranza automática de la plataforma a tenants con pago fallido: reintentos D+1/D+3/D+7 y suspensión.", r"dunning", "payment_attempts, platform_invoices"),
    ("MRR / ARR", "Plataforma", "Ingreso recurrente mensual/anual de la plataforma (Σ suscripciones activas mensualizadas).", r"\bMRR\b|\bARR\b", "platform_metrics_daily"),
    # ---------------- Técnicos
    ("PROC-xxx", "Documentación", "Identificador de proceso de negocio de la documentación inicial (p. ej. PROC-025 conversión cotización → reserva); cada spec lista los que cubre en su §1.", r"PROC-\d+", "—"),
    ("DOC-PROC-001", "Documentación", "Documento funcional inicial del cliente; sus «reglas transversales» numeradas se citan como RT-n.", r"DOC-PROC", "—"),
    ("RT-n (regla transversal)", "Documentación", "Regla transversal n de DOC-PROC-001 §30 (p. ej. RT-4 no confirmar sin disponibilidad, RT-22 idempotencia). Ver REGLAS-DE-NEGOCIO.md §3.", r"\bRT-\d+|regla transversal", "—"),
    ("XXX-BR-nn", "Documentación", "Regla de negocio de un módulo (CRM-BR, QTE-BR, RES-BR, FIN-BR…); se devuelve como `code` en errores 409/422.", r"-BR-\d+", "—"),
    ("E2E-xx", "Pruebas", "Escenario de prueba de extremo a extremo (Playwright) definido en la documentación (p. ej. E2E-08 aislamiento entre tenants).", r"E2E-\d+", "kit-ia/tests/e2e"),
    ("Prototipo", "Documentación", "Aplicación navegable `proto/index.html` (HTML + JS sin backend, datos en `DB`) que define pantallas, reglas y comportamiento de referencia.", r"prototipo", "proto/"),
    ("Spec / especificación", "Documentación", "Documento técnico por módulo `proto/docs/especificaciones/NN-*.md` con la plantilla de 12 secciones de CONVENCIONES §8.", r"especificaci[oó]n", "—"),
    ("RLS (Row Level Security)", "Técnico", "Política de PostgreSQL que filtra cada tabla por `tenant_id = current_setting('app.tenant_id')`; segunda barrera de aislamiento.", r"\bRLS\b", "90_rls.sql"),
    ("Sanctum / abilities", "Técnico", "Tokens de Laravel Sanctum para el BFF y las apps; las abilities (`mfa:verify`, `supplier`, `customer`…) limitan la experiencia.", r"Sanctum|abilit", "personal_access_tokens"),
    ("spatie/laravel-permission (teams)", "Técnico", "Paquete de roles y permisos; con *teams* el equipo es el tenant.", r"spatie", "roles, permissions, role_has_permissions"),
    ("ACCESS / ROLE_UX", "Técnico", "Mapas del prototipo: permiso requerido por pantalla y experiencia por rol (back-office, portal, app). Ver PERMISOS.md.", r"\bACCESS\b|ROLE_UX", "core.js"),
    ("Idempotency-Key", "Técnico", "Header que hace repetible sin duplicar una operación crítica; misma clave = misma respuesta durante 24 h (RT-22, SEC-BR-16).", r"Idempotency-Key|idempoten", "sys_idempotency_keys"),
    ("lock_version / If-Match", "Técnico", "Control de concurrencia optimista: el cliente envía la versión leída y el servidor responde 409 si cambió (SEC-BR-17).", r"lock_version|If-Match", "columna lock_version"),
    ("Outbox", "Técnico", "Tabla donde se registran efectos externos en la misma transacción; un worker los envía con reintentos (integraciones, webhooks, OSE).", r"outbox", "sys_outbox"),
    ("Horizon / colas", "Técnico", "Gestor de colas Redis de Laravel; colas critical, default, notifications, documents, integrations, reports, low.", r"Horizon|\bcolas?\b", "sys_job_runs"),
    ("Reverb", "Técnico", "Servidor WebSocket de Laravel para tiempo real (campana, tableros, chat web).", r"Reverb", "—"),
    ("Job / scheduler", "Técnico", "Tarea en cola o programada (`routes/console.php`); los programados se identifican JOB-nn y se registran en `sys_job_runs`.", r"\bjobs?\b|scheduler", "sys_scheduled_jobs, sys_job_runs"),
    ("Webhook", "Técnico", "Llamada HTTP firmada (HMAC-SHA256) que el sistema envía a sistemas del tenant ante eventos (`reservation.confirmed`…) o que recibe de proveedores (pasarela, OSE, Meta).", r"webhooks?", "integration_webhooks, integration_webhook_deliveries"),
    ("API key / OAuth app", "Plataforma", "Credenciales de la API pública del tenant (`qts_live_…`, scopes) y aplicaciones OAuth 2.0 con PKCE.", r"api keys?|oauth", "integration_api_keys, integration_oauth_apps, oauth_clients"),
    ("Read model", "Técnico", "Vista o tabla derivada para consultas pesadas (KPIs, reportes) que se recalcula por eventos o jobs.", r"read model", "—"),
    ("Correlativo / serie", "Técnico", "Numeración por tipo de documento (COT-2026-, RES-2026-, F001-) asignada de forma atómica, sin huecos en documentos fiscales.", r"correlativos?|series?\b", "sys_sequences, fin_document_series"),
    ("Auditoría", "Técnico", "Registro append-only de acciones críticas (quién, qué, antes/después, IP) consultable en Administración › Auditoría.", r"auditor[ií]a|audit", "audit_events"),
    ("BFF", "Técnico", "Backend-for-frontend en Next.js (Route Handlers / Server Actions) que guarda el token Sanctum y llama a la API.", r"\bBFF\b", "—"),
    ("data-testid", "Pruebas", "Atributo estable para selectores de Playwright; el contrato de selectores está en `kit-ia/tests`.", r"data-testid", "kit-ia/tests/e2e"),
    ("DemoSeeder / E2ESeeder", "Pruebas", "Seeders de Laravel que cargan `kit-ia/seeds/*.json` (demo) y el estado de prueba E2E (tenant B, contraseña y TOTP comunes).", r"Seeder", "kit-ia/seeds"),
]

MERGE = {"UI": "Técnico", "Precios": "Catálogo", "Seguridad": "Técnico", "Tesorería y reclamaciones": "Finanzas",
         "Tesorería": "Finanzas", "Monedas": "Finanzas", "Reseñas": "Canales", "Extranet": "Operaciones",
         "Aprobaciones e inbox": "Canales", "Marketing y metas": "CRM", "Cupos": "Catálogo",
         "Motor de reservas": "Catálogo", "Cotizaciones": "Comercial (cotizaciones y reservas)",
         "Reservas": "Comercial (cotizaciones y reservas)", "Documentación": "Documentación y pruebas",
         "Pruebas": "Documentación y pruebas"}
TERMS = [(a, MERGE.get(b, b), c, d, e) for a, b, c, d, e in TERMS]
texts = {p.name[:2]: p.read_text(encoding="utf-8") for p in spec_files()}
warnings = []
cats = []
for t in TERMS:
    if t[1] not in cats:
        cats.append(t[1])


def where(rx: str) -> str:
    c = Counter()
    for spec, txt in texts.items():
        n = len(re.findall(rx, txt, flags=re.I if not re.search(r"[A-Z]{2}", rx) else 0))
        if n:
            c[spec] = n
    if not c:
        return "—"
    top = sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))[:5]
    return ", ".join(f"{s} ({n})" for s, n in top) + (f" y {len(c) - 5} más" if len(c) > 5 else "")


def tables_cell(s: str) -> str:
    out = []
    for part in [x.strip() for x in s.split(",")]:
        name = part.split(".")[0].split(" ")[0]
        if re.fullmatch(r"[a-z][a-z0-9_]+", name) and "_" in name and not name.endswith("_*") and "/" not in part:
            if name not in SQL_TABLES:
                warnings.append(f"{part}")
                out.append(f"`{part}` ⚠")
                continue
        out.append(f"`{part}`" if part not in ("—",) else "—")
    return ", ".join(out)


L = ["# Glosario de negocio y técnico", "",
     "> Generado por `kit-ia/referencia/tools/build_glossary.py`. Definiciones redactadas a partir de las especificaciones; "
     "«Dónde aparece» = especificaciones con más menciones del término (número de menciones entre paréntesis; "
     + ", ".join(f"{k} = {v}" for k, v in MODULE_NAMES.items()) + "). Las tablas se verifican contra `kit-ia/database/*.sql`.", "",
     f"**{len(TERMS)} términos** en {len(cats)} categorías: " + ", ".join(cats) + ".", ""]
for cat in cats:
    L.append(f"## {cat}")
    L.append("")
    L.append("| Término | Definición | Tablas / código | Dónde aparece (spec) |")
    L.append("|---|---|---|---|")
    for term, c, d, rx, tb in sorted([t for t in TERMS if t[1] == cat], key=lambda t: t[0].lower()):
        L.append(f"| **{md_escape(term)}** | {md_escape(d)} | {tables_cell(tb)} | {where(rx)} |")
    L.append("")
if warnings:
    L.append("⚠ = nombre citado que no existe como tabla en `kit-ia/database/*.sql` (revisar): " + ", ".join(f"`{w}`" for w in warnings))
    L.append("")
OUT.write_text("\n".join(L) + "\n", encoding="utf-8")
print(f"términos {len(TERMS)} · categorías {len(cats)} · avisos de tabla {len(warnings)}: {warnings}")
