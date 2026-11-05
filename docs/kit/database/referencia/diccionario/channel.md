# Diccionario de datos · Canales (channel_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.13 tras cargar `00`→`90`. No editar a mano._

B2B, e-commerce, sitio web, widget, portales, tickets, reseñas externas y eventos web.

22 tablas · 373 columnas · 78 claves foráneas. Diagrama ER: [`../er/channel.svg`](../er/channel.svg) (fuente [`../er/channel.mmd`](../er/channel.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`channel_support_ticket_events`](#channel_support_ticket_events) | Fase 1 · MVP | tenant | 8 | 3 | [Spec 08 §3.12] [Fase 1] Bitácora del ticket (log). |
| [`channel_support_tickets`](#channel_support_tickets) | Fase 1 · MVP | tenant | 19 | 5 | [Spec 08 §3.12] [Fase 1] Solicitudes desde portal cliente / pasajero. |
| [`channel_b2b_agencies`](#channel_b2b_agencies) | Fase 2 · Canales y campo | tenant | 23 | 3 | [Spec 08 §3.1] [Fase 2] Agencias asociadas B2B (crédito, comisión). |
| [`channel_b2b_credit_exceptions`](#channel_b2b_credit_exceptions) | Fase 2 · Canales y campo | tenant | 8 | 3 | [Spec 10 §3.11] [Fase 2] Ampliaciones de crédito B2B aprobadas. (columnas mínimas de 10) |
| [`channel_b2b_credit_movements`](#channel_b2b_credit_movements) | Fase 2 · Canales y campo | tenant | 15 | 4 | [Spec 08 §3.4] [Fase 2] Libro de la línea de crédito B2B (inmutable; fuente de credit_used, H-02). |
| [`channel_b2b_price_lists`](#channel_b2b_price_lists) | Fase 2 · Canales y campo | tenant | 9 | 1 | [Spec 08 §3.2] [Fase 2] Listas de precios B2B. |
| [`channel_b2b_settlement_requests`](#channel_b2b_settlement_requests) | Fase 2 · Canales y campo | tenant | 13 | 3 | [Spec 08 §3.5] [Fase 2] Solicitudes de liquidación de comisiones B2B. |
| [`channel_ecom_order_lines`](#channel_ecom_order_lines) | Fase 2 · Canales y campo | tenant | 31 | 9 | [Spec 15 §3.4] [Fase 2] Líneas del pedido web (snapshot de precio). |
| [`channel_ecom_orders`](#channel_ecom_orders) | Fase 2 · Canales y campo | tenant | 48 | 8 | [Spec 08 §3.6 + 15 §3.3, §3.14] [Fase 2] Pedidos web (tienda y sitio público). |
| [`channel_ecom_passengers`](#channel_ecom_passengers) | Fase 2 · Canales y campo | tenant | 17 | 2 | [Spec 08 §3.7 + 15 §3.5] [Fase 2] Pasajeros del pedido web. |
| [`channel_ecom_payment_attempts`](#channel_ecom_payment_attempts) | Fase 2 · Canales y campo | tenant | 17 | 3 | [Spec 08 §3.8 + 15 §3.6] [Fase 2] Intentos de pago del pedido web (pasarela, transferencia, Yape/Plin). |
| [`channel_pax_feedback`](#channel_pax_feedback) | Fase 2 · Canales y campo | tenant | 22 | 6 | [Spec 04 §3 v2.1 + 08 §3.16] [Fase 2] Comentarios del pasajero (portal/app); tabla única, dueño Canales. |
| [`channel_portal_access_links`](#channel_portal_access_links) | Fase 2 · Canales y campo | tenant | 10 | 3 | [Spec 08 §3.13] [Fase 2] Acceso del pasajero por enlace/código. |
| [`channel_trip_messages`](#channel_trip_messages) | Fase 2 · Canales y campo | tenant | 10 | 3 | [Spec 05 §3.14] [Fase 2] Chat pasajero ↔ agencia de la app pasajero. |
| [`channel_web_cart_items`](#channel_web_cart_items) | Fase 2 · Canales y campo | tenant | 24 | 5 | [Spec 15 §3.2] [Fase 2] Líneas del carrito (precio recalculado en cada lectura). |
| [`channel_web_carts`](#channel_web_carts) | Fase 2 · Canales y campo | tenant | 17 | 3 | [Spec 15 §3.1] [Fase 2] Carritos del sitio público. |
| [`channel_web_events`](#channel_web_events) | Fase 2 · Canales y campo | tenant | 10 | 1 | [Spec 15 §3.8] [Fase 2] Eventos de analítica del sitio (particionada por mes). |
| [`channel_widget_config`](#channel_widget_config) | Fase 2 · Canales y campo | tenant | 12 | 1 | [Spec 17 §3.8] [Fase 2] Configuración del widget embebible (1 por tenant). |
| [`channel_widget_domains`](#channel_widget_domains) | Fase 2 · Canales y campo | tenant | 11 | 1 | [Spec 17 §3.8] [Fase 2] Dominios autorizados del widget (CORS/CSP). |
| [`channel_widget_handoffs`](#channel_widget_handoffs) | Fase 2 · Canales y campo | tenant | 23 | 3 | [Spec 17 §3.8] [Fase 2] Traspaso del widget al checkout (TTL 24 h). |
| [`channel_wishlist_items`](#channel_wishlist_items) | Fase 2 · Canales y campo | tenant | 4 | 3 | [Spec 15 §3.7] [Fase 2] Favoritos del cliente. |
| [`channel_external_reviews`](#channel_external_reviews) | Fase 3 · SaaS y crecimiento | tenant | 22 | 5 | [Spec 17 §3.7] [Fase 3] Reseñas importadas (texto inmutable). |

## Detalle por tabla

### `channel_support_ticket_events`

[Spec 08 §3.12] [Fase 1] Bitácora del ticket (log).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `ticket_id` | `uuid` | no |  | FK → channel_support_tickets.id. |
| 4 | `occurred_at` | `timestamp with time zone` | no | `now()` |  |
| 5 | `user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 6 | `message` | `character varying(500)` | no |  |  |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_support_ticket_events_tenant_id` |
| `ticket_id` | `channel_support_tickets.id` | NO ACTION | `fk_channel_support_ticket_events_ticket_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_channel_support_ticket_events_user_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_support_ticket_events_tenant_id` | `USING btree (tenant_id)` |
| `ix_channel_support_ticket_events_ticket_id` | `USING btree (ticket_id)` |
| `ix_channel_support_ticket_events_user_id` | `USING btree (user_id)` |

[↑ Índice del dominio](#tablas)

### `channel_support_tickets`

[Spec 08 §3.12] [Fase 1] Solicitudes desde portal cliente / pasajero.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `crm_client_id` | `uuid` | no |  | FK → crm_clients.id. |
| 5 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 6 | `source` | `character varying(30)` | no |  | Valores: `portal_cliente`, `portal_pasajero`. |
| 7 | `subject` | `character varying(200)` | no |  |  |
| 8 | `category` | `character varying(40)` | no |  |  |
| 9 | `topic` | `character varying(40)` | sí |  |  |
| 10 | `priority` | `character varying(10)` | no | `'media'::character varying` | Valores: `baja`, `media`, `alta`. |
| 11 | `message` | `text` | no |  |  |
| 12 | `status` | `character varying(30)` | no | `'abierta'::character varying` | Valores: `abierta`, `en_proceso`, `resuelta`, `cerrada`. |
| 13 | `owner_id` | `uuid` | no |  | FK → iam_users.id. |
| 14 | `created_by_user_id` | `uuid` | no |  | FK → iam_users.id. |
| 15 | `first_response_due_at` | `timestamp with time zone` | sí |  |  |
| 16 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 17 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 18 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 19 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `created_by_user_id` | `iam_users.id` | NO ACTION | `fk_channel_support_tickets_created_by_user_id` |
| `crm_client_id` | `crm_clients.id` | NO ACTION | `fk_channel_support_tickets_crm_client_id` |
| `owner_id` | `iam_users.id` | NO ACTION | `fk_channel_support_tickets_owner_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_channel_support_tickets_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_support_tickets_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_channel_support_tickets_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `channel_support_tickets_priority_check` | `CHECK (((priority)::text = ANY ((ARRAY['baja'::character varying, 'media'::character varying, 'alta'::character varying])::text[])))` | `priority`: `baja`, `media`, `alta` |
| `channel_support_tickets_source_check` | `CHECK (((source)::text = ANY ((ARRAY['portal_cliente'::character varying, 'portal_pasajero'::character varying])::text[])))` | `source`: `portal_cliente`, `portal_pasajero` |
| `channel_support_tickets_status_check` | `CHECK (((status)::text = ANY ((ARRAY['abierta'::character varying, 'en_proceso'::character varying, 'resuelta'::character varying, 'cerrada'::character varying])::text[])))` | `status`: `abierta`, `en_proceso`, `resuelta`, `cerrada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_support_tickets_created_by_user_id` | `USING btree (created_by_user_id)` |
| `ix_channel_support_tickets_crm_client_id` | `USING btree (crm_client_id)` |
| `ix_channel_support_tickets_owner_id` | `USING btree (owner_id)` |
| `ix_channel_support_tickets_reservation_id` | `USING btree (reservation_id)` |
| `ix_channel_support_tickets_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_channel_support_tickets_tenant_id_owner_id` | `USING btree (tenant_id, owner_id)` |
| `ix_channel_support_tickets_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_channel_support_tickets_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `channel_b2b_agencies`

[Spec 08 §3.1] [Fase 2] Agencias asociadas B2B (crédito, comisión).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `legal_name` | `character varying(200)` | no |  |  |
| 5 | `ruc` | `character(11)` | no |  |  |
| 6 | `contact_name` | `character varying(150)` | no |  |  |
| 7 | `booking_email` | `character varying(190)` | sí |  |  |
| 8 | `crm_client_id` | `uuid` | sí |  | FK → crm_clients.id. |
| 9 | `price_list_id` | `uuid` | no |  | FK → channel_b2b_price_lists.id. |
| 10 | `commission_pct` | `numeric(5,2)` | no |  |  |
| 11 | `credit_currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 12 | `credit_limit` | `numeric(14,2)` | no | `0` |  |
| 13 | `credit_used` | `numeric(14,2)` | no | `0` |  |
| 14 | `valid_from` | `date` | no |  |  |
| 15 | `valid_to` | `date` | no |  |  |
| 16 | `status` | `character varying(30)` | no | `'activa'::character varying` | Valores: `activa`, `bloqueada`, `inactiva`. |
| 17 | `block_reason` | `character varying(30)` | sí |  | Valores: `manual`, `credito_excedido`. |
| 18 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 19 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 20 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 21 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 22 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 23 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `crm_client_id` | `crm_clients.id` | NO ACTION | `fk_channel_b2b_agencies_crm_client_id` |
| `price_list_id` | `channel_b2b_price_lists.id` | NO ACTION | `fk_channel_b2b_agencies_price_list_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_b2b_agencies_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_channel_b2b_agencies_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_channel_b2b_agencies_tenant_id_ruc_p` | `tenant_id, ruc` | `(deleted_at IS NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `channel_b2b_agencies_block_reason_check` | `CHECK (((block_reason IS NULL) OR ((block_reason)::text = ANY ((ARRAY['manual'::character varying, 'credito_excedido'::character varying])::text[]))))` | `block_reason`: `manual`, `credito_excedido` |
| `channel_b2b_agencies_commission_pct_check` | `CHECK (((commission_pct >= (0)::numeric) AND (commission_pct <= (30)::numeric)))` |  |
| `channel_b2b_agencies_credit_currency_check` | `CHECK ((credit_currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `credit_currency`: `PEN`, `USD` |
| `channel_b2b_agencies_credit_limit_check` | `CHECK ((credit_limit >= (0)::numeric))` |  |
| `channel_b2b_agencies_credit_used_check` | `CHECK ((credit_used >= (0)::numeric))` |  |
| `channel_b2b_agencies_ruc_check` | `CHECK ((ruc ~ '^[0-9]{11}$'::text))` |  |
| `channel_b2b_agencies_status_check` | `CHECK (((status)::text = ANY ((ARRAY['activa'::character varying, 'bloqueada'::character varying, 'inactiva'::character varying])::text[])))` | `status`: `activa`, `bloqueada`, `inactiva` |
| `ck_channel_b2b_agencies_1` | `CHECK ((valid_to >= valid_from))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_b2b_agencies_crm_client_id` | `USING btree (crm_client_id)` |
| `ix_channel_b2b_agencies_price_list_id` | `USING btree (price_list_id)` |
| `ix_channel_b2b_agencies_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_channel_b2b_agencies_tenant_id_crm_client_id` | `USING btree (tenant_id, crm_client_id)` |
| `ix_channel_b2b_agencies_tenant_id_price_list_id` | `USING btree (tenant_id, price_list_id)` |
| `ix_channel_b2b_agencies_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_channel_b2b_agencies_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_channel_b2b_agencies_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `channel_b2b_credit_exceptions`

[Spec 10 §3.11] [Fase 2] Ampliaciones de crédito B2B aprobadas. (columnas mínimas de 10)

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `agency_id` | `uuid` | no |  | FK → channel_b2b_agencies.id. |
| 4 | `approval_request_id` | `uuid` | sí |  | FK → collab_approval_requests.id. |
| 5 | `amount` | `numeric(14,2)` | no |  |  |
| 6 | `valid_until` | `date` | sí |  |  |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `agency_id` | `channel_b2b_agencies.id` | NO ACTION | `fk_channel_b2b_credit_exceptions_agency_id` |
| `approval_request_id` | `collab_approval_requests.id` | NO ACTION | `fk_channel_b2b_credit_exceptions_approval_request_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_b2b_credit_exceptions_tenant_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_b2b_credit_exceptions_agency_id` | `USING btree (agency_id)` |
| `ix_channel_b2b_credit_exceptions_approval_request_id` | `USING btree (approval_request_id)` |
| `ix_channel_b2b_credit_exceptions_tenant_id` | `USING btree (tenant_id)` |

[↑ Índice del dominio](#tablas)

### `channel_b2b_credit_movements`

[Spec 08 §3.4] [Fase 2] Libro de la línea de crédito B2B (inmutable; fuente de credit_used, H-02).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `agency_id` | `uuid` | no |  | FK → channel_b2b_agencies.id. |
| 4 | `movement_type` | `character varying(30)` | no |  | Valores: `cargo_reserva`, `pago_aplicado`, `reversion_pago`, `anulacion_reserva`, `ajuste`. |
| 5 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 6 | `payment_id` | `uuid` | sí |  | FK → fin_payments.id. |
| 7 | `amount` | `numeric(14,2)` | no |  |  |
| 8 | `currency` | `character(3)` | no |  |  |
| 9 | `source_amount` | `numeric(14,2)` | sí |  |  |
| 10 | `source_currency` | `character(3)` | sí |  |  |
| 11 | `fx_rate` | `numeric(12,6)` | sí |  |  |
| 12 | `balance_after` | `numeric(14,2)` | no |  |  |
| 13 | `note` | `character varying(250)` | sí |  |  |
| 14 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 15 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `agency_id` | `channel_b2b_agencies.id` | NO ACTION | `fk_channel_b2b_credit_movements_agency_id` |
| `payment_id` | `fin_payments.id` | NO ACTION | `fk_channel_b2b_credit_movements_payment_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_channel_b2b_credit_movements_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_b2b_credit_movements_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `channel_b2b_credit_movements_movement_type_check` | `CHECK (((movement_type)::text = ANY ((ARRAY['cargo_reserva'::character varying, 'pago_aplicado'::character varying, 'reversion_pago'::character varying, 'anulacion_reserva'::character varying, 'ajuste'::character varying])::text[])))` | `movement_type`: `cargo_reserva`, `pago_aplicado`, `reversion_pago`, `anulacion_reserva`, `ajuste` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_b2b_credit_movements_agency_id` | `USING btree (agency_id)` |
| `ix_channel_b2b_credit_movements_payment_id` | `USING btree (payment_id)` |
| `ix_channel_b2b_credit_movements_reservation_id` | `USING btree (reservation_id)` |
| `ix_channel_b2b_credit_movements_tenant_id_agency_id_crea_13d548` | `USING btree (tenant_id, agency_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_channel_b2b_credit_movements_append_only` | BEFORE DELETE OR UPDATE | `app_forbid_update_delete` |

[↑ Índice del dominio](#tablas)

### `channel_b2b_price_lists`

[Spec 08 §3.2] [Fase 2] Listas de precios B2B.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `name` | `character varying(80)` | no |  |  |
| 4 | `year` | `smallint` | sí |  |  |
| 5 | `status` | `character varying(30)` | no | `'activa'::character varying` | Valores: `activa`, `inactiva`. |
| 6 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 7 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 8 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 9 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_b2b_price_lists_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_channel_b2b_price_lists_tenant_id_name` | `tenant_id, name` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `channel_b2b_price_lists_status_check` | `CHECK (((status)::text = ANY ((ARRAY['activa'::character varying, 'inactiva'::character varying])::text[])))` | `status`: `activa`, `inactiva` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_b2b_price_lists_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_channel_b2b_price_lists_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `channel_b2b_settlement_requests`

[Spec 08 §3.5] [Fase 2] Solicitudes de liquidación de comisiones B2B.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `agency_id` | `uuid` | no |  | FK → channel_b2b_agencies.id. |
| 5 | `amount_pen` | `numeric(14,2)` | no |  |  |
| 6 | `fx_rate` | `numeric(12,6)` | no |  |  |
| 7 | `commission_ids` | `uuid[]` | no | `'{}'::uuid[]` |  |
| 8 | `status` | `character varying(30)` | no | `'solicitada'::character varying` | Valores: `solicitada`, `aprobada`, `rechazada`, `pagada`. |
| 9 | `requested_by` | `uuid` | no |  | FK → iam_users.id. |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 13 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `agency_id` | `channel_b2b_agencies.id` | NO ACTION | `fk_channel_b2b_settlement_requests_agency_id` |
| `requested_by` | `iam_users.id` | NO ACTION | `fk_channel_b2b_settlement_requests_requested_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_b2b_settlement_requests_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_channel_b2b_settlement_requests_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `channel_b2b_settlement_requests_status_check` | `CHECK (((status)::text = ANY ((ARRAY['solicitada'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'pagada'::character varying])::text[])))` | `status`: `solicitada`, `aprobada`, `rechazada`, `pagada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_b2b_settlement_requests_agency_id` | `USING btree (agency_id)` |
| `ix_channel_b2b_settlement_requests_requested_by` | `USING btree (requested_by)` |
| `ix_channel_b2b_settlement_requests_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_channel_b2b_settlement_requests_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_channel_b2b_settlement_requests_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `channel_ecom_order_lines`

[Spec 15 §3.4] [Fase 2] Líneas del pedido web (snapshot de precio).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `order_id` | `uuid` | no |  | FK → channel_ecom_orders.id. |
| 4 | `line_no` | `smallint` | no |  |  |
| 5 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 6 | `product_version` | `character varying(10)` | no |  |  |
| 7 | `service_date` | `date` | no |  |  |
| 8 | `departure_id` | `uuid` | sí |  | FK → catalog_product_departures.id. |
| 9 | `pax_adults` | `smallint` | no | `1` |  |
| 10 | `pax_children` | `smallint` | no | `0` |  |
| 11 | `pax_infants` | `smallint` | no | `0` |  |
| 12 | `rate_id` | `uuid` | no |  | FK → catalog_rates.id. |
| 13 | `season_id` | `uuid` | sí |  | FK → catalog_seasons.id. |
| 14 | `season_factor` | `numeric(6,4)` | no | `1` |  |
| 15 | `unit_adult` | `numeric(14,2)` | no |  |  |
| 16 | `unit_child` | `numeric(14,2)` | no | `0` |  |
| 17 | `units` | `smallint` | sí |  |  |
| 18 | `config_snapshot` | `jsonb` | no | `'[]'::jsonb` |  |
| 19 | `extras_snapshot` | `jsonb` | no | `'[]'::jsonb` |  |
| 20 | `subtotal` | `numeric(14,2)` | no |  |  |
| 21 | `discount` | `numeric(14,2)` | no | `0` |  |
| 22 | `total` | `numeric(14,2)` | no |  |  |
| 23 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 24 | `promotion_id` | `uuid` | sí |  | FK → catalog_product_promotions.id. |
| 25 | `cost_total` | `numeric(14,2)` | no | `0` |  |
| 26 | `hold_id` | `uuid` | sí |  | FK → catalog_availability_holds.id. |
| 27 | `reservation_service_id` | `uuid` | sí |  | FK → booking_reservation_services.id. |
| 28 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 29 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 30 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 31 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `departure_id` | `catalog_product_departures.id` | NO ACTION | `fk_channel_ecom_order_lines_departure_id` |
| `hold_id` | `catalog_availability_holds.id` | NO ACTION | `fk_channel_ecom_order_lines_hold_id` |
| `order_id` | `channel_ecom_orders.id` | NO ACTION | `fk_channel_ecom_order_lines_order_id` |
| `product_id` | `catalog_products.id` | NO ACTION | `fk_channel_ecom_order_lines_product_id` |
| `promotion_id` | `catalog_product_promotions.id` | NO ACTION | `fk_channel_ecom_order_lines_promotion_id` |
| `rate_id` | `catalog_rates.id` | NO ACTION | `fk_channel_ecom_order_lines_rate_id` |
| `reservation_service_id` | `booking_reservation_services.id` | NO ACTION | `fk_channel_ecom_order_lines_reservation_service_id` |
| `season_id` | `catalog_seasons.id` | NO ACTION | `fk_channel_ecom_order_lines_season_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_ecom_order_lines_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_channel_ecom_order_lines_order_id_line_no` | `order_id, line_no` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `channel_ecom_order_lines_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_ecom_order_lines_departure_id` | `USING btree (departure_id)` |
| `ix_channel_ecom_order_lines_hold_id` | `USING btree (hold_id)` |
| `ix_channel_ecom_order_lines_product_id` | `USING btree (product_id)` |
| `ix_channel_ecom_order_lines_promotion_id` | `USING btree (promotion_id)` |
| `ix_channel_ecom_order_lines_rate_id` | `USING btree (rate_id)` |
| `ix_channel_ecom_order_lines_reservation_service_id` | `USING btree (reservation_service_id)` |
| `ix_channel_ecom_order_lines_season_id` | `USING btree (season_id)` |
| `ix_channel_ecom_order_lines_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_channel_ecom_order_lines_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `channel_ecom_orders`

[Spec 08 §3.6 + 15 §3.3, §3.14] [Fase 2] Pedidos web (tienda y sitio público).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `ordered_at` | `timestamp with time zone` | no | `now()` |  |
| 5 | `crm_client_id` | `uuid` | no |  | FK → crm_clients.id. |
| 6 | `customer_name` | `character varying(150)` | no |  |  |
| 7 | `customer_email` | `character varying(190)` | no |  |  |
| 8 | `customer_phone` | `character varying(40)` | sí |  |  |
| 9 | `customer_country` | `character varying(60)` | sí |  |  |
| 10 | `product_id` | `uuid` | sí |  | FK → catalog_products.id. |
| 11 | `departure_id` | `uuid` | sí |  | FK → catalog_product_departures.id. |
| 12 | `service_date` | `date` | sí |  |  |
| 13 | `pax_adults` | `smallint` | sí |  |  |
| 14 | `pax_children` | `smallint` | sí | `0` |  |
| 15 | `pax_total` | `smallint` | sí | `generada: (COALESCE((pax_adults)::integer, 0) + COALESCE((pax_children)::integer, 0))` |  |
| 16 | `config_snapshot` | `jsonb` | no | `'[]'::jsonb` |  |
| 17 | `price_snapshot` | `jsonb` | no | `'{}'::jsonb` |  |
| 18 | `promo_code` | `character varying(40)` | sí |  |  |
| 19 | `promotion_id` | `uuid` | sí |  | FK → catalog_product_promotions.id. |
| 20 | `discount_amount` | `numeric(14,2)` | no | `0` |  |
| 21 | `total` | `numeric(14,2)` | no |  |  |
| 22 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 23 | `fx_rate` | `numeric(12,6)` | no | `1` |  |
| 24 | `cost_total` | `numeric(14,2)` | no | `0` |  |
| 25 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 26 | `reservation_ids` | `uuid[]` | no | `'{}'::uuid[]` |  |
| 27 | `receivable_id` | `uuid` | sí |  | FK → fin_receivables.id. |
| 28 | `status` | `character varying(30)` | no | `'pago_pendiente'::character varying` | Valores: `pago_pendiente`, `pago_por_validar`, `pago_rechazado`, `confirmado`, `cancelado`, `expirado`. |
| 29 | `hold_expires_at` | `timestamp with time zone` | sí |  |  |
| 30 | `cancel_reason` | `character varying(300)` | sí |  |  |
| 31 | `buyer_snapshot` | `jsonb` | no | `'{}'::jsonb` |  |
| 32 | `utm` | `jsonb` | sí |  |  |
| 33 | `cart_id` | `uuid` | sí |  | FK → channel_web_carts.id. |
| 34 | `sales_channel` | `character varying(20)` | no | `'sitio_web'::character varying` | Valores: `sitio_web`, `tienda_backoffice`. |
| 35 | `locale` | `character varying(5)` | no | `'es'::character varying` |  |
| 36 | `pay_mode` | `character varying(10)` | no | `'total'::character varying` | Valores: `total`, `anticipo`. |
| 37 | `deposit_pct` | `numeric(5,2)` | no | `100` |  |
| 38 | `amount_due_now` | `numeric(14,2)` | no | `0` |  |
| 39 | `balance_due_date` | `date` | sí |  |  |
| 40 | `billing` | `jsonb` | no | `'{}'::jsonb` |  |
| 41 | `consents` | `jsonb` | no | `'{}'::jsonb` |  |
| 42 | `access_token_hash` | `character(64)` | sí |  |  |
| 43 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 44 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 45 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 46 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 47 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 48 | `utm_campaign` | `character varying(40)` | sí |  | Columnas agregadas en Fase 3 por spec 14 §3.17 [Agregada en `40_fase3.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `cart_id` | `channel_web_carts.id` | NO ACTION | `fk_channel_ecom_orders_cart_id` |
| `crm_client_id` | `crm_clients.id` | NO ACTION | `fk_channel_ecom_orders_crm_client_id` |
| `departure_id` | `catalog_product_departures.id` | NO ACTION | `fk_channel_ecom_orders_departure_id` |
| `product_id` | `catalog_products.id` | NO ACTION | `fk_channel_ecom_orders_product_id` |
| `promotion_id` | `catalog_product_promotions.id` | NO ACTION | `fk_channel_ecom_orders_promotion_id` |
| `receivable_id` | `fin_receivables.id` | NO ACTION | `fk_channel_ecom_orders_receivable_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_channel_ecom_orders_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_ecom_orders_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_channel_ecom_orders_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `channel_ecom_orders_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `channel_ecom_orders_pax_adults_check` | `CHECK ((pax_adults >= 1))` |  |
| `channel_ecom_orders_pay_mode_check` | `CHECK (((pay_mode)::text = ANY ((ARRAY['total'::character varying, 'anticipo'::character varying])::text[])))` | `pay_mode`: `total`, `anticipo` |
| `channel_ecom_orders_sales_channel_check` | `CHECK (((sales_channel)::text = ANY ((ARRAY['sitio_web'::character varying, 'tienda_backoffice'::character varying])::text[])))` | `sales_channel`: `sitio_web`, `tienda_backoffice` |
| `channel_ecom_orders_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pago_pendiente'::character varying, 'pago_por_validar'::character varying, 'pago_rechazado'::character varying, 'confirmado'::character varying, 'cancelado'::character varying, 'expirado'::character varying])::text[])))` | `status`: `pago_pendiente`, `pago_por_validar`, `pago_rechazado`, `confirmado`, `cancelado`, `expirado` |
| `ck_channel_ecom_orders_1` | `CHECK ((((pay_mode)::text <> 'anticipo'::text) OR (balance_due_date IS NOT NULL)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_ecom_orders_cart_id` | `USING btree (cart_id)` |
| `ix_channel_ecom_orders_crm_client_id` | `USING btree (crm_client_id)` |
| `ix_channel_ecom_orders_departure_id` | `USING btree (departure_id)` |
| `ix_channel_ecom_orders_hold_expires_at_p` | `USING btree (hold_expires_at) WHERE ((status)::text = ANY ((ARRAY['pago_pendiente'::character varying, 'pago_rechazado'::character varying])::text[]))` |
| `ix_channel_ecom_orders_product_id` | `USING btree (product_id)` |
| `ix_channel_ecom_orders_promotion_id` | `USING btree (promotion_id)` |
| `ix_channel_ecom_orders_receivable_id` | `USING btree (receivable_id)` |
| `ix_channel_ecom_orders_reservation_id` | `USING btree (reservation_id)` |
| `ix_channel_ecom_orders_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_channel_ecom_orders_tenant_id_customer_email` | `USING btree (tenant_id, customer_email)` |
| `ix_channel_ecom_orders_tenant_id_ordered_at_desc` | `USING btree (tenant_id, ordered_at DESC)` |
| `ix_channel_ecom_orders_tenant_id_reservation_id` | `USING btree (tenant_id, reservation_id)` |
| `ix_channel_ecom_orders_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_channel_ecom_orders_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_channel_ecom_orders_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `channel_ecom_passengers`

[Spec 08 §3.7 + 15 §3.5] [Fase 2] Pasajeros del pedido web.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `order_id` | `uuid` | no |  | FK → channel_ecom_orders.id. |
| 4 | `position` | `smallint` | no |  |  |
| 5 | `first_name` | `character varying(80)` | no |  |  |
| 6 | `last_name` | `character varying(80)` | no |  |  |
| 7 | `full_name` | `character varying(161)` | sí | `generada: (((first_name)::text \|\| ' '::text) \|\| (last_name)::text)` |  |
| 8 | `doc_type` | `character varying(20)` | no |  |  |
| 9 | `doc_number` | `character varying(30)` | no |  |  |
| 10 | `pax_type` | `character(3)` | no |  | Valores: `ADT`, `CHD`, `INF`. |
| 11 | `birth_date` | `date` | no |  |  |
| 12 | `nationality` | `character varying(60)` | no |  |  |
| 13 | `diet` | `character varying(120)` | sí |  |  |
| 14 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 15 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 16 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 17 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `order_id` | `channel_ecom_orders.id` | NO ACTION | `fk_channel_ecom_passengers_order_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_ecom_passengers_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_channel_ecom_passengers_order_id_doc_type_doc_number` | `order_id, doc_type, doc_number` |  | índice único |
| `uq_channel_ecom_passengers_order_id_position` | `order_id, "position"` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `channel_ecom_passengers_pax_type_check` | `CHECK ((pax_type = ANY (ARRAY['ADT'::bpchar, 'CHD'::bpchar, 'INF'::bpchar])))` | `pax_type`: `ADT`, `CHD`, `INF` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_ecom_passengers_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_channel_ecom_passengers_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `channel_ecom_payment_attempts`

[Spec 08 §3.8 + 15 §3.6] [Fase 2] Intentos de pago del pedido web (pasarela, transferencia, Yape/Plin).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `order_id` | `uuid` | no |  | FK → channel_ecom_orders.id. |
| 4 | `attempted_at` | `timestamp with time zone` | no | `now()` |  |
| 5 | `method` | `character varying(20)` | no | `'tarjeta'::character varying` | Valores: `tarjeta`, `transferencia`, `yape`, `plin`. |
| 6 | `card_masked` | `character varying(20)` | sí |  |  |
| 7 | `operation_ref` | `character varying(60)` | sí |  |  |
| 8 | `result` | `character varying(20)` | no |  | Valores: `aprobado`, `rechazado`, `por_validar`. |
| 9 | `gateway_code` | `character varying(20)` | sí |  |  |
| 10 | `message` | `character varying(200)` | sí |  |  |
| 11 | `gateway_txn_id` | `character varying(80)` | sí |  |  |
| 12 | `amount` | `numeric(14,2)` | sí |  |  |
| 13 | `currency` | `character(3)` | sí |  |  |
| 14 | `idempotency_key` | `character varying(80)` | sí |  |  |
| 15 | `payment_id` | `uuid` | sí |  | FK → fin_payments.id. |
| 16 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 17 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `order_id` | `channel_ecom_orders.id` | NO ACTION | `fk_channel_ecom_payment_attempts_order_id` |
| `payment_id` | `fin_payments.id` | NO ACTION | `fk_channel_ecom_payment_attempts_payment_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_ecom_payment_attempts_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_channel_ecom_payment_attempts_tenant_id_gateway_txn_id_p` | `tenant_id, gateway_txn_id` | `(gateway_txn_id IS NOT NULL)` | índice único |
| `uq_channel_ecom_payment_attempts_tenant_id_idempotency_key_p` | `tenant_id, idempotency_key` | `(idempotency_key IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `channel_ecom_payment_attempts_method_check` | `CHECK (((method)::text = ANY ((ARRAY['tarjeta'::character varying, 'transferencia'::character varying, 'yape'::character varying, 'plin'::character varying])::text[])))` | `method`: `tarjeta`, `transferencia`, `yape`, `plin` |
| `channel_ecom_payment_attempts_result_check` | `CHECK (((result)::text = ANY ((ARRAY['aprobado'::character varying, 'rechazado'::character varying, 'por_validar'::character varying])::text[])))` | `result`: `aprobado`, `rechazado`, `por_validar` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_ecom_payment_attempts_order_id` | `USING btree (order_id)` |
| `ix_channel_ecom_payment_attempts_payment_id` | `USING btree (payment_id)` |
| `ix_channel_ecom_payment_attempts_tenant_id` | `USING btree (tenant_id)` |

[↑ Índice del dominio](#tablas)

### `channel_pax_feedback`

[Spec 04 §3 v2.1 + 08 §3.16] [Fase 2] Comentarios del pasajero (portal/app); tabla única, dueño Canales.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(12)` | no |  |  |
| 4 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 5 | `passenger_name` | `character varying(150)` | no |  |  |
| 6 | `type` | `character varying(20)` | no |  | Valores: `comentario`, `sugerencia`, `felicitacion`, `reclamo`, `incidencia`. |
| 7 | `rating` | `smallint` | sí |  |  |
| 8 | `reservation_service_id` | `uuid` | sí |  | FK → booking_reservation_services.id. |
| 9 | `text` | `character varying(1000)` | no |  |  |
| 10 | `status` | `character varying(20)` | no | `'nuevo'::character varying` | Valores: `nuevo`, `leido`, `respondido`, `derivado`. |
| 11 | `reply` | `text` | sí |  |  |
| 12 | `replied_at` | `timestamp with time zone` | sí |  |  |
| 13 | `replied_by` | `uuid` | sí |  | FK → iam_users.id. |
| 14 | `conversation_id` | `uuid` | sí |  | FK → collab_conversations.id. |
| 15 | `incident_id` | `uuid` | sí |  | FK → ops_incidents.id. |
| 16 | `channel` | `character varying(30)` | sí |  |  |
| 17 | `contact_email` | `character varying(190)` | sí |  |  |
| 18 | `contact_phone` | `character varying(40)` | sí |  |  |
| 19 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 20 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 21 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 22 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `conversation_id` | `collab_conversations.id` | NO ACTION | `fk_channel_pax_feedback_conversation_id` |
| `incident_id` | `ops_incidents.id` | NO ACTION | `fk_channel_pax_feedback_incident_id` |
| `replied_by` | `iam_users.id` | NO ACTION | `fk_channel_pax_feedback_replied_by` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_channel_pax_feedback_reservation_id` |
| `reservation_service_id` | `booking_reservation_services.id` | NO ACTION | `fk_channel_pax_feedback_reservation_service_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_pax_feedback_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_channel_pax_feedback_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `channel_pax_feedback_rating_check` | `CHECK (((rating >= 1) AND (rating <= 5)))` |  |
| `channel_pax_feedback_status_check` | `CHECK (((status)::text = ANY ((ARRAY['nuevo'::character varying, 'leido'::character varying, 'respondido'::character varying, 'derivado'::character varying])::text[])))` | `status`: `nuevo`, `leido`, `respondido`, `derivado` |
| `channel_pax_feedback_type_check` | `CHECK (((type)::text = ANY ((ARRAY['comentario'::character varying, 'sugerencia'::character varying, 'felicitacion'::character varying, 'reclamo'::character varying, 'incidencia'::character varying])::text[])))` | `type`: `comentario`, `sugerencia`, `felicitacion`, `reclamo`, `incidencia` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_pax_feedback_conversation_id` | `USING btree (conversation_id)` |
| `ix_channel_pax_feedback_incident_id` | `USING btree (incident_id)` |
| `ix_channel_pax_feedback_replied_by` | `USING btree (replied_by)` |
| `ix_channel_pax_feedback_reservation_id` | `USING btree (reservation_id)` |
| `ix_channel_pax_feedback_reservation_service_id` | `USING btree (reservation_service_id)` |
| `ix_channel_pax_feedback_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_channel_pax_feedback_tenant_id_reservation_id` | `USING btree (tenant_id, reservation_id)` |
| `ix_channel_pax_feedback_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_channel_pax_feedback_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `channel_portal_access_links`

[Spec 08 §3.13] [Fase 2] Acceso del pasajero por enlace/código.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 4 | `passenger_id` | `uuid` | sí |  | FK → booking_passengers.id. |
| 5 | `email` | `character varying(190)` | no |  |  |
| 6 | `token_hash` | `character(64)` | no |  |  |
| 7 | `expires_at` | `timestamp with time zone` | no |  |  |
| 8 | `used_at` | `timestamp with time zone` | sí |  |  |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `passenger_id` | `booking_passengers.id` | NO ACTION | `fk_channel_portal_access_links_passenger_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_channel_portal_access_links_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_portal_access_links_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_channel_portal_access_links_token_hash` | `token_hash` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_portal_access_links_passenger_id` | `USING btree (passenger_id)` |
| `ix_channel_portal_access_links_reservation_id` | `USING btree (reservation_id)` |
| `ix_channel_portal_access_links_tenant_id` | `USING btree (tenant_id)` |

[↑ Índice del dominio](#tablas)

### `channel_trip_messages`

[Spec 05 §3.14] [Fase 2] Chat pasajero ↔ agencia de la app pasajero.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 4 | `sender_type` | `character varying(10)` | no |  | Valores: `passenger`, `agency`, `system`. |
| 5 | `sender_user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 6 | `body` | `text` | no |  |  |
| 7 | `quick_reply` | `boolean` | no | `false` |  |
| 8 | `read_at` | `timestamp with time zone` | sí |  |  |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_channel_trip_messages_reservation_id` |
| `sender_user_id` | `iam_users.id` | NO ACTION | `fk_channel_trip_messages_sender_user_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_trip_messages_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `channel_trip_messages_sender_type_check` | `CHECK (((sender_type)::text = ANY ((ARRAY['passenger'::character varying, 'agency'::character varying, 'system'::character varying])::text[])))` | `sender_type`: `passenger`, `agency`, `system` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_trip_messages_reservation_id` | `USING btree (reservation_id)` |
| `ix_channel_trip_messages_sender_user_id` | `USING btree (sender_user_id)` |
| `ix_channel_trip_messages_tenant_id_reservation_id_created_at` | `USING btree (tenant_id, reservation_id, created_at)` |

[↑ Índice del dominio](#tablas)

### `channel_web_cart_items`

[Spec 15 §3.2] [Fase 2] Líneas del carrito (precio recalculado en cada lectura).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `cart_id` | `uuid` | no |  | FK → channel_web_carts.id. |
| 4 | `line_no` | `smallint` | no |  |  |
| 5 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 6 | `service_date` | `date` | no |  |  |
| 7 | `departure_id` | `uuid` | sí |  | FK → catalog_product_departures.id. |
| 8 | `pax_adults` | `smallint` | no | `1` |  |
| 9 | `pax_children` | `smallint` | no | `0` |  |
| 10 | `pax_infants` | `smallint` | no | `0` |  |
| 11 | `options` | `jsonb` | no | `'{}'::jsonb` |  |
| 12 | `extras` | `jsonb` | no | `'{}'::jsonb` |  |
| 13 | `addons` | `jsonb` | sí |  |  |
| 14 | `lodging` | `jsonb` | sí |  |  |
| 15 | `no_lodging` | `boolean` | no | `false` |  |
| 16 | `removed_line_keys` | `text[]` | no | `'{}'::text[]` |  |
| 17 | `source` | `character varying(10)` | no | `'sitio'::character varying` | Valores: `sitio`, `widget`. |
| 18 | `hold_id` | `uuid` | sí |  | FK → catalog_availability_holds.id. |
| 19 | `hold_expires_at` | `timestamp with time zone` | sí |  |  |
| 20 | `added_at` | `timestamp with time zone` | no | `now()` |  |
| 21 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 22 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 23 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 24 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `cart_id` | `channel_web_carts.id` | CASCADE | `fk_channel_web_cart_items_cart_id` |
| `departure_id` | `catalog_product_departures.id` | NO ACTION | `fk_channel_web_cart_items_departure_id` |
| `hold_id` | `catalog_availability_holds.id` | NO ACTION | `fk_channel_web_cart_items_hold_id` |
| `product_id` | `catalog_products.id` | NO ACTION | `fk_channel_web_cart_items_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_web_cart_items_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_channel_web_cart_items_cart_id_line_no` | `cart_id, line_no` |  | índice único |
| `uq_channel_web_cart_items_hold_id_p` | `hold_id` | `(hold_id IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `channel_web_cart_items_source_check` | `CHECK (((source)::text = ANY ((ARRAY['sitio'::character varying, 'widget'::character varying])::text[])))` | `source`: `sitio`, `widget` |
| `ck_channel_web_cart_items_1` | `CHECK (((pax_adults >= 1) AND (pax_children >= 0) AND (pax_infants >= 0) AND (pax_infants <= pax_adults)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_web_cart_items_departure_id` | `USING btree (departure_id)` |
| `ix_channel_web_cart_items_hold_id` | `USING btree (hold_id)` |
| `ix_channel_web_cart_items_product_id` | `USING btree (product_id)` |
| `ix_channel_web_cart_items_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_channel_web_cart_items_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `channel_web_carts`

[Spec 15 §3.1] [Fase 2] Carritos del sitio público.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `token_hash` | `character(64)` | no |  |  |
| 5 | `crm_client_id` | `uuid` | sí |  | FK → crm_clients.id. |
| 6 | `promo_code` | `character varying(40)` | sí |  |  |
| 7 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 8 | `locale` | `character varying(5)` | no | `'es'::character varying` | Valores: `es`, `en`. |
| 9 | `status` | `character varying(20)` | no | `'activo'::character varying` | Valores: `activo`, `convertido`, `abandonado`, `expirado`. |
| 10 | `order_id` | `uuid` | sí |  | FK → channel_ecom_orders.id. |
| 11 | `utm` | `jsonb` | sí |  |  |
| 12 | `last_activity_at` | `timestamp with time zone` | no | `now()` |  |
| 13 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 14 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 15 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 16 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 17 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `crm_client_id` | `crm_clients.id` | NO ACTION | `fk_channel_web_carts_crm_client_id` |
| `order_id` | `channel_ecom_orders.id` | NO ACTION | `fk_channel_web_carts_order_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_web_carts_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_channel_web_carts_order_id_p` | `order_id` | `(order_id IS NOT NULL)` | índice único |
| `uq_channel_web_carts_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_channel_web_carts_tenant_id_token_hash` | `tenant_id, token_hash` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `channel_web_carts_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `channel_web_carts_locale_check` | `CHECK (((locale)::text = ANY ((ARRAY['es'::character varying, 'en'::character varying])::text[])))` | `locale`: `es`, `en` |
| `channel_web_carts_status_check` | `CHECK (((status)::text = ANY ((ARRAY['activo'::character varying, 'convertido'::character varying, 'abandonado'::character varying, 'expirado'::character varying])::text[])))` | `status`: `activo`, `convertido`, `abandonado`, `expirado` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_web_carts_crm_client_id` | `USING btree (crm_client_id)` |
| `ix_channel_web_carts_last_activity_at_p` | `USING btree (last_activity_at) WHERE ((status)::text = 'activo'::text)` |
| `ix_channel_web_carts_order_id` | `USING btree (order_id)` |
| `ix_channel_web_carts_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_channel_web_carts_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_channel_web_carts_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_channel_web_carts_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `channel_web_events`

[Spec 15 §3.8] [Fase 2] Eventos de analítica del sitio (particionada por mes).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | Sí · `RANGE (occurred_at)` · 25 particiones (incluida DEFAULT) |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 2 | `id` | `bigint` | no | `identity (ALWAYS)` | PK. |
| 3 | `occurred_at` | `timestamp with time zone` | no | `now()` | PK. |
| 4 | `session_id` | `character varying(40)` | no |  |  |
| 5 | `client_id` | `uuid` | sí |  |  |
| 6 | `event` | `character varying(40)` | no |  |  |
| 7 | `params` | `jsonb` | no | `'{}'::jsonb` |  |
| 8 | `locale` | `character varying(5)` | no |  |  |
| 9 | `currency` | `character(3)` | no |  |  |
| 10 | `utm` | `jsonb` | sí |  |  |

**PK:** `id, occurred_at`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_web_events_tenant_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_web_events_tenant_id_event_occurred_at_desc` | `USING btree (tenant_id, event, occurred_at DESC)` |
| `ix_channel_web_events_tenant_id_occurred_at_desc` | `USING btree (tenant_id, occurred_at DESC)` |

**Particiones:** 25 (p. ej. `channel_web_events_default`, `channel_web_events_y2026m01`, `channel_web_events_y2026m02` …). Se crean con `app_create_monthly_partitions()`; programar un job mensual.

[↑ Índice del dominio](#tablas)

### `channel_widget_config`

[Spec 17 §3.8] [Fase 2] Configuración del widget embebible (1 por tenant).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `tenant_slug` | `character varying(60)` | no |  |  |
| 4 | `public_key` | `character varying(40)` | no |  |  |
| 5 | `public_key_prev` | `character varying(40)` | sí |  |  |
| 6 | `prev_expires_at` | `timestamp with time zone` | sí |  |  |
| 7 | `defaults` | `jsonb` | no | `'{}'::jsonb` |  |
| 8 | `reviews_widget` | `jsonb` | no | `'{}'::jsonb` |  |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 12 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_widget_config_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_channel_widget_config_public_key` | `public_key` |  | índice único |
| `uq_channel_widget_config_tenant_id` | `tenant_id` |  | índice único |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_channel_widget_config_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `channel_widget_domains`

[Spec 17 §3.8] [Fase 2] Dominios autorizados del widget (CORS/CSP).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `domain` | `character varying(253)` | no |  |  |
| 4 | `cms` | `character varying(40)` | sí |  |  |
| 5 | `status` | `character varying(20)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `verificado`. |
| 6 | `verify_token` | `character varying(60)` | no |  |  |
| 7 | `verified_at` | `timestamp with time zone` | sí |  |  |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 9 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 11 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_widget_domains_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_channel_widget_domains_tenant_id_domain` | `tenant_id, domain` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `channel_widget_domains_domain_check` | `CHECK (((domain)::text ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$'::text))` |  |
| `channel_widget_domains_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'verificado'::character varying])::text[])))` | `status`: `pendiente`, `verificado` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_widget_domains_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_channel_widget_domains_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `channel_widget_handoffs`

[Spec 17 §3.8] [Fase 2] Traspaso del widget al checkout (TTL 24 h).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 5 | `service_date` | `date` | no |  |  |
| 6 | `pax` | `jsonb` | no |  |  |
| 7 | `addons` | `jsonb` | sí |  |  |
| 8 | `lodging` | `jsonb` | sí |  |  |
| 9 | `removed` | `text[]` | no | `'{}'::text[]` |  |
| 10 | `currency_display` | `character(3)` | no |  |  |
| 11 | `fx_rate` | `numeric(12,6)` | no |  |  |
| 12 | `payment_mode` | `character varying(15)` | sí |  |  |
| 13 | `lang` | `character(2)` | no | `'es'::bpchar` |  |
| 14 | `origin_domain` | `character varying(253)` | sí |  |  |
| 15 | `quote_snapshot` | `jsonb` | sí |  |  |
| 16 | `rules_applied` | `text[]` | no | `'{}'::text[]` |  |
| 17 | `status` | `character varying(20)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `en_carrito`, `convertido`, `expirado`. |
| 18 | `cart_id` | `uuid` | sí |  | FK → channel_web_carts.id. |
| 19 | `expires_at` | `timestamp with time zone` | no |  |  |
| 20 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 21 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 22 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 23 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `cart_id` | `channel_web_carts.id` | NO ACTION | `fk_channel_widget_handoffs_cart_id` |
| `product_id` | `catalog_products.id` | NO ACTION | `fk_channel_widget_handoffs_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_widget_handoffs_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_channel_widget_handoffs_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `channel_widget_handoffs_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'en_carrito'::character varying, 'convertido'::character varying, 'expirado'::character varying])::text[])))` | `status`: `pendiente`, `en_carrito`, `convertido`, `expirado` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_widget_handoffs_cart_id` | `USING btree (cart_id)` |
| `ix_channel_widget_handoffs_product_id` | `USING btree (product_id)` |
| `ix_channel_widget_handoffs_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_channel_widget_handoffs_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_channel_widget_handoffs_tenant_id_status_expires_at` | `USING btree (tenant_id, status, expires_at)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_channel_widget_handoffs_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `channel_wishlist_items`

[Spec 15 §3.7] [Fase 2] Favoritos del cliente.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). PK. FK → tenants.id. |
| 2 | `crm_client_id` | `uuid` | no |  | PK. FK → crm_clients.id. |
| 3 | `product_id` | `uuid` | no |  | PK. FK → catalog_products.id. |
| 4 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `tenant_id, crm_client_id, product_id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `crm_client_id` | `crm_clients.id` | CASCADE | `fk_channel_wishlist_items_crm_client_id` |
| `product_id` | `catalog_products.id` | CASCADE | `fk_channel_wishlist_items_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_wishlist_items_tenant_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_wishlist_items_crm_client_id` | `USING btree (crm_client_id)` |
| `ix_channel_wishlist_items_product_id` | `USING btree (product_id)` |

[↑ Índice del dominio](#tablas)

### `channel_external_reviews`

[Spec 17 §3.7] [Fase 3] Reseñas importadas (texto inmutable).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Canales (channel_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `source_id` | `uuid` | no |  | FK → integration_review_sources.id. |
| 4 | `external_id` | `character varying(120)` | no |  |  |
| 5 | `author_display` | `character varying(120)` | no |  |  |
| 6 | `review_date` | `date` | no |  |  |
| 7 | `rating` | `smallint` | no |  |  |
| 8 | `title` | `text` | sí |  |  |
| 9 | `body` | `text` | sí |  |  |
| 10 | `lang` | `character(2)` | sí |  |  |
| 11 | `product_id` | `uuid` | sí |  | FK → catalog_products.id. |
| 12 | `url` | `text` | sí |  |  |
| 13 | `response_status` | `character varying(20)` | no | `'sin_responder'::character varying` | Valores: `sin_responder`, `pendiente_publicar`, `publicada`, `no_admite`. |
| 14 | `reply` | `text` | sí |  |  |
| 15 | `replied_at` | `timestamp with time zone` | sí |  |  |
| 16 | `replied_by` | `uuid` | sí |  | FK → iam_users.id. |
| 17 | `conversation_id` | `uuid` | sí |  | FK → collab_conversations.id. |
| 18 | `raw` | `jsonb` | sí |  |  |
| 19 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 20 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 21 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 22 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `conversation_id` | `collab_conversations.id` | NO ACTION | `fk_channel_external_reviews_conversation_id` |
| `product_id` | `catalog_products.id` | NO ACTION | `fk_channel_external_reviews_product_id` |
| `replied_by` | `iam_users.id` | NO ACTION | `fk_channel_external_reviews_replied_by` |
| `source_id` | `integration_review_sources.id` | NO ACTION | `fk_channel_external_reviews_source_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_channel_external_reviews_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_channel_external_reviews_tenant_id_source_id_external_id` | `tenant_id, source_id, external_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `channel_external_reviews_rating_check` | `CHECK (((rating >= 1) AND (rating <= 5)))` |  |
| `channel_external_reviews_response_status_check` | `CHECK (((response_status)::text = ANY ((ARRAY['sin_responder'::character varying, 'pendiente_publicar'::character varying, 'publicada'::character varying, 'no_admite'::character varying])::text[])))` | `response_status`: `sin_responder`, `pendiente_publicar`, `publicada`, `no_admite` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_channel_external_reviews_conversation_id` | `USING btree (conversation_id)` |
| `ix_channel_external_reviews_product_id` | `USING btree (product_id)` |
| `ix_channel_external_reviews_replied_by` | `USING btree (replied_by)` |
| `ix_channel_external_reviews_source_id` | `USING btree (source_id)` |
| `ix_channel_external_reviews_tenant_id_response_status` | `USING btree (tenant_id, response_status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_channel_external_reviews_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)
