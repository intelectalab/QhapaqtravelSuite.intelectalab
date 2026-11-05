# Diccionario de datos · Qhapaq Travel Suite

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.13 tras cargar `00`→`90`. No editar a mano._

Fuente de verdad: `kit-ia/database/*.sql`. Este índice y los archivos de `diccionario/` se regeneran con `python3 kit-ia/database/referencia/build_reference.py` (ver [README](README.md)).

## Cifras del catálogo

| Tablas | Columnas | FKs | CHECK | UNIQUE (restricción) | Índices (incl. PK/UNIQUE) | EXCLUDE | Triggers | Tablas con RLS | Políticas |
|---|---|---|---|---|---|---|---|---|---|
| 262 | 4146 | 804 | 582 | 1 | 1472 | 6 | 238 | 231 | 467 |

Modos de RLS: **tenant** = política `tenant_isolation` (`tenant_id = app_current_tenant_id()`, ENABLE + FORCE); **shared** = además `tenant_shared_read` (lee filas globales con `tenant_id IS NULL`); **plataforma** = tablas de `01_platform.sql` sin RLS de tenant (acceso por privilegios de `platform_role`; `tenants` usa `tenant_self`); **sin RLS** = tabla de negocio sin políticas. Todas las tablas con RLS tienen además `platform_access` para `platform_role`.

## Por dominio

| Dominio | Archivo | Tablas | Columnas | FKs | Plataforma | F0 | F1 | F2 | F3 | Diagrama ER |
|---|---|---|---|---|---|---|---|---|---|---|
| **Plataforma SaaS** — Planes, tenants, suscripciones, facturación SaaS, cupones y medición de uso (sin tenant_id de negocio). | [`diccionario/plataforma.md`](diccionario/plataforma.md) | 27 | 301 | 39 | 27 |  |  |  |  | [SVG](er/plataforma.svg) |
| **Identidad y acceso (iam_)** — Sedes, usuarios, MFA, tokens, roles y permisos (Spatie). | [`diccionario/iam.md`](diccionario/iam.md) | 11 | 122 | 27 | 1 | 10 |  |  |  | [SVG](er/iam.svg) |
| **Sistema (sys_)** — Auditoría, correlativos, idempotencia, outbox, ajustes, documentos, jobs y reglas de reserva. | [`diccionario/sys.md`](diccionario/sys.md) | 12 | 159 | 14 | 2 | 8 | 1 | 1 |  | [SVG](er/sys.svg) |
| **Notificaciones (notif_)** — Reglas de evento, plantillas, mensajes y lecturas; mensajes al pasajero. | [`diccionario/notif.md`](diccionario/notif.md) | 6 | 100 | 16 |  | 4 |  | 2 |  | [SVG](er/notif.svg) |
| **Integraciones (integration_)** — Adaptadores, errores, API keys, webhooks, OAuth y fuentes de reseñas. | [`diccionario/integration.md`](diccionario/integration.md) | 8 | 137 | 15 |  | 2 |  |  | 6 | [SVG](er/integration.svg) |
| **Catálogo (catalog_)** — Productos, versiones, servicios, proveedores, tarifas, salidas, holds, cupos y reglas por producto. | [`diccionario/catalog.md`](diccionario/catalog.md) | 50 | 732 | 133 |  |  | 33 | 17 |  | [SVG](er/catalog.svg) |
| **CRM (crm_)** — Clientes, leads, oportunidades, actividades, postventa, reclamaciones, metas y reseñas propias. | [`diccionario/crm.md`](diccionario/crm.md) | 20 | 368 | 71 |  |  | 12 |  | 8 | [SVG](er/crm.svg) |
| **Cotizaciones (quote_)** — Cotizaciones, versiones, ítems, aprobaciones, envíos y vistas. | [`diccionario/quote.md`](diccionario/quote.md) | 9 | 168 | 39 |  |  | 9 |  |  | [SVG](er/quote.svg) |
| **Reservas (booking_)** — Reservas, pasajeros, servicios, holds, cambios, cancelaciones y snapshots web. | [`diccionario/booking.md`](diccionario/booking.md) | 10 | 233 | 51 |  |  | 7 | 3 |  | [SVG](er/booking.svg) |
| **Operaciones (ops_)** — Órdenes operativas, asignaciones, recursos, rooming, vouchers, incidencias, móvil y documentos de viaje. | [`diccionario/ops.md`](diccionario/ops.md) | 23 | 374 | 98 |  |  | 16 | 7 |  | [SVG](er/ops.svg) |
| **Extranet de proveedores (supplier_)** — Respuestas, facturas y solicitudes de tarifa del proveedor. | [`diccionario/supplier.md`](diccionario/supplier.md) | 3 | 70 | 19 |  |  |  | 3 |  | [SVG](er/supplier.svg) |
| **Finanzas y tesorería (fin_)** — CxC, pagos, CxP, comisiones, comprobantes, conciliación, cierres, tesorería y monedas. | [`diccionario/fin.md`](diccionario/fin.md) | 34 | 590 | 125 |  |  | 13 | 21 |  | [SVG](er/fin.svg) |
| **Canales (channel_)** — B2B, e-commerce, sitio web, widget, portales, tickets, reseñas externas y eventos web. | [`diccionario/channel.md`](diccionario/channel.md) | 22 | 373 | 78 |  |  | 2 | 19 | 1 | [SVG](er/channel.svg) |
| **Contenidos (cms_)** — Contenidos del CMS y su historial. | [`diccionario/cms.md`](diccionario/cms.md) | 2 | 34 | 5 |  |  |  | 2 |  | [SVG](er/cms.svg) |
| **Aprobaciones e inbox (collab_)** — Reglas y solicitudes de aprobación, conversaciones omnicanal y mensajes. | [`diccionario/collab.md`](diccionario/collab.md) | 11 | 178 | 36 |  |  |  | 11 |  | [SVG](er/collab.svg) |
| **Marketing (mkt_)** — Suscriptores, segmentos, plantillas, campañas, consentimientos, atribución y automatizaciones. | [`diccionario/mkt.md`](diccionario/mkt.md) | 13 | 188 | 35 |  |  |  |  | 13 | [SVG](er/mkt.svg) |
| **Reportes (report_)** — Exportaciones de reportes. | [`diccionario/report.md`](diccionario/report.md) | 1 | 19 | 3 |  |  | 1 |  |  | [SVG](er/report.svg) |

Diagrama general entre dominios: [`er/00-general.svg`](er/00-general.svg). Visor de todos los diagramas: [`er/index.html`](er/index.html).

## Por fase (archivo SQL de origen)

### Plataforma · `01_platform.sql` · 30 tablas

| Tabla | Dominio | RLS | Descripción |
|---|---|---|---|
| [`permissions`](diccionario/iam.md#permissions) | iam | plataforma | [Spec 00 §3.5] [Plataforma] Catálogo global de permisos (spatie). Sin tenant; sembrado por seeder. |
| [`addon_prices`](diccionario/plataforma.md#addon_prices) | plataforma | plataforma | [Spec 13 §3.5] [Plataforma] Precio de add-on por plan (p. ej. extra_users). |
| [`addons`](diccionario/plataforma.md#addons) | plataforma | plataforma | [Spec 13 §3.5] [Plataforma] Catálogo de add-ons de suscripción. |
| [`coupon_redemptions`](diccionario/plataforma.md#coupon_redemptions) | plataforma | plataforma | [Spec 13 §3.9] [Plataforma] Canje de cupón por tenant. [Fase 3] |
| [`coupons`](diccionario/plataforma.md#coupons) | plataforma | plataforma | [Spec 13 §3.9] [Plataforma] Cupones de suscripción. [Fase 3] |
| [`feature_overrides`](diccionario/plataforma.md#feature_overrides) | plataforma | plataforma | [Spec 13 §3.4] [Plataforma] Excepciones de feature por tenant (Super Admin). |
| [`features`](diccionario/plataforma.md#features) | plataforma | plataforma | [Spec 13 §3.4] [Plataforma] Catálogo de feature flags / módulos. |
| [`payment_attempts`](diccionario/plataforma.md#payment_attempts) | plataforma | plataforma | [Spec 13 §3.8] [Plataforma] Intentos de cobro de facturas de plataforma (dunning). [Fase 3] |
| [`payment_methods`](diccionario/plataforma.md#payment_methods) | plataforma | plataforma | [Spec 13 §3.7] [Plataforma] Medios de pago del tenant para la suscripción (solo token). [Fase 3] |
| [`plan_channels`](diccionario/plataforma.md#plan_channels) | plataforma | plataforma | [Spec 09 §3.3] [Plataforma] Canal mínimo por plan (CHANNELS del prototipo). |
| [`plan_features`](diccionario/plataforma.md#plan_features) | plataforma | plataforma | [Spec 13 §3.4 + 09 §3.2] [Plataforma] Matriz plan × feature (entitlements). |
| [`plan_limits`](diccionario/plataforma.md#plan_limits) | plataforma | plataforma | [Spec 13 §3.3] [Plataforma] Límites por plan y métrica (NULL = ilimitado). |
| [`plan_rule_entitlements`](diccionario/plataforma.md#plan_rule_entitlements) | plataforma | plataforma | [Spec 13 §3.4 (v2.2)] [Plataforma] Plan mínimo que incluye cada regla del motor (DEMO editable). |
| [`plans`](diccionario/plataforma.md#plans) | plataforma | plataforma | [Spec 13 §3.2 + 09 §3.1] [Plataforma] Planes comerciales (Starter/Professional/Enterprise). |
| [`platform_credit_notes`](diccionario/plataforma.md#platform_credit_notes) | plataforma | plataforma | [Spec 13 §3.8] [Plataforma] Notas de crédito de plataforma (serie NQ01). [Fase 3] |
| [`platform_invoice_lines`](diccionario/plataforma.md#platform_invoice_lines) | plataforma | plataforma | [Spec 13 §3.8] [Plataforma] Líneas de factura de plataforma. [Fase 3] |
| [`platform_invoices`](diccionario/plataforma.md#platform_invoices) | plataforma | plataforma | [Spec 13 §3.8] [Plataforma] Facturas de plataforma (emisor Qhapaq Cloud). [Fase 3] |
| [`platform_metrics_daily`](diccionario/plataforma.md#platform_metrics_daily) | plataforma | plataforma | [Spec 13 §3.1] [Plataforma] Snapshot diario de MRR/ARR/churn. [Fase 3] (supuesto: columnas) |
| [`platform_sequences`](diccionario/plataforma.md#platform_sequences) | plataforma | plataforma | [Spec 13 §3.8] [Plataforma] Correlativos globales de plataforma (series FQ01/NQ01, TNT-, SUB-). |
| [`platform_users`](diccionario/plataforma.md#platform_users) | plataforma | plataforma | [Spec 00 §3.1] [Plataforma] Usuarios de plataforma (Super Admin). Guard `platform`; nunca tienen filas en iam_users. |
| [`subscription_changes`](diccionario/plataforma.md#subscription_changes) | plataforma | plataforma | [Spec 13 §3.6] [Plataforma] Cambios de plan/ciclo/add-on (programados o aplicados). [Fase 3] |
| [`subscription_items`](diccionario/plataforma.md#subscription_items) | plataforma | plataforma | [Spec 13 §3.6] [Plataforma] Add-ons contratados en la suscripción. [Fase 3] |
| [`subscriptions`](diccionario/plataforma.md#subscriptions) | plataforma | plataforma | [Spec 13 §3.6] [Plataforma] Suscripción del tenant a un plan. [Fase 3] |
| [`tenant_onboarding`](diccionario/plataforma.md#tenant_onboarding) | plataforma | plataforma | [Spec 09 §3.5] [Plataforma] Snapshot del asistente de alta PROC-001. |
| [`tenants`](diccionario/plataforma.md#tenants) | plataforma | plataforma | [Spec 09 §3.4] [Plataforma] Tenant (agencia). Raíz del aislamiento; RLS propia: una fila visible = la del contexto. |
| [`usage_counters`](diccionario/plataforma.md#usage_counters) | plataforma | plataforma | [Spec 13 §3.10] [Plataforma] Contadores diarios de uso por tenant (particionada por mes). [Fase 3] |
| [`usage_events`](diccionario/plataforma.md#usage_events) | plataforma | plataforma | [Spec 13 §9 (fallback)] [Plataforma] Fallback de medición cuando Redis no está disponible. [Fase 3] (supuesto: columnas mínimas) |
| [`usage_monthly`](diccionario/plataforma.md#usage_monthly) | plataforma | plataforma | [Spec 13 §3.10] [Plataforma] Uso mensual consolidado y alertas 80/100 %. [Fase 3] |
| [`sys_booking_rule_catalog`](diccionario/sys.md#sys_booking_rule_catalog) | sys | plataforma | [Spec 17 §3.1 + 16 §3.1 + 13 §3.4] [Plataforma] Catálogo de plataforma de reglas del motor de reservas (31 reglas). |
| [`sys_rule_templates`](diccionario/sys.md#sys_rule_templates) | sys | plataforma | [Spec 17 §3.3] [Plataforma] Plantillas de reglas por tipo de negocio (plataforma). |

### Fase 0 · Fundaciones · `10_fase0.sql` · 24 tablas

| Tabla | Dominio | RLS | Descripción |
|---|---|---|---|
| [`iam_access_requests`](diccionario/iam.md#iam_access_requests) | iam | tenant | [Spec 00 §3.10] [Fase 0] Solicitudes de acceso desde la pantalla 403. |
| [`iam_mfa_factors`](diccionario/iam.md#iam_mfa_factors) | iam | tenant | [Spec 00 §3.3] [Fase 0] Factor TOTP por usuario (secreto cifrado). |
| [`iam_sedes`](diccionario/iam.md#iam_sedes) | iam | tenant | [Spec 09 §3.6] [Fase 0] Sedes (sucursales) del tenant. |
| [`iam_user_invitations`](diccionario/iam.md#iam_user_invitations) | iam | tenant | [Spec 09 §3.7] [Fase 0] Invitaciones de usuario (token de un solo uso, 72 h). |
| [`iam_users`](diccionario/iam.md#iam_users) | iam | tenant | [Spec 00 §3.2] [Fase 0] Usuarios del tenant (internos y externos: cliente, pasajero, B2B, proveedor, guía, conductor). |
| [`model_has_permissions`](diccionario/iam.md#model_has_permissions) | iam | tenant | [Spec 00 §3.5] [Fase 0] Tabla del paquete spatie. NO se usa: prohibidos permisos directos a usuario (se crea por compatibilidad con la migra |
| [`model_has_roles`](diccionario/iam.md#model_has_roles) | iam | tenant | [Spec 00 §3.5] [Fase 0] Asignación de rol a usuario (un rol por usuario). |
| [`personal_access_tokens`](diccionario/iam.md#personal_access_tokens) | iam | sin RLS | [Spec 00 §3.4] [Fase 0] Tokens Sanctum extendidos. Sin RLS: se consultan antes de conocer el tenant (son la fuente del tenant). |
| [`role_has_permissions`](diccionario/iam.md#role_has_permissions) | iam | sin RLS | [Spec 00 §3.5] [Fase 0] Pivote rol-permiso (spatie). Sin tenant_id propio: se filtra vía `roles`. |
| [`roles`](diccionario/iam.md#roles) | iam | shared | [Spec 00 §3.5] [Fase 0] Roles spatie con teams (tenant_id NULL = plantilla de sistema). |
| [`integration_adapters`](diccionario/integration.md#integration_adapters) | integration | shared | [Spec 09 §3.13] [Fase 0] Adaptadores de integración INT-01…07 (tenant NULL = compartido de plataforma). |
| [`integration_errors`](diccionario/integration.md#integration_errors) | integration | tenant | [Spec 09 §3.15] [Fase 0] Errores de jobs/notificaciones/integraciones (jobLog). |
| [`notif_event_rules`](diccionario/notif.md#notif_event_rules) | notif | tenant | [Spec 09 §3.10] [Fase 0] Matriz evento × canal de notificaciones (PROC-059). |
| [`notif_messages`](diccionario/notif.md#notif_messages) | notif | tenant | [Spec 09 §3.12 + 05 §3.14 + 01 §3.12] [Fase 0] Log de notificaciones enviadas (campana, email, WhatsApp, push). |
| [`notif_reads`](diccionario/notif.md#notif_reads) | notif | tenant | [Spec 05 §3.14] [Fase 0] Lecturas de notificación por usuario (app pasajero, campana). |
| [`notif_templates`](diccionario/notif.md#notif_templates) | notif | shared | [Spec 09 §3.11] [Fase 0] Plantillas de notificación versionadas (tenant NULL = predeterminada del sistema). |
| [`audit_events`](diccionario/sys.md#audit_events) | sys | tenant | [Spec 00 §3.6] [Fase 0] Bitácora append-only (PROC-063), particionada por mes. |
| [`sys_documents`](diccionario/sys.md#sys_documents) | sys | tenant | [Spec CONVENCIONES §5 (supuesto)] [Fase 0] Documentos generados/subidos (PDF, XML, CDR, evidencias) versionados con hash. Referenciada por 0 |
| [`sys_idempotency_keys`](diccionario/sys.md#sys_idempotency_keys) | sys | tenant | [Spec 00 §3.8] [Fase 0] Claves Idempotency-Key (TTL 24 h). |
| [`sys_job_runs`](diccionario/sys.md#sys_job_runs) | sys | tenant | [Spec 09 §3.14 + CONVENCIONES §4] [Fase 0] Ejecuciones de jobs. |
| [`sys_outbox`](diccionario/sys.md#sys_outbox) | sys | tenant | [Spec 00 §3.9] [Fase 0] Outbox transaccional (fuente de webhooks e integraciones). |
| [`sys_scheduled_jobs`](diccionario/sys.md#sys_scheduled_jobs) | sys | tenant | [Spec 09 §3.14] [Fase 0] Jobs programados (JOB-01…) y reportes programados. |
| [`sys_sequences`](diccionario/sys.md#sys_sequences) | sys | tenant | [Spec 00 §3.7] [Fase 0] Correlativos por tenant, tipo y serie (SELECT … FOR UPDATE). |
| [`sys_settings`](diccionario/sys.md#sys_settings) | sys | tenant | [Spec 09 §3.8] [Fase 0] Configuración del tenant por sección (JSONB validado por FormRequest). |

### Fase 1 · MVP · `20_fase1.sql` · 94 tablas

| Tabla | Dominio | RLS | Descripción |
|---|---|---|---|
| [`booking_cancel_requests`](diccionario/booking.md#booking_cancel_requests) | booking | tenant | [Spec 04 §3 + 10 §3.11] [Fase 1] Solicitudes de anulación de reserva. |
| [`booking_cancellations`](diccionario/booking.md#booking_cancellations) | booking | tenant | [Spec 04 §3] [Fase 1] Resultado de la cancelación (penalidad, reembolso). |
| [`booking_changes`](diccionario/booking.md#booking_changes) | booking | tenant | [Spec 04 §3] [Fase 1] Modificaciones y reprogramaciones de la reserva. |
| [`booking_inventory_holds`](diccionario/booking.md#booking_inventory_holds) | booking | tenant | [Spec 04 §3] [Fase 1] Cupos retenidos por la reserva en salidas. |
| [`booking_passengers`](diccionario/booking.md#booking_passengers) | booking | tenant | [Spec 04 §3 (+ v2.1)] [Fase 1] Pasajeros de la reserva. |
| [`booking_reservation_services`](diccionario/booking.md#booking_reservation_services) | booking | tenant | [Spec 04 §3 + 05 §3.3 + 08 §3.15] [Fase 1] Servicios de la reserva (estado de proveedor y operativo). |
| [`booking_reservations`](diccionario/booking.md#booking_reservations) | booking | tenant | [Spec 04 §3] [Fase 1] Reserva. |
| [`catalog_availability_holds`](diccionario/catalog.md#catalog_availability_holds) | catalog | tenant | [Spec 02 §3.9 + 15 §3.13–3.14] [Fase 1] Retenciones de cupo (hold → confirmada/liberada/expirada/consumida). |
| [`catalog_availability_ranges`](diccionario/catalog.md#catalog_availability_ranges) | catalog | tenant | [Spec 16 §3.3] [Fase 1] Rangos de disponibilidad por producto (motor básico). |
| [`catalog_destinations`](diccionario/catalog.md#catalog_destinations) | catalog | tenant | [Spec 02 §3.3] [Fase 1] Árbol de destinos (País → Atracción/Ruta). |
| [`catalog_itineraries`](diccionario/catalog.md#catalog_itineraries) | catalog | tenant | [Spec 02 §3.7] [Fase 1] Itinerario del producto. |
| [`catalog_itinerary_days`](diccionario/catalog.md#catalog_itinerary_days) | catalog | tenant | [Spec 02 §3.7] [Fase 1] Días del itinerario. |
| [`catalog_itinerary_items`](diccionario/catalog.md#catalog_itinerary_items) | catalog | tenant | [Spec 02 §3.7] [Fase 1] Actividades por día del itinerario. |
| [`catalog_pax_rules`](diccionario/catalog.md#catalog_pax_rules) | catalog | tenant | [Spec 16 §3.4] [Fase 1] Reglas de pasajeros por producto (edades, proporciones). |
| [`catalog_price_rules`](diccionario/catalog.md#catalog_price_rules) | catalog | tenant | [Spec 02 §3.8] [Fase 1] Reglas de pricing a nivel tenant. |
| [`catalog_product_categories`](diccionario/catalog.md#catalog_product_categories) | catalog | tenant | [Spec 02 §3.2] [Fase 1] Categorías de producto. |
| [`catalog_product_channels`](diccionario/catalog.md#catalog_product_channels) | catalog | tenant | [Spec 02 §3.7] [Fase 1] Publicación del producto por canal. |
| [`catalog_product_config_groups`](diccionario/catalog.md#catalog_product_config_groups) | catalog | tenant | [Spec 02 §3.7] [Fase 1] Grupos de personalización del producto (§23). |
| [`catalog_product_config_options`](diccionario/catalog.md#catalog_product_config_options) | catalog | tenant | [Spec 02 §3.7] [Fase 1] Opciones de personalización (delta de precio por pasajero). |
| [`catalog_product_departures`](diccionario/catalog.md#catalog_product_departures) | catalog | tenant | [Spec 02 §3.9] [Fase 1] Salidas programadas (cupo por fecha/hora). |
| [`catalog_product_destinations`](diccionario/catalog.md#catalog_product_destinations) | catalog | tenant | [Spec 02 §3.7] [Fase 1] Destinos secundarios del producto. |
| [`catalog_product_faqs`](diccionario/catalog.md#catalog_product_faqs) | catalog | tenant | [Spec 02 §3.7] [Fase 1] Preguntas frecuentes del producto. |
| [`catalog_product_inclusions`](diccionario/catalog.md#catalog_product_inclusions) | catalog | tenant | [Spec 02 §3.7] [Fase 1] Incluye / no incluye. |
| [`catalog_product_items`](diccionario/catalog.md#catalog_product_items) | catalog | tenant | [Spec 02 §3.7] [Fase 1] Componentes del producto (servicio o producto; paquetes). |
| [`catalog_product_media`](diccionario/catalog.md#catalog_product_media) | catalog | tenant | [Spec 02 §3.7] [Fase 1] Galería del producto. |
| [`catalog_product_policies`](diccionario/catalog.md#catalog_product_policies) | catalog | tenant | [Spec 02 §3.7] [Fase 1] Políticas comerciales 1:1 con producto. |
| [`catalog_product_promotions`](diccionario/catalog.md#catalog_product_promotions) | catalog | tenant | [Spec 02 §3.7 + 08 §3.9] [Fase 1] Promociones por producto (códigos promocionales). |
| [`catalog_product_related`](diccionario/catalog.md#catalog_product_related) | catalog | tenant | [Spec 02 §3.7] [Fase 1] Productos relacionados (cross-sell/upsell). |
| [`catalog_product_requirements`](diccionario/catalog.md#catalog_product_requirements) | catalog | tenant | [Spec 02 §3.7] [Fase 1] Requisitos del producto. |
| [`catalog_product_seasons`](diccionario/catalog.md#catalog_product_seasons) | catalog | tenant | [Spec 02 §3.7] [Fase 1] Temporadas asociadas al producto. |
| [`catalog_product_subcategories`](diccionario/catalog.md#catalog_product_subcategories) | catalog | tenant | [Spec 02 §3.2] [Fase 1] Subcategorías de producto. |
| [`catalog_product_types`](diccionario/catalog.md#catalog_product_types) | catalog | tenant | [Spec 02 §3.1] [Fase 1] Tipos de producto (TOUR, EXCURSIÓN, PAQUETE…). |
| [`catalog_product_versions`](diccionario/catalog.md#catalog_product_versions) | catalog | tenant | [Spec 02 §3.7] [Fase 1] Versiones inmutables del producto (snapshot). |
| [`catalog_products`](diccionario/catalog.md#catalog_products) | catalog | tenant | [Spec 02 §3.6 + 16 §3.3] [Fase 1] Ficha maestra de producto. |
| [`catalog_provider_contacts`](diccionario/catalog.md#catalog_provider_contacts) | catalog | tenant | [Spec 02 §3.4] [Fase 1] Contactos adicionales del proveedor. |
| [`catalog_providers`](diccionario/catalog.md#catalog_providers) | catalog | tenant | [Spec 02 §3.4] [Fase 1] Proveedores (hoteles, transporte, guías…). |
| [`catalog_rate_conditions`](diccionario/catalog.md#catalog_rate_conditions) | catalog | tenant | [Spec 02 §3.8] [Fase 1] Condiciones estructuradas de tarifa (propuesta; el prototipo no la usa). |
| [`catalog_rates`](diccionario/catalog.md#catalog_rates) | catalog | tenant | [Spec 02 §3.8] [Fase 1] Tarifas del producto por segmento/canal/vigencia. |
| [`catalog_seasons`](diccionario/catalog.md#catalog_seasons) | catalog | tenant | [Spec 02 §3.8] [Fase 1] Temporadas (factor de precio). |
| [`catalog_services`](diccionario/catalog.md#catalog_services) | catalog | tenant | [Spec 02 §3.5] [Fase 1] Servicios de proveedor (componentes de costo). |
| [`channel_support_ticket_events`](diccionario/channel.md#channel_support_ticket_events) | channel | tenant | [Spec 08 §3.12] [Fase 1] Bitácora del ticket (log). |
| [`channel_support_tickets`](diccionario/channel.md#channel_support_tickets) | channel | tenant | [Spec 08 §3.12] [Fase 1] Solicitudes desde portal cliente / pasajero. |
| [`crm_activities`](diccionario/crm.md#crm_activities) | crm | tenant | [Spec 01 §3.8] [Fase 1] Actividades comerciales (llamadas, reuniones, tareas…). |
| [`crm_case_events`](diccionario/crm.md#crm_case_events) | crm | tenant | [Spec 01 §3.11 + 12 §3.10] [Fase 1] Bitácora del caso / hoja de reclamación (append-only). |
| [`crm_cases`](diccionario/crm.md#crm_cases) | crm | tenant | [Spec 01 §3.10 + 12 §3.10] [Fase 1] Casos de postventa y hojas del Libro de Reclamaciones (is_book). |
| [`crm_catalog_items`](diccionario/crm.md#crm_catalog_items) | crm | tenant | [Spec 01 §3.1] [Fase 1] Catálogos configurables del CRM (fuentes, canales, motivos…). |
| [`crm_claim_book_settings`](diccionario/crm.md#crm_claim_book_settings) | crm | tenant | [Spec 12 §3.11] [Fase 1] Parámetros del Libro de Reclamaciones (1 fila por tenant). |
| [`crm_client_contacts`](diccionario/crm.md#crm_client_contacts) | crm | tenant | [Spec 01 §3.5] [Fase 1] Contactos del cliente. |
| [`crm_clients`](diccionario/crm.md#crm_clients) | crm | tenant | [Spec 01 §3.4] [Fase 1] Clientes (personas y empresas). |
| [`crm_lead_qualifications`](diccionario/crm.md#crm_lead_qualifications) | crm | tenant | [Spec 01 §3.3] [Fase 1] Historial BANT del lead (vigente = último). |
| [`crm_leads`](diccionario/crm.md#crm_leads) | crm | tenant | [Spec 01 §3.2] [Fase 1] Leads comerciales. |
| [`crm_opportunities`](diccionario/crm.md#crm_opportunities) | crm | tenant | [Spec 01 §3.7] [Fase 1] Oportunidades de venta. |
| [`crm_pipeline_stages`](diccionario/crm.md#crm_pipeline_stages) | crm | tenant | [Spec 01 §3.6] [Fase 1] Etapas del embudo de oportunidades. |
| [`crm_surveys`](diccionario/crm.md#crm_surveys) | crm | tenant | [Spec 01 §3.9] [Fase 1] Encuestas NPS. |
| [`fin_bank_accounts`](diccionario/fin.md#fin_bank_accounts) | fin | tenant | [Spec 07 §3.8] [Fase 1] Cuentas bancarias para pagos a proveedores. |
| [`fin_commission_rules`](diccionario/fin.md#fin_commission_rules) | fin | tenant | [Spec 07 §3.10] [Fase 1] Reglas de comisión (vendedor / agencia B2B). |
| [`fin_commissions`](diccionario/fin.md#fin_commissions) | fin | tenant | [Spec 07 §3.11 + 14 §3.17] [Fase 1] Comisiones calculadas (vendedor, agencia B2B, bono por meta). |
| [`fin_fx_rates`](diccionario/fin.md#fin_fx_rates) | fin | tenant | [Spec 07 §3.19 + 09 §3.9 + 17 §3.6] [Fase 1] Histórico de tipo de cambio (append-only). |
| [`fin_payable_payouts`](diccionario/fin.md#fin_payable_payouts) | fin | tenant | [Spec 07 §3.7] [Fase 1] Pagos a proveedores. |
| [`fin_payables`](diccionario/fin.md#fin_payables) | fin | tenant | [Spec 07 §3.6] [Fase 1] Cuentas por pagar a proveedores y costos adicionales. |
| [`fin_payment_applications`](diccionario/fin.md#fin_payment_applications) | fin | tenant | [Spec 07 §3.4] [Fase 1] Aplicación / desaplicación de pagos a CxC. |
| [`fin_payment_methods`](diccionario/fin.md#fin_payment_methods) | fin | tenant | [Spec 07 §3.9] [Fase 1] Medios de cobro configurables (PAY_METHODS). |
| [`fin_payments`](diccionario/fin.md#fin_payments) | fin | tenant | [Spec 07 §3.3 + 08 §3.15] [Fase 1] Pagos recibidos y reembolsos. |
| [`fin_receivable_reminders`](diccionario/fin.md#fin_receivable_reminders) | fin | tenant | [Spec 07 §3.2] [Fase 1] Recordatorios de cobro enviados. |
| [`fin_receivables`](diccionario/fin.md#fin_receivables) | fin | tenant | [Spec 07 §3.1] [Fase 1] Cuentas por cobrar (obligaciones de cobro). |
| [`fin_settlements`](diccionario/fin.md#fin_settlements) | fin | tenant | [Spec 07 §3.12] [Fase 1] Liquidación / cierre financiero de la reserva. |
| [`fin_status_history`](diccionario/fin.md#fin_status_history) | fin | tenant | [Spec 07 §3.5] [Fase 1] Historial de estados de pagos, comisiones, comprobantes y CxP. |
| [`ops_assignment_checkins`](diccionario/ops.md#ops_assignment_checkins) | ops | tenant | [Spec 05 §3.6] [Fase 1] Check-in por pasajero y servicio (idempotente). |
| [`ops_assignments`](diccionario/ops.md#ops_assignments) | ops | tenant | [Spec 05 §3.5] [Fase 1] Asignación de guía/conductor/vehículo por servicio. |
| [`ops_drivers`](diccionario/ops.md#ops_drivers) | ops | tenant | [Spec 05 §3.7] [Fase 1] Conductores (recurso operativo). |
| [`ops_evidences`](diccionario/ops.md#ops_evidences) | ops | tenant | [Spec 05 §3.12] [Fase 1] Evidencias (fotos/PDF) de operación e incidencias (PROC-038). |
| [`ops_guides`](diccionario/ops.md#ops_guides) | ops | tenant | [Spec 05 §3.7] [Fase 1] Guías (recurso operativo). |
| [`ops_incident_logs`](diccionario/ops.md#ops_incident_logs) | ops | tenant | [Spec 05 §3.11 + 06 §3] [Fase 1] Bitácora append-only de la incidencia. |
| [`ops_incidents`](diccionario/ops.md#ops_incidents) | ops | tenant | [Spec 05 §3.11] [Fase 1] Incidencias operativas (SLA por severidad). |
| [`ops_order_tasks`](diccionario/ops.md#ops_order_tasks) | ops | tenant | [Spec 05 §3.2] [Fase 1] Checklist de la orden operativa. |
| [`ops_orders`](diccionario/ops.md#ops_orders) | ops | tenant | [Spec 05 §3.1] [Fase 1] Orden operativa (una por reserva). |
| [`ops_rooming_guests`](diccionario/ops.md#ops_rooming_guests) | ops | tenant | [Spec 05 §3.9] [Fase 1] Huéspedes por habitación. |
| [`ops_rooming_lists`](diccionario/ops.md#ops_rooming_lists) | ops | tenant | [Spec 05 §3.8 + §3.14b] [Fase 1] Rooming list por reserva y hotel/ciudad. |
| [`ops_rooming_rooms`](diccionario/ops.md#ops_rooming_rooms) | ops | tenant | [Spec 05 §3.9] [Fase 1] Habitaciones de la rooming list. |
| [`ops_supplier_requests`](diccionario/ops.md#ops_supplier_requests) | ops | tenant | [Spec 05 §3.4] [Fase 1] Solicitudes enviadas a proveedores por servicio (PROC-032). |
| [`ops_vehicles`](diccionario/ops.md#ops_vehicles) | ops | tenant | [Spec 05 §3.7] [Fase 1] Vehículos. |
| [`ops_voucher_versions`](diccionario/ops.md#ops_voucher_versions) | ops | tenant | [Spec 05 §3.10] [Fase 1] Historial de versiones del voucher. |
| [`ops_vouchers`](diccionario/ops.md#ops_vouchers) | ops | tenant | [Spec 05 §3.10] [Fase 1] Vouchers de servicio (versionados, QR firmado). |
| [`quote_access_tokens`](diccionario/quote.md#quote_access_tokens) | quote | tenant | [Spec 03 §3] [Fase 1] Tokens (hash) del enlace público de la cotización. |
| [`quote_approvals`](diccionario/quote.md#quote_approvals) | quote | tenant | [Spec 08 §3.15] [Fase 1] Evidencia de aprobación del cliente desde el portal. |
| [`quote_internal_approvals`](diccionario/quote.md#quote_internal_approvals) | quote | tenant | [Spec 03 §3] [Fase 1] Solicitud y decisión de aprobación interna (gerencia). |
| [`quote_items`](diccionario/quote.md#quote_items) | quote | tenant | [Spec 03 §3] [Fase 1] Ítems de la versión (producto, tarifa, fecha, pax). |
| [`quote_negotiations`](diccionario/quote.md#quote_negotiations) | quote | tenant | [Spec 03 §3] [Fase 1] Registro de negociación con el cliente. |
| [`quote_quotes`](diccionario/quote.md#quote_quotes) | quote | tenant | [Spec 03 §3] [Fase 1] Cotización (cabecera). |
| [`quote_sends`](diccionario/quote.md#quote_sends) | quote | tenant | [Spec 03 §3] [Fase 1] Envíos de la cotización por canal. |
| [`quote_versions`](diccionario/quote.md#quote_versions) | quote | tenant | [Spec 03 §3] [Fase 1] Versiones de cotización (congeladas al enviar). |
| [`quote_views`](diccionario/quote.md#quote_views) | quote | tenant | [Spec 03 §3] [Fase 1] Aperturas de la cotización (portal o registro manual). |
| [`report_exports`](diccionario/report.md#report_exports) | report | tenant | [Spec 09 §3.16] [Fase 1] Exportaciones de reportes (PROC-061). |
| [`sys_holidays`](diccionario/sys.md#sys_holidays) | sys | shared | [Spec 12 §3.11] [Fase 1] Feriados (tenant NULL = nacionales) para plazos hábiles. |

### Fase 2 · Canales y campo · `30_fase2.sql` · 86 tablas

| Tabla | Dominio | RLS | Descripción |
|---|---|---|---|
| [`booking_reservation_web_addons`](diccionario/booking.md#booking_reservation_web_addons) | booking | tenant | [Spec 04 §3 v2.1] [Fase 2] Adicionales elegidos en la reserva web. |
| [`booking_reservation_web_lodging`](diccionario/booking.md#booking_reservation_web_lodging) | booking | tenant | [Spec 04 §3 v2.1] [Fase 2] Alojamiento elegido en la reserva web. |
| [`booking_reservation_web_snapshots`](diccionario/booking.md#booking_reservation_web_snapshots) | booking | tenant | [Spec 04 §3 v2.1] [Fase 2] Snapshot 1:1 de la reserva web (motor de reservas). |
| [`catalog_accommodation_hotels`](diccionario/catalog.md#catalog_accommodation_hotels) | catalog | tenant | [Spec 16 §3.6] [Fase 2] Hoteles por tramo. |
| [`catalog_accommodation_legs`](diccionario/catalog.md#catalog_accommodation_legs) | catalog | tenant | [Spec 16 §3.6] [Fase 2] Tramos de alojamiento del circuito. |
| [`catalog_accommodation_room_types`](diccionario/catalog.md#catalog_accommodation_room_types) | catalog | tenant | [Spec 16 §3.6] [Fase 2] Tipos de habitación y precio por noche. |
| [`catalog_allotment_charges`](diccionario/catalog.md#catalog_allotment_charges) | catalog | tenant | [Spec 11 §3.5] [Fase 2] Penalidades por cupo no usado. |
| [`catalog_allotment_consumptions`](diccionario/catalog.md#catalog_allotment_consumptions) | catalog | tenant | [Spec 11 §3.3] [Fase 2] Consumo de cupo por servicio de reserva (idempotente). |
| [`catalog_allotment_days`](diccionario/catalog.md#catalog_allotment_days) | catalog | tenant | [Spec 11 §3.2] [Fase 2] Cupo por contrato y fecha. |
| [`catalog_allotment_events`](diccionario/catalog.md#catalog_allotment_events) | catalog | tenant | [Spec 11 §3.6] [Fase 2] Bitácora del contrato de cupo. |
| [`catalog_allotment_requests`](diccionario/catalog.md#catalog_allotment_requests) | catalog | tenant | [Spec 11 §3.4] [Fase 2] Solicitudes de ampliación de cupo. |
| [`catalog_allotments`](diccionario/catalog.md#catalog_allotments) | catalog | tenant | [Spec 11 §3.1] [Fase 2] Contratos de cupo (allotment) con proveedores. |
| [`catalog_destination_contents`](diccionario/catalog.md#catalog_destination_contents) | catalog | tenant | [Spec 15 §3.11] [Fase 2] Contenido de páginas de destino por idioma. |
| [`catalog_payment_policies`](diccionario/catalog.md#catalog_payment_policies) | catalog | tenant | [Spec 16 §3.7] [Fase 2] Política de pago del producto (total/adelanto). |
| [`catalog_pickup_points`](diccionario/catalog.md#catalog_pickup_points) | catalog | tenant | [Spec 16 §3.8] [Fase 2] Puntos de recojo del producto. |
| [`catalog_product_addons`](diccionario/catalog.md#catalog_product_addons) | catalog | tenant | [Spec 16 §3.5] [Fase 2] Adicionales del producto (museos, seguros…). |
| [`catalog_product_b2b_rates`](diccionario/catalog.md#catalog_product_b2b_rates) | catalog | tenant | [Spec 02 §3.7 + 08 §3.3] [Fase 2] Tarifa neta por agencia y producto. |
| [`catalog_product_rule_overrides`](diccionario/catalog.md#catalog_product_rule_overrides) | catalog | tenant | [Spec 17 §3.2 + 16 §3.2] [Fase 2] Excepción de regla por producto. |
| [`catalog_product_translations`](diccionario/catalog.md#catalog_product_translations) | catalog | tenant | [Spec 15 §3.11] [Fase 2] Traducciones del producto para el sitio. |
| [`catalog_service_cost_history`](diccionario/catalog.md#catalog_service_cost_history) | catalog | tenant | [Spec 10 §3.11 + 06 §3.4] [Fase 2] Historial de costos/vigencias de servicios de proveedor (tarifas aprobadas). |
| [`channel_b2b_agencies`](diccionario/channel.md#channel_b2b_agencies) | channel | tenant | [Spec 08 §3.1] [Fase 2] Agencias asociadas B2B (crédito, comisión). |
| [`channel_b2b_credit_exceptions`](diccionario/channel.md#channel_b2b_credit_exceptions) | channel | tenant | [Spec 10 §3.11] [Fase 2] Ampliaciones de crédito B2B aprobadas. (columnas mínimas de 10) |
| [`channel_b2b_credit_movements`](diccionario/channel.md#channel_b2b_credit_movements) | channel | tenant | [Spec 08 §3.4] [Fase 2] Libro de la línea de crédito B2B (inmutable; fuente de credit_used, H-02). |
| [`channel_b2b_price_lists`](diccionario/channel.md#channel_b2b_price_lists) | channel | tenant | [Spec 08 §3.2] [Fase 2] Listas de precios B2B. |
| [`channel_b2b_settlement_requests`](diccionario/channel.md#channel_b2b_settlement_requests) | channel | tenant | [Spec 08 §3.5] [Fase 2] Solicitudes de liquidación de comisiones B2B. |
| [`channel_ecom_order_lines`](diccionario/channel.md#channel_ecom_order_lines) | channel | tenant | [Spec 15 §3.4] [Fase 2] Líneas del pedido web (snapshot de precio). |
| [`channel_ecom_orders`](diccionario/channel.md#channel_ecom_orders) | channel | tenant | [Spec 08 §3.6 + 15 §3.3, §3.14] [Fase 2] Pedidos web (tienda y sitio público). |
| [`channel_ecom_passengers`](diccionario/channel.md#channel_ecom_passengers) | channel | tenant | [Spec 08 §3.7 + 15 §3.5] [Fase 2] Pasajeros del pedido web. |
| [`channel_ecom_payment_attempts`](diccionario/channel.md#channel_ecom_payment_attempts) | channel | tenant | [Spec 08 §3.8 + 15 §3.6] [Fase 2] Intentos de pago del pedido web (pasarela, transferencia, Yape/Plin). |
| [`channel_pax_feedback`](diccionario/channel.md#channel_pax_feedback) | channel | tenant | [Spec 04 §3 v2.1 + 08 §3.16] [Fase 2] Comentarios del pasajero (portal/app); tabla única, dueño Canales. |
| [`channel_portal_access_links`](diccionario/channel.md#channel_portal_access_links) | channel | tenant | [Spec 08 §3.13] [Fase 2] Acceso del pasajero por enlace/código. |
| [`channel_trip_messages`](diccionario/channel.md#channel_trip_messages) | channel | tenant | [Spec 05 §3.14] [Fase 2] Chat pasajero ↔ agencia de la app pasajero. |
| [`channel_web_cart_items`](diccionario/channel.md#channel_web_cart_items) | channel | tenant | [Spec 15 §3.2] [Fase 2] Líneas del carrito (precio recalculado en cada lectura). |
| [`channel_web_carts`](diccionario/channel.md#channel_web_carts) | channel | tenant | [Spec 15 §3.1] [Fase 2] Carritos del sitio público. |
| [`channel_web_events`](diccionario/channel.md#channel_web_events) | channel | tenant | [Spec 15 §3.8] [Fase 2] Eventos de analítica del sitio (particionada por mes). |
| [`channel_widget_config`](diccionario/channel.md#channel_widget_config) | channel | tenant | [Spec 17 §3.8] [Fase 2] Configuración del widget embebible (1 por tenant). |
| [`channel_widget_domains`](diccionario/channel.md#channel_widget_domains) | channel | tenant | [Spec 17 §3.8] [Fase 2] Dominios autorizados del widget (CORS/CSP). |
| [`channel_widget_handoffs`](diccionario/channel.md#channel_widget_handoffs) | channel | tenant | [Spec 17 §3.8] [Fase 2] Traspaso del widget al checkout (TTL 24 h). |
| [`channel_wishlist_items`](diccionario/channel.md#channel_wishlist_items) | channel | tenant | [Spec 15 §3.7] [Fase 2] Favoritos del cliente. |
| [`cms_content_events`](diccionario/cms.md#cms_content_events) | cms | tenant | [Spec 08 §3.11] [Fase 2] Bitácora editorial del contenido. |
| [`cms_contents`](diccionario/cms.md#cms_contents) | cms | tenant | [Spec 08 §3.10] [Fase 2] Contenidos CMS (páginas, artículos, banners, legales). |
| [`collab_approval_events`](diccionario/collab.md#collab_approval_events) | collab | tenant | [Spec 10 §3.5] [Fase 2] Trazabilidad de la solicitud (append-only). |
| [`collab_approval_info_requests`](diccionario/collab.md#collab_approval_info_requests) | collab | tenant | [Spec 10 §3.4] [Fase 2] Pedidos de información sobre una solicitud. |
| [`collab_approval_requests`](diccionario/collab.md#collab_approval_requests) | collab | tenant | [Spec 10 §3.2] [Fase 2] Solicitud de aprobación unificada. |
| [`collab_approval_rules`](diccionario/collab.md#collab_approval_rules) | collab | tenant | [Spec 10 §3.1] [Fase 2] Matriz de enrutamiento de aprobaciones. |
| [`collab_approval_steps`](diccionario/collab.md#collab_approval_steps) | collab | tenant | [Spec 10 §3.3] [Fase 2] Decisiones por nivel. |
| [`collab_channel_accounts`](diccionario/collab.md#collab_channel_accounts) | collab | tenant | [Spec 10 §3.10] [Fase 2] Cuentas de canal del inbox (WhatsApp, email, webchat). |
| [`collab_conversations`](diccionario/collab.md#collab_conversations) | collab | tenant | [Spec 10 §3.6] [Fase 2] Conversaciones omnicanal. |
| [`collab_inbound_events`](diccionario/collab.md#collab_inbound_events) | collab | tenant | [Spec 10 §3.10] [Fase 2] Eventos entrantes de webhooks (idempotencia, retención 30 días). |
| [`collab_message_attachments`](diccionario/collab.md#collab_message_attachments) | collab | tenant | [Spec 10 §3.8] [Fase 2] Adjuntos de mensajes. |
| [`collab_messages`](diccionario/collab.md#collab_messages) | collab | tenant | [Spec 10 §3.7] [Fase 2] Mensajes de la conversación. |
| [`collab_reply_templates`](diccionario/collab.md#collab_reply_templates) | collab | tenant | [Spec 10 §3.9] [Fase 2] Plantillas de respuesta del inbox. |
| [`fin_bank_lines`](diccionario/fin.md#fin_bank_lines) | fin | tenant | [Spec 07 §3.17] [Fase 2] Líneas de extracto bancario y su conciliación. |
| [`fin_bank_statements`](diccionario/fin.md#fin_bank_statements) | fin | tenant | [Spec 07 §3.17] [Fase 2] Extractos bancarios importados. |
| [`fin_cash_counts`](diccionario/fin.md#fin_cash_counts) | fin | tenant | [Spec 12 §3.6] [Fase 2] Actas de arqueo de caja. |
| [`fin_cash_replenishment_events`](diccionario/fin.md#fin_cash_replenishment_events) | fin | tenant | [Spec 12 §3.7] [Fase 2] Historial de estados de la reposición. (columnas supuestas) |
| [`fin_cash_replenishments`](diccionario/fin.md#fin_cash_replenishments) | fin | tenant | [Spec 12 §3.7] [Fase 2] Reposiciones de caja chica. |
| [`fin_cash_sessions`](diccionario/fin.md#fin_cash_sessions) | fin | tenant | [Spec 12 §3.5] [Fase 2] Sesiones diarias de caja chica. |
| [`fin_currencies`](diccionario/fin.md#fin_currencies) | fin | tenant | [Spec 17 §3.6] [Fase 2] Monedas activas del tenant (base / cobro). |
| [`fin_document_series`](diccionario/fin.md#fin_document_series) | fin | tenant | [Spec 07 §3.13] [Fase 2] Series de comprobantes (F001, B001, FC01, BC01). |
| [`fin_expense_receipts`](diccionario/fin.md#fin_expense_receipts) | fin | tenant | [Spec 12 §3.3] [Fase 2] Comprobante del gasto de caja chica. |
| [`fin_fiscal_events`](diccionario/fin.md#fin_fiscal_events) | fin | tenant | [Spec 07 §3.16] [Fase 2] Bitácora de integración fiscal OSE/PSE. |
| [`fin_fx_revaluations`](diccionario/fin.md#fin_fx_revaluations) | fin | tenant | [Spec 12 §3.8] [Fase 2] Diferencia de cambio mensual por cuenta USD. |
| [`fin_invoice_lines`](diccionario/fin.md#fin_invoice_lines) | fin | tenant | [Spec 07 §3.15] [Fase 2] Líneas del comprobante. |
| [`fin_invoices`](diccionario/fin.md#fin_invoices) | fin | tenant | [Spec 07 §3.14] [Fase 2] Comprobantes electrónicos (factura, boleta, NC, ND). Nunca se borran. |
| [`fin_period_close_checks`](diccionario/fin.md#fin_period_close_checks) | fin | tenant | [Spec 07 §3.18] [Fase 2] Controles manuales del cierre de periodo. |
| [`fin_period_closes`](diccionario/fin.md#fin_period_closes) | fin | tenant | [Spec 07 §3.18] [Fase 2] Cierre de periodo contable. |
| [`fin_reconciliation_closures`](diccionario/fin.md#fin_reconciliation_closures) | fin | tenant | [Spec 07 §3.17] [Fase 2] Cierres de conciliación bancaria. |
| [`fin_treasury_accounts`](diccionario/fin.md#fin_treasury_accounts) | fin | tenant | [Spec 12 §3.1] [Fase 2] Cuentas de tesorería (banco, caja chica, pasarela). |
| [`fin_treasury_movements`](diccionario/fin.md#fin_treasury_movements) | fin | tenant | [Spec 12 §3.2] [Fase 2] Movimientos de tesorería (saldo derivado). |
| [`fin_treasury_settings`](diccionario/fin.md#fin_treasury_settings) | fin | tenant | [Spec 12 §3.9] [Fase 2] Parámetros de tesorería (1 fila por tenant). |
| [`fin_treasury_transfers`](diccionario/fin.md#fin_treasury_transfers) | fin | tenant | [Spec 12 §3.4] [Fase 2] Transferencias entre cuentas / liquidaciones de pasarela. |
| [`fx_rate_providers`](diccionario/fin.md#fx_rate_providers) | fin | tenant | [Spec 17 §3.6 (v2.2)] [Fase 2] Proveedores de tipo de cambio. |
| [`notif_pax_message_templates`](diccionario/notif.md#notif_pax_message_templates) | notif | tenant | [Spec 17 §3.4] [Fase 2] Plantillas de mensajes automáticos al pasajero. |
| [`notif_pax_messages`](diccionario/notif.md#notif_pax_messages) | notif | tenant | [Spec 17 §3.5 + 04 §3 v2.1] [Fase 2] Mensajes al pasajero (programados, enviados, respuestas). |
| [`ops_incident_pax_acks`](diccionario/ops.md#ops_incident_pax_acks) | ops | tenant | [Spec 08 §3.14] [Fase 2] Confirmación de lectura de alertas por el pasajero. |
| [`ops_mobile_devices`](diccionario/ops.md#ops_mobile_devices) | ops | tenant | [Spec 05 §3.13] [Fase 2] Dispositivos de las apps operador/pasajero (id generado en el dispositivo). |
| [`ops_sync_actions`](diccionario/ops.md#ops_sync_actions) | ops | tenant | [Spec 05 §3.13] [Fase 2] Acciones recibidas del outbox móvil (base de idempotencia; id = client_action_id). |
| [`ops_travel_doc_contacts`](diccionario/ops.md#ops_travel_doc_contacts) | ops | tenant | [Spec 11 §3.8] [Fase 2] Contacto de emergencia por pasajero. |
| [`ops_travel_doc_items`](diccionario/ops.md#ops_travel_doc_items) | ops | tenant | [Spec 11 §3.7] [Fase 2] Checklist documental por pasajero. |
| [`ops_travel_doc_reminders`](diccionario/ops.md#ops_travel_doc_reminders) | ops | tenant | [Spec 11 §3.9] [Fase 2] Recordatorios documentales enviados. |
| [`ops_travel_doc_special`](diccionario/ops.md#ops_travel_doc_special) | ops | tenant | [Spec 11 §3.8] [Fase 2] Atención especial (sin datos clínicos; acceso restringido). |
| [`supplier_invoices`](diccionario/supplier.md#supplier_invoices) | supplier | tenant | [Spec 06 §3.3] [Fase 2] Factura del proveedor asociada a una CxP. |
| [`supplier_rate_requests`](diccionario/supplier.md#supplier_rate_requests) | supplier | tenant | [Spec 06 §3.4] [Fase 2] Solicitudes de actualización de tarifa del proveedor. |
| [`supplier_request_responses`](diccionario/supplier.md#supplier_request_responses) | supplier | tenant | [Spec 06 §3.2] [Fase 2] Respuesta del proveedor (confirmación, rechazo, alternativa). |
| [`sys_booking_rules`](diccionario/sys.md#sys_booking_rules) | sys | tenant | [Spec 17 §3.1 + 16 §3.1] [Fase 2] Centro de reglas del tenant (copia del catálogo de plataforma). |

Columnas que esta fase agrega a tablas de fases previas: `booking_passengers` (pending); `booking_reservation_services` (addon_id, kind, nights, pax_detail, rooms); `booking_reservations` (b2b_terms, cancel_request_id, ecom_order_id); `catalog_product_media` (alt_i18n, blurhash, caption_i18n, height, width); `catalog_products` (accommodation_currency, accommodation_enabled, accommodation_note, accommodation_optional, difficulty, guide_languages, pickup_ask_flight, pickup_required, pickup_text, rating_avg, rating_count); `catalog_services` (scheduled_cost, scheduled_cost_from); `crm_clients` (consents); `crm_leads` (consent, matched_client_id, sla_due_at, web_request); `fin_commissions` (approval_round, observation, settlement_request_id); `fin_fx_rates` (alert_raised, daily_change_pct, is_demo, provider_id); `fin_payables` (approval_round, observation); `fin_payments` (reversal_request_id); `iam_users` (created_via, email_verified_at, provider_role); `ops_incidents` (public_message, public_title); `quote_versions` (approval_request_id).

### Fase 3 · SaaS y crecimiento · `40_fase3.sql` · 28 tablas

| Tabla | Dominio | RLS | Descripción |
|---|---|---|---|
| [`channel_external_reviews`](diccionario/channel.md#channel_external_reviews) | channel | tenant | [Spec 17 §3.7] [Fase 3] Reseñas importadas (texto inmutable). |
| [`crm_own_review_log`](diccionario/crm.md#crm_own_review_log) | crm | tenant | [Spec 18 §3.2] [Fase 3] Historial de moderación de la reseña. |
| [`crm_own_reviews`](diccionario/crm.md#crm_own_reviews) | crm | tenant | [Spec 18 §3.1] [Fase 3] Reseñas propias verificadas por reserva. |
| [`crm_review_requests`](diccionario/crm.md#crm_review_requests) | crm | tenant | [Spec 18 §3.3] [Fase 3] Solicitudes de reseña post-viaje. |
| [`crm_sales_target_adjustments`](diccionario/crm.md#crm_sales_target_adjustments) | crm | tenant | [Spec 14 §3.15] [Fase 3] Historial de ajustes de la meta. |
| [`crm_sales_target_policies`](diccionario/crm.md#crm_sales_target_policies) | crm | tenant | [Spec 14 §3.16] [Fase 3] Política de metas y bonos (1 fila por tenant). |
| [`crm_sales_targets`](diccionario/crm.md#crm_sales_targets) | crm | tenant | [Spec 14 §3.14] [Fase 3] Metas comerciales por asesor, sede o equipo. |
| [`crm_sales_team_members`](diccionario/crm.md#crm_sales_team_members) | crm | tenant | [Spec 14 §3.13] [Fase 3] Integrantes del equipo (vigencias). |
| [`crm_sales_teams`](diccionario/crm.md#crm_sales_teams) | crm | tenant | [Spec 14 §3.13] [Fase 3] Equipos de venta. |
| [`integration_api_keys`](diccionario/integration.md#integration_api_keys) | integration | tenant | [Spec 13 §3.11] [Fase 3] API keys del tenant (solo hash del token). |
| [`integration_oauth_apps`](diccionario/integration.md#integration_oauth_apps) | integration | tenant | [Spec 13 §3.14] [Fase 3] Apps OAuth de terceros autorizadas (Authorization Code + PKCE). |
| [`integration_review_sources`](diccionario/integration.md#integration_review_sources) | integration | tenant | [Spec 17 §3.7] [Fase 3] Conectores de reseñas externas (TripAdvisor, Google…). |
| [`integration_webhook_deliveries`](diccionario/integration.md#integration_webhook_deliveries) | integration | tenant | [Spec 13 §3.13] [Fase 3] Entregas de webhooks (particionada por mes, retención 30 días). |
| [`integration_webhooks`](diccionario/integration.md#integration_webhooks) | integration | tenant | [Spec 13 §3.12] [Fase 3] Suscripciones de webhooks del tenant. |
| [`oauth_clients`](diccionario/integration.md#oauth_clients) | integration | tenant | [Spec 13 §3.14] [Fase 3] Clientes OAuth (Laravel Passport) extendidos con tenant_id. |
| [`mkt_attributions`](diccionario/mkt.md#mkt_attributions) | mkt | tenant | [Spec 14 §3.10] [Fase 3] Atribución de conversiones a campañas (read model). |
| [`mkt_automation_enrollments`](diccionario/mkt.md#mkt_automation_enrollments) | mkt | tenant | [Spec 14 §3.12] [Fase 3] Disparos procesados por automatización (idempotencia). |
| [`mkt_automation_runs`](diccionario/mkt.md#mkt_automation_runs) | mkt | tenant | [Spec 14 §3.12] [Fase 3] Ejecuciones de automatizaciones. |
| [`mkt_automations`](diccionario/mkt.md#mkt_automations) | mkt | tenant | [Spec 14 §3.11] [Fase 3] Automatizaciones de marketing / servicio. |
| [`mkt_campaign_recipients`](diccionario/mkt.md#mkt_campaign_recipients) | mkt | tenant | [Spec 14 §3.8] [Fase 3] Destinatarios de la campaña y métricas. |
| [`mkt_campaign_suppressions`](diccionario/mkt.md#mkt_campaign_suppressions) | mkt | tenant | [Spec 14 §3.9] [Fase 3] Contactos suprimidos del envío (evidencia). |
| [`mkt_campaign_tests`](diccionario/mkt.md#mkt_campaign_tests) | mkt | tenant | [Spec 14 §3.7] [Fase 3] Envíos de prueba de campaña. |
| [`mkt_campaigns`](diccionario/mkt.md#mkt_campaigns) | mkt | tenant | [Spec 14 §3.6] [Fase 3] Campañas de marketing. |
| [`mkt_consent_events`](diccionario/mkt.md#mkt_consent_events) | mkt | tenant | [Spec 14 §3.3] [Fase 3] Historial inmutable de consentimientos (evidencia ANPD). |
| [`mkt_consents`](diccionario/mkt.md#mkt_consents) | mkt | tenant | [Spec 14 §3.2] [Fase 3] Consentimiento vigente por titular y canal. |
| [`mkt_contacts_subscribers`](diccionario/mkt.md#mkt_contacts_subscribers) | mkt | tenant | [Spec 14 §3.1] [Fase 3] Suscriptores del newsletter. |
| [`mkt_segments`](diccionario/mkt.md#mkt_segments) | mkt | tenant | [Spec 14 §3.4] [Fase 3] Segmentos de audiencia. |
| [`mkt_templates`](diccionario/mkt.md#mkt_templates) | mkt | tenant | [Spec 14 §3.5] [Fase 3] Plantillas de marketing (email / WhatsApp). |

Columnas que esta fase agrega a tablas de fases previas: `catalog_product_promotions` (campaign_id); `channel_ecom_orders` (utm_campaign); `crm_leads` (utm_campaign); `fin_commissions` (sales_target_id).

## Columnas de estado (CHECK con lista de valores)

Ver también [`../../referencia/MAQUINAS-DE-ESTADO.md`](../../referencia/MAQUINAS-DE-ESTADO.md) (transiciones).

| Tabla | Columna | Valores |
|---|---|---|
| [`booking_cancel_requests`](diccionario/booking.md#booking_cancel_requests) | `status` | `pendiente`, `aprobada`, `rechazada`, `retirada` |
| [`booking_changes`](diccionario/booking.md#booking_changes) | `status` | `pendiente`, `aplicada`, `rechazada` |
| [`booking_inventory_holds`](diccionario/booking.md#booking_inventory_holds) | `status` | `hold`, `confirmada`, `liberada`, `expirada`, `consumida` |
| [`booking_reservation_services`](diccionario/booking.md#booking_reservation_services) | `status` | `pendiente`, `solicitado`, `confirmado`, `rechazado`, `en_curso`, `completado`, `cancelado` |
| [`booking_reservations`](diccionario/booking.md#booking_reservations) | `status` | `borrador`, `pendiente_disponibilidad`, `confirmada`, `pendiente_pago`, `pendiente_proveedor`, `reprogramada`, `parcial`, `incidencia`, `en_operacion`, `completada`, `cancelada` |
| [`catalog_allotment_consumptions`](diccionario/catalog.md#catalog_allotment_consumptions) | `state` | `consumido`, `en_tramite`, `revertido` |
| [`catalog_allotment_requests`](diccionario/catalog.md#catalog_allotment_requests) | `status` | `solicitada`, `aceptada`, `rechazada` |
| [`catalog_allotments`](diccionario/catalog.md#catalog_allotments) | `status` | `activo`, `en_release`, `liberado`, `vencido` |
| [`catalog_availability_holds`](diccionario/catalog.md#catalog_availability_holds) | `status` | `hold`, `confirmada`, `liberada`, `expirada`, `consumida` |
| [`catalog_availability_ranges`](diccionario/catalog.md#catalog_availability_ranges) | `status` | `disponible`, `cerrado`, `agotado` |
| [`catalog_price_rules`](diccionario/catalog.md#catalog_price_rules) | `status` | `activa`, `inactiva` |
| [`catalog_product_departures`](diccionario/catalog.md#catalog_product_departures) | `status` | `abierta`, `completa`, `cerrada`, `cancelada` |
| [`catalog_product_promotions`](diccionario/catalog.md#catalog_product_promotions) | `status` | `activa`, `inactiva` |
| [`catalog_product_versions`](diccionario/catalog.md#catalog_product_versions) | `status` | `borrador`, `en_revision`, `vigente`, `historica` |
| [`catalog_products`](diccionario/catalog.md#catalog_products) | `status` | `DRAFT`, `REVIEW`, `APPROVED`, `ACTIVE`, `SUSPENDED`, `INACTIVE`, `ARCHIVED` |
| [`catalog_providers`](diccionario/catalog.md#catalog_providers) | `status` | `activo`, `inactivo`, `vencido` |
| [`catalog_rates`](diccionario/catalog.md#catalog_rates) | `status` | `vigente`, `inactiva` |
| [`catalog_seasons`](diccionario/catalog.md#catalog_seasons) | `status` | `activa`, `inactiva` |
| [`catalog_services`](diccionario/catalog.md#catalog_services) | `status` | `activo`, `inactivo`, `vencido` |
| [`channel_b2b_agencies`](diccionario/channel.md#channel_b2b_agencies) | `status` | `activa`, `bloqueada`, `inactiva` |
| [`channel_b2b_price_lists`](diccionario/channel.md#channel_b2b_price_lists) | `status` | `activa`, `inactiva` |
| [`channel_b2b_settlement_requests`](diccionario/channel.md#channel_b2b_settlement_requests) | `status` | `solicitada`, `aprobada`, `rechazada`, `pagada` |
| [`channel_ecom_orders`](diccionario/channel.md#channel_ecom_orders) | `status` | `pago_pendiente`, `pago_por_validar`, `pago_rechazado`, `confirmado`, `cancelado`, `expirado` |
| [`channel_external_reviews`](diccionario/channel.md#channel_external_reviews) | `response_status` | `sin_responder`, `pendiente_publicar`, `publicada`, `no_admite` |
| [`channel_pax_feedback`](diccionario/channel.md#channel_pax_feedback) | `status` | `nuevo`, `leido`, `respondido`, `derivado` |
| [`channel_support_tickets`](diccionario/channel.md#channel_support_tickets) | `status` | `abierta`, `en_proceso`, `resuelta`, `cerrada` |
| [`channel_web_carts`](diccionario/channel.md#channel_web_carts) | `status` | `activo`, `convertido`, `abandonado`, `expirado` |
| [`channel_widget_domains`](diccionario/channel.md#channel_widget_domains) | `status` | `pendiente`, `verificado` |
| [`channel_widget_handoffs`](diccionario/channel.md#channel_widget_handoffs) | `status` | `pendiente`, `en_carrito`, `convertido`, `expirado` |
| [`cms_contents`](diccionario/cms.md#cms_contents) | `status` | `borrador`, `en_revision`, `aprobado`, `publicado`, `despublicado` |
| [`collab_approval_requests`](diccionario/collab.md#collab_approval_requests) | `status` | `pendiente`, `info`, `aprobada`, `rechazada`, `anulada` |
| [`collab_channel_accounts`](diccionario/collab.md#collab_channel_accounts) | `status` | `activo`, `sandbox`, `inactivo` |
| [`collab_conversations`](diccionario/collab.md#collab_conversations) | `status` | `abierta`, `pendiente`, `resuelta` |
| [`collab_inbound_events`](diccionario/collab.md#collab_inbound_events) | `status` | `recibido`, `procesado`, `duplicado`, `error` |
| [`collab_message_attachments`](diccionario/collab.md#collab_message_attachments) | `scan_status` | `pendiente`, `limpio`, `infectado` |
| [`collab_messages`](diccionario/collab.md#collab_messages) | `delivery_status` | `encolado`, `enviado`, `entregado`, `leido`, `fallido` |
| [`coupons`](diccionario/plataforma.md#coupons) | `status` | `active`, `inactive` |
| [`crm_activities`](diccionario/crm.md#crm_activities) | `status` | `pendiente`, `vencida`, `completada` |
| [`crm_cases`](diccionario/crm.md#crm_cases) | `status` | `abierta`, `en_proceso`, `resuelta`, `cerrada` |
| [`crm_cases`](diccionario/crm.md#crm_cases) | `book_status` | `received`, `in_review`, `answered`, `closed` |
| [`crm_leads`](diccionario/crm.md#crm_leads) | `status` | `nuevo`, `contactado`, `calificado`, `convertido`, `duplicado`, `descartado` |
| [`crm_opportunities`](diccionario/crm.md#crm_opportunities) | `stage` | `calificacion`, `descubrimiento`, `cotizacion`, `negociacion`, `ganada`, `perdida` |
| [`crm_own_reviews`](diccionario/crm.md#crm_own_reviews) | `status` | `pendiente`, `publicada`, `rechazada`, `oculta` |
| [`crm_review_requests`](diccionario/crm.md#crm_review_requests) | `status` | `programada`, `enviada`, `abierta`, `respondida`, `vencida`, `cancelada` |
| [`crm_sales_targets`](diccionario/crm.md#crm_sales_targets) | `status` | `borrador`, `vigente`, `cerrada`, `anulada` |
| [`fin_bank_lines`](diccionario/fin.md#fin_bank_lines) | `status` | `pendiente`, `sugerido`, `excepcion`, `conciliado` |
| [`fin_cash_counts`](diccionario/fin.md#fin_cash_counts) | `status` | `signed`, `pending_approval`, `approved`, `validated` |
| [`fin_cash_replenishments`](diccionario/fin.md#fin_cash_replenishments) | `status` | `requested`, `approved`, `paid`, `rejected` |
| [`fin_cash_sessions`](diccionario/fin.md#fin_cash_sessions) | `status` | `open`, `closed` |
| [`fin_commissions`](diccionario/fin.md#fin_commissions) | `status` | `calculada`, `aprobada`, `pagada` |
| [`fin_fiscal_events`](diccionario/fin.md#fin_fiscal_events) | `status` | `ok`, `error_temporal`, `error_definitivo` |
| [`fin_invoices`](diccionario/fin.md#fin_invoices) | `status` | `pendiente_envio`, `emitido`, `aceptado`, `observado`, `rechazado`, `anulado` |
| [`fin_payables`](diccionario/fin.md#fin_payables) | `status` | `abierta`, `aprobada`, `parcial`, `pagada`, `vencida`, `cancelada` |
| [`fin_payments`](diccionario/fin.md#fin_payments) | `status` | `pendiente`, `confirmado`, `aplicado`, `rechazado`, `revertido` |
| [`fin_period_closes`](diccionario/fin.md#fin_period_closes) | `status` | `abierto`, `cerrado` |
| [`fin_receivables`](diccionario/fin.md#fin_receivables) | `status` | `abierta`, `parcial`, `vencida`, `pagada`, `cancelada` |
| [`fin_treasury_accounts`](diccionario/fin.md#fin_treasury_accounts) | `status` | `active`, `inactive` |
| [`fin_treasury_movements`](diccionario/fin.md#fin_treasury_movements) | `status` | `posted`, `voided` |
| [`fx_rate_providers`](diccionario/fin.md#fx_rate_providers) | `status` | `activo`, `por_validar`, `inactivo`, `error` |
| [`iam_access_requests`](diccionario/iam.md#iam_access_requests) | `status` | `pendiente`, `atendida`, `rechazada` |
| [`iam_sedes`](diccionario/iam.md#iam_sedes) | `status` | `activa`, `inactiva` |
| [`iam_users`](diccionario/iam.md#iam_users) | `status` | `pendiente`, `activo`, `inactivo` |
| [`integration_adapters`](diccionario/integration.md#integration_adapters) | `status` | `activo`, `por_validar`, `sandbox`, `parcial`, `futuro` |
| [`integration_api_keys`](diccionario/integration.md#integration_api_keys) | `status` | `active`, `revoked`, `expired` |
| [`integration_errors`](diccionario/integration.md#integration_errors) | `status` | `reintentando`, `fallo_definitivo`, `resuelto` |
| [`integration_oauth_apps`](diccionario/integration.md#integration_oauth_apps) | `status` | `active`, `revoked` |
| [`integration_review_sources`](diccionario/integration.md#integration_review_sources) | `status` | `no_conectado`, `pendiente`, `conectado`, `error` |
| [`integration_webhook_deliveries`](diccionario/integration.md#integration_webhook_deliveries) | `status` | `pending`, `delivered`, `retrying`, `failed` |
| [`integration_webhooks`](diccionario/integration.md#integration_webhooks) | `status` | `active`, `paused`, `disabled`, `deleted` |
| [`mkt_automation_enrollments`](diccionario/mkt.md#mkt_automation_enrollments) | `status` | `enviado`, `suprimido` |
| [`mkt_automations`](diccionario/mkt.md#mkt_automations) | `status` | `activa`, `pausada` |
| [`mkt_campaign_recipients`](diccionario/mkt.md#mkt_campaign_recipients) | `status` | `pendiente`, `enviado`, `entregado`, `rebotado`, `fallido` |
| [`mkt_campaigns`](diccionario/mkt.md#mkt_campaigns) | `status` | `borrador`, `programada`, `enviando`, `enviada`, `cancelada` |
| [`mkt_consents`](diccionario/mkt.md#mkt_consents) | `status` | `otorgado`, `revocado` |
| [`mkt_templates`](diccionario/mkt.md#mkt_templates) | `status` | `activa`, `en_revision`, `aprobada`, `rechazada` |
| [`notif_messages`](diccionario/notif.md#notif_messages) | `status` | `pendiente`, `enviado`, `fallido` |
| [`notif_pax_messages`](diccionario/notif.md#notif_pax_messages) | `status` | `programado`, `enviado`, `entregado`, `leido`, `fallido`, `cancelado` |
| [`ops_assignments`](diccionario/ops.md#ops_assignments) | `status` | `pendiente`, `asignada`, `confirmada`, `en_curso`, `completada` |
| [`ops_drivers`](diccionario/ops.md#ops_drivers) | `status` | `disponible`, `asignado`, `descanso`, `vacaciones` |
| [`ops_guides`](diccionario/ops.md#ops_guides) | `status` | `disponible`, `asignado`, `descanso`, `vacaciones` |
| [`ops_incidents`](diccionario/ops.md#ops_incidents) | `status` | `abierta`, `en_proceso`, `resuelta`, `cerrada` |
| [`ops_orders`](diccionario/ops.md#ops_orders) | `status` | `planificada`, `pendiente_asignacion`, `asignada`, `confirmada`, `en_ejecucion`, `completada`, `cancelada` |
| [`ops_rooming_lists`](diccionario/ops.md#ops_rooming_lists) | `status` | `borrador`, `confirmada`, `modificada`, `enviada` |
| [`ops_rooming_rooms`](diccionario/ops.md#ops_rooming_rooms) | `status` | `confirmada`, `pendiente`, `observada` |
| [`ops_supplier_requests`](diccionario/ops.md#ops_supplier_requests) | `status` | `solicitado`, `confirmado`, `rechazado`, `alternativa_propuesta`, `anulada` |
| [`ops_travel_doc_items`](diccionario/ops.md#ops_travel_doc_items) | `status` | `pendiente`, `recibido`, `completo`, `observado` |
| [`ops_vehicles`](diccionario/ops.md#ops_vehicles) | `status` | `disponible`, `asignado`, `mantenimiento` |
| [`ops_vouchers`](diccionario/ops.md#ops_vouchers) | `status` | `emitido`, `utilizado`, `anulado` |
| [`payment_methods`](diccionario/plataforma.md#payment_methods) | `status` | `active`, `expired`, `removed` |
| [`plans`](diccionario/plataforma.md#plans) | `status` | `active`, `hidden`, `retired` |
| [`platform_credit_notes`](diccionario/plataforma.md#platform_credit_notes) | `sunat_status` | `pending`, `accepted`, `observed`, `rejected` |
| [`platform_invoices`](diccionario/plataforma.md#platform_invoices) | `status` | `draft`, `open`, `paid`, `failed`, `uncollectible`, `void` |
| [`platform_invoices`](diccionario/plataforma.md#platform_invoices) | `sunat_status` | `pending`, `accepted`, `observed`, `rejected` |
| [`platform_users`](diccionario/plataforma.md#platform_users) | `status` | `activo`, `inactivo` |
| [`quote_internal_approvals`](diccionario/quote.md#quote_internal_approvals) | `status` | `pendiente`, `aprobada`, `rechazada`, `anulada` |
| [`quote_quotes`](diccionario/quote.md#quote_quotes) | `status` | `borrador`, `enviada`, `vista`, `negociacion`, `aprobada`, `rechazada`, `vencida`, `convertida`, `cancelada` |
| [`quote_versions`](diccionario/quote.md#quote_versions) | `status` | `borrador`, `enviada`, `aprobada`, `rechazada`, `reemplazada`, `vencida` |
| [`report_exports`](diccionario/report.md#report_exports) | `status` | `en_cola`, `procesando`, `disponible`, `fallido`, `expirado` |
| [`subscription_changes`](diccionario/plataforma.md#subscription_changes) | `status` | `scheduled`, `applied`, `voided` |
| [`subscriptions`](diccionario/plataforma.md#subscriptions) | `status` | `trialing`, `active`, `past_due`, `cancel_scheduled`, `suspended`, `canceled` |
| [`supplier_invoices`](diccionario/supplier.md#supplier_invoices) | `status` | `registrada`, `validada`, `observada`, `rechazada` |
| [`supplier_rate_requests`](diccionario/supplier.md#supplier_rate_requests) | `status` | `pendiente`, `aprobada`, `rechazada`, `retirada` |
| [`supplier_request_responses`](diccionario/supplier.md#supplier_request_responses) | `review_status` | `pendiente`, `aceptada`, `rechazada`, `expirada` |
| [`sys_idempotency_keys`](diccionario/sys.md#sys_idempotency_keys) | `status` | `processing`, `completed`, `failed` |
| [`sys_job_runs`](diccionario/sys.md#sys_job_runs) | `status` | `en_curso`, `ok`, `advertencia`, `error` |
| [`sys_outbox`](diccionario/sys.md#sys_outbox) | `status` | `pending`, `dispatched`, `failed` |
| [`sys_scheduled_jobs`](diccionario/sys.md#sys_scheduled_jobs) | `last_status` | `ok`, `advertencia`, `error`, `en_curso` |
| [`tenants`](diccionario/plataforma.md#tenants) | `status` | `prueba`, `activo`, `suspendido` |
