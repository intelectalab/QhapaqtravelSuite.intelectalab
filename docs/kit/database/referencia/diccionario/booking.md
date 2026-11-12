# Diccionario de datos · Reservas (booking_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.15 tras cargar `00`→`90`. No editar a mano._

Reservas, pasajeros, servicios, holds, cambios, cancelaciones y snapshots web.

15 tablas · 312 columnas · 83 claves foráneas. Diagrama ER: [`../er/booking.svg`](../er/booking.svg) (fuente [`../er/booking.mmd`](../er/booking.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`booking_cancel_requests`](#booking_cancel_requests) | Fase 1 · MVP | tenant | 14 | 4 | [Spec 04 §3 + 10 §3.11] [Fase 1] Solicitudes de anulación de reserva. |
| [`booking_cancellations`](#booking_cancellations) | Fase 1 · MVP | tenant | 23 | 6 | [Spec 04 §3] [Fase 1] Resultado de la cancelación (penalidad, reembolso). |
| [`booking_changes`](#booking_changes) | Fase 1 · MVP | tenant | 21 | 5 | [Spec 04 §3] [Fase 1] Modificaciones y reprogramaciones de la reserva. |
| [`booking_inventory_holds`](#booking_inventory_holds) | Fase 1 · MVP | tenant | 13 | 4 | [Spec 04 §3] [Fase 1] Cupo consumido por la reserva en una salida (registro por reserva). v2.5: no entra en el cálculo de disponibilidad; la disponibilidad = ca |
| [`booking_passengers`](#booking_passengers) | Fase 1 · MVP | tenant | 22 | 2 | [Spec 04 §3 (+ v2.1)] [Fase 1] Pasajeros de la reserva. |
| [`booking_reservation_services`](#booking_reservation_services) | Fase 1 · MVP | tenant | 40 | 12 | [Spec 04 §3 + 05 §3.3 + 08 §3.15] [Fase 1] Servicios de la reserva (estado de proveedor y operativo). |
| [`booking_reservations`](#booking_reservations) | Fase 1 · MVP | tenant | 36 | 9 | [Spec 04 §3] [Fase 1] Reserva. |
| [`booking_reservation_web_addons`](#booking_reservation_web_addons) | Fase 2 · Canales y campo | tenant | 12 | 3 | [Spec 04 §3 v2.1] [Fase 2] Adicionales elegidos en la reserva web. |
| [`booking_reservation_web_lodging`](#booking_reservation_web_lodging) | Fase 2 · Canales y campo | tenant | 14 | 3 | [Spec 04 §3 v2.1] [Fase 2] Alojamiento elegido en la reserva web. |
| [`booking_reservation_web_snapshots`](#booking_reservation_web_snapshots) | Fase 2 · Canales y campo | tenant | 38 | 3 | [Spec 04 §3 v2.1] [Fase 2] Snapshot 1:1 de la reserva web (motor de reservas). |
| [`booking_corporate_approvals`](#booking_corporate_approvals) | Fase 3 · SaaS y crecimiento | tenant | 19 | 8 | [Spec 20 §3.5] [Fase 3] Aprobación de la empresa cliente para una cotización o reserva que supera el umbral. |
| [`booking_cost_allocations`](#booking_cost_allocations) | Fase 3 · SaaS y crecimiento | tenant | 12 | 6 | [Spec 20 §3.6] [Fase 3] Reparto del importe de una reserva corporativa por centro de costo y viajero. |
| [`booking_in_trip_offers`](#booking_in_trip_offers) | Fase 3 · SaaS y crecimiento | tenant | 18 | 7 | [Spec 21 §3.6] [Fase 3] Venta en ruta: oferta de un tour o movilidad de un tramo pendiente, con link de pago y vencimiento. |
| [`booking_trip_items`](#booking_trip_items) | Fase 3 · SaaS y crecimiento | tenant | 20 | 8 | [Spec 21 §3.5] [Fase 3] Tours y movilidad del viaje armado, con importe confirmado por el servidor y servicio generado. |
| [`booking_trip_legs`](#booking_trip_legs) | Fase 3 · SaaS y crecimiento | tenant | 10 | 3 | [Spec 21 §3.4] [Fase 3] Tramos del viaje armado en la reserva: noches elegidas y fechas de entrada y salida por ciudad. |

## Detalle por tabla

### `booking_cancel_requests`

[Spec 04 §3 + 10 §3.11] [Fase 1] Solicitudes de anulación de reserva.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reservas (booking_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, iam_users.tenant_id, booking_reservations.tenant_id, tenants.id. |
| 3 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 4 | `reason` | `text` | no |  |  |
| 5 | `requested_by` | `uuid` | no |  | FK → iam_users.id. |
| 6 | `requested_at` | `timestamp with time zone` | no | `now()` |  |
| 7 | `status` | `character varying(15)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `aprobada`, `rechazada`, `retirada`. |
| 8 | `decided_by` | `uuid` | sí |  | FK → iam_users.id. |
| 9 | `decided_at` | `timestamp with time zone` | sí |  |  |
| 10 | `decision_note` | `text` | sí |  |  |
| 11 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 12 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 13 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 14 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, decided_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_booking_cancel_requests_decided_by` |
| `tenant_id, requested_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_booking_cancel_requests_requested_by` |
| `tenant_id, reservation_id` | `booking_reservations.tenant_id, id` | NO ACTION | `fk_booking_cancel_requests_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_booking_cancel_requests_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_booking_cancel_requests_id` | `tenant_id, id` |  | restricción |
| `uq_booking_cancel_requests_reservation_id_p` | `reservation_id` | `((status)::text = 'pendiente'::text)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `booking_cancel_requests_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'retirada'::character varying])::text[])))` | `status`: `pendiente`, `aprobada`, `rechazada`, `retirada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_booking_cancel_requests_decided_by` | `USING btree (decided_by)` |
| `ix_booking_cancel_requests_requested_by` | `USING btree (requested_by)` |
| `ix_booking_cancel_requests_reservation_id` | `USING btree (reservation_id)` |
| `ix_booking_cancel_requests_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_booking_cancel_requests_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `booking_cancellations`

[Spec 04 §3] [Fase 1] Resultado de la cancelación (penalidad, reembolso).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reservas (booking_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, fin_invoices.tenant_id, fin_receivables.tenant_id, fin_payments.tenant_id, booking_reservations.tenant_id, tenants.id. |
| 3 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 4 | `total_at_cancel` | `numeric(14,2)` | no |  |  |
| 5 | `paid_at_cancel` | `numeric(14,2)` | no |  |  |
| 6 | `penalty_services` | `numeric(14,2)` | no |  |  |
| 7 | `consumed_amount` | `numeric(14,2)` | no |  |  |
| 8 | `factor_k` | `numeric(12,6)` | no |  |  |
| 9 | `penalty_amount` | `numeric(14,2)` | no |  |  |
| 10 | `refund_amount` | `numeric(14,2)` | no |  |  |
| 11 | `owed_amount` | `numeric(14,2)` | no |  |  |
| 12 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 13 | `lines` | `jsonb` | no |  |  |
| 14 | `credit_note_id` | `uuid` | sí |  | FK → fin_invoices.id. |
| 15 | `refund_payment_id` | `uuid` | sí |  | FK → fin_payments.id. |
| 16 | `penalty_receivable_id` | `uuid` | sí |  | FK → fin_receivables.id. |
| 17 | `reason` | `text` | no |  |  |
| 18 | `cancelled_by` | `uuid` | no |  | FK → iam_users.id. |
| 19 | `cancelled_at` | `timestamp with time zone` | no | `now()` |  |
| 20 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 21 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 22 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 23 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, cancelled_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_booking_cancellations_cancelled_by` |
| `tenant_id, credit_note_id` | `fin_invoices.tenant_id, id` | NO ACTION | `fk_booking_cancellations_credit_note_id` |
| `tenant_id, penalty_receivable_id` | `fin_receivables.tenant_id, id` | NO ACTION | `fk_booking_cancellations_penalty_receivable_id` |
| `tenant_id, refund_payment_id` | `fin_payments.tenant_id, id` | NO ACTION | `fk_booking_cancellations_refund_payment_id` |
| `tenant_id, reservation_id` | `booking_reservations.tenant_id, id` | NO ACTION | `fk_booking_cancellations_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_booking_cancellations_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_booking_cancellations_reservation_id` | `reservation_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `booking_cancellations_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_booking_cancellations_cancelled_by` | `USING btree (cancelled_by)` |
| `ix_booking_cancellations_credit_note_id` | `USING btree (credit_note_id)` |
| `ix_booking_cancellations_penalty_receivable_id` | `USING btree (penalty_receivable_id)` |
| `ix_booking_cancellations_refund_payment_id` | `USING btree (refund_payment_id)` |
| `ix_booking_cancellations_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_booking_cancellations_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `booking_changes`

[Spec 04 §3] [Fase 1] Modificaciones y reprogramaciones de la reserva.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reservas (booking_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, catalog_products.tenant_id, iam_users.tenant_id, booking_reservations.tenant_id, tenants.id. |
| 3 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 4 | `type` | `character varying(20)` | no |  | Valores: `pax`, `servicio`, `upgrade`, `otro`, `reprogramacion`. |
| 5 | `description` | `text` | no |  |  |
| 6 | `extra_pax` | `integer` | sí |  |  |
| 7 | `product_id` | `uuid` | sí |  | FK → catalog_products.id. |
| 8 | `service_date` | `date` | sí |  |  |
| 9 | `delta_amount` | `numeric(14,2)` | no | `0` |  |
| 10 | `credit_amount` | `numeric(14,2)` | sí |  |  |
| 11 | `status` | `character varying(15)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `aplicada`, `rechazada`. |
| 12 | `requested_by` | `uuid` | no |  | FK → iam_users.id. |
| 13 | `requested_at` | `timestamp with time zone` | no | `now()` |  |
| 14 | `decided_by` | `uuid` | sí |  | FK → iam_users.id. |
| 15 | `decided_at` | `timestamp with time zone` | sí |  |  |
| 16 | `applied_at` | `timestamp with time zone` | sí |  |  |
| 17 | `payload` | `jsonb` | sí |  |  |
| 18 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 19 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 20 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 21 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, decided_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_booking_changes_decided_by` |
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | NO ACTION | `fk_booking_changes_product_id` |
| `tenant_id, requested_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_booking_changes_requested_by` |
| `tenant_id, reservation_id` | `booking_reservations.tenant_id, id` | NO ACTION | `fk_booking_changes_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_booking_changes_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `booking_changes_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'aplicada'::character varying, 'rechazada'::character varying])::text[])))` | `status`: `pendiente`, `aplicada`, `rechazada` |
| `booking_changes_type_check` | `CHECK (((type)::text = ANY ((ARRAY['pax'::character varying, 'servicio'::character varying, 'upgrade'::character varying, 'otro'::character varying, 'reprogramacion'::character varying])::text[])))` | `type`: `pax`, `servicio`, `upgrade`, `otro`, `reprogramacion` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_booking_changes_decided_by` | `USING btree (decided_by)` |
| `ix_booking_changes_product_id` | `USING btree (product_id)` |
| `ix_booking_changes_requested_by` | `USING btree (requested_by)` |
| `ix_booking_changes_reservation_id` | `USING btree (reservation_id)` |
| `ix_booking_changes_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_booking_changes_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `booking_inventory_holds`

[Spec 04 §3] [Fase 1] Cupo consumido por la reserva en una salida (registro por reserva). v2.5: no entra en el cálculo de disponibilidad; la disponibilidad = capacity − sold − holds vigentes de catalog_availability_holds (fuente única de retenciones).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reservas (booking_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → booking_reservation_services.tenant_id, catalog_product_departures.tenant_id, booking_reservations.tenant_id, tenants.id. |
| 3 | `departure_id` | `uuid` | no |  | FK → catalog_product_departures.id. |
| 4 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 5 | `booking_service_id` | `uuid` | sí |  | FK → booking_reservation_services.id. |
| 6 | `pax` | `integer` | no |  |  |
| 7 | `status` | `character varying(15)` | no | `'hold'::character varying` | Valores: `hold`, `confirmada`, `liberada`, `expirada`, `consumida`. |
| 8 | `expires_at` | `timestamp with time zone` | sí |  |  |
| 9 | `released_at` | `timestamp with time zone` | sí |  |  |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 13 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, booking_service_id` | `booking_reservation_services.tenant_id, id` | NO ACTION | `fk_booking_inventory_holds_booking_service_id` |
| `tenant_id, departure_id` | `catalog_product_departures.tenant_id, id` | NO ACTION | `fk_booking_inventory_holds_departure_id` |
| `tenant_id, reservation_id` | `booking_reservations.tenant_id, id` | NO ACTION | `fk_booking_inventory_holds_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_booking_inventory_holds_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `booking_inventory_holds_pax_check` | `CHECK ((pax > 0))` |  |
| `booking_inventory_holds_status_check` | `CHECK (((status)::text = ANY ((ARRAY['hold'::character varying, 'confirmada'::character varying, 'liberada'::character varying, 'expirada'::character varying, 'consumida'::character varying])::text[])))` | `status`: `hold`, `confirmada`, `liberada`, `expirada`, `consumida` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_booking_inventory_holds_booking_service_id` | `USING btree (booking_service_id)` |
| `ix_booking_inventory_holds_departure_id` | `USING btree (departure_id)` |
| `ix_booking_inventory_holds_reservation_id` | `USING btree (reservation_id)` |
| `ix_booking_inventory_holds_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_booking_inventory_holds_tenant_id_status_expires_at` | `USING btree (tenant_id, status, expires_at)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_booking_inventory_holds_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `booking_passengers`

[Spec 04 §3 (+ v2.1)] [Fase 1] Pasajeros de la reserva.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reservas (booking_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → booking_reservations.tenant_id, tenants.id. |
| 3 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 4 | `seq` | `smallint` | no |  |  |
| 5 | `full_name` | `character varying(150)` | no |  |  |
| 6 | `doc_type` | `character varying(12)` | sí |  | Valores: `DNI`, `Pasaporte`, `CE`, `Passport`. |
| 7 | `doc_number` | `text` | sí |  |  |
| 8 | `pax_type` | `character(3)` | no | `'ADT'::bpchar` | Valores: `ADT`, `CHD`, `INF`. |
| 9 | `nationality` | `character varying(60)` | sí |  |  |
| 10 | `birth_date` | `date` | sí |  |  |
| 11 | `phone` | `character varying(30)` | sí |  |  |
| 12 | `diet_notes` | `character varying(200)` | sí |  |  |
| 13 | `is_placeholder` | `boolean` | no | `true` |  |
| 14 | `relationship` | `character varying(30)` | sí |  | Valores: `Titular`, `Cónyuge / pareja`, `Hijo/a`, `Padre / madre`, `Hermano/a`, `Amigo/a`, `Otro`. |
| 15 | `age` | `smallint` | sí |  |  |
| 16 | `email` | `character varying(150)` | sí |  |  |
| 17 | `is_lead` | `boolean` | no | `false` |  |
| 18 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 19 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 20 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 21 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 22 | `pending` | `boolean` | no | `false` | Columnas agregadas en Fase 2 por spec 15 §3.14 [Agregada en `30_fase2.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, reservation_id` | `booking_reservations.tenant_id, id` | NO ACTION | `fk_booking_passengers_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_booking_passengers_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_booking_passengers_id` | `tenant_id, id` |  | restricción |
| `uq_booking_passengers_reservation_id_p` | `reservation_id` | `is_lead` | índice único |
| `uq_booking_passengers_reservation_id_seq` | `reservation_id, seq` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `booking_passengers_doc_type_check` | `CHECK (((doc_type IS NULL) OR ((doc_type)::text = ANY ((ARRAY['DNI'::character varying, 'Pasaporte'::character varying, 'CE'::character varying, 'Passport'::character varying])::text[]))))` | `doc_type`: `DNI`, `Pasaporte`, `CE`, `Passport` |
| `booking_passengers_pax_type_check` | `CHECK ((pax_type = ANY (ARRAY['ADT'::bpchar, 'CHD'::bpchar, 'INF'::bpchar])))` | `pax_type`: `ADT`, `CHD`, `INF` |
| `booking_passengers_relationship_check` | `CHECK (((relationship IS NULL) OR ((relationship)::text = ANY ((ARRAY['Titular'::character varying, 'Cónyuge / pareja'::character varying, 'Hijo/a'::character varying, 'Padre / madre'::character varying, 'Hermano/a'::character varying, 'Amigo/a'::character varying, 'Otro'::character varying])::text[]))))` | `relationship`: `Titular`, `Cónyuge / pareja`, `Hijo/a`, `Padre / madre`, `Hermano/a`, `Amigo/a`, `Otro` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_booking_passengers_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_booking_passengers_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `booking_reservation_services`

[Spec 04 §3 + 05 §3.3 + 08 §3.15] [Fase 1] Servicios de la reserva (estado de proveedor y operativo).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reservas (booking_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_product_addons.tenant_id, booking_reservation_services.tenant_id, catalog_services.tenant_id, iam_users.tenant_id, catalog_product_departures.tenant_id, catalog_products.tenant_id, catalog_providers.tenant_id, quote_items.tenant_id, booking_reservation_services.tenant_id, iam_users.tenant_id, booking_reservations.tenant_id, tenants.id. |
| 3 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 4 | `code` | `character varying(20)` | no |  |  |
| 5 | `product_id` | `uuid` | sí |  | FK → catalog_products.id. |
| 6 | `catalog_service_id` | `uuid` | sí |  | FK → catalog_services.id. |
| 7 | `quote_item_id` | `uuid` | sí |  | FK → quote_items.id. |
| 8 | `departure_id` | `uuid` | sí |  | FK → catalog_product_departures.id. |
| 9 | `provider_id` | `uuid` | sí |  | FK → catalog_providers.id. |
| 10 | `name` | `character varying(200)` | no |  |  |
| 11 | `service_date` | `date` | no |  |  |
| 12 | `service_time` | `time without time zone` | sí |  |  |
| 13 | `pax` | `integer` | sí |  |  |
| 14 | `status` | `character varying(30)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `solicitado`, `confirmado`, `rechazado`, `en_curso`, `completado`, `cancelado`. |
| 15 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 16 | `fx_rate` | `numeric(12,6)` | sí |  |  |
| 17 | `cost_amount` | `numeric(14,2)` | no | `0` |  |
| 18 | `price_amount` | `numeric(14,2)` | no | `0` |  |
| 19 | `is_required` | `boolean` | no | `true` |  |
| 20 | `requires_assignment` | `boolean` | no | `false` |  |
| 21 | `service_kind` | `character varying(20)` | no | `'tour'::character varying` | Valores: `tour`, `traslado`, `alojamiento`, `tren_entrada`, `libre`. |
| 22 | `confirmation_code` | `character varying(40)` | sí |  |  |
| 23 | `confirmed_by_name` | `character varying(120)` | sí |  |  |
| 24 | `confirmed_by` | `uuid` | sí |  | FK → iam_users.id. |
| 25 | `requested_at` | `timestamp with time zone` | sí |  |  |
| 26 | `requested_by` | `uuid` | sí |  | FK → iam_users.id. |
| 27 | `confirmed_at` | `timestamp with time zone` | sí |  |  |
| 28 | `reject_reason` | `text` | sí |  |  |
| 29 | `alt_of_id` | `uuid` | sí |  | FK → booking_reservation_services.id. |
| 30 | `replaced_by_id` | `uuid` | sí |  | FK → booking_reservation_services.id. |
| 31 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 32 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 33 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 34 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 35 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 36 | `pax_detail` | `jsonb` | sí |  | Columnas agregadas en Fase 2 por spec 15 §3.14 [Agregada en `30_fase2.sql`] |
| 37 | `kind` | `character varying(20)` | sí |  | Columnas agregadas en Fase 2 por spec 15 §3.14 Valores: `adicional`, `alojamiento`, `recargo`. [Agregada en `30_fase2.sql`] |
| 38 | `addon_id` | `uuid` | sí |  | Columnas agregadas en Fase 2 por spec 15 §3.14 FK → catalog_product_addons.id. [Agregada en `30_fase2.sql`] |
| 39 | `rooms` | `smallint` | sí |  | Columnas agregadas en Fase 2 por spec 15 §3.14 [Agregada en `30_fase2.sql`] |
| 40 | `nights` | `smallint` | sí |  | Columnas agregadas en Fase 2 por spec 15 §3.14 [Agregada en `30_fase2.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, addon_id` | `catalog_product_addons.tenant_id, id` | NO ACTION | `fk_booking_reservation_services_addon_id` |
| `tenant_id, alt_of_id` | `booking_reservation_services.tenant_id, id` | NO ACTION | `fk_booking_reservation_services_alt_of_id` |
| `tenant_id, catalog_service_id` | `catalog_services.tenant_id, id` | NO ACTION | `fk_booking_reservation_services_catalog_service_id` |
| `tenant_id, confirmed_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_booking_reservation_services_confirmed_by` |
| `tenant_id, departure_id` | `catalog_product_departures.tenant_id, id` | NO ACTION | `fk_booking_reservation_services_departure_id` |
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | NO ACTION | `fk_booking_reservation_services_product_id` |
| `tenant_id, provider_id` | `catalog_providers.tenant_id, id` | NO ACTION | `fk_booking_reservation_services_provider_id` |
| `tenant_id, quote_item_id` | `quote_items.tenant_id, id` | NO ACTION | `fk_booking_reservation_services_quote_item_id` |
| `tenant_id, replaced_by_id` | `booking_reservation_services.tenant_id, id` | NO ACTION | `fk_booking_reservation_services_replaced_by_id` |
| `tenant_id, requested_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_booking_reservation_services_requested_by` |
| `tenant_id, reservation_id` | `booking_reservations.tenant_id, id` | NO ACTION | `fk_booking_reservation_services_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_booking_reservation_services_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_booking_reservation_services_id` | `tenant_id, id` |  | restricción |
| `uq_booking_reservation_services_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `booking_reservation_services_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `booking_reservation_services_kind_check` | `CHECK (((kind IS NULL) OR ((kind)::text = ANY ((ARRAY['adicional'::character varying, 'alojamiento'::character varying, 'recargo'::character varying])::text[]))))` | `kind`: `adicional`, `alojamiento`, `recargo` |
| `booking_reservation_services_service_kind_check` | `CHECK (((service_kind)::text = ANY ((ARRAY['tour'::character varying, 'traslado'::character varying, 'alojamiento'::character varying, 'tren_entrada'::character varying, 'libre'::character varying])::text[])))` | `service_kind`: `tour`, `traslado`, `alojamiento`, `tren_entrada`, `libre` |
| `booking_reservation_services_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'solicitado'::character varying, 'confirmado'::character varying, 'rechazado'::character varying, 'en_curso'::character varying, 'completado'::character varying, 'cancelado'::character varying])::text[])))` | `status`: `pendiente`, `solicitado`, `confirmado`, `rechazado`, `en_curso`, `completado`, `cancelado` |
| `ck_booking_reservation_services_1` | `CHECK ((((status)::text <> 'confirmado'::text) OR (confirmation_code IS NOT NULL)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_booking_reservation_services_addon_id` | `USING btree (addon_id)` |
| `ix_booking_reservation_services_alt_of_id` | `USING btree (alt_of_id)` |
| `ix_booking_reservation_services_catalog_service_id` | `USING btree (catalog_service_id)` |
| `ix_booking_reservation_services_confirmed_by` | `USING btree (confirmed_by)` |
| `ix_booking_reservation_services_departure_id` | `USING btree (departure_id)` |
| `ix_booking_reservation_services_product_id` | `USING btree (product_id)` |
| `ix_booking_reservation_services_provider_id` | `USING btree (provider_id)` |
| `ix_booking_reservation_services_quote_item_id` | `USING btree (quote_item_id)` |
| `ix_booking_reservation_services_replaced_by_id` | `USING btree (replaced_by_id)` |
| `ix_booking_reservation_services_requested_by` | `USING btree (requested_by)` |
| `ix_booking_reservation_services_reservation_id_service_date` | `USING btree (reservation_id, service_date)` |
| `ix_booking_reservation_services_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_booking_reservation_services_tenant_id_provider_id_status` | `USING btree (tenant_id, provider_id, status)` |
| `ix_booking_reservation_services_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_booking_reservation_services_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_booking_reservation_services_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `booking_reservations`

[Spec 04 §3] [Fase 1] Reserva.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reservas (booking_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → channel_b2b_agencies.tenant_id, booking_cancel_requests.tenant_id, crm_clients.tenant_id, channel_ecom_orders.tenant_id, iam_users.tenant_id, quote_quotes.tenant_id, quote_versions.tenant_id, iam_sedes.tenant_id, tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `quote_id` | `uuid` | sí |  | FK → quote_quotes.id. |
| 5 | `quote_version_id` | `uuid` | sí |  | FK → quote_versions.id. |
| 6 | `quote_version_no` | `smallint` | sí |  |  |
| 7 | `client_id` | `uuid` | no |  | FK → crm_clients.id. |
| 8 | `agency_id` | `uuid` | sí |  | FK → channel_b2b_agencies.id. |
| 9 | `owner_id` | `uuid` | no |  | FK → iam_users.id. |
| 10 | `sede_id` | `uuid` | no |  | FK → iam_sedes.id. |
| 11 | `title` | `character varying(200)` | no |  |  |
| 12 | `status` | `character varying(30)` | no | `'borrador'::character varying` | Valores: `borrador`, `pendiente_disponibilidad`, `confirmada`, `pendiente_pago`, `pendiente_proveedor`, `reprogramada`, `parcial`, `incidencia`, `en_operacion`, `completada`, `cancelada`. |
| 13 | `channel` | `character varying(15)` | no | `'Directo'::character varying` | Valores: `Directo`, `Corporativo`, `B2B`, `E-commerce`. |
| 14 | `travel_from` | `date` | no |  |  |
| 15 | `travel_to` | `date` | no |  |  |
| 16 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 17 | `fx_rate` | `numeric(12,6)` | no |  |  |
| 18 | `total_amount` | `numeric(14,2)` | no | `0` |  |
| 19 | `snapshot_label` | `character varying(300)` | no |  |  |
| 20 | `catalog_snapshot` | `jsonb` | sí |  |  |
| 21 | `policies_snapshot` | `jsonb` | no | `'{}'::jsonb` |  |
| 22 | `notes` | `text` | sí |  |  |
| 23 | `rescheduled_at` | `timestamp with time zone` | sí |  |  |
| 24 | `cancelled_at` | `timestamp with time zone` | sí |  |  |
| 25 | `cancel_reason` | `text` | sí |  |  |
| 26 | `penalty_amount` | `numeric(14,2)` | sí |  |  |
| 27 | `refund_amount` | `numeric(14,2)` | sí |  |  |
| 28 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 29 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 30 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 31 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 32 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 33 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |
| 34 | `ecom_order_id` | `uuid` | sí |  | Columnas agregadas en Fase 2 por spec 08 §3.15 + 10 §3.11 FK → channel_ecom_orders.id. [Agregada en `30_fase2.sql`] |
| 35 | `b2b_terms` | `jsonb` | sí |  | Columnas agregadas en Fase 2 por spec 08 §3.15 + 10 §3.11 [Agregada en `30_fase2.sql`] |
| 36 | `cancel_request_id` | `uuid` | sí |  | Columnas agregadas en Fase 2 por spec 08 §3.15 + 10 §3.11 FK → booking_cancel_requests.id. [Agregada en `30_fase2.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, agency_id` | `channel_b2b_agencies.tenant_id, id` | NO ACTION | `fk_booking_reservations_agency_id` |
| `tenant_id, cancel_request_id` | `booking_cancel_requests.tenant_id, id` | NO ACTION | `fk_booking_reservations_cancel_request_id` |
| `tenant_id, client_id` | `crm_clients.tenant_id, id` | NO ACTION | `fk_booking_reservations_client_id` |
| `tenant_id, ecom_order_id` | `channel_ecom_orders.tenant_id, id` | NO ACTION | `fk_booking_reservations_ecom_order_id` |
| `tenant_id, owner_id` | `iam_users.tenant_id, id` | NO ACTION | `fk_booking_reservations_owner_id` |
| `tenant_id, quote_id` | `quote_quotes.tenant_id, id` | NO ACTION | `fk_booking_reservations_quote_id` |
| `tenant_id, quote_version_id` | `quote_versions.tenant_id, id` | NO ACTION | `fk_booking_reservations_quote_version_id` |
| `tenant_id, sede_id` | `iam_sedes.tenant_id, id` | NO ACTION | `fk_booking_reservations_sede_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_booking_reservations_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_booking_reservations_id` | `tenant_id, id` |  | restricción |
| `uq_booking_reservations_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_booking_reservations_tenant_id_quote_id_p` | `tenant_id, quote_id` | `(quote_id IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `booking_reservations_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['Directo'::character varying, 'Corporativo'::character varying, 'B2B'::character varying, 'E-commerce'::character varying])::text[])))` | `channel`: `Directo`, `Corporativo`, `B2B`, `E-commerce` |
| `booking_reservations_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `booking_reservations_status_check` | `CHECK (((status)::text = ANY ((ARRAY['borrador'::character varying, 'pendiente_disponibilidad'::character varying, 'confirmada'::character varying, 'pendiente_pago'::character varying, 'pendiente_proveedor'::character varying, 'reprogramada'::character varying, 'parcial'::character varying, 'incidencia'::character varying, 'en_operacion'::character varying, 'completada'::character varying, 'cancelada'::character varying])::text[])))` | `status`: `borrador`, `pendiente_disponibilidad`, `confirmada`, `pendiente_pago`, `pendiente_proveedor`, `reprogramada`, `parcial`, `incidencia`, `en_operacion`, `completada`, `cancelada` |
| `ck_booking_reservations_1` | `CHECK ((travel_to >= travel_from))` |  |
| `ck_booking_reservations_2` | `CHECK ((((status)::text <> 'cancelada'::text) OR (cancelled_at IS NOT NULL)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_booking_reservations_agency_id` | `USING btree (agency_id)` |
| `ix_booking_reservations_cancel_request_id` | `USING btree (cancel_request_id)` |
| `ix_booking_reservations_client_id` | `USING btree (client_id)` |
| `ix_booking_reservations_ecom_order_id` | `USING btree (ecom_order_id)` |
| `ix_booking_reservations_owner_id` | `USING btree (owner_id)` |
| `ix_booking_reservations_quote_id` | `USING btree (quote_id)` |
| `ix_booking_reservations_quote_version_id` | `USING btree (quote_version_id)` |
| `ix_booking_reservations_sede_id` | `USING btree (sede_id)` |
| `ix_booking_reservations_tenant_id_client_id` | `USING btree (tenant_id, client_id)` |
| `ix_booking_reservations_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_booking_reservations_tenant_id_owner_id` | `USING btree (tenant_id, owner_id)` |
| `ix_booking_reservations_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_booking_reservations_tenant_id_travel_from` | `USING btree (tenant_id, travel_from)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_booking_reservations_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_booking_reservations_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `booking_reservation_web_addons`

[Spec 04 §3 v2.1] [Fase 2] Adicionales elegidos en la reserva web.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reservas (booking_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_product_addons.tenant_id, booking_reservation_web_snapshots.tenant_id, tenants.id. |
| 3 | `snapshot_id` | `uuid` | no |  | FK → booking_reservation_web_snapshots.id. |
| 4 | `addon_id` | `uuid` | sí |  | FK → catalog_product_addons.id. |
| 5 | `name` | `character varying(150)` | no |  |  |
| 6 | `qty` | `smallint` | no | `1` |  |
| 7 | `amount` | `numeric(14,2)` | no |  |  |
| 8 | `by_type` | `jsonb` | sí |  |  |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 12 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, addon_id` | `catalog_product_addons.tenant_id, id` | NO ACTION | `fk_booking_reservation_web_addons_addon_id` |
| `tenant_id, snapshot_id` | `booking_reservation_web_snapshots.tenant_id, id` | CASCADE | `fk_booking_reservation_web_addons_snapshot_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_booking_reservation_web_addons_tenant_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_booking_reservation_web_addons_addon_id` | `USING btree (addon_id)` |
| `ix_booking_reservation_web_addons_snapshot_id` | `USING btree (snapshot_id)` |
| `ix_booking_reservation_web_addons_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_booking_reservation_web_addons_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `booking_reservation_web_lodging`

[Spec 04 §3 v2.1] [Fase 2] Alojamiento elegido en la reserva web.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reservas (booking_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_accommodation_hotels.tenant_id, booking_reservation_web_snapshots.tenant_id, tenants.id. |
| 3 | `snapshot_id` | `uuid` | no |  | FK → booking_reservation_web_snapshots.id. |
| 4 | `leg_id` | `character varying(20)` | sí |  |  |
| 5 | `city` | `character varying(80)` | no |  |  |
| 6 | `hotel_id` | `uuid` | sí |  | FK → catalog_accommodation_hotels.id. |
| 7 | `hotel_name` | `character varying(150)` | no |  |  |
| 8 | `room_type` | `character varying(30)` | no |  |  |
| 9 | `rooms` | `smallint` | no |  |  |
| 10 | `nights` | `smallint` | no |  |  |
| 11 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 12 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 13 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 14 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, hotel_id` | `catalog_accommodation_hotels.tenant_id, id` | NO ACTION | `fk_booking_reservation_web_lodging_hotel_id` |
| `tenant_id, snapshot_id` | `booking_reservation_web_snapshots.tenant_id, id` | CASCADE | `fk_booking_reservation_web_lodging_snapshot_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_booking_reservation_web_lodging_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `booking_reservation_web_lodging_nights_check` | `CHECK ((nights > 0))` |  |
| `booking_reservation_web_lodging_rooms_check` | `CHECK ((rooms > 0))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_booking_reservation_web_lodging_hotel_id` | `USING btree (hotel_id)` |
| `ix_booking_reservation_web_lodging_snapshot_id` | `USING btree (snapshot_id)` |
| `ix_booking_reservation_web_lodging_tenant_id_snapshot_id` | `USING btree (tenant_id, snapshot_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_booking_reservation_web_lodging_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `booking_reservation_web_snapshots`

[Spec 04 §3 v2.1] [Fase 2] Snapshot 1:1 de la reserva web (motor de reservas).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reservas (booking_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, booking_reservations.tenant_id, tenants.id. |
| 3 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 4 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 5 | `service_date` | `date` | no |  |  |
| 6 | `pax_adt` | `smallint` | no | `0` |  |
| 7 | `pax_chd` | `smallint` | no | `0` |  |
| 8 | `pax_inf` | `smallint` | no | `0` |  |
| 9 | `currency_display` | `character(3)` | no |  |  |
| 10 | `charge_currency` | `character(3)` | no |  |  |
| 11 | `fx_rate` | `numeric(12,6)` | no |  |  |
| 12 | `lines` | `jsonb` | no |  |  |
| 13 | `adjustments` | `jsonb` | no | `'[]'::jsonb` |  |
| 14 | `removed_lines` | `jsonb` | sí |  |  |
| 15 | `total` | `numeric(14,2)` | no |  |  |
| 16 | `total_display` | `numeric(14,2)` | sí |  |  |
| 17 | `rooms_total` | `smallint` | sí |  |  |
| 18 | `nights_total` | `smallint` | sí |  |  |
| 19 | `pickup_point` | `character varying(200)` | sí |  |  |
| 20 | `pickup_address` | `character varying(200)` | sí |  |  |
| 21 | `pickup_flight` | `character varying(40)` | sí |  |  |
| 22 | `pickup_arrival` | `timestamp with time zone` | sí |  |  |
| 23 | `comments` | `character varying(1000)` | sí |  |  |
| 24 | `payment_mode` | `character varying(20)` | no |  | Valores: `total`, `adelanto`, `pagar_despues`. |
| 25 | `deposit_pct` | `numeric(5,2)` | sí |  |  |
| 26 | `deposit` | `numeric(14,2)` | sí |  |  |
| 27 | `balance` | `numeric(14,2)` | sí |  |  |
| 28 | `balance_due` | `date` | sí |  |  |
| 29 | `companions_pending` | `boolean` | sí |  |  |
| 30 | `companions_due` | `date` | sí |  |  |
| 31 | `altitude_declaration` | `jsonb` | sí |  |  |
| 32 | `rules_applied` | `text[]` | no | `'{}'::text[]` |  |
| 33 | `source` | `character varying(30)` | sí |  |  |
| 34 | `order_code` | `character varying(30)` | sí |  |  |
| 35 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 36 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 37 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 38 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | NO ACTION | `fk_booking_reservation_web_snapshots_product_id` |
| `tenant_id, reservation_id` | `booking_reservations.tenant_id, id` | NO ACTION | `fk_booking_reservation_web_snapshots_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_booking_reservation_web_snapshots_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_booking_reservation_web_snapshots_id` | `tenant_id, id` |  | restricción |
| `uq_booking_reservation_web_snapshots_tenant_id_reservation_id` | `tenant_id, reservation_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `booking_reservation_web_snapshots_pax_adt_check` | `CHECK ((pax_adt >= 0))` |  |
| `booking_reservation_web_snapshots_pax_chd_check` | `CHECK ((pax_chd >= 0))` |  |
| `booking_reservation_web_snapshots_pax_inf_check` | `CHECK ((pax_inf >= 0))` |  |
| `booking_reservation_web_snapshots_payment_mode_check` | `CHECK (((payment_mode)::text = ANY ((ARRAY['total'::character varying, 'adelanto'::character varying, 'pagar_despues'::character varying])::text[])))` | `payment_mode`: `total`, `adelanto`, `pagar_despues` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_booking_reservation_web_snapshots_product_id` | `USING btree (product_id)` |
| `ix_booking_reservation_web_snapshots_reservation_id` | `USING btree (reservation_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_booking_reservation_web_snapshots_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `booking_corporate_approvals`

[Spec 20 §3.5] [Fase 3] Aprobación de la empresa cliente para una cotización o reserva que supera el umbral.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reservas (booking_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → crm_corporate_accounts.tenant_id, crm_corporate_portal_users.tenant_id, crm_corporate_cost_centers.tenant_id, quote_quotes.tenant_id, crm_corporate_portal_users.tenant_id, iam_users.tenant_id, booking_reservations.tenant_id, tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `account_id` | `uuid` | no |  | FK → crm_corporate_accounts.id. |
| 5 | `quote_id` | `uuid` | sí |  | FK → quote_quotes.id. |
| 6 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 7 | `cost_center_id` | `uuid` | no |  | FK → crm_corporate_cost_centers.id. |
| 8 | `amount` | `numeric(14,2)` | no |  |  |
| 9 | `currency` | `character(3)` | no |  |  |
| 10 | `requested_by_portal_user_id` | `uuid` | sí |  | FK → crm_corporate_portal_users.id. |
| 11 | `requested_by_user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 12 | `approver_portal_user_id` | `uuid` | sí |  | FK → crm_corporate_portal_users.id. |
| 13 | `status` | `character varying(10)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `aprobada`, `rechazada`, `vencida`, `cancelada`. |
| 14 | `reason` | `text` | sí |  |  |
| 15 | `expires_at` | `timestamp with time zone` | no |  |  |
| 16 | `decided_at` | `timestamp with time zone` | sí |  |  |
| 17 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 18 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 19 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, account_id` | `crm_corporate_accounts.tenant_id, id` | NO ACTION | `fk_booking_corporate_approvals_account_id` |
| `tenant_id, approver_portal_user_id` | `crm_corporate_portal_users.tenant_id, id` | NO ACTION | `fk_booking_corporate_approvals_approver_portal_user_id` |
| `tenant_id, cost_center_id` | `crm_corporate_cost_centers.tenant_id, id` | NO ACTION | `fk_booking_corporate_approvals_cost_center_id` |
| `tenant_id, quote_id` | `quote_quotes.tenant_id, id` | NO ACTION | `fk_booking_corporate_approvals_quote_id` |
| `tenant_id, requested_by_portal_user_id` | `crm_corporate_portal_users.tenant_id, id` | NO ACTION | `fk_booking_corporate_approvals_requested_by_portal_user_id` |
| `tenant_id, requested_by_user_id` | `iam_users.tenant_id, id` | NO ACTION | `fk_booking_corporate_approvals_requested_by_user_id` |
| `tenant_id, reservation_id` | `booking_reservations.tenant_id, id` | NO ACTION | `fk_booking_corporate_approvals_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_booking_corporate_approvals_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_booking_corporate_approvals_pending_quote` | `tenant_id, quote_id` | `(((status)::text = 'pendiente'::text) AND (quote_id IS NOT NULL))` | índice único |
| `uq_booking_corporate_approvals_pending_reservation` | `tenant_id, reservation_id` | `(((status)::text = 'pendiente'::text) AND (reservation_id IS NOT NULL))` | índice único |
| `uq_booking_corporate_approvals_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `booking_corporate_approvals_amount_check` | `CHECK ((amount >= (0)::numeric))` |  |
| `booking_corporate_approvals_currency_check` | `CHECK ((currency ~ '^[A-Z]{3}$'::text))` |  |
| `booking_corporate_approvals_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'vencida'::character varying, 'cancelada'::character varying])::text[])))` | `status`: `pendiente`, `aprobada`, `rechazada`, `vencida`, `cancelada` |
| `ck_booking_corporate_approvals_1` | `CHECK ((num_nonnulls(quote_id, reservation_id) = 1))` |  |
| `ck_booking_corporate_approvals_2` | `CHECK ((((status)::text <> ALL ((ARRAY['aprobada'::character varying, 'rechazada'::character varying])::text[])) OR ((decided_at IS NOT NULL) AND (approver_portal_user_id IS NOT NULL))))` |  |
| `ck_booking_corporate_approvals_3` | `CHECK ((((status)::text <> 'rechazada'::text) OR (COALESCE(btrim(reason), ''::text) <> ''::text)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_booking_corporate_approvals_account_id_status` | `USING btree (tenant_id, account_id, status, expires_at)` |
| `ix_booking_corporate_approvals_approver_portal_user_id` | `USING btree (approver_portal_user_id)` |
| `ix_booking_corporate_approvals_cost_center_id` | `USING btree (cost_center_id)` |
| `ix_booking_corporate_approvals_quote_id` | `USING btree (quote_id)` |
| `ix_booking_corporate_approvals_requested_by_portal_user_id` | `USING btree (requested_by_portal_user_id)` |
| `ix_booking_corporate_approvals_requested_by_user_id` | `USING btree (requested_by_user_id)` |
| `ix_booking_corporate_approvals_reservation_id` | `USING btree (reservation_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_booking_corporate_approvals_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_booking_corporate_approvals_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `booking_cost_allocations`

[Spec 20 §3.6] [Fase 3] Reparto del importe de una reserva corporativa por centro de costo y viajero.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reservas (booking_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → crm_corporate_accounts.tenant_id, crm_corporate_cost_centers.tenant_id, iam_users.tenant_id, booking_reservations.tenant_id, tenants.id, crm_corporate_travelers.tenant_id. |
| 3 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 4 | `account_id` | `uuid` | no |  | FK → crm_corporate_accounts.id. |
| 5 | `cost_center_id` | `uuid` | no |  | FK → crm_corporate_cost_centers.id. |
| 6 | `traveler_id` | `uuid` | sí |  | FK → crm_corporate_travelers.id. |
| 7 | `pct` | `numeric(5,2)` | no |  |  |
| 8 | `amount` | `numeric(14,2)` | no |  |  |
| 9 | `currency` | `character(3)` | no |  |  |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). FK → iam_users.id. |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 12 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, account_id` | `crm_corporate_accounts.tenant_id, id` | NO ACTION | `fk_booking_cost_allocations_account_id` |
| `tenant_id, cost_center_id` | `crm_corporate_cost_centers.tenant_id, id` | NO ACTION | `fk_booking_cost_allocations_cost_center_id` |
| `tenant_id, created_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_booking_cost_allocations_created_by` |
| `tenant_id, reservation_id` | `booking_reservations.tenant_id, id` | CASCADE | `fk_booking_cost_allocations_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_booking_cost_allocations_tenant_id` |
| `tenant_id, traveler_id` | `crm_corporate_travelers.tenant_id, id` | NO ACTION | `fk_booking_cost_allocations_traveler_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_booking_cost_allocations_res_cc_traveler` | `tenant_id, reservation_id, cost_center_id, COALESCE(traveler_id, '00000000-0000-0000-0000-000000000000'::uuid)` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `booking_cost_allocations_amount_check` | `CHECK ((amount >= (0)::numeric))` |  |
| `booking_cost_allocations_currency_check` | `CHECK ((currency ~ '^[A-Z]{3}$'::text))` |  |
| `booking_cost_allocations_pct_check` | `CHECK (((pct > (0)::numeric) AND (pct <= (100)::numeric)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_booking_cost_allocations_account_id` | `USING btree (account_id)` |
| `ix_booking_cost_allocations_cost_center_id` | `USING btree (cost_center_id)` |
| `ix_booking_cost_allocations_created_by` | `USING btree (created_by)` |
| `ix_booking_cost_allocations_reservation_id` | `USING btree (reservation_id)` |
| `ix_booking_cost_allocations_traveler_id` | `USING btree (traveler_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_booking_cost_allocations_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `booking_in_trip_offers`

[Spec 21 §3.6] [Fase 3] Venta en ruta: oferta de un tour o movilidad de un tramo pendiente, con link de pago y vencimiento.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reservas (booking_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, catalog_leg_tours.tenant_id, fin_payment_links.tenant_id, booking_reservations.tenant_id, tenants.id, catalog_transport_options.tenant_id, booking_trip_items.tenant_id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 5 | `kind` | `character varying(10)` | no |  | Valores: `tour`, `transporte`. |
| 6 | `leg_tour_id` | `uuid` | sí |  | FK → catalog_leg_tours.id. |
| 7 | `transport_option_id` | `uuid` | sí |  | FK → catalog_transport_options.id. |
| 8 | `service_date` | `date` | no |  |  |
| 9 | `currency` | `character(3)` | no |  |  |
| 10 | `amount` | `numeric(14,2)` | no |  |  |
| 11 | `status` | `character varying(14)` | no | `'ofrecida'::character varying` | Valores: `ofrecida`, `link_enviado`, `pagada`, `confirmada`, `vencida`, `cancelada`, `reembolsada`. |
| 12 | `payment_link_id` | `uuid` | sí |  | FK → fin_payment_links.id. |
| 13 | `trip_item_id` | `uuid` | sí |  | FK → booking_trip_items.id. |
| 14 | `expires_at` | `timestamp with time zone` | no |  |  |
| 15 | `channel` | `character varying(12)` | no | `'portal'::character varying` | Valores: `portal`, `whatsapp`, `email`, `app`, `asesor`. |
| 16 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). FK → iam_users.id. |
| 17 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 18 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, created_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_booking_in_trip_offers_created_by` |
| `tenant_id, leg_tour_id` | `catalog_leg_tours.tenant_id, id` | NO ACTION | `fk_booking_in_trip_offers_leg_tour_id` |
| `tenant_id, payment_link_id` | `fin_payment_links.tenant_id, id` | NO ACTION | `fk_booking_in_trip_offers_payment_link_id` |
| `tenant_id, reservation_id` | `booking_reservations.tenant_id, id` | NO ACTION | `fk_booking_in_trip_offers_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_booking_in_trip_offers_tenant_id` |
| `tenant_id, transport_option_id` | `catalog_transport_options.tenant_id, id` | NO ACTION | `fk_booking_in_trip_offers_transport_option_id` |
| `tenant_id, trip_item_id` | `booking_trip_items.tenant_id, id` | NO ACTION | `fk_booking_in_trip_offers_trip_item_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_booking_in_trip_offers_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `booking_in_trip_offers_amount_check` | `CHECK ((amount > (0)::numeric))` |  |
| `booking_in_trip_offers_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['portal'::character varying, 'whatsapp'::character varying, 'email'::character varying, 'app'::character varying, 'asesor'::character varying])::text[])))` | `channel`: `portal`, `whatsapp`, `email`, `app`, `asesor` |
| `booking_in_trip_offers_currency_check` | `CHECK ((currency ~ '^[A-Z]{3}$'::text))` |  |
| `booking_in_trip_offers_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['tour'::character varying, 'transporte'::character varying])::text[])))` | `kind`: `tour`, `transporte` |
| `booking_in_trip_offers_status_check` | `CHECK (((status)::text = ANY ((ARRAY['ofrecida'::character varying, 'link_enviado'::character varying, 'pagada'::character varying, 'confirmada'::character varying, 'vencida'::character varying, 'cancelada'::character varying, 'reembolsada'::character varying])::text[])))` | `status`: `ofrecida`, `link_enviado`, `pagada`, `confirmada`, `vencida`, `cancelada`, `reembolsada` |
| `ck_booking_in_trip_offers_1` | `CHECK (((((kind)::text = 'tour'::text) = (leg_tour_id IS NOT NULL)) AND (((kind)::text = 'transporte'::text) = (transport_option_id IS NOT NULL))))` |  |
| `ck_booking_in_trip_offers_2` | `CHECK ((((status)::text <> ALL ((ARRAY['pagada'::character varying, 'confirmada'::character varying])::text[])) OR (payment_link_id IS NOT NULL)))` |  |
| `ck_booking_in_trip_offers_3` | `CHECK ((((status)::text <> 'confirmada'::text) OR (trip_item_id IS NOT NULL)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_booking_in_trip_offers_created_by` | `USING btree (created_by)` |
| `ix_booking_in_trip_offers_expires` | `USING btree (tenant_id, expires_at) WHERE ((status)::text = ANY ((ARRAY['ofrecida'::character varying, 'link_enviado'::character varying])::text[]))` |
| `ix_booking_in_trip_offers_leg_tour_id` | `USING btree (leg_tour_id)` |
| `ix_booking_in_trip_offers_payment_link_id` | `USING btree (payment_link_id)` |
| `ix_booking_in_trip_offers_reservation_id` | `USING btree (reservation_id, status)` |
| `ix_booking_in_trip_offers_transport_option_id` | `USING btree (transport_option_id)` |
| `ix_booking_in_trip_offers_trip_item_id` | `USING btree (trip_item_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_booking_in_trip_offers_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `booking_trip_items`

[Spec 21 §3.5] [Fase 3] Tours y movilidad del viaje armado, con importe confirmado por el servidor y servicio generado.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reservas (booking_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, catalog_leg_tours.tenant_id, booking_reservations.tenant_id, booking_reservation_services.tenant_id, tenants.id, catalog_transport_options.tenant_id, booking_trip_legs.tenant_id, catalog_transport_vehicles.tenant_id. |
| 3 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 4 | `trip_leg_id` | `uuid` | sí |  | FK → booking_trip_legs.id. |
| 5 | `kind` | `character varying(10)` | no |  | Valores: `tour`, `transporte`. |
| 6 | `leg_tour_id` | `uuid` | sí |  | FK → catalog_leg_tours.id. |
| 7 | `transport_option_id` | `uuid` | sí |  | FK → catalog_transport_options.id. |
| 8 | `vehicle_id` | `uuid` | sí |  | FK → catalog_transport_vehicles.id. |
| 9 | `vehicle_units` | `smallint` | sí |  |  |
| 10 | `service_date` | `date` | no |  |  |
| 11 | `start_time` | `time without time zone` | sí |  |  |
| 12 | `adults` | `smallint` | no | `0` |  |
| 13 | `children` | `smallint` | no | `0` |  |
| 14 | `currency` | `character(3)` | no |  |  |
| 15 | `amount` | `numeric(14,2)` | no |  |  |
| 16 | `reservation_service_id` | `uuid` | sí |  | FK → booking_reservation_services.id. |
| 17 | `sold_in_trip` | `boolean` | no | `false` |  |
| 18 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). FK → iam_users.id. |
| 19 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 20 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, created_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_booking_trip_items_created_by` |
| `tenant_id, leg_tour_id` | `catalog_leg_tours.tenant_id, id` | NO ACTION | `fk_booking_trip_items_leg_tour_id` |
| `tenant_id, reservation_id` | `booking_reservations.tenant_id, id` | CASCADE | `fk_booking_trip_items_reservation_id` |
| `tenant_id, reservation_service_id` | `booking_reservation_services.tenant_id, id` | NO ACTION | `fk_booking_trip_items_reservation_service_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_booking_trip_items_tenant_id` |
| `tenant_id, transport_option_id` | `catalog_transport_options.tenant_id, id` | NO ACTION | `fk_booking_trip_items_transport_option_id` |
| `tenant_id, trip_leg_id` | `booking_trip_legs.tenant_id, id` | NO ACTION | `fk_booking_trip_items_trip_leg_id` |
| `tenant_id, vehicle_id` | `catalog_transport_vehicles.tenant_id, id` | NO ACTION | `fk_booking_trip_items_vehicle_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_booking_trip_items_id` | `tenant_id, id` |  | restricción |
| `uq_booking_trip_items_res_tour_date` | `tenant_id, reservation_id, leg_tour_id, service_date` | `(leg_tour_id IS NOT NULL)` | índice único |
| `uq_booking_trip_items_res_transport` | `tenant_id, reservation_id, transport_option_id` | `(transport_option_id IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `booking_trip_items_adults_check` | `CHECK ((adults >= 0))` |  |
| `booking_trip_items_amount_check` | `CHECK ((amount >= (0)::numeric))` |  |
| `booking_trip_items_children_check` | `CHECK ((children >= 0))` |  |
| `booking_trip_items_currency_check` | `CHECK ((currency ~ '^[A-Z]{3}$'::text))` |  |
| `booking_trip_items_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['tour'::character varying, 'transporte'::character varying])::text[])))` | `kind`: `tour`, `transporte` |
| `booking_trip_items_vehicle_units_check` | `CHECK (((vehicle_units IS NULL) OR ((vehicle_units >= 1) AND (vehicle_units <= 20))))` |  |
| `ck_booking_trip_items_1` | `CHECK (((((kind)::text = 'tour'::text) AND (leg_tour_id IS NOT NULL) AND (transport_option_id IS NULL)) OR (((kind)::text = 'transporte'::text) AND (transport_option_id IS NOT NULL) AND (leg_tour_id IS NULL))))` |  |
| `ck_booking_trip_items_2` | `CHECK (((vehicle_id IS NULL) = (vehicle_units IS NULL)))` |  |
| `ck_booking_trip_items_3` | `CHECK (((adults + children) > 0))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_booking_trip_items_created_by` | `USING btree (created_by)` |
| `ix_booking_trip_items_leg_tour_id` | `USING btree (leg_tour_id)` |
| `ix_booking_trip_items_reservation_id` | `USING btree (reservation_id, service_date)` |
| `ix_booking_trip_items_reservation_service_id` | `USING btree (reservation_service_id)` |
| `ix_booking_trip_items_transport_option_id` | `USING btree (transport_option_id)` |
| `ix_booking_trip_items_trip_leg_id` | `USING btree (trip_leg_id)` |
| `ix_booking_trip_items_vehicle_id` | `USING btree (vehicle_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_booking_trip_items_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `booking_trip_legs`

[Spec 21 §3.4] [Fase 3] Tramos del viaje armado en la reserva: noches elegidas y fechas de entrada y salida por ciudad.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Reservas (booking_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_accommodation_legs.tenant_id, booking_reservations.tenant_id, tenants.id. |
| 3 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 4 | `leg_id` | `uuid` | no |  | FK → catalog_accommodation_legs.id. |
| 5 | `sequence` | `smallint` | no |  |  |
| 6 | `city` | `character varying(80)` | no |  |  |
| 7 | `nights` | `smallint` | no |  |  |
| 8 | `check_in` | `date` | no |  |  |
| 9 | `check_out` | `date` | no |  |  |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, leg_id` | `catalog_accommodation_legs.tenant_id, id` | NO ACTION | `fk_booking_trip_legs_leg_id` |
| `tenant_id, reservation_id` | `booking_reservations.tenant_id, id` | CASCADE | `fk_booking_trip_legs_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_booking_trip_legs_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_booking_trip_legs_id` | `tenant_id, id` |  | restricción |
| `uq_booking_trip_legs_reservation_id_sequence` | `tenant_id, reservation_id, sequence` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `booking_trip_legs_nights_check` | `CHECK (((nights >= 1) AND (nights <= 30)))` |  |
| `booking_trip_legs_sequence_check` | `CHECK ((sequence >= 1))` |  |
| `ck_booking_trip_legs_1` | `CHECK ((check_out = (check_in + (nights)::integer)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_booking_trip_legs_leg_id` | `USING btree (leg_id)` |
| `ix_booking_trip_legs_reservation_id` | `USING btree (reservation_id)` |

[↑ Índice del dominio](#tablas)
