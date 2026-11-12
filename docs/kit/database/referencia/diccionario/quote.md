# Diccionario de datos · Cotizaciones (quote_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.15 tras cargar `00`→`90`. No editar a mano._

Cotizaciones, versiones, ítems, aprobaciones, envíos y vistas.

10 tablas · 188 columnas · 43 claves foráneas. Diagrama ER: [`../er/quote.svg`](../er/quote.svg) (fuente [`../er/quote.mmd`](../er/quote.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`quote_access_tokens`](#quote_access_tokens) | Fase 1 · MVP | tenant | 8 | 2 | [Spec 03 §3] [Fase 1] Tokens (hash) del enlace público de la cotización. |
| [`quote_approvals`](#quote_approvals) | Fase 1 · MVP | tenant | 16 | 4 | [Spec 08 §3.15] [Fase 1] Evidencia de aprobación del cliente desde el portal. |
| [`quote_internal_approvals`](#quote_internal_approvals) | Fase 1 · MVP | tenant | 17 | 4 | [Spec 03 §3] [Fase 1] Solicitud y decisión de aprobación interna (gerencia). |
| [`quote_items`](#quote_items) | Fase 1 · MVP | tenant | 23 | 5 | [Spec 03 §3] [Fase 1] Ítems de la versión (producto, tarifa, fecha, pax). |
| [`quote_negotiations`](#quote_negotiations) | Fase 1 · MVP | tenant | 10 | 3 | [Spec 03 §3] [Fase 1] Registro de negociación con el cliente. |
| [`quote_quotes`](#quote_quotes) | Fase 1 · MVP | tenant | 38 | 8 | [Spec 03 §3] [Fase 1] Cotización (cabecera). |
| [`quote_sends`](#quote_sends) | Fase 1 · MVP | tenant | 12 | 4 | [Spec 03 §3] [Fase 1] Envíos de la cotización por canal. |
| [`quote_versions`](#quote_versions) | Fase 1 · MVP | tenant | 35 | 6 | [Spec 03 §3] [Fase 1] Versiones de cotización (congeladas al enviar). |
| [`quote_views`](#quote_views) | Fase 1 · MVP | tenant | 9 | 3 | [Spec 03 §3] [Fase 1] Aperturas de la cotización (portal o registro manual). |
| [`quote_external_offers`](#quote_external_offers) | Fase 3 · SaaS y crecimiento | tenant | 20 | 4 | [Spec 19 §3.12] [Fase 3] Ofertas de aéreo, hotel, auto o seguro tomadas de un GDS o banco de camas para una cotización. |

## Detalle por tabla

### `quote_access_tokens`

[Spec 03 §3] [Fase 1] Tokens (hash) del enlace público de la cotización.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Cotizaciones (quote_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → quote_quotes.tenant_id, tenants.id. |
| 3 | `quote_id` | `uuid` | no |  | FK → quote_quotes.id. |
| 4 | `token_hash` | `character varying(80)` | no |  |  |
| 5 | `expires_at` | `date` | no |  |  |
| 6 | `revoked_at` | `timestamp with time zone` | sí |  |  |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, quote_id` | `quote_quotes.tenant_id, id` | NO ACTION | `fk_quote_access_tokens_quote_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_quote_access_tokens_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_quote_access_tokens_id` | `tenant_id, id` |  | restricción |
| `uq_quote_access_tokens_token_hash` | `token_hash` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_quote_access_tokens_quote_id` | `USING btree (quote_id)` |
| `ix_quote_access_tokens_tenant_id` | `USING btree (tenant_id)` |

[↑ Índice del dominio](#tablas)

### `quote_approvals`

[Spec 08 §3.15] [Fase 1] Evidencia de aprobación del cliente desde el portal.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Cotizaciones (quote_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → quote_quotes.tenant_id, quote_versions.tenant_id, tenants.id, quote_access_tokens.tenant_id. |
| 3 | `quote_id` | `uuid` | no |  | FK → quote_quotes.id. |
| 4 | `quote_version_id` | `uuid` | sí |  | FK → quote_versions.id. |
| 5 | `version_no` | `smallint` | no |  |  |
| 6 | `approved_at` | `timestamp with time zone` | no | `now()` |  |
| 7 | `approver_name` | `character varying(150)` | no |  |  |
| 8 | `channel` | `character varying(60)` | no | `'Portal cliente'::character varying` |  |
| 9 | `ip` | `inet` | sí |  |  |
| 10 | `token_id` | `uuid` | sí |  | FK → quote_access_tokens.id. |
| 11 | `total` | `numeric(14,2)` | no |  |  |
| 12 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 13 | `note` | `text` | sí |  |  |
| 14 | `evidence_hash` | `character(71)` | no |  |  |
| 15 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 16 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, quote_id` | `quote_quotes.tenant_id, id` | NO ACTION | `fk_quote_approvals_quote_id` |
| `tenant_id, quote_version_id` | `quote_versions.tenant_id, id` | NO ACTION | `fk_quote_approvals_quote_version_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_quote_approvals_tenant_id` |
| `tenant_id, token_id` | `quote_access_tokens.tenant_id, id` | NO ACTION | `fk_quote_approvals_token_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `quote_approvals_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `quote_approvals_evidence_hash_check` | `CHECK ((evidence_hash ~~ 'sha256:%'::text))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_quote_approvals_quote_id` | `USING btree (quote_id)` |
| `ix_quote_approvals_quote_version_id` | `USING btree (quote_version_id)` |
| `ix_quote_approvals_tenant_id_quote_id` | `USING btree (tenant_id, quote_id)` |
| `ix_quote_approvals_token_id` | `USING btree (token_id)` |

[↑ Índice del dominio](#tablas)

### `quote_internal_approvals`

[Spec 03 §3] [Fase 1] Solicitud y decisión de aprobación interna (gerencia).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Cotizaciones (quote_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, quote_versions.tenant_id, iam_users.tenant_id, tenants.id. |
| 3 | `quote_version_id` | `uuid` | no |  | FK → quote_versions.id. |
| 4 | `reasons` | `jsonb` | no | `'[]'::jsonb` |  |
| 5 | `over_cap` | `boolean` | no | `false` |  |
| 6 | `requested_by` | `uuid` | sí |  | FK → iam_users.id. |
| 7 | `requested_at` | `timestamp with time zone` | sí |  |  |
| 8 | `request_note` | `text` | sí |  |  |
| 9 | `status` | `character varying(20)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `aprobada`, `rechazada`, `anulada`. |
| 10 | `decided_by` | `uuid` | sí |  | FK → iam_users.id. |
| 11 | `decided_at` | `timestamp with time zone` | sí |  |  |
| 12 | `decision_note` | `text` | sí |  |  |
| 13 | `is_override` | `boolean` | no | `false` |  |
| 14 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 15 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 16 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 17 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, decided_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_quote_internal_approvals_decided_by` |
| `tenant_id, quote_version_id` | `quote_versions.tenant_id, id` | NO ACTION | `fk_quote_internal_approvals_quote_version_id` |
| `tenant_id, requested_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_quote_internal_approvals_requested_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_quote_internal_approvals_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_quote_internal_approvals_id` | `tenant_id, id` |  | restricción |
| `uq_quote_internal_approvals_tenant_id_quote_version_id_p` | `tenant_id, quote_version_id` | `((status)::text = 'pendiente'::text)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `quote_internal_approvals_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'anulada'::character varying])::text[])))` | `status`: `pendiente`, `aprobada`, `rechazada`, `anulada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_quote_internal_approvals_decided_by` | `USING btree (decided_by)` |
| `ix_quote_internal_approvals_quote_version_id` | `USING btree (quote_version_id)` |
| `ix_quote_internal_approvals_requested_by` | `USING btree (requested_by)` |
| `ix_quote_internal_approvals_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_quote_internal_approvals_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `quote_items`

[Spec 03 §3] [Fase 1] Ítems de la versión (producto, tarifa, fecha, pax).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Cotizaciones (quote_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, quote_versions.tenant_id, catalog_rates.tenant_id, catalog_seasons.tenant_id, tenants.id. |
| 3 | `quote_version_id` | `uuid` | no |  | FK → quote_versions.id. |
| 4 | `line_no` | `smallint` | no |  |  |
| 5 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 6 | `product_version` | `character varying(10)` | no |  |  |
| 7 | `rate_id` | `uuid` | sí |  | FK → catalog_rates.id. |
| 8 | `segment` | `character varying(15)` | no |  | Valores: `Adulto`, `Niño`, `Infante`, `Grupo`, `Pasajero`. |
| 9 | `service_date` | `date` | no |  |  |
| 10 | `qty` | `integer` | no |  |  |
| 11 | `pax` | `integer` | no |  |  |
| 12 | `unit_cost` | `numeric(14,2)` | no |  |  |
| 13 | `unit_price` | `numeric(14,2)` | no |  |  |
| 14 | `cost_total` | `numeric(14,2)` | sí | `generada: round(((unit_cost * (qty)::numeric) * (pax)::numeric), 2)` |  |
| 15 | `sale_total` | `numeric(14,2)` | sí | `generada: round(((unit_price * (qty)::numeric) * (pax)::numeric), 2)` |  |
| 16 | `season_id` | `uuid` | sí |  | FK → catalog_seasons.id. |
| 17 | `season_factor` | `numeric(6,3)` | sí |  |  |
| 18 | `price_source` | `character varying(10)` | no | `'rate'::character varying` | Valores: `rate`, `manual`. |
| 19 | `rate_snapshot` | `jsonb` | sí |  |  |
| 20 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 21 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 22 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 23 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | NO ACTION | `fk_quote_items_product_id` |
| `tenant_id, quote_version_id` | `quote_versions.tenant_id, id` | CASCADE | `fk_quote_items_quote_version_id` |
| `tenant_id, rate_id` | `catalog_rates.tenant_id, id` | NO ACTION | `fk_quote_items_rate_id` |
| `tenant_id, season_id` | `catalog_seasons.tenant_id, id` | NO ACTION | `fk_quote_items_season_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_quote_items_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_quote_items_id` | `tenant_id, id` |  | restricción |
| `uq_quote_items_quote_version_id_line_no` | `quote_version_id, line_no` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `quote_items_pax_check` | `CHECK ((pax > 0))` |  |
| `quote_items_price_source_check` | `CHECK (((price_source)::text = ANY ((ARRAY['rate'::character varying, 'manual'::character varying])::text[])))` | `price_source`: `rate`, `manual` |
| `quote_items_qty_check` | `CHECK ((qty > 0))` |  |
| `quote_items_segment_check` | `CHECK (((segment)::text = ANY ((ARRAY['Adulto'::character varying, 'Niño'::character varying, 'Infante'::character varying, 'Grupo'::character varying, 'Pasajero'::character varying])::text[])))` | `segment`: `Adulto`, `Niño`, `Infante`, `Grupo`, `Pasajero` |
| `quote_items_unit_cost_check` | `CHECK ((unit_cost >= (0)::numeric))` |  |
| `quote_items_unit_price_check` | `CHECK ((unit_price > (0)::numeric))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_quote_items_product_id` | `USING btree (product_id)` |
| `ix_quote_items_rate_id` | `USING btree (rate_id)` |
| `ix_quote_items_season_id` | `USING btree (season_id)` |
| `ix_quote_items_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_quote_items_frozen_guard` | BEFORE INSERT OR DELETE OR UPDATE | `app_quote_items_frozen_guard` |
| `trg_quote_items_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `quote_negotiations`

[Spec 03 §3] [Fase 1] Registro de negociación con el cliente.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Cotizaciones (quote_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → quote_quotes.tenant_id, iam_users.tenant_id, tenants.id. |
| 3 | `quote_id` | `uuid` | no |  | FK → quote_quotes.id. |
| 4 | `channel` | `character varying(15)` | no |  | Valores: `Llamada`, `Reunión`, `Email`, `WhatsApp`. |
| 5 | `note` | `text` | no |  |  |
| 6 | `created_version_no` | `smallint` | sí |  |  |
| 7 | `recorded_by` | `uuid` | no |  | FK → iam_users.id. |
| 8 | `recorded_at` | `timestamp with time zone` | no | `now()` |  |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, quote_id` | `quote_quotes.tenant_id, id` | NO ACTION | `fk_quote_negotiations_quote_id` |
| `tenant_id, recorded_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_quote_negotiations_recorded_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_quote_negotiations_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `quote_negotiations_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['Llamada'::character varying, 'Reunión'::character varying, 'Email'::character varying, 'WhatsApp'::character varying])::text[])))` | `channel`: `Llamada`, `Reunión`, `Email`, `WhatsApp` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_quote_negotiations_quote_id` | `USING btree (quote_id)` |
| `ix_quote_negotiations_recorded_by` | `USING btree (recorded_by)` |
| `ix_quote_negotiations_tenant_id` | `USING btree (tenant_id)` |

[↑ Índice del dominio](#tablas)

### `quote_quotes`

[Spec 03 §3] [Fase 1] Cotización (cabecera).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Cotizaciones (quote_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, crm_clients.tenant_id, quote_versions.tenant_id, quote_quotes.tenant_id, crm_opportunities.tenant_id, iam_users.tenant_id, booking_reservations.tenant_id, tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `client_id` | `uuid` | no |  | FK → crm_clients.id. |
| 5 | `opportunity_id` | `uuid` | sí |  | FK → crm_opportunities.id. |
| 6 | `owner_id` | `uuid` | no |  | FK → iam_users.id. |
| 7 | `title` | `character varying(200)` | no |  |  |
| 8 | `status` | `character varying(30)` | no | `'borrador'::character varying` | Valores: `borrador`, `enviada`, `vista`, `negociacion`, `aprobada`, `rechazada`, `vencida`, `convertida`, `cancelada`. |
| 9 | `current_version_no` | `smallint` | no | `1` |  |
| 10 | `current_version_id` | `uuid` | sí |  | FK → quote_versions.id. |
| 11 | `travel_from` | `date` | no |  |  |
| 12 | `travel_to` | `date` | no |  |  |
| 13 | `valid_until` | `date` | no |  |  |
| 14 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 15 | `fx_rate` | `numeric(12,6)` | no |  |  |
| 16 | `pax_adt` | `smallint` | no | `0` |  |
| 17 | `pax_chd` | `smallint` | no | `0` |  |
| 18 | `pax_inf` | `smallint` | no | `0` |  |
| 19 | `viewed_at` | `timestamp with time zone` | sí |  |  |
| 20 | `approved_at` | `timestamp with time zone` | sí |  |  |
| 21 | `approved_by_name` | `character varying(150)` | sí |  |  |
| 22 | `approval_channel` | `character varying(60)` | sí |  |  |
| 23 | `approval_ref` | `character varying(200)` | sí |  |  |
| 24 | `approval_recorded_by` | `uuid` | sí |  | FK → iam_users.id. |
| 25 | `approval_ip` | `inet` | sí |  |  |
| 26 | `approval_hash` | `character varying(80)` | sí |  |  |
| 27 | `approval_version_no` | `smallint` | sí |  |  |
| 28 | `rejected_at` | `timestamp with time zone` | sí |  |  |
| 29 | `rejected_reason` | `text` | sí |  |  |
| 30 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 31 | `converted_at` | `timestamp with time zone` | sí |  |  |
| 32 | `duplicated_from_id` | `uuid` | sí |  | FK → quote_quotes.id. |
| 33 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 34 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 35 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 36 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 37 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 38 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, approval_recorded_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_quote_quotes_approval_recorded_by` |
| `tenant_id, client_id` | `crm_clients.tenant_id, id` | NO ACTION | `fk_quote_quotes_client_id` |
| `tenant_id, current_version_id` | `quote_versions.tenant_id, id` | NO ACTION · DEFERRABLE | `fk_quote_quotes_current_version_id` |
| `tenant_id, duplicated_from_id` | `quote_quotes.tenant_id, id` | NO ACTION | `fk_quote_quotes_duplicated_from_id` |
| `tenant_id, opportunity_id` | `crm_opportunities.tenant_id, id` | NO ACTION | `fk_quote_quotes_opportunity_id` |
| `tenant_id, owner_id` | `iam_users.tenant_id, id` | NO ACTION | `fk_quote_quotes_owner_id` |
| `tenant_id, reservation_id` | `booking_reservations.tenant_id, id` | NO ACTION | `fk_quote_quotes_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_quote_quotes_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_quote_quotes_id` | `tenant_id, id` |  | restricción |
| `uq_quote_quotes_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_quote_quotes_tenant_id_reservation_id_p` | `tenant_id, reservation_id` | `(reservation_id IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_quote_quotes_1` | `CHECK ((travel_to >= travel_from))` |  |
| `ck_quote_quotes_2` | `CHECK ((((pax_adt + pax_chd) + pax_inf) > 0))` |  |
| `ck_quote_quotes_3` | `CHECK ((((status)::text <> 'rechazada'::text) OR (rejected_reason IS NOT NULL)))` |  |
| `quote_quotes_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `quote_quotes_status_check` | `CHECK (((status)::text = ANY ((ARRAY['borrador'::character varying, 'enviada'::character varying, 'vista'::character varying, 'negociacion'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'vencida'::character varying, 'convertida'::character varying, 'cancelada'::character varying])::text[])))` | `status`: `borrador`, `enviada`, `vista`, `negociacion`, `aprobada`, `rechazada`, `vencida`, `convertida`, `cancelada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_quote_quotes_approval_recorded_by` | `USING btree (approval_recorded_by)` |
| `ix_quote_quotes_client_id` | `USING btree (client_id)` |
| `ix_quote_quotes_current_version_id` | `USING btree (current_version_id)` |
| `ix_quote_quotes_duplicated_from_id` | `USING btree (duplicated_from_id)` |
| `ix_quote_quotes_opportunity_id` | `USING btree (opportunity_id)` |
| `ix_quote_quotes_owner_id` | `USING btree (owner_id)` |
| `ix_quote_quotes_reservation_id` | `USING btree (reservation_id)` |
| `ix_quote_quotes_tenant_id_client_id` | `USING btree (tenant_id, client_id)` |
| `ix_quote_quotes_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_quote_quotes_tenant_id_opportunity_id` | `USING btree (tenant_id, opportunity_id)` |
| `ix_quote_quotes_tenant_id_owner_id` | `USING btree (tenant_id, owner_id)` |
| `ix_quote_quotes_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_quote_quotes_tenant_id_valid_until` | `USING btree (tenant_id, valid_until)` |
| `ix_quote_quotes_title_gin_trgm_ops` | `USING gin (title gin_trgm_ops)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_quote_quotes_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_quote_quotes_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `quote_sends`

[Spec 03 §3] [Fase 1] Envíos de la cotización por canal.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Cotizaciones (quote_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → notif_messages.tenant_id, quote_quotes.tenant_id, iam_users.tenant_id, tenants.id. |
| 3 | `quote_id` | `uuid` | no |  | FK → quote_quotes.id. |
| 4 | `version_no` | `smallint` | no |  |  |
| 5 | `channel` | `character varying(15)` | no |  | Valores: `Email`, `WhatsApp`, `Portal`. |
| 6 | `recipient` | `character varying(200)` | no |  |  |
| 7 | `message` | `text` | sí |  |  |
| 8 | `sent_by` | `uuid` | no |  | FK → iam_users.id. |
| 9 | `sent_at` | `timestamp with time zone` | no | `now()` |  |
| 10 | `notification_id` | `uuid` | sí |  | FK → notif_messages.id. |
| 11 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, notification_id` | `notif_messages.tenant_id, id` | NO ACTION | `fk_quote_sends_notification_id` |
| `tenant_id, quote_id` | `quote_quotes.tenant_id, id` | NO ACTION | `fk_quote_sends_quote_id` |
| `tenant_id, sent_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_quote_sends_sent_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_quote_sends_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `quote_sends_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['Email'::character varying, 'WhatsApp'::character varying, 'Portal'::character varying])::text[])))` | `channel`: `Email`, `WhatsApp`, `Portal` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_quote_sends_notification_id` | `USING btree (notification_id)` |
| `ix_quote_sends_quote_id` | `USING btree (quote_id)` |
| `ix_quote_sends_sent_by` | `USING btree (sent_by)` |
| `ix_quote_sends_tenant_id_quote_id` | `USING btree (tenant_id, quote_id)` |

[↑ Índice del dominio](#tablas)

### `quote_versions`

[Spec 03 §3] [Fase 1] Versiones de cotización (congeladas al enviar).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Cotizaciones (quote_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → collab_approval_requests.tenant_id, iam_users.tenant_id, quote_internal_approvals.tenant_id, sys_documents.tenant_id, quote_quotes.tenant_id, tenants.id. |
| 3 | `quote_id` | `uuid` | no |  | FK → quote_quotes.id. |
| 4 | `version_no` | `smallint` | no |  |  |
| 5 | `status` | `character varying(30)` | no | `'borrador'::character varying` | Valores: `borrador`, `enviada`, `aprobada`, `rechazada`, `reemplazada`, `vencida`. |
| 6 | `issued_on` | `date` | no | `CURRENT_DATE` |  |
| 7 | `author_id` | `uuid` | no |  | FK → iam_users.id. |
| 8 | `discount_pct` | `numeric(5,2)` | no | `0` |  |
| 9 | `tax_pct` | `numeric(5,2)` | no | `18` |  |
| 10 | `markup_pct` | `numeric(7,2)` | no | `0` |  |
| 11 | `notes` | `text` | sí |  |  |
| 12 | `conditions` | `text` | sí |  |  |
| 13 | `snapshot_label` | `character varying(300)` | no |  |  |
| 14 | `catalog_snapshot` | `jsonb` | no |  |  |
| 15 | `policies_snapshot` | `jsonb` | no |  |  |
| 16 | `fx_rate` | `numeric(12,6)` | no |  |  |
| 17 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 18 | `cost_total` | `numeric(14,2)` | no | `0` |  |
| 19 | `sale_total` | `numeric(14,2)` | no | `0` |  |
| 20 | `discount_total` | `numeric(14,2)` | no | `0` |  |
| 21 | `net_total` | `numeric(14,2)` | no | `0` |  |
| 22 | `tax_total` | `numeric(14,2)` | no | `0` |  |
| 23 | `grand_total` | `numeric(14,2)` | no | `0` |  |
| 24 | `profit_total` | `numeric(14,2)` | no | `0` |  |
| 25 | `margin_pct` | `numeric(7,2)` | no | `0` |  |
| 26 | `internal_approval_id` | `uuid` | sí |  | FK → quote_internal_approvals.id. |
| 27 | `frozen_at` | `timestamp with time zone` | sí |  |  |
| 28 | `content_hash` | `character varying(80)` | sí |  |  |
| 29 | `pdf_document_id` | `uuid` | sí |  | FK → sys_documents.id. |
| 30 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 31 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 32 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 33 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 34 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 35 | `approval_request_id` | `uuid` | sí |  | Columnas agregadas en Fase 2 por spec 10 §3.11 FK → collab_approval_requests.id. [Agregada en `30_fase2.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, approval_request_id` | `collab_approval_requests.tenant_id, id` | NO ACTION | `fk_quote_versions_approval_request_id` |
| `tenant_id, author_id` | `iam_users.tenant_id, id` | NO ACTION | `fk_quote_versions_author_id` |
| `tenant_id, internal_approval_id` | `quote_internal_approvals.tenant_id, id` | NO ACTION | `fk_quote_versions_internal_approval_id` |
| `tenant_id, pdf_document_id` | `sys_documents.tenant_id, id` | NO ACTION | `fk_quote_versions_pdf_document_id` |
| `tenant_id, quote_id` | `quote_quotes.tenant_id, id` | NO ACTION | `fk_quote_versions_quote_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_quote_versions_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_quote_versions_id` | `tenant_id, id` |  | restricción |
| `uq_quote_versions_tenant_id_quote_id_version_no` | `tenant_id, quote_id, version_no` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `quote_versions_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `quote_versions_discount_pct_check` | `CHECK (((discount_pct >= (0)::numeric) AND (discount_pct <= (50)::numeric)))` |  |
| `quote_versions_status_check` | `CHECK (((status)::text = ANY ((ARRAY['borrador'::character varying, 'enviada'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'reemplazada'::character varying, 'vencida'::character varying])::text[])))` | `status`: `borrador`, `enviada`, `aprobada`, `rechazada`, `reemplazada`, `vencida` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_quote_versions_approval_request_id` | `USING btree (approval_request_id)` |
| `ix_quote_versions_author_id` | `USING btree (author_id)` |
| `ix_quote_versions_internal_approval_id` | `USING btree (internal_approval_id)` |
| `ix_quote_versions_pdf_document_id` | `USING btree (pdf_document_id)` |
| `ix_quote_versions_quote_id` | `USING btree (quote_id)` |
| `ix_quote_versions_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_quote_versions_frozen_guard` | BEFORE UPDATE | `app_quote_versions_frozen_guard` |
| `trg_quote_versions_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_quote_versions_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `quote_views`

[Spec 03 §3] [Fase 1] Aperturas de la cotización (portal o registro manual).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Cotizaciones (quote_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → quote_quotes.tenant_id, iam_users.tenant_id, tenants.id. |
| 3 | `quote_id` | `uuid` | no |  | FK → quote_quotes.id. |
| 4 | `version_no` | `smallint` | no |  |  |
| 5 | `viewed_at` | `timestamp with time zone` | no | `now()` |  |
| 6 | `source` | `character varying(15)` | no |  | Valores: `portal`, `manual`. |
| 7 | `ip` | `inet` | sí |  |  |
| 8 | `user_agent` | `text` | sí |  |  |
| 9 | `recorded_by` | `uuid` | sí |  | FK → iam_users.id. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, quote_id` | `quote_quotes.tenant_id, id` | NO ACTION | `fk_quote_views_quote_id` |
| `tenant_id, recorded_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_quote_views_recorded_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_quote_views_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `quote_views_source_check` | `CHECK (((source)::text = ANY ((ARRAY['portal'::character varying, 'manual'::character varying])::text[])))` | `source`: `portal`, `manual` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_quote_views_quote_id` | `USING btree (quote_id)` |
| `ix_quote_views_recorded_by` | `USING btree (recorded_by)` |
| `ix_quote_views_tenant_id` | `USING btree (tenant_id)` |

[↑ Índice del dominio](#tablas)

### `quote_external_offers`

[Spec 19 §3.12] [Fase 3] Ofertas de aéreo, hotel, auto o seguro tomadas de un GDS o banco de camas para una cotización.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Cotizaciones (quote_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → quote_quotes.tenant_id, booking_reservations.tenant_id, tenants.id, quote_versions.tenant_id. |
| 3 | `quote_id` | `uuid` | no |  | FK → quote_quotes.id. |
| 4 | `version_id` | `uuid` | sí |  | FK → quote_versions.id. |
| 5 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 6 | `provider` | `character varying(20)` | no |  | Valores: `amadeus`, `sabre`, `travelport`, `hotelbeds`, `otro`. |
| 7 | `kind` | `character varying(10)` | no |  | Valores: `aereo`, `hotel`, `auto`, `seguro`. |
| 8 | `offer_ref` | `character varying(160)` | no |  |  |
| 9 | `summary` | `character varying(300)` | no |  |  |
| 10 | `payload` | `jsonb` | no |  |  |
| 11 | `net_amount` | `numeric(14,2)` | no |  |  |
| 12 | `sell_amount` | `numeric(14,2)` | no |  |  |
| 13 | `currency` | `character(3)` | no |  |  |
| 14 | `offer_expires_at` | `timestamp with time zone` | sí |  |  |
| 15 | `pnr` | `character varying(20)` | sí |  |  |
| 16 | `status` | `character varying(12)` | no | `'cotizada'::character varying` | Valores: `cotizada`, `retenida`, `emitida`, `vencida`, `cancelada`, `error`. |
| 17 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 18 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 19 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 20 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, quote_id` | `quote_quotes.tenant_id, id` | NO ACTION | `fk_quote_external_offers_quote_id` |
| `tenant_id, reservation_id` | `booking_reservations.tenant_id, id` | NO ACTION | `fk_quote_external_offers_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_quote_external_offers_tenant_id` |
| `tenant_id, version_id` | `quote_versions.tenant_id, id` | NO ACTION | `fk_quote_external_offers_version_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_quote_external_offers_tenant_provider_ref` | `tenant_id, provider, offer_ref` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_quote_external_offers_1` | `CHECK ((((status)::text <> 'emitida'::text) OR (pnr IS NOT NULL)))` |  |
| `quote_external_offers_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['aereo'::character varying, 'hotel'::character varying, 'auto'::character varying, 'seguro'::character varying])::text[])))` | `kind`: `aereo`, `hotel`, `auto`, `seguro` |
| `quote_external_offers_net_amount_check` | `CHECK ((net_amount >= (0)::numeric))` |  |
| `quote_external_offers_provider_check` | `CHECK (((provider)::text = ANY ((ARRAY['amadeus'::character varying, 'sabre'::character varying, 'travelport'::character varying, 'hotelbeds'::character varying, 'otro'::character varying])::text[])))` | `provider`: `amadeus`, `sabre`, `travelport`, `hotelbeds`, `otro` |
| `quote_external_offers_sell_amount_check` | `CHECK ((sell_amount >= (0)::numeric))` |  |
| `quote_external_offers_status_check` | `CHECK (((status)::text = ANY ((ARRAY['cotizada'::character varying, 'retenida'::character varying, 'emitida'::character varying, 'vencida'::character varying, 'cancelada'::character varying, 'error'::character varying])::text[])))` | `status`: `cotizada`, `retenida`, `emitida`, `vencida`, `cancelada`, `error` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_quote_external_offers_quote_id` | `USING btree (quote_id)` |
| `ix_quote_external_offers_reservation_id` | `USING btree (reservation_id)` |
| `ix_quote_external_offers_tenant_id_status_offer_expires_at` | `USING btree (tenant_id, status, offer_expires_at)` |
| `ix_quote_external_offers_version_id` | `USING btree (version_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_quote_external_offers_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)
