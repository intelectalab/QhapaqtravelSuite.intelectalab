# Diccionario de datos · Integraciones (integration_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.13 tras cargar `00`→`90`. No editar a mano._

Adaptadores, errores, API keys, webhooks, OAuth y fuentes de reseñas.

8 tablas · 137 columnas · 15 claves foráneas. Diagrama ER: [`../er/integration.svg`](../er/integration.svg) (fuente [`../er/integration.mmd`](../er/integration.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`integration_adapters`](#integration_adapters) | Fase 0 · Fundaciones | shared | 21 | 2 | [Spec 09 §3.13] [Fase 0] Adaptadores de integración INT-01…07 (tenant NULL = compartido de plataforma). |
| [`integration_errors`](#integration_errors) | Fase 0 · Fundaciones | tenant | 18 | 2 | [Spec 09 §3.15] [Fase 0] Errores de jobs/notificaciones/integraciones (jobLog). |
| [`integration_api_keys`](#integration_api_keys) | Fase 3 · SaaS y crecimiento | tenant | 19 | 2 | [Spec 13 §3.11] [Fase 3] API keys del tenant (solo hash del token). |
| [`integration_oauth_apps`](#integration_oauth_apps) | Fase 3 · SaaS y crecimiento | tenant | 8 | 2 | [Spec 13 §3.14] [Fase 3] Apps OAuth de terceros autorizadas (Authorization Code + PKCE). |
| [`integration_review_sources`](#integration_review_sources) | Fase 3 · SaaS y crecimiento | tenant | 21 | 3 | [Spec 17 §3.7] [Fase 3] Conectores de reseñas externas (TripAdvisor, Google…). |
| [`integration_webhook_deliveries`](#integration_webhook_deliveries) | Fase 3 · SaaS y crecimiento | tenant | 17 | 2 | [Spec 13 §3.13] [Fase 3] Entregas de webhooks (particionada por mes, retención 30 días). |
| [`integration_webhooks`](#integration_webhooks) | Fase 3 · SaaS y crecimiento | tenant | 19 | 1 | [Spec 13 §3.12] [Fase 3] Suscripciones de webhooks del tenant. |
| [`oauth_clients`](#oauth_clients) | Fase 3 · SaaS y crecimiento | tenant | 14 | 1 | [Spec 13 §3.14] [Fase 3] Clientes OAuth (Laravel Passport) extendidos con tenant_id. |

## Detalle por tabla

### `integration_adapters`

[Spec 09 §3.13] [Fase 0] Adaptadores de integración INT-01…07 (tenant NULL = compartido de plataforma).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Integraciones (integration_) | Fase 0 · Fundaciones (`10_fase0.sql`) | shared (tenant + filas globales de solo lectura) · FORCE | `platform_access`, `tenant_isolation`, `tenant_shared_read` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | sí | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `name` | `character varying(120)` | no |  |  |
| 5 | `kind` | `character varying(30)` | no |  | Valores: `fiscal`, `payments`, `email`, `messaging`, `maps`, `suppliers`, `distribution`. |
| 6 | `status` | `character varying(20)` | no | `'por_validar'::character varying` | Valores: `activo`, `por_validar`, `sandbox`, `parcial`, `futuro`. |
| 7 | `environment` | `character varying(20)` | no | `'sandbox'::character varying` | Valores: `sandbox`, `production`. |
| 8 | `owner_user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 9 | `max_retries` | `smallint` | no | `5` |  |
| 10 | `backoff_base_s` | `integer` | no | `60` |  |
| 11 | `timeout_s` | `integer` | no | `30` |  |
| 12 | `secret_ref` | `character varying(200)` | sí |  |  |
| 13 | `secret_rotated_at` | `timestamp with time zone` | sí |  |  |
| 14 | `note` | `text` | sí |  |  |
| 15 | `last_test_at` | `timestamp with time zone` | sí |  |  |
| 16 | `last_test_ok` | `boolean` | sí |  |  |
| 17 | `last_test_result` | `character varying(250)` | sí |  |  |
| 18 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 19 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 20 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 21 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `owner_user_id` | `iam_users.id` | NO ACTION | `fk_integration_adapters_owner_user_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_integration_adapters_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_integration_adapters_tenant_id_code_p` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `integration_adapters_backoff_base_s_check` | `CHECK ((backoff_base_s >= 5))` |  |
| `integration_adapters_environment_check` | `CHECK (((environment)::text = ANY ((ARRAY['sandbox'::character varying, 'production'::character varying])::text[])))` | `environment`: `sandbox`, `production` |
| `integration_adapters_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['fiscal'::character varying, 'payments'::character varying, 'email'::character varying, 'messaging'::character varying, 'maps'::character varying, 'suppliers'::character varying, 'distribution'::character varying])::text[])))` | `kind`: `fiscal`, `payments`, `email`, `messaging`, `maps`, `suppliers`, `distribution` |
| `integration_adapters_max_retries_check` | `CHECK (((max_retries >= 0) AND (max_retries <= 10)))` |  |
| `integration_adapters_status_check` | `CHECK (((status)::text = ANY ((ARRAY['activo'::character varying, 'por_validar'::character varying, 'sandbox'::character varying, 'parcial'::character varying, 'futuro'::character varying])::text[])))` | `status`: `activo`, `por_validar`, `sandbox`, `parcial`, `futuro` |
| `integration_adapters_timeout_s_check` | `CHECK (((timeout_s >= 5) AND (timeout_s <= 120)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_integration_adapters_owner_user_id` | `USING btree (owner_user_id)` |
| `ix_integration_adapters_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_integration_adapters_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_integration_adapters_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `integration_errors`

[Spec 09 §3.15] [Fase 0] Errores de jobs/notificaciones/integraciones (jobLog).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Integraciones (integration_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | sí | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | sí |  |  |
| 4 | `source` | `character varying(20)` | no |  | Valores: `job`, `notification`, `integration`. |
| 5 | `ref_code` | `character varying(30)` | no |  |  |
| 6 | `target` | `character varying(150)` | no |  |  |
| 7 | `error` | `text` | no |  |  |
| 8 | `error_class` | `character varying(20)` | no |  | Valores: `transitorio`, `permanente`. |
| 9 | `attempt` | `smallint` | no | `0` |  |
| 10 | `max_attempts` | `smallint` | no | `5` |  |
| 11 | `next_retry_at` | `timestamp with time zone` | sí |  |  |
| 12 | `status` | `character varying(20)` | no | `'reintentando'::character varying` | Valores: `reintentando`, `fallo_definitivo`, `resuelto`. |
| 13 | `resolution` | `text` | sí |  |  |
| 14 | `resolved_by` | `uuid` | sí |  | FK → iam_users.id. |
| 15 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 16 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 17 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 18 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `resolved_by` | `iam_users.id` | NO ACTION | `fk_integration_errors_resolved_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_integration_errors_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `integration_errors_error_class_check` | `CHECK (((error_class)::text = ANY ((ARRAY['transitorio'::character varying, 'permanente'::character varying])::text[])))` | `error_class`: `transitorio`, `permanente` |
| `integration_errors_source_check` | `CHECK (((source)::text = ANY ((ARRAY['job'::character varying, 'notification'::character varying, 'integration'::character varying])::text[])))` | `source`: `job`, `notification`, `integration` |
| `integration_errors_status_check` | `CHECK (((status)::text = ANY ((ARRAY['reintentando'::character varying, 'fallo_definitivo'::character varying, 'resuelto'::character varying])::text[])))` | `status`: `reintentando`, `fallo_definitivo`, `resuelto` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_integration_errors_resolved_by` | `USING btree (resolved_by)` |
| `ix_integration_errors_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_integration_errors_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_integration_errors_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `integration_api_keys`

[Spec 13 §3.11] [Fase 3] API keys del tenant (solo hash del token).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Integraciones (integration_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `name` | `character varying(120)` | no |  |  |
| 5 | `environment` | `character varying(10)` | no |  | Valores: `live`, `test`. |
| 6 | `prefix` | `character varying(16)` | no |  |  |
| 7 | `last4` | `character(4)` | no |  |  |
| 8 | `token_hash` | `character(64)` | no |  |  |
| 9 | `scopes` | `text[]` | no | `'{}'::text[]` |  |
| 10 | `ip_allowlist` | `cidr[]` | sí |  |  |
| 11 | `expires_at` | `date` | sí |  |  |
| 12 | `last_used_at` | `timestamp with time zone` | sí |  |  |
| 13 | `last_used_ip` | `inet` | sí |  |  |
| 14 | `status` | `character varying(20)` | no | `'active'::character varying` | Valores: `active`, `revoked`, `expired`. |
| 15 | `revoked_at` | `timestamp with time zone` | sí |  |  |
| 16 | `revoked_by` | `uuid` | sí |  | FK → iam_users.id. |
| 17 | `revoke_reason` | `character varying(300)` | sí |  |  |
| 18 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 19 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `revoked_by` | `iam_users.id` | NO ACTION | `fk_integration_api_keys_revoked_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_integration_api_keys_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_integration_api_keys_prefix` | `prefix` |  | índice único |
| `uq_integration_api_keys_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `integration_api_keys_environment_check` | `CHECK (((environment)::text = ANY ((ARRAY['live'::character varying, 'test'::character varying])::text[])))` | `environment`: `live`, `test` |
| `integration_api_keys_status_check` | `CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'revoked'::character varying, 'expired'::character varying])::text[])))` | `status`: `active`, `revoked`, `expired` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_integration_api_keys_revoked_by` | `USING btree (revoked_by)` |
| `ix_integration_api_keys_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_integration_api_keys_tenant_id_status` | `USING btree (tenant_id, status)` |

[↑ Índice del dominio](#tablas)

### `integration_oauth_apps`

[Spec 13 §3.14] [Fase 3] Apps OAuth de terceros autorizadas (Authorization Code + PKCE).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Integraciones (integration_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `client_id` | `uuid` | no |  | FK → oauth_clients.id. |
| 4 | `vendor` | `character varying(120)` | no |  |  |
| 5 | `allowed_scopes` | `text[]` | no | `'{}'::text[]` |  |
| 6 | `status` | `character varying(20)` | no | `'active'::character varying` | Valores: `active`, `revoked`. |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `client_id` | `oauth_clients.id` | NO ACTION | `fk_integration_oauth_apps_client_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_integration_oauth_apps_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_integration_oauth_apps_client_id` | `client_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `integration_oauth_apps_status_check` | `CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'revoked'::character varying])::text[])))` | `status`: `active`, `revoked` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_integration_oauth_apps_tenant_id_status` | `USING btree (tenant_id, status)` |

[↑ Índice del dominio](#tablas)

### `integration_review_sources`

[Spec 17 §3.7] [Fase 3] Conectores de reseñas externas (TripAdvisor, Google…).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Integraciones (integration_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `provider` | `character varying(20)` | no |  | Valores: `tripadvisor`, `trustpilot`, `google`, `facebook`, `getyourguide`, `viator`. |
| 4 | `status` | `character varying(20)` | no | `'no_conectado'::character varying` | Valores: `no_conectado`, `pendiente`, `conectado`, `error`. |
| 5 | `account_ref` | `character varying(120)` | sí |  |  |
| 6 | `secret_ref` | `character varying(200)` | sí |  |  |
| 7 | `secret_last4` | `character(4)` | sí |  |  |
| 8 | `scopes` | `text[]` | no | `'{}'::text[]` |  |
| 9 | `can_reply` | `boolean` | no | `false` |  |
| 10 | `supports_invites` | `boolean` | no | `false` |  |
| 11 | `rating` | `numeric(3,2)` | sí |  |  |
| 12 | `review_count` | `integer` | no | `0` |  |
| 13 | `last_sync_at` | `timestamp with time zone` | sí |  |  |
| 14 | `connected_at` | `timestamp with time zone` | sí |  |  |
| 15 | `connected_by` | `uuid` | sí |  | FK → iam_users.id. |
| 16 | `contract_ack_at` | `timestamp with time zone` | sí |  |  |
| 17 | `contract_ack_by` | `uuid` | sí |  | FK → iam_users.id. |
| 18 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 19 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 20 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 21 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `connected_by` | `iam_users.id` | NO ACTION | `fk_integration_review_sources_connected_by` |
| `contract_ack_by` | `iam_users.id` | NO ACTION | `fk_integration_review_sources_contract_ack_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_integration_review_sources_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_integration_review_sources_tenant_id_provider` | `tenant_id, provider` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `integration_review_sources_provider_check` | `CHECK (((provider)::text = ANY ((ARRAY['tripadvisor'::character varying, 'trustpilot'::character varying, 'google'::character varying, 'facebook'::character varying, 'getyourguide'::character varying, 'viator'::character varying])::text[])))` | `provider`: `tripadvisor`, `trustpilot`, `google`, `facebook`, `getyourguide`, `viator` |
| `integration_review_sources_status_check` | `CHECK (((status)::text = ANY ((ARRAY['no_conectado'::character varying, 'pendiente'::character varying, 'conectado'::character varying, 'error'::character varying])::text[])))` | `status`: `no_conectado`, `pendiente`, `conectado`, `error` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_integration_review_sources_connected_by` | `USING btree (connected_by)` |
| `ix_integration_review_sources_contract_ack_by` | `USING btree (contract_ack_by)` |
| `ix_integration_review_sources_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_integration_review_sources_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `integration_webhook_deliveries`

[Spec 13 §3.13] [Fase 3] Entregas de webhooks (particionada por mes, retención 30 días).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Integraciones (integration_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | Sí · `RANGE (created_at)` · 25 particiones (incluida DEFAULT) |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `webhook_id` | `uuid` | no |  | FK → integration_webhooks.id. |
| 5 | `event_type` | `character varying(50)` | no |  |  |
| 6 | `event_id` | `character varying(40)` | no |  |  |
| 7 | `entity_code` | `character varying(40)` | sí |  |  |
| 8 | `payload` | `jsonb` | no |  |  |
| 9 | `attempt` | `smallint` | no | `1` |  |
| 10 | `status` | `character varying(20)` | no | `'pending'::character varying` | Valores: `pending`, `delivered`, `retrying`, `failed`. |
| 11 | `http_status` | `smallint` | sí |  |  |
| 12 | `duration_ms` | `integer` | sí |  |  |
| 13 | `response_excerpt` | `character varying(2000)` | sí |  |  |
| 14 | `error` | `character varying(300)` | sí |  |  |
| 15 | `next_retry_at` | `timestamp with time zone` | sí |  |  |
| 16 | `manual` | `boolean` | no | `false` |  |
| 17 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. PK. |

**PK:** `id, created_at`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_integration_webhook_deliveries_tenant_id` |
| `webhook_id` | `integration_webhooks.id` | NO ACTION | `fk_integration_webhook_deliveries_webhook_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `integration_webhook_deliveries_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'delivered'::character varying, 'retrying'::character varying, 'failed'::character varying])::text[])))` | `status`: `pending`, `delivered`, `retrying`, `failed` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_integration_webhook_deliveries_status_next_retry_at_p` | `USING btree (status, next_retry_at) WHERE ((status)::text = 'retrying'::text)` |
| `ix_integration_webhook_deliveries_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_integration_webhook_deliveries_tenant_id_webhook_id_c_761fb0` | `USING btree (tenant_id, webhook_id, created_at DESC)` |
| `ix_integration_webhook_deliveries_webhook_id` | `USING btree (webhook_id)` |

**Particiones:** 25 (p. ej. `integration_webhook_deliveries_default`, `integration_webhook_deliveries_y2026m01`, `integration_webhook_deliveries_y2026m02` …). Se crean con `app_create_monthly_partitions()`; programar un job mensual.

[↑ Índice del dominio](#tablas)

### `integration_webhooks`

[Spec 13 §3.12] [Fase 3] Suscripciones de webhooks del tenant.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Integraciones (integration_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `url` | `character varying(500)` | no |  |  |
| 5 | `description` | `character varying(200)` | sí |  |  |
| 6 | `events` | `text[]` | no | `'{}'::text[]` |  |
| 7 | `secret_encrypted` | `text` | no |  |  |
| 8 | `previous_secret_encrypted` | `text` | sí |  |  |
| 9 | `previous_secret_expires_at` | `timestamp with time zone` | sí |  |  |
| 10 | `secret_prefix` | `character varying(12)` | no |  |  |
| 11 | `api_version` | `character varying(10)` | no |  |  |
| 12 | `status` | `character varying(20)` | no | `'active'::character varying` | Valores: `active`, `paused`, `disabled`, `deleted`. |
| 13 | `consecutive_failures` | `smallint` | no | `0` |  |
| 14 | `disabled_reason` | `character varying(200)` | sí |  |  |
| 15 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 16 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 17 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 18 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 19 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_integration_webhooks_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_integration_webhooks_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `integration_webhooks_status_check` | `CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'paused'::character varying, 'disabled'::character varying, 'deleted'::character varying])::text[])))` | `status`: `active`, `paused`, `disabled`, `deleted` |
| `integration_webhooks_url_check` | `CHECK (((url)::text ~ '^https://'::text))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_integration_webhooks_events` | `USING gin (events)` |
| `ix_integration_webhooks_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_integration_webhooks_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_integration_webhooks_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `oauth_clients`

[Spec 13 §3.14] [Fase 3] Clientes OAuth (Laravel Passport) extendidos con tenant_id.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Integraciones (integration_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `owner_type` | `character varying(255)` | sí |  |  |
| 4 | `owner_id` | `uuid` | sí |  |  |
| 5 | `name` | `character varying(255)` | no |  |  |
| 6 | `secret` | `character varying(255)` | sí |  |  |
| 7 | `provider` | `character varying(255)` | sí |  |  |
| 8 | `redirect_uris` | `text` | no | `'[]'::text` |  |
| 9 | `grant_types` | `text` | no | `'["authorization_code","refresh_token"]'::text` |  |
| 10 | `revoked` | `boolean` | no | `false` |  |
| 11 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 12 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 13 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 14 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_oauth_clients_tenant_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_oauth_clients_owner_type_owner_id` | `USING btree (owner_type, owner_id)` |
| `ix_oauth_clients_tenant_id_owner_id` | `USING btree (tenant_id, owner_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_oauth_clients_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)
