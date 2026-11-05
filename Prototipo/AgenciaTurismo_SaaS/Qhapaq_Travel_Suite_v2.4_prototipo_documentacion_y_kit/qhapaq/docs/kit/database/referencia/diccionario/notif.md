# Diccionario de datos · Notificaciones (notif_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.13 tras cargar `00`→`90`. No editar a mano._

Reglas de evento, plantillas, mensajes y lecturas; mensajes al pasajero.

6 tablas · 100 columnas · 16 claves foráneas. Diagrama ER: [`../er/notif.svg`](../er/notif.svg) (fuente [`../er/notif.mmd`](../er/notif.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`notif_event_rules`](#notif_event_rules) | Fase 0 · Fundaciones | tenant | 15 | 1 | [Spec 09 §3.10] [Fase 0] Matriz evento × canal de notificaciones (PROC-059). |
| [`notif_messages`](#notif_messages) | Fase 0 · Fundaciones | tenant | 25 | 6 | [Spec 09 §3.12 + 05 §3.14 + 01 §3.12] [Fase 0] Log de notificaciones enviadas (campana, email, WhatsApp, push). |
| [`notif_reads`](#notif_reads) | Fase 0 · Fundaciones | tenant | 5 | 3 | [Spec 05 §3.14] [Fase 0] Lecturas de notificación por usuario (app pasajero, campana). |
| [`notif_templates`](#notif_templates) | Fase 0 · Fundaciones | shared | 11 | 1 | [Spec 09 §3.11] [Fase 0] Plantillas de notificación versionadas (tenant NULL = predeterminada del sistema). |
| [`notif_pax_message_templates`](#notif_pax_message_templates) | Fase 2 · Canales y campo | tenant | 19 | 1 | [Spec 17 §3.4] [Fase 2] Plantillas de mensajes automáticos al pasajero. |
| [`notif_pax_messages`](#notif_pax_messages) | Fase 2 · Canales y campo | tenant | 25 | 4 | [Spec 17 §3.5 + 04 §3 v2.1] [Fase 2] Mensajes al pasajero (programados, enviados, respuestas). |

## Detalle por tabla

### `notif_event_rules`

[Spec 09 §3.10] [Fase 0] Matriz evento × canal de notificaciones (PROC-059).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Notificaciones (notif_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `event_code` | `character varying(50)` | no |  |  |
| 4 | `label` | `character varying(80)` | no |  |  |
| 5 | `ch_email` | `boolean` | no | `false` |  |
| 6 | `ch_whatsapp` | `boolean` | no | `false` |  |
| 7 | `ch_push` | `boolean` | no | `false` |  |
| 8 | `ch_portal` | `boolean` | no | `false` |  |
| 9 | `recipients` | `character varying(200)` | no |  |  |
| 10 | `timing` | `character varying(20)` | no | `'immediate'::character varying` | Valores: `immediate`, `batch_15m`, `business_hours`. |
| 11 | `condition` | `character varying(30)` | no | `'always'::character varying` | Valores: `always`, `marketing_consent`, `amount_gt_5000`. |
| 12 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 13 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 15 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_notif_event_rules_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_notif_event_rules_tenant_id_event_code` | `tenant_id, event_code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_notif_event_rules_1` | `CHECK ((((event_code)::text <> 'incidencia.critica'::text) OR (ch_email OR ch_whatsapp OR ch_push OR ch_portal)))` |  |
| `notif_event_rules_condition_check` | `CHECK (((condition)::text = ANY ((ARRAY['always'::character varying, 'marketing_consent'::character varying, 'amount_gt_5000'::character varying])::text[])))` | `condition`: `always`, `marketing_consent`, `amount_gt_5000` |
| `notif_event_rules_timing_check` | `CHECK (((timing)::text = ANY ((ARRAY['immediate'::character varying, 'batch_15m'::character varying, 'business_hours'::character varying])::text[])))` | `timing`: `immediate`, `batch_15m`, `business_hours` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_notif_event_rules_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `notif_messages`

[Spec 09 §3.12 + 05 §3.14 + 01 §3.12] [Fase 0] Log de notificaciones enviadas (campana, email, WhatsApp, push).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Notificaciones (notif_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | sí |  |  |
| 4 | `event_code` | `character varying(50)` | no |  |  |
| 5 | `channel` | `character varying(20)` | no |  | Valores: `email`, `whatsapp`, `push`, `portal`. |
| 6 | `recipient_user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 7 | `recipient_address` | `character varying(190)` | sí |  |  |
| 8 | `subject` | `character varying(200)` | no |  |  |
| 9 | `body_rendered` | `text` | sí |  |  |
| 10 | `template_id` | `uuid` | sí |  | FK → notif_templates.id. |
| 11 | `source_type` | `character varying(40)` | sí |  |  |
| 12 | `source_id` | `uuid` | sí |  |  |
| 13 | `client_id` | `uuid` | sí |  | FK → crm_clients.id. |
| 14 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 15 | `audience` | `character varying(20)` | no | `'internal'::character varying` | Valores: `internal`, `client`, `passenger`, `agency`, `provider`. |
| 16 | `status` | `character varying(20)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `enviado`, `fallido`. |
| 17 | `retries` | `smallint` | no | `0` |  |
| 18 | `last_error` | `text` | sí |  |  |
| 19 | `is_fallback` | `boolean` | no | `false` |  |
| 20 | `fallback_of_id` | `uuid` | sí |  | FK → notif_messages.id. |
| 21 | `read_at` | `timestamp with time zone` | sí |  |  |
| 22 | `provider_message_id` | `character varying(120)` | sí |  |  |
| 23 | `sent_at` | `timestamp with time zone` | sí |  |  |
| 24 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 25 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `client_id` | `crm_clients.id` | NO ACTION | `fk_notif_messages_client_id` |
| `fallback_of_id` | `notif_messages.id` | NO ACTION | `fk_notif_messages_fallback_of_id` |
| `recipient_user_id` | `iam_users.id` | NO ACTION | `fk_notif_messages_recipient_user_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_notif_messages_reservation_id` |
| `template_id` | `notif_templates.id` | NO ACTION | `fk_notif_messages_template_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_notif_messages_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `notif_messages_audience_check` | `CHECK (((audience)::text = ANY ((ARRAY['internal'::character varying, 'client'::character varying, 'passenger'::character varying, 'agency'::character varying, 'provider'::character varying])::text[])))` | `audience`: `internal`, `client`, `passenger`, `agency`, `provider` |
| `notif_messages_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'whatsapp'::character varying, 'push'::character varying, 'portal'::character varying])::text[])))` | `channel`: `email`, `whatsapp`, `push`, `portal` |
| `notif_messages_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'enviado'::character varying, 'fallido'::character varying])::text[])))` | `status`: `pendiente`, `enviado`, `fallido` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_notif_messages_client_id` | `USING btree (client_id)` |
| `ix_notif_messages_fallback_of_id` | `USING btree (fallback_of_id)` |
| `ix_notif_messages_recipient_user_id` | `USING btree (recipient_user_id)` |
| `ix_notif_messages_reservation_id` | `USING btree (reservation_id)` |
| `ix_notif_messages_template_id` | `USING btree (template_id)` |
| `ix_notif_messages_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_notif_messages_tenant_id_recipient_user_id_read_at` | `USING btree (tenant_id, recipient_user_id, read_at)` |
| `ix_notif_messages_tenant_id_source_type_source_id` | `USING btree (tenant_id, source_type, source_id)` |
| `ix_notif_messages_tenant_id_status` | `USING btree (tenant_id, status)` |

[↑ Índice del dominio](#tablas)

### `notif_reads`

[Spec 05 §3.14] [Fase 0] Lecturas de notificación por usuario (app pasajero, campana).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Notificaciones (notif_) | Fase 0 · Fundaciones (`10_fase0.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `notification_id` | `uuid` | no |  | FK → notif_messages.id. |
| 4 | `user_id` | `uuid` | no |  | FK → iam_users.id. |
| 5 | `read_at` | `timestamp with time zone` | no | `now()` |  |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `notification_id` | `notif_messages.id` | CASCADE | `fk_notif_reads_notification_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_notif_reads_tenant_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_notif_reads_user_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_notif_reads_notification_id_user_id` | `notification_id, user_id` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_notif_reads_tenant_id` | `USING btree (tenant_id)` |
| `ix_notif_reads_user_id` | `USING btree (user_id)` |

[↑ Índice del dominio](#tablas)

### `notif_templates`

[Spec 09 §3.11] [Fase 0] Plantillas de notificación versionadas (tenant NULL = predeterminada del sistema).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Notificaciones (notif_) | Fase 0 · Fundaciones (`10_fase0.sql`) | shared (tenant + filas globales de solo lectura) · FORCE | `platform_access`, `tenant_isolation`, `tenant_shared_read` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | sí | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `event_code` | `character varying(50)` | no |  |  |
| 4 | `channel` | `character varying(20)` | no |  | Valores: `email`, `whatsapp`, `push`. |
| 5 | `version` | `integer` | no | `1` |  |
| 6 | `subject` | `character varying(200)` | no |  |  |
| 7 | `body` | `text` | no |  |  |
| 8 | `is_current` | `boolean` | no | `true` |  |
| 9 | `provider_template_id` | `character varying(120)` | sí |  |  |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_notif_templates_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_notif_templates_tenant_id_event_code_channel_p` | `tenant_id, event_code, channel` | `is_current` | índice único |
| `uq_notif_templates_tenant_id_event_code_channel_version_p` | `tenant_id, event_code, channel, version` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_notif_templates_1` | `CHECK ((((channel)::text <> 'push'::text) OR (char_length(body) <= 140)))` |  |
| `notif_templates_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'whatsapp'::character varying, 'push'::character varying])::text[])))` | `channel`: `email`, `whatsapp`, `push` |
| `notif_templates_version_check` | `CHECK ((version >= 1))` |  |

[↑ Índice del dominio](#tablas)

### `notif_pax_message_templates`

[Spec 17 §3.4] [Fase 2] Plantillas de mensajes automáticos al pasajero.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Notificaciones (notif_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `name` | `character varying(120)` | no |  |  |
| 5 | `event` | `character varying(30)` | no |  | Valores: `reserva_confirmada`, `saldo_vence`, `viaje`, `fin_viaje`, `cambio_horario`, `cumpleanos`. |
| 6 | `offset_hours` | `integer` | no | `0` |  |
| 7 | `offset_from_rule` | `boolean` | no | `false` |  |
| 8 | `channels` | `text[]` | no |  |  |
| 9 | `subject` | `character varying(200)` | sí |  |  |
| 10 | `body` | `text` | no |  |  |
| 11 | `lang` | `character(2)` | no | `'ES'::bpchar` | Valores: `ES`, `EN`. |
| 12 | `group_code` | `character varying(20)` | sí |  |  |
| 13 | `conditions` | `jsonb` | no | `'{}'::jsonb` |  |
| 14 | `whatsapp_template_name` | `character varying(120)` | sí |  |  |
| 15 | `active` | `boolean` | no | `true` |  |
| 16 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 17 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 18 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 19 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_notif_pax_message_templates_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_notif_pax_message_templates_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `notif_pax_message_templates_channels_check` | `CHECK (((cardinality(channels) >= 1) AND (channels <@ ARRAY['email'::text, 'whatsapp'::text, 'portal'::text, 'push'::text])))` |  |
| `notif_pax_message_templates_event_check` | `CHECK (((event)::text = ANY ((ARRAY['reserva_confirmada'::character varying, 'saldo_vence'::character varying, 'viaje'::character varying, 'fin_viaje'::character varying, 'cambio_horario'::character varying, 'cumpleanos'::character varying])::text[])))` | `event`: `reserva_confirmada`, `saldo_vence`, `viaje`, `fin_viaje`, `cambio_horario`, `cumpleanos` |
| `notif_pax_message_templates_lang_check` | `CHECK ((lang = ANY (ARRAY['ES'::bpchar, 'EN'::bpchar])))` | `lang`: `ES`, `EN` |
| `notif_pax_message_templates_offset_hours_check` | `CHECK (((offset_hours >= '-720'::integer) AND (offset_hours <= 720)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_notif_pax_message_templates_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_notif_pax_message_templates_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `notif_pax_messages`

[Spec 17 §3.5 + 04 §3 v2.1] [Fase 2] Mensajes al pasajero (programados, enviados, respuestas).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Notificaciones (notif_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 5 | `template_id` | `uuid` | sí |  | FK → notif_pax_message_templates.id. |
| 6 | `feedback_id` | `uuid` | sí |  | FK → channel_pax_feedback.id. |
| 7 | `channel` | `character varying(10)` | no |  | Valores: `email`, `whatsapp`, `portal`, `push`. |
| 8 | `recipient` | `character varying(200)` | no |  |  |
| 9 | `subject` | `text` | sí |  |  |
| 10 | `body` | `text` | sí |  |  |
| 11 | `status` | `character varying(15)` | no | `'programado'::character varying` | Valores: `programado`, `enviado`, `entregado`, `leido`, `fallido`, `cancelado`. |
| 12 | `direction` | `character varying(10)` | no | `'saliente'::character varying` | Valores: `saliente`, `entrante`. |
| 13 | `origin` | `character varying(10)` | no | `'auto'::character varying` | Valores: `auto`, `manual`, `prueba`. |
| 14 | `scheduled_at` | `timestamp with time zone` | sí |  |  |
| 15 | `sent_at` | `timestamp with time zone` | sí |  |  |
| 16 | `delivered_at` | `timestamp with time zone` | sí |  |  |
| 17 | `read_at` | `timestamp with time zone` | sí |  |  |
| 18 | `attempts` | `smallint` | no | `0` |  |
| 19 | `provider_message_id` | `character varying(120)` | sí |  |  |
| 20 | `error` | `text` | sí |  |  |
| 21 | `lang` | `character(2)` | no | `'ES'::bpchar` |  |
| 22 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 23 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 24 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 25 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `feedback_id` | `channel_pax_feedback.id` | NO ACTION | `fk_notif_pax_messages_feedback_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_notif_pax_messages_reservation_id` |
| `template_id` | `notif_pax_message_templates.id` | NO ACTION | `fk_notif_pax_messages_template_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_notif_pax_messages_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_notif_pax_messages_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_notif_pax_messages_tenant_id_reservation_id_template__fe1a07` | `tenant_id, reservation_id, template_id, channel` | `(((origin)::text = 'auto'::text) AND ((status)::text <> 'cancelado'::text))` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `notif_pax_messages_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'whatsapp'::character varying, 'portal'::character varying, 'push'::character varying])::text[])))` | `channel`: `email`, `whatsapp`, `portal`, `push` |
| `notif_pax_messages_direction_check` | `CHECK (((direction)::text = ANY ((ARRAY['saliente'::character varying, 'entrante'::character varying])::text[])))` | `direction`: `saliente`, `entrante` |
| `notif_pax_messages_origin_check` | `CHECK (((origin)::text = ANY ((ARRAY['auto'::character varying, 'manual'::character varying, 'prueba'::character varying])::text[])))` | `origin`: `auto`, `manual`, `prueba` |
| `notif_pax_messages_status_check` | `CHECK (((status)::text = ANY ((ARRAY['programado'::character varying, 'enviado'::character varying, 'entregado'::character varying, 'leido'::character varying, 'fallido'::character varying, 'cancelado'::character varying])::text[])))` | `status`: `programado`, `enviado`, `entregado`, `leido`, `fallido`, `cancelado` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_notif_pax_messages_feedback_id` | `USING btree (feedback_id)` |
| `ix_notif_pax_messages_reservation_id` | `USING btree (reservation_id)` |
| `ix_notif_pax_messages_template_id` | `USING btree (template_id)` |
| `ix_notif_pax_messages_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_notif_pax_messages_tenant_id_reservation_id` | `USING btree (tenant_id, reservation_id)` |
| `ix_notif_pax_messages_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_notif_pax_messages_tenant_id_status_scheduled_at` | `USING btree (tenant_id, status, scheduled_at)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_notif_pax_messages_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)
