# Diccionario de datos · CRM (crm_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.13 tras cargar `00`→`90`. No editar a mano._

Clientes, leads, oportunidades, actividades, postventa, reclamaciones, metas y reseñas propias.

20 tablas · 368 columnas · 71 claves foráneas. Diagrama ER: [`../er/crm.svg`](../er/crm.svg) (fuente [`../er/crm.mmd`](../er/crm.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`crm_activities`](#crm_activities) | Fase 1 · MVP | tenant | 21 | 5 | [Spec 01 §3.8] [Fase 1] Actividades comerciales (llamadas, reuniones, tareas…). |
| [`crm_case_events`](#crm_case_events) | Fase 1 · MVP | tenant | 10 | 3 | [Spec 01 §3.11 + 12 §3.10] [Fase 1] Bitácora del caso / hoja de reclamación (append-only). |
| [`crm_cases`](#crm_cases) | Fase 1 · MVP | tenant | 37 | 7 | [Spec 01 §3.10 + 12 §3.10] [Fase 1] Casos de postventa y hojas del Libro de Reclamaciones (is_book). |
| [`crm_catalog_items`](#crm_catalog_items) | Fase 1 · MVP | tenant | 12 | 1 | [Spec 01 §3.1] [Fase 1] Catálogos configurables del CRM (fuentes, canales, motivos…). |
| [`crm_claim_book_settings`](#crm_claim_book_settings) | Fase 1 · MVP | tenant | 9 | 1 | [Spec 12 §3.11] [Fase 1] Parámetros del Libro de Reclamaciones (1 fila por tenant). |
| [`crm_client_contacts`](#crm_client_contacts) | Fase 1 · MVP | tenant | 13 | 3 | [Spec 01 §3.5] [Fase 1] Contactos del cliente. |
| [`crm_clients`](#crm_clients) | Fase 1 · MVP | tenant | 26 | 4 | [Spec 01 §3.4] [Fase 1] Clientes (personas y empresas). |
| [`crm_lead_qualifications`](#crm_lead_qualifications) | Fase 1 · MVP | tenant | 17 | 3 | [Spec 01 §3.3] [Fase 1] Historial BANT del lead (vigente = último). |
| [`crm_leads`](#crm_leads) | Fase 1 · MVP | tenant | 46 | 9 | [Spec 01 §3.2] [Fase 1] Leads comerciales. |
| [`crm_opportunities`](#crm_opportunities) | Fase 1 · MVP | tenant | 27 | 5 | [Spec 01 §3.7] [Fase 1] Oportunidades de venta. |
| [`crm_pipeline_stages`](#crm_pipeline_stages) | Fase 1 · MVP | tenant | 11 | 1 | [Spec 01 §3.6] [Fase 1] Etapas del embudo de oportunidades. |
| [`crm_surveys`](#crm_surveys) | Fase 1 · MVP | tenant | 15 | 4 | [Spec 01 §3.9] [Fase 1] Encuestas NPS. |
| [`crm_own_review_log`](#crm_own_review_log) | Fase 3 · SaaS y crecimiento | tenant | 7 | 3 | [Spec 18 §3.2] [Fase 3] Historial de moderación de la reseña. |
| [`crm_own_reviews`](#crm_own_reviews) | Fase 3 · SaaS y crecimiento | tenant | 36 | 8 | [Spec 18 §3.1] [Fase 3] Reseñas propias verificadas por reserva. |
| [`crm_review_requests`](#crm_review_requests) | Fase 3 · SaaS y crecimiento | tenant | 20 | 3 | [Spec 18 §3.3] [Fase 3] Solicitudes de reseña post-viaje. |
| [`crm_sales_target_adjustments`](#crm_sales_target_adjustments) | Fase 3 · SaaS y crecimiento | tenant | 9 | 3 | [Spec 14 §3.15] [Fase 3] Historial de ajustes de la meta. |
| [`crm_sales_target_policies`](#crm_sales_target_policies) | Fase 3 · SaaS y crecimiento | tenant | 10 | 1 | [Spec 14 §3.16] [Fase 3] Política de metas y bonos (1 fila por tenant). |
| [`crm_sales_targets`](#crm_sales_targets) | Fase 3 · SaaS y crecimiento | tenant | 23 | 2 | [Spec 14 §3.14] [Fase 3] Metas comerciales por asesor, sede o equipo. |
| [`crm_sales_team_members`](#crm_sales_team_members) | Fase 3 · SaaS y crecimiento | tenant | 10 | 3 | [Spec 14 §3.13] [Fase 3] Integrantes del equipo (vigencias). |
| [`crm_sales_teams`](#crm_sales_teams) | Fase 3 · SaaS y crecimiento | tenant | 9 | 2 | [Spec 14 §3.13] [Fase 3] Equipos de venta. |

## Detalle por tabla

### `crm_activities`

[Spec 01 §3.8] [Fase 1] Actividades comerciales (llamadas, reuniones, tareas…).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `type` | `character varying(20)` | no |  | Valores: `llamada`, `email`, `whatsapp`, `reunion`, `tarea`, `postventa`. |
| 5 | `subject` | `character varying(200)` | no |  |  |
| 6 | `description` | `text` | sí |  |  |
| 7 | `related_type` | `character varying(20)` | sí |  | Valores: `lead`, `opportunity`, `client`, `quote`, `reservation`. |
| 8 | `related_id` | `uuid` | sí |  |  |
| 9 | `owner_id` | `uuid` | no |  | FK → iam_users.id. |
| 10 | `due_at` | `timestamp with time zone` | no |  |  |
| 11 | `status` | `character varying(20)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `vencida`, `completada`. |
| 12 | `result` | `text` | sí |  |  |
| 13 | `completed_at` | `timestamp with time zone` | sí |  |  |
| 14 | `completed_by` | `uuid` | sí |  | FK → iam_users.id. |
| 15 | `auto_closed` | `boolean` | no | `false` |  |
| 16 | `previous_activity_id` | `uuid` | sí |  | FK → crm_activities.id. |
| 17 | `merged_from_lead_id` | `uuid` | sí |  | FK → crm_leads.id. |
| 18 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 19 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 20 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 21 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `completed_by` | `iam_users.id` | NO ACTION | `fk_crm_activities_completed_by` |
| `merged_from_lead_id` | `crm_leads.id` | NO ACTION | `fk_crm_activities_merged_from_lead_id` |
| `owner_id` | `iam_users.id` | NO ACTION | `fk_crm_activities_owner_id` |
| `previous_activity_id` | `crm_activities.id` | NO ACTION | `fk_crm_activities_previous_activity_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_activities_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_crm_activities_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_crm_activities_1` | `CHECK (((related_type IS NULL) = (related_id IS NULL)))` |  |
| `ck_crm_activities_2` | `CHECK ((((status)::text <> 'completada'::text) OR (result IS NOT NULL)))` |  |
| `crm_activities_related_type_check` | `CHECK (((related_type IS NULL) OR ((related_type)::text = ANY ((ARRAY['lead'::character varying, 'opportunity'::character varying, 'client'::character varying, 'quote'::character varying, 'reservation'::character varying])::text[]))))` | `related_type`: `lead`, `opportunity`, `client`, `quote`, `reservation` |
| `crm_activities_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'vencida'::character varying, 'completada'::character varying])::text[])))` | `status`: `pendiente`, `vencida`, `completada` |
| `crm_activities_type_check` | `CHECK (((type)::text = ANY ((ARRAY['llamada'::character varying, 'email'::character varying, 'whatsapp'::character varying, 'reunion'::character varying, 'tarea'::character varying, 'postventa'::character varying])::text[])))` | `type`: `llamada`, `email`, `whatsapp`, `reunion`, `tarea`, `postventa` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_activities_completed_by` | `USING btree (completed_by)` |
| `ix_crm_activities_merged_from_lead_id` | `USING btree (merged_from_lead_id)` |
| `ix_crm_activities_owner_id` | `USING btree (owner_id)` |
| `ix_crm_activities_previous_activity_id` | `USING btree (previous_activity_id)` |
| `ix_crm_activities_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_crm_activities_tenant_id_due_at_p` | `USING btree (tenant_id, due_at) WHERE ((status)::text <> 'completada'::text)` |
| `ix_crm_activities_tenant_id_owner_id` | `USING btree (tenant_id, owner_id)` |
| `ix_crm_activities_tenant_id_owner_id_status_due_at` | `USING btree (tenant_id, owner_id, status, due_at)` |
| `ix_crm_activities_tenant_id_related_type_related_id` | `USING btree (tenant_id, related_type, related_id)` |
| `ix_crm_activities_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_activities_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `crm_case_events`

[Spec 01 §3.11 + 12 §3.10] [Fase 1] Bitácora del caso / hoja de reclamación (append-only).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `case_id` | `uuid` | no |  | FK → crm_cases.id. |
| 4 | `event` | `character varying(20)` | no |  | Valores: `registro`, `estado`, `seguimiento`. |
| 5 | `from_status` | `character varying(20)` | sí |  |  |
| 6 | `to_status` | `character varying(20)` | sí |  |  |
| 7 | `message` | `text` | no |  |  |
| 8 | `user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `case_id` | `crm_cases.id` | NO ACTION | `fk_crm_case_events_case_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_case_events_tenant_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_crm_case_events_user_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `crm_case_events_event_check` | `CHECK (((event)::text = ANY ((ARRAY['registro'::character varying, 'estado'::character varying, 'seguimiento'::character varying])::text[])))` | `event`: `registro`, `estado`, `seguimiento` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_case_events_case_id` | `USING btree (case_id)` |
| `ix_crm_case_events_tenant_id` | `USING btree (tenant_id)` |
| `ix_crm_case_events_user_id` | `USING btree (user_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_case_events_append_only` | BEFORE DELETE OR UPDATE | `app_forbid_update_delete` |

[↑ Índice del dominio](#tablas)

### `crm_cases`

[Spec 01 §3.10 + 12 §3.10] [Fase 1] Casos de postventa y hojas del Libro de Reclamaciones (is_book).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `client_id` | `uuid` | sí |  | FK → crm_clients.id. |
| 5 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 6 | `survey_id` | `uuid` | sí |  | FK → crm_surveys.id. |
| 7 | `origin` | `character varying(20)` | no | `'manual'::character varying` | Valores: `manual`, `nps_auto`. |
| 8 | `type_code` | `character varying(40)` | no |  |  |
| 9 | `priority` | `character varying(10)` | no | `'media'::character varying` | Valores: `baja`, `media`, `alta`, `critica`. |
| 10 | `subject` | `character varying(200)` | no |  |  |
| 11 | `description` | `text` | no |  |  |
| 12 | `status` | `character varying(20)` | no | `'abierta'::character varying` | Valores: `abierta`, `en_proceso`, `resuelta`, `cerrada`. |
| 13 | `owner_id` | `uuid` | no |  | FK → iam_users.id. |
| 14 | `resolution` | `text` | sí |  |  |
| 15 | `resolved_at` | `timestamp with time zone` | sí |  |  |
| 16 | `closed_at` | `timestamp with time zone` | sí |  |  |
| 17 | `is_book` | `boolean` | no | `false` |  |
| 18 | `book_number` | `character varying(25)` | sí |  |  |
| 19 | `sede_id` | `uuid` | sí |  | FK → iam_sedes.id. |
| 20 | `channel` | `character varying(30)` | sí |  | Valores: `web`, `customer_portal`, `passenger_portal`, `in_person`. |
| 21 | `book_status` | `character varying(20)` | sí |  | Valores: `received`, `in_review`, `answered`, `closed`. |
| 22 | `consumer` | `text` | sí |  |  |
| 23 | `good` | `jsonb` | sí |  |  |
| 24 | `detail` | `text` | sí |  |  |
| 25 | `request` | `text` | sí |  |  |
| 26 | `received_at` | `timestamp with time zone` | sí |  |  |
| 27 | `due_date` | `date` | sí |  |  |
| 28 | `response_days` | `smallint` | sí |  |  |
| 29 | `response` | `jsonb` | sí |  |  |
| 30 | `close_note` | `text` | sí |  |  |
| 31 | `ack_sent_at` | `timestamp with time zone` | sí |  |  |
| 32 | `submitted_by` | `uuid` | sí |  | FK → iam_users.id. |
| 33 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 34 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 35 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 36 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 37 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `client_id` | `crm_clients.id` | NO ACTION | `fk_crm_cases_client_id` |
| `owner_id` | `iam_users.id` | NO ACTION | `fk_crm_cases_owner_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_crm_cases_reservation_id` |
| `sede_id` | `iam_sedes.id` | NO ACTION | `fk_crm_cases_sede_id` |
| `submitted_by` | `iam_users.id` | NO ACTION | `fk_crm_cases_submitted_by` |
| `survey_id` | `crm_surveys.id` | NO ACTION | `fk_crm_cases_survey_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_cases_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_crm_cases_tenant_id_book_number_p` | `tenant_id, book_number` | `(book_number IS NOT NULL)` | índice único |
| `uq_crm_cases_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_crm_cases_tenant_id_survey_id_p` | `tenant_id, survey_id` | `(survey_id IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_crm_cases_1` | `CHECK ((((status)::text <> 'resuelta'::text) OR (resolution IS NOT NULL)))` |  |
| `ck_crm_cases_2` | `CHECK (((NOT is_book) OR ((book_number IS NOT NULL) AND (sede_id IS NOT NULL) AND (book_status IS NOT NULL) AND (received_at IS NOT NULL) AND (due_date IS NOT NULL))))` |  |
| `ck_crm_cases_3` | `CHECK ((is_book OR (client_id IS NOT NULL)))` |  |
| `crm_cases_book_status_check` | `CHECK (((book_status IS NULL) OR ((book_status)::text = ANY ((ARRAY['received'::character varying, 'in_review'::character varying, 'answered'::character varying, 'closed'::character varying])::text[]))))` | `book_status`: `received`, `in_review`, `answered`, `closed` |
| `crm_cases_channel_check` | `CHECK (((channel IS NULL) OR ((channel)::text = ANY ((ARRAY['web'::character varying, 'customer_portal'::character varying, 'passenger_portal'::character varying, 'in_person'::character varying])::text[]))))` | `channel`: `web`, `customer_portal`, `passenger_portal`, `in_person` |
| `crm_cases_origin_check` | `CHECK (((origin)::text = ANY ((ARRAY['manual'::character varying, 'nps_auto'::character varying])::text[])))` | `origin`: `manual`, `nps_auto` |
| `crm_cases_priority_check` | `CHECK (((priority)::text = ANY ((ARRAY['baja'::character varying, 'media'::character varying, 'alta'::character varying, 'critica'::character varying])::text[])))` | `priority`: `baja`, `media`, `alta`, `critica` |
| `crm_cases_status_check` | `CHECK (((status)::text = ANY ((ARRAY['abierta'::character varying, 'en_proceso'::character varying, 'resuelta'::character varying, 'cerrada'::character varying])::text[])))` | `status`: `abierta`, `en_proceso`, `resuelta`, `cerrada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_cases_client_id` | `USING btree (client_id)` |
| `ix_crm_cases_owner_id` | `USING btree (owner_id)` |
| `ix_crm_cases_reservation_id` | `USING btree (reservation_id)` |
| `ix_crm_cases_sede_id` | `USING btree (sede_id)` |
| `ix_crm_cases_submitted_by` | `USING btree (submitted_by)` |
| `ix_crm_cases_survey_id` | `USING btree (survey_id)` |
| `ix_crm_cases_tenant_id_client_id` | `USING btree (tenant_id, client_id)` |
| `ix_crm_cases_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_crm_cases_tenant_id_due_date_p` | `USING btree (tenant_id, due_date) WHERE (is_book AND ((book_status)::text = ANY ((ARRAY['received'::character varying, 'in_review'::character varying])::text[])))` |
| `ix_crm_cases_tenant_id_is_book_book_status` | `USING btree (tenant_id, is_book, book_status)` |
| `ix_crm_cases_tenant_id_owner_id` | `USING btree (tenant_id, owner_id)` |
| `ix_crm_cases_tenant_id_sede_id` | `USING btree (tenant_id, sede_id)` |
| `ix_crm_cases_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_cases_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_crm_cases_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `crm_catalog_items`

[Spec 01 §3.1] [Fase 1] Catálogos configurables del CRM (fuentes, canales, motivos…).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `kind` | `character varying(30)` | no |  | Valores: `lead_source`, `lead_channel`, `lead_interest`, `client_segment`, `lost_reason`, `discard_reason`, `case_type`, `survey_channel`, `activity_type`. |
| 4 | `code` | `character varying(40)` | no |  |  |
| 5 | `label` | `character varying(120)` | no |  |  |
| 6 | `requires_detail` | `boolean` | no | `false` |  |
| 7 | `sort_order` | `smallint` | no | `0` |  |
| 8 | `is_active` | `boolean` | no | `true` |  |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 12 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_catalog_items_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_crm_catalog_items_tenant_id_kind_code` | `tenant_id, kind, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `crm_catalog_items_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['lead_source'::character varying, 'lead_channel'::character varying, 'lead_interest'::character varying, 'client_segment'::character varying, 'lost_reason'::character varying, 'discard_reason'::character varying, 'case_type'::character varying, 'survey_channel'::character varying, 'activity_type'::character varying])::text[])))` | `kind`: `lead_source`, `lead_channel`, `lead_interest`, `client_segment`, `lost_reason`, `discard_reason`, `case_type`, `survey_channel`, `activity_type` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_catalog_items_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_catalog_items_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `crm_claim_book_settings`

[Spec 12 §3.11] [Fase 1] Parámetros del Libro de Reclamaciones (1 fila por tenant).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `response_days` | `smallint` | no | `15` |  |
| 4 | `alert_days` | `smallint` | no | `3` |  |
| 5 | `retention_years` | `smallint` | no | `2` |  |
| 6 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 7 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 8 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 9 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_claim_book_settings_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_crm_claim_book_settings_tenant_id` | `tenant_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `crm_claim_book_settings_response_days_check` | `CHECK (((response_days >= 1) AND (response_days <= 30)))` |  |
| `crm_claim_book_settings_retention_years_check` | `CHECK ((retention_years >= 2))` |  |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_claim_book_settings_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `crm_client_contacts`

[Spec 01 §3.5] [Fase 1] Contactos del cliente.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `client_id` | `uuid` | no |  | FK → crm_clients.id. |
| 4 | `name` | `character varying(160)` | no |  |  |
| 5 | `role` | `character varying(120)` | sí |  |  |
| 6 | `email` | `character varying(190)` | sí |  |  |
| 7 | `phone` | `character varying(40)` | sí |  |  |
| 8 | `is_primary` | `boolean` | no | `false` |  |
| 9 | `source_lead_id` | `uuid` | sí |  | FK → crm_leads.id. |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 13 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `client_id` | `crm_clients.id` | NO ACTION | `fk_crm_client_contacts_client_id` |
| `source_lead_id` | `crm_leads.id` | NO ACTION | `fk_crm_client_contacts_source_lead_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_client_contacts_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_crm_client_contacts_client_id_p` | `client_id` | `is_primary` | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_client_contacts_client_id` | `USING btree (client_id)` |
| `ix_crm_client_contacts_source_lead_id` | `USING btree (source_lead_id)` |
| `ix_crm_client_contacts_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_client_contacts_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `crm_clients`

[Spec 01 §3.4] [Fase 1] Clientes (personas y empresas).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `kind` | `character varying(10)` | no |  | Valores: `persona`, `empresa`. |
| 5 | `name` | `character varying(200)` | no |  |  |
| 6 | `doc_type` | `character varying(10)` | no |  | Valores: `DNI`, `RUC`, `PASAPORTE`, `CE`. |
| 7 | `doc_number` | `character varying(20)` | no |  |  |
| 8 | `email` | `character varying(190)` | sí |  |  |
| 9 | `email_norm` | `character varying(190)` | sí | `generada: lower(TRIM(BOTH FROM email))` |  |
| 10 | `phone` | `character varying(40)` | sí |  |  |
| 11 | `phone_norm` | `character varying(9)` | sí |  |  |
| 12 | `country` | `character varying(80)` | no | `'Perú'::character varying` |  |
| 13 | `city` | `character varying(80)` | sí |  |  |
| 14 | `birth_date` | `date` | sí |  |  |
| 15 | `segment_code` | `character varying(40)` | no |  |  |
| 16 | `owner_id` | `uuid` | no |  | FK → iam_users.id. |
| 17 | `tags` | `text[]` | no | `'{}'::text[]` |  |
| 18 | `nps_last` | `smallint` | sí |  |  |
| 19 | `source_lead_id` | `uuid` | sí |  | FK → crm_leads.id. |
| 20 | `b2b_agency_id` | `uuid` | sí |  | FK → channel_b2b_agencies.id. |
| 21 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 22 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 23 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 24 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 25 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |
| 26 | `consents` | `jsonb` | sí |  | Columnas agregadas en Fase 2 por spec 15 §3.10 [Agregada en `30_fase2.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `b2b_agency_id` | `channel_b2b_agencies.id` | NO ACTION | `fk_crm_clients_b2b_agency_id` |
| `owner_id` | `iam_users.id` | NO ACTION | `fk_crm_clients_owner_id` |
| `source_lead_id` | `crm_leads.id` | NO ACTION | `fk_crm_clients_source_lead_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_clients_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_crm_clients_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_crm_clients_tenant_id_doc_type_doc_number_p` | `tenant_id, doc_type, doc_number` | `(deleted_at IS NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_crm_clients_1` | `CHECK (((email IS NOT NULL) OR (phone IS NOT NULL)))` |  |
| `ck_crm_clients_2` | `CHECK ((((kind)::text <> 'empresa'::text) OR ((country)::text <> 'Perú'::text) OR ((doc_type)::text = 'RUC'::text)))` |  |
| `crm_clients_doc_number_check` | `CHECK (((doc_number)::text !~ '\s'::text))` |  |
| `crm_clients_doc_type_check` | `CHECK (((doc_type)::text = ANY ((ARRAY['DNI'::character varying, 'RUC'::character varying, 'PASAPORTE'::character varying, 'CE'::character varying])::text[])))` | `doc_type`: `DNI`, `RUC`, `PASAPORTE`, `CE` |
| `crm_clients_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['persona'::character varying, 'empresa'::character varying])::text[])))` | `kind`: `persona`, `empresa` |
| `crm_clients_nps_last_check` | `CHECK (((nps_last >= 0) AND (nps_last <= 10)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_clients_b2b_agency_id` | `USING btree (b2b_agency_id)` |
| `ix_crm_clients_owner_id` | `USING btree (owner_id)` |
| `ix_crm_clients_source_lead_id` | `USING btree (source_lead_id)` |
| `ix_crm_clients_tags` | `USING gin (tags)` |
| `ix_crm_clients_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_crm_clients_tenant_id_email_norm` | `USING btree (tenant_id, email_norm)` |
| `ix_crm_clients_tenant_id_owner_id` | `USING btree (tenant_id, owner_id)` |
| `ix_crm_clients_tenant_id_phone_norm` | `USING btree (tenant_id, phone_norm)` |
| `ix_crm_clients_tenant_id_segment_code` | `USING btree (tenant_id, segment_code)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_clients_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `crm_lead_qualifications`

[Spec 01 §3.3] [Fase 1] Historial BANT del lead (vigente = último).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `lead_id` | `uuid` | no |  | FK → crm_leads.id. |
| 4 | `budget` | `smallint` | no |  | Valores: `0`, `10`, `18`, `25`. |
| 5 | `authority` | `smallint` | no |  | Valores: `0`, `10`, `18`, `25`. |
| 6 | `need` | `smallint` | no |  | Valores: `0`, `10`, `18`, `25`. |
| 7 | `timeline` | `smallint` | no |  | Valores: `0`, `10`, `18`, `25`. |
| 8 | `score` | `smallint` | sí | `generada: (((budget + authority) + need) + timeline)` |  |
| 9 | `declared_amount` | `numeric(14,2)` | sí |  |  |
| 10 | `currency` | `character(3)` | sí |  | Valores: `PEN`, `USD`. |
| 11 | `notes` | `text` | sí |  |  |
| 12 | `qualified_by` | `uuid` | no |  | FK → iam_users.id. |
| 13 | `qualified_at` | `timestamp with time zone` | no | `now()` |  |
| 14 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 15 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 16 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 17 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `lead_id` | `crm_leads.id` | NO ACTION | `fk_crm_lead_qualifications_lead_id` |
| `qualified_by` | `iam_users.id` | NO ACTION | `fk_crm_lead_qualifications_qualified_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_lead_qualifications_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `crm_lead_qualifications_authority_check` | `CHECK ((authority = ANY (ARRAY[0, 10, 18, 25])))` | `authority`: `0`, `10`, `18`, `25` |
| `crm_lead_qualifications_budget_check` | `CHECK ((budget = ANY (ARRAY[0, 10, 18, 25])))` | `budget`: `0`, `10`, `18`, `25` |
| `crm_lead_qualifications_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `crm_lead_qualifications_declared_amount_check` | `CHECK ((declared_amount >= (0)::numeric))` |  |
| `crm_lead_qualifications_need_check` | `CHECK ((need = ANY (ARRAY[0, 10, 18, 25])))` | `need`: `0`, `10`, `18`, `25` |
| `crm_lead_qualifications_timeline_check` | `CHECK ((timeline = ANY (ARRAY[0, 10, 18, 25])))` | `timeline`: `0`, `10`, `18`, `25` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_lead_qualifications_lead_id` | `USING btree (lead_id)` |
| `ix_crm_lead_qualifications_qualified_by` | `USING btree (qualified_by)` |
| `ix_crm_lead_qualifications_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_lead_qualifications_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `crm_leads`

[Spec 01 §3.2] [Fase 1] Leads comerciales.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `full_name` | `character varying(160)` | no |  |  |
| 5 | `company` | `character varying(160)` | sí |  |  |
| 6 | `email` | `character varying(190)` | sí |  |  |
| 7 | `email_norm` | `character varying(190)` | sí | `generada: lower(TRIM(BOTH FROM email))` |  |
| 8 | `phone` | `character varying(40)` | sí |  |  |
| 9 | `phone_norm` | `character varying(9)` | sí |  |  |
| 10 | `channel_code` | `character varying(40)` | no |  |  |
| 11 | `source_code` | `character varying(40)` | no |  |  |
| 12 | `interest_code` | `character varying(40)` | no |  |  |
| 13 | `destination_id` | `uuid` | sí |  | FK → catalog_destinations.id. |
| 14 | `destination_label` | `character varying(120)` | sí |  |  |
| 15 | `product_id` | `uuid` | sí |  | FK → catalog_products.id. |
| 16 | `travel_date` | `date` | sí |  |  |
| 17 | `pax` | `smallint` | no | `0` |  |
| 18 | `status` | `character varying(30)` | no | `'nuevo'::character varying` | Valores: `nuevo`, `contactado`, `calificado`, `convertido`, `duplicado`, `descartado`. |
| 19 | `owner_id` | `uuid` | sí |  | FK → iam_users.id. |
| 20 | `score` | `smallint` | no | `0` |  |
| 21 | `notes` | `text` | sí |  |  |
| 22 | `duplicate_of_type` | `character varying(10)` | sí |  | Valores: `lead`, `client`. |
| 23 | `duplicate_of_id` | `uuid` | sí |  |  |
| 24 | `validated_at` | `timestamp with time zone` | no | `now()` |  |
| 25 | `assigned_at` | `timestamp with time zone` | sí |  |  |
| 26 | `taken_by` | `uuid` | sí |  | FK → iam_users.id. |
| 27 | `first_contact_at` | `timestamp with time zone` | sí |  |  |
| 28 | `discard_reason_code` | `character varying(40)` | sí |  |  |
| 29 | `discard_detail` | `text` | sí |  |  |
| 30 | `discarded_at` | `timestamp with time zone` | sí |  |  |
| 31 | `discarded_at_step` | `smallint` | sí |  |  |
| 32 | `converted_client_id` | `uuid` | sí |  | FK → crm_clients.id. |
| 33 | `converted_opportunity_id` | `uuid` | sí |  | FK → crm_opportunities.id. |
| 34 | `converted_at` | `timestamp with time zone` | sí |  |  |
| 35 | `converted_by` | `uuid` | sí |  | FK → iam_users.id. |
| 36 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 37 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 38 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 39 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 40 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 41 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |
| 42 | `web_request` | `jsonb` | sí |  | Columnas agregadas en Fase 2 por spec 15 §3.9 [Agregada en `30_fase2.sql`] |
| 43 | `matched_client_id` | `uuid` | sí |  | Columnas agregadas en Fase 2 por spec 15 §3.9 FK → crm_clients.id. [Agregada en `30_fase2.sql`] |
| 44 | `sla_due_at` | `timestamp with time zone` | sí |  | Columnas agregadas en Fase 2 por spec 15 §3.9 [Agregada en `30_fase2.sql`] |
| 45 | `consent` | `jsonb` | sí |  | Columnas agregadas en Fase 2 por spec 15 §3.9 [Agregada en `30_fase2.sql`] |
| 46 | `utm_campaign` | `character varying(40)` | sí |  | Columnas agregadas en Fase 3 por spec 14 §3.17 [Agregada en `40_fase3.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `converted_by` | `iam_users.id` | NO ACTION | `fk_crm_leads_converted_by` |
| `converted_client_id` | `crm_clients.id` | NO ACTION | `fk_crm_leads_converted_client_id` |
| `converted_opportunity_id` | `crm_opportunities.id` | NO ACTION | `fk_crm_leads_converted_opportunity_id` |
| `destination_id` | `catalog_destinations.id` | NO ACTION | `fk_crm_leads_destination_id` |
| `matched_client_id` | `crm_clients.id` | NO ACTION | `fk_crm_leads_matched_client_id` |
| `owner_id` | `iam_users.id` | NO ACTION | `fk_crm_leads_owner_id` |
| `product_id` | `catalog_products.id` | NO ACTION | `fk_crm_leads_product_id` |
| `taken_by` | `iam_users.id` | NO ACTION | `fk_crm_leads_taken_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_leads_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_crm_leads_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_crm_leads_1` | `CHECK (((email IS NOT NULL) OR (phone IS NOT NULL)))` |  |
| `ck_crm_leads_2` | `CHECK ((((status)::text <> 'convertido'::text) OR ((converted_client_id IS NOT NULL) AND (converted_opportunity_id IS NOT NULL))))` |  |
| `ck_crm_leads_3` | `CHECK ((((status)::text <> 'descartado'::text) OR (discard_reason_code IS NOT NULL)))` |  |
| `ck_crm_leads_4` | `CHECK (((duplicate_of_type IS NULL) = (duplicate_of_id IS NULL)))` |  |
| `ck_crm_leads_5` | `CHECK ((((status)::text = 'nuevo'::text) OR (owner_id IS NOT NULL) OR ((status)::text = ANY ((ARRAY['duplicado'::character varying, 'descartado'::character varying])::text[]))))` |  |
| `crm_leads_discarded_at_step_check` | `CHECK (((discarded_at_step >= 0) AND (discarded_at_step <= 7)))` |  |
| `crm_leads_duplicate_of_type_check` | `CHECK (((duplicate_of_type IS NULL) OR ((duplicate_of_type)::text = ANY ((ARRAY['lead'::character varying, 'client'::character varying])::text[]))))` | `duplicate_of_type`: `lead`, `client` |
| `crm_leads_pax_check` | `CHECK ((pax >= 0))` |  |
| `crm_leads_score_check` | `CHECK (((score >= 0) AND (score <= 100)))` |  |
| `crm_leads_status_check` | `CHECK (((status)::text = ANY ((ARRAY['nuevo'::character varying, 'contactado'::character varying, 'calificado'::character varying, 'convertido'::character varying, 'duplicado'::character varying, 'descartado'::character varying])::text[])))` | `status`: `nuevo`, `contactado`, `calificado`, `convertido`, `duplicado`, `descartado` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_leads_converted_by` | `USING btree (converted_by)` |
| `ix_crm_leads_converted_client_id` | `USING btree (converted_client_id)` |
| `ix_crm_leads_converted_opportunity_id` | `USING btree (converted_opportunity_id)` |
| `ix_crm_leads_destination_id` | `USING btree (destination_id)` |
| `ix_crm_leads_matched_client_id` | `USING btree (matched_client_id)` |
| `ix_crm_leads_owner_id` | `USING btree (owner_id)` |
| `ix_crm_leads_product_id` | `USING btree (product_id)` |
| `ix_crm_leads_taken_by` | `USING btree (taken_by)` |
| `ix_crm_leads_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_crm_leads_tenant_id_created_at_p` | `USING btree (tenant_id, created_at) WHERE ((owner_id IS NULL) AND ((status)::text = ANY ((ARRAY['nuevo'::character varying, 'contactado'::character varying])::text[])))` |
| `ix_crm_leads_tenant_id_email_norm` | `USING btree (tenant_id, email_norm)` |
| `ix_crm_leads_tenant_id_owner_id` | `USING btree (tenant_id, owner_id)` |
| `ix_crm_leads_tenant_id_phone_norm` | `USING btree (tenant_id, phone_norm)` |
| `ix_crm_leads_tenant_id_source_code` | `USING btree (tenant_id, source_code)` |
| `ix_crm_leads_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_leads_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_crm_leads_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `crm_opportunities`

[Spec 01 §3.7] [Fase 1] Oportunidades de venta.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `client_id` | `uuid` | no |  | FK → crm_clients.id. |
| 5 | `title` | `character varying(200)` | no |  |  |
| 6 | `stage` | `character varying(30)` | no | `'descubrimiento'::character varying` | Valores: `calificacion`, `descubrimiento`, `cotizacion`, `negociacion`, `ganada`, `perdida`. |
| 7 | `amount` | `numeric(14,2)` | no |  |  |
| 8 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 9 | `probability` | `smallint` | no |  |  |
| 10 | `expected_close_date` | `date` | no |  |  |
| 11 | `closed_at` | `date` | sí |  |  |
| 12 | `owner_id` | `uuid` | no |  | FK → iam_users.id. |
| 13 | `destination_label` | `character varying(120)` | sí |  |  |
| 14 | `pax` | `smallint` | no | `0` |  |
| 15 | `lead_id` | `uuid` | sí |  | FK → crm_leads.id. |
| 16 | `product_id` | `uuid` | sí |  | FK → catalog_products.id. |
| 17 | `origin` | `character varying(40)` | sí |  |  |
| 18 | `notes` | `text` | sí |  |  |
| 19 | `lost_reason_code` | `character varying(40)` | sí |  |  |
| 20 | `lost_detail` | `text` | sí |  |  |
| 21 | `lost_at_stage` | `character varying(30)` | sí |  |  |
| 22 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 23 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 24 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 25 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 26 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 27 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `client_id` | `crm_clients.id` | NO ACTION | `fk_crm_opportunities_client_id` |
| `lead_id` | `crm_leads.id` | NO ACTION | `fk_crm_opportunities_lead_id` |
| `owner_id` | `iam_users.id` | NO ACTION | `fk_crm_opportunities_owner_id` |
| `product_id` | `catalog_products.id` | NO ACTION | `fk_crm_opportunities_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_opportunities_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_crm_opportunities_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_crm_opportunities_tenant_id_lead_id_p` | `tenant_id, lead_id` | `(lead_id IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_crm_opportunities_1` | `CHECK ((((stage)::text <> 'perdida'::text) OR ((lost_reason_code IS NOT NULL) AND (probability = 0) AND (closed_at IS NOT NULL))))` |  |
| `ck_crm_opportunities_2` | `CHECK ((((stage)::text <> 'ganada'::text) OR ((probability = 100) AND (closed_at IS NOT NULL))))` |  |
| `ck_crm_opportunities_3` | `CHECK ((((stage)::text = ANY ((ARRAY['ganada'::character varying, 'perdida'::character varying])::text[])) OR (closed_at IS NULL)))` |  |
| `crm_opportunities_amount_check` | `CHECK ((amount >= (0)::numeric))` |  |
| `crm_opportunities_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `crm_opportunities_pax_check` | `CHECK ((pax >= 0))` |  |
| `crm_opportunities_probability_check` | `CHECK (((probability >= 0) AND (probability <= 100)))` |  |
| `crm_opportunities_stage_check` | `CHECK (((stage)::text = ANY ((ARRAY['calificacion'::character varying, 'descubrimiento'::character varying, 'cotizacion'::character varying, 'negociacion'::character varying, 'ganada'::character varying, 'perdida'::character varying])::text[])))` | `stage`: `calificacion`, `descubrimiento`, `cotizacion`, `negociacion`, `ganada`, `perdida` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_opportunities_client_id` | `USING btree (client_id)` |
| `ix_crm_opportunities_lead_id` | `USING btree (lead_id)` |
| `ix_crm_opportunities_owner_id` | `USING btree (owner_id)` |
| `ix_crm_opportunities_product_id` | `USING btree (product_id)` |
| `ix_crm_opportunities_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_crm_opportunities_tenant_id_expected_close_date` | `USING btree (tenant_id, expected_close_date)` |
| `ix_crm_opportunities_tenant_id_owner_id` | `USING btree (tenant_id, owner_id)` |
| `ix_crm_opportunities_tenant_id_stage` | `USING btree (tenant_id, stage)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_opportunities_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_crm_opportunities_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `crm_pipeline_stages`

[Spec 01 §3.6] [Fase 1] Etapas del embudo de oportunidades.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  | Valores: `calificacion`, `descubrimiento`, `cotizacion`, `negociacion`, `ganada`, `perdida`. |
| 4 | `name` | `character varying(60)` | no |  |  |
| 5 | `default_probability` | `smallint` | no |  |  |
| 6 | `sort_order` | `smallint` | no |  |  |
| 7 | `is_closed` | `boolean` | no | `false` |  |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 9 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 11 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_pipeline_stages_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_crm_pipeline_stages_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `crm_pipeline_stages_code_check` | `CHECK (((code)::text = ANY ((ARRAY['calificacion'::character varying, 'descubrimiento'::character varying, 'cotizacion'::character varying, 'negociacion'::character varying, 'ganada'::character varying, 'perdida'::character varying])::text[])))` | `code`: `calificacion`, `descubrimiento`, `cotizacion`, `negociacion`, `ganada`, `perdida` |
| `crm_pipeline_stages_default_probability_check` | `CHECK (((default_probability >= 0) AND (default_probability <= 100)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_pipeline_stages_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_pipeline_stages_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `crm_surveys`

[Spec 01 §3.9] [Fase 1] Encuestas NPS.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `client_id` | `uuid` | no |  | FK → crm_clients.id. |
| 5 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 6 | `score` | `smallint` | no |  |  |
| 7 | `category` | `character varying(10)` | sí | `generada:  CASE     WHEN (score >= 9) THEN 'promotor'::text     WHEN (score >= 7) THEN 'pasivo'::text     ELSE 'detractor'::text END` |  |
| 8 | `comment` | `text` | sí |  |  |
| 9 | `channel_code` | `character varying(40)` | no |  |  |
| 10 | `responded_at` | `timestamp with time zone` | no |  |  |
| 11 | `recorded_by` | `uuid` | no |  | FK → iam_users.id. |
| 12 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 13 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 15 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `client_id` | `crm_clients.id` | NO ACTION | `fk_crm_surveys_client_id` |
| `recorded_by` | `iam_users.id` | NO ACTION | `fk_crm_surveys_recorded_by` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_crm_surveys_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_surveys_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_crm_surveys_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_crm_surveys_tenant_id_reservation_id_p` | `tenant_id, reservation_id` | `(reservation_id IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `crm_surveys_score_check` | `CHECK (((score >= 0) AND (score <= 10)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_surveys_client_id` | `USING btree (client_id)` |
| `ix_crm_surveys_recorded_by` | `USING btree (recorded_by)` |
| `ix_crm_surveys_reservation_id` | `USING btree (reservation_id)` |
| `ix_crm_surveys_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_surveys_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `crm_own_review_log`

[Spec 18 §3.2] [Fase 3] Historial de moderación de la reseña.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `review_id` | `uuid` | no |  | FK → crm_own_reviews.id. |
| 4 | `action` | `character varying(30)` | no |  | Valores: `crear`, `publicar`, `rechazar`, `ocultar`, `responder`, `editar_respuesta`, `autopublicar`. |
| 5 | `note` | `text` | sí |  |  |
| 6 | `user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 7 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `review_id` | `crm_own_reviews.id` | NO ACTION | `fk_crm_own_review_log_review_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_own_review_log_tenant_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_crm_own_review_log_user_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `crm_own_review_log_action_check` | `CHECK (((action)::text = ANY ((ARRAY['crear'::character varying, 'publicar'::character varying, 'rechazar'::character varying, 'ocultar'::character varying, 'responder'::character varying, 'editar_respuesta'::character varying, 'autopublicar'::character varying])::text[])))` | `action`: `crear`, `publicar`, `rechazar`, `ocultar`, `responder`, `editar_respuesta`, `autopublicar` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_own_review_log_review_id` | `USING btree (review_id)` |
| `ix_crm_own_review_log_tenant_id` | `USING btree (tenant_id)` |
| `ix_crm_own_review_log_user_id` | `USING btree (user_id)` |

[↑ Índice del dominio](#tablas)

### `crm_own_reviews`

[Spec 18 §3.1] [Fase 3] Reseñas propias verificadas por reserva.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 5 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 6 | `client_id` | `uuid` | no |  | FK → crm_clients.id. |
| 7 | `passenger_id` | `uuid` | sí |  | FK → booking_passengers.id. |
| 8 | `author_display` | `character varying(80)` | no |  |  |
| 9 | `author_name` | `character varying(160)` | no |  |  |
| 10 | `country` | `character varying(60)` | sí |  |  |
| 11 | `travel_date` | `date` | no |  |  |
| 12 | `stars` | `smallint` | no |  |  |
| 13 | `subratings` | `jsonb` | no | `'{}'::jsonb` |  |
| 14 | `title` | `character varying(120)` | no |  |  |
| 15 | `body` | `text` | no |  |  |
| 16 | `photos` | `jsonb` | no | `'[]'::jsonb` |  |
| 17 | `lang` | `character(2)` | no | `'es'::bpchar` | Valores: `es`, `en`, `de`, `fr`, `pt`. |
| 18 | `verified` | `boolean` | no | `true` |  |
| 19 | `consent_publish` | `boolean` | no | `false` |  |
| 20 | `status` | `character varying(20)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `publicada`, `rechazada`, `oculta`. |
| 21 | `moderation_reason` | `text` | sí |  |  |
| 22 | `reply_text` | `text` | sí |  |  |
| 23 | `reply_by` | `uuid` | sí |  | FK → iam_users.id. |
| 24 | `replied_at` | `timestamp with time zone` | sí |  |  |
| 25 | `helpful_count` | `integer` | no | `0` |  |
| 26 | `source` | `character varying(10)` | no |  | Valores: `portal`, `email`, `widget`. |
| 27 | `request_id` | `uuid` | sí |  | FK → crm_review_requests.id. |
| 28 | `is_demo` | `boolean` | no | `false` |  |
| 29 | `published_at` | `timestamp with time zone` | sí |  |  |
| 30 | `moderated_by` | `uuid` | sí |  | FK → iam_users.id. |
| 31 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 32 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 33 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 34 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 35 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 36 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `client_id` | `crm_clients.id` | NO ACTION | `fk_crm_own_reviews_client_id` |
| `moderated_by` | `iam_users.id` | NO ACTION | `fk_crm_own_reviews_moderated_by` |
| `passenger_id` | `booking_passengers.id` | NO ACTION | `fk_crm_own_reviews_passenger_id` |
| `product_id` | `catalog_products.id` | NO ACTION | `fk_crm_own_reviews_product_id` |
| `reply_by` | `iam_users.id` | NO ACTION | `fk_crm_own_reviews_reply_by` |
| `request_id` | `crm_review_requests.id` | NO ACTION | `fk_crm_own_reviews_request_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_crm_own_reviews_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_own_reviews_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_crm_own_reviews_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_crm_own_reviews_tenant_id_reservation_id_product_id_p_7ca549` | `tenant_id, reservation_id, product_id, passenger_id)` | `(deleted_at IS NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_crm_own_reviews_1` | `CHECK ((((status)::text <> 'publicada'::text) OR consent_publish))` |  |
| `crm_own_reviews_body_check` | `CHECK (((char_length(body) >= 20) AND (char_length(body) <= 2000)))` |  |
| `crm_own_reviews_lang_check` | `CHECK ((lang = ANY (ARRAY['es'::bpchar, 'en'::bpchar, 'de'::bpchar, 'fr'::bpchar, 'pt'::bpchar])))` | `lang`: `es`, `en`, `de`, `fr`, `pt` |
| `crm_own_reviews_source_check` | `CHECK (((source)::text = ANY ((ARRAY['portal'::character varying, 'email'::character varying, 'widget'::character varying])::text[])))` | `source`: `portal`, `email`, `widget` |
| `crm_own_reviews_stars_check` | `CHECK (((stars >= 1) AND (stars <= 5)))` |  |
| `crm_own_reviews_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'publicada'::character varying, 'rechazada'::character varying, 'oculta'::character varying])::text[])))` | `status`: `pendiente`, `publicada`, `rechazada`, `oculta` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_own_reviews_client_id` | `USING btree (client_id)` |
| `ix_crm_own_reviews_moderated_by` | `USING btree (moderated_by)` |
| `ix_crm_own_reviews_passenger_id` | `USING btree (passenger_id)` |
| `ix_crm_own_reviews_product_id` | `USING btree (product_id)` |
| `ix_crm_own_reviews_reply_by` | `USING btree (reply_by)` |
| `ix_crm_own_reviews_request_id` | `USING btree (request_id)` |
| `ix_crm_own_reviews_reservation_id` | `USING btree (reservation_id)` |
| `ix_crm_own_reviews_tenant_id_client_id` | `USING btree (tenant_id, client_id)` |
| `ix_crm_own_reviews_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_crm_own_reviews_tenant_id_product_id_status_published_d101db` | `USING btree (tenant_id, product_id, status, published_at DESC)` |
| `ix_crm_own_reviews_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_own_reviews_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_crm_own_reviews_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `crm_review_requests`

[Spec 18 §3.3] [Fase 3] Solicitudes de reseña post-viaje.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 5 | `client_id` | `uuid` | no |  | FK → crm_clients.id. |
| 6 | `to_address` | `character varying(160)` | no |  |  |
| 7 | `channel` | `character varying(10)` | no |  | Valores: `email`, `whatsapp`. |
| 8 | `lang` | `character(2)` | no | `'es'::bpchar` |  |
| 9 | `token_hash` | `character(64)` | no |  |  |
| 10 | `scheduled_at` | `timestamp with time zone` | sí |  |  |
| 11 | `sent_at` | `timestamp with time zone` | sí |  |  |
| 12 | `opened_at` | `timestamp with time zone` | sí |  |  |
| 13 | `reminded_at` | `timestamp with time zone` | sí |  |  |
| 14 | `expires_at` | `timestamp with time zone` | sí |  |  |
| 15 | `status` | `character varying(15)` | no | `'programada'::character varying` | Valores: `programada`, `enviada`, `abierta`, `respondida`, `vencida`, `cancelada`. |
| 16 | `is_demo` | `boolean` | no | `false` |  |
| 17 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 18 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 19 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 20 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `client_id` | `crm_clients.id` | NO ACTION | `fk_crm_review_requests_client_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_crm_review_requests_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_review_requests_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_crm_review_requests_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_crm_review_requests_tenant_id_reservation_id` | `tenant_id, reservation_id` |  | índice único |
| `uq_crm_review_requests_token_hash` | `token_hash` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `crm_review_requests_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'whatsapp'::character varying])::text[])))` | `channel`: `email`, `whatsapp` |
| `crm_review_requests_status_check` | `CHECK (((status)::text = ANY ((ARRAY['programada'::character varying, 'enviada'::character varying, 'abierta'::character varying, 'respondida'::character varying, 'vencida'::character varying, 'cancelada'::character varying])::text[])))` | `status`: `programada`, `enviada`, `abierta`, `respondida`, `vencida`, `cancelada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_review_requests_client_id` | `USING btree (client_id)` |
| `ix_crm_review_requests_reservation_id` | `USING btree (reservation_id)` |
| `ix_crm_review_requests_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_crm_review_requests_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_review_requests_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `crm_sales_target_adjustments`

[Spec 14 §3.15] [Fase 3] Historial de ajustes de la meta.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `target_id` | `uuid` | no |  | FK → crm_sales_targets.id. |
| 4 | `action` | `character varying(20)` | no |  | Valores: `crear`, `activar`, `ajustar`, `anular`, `cerrar`, `bono`. |
| 5 | `before` | `jsonb` | sí |  |  |
| 6 | `after` | `jsonb` | sí |  |  |
| 7 | `reason` | `text` | sí |  |  |
| 8 | `actor_id` | `uuid` | no |  | FK → iam_users.id. |
| 9 | `occurred_at` | `timestamp with time zone` | no | `now()` |  |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `actor_id` | `iam_users.id` | NO ACTION | `fk_crm_sales_target_adjustments_actor_id` |
| `target_id` | `crm_sales_targets.id` | NO ACTION | `fk_crm_sales_target_adjustments_target_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_sales_target_adjustments_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_crm_sales_target_adjustments_1` | `CHECK ((((action)::text <> ALL ((ARRAY['ajustar'::character varying, 'anular'::character varying])::text[])) OR (reason IS NOT NULL)))` |  |
| `crm_sales_target_adjustments_action_check` | `CHECK (((action)::text = ANY ((ARRAY['crear'::character varying, 'activar'::character varying, 'ajustar'::character varying, 'anular'::character varying, 'cerrar'::character varying, 'bono'::character varying])::text[])))` | `action`: `crear`, `activar`, `ajustar`, `anular`, `cerrar`, `bono` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_sales_target_adjustments_actor_id` | `USING btree (actor_id)` |
| `ix_crm_sales_target_adjustments_target_id` | `USING btree (target_id)` |
| `ix_crm_sales_target_adjustments_tenant_id` | `USING btree (tenant_id)` |

[↑ Índice del dominio](#tablas)

### `crm_sales_target_policies`

[Spec 14 §3.16] [Fase 3] Política de metas y bonos (1 fila por tenant).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `tiers` | `jsonb` | no | `'[{"min": 90, "pay": 50}, {"min": 100, "pay": 100}, {"min": 120, "pay": 130}]'::jsonb` |  |
| 4 | `primary_metric` | `character varying(20)` | no | `'sales'::character varying` |  |
| 5 | `lock_decrease_after_pct` | `integer` | no | `50` |  |
| 6 | `attribution_window_days` | `integer` | no | `30` |  |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 10 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_sales_target_policies_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_crm_sales_target_policies_tenant_id` | `tenant_id` |  | índice único |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_sales_target_policies_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `crm_sales_targets`

[Spec 14 §3.14] [Fase 3] Metas comerciales por asesor, sede o equipo.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `scope_type` | `character varying(10)` | no |  | Valores: `asesor`, `sede`, `equipo`. |
| 5 | `scope_id` | `uuid` | no |  |  |
| 6 | `period_type` | `character varying(10)` | no |  | Valores: `mes`, `trimestre`. |
| 7 | `period_key` | `character varying(7)` | no |  |  |
| 8 | `period_from` | `date` | no |  |  |
| 9 | `period_to` | `date` | no |  |  |
| 10 | `goal_sales_pen` | `numeric(14,2)` | no |  |  |
| 11 | `goal_bookings` | `integer` | sí |  |  |
| 12 | `goal_margin_pen` | `numeric(14,2)` | sí |  |  |
| 13 | `goal_conversion_pct` | `numeric(5,2)` | sí |  |  |
| 14 | `bonus_amount` | `numeric(14,2)` | sí |  |  |
| 15 | `bonus_currency` | `character(3)` | sí | `'PEN'::bpchar` |  |
| 16 | `status` | `character varying(20)` | no | `'borrador'::character varying` | Valores: `borrador`, `vigente`, `cerrada`, `anulada`. |
| 17 | `result` | `jsonb` | sí |  |  |
| 18 | `bonus_commission_id` | `uuid` | sí |  | FK → fin_commissions.id. |
| 19 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 20 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 21 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 22 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 23 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `bonus_commission_id` | `fin_commissions.id` | NO ACTION | `fk_crm_sales_targets_bonus_commission_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_sales_targets_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_crm_sales_targets_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_crm_sales_targets_tenant_id_scope_type_scope_id_period_key_p` | `tenant_id, scope_type, scope_id, period_key` | `((status)::text <> 'anulada'::text)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_crm_sales_targets_1` | `CHECK (((bonus_amount IS NULL) OR ((scope_type)::text = 'asesor'::text)))` |  |
| `ck_crm_sales_targets_2` | `CHECK ((period_to >= period_from))` |  |
| `crm_sales_targets_goal_bookings_check` | `CHECK ((goal_bookings >= 0))` |  |
| `crm_sales_targets_goal_conversion_pct_check` | `CHECK (((goal_conversion_pct >= (0)::numeric) AND (goal_conversion_pct <= (100)::numeric)))` |  |
| `crm_sales_targets_goal_sales_pen_check` | `CHECK ((goal_sales_pen > (0)::numeric))` |  |
| `crm_sales_targets_period_key_check` | `CHECK (((period_key)::text ~ '^[0-9]{4}-([0-9]{2}\|Q[1-4])$'::text))` |  |
| `crm_sales_targets_period_type_check` | `CHECK (((period_type)::text = ANY ((ARRAY['mes'::character varying, 'trimestre'::character varying])::text[])))` | `period_type`: `mes`, `trimestre` |
| `crm_sales_targets_scope_type_check` | `CHECK (((scope_type)::text = ANY ((ARRAY['asesor'::character varying, 'sede'::character varying, 'equipo'::character varying])::text[])))` | `scope_type`: `asesor`, `sede`, `equipo` |
| `crm_sales_targets_status_check` | `CHECK (((status)::text = ANY ((ARRAY['borrador'::character varying, 'vigente'::character varying, 'cerrada'::character varying, 'anulada'::character varying])::text[])))` | `status`: `borrador`, `vigente`, `cerrada`, `anulada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_sales_targets_bonus_commission_id` | `USING btree (bonus_commission_id)` |
| `ix_crm_sales_targets_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_crm_sales_targets_tenant_id_period_key` | `USING btree (tenant_id, period_key)` |
| `ix_crm_sales_targets_tenant_id_scope_type_scope_id` | `USING btree (tenant_id, scope_type, scope_id)` |
| `ix_crm_sales_targets_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_sales_targets_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_crm_sales_targets_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `crm_sales_team_members`

[Spec 14 §3.13] [Fase 3] Integrantes del equipo (vigencias).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `team_id` | `uuid` | no |  | FK → crm_sales_teams.id. |
| 4 | `user_id` | `uuid` | no |  | FK → iam_users.id. |
| 5 | `valid_from` | `date` | no |  |  |
| 6 | `valid_to` | `date` | sí |  |  |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 10 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `team_id` | `crm_sales_teams.id` | NO ACTION | `fk_crm_sales_team_members_team_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_sales_team_members_tenant_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_crm_sales_team_members_user_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_crm_sales_team_members_team_id_user_id_valid_from` | `team_id, user_id, valid_from` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_sales_team_members_tenant_id` | `USING btree (tenant_id)` |
| `ix_crm_sales_team_members_user_id` | `USING btree (user_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_sales_team_members_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `crm_sales_teams`

[Spec 14 §3.13] [Fase 3] Equipos de venta.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| CRM (crm_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `name` | `character varying(120)` | no |  |  |
| 5 | `leader_id` | `uuid` | sí |  | FK → iam_users.id. |
| 6 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 7 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 8 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 9 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `leader_id` | `iam_users.id` | NO ACTION | `fk_crm_sales_teams_leader_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_crm_sales_teams_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_crm_sales_teams_tenant_id_code` | `tenant_id, code` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_crm_sales_teams_leader_id` | `USING btree (leader_id)` |
| `ix_crm_sales_teams_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_crm_sales_teams_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)
