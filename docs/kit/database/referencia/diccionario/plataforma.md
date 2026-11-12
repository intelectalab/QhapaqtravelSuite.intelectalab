# Diccionario de datos · Plataforma SaaS

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.15 tras cargar `00`→`90`. No editar a mano._

Planes, tenants, suscripciones, facturación SaaS, cupones y medición de uso (sin tenant_id de negocio).

44 tablas · 586 columnas · 69 claves foráneas. Diagrama ER: [`../er/plataforma.svg`](../er/plataforma.svg) (fuente [`../er/plataforma.mmd`](../er/plataforma.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`addon_prices`](#addon_prices) | Plataforma | plataforma | 3 | 2 | [Spec 13 §3.5] [Plataforma] Precio de add-on por plan (p. ej. extra_users). |
| [`addons`](#addons) | Plataforma | plataforma | 14 | 0 | [Spec 13 §3.5] [Plataforma] Catálogo de add-ons de suscripción. |
| [`coupon_redemptions`](#coupon_redemptions) | Plataforma | plataforma | 7 | 3 | [Spec 13 §3.9] [Plataforma] Canje de cupón por tenant. [Fase 3] |
| [`coupons`](#coupons) | Plataforma | plataforma | 13 | 1 | [Spec 13 §3.9] [Plataforma] Cupones de suscripción. [Fase 3] |
| [`feature_overrides`](#feature_overrides) | Plataforma | plataforma | 9 | 3 | [Spec 13 §3.4] [Plataforma] Excepciones de feature por tenant (Super Admin). |
| [`features`](#features) | Plataforma | plataforma | 9 | 1 | [Spec 13 §3.4] [Plataforma] Catálogo de feature flags / módulos. |
| [`payment_attempts`](#payment_attempts) | Plataforma | plataforma | 10 | 1 | [Spec 13 §3.8] [Plataforma] Intentos de cobro de facturas de plataforma (dunning). [Fase 3] |
| [`payment_methods`](#payment_methods) | Plataforma | plataforma | 12 | 1 | [Spec 13 §3.7] [Plataforma] Medios de pago del tenant para la suscripción (solo token). [Fase 3] |
| [`plan_channels`](#plan_channels) | Plataforma | plataforma | 5 | 1 | [Spec 09 §3.3] [Plataforma] Canal mínimo por plan (CHANNELS del prototipo). |
| [`plan_features`](#plan_features) | Plataforma | plataforma | 4 | 2 | [Spec 13 §3.4 + 09 §3.2] [Plataforma] Matriz plan × feature (entitlements). |
| [`plan_limits`](#plan_limits) | Plataforma | plataforma | 4 | 1 | [Spec 13 §3.3] [Plataforma] Límites por plan y métrica (NULL = ilimitado). |
| [`plan_rule_entitlements`](#plan_rule_entitlements) | Plataforma | plataforma | 5 | 2 | [Spec 13 §3.4 (v2.2)] [Plataforma] Plan mínimo que incluye cada regla del motor (DEMO editable). |
| [`plans`](#plans) | Plataforma | plataforma | 16 | 0 | [Spec 13 §3.2 + 09 §3.1] [Plataforma] Planes comerciales (Starter/Professional/Enterprise). |
| [`platform_credit_notes`](#platform_credit_notes) | Plataforma | plataforma | 10 | 2 | [Spec 13 §3.8] [Plataforma] Notas de crédito de plataforma (serie NQ01). [Fase 3] |
| [`platform_invoice_lines`](#platform_invoice_lines) | Plataforma | plataforma | 7 | 1 | [Spec 13 §3.8] [Plataforma] Líneas de factura de plataforma. [Fase 3] |
| [`platform_invoices`](#platform_invoices) | Plataforma | plataforma | 33 | 2 | [Spec 13 §3.8] [Plataforma] Facturas de plataforma (emisor KipuControl Cloud). [Fase 3] |
| [`platform_metrics_daily`](#platform_metrics_daily) | Plataforma | plataforma | 11 | 0 | [Spec 13 §3.1] [Plataforma] Snapshot diario de MRR/ARR/churn. [Fase 3] (supuesto: columnas) |
| [`platform_sequences`](#platform_sequences) | Plataforma | plataforma | 6 | 0 | [Spec 13 §3.8] [Plataforma] Correlativos globales de plataforma (series FQ01/NQ01, TNT-, SUB-). |
| [`platform_users`](#platform_users) | Plataforma | plataforma | 11 | 0 | [Spec 00 §3.1] [Plataforma] Usuarios de plataforma (Super Admin). Guard `platform`; nunca tienen filas en iam_users. |
| [`subscription_changes`](#subscription_changes) | Plataforma | plataforma | 14 | 4 | [Spec 13 §3.6] [Plataforma] Cambios de plan/ciclo/add-on (programados o aplicados). [Fase 3] |
| [`subscription_items`](#subscription_items) | Plataforma | plataforma | 14 | 2 | [Spec 13 §3.6] [Plataforma] Add-ons contratados en la suscripción. [Fase 3] |
| [`subscriptions`](#subscriptions) | Plataforma | plataforma | 30 | 3 | [Spec 13 §3.6] [Plataforma] Suscripción del tenant a un plan. [Fase 3] |
| [`tenant_onboarding`](#tenant_onboarding) | Plataforma | plataforma | 8 | 2 | [Spec 09 §3.5] [Plataforma] Snapshot del asistente de alta PROC-001. |
| [`tenants`](#tenants) | Plataforma | plataforma | 32 | 2 | [Spec 09 §3.4] [Plataforma] Tenant (agencia). Raíz del aislamiento; RLS propia: una fila visible = la del contexto. |
| [`usage_counters`](#usage_counters) | Plataforma | plataforma | 4 | 1 | [Spec 13 §3.10] [Plataforma] Contadores diarios de uso por tenant (particionada por mes). [Fase 3] |
| [`usage_events`](#usage_events) | Plataforma | plataforma | 7 | 1 | [Spec 13 §9 (fallback)] [Plataforma] Fallback de medición cuando Redis no está disponible. [Fase 3] (supuesto: columnas mínimas) |
| [`usage_monthly`](#usage_monthly) | Plataforma | plataforma | 7 | 1 | [Spec 13 §3.10] [Plataforma] Uso mensual consolidado y alertas 80/100 %. [Fase 3] |
| [`platform_access_passes`](#platform_access_passes) | Fase 3 · SaaS y crecimiento | sin RLS | 17 | 4 | [Spec 22 §3.7] [Fase 3] Pase Básico de hasta 60 días con funciones elegidas por el Super Admin; uno activo por tenant. |
| [`platform_ai_credit_packs`](#platform_ai_credit_packs) | Fase 3 · SaaS y crecimiento | sin RLS | 12 | 0 | [Spec 23 §3.4] [Fase 3] Paquetes de créditos de IA para contenido e imágenes, de pago único o mensual. |
| [`platform_blog_posts`](#platform_blog_posts) | Fase 3 · SaaS y crecimiento | sin RLS | 19 | 1 | [Spec 22 §3.11] [Fase 3] Artículos del blog SEO de la vitrina, enlazados a tours publicados. |
| [`platform_conversion_dispatches`](#platform_conversion_dispatches) | Fase 3 · SaaS y crecimiento | sin RLS | 14 | 2 | [Spec 24 §3.3] [Fase 3] Registro de cada conversión enviada (navegador o servidor) con resultado, reintentos y deduplicación por event_id. Retención 90 días. |
| [`platform_conversion_mappings`](#platform_conversion_mappings) | Fase 3 · SaaS y crecimiento | sin RLS | 10 | 1 | [Spec 24 §3.2] [Fase 3] Qué evento interno de la vitrina se envía a cada etiqueta, con nombre del proveedor, etiqueta de conversión de Google Ads y envío del la |
| [`platform_funnel_events`](#platform_funnel_events) | Fase 3 · SaaS y crecimiento | sin RLS | 8 | 3 | [Spec 22 §3.12] [Fase 3] Eventos del embudo de captación de agencias (visita, reserva, registro, pase, plan). Append-only. |
| [`platform_marketplace_listings`](#platform_marketplace_listings) | Fase 3 · SaaS y crecimiento | sin RLS | 16 | 1 | [Spec 19 §3.7] [Fase 3] Productos publicados por un tenant en el marketplace B2B (tabla de plataforma). |
| [`platform_marketplace_orders`](#platform_marketplace_orders) | Fase 3 · SaaS y crecimiento | sin RLS | 16 | 4 | [Spec 19 §3.7] [Fase 3] Ventas entre tenants por el marketplace; crean la reserva en el vendedor y en el revendedor. |
| [`platform_marketplace_partnerships`](#platform_marketplace_partnerships) | Fase 3 · SaaS y crecimiento | sin RLS | 13 | 2 | [Spec 19 §3.7] [Fase 3] Alianzas vendedor ↔ revendedor con comisión y tarifa de plataforma. |
| [`platform_showcase_agencies`](#platform_showcase_agencies) | Fase 3 · SaaS y crecimiento | sin RLS | 17 | 1 | [Spec 22 §3.8] [Fase 3] Agencias que publican en la vitrina gratuita (con o sin tenant en KipuControl). |
| [`platform_showcase_bookings`](#platform_showcase_bookings) | Fase 3 · SaaS y crecimiento | sin RLS | 20 | 1 | [Spec 22 §3.10] [Fase 3] Reservas de la vitrina con nombre y correo, y el cargo a la agencia (cupo, por asistente o comisión). |
| [`platform_showcase_listings`](#platform_showcase_listings) | Fase 3 · SaaS y crecimiento | sin RLS | 26 | 1 | [Spec 22 §3.9] [Fase 3] Tours publicados en la vitrina: free tour (propina) o de pago, con moderación. |
| [`platform_site_template_versions`](#platform_site_template_versions) | Fase 3 · SaaS y crecimiento | sin RLS | 16 | 2 | [Spec 23 §3.2] [Fase 3] Versiones semver de una plantilla con manifiesto, paquete firmado por SHA-256 y puntajes Lighthouse mínimos para publicar. |
| [`platform_site_templates`](#platform_site_templates) | Fase 3 · SaaS y crecimiento | sin RLS | 20 | 1 | [Spec 23 §3.1] [Fase 3] Catálogo de plantillas del sitio público (equipo o partner), incluidas o premium, con plantilla por defecto para nuevas agencias. |
| [`platform_template_submissions`](#platform_template_submissions) | Fase 3 · SaaS y crecimiento | sin RLS | 13 | 3 | [Spec 23 §3.3] [Fase 3] Envíos de plantillas a revisión con el resultado de las validaciones automáticas y la decisión. |
| [`platform_tracking_tags`](#platform_tracking_tags) | Fase 3 · SaaS y crecimiento | sin RLS | 26 | 2 | [Spec 24 §3.1] [Fase 3] Etiquetas de medición y publicidad de la vitrina y su blog (GA4, GTM, Google Ads, Meta Pixel, TikTok, Clarity, LinkedIn y scripts propio |
| [`platform_web_analytics_daily`](#platform_web_analytics_daily) | Fase 3 · SaaS y crecimiento | sin RLS | 18 | 1 | [Spec 24 §3.4] [Fase 3] Visitas agregadas por día de la vitrina y el blog (página, agencia, fuente, medio, campaña, dispositivo y país), sin datos personales. |

## Detalle por tabla

### `addon_prices`

[Spec 13 §3.5] [Plataforma] Precio de add-on por plan (p. ej. extra_users).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `addon_code` | `character varying(40)` | no |  | PK. FK → addons.code. |
| 2 | `plan_id` | `uuid` | no |  | PK. FK → plans.id. |
| 3 | `price` | `numeric(14,2)` | no |  |  |

**PK:** `addon_code, plan_id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `addon_code` | `addons.code` | CASCADE | `fk_addon_prices_addon_code` |
| `plan_id` | `plans.id` | CASCADE | `fk_addon_prices_plan_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `addon_prices_price_check` | `CHECK ((price >= (0)::numeric))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_addon_prices_plan_id` | `USING btree (plan_id)` |

[↑ Índice del dominio](#tablas)

### `addons`

[Spec 13 §3.5] [Plataforma] Catálogo de add-ons de suscripción.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `code` | `character varying(40)` | no |  | PK. |
| 2 | `label` | `character varying(120)` | no |  |  |
| 3 | `unit` | `character varying(30)` | sí |  |  |
| 4 | `quantity_allowed` | `boolean` | no | `false` |  |
| 5 | `price_month` | `numeric(14,2)` | sí |  |  |
| 6 | `available_plans` | `uuid[]` | no | `'{}'::uuid[]` |  |
| 7 | `included_plans` | `uuid[]` | no | `'{}'::uuid[]` |  |
| 8 | `grants` | `jsonb` | no | `'{}'::jsonb` |  |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 12 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 13 | `billing_mode` | `character varying(8)` | no | `'mensual'::character varying` | Valores: `mensual`, `unico`, `ambos`. [Agregada en `40_fase3.sql`] |
| 14 | `price_once` | `numeric(14,2)` | sí |  | [Agregada en `40_fase3.sql`] |

**PK:** `code`

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `addons_billing_mode_check` | `CHECK (((billing_mode)::text = ANY ((ARRAY['mensual'::character varying, 'unico'::character varying, 'ambos'::character varying])::text[])))` | `billing_mode`: `mensual`, `unico`, `ambos` |
| `addons_price_once_check` | `CHECK (((price_once IS NULL) OR (price_once >= (0)::numeric)))` |  |
| `ck_addons_billing_prices` | `CHECK (((((billing_mode)::text = 'mensual'::text) OR (price_once IS NOT NULL)) AND (((billing_mode)::text = 'unico'::text) OR (price_month IS NOT NULL))))` |  |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_addons_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `coupon_redemptions`

[Spec 13 §3.9] [Plataforma] Canje de cupón por tenant. [Fase 3]

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `coupon_id` | `uuid` | no |  | FK → coupons.id. |
| 3 | `tenant_id` | `uuid` | no |  | Tenant propietario de la fila (RLS). FK → subscriptions.tenant_id, tenants.id. |
| 4 | `subscription_id` | `uuid` | no |  | FK → subscriptions.id. |
| 5 | `remaining_cycles` | `smallint` | no |  |  |
| 6 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 7 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `coupon_id` | `coupons.id` | NO ACTION | `fk_coupon_redemptions_coupon_id` |
| `tenant_id, subscription_id` | `subscriptions.tenant_id, id` | NO ACTION | `fk_coupon_redemptions_subscription_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_coupon_redemptions_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_coupon_redemptions_id` | `tenant_id, id` |  | restricción |
| `uq_coupon_redemptions_coupon_id_tenant_id` | `coupon_id, tenant_id` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_coupon_redemptions_subscription_id` | `USING btree (subscription_id)` |

[↑ Índice del dominio](#tablas)

### `coupons`

[Spec 13 §3.9] [Plataforma] Cupones de suscripción. [Fase 3]

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `code` | `character varying(20)` | no |  |  |
| 3 | `type` | `character varying(10)` | no |  | Valores: `percent`, `fixed`. |
| 4 | `value` | `numeric(10,2)` | no |  |  |
| 5 | `duration_cycles` | `smallint` | no |  |  |
| 6 | `plan_ids` | `uuid[]` | no | `'{}'::uuid[]` |  |
| 7 | `max_redemptions` | `integer` | sí |  |  |
| 8 | `redeemed_count` | `integer` | no | `0` |  |
| 9 | `valid_to` | `date` | sí |  |  |
| 10 | `status` | `character varying(10)` | no | `'active'::character varying` | Valores: `active`, `inactive`. |
| 11 | `note` | `text` | sí |  |  |
| 12 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). FK → platform_users.id. |
| 13 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `created_by` | `platform_users.id` | NO ACTION | `fk_coupons_created_by` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_coupons_code` | `code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_coupons_1` | `CHECK ((((type)::text <> 'percent'::text) OR (value <= (50)::numeric)))` |  |
| `ck_coupons_2` | `CHECK (((max_redemptions IS NULL) OR (redeemed_count <= max_redemptions)))` |  |
| `coupons_code_check` | `CHECK (((code)::text ~ '^[A-Z0-9_-]{4,20}$'::text))` |  |
| `coupons_duration_cycles_check` | `CHECK (((duration_cycles >= 1) AND (duration_cycles <= 12)))` |  |
| `coupons_status_check` | `CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))` | `status`: `active`, `inactive` |
| `coupons_type_check` | `CHECK (((type)::text = ANY ((ARRAY['percent'::character varying, 'fixed'::character varying])::text[])))` | `type`: `percent`, `fixed` |
| `coupons_value_check` | `CHECK ((value > (0)::numeric))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_coupons_created_by` | `USING btree (created_by)` |

[↑ Índice del dominio](#tablas)

### `feature_overrides`

[Spec 13 §3.4] [Plataforma] Excepciones de feature por tenant (Super Admin).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no |  | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `feature_key` | `character varying(60)` | no |  | FK → features.key. |
| 4 | `value` | `boolean` | no |  |  |
| 5 | `reason` | `character varying(300)` | no |  |  |
| 6 | `valid_until` | `date` | sí |  |  |
| 7 | `granted_by` | `uuid` | no |  | FK → platform_users.id. |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `feature_key` | `features.key` | NO ACTION | `fk_feature_overrides_feature_key` |
| `granted_by` | `platform_users.id` | NO ACTION | `fk_feature_overrides_granted_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_feature_overrides_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_feature_overrides_tenant_id_feature_key` | `tenant_id, feature_key` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_feature_overrides_feature_key` | `USING btree (feature_key)` |
| `ix_feature_overrides_granted_by` | `USING btree (granted_by)` |

[↑ Índice del dominio](#tablas)

### `features`

[Spec 13 §3.4] [Plataforma] Catálogo de feature flags / módulos.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `key` | `character varying(60)` | no |  | PK. |
| 2 | `label` | `character varying(120)` | no |  |  |
| 3 | `module` | `character varying(40)` | sí |  |  |
| 4 | `kind` | `character varying(20)` | no |  | Valores: `module`, `limit`, `addon`, `beta`. |
| 5 | `addon_code` | `character varying(40)` | sí |  | FK → addons.code. |
| 6 | `routes` | `text[]` | no | `'{}'::text[]` |  |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `key`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `addon_code` | `addons.code` | NO ACTION | `fk_features_addon_code` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `features_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['module'::character varying, 'limit'::character varying, 'addon'::character varying, 'beta'::character varying])::text[])))` | `kind`: `module`, `limit`, `addon`, `beta` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_features_addon_code` | `USING btree (addon_code)` |

[↑ Índice del dominio](#tablas)

### `payment_attempts`

[Spec 13 §3.8] [Plataforma] Intentos de cobro de facturas de plataforma (dunning). [Fase 3]

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `invoice_id` | `uuid` | no |  | FK → platform_invoices.id. |
| 3 | `attempt_no` | `smallint` | no |  |  |
| 4 | `source` | `character varying(20)` | no |  | Valores: `initial`, `dunning`, `manual_retry`, `portal`, `manual_payment`. |
| 5 | `result` | `character varying(20)` | no |  | Valores: `succeeded`, `declined`, `error`. |
| 6 | `gateway_code` | `character varying(40)` | sí |  |  |
| 7 | `message` | `character varying(300)` | sí |  |  |
| 8 | `idempotency_key` | `character varying(80)` | no |  |  |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `invoice_id` | `platform_invoices.id` | NO ACTION | `fk_payment_attempts_invoice_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_payment_attempts_idempotency_key` | `idempotency_key` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `payment_attempts_result_check` | `CHECK (((result)::text = ANY ((ARRAY['succeeded'::character varying, 'declined'::character varying, 'error'::character varying])::text[])))` | `result`: `succeeded`, `declined`, `error` |
| `payment_attempts_source_check` | `CHECK (((source)::text = ANY ((ARRAY['initial'::character varying, 'dunning'::character varying, 'manual_retry'::character varying, 'portal'::character varying, 'manual_payment'::character varying])::text[])))` | `source`: `initial`, `dunning`, `manual_retry`, `portal`, `manual_payment` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_payment_attempts_invoice_id_created_at` | `USING btree (invoice_id, created_at)` |

[↑ Índice del dominio](#tablas)

### `payment_methods`

[Spec 13 §3.7] [Plataforma] Medios de pago del tenant para la suscripción (solo token). [Fase 3]

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no |  | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `gateway_token` | `character varying(120)` | no |  |  |
| 4 | `brand` | `character varying(20)` | sí |  |  |
| 5 | `last4` | `character(4)` | sí |  |  |
| 6 | `exp_month` | `smallint` | sí |  |  |
| 7 | `exp_year` | `smallint` | sí |  |  |
| 8 | `holder` | `character varying(120)` | sí |  |  |
| 9 | `is_default` | `boolean` | no | `false` |  |
| 10 | `status` | `character varying(20)` | no | `'active'::character varying` | Valores: `active`, `expired`, `removed`. |
| 11 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_payment_methods_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_payment_methods_tenant_id_p` | `tenant_id` | `is_default` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `payment_methods_status_check` | `CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'expired'::character varying, 'removed'::character varying])::text[])))` | `status`: `active`, `expired`, `removed` |

[↑ Índice del dominio](#tablas)

### `plan_channels`

[Spec 09 §3.3] [Plataforma] Canal mínimo por plan (CHANNELS del prototipo).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `channel_key` | `character varying(30)` | no |  | PK. |
| 2 | `label` | `character varying(80)` | no |  |  |
| 3 | `min_plan_id` | `uuid` | no |  | FK → plans.id. |
| 4 | `description` | `character varying(200)` | no |  |  |
| 5 | `depends_on_integration` | `character varying(30)` | sí |  |  |

**PK:** `channel_key`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `min_plan_id` | `plans.id` | NO ACTION | `fk_plan_channels_min_plan_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_plan_channels_min_plan_id` | `USING btree (min_plan_id)` |

[↑ Índice del dominio](#tablas)

### `plan_features`

[Spec 13 §3.4 + 09 §3.2] [Plataforma] Matriz plan × feature (entitlements).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `plan_id` | `uuid` | no |  | PK. FK → plans.id. |
| 2 | `feature_key` | `character varying(60)` | no |  | PK. FK → features.key. |
| 3 | `value` | `character varying(30)` | no |  |  |
| 4 | `label` | `character varying(120)` | sí |  |  |

**PK:** `plan_id, feature_key`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `feature_key` | `features.key` | CASCADE | `fk_plan_features_feature_key` |
| `plan_id` | `plans.id` | CASCADE | `fk_plan_features_plan_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_plan_features_feature_key` | `USING btree (feature_key)` |

[↑ Índice del dominio](#tablas)

### `plan_limits`

[Spec 13 §3.3] [Plataforma] Límites por plan y métrica (NULL = ilimitado).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `plan_id` | `uuid` | no |  | PK. FK → plans.id. |
| 2 | `metric` | `character varying(30)` | no |  | PK. Valores: `users`, `sedes`, `storage_gb`, `reservations_month`, `whatsapp_month`, `email_month`, `api_calls_month`, `api_rate_per_min`, `webhooks`, `api_keys`. |
| 3 | `value` | `bigint` | sí |  |  |
| 4 | `hard` | `boolean` | no | `true` |  |

**PK:** `plan_id, metric`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `plan_id` | `plans.id` | CASCADE | `fk_plan_limits_plan_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `plan_limits_metric_check` | `CHECK (((metric)::text = ANY ((ARRAY['users'::character varying, 'sedes'::character varying, 'storage_gb'::character varying, 'reservations_month'::character varying, 'whatsapp_month'::character varying, 'email_month'::character varying, 'api_calls_month'::character varying, 'api_rate_per_min'::character varying, 'webhooks'::character varying, 'api_keys'::character varying])::text[])))` | `metric`: `users`, `sedes`, `storage_gb`, `reservations_month`, `whatsapp_month`, `email_month`, `api_calls_month`, `api_rate_per_min`, `webhooks`, `api_keys` |

[↑ Índice del dominio](#tablas)

### `plan_rule_entitlements`

[Spec 13 §3.4 (v2.2)] [Plataforma] Plan mínimo que incluye cada regla del motor (DEMO editable).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `rule_code` | `character varying(40)` | no |  | PK. FK → sys_booking_rule_catalog.code. |
| 2 | `min_plan` | `character varying(20)` | no |  | Valores: `Starter`, `Professional`, `Enterprise`. |
| 3 | `is_demo` | `boolean` | no | `true` |  |
| 4 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). FK → platform_users.id. |
| 5 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `rule_code`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `rule_code` | `sys_booking_rule_catalog.code` | CASCADE | `fk_plan_rule_entitlements_rule_code` |
| `updated_by` | `platform_users.id` | NO ACTION | `fk_plan_rule_entitlements_updated_by` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `plan_rule_entitlements_min_plan_check` | `CHECK (((min_plan)::text = ANY ((ARRAY['Starter'::character varying, 'Professional'::character varying, 'Enterprise'::character varying])::text[])))` | `min_plan`: `Starter`, `Professional`, `Enterprise` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_plan_rule_entitlements_updated_by` | `USING btree (updated_by)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_plan_rule_entitlements_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `plans`

[Spec 13 §3.2 + 09 §3.1] [Plataforma] Planes comerciales (Starter/Professional/Enterprise).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `code` | `character varying(30)` | no |  |  |
| 3 | `name` | `character varying(60)` | no |  |  |
| 4 | `rank` | `smallint` | no |  |  |
| 5 | `price_month` | `numeric(14,2)` | no |  |  |
| 6 | `price_year` | `numeric(14,2)` | no |  |  |
| 7 | `currency` | `character(3)` | no | `'PEN'::bpchar` |  |
| 8 | `trial_days` | `smallint` | no | `14` |  |
| 9 | `support_level` | `character varying(80)` | sí |  |  |
| 10 | `module_count` | `smallint` | sí |  |  |
| 11 | `status` | `character varying(30)` | no | `'active'::character varying` | Valores: `active`, `hidden`, `retired`. |
| 12 | `gateway_price_ids` | `jsonb` | sí |  |  |
| 13 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 14 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 15 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 16 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_plans_code` | `code` |  | índice único |
| `uq_plans_rank` | `rank` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_plans_1` | `CHECK ((price_year <= (price_month * (12)::numeric)))` |  |
| `plans_price_month_check` | `CHECK ((price_month >= (0)::numeric))` |  |
| `plans_status_check` | `CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'hidden'::character varying, 'retired'::character varying])::text[])))` | `status`: `active`, `hidden`, `retired` |
| `plans_trial_days_check` | `CHECK (((trial_days >= 0) AND (trial_days <= 60)))` |  |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_plans_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `platform_credit_notes`

[Spec 13 §3.8] [Plataforma] Notas de crédito de plataforma (serie NQ01). [Fase 3]

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `series` | `character(4)` | no | `'NQ01'::bpchar` |  |
| 3 | `number` | `integer` | no |  |  |
| 4 | `invoice_id` | `uuid` | no |  | FK → platform_invoices.id. |
| 5 | `reason` | `character varying(300)` | no |  |  |
| 6 | `amount` | `numeric(14,2)` | no |  |  |
| 7 | `sunat_status` | `character varying(20)` | no | `'pending'::character varying` | Valores: `pending`, `accepted`, `observed`, `rejected`. |
| 8 | `refund_ref` | `character varying(120)` | sí |  |  |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). FK → platform_users.id. |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `created_by` | `platform_users.id` | NO ACTION | `fk_platform_credit_notes_created_by` |
| `invoice_id` | `platform_invoices.id` | NO ACTION | `fk_platform_credit_notes_invoice_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_credit_notes_invoice_id` | `invoice_id` |  | índice único |
| `uq_platform_credit_notes_series_number` | `series, number` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `platform_credit_notes_sunat_status_check` | `CHECK (((sunat_status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'observed'::character varying, 'rejected'::character varying])::text[])))` | `sunat_status`: `pending`, `accepted`, `observed`, `rejected` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_credit_notes_created_by` | `USING btree (created_by)` |

[↑ Índice del dominio](#tablas)

### `platform_invoice_lines`

[Spec 13 §3.8] [Plataforma] Líneas de factura de plataforma. [Fase 3]

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `invoice_id` | `uuid` | no |  | FK → platform_invoices.id. |
| 3 | `description` | `character varying(250)` | no |  |  |
| 4 | `quantity` | `numeric(10,2)` | no | `1` |  |
| 5 | `unit_price` | `numeric(14,2)` | no |  |  |
| 6 | `amount` | `numeric(14,2)` | no |  |  |
| 7 | `line_type` | `character varying(20)` | no |  | Valores: `plan`, `addon`, `proration_charge`, `proration_credit`, `discount`, `usage_overage`. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `invoice_id` | `platform_invoices.id` | CASCADE | `fk_platform_invoice_lines_invoice_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `platform_invoice_lines_line_type_check` | `CHECK (((line_type)::text = ANY ((ARRAY['plan'::character varying, 'addon'::character varying, 'proration_charge'::character varying, 'proration_credit'::character varying, 'discount'::character varying, 'usage_overage'::character varying])::text[])))` | `line_type`: `plan`, `addon`, `proration_charge`, `proration_credit`, `discount`, `usage_overage` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_invoice_lines_invoice_id` | `USING btree (invoice_id)` |

[↑ Índice del dominio](#tablas)

### `platform_invoices`

[Spec 13 §3.8] [Plataforma] Facturas de plataforma (emisor KipuControl Cloud). [Fase 3]

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `series` | `character(4)` | no |  |  |
| 3 | `number` | `integer` | no |  |  |
| 4 | `tenant_id` | `uuid` | no |  | Tenant propietario de la fila (RLS). FK → subscriptions.tenant_id, tenants.id. |
| 5 | `subscription_id` | `uuid` | no |  | FK → subscriptions.id. |
| 6 | `kind` | `character varying(20)` | no |  | Valores: `subscription`, `proration`, `addon`, `manual`. |
| 7 | `period_from` | `date` | no |  |  |
| 8 | `period_to` | `date` | no |  |  |
| 9 | `issue_date` | `date` | no |  |  |
| 10 | `due_date` | `date` | no |  |  |
| 11 | `currency` | `character(3)` | no | `'PEN'::bpchar` |  |
| 12 | `subtotal` | `numeric(14,2)` | no |  |  |
| 13 | `igv` | `numeric(14,2)` | no |  |  |
| 14 | `total` | `numeric(14,2)` | no |  |  |
| 15 | `igv_pct` | `numeric(5,2)` | no | `18.00` |  |
| 16 | `status` | `character varying(20)` | no | `'draft'::character varying` | Valores: `draft`, `open`, `paid`, `failed`, `uncollectible`, `void`. |
| 17 | `paid_at` | `timestamp with time zone` | sí |  |  |
| 18 | `payment_ref` | `character varying(120)` | sí |  |  |
| 19 | `bill_to` | `jsonb` | no |  |  |
| 20 | `sunat_status` | `character varying(20)` | no | `'pending'::character varying` | Valores: `pending`, `accepted`, `observed`, `rejected`. |
| 21 | `sunat_hash` | `character varying(120)` | sí |  |  |
| 22 | `sunat_cdr_path` | `character varying(255)` | sí |  |  |
| 23 | `pdf_path` | `character varying(255)` | sí |  |  |
| 24 | `xml_path` | `character varying(255)` | sí |  |  |
| 25 | `dunning_failed_at` | `date` | sí |  |  |
| 26 | `dunning_retries_done` | `smallint` | no | `0` |  |
| 27 | `dunning_next_retry_at` | `timestamp with time zone` | sí |  |  |
| 28 | `dunning_extended_days` | `smallint` | no | `0` |  |
| 29 | `void_reason` | `character varying(300)` | sí |  |  |
| 30 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 31 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 32 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 33 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, subscription_id` | `subscriptions.tenant_id, id` | NO ACTION | `fk_platform_invoices_subscription_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_platform_invoices_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_platform_invoices_id` | `tenant_id, id` |  | restricción |
| `uq_platform_invoices_series_number` | `series, number` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_platform_invoices_1` | `CHECK ((total = (subtotal + igv)))` |  |
| `platform_invoices_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['subscription'::character varying, 'proration'::character varying, 'addon'::character varying, 'manual'::character varying])::text[])))` | `kind`: `subscription`, `proration`, `addon`, `manual` |
| `platform_invoices_status_check` | `CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'open'::character varying, 'paid'::character varying, 'failed'::character varying, 'uncollectible'::character varying, 'void'::character varying])::text[])))` | `status`: `draft`, `open`, `paid`, `failed`, `uncollectible`, `void` |
| `platform_invoices_sunat_status_check` | `CHECK (((sunat_status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'observed'::character varying, 'rejected'::character varying])::text[])))` | `sunat_status`: `pending`, `accepted`, `observed`, `rejected` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_invoices_dunning_next_retry_at_p` | `USING btree (dunning_next_retry_at) WHERE ((status)::text = 'failed'::text)` |
| `ix_platform_invoices_status` | `USING btree (status)` |
| `ix_platform_invoices_subscription_id` | `USING btree (subscription_id)` |
| `ix_platform_invoices_tenant_id_issue_date_desc` | `USING btree (tenant_id, issue_date DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_platform_invoices_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `platform_metrics_daily`

[Spec 13 §3.1] [Plataforma] Snapshot diario de MRR/ARR/churn. [Fase 3] (supuesto: columnas)

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `day` | `date` | no |  |  |
| 3 | `mrr` | `numeric(14,2)` | no | `0` |  |
| 4 | `arr` | `numeric(14,2)` | no | `0` |  |
| 5 | `arpa` | `numeric(14,2)` | no | `0` |  |
| 6 | `active_tenants` | `integer` | no | `0` |  |
| 7 | `new_tenants` | `integer` | no | `0` |  |
| 8 | `churned_tenants` | `integer` | no | `0` |  |
| 9 | `logo_churn_pct` | `numeric(6,3)` | sí |  |  |
| 10 | `revenue_churn_pct` | `numeric(6,3)` | sí |  |  |
| 11 | `breakdown` | `jsonb` | no | `'{}'::jsonb` |  |

**PK:** `id`

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_metrics_daily_day` | `day` |  | índice único |

[↑ Índice del dominio](#tablas)

### `platform_sequences`

[Spec 13 §3.8] [Plataforma] Correlativos globales de plataforma (series FQ01/NQ01, TNT-, SUB-).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `doc_type` | `character varying(40)` | no |  |  |
| 3 | `series` | `character varying(10)` | no | `'default'::character varying` |  |
| 4 | `prefix` | `character varying(30)` | no | `''::character varying` |  |
| 5 | `pad_width` | `smallint` | no | `5` |  |
| 6 | `next_number` | `bigint` | no | `1` |  |

**PK:** `id`

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_sequences_doc_type_series` | `doc_type, series` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `platform_sequences_next_number_check` | `CHECK ((next_number > 0))` |  |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_platform_sequences_no_decrease` | BEFORE UPDATE | `app_sequence_no_decrease` |

[↑ Índice del dominio](#tablas)

### `platform_users`

[Spec 00 §3.1] [Plataforma] Usuarios de plataforma (Super Admin). Guard `platform`; nunca tienen filas en iam_users.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `name` | `character varying(150)` | no |  |  |
| 3 | `email` | `character varying(190)` | no |  |  |
| 4 | `password` | `character varying(255)` | no |  |  |
| 5 | `mfa_secret` | `text` | no |  |  |
| 6 | `status` | `character varying(20)` | no | `'activo'::character varying` | Valores: `activo`, `inactivo`. |
| 7 | `last_login_at` | `timestamp with time zone` | sí |  |  |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 9 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 11 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_users_lower_email` | `lower((email)::text)` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `platform_users_status_check` | `CHECK (((status)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[])))` | `status`: `activo`, `inactivo` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_platform_users_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `subscription_changes`

[Spec 13 §3.6] [Plataforma] Cambios de plan/ciclo/add-on (programados o aplicados). [Fase 3]

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `subscription_id` | `uuid` | no |  | FK → subscriptions.id. |
| 3 | `kind` | `character varying(20)` | no |  | Valores: `upgrade`, `downgrade`, `cycle`, `addon_add`, `addon_update`, `addon_remove`, `cancel`, `resume`. |
| 4 | `from_plan_id` | `uuid` | sí |  | FK → plans.id. |
| 5 | `to_plan_id` | `uuid` | sí |  | FK → plans.id. |
| 6 | `from_cycle` | `character varying(10)` | sí |  |  |
| 7 | `to_cycle` | `character varying(10)` | sí |  |  |
| 8 | `effective_at` | `date` | no |  |  |
| 9 | `status` | `character varying(20)` | no | `'scheduled'::character varying` | Valores: `scheduled`, `applied`, `voided`. |
| 10 | `proration` | `jsonb` | sí |  |  |
| 11 | `invoice_id` | `uuid` | sí |  | FK → platform_invoices.id. |
| 12 | `requested_by` | `uuid` | sí |  |  |
| 13 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `from_plan_id` | `plans.id` | NO ACTION | `fk_subscription_changes_from_plan_id` |
| `invoice_id` | `platform_invoices.id` | NO ACTION | `fk_subscription_changes_invoice_id` |
| `subscription_id` | `subscriptions.id` | NO ACTION | `fk_subscription_changes_subscription_id` |
| `to_plan_id` | `plans.id` | NO ACTION | `fk_subscription_changes_to_plan_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_subscription_changes_subscription_id_p` | `subscription_id` | `((status)::text = 'scheduled'::text)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `subscription_changes_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['upgrade'::character varying, 'downgrade'::character varying, 'cycle'::character varying, 'addon_add'::character varying, 'addon_update'::character varying, 'addon_remove'::character varying, 'cancel'::character varying, 'resume'::character varying])::text[])))` | `kind`: `upgrade`, `downgrade`, `cycle`, `addon_add`, `addon_update`, `addon_remove`, `cancel`, `resume` |
| `subscription_changes_status_check` | `CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'applied'::character varying, 'voided'::character varying])::text[])))` | `status`: `scheduled`, `applied`, `voided` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_subscription_changes_from_plan_id` | `USING btree (from_plan_id)` |
| `ix_subscription_changes_invoice_id` | `USING btree (invoice_id)` |
| `ix_subscription_changes_subscription_id` | `USING btree (subscription_id)` |
| `ix_subscription_changes_to_plan_id` | `USING btree (to_plan_id)` |

[↑ Índice del dominio](#tablas)

### `subscription_items`

[Spec 13 §3.6] [Plataforma] Add-ons contratados en la suscripción. [Fase 3]

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `subscription_id` | `uuid` | no |  | FK → subscriptions.id. |
| 3 | `addon_code` | `character varying(40)` | no |  | FK → addons.code. |
| 4 | `quantity` | `smallint` | no | `1` |  |
| 5 | `meta` | `jsonb` | sí |  |  |
| 6 | `starts_at` | `date` | no |  |  |
| 7 | `ends_at` | `date` | sí |  |  |
| 8 | `unit_price` | `numeric(14,2)` | no |  |  |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 12 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 13 | `billing_mode` | `character varying(8)` | no | `'mensual'::character varying` | Valores: `mensual`, `unico`. [Agregada en `40_fase3.sql`] |
| 14 | `paid_once_at` | `timestamp with time zone` | sí |  | [Agregada en `40_fase3.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `addon_code` | `addons.code` | NO ACTION | `fk_subscription_items_addon_code` |
| `subscription_id` | `subscriptions.id` | CASCADE | `fk_subscription_items_subscription_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_subscription_items_subscription_id_addon_code_p` | `subscription_id, addon_code` | `(ends_at IS NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_subscription_items_once` | `CHECK ((((billing_mode)::text = 'mensual'::text) OR (ends_at IS NULL)))` |  |
| `subscription_items_billing_mode_check` | `CHECK (((billing_mode)::text = ANY ((ARRAY['mensual'::character varying, 'unico'::character varying])::text[])))` | `billing_mode`: `mensual`, `unico` |
| `subscription_items_quantity_check` | `CHECK ((quantity >= 1))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_subscription_items_addon_code` | `USING btree (addon_code)` |
| `ix_subscription_items_subscription_id` | `USING btree (subscription_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_subscription_items_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `subscriptions`

[Spec 13 §3.6] [Plataforma] Suscripción del tenant a un plan. [Fase 3]

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `code` | `character varying(30)` | no |  |  |
| 3 | `tenant_id` | `uuid` | no |  | Tenant propietario de la fila (RLS). FK → coupon_redemptions.tenant_id, tenants.id. |
| 4 | `plan_id` | `uuid` | no |  | FK → plans.id. |
| 5 | `cycle` | `character varying(10)` | no |  | Valores: `monthly`, `annual`. |
| 6 | `status` | `character varying(30)` | no | `'trialing'::character varying` | Valores: `trialing`, `active`, `past_due`, `cancel_scheduled`, `suspended`, `canceled`. |
| 7 | `trial_starts_at` | `date` | sí |  |  |
| 8 | `trial_ends_at` | `date` | sí |  |  |
| 9 | `trial_extended_days` | `smallint` | no | `0` |  |
| 10 | `current_period_start` | `date` | no |  |  |
| 11 | `current_period_end` | `date` | no |  |  |
| 12 | `billing_anchor_day` | `smallint` | no |  |  |
| 13 | `auto_renew` | `boolean` | no | `true` |  |
| 14 | `cancel_at` | `date` | sí |  |  |
| 15 | `cancel_survey` | `jsonb` | sí |  |  |
| 16 | `credit_balance` | `numeric(14,2)` | no | `0` |  |
| 17 | `coupon_redemption_id` | `uuid` | sí |  | FK → coupon_redemptions.id. |
| 18 | `gateway` | `character varying(20)` | no |  | Valores: `cashier_stripe`, `local_gateway`. |
| 19 | `gateway_customer_id` | `character varying(100)` | sí |  |  |
| 20 | `gateway_subscription_id` | `character varying(100)` | sí |  |  |
| 21 | `billing_ruc` | `character(11)` | no |  |  |
| 22 | `billing_name` | `character varying(200)` | no |  |  |
| 23 | `billing_address` | `character varying(200)` | no |  |  |
| 24 | `billing_ubigeo` | `character(6)` | sí |  |  |
| 25 | `billing_email` | `character varying(150)` | no |  |  |
| 26 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 27 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 28 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 29 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 30 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, coupon_redemption_id` | `coupon_redemptions.tenant_id, id` | NO ACTION | `fk_subscriptions_coupon_redemption_id` |
| `plan_id` | `plans.id` | NO ACTION | `fk_subscriptions_plan_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_subscriptions_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_subscriptions_id` | `tenant_id, id` |  | restricción |
| `uq_subscriptions_code` | `code` |  | índice único |
| `uq_subscriptions_tenant_id_p` | `tenant_id` | `((status)::text <> 'canceled'::text)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_subscriptions_1` | `CHECK ((current_period_end > current_period_start))` |  |
| `subscriptions_billing_anchor_day_check` | `CHECK (((billing_anchor_day >= 1) AND (billing_anchor_day <= 28)))` |  |
| `subscriptions_billing_ruc_check` | `CHECK ((billing_ruc ~ '^(10\|15\|17\|20)[0-9]{9}$'::text))` |  |
| `subscriptions_cycle_check` | `CHECK (((cycle)::text = ANY ((ARRAY['monthly'::character varying, 'annual'::character varying])::text[])))` | `cycle`: `monthly`, `annual` |
| `subscriptions_gateway_check` | `CHECK (((gateway)::text = ANY ((ARRAY['cashier_stripe'::character varying, 'local_gateway'::character varying])::text[])))` | `gateway`: `cashier_stripe`, `local_gateway` |
| `subscriptions_status_check` | `CHECK (((status)::text = ANY ((ARRAY['trialing'::character varying, 'active'::character varying, 'past_due'::character varying, 'cancel_scheduled'::character varying, 'suspended'::character varying, 'canceled'::character varying])::text[])))` | `status`: `trialing`, `active`, `past_due`, `cancel_scheduled`, `suspended`, `canceled` |
| `subscriptions_trial_extended_days_check` | `CHECK ((trial_extended_days <= 14))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_subscriptions_coupon_redemption_id` | `USING btree (coupon_redemption_id)` |
| `ix_subscriptions_current_period_end` | `USING btree (current_period_end)` |
| `ix_subscriptions_plan_id` | `USING btree (plan_id)` |
| `ix_subscriptions_status` | `USING btree (status)` |
| `ix_subscriptions_trial_ends_at_p` | `USING btree (trial_ends_at) WHERE ((status)::text = 'trialing'::text)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_subscriptions_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_subscriptions_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `tenant_onboarding`

[Spec 09 §3.5] [Plataforma] Snapshot del asistente de alta PROC-001.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no |  | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `payload` | `jsonb` | no |  |  |
| 4 | `permission_template` | `character varying(40)` | no |  | Valores: `estandar`, `minimo_privilegio`, `copiar_tenant`. |
| 5 | `copied_from_tenant_id` | `uuid` | sí |  | FK → tenants.id. |
| 6 | `idempotency_key` | `character varying(80)` | no |  |  |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `copied_from_tenant_id` | `tenants.id` | NO ACTION | `fk_tenant_onboarding_copied_from_tenant_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_tenant_onboarding_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tenant_onboarding_idempotency_key` | `idempotency_key` |  | índice único |
| `uq_tenant_onboarding_tenant_id` | `tenant_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `tenant_onboarding_permission_template_check` | `CHECK (((permission_template)::text = ANY ((ARRAY['estandar'::character varying, 'minimo_privilegio'::character varying, 'copiar_tenant'::character varying])::text[])))` | `permission_template`: `estandar`, `minimo_privilegio`, `copiar_tenant` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_tenant_onboarding_copied_from_tenant_id` | `USING btree (copied_from_tenant_id)` |

[↑ Índice del dominio](#tablas)

### `tenants`

[Spec 09 §3.4] [Plataforma] Tenant (agencia). Raíz del aislamiento; RLS propia: una fila visible = la del contexto.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (tenant_self: cada tenant ve su fila) · FORCE | `platform_access`, `tenant_self`, `tenant_self_update` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `code` | `character varying(20)` | no |  |  |
| 3 | `legal_name` | `character varying(200)` | no |  |  |
| 4 | `commercial_name` | `character varying(120)` | no |  |  |
| 5 | `ruc` | `character(11)` | no |  |  |
| 6 | `fiscal_address` | `character varying(250)` | no |  |  |
| 7 | `business_type` | `character varying(40)` | no |  | Valores: `Agencia de viajes minorista`, `Agencia mayorista`, `Operador turístico`, `DMC / receptivo`, `Agencia corporativa`. |
| 8 | `legal_rep` | `character varying(150)` | sí |  |  |
| 9 | `subdomain` | `character varying(30)` | no |  |  |
| 10 | `custom_domain` | `character varying(190)` | sí |  |  |
| 11 | `country` | `character varying(40)` | no | `'Perú'::character varying` |  |
| 12 | `base_currency` | `character(3)` | no | `'PEN'::bpchar` |  |
| 13 | `alt_currency` | `character(3)` | no | `'USD'::bpchar` |  |
| 14 | `timezone` | `character varying(40)` | no | `'America/Lima'::character varying` |  |
| 15 | `locale` | `character varying(10)` | no | `'es-PE'::character varying` |  |
| 16 | `logo_initials` | `character varying(3)` | no |  |  |
| 17 | `logo_path` | `character varying(255)` | sí |  |  |
| 18 | `plan_id` | `uuid` | no |  | FK → plans.id. |
| 19 | `status` | `character varying(20)` | no | `'prueba'::character varying` | Valores: `prueba`, `activo`, `suspendido`. |
| 20 | `trial_ends_at` | `timestamp with time zone` | sí |  |  |
| 21 | `suspend_reason` | `text` | sí |  |  |
| 22 | `suspended_at` | `timestamp with time zone` | sí |  |  |
| 23 | `mrr` | `numeric(14,2)` | no | `0` |  |
| 24 | `modules` | `smallint` | no | `0` |  |
| 25 | `storage_used_bytes` | `bigint` | no | `0` |  |
| 26 | `admin_email` | `character varying(190)` | no |  |  |
| 27 | `settings` | `jsonb` | no | `'{}'::jsonb` |  |
| 28 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). FK → platform_users.id. |
| 29 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 30 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 31 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 32 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `created_by` | `platform_users.id` | NO ACTION | `fk_tenants_created_by` |
| `plan_id` | `plans.id` | NO ACTION | `fk_tenants_plan_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tenants_code` | `code` |  | índice único |
| `uq_tenants_lower_custom_domain_p` | `lower((custom_domain)::text)` | `(custom_domain IS NOT NULL)` | índice único |
| `uq_tenants_ruc` | `ruc` |  | índice único |
| `uq_tenants_subdomain` | `subdomain` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_tenants_1` | `CHECK ((((status)::text <> 'suspendido'::text) OR (suspend_reason IS NOT NULL)))` |  |
| `tenants_business_type_check` | `CHECK (((business_type)::text = ANY ((ARRAY['Agencia de viajes minorista'::character varying, 'Agencia mayorista'::character varying, 'Operador turístico'::character varying, 'DMC / receptivo'::character varying, 'Agencia corporativa'::character varying])::text[])))` | `business_type`: `Agencia de viajes minorista`, `Agencia mayorista`, `Operador turístico`, `DMC / receptivo`, `Agencia corporativa` |
| `tenants_ruc_check` | `CHECK ((ruc ~ '^(10\|15\|17\|20)[0-9]{9}$'::text))` |  |
| `tenants_status_check` | `CHECK (((status)::text = ANY ((ARRAY['prueba'::character varying, 'activo'::character varying, 'suspendido'::character varying])::text[])))` | `status`: `prueba`, `activo`, `suspendido` |
| `tenants_subdomain_check` | `CHECK (((subdomain)::text ~ '^[a-z0-9-]{3,30}$'::text))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_tenants_created_by` | `USING btree (created_by)` |
| `ix_tenants_plan_id` | `USING btree (plan_id)` |
| `ix_tenants_status` | `USING btree (status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_tenants_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_tenants_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `usage_counters`

[Spec 13 §3.10] [Plataforma] Contadores diarios de uso por tenant (particionada por mes). [Fase 3]

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | Sí · `RANGE (day)` · 25 particiones (incluida DEFAULT) |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `tenant_id` | `uuid` | no |  | Tenant propietario de la fila (RLS). PK. FK → tenants.id. |
| 2 | `metric` | `character varying(30)` | no |  | PK. Valores: `users`, `sedes`, `storage_gb`, `reservations_month`, `whatsapp_month`, `email_month`, `api_calls_month`, `api_rate_per_min`, `webhooks`, `api_keys`. |
| 3 | `day` | `date` | no |  | PK. |
| 4 | `value` | `bigint` | no | `0` |  |

**PK:** `tenant_id, metric, day`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_usage_counters_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `usage_counters_metric_check` | `CHECK (((metric)::text = ANY ((ARRAY['users'::character varying, 'sedes'::character varying, 'storage_gb'::character varying, 'reservations_month'::character varying, 'whatsapp_month'::character varying, 'email_month'::character varying, 'api_calls_month'::character varying, 'api_rate_per_min'::character varying, 'webhooks'::character varying, 'api_keys'::character varying])::text[])))` | `metric`: `users`, `sedes`, `storage_gb`, `reservations_month`, `whatsapp_month`, `email_month`, `api_calls_month`, `api_rate_per_min`, `webhooks`, `api_keys` |

**Particiones:** 25 (p. ej. `usage_counters_default`, `usage_counters_y2026m01`, `usage_counters_y2026m02` …). Se crean con `app_create_monthly_partitions()`; programar un job mensual.

[↑ Índice del dominio](#tablas)

### `usage_events`

[Spec 13 §9 (fallback)] [Plataforma] Fallback de medición cuando Redis no está disponible. [Fase 3] (supuesto: columnas mínimas)

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no |  | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `metric` | `character varying(30)` | no |  |  |
| 4 | `day` | `date` | no |  |  |
| 5 | `value` | `bigint` | no | `1` |  |
| 6 | `processed_at` | `timestamp with time zone` | sí |  |  |
| 7 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_usage_events_tenant_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_usage_events_processed_at_p` | `USING btree (processed_at) WHERE (processed_at IS NULL)` |

[↑ Índice del dominio](#tablas)

### `usage_monthly`

[Spec 13 §3.10] [Plataforma] Uso mensual consolidado y alertas 80/100 %. [Fase 3]

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `tenant_id` | `uuid` | no |  | Tenant propietario de la fila (RLS). PK. FK → tenants.id. |
| 2 | `metric` | `character varying(30)` | no |  | PK. |
| 3 | `month` | `date` | no |  | PK. |
| 4 | `value` | `bigint` | no | `0` |  |
| 5 | `limit_value` | `bigint` | sí |  |  |
| 6 | `alert_80_sent_at` | `timestamp with time zone` | sí |  |  |
| 7 | `alert_100_sent_at` | `timestamp with time zone` | sí |  |  |

**PK:** `tenant_id, metric, month`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_usage_monthly_tenant_id` |

[↑ Índice del dominio](#tablas)

### `platform_access_passes`

[Spec 22 §3.7] [Fase 3] Pase Básico de hasta 60 días con funciones elegidas por el Super Admin; uno activo por tenant.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `code` | `character varying(20)` | no |  |  |
| 3 | `tenant_id` | `uuid` | no |  | Tenant propietario de la fila (RLS). FK → platform_invoices.tenant_id, tenants.id. |
| 4 | `name` | `character varying(80)` | no | `'Pase Básico 30 días'::character varying` |  |
| 5 | `starts_on` | `date` | no |  |  |
| 6 | `ends_on` | `date` | no |  |  |
| 7 | `price` | `numeric(14,2)` | no | `0` |  |
| 8 | `currency` | `character(3)` | no | `'PEN'::bpchar` |  |
| 9 | `features` | `text[]` | no |  |  |
| 10 | `reason` | `character varying(200)` | no |  |  |
| 11 | `status` | `character varying(10)` | no | `'activo'::character varying` | Valores: `activo`, `vencido`, `convertido`, `revocado`. |
| 12 | `convert_to_plan_id` | `uuid` | sí |  | FK → plans.id. |
| 13 | `source` | `character varying(12)` | no | `'consola'::character varying` | Valores: `consola`, `vitrina`, `ventas`. |
| 14 | `invoice_id` | `uuid` | sí |  | FK → platform_invoices.id. |
| 15 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). FK → platform_users.id. |
| 16 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 17 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `convert_to_plan_id` | `plans.id` | NO ACTION | `fk_platform_access_passes_convert_to_plan_id` |
| `created_by` | `platform_users.id` | NO ACTION | `fk_platform_access_passes_created_by` |
| `tenant_id, invoice_id` | `platform_invoices.tenant_id, id` | NO ACTION | `fk_platform_access_passes_invoice_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_platform_access_passes_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_access_passes_active_tenant` | `tenant_id` | `((status)::text = 'activo'::text)` | índice único |
| `uq_platform_access_passes_code` | `code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_platform_access_passes_1` | `CHECK (((ends_on > starts_on) AND ((ends_on - starts_on) <= 60)))` |  |
| `ck_platform_access_passes_2` | `CHECK (((price = (0)::numeric) OR (invoice_id IS NOT NULL) OR ((status)::text = 'revocado'::text)))` |  |
| `platform_access_passes_currency_check` | `CHECK ((currency ~ '^[A-Z]{3}$'::text))` |  |
| `platform_access_passes_features_check` | `CHECK ((cardinality(features) > 0))` |  |
| `platform_access_passes_price_check` | `CHECK ((price >= (0)::numeric))` |  |
| `platform_access_passes_source_check` | `CHECK (((source)::text = ANY ((ARRAY['consola'::character varying, 'vitrina'::character varying, 'ventas'::character varying])::text[])))` | `source`: `consola`, `vitrina`, `ventas` |
| `platform_access_passes_status_check` | `CHECK (((status)::text = ANY ((ARRAY['activo'::character varying, 'vencido'::character varying, 'convertido'::character varying, 'revocado'::character varying])::text[])))` | `status`: `activo`, `vencido`, `convertido`, `revocado` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_access_passes_convert_to_plan_id` | `USING btree (convert_to_plan_id)` |
| `ix_platform_access_passes_created_by` | `USING btree (created_by)` |
| `ix_platform_access_passes_ends_on` | `USING btree (ends_on) WHERE ((status)::text = 'activo'::text)` |
| `ix_platform_access_passes_invoice_id` | `USING btree (invoice_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_platform_access_passes_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `platform_ai_credit_packs`

[Spec 23 §3.4] [Fase 3] Paquetes de créditos de IA para contenido e imágenes, de pago único o mensual.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `code` | `character varying(30)` | no |  |  |
| 3 | `name` | `character varying(80)` | no |  |  |
| 4 | `kind` | `character varying(10)` | no |  | Valores: `contenido`, `imagenes`. |
| 5 | `credits` | `integer` | no |  |  |
| 6 | `price` | `numeric(12,2)` | no |  |  |
| 7 | `currency` | `character(3)` | no | `'PEN'::bpchar` |  |
| 8 | `billing` | `character varying(8)` | no |  | Valores: `unico`, `mensual`. |
| 9 | `addon_code` | `character varying(40)` | sí |  |  |
| 10 | `active` | `boolean` | no | `true` |  |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 12 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_ai_credit_packs_code` | `code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `platform_ai_credit_packs_billing_check` | `CHECK (((billing)::text = ANY ((ARRAY['unico'::character varying, 'mensual'::character varying])::text[])))` | `billing`: `unico`, `mensual` |
| `platform_ai_credit_packs_credits_check` | `CHECK ((credits > 0))` |  |
| `platform_ai_credit_packs_currency_check` | `CHECK ((currency ~ '^[A-Z]{3}$'::text))` |  |
| `platform_ai_credit_packs_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['contenido'::character varying, 'imagenes'::character varying])::text[])))` | `kind`: `contenido`, `imagenes` |
| `platform_ai_credit_packs_price_check` | `CHECK ((price >= (0)::numeric))` |  |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_platform_ai_credit_packs_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `platform_blog_posts`

[Spec 22 §3.11] [Fase 3] Artículos del blog SEO de la vitrina, enlazados a tours publicados.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `slug` | `character varying(160)` | no |  |  |
| 3 | `title` | `character varying(200)` | no |  |  |
| 4 | `excerpt` | `character varying(320)` | no |  |  |
| 5 | `body` | `text` | sí |  |  |
| 6 | `city` | `character varying(40)` | sí |  |  |
| 7 | `focus_keyword` | `character varying(120)` | no |  |  |
| 8 | `status` | `character varying(12)` | no | `'borrador'::character varying` | Valores: `borrador`, `en_revision`, `publicado`, `archivado`. |
| 9 | `word_count` | `integer` | no | `0` |  |
| 10 | `seo_score` | `smallint` | sí |  |  |
| 11 | `published_at` | `timestamp with time zone` | sí |  |  |
| 12 | `author_id` | `uuid` | sí |  | FK → platform_users.id. |
| 13 | `linked_listing_ids` | `uuid[]` | no | `'{}'::uuid[]` |  |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 15 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 16 | `payload_id` | `character varying(40)` | sí |  |  |
| 17 | `synced_at` | `timestamp with time zone` | sí |  |  |
| 18 | `canonical_url` | `character varying(300)` | sí |  |  |
| 19 | `noindex` | `boolean` | no | `false` |  |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `author_id` | `platform_users.id` | NO ACTION | `fk_platform_blog_posts_author_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_blog_posts_payload_id` | `payload_id` | `(payload_id IS NOT NULL)` | índice único |
| `uq_platform_blog_posts_slug` | `slug` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_platform_blog_posts_1` | `CHECK ((((status)::text <> 'publicado'::text) OR ((published_at IS NOT NULL) AND (word_count >= 800))))` |  |
| `ck_platform_blog_posts_2` | `CHECK (((payload_id IS NULL) OR (synced_at IS NOT NULL)))` |  |
| `platform_blog_posts_canonical_url_check` | `CHECK (((canonical_url IS NULL) OR ((canonical_url)::text ~ '^https://'::text)))` |  |
| `platform_blog_posts_seo_score_check` | `CHECK (((seo_score IS NULL) OR ((seo_score >= 0) AND (seo_score <= 100))))` |  |
| `platform_blog_posts_slug_check` | `CHECK (((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))` |  |
| `platform_blog_posts_status_check` | `CHECK (((status)::text = ANY ((ARRAY['borrador'::character varying, 'en_revision'::character varying, 'publicado'::character varying, 'archivado'::character varying])::text[])))` | `status`: `borrador`, `en_revision`, `publicado`, `archivado` |
| `platform_blog_posts_word_count_check` | `CHECK ((word_count >= 0))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_blog_posts_author_id` | `USING btree (author_id)` |
| `ix_platform_blog_posts_status` | `USING btree (status, published_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_platform_blog_posts_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `platform_conversion_dispatches`

[Spec 24 §3.3] [Fase 3] Registro de cada conversión enviada (navegador o servidor) con resultado, reintentos y deduplicación por event_id. Retención 90 días.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `bigint` | no | `identity (ALWAYS)` | PK. |
| 2 | `event_id` | `uuid` | no |  |  |
| 3 | `mapping_id` | `uuid` | no |  | FK → platform_conversion_mappings.id. |
| 4 | `internal_event` | `character varying(24)` | no |  |  |
| 5 | `channel` | `character varying(10)` | no |  | Valores: `navegador`, `servidor`. |
| 6 | `status` | `character varying(24)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `enviado`, `fallido`, `sin_consentimiento`, `duplicado`. |
| 7 | `attempts` | `smallint` | no | `0` |  |
| 8 | `http_status` | `smallint` | sí |  |  |
| 9 | `error` | `character varying(300)` | sí |  |  |
| 10 | `value` | `numeric(14,2)` | sí |  |  |
| 11 | `currency` | `character(3)` | sí |  |  |
| 12 | `agency_id` | `uuid` | sí |  | FK → platform_showcase_agencies.id. |
| 13 | `occurred_at` | `timestamp with time zone` | no | `now()` |  |
| 14 | `sent_at` | `timestamp with time zone` | sí |  |  |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `agency_id` | `platform_showcase_agencies.id` | NO ACTION | `fk_platform_conversion_dispatches_agency_id` |
| `mapping_id` | `platform_conversion_mappings.id` | NO ACTION | `fk_platform_conversion_dispatches_mapping_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_conversion_dispatches_event` | `event_id, mapping_id, channel` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_platform_conversion_dispatches_1` | `CHECK ((((status)::text <> 'enviado'::text) OR (sent_at IS NOT NULL)))` |  |
| `ck_platform_conversion_dispatches_2` | `CHECK ((((status)::text <> 'fallido'::text) OR (error IS NOT NULL)))` |  |
| `platform_conversion_dispatches_attempts_check` | `CHECK (((attempts >= 0) AND (attempts <= 10)))` |  |
| `platform_conversion_dispatches_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['navegador'::character varying, 'servidor'::character varying])::text[])))` | `channel`: `navegador`, `servidor` |
| `platform_conversion_dispatches_currency_check` | `CHECK (((currency IS NULL) OR (currency ~ '^[A-Z]{3}$'::text)))` |  |
| `platform_conversion_dispatches_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'enviado'::character varying, 'fallido'::character varying, 'sin_consentimiento'::character varying, 'duplicado'::character varying])::text[])))` | `status`: `pendiente`, `enviado`, `fallido`, `sin_consentimiento`, `duplicado` |
| `platform_conversion_dispatches_value_check` | `CHECK (((value IS NULL) OR (value >= (0)::numeric)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_conversion_dispatches_agency_id` | `USING btree (agency_id)` |
| `ix_platform_conversion_dispatches_mapping_id` | `USING btree (mapping_id)` |
| `ix_platform_conversion_dispatches_status` | `USING btree (status, occurred_at)` |

[↑ Índice del dominio](#tablas)

### `platform_conversion_mappings`

[Spec 24 §3.2] [Fase 3] Qué evento interno de la vitrina se envía a cada etiqueta, con nombre del proveedor, etiqueta de conversión de Google Ads y envío del lado del servidor.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tag_id` | `uuid` | no |  | FK → platform_tracking_tags.id. |
| 3 | `internal_event` | `character varying(24)` | no |  | Valores: `reserva_vitrina`, `registro_agencia`, `pase_iniciado`, `plan_pagado`, `addon_comprado`, `suscripcion_boletin`, `lectura_articulo`, `clic_whatsapp`. |
| 4 | `provider_event` | `character varying(80)` | no |  |  |
| 5 | `conversion_label` | `character varying(60)` | sí |  |  |
| 6 | `send_value` | `boolean` | no | `false` |  |
| 7 | `server_side` | `boolean` | no | `false` |  |
| 8 | `active` | `boolean` | no | `true` |  |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 10 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tag_id` | `platform_tracking_tags.id` | NO ACTION | `fk_platform_conversion_mappings_tag_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_conversion_mappings_tag_event` | `tag_id, internal_event` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `platform_conversion_mappings_internal_event_check` | `CHECK (((internal_event)::text = ANY ((ARRAY['reserva_vitrina'::character varying, 'registro_agencia'::character varying, 'pase_iniciado'::character varying, 'plan_pagado'::character varying, 'addon_comprado'::character varying, 'suscripcion_boletin'::character varying, 'lectura_articulo'::character varying, 'clic_whatsapp'::character varying])::text[])))` | `internal_event`: `reserva_vitrina`, `registro_agencia`, `pase_iniciado`, `plan_pagado`, `addon_comprado`, `suscripcion_boletin`, `lectura_articulo`, `clic_whatsapp` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_platform_conversion_mappings_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `platform_funnel_events`

[Spec 22 §3.12] [Fase 3] Eventos del embudo de captación de agencias (visita, reserva, registro, pase, plan). Append-only.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `bigint` | no | `identity (ALWAYS)` | PK. |
| 2 | `occurred_at` | `timestamp with time zone` | no | `now()` |  |
| 3 | `kind` | `character varying(20)` | no |  | Valores: `visita`, `reserva`, `registro_agencia`, `pase_iniciado`, `plan_pagado`, `addon_comprado`. |
| 4 | `agency_id` | `uuid` | sí |  | FK → platform_showcase_agencies.id. |
| 5 | `tenant_id` | `uuid` | sí |  | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 6 | `listing_id` | `uuid` | sí |  | FK → platform_showcase_listings.id. |
| 7 | `session_hash` | `character(64)` | sí |  |  |
| 8 | `utm` | `jsonb` | sí |  |  |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `agency_id` | `platform_showcase_agencies.id` | NO ACTION | `fk_platform_funnel_events_agency_id` |
| `listing_id` | `platform_showcase_listings.id` | NO ACTION | `fk_platform_funnel_events_listing_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_platform_funnel_events_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `platform_funnel_events_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['visita'::character varying, 'reserva'::character varying, 'registro_agencia'::character varying, 'pase_iniciado'::character varying, 'plan_pagado'::character varying, 'addon_comprado'::character varying])::text[])))` | `kind`: `visita`, `reserva`, `registro_agencia`, `pase_iniciado`, `plan_pagado`, `addon_comprado` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_funnel_events_agency_id` | `USING btree (agency_id)` |
| `ix_platform_funnel_events_kind_time` | `USING btree (kind, occurred_at)` |
| `ix_platform_funnel_events_listing_id` | `USING btree (listing_id)` |
| `ix_platform_funnel_events_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fk_tenant_platform_funnel_events_agency_id` | BEFORE INSERT OR UPDATE OF agency_id, tenant_id | `app_check_fk_tenant` |
| `trg_platform_funnel_events_append_only` | BEFORE DELETE OR UPDATE | `app_forbid_update_delete` |

[↑ Índice del dominio](#tablas)

### `platform_marketplace_listings`

[Spec 19 §3.7] [Fase 3] Productos publicados por un tenant en el marketplace B2B (tabla de plataforma).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `seller_tenant_id` | `uuid` | no |  | FK → tenants.id. |
| 3 | `product_ref` | `uuid` | no |  |  |
| 4 | `product_code` | `character varying(40)` | no |  |  |
| 5 | `title` | `character varying(200)` | no |  |  |
| 6 | `destination` | `character varying(120)` | sí |  |  |
| 7 | `summary` | `text` | sí |  |  |
| 8 | `currency` | `character(3)` | no |  |  |
| 9 | `from_price` | `numeric(14,2)` | sí |  |  |
| 10 | `reseller_commission_pct` | `numeric(5,2)` | no |  |  |
| 11 | `status` | `character varying(12)` | no | `'borrador'::character varying` | Valores: `borrador`, `publicado`, `pausado`, `retirado`. |
| 12 | `published_at` | `timestamp with time zone` | sí |  |  |
| 13 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 14 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 15 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 16 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `seller_tenant_id` | `tenants.id` | NO ACTION | `fk_platform_marketplace_listings_seller_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_marketplace_listings_seller_product` | `seller_tenant_id, product_ref` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `platform_marketplace_listings_from_price_check` | `CHECK (((from_price IS NULL) OR (from_price > (0)::numeric)))` |  |
| `platform_marketplace_listings_reseller_commission_pct_check` | `CHECK (((reseller_commission_pct >= (0)::numeric) AND (reseller_commission_pct <= (40)::numeric)))` |  |
| `platform_marketplace_listings_status_check` | `CHECK (((status)::text = ANY ((ARRAY['borrador'::character varying, 'publicado'::character varying, 'pausado'::character varying, 'retirado'::character varying])::text[])))` | `status`: `borrador`, `publicado`, `pausado`, `retirado` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_marketplace_listings_status_destination` | `USING btree (status, destination)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_platform_marketplace_listings_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `platform_marketplace_orders`

[Spec 19 §3.7] [Fase 3] Ventas entre tenants por el marketplace; crean la reserva en el vendedor y en el revendedor.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `code` | `character varying(30)` | no |  |  |
| 3 | `partnership_id` | `uuid` | no |  | FK → platform_marketplace_partnerships.id. |
| 4 | `listing_id` | `uuid` | no |  | FK → platform_marketplace_listings.id. |
| 5 | `seller_tenant_id` | `uuid` | no |  | FK → tenants.id. |
| 6 | `reseller_tenant_id` | `uuid` | no |  | FK → tenants.id. |
| 7 | `seller_reservation_ref` | `uuid` | sí |  |  |
| 8 | `reseller_reservation_ref` | `uuid` | sí |  |  |
| 9 | `gross_amount` | `numeric(14,2)` | no |  |  |
| 10 | `commission_amount` | `numeric(14,2)` | no |  |  |
| 11 | `platform_fee_amount` | `numeric(14,2)` | no |  |  |
| 12 | `currency` | `character(3)` | no |  |  |
| 13 | `status` | `character varying(12)` | no | `'solicitada'::character varying` | Valores: `solicitada`, `confirmada`, `rechazada`, `cancelada`, `liquidada`. |
| 14 | `idempotency_key` | `character varying(80)` | no |  |  |
| 15 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 16 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `listing_id` | `platform_marketplace_listings.id` | NO ACTION | `fk_platform_marketplace_orders_listing_id` |
| `partnership_id` | `platform_marketplace_partnerships.id` | NO ACTION | `fk_platform_marketplace_orders_partnership_id` |
| `reseller_tenant_id` | `tenants.id` | NO ACTION | `fk_platform_marketplace_orders_reseller_tenant_id` |
| `seller_tenant_id` | `tenants.id` | NO ACTION | `fk_platform_marketplace_orders_seller_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_marketplace_orders_code` | `code` |  | índice único |
| `uq_platform_marketplace_orders_reseller_idem` | `reseller_tenant_id, idempotency_key` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `platform_marketplace_orders_commission_amount_check` | `CHECK ((commission_amount >= (0)::numeric))` |  |
| `platform_marketplace_orders_gross_amount_check` | `CHECK ((gross_amount > (0)::numeric))` |  |
| `platform_marketplace_orders_platform_fee_amount_check` | `CHECK ((platform_fee_amount >= (0)::numeric))` |  |
| `platform_marketplace_orders_status_check` | `CHECK (((status)::text = ANY ((ARRAY['solicitada'::character varying, 'confirmada'::character varying, 'rechazada'::character varying, 'cancelada'::character varying, 'liquidada'::character varying])::text[])))` | `status`: `solicitada`, `confirmada`, `rechazada`, `cancelada`, `liquidada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_marketplace_orders_listing_id` | `USING btree (listing_id)` |
| `ix_platform_marketplace_orders_partnership_id` | `USING btree (partnership_id)` |
| `ix_platform_marketplace_orders_seller_tenant_id_status` | `USING btree (seller_tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_platform_marketplace_orders_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `platform_marketplace_partnerships`

[Spec 19 §3.7] [Fase 3] Alianzas vendedor ↔ revendedor con comisión y tarifa de plataforma.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `seller_tenant_id` | `uuid` | no |  | FK → tenants.id. |
| 3 | `reseller_tenant_id` | `uuid` | no |  | FK → tenants.id. |
| 4 | `status` | `character varying(12)` | no | `'solicitada'::character varying` | Valores: `solicitada`, `activa`, `rechazada`, `suspendida`, `terminada`. |
| 5 | `commission_pct` | `numeric(5,2)` | no |  |  |
| 6 | `platform_fee_pct` | `numeric(4,2)` | no | `1.00` |  |
| 7 | `credit_limit` | `numeric(14,2)` | no | `0` |  |
| 8 | `payment_terms` | `character varying(10)` | no | `'prepago'::character varying` | Valores: `prepago`, `credito`. |
| 9 | `requested_by` | `uuid` | sí |  |  |
| 10 | `decided_by` | `uuid` | sí |  |  |
| 11 | `decided_at` | `timestamp with time zone` | sí |  |  |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 13 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `reseller_tenant_id` | `tenants.id` | NO ACTION | `fk_platform_marketplace_partnerships_reseller_tenant_id` |
| `seller_tenant_id` | `tenants.id` | NO ACTION | `fk_platform_marketplace_partnerships_seller_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_marketplace_partnerships_pair` | `seller_tenant_id, reseller_tenant_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_platform_marketplace_partnerships_1` | `CHECK ((seller_tenant_id <> reseller_tenant_id))` |  |
| `platform_marketplace_partnerships_commission_pct_check` | `CHECK (((commission_pct >= (0)::numeric) AND (commission_pct <= (40)::numeric)))` |  |
| `platform_marketplace_partnerships_credit_limit_check` | `CHECK ((credit_limit >= (0)::numeric))` |  |
| `platform_marketplace_partnerships_payment_terms_check` | `CHECK (((payment_terms)::text = ANY ((ARRAY['prepago'::character varying, 'credito'::character varying])::text[])))` | `payment_terms`: `prepago`, `credito` |
| `platform_marketplace_partnerships_platform_fee_pct_check` | `CHECK (((platform_fee_pct >= (0)::numeric) AND (platform_fee_pct <= (10)::numeric)))` |  |
| `platform_marketplace_partnerships_status_check` | `CHECK (((status)::text = ANY ((ARRAY['solicitada'::character varying, 'activa'::character varying, 'rechazada'::character varying, 'suspendida'::character varying, 'terminada'::character varying])::text[])))` | `status`: `solicitada`, `activa`, `rechazada`, `suspendida`, `terminada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_marketplace_partnerships_reseller_tenant_id` | `USING btree (reseller_tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_platform_marketplace_partnerships_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `platform_showcase_agencies`

[Spec 22 §3.8] [Fase 3] Agencias que publican en la vitrina gratuita (con o sin tenant en KipuControl).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `code` | `character varying(12)` | no |  |  |
| 3 | `tenant_id` | `uuid` | sí |  | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 4 | `name` | `character varying(160)` | no |  |  |
| 5 | `slug` | `character varying(120)` | no |  |  |
| 6 | `city` | `character varying(40)` | no |  |  |
| 7 | `ruc` | `character(11)` | sí |  |  |
| 8 | `email` | `character varying(160)` | no |  |  |
| 9 | `phone` | `character varying(30)` | sí |  |  |
| 10 | `license_ref` | `character varying(60)` | sí |  |  |
| 11 | `status` | `character varying(12)` | no | `'en_revision'::character varying` | Valores: `en_revision`, `activa`, `suspendida`, `rechazada`. |
| 12 | `verified_at` | `timestamp with time zone` | sí |  |  |
| 13 | `rating` | `numeric(2,1)` | sí |  |  |
| 14 | `reviews` | `integer` | no | `0` |  |
| 15 | `marketing_opt_in` | `boolean` | no | `true` |  |
| 16 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 17 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_platform_showcase_agencies_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_showcase_agencies_code` | `code` |  | índice único |
| `uq_platform_showcase_agencies_slug` | `slug` |  | índice único |
| `uq_platform_showcase_agencies_tenant_id` | `tenant_id` | `(tenant_id IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_platform_showcase_agencies_1` | `CHECK ((((status)::text <> 'activa'::text) OR (verified_at IS NOT NULL)))` |  |
| `platform_showcase_agencies_rating_check` | `CHECK (((rating IS NULL) OR ((rating >= (1)::numeric) AND (rating <= (5)::numeric))))` |  |
| `platform_showcase_agencies_reviews_check` | `CHECK ((reviews >= 0))` |  |
| `platform_showcase_agencies_ruc_check` | `CHECK (((ruc IS NULL) OR (ruc ~ '^(10\|20)[0-9]{9}$'::text)))` |  |
| `platform_showcase_agencies_slug_check` | `CHECK (((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))` |  |
| `platform_showcase_agencies_status_check` | `CHECK (((status)::text = ANY ((ARRAY['en_revision'::character varying, 'activa'::character varying, 'suspendida'::character varying, 'rechazada'::character varying])::text[])))` | `status`: `en_revision`, `activa`, `suspendida`, `rechazada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_showcase_agencies_status` | `USING btree (status, city)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_platform_showcase_agencies_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `platform_showcase_bookings`

[Spec 22 §3.10] [Fase 3] Reservas de la vitrina con nombre y correo, y el cargo a la agencia (cupo, por asistente o comisión).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `code` | `character varying(12)` | no |  |  |
| 3 | `listing_id` | `uuid` | no |  | FK → platform_showcase_listings.id. |
| 4 | `service_date` | `date` | no |  |  |
| 5 | `start_time` | `character varying(5)` | no |  |  |
| 6 | `traveler_name` | `character varying(160)` | no |  |  |
| 7 | `traveler_email` | `citext` | no |  |  |
| 8 | `pax` | `smallint` | no |  |  |
| 9 | `language` | `character(2)` | no |  |  |
| 10 | `status` | `character varying(10)` | no | `'confirmada'::character varying` | Valores: `confirmada`, `asistio`, `no_show`, `cancelada`. |
| 11 | `amount` | `numeric(14,2)` | sí |  |  |
| 12 | `currency` | `character(3)` | no | `'PEN'::bpchar` |  |
| 13 | `commission_pct` | `numeric(5,2)` | sí |  |  |
| 14 | `fee_amount` | `numeric(14,2)` | no | `0` |  |
| 15 | `fee_basis` | `character varying(14)` | no |  | Valores: `cupo_gratis`, `por_asistente`, `comision`, `plan`. |
| 16 | `marketing_consent` | `boolean` | no | `false` |  |
| 17 | `source` | `character varying(40)` | sí |  |  |
| 18 | `cancel_token` | `character varying(40)` | no |  |  |
| 19 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 20 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `listing_id` | `platform_showcase_listings.id` | NO ACTION | `fk_platform_showcase_bookings_listing_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_showcase_bookings_cancel_token` | `cancel_token` |  | índice único |
| `uq_platform_showcase_bookings_code` | `code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_platform_showcase_bookings_1` | `CHECK (((((fee_basis)::text = 'comision'::text) = (commission_pct IS NOT NULL)) AND (((fee_basis)::text = 'comision'::text) = (amount IS NOT NULL))))` |  |
| `platform_showcase_bookings_amount_check` | `CHECK (((amount IS NULL) OR (amount > (0)::numeric)))` |  |
| `platform_showcase_bookings_commission_pct_check` | `CHECK (((commission_pct IS NULL) OR ((commission_pct >= (0)::numeric) AND (commission_pct <= (30)::numeric))))` |  |
| `platform_showcase_bookings_currency_check` | `CHECK ((currency ~ '^[A-Z]{3}$'::text))` |  |
| `platform_showcase_bookings_fee_amount_check` | `CHECK ((fee_amount >= (0)::numeric))` |  |
| `platform_showcase_bookings_fee_basis_check` | `CHECK (((fee_basis)::text = ANY ((ARRAY['cupo_gratis'::character varying, 'por_asistente'::character varying, 'comision'::character varying, 'plan'::character varying])::text[])))` | `fee_basis`: `cupo_gratis`, `por_asistente`, `comision`, `plan` |
| `platform_showcase_bookings_pax_check` | `CHECK (((pax >= 1) AND (pax <= 30)))` |  |
| `platform_showcase_bookings_start_time_check` | `CHECK (((start_time)::text ~ '^[0-2][0-9]:[0-5][0-9]$'::text))` |  |
| `platform_showcase_bookings_status_check` | `CHECK (((status)::text = ANY ((ARRAY['confirmada'::character varying, 'asistio'::character varying, 'no_show'::character varying, 'cancelada'::character varying])::text[])))` | `status`: `confirmada`, `asistio`, `no_show`, `cancelada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_showcase_bookings_email` | `USING btree (traveler_email)` |
| `ix_platform_showcase_bookings_listing_id` | `USING btree (listing_id, service_date)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_platform_showcase_bookings_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `platform_showcase_listings`

[Spec 22 §3.9] [Fase 3] Tours publicados en la vitrina: free tour (propina) o de pago, con moderación.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `code` | `character varying(12)` | no |  |  |
| 3 | `agency_id` | `uuid` | no |  | FK → platform_showcase_agencies.id. |
| 4 | `slug` | `character varying(160)` | no |  |  |
| 5 | `title` | `character varying(160)` | no |  |  |
| 6 | `city` | `character varying(40)` | no |  |  |
| 7 | `zone` | `character varying(80)` | sí |  |  |
| 8 | `theme` | `character varying(40)` | sí |  |  |
| 9 | `languages` | `text[]` | no | `'{es}'::text[]` |  |
| 10 | `start_times` | `text[]` | no |  |  |
| 11 | `duration_hours` | `numeric(4,1)` | no |  |  |
| 12 | `meeting_point` | `character varying(300)` | no |  |  |
| 13 | `model` | `character varying(8)` | no |  | Valores: `propina`, `pago`. |
| 14 | `price` | `numeric(14,2)` | no | `0` |  |
| 15 | `currency` | `character(3)` | no | `'PEN'::bpchar` |  |
| 16 | `capacity` | `smallint` | no | `20` |  |
| 17 | `highlights` | `text[]` | no | `'{}'::text[]` |  |
| 18 | `tenant_product_ref` | `uuid` | sí |  |  |
| 19 | `status` | `character varying(12)` | no | `'en_revision'::character varying` | Valores: `borrador`, `en_revision`, `publicado`, `rechazado`, `despublicado`. |
| 20 | `reject_reason` | `text` | sí |  |  |
| 21 | `featured_until` | `date` | sí |  |  |
| 22 | `rating` | `numeric(2,1)` | sí |  |  |
| 23 | `reviews` | `integer` | no | `0` |  |
| 24 | `published_at` | `timestamp with time zone` | sí |  |  |
| 25 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 26 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `agency_id` | `platform_showcase_agencies.id` | NO ACTION | `fk_platform_showcase_listings_agency_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_showcase_listings_code` | `code` |  | índice único |
| `uq_platform_showcase_listings_slug` | `slug` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_platform_showcase_listings_1` | `CHECK ((((model)::text = 'pago'::text) = (price > (0)::numeric)))` |  |
| `ck_platform_showcase_listings_2` | `CHECK ((((status)::text <> 'rechazado'::text) OR (reject_reason IS NOT NULL)))` |  |
| `ck_platform_showcase_listings_3` | `CHECK ((((status)::text <> 'publicado'::text) OR (published_at IS NOT NULL)))` |  |
| `platform_showcase_listings_capacity_check` | `CHECK (((capacity >= 1) AND (capacity <= 200)))` |  |
| `platform_showcase_listings_currency_check` | `CHECK ((currency ~ '^[A-Z]{3}$'::text))` |  |
| `platform_showcase_listings_duration_hours_check` | `CHECK (((duration_hours > (0)::numeric) AND (duration_hours <= (24)::numeric)))` |  |
| `platform_showcase_listings_languages_check` | `CHECK ((cardinality(languages) > 0))` |  |
| `platform_showcase_listings_model_check` | `CHECK (((model)::text = ANY ((ARRAY['propina'::character varying, 'pago'::character varying])::text[])))` | `model`: `propina`, `pago` |
| `platform_showcase_listings_price_check` | `CHECK ((price >= (0)::numeric))` |  |
| `platform_showcase_listings_rating_check` | `CHECK (((rating IS NULL) OR ((rating >= (1)::numeric) AND (rating <= (5)::numeric))))` |  |
| `platform_showcase_listings_reviews_check` | `CHECK ((reviews >= 0))` |  |
| `platform_showcase_listings_slug_check` | `CHECK (((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))` |  |
| `platform_showcase_listings_start_times_check` | `CHECK ((cardinality(start_times) > 0))` |  |
| `platform_showcase_listings_status_check` | `CHECK (((status)::text = ANY ((ARRAY['borrador'::character varying, 'en_revision'::character varying, 'publicado'::character varying, 'rechazado'::character varying, 'despublicado'::character varying])::text[])))` | `status`: `borrador`, `en_revision`, `publicado`, `rechazado`, `despublicado` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_showcase_listings_agency_id` | `USING btree (agency_id)` |
| `ix_platform_showcase_listings_city_status` | `USING btree (city, status, theme)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_platform_showcase_listings_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `platform_site_template_versions`

[Spec 23 §3.2] [Fase 3] Versiones semver de una plantilla con manifiesto, paquete firmado por SHA-256 y puntajes Lighthouse mínimos para publicar.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `template_id` | `uuid` | no |  | FK → platform_site_templates.id. |
| 3 | `version` | `character varying(20)` | no |  |  |
| 4 | `manifest` | `jsonb` | no |  |  |
| 5 | `bundle_path` | `character varying(300)` | no |  |  |
| 6 | `bundle_sha256` | `character(64)` | no |  |  |
| 7 | `changelog` | `text` | sí |  |  |
| 8 | `status` | `character varying(12)` | no | `'candidata'::character varying` | Valores: `candidata`, `aprobada`, `publicada`, `retirada`. |
| 9 | `lh_performance` | `smallint` | sí |  |  |
| 10 | `lh_accessibility` | `smallint` | sí |  |  |
| 11 | `lh_seo` | `smallint` | sí |  |  |
| 12 | `lh_best_practices` | `smallint` | sí |  |  |
| 13 | `approved_by` | `uuid` | sí |  | FK → platform_users.id. |
| 14 | `published_at` | `timestamp with time zone` | sí |  |  |
| 15 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 16 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `approved_by` | `platform_users.id` | NO ACTION | `fk_platform_site_template_versions_approved_by` |
| `template_id` | `platform_site_templates.id` | NO ACTION | `fk_platform_site_template_versions_template_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_site_template_versions_tpl_version` | `template_id, version` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_platform_site_template_versions_1` | `CHECK ((((status)::text <> ALL ((ARRAY['aprobada'::character varying, 'publicada'::character varying])::text[])) OR ((approved_by IS NOT NULL) AND (lh_performance >= 85) AND (lh_accessibility >= 95) AND (lh_seo >= 95) AND (lh_best_practices >= 90))))` |  |
| `ck_platform_site_template_versions_2` | `CHECK ((((status)::text <> 'publicada'::text) OR (published_at IS NOT NULL)))` |  |
| `platform_site_template_versions_bundle_sha256_check` | `CHECK ((bundle_sha256 ~ '^[0-9a-f]{64}$'::text))` |  |
| `platform_site_template_versions_lh_accessibility_check` | `CHECK (((lh_accessibility >= 0) AND (lh_accessibility <= 100)))` |  |
| `platform_site_template_versions_lh_best_practices_check` | `CHECK (((lh_best_practices >= 0) AND (lh_best_practices <= 100)))` |  |
| `platform_site_template_versions_lh_performance_check` | `CHECK (((lh_performance >= 0) AND (lh_performance <= 100)))` |  |
| `platform_site_template_versions_lh_seo_check` | `CHECK (((lh_seo >= 0) AND (lh_seo <= 100)))` |  |
| `platform_site_template_versions_manifest_check` | `CHECK (((jsonb_typeof(manifest) = 'object'::text) AND (manifest ? 'sections'::text) AND (manifest ? 'tokens'::text)))` |  |
| `platform_site_template_versions_status_check` | `CHECK (((status)::text = ANY ((ARRAY['candidata'::character varying, 'aprobada'::character varying, 'publicada'::character varying, 'retirada'::character varying])::text[])))` | `status`: `candidata`, `aprobada`, `publicada`, `retirada` |
| `platform_site_template_versions_version_check` | `CHECK (((version)::text ~ '^[0-9]+\.[0-9]+\.[0-9]+$'::text))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_site_template_versions_approved_by` | `USING btree (approved_by)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_platform_site_template_versions_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `platform_site_templates`

[Spec 23 §3.1] [Fase 3] Catálogo de plantillas del sitio público (equipo o partner), incluidas o premium, con plantilla por defecto para nuevas agencias.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `code` | `character varying(20)` | no |  |  |
| 3 | `slug` | `character varying(60)` | no |  |  |
| 4 | `name` | `character varying(80)` | no |  |  |
| 5 | `description` | `text` | no |  |  |
| 6 | `category` | `character varying(16)` | no |  | Valores: `agencia`, `free_tour`, `aventura`, `lujo`, `corporativo`, `multi`. |
| 7 | `tier` | `character varying(10)` | no | `'incluida'::character varying` | Valores: `incluida`, `premium`. |
| 8 | `price_once` | `numeric(12,2)` | no | `0` |  |
| 9 | `currency` | `character(3)` | no | `'PEN'::bpchar` |  |
| 10 | `min_plan_code` | `character varying(40)` | sí |  |  |
| 11 | `author_kind` | `character varying(10)` | no | `'equipo'::character varying` | Valores: `equipo`, `partner`. |
| 12 | `author_name` | `character varying(120)` | no |  |  |
| 13 | `repo_url` | `character varying(300)` | sí |  |  |
| 14 | `status` | `character varying(12)` | no | `'borrador'::character varying` | Valores: `borrador`, `en_revision`, `publicado`, `retirado`. |
| 15 | `current_version_id` | `uuid` | sí |  | FK → platform_site_template_versions.id. |
| 16 | `default_for_new` | `boolean` | no | `false` |  |
| 17 | `installs` | `integer` | no | `0` |  |
| 18 | `tags` | `text[]` | no | `'{}'::text[]` |  |
| 19 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 20 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `current_version_id` | `platform_site_template_versions.id` | NO ACTION · DEFERRABLE | `fk_platform_site_templates_current_version_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_site_templates_code` | `code` |  | índice único |
| `uq_platform_site_templates_default` | `(true)` | `default_for_new` | índice único |
| `uq_platform_site_templates_slug` | `slug` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_platform_site_templates_1` | `CHECK (((((tier)::text = 'incluida'::text) AND (price_once = (0)::numeric)) OR (((tier)::text = 'premium'::text) AND (price_once > (0)::numeric))))` |  |
| `ck_platform_site_templates_2` | `CHECK ((((status)::text <> 'publicado'::text) OR (current_version_id IS NOT NULL)))` |  |
| `ck_platform_site_templates_3` | `CHECK (((NOT default_for_new) OR (((status)::text = 'publicado'::text) AND ((tier)::text = 'incluida'::text))))` |  |
| `platform_site_templates_author_kind_check` | `CHECK (((author_kind)::text = ANY ((ARRAY['equipo'::character varying, 'partner'::character varying])::text[])))` | `author_kind`: `equipo`, `partner` |
| `platform_site_templates_category_check` | `CHECK (((category)::text = ANY ((ARRAY['agencia'::character varying, 'free_tour'::character varying, 'aventura'::character varying, 'lujo'::character varying, 'corporativo'::character varying, 'multi'::character varying])::text[])))` | `category`: `agencia`, `free_tour`, `aventura`, `lujo`, `corporativo`, `multi` |
| `platform_site_templates_currency_check` | `CHECK ((currency ~ '^[A-Z]{3}$'::text))` |  |
| `platform_site_templates_installs_check` | `CHECK ((installs >= 0))` |  |
| `platform_site_templates_price_once_check` | `CHECK ((price_once >= (0)::numeric))` |  |
| `platform_site_templates_slug_check` | `CHECK (((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))` |  |
| `platform_site_templates_status_check` | `CHECK (((status)::text = ANY ((ARRAY['borrador'::character varying, 'en_revision'::character varying, 'publicado'::character varying, 'retirado'::character varying])::text[])))` | `status`: `borrador`, `en_revision`, `publicado`, `retirado` |
| `platform_site_templates_tier_check` | `CHECK (((tier)::text = ANY ((ARRAY['incluida'::character varying, 'premium'::character varying])::text[])))` | `tier`: `incluida`, `premium` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_site_templates_current_version_id` | `USING btree (current_version_id)` |
| `ix_platform_site_templates_status` | `USING btree (status, category)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_platform_site_templates_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `platform_template_submissions`

[Spec 23 §3.3] [Fase 3] Envíos de plantillas a revisión con el resultado de las validaciones automáticas y la decisión.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `code` | `character varying(20)` | no |  |  |
| 3 | `template_id` | `uuid` | no |  | FK → platform_site_templates.id. |
| 4 | `version` | `character varying(20)` | no |  |  |
| 5 | `submitted_by` | `uuid` | sí |  | FK → platform_users.id. |
| 6 | `submitted_by_name` | `character varying(120)` | no |  |  |
| 7 | `status` | `character varying(12)` | no | `'recibida'::character varying` | Valores: `recibida`, `validando`, `aprobada`, `rechazada`. |
| 8 | `checks` | `jsonb` | no | `'{}'::jsonb` |  |
| 9 | `reviewer_id` | `uuid` | sí |  | FK → platform_users.id. |
| 10 | `decided_at` | `timestamp with time zone` | sí |  |  |
| 11 | `reject_reason` | `text` | sí |  |  |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 13 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `reviewer_id` | `platform_users.id` | NO ACTION | `fk_platform_template_submissions_reviewer_id` |
| `submitted_by` | `platform_users.id` | NO ACTION | `fk_platform_template_submissions_submitted_by` |
| `template_id` | `platform_site_templates.id` | NO ACTION | `fk_platform_template_submissions_template_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_template_submissions_code` | `code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_platform_template_submissions_1` | `CHECK ((((status)::text <> ALL ((ARRAY['aprobada'::character varying, 'rechazada'::character varying])::text[])) OR ((decided_at IS NOT NULL) AND (reviewer_id IS NOT NULL))))` |  |
| `ck_platform_template_submissions_2` | `CHECK ((((status)::text <> 'rechazada'::text) OR (length(COALESCE(reject_reason, ''::text)) >= 10)))` |  |
| `platform_template_submissions_checks_check` | `CHECK ((jsonb_typeof(checks) = 'object'::text))` |  |
| `platform_template_submissions_status_check` | `CHECK (((status)::text = ANY ((ARRAY['recibida'::character varying, 'validando'::character varying, 'aprobada'::character varying, 'rechazada'::character varying])::text[])))` | `status`: `recibida`, `validando`, `aprobada`, `rechazada` |
| `platform_template_submissions_version_check` | `CHECK (((version)::text ~ '^[0-9]+\.[0-9]+\.[0-9]+$'::text))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_template_submissions_reviewer_id` | `USING btree (reviewer_id)` |
| `ix_platform_template_submissions_status` | `USING btree (status, created_at)` |
| `ix_platform_template_submissions_submitted_by` | `USING btree (submitted_by)` |
| `ix_platform_template_submissions_template_id` | `USING btree (template_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_platform_template_submissions_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `platform_tracking_tags`

[Spec 24 §3.1] [Fase 3] Etiquetas de medición y publicidad de la vitrina y su blog (GA4, GTM, Google Ads, Meta Pixel, TikTok, Clarity, LinkedIn y scripts propios) con consentimiento, reglas de página y aprobación por otra persona.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `code` | `character varying(20)` | no |  |  |
| 3 | `site` | `character varying(10)` | no | `'vitrina'::character varying` | Valores: `vitrina`, `blog`, `ambos`. |
| 4 | `provider` | `character varying(16)` | no |  | Valores: `ga4`, `gtm`, `google_ads`, `meta_pixel`, `tiktok`, `clarity`, `linkedin`, `script`. |
| 5 | `name` | `character varying(80)` | no |  |  |
| 6 | `measurement_id` | `character varying(40)` | sí |  |  |
| 7 | `config` | `jsonb` | no | `'{}'::jsonb` |  |
| 8 | `secret_ref` | `character varying(200)` | sí |  |  |
| 9 | `consent_category` | `character varying(12)` | no |  | Valores: `necesarias`, `analiticas`, `marketing`. |
| 10 | `placement` | `character varying(12)` | no | `'head'::character varying` | Valores: `head`, `body_inicio`, `body_fin`. |
| 11 | `page_rules` | `jsonb` | no | `'{"exclude": [], "include": ["/*"]}'::jsonb` |  |
| 12 | `script_body` | `text` | sí |  |  |
| 13 | `script_src` | `character varying(400)` | sí |  |  |
| 14 | `sri_hash` | `character varying(120)` | sí |  |  |
| 15 | `csp_domains` | `text[]` | no | `'{}'::text[]` |  |
| 16 | `exclude_checkout` | `boolean` | no | `true` |  |
| 17 | `status` | `character varying(12)` | no | `'borrador'::character varying` | Valores: `borrador`, `en_revision`, `activo`, `pausado`, `rechazado`. |
| 18 | `starts_at` | `timestamp with time zone` | sí |  |  |
| 19 | `ends_at` | `timestamp with time zone` | sí |  |  |
| 20 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). FK → platform_users.id. |
| 21 | `approved_by` | `uuid` | sí |  | FK → platform_users.id. |
| 22 | `approved_at` | `timestamp with time zone` | sí |  |  |
| 23 | `reject_reason` | `text` | sí |  |  |
| 24 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 25 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 26 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `approved_by` | `platform_users.id` | NO ACTION | `fk_platform_tracking_tags_approved_by` |
| `created_by` | `platform_users.id` | NO ACTION | `fk_platform_tracking_tags_created_by` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_tracking_tags_code` | `code` |  | índice único |
| `uq_platform_tracking_tags_provider_id` | `site, provider, measurement_id` | `((measurement_id IS NOT NULL) AND ((status)::text <> 'rechazado'::text))` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_platform_tracking_tags_1` | `CHECK (((((provider)::text = 'ga4'::text) AND ((measurement_id)::text ~ '^G-[A-Z0-9]{6,12}$'::text)) OR (((provider)::text = 'gtm'::text) AND ((measurement_id)::text ~ '^GTM-[A-Z0-9]{4,10}$'::text)) OR (((provider)::text = 'google_ads'::text) AND ((measurement_id)::text ~ '^AW-[0-9]{6,12}$'::text)) OR (((provider)::text = 'meta_pixel'::text) AND ((measurement_id)::text ~ '^[0-9]{10,20}$'::text)) OR (((provider)::text = ANY ((ARRAY['tiktok'::character varying, 'clarity'::character varying, 'linkedin'::character varying])::text[])) AND ((measurement_id)::text ~ '^[A-Za-z0-9_-]{4,40}$'::text)) OR (((provider)::text = 'script'::text) AND (measurement_id IS NULL) AND ((script_body IS NOT NULL) OR (script_src IS NOT NULL)))))` |  |
| `ck_platform_tracking_tags_2` | `CHECK (((script_src IS NULL) OR (sri_hash IS NOT NULL)))` |  |
| `ck_platform_tracking_tags_3` | `CHECK ((((status)::text <> ALL ((ARRAY['activo'::character varying, 'pausado'::character varying])::text[])) OR ((approved_by IS NOT NULL) AND (approved_at IS NOT NULL))))` |  |
| `ck_platform_tracking_tags_4` | `CHECK (((approved_by IS NULL) OR (created_by IS NULL) OR (approved_by <> created_by)))` |  |
| `ck_platform_tracking_tags_5` | `CHECK ((((status)::text <> 'rechazado'::text) OR (length(COALESCE(reject_reason, ''::text)) >= 10)))` |  |
| `ck_platform_tracking_tags_6` | `CHECK (((ends_at IS NULL) OR (starts_at IS NULL) OR (ends_at > starts_at)))` |  |
| `ck_platform_tracking_tags_7` | `CHECK ((((provider)::text <> 'script'::text) OR exclude_checkout))` |  |
| `platform_tracking_tags_config_check` | `CHECK ((jsonb_typeof(config) = 'object'::text))` |  |
| `platform_tracking_tags_consent_category_check` | `CHECK (((consent_category)::text = ANY ((ARRAY['necesarias'::character varying, 'analiticas'::character varying, 'marketing'::character varying])::text[])))` | `consent_category`: `necesarias`, `analiticas`, `marketing` |
| `platform_tracking_tags_page_rules_check` | `CHECK (((jsonb_typeof(page_rules) = 'object'::text) AND (page_rules ? 'include'::text)))` |  |
| `platform_tracking_tags_placement_check` | `CHECK (((placement)::text = ANY ((ARRAY['head'::character varying, 'body_inicio'::character varying, 'body_fin'::character varying])::text[])))` | `placement`: `head`, `body_inicio`, `body_fin` |
| `platform_tracking_tags_provider_check` | `CHECK (((provider)::text = ANY ((ARRAY['ga4'::character varying, 'gtm'::character varying, 'google_ads'::character varying, 'meta_pixel'::character varying, 'tiktok'::character varying, 'clarity'::character varying, 'linkedin'::character varying, 'script'::character varying])::text[])))` | `provider`: `ga4`, `gtm`, `google_ads`, `meta_pixel`, `tiktok`, `clarity`, `linkedin`, `script` |
| `platform_tracking_tags_script_body_check` | `CHECK (((script_body IS NULL) OR (length(script_body) <= 51200)))` |  |
| `platform_tracking_tags_script_src_check` | `CHECK (((script_src IS NULL) OR ((script_src)::text ~ '^https://'::text)))` |  |
| `platform_tracking_tags_site_check` | `CHECK (((site)::text = ANY ((ARRAY['vitrina'::character varying, 'blog'::character varying, 'ambos'::character varying])::text[])))` | `site`: `vitrina`, `blog`, `ambos` |
| `platform_tracking_tags_sri_hash_check` | `CHECK (((sri_hash IS NULL) OR ((sri_hash)::text ~ '^sha(256\|384\|512)-[A-Za-z0-9+/=]+$'::text)))` |  |
| `platform_tracking_tags_status_check` | `CHECK (((status)::text = ANY ((ARRAY['borrador'::character varying, 'en_revision'::character varying, 'activo'::character varying, 'pausado'::character varying, 'rechazado'::character varying])::text[])))` | `status`: `borrador`, `en_revision`, `activo`, `pausado`, `rechazado` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_tracking_tags_approved_by` | `USING btree (approved_by)` |
| `ix_platform_tracking_tags_created_by` | `USING btree (created_by)` |
| `ix_platform_tracking_tags_status` | `USING btree (site, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_platform_tracking_tags_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `platform_web_analytics_daily`

[Spec 24 §3.4] [Fase 3] Visitas agregadas por día de la vitrina y el blog (página, agencia, fuente, medio, campaña, dispositivo y país), sin datos personales.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Plataforma SaaS | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | sin RLS | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `bigint` | no | `identity (ALWAYS)` | PK. |
| 2 | `day` | `date` | no |  |  |
| 3 | `site` | `character varying(10)` | no |  | Valores: `vitrina`, `blog`. |
| 4 | `path` | `character varying(300)` | no |  |  |
| 5 | `agency_id` | `uuid` | sí |  | FK → platform_showcase_agencies.id. |
| 6 | `source` | `character varying(80)` | no | `'(directo)'::character varying` |  |
| 7 | `medium` | `character varying(40)` | no | `'(ninguno)'::character varying` |  |
| 8 | `campaign` | `character varying(120)` | no | `''::character varying` |  |
| 9 | `device` | `character varying(8)` | no |  | Valores: `movil`, `tablet`, `escritorio`, `otro`. |
| 10 | `country` | `character(2)` | no | `'ZZ'::bpchar` |  |
| 11 | `visits` | `integer` | no | `0` |  |
| 12 | `visitors` | `integer` | no | `0` |  |
| 13 | `pageviews` | `integer` | no | `0` |  |
| 14 | `bounces` | `integer` | no | `0` |  |
| 15 | `engaged_seconds` | `bigint` | no | `0` |  |
| 16 | `conversions` | `integer` | no | `0` |  |
| 17 | `revenue` | `numeric(14,2)` | no | `0` |  |
| 18 | `computed_at` | `timestamp with time zone` | no | `now()` |  |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `agency_id` | `platform_showcase_agencies.id` | NO ACTION | `fk_platform_web_analytics_daily_agency_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_platform_web_analytics_daily_dims` | `day, site, path, COALESCE(agency_id, '00000000-0000-0000-0000-000000000000'::uuid), source, medium, campaign, device, country` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_platform_web_analytics_daily_1` | `CHECK (((visitors <= visits) AND (bounces <= visits) AND (pageviews >= visits)))` |  |
| `platform_web_analytics_daily_bounces_check` | `CHECK ((bounces >= 0))` |  |
| `platform_web_analytics_daily_conversions_check` | `CHECK ((conversions >= 0))` |  |
| `platform_web_analytics_daily_country_check` | `CHECK ((country ~ '^[A-Z]{2}$'::text))` |  |
| `platform_web_analytics_daily_device_check` | `CHECK (((device)::text = ANY ((ARRAY['movil'::character varying, 'tablet'::character varying, 'escritorio'::character varying, 'otro'::character varying])::text[])))` | `device`: `movil`, `tablet`, `escritorio`, `otro` |
| `platform_web_analytics_daily_engaged_seconds_check` | `CHECK ((engaged_seconds >= 0))` |  |
| `platform_web_analytics_daily_pageviews_check` | `CHECK ((pageviews >= 0))` |  |
| `platform_web_analytics_daily_revenue_check` | `CHECK ((revenue >= (0)::numeric))` |  |
| `platform_web_analytics_daily_site_check` | `CHECK (((site)::text = ANY ((ARRAY['vitrina'::character varying, 'blog'::character varying])::text[])))` | `site`: `vitrina`, `blog` |
| `platform_web_analytics_daily_visitors_check` | `CHECK ((visitors >= 0))` |  |
| `platform_web_analytics_daily_visits_check` | `CHECK ((visits >= 0))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_platform_web_analytics_daily_agency_id` | `USING btree (agency_id, day)` |
| `ix_platform_web_analytics_daily_day` | `USING btree (site, day)` |

[↑ Índice del dominio](#tablas)
