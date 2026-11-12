# Base de datos · KipuControl (PostgreSQL 17)

Esquema físico completo del SaaS, consolidado desde la **sección 3 (modelo de datos)** de las 26 especificaciones (`proto/docs/especificaciones/00…25`; la 25 no agrega tablas) y `CONVENCIONES.md`. Los archivos `.sql` de esta carpeta son la **fuente de verdad** del modelo de datos: las migraciones de Laravel se escriben a partir de ellos, no del prototipo.

Validado en PostgreSQL 16 real (sintaxis compatible con 17): los 7 archivos corren sin errores con `ON_ERROR_STOP=1`, en una sola pasada y también fase por fase (`00→01→10→90→20→90→30→90→40→90`), y el smoke test pasa 15/15 (ver §9).

## 1. Contenido

| Archivo | Qué contiene |
|---|---|
| `00_extensions_and_functions.sql` | Extensiones (`pgcrypto`, `btree_gist`, `pg_trgm`, `citext`), `app_uuid_v7()`, helper de tenant `app_current_tenant_id()` (= `current_setting('app.tenant_id', true)`), `app_set_tenant()`, triggers genéricos (`updated_at`, `lock_version`, append-only, correlativo no decreciente), particiones mensuales y `app_enable_tenant_rls()`. |
| `01_platform.sql` | Tablas de plataforma, sin RLS de tenant: `tenants`, `plans`, límites, features, add-ons, suscripciones, facturación SaaS, medición de uso, catálogo de reglas y permisos globales. Incluye las tablas de plataforma de fase 3, marcadas `[Fase 3]` en su comentario. |
| `10_fase0.sql` · `20_fase1.sql` · `30_fase2.sql` · `40_fase3.sql` | Tablas de negocio de cada fase del plan (tablas, columnas agregadas a fases previas, CHECK, UNIQUE, FK, índices, EXCLUDE, triggers y `COMMENT ON TABLE` con la spec de origen). Cada archivo es autocontenido; los índices van dentro del archivo de su fase, por eso no hay `95_indexes.sql`. |
| `90_rls.sql` | Roles `app_role` / `platform_role`, privilegios, `ENABLE` + `FORCE ROW LEVEL SECURITY` y la política `tenant_isolation` en las 258 tablas con `tenant_id` (incluido `personal_access_tokens` desde v2.5; `tenant_self` en `tenants` y políticas propias en `role_has_permissions`), funciones de resolución previas al contexto y una verificación final que falla si alguna tabla con `tenant_id` quedó sin RLS. Es idempotente y se ejecuta **después de cada fase**. |
| `schema.dbml` | Diagrama completo para dbdiagram.io (327 tablas, `TableGroup` por fase). |
| `dbml/plataforma.dbml`, `dbml/fase0…3.dbml` | Un diagrama por fase (más legible). Solo incluyen las relaciones internas de la fase. |
| `tests/smoke_test.sql` | Pruebas de aislamiento RLS, triggers, CHECK, EXCLUDE y flujo catálogo → cotización → reserva → CxC. Ejecutar solo en una BD de prueba. |
| `tests/validate.sh` | Crea un cluster temporal (`initdb`), ejecuta 00→90 y el smoke test, imprime conteos y detiene el cluster. |

## 2. Orden de ejecución

```bash
# BD vacía, como dueño del esquema (usuario de migraciones)
for f in 00_extensions_and_functions 01_platform 10_fase0 20_fase1 30_fase2 40_fase3 90_rls; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/$f.sql
done

# Validación completa en un cluster temporal
PGBIN=/usr/lib/postgresql/17/bin ./database/tests/validate.sh
```

Despliegue por fases: `00 → 01 → 10 → 90`, luego `20 → 90`, `30 → 90` y `40 → 90`. Una fase puede agregar columnas y FKs a tablas de fases anteriores (ver §4). Las FKs hacia tablas de fases futuras (por ejemplo `iam_users.client_id → crm_clients`) se crean en el archivo de la fase donde existe la tabla destino.

## 3. Convenciones aplicadas (CONVENCIONES.md §1–2)

| Tema | Implementación |
|---|---|
| PK | `id uuid default app_uuid_v7()`. Laravel `HasUuids` genera v7 en la app; el default cubre SQL y seeders. Excepciones con PK compuesta: tablas pivote, `sys_settings (tenant_id, section)`, `plan_limits`, `usage_*` y `channel_web_events` (`bigint identity`, spec 15). |
| Tenant | `tenant_id uuid not null default app_current_tenant_id()` + FK a `tenants(id)` en toda tabla de negocio. El default es solo una defensa: Laravel asigna el tenant desde el contexto autenticado. Tablas con `tenant_id` NULL = fila global: `roles` (plantillas), `notif_templates`, `integration_adapters`, `sys_holidays`, `sys_scheduled_jobs`, `sys_job_runs`, `integration_errors`, `audit_events`, `sys_idempotency_keys`, `sys_outbox`. |
| Código legible | `code varchar(20–30)` con `UNIQUE (tenant_id, code)`, generado con `sys_sequences` (`SELECT … FOR UPDATE`). Catálogo (spec 02) usa `ref` (C-13). |
| Dinero | `numeric(14,2)` + `currency char(3)` (+ `CHECK IN ('PEN','USD')` donde la spec lo fija) + `fx_rate numeric(12,6)`. Nunca `float`. |
| Fechas | `timestamptz` para instantes, `date` para servicio y `time` para horas locales. |
| Estados | `varchar(n)` + `CHECK (status IN (…))` con los **valores exactos** de cada spec. Si varias specs listan valores distintos, el CHECK es la unión y queda registrado en §8. |
| Concurrencia | `lock_version integer default 0` en 39 tablas (cotizaciones, reservas, salidas, holds, pagos, CxC/CxP, cupos, etc.). El trigger `app_bump_lock_version` incrementa el valor si la app no lo hizo. El `UPDATE … WHERE lock_version = ?` sin filas afectadas → 409. |
| Borrado | `deleted_at` en las 40 entidades con historia que indican las specs. Las bitácoras son append-only: trigger `app_forbid_update_delete` + `REVOKE UPDATE, DELETE` (`audit_events`, `crm_case_events`, `ops_incident_logs`, `channel_b2b_credit_movements`, `collab_approval_events`, `mkt_consent_events`, `fin_fx_rates`). |
| Auditoría de fila | `created_by`, `updated_by`, `created_at`, `updated_at` (trigger `app_set_updated_at`). Las tablas de log solo llevan `created_by` y `created_at`. `created_by`/`updated_by` **no tienen FK** porque pueden ser usuario del tenant, usuario de plataforma o `NULL` = Sistema. |
| Índices | Toda FK tiene índice (verificado: 0 FKs sin índice, salvo `tenant_id`, que siempre encabeza algún índice compuesto). También `(tenant_id, status)`, `(tenant_id, owner_id)` y `(tenant_id, created_at desc)` en tablas con código, además de los índices parciales, GIN (tags, trigram, arrays) y GiST que piden las specs. |
| Comentarios | `COMMENT ON TABLE` en las 327 tablas: `[Spec NN §x] [Fase] descripción`. Las columnas agregadas por una fase posterior llevan `COMMENT ON COLUMN`. |
| Particionado | Por mes: `audit_events`, `usage_counters`, `channel_web_events`, `integration_webhook_deliveries`. Se crean la partición DEFAULT y 24 meses desde 2026-01 con `app_create_monthly_partitions()`; programar un job mensual que cree el mes siguiente. |

## 4. Resumen por fase

| Fase | Archivo | Tablas | FKs | UNIQUE | Índices | CHECK de tabla | Specs de origen |
|---|---|---|---|---|---|---|---|
| Plataforma | `01_platform.sql` | 30 | 39 | 26 | 32 | 6 | 00, 09, 13, 17 |
| Fase 0 · Fundaciones | `10_fase0.sql` | 25 | 47 | 17 | 57 | 2 | 00, 05, 07, 09 |
| Fase 1 · MVP | `20_fase1.sql` | 93 | 334 | 93 | 411 | 62 | 01, 02, 03, 04, 05, 07, 08, 09, 12, 16 |
| Fase 2 · Canales y campo | `30_fase2.sql` | 86 | 305 | 98 | 340 | 27 | 02, 04, 05, 06, 07, 08, 10, 11, 12, 15, 16, 17 |
| Fase 3 · SaaS y crecimiento | `40_fase3.sql` | 93 | 271 | 112 | 299 | 106 | 13, 14, 17, 18, 19, 20, 21, 22, 23, 24 |
| **Total** | | **327** | 996 | 346 | 1139 | 203 | 00–24 |

Los CHECK de columna (estados, rangos) van en línea y no se cuentan arriba; tampoco la FK compuesta `(tenant_id, rule_code)` ni el UNIQUE diferible de `catalog_accommodation_legs`, que se declaran como restricciones. En la BD de prueba hay **974 CHECK**, **997 FK** (638 compuestas con `tenant_id`), **1 911 índices** (incluye PK y UNIQUE, entre ellos los UNIQUE `(tenant_id, id)` que exigen las FKs compuestas), **7 EXCLUDE**, **314 triggers**, **281 tablas con RLS** y **569 políticas**.

**Plataforma** (30): `platform_users`, `plans`, `plan_limits`, `addons`, `addon_prices`, `features`, `plan_features`, `plan_channels`, `tenants`, `tenant_onboarding`, `platform_sequences`, `feature_overrides`, `sys_booking_rule_catalog`, `plan_rule_entitlements`, `sys_rule_templates`, `permissions`, `coupons`, `subscriptions`, `coupon_redemptions`, `subscription_items`, `platform_invoices`, `platform_invoice_lines`, `subscription_changes`, `platform_credit_notes`, `payment_methods`, `payment_attempts`, `usage_counters`, `usage_monthly`, `usage_events`, `platform_metrics_daily`

**Fase 0 · Fundaciones** (25, incluye `fin_fx_rates` desde v2.5): `iam_sedes`, `iam_users`, `iam_mfa_factors`, `personal_access_tokens`, `roles`, `role_has_permissions`, `model_has_roles`, `model_has_permissions`, `audit_events`, `sys_sequences`, `sys_idempotency_keys`, `sys_outbox`, `iam_access_requests`, `iam_user_invitations`, `sys_settings`, `notif_event_rules`, `notif_templates`, `notif_messages`, `notif_reads`, `sys_documents`, `integration_adapters`, `sys_scheduled_jobs`, `sys_job_runs`, `integration_errors`, `fin_fx_rates`

**Fase 1 · MVP** (93): `catalog_product_types`, `catalog_product_categories`, `catalog_product_subcategories`, `catalog_destinations`, `catalog_providers`, `catalog_provider_contacts`, `catalog_services`, `catalog_products`, `catalog_product_versions`, `catalog_product_destinations`, `catalog_product_items`, `catalog_itineraries`, `catalog_itinerary_days`, `catalog_itinerary_items`, `catalog_product_inclusions`, `catalog_product_requirements`, `catalog_product_policies`, `catalog_product_related`, `catalog_seasons`, `catalog_product_promotions`, `catalog_product_media`, `catalog_product_faqs`, `catalog_product_channels`, `catalog_product_seasons`, `catalog_product_config_groups`, `catalog_product_config_options`, `catalog_rates`, `catalog_rate_conditions`, `catalog_price_rules`, `catalog_product_departures`, `catalog_availability_holds`, `catalog_availability_ranges`, `catalog_pax_rules`, `crm_catalog_items`, `crm_clients`, `crm_leads`, `crm_lead_qualifications`, `crm_client_contacts`, `crm_pipeline_stages`, `crm_opportunities`, `crm_activities`, `crm_surveys`, `crm_cases`, `crm_case_events`, `crm_claim_book_settings`, `sys_holidays`, `quote_quotes`, `quote_versions`, `quote_items`, `quote_internal_approvals`, `quote_sends`, `quote_access_tokens`, `quote_views`, `quote_negotiations`, `quote_approvals`, `booking_reservations`, `booking_passengers`, `booking_reservation_services`, `booking_inventory_holds`, `booking_changes`, `booking_cancel_requests`, `booking_cancellations`, `ops_guides`, `ops_drivers`, `ops_vehicles`, `ops_orders`, `ops_order_tasks`, `ops_supplier_requests`, `ops_assignments`, `ops_assignment_checkins`, `ops_rooming_lists`, `ops_rooming_rooms`, `ops_rooming_guests`, `ops_vouchers`, `ops_voucher_versions`, `ops_incidents`, `ops_incident_logs`, `ops_evidences`, `fin_bank_accounts`, `fin_payment_methods`, `fin_receivables`, `fin_receivable_reminders`, `fin_payments`, `fin_payment_applications`, `fin_status_history`, `fin_payables`, `fin_payable_payouts`, `fin_commission_rules`, `fin_commissions`, `fin_settlements`, `channel_support_tickets`, `channel_support_ticket_events`, `report_exports`

**Fase 2 · Canales y campo** (86): `ops_mobile_devices`, `ops_sync_actions`, `channel_trip_messages`, `catalog_service_cost_history`, `supplier_request_responses`, `supplier_invoices`, `supplier_rate_requests`, `fin_document_series`, `fin_invoices`, `fin_invoice_lines`, `fin_fiscal_events`, `fin_bank_statements`, `fin_reconciliation_closures`, `fin_bank_lines`, `fin_period_closes`, `fin_period_close_checks`, `channel_b2b_price_lists`, `channel_b2b_agencies`, `catalog_product_b2b_rates`, `channel_b2b_settlement_requests`, `channel_b2b_credit_movements`, `channel_b2b_credit_exceptions`, `cms_contents`, `cms_content_events`, `channel_ecom_orders`, `channel_ecom_order_lines`, `channel_ecom_passengers`, `channel_ecom_payment_attempts`, `channel_portal_access_links`, `ops_incident_pax_acks`, `channel_pax_feedback`, `collab_approval_rules`, `collab_approval_requests`, `collab_approval_steps`, `collab_approval_info_requests`, `collab_approval_events`, `collab_channel_accounts`, `collab_reply_templates`, `collab_conversations`, `collab_messages`, `collab_message_attachments`, `collab_inbound_events`, `catalog_allotments`, `catalog_allotment_days`, `catalog_allotment_consumptions`, `catalog_allotment_requests`, `catalog_allotment_charges`, `catalog_allotment_events`, `ops_travel_doc_items`, `ops_travel_doc_contacts`, `ops_travel_doc_special`, `ops_travel_doc_reminders`, `fin_treasury_accounts`, `fin_treasury_transfers`, `fin_cash_replenishments`, `fin_cash_replenishment_events`, `fin_treasury_movements`, `fin_expense_receipts`, `fin_cash_sessions`, `fin_cash_counts`, `fin_fx_revaluations`, `fin_treasury_settings`, `sys_booking_rules`, `catalog_product_rule_overrides`, `catalog_product_addons`, `catalog_accommodation_legs`, `catalog_accommodation_hotels`, `catalog_accommodation_room_types`, `catalog_payment_policies`, `catalog_pickup_points`, `booking_reservation_web_snapshots`, `booking_reservation_web_lodging`, `booking_reservation_web_addons`, `notif_pax_message_templates`, `notif_pax_messages`, `fin_currencies`, `fx_rate_providers`, `channel_widget_config`, `channel_widget_domains`, `channel_web_carts`, `channel_web_cart_items`, `channel_widget_handoffs`, `channel_wishlist_items`, `channel_web_events`, `catalog_product_translations`, `catalog_destination_contents`

  - Columnas que esta fase agrega a tablas de fases previas (`ALTER TABLE … ADD COLUMN`): booking_reservation_services (pax_detail, kind, addon_id, rooms, nights) — 15 §3.14; iam_users (provider_role, created_via, email_verified_at) — 06 §3.1 + 15 §3.10; catalog_services (scheduled_cost, scheduled_cost_from) — 10 §3.11; fin_commissions (settlement_request_id) — 08 §3.15; ops_incidents (public_title, public_message) — 08 §3.15; booking_reservations (ecom_order_id, b2b_terms, cancel_request_id) — 08 §3.15 + 10 §3.11; quote_versions (approval_request_id) — 10 §3.11; fin_payments (reversal_request_id) — 10 §3.11; fin_payables (approval_round, observation) — 10 §3.11; fin_commissions (approval_round, observation) — 10 §3.11; catalog_products (accommodation_enabled, accommodation_optional, accommodation_currency, accommodation_note, pickup_required, pickup_ask_flight, difficulty, guide_languages, pickup_text, rating_avg, rating_count) — 16 §3.6, §3.8 + 15 §3.11; booking_passengers (pending) — 15 §3.14; fin_fx_rates (provider_id, daily_change_pct, alert_raised, is_demo) — 17 §3.6 (v2.2); catalog_product_media (alt_i18n, caption_i18n, width, height, blurhash) — 15 §3.11; crm_leads (web_request, matched_client_id, sla_due_at, consent) — 15 §3.9; crm_clients (consents) — 15 §3.10

**Fase 3 · SaaS y crecimiento** (93, con las 22 del bloque v2.6 de la spec 19, las 8 del bloque v2.7 de la spec 20, las 19 del bloque v2.8 de las specs 21 y 22, las 8 del bloque v2.9 de la spec 23 y las 8 del bloque v2.10 de la spec 24 al final de la lista; las `platform_*` de la v2.8, la v2.9 y la v2.10 no tienen RLS y se protegen con REVOKE como el resto de la plataforma): `integration_api_keys`, `integration_webhooks`, `integration_webhook_deliveries`, `oauth_clients`, `integration_oauth_apps`, `mkt_contacts_subscribers`, `mkt_segments`, `mkt_templates`, `mkt_campaigns`, `mkt_consents`, `mkt_consent_events`, `mkt_campaign_tests`, `mkt_campaign_recipients`, `mkt_campaign_suppressions`, `mkt_attributions`, `mkt_automations`, `mkt_automation_runs`, `mkt_automation_enrollments`, `crm_sales_teams`, `crm_sales_team_members`, `crm_sales_targets`, `crm_sales_target_adjustments`, `crm_sales_target_policies`, `integration_review_sources`, `channel_external_reviews`, `crm_review_requests`, `crm_own_reviews`, `crm_own_review_log`, `sys_ai_requests`, `report_ai_insights`, `collab_whatsapp_templates`, `fin_payment_links`, `mkt_recovery_flows`, `mkt_recovery_attempts`, `catalog_import_jobs`, `catalog_dynamic_price_rules`, `channel_ota_connections`, `channel_ota_product_mappings`, `channel_ota_bookings`, `platform_marketplace_listings`, `platform_marketplace_partnerships`, `platform_marketplace_orders`, `fin_gift_cards`, `fin_gift_card_movements`, `ops_waiver_templates`, `ops_waiver_signatures`, `ops_checkin_passes`, `fin_account_mappings`, `fin_accounting_exports`, `quote_external_offers`, `crm_corporate_accounts`, `crm_corporate_cost_centers`, `crm_corporate_travelers`, `crm_corporate_portal_users`, `booking_corporate_approvals`, `booking_cost_allocations`, `fin_corporate_statements`, `report_corporate_exports`, `catalog_hotel_season_rates`, `catalog_leg_tours`, `catalog_transport_options`, `catalog_transport_vehicles`, `booking_trip_legs`, `booking_trip_items`, `booking_in_trip_offers`, `fin_gateway_accounts`, `fin_payment_fees`, `cms_site_domains`, `cms_seo_pages`, `cms_redirects`, `cms_travel_stories`, `platform_access_passes`, `platform_showcase_agencies`, `platform_showcase_listings`, `platform_showcase_bookings`, `platform_blog_posts`, `platform_funnel_events`, `platform_site_templates`, `platform_site_template_versions`, `platform_template_submissions`, `platform_ai_credit_packs`, `cms_site_themes`, `cms_ai_content_jobs`, `cms_ai_images`, `fin_ai_credit_ledger`, `platform_tracking_tags`, `platform_conversion_mappings`, `platform_conversion_dispatches`, `platform_web_analytics_daily`, `mkt_tracking_tags`, `mkt_conversion_mappings`, `mkt_conversion_dispatches`, `cms_web_analytics_daily`

  - Columnas que esta fase agrega a tablas de fases previas (`ALTER TABLE … ADD COLUMN`): catalog_product_promotions (campaign_id) — 14 §3.17; channel_ecom_orders (utm_campaign) — 14 §3.17; crm_leads (utm_campaign) — 14 §3.17; fin_commissions (sales_target_id) — 14 §3.17

**Decisiones de asignación de fase** (el plan agrupa por módulo; aquí se decide por dependencia):
- `catalog_product_b2b_rates` pasa a fase 2 porque depende de `channel_b2b_agencies` (B2B es fase 2).
- `ops_assignment_checkins` queda en fase 1 (el check-in también se marca desde la web). Su FK a `ops_mobile_devices` se agrega en fase 2.
- `crm_cases` nace en fase 1 con las columnas del Libro de Reclamaciones (spec 12, fase 1). La tesorería de la misma spec va en fase 2.
- Los snapshots de reserva web (`booking_reservation_web_*`, 04 v2.1) van en fase 2 (sitio público y motor completo).
- De la spec 16, el motor básico (rangos, reglas de pasajeros, salidas, holds, temporadas y tarifas) está en fase 1. El centro de reglas, los adicionales, el alojamiento, los puntos de recojo y las políticas de pago están en fase 2.
- `fin_commissions.kind` incluye `'Bono por meta'` desde fase 1 para no reescribir el CHECK en fase 3. La columna `sales_target_id` y su CHECK se agregan en fase 3.

## 5. Row Level Security: cómo se activa

**Modelo.** Todas las tablas con `tenant_id` tienen `ENABLE` + `FORCE ROW LEVEL SECURITY` y la política:

```sql
create policy tenant_isolation on <tabla>
  using (tenant_id = app_current_tenant_id())
  with check (tenant_id = app_current_tenant_id());
-- app_current_tenant_id() = nullif(current_setting('app.tenant_id', true), '')::uuid
```

Sin contexto, la función devuelve `NULL` y la consulta devuelve **cero filas** (falla cerrado). `FORCE` aplica RLS incluso al dueño de las tablas. Las 4 tablas en modo `shared` (`roles`, `notif_templates`, `integration_adapters`, `sys_holidays`) agregan la política `tenant_shared_read FOR SELECT USING (tenant_id IS NULL)`: el tenant **lee** las filas globales pero solo **escribe** las suyas.

**Por request (middleware `SetPostgresTenant`).** Dentro de la transacción, antes de cualquier consulta:

```php
// app/Http/Middleware/SetPostgresTenant.php (esquema)
DB::beginTransaction();
DB::select("select set_config('app.tenant_id', ?, true)", [$tenantId]); // = SET LOCAL app.tenant_id
// … request …
DB::commit();
```

- Usar `set_config(…, true)` (equivale a `SET LOCAL`): el valor dura hasta el fin de la transacción. Es compatible con PgBouncer en modo transacción y con Octane. **Nunca** usar `SET` sin `LOCAL`, porque el valor quedaría pegado a la conexión.
- El tenant sale del token (`personal_access_tokens.tenant_id`) o del host. Nunca del request.
- Jobs: el middleware de job `TenantAware` serializa `tenant_id` y ejecuta `handle()` dentro de `DB::transaction()` con el mismo `set_config`.
- Scheduler multi-tenant (expirar holds, vencer cotizaciones…): recorre `tenants` con la conexión de plataforma y despacha **un job por tenant**.
- Seeders y tests: `select app_set_tenant('<uuid>')` dentro de una transacción antes de insertar, porque `FORCE` también afecta al dueño.

**Roles de base de datos** (creados como `NOLOGIN` en `90_rls.sql`; infra crea los usuarios `LOGIN … IN ROLE …`):

| Rol | Uso | Acceso |
|---|---|---|
| `app_role` | API, colas y Reverb del tenant | CRUD en tablas de negocio (con RLS). Solo lectura en catálogos de plataforma (`plans`, `features`, `plan_features`, `sys_booking_rule_catalog`…). Sin acceso a suscripciones, facturación SaaS ni medición. `tenants`: solo su fila; SELECT completo y UPDATE solo de columnas de perfil (nombre comercial, dirección, representante, logo, zona horaria, idioma, moneda alterna, correo del admin, `settings`). Plan, estado, prueba, suspensión, MRR, módulos, dominios, RUC y razón social solo los cambia `platform_role` (v2.5). |
| `platform_role` | `App\Domain\Platform\*` (Super Admin, facturación SaaS, jobs multi-tenant) | Política `platform_access` en todas las tablas con RLS. No usa `BYPASSRLS`, así que funciona en RDS/Cloud SQL. |

**Excepciones sin RLS** (tienen `tenant_id` como dato): las tablas de plataforma `tenant_onboarding`, `feature_overrides`, `subscriptions`, `coupon_redemptions`, `platform_invoices`, `payment_methods`, `usage_counters`, `usage_monthly`, `usage_events` (spec 13 §3.1: solo `platform_role`).

**FKs con tenant (v2.5).** La validación de una FK no pasa por RLS: con FKs de una sola columna un tenant podía enlazar sus filas al id de otro tenant. `90_rls.sql` convierte cada FK entre tablas con `tenant_id NOT NULL` en `(tenant_id, col) → padre(tenant_id, id)` y agrega `UNIQUE (tenant_id, id)` en el padre (560 FKs al final de la fase 3). Las FKs hacia o desde tablas con filas globales (`roles`, `notif_templates`, `sys_scheduled_jobs`, `integration_*`, `sys_idempotency_keys`, `sys_job_runs`) se validan con el trigger `app_check_fk_tenant` (padre global o del mismo tenant). `role_has_permissions` no tiene `tenant_id` y recibe RLS por el rol: se leen los permisos de roles visibles y solo se escriben en roles propios. Al final hay una verificación que falla si queda alguna FK de una columna entre tablas de tenant. En Laravel, la migración que cierra cada fase debe ejecutar `90_rls.sql` (o su equivalente) igual que hoy.

**Resolución antes de tener contexto** (`SECURITY DEFINER`, dueño `platform_role`, devuelven lo mínimo):
- `app_resolve_access_token(token_hash)`: middleware `ResolveTenant` con token Bearer (v2.5). `personal_access_tokens` tiene RLS, por eso el tenant se resuelve y se fija **antes** de `auth:sanctum`.
- `app_resolve_tenant_by_host(host, base_domain)`: middleware `ResolveTenant` (subdominio o dominio propio).
- `app_resolve_api_key(prefix)`: API pública (fase 3). La app compara `token_hash` en tiempo constante.
- `app_resolve_widget_key(public_key)`: widget embebible (fase 2).
- `app_resolve_channel_account(channel, phone_number_id, mailbox)`: webhooks entrantes de WhatsApp o email (fase 2).

**Particiones.** RLS se define en la tabla padre. Las particiones quedan con RLS habilitada y sin políticas, así que el acceso directo a una partición devuelve cero filas.

**Integridad entre tenants.** Las FKs apuntan a `id`, por lo que no impiden, por sí solas, referenciar el id de otro tenant (las comprobaciones de FK ignoran RLS). La validación va en la app: `exists` en FormRequest siempre pasa por el global scope `BelongsToTenant`, y hay pruebas Pest de aislamiento por módulo. Hay una FK compuesta real, `(tenant_id, rule_code) → sys_booking_rules`. Si se quiere blindar más, el patrón es `UNIQUE (tenant_id, id)` en el padre + FK `(tenant_id, x_id)` en el hijo (no aplicado para no duplicar índices).

## 6. Cómo traducir a migraciones de Laravel 12

**Regla para Claude Code:** antes de crear o modificar una migración, leer la definición de la tabla en `database/*.sql` (buscar `create table <tabla>`, su bloque de FKs e índices y `comment on table`). La migración debe reproducir **exactamente** columnas, tipos, nulabilidad, defaults, CHECK, UNIQUE (incluidos los parciales), FKs e índices. No agregar columnas ni estados que no estén en el SQL. Si una historia necesita cambiar el modelo, **primero** se actualiza el `.sql` (y §8 si resuelve un conflicto), se revalida con `tests/validate.sh` y **después** se escribe la migración.

**Granularidad: una migración por agregado** (una tabla raíz + sus satélites, en orden de dependencia). Ejemplos:

| Fase | Migraciones sugeridas (agregados) |
|---|---|
| Plataforma/0 | `create_platform_tables` (tenants, plans, features…), `create_iam_tables` (sedes, users, mfa, invitations, access_requests), `extend_sanctum_tokens`, `create_permission_tables` (spatie publicada y adaptada), `create_audit_events`, `create_sys_tables` (sequences, idempotency, outbox, settings, documents, jobs), `create_notification_tables`, `create_integration_adapters` |
| 1 | `create_catalog_core` (types, categories, destinations, providers, services), `create_catalog_products` (+ satélites), `create_catalog_pricing` (seasons, rates, price_rules, promotions), `create_catalog_availability` (departures, holds, ranges, pax_rules), `create_crm_*`, `create_quote_*`, `create_booking_*`, `create_ops_*`, `create_fin_receivables_payments`, `create_fin_payables_commissions`, `create_portal_support`, `create_report_exports` |
| 2 | Una por módulo: extranet, facturación electrónica, conciliación, B2B, e-commerce/sitio, CMS, aprobaciones, inbox, cupos, documentos de viaje, tesorería, reglas y monedas, widget. Más migraciones `add_*_columns_to_*` para las columnas de §4 sobre tablas previas. |
| 3 | `create_integration_api_webhooks`, `create_oauth_extensions`, `create_mkt_*`, `create_sales_targets`, `create_reviews` |

**Mapeo SQL → Schema Builder:**

| SQL | Laravel |
|---|---|
| `id uuid default app_uuid_v7()` | `$table->uuid('id')->primary();` + modelo con `HasUuids` (v7). Opcional: `DB::statement('alter table x alter column id set default app_uuid_v7()')`. |
| `tenant_id uuid not null default app_current_tenant_id()` + FK | `$table->foreignUuid('tenant_id')->constrained('tenants');` + `DB::statement` para el default. Trait `BelongsToTenant` en el modelo. |
| `numeric(14,2)`, `numeric(12,6)` | `$table->decimal('amount', 14, 2)`, `$table->decimal('fx_rate', 12, 6)`. Cast `'decimal:2'` (la API devuelve el monto como string). |
| `char(3)` | `$table->char('currency', 3)` |
| `timestamptz` | `$table->timestampTz(...)`, `$table->timestampsTz()`, `$table->softDeletesTz()` |
| `varchar(n) check (status in (…))` | `$table->string('status', 30);` + `DB::statement("alter table … add constraint … check (…)")`. **No** usar `enum()`. |
| `text[]`, `uuid[]`, `char(2)[]`, `daterange`, `citext`, `inet`, `cidr[]` | `DB::statement` para la columna, o `$table->addColumn('text[]', …)` según el driver. |
| Columnas `generated always as (…) stored` | `$table->…->storedAs('expresión')`. |
| UNIQUE parcial, índices con expresión (`lower()`, `coalesce()`), GIN/GiST, `nulls not distinct` | `DB::statement('create unique index … where …')`. Copiar el nombre del SQL. |
| `EXCLUDE USING gist` | `DB::statement('alter table … add constraint ex_… exclude using gist (…)')`. |
| Triggers (`updated_at`, `lock_version`, append-only, guardas) | `DB::statement('create trigger …')`. Las funciones ya existen en la migración `0000_create_extensions_and_functions` (= archivo 00). |
| RLS | En la **misma migración** de la tabla (arquitectura §Migraciones): `DB::statement("select app_enable_tenant_rls('crm_leads', 'strict')");`. La primera migración crea roles y privilegios (bloques de `90_rls.sql`). |
| `COMMENT ON TABLE` | `$table->comment('[Spec 01 §3.2] …')` o `DB::statement`. |
| Particionadas | `DB::statement` completo (Schema Builder no soporta `PARTITION BY`) + `app_create_monthly_partitions()`. |

**Otros puntos:**
- Paquetes: publicar las migraciones de spatie/laravel-permission (teams, `team_foreign_key = tenant_id`, ids uuid), Sanctum (extender `personal_access_tokens` con las columnas de 00 §3.4) y Passport (`oauth_clients` + `tenant_id`), y ajustarlas a este SQL. Las tablas propias de Laravel (`migrations`, `cache`, `sessions`, `password_reset_tokens`, `failed_jobs`/`job_batches`) no forman parte de este esquema; créalas con sus migraciones estándar (Horizon usa Redis).
- `down()`: reversible. Borrar primero las FKs de otras tablas que apuntan a la tabla y después la tabla (las FKs cruzadas entre fases viven en la migración de la fase posterior).
- Modelos: `$casts` para jsonb (`array`), arrays de PostgreSQL (cast propio) y `encrypted` / `encrypted:array` (`mfa_secret`, `iam_mfa_factors.secret`, `collab_channel_accounts.credentials_encrypted`, `crm_cases.consumer`).
- Pest: por tabla crítica, una prueba que abre dos tenants y verifica que A no ve B **con la conexión `app_role`**. El superusuario ignora RLS, así que una prueba con superusuario no demuestra el aislamiento.

## 7. Supuestos y puntos a validar

- `sys_documents` no está definida en ninguna spec aunque 9 specs la referencian: sus columnas son un supuesto (C-12).
- También tienen columnas mínimas supuestas: `catalog_service_cost_history`, `channel_b2b_credit_exceptions`, `fin_cash_replenishment_events`, `usage_events` y `platform_metrics_daily`.
- `notif_messages.audience` usa valores supuestos (`internal, client, passenger, agency, provider`).
- `integration_api_keys.scopes` no tiene CHECK hasta cerrar el catálogo de scopes (C-56).
- Hay dos tablas de hold (`catalog_availability_holds` y `booking_inventory_holds`) y dos de cuentas bancarias (`fin_bank_accounts` y `fin_treasury_accounts`) porque así lo definen sus specs. Se recomienda unificarlas (C-22 y C-34).
- Libro de Reclamaciones: la restricción «libro solo Reclamo/Queja» queda en servicio hasta fijar los `code` del catálogo `case_type`.
- Reglas que quedan en servicio porque un CHECK no puede consultar otras tablas: «`fx_rate` obligatorio si moneda ≠ base del tenant», «al menos un Tenant Admin activo», capacidad de habitación por tipo y ciclo en el árbol de destinos (el trigger valida solo el nivel).

**No se crean como tablas** (son vistas o read models que se implementarán en su historia): `supplier_v_*` (06), `ops_resource_occupations` (05), `catalog_allotment_days_v` (11), `rpt_monthly_sales`, `rpt_seller_performance`, `rpt_funnel`, `rpt_sales_by_channel` (09), `mkt_contacts_v`, `crm_target_progress` (14), `plan_rules_v` (13), `fin_treasury_balances` (12) y `channel_web_funnel_daily` (15). Si son vistas, crearlas con `WITH (security_invoker = true)` para que respeten RLS.

**Tampoco se crean, por decisión de spec o por deduplicación:** `catalog_packages`, `catalog_package_items`, `catalog_product_tags` (02 los descarta), `catalog_product_departure_assignments` (reservada), `cms_content_channels` (recomendación futura de 08) y `collab_conversation_reads` (alternativa de 10). Los alias resueltos a otra tabla están en §8: `audit_logs`, `notif_notifications`, `booking_services`, `booking_pax_feedback`, `crm_claims`, `crm_claim_events`, `catalog_departures`, `catalog_promotions`, `catalog_product_rates`, `catalog_service_rates`, `supplier_providers`, `iam_branches`, `sys_fx_rates`, `booking_lodging_rooms`, `booking_addons`, `catalog_product_configs` y `platform_booking_rule_templates`.

## 8. Reporte de conflictos resueltos

Criterio: **(1)** la spec dueña de la tabla fija el nombre y las columnas base; **(2)** las columnas de otras specs se unen; **(3)** los CHECK de estado son la unión de valores; **(4)** entre versiones, se aplica la más reciente (v2.1/v2.2); **(5)** todo lo no definido se marca como supuesto.

| # | Tabla | Specs | Conflicto | Resolución |
|---|---|---|---|---|
| C-01 | `plans` | 09 §3.1 / 13 §3.2 | 09 usa PK `id varchar(30)` (`starter`…), `price_monthly`, `max_users`, `max_sedes`, `max_storage_gb` y estados `activo/inactivo`; 13 usa `id uuid` + `code`, `price_month/price_year`, límites en `plan_limits` y estados `active/hidden/retired`. | Se adopta 13 (dueño de planes, cumple CONVENCIONES uuid). Límites → `plan_limits`; se conservan `support_level` y `module_count` de 09. FKs de 09 (`tenants.plan_id`, `plan_channels.min_plan_id`) pasan a uuid. |
| C-02 | `plan_features` | 09 §3.2 / 13 §3.4 | 09: `id uuid`, `plan_id varchar(30)`, valores `included/not_included/basico`; 13: PK (plan_id, feature_key) con FK a `features`, valores `on/off/basic`. | Se adopta 13 (PK compuesta + FK a `features`); `value varchar(30)` admite ambos vocabularios, se conserva `label` de 09. Semilla: usar `on/off/<nivel>` (13). |
| C-03 | `tenants` | 08 §3.15 / 09 §3.4 / 15 §3.13 | 08 lee `tenants.settings` (hold_minutes, fx…); 15 resuelve por `tenants.domain`; 09 define `custom_domain` y la configuración en `sys_settings`. | Se usa `custom_domain` (09). La configuración vive en `sys_settings` (09); `tenants.settings jsonb` queda solo como caché/compatibilidad (supuesto). |
| C-04 | `sys_booking_rule_catalog` | 16 §3.1 / 17 §3.1 | 16 llama al catálogo `platform_booking_rule_templates`; 17 y 13 lo llaman `sys_booking_rule_catalog`. | Se crea una sola tabla `sys_booking_rule_catalog` (nombre usado por 13 y 17). |
| C-05 | `permissions` | 00 §3.5 | spatie crea `permissions.id` bigint. | Se usa `uuid` (config `permission.column_names` + modelos con `HasUuids`) para cumplir CONVENCIONES. |
| C-06 | `iam_sedes` | 14 §3.14 | 14 menciona `iam_branches` y `branch_id`. | Se usa `iam_sedes` / `sede_id` (00, 09, 12). |
| C-07 | `iam_users` | 00 §3.2 / 08 §3.15 | 08 nombra `crm_client_id` el vínculo del usuario externo con el cliente; 00 lo llama `client_id`. | Se usa `client_id` (00, dueño de la tabla). |
| C-08 | `personal_access_tokens` | 00 §3.4 / 00 §3.11 | 00 §3.11 exige RLS en toda tabla con `tenant_id`, pero el token se busca antes de fijar `app.tenant_id` (es la única fuente del tenant). v2.5: con RLS estricta. La búsqueda previa al contexto usa `app_resolve_access_token(hash)` (SECURITY DEFINER); orden de middleware `ResolveTenant → SetPostgresTenant → auth:sanctum`. |
| C-09 | `audit_events` | 00 §3.6 / 01, 05, 12 (`audit_logs`) | 01 §3.12, 05 §3 y 12 §3.6 referencian `audit_logs`. | Tabla única `audit_events` (00, dueño transversal). `audit_logs` no existe. |
| C-10 | `sys_settings` | 09 §3.8 / 11 §3.10 / 17 §3.3, §3.6 / 18 §3.4 | 09 fija el CHECK de `section` en 6 valores; 11 usa clave `travel_docs`, 17 `ecommerce` y `rule_template_applied`, 18 `own_reviews`. | CHECK ampliado: `general, currency, policies, operations, channels, notifications, travel_docs, ecommerce, own_reviews, rules` (`rule_template_applied` va dentro de `rules`). |
| C-11 | `notif_messages` | 01 §3.12 / 05 §3.14 / 09 §3.12 | 05 referencia `notif_notifications` con `reservation_id` y `audience = passenger`; 01 pide `client_id`, `related_type`, `related_id`. | Tabla única `notif_messages` (09). Se agregan `client_id`, `reservation_id` y `audience` (valores supuestos: internal, client, passenger, agency, provider); `related_type/related_id` = `source_type/source_id`. |
| C-12 | `sys_documents` | CONVENCIONES §5 / 03, 05, 06, 07, 11 | Tabla referenciada por varias specs como FK pero sin definición de columnas. | Supuesto: columnas mínimas (tipo, entidad, versión, ruta S3, mime, tamaño, sha256). Validar con negocio/arquitectura. |
| C-13 | `catalog_*` | 02 §3 / CONVENCIONES §2 | CONVENCIONES pide `code varchar(30)` como correlativo; 02 usa `ref varchar(20)` (`PRD-001`, `TAR-001`…) y reserva `code`/`sku` de productos para códigos de negocio. | Se respeta 02: tablas de catálogo con `ref` UNIQUE (tenant_id, ref); `catalog_products.code` es el código de negocio UNIQUE (tenant_id, lower(code)). Tablas de 16 (rangos, adicionales, tramos) usan `code` como indica 16. |
| C-14 | `catalog_destinations` | 02 §3.3 | `path` definido como “ltree o text”. | Se usa `text` con índice `text_pattern_ops` (búsqueda por prefijo); migrable a `ltree` si se requiere. |
| C-15 | `catalog_providers` | 04 §3 (booking_services.provider_id) | 04 apunta `provider_id` a `supplier_providers`. | No existe `supplier_providers`: FK a `catalog_providers` (02, 05, 06, 07). |
| C-16 | `catalog_products` | 02 §3.6 / 08 §3.15 | 08 usa `advance_min_days`, `min_pax`, `max_pax`, `min_age`; 02 usa `booking_advance_min_days`, `minimum_passengers`, `minimum_age`. | Se usan los nombres de 02 (dueño). |
| C-17 | `catalog_product_policies` | 02 §3.7 / 04-HALLAZGOS H-10 | H-10: los tramos de penalidad se deducen del texto libre de la política. | Se agrega `penalty_tiers jsonb` (`[{days_before, penalty_pct}]`) — supuesto derivado de H-10. |
| C-18 | `catalog_product_promotions` | 02 §3.7 / 08 §3.9 / 14 §3.17 | 08 usa `code_internal`, `valid_from/valid_to`, `min_pax`, `deleted_at` y UNIQUE parcial con `deleted_at`; 02 usa `ref`, `date_from/date_to` y UNIQUE `WHERE promo_code <> ''`; 14 la llama `catalog_promotions`. | Nombres de 02 (`ref`, `date_from/date_to`) + columnas de 08 (`min_pax`, `deleted_at`, `CHECK value > 0`, UNIQUE parcial de 08). `catalog_promotions` = esta tabla. |
| C-19 | `catalog_product_config_groups` | 02 §3.7 / 15 §3.2 | 15 referencia `catalog_product_configs`. | Son `catalog_product_config_groups` + `catalog_product_config_options` (02). |
| C-20 | `catalog_rates` | 02 §3.8 / 15 §3 | 15 referencia `catalog_product_rates`. | La tabla es `catalog_rates` (02). |
| C-21 | `catalog_product_departures` | 02 §3.9 / 04, 05, 08 | 04 y 05 la llaman `catalog_departures`; 08 lista estados sin `cancelada`. | Nombre de 02 (`catalog_product_departures`); CHECK de 02 (incluye `cancelada`). |
| C-22 | `catalog_availability_holds` | 02 §3.9 / 04 §3 / 15 §3.14 | 02 exige `departure_id NOT NULL`; 15 agrega holds por rango (`product_id` + `service_date`) y `reference_type=cart`. 04 define además `booking_inventory_holds` para lo mismo desde la reserva. | `departure_id` nullable con CHECK (salida o producto+fecha). Se conservan ambas tablas de hold según sus specs; **punto a validar**: unificar en `catalog_availability_holds` (reference_type=reservation) para una sola fuente de cupos. |
| C-23 | `crm_cases` | 01 §3.10 / 12 §3.10 / 15 §3 | 12 define la tabla como `crm_claims` “extendida”, con `type` (texto) y estados `open, in_progress, resolved, closed`; 01 la define como `crm_cases` con `type_code` y estados `abierta, en_proceso, resuelta, cerrada`. 15 referencia `crm_claims`. | Tabla única `crm_cases` (01, dueño; 12 dice que extiende la tabla de casos del CRM). Estados de 01; `book_status` de 12. `type_code` del catálogo `case_type`; la restricción “libro solo Reclamo/Queja” se valida en servicio (códigos del catálogo por definir). `consumer` se guarda como `text` cifrado (`encrypted:array`), no `jsonb`, porque el cifrado de aplicación produce texto. `client_id` pasa a NULL para hojas anónimas del libro. |
| C-24 | `crm_case_events` | 01 §3.11 / 12 §3.10 | 12 usa `crm_claim_events (claim_id, ts, user_id, message)`. | Tabla única `crm_case_events` (CHECK de 01); las acciones del libro (respuesta, reenvío, cierre) se registran como `estado`/`seguimiento` con `message`. |
| C-25 | `quote_versions` | 03 §3 / CONVENCIONES §2 | La versión guarda montos pero 03 no le da columna `currency` (solo `fx_rate`). | Se agrega `currency char(3)` (regla de dinero de CONVENCIONES: monto + moneda + TC). |
| C-26 | `quote_negotiations` | 03 §3 | Columnas `by / at` (palabra reservada `by`). | Se renombran a `recorded_by` / `recorded_at`. |
| C-27 | `quote_approvals` | 03 §3 / 08 §3.15 | 03 guarda la aprobación del cliente en columnas `approval_*` de `quote_quotes`; 08 define además `quote_approvals` con evidencia (`token`, `evidence_hash`). | Se mantienen ambas: `quote_quotes.approval_*` = estado vigente; `quote_approvals` = evidencia inmutable. `token` se guarda como FK `token_id` (nunca el token en claro). |
| C-28 | `booking_reservations` | 04 §3 / 15 §3.14 / 16 §3.9 | 15 y 16 describen el snapshot web como columna `booking_reservations.booking jsonb`; 04 v2.1 lo normaliza en `booking_reservation_web_snapshots` (+ lodging, addons). | Se adopta la normalización de 04 (dueño). No se crea la columna `booking`. `total` (04 v2.1) = `total_amount`. |
| C-29 | `booking_reservation_services` | 04 §3 / 05 §3.3 / 06 / 07 / 08 / 11 / 15 | 04 la llama `booking_services` (con `cost_amount/price_amount` y estados sin `en_curso`); 05, 06, 07, 08 y 15 la llaman `booking_reservation_services` (05 con `unit_cost/unit_price`, `currency`, `fx_rate`, `requires_assignment`, `service_kind`); 11 usa `booking_services`. | Nombre `booking_reservation_services` (mayoría de specs). Columnas unidas: montos de 04 (`cost_amount/price_amount`, totales de la línea) + `currency`/`fx_rate` y columnas operativas de 05; CHECK de estados = unión (incluye `en_curso`). FK `booking_service_id` de 04/11 apuntan aquí. |
| C-30 | `booking_cancel_requests` | 04 §3 / 10 §3.11 | 10 agrega el estado `retirada`. | CHECK = unión (`pendiente, aprobada, rechazada, retirada`). |
| C-31 | `ops_drivers` | 05 §3.7 | “igual estructura base” que `ops_guides` sin listar columnas. | Se replican `code`, `user_id`, `provider_id`, `full_name`, `rating`, `phone`, `deleted_at` (sin `languages`). |
| C-32 | `ops_rooming_lists` | 05 §3.8 / §3.14b | §3.8: `hotel_provider_id NOT NULL` y UNIQUE (tenant, reserva, hotel); §3.14b (v2.1) lo vuelve nullable y cambia la unicidad. | Se aplica v2.1 (§3.14b). |
| C-33 | `ops_vouchers` | 05 §3.10 / 08 §3.15 | `issued_by` NOT NULL en 05, pero 08 emite vouchers como “Sistema”. | `issued_by` nullable (NULL = Sistema). |
| C-34 | `fin_bank_accounts` | 07 §3.8 / 12 §3.1 | 12 (Tesorería, fase 2) define `fin_treasury_accounts` (bank/petty_cash/gateway) que cubre también las cuentas bancarias. | Se mantienen ambas según sus specs. **Punto a validar**: en fase 2 migrar `fin_bank_accounts` a `fin_treasury_accounts(kind=bank)` o enlazarlas. |
| C-35 | `fin_receivables` | 07 §3.1 / 08 §3.15 / 15 §3.14 | `kind`: 07 = anticipo, saldo, cargo, ajuste, penalidad, b2b; 15 = total, adelanto, saldo, pago_posterior. 08 nombra `crm_client_id` y `paid`. El CHECK de 07 “fx_rate obligatorio si moneda ≠ base del tenant” requiere leer `tenants`. | CHECK de `kind` = unión. Se usan `client_id` y `paid_amount` (07). La obligatoriedad de `fx_rate` se valida en servicio (un CHECK no puede consultar otra tabla). |
| C-36 | `fin_payments` | 04 §3 / 07 §3.3 / 08 §3.15 | 04 lista estados sin `rechazado`; 07 y 08 lo incluyen. 08 agrega `reported_by_agency`. | CHECK = unión de 07/08; se agrega `reported_by_agency`. |
| C-37 | `fin_payable_payouts` | 07 §3.7 | No tiene columna de moneda (hereda la de la CxP). | Se respeta 07: la moneda es la de `fin_payables`; `fx_rate` obligatorio si la CxP es USD (servicio). |
| C-38 | `fin_commissions` | 07 §3.11 / 08 §3.15 / 14 §3.17 | 08 usa `beneficiary_type`/`beneficiary_id`/`base`; 07 usa `beneficiary_user_id`/`beneficiary_agency_id`/`base_amount`. 14 hace `reservation_id` NULLABLE y agrega `kind = 'Bono por meta'` (valor literal). | Nombres de 07. `reservation_id` nullable desde fase 1 y CHECK de `kind` incluye `Bono por meta` (valor exacto de 14) para no reescribir el CHECK en fase 3; `sales_target_id` se agrega en fase 3. |
| C-39 | `fin_fx_rates` | 07 §3.19 / 09 §3.9 / 17 §3.6 | Tres definiciones de histórico de TC: 07 `fin_fx_rates(rate_date, currency, buy, sell, source)` UNIQUE por día; 09 `sys_fx_rates(from_currency, to_currency, rate)`; 17 `fin_fx_rates(currency_code, rate_pen, previous_rate, …)` append-only con varios valores por día. | Tabla única `fin_fx_rates` (nombre de 07 y 17) con columnas de 17 + `buy/sell` (07) + `base_currency` (≈ `to_currency` de 09). Sin UNIQUE diario (17: append-only, vigente = último del día). `sys_fx_rates` no se crea. Columnas v2.2 de 17 (`provider_id`, `daily_change_pct`, `alert_raised`, `is_demo`) se agregan en fase 2. |
| C-40 | `ops_mobile_devices` | 05 §3.13 | El `id` lo genera el dispositivo. | Se mantiene `default app_uuid_v7()` solo como respaldo; la API inserta el id del dispositivo. |
| C-41 | `catalog_service_cost_history` | 06 §3.4 / 10 §3.11 | 06 referencia `catalog_service_rates` (no definida en ninguna spec) para la nueva vigencia al aprobar la solicitud de tarifa; 10 define `catalog_services.scheduled_cost` + `catalog_service_cost_history`. | Se crea `catalog_service_cost_history` (10) con columnas supuestas; `supplier_rate_requests.resulting_rate_id` apunta a ella. `catalog_service_rates` no se crea. |
| C-42 | `catalog_product_b2b_rates` | 02 §3.7 / 08 §3.3 | 02: `price_list varchar(80) not null`, `price`, `is_credit default false`, `valid_to not null`, UNIQUE (product_id, agency_id). 08: `price_list_id uuid FK`, `net_price`, `credit_allowed default true`, `valid_to null`, `deleted_at`, UNIQUE parcial por tenant. | Nombres de 02 (dueño: `price`, `is_credit`) + columnas de 08 (`price_list_id` FK, `deleted_at`, UNIQUE parcial). `price_list` (texto) queda nullable por compatibilidad; `valid_to` nullable (08). Tabla en fase 2 porque depende de agencias B2B. |
| C-43 | `channel_ecom_orders` | 08 §3.6 / 15 §3.3, §3.13, §3.14 | 08: `product_id`, `departure_id`, `service_date`, `pax_*` NOT NULL y `reservation_id UNIQUE`; 15: pedidos multiproducto (esas columnas pasan a NULL), estado `pago_por_validar`, y v2.1 “un pedido ⇒ N reservas” (`reservation_ids uuid[]`, sin UNIQUE en `reservation_id`). | Se aplica 15 v2.1 (lo más reciente): columnas nullables, `reservation_ids`, sin UNIQUE; CHECK de estado = unión. `access_token_hash` nullable hasta generar la confirmación. |
| C-44 | `channel_ecom_payment_attempts` | 08 §3.8 / 15 §3.6 | 08: `card_masked NOT NULL`; 15 agrega métodos sin tarjeta (transferencia, Yape, Plin). | `card_masked` nullable; resto unión de columnas. |
| C-45 | `channel_pax_feedback` | 04 §3 v2.1 / 08 §3.16 | 04 la llama `booking_pax_feedback`; 08 `channel_pax_feedback` y dice “tabla única; dueño Canales”. | Se crea `channel_pax_feedback` (prefijo del dueño). `booking_pax_feedback` no existe. |
| C-46 | `collab_conversations` | 08 §3.16 / 10 §3.6 | 08 crea conversaciones desde el feedback del pasajero con `feedback_id`; 10 no tiene esa columna. | Se agrega `feedback_id` FK a `channel_pax_feedback`. |
| C-47 | `collab_messages` | 10 §3.7 | UNIQUE (tenant_id, channel, external_message_id) pero la tabla no tiene `channel`. | Se agrega `channel` (copiado de la conversación) para poder aplicar la unicidad. |
| C-48 | `ops_travel_doc_reminders` | 11 §3.9 | UNIQUE sobre la expresión `(sent_at::date)`: `timestamptz::date` no es inmutable (depende de la zona horaria) y PostgreSQL no lo acepta en un índice. | Se agrega `sent_on date` (fecha en zona del tenant, asignada por el servicio) y el UNIQUE parcial usa esa columna. |
| C-49 | `sys_booking_rules` | 16 §3.1 / 17 §3.1 | 16: `rule_key`, `group_name`, `is_system`, `sort_order`; 17: `code`, `rule_group`, `is_custom`, `depends_on`, `min_plan`, `lock_version` y CHECK de formato. | Se adopta 17 (versión v2.2 y referida por 13); `is_custom` = NOT `is_system`; se conserva `sort_order` de 16. |
| C-50 | `catalog_product_rule_overrides` | 16 §3.2 / 17 §3.2 | 16: `rule_key`, `enabled boolean null` (null = usa tenant), `params not null default {}`; 17: `rule_code`, `disabled boolean`, `params null`. | Se adopta 17 (coherente con `sys_booking_rules.code`). FK compuesta real (tenant_id, rule_code) → `sys_booking_rules`. La restricción “regla con product_override=true” se valida en servicio/trigger. |
| C-51 | `booking_reservation_web_snapshots` | 04 §3 v2.1 / 15 §3.14 | 15 lista además `removedLines`, `totalDisplay`, `companionsPending/Due`, `altitudeDeclaration` en el snapshot. | Se agregan como columnas (unión). |
| C-52 | `booking_reservation_web_lodging` | 04 §3 v2.1 / 15 §3.14 | 15 los llama `booking_lodging_rooms` y `booking_addons`. | Nombres de 04 (`booking_reservation_web_lodging`, `booking_reservation_web_addons`). |
| C-53 | `notif_pax_messages` | 04 §3 v2.1 / 17 §3.5 | 04 inserta respuestas con `feedback_id` y `direction='saliente'`; 17 no define `feedback_id` ni el CHECK de `direction` (“canales.js registra también respuestas”). | Se agrega `feedback_id` FK y CHECK `direction IN (saliente, entrante)` (supuesto para respuestas). |
| C-54 | `channel_web_events` | 15 §3.8 / CONVENCIONES §2 | PK `bigint identity` en lugar de uuid. | Se respeta 15 (alto volumen); PK compuesta (id, occurred_at) por el particionado. `client_id` sin FK (evento de analítica). |
| C-55 | `catalog_product_media` | 02 §3.7 / 15 §3.11 | 15 redefine la galería con `position`, `storage_key`, `alt_i18n`…; 02 usa `sort_order`, `storage_path`, `alt_text`. | Se conservan columnas de 02 y se agregan las nuevas de 15 (`alt_i18n`, `caption_i18n`, `width`, `height`, `blurhash`). `position`=`sort_order`, `storage_key`=`storage_path`. |
| C-56 | `integration_api_keys` | 13 §3.11 | `CHECK scopes <@ ARRAY[...catálogo]`: el catálogo de scopes no está enumerado en §3. | Se deja sin CHECK de scopes (validación en FormRequest) hasta cerrar el catálogo. |
| C-57 | `oauth_clients` | 13 §3.14 | Tabla del paquete Passport; 13 solo indica que se extiende con `tenant_id` (RLS). | Se definen columnas de Passport 13 (uuid) + `tenant_id`. El resto de tablas de Passport (tokens, códigos) las crea el paquete. |
| C-58 | `integration_oauth_apps` | 13 §3.14 | `status` sin valores definidos. | Supuesto: `active`, `revoked`. |
| C-59 | `mkt_contacts_subscribers` | 14 §3.1 / 15 §4.6 | 15 describe estados del suscriptor `activo ↔ baja`; 14 no define columna de estado (la baja = `deleted_at` / consentimiento revocado). | Sin columna `status`; baja = consentimiento `revocado` en `mkt_consents` (+ `deleted_at` para supresión ARCO). |

## 9. Validación ejecutada

- PostgreSQL 16 (`/usr/lib/postgresql/16/bin`), cluster temporal con `initdb`. `psql -v ON_ERROR_STOP=1` sobre `00 → 01 → 10 → 20 → 30 → 40 → 90`: **sin errores**. También fase por fase con `90_rls.sql` después de cada fase: sin errores e idempotente.
- Conteos en la BD resultante (v2.10): **327 tablas** (+100 particiones), **281 con RLS**, **569 políticas** (`tenant_isolation`, `platform_access`, `tenant_shared_read`, las de `tenants` y las de `role_has_permissions`), **1 911 índices**, **997 FK** (638 compuestas con `tenant_id`), **974 CHECK**, **7 EXCLUDE**, **314 triggers**.
- `tests/smoke_test.sql`, 19/19 OK:
  - aislamiento A/B con `app_role`: sin contexto se ven 0 filas y `WITH CHECK` bloquea escribir en otro tenant;
  - modo `shared`;
  - `platform_role` ve todos los tenants;
  - `app_role` sin acceso a `subscriptions`;
  - resolución por host;
  - `lock_version`, UUID v7, `audit_events` append-only y correlativo no decreciente;
  - EXCLUDE de temporadas y CHECK de estados;
  - flujo producto → tarifa → cotización → versión congelada → reserva (idempotencia de conversión) → CxC;
  - v2.5: FK compuesta que impide referencias entre tenants, `tenants` solo con columnas de perfil y `personal_access_tokens` con RLS;
  - v2.7: portal corporativo con aislamiento, FK compuesta hacia `crm_clients` y CHECKs de aprobador y saldo del estado de cuenta;
  - v2.8: tramos del viaje y ventas en ruta con aislamiento, EXCLUDE de temporadas de hotel, CHECK de noches mínimas y máximas, neto de la comisión de pasarela y `platform_funnel_events` de solo inserción;
  - v2.9: versión de plantilla publicada con Lighthouse bajo rechazada por CHECK, un solo tema activo por tenant, libro de créditos de IA de solo inserción y aislamiento de tema y créditos entre tenants;
  - v2.10: ID de etiqueta con formato inválido, script externo sin SRI, etiqueta de la vitrina activa sin aprobación, script del tenant activo sin aprobación o habilitado en el pago rechazados por CHECK; conversión duplicada por `event_id` rechazada; visitas con más visitantes que visitas rechazadas y aislamiento de etiquetas y visitas entre tenants.
- `schema.dbml` y los 5 DBML por fase se parsean sin errores con `@dbml/core`.
