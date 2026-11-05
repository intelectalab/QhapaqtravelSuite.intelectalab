# Diccionario de datos · Marketing (mkt_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.13 tras cargar `00`→`90`. No editar a mano._

Suscriptores, segmentos, plantillas, campañas, consentimientos, atribución y automatizaciones.

13 tablas · 188 columnas · 35 claves foráneas. Diagrama ER: [`../er/mkt.svg`](../er/mkt.svg) (fuente [`../er/mkt.mmd`](../er/mkt.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`mkt_attributions`](#mkt_attributions) | Fase 3 · SaaS y crecimiento | tenant | 13 | 5 | [Spec 14 §3.10] [Fase 3] Atribución de conversiones a campañas (read model). |
| [`mkt_automation_enrollments`](#mkt_automation_enrollments) | Fase 3 · SaaS y crecimiento | tenant | 10 | 2 | [Spec 14 §3.12] [Fase 3] Disparos procesados por automatización (idempotencia). |
| [`mkt_automation_runs`](#mkt_automation_runs) | Fase 3 · SaaS y crecimiento | tenant | 9 | 3 | [Spec 14 §3.12] [Fase 3] Ejecuciones de automatizaciones. |
| [`mkt_automations`](#mkt_automations) | Fase 3 · SaaS y crecimiento | tenant | 20 | 2 | [Spec 14 §3.11] [Fase 3] Automatizaciones de marketing / servicio. |
| [`mkt_campaign_recipients`](#mkt_campaign_recipients) | Fase 3 · SaaS y crecimiento | tenant | 18 | 2 | [Spec 14 §3.8] [Fase 3] Destinatarios de la campaña y métricas. |
| [`mkt_campaign_suppressions`](#mkt_campaign_suppressions) | Fase 3 · SaaS y crecimiento | tenant | 8 | 2 | [Spec 14 §3.9] [Fase 3] Contactos suprimidos del envío (evidencia). |
| [`mkt_campaign_tests`](#mkt_campaign_tests) | Fase 3 · SaaS y crecimiento | tenant | 11 | 3 | [Spec 14 §3.7] [Fase 3] Envíos de prueba de campaña. |
| [`mkt_campaigns`](#mkt_campaigns) | Fase 3 · SaaS y crecimiento | tenant | 24 | 5 | [Spec 14 §3.6] [Fase 3] Campañas de marketing. |
| [`mkt_consent_events`](#mkt_consent_events) | Fase 3 · SaaS y crecimiento | tenant | 9 | 3 | [Spec 14 §3.3] [Fase 3] Historial inmutable de consentimientos (evidencia ANPD). |
| [`mkt_consents`](#mkt_consents) | Fase 3 · SaaS y crecimiento | tenant | 19 | 2 | [Spec 14 §3.2] [Fase 3] Consentimiento vigente por titular y canal. |
| [`mkt_contacts_subscribers`](#mkt_contacts_subscribers) | Fase 3 · SaaS y crecimiento | tenant | 18 | 3 | [Spec 14 §3.1] [Fase 3] Suscriptores del newsletter. |
| [`mkt_segments`](#mkt_segments) | Fase 3 · SaaS y crecimiento | tenant | 13 | 2 | [Spec 14 §3.4] [Fase 3] Segmentos de audiencia. |
| [`mkt_templates`](#mkt_templates) | Fase 3 · SaaS y crecimiento | tenant | 16 | 1 | [Spec 14 §3.5] [Fase 3] Plantillas de marketing (email / WhatsApp). |

## Detalle por tabla

### `mkt_attributions`

[Spec 14 §3.10] [Fase 3] Atribución de conversiones a campañas (read model).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Marketing (mkt_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `campaign_id` | `uuid` | no |  | FK → mkt_campaigns.id. |
| 4 | `kind` | `character varying(20)` | no |  | Valores: `reservation`, `lead`, `promo_use`. |
| 5 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 6 | `lead_id` | `uuid` | sí |  | FK → crm_leads.id. |
| 7 | `ecom_order_id` | `uuid` | sí |  | FK → channel_ecom_orders.id. |
| 8 | `revenue_pen` | `numeric(14,2)` | sí |  |  |
| 9 | `attributed_at` | `timestamp with time zone` | no | `now()` |  |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 13 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `campaign_id` | `mkt_campaigns.id` | NO ACTION | `fk_mkt_attributions_campaign_id` |
| `ecom_order_id` | `channel_ecom_orders.id` | NO ACTION | `fk_mkt_attributions_ecom_order_id` |
| `lead_id` | `crm_leads.id` | NO ACTION | `fk_mkt_attributions_lead_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_mkt_attributions_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_mkt_attributions_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_mkt_attributions_tenant_id_kind_lead_id_p` | `tenant_id, kind, lead_id` | `(lead_id IS NOT NULL)` | índice único |
| `uq_mkt_attributions_tenant_id_kind_reservation_id_p` | `tenant_id, kind, reservation_id` | `(reservation_id IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_mkt_attributions_1` | `CHECK (((((kind)::text <> 'reservation'::text) OR (reservation_id IS NOT NULL)) AND (((kind)::text <> 'lead'::text) OR (lead_id IS NOT NULL)) AND (((kind)::text <> 'promo_use'::text) OR (ecom_order_id IS NOT NULL) OR (reservation_id IS NOT NULL))))` |  |
| `mkt_attributions_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['reservation'::character varying, 'lead'::character varying, 'promo_use'::character varying])::text[])))` | `kind`: `reservation`, `lead`, `promo_use` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_mkt_attributions_campaign_id` | `USING btree (campaign_id)` |
| `ix_mkt_attributions_ecom_order_id` | `USING btree (ecom_order_id)` |
| `ix_mkt_attributions_lead_id` | `USING btree (lead_id)` |
| `ix_mkt_attributions_reservation_id` | `USING btree (reservation_id)` |
| `ix_mkt_attributions_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_mkt_attributions_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `mkt_automation_enrollments`

[Spec 14 §3.12] [Fase 3] Disparos procesados por automatización (idempotencia).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Marketing (mkt_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `automation_id` | `uuid` | no |  | FK → mkt_automations.id. |
| 4 | `subject_type` | `character varying(20)` | no |  |  |
| 5 | `subject_id` | `uuid` | no |  |  |
| 6 | `ref_type` | `character varying(20)` | no |  | Valores: `subscriber`, `ecom_order`, `reservation`, `client`. |
| 7 | `ref_id` | `uuid` | no |  |  |
| 8 | `status` | `character varying(20)` | no |  | Valores: `enviado`, `suprimido`. |
| 9 | `reason` | `character varying(60)` | sí |  |  |
| 10 | `processed_at` | `timestamp with time zone` | no | `now()` |  |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `automation_id` | `mkt_automations.id` | NO ACTION | `fk_mkt_automation_enrollments_automation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_mkt_automation_enrollments_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_mkt_automation_enrollments_automation_id_subject_type_bd6412` | `automation_id, subject_type, subject_id, ref_type, ref_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `mkt_automation_enrollments_ref_type_check` | `CHECK (((ref_type)::text = ANY ((ARRAY['subscriber'::character varying, 'ecom_order'::character varying, 'reservation'::character varying, 'client'::character varying])::text[])))` | `ref_type`: `subscriber`, `ecom_order`, `reservation`, `client` |
| `mkt_automation_enrollments_status_check` | `CHECK (((status)::text = ANY ((ARRAY['enviado'::character varying, 'suprimido'::character varying])::text[])))` | `status`: `enviado`, `suprimido` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_mkt_automation_enrollments_tenant_id_status` | `USING btree (tenant_id, status)` |

[↑ Índice del dominio](#tablas)

### `mkt_automation_runs`

[Spec 14 §3.12] [Fase 3] Ejecuciones de automatizaciones.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Marketing (mkt_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `automation_id` | `uuid` | no |  | FK → mkt_automations.id. |
| 4 | `started_at` | `timestamp with time zone` | no | `now()` |  |
| 5 | `finished_at` | `timestamp with time zone` | sí |  |  |
| 6 | `queued` | `integer` | no | `0` |  |
| 7 | `sent` | `integer` | no | `0` |  |
| 8 | `suppressed` | `integer` | no | `0` |  |
| 9 | `triggered_by` | `uuid` | sí |  | FK → iam_users.id. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `automation_id` | `mkt_automations.id` | NO ACTION | `fk_mkt_automation_runs_automation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_mkt_automation_runs_tenant_id` |
| `triggered_by` | `iam_users.id` | NO ACTION | `fk_mkt_automation_runs_triggered_by` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_mkt_automation_runs_automation_id` | `USING btree (automation_id)` |
| `ix_mkt_automation_runs_tenant_id` | `USING btree (tenant_id)` |
| `ix_mkt_automation_runs_triggered_by` | `USING btree (triggered_by)` |

[↑ Índice del dominio](#tablas)

### `mkt_automations`

[Spec 14 §3.11] [Fase 3] Automatizaciones de marketing / servicio.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Marketing (mkt_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `key` | `character varying(30)` | no |  | Valores: `welcome`, `cart`, `pretrip`, `survey`, `birthday`, `reactivation`. |
| 5 | `name` | `character varying(120)` | no |  |  |
| 6 | `trigger_desc` | `character varying(200)` | no |  |  |
| 7 | `delay_desc` | `character varying(80)` | no |  |  |
| 8 | `delay_minutes` | `integer` | sí |  |  |
| 9 | `schedule_cron` | `character varying(60)` | sí |  |  |
| 10 | `channel` | `character varying(20)` | no |  | Valores: `email`, `whatsapp`. |
| 11 | `template_id` | `uuid` | no |  | FK → mkt_templates.id. |
| 12 | `purpose` | `character varying(20)` | no |  | Valores: `comercial`, `servicio`. |
| 13 | `status` | `character varying(20)` | no | `'pausada'::character varying` | Valores: `activa`, `pausada`. |
| 14 | `sent_total` | `integer` | no | `0` |  |
| 15 | `suppressed_total` | `integer` | no | `0` |  |
| 16 | `conversions_total` | `integer` | no | `0` |  |
| 17 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 18 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 19 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 20 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `template_id` | `mkt_templates.id` | NO ACTION | `fk_mkt_automations_template_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_mkt_automations_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_mkt_automations_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_mkt_automations_tenant_id_key` | `tenant_id, key` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `mkt_automations_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'whatsapp'::character varying])::text[])))` | `channel`: `email`, `whatsapp` |
| `mkt_automations_key_check` | `CHECK (((key)::text = ANY ((ARRAY['welcome'::character varying, 'cart'::character varying, 'pretrip'::character varying, 'survey'::character varying, 'birthday'::character varying, 'reactivation'::character varying])::text[])))` | `key`: `welcome`, `cart`, `pretrip`, `survey`, `birthday`, `reactivation` |
| `mkt_automations_purpose_check` | `CHECK (((purpose)::text = ANY ((ARRAY['comercial'::character varying, 'servicio'::character varying])::text[])))` | `purpose`: `comercial`, `servicio` |
| `mkt_automations_status_check` | `CHECK (((status)::text = ANY ((ARRAY['activa'::character varying, 'pausada'::character varying])::text[])))` | `status`: `activa`, `pausada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_mkt_automations_template_id` | `USING btree (template_id)` |
| `ix_mkt_automations_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_mkt_automations_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_mkt_automations_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `mkt_campaign_recipients`

[Spec 14 §3.8] [Fase 3] Destinatarios de la campaña y métricas.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Marketing (mkt_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `campaign_id` | `uuid` | no |  | FK → mkt_campaigns.id. |
| 4 | `subject_type` | `character varying(20)` | no |  |  |
| 5 | `subject_id` | `uuid` | no |  |  |
| 6 | `address` | `character varying(160)` | no |  |  |
| 7 | `provider_message_id` | `character varying(120)` | sí |  |  |
| 8 | `status` | `character varying(20)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `enviado`, `entregado`, `rebotado`, `fallido`. |
| 9 | `delivered_at` | `timestamp with time zone` | sí |  |  |
| 10 | `opened_at` | `timestamp with time zone` | sí |  |  |
| 11 | `clicked_at` | `timestamp with time zone` | sí |  |  |
| 12 | `replied_at` | `timestamp with time zone` | sí |  |  |
| 13 | `unsubscribed_at` | `timestamp with time zone` | sí |  |  |
| 14 | `error` | `text` | sí |  |  |
| 15 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 16 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 17 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 18 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `campaign_id` | `mkt_campaigns.id` | NO ACTION | `fk_mkt_campaign_recipients_campaign_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_mkt_campaign_recipients_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_mkt_campaign_recipients_campaign_id_subject_type_subject_id` | `campaign_id, subject_type, subject_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `mkt_campaign_recipients_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'enviado'::character varying, 'entregado'::character varying, 'rebotado'::character varying, 'fallido'::character varying])::text[])))` | `status`: `pendiente`, `enviado`, `entregado`, `rebotado`, `fallido` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_mkt_campaign_recipients_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_mkt_campaign_recipients_tenant_id_subject_type_subjec_4344ad` | `USING btree (tenant_id, subject_type, subject_id, campaign_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_mkt_campaign_recipients_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `mkt_campaign_suppressions`

[Spec 14 §3.9] [Fase 3] Contactos suprimidos del envío (evidencia).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Marketing (mkt_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `campaign_id` | `uuid` | no |  | FK → mkt_campaigns.id. |
| 4 | `subject_type` | `character varying(20)` | no |  |  |
| 5 | `subject_id` | `uuid` | no |  |  |
| 6 | `reason` | `character varying(20)` | no |  | Valores: `optout`, `nodata`, `consent`, `fatigue`. |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `campaign_id` | `mkt_campaigns.id` | NO ACTION | `fk_mkt_campaign_suppressions_campaign_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_mkt_campaign_suppressions_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_mkt_campaign_suppressions_campaign_id_subject_type_su_c790b4` | `campaign_id, subject_type, subject_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `mkt_campaign_suppressions_reason_check` | `CHECK (((reason)::text = ANY ((ARRAY['optout'::character varying, 'nodata'::character varying, 'consent'::character varying, 'fatigue'::character varying])::text[])))` | `reason`: `optout`, `nodata`, `consent`, `fatigue` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_mkt_campaign_suppressions_tenant_id` | `USING btree (tenant_id)` |

[↑ Índice del dominio](#tablas)

### `mkt_campaign_tests`

[Spec 14 §3.7] [Fase 3] Envíos de prueba de campaña.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Marketing (mkt_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `campaign_id` | `uuid` | no |  | FK → mkt_campaigns.id. |
| 4 | `to_user_id` | `uuid` | no |  | FK → iam_users.id. |
| 5 | `to_address` | `character varying(160)` | no |  |  |
| 6 | `sample_subject_type` | `character varying(20)` | sí |  |  |
| 7 | `sample_subject_id` | `uuid` | sí |  |  |
| 8 | `sent_at` | `timestamp with time zone` | no | `now()` |  |
| 9 | `invalidated_at` | `timestamp with time zone` | sí |  |  |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `campaign_id` | `mkt_campaigns.id` | NO ACTION | `fk_mkt_campaign_tests_campaign_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_mkt_campaign_tests_tenant_id` |
| `to_user_id` | `iam_users.id` | NO ACTION | `fk_mkt_campaign_tests_to_user_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_mkt_campaign_tests_campaign_id` | `USING btree (campaign_id)` |
| `ix_mkt_campaign_tests_tenant_id` | `USING btree (tenant_id)` |
| `ix_mkt_campaign_tests_to_user_id` | `USING btree (to_user_id)` |

[↑ Índice del dominio](#tablas)

### `mkt_campaigns`

[Spec 14 §3.6] [Fase 3] Campañas de marketing.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Marketing (mkt_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `name` | `character varying(160)` | no |  |  |
| 5 | `channel` | `character varying(20)` | no |  | Valores: `email`, `whatsapp`. |
| 6 | `segment_id` | `uuid` | no |  | FK → mkt_segments.id. |
| 7 | `template_id` | `uuid` | no |  | FK → mkt_templates.id. |
| 8 | `subject` | `character varying(200)` | sí |  |  |
| 9 | `body` | `text` | no |  |  |
| 10 | `promotion_id` | `uuid` | sí |  | FK → catalog_product_promotions.id. |
| 11 | `promo_code` | `character varying(20)` | sí |  |  |
| 12 | `utm` | `character varying(200)` | no |  |  |
| 13 | `status` | `character varying(20)` | no | `'borrador'::character varying` | Valores: `borrador`, `programada`, `enviando`, `enviada`, `cancelada`. |
| 14 | `scheduled_at` | `timestamp with time zone` | sí |  |  |
| 15 | `sent_at` | `timestamp with time zone` | sí |  |  |
| 16 | `completed_at` | `timestamp with time zone` | sí |  |  |
| 17 | `cancel_reason` | `text` | sí |  |  |
| 18 | `audience_snapshot` | `jsonb` | sí |  |  |
| 19 | `owner_id` | `uuid` | no |  | FK → iam_users.id. |
| 20 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 21 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 22 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 23 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 24 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `owner_id` | `iam_users.id` | NO ACTION | `fk_mkt_campaigns_owner_id` |
| `promotion_id` | `catalog_product_promotions.id` | NO ACTION | `fk_mkt_campaigns_promotion_id` |
| `segment_id` | `mkt_segments.id` | NO ACTION | `fk_mkt_campaigns_segment_id` |
| `template_id` | `mkt_templates.id` | NO ACTION | `fk_mkt_campaigns_template_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_mkt_campaigns_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_mkt_campaigns_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `mkt_campaigns_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'whatsapp'::character varying])::text[])))` | `channel`: `email`, `whatsapp` |
| `mkt_campaigns_status_check` | `CHECK (((status)::text = ANY ((ARRAY['borrador'::character varying, 'programada'::character varying, 'enviando'::character varying, 'enviada'::character varying, 'cancelada'::character varying])::text[])))` | `status`: `borrador`, `programada`, `enviando`, `enviada`, `cancelada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_mkt_campaigns_owner_id` | `USING btree (owner_id)` |
| `ix_mkt_campaigns_promotion_id` | `USING btree (promotion_id)` |
| `ix_mkt_campaigns_segment_id` | `USING btree (segment_id)` |
| `ix_mkt_campaigns_template_id` | `USING btree (template_id)` |
| `ix_mkt_campaigns_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_mkt_campaigns_tenant_id_owner_id` | `USING btree (tenant_id, owner_id)` |
| `ix_mkt_campaigns_tenant_id_scheduled_at_p` | `USING btree (tenant_id, scheduled_at) WHERE ((status)::text = 'programada'::text)` |
| `ix_mkt_campaigns_tenant_id_sent_at_desc` | `USING btree (tenant_id, sent_at DESC)` |
| `ix_mkt_campaigns_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_mkt_campaigns_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_mkt_campaigns_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `mkt_consent_events`

[Spec 14 §3.3] [Fase 3] Historial inmutable de consentimientos (evidencia ANPD).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Marketing (mkt_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `consent_id` | `uuid` | no |  | FK → mkt_consents.id. |
| 4 | `event` | `character varying(20)` | no |  | Valores: `otorgado`, `revocado`. |
| 5 | `source` | `character varying(120)` | no |  |  |
| 6 | `evidence` | `text` | sí |  |  |
| 7 | `actor_id` | `uuid` | sí |  | FK → iam_users.id. |
| 8 | `occurred_at` | `timestamp with time zone` | no | `now()` |  |
| 9 | `ip` | `inet` | sí |  |  |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `actor_id` | `iam_users.id` | NO ACTION | `fk_mkt_consent_events_actor_id` |
| `consent_id` | `mkt_consents.id` | NO ACTION | `fk_mkt_consent_events_consent_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_mkt_consent_events_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `mkt_consent_events_event_check` | `CHECK (((event)::text = ANY ((ARRAY['otorgado'::character varying, 'revocado'::character varying])::text[])))` | `event`: `otorgado`, `revocado` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_mkt_consent_events_actor_id` | `USING btree (actor_id)` |
| `ix_mkt_consent_events_consent_id` | `USING btree (consent_id)` |
| `ix_mkt_consent_events_tenant_id_occurred_at` | `USING btree (tenant_id, occurred_at)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_mkt_consent_events_append_only` | BEFORE DELETE OR UPDATE | `app_forbid_update_delete` |

[↑ Índice del dominio](#tablas)

### `mkt_consents`

[Spec 14 §3.2] [Fase 3] Consentimiento vigente por titular y canal.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Marketing (mkt_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `subject_type` | `character varying(20)` | no |  | Valores: `client`, `lead`, `subscriber`. |
| 5 | `subject_id` | `uuid` | no |  |  |
| 6 | `channel` | `character varying(20)` | no |  | Valores: `email`, `whatsapp`. |
| 7 | `status` | `character varying(20)` | no | `'otorgado'::character varying` | Valores: `otorgado`, `revocado`. |
| 8 | `granted_at` | `timestamp with time zone` | no |  |  |
| 9 | `source` | `character varying(120)` | no |  |  |
| 10 | `evidence` | `text` | no |  |  |
| 11 | `policy_version` | `character varying(20)` | no |  |  |
| 12 | `revoked_at` | `timestamp with time zone` | sí |  |  |
| 13 | `revoke_source` | `character varying(120)` | sí |  |  |
| 14 | `revoke_campaign_id` | `uuid` | sí |  | FK → mkt_campaigns.id. |
| 15 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 16 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 17 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 18 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 19 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `revoke_campaign_id` | `mkt_campaigns.id` | NO ACTION | `fk_mkt_consents_revoke_campaign_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_mkt_consents_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_mkt_consents_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_mkt_consents_tenant_id_subject_type_subject_id_channel` | `tenant_id, subject_type, subject_id, channel` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_mkt_consents_1` | `CHECK ((((status)::text = 'revocado'::text) = (revoked_at IS NOT NULL)))` |  |
| `mkt_consents_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'whatsapp'::character varying])::text[])))` | `channel`: `email`, `whatsapp` |
| `mkt_consents_status_check` | `CHECK (((status)::text = ANY ((ARRAY['otorgado'::character varying, 'revocado'::character varying])::text[])))` | `status`: `otorgado`, `revocado` |
| `mkt_consents_subject_type_check` | `CHECK (((subject_type)::text = ANY ((ARRAY['client'::character varying, 'lead'::character varying, 'subscriber'::character varying])::text[])))` | `subject_type`: `client`, `lead`, `subscriber` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_mkt_consents_revoke_campaign_id` | `USING btree (revoke_campaign_id)` |
| `ix_mkt_consents_tenant_id_channel_p` | `USING btree (tenant_id, channel) WHERE ((status)::text = 'otorgado'::text)` |
| `ix_mkt_consents_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_mkt_consents_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_mkt_consents_tenant_id_subject_type_subject_id` | `USING btree (tenant_id, subject_type, subject_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_mkt_consents_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_mkt_consents_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `mkt_contacts_subscribers`

[Spec 14 §3.1] [Fase 3] Suscriptores del newsletter.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Marketing (mkt_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `full_name` | `character varying(160)` | no |  |  |
| 5 | `email` | `citext` | no |  |  |
| 6 | `phone` | `character varying(30)` | sí |  |  |
| 7 | `phone_e164` | `character varying(20)` | sí |  |  |
| 8 | `country` | `character varying(60)` | sí |  |  |
| 9 | `interest_destination` | `character varying(120)` | sí |  |  |
| 10 | `source` | `character varying(60)` | no |  |  |
| 11 | `client_id` | `uuid` | sí |  | FK → crm_clients.id. |
| 12 | `lead_id` | `uuid` | sí |  | FK → crm_leads.id. |
| 13 | `double_opt_in_at` | `timestamp with time zone` | sí |  |  |
| 14 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 15 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 16 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 17 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 18 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `client_id` | `crm_clients.id` | NO ACTION | `fk_mkt_contacts_subscribers_client_id` |
| `lead_id` | `crm_leads.id` | NO ACTION | `fk_mkt_contacts_subscribers_lead_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_mkt_contacts_subscribers_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_mkt_contacts_subscribers_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_mkt_contacts_subscribers_tenant_id_email` | `tenant_id, email` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_mkt_contacts_subscribers_client_id` | `USING btree (client_id)` |
| `ix_mkt_contacts_subscribers_lead_id` | `USING btree (lead_id)` |
| `ix_mkt_contacts_subscribers_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_mkt_contacts_subscribers_tenant_id_phone_e164` | `USING btree (tenant_id, phone_e164)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_mkt_contacts_subscribers_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `mkt_segments`

[Spec 14 §3.4] [Fase 3] Segmentos de audiencia.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Marketing (mkt_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `name` | `character varying(160)` | no |  |  |
| 5 | `description` | `text` | sí |  |  |
| 6 | `match` | `character varying(5)` | no | `'all'::character varying` | Valores: `all`, `any`. |
| 7 | `rules` | `jsonb` | no | `'[]'::jsonb` |  |
| 8 | `owner_id` | `uuid` | no |  | FK → iam_users.id. |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 12 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 13 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `owner_id` | `iam_users.id` | NO ACTION | `fk_mkt_segments_owner_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_mkt_segments_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_mkt_segments_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_mkt_segments_tenant_id_lower_name` | `tenant_id, lower((name)::text)` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `mkt_segments_match_check` | `CHECK (((match)::text = ANY ((ARRAY['all'::character varying, 'any'::character varying])::text[])))` | `match`: `all`, `any` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_mkt_segments_owner_id` | `USING btree (owner_id)` |
| `ix_mkt_segments_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_mkt_segments_tenant_id_owner_id` | `USING btree (tenant_id, owner_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_mkt_segments_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `mkt_templates`

[Spec 14 §3.5] [Fase 3] Plantillas de marketing (email / WhatsApp).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Marketing (mkt_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `name` | `character varying(120)` | no |  |  |
| 5 | `channel` | `character varying(20)` | no |  | Valores: `email`, `whatsapp`. |
| 6 | `category` | `character varying(20)` | no |  | Valores: `MARKETING`, `UTILITY`, `SERVICIO`. |
| 7 | `status` | `character varying(20)` | no | `'activa'::character varying` | Valores: `activa`, `en_revision`, `aprobada`, `rechazada`. |
| 8 | `provider_template_id` | `character varying(60)` | sí |  |  |
| 9 | `language` | `character varying(10)` | no | `'es'::character varying` |  |
| 10 | `subject` | `character varying(200)` | sí |  |  |
| 11 | `body` | `text` | no |  |  |
| 12 | `reviewed_at` | `timestamp with time zone` | sí |  |  |
| 13 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 14 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 15 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 16 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_mkt_templates_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_mkt_templates_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_mkt_templates_1` | `CHECK ((((channel)::text <> 'email'::text) OR (subject IS NOT NULL)))` |  |
| `ck_mkt_templates_2` | `CHECK ((((channel)::text <> 'whatsapp'::text) OR ((name)::text ~ '^[a-z0-9_]+$'::text)))` |  |
| `mkt_templates_category_check` | `CHECK (((category)::text = ANY ((ARRAY['MARKETING'::character varying, 'UTILITY'::character varying, 'SERVICIO'::character varying])::text[])))` | `category`: `MARKETING`, `UTILITY`, `SERVICIO` |
| `mkt_templates_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'whatsapp'::character varying])::text[])))` | `channel`: `email`, `whatsapp` |
| `mkt_templates_status_check` | `CHECK (((status)::text = ANY ((ARRAY['activa'::character varying, 'en_revision'::character varying, 'aprobada'::character varying, 'rechazada'::character varying])::text[])))` | `status`: `activa`, `en_revision`, `aprobada`, `rechazada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_mkt_templates_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_mkt_templates_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_mkt_templates_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)
