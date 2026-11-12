# Diccionario de datos · Reportes (report_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.15 tras cargar `00`→`90`. No editar a mano._

Exportaciones de reportes.

3 tablas · 52 columnas · 11 claves foráneas. Diagrama ER: [`../er/report.svg`](../er/report.svg) (fuente [`../er/report.mmd`](../er/report.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`report_exports`](#report_exports) | Fase 1 · MVP | tenant | 19 | 3 | [Spec 09 §3.16] [Fase 1] Exportaciones de reportes (PROC-061). |
| [`report_ai_insights`](#report_ai_insights) | Fase 3 · SaaS y crecimiento | tenant | 16 | 3 | [Spec 19 §3.13] [Fase 3] Alertas de rentabilidad generadas por IA (margen bajo, proveedor caro, meta en riesgo, cobranza). |
| [`report_corporate_exports`](#report_corporate_exports) | Fase 3 · SaaS y crecimiento | tenant | 17 | 5 | [Spec 20 §3.8] [Fase 3] Exportaciones de reportes del portal corporativo en Excel, PDF o CSV. |

## Detalle por tabla

### `report_exports`

[Spec 09 §3.16] [Fase 1] Exportaciones de reportes (PROC-061).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reportes (report_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, tenants.id. |
| 3 | `code` | `character varying(20)` | sí |  |  |
| 4 | `report_name` | `character varying(200)` | no |  |  |
| 5 | `report_key` | `character varying(40)` | no |  |  |
| 6 | `filters` | `jsonb` | no | `'{}'::jsonb` |  |
| 7 | `scope` | `character varying(20)` | no | `'filtered'::character varying` | Valores: `filtered`, `detailed`. |
| 8 | `format` | `character varying(10)` | no |  | Valores: `CSV`, `XLSX`, `PDF`. |
| 9 | `rows_count` | `integer` | sí |  |  |
| 10 | `size_bytes` | `bigint` | sí |  |  |
| 11 | `file_path` | `character varying(255)` | sí |  |  |
| 12 | `status` | `character varying(20)` | no | `'en_cola'::character varying` | Valores: `en_cola`, `procesando`, `disponible`, `fallido`, `expirado`. |
| 13 | `requested_by` | `uuid` | sí |  | FK → iam_users.id. |
| 14 | `scheduled_job_id` | `uuid` | sí |  | FK → sys_scheduled_jobs.id. |
| 15 | `idempotency_key` | `character varying(80)` | sí |  |  |
| 16 | `expires_at` | `timestamp with time zone` | no | `(now() + '7 days'::interval)` |  |
| 17 | `finished_at` | `timestamp with time zone` | sí |  |  |
| 18 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 19 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, requested_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_report_exports_requested_by` |
| `scheduled_job_id` | `sys_scheduled_jobs.id` | NO ACTION | `fk_report_exports_scheduled_job_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_report_exports_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_report_exports_tenant_id_idempotency_key_p` | `tenant_id, idempotency_key` | `(idempotency_key IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `report_exports_format_check` | `CHECK (((format)::text = ANY ((ARRAY['CSV'::character varying, 'XLSX'::character varying, 'PDF'::character varying])::text[])))` | `format`: `CSV`, `XLSX`, `PDF` |
| `report_exports_scope_check` | `CHECK (((scope)::text = ANY ((ARRAY['filtered'::character varying, 'detailed'::character varying])::text[])))` | `scope`: `filtered`, `detailed` |
| `report_exports_status_check` | `CHECK (((status)::text = ANY ((ARRAY['en_cola'::character varying, 'procesando'::character varying, 'disponible'::character varying, 'fallido'::character varying, 'expirado'::character varying])::text[])))` | `status`: `en_cola`, `procesando`, `disponible`, `fallido`, `expirado` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_report_exports_requested_by` | `USING btree (requested_by)` |
| `ix_report_exports_scheduled_job_id` | `USING btree (scheduled_job_id)` |
| `ix_report_exports_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_report_exports_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_fk_tenant_report_exports_scheduled_job_id` | BEFORE INSERT OR UPDATE OF scheduled_job_id, tenant_id | `app_check_fk_tenant` |

[↑ Índice del dominio](#tablas)

### `report_ai_insights`

[Spec 19 §3.13] [Fase 3] Alertas de rentabilidad generadas por IA (margen bajo, proveedor caro, meta en riesgo, cobranza).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reportes (report_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → sys_ai_requests.tenant_id, iam_users.tenant_id, tenants.id. |
| 3 | `kind` | `character varying(30)` | no |  | Valores: `margen_bajo`, `proveedor_caro`, `meta_en_riesgo`, `cobranza_atrasada`, `demanda_alta`. |
| 4 | `severity` | `character varying(10)` | no | `'media'::character varying` | Valores: `baja`, `media`, `alta`. |
| 5 | `title` | `character varying(160)` | no |  |  |
| 6 | `detail` | `text` | no |  |  |
| 7 | `source_type` | `character varying(40)` | sí |  |  |
| 8 | `source_id` | `uuid` | sí |  |  |
| 9 | `metric` | `jsonb` | no | `'{}'::jsonb` |  |
| 10 | `audience_user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 11 | `status` | `character varying(12)` | no | `'nueva'::character varying` | Valores: `nueva`, `vista`, `resuelta`, `descartada`. |
| 12 | `ai_request_id` | `uuid` | sí |  | FK → sys_ai_requests.id. |
| 13 | `generated_at` | `timestamp with time zone` | no | `now()` |  |
| 14 | `resolved_at` | `timestamp with time zone` | sí |  |  |
| 15 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 16 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, ai_request_id` | `sys_ai_requests.tenant_id, id` | NO ACTION | `fk_report_ai_insights_ai_request_id` |
| `tenant_id, audience_user_id` | `iam_users.tenant_id, id` | NO ACTION | `fk_report_ai_insights_audience_user_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_report_ai_insights_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `report_ai_insights_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['margen_bajo'::character varying, 'proveedor_caro'::character varying, 'meta_en_riesgo'::character varying, 'cobranza_atrasada'::character varying, 'demanda_alta'::character varying])::text[])))` | `kind`: `margen_bajo`, `proveedor_caro`, `meta_en_riesgo`, `cobranza_atrasada`, `demanda_alta` |
| `report_ai_insights_severity_check` | `CHECK (((severity)::text = ANY ((ARRAY['baja'::character varying, 'media'::character varying, 'alta'::character varying])::text[])))` | `severity`: `baja`, `media`, `alta` |
| `report_ai_insights_status_check` | `CHECK (((status)::text = ANY ((ARRAY['nueva'::character varying, 'vista'::character varying, 'resuelta'::character varying, 'descartada'::character varying])::text[])))` | `status`: `nueva`, `vista`, `resuelta`, `descartada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_report_ai_insights_ai_request_id` | `USING btree (ai_request_id)` |
| `ix_report_ai_insights_audience_user_id` | `USING btree (audience_user_id)` |
| `ix_report_ai_insights_tenant_id_status_generated_at_desc` | `USING btree (tenant_id, status, generated_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_report_ai_insights_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `report_corporate_exports`

[Spec 20 §3.8] [Fase 3] Exportaciones de reportes del portal corporativo en Excel, PDF o CSV.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reportes (report_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → crm_corporate_accounts.tenant_id, sys_documents.tenant_id, crm_corporate_portal_users.tenant_id, iam_users.tenant_id, tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `account_id` | `uuid` | no |  | FK → crm_corporate_accounts.id. |
| 5 | `requested_by_portal_user_id` | `uuid` | sí |  | FK → crm_corporate_portal_users.id. |
| 6 | `requested_by_user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 7 | `report_type` | `character varying(20)` | no |  | Valores: `compras`, `movimientos`, `centro_costo`, `viajeros`, `estado_cuenta`, `aprobaciones`. |
| 8 | `filters` | `jsonb` | no | `'{}'::jsonb` |  |
| 9 | `format` | `character varying(5)` | no |  | Valores: `xlsx`, `pdf`, `csv`. |
| 10 | `status` | `character varying(12)` | no | `'en_cola'::character varying` | Valores: `en_cola`, `procesando`, `listo`, `fallido`, `vencido`. |
| 11 | `row_count` | `integer` | sí |  |  |
| 12 | `document_id` | `uuid` | sí |  | FK → sys_documents.id. |
| 13 | `error` | `text` | sí |  |  |
| 14 | `completed_at` | `timestamp with time zone` | sí |  |  |
| 15 | `expires_at` | `timestamp with time zone` | sí |  |  |
| 16 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 17 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, account_id` | `crm_corporate_accounts.tenant_id, id` | NO ACTION | `fk_report_corporate_exports_account_id` |
| `tenant_id, document_id` | `sys_documents.tenant_id, id` | NO ACTION | `fk_report_corporate_exports_document_id` |
| `tenant_id, requested_by_portal_user_id` | `crm_corporate_portal_users.tenant_id, id` | NO ACTION | `fk_report_corporate_exports_requested_by_portal_user_id` |
| `tenant_id, requested_by_user_id` | `iam_users.tenant_id, id` | NO ACTION | `fk_report_corporate_exports_requested_by_user_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_report_corporate_exports_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_report_corporate_exports_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_report_corporate_exports_1` | `CHECK ((num_nonnulls(requested_by_portal_user_id, requested_by_user_id) >= 1))` |  |
| `ck_report_corporate_exports_2` | `CHECK ((((status)::text <> 'listo'::text) OR ((document_id IS NOT NULL) AND (completed_at IS NOT NULL))))` |  |
| `report_corporate_exports_format_check` | `CHECK (((format)::text = ANY ((ARRAY['xlsx'::character varying, 'pdf'::character varying, 'csv'::character varying])::text[])))` | `format`: `xlsx`, `pdf`, `csv` |
| `report_corporate_exports_report_type_check` | `CHECK (((report_type)::text = ANY ((ARRAY['compras'::character varying, 'movimientos'::character varying, 'centro_costo'::character varying, 'viajeros'::character varying, 'estado_cuenta'::character varying, 'aprobaciones'::character varying])::text[])))` | `report_type`: `compras`, `movimientos`, `centro_costo`, `viajeros`, `estado_cuenta`, `aprobaciones` |
| `report_corporate_exports_row_count_check` | `CHECK (((row_count IS NULL) OR (row_count >= 0)))` |  |
| `report_corporate_exports_status_check` | `CHECK (((status)::text = ANY ((ARRAY['en_cola'::character varying, 'procesando'::character varying, 'listo'::character varying, 'fallido'::character varying, 'vencido'::character varying])::text[])))` | `status`: `en_cola`, `procesando`, `listo`, `fallido`, `vencido` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_report_corporate_exports_account_id` | `USING btree (account_id, created_at DESC)` |
| `ix_report_corporate_exports_document_id` | `USING btree (document_id)` |
| `ix_report_corporate_exports_requested_by_portal_user_id` | `USING btree (requested_by_portal_user_id)` |
| `ix_report_corporate_exports_requested_by_user_id` | `USING btree (requested_by_user_id)` |
| `ix_report_corporate_exports_status` | `USING btree (tenant_id, status, expires_at)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_report_corporate_exports_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)
