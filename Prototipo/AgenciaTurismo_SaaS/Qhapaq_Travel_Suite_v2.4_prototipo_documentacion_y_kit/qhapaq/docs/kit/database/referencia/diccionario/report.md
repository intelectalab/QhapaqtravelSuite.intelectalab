# Diccionario de datos · Reportes (report_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.13 tras cargar `00`→`90`. No editar a mano._

Exportaciones de reportes.

1 tablas · 19 columnas · 3 claves foráneas. Diagrama ER: [`../er/report.svg`](../er/report.svg) (fuente [`../er/report.mmd`](../er/report.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`report_exports`](#report_exports) | Fase 1 · MVP | tenant | 19 | 3 | [Spec 09 §3.16] [Fase 1] Exportaciones de reportes (PROC-061). |

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
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
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
| `requested_by` | `iam_users.id` | NO ACTION | `fk_report_exports_requested_by` |
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

[↑ Índice del dominio](#tablas)
