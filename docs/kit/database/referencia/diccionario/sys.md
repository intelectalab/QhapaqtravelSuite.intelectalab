# Diccionario de datos · Sistema (sys_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.13 tras cargar `00`→`90`. No editar a mano._

Auditoría, correlativos, idempotencia, outbox, ajustes, documentos, jobs y reglas de reserva.

12 tablas · 159 columnas · 14 claves foráneas. Diagrama ER: [`../er/sys.svg`](../er/sys.svg) (fuente [`../er/sys.mmd`](../er/sys.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`sys_booking_rule_catalog`](#sys_booking_rule_catalog) | Plataforma | plataforma | 15 | 0 | [Spec 17 §3.1 + 16 §3.1 + 13 §3.4] [Plataforma] Catálogo de plataforma de reglas del motor de reservas (31 reglas). |
| [`sys_rule_templates`](#sys_rule_templates) | Plataforma | plataforma | 9 | 0 | [Spec 17 §3.3] [Plataforma] Plantillas de reglas por tipo de negocio (plataforma). |
| [`audit_events`](#audit_events) | Fase 0 · Fundaciones | tenant | 18 | 1 | [Spec 00 §3.6] [Fase 0] Bitácora append-only (PROC-063), particionada por mes. |
| [`sys_documents`](#sys_documents) | Fase 0 · Fundaciones | tenant | 15 | 1 | [Spec CONVENCIONES §5 (supuesto)] [Fase 0] Documentos generados/subidos (PDF, XML, CDR, evidencias) versionados con hash. Referenciada por 03-12; ninguna spec l |
| [`sys_idempotency_keys`](#sys_idempotency_keys) | Fase 0 · Fundaciones | tenant | 13 | 2 | [Spec 00 §3.8] [Fase 0] Claves Idempotency-Key (TTL 24 h). |
| [`sys_job_runs`](#sys_job_runs) | Fase 0 · Fundaciones | tenant | 12 | 3 | [Spec 09 §3.14 + CONVENCIONES §4] [Fase 0] Ejecuciones de jobs. |
| [`sys_outbox`](#sys_outbox) | Fase 0 · Fundaciones | tenant | 11 | 1 | [Spec 00 §3.9] [Fase 0] Outbox transaccional (fuente de webhooks e integraciones). |
| [`sys_scheduled_jobs`](#sys_scheduled_jobs) | Fase 0 · Fundaciones | tenant | 22 | 2 | [Spec 09 §3.14] [Fase 0] Jobs programados (JOB-01…) y reportes programados. |
| [`sys_sequences`](#sys_sequences) | Fase 0 · Fundaciones | tenant | 10 | 1 | [Spec 00 §3.7] [Fase 0] Correlativos por tenant, tipo y serie (SELECT … FOR UPDATE). |
| [`sys_settings`](#sys_settings) | Fase 0 · Fundaciones | tenant | 6 | 1 | [Spec 09 §3.8] [Fase 0] Configuración del tenant por sección (JSONB validado por FormRequest). |
| [`sys_holidays`](#sys_holidays) | Fase 1 · MVP | shared | 8 | 1 | [Spec 12 §3.11] [Fase 1] Feriados (tenant NULL = nacionales) para plazos hábiles. |
| [`sys_booking_rules`](#sys_booking_rules) | Fase 2 · Canales y campo | tenant | 20 | 1 | [Spec 17 §3.1 + 16 §3.1] [Fase 2] Centro de reglas del tenant (copia del catálogo de plataforma). |

## Detalle por tabla

### `sys_booking_rule_catalog`

[Spec 17 §3.1 + 16 §3.1 + 13 §3.4] [Plataforma] Catálogo de plataforma de reglas del motor de reservas (31 reglas).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Sistema (sys_) | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `code` | `character varying(40)` | no |  |  |
| 3 | `rule_group` | `character varying(40)` | no |  |  |
| 4 | `name` | `character varying(160)` | no |  |  |
| 5 | `description` | `text` | no |  |  |
| 6 | `default_enabled` | `boolean` | no | `false` |  |
| 7 | `default_params` | `jsonb` | no | `'{}'::jsonb` |  |
| 8 | `params_schema` | `jsonb` | no | `'{}'::jsonb` |  |
| 9 | `scope` | `text[]` | no | `'{}'::text[]` |  |
| 10 | `product_override` | `boolean` | no | `false` |  |
| 11 | `min_plan` | `character varying(20)` | no | `'Starter'::character varying` | Valores: `Starter`, `Professional`, `Enterprise`. |
| 12 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 13 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 15 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_sys_booking_rule_catalog_code` | `code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `sys_booking_rule_catalog_code_check` | `CHECK (((code)::text ~ '^R-[A-Z0-9-]{2,38}$'::text))` |  |
| `sys_booking_rule_catalog_min_plan_check` | `CHECK (((min_plan)::text = ANY ((ARRAY['Starter'::character varying, 'Professional'::character varying, 'Enterprise'::character varying])::text[])))` | `min_plan`: `Starter`, `Professional`, `Enterprise` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_sys_booking_rule_catalog_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `sys_rule_templates`

[Spec 17 §3.3] [Plataforma] Plantillas de reglas por tipo de negocio (plataforma).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Sistema (sys_) | Plataforma (`01_platform.sql`) | plataforma (sin RLS) | — | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `code` | `character varying(30)` | no |  | Valores: `receptivo`, `minorista`, `aventura`, `b2b`. |
| 3 | `name` | `character varying(120)` | no |  |  |
| 4 | `description` | `text` | sí |  |  |
| 5 | `enabled_codes` | `text[]` | no | `'{}'::text[]` |  |
| 6 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 7 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 8 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 9 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_sys_rule_templates_code` | `code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `sys_rule_templates_code_check` | `CHECK (((code)::text = ANY ((ARRAY['receptivo'::character varying, 'minorista'::character varying, 'aventura'::character varying, 'b2b'::character varying])::text[])))` | `code`: `receptivo`, `minorista`, `aventura`, `b2b` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_sys_rule_templates_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `audit_events`

[Spec 00 §3.6] [Fase 0] Bitácora append-only (PROC-063), particionada por mes.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Sistema (sys_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | Sí · `RANGE (occurred_at)` · 25 particiones (incluida DEFAULT) |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | sí | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `bigint` | no |  |  |
| 4 | `actor_type` | `character varying(20)` | no |  | Valores: `user`, `platform_user`, `system`, `api_client`. |
| 5 | `actor_id` | `uuid` | sí |  |  |
| 6 | `actor_role` | `character varying(60)` | sí |  |  |
| 7 | `entity` | `character varying(40)` | no |  |  |
| 8 | `entity_id` | `character varying(80)` | no |  |  |
| 9 | `action` | `character varying(40)` | no |  |  |
| 10 | `is_critical` | `boolean` | no | `false` |  |
| 11 | `before_value` | `text` | sí |  |  |
| 12 | `after_value` | `text` | sí |  |  |
| 13 | `diff` | `jsonb` | sí |  |  |
| 14 | `ip` | `inet` | sí |  |  |
| 15 | `user_agent` | `character varying(250)` | sí |  |  |
| 16 | `correlation_id` | `character varying(40)` | no |  |  |
| 17 | `evidence` | `jsonb` | sí |  |  |
| 18 | `occurred_at` | `timestamp with time zone` | no | `now()` | PK. |

**PK:** `id, occurred_at`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_audit_events_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `audit_events_actor_type_check` | `CHECK (((actor_type)::text = ANY ((ARRAY['user'::character varying, 'platform_user'::character varying, 'system'::character varying, 'api_client'::character varying])::text[])))` | `actor_type`: `user`, `platform_user`, `system`, `api_client` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_audit_events_correlation_id` | `USING btree (correlation_id)` |
| `ix_audit_events_tenant_id_action` | `USING btree (tenant_id, action)` |
| `ix_audit_events_tenant_id_actor_id` | `USING btree (tenant_id, actor_id)` |
| `ix_audit_events_tenant_id_entity_entity_id` | `USING btree (tenant_id, entity, entity_id)` |
| `ix_audit_events_tenant_id_occurred_at_desc` | `USING btree (tenant_id, occurred_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_audit_events_append_only` | BEFORE DELETE OR UPDATE | `app_forbid_update_delete` |

**Particiones:** 25 (p. ej. `audit_events_default`, `audit_events_y2026m01`, `audit_events_y2026m02` …). Se crean con `app_create_monthly_partitions()`; programar un job mensual.

[↑ Índice del dominio](#tablas)

### `sys_documents`

[Spec CONVENCIONES §5 (supuesto)] [Fase 0] Documentos generados/subidos (PDF, XML, CDR, evidencias) versionados con hash. Referenciada por 03-12; ninguna spec la define: columnas supuestas.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Sistema (sys_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `doc_type` | `character varying(40)` | no |  |  |
| 4 | `entity_type` | `character varying(40)` | sí |  |  |
| 5 | `entity_id` | `uuid` | sí |  |  |
| 6 | `version` | `integer` | no | `1` |  |
| 7 | `storage_disk` | `character varying(20)` | no | `'s3'::character varying` |  |
| 8 | `storage_path` | `character varying(400)` | no |  |  |
| 9 | `file_name` | `character varying(200)` | no |  |  |
| 10 | `mime_type` | `character varying(100)` | no |  |  |
| 11 | `size_bytes` | `bigint` | no | `0` |  |
| 12 | `sha256` | `character(64)` | no |  |  |
| 13 | `generated_by_job` | `character varying(150)` | sí |  |  |
| 14 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 15 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_sys_documents_tenant_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_sys_documents_tenant_id_entity_type_entity_id` | `USING btree (tenant_id, entity_type, entity_id)` |
| `ix_sys_documents_tenant_id_sha256` | `USING btree (tenant_id, sha256)` |

[↑ Índice del dominio](#tablas)

### `sys_idempotency_keys`

[Spec 00 §3.8] [Fase 0] Claves Idempotency-Key (TTL 24 h).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Sistema (sys_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | sí | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `key` | `character varying(80)` | no |  |  |
| 4 | `user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 5 | `method` | `character varying(10)` | no |  |  |
| 6 | `path` | `character varying(250)` | no |  |  |
| 7 | `request_hash` | `character(64)` | no |  |  |
| 8 | `status` | `character varying(20)` | no | `'processing'::character varying` | Valores: `processing`, `completed`, `failed`. |
| 9 | `response_code` | `smallint` | sí |  |  |
| 10 | `response_body` | `jsonb` | sí |  |  |
| 11 | `locked_until` | `timestamp with time zone` | sí |  |  |
| 12 | `expires_at` | `timestamp with time zone` | no |  |  |
| 13 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_sys_idempotency_keys_tenant_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_sys_idempotency_keys_user_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_sys_idempotency_keys_tenant_id_key_p` | `tenant_id, key` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `sys_idempotency_keys_status_check` | `CHECK (((status)::text = ANY ((ARRAY['processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))` | `status`: `processing`, `completed`, `failed` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_sys_idempotency_keys_expires_at` | `USING btree (expires_at)` |
| `ix_sys_idempotency_keys_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_sys_idempotency_keys_user_id` | `USING btree (user_id)` |

[↑ Índice del dominio](#tablas)

### `sys_job_runs`

[Spec 09 §3.14 + CONVENCIONES §4] [Fase 0] Ejecuciones de jobs.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Sistema (sys_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | sí | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `scheduled_job_id` | `uuid` | sí |  | FK → sys_scheduled_jobs.id. |
| 4 | `job_class` | `character varying(150)` | sí |  |  |
| 5 | `trigger` | `character varying(20)` | no |  | Valores: `schedule`, `manual`, `retry`. |
| 6 | `triggered_by` | `uuid` | sí |  | FK → iam_users.id. |
| 7 | `status` | `character varying(20)` | no | `'en_curso'::character varying` | Valores: `en_curso`, `ok`, `advertencia`, `error`. |
| 8 | `result` | `character varying(250)` | sí |  |  |
| 9 | `started_at` | `timestamp with time zone` | no | `now()` |  |
| 10 | `finished_at` | `timestamp with time zone` | sí |  |  |
| 11 | `attempt` | `smallint` | no | `1` |  |
| 12 | `correlation_id` | `character varying(40)` | sí |  |  |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `scheduled_job_id` | `sys_scheduled_jobs.id` | NO ACTION | `fk_sys_job_runs_scheduled_job_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_sys_job_runs_tenant_id` |
| `triggered_by` | `iam_users.id` | NO ACTION | `fk_sys_job_runs_triggered_by` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `sys_job_runs_status_check` | `CHECK (((status)::text = ANY ((ARRAY['en_curso'::character varying, 'ok'::character varying, 'advertencia'::character varying, 'error'::character varying])::text[])))` | `status`: `en_curso`, `ok`, `advertencia`, `error` |
| `sys_job_runs_trigger_check` | `CHECK (((trigger)::text = ANY ((ARRAY['schedule'::character varying, 'manual'::character varying, 'retry'::character varying])::text[])))` | `trigger`: `schedule`, `manual`, `retry` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_sys_job_runs_scheduled_job_id_started_at_desc` | `USING btree (scheduled_job_id, started_at DESC)` |
| `ix_sys_job_runs_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_sys_job_runs_triggered_by` | `USING btree (triggered_by)` |

[↑ Índice del dominio](#tablas)

### `sys_outbox`

[Spec 00 §3.9] [Fase 0] Outbox transaccional (fuente de webhooks e integraciones).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Sistema (sys_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | sí | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `aggregate_type` | `character varying(40)` | no |  |  |
| 4 | `aggregate_id` | `uuid` | no |  |  |
| 5 | `event` | `character varying(80)` | no |  |  |
| 6 | `payload` | `jsonb` | no |  |  |
| 7 | `status` | `character varying(20)` | no | `'pending'::character varying` | Valores: `pending`, `dispatched`, `failed`. |
| 8 | `attempts` | `smallint` | no | `0` |  |
| 9 | `available_at` | `timestamp with time zone` | no | `now()` |  |
| 10 | `dispatched_at` | `timestamp with time zone` | sí |  |  |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_sys_outbox_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `sys_outbox_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'dispatched'::character varying, 'failed'::character varying])::text[])))` | `status`: `pending`, `dispatched`, `failed` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_sys_outbox_aggregate_type_aggregate_id` | `USING btree (aggregate_type, aggregate_id)` |
| `ix_sys_outbox_status_available_at_p` | `USING btree (status, available_at) WHERE ((status)::text = 'pending'::text)` |
| `ix_sys_outbox_tenant_id_status` | `USING btree (tenant_id, status)` |

[↑ Índice del dominio](#tablas)

### `sys_scheduled_jobs`

[Spec 09 §3.14] [Fase 0] Jobs programados (JOB-01…) y reportes programados.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Sistema (sys_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | sí | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `name` | `character varying(150)` | no |  |  |
| 5 | `job_class` | `character varying(150)` | no |  |  |
| 6 | `cron` | `character varying(60)` | no |  |  |
| 7 | `cron_label` | `character varying(60)` | no |  |  |
| 8 | `queue` | `character varying(20)` | no | `'default'::character varying` | Valores: `critical`, `default`, `notifications`, `documents`, `integrations`, `reports`, `low`. |
| 9 | `paused` | `boolean` | no | `false` |  |
| 10 | `last_run_at` | `timestamp with time zone` | sí |  |  |
| 11 | `next_run_at` | `timestamp with time zone` | sí |  |  |
| 12 | `last_status` | `character varying(20)` | sí |  | Valores: `ok`, `advertencia`, `error`, `en_curso`. |
| 13 | `last_result` | `character varying(250)` | sí |  |  |
| 14 | `report_key` | `character varying(60)` | sí |  |  |
| 15 | `report_format` | `character varying(10)` | sí |  | Valores: `PDF`, `XLSX`, `CSV`. |
| 16 | `recipients` | `text` | sí |  |  |
| 17 | `owner_user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 18 | `is_system` | `boolean` | no | `false` |  |
| 19 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 20 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 21 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 22 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `owner_user_id` | `iam_users.id` | NO ACTION | `fk_sys_scheduled_jobs_owner_user_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_sys_scheduled_jobs_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_sys_scheduled_jobs_tenant_id_code_p` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `sys_scheduled_jobs_last_status_check` | `CHECK (((last_status IS NULL) OR ((last_status)::text = ANY ((ARRAY['ok'::character varying, 'advertencia'::character varying, 'error'::character varying, 'en_curso'::character varying])::text[]))))` | `last_status`: `ok`, `advertencia`, `error`, `en_curso` |
| `sys_scheduled_jobs_queue_check` | `CHECK (((queue)::text = ANY ((ARRAY['critical'::character varying, 'default'::character varying, 'notifications'::character varying, 'documents'::character varying, 'integrations'::character varying, 'reports'::character varying, 'low'::character varying])::text[])))` | `queue`: `critical`, `default`, `notifications`, `documents`, `integrations`, `reports`, `low` |
| `sys_scheduled_jobs_report_format_check` | `CHECK (((report_format IS NULL) OR ((report_format)::text = ANY ((ARRAY['PDF'::character varying, 'XLSX'::character varying, 'CSV'::character varying])::text[]))))` | `report_format`: `PDF`, `XLSX`, `CSV` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_sys_scheduled_jobs_owner_user_id` | `USING btree (owner_user_id)` |
| `ix_sys_scheduled_jobs_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_sys_scheduled_jobs_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `sys_sequences`

[Spec 00 §3.7] [Fase 0] Correlativos por tenant, tipo y serie (SELECT … FOR UPDATE).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Sistema (sys_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `doc_type` | `character varying(60)` | no |  |  |
| 4 | `label` | `character varying(60)` | no |  |  |
| 5 | `series` | `character varying(10)` | no | `'default'::character varying` |  |
| 6 | `prefix` | `character varying(30)` | no |  |  |
| 7 | `pad_width` | `smallint` | no | `5` |  |
| 8 | `next_number` | `bigint` | no | `1` |  |
| 9 | `year_reset` | `boolean` | no | `true` |  |
| 10 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_sys_sequences_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_sys_sequences_tenant_id_doc_type_series` | `tenant_id, doc_type, series` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `sys_sequences_next_number_check` | `CHECK ((next_number > 0))` |  |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_sys_sequences_no_decrease` | BEFORE UPDATE | `app_sequence_no_decrease` |
| `trg_sys_sequences_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `sys_settings`

[Spec 09 §3.8] [Fase 0] Configuración del tenant por sección (JSONB validado por FormRequest).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Sistema (sys_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). PK. FK → tenants.id. |
| 2 | `section` | `character varying(30)` | no |  | PK. Valores: `general`, `currency`, `policies`, `operations`, `channels`, `notifications`, `travel_docs`, `ecommerce`, `own_reviews`, `rules`. |
| 3 | `values` | `jsonb` | no | `'{}'::jsonb` |  |
| 4 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 5 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 6 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |

**PK:** `tenant_id, section`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_sys_settings_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `sys_settings_section_check` | `CHECK (((section)::text = ANY ((ARRAY['general'::character varying, 'currency'::character varying, 'policies'::character varying, 'operations'::character varying, 'channels'::character varying, 'notifications'::character varying, 'travel_docs'::character varying, 'ecommerce'::character varying, 'own_reviews'::character varying, 'rules'::character varying])::text[])))` | `section`: `general`, `currency`, `policies`, `operations`, `channels`, `notifications`, `travel_docs`, `ecommerce`, `own_reviews`, `rules` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_sys_settings_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_sys_settings_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `sys_holidays`

[Spec 12 §3.11] [Fase 1] Feriados (tenant NULL = nacionales) para plazos hábiles.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Sistema (sys_) | Fase 1 · MVP (`20_fase1.sql`) | shared (tenant + filas globales de solo lectura) · FORCE | `platform_access`, `tenant_isolation`, `tenant_shared_read` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | sí | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `date` | `date` | no |  |  |
| 4 | `name` | `character varying(120)` | no |  |  |
| 5 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 6 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 7 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 8 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_sys_holidays_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_sys_holidays_tenant_id_date_p` | `tenant_id, date` |  | índice único |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_sys_holidays_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `sys_booking_rules`

[Spec 17 §3.1 + 16 §3.1] [Fase 2] Centro de reglas del tenant (copia del catálogo de plataforma).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Sistema (sys_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(40)` | no |  |  |
| 4 | `rule_group` | `character varying(40)` | no |  |  |
| 5 | `name` | `character varying(160)` | no |  |  |
| 6 | `description` | `text` | no |  |  |
| 7 | `enabled` | `boolean` | no | `false` |  |
| 8 | `params` | `jsonb` | no | `'{}'::jsonb` |  |
| 9 | `params_schema` | `jsonb` | no | `'{}'::jsonb` |  |
| 10 | `scope` | `text[]` | no | `'{}'::text[]` |  |
| 11 | `product_override` | `boolean` | no | `false` |  |
| 12 | `is_custom` | `boolean` | no | `false` |  |
| 13 | `depends_on` | `character varying(40)` | sí |  |  |
| 14 | `min_plan` | `character varying(20)` | no | `'Starter'::character varying` | Valores: `Starter`, `Professional`, `Enterprise`. |
| 15 | `sort_order` | `smallint` | no | `0` |  |
| 16 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 17 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 18 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 19 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 20 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_sys_booking_rules_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_sys_booking_rules_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_sys_booking_rules_1` | `CHECK ((is_custom OR ((rule_group)::text = ANY ((ARRAY['Disponibilidad'::character varying, 'Pasajeros'::character varying, 'Alojamiento'::character varying, 'Adicionales'::character varying, 'Precios'::character varying, 'Monedas y pagos'::character varying, 'Checkout'::character varying, 'Comunicación'::character varying])::text[]))))` |  |
| `sys_booking_rules_code_check` | `CHECK (((code)::text ~ '^R-[A-Z0-9-]{2,38}$'::text))` |  |
| `sys_booking_rules_min_plan_check` | `CHECK (((min_plan)::text = ANY ((ARRAY['Starter'::character varying, 'Professional'::character varying, 'Enterprise'::character varying])::text[])))` | `min_plan`: `Starter`, `Professional`, `Enterprise` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_sys_booking_rules_scope` | `USING gin (scope)` |
| `ix_sys_booking_rules_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_sys_booking_rules_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_sys_booking_rules_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)
