# Diccionario de datos · Aprobaciones e inbox (collab_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.15 tras cargar `00`→`90`. No editar a mano._

Reglas y solicitudes de aprobación, conversaciones omnicanal y mensajes.

12 tablas · 194 columnas · 38 claves foráneas. Diagrama ER: [`../er/collab.svg`](../er/collab.svg) (fuente [`../er/collab.mmd`](../er/collab.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`collab_approval_events`](#collab_approval_events) | Fase 2 · Canales y campo | tenant | 8 | 3 | [Spec 10 §3.5] [Fase 2] Trazabilidad de la solicitud (append-only). |
| [`collab_approval_info_requests`](#collab_approval_info_requests) | Fase 2 · Canales y campo | tenant | 13 | 4 | [Spec 10 §3.4] [Fase 2] Pedidos de información sobre una solicitud. |
| [`collab_approval_requests`](#collab_approval_requests) | Fase 2 · Canales y campo | tenant | 35 | 5 | [Spec 10 §3.2] [Fase 2] Solicitud de aprobación unificada. |
| [`collab_approval_rules`](#collab_approval_rules) | Fase 2 · Canales y campo | tenant | 16 | 1 | [Spec 10 §3.1] [Fase 2] Matriz de enrutamiento de aprobaciones. |
| [`collab_approval_steps`](#collab_approval_steps) | Fase 2 · Canales y campo | tenant | 11 | 4 | [Spec 10 §3.3] [Fase 2] Decisiones por nivel. |
| [`collab_channel_accounts`](#collab_channel_accounts) | Fase 2 · Canales y campo | tenant | 14 | 1 | [Spec 10 §3.10] [Fase 2] Cuentas de canal del inbox (WhatsApp, email, webchat). |
| [`collab_conversations`](#collab_conversations) | Fase 2 · Canales y campo | tenant | 32 | 10 | [Spec 10 §3.6] [Fase 2] Conversaciones omnicanal. |
| [`collab_inbound_events`](#collab_inbound_events) | Fase 2 · Canales y campo | tenant | 9 | 1 | [Spec 10 §3.10] [Fase 2] Eventos entrantes de webhooks (idempotencia, retención 30 días). |
| [`collab_message_attachments`](#collab_message_attachments) | Fase 2 · Canales y campo | tenant | 11 | 2 | [Spec 10 §3.8] [Fase 2] Adjuntos de mensajes. |
| [`collab_messages`](#collab_messages) | Fase 2 · Canales y campo | tenant | 14 | 4 | [Spec 10 §3.7] [Fase 2] Mensajes de la conversación. |
| [`collab_reply_templates`](#collab_reply_templates) | Fase 2 · Canales y campo | tenant | 15 | 1 | [Spec 10 §3.9] [Fase 2] Plantillas de respuesta del inbox. |
| [`collab_whatsapp_templates`](#collab_whatsapp_templates) | Fase 3 · SaaS y crecimiento | tenant | 16 | 2 | [Spec 19 §3.2] [Fase 3] Plantillas de WhatsApp Business aprobadas por Meta por cuenta de canal. |

## Detalle por tabla

### `collab_approval_events`

[Spec 10 §3.5] [Fase 2] Trazabilidad de la solicitud (append-only).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Aprobaciones e inbox (collab_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, collab_approval_requests.tenant_id, tenants.id. |
| 3 | `request_id` | `uuid` | no |  | FK → collab_approval_requests.id. |
| 4 | `event` | `character varying(40)` | no |  | Valores: `creada`, `aprobada_nivel`, `aprobada`, `rechazada`, `info_solicitada`, `info_respondida`, `delegada`, `retirada`, `reenviada`, `cerrada_en_origen`, `sla_advertencia`, `sla_vencido`. |
| 5 | `actor_id` | `uuid` | sí |  | FK → iam_users.id. |
| 6 | `note` | `text` | sí |  |  |
| 7 | `payload` | `jsonb` | sí |  |  |
| 8 | `occurred_at` | `timestamp with time zone` | no | `now()` |  |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, actor_id` | `iam_users.tenant_id, id` | NO ACTION | `fk_collab_approval_events_actor_id` |
| `tenant_id, request_id` | `collab_approval_requests.tenant_id, id` | NO ACTION | `fk_collab_approval_events_request_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_collab_approval_events_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `collab_approval_events_event_check` | `CHECK (((event)::text = ANY ((ARRAY['creada'::character varying, 'aprobada_nivel'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'info_solicitada'::character varying, 'info_respondida'::character varying, 'delegada'::character varying, 'retirada'::character varying, 'reenviada'::character varying, 'cerrada_en_origen'::character varying, 'sla_advertencia'::character varying, 'sla_vencido'::character varying])::text[])))` | `event`: `creada`, `aprobada_nivel`, `aprobada`, `rechazada`, `info_solicitada`, `info_respondida`, `delegada`, `retirada`, `reenviada`, `cerrada_en_origen`, `sla_advertencia`, `sla_vencido` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_collab_approval_events_actor_id` | `USING btree (actor_id)` |
| `ix_collab_approval_events_request_id` | `USING btree (request_id)` |
| `ix_collab_approval_events_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_collab_approval_events_append_only` | BEFORE DELETE OR UPDATE | `app_forbid_update_delete` |

[↑ Índice del dominio](#tablas)

### `collab_approval_info_requests`

[Spec 10 §3.4] [Fase 2] Pedidos de información sobre una solicitud.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Aprobaciones e inbox (collab_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, iam_users.tenant_id, collab_approval_requests.tenant_id, tenants.id. |
| 3 | `request_id` | `uuid` | no |  | FK → collab_approval_requests.id. |
| 4 | `asked_by` | `uuid` | no |  | FK → iam_users.id. |
| 5 | `question` | `text` | no |  |  |
| 6 | `asked_at` | `timestamp with time zone` | no | `now()` |  |
| 7 | `answer` | `text` | sí |  |  |
| 8 | `answered_by` | `uuid` | sí |  | FK → iam_users.id. |
| 9 | `answered_at` | `timestamp with time zone` | sí |  |  |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 13 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, answered_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_collab_approval_info_requests_answered_by` |
| `tenant_id, asked_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_collab_approval_info_requests_asked_by` |
| `tenant_id, request_id` | `collab_approval_requests.tenant_id, id` | NO ACTION | `fk_collab_approval_info_requests_request_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_collab_approval_info_requests_tenant_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_collab_approval_info_requests_answered_by` | `USING btree (answered_by)` |
| `ix_collab_approval_info_requests_asked_by` | `USING btree (asked_by)` |
| `ix_collab_approval_info_requests_request_id` | `USING btree (request_id)` |
| `ix_collab_approval_info_requests_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_collab_approval_info_requests_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `collab_approval_requests`

[Spec 10 §3.2] [Fase 2] Solicitud de aprobación unificada.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Aprobaciones e inbox (collab_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, iam_users.tenant_id, iam_users.tenant_id, catalog_providers.tenant_id, tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `request_type` | `character varying(30)` | no |  | Valores: `quote`, `cancel`, `reversal`, `payable`, `commission`, `provider_rate`, `credit_b2b`, `refund`, `other`. |
| 5 | `is_generic` | `boolean` | no | `false` |  |
| 6 | `subject_type` | `character varying(40)` | sí |  | Valores: `quote_versions`, `booking_reservations`, `fin_payments`, `fin_payables`, `fin_commissions`, `supplier_rate_requests`, `channel_b2b_agencies`. |
| 7 | `subject_id` | `uuid` | sí |  |  |
| 8 | `subject_code` | `character varying(40)` | sí |  |  |
| 9 | `subject_version` | `integer` | sí |  |  |
| 10 | `dedupe_key` | `character varying(120)` | no |  |  |
| 11 | `title` | `character varying(200)` | no |  |  |
| 12 | `justification` | `text` | sí |  |  |
| 13 | `requester_id` | `uuid` | sí |  | FK → iam_users.id. |
| 14 | `requester_kind` | `character varying(20)` | no | `'user'::character varying` | Valores: `user`, `supplier`, `system`. |
| 15 | `requester_supplier_id` | `uuid` | sí |  | FK → catalog_providers.id. |
| 16 | `amount` | `numeric(14,2)` | no |  |  |
| 17 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 18 | `fx_rate` | `numeric(12,6)` | no |  |  |
| 19 | `amount_base` | `numeric(14,2)` | sí | `generada: round((amount * fx_rate), 2)` |  |
| 20 | `status` | `character varying(30)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `info`, `aprobada`, `rechazada`, `anulada`. |
| 21 | `current_level` | `smallint` | no | `1` |  |
| 22 | `total_levels` | `smallint` | no | `1` |  |
| 23 | `delegated_to` | `uuid` | sí |  | FK → iam_users.id. |
| 24 | `due_at` | `timestamp with time zone` | sí |  |  |
| 25 | `paused_at` | `timestamp with time zone` | sí |  |  |
| 26 | `decided_by` | `uuid` | sí |  | FK → iam_users.id. |
| 27 | `decided_at` | `timestamp with time zone` | sí |  |  |
| 28 | `decision_note` | `text` | sí |  |  |
| 29 | `closed_in_origin` | `boolean` | no | `false` |  |
| 30 | `origin_snapshot` | `jsonb` | sí |  |  |
| 31 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 32 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 33 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 34 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 35 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, decided_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_collab_approval_requests_decided_by` |
| `tenant_id, delegated_to` | `iam_users.tenant_id, id` | NO ACTION | `fk_collab_approval_requests_delegated_to` |
| `tenant_id, requester_id` | `iam_users.tenant_id, id` | NO ACTION | `fk_collab_approval_requests_requester_id` |
| `tenant_id, requester_supplier_id` | `catalog_providers.tenant_id, id` | NO ACTION | `fk_collab_approval_requests_requester_supplier_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_collab_approval_requests_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_collab_approval_requests_id` | `tenant_id, id` |  | restricción |
| `uq_collab_approval_requests_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_collab_approval_requests_tenant_id_dedupe_key_p` | `tenant_id, dedupe_key` | `((status)::text = ANY ((ARRAY['pendiente'::character varying, 'info'::character varying])::text[]))` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_collab_approval_requests_1` | `CHECK ((((status)::text <> 'rechazada'::text) OR (decision_note IS NOT NULL)))` |  |
| `collab_approval_requests_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `collab_approval_requests_current_level_check` | `CHECK (((current_level >= 1) AND (current_level <= 2)))` |  |
| `collab_approval_requests_request_type_check` | `CHECK (((request_type)::text = ANY ((ARRAY['quote'::character varying, 'cancel'::character varying, 'reversal'::character varying, 'payable'::character varying, 'commission'::character varying, 'provider_rate'::character varying, 'credit_b2b'::character varying, 'refund'::character varying, 'other'::character varying])::text[])))` | `request_type`: `quote`, `cancel`, `reversal`, `payable`, `commission`, `provider_rate`, `credit_b2b`, `refund`, `other` |
| `collab_approval_requests_requester_kind_check` | `CHECK (((requester_kind)::text = ANY ((ARRAY['user'::character varying, 'supplier'::character varying, 'system'::character varying])::text[])))` | `requester_kind`: `user`, `supplier`, `system` |
| `collab_approval_requests_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'info'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'anulada'::character varying])::text[])))` | `status`: `pendiente`, `info`, `aprobada`, `rechazada`, `anulada` |
| `collab_approval_requests_subject_type_check` | `CHECK (((subject_type IS NULL) OR ((subject_type)::text = ANY ((ARRAY['quote_versions'::character varying, 'booking_reservations'::character varying, 'fin_payments'::character varying, 'fin_payables'::character varying, 'fin_commissions'::character varying, 'supplier_rate_requests'::character varying, 'channel_b2b_agencies'::character varying])::text[]))))` | `subject_type`: `quote_versions`, `booking_reservations`, `fin_payments`, `fin_payables`, `fin_commissions`, `supplier_rate_requests`, `channel_b2b_agencies` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_collab_approval_requests_decided_by` | `USING btree (decided_by)` |
| `ix_collab_approval_requests_delegated_to` | `USING btree (delegated_to)` |
| `ix_collab_approval_requests_requester_id` | `USING btree (requester_id)` |
| `ix_collab_approval_requests_requester_supplier_id` | `USING btree (requester_supplier_id)` |
| `ix_collab_approval_requests_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_collab_approval_requests_tenant_id_delegated_to_p` | `USING btree (tenant_id, delegated_to) WHERE (delegated_to IS NOT NULL)` |
| `ix_collab_approval_requests_tenant_id_request_type_status` | `USING btree (tenant_id, request_type, status)` |
| `ix_collab_approval_requests_tenant_id_requester_id_creat_68c221` | `USING btree (tenant_id, requester_id, created_at DESC)` |
| `ix_collab_approval_requests_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_collab_approval_requests_tenant_id_status_due_at` | `USING btree (tenant_id, status, due_at)` |
| `ix_collab_approval_requests_tenant_id_subject_type_subject_id` | `USING btree (tenant_id, subject_type, subject_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_collab_approval_requests_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_collab_approval_requests_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `collab_approval_rules`

[Spec 10 §3.1] [Fase 2] Matriz de enrutamiento de aprobaciones.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Aprobaciones e inbox (collab_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `request_type` | `character varying(30)` | no |  | Valores: `quote`, `cancel`, `reversal`, `payable`, `commission`, `provider_rate`, `credit_b2b`, `refund`, `other`. |
| 5 | `level` | `smallint` | no |  | Valores: `1`, `2`. |
| 6 | `permission` | `character varying(80)` | no |  |  |
| 7 | `min_amount_pen` | `numeric(14,2)` | no | `0` |  |
| 8 | `sla_hours` | `smallint` | no |  |  |
| 9 | `forbid_self_approval` | `boolean` | no | `true` |  |
| 10 | `is_active` | `boolean` | no | `true` |  |
| 11 | `is_origin_locked` | `boolean` | no | `false` |  |
| 12 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 13 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 15 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 16 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_collab_approval_rules_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_collab_approval_rules_id` | `tenant_id, id` |  | restricción |
| `uq_collab_approval_rules_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_collab_approval_rules_tenant_id_request_type_level_mi_868e35` | `tenant_id, request_type, level, min_amount_pen` | `(deleted_at IS NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `collab_approval_rules_level_check` | `CHECK ((level = ANY (ARRAY[1, 2])))` | `level`: `1`, `2` |
| `collab_approval_rules_request_type_check` | `CHECK (((request_type)::text = ANY ((ARRAY['quote'::character varying, 'cancel'::character varying, 'reversal'::character varying, 'payable'::character varying, 'commission'::character varying, 'provider_rate'::character varying, 'credit_b2b'::character varying, 'refund'::character varying, 'other'::character varying])::text[])))` | `request_type`: `quote`, `cancel`, `reversal`, `payable`, `commission`, `provider_rate`, `credit_b2b`, `refund`, `other` |
| `collab_approval_rules_sla_hours_check` | `CHECK (((sla_hours >= 1) AND (sla_hours <= 720)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_collab_approval_rules_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_collab_approval_rules_tenant_id_request_type_is_active` | `USING btree (tenant_id, request_type, is_active)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_collab_approval_rules_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `collab_approval_steps`

[Spec 10 §3.3] [Fase 2] Decisiones por nivel.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Aprobaciones e inbox (collab_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, collab_approval_requests.tenant_id, collab_approval_rules.tenant_id, tenants.id. |
| 3 | `request_id` | `uuid` | no |  | FK → collab_approval_requests.id. |
| 4 | `level` | `smallint` | no |  |  |
| 5 | `rule_id` | `uuid` | no |  | FK → collab_approval_rules.id. |
| 6 | `decision` | `character varying(20)` | no |  | Valores: `aprobada`, `rechazada`. |
| 7 | `decided_by` | `uuid` | no |  | FK → iam_users.id. |
| 8 | `note` | `text` | sí |  |  |
| 9 | `decided_at` | `timestamp with time zone` | no | `now()` |  |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, decided_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_collab_approval_steps_decided_by` |
| `tenant_id, request_id` | `collab_approval_requests.tenant_id, id` | NO ACTION | `fk_collab_approval_steps_request_id` |
| `tenant_id, rule_id` | `collab_approval_rules.tenant_id, id` | NO ACTION | `fk_collab_approval_steps_rule_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_collab_approval_steps_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_collab_approval_steps_request_id_decided_by` | `request_id, decided_by` |  | índice único |
| `uq_collab_approval_steps_request_id_level` | `request_id, level` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `collab_approval_steps_decision_check` | `CHECK (((decision)::text = ANY ((ARRAY['aprobada'::character varying, 'rechazada'::character varying])::text[])))` | `decision`: `aprobada`, `rechazada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_collab_approval_steps_decided_by` | `USING btree (decided_by)` |
| `ix_collab_approval_steps_rule_id` | `USING btree (rule_id)` |
| `ix_collab_approval_steps_tenant_id` | `USING btree (tenant_id)` |

[↑ Índice del dominio](#tablas)

### `collab_channel_accounts`

[Spec 10 §3.10] [Fase 2] Cuentas de canal del inbox (WhatsApp, email, webchat).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Aprobaciones e inbox (collab_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `channel` | `character varying(20)` | no |  | Valores: `whatsapp`, `email`, `webchat`, `form`, `portal`. |
| 4 | `name` | `character varying(120)` | no |  |  |
| 5 | `credentials_encrypted` | `text` | sí |  |  |
| 6 | `webhook_secret_encrypted` | `text` | sí |  |  |
| 7 | `phone_number_id` | `character varying(60)` | sí |  |  |
| 8 | `mailbox` | `character varying(190)` | sí |  |  |
| 9 | `first_response_sla_minutes` | `smallint` | no | `240` |  |
| 10 | `status` | `character varying(20)` | no | `'sandbox'::character varying` | Valores: `activo`, `sandbox`, `inactivo`. |
| 11 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 12 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 13 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 14 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_collab_channel_accounts_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_collab_channel_accounts_id` | `tenant_id, id` |  | restricción |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `collab_channel_accounts_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['whatsapp'::character varying, 'email'::character varying, 'webchat'::character varying, 'form'::character varying, 'portal'::character varying])::text[])))` | `channel`: `whatsapp`, `email`, `webchat`, `form`, `portal` |
| `collab_channel_accounts_status_check` | `CHECK (((status)::text = ANY ((ARRAY['activo'::character varying, 'sandbox'::character varying, 'inactivo'::character varying])::text[])))` | `status`: `activo`, `sandbox`, `inactivo` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_collab_channel_accounts_channel_mailbox_p` | `USING btree (channel, mailbox) WHERE (mailbox IS NOT NULL)` |
| `ix_collab_channel_accounts_channel_phone_number_id_p` | `USING btree (channel, phone_number_id) WHERE (phone_number_id IS NOT NULL)` |
| `ix_collab_channel_accounts_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_collab_channel_accounts_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `collab_conversations`

[Spec 10 §3.6] [Fase 2] Conversaciones omnicanal.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Aprobaciones e inbox (collab_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, collab_channel_accounts.tenant_id, crm_clients.tenant_id, channel_pax_feedback.tenant_id, crm_leads.tenant_id, quote_quotes.tenant_id, booking_reservations.tenant_id, iam_users.tenant_id, channel_support_tickets.tenant_id, tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `channel` | `character varying(20)` | no |  | Valores: `whatsapp`, `email`, `webchat`, `form`, `portal`. |
| 5 | `channel_account_id` | `uuid` | sí |  | FK → collab_channel_accounts.id. |
| 6 | `external_thread_id` | `character varying(190)` | sí |  |  |
| 7 | `contact_name` | `character varying(160)` | no |  |  |
| 8 | `contact_email` | `citext` | sí |  |  |
| 9 | `contact_phone` | `character varying(30)` | sí |  |  |
| 10 | `subject` | `character varying(200)` | no |  |  |
| 11 | `status` | `character varying(20)` | no | `'abierta'::character varying` | Valores: `abierta`, `pendiente`, `resuelta`. |
| 12 | `priority` | `character varying(10)` | no | `'media'::character varying` | Valores: `baja`, `media`, `alta`, `critica`. |
| 13 | `tags` | `text[]` | no | `'{}'::text[]` |  |
| 14 | `assignee_id` | `uuid` | sí |  | FK → iam_users.id. |
| 15 | `client_id` | `uuid` | sí |  | FK → crm_clients.id. |
| 16 | `lead_id` | `uuid` | sí |  | FK → crm_leads.id. |
| 17 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 18 | `quote_id` | `uuid` | sí |  | FK → quote_quotes.id. |
| 19 | `support_ticket_id` | `uuid` | sí |  | FK → channel_support_tickets.id. |
| 20 | `feedback_id` | `uuid` | sí |  | FK → channel_pax_feedback.id. |
| 21 | `first_response_due_at` | `timestamp with time zone` | no |  |  |
| 22 | `first_response_at` | `timestamp with time zone` | sí |  |  |
| 23 | `last_inbound_at` | `timestamp with time zone` | sí |  |  |
| 24 | `last_message_at` | `timestamp with time zone` | no | `now()` |  |
| 25 | `unread_count` | `integer` | no | `0` |  |
| 26 | `resolved_at` | `timestamp with time zone` | sí |  |  |
| 27 | `resolved_by` | `uuid` | sí |  | FK → iam_users.id. |
| 28 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 29 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 30 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 31 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 32 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, assignee_id` | `iam_users.tenant_id, id` | NO ACTION | `fk_collab_conversations_assignee_id` |
| `tenant_id, channel_account_id` | `collab_channel_accounts.tenant_id, id` | NO ACTION | `fk_collab_conversations_channel_account_id` |
| `tenant_id, client_id` | `crm_clients.tenant_id, id` | NO ACTION | `fk_collab_conversations_client_id` |
| `tenant_id, feedback_id` | `channel_pax_feedback.tenant_id, id` | NO ACTION | `fk_collab_conversations_feedback_id` |
| `tenant_id, lead_id` | `crm_leads.tenant_id, id` | NO ACTION | `fk_collab_conversations_lead_id` |
| `tenant_id, quote_id` | `quote_quotes.tenant_id, id` | NO ACTION | `fk_collab_conversations_quote_id` |
| `tenant_id, reservation_id` | `booking_reservations.tenant_id, id` | NO ACTION | `fk_collab_conversations_reservation_id` |
| `tenant_id, resolved_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_collab_conversations_resolved_by` |
| `tenant_id, support_ticket_id` | `channel_support_tickets.tenant_id, id` | NO ACTION | `fk_collab_conversations_support_ticket_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_collab_conversations_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_collab_conversations_id` | `tenant_id, id` |  | restricción |
| `uq_collab_conversations_support_ticket_id_p` | `support_ticket_id` | `(support_ticket_id IS NOT NULL)` | índice único |
| `uq_collab_conversations_tenant_id_channel_external_thread_id_p` | `tenant_id, channel, external_thread_id` | `(external_thread_id IS NOT NULL)` | índice único |
| `uq_collab_conversations_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `collab_conversations_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['whatsapp'::character varying, 'email'::character varying, 'webchat'::character varying, 'form'::character varying, 'portal'::character varying])::text[])))` | `channel`: `whatsapp`, `email`, `webchat`, `form`, `portal` |
| `collab_conversations_priority_check` | `CHECK (((priority)::text = ANY ((ARRAY['baja'::character varying, 'media'::character varying, 'alta'::character varying, 'critica'::character varying])::text[])))` | `priority`: `baja`, `media`, `alta`, `critica` |
| `collab_conversations_status_check` | `CHECK (((status)::text = ANY ((ARRAY['abierta'::character varying, 'pendiente'::character varying, 'resuelta'::character varying])::text[])))` | `status`: `abierta`, `pendiente`, `resuelta` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_collab_conversations_assignee_id` | `USING btree (assignee_id)` |
| `ix_collab_conversations_channel_account_id` | `USING btree (channel_account_id)` |
| `ix_collab_conversations_client_id` | `USING btree (client_id)` |
| `ix_collab_conversations_feedback_id` | `USING btree (feedback_id)` |
| `ix_collab_conversations_lead_id` | `USING btree (lead_id)` |
| `ix_collab_conversations_quote_id` | `USING btree (quote_id)` |
| `ix_collab_conversations_reservation_id` | `USING btree (reservation_id)` |
| `ix_collab_conversations_resolved_by` | `USING btree (resolved_by)` |
| `ix_collab_conversations_support_ticket_id` | `USING btree (support_ticket_id)` |
| `ix_collab_conversations_tags` | `USING gin (tags)` |
| `ix_collab_conversations_tenant_id_assignee_id_status` | `USING btree (tenant_id, assignee_id, status)` |
| `ix_collab_conversations_tenant_id_contact_email` | `USING btree (tenant_id, contact_email)` |
| `ix_collab_conversations_tenant_id_contact_phone` | `USING btree (tenant_id, contact_phone)` |
| `ix_collab_conversations_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_collab_conversations_tenant_id_last_inbound_at` | `USING btree (tenant_id, last_inbound_at)` |
| `ix_collab_conversations_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_collab_conversations_tenant_id_status_last_message_at_desc` | `USING btree (tenant_id, status, last_message_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_collab_conversations_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_collab_conversations_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `collab_inbound_events`

[Spec 10 §3.10] [Fase 2] Eventos entrantes de webhooks (idempotencia, retención 30 días).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Aprobaciones e inbox (collab_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `channel` | `character varying(20)` | no |  | Valores: `whatsapp`, `email`, `webchat`, `form`, `portal`. |
| 4 | `external_event_id` | `character varying(190)` | no |  |  |
| 5 | `payload` | `jsonb` | no |  |  |
| 6 | `received_at` | `timestamp with time zone` | no | `now()` |  |
| 7 | `processed_at` | `timestamp with time zone` | sí |  |  |
| 8 | `status` | `character varying(20)` | no | `'recibido'::character varying` | Valores: `recibido`, `procesado`, `duplicado`, `error`. |
| 9 | `error` | `text` | sí |  |  |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_collab_inbound_events_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_collab_inbound_events_channel_external_event_id` | `channel, external_event_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `collab_inbound_events_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['whatsapp'::character varying, 'email'::character varying, 'webchat'::character varying, 'form'::character varying, 'portal'::character varying])::text[])))` | `channel`: `whatsapp`, `email`, `webchat`, `form`, `portal` |
| `collab_inbound_events_status_check` | `CHECK (((status)::text = ANY ((ARRAY['recibido'::character varying, 'procesado'::character varying, 'duplicado'::character varying, 'error'::character varying])::text[])))` | `status`: `recibido`, `procesado`, `duplicado`, `error` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_collab_inbound_events_tenant_id_status` | `USING btree (tenant_id, status)` |

[↑ Índice del dominio](#tablas)

### `collab_message_attachments`

[Spec 10 §3.8] [Fase 2] Adjuntos de mensajes.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Aprobaciones e inbox (collab_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → collab_messages.tenant_id, tenants.id. |
| 3 | `message_id` | `uuid` | no |  | FK → collab_messages.id. |
| 4 | `file_name` | `character varying(200)` | no |  |  |
| 5 | `mime` | `character varying(100)` | no |  |  |
| 6 | `size_bytes` | `integer` | no |  |  |
| 7 | `storage_path` | `character varying(300)` | no |  |  |
| 8 | `sha256` | `character(64)` | no |  |  |
| 9 | `scan_status` | `character varying(15)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `limpio`, `infectado`. |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, message_id` | `collab_messages.tenant_id, id` | NO ACTION | `fk_collab_message_attachments_message_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_collab_message_attachments_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `collab_message_attachments_scan_status_check` | `CHECK (((scan_status)::text = ANY ((ARRAY['pendiente'::character varying, 'limpio'::character varying, 'infectado'::character varying])::text[])))` | `scan_status`: `pendiente`, `limpio`, `infectado` |
| `collab_message_attachments_size_bytes_check` | `CHECK ((size_bytes <= 16777216))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_collab_message_attachments_message_id` | `USING btree (message_id)` |
| `ix_collab_message_attachments_tenant_id` | `USING btree (tenant_id)` |

[↑ Índice del dominio](#tablas)

### `collab_messages`

[Spec 10 §3.7] [Fase 2] Mensajes de la conversación.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Aprobaciones e inbox (collab_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, collab_conversations.tenant_id, collab_reply_templates.tenant_id, tenants.id. |
| 3 | `conversation_id` | `uuid` | no |  | FK → collab_conversations.id. |
| 4 | `channel` | `character varying(20)` | no |  | Valores: `whatsapp`, `email`, `webchat`, `form`, `portal`. |
| 5 | `direction` | `character varying(10)` | no |  | Valores: `in`, `out`, `internal`, `system`. |
| 6 | `author_user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 7 | `body` | `text` | no |  |  |
| 8 | `template_id` | `uuid` | sí |  | FK → collab_reply_templates.id. |
| 9 | `external_message_id` | `character varying(190)` | sí |  |  |
| 10 | `delivery_status` | `character varying(20)` | sí |  | Valores: `encolado`, `enviado`, `entregado`, `leido`, `fallido`. |
| 11 | `failure_reason` | `text` | sí |  |  |
| 12 | `sent_at` | `timestamp with time zone` | no | `now()` |  |
| 13 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, author_user_id` | `iam_users.tenant_id, id` | NO ACTION | `fk_collab_messages_author_user_id` |
| `tenant_id, conversation_id` | `collab_conversations.tenant_id, id` | NO ACTION | `fk_collab_messages_conversation_id` |
| `tenant_id, template_id` | `collab_reply_templates.tenant_id, id` | NO ACTION | `fk_collab_messages_template_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_collab_messages_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_collab_messages_id` | `tenant_id, id` |  | restricción |
| `uq_collab_messages_tenant_id_channel_external_message_id_p` | `tenant_id, channel, external_message_id` | `(external_message_id IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `collab_messages_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['whatsapp'::character varying, 'email'::character varying, 'webchat'::character varying, 'form'::character varying, 'portal'::character varying])::text[])))` | `channel`: `whatsapp`, `email`, `webchat`, `form`, `portal` |
| `collab_messages_delivery_status_check` | `CHECK (((delivery_status IS NULL) OR ((delivery_status)::text = ANY ((ARRAY['encolado'::character varying, 'enviado'::character varying, 'entregado'::character varying, 'leido'::character varying, 'fallido'::character varying])::text[]))))` | `delivery_status`: `encolado`, `enviado`, `entregado`, `leido`, `fallido` |
| `collab_messages_direction_check` | `CHECK (((direction)::text = ANY ((ARRAY['in'::character varying, 'out'::character varying, 'internal'::character varying, 'system'::character varying])::text[])))` | `direction`: `in`, `out`, `internal`, `system` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_collab_messages_author_user_id` | `USING btree (author_user_id)` |
| `ix_collab_messages_conversation_id_sent_at` | `USING btree (conversation_id, sent_at)` |
| `ix_collab_messages_template_id` | `USING btree (template_id)` |
| `ix_collab_messages_tenant_id` | `USING btree (tenant_id)` |

[↑ Índice del dominio](#tablas)

### `collab_reply_templates`

[Spec 10 §3.9] [Fase 2] Plantillas de respuesta del inbox.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Aprobaciones e inbox (collab_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `name` | `character varying(120)` | no |  |  |
| 5 | `body` | `text` | no |  |  |
| 6 | `channels` | `text[]` | no | `'{}'::text[]` |  |
| 7 | `is_whatsapp_approved` | `boolean` | no | `false` |  |
| 8 | `whatsapp_template_name` | `character varying(120)` | sí |  |  |
| 9 | `whatsapp_language` | `character(5)` | sí |  |  |
| 10 | `is_active` | `boolean` | no | `true` |  |
| 11 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 12 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 13 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 14 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 15 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_collab_reply_templates_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_collab_reply_templates_id` | `tenant_id, id` |  | restricción |
| `uq_collab_reply_templates_tenant_id_code` | `tenant_id, code` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_collab_reply_templates_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_collab_reply_templates_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `collab_whatsapp_templates`

[Spec 19 §3.2] [Fase 3] Plantillas de WhatsApp Business aprobadas por Meta por cuenta de canal.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Aprobaciones e inbox (collab_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → collab_channel_accounts.tenant_id, tenants.id. |
| 3 | `channel_account_id` | `uuid` | no |  | FK → collab_channel_accounts.id. |
| 4 | `name` | `character varying(80)` | no |  |  |
| 5 | `lang` | `character varying(10)` | no | `'es'::character varying` |  |
| 6 | `category` | `character varying(20)` | no |  | Valores: `utility`, `marketing`, `authentication`. |
| 7 | `purpose` | `character varying(30)` | no |  | Valores: `cotizacion`, `link_pago`, `voucher`, `recordatorio`, `recuperacion`, `resena`, `otro`. |
| 8 | `body` | `text` | no |  |  |
| 9 | `variables` | `text[]` | no | `'{}'::text[]` |  |
| 10 | `meta_template_id` | `character varying(60)` | sí |  |  |
| 11 | `status` | `character varying(12)` | no | `'borrador'::character varying` | Valores: `borrador`, `enviada`, `aprobada`, `rechazada`, `pausada`. |
| 12 | `rejected_reason` | `text` | sí |  |  |
| 13 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 14 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 15 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 16 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, channel_account_id` | `collab_channel_accounts.tenant_id, id` | NO ACTION | `fk_collab_whatsapp_templates_channel_account_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_collab_whatsapp_templates_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_collab_whatsapp_templates_account_name_lang` | `channel_account_id, name, lang` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `collab_whatsapp_templates_category_check` | `CHECK (((category)::text = ANY ((ARRAY['utility'::character varying, 'marketing'::character varying, 'authentication'::character varying])::text[])))` | `category`: `utility`, `marketing`, `authentication` |
| `collab_whatsapp_templates_name_check` | `CHECK (((name)::text ~ '^[a-z0-9_]{1,80}$'::text))` |  |
| `collab_whatsapp_templates_purpose_check` | `CHECK (((purpose)::text = ANY ((ARRAY['cotizacion'::character varying, 'link_pago'::character varying, 'voucher'::character varying, 'recordatorio'::character varying, 'recuperacion'::character varying, 'resena'::character varying, 'otro'::character varying])::text[])))` | `purpose`: `cotizacion`, `link_pago`, `voucher`, `recordatorio`, `recuperacion`, `resena`, `otro` |
| `collab_whatsapp_templates_status_check` | `CHECK (((status)::text = ANY ((ARRAY['borrador'::character varying, 'enviada'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'pausada'::character varying])::text[])))` | `status`: `borrador`, `enviada`, `aprobada`, `rechazada`, `pausada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_collab_whatsapp_templates_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_collab_whatsapp_templates_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)
