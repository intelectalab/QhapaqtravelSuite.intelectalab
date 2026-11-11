# Diccionario de datos · Plataforma SaaS

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.13 tras cargar `00`→`90`. No editar a mano._

Planes, tenants, suscripciones, facturación SaaS, cupones y medición de uso (sin tenant_id de negocio).

27 tablas · 301 columnas · 39 claves foráneas. Diagrama ER: [`../er/plataforma.svg`](../er/plataforma.svg) (fuente [`../er/plataforma.mmd`](../er/plataforma.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`addon_prices`](#addon_prices) | Plataforma | plataforma | 3 | 2 | [Spec 13 §3.5] [Plataforma] Precio de add-on por plan (p. ej. extra_users). |
| [`addons`](#addons) | Plataforma | plataforma | 12 | 0 | [Spec 13 §3.5] [Plataforma] Catálogo de add-ons de suscripción. |
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
| [`subscription_items`](#subscription_items) | Plataforma | plataforma | 12 | 2 | [Spec 13 §3.6] [Plataforma] Add-ons contratados en la suscripción. [Fase 3] |
| [`subscriptions`](#subscriptions) | Plataforma | plataforma | 30 | 3 | [Spec 13 §3.6] [Plataforma] Suscripción del tenant a un plan. [Fase 3] |
| [`tenant_onboarding`](#tenant_onboarding) | Plataforma | plataforma | 8 | 2 | [Spec 09 §3.5] [Plataforma] Snapshot del asistente de alta PROC-001. |
| [`tenants`](#tenants) | Plataforma | plataforma | 32 | 2 | [Spec 09 §3.4] [Plataforma] Tenant (agencia). Raíz del aislamiento; RLS propia: una fila visible = la del contexto. |
| [`usage_counters`](#usage_counters) | Plataforma | plataforma | 4 | 1 | [Spec 13 §3.10] [Plataforma] Contadores diarios de uso por tenant (particionada por mes). [Fase 3] |
| [`usage_events`](#usage_events) | Plataforma | plataforma | 7 | 1 | [Spec 13 §9 (fallback)] [Plataforma] Fallback de medición cuando Redis no está disponible. [Fase 3] (supuesto: columnas mínimas) |
| [`usage_monthly`](#usage_monthly) | Plataforma | plataforma | 7 | 1 | [Spec 13 §3.10] [Plataforma] Uso mensual consolidado y alertas 80/100 %. [Fase 3] |

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

**PK:** `code`

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
| 3 | `tenant_id` | `uuid` | no |  | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 4 | `subscription_id` | `uuid` | no |  | FK → subscriptions.id. |
| 5 | `remaining_cycles` | `smallint` | no |  |  |
| 6 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 7 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `coupon_id` | `coupons.id` | NO ACTION | `fk_coupon_redemptions_coupon_id` |
| `subscription_id` | `subscriptions.id` | NO ACTION | `fk_coupon_redemptions_subscription_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_coupon_redemptions_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
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
| 4 | `tenant_id` | `uuid` | no |  | Tenant propietario de la fila (RLS). FK → tenants.id. |
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
| `subscription_id` | `subscriptions.id` | NO ACTION | `fk_platform_invoices_subscription_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_platform_invoices_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
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
| 3 | `tenant_id` | `uuid` | no |  | Tenant propietario de la fila (RLS). FK → tenants.id. |
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
| `coupon_redemption_id` | `coupon_redemptions.id` | NO ACTION | `fk_subscriptions_coupon_redemption_id` |
| `plan_id` | `plans.id` | NO ACTION | `fk_subscriptions_plan_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_subscriptions_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
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
