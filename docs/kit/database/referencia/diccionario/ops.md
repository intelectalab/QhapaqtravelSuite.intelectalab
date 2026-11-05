# Diccionario de datos · Operaciones (ops_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.13 tras cargar `00`→`90`. No editar a mano._

Órdenes operativas, asignaciones, recursos, rooming, vouchers, incidencias, móvil y documentos de viaje.

23 tablas · 374 columnas · 98 claves foráneas. Diagrama ER: [`../er/ops.svg`](../er/ops.svg) (fuente [`../er/ops.mmd`](../er/ops.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`ops_assignment_checkins`](#ops_assignment_checkins) | Fase 1 · MVP | tenant | 14 | 5 | [Spec 05 §3.6] [Fase 1] Check-in por pasajero y servicio (idempotente). |
| [`ops_assignments`](#ops_assignments) | Fase 1 · MVP | tenant | 22 | 6 | [Spec 05 §3.5] [Fase 1] Asignación de guía/conductor/vehículo por servicio. |
| [`ops_drivers`](#ops_drivers) | Fase 1 · MVP | tenant | 17 | 3 | [Spec 05 §3.7] [Fase 1] Conductores (recurso operativo). |
| [`ops_evidences`](#ops_evidences) | Fase 1 · MVP | tenant | 22 | 6 | [Spec 05 §3.12] [Fase 1] Evidencias (fotos/PDF) de operación e incidencias (PROC-038). |
| [`ops_guides`](#ops_guides) | Fase 1 · MVP | tenant | 16 | 3 | [Spec 05 §3.7] [Fase 1] Guías (recurso operativo). |
| [`ops_incident_logs`](#ops_incident_logs) | Fase 1 · MVP | tenant | 9 | 3 | [Spec 05 §3.11 + 06 §3] [Fase 1] Bitácora append-only de la incidencia. |
| [`ops_incidents`](#ops_incidents) | Fase 1 · MVP | tenant | 31 | 10 | [Spec 05 §3.11] [Fase 1] Incidencias operativas (SLA por severidad). |
| [`ops_order_tasks`](#ops_order_tasks) | Fase 1 · MVP | tenant | 13 | 3 | [Spec 05 §3.2] [Fase 1] Checklist de la orden operativa. |
| [`ops_orders`](#ops_orders) | Fase 1 · MVP | tenant | 19 | 4 | [Spec 05 §3.1] [Fase 1] Orden operativa (una por reserva). |
| [`ops_rooming_guests`](#ops_rooming_guests) | Fase 1 · MVP | tenant | 10 | 4 | [Spec 05 §3.9] [Fase 1] Huéspedes por habitación. |
| [`ops_rooming_lists`](#ops_rooming_lists) | Fase 1 · MVP | tenant | 26 | 7 | [Spec 05 §3.8 + §3.14b] [Fase 1] Rooming list por reserva y hotel/ciudad. |
| [`ops_rooming_rooms`](#ops_rooming_rooms) | Fase 1 · MVP | tenant | 15 | 4 | [Spec 05 §3.9] [Fase 1] Habitaciones de la rooming list. |
| [`ops_supplier_requests`](#ops_supplier_requests) | Fase 1 · MVP | tenant | 19 | 5 | [Spec 05 §3.4] [Fase 1] Solicitudes enviadas a proveedores por servicio (PROC-032). |
| [`ops_vehicles`](#ops_vehicles) | Fase 1 · MVP | tenant | 13 | 2 | [Spec 05 §3.7] [Fase 1] Vehículos. |
| [`ops_voucher_versions`](#ops_voucher_versions) | Fase 1 · MVP | tenant | 11 | 4 | [Spec 05 §3.10] [Fase 1] Historial de versiones del voucher. |
| [`ops_vouchers`](#ops_vouchers) | Fase 1 · MVP | tenant | 28 | 8 | [Spec 05 §3.10] [Fase 1] Vouchers de servicio (versionados, QR firmado). |
| [`ops_incident_pax_acks`](#ops_incident_pax_acks) | Fase 2 · Canales y campo | tenant | 5 | 3 | [Spec 08 §3.14] [Fase 2] Confirmación de lectura de alertas por el pasajero. |
| [`ops_mobile_devices`](#ops_mobile_devices) | Fase 2 · Canales y campo | tenant | 15 | 2 | [Spec 05 §3.13] [Fase 2] Dispositivos de las apps operador/pasajero (id generado en el dispositivo). |
| [`ops_sync_actions`](#ops_sync_actions) | Fase 2 · Canales y campo | tenant | 18 | 4 | [Spec 05 §3.13] [Fase 2] Acciones recibidas del outbox móvil (base de idempotencia; id = client_action_id). |
| [`ops_travel_doc_contacts`](#ops_travel_doc_contacts) | Fase 2 · Canales y campo | tenant | 10 | 2 | [Spec 11 §3.8] [Fase 2] Contacto de emergencia por pasajero. |
| [`ops_travel_doc_items`](#ops_travel_doc_items) | Fase 2 · Canales y campo | tenant | 20 | 5 | [Spec 11 §3.7] [Fase 2] Checklist documental por pasajero. |
| [`ops_travel_doc_reminders`](#ops_travel_doc_reminders) | Fase 2 · Canales y campo | tenant | 12 | 3 | [Spec 11 §3.9] [Fase 2] Recordatorios documentales enviados. |
| [`ops_travel_doc_special`](#ops_travel_doc_special) | Fase 2 · Canales y campo | tenant | 9 | 2 | [Spec 11 §3.8] [Fase 2] Atención especial (sin datos clínicos; acceso restringido). |

## Detalle por tabla

### `ops_assignment_checkins`

[Spec 05 §3.6] [Fase 1] Check-in por pasajero y servicio (idempotente).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `assignment_id` | `uuid` | no |  | FK → ops_assignments.id. |
| 4 | `passenger_id` | `uuid` | no |  | FK → booking_passengers.id. |
| 5 | `checked_at` | `timestamp with time zone` | no |  |  |
| 6 | `source` | `character varying(10)` | no |  | Valores: `app`, `web`. |
| 7 | `client_action_id` | `uuid` | sí |  |  |
| 8 | `device_id` | `uuid` | sí |  | FK → ops_mobile_devices.id. |
| 9 | `undone_at` | `timestamp with time zone` | sí |  |  |
| 10 | `undone_by` | `uuid` | sí |  | FK → iam_users.id. |
| 11 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 12 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 13 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 14 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `assignment_id` | `ops_assignments.id` | NO ACTION | `fk_ops_assignment_checkins_assignment_id` |
| `device_id` | `ops_mobile_devices.id` | NO ACTION | `fk_ops_assignment_checkins_device_id` |
| `passenger_id` | `booking_passengers.id` | NO ACTION | `fk_ops_assignment_checkins_passenger_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_assignment_checkins_tenant_id` |
| `undone_by` | `iam_users.id` | NO ACTION | `fk_ops_assignment_checkins_undone_by` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_assignment_checkins_assignment_id_passenger_id_p` | `assignment_id, passenger_id` | `(undone_at IS NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ops_assignment_checkins_source_check` | `CHECK (((source)::text = ANY ((ARRAY['app'::character varying, 'web'::character varying])::text[])))` | `source`: `app`, `web` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_assignment_checkins_assignment_id` | `USING btree (assignment_id)` |
| `ix_ops_assignment_checkins_device_id` | `USING btree (device_id)` |
| `ix_ops_assignment_checkins_passenger_id` | `USING btree (passenger_id)` |
| `ix_ops_assignment_checkins_tenant_id` | `USING btree (tenant_id)` |
| `ix_ops_assignment_checkins_undone_by` | `USING btree (undone_by)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_assignment_checkins_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `ops_assignments`

[Spec 05 §3.5] [Fase 1] Asignación de guía/conductor/vehículo por servicio.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `order_id` | `uuid` | no |  | FK → ops_orders.id. |
| 4 | `reservation_service_id` | `uuid` | no |  | FK → booking_reservation_services.id. |
| 5 | `service_date` | `date` | no |  |  |
| 6 | `service_time` | `time without time zone` | sí |  |  |
| 7 | `service_label` | `character varying(200)` | no |  |  |
| 8 | `guide_id` | `uuid` | sí |  | FK → ops_guides.id. |
| 9 | `driver_id` | `uuid` | sí |  | FK → ops_drivers.id. |
| 10 | `vehicle_id` | `uuid` | sí |  | FK → ops_vehicles.id. |
| 11 | `status` | `character varying(30)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `asignada`, `confirmada`, `en_curso`, `completada`. |
| 12 | `confirmed_at` | `timestamp with time zone` | sí |  |  |
| 13 | `confirmed_via` | `character varying(10)` | sí |  | Valores: `web`, `app`. |
| 14 | `started_at` | `timestamp with time zone` | sí |  |  |
| 15 | `first_checkin_at` | `timestamp with time zone` | sí |  |  |
| 16 | `finished_at` | `timestamp with time zone` | sí |  |  |
| 17 | `warnings_ack` | `jsonb` | sí |  |  |
| 18 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 19 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 20 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 21 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 22 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `driver_id` | `ops_drivers.id` | NO ACTION | `fk_ops_assignments_driver_id` |
| `guide_id` | `ops_guides.id` | NO ACTION | `fk_ops_assignments_guide_id` |
| `order_id` | `ops_orders.id` | NO ACTION | `fk_ops_assignments_order_id` |
| `reservation_service_id` | `booking_reservation_services.id` | NO ACTION | `fk_ops_assignments_reservation_service_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_assignments_tenant_id` |
| `vehicle_id` | `ops_vehicles.id` | NO ACTION | `fk_ops_assignments_vehicle_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_assignments_tenant_id_order_id_reservation_service_id` | `tenant_id, order_id, reservation_service_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_ops_assignments_1` | `CHECK ((((status)::text = 'pendiente'::text) OR (guide_id IS NOT NULL) OR (driver_id IS NOT NULL) OR (vehicle_id IS NOT NULL)))` |  |
| `ops_assignments_confirmed_via_check` | `CHECK (((confirmed_via IS NULL) OR ((confirmed_via)::text = ANY ((ARRAY['web'::character varying, 'app'::character varying])::text[]))))` | `confirmed_via`: `web`, `app` |
| `ops_assignments_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'asignada'::character varying, 'confirmada'::character varying, 'en_curso'::character varying, 'completada'::character varying])::text[])))` | `status`: `pendiente`, `asignada`, `confirmada`, `en_curso`, `completada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_assignments_driver_id` | `USING btree (driver_id)` |
| `ix_ops_assignments_guide_id` | `USING btree (guide_id)` |
| `ix_ops_assignments_order_id` | `USING btree (order_id)` |
| `ix_ops_assignments_reservation_service_id` | `USING btree (reservation_service_id)` |
| `ix_ops_assignments_tenant_id_driver_id_service_date` | `USING btree (tenant_id, driver_id, service_date)` |
| `ix_ops_assignments_tenant_id_guide_id_service_date` | `USING btree (tenant_id, guide_id, service_date)` |
| `ix_ops_assignments_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_ops_assignments_tenant_id_vehicle_id_service_date` | `USING btree (tenant_id, vehicle_id, service_date)` |
| `ix_ops_assignments_vehicle_id` | `USING btree (vehicle_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_assignments_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_ops_assignments_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `ops_drivers`

[Spec 05 §3.7] [Fase 1] Conductores (recurso operativo).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 5 | `provider_id` | `uuid` | sí |  | FK → catalog_providers.id. |
| 6 | `full_name` | `character varying(150)` | no |  |  |
| 7 | `license_number` | `character varying(40)` | no |  |  |
| 8 | `license_class` | `character varying(10)` | sí |  |  |
| 9 | `license_expires_on` | `date` | no |  |  |
| 10 | `rating` | `numeric(2,1)` | sí |  |  |
| 11 | `status` | `character varying(20)` | no | `'disponible'::character varying` | Valores: `disponible`, `asignado`, `descanso`, `vacaciones`. |
| 12 | `phone` | `character varying(30)` | sí |  |  |
| 13 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 14 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 15 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 16 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 17 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `provider_id` | `catalog_providers.id` | NO ACTION | `fk_ops_drivers_provider_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_drivers_tenant_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_ops_drivers_user_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_drivers_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_ops_drivers_tenant_id_user_id_p` | `tenant_id, user_id` | `(user_id IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ops_drivers_rating_check` | `CHECK (((rating >= (0)::numeric) AND (rating <= (5)::numeric)))` |  |
| `ops_drivers_status_check` | `CHECK (((status)::text = ANY ((ARRAY['disponible'::character varying, 'asignado'::character varying, 'descanso'::character varying, 'vacaciones'::character varying])::text[])))` | `status`: `disponible`, `asignado`, `descanso`, `vacaciones` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_drivers_provider_id` | `USING btree (provider_id)` |
| `ix_ops_drivers_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_ops_drivers_tenant_id_license_expires_on` | `USING btree (tenant_id, license_expires_on)` |
| `ix_ops_drivers_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_ops_drivers_user_id` | `USING btree (user_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_drivers_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `ops_evidences`

[Spec 05 §3.12] [Fase 1] Evidencias (fotos/PDF) de operación e incidencias (PROC-038).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `order_id` | `uuid` | sí |  | FK → ops_orders.id. |
| 4 | `reservation_service_id` | `uuid` | sí |  | FK → booking_reservation_services.id. |
| 5 | `incident_id` | `uuid` | sí |  | FK → ops_incidents.id. |
| 6 | `file_name` | `character varying(200)` | no |  |  |
| 7 | `storage_path` | `character varying(400)` | no |  |  |
| 8 | `mime_type` | `character varying(80)` | no |  |  |
| 9 | `size_bytes` | `integer` | no |  |  |
| 10 | `sha256` | `character(64)` | no |  |  |
| 11 | `source` | `character varying(20)` | no | `'web'::character varying` | Valores: `web`, `app_operador`, `extranet`. |
| 12 | `captured_at` | `timestamp with time zone` | no |  |  |
| 13 | `captured_offline` | `boolean` | no | `false` |  |
| 14 | `uploaded_by` | `uuid` | no |  | FK → iam_users.id. |
| 15 | `client_action_id` | `uuid` | sí |  |  |
| 16 | `removed_at` | `timestamp with time zone` | sí |  |  |
| 17 | `removed_by` | `uuid` | sí |  | FK → iam_users.id. |
| 18 | `removed_reason` | `text` | sí |  |  |
| 19 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 20 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 21 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 22 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `incident_id` | `ops_incidents.id` | NO ACTION | `fk_ops_evidences_incident_id` |
| `order_id` | `ops_orders.id` | NO ACTION | `fk_ops_evidences_order_id` |
| `removed_by` | `iam_users.id` | NO ACTION | `fk_ops_evidences_removed_by` |
| `reservation_service_id` | `booking_reservation_services.id` | NO ACTION | `fk_ops_evidences_reservation_service_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_evidences_tenant_id` |
| `uploaded_by` | `iam_users.id` | NO ACTION | `fk_ops_evidences_uploaded_by` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_evidences_tenant_id_order_id_sha256_p` | `tenant_id, order_id, sha256` | `(removed_at IS NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_ops_evidences_1` | `CHECK (((order_id IS NOT NULL) OR (incident_id IS NOT NULL)))` |  |
| `ck_ops_evidences_2` | `CHECK (((removed_at IS NULL) OR (removed_reason IS NOT NULL)))` |  |
| `ops_evidences_mime_type_check` | `CHECK ((((mime_type)::text ~~ 'image/%'::text) OR ((mime_type)::text = 'application/pdf'::text)))` |  |
| `ops_evidences_source_check` | `CHECK (((source)::text = ANY ((ARRAY['web'::character varying, 'app_operador'::character varying, 'extranet'::character varying])::text[])))` | `source`: `web`, `app_operador`, `extranet` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_evidences_incident_id` | `USING btree (incident_id)` |
| `ix_ops_evidences_order_id` | `USING btree (order_id)` |
| `ix_ops_evidences_removed_by` | `USING btree (removed_by)` |
| `ix_ops_evidences_reservation_service_id` | `USING btree (reservation_service_id)` |
| `ix_ops_evidences_tenant_id` | `USING btree (tenant_id)` |
| `ix_ops_evidences_uploaded_by` | `USING btree (uploaded_by)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_evidences_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `ops_guides`

[Spec 05 §3.7] [Fase 1] Guías (recurso operativo).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 5 | `provider_id` | `uuid` | sí |  | FK → catalog_providers.id. |
| 6 | `full_name` | `character varying(150)` | no |  |  |
| 7 | `languages` | `character(2)[]` | no | `'{}'::bpchar[]` |  |
| 8 | `license_number` | `character varying(40)` | no |  |  |
| 9 | `rating` | `numeric(2,1)` | sí |  |  |
| 10 | `status` | `character varying(20)` | no | `'disponible'::character varying` | Valores: `disponible`, `asignado`, `descanso`, `vacaciones`. |
| 11 | `phone` | `character varying(30)` | sí |  |  |
| 12 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 13 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 15 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 16 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `provider_id` | `catalog_providers.id` | NO ACTION | `fk_ops_guides_provider_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_guides_tenant_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_ops_guides_user_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_guides_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_ops_guides_tenant_id_user_id_p` | `tenant_id, user_id` | `(user_id IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ops_guides_rating_check` | `CHECK (((rating >= (0)::numeric) AND (rating <= (5)::numeric)))` |  |
| `ops_guides_status_check` | `CHECK (((status)::text = ANY ((ARRAY['disponible'::character varying, 'asignado'::character varying, 'descanso'::character varying, 'vacaciones'::character varying])::text[])))` | `status`: `disponible`, `asignado`, `descanso`, `vacaciones` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_guides_languages` | `USING gin (languages)` |
| `ix_ops_guides_provider_id` | `USING btree (provider_id)` |
| `ix_ops_guides_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_ops_guides_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_ops_guides_user_id` | `USING btree (user_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_guides_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `ops_incident_logs`

[Spec 05 §3.11 + 06 §3] [Fase 1] Bitácora append-only de la incidencia.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `incident_id` | `uuid` | no |  | FK → ops_incidents.id. |
| 4 | `user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 5 | `kind` | `character varying(20)` | no |  | Valores: `registro`, `comentario`, `estado`, `asignacion`, `reclasificacion`, `alerta`, `evidencia`, `resolucion`. |
| 6 | `message` | `text` | no |  |  |
| 7 | `visibility` | `character varying(10)` | no | `'proveedor'::character varying` | Valores: `interna`, `proveedor`. |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `incident_id` | `ops_incidents.id` | NO ACTION | `fk_ops_incident_logs_incident_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_incident_logs_tenant_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_ops_incident_logs_user_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ops_incident_logs_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['registro'::character varying, 'comentario'::character varying, 'estado'::character varying, 'asignacion'::character varying, 'reclasificacion'::character varying, 'alerta'::character varying, 'evidencia'::character varying, 'resolucion'::character varying])::text[])))` | `kind`: `registro`, `comentario`, `estado`, `asignacion`, `reclasificacion`, `alerta`, `evidencia`, `resolucion` |
| `ops_incident_logs_visibility_check` | `CHECK (((visibility)::text = ANY ((ARRAY['interna'::character varying, 'proveedor'::character varying])::text[])))` | `visibility`: `interna`, `proveedor` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_incident_logs_incident_id` | `USING btree (incident_id)` |
| `ix_ops_incident_logs_tenant_id` | `USING btree (tenant_id)` |
| `ix_ops_incident_logs_user_id` | `USING btree (user_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_incident_logs_append_only` | BEFORE DELETE OR UPDATE | `app_forbid_update_delete` |

[↑ Índice del dominio](#tablas)

### `ops_incidents`

[Spec 05 §3.11] [Fase 1] Incidencias operativas (SLA por severidad).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `order_id` | `uuid` | sí |  | FK → ops_orders.id. |
| 5 | `reservation_id` | `uuid` | sí |  | FK → booking_reservations.id. |
| 6 | `reservation_service_id` | `uuid` | sí |  | FK → booking_reservation_services.id. |
| 7 | `provider_id` | `uuid` | sí |  | FK → catalog_providers.id. |
| 8 | `type` | `character varying(30)` | no |  | Valores: `Transporte`, `Proveedor`, `Salud del pasajero`, `Horario`, `Clima`, `Documentación`, `Equipaje`, `Seguridad`, `Capacidad`, `Pasajero`, `Otro`. |
| 9 | `severity` | `character varying(10)` | no |  | Valores: `baja`, `media`, `alta`, `critica`. |
| 10 | `title` | `character varying(200)` | no |  |  |
| 11 | `description` | `text` | no |  |  |
| 12 | `status` | `character varying(20)` | no | `'abierta'::character varying` | Valores: `abierta`, `en_proceso`, `resuelta`, `cerrada`. |
| 13 | `assignee_id` | `uuid` | sí |  | FK → iam_users.id. |
| 14 | `reported_by` | `uuid` | no |  | FK → iam_users.id. |
| 15 | `source` | `character varying(20)` | no | `'web'::character varying` | Valores: `web`, `app_operador`, `extranet`, `sistema`. |
| 16 | `sla_hours` | `smallint` | no |  |  |
| 17 | `sla_due_at` | `timestamp with time zone` | no |  |  |
| 18 | `resolution` | `text` | sí |  |  |
| 19 | `resolved_at` | `timestamp with time zone` | sí |  |  |
| 20 | `resolved_by` | `uuid` | sí |  | FK → iam_users.id. |
| 21 | `closed_at` | `timestamp with time zone` | sí |  |  |
| 22 | `closed_by` | `uuid` | sí |  | FK → iam_users.id. |
| 23 | `related_incident_id` | `uuid` | sí |  | FK → ops_incidents.id. |
| 24 | `client_action_id` | `uuid` | sí |  |  |
| 25 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 26 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 27 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 28 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 29 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 30 | `public_title` | `character varying(200)` | sí |  | Columnas agregadas en Fase 2 por spec 08 §3.15 [Agregada en `30_fase2.sql`] |
| 31 | `public_message` | `text` | sí |  | Columnas agregadas en Fase 2 por spec 08 §3.15 [Agregada en `30_fase2.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `assignee_id` | `iam_users.id` | NO ACTION | `fk_ops_incidents_assignee_id` |
| `closed_by` | `iam_users.id` | NO ACTION | `fk_ops_incidents_closed_by` |
| `order_id` | `ops_orders.id` | NO ACTION | `fk_ops_incidents_order_id` |
| `provider_id` | `catalog_providers.id` | NO ACTION | `fk_ops_incidents_provider_id` |
| `related_incident_id` | `ops_incidents.id` | NO ACTION | `fk_ops_incidents_related_incident_id` |
| `reported_by` | `iam_users.id` | NO ACTION | `fk_ops_incidents_reported_by` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_ops_incidents_reservation_id` |
| `reservation_service_id` | `booking_reservation_services.id` | NO ACTION | `fk_ops_incidents_reservation_service_id` |
| `resolved_by` | `iam_users.id` | NO ACTION | `fk_ops_incidents_resolved_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_incidents_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_incidents_tenant_id_client_action_id_p` | `tenant_id, client_action_id` | `(client_action_id IS NOT NULL)` | índice único |
| `uq_ops_incidents_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_ops_incidents_1` | `CHECK ((((status)::text <> 'resuelta'::text) OR (resolution IS NOT NULL)))` |  |
| `ops_incidents_severity_check` | `CHECK (((severity)::text = ANY ((ARRAY['baja'::character varying, 'media'::character varying, 'alta'::character varying, 'critica'::character varying])::text[])))` | `severity`: `baja`, `media`, `alta`, `critica` |
| `ops_incidents_source_check` | `CHECK (((source)::text = ANY ((ARRAY['web'::character varying, 'app_operador'::character varying, 'extranet'::character varying, 'sistema'::character varying])::text[])))` | `source`: `web`, `app_operador`, `extranet`, `sistema` |
| `ops_incidents_status_check` | `CHECK (((status)::text = ANY ((ARRAY['abierta'::character varying, 'en_proceso'::character varying, 'resuelta'::character varying, 'cerrada'::character varying])::text[])))` | `status`: `abierta`, `en_proceso`, `resuelta`, `cerrada` |
| `ops_incidents_type_check` | `CHECK (((type)::text = ANY ((ARRAY['Transporte'::character varying, 'Proveedor'::character varying, 'Salud del pasajero'::character varying, 'Horario'::character varying, 'Clima'::character varying, 'Documentación'::character varying, 'Equipaje'::character varying, 'Seguridad'::character varying, 'Capacidad'::character varying, 'Pasajero'::character varying, 'Otro'::character varying])::text[])))` | `type`: `Transporte`, `Proveedor`, `Salud del pasajero`, `Horario`, `Clima`, `Documentación`, `Equipaje`, `Seguridad`, `Capacidad`, `Pasajero`, `Otro` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_incidents_assignee_id` | `USING btree (assignee_id)` |
| `ix_ops_incidents_closed_by` | `USING btree (closed_by)` |
| `ix_ops_incidents_order_id` | `USING btree (order_id)` |
| `ix_ops_incidents_provider_id` | `USING btree (provider_id)` |
| `ix_ops_incidents_related_incident_id` | `USING btree (related_incident_id)` |
| `ix_ops_incidents_reported_by` | `USING btree (reported_by)` |
| `ix_ops_incidents_reservation_id` | `USING btree (reservation_id)` |
| `ix_ops_incidents_reservation_service_id` | `USING btree (reservation_service_id)` |
| `ix_ops_incidents_resolved_by` | `USING btree (resolved_by)` |
| `ix_ops_incidents_tenant_id_assignee_id` | `USING btree (tenant_id, assignee_id)` |
| `ix_ops_incidents_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_ops_incidents_tenant_id_order_id` | `USING btree (tenant_id, order_id)` |
| `ix_ops_incidents_tenant_id_provider_id` | `USING btree (tenant_id, provider_id)` |
| `ix_ops_incidents_tenant_id_sla_due_at_p` | `USING btree (tenant_id, sla_due_at) WHERE ((status)::text = ANY ((ARRAY['abierta'::character varying, 'en_proceso'::character varying])::text[]))` |
| `ix_ops_incidents_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_ops_incidents_tenant_id_status_severity` | `USING btree (tenant_id, status, severity)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_incidents_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_ops_incidents_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `ops_order_tasks`

[Spec 05 §3.2] [Fase 1] Checklist de la orden operativa.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `order_id` | `uuid` | no |  | FK → ops_orders.id. |
| 4 | `title` | `character varying(250)` | no |  |  |
| 5 | `position` | `smallint` | no | `0` |  |
| 6 | `done` | `boolean` | no | `false` |  |
| 7 | `done_by` | `uuid` | sí |  | FK → iam_users.id. |
| 8 | `done_at` | `timestamp with time zone` | sí |  |  |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 12 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 13 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `done_by` | `iam_users.id` | NO ACTION | `fk_ops_order_tasks_done_by` |
| `order_id` | `ops_orders.id` | NO ACTION | `fk_ops_order_tasks_order_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_order_tasks_tenant_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_order_tasks_done_by` | `USING btree (done_by)` |
| `ix_ops_order_tasks_order_id` | `USING btree (order_id)` |
| `ix_ops_order_tasks_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_order_tasks_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `ops_orders`

[Spec 05 §3.1] [Fase 1] Orden operativa (una por reserva).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 5 | `title` | `character varying(200)` | no |  |  |
| 6 | `status` | `character varying(30)` | no | `'pendiente_asignacion'::character varying` | Valores: `planificada`, `pendiente_asignacion`, `asignada`, `confirmada`, `en_ejecucion`, `completada`, `cancelada`. |
| 7 | `coordinator_id` | `uuid` | no |  | FK → iam_users.id. |
| 8 | `date_from` | `date` | no |  |  |
| 9 | `date_to` | `date` | no |  |  |
| 10 | `closed_at` | `timestamp with time zone` | sí |  |  |
| 11 | `closed_by` | `uuid` | sí |  | FK → iam_users.id. |
| 12 | `cancelled_at` | `timestamp with time zone` | sí |  |  |
| 13 | `cancel_reason` | `text` | sí |  |  |
| 14 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 15 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 16 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 17 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 18 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 19 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `closed_by` | `iam_users.id` | NO ACTION | `fk_ops_orders_closed_by` |
| `coordinator_id` | `iam_users.id` | NO ACTION | `fk_ops_orders_coordinator_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_ops_orders_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_orders_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_orders_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_ops_orders_tenant_id_reservation_id_p` | `tenant_id, reservation_id` | `(deleted_at IS NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_ops_orders_1` | `CHECK ((date_to >= date_from))` |  |
| `ops_orders_status_check` | `CHECK (((status)::text = ANY ((ARRAY['planificada'::character varying, 'pendiente_asignacion'::character varying, 'asignada'::character varying, 'confirmada'::character varying, 'en_ejecucion'::character varying, 'completada'::character varying, 'cancelada'::character varying])::text[])))` | `status`: `planificada`, `pendiente_asignacion`, `asignada`, `confirmada`, `en_ejecucion`, `completada`, `cancelada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_orders_closed_by` | `USING btree (closed_by)` |
| `ix_ops_orders_coordinator_id` | `USING btree (coordinator_id)` |
| `ix_ops_orders_reservation_id` | `USING btree (reservation_id)` |
| `ix_ops_orders_tenant_id_coordinator_id` | `USING btree (tenant_id, coordinator_id)` |
| `ix_ops_orders_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_ops_orders_tenant_id_date_from` | `USING btree (tenant_id, date_from)` |
| `ix_ops_orders_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_orders_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_ops_orders_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `ops_rooming_guests`

[Spec 05 §3.9] [Fase 1] Huéspedes por habitación.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `room_id` | `uuid` | no |  | FK → ops_rooming_rooms.id. |
| 4 | `rooming_list_id` | `uuid` | no |  | FK → ops_rooming_lists.id. |
| 5 | `passenger_id` | `uuid` | no |  | FK → booking_passengers.id. |
| 6 | `stay` | `daterange` | no |  |  |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 10 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `passenger_id` | `booking_passengers.id` | NO ACTION | `fk_ops_rooming_guests_passenger_id` |
| `room_id` | `ops_rooming_rooms.id` | CASCADE | `fk_ops_rooming_guests_room_id` |
| `rooming_list_id` | `ops_rooming_lists.id` | NO ACTION | `fk_ops_rooming_guests_rooming_list_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_rooming_guests_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_rooming_guests_rooming_list_id_passenger_id` | `rooming_list_id, passenger_id` |  | índice único |

**EXCLUDE**

- `ex_ops_rooming_guests_overlap`: `EXCLUDE USING gist (tenant_id WITH =, passenger_id WITH =, stay WITH &&)`

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_rooming_guests_passenger_id` | `USING btree (passenger_id)` |
| `ix_ops_rooming_guests_room_id` | `USING btree (room_id)` |
| `ix_ops_rooming_guests_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_rooming_guests_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `ops_rooming_lists`

[Spec 05 §3.8 + §3.14b] [Fase 1] Rooming list por reserva y hotel/ciudad.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 4 | `hotel_provider_id` | `uuid` | sí |  | FK → catalog_providers.id. |
| 5 | `leg_id` | `character varying(20)` | sí |  |  |
| 6 | `city` | `character varying(80)` | sí |  |  |
| 7 | `hotel_name` | `character varying(150)` | sí |  |  |
| 8 | `source` | `character varying(30)` | no | `'manual'::character varying` | Valores: `manual`, `booking.lodging`. |
| 9 | `check_in` | `date` | no |  |  |
| 10 | `check_out` | `date` | no |  |  |
| 11 | `stay` | `daterange` | sí | `generada: daterange(check_in, check_out, '[)'::text)` |  |
| 12 | `status` | `character varying(20)` | no | `'borrador'::character varying` | Valores: `borrador`, `confirmada`, `modificada`, `enviada`. |
| 13 | `sent_at` | `timestamp with time zone` | sí |  |  |
| 14 | `sent_by` | `uuid` | sí |  | FK → iam_users.id. |
| 15 | `sent_version` | `integer` | no | `0` |  |
| 16 | `hotel_ack_at` | `timestamp with time zone` | sí |  |  |
| 17 | `hotel_ack_by` | `uuid` | sí |  | FK → iam_users.id. |
| 18 | `hotel_confirmed_at` | `timestamp with time zone` | sí |  |  |
| 19 | `hotel_confirmed_by` | `uuid` | sí |  | FK → iam_users.id. |
| 20 | `document_id` | `uuid` | sí |  | FK → sys_documents.id. |
| 21 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 22 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 23 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 24 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 25 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 26 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `document_id` | `sys_documents.id` | NO ACTION | `fk_ops_rooming_lists_document_id` |
| `hotel_ack_by` | `iam_users.id` | NO ACTION | `fk_ops_rooming_lists_hotel_ack_by` |
| `hotel_confirmed_by` | `iam_users.id` | NO ACTION | `fk_ops_rooming_lists_hotel_confirmed_by` |
| `hotel_provider_id` | `catalog_providers.id` | NO ACTION | `fk_ops_rooming_lists_hotel_provider_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_ops_rooming_lists_reservation_id` |
| `sent_by` | `iam_users.id` | NO ACTION | `fk_ops_rooming_lists_sent_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_rooming_lists_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_rooming_lists_tenant_id_reservation_id_coalesce_l_ee5adb` | `tenant_id, reservation_id, COALESCE(leg_id, ((hotel_provider_id)::text)::character` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_ops_rooming_lists_1` | `CHECK ((check_out > check_in))` |  |
| `ck_ops_rooming_lists_2` | `CHECK (((hotel_provider_id IS NOT NULL) OR (hotel_name IS NOT NULL)))` |  |
| `ops_rooming_lists_source_check` | `CHECK (((source)::text = ANY ((ARRAY['manual'::character varying, 'booking.lodging'::character varying])::text[])))` | `source`: `manual`, `booking.lodging` |
| `ops_rooming_lists_status_check` | `CHECK (((status)::text = ANY ((ARRAY['borrador'::character varying, 'confirmada'::character varying, 'modificada'::character varying, 'enviada'::character varying])::text[])))` | `status`: `borrador`, `confirmada`, `modificada`, `enviada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_rooming_lists_document_id` | `USING btree (document_id)` |
| `ix_ops_rooming_lists_hotel_ack_by` | `USING btree (hotel_ack_by)` |
| `ix_ops_rooming_lists_hotel_confirmed_by` | `USING btree (hotel_confirmed_by)` |
| `ix_ops_rooming_lists_hotel_provider_id` | `USING btree (hotel_provider_id)` |
| `ix_ops_rooming_lists_reservation_id` | `USING btree (reservation_id)` |
| `ix_ops_rooming_lists_sent_by` | `USING btree (sent_by)` |
| `ix_ops_rooming_lists_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_rooming_lists_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_ops_rooming_lists_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `ops_rooming_rooms`

[Spec 05 §3.9] [Fase 1] Habitaciones de la rooming list.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `rooming_list_id` | `uuid` | no |  | FK → ops_rooming_lists.id. |
| 4 | `hotel_provider_id` | `uuid` | sí |  | FK → catalog_providers.id. |
| 5 | `stay` | `daterange` | no |  |  |
| 6 | `room_number` | `character varying(10)` | no |  |  |
| 7 | `room_type` | `character varying(20)` | no |  | Valores: `Simple`, `Doble`, `Doble twin`, `Matrimonial`, `Triple`, `Junior suite`. |
| 8 | `capacity` | `smallint` | no |  |  |
| 9 | `status` | `character varying(20)` | no | `'pendiente'::character varying` | Valores: `confirmada`, `pendiente`, `observada`. |
| 10 | `hotel_note` | `text` | sí |  |  |
| 11 | `incident_id` | `uuid` | sí |  | FK → ops_incidents.id. |
| 12 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 13 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 15 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `hotel_provider_id` | `catalog_providers.id` | NO ACTION | `fk_ops_rooming_rooms_hotel_provider_id` |
| `incident_id` | `ops_incidents.id` | NO ACTION | `fk_ops_rooming_rooms_incident_id` |
| `rooming_list_id` | `ops_rooming_lists.id` | CASCADE | `fk_ops_rooming_rooms_rooming_list_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_rooming_rooms_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_rooming_rooms_rooming_list_id_room_number` | `rooming_list_id, room_number` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ops_rooming_rooms_room_type_check` | `CHECK (((room_type)::text = ANY ((ARRAY['Simple'::character varying, 'Doble'::character varying, 'Doble twin'::character varying, 'Matrimonial'::character varying, 'Triple'::character varying, 'Junior suite'::character varying])::text[])))` | `room_type`: `Simple`, `Doble`, `Doble twin`, `Matrimonial`, `Triple`, `Junior suite` |
| `ops_rooming_rooms_status_check` | `CHECK (((status)::text = ANY ((ARRAY['confirmada'::character varying, 'pendiente'::character varying, 'observada'::character varying])::text[])))` | `status`: `confirmada`, `pendiente`, `observada` |

**EXCLUDE**

- `ex_ops_rooming_rooms_overlap`: `EXCLUDE USING gist (tenant_id WITH =, hotel_provider_id WITH =, room_number WITH =, stay WITH &&)`

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_rooming_rooms_hotel_provider_id` | `USING btree (hotel_provider_id)` |
| `ix_ops_rooming_rooms_incident_id` | `USING btree (incident_id)` |
| `ix_ops_rooming_rooms_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_rooming_rooms_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `ops_supplier_requests`

[Spec 05 §3.4] [Fase 1] Solicitudes enviadas a proveedores por servicio (PROC-032).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `reservation_service_id` | `uuid` | no |  | FK → booking_reservation_services.id. |
| 4 | `provider_id` | `uuid` | no |  | FK → catalog_providers.id. |
| 5 | `status` | `character varying(30)` | no | `'solicitado'::character varying` | Valores: `solicitado`, `confirmado`, `rechazado`, `alternativa_propuesta`, `anulada`. |
| 6 | `channel` | `character varying(20)` | no |  | Valores: `email`, `extranet`, `telefono`, `integracion`. |
| 7 | `requested_at` | `timestamp with time zone` | no | `now()` |  |
| 8 | `requested_by` | `uuid` | no |  | FK → iam_users.id. |
| 9 | `responded_at` | `timestamp with time zone` | sí |  |  |
| 10 | `responded_by_user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 11 | `response_source` | `character varying(20)` | sí |  | Valores: `web_interno`, `extranet`. |
| 12 | `confirmation_code` | `character varying(40)` | sí |  |  |
| 13 | `rejection_reason` | `character varying(120)` | sí |  |  |
| 14 | `note` | `text` | sí |  |  |
| 15 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 16 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 17 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 18 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 19 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `provider_id` | `catalog_providers.id` | NO ACTION | `fk_ops_supplier_requests_provider_id` |
| `requested_by` | `iam_users.id` | NO ACTION | `fk_ops_supplier_requests_requested_by` |
| `reservation_service_id` | `booking_reservation_services.id` | NO ACTION | `fk_ops_supplier_requests_reservation_service_id` |
| `responded_by_user_id` | `iam_users.id` | NO ACTION | `fk_ops_supplier_requests_responded_by_user_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_supplier_requests_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_ops_supplier_requests_1` | `CHECK ((((status)::text <> 'rechazado'::text) OR (rejection_reason IS NOT NULL)))` |  |
| `ops_supplier_requests_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'extranet'::character varying, 'telefono'::character varying, 'integracion'::character varying])::text[])))` | `channel`: `email`, `extranet`, `telefono`, `integracion` |
| `ops_supplier_requests_response_source_check` | `CHECK (((response_source IS NULL) OR ((response_source)::text = ANY ((ARRAY['web_interno'::character varying, 'extranet'::character varying])::text[]))))` | `response_source`: `web_interno`, `extranet` |
| `ops_supplier_requests_status_check` | `CHECK (((status)::text = ANY ((ARRAY['solicitado'::character varying, 'confirmado'::character varying, 'rechazado'::character varying, 'alternativa_propuesta'::character varying, 'anulada'::character varying])::text[])))` | `status`: `solicitado`, `confirmado`, `rechazado`, `alternativa_propuesta`, `anulada` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_supplier_requests_provider_id` | `USING btree (provider_id)` |
| `ix_ops_supplier_requests_requested_by` | `USING btree (requested_by)` |
| `ix_ops_supplier_requests_reservation_service_id` | `USING btree (reservation_service_id)` |
| `ix_ops_supplier_requests_responded_by_user_id` | `USING btree (responded_by_user_id)` |
| `ix_ops_supplier_requests_tenant_id_provider_id_status` | `USING btree (tenant_id, provider_id, status)` |
| `ix_ops_supplier_requests_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_supplier_requests_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `ops_vehicles`

[Spec 05 §3.7] [Fase 1] Vehículos.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `plate` | `character varying(12)` | no |  |  |
| 4 | `vehicle_type` | `character varying(60)` | no |  |  |
| 5 | `capacity` | `smallint` | no |  |  |
| 6 | `provider_id` | `uuid` | sí |  | FK → catalog_providers.id. |
| 7 | `soat_expires_on` | `date` | no |  |  |
| 8 | `status` | `character varying(20)` | no | `'disponible'::character varying` | Valores: `disponible`, `asignado`, `mantenimiento`. |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 12 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 13 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `provider_id` | `catalog_providers.id` | NO ACTION | `fk_ops_vehicles_provider_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_vehicles_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_vehicles_tenant_id_plate` | `tenant_id, plate` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ops_vehicles_capacity_check` | `CHECK ((capacity > 0))` |  |
| `ops_vehicles_status_check` | `CHECK (((status)::text = ANY ((ARRAY['disponible'::character varying, 'asignado'::character varying, 'mantenimiento'::character varying])::text[])))` | `status`: `disponible`, `asignado`, `mantenimiento` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_vehicles_provider_id` | `USING btree (provider_id)` |
| `ix_ops_vehicles_tenant_id_soat_expires_on` | `USING btree (tenant_id, soat_expires_on)` |
| `ix_ops_vehicles_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_vehicles_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `ops_voucher_versions`

[Spec 05 §3.10] [Fase 1] Historial de versiones del voucher.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `voucher_id` | `uuid` | no |  | FK → ops_vouchers.id. |
| 4 | `version` | `integer` | no |  |  |
| 5 | `issued_at` | `timestamp with time zone` | no | `now()` |  |
| 6 | `issued_by` | `uuid` | sí |  | FK → iam_users.id. |
| 7 | `reason` | `text` | no |  |  |
| 8 | `snapshot` | `jsonb` | no |  |  |
| 9 | `document_id` | `uuid` | sí |  | FK → sys_documents.id. |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `document_id` | `sys_documents.id` | NO ACTION | `fk_ops_voucher_versions_document_id` |
| `issued_by` | `iam_users.id` | NO ACTION | `fk_ops_voucher_versions_issued_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_voucher_versions_tenant_id` |
| `voucher_id` | `ops_vouchers.id` | NO ACTION | `fk_ops_voucher_versions_voucher_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_voucher_versions_voucher_id_version` | `voucher_id, version` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_voucher_versions_document_id` | `USING btree (document_id)` |
| `ix_ops_voucher_versions_issued_by` | `USING btree (issued_by)` |
| `ix_ops_voucher_versions_tenant_id` | `USING btree (tenant_id)` |

[↑ Índice del dominio](#tablas)

### `ops_vouchers`

[Spec 05 §3.10] [Fase 1] Vouchers de servicio (versionados, QR firmado).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 5 | `reservation_service_id` | `uuid` | no |  | FK → booking_reservation_services.id. |
| 6 | `provider_id` | `uuid` | no |  | FK → catalog_providers.id. |
| 7 | `service_label` | `character varying(200)` | no |  |  |
| 8 | `service_date` | `date` | no |  |  |
| 9 | `pax` | `smallint` | no |  |  |
| 10 | `status` | `character varying(20)` | no | `'emitido'::character varying` | Valores: `emitido`, `utilizado`, `anulado`. |
| 11 | `version` | `integer` | no | `1` |  |
| 12 | `issued_at` | `timestamp with time zone` | no | `now()` |  |
| 13 | `issued_by` | `uuid` | sí |  | FK → iam_users.id. |
| 14 | `note` | `text` | sí |  |  |
| 15 | `used_at` | `timestamp with time zone` | sí |  |  |
| 16 | `used_by` | `uuid` | sí |  | FK → iam_users.id. |
| 17 | `used_via` | `character varying(20)` | sí |  | Valores: `web`, `extranet`, `app_operador`. |
| 18 | `void_reason` | `text` | sí |  |  |
| 19 | `void_at` | `timestamp with time zone` | sí |  |  |
| 20 | `void_by` | `uuid` | sí |  | FK → iam_users.id. |
| 21 | `origin` | `character varying(20)` | no | `'operaciones'::character varying` | Valores: `operaciones`, `ecommerce`. |
| 22 | `qr_token` | `character varying(128)` | no |  |  |
| 23 | `document_id` | `uuid` | sí |  | FK → sys_documents.id. |
| 24 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 25 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 26 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 27 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 28 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `document_id` | `sys_documents.id` | NO ACTION | `fk_ops_vouchers_document_id` |
| `issued_by` | `iam_users.id` | NO ACTION | `fk_ops_vouchers_issued_by` |
| `provider_id` | `catalog_providers.id` | NO ACTION | `fk_ops_vouchers_provider_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_ops_vouchers_reservation_id` |
| `reservation_service_id` | `booking_reservation_services.id` | NO ACTION | `fk_ops_vouchers_reservation_service_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_vouchers_tenant_id` |
| `used_by` | `iam_users.id` | NO ACTION | `fk_ops_vouchers_used_by` |
| `void_by` | `iam_users.id` | NO ACTION | `fk_ops_vouchers_void_by` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_vouchers_qr_token` | `qr_token` |  | índice único |
| `uq_ops_vouchers_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_ops_vouchers_tenant_id_reservation_service_id_p` | `tenant_id, reservation_service_id` | `((status)::text = 'emitido'::text)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ck_ops_vouchers_1` | `CHECK ((((status)::text <> 'anulado'::text) OR (void_reason IS NOT NULL)))` |  |
| `ops_vouchers_origin_check` | `CHECK (((origin)::text = ANY ((ARRAY['operaciones'::character varying, 'ecommerce'::character varying])::text[])))` | `origin`: `operaciones`, `ecommerce` |
| `ops_vouchers_status_check` | `CHECK (((status)::text = ANY ((ARRAY['emitido'::character varying, 'utilizado'::character varying, 'anulado'::character varying])::text[])))` | `status`: `emitido`, `utilizado`, `anulado` |
| `ops_vouchers_used_via_check` | `CHECK (((used_via IS NULL) OR ((used_via)::text = ANY ((ARRAY['web'::character varying, 'extranet'::character varying, 'app_operador'::character varying])::text[]))))` | `used_via`: `web`, `extranet`, `app_operador` |
| `ops_vouchers_version_check` | `CHECK ((version >= 1))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_vouchers_document_id` | `USING btree (document_id)` |
| `ix_ops_vouchers_issued_by` | `USING btree (issued_by)` |
| `ix_ops_vouchers_provider_id` | `USING btree (provider_id)` |
| `ix_ops_vouchers_reservation_id` | `USING btree (reservation_id)` |
| `ix_ops_vouchers_reservation_service_id` | `USING btree (reservation_service_id)` |
| `ix_ops_vouchers_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_ops_vouchers_tenant_id_provider_id_status` | `USING btree (tenant_id, provider_id, status)` |
| `ix_ops_vouchers_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_ops_vouchers_used_by` | `USING btree (used_by)` |
| `ix_ops_vouchers_void_by` | `USING btree (void_by)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_vouchers_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_ops_vouchers_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `ops_incident_pax_acks`

[Spec 08 §3.14] [Fase 2] Confirmación de lectura de alertas por el pasajero.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `incident_id` | `uuid` | no |  | FK → ops_incidents.id. |
| 4 | `user_id` | `uuid` | no |  | FK → iam_users.id. |
| 5 | `acknowledged_at` | `timestamp with time zone` | no | `now()` |  |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `incident_id` | `ops_incidents.id` | NO ACTION | `fk_ops_incident_pax_acks_incident_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_incident_pax_acks_tenant_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_ops_incident_pax_acks_user_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_incident_pax_acks_incident_id_user_id` | `incident_id, user_id` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_incident_pax_acks_tenant_id` | `USING btree (tenant_id)` |
| `ix_ops_incident_pax_acks_user_id` | `USING btree (user_id)` |

[↑ Índice del dominio](#tablas)

### `ops_mobile_devices`

[Spec 05 §3.13] [Fase 2] Dispositivos de las apps operador/pasajero (id generado en el dispositivo).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `user_id` | `uuid` | no |  | FK → iam_users.id. |
| 4 | `app` | `character varying(20)` | no |  | Valores: `operador`, `pasajero`. |
| 5 | `platform` | `character varying(10)` | no |  | Valores: `ios`, `android`. |
| 6 | `app_version` | `character varying(20)` | no |  |  |
| 7 | `expo_push_token` | `character varying(200)` | sí |  |  |
| 8 | `last_seen_at` | `timestamp with time zone` | sí |  |  |
| 9 | `last_sync_at` | `timestamp with time zone` | sí |  |  |
| 10 | `sync_cursor` | `character varying(64)` | sí |  |  |
| 11 | `revoked_at` | `timestamp with time zone` | sí |  |  |
| 12 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 13 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 15 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_mobile_devices_tenant_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_ops_mobile_devices_user_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_mobile_devices_expo_push_token_p` | `expo_push_token` | `(expo_push_token IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ops_mobile_devices_app_check` | `CHECK (((app)::text = ANY ((ARRAY['operador'::character varying, 'pasajero'::character varying])::text[])))` | `app`: `operador`, `pasajero` |
| `ops_mobile_devices_platform_check` | `CHECK (((platform)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying])::text[])))` | `platform`: `ios`, `android` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_mobile_devices_tenant_id_user_id` | `USING btree (tenant_id, user_id)` |
| `ix_ops_mobile_devices_user_id` | `USING btree (user_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_mobile_devices_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `ops_sync_actions`

[Spec 05 §3.13] [Fase 2] Acciones recibidas del outbox móvil (base de idempotencia; id = client_action_id).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `user_id` | `uuid` | no |  | FK → iam_users.id. |
| 4 | `device_id` | `uuid` | no |  | FK → ops_mobile_devices.id. |
| 5 | `resource_type` | `character varying(10)` | no |  | Valores: `guide`, `driver`. |
| 6 | `resource_id` | `uuid` | no |  |  |
| 7 | `action_type` | `character varying(20)` | no |  | Valores: `confirm`, `start`, `checkin`, `checkin_undo`, `checkin_all`, `evidence`, `incident`, `finish`. |
| 8 | `assignment_id` | `uuid` | no |  | FK → ops_assignments.id. |
| 9 | `coalesce_key` | `character varying(120)` | no |  |  |
| 10 | `payload` | `jsonb` | no |  |  |
| 11 | `occurred_at` | `timestamp with time zone` | no |  |  |
| 12 | `captured_offline` | `boolean` | no | `false` |  |
| 13 | `received_at` | `timestamp with time zone` | no | `now()` |  |
| 14 | `attempts` | `smallint` | no | `1` |  |
| 15 | `result` | `character varying(20)` | no |  | Valores: `applied`, `duplicate`, `conflict_resolved`, `rejected`. |
| 16 | `conflict_rule` | `character varying(40)` | sí |  |  |
| 17 | `conflict_message` | `text` | sí |  |  |
| 18 | `response` | `jsonb` | no |  |  |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `assignment_id` | `ops_assignments.id` | NO ACTION | `fk_ops_sync_actions_assignment_id` |
| `device_id` | `ops_mobile_devices.id` | NO ACTION | `fk_ops_sync_actions_device_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_sync_actions_tenant_id` |
| `user_id` | `iam_users.id` | NO ACTION | `fk_ops_sync_actions_user_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_sync_actions_tenant_id_id` | `tenant_id, id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ops_sync_actions_action_type_check` | `CHECK (((action_type)::text = ANY ((ARRAY['confirm'::character varying, 'start'::character varying, 'checkin'::character varying, 'checkin_undo'::character varying, 'checkin_all'::character varying, 'evidence'::character varying, 'incident'::character varying, 'finish'::character varying])::text[])))` | `action_type`: `confirm`, `start`, `checkin`, `checkin_undo`, `checkin_all`, `evidence`, `incident`, `finish` |
| `ops_sync_actions_resource_type_check` | `CHECK (((resource_type)::text = ANY ((ARRAY['guide'::character varying, 'driver'::character varying])::text[])))` | `resource_type`: `guide`, `driver` |
| `ops_sync_actions_result_check` | `CHECK (((result)::text = ANY ((ARRAY['applied'::character varying, 'duplicate'::character varying, 'conflict_resolved'::character varying, 'rejected'::character varying])::text[])))` | `result`: `applied`, `duplicate`, `conflict_resolved`, `rejected` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_sync_actions_assignment_id` | `USING btree (assignment_id)` |
| `ix_ops_sync_actions_device_id` | `USING btree (device_id)` |
| `ix_ops_sync_actions_tenant_id_assignment_id_occurred_at` | `USING btree (tenant_id, assignment_id, occurred_at)` |
| `ix_ops_sync_actions_user_id` | `USING btree (user_id)` |

[↑ Índice del dominio](#tablas)

### `ops_travel_doc_contacts`

[Spec 11 §3.8] [Fase 2] Contacto de emergencia por pasajero.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `passenger_id` | `uuid` | no |  | FK → booking_passengers.id. |
| 4 | `name` | `character varying(150)` | no |  |  |
| 5 | `phone` | `character varying(30)` | no |  |  |
| 6 | `relation` | `character varying(20)` | no |  | Valores: `Familiar`, `Pareja`, `Amigo(a)`, `Empresa`, `Otro`. |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 10 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `passenger_id` | `booking_passengers.id` | CASCADE | `fk_ops_travel_doc_contacts_passenger_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_travel_doc_contacts_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_travel_doc_contacts_passenger_id` | `passenger_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ops_travel_doc_contacts_relation_check` | `CHECK (((relation)::text = ANY ((ARRAY['Familiar'::character varying, 'Pareja'::character varying, 'Amigo(a)'::character varying, 'Empresa'::character varying, 'Otro'::character varying])::text[])))` | `relation`: `Familiar`, `Pareja`, `Amigo(a)`, `Empresa`, `Otro` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_travel_doc_contacts_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_travel_doc_contacts_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `ops_travel_doc_items`

[Spec 11 §3.7] [Fase 2] Checklist documental por pasajero.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 4 | `passenger_id` | `uuid` | no |  | FK → booking_passengers.id. |
| 5 | `doc_type` | `character varying(20)` | no |  | Valores: `id_doc`, `visa`, `insurance`, `yellow_fever`, `minor_auth`, `migration`, `emergency`, `special`. |
| 6 | `status` | `character varying(15)` | no | `'pendiente'::character varying` | Valores: `pendiente`, `recibido`, `completo`, `observado`. |
| 7 | `doc_number` | `character varying(40)` | sí |  |  |
| 8 | `expiry_date` | `date` | sí |  |  |
| 9 | `file_id` | `uuid` | sí |  | FK → sys_documents.id. |
| 10 | `file_name` | `character varying(200)` | sí |  |  |
| 11 | `uploaded_by_type` | `character varying(10)` | sí |  | Valores: `user`, `client`, `agency`. |
| 12 | `observation` | `text` | sí |  |  |
| 13 | `validated_by` | `uuid` | sí |  | FK → iam_users.id. |
| 14 | `validated_at` | `timestamp with time zone` | sí |  |  |
| 15 | `note` | `character varying(300)` | sí |  |  |
| 16 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 17 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 18 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 19 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 20 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `file_id` | `sys_documents.id` | NO ACTION | `fk_ops_travel_doc_items_file_id` |
| `passenger_id` | `booking_passengers.id` | CASCADE | `fk_ops_travel_doc_items_passenger_id` |
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_ops_travel_doc_items_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_travel_doc_items_tenant_id` |
| `validated_by` | `iam_users.id` | NO ACTION | `fk_ops_travel_doc_items_validated_by` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_travel_doc_items_passenger_id_doc_type` | `passenger_id, doc_type` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ops_travel_doc_items_doc_type_check` | `CHECK (((doc_type)::text = ANY ((ARRAY['id_doc'::character varying, 'visa'::character varying, 'insurance'::character varying, 'yellow_fever'::character varying, 'minor_auth'::character varying, 'migration'::character varying, 'emergency'::character varying, 'special'::character varying])::text[])))` | `doc_type`: `id_doc`, `visa`, `insurance`, `yellow_fever`, `minor_auth`, `migration`, `emergency`, `special` |
| `ops_travel_doc_items_status_check` | `CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'recibido'::character varying, 'completo'::character varying, 'observado'::character varying])::text[])))` | `status`: `pendiente`, `recibido`, `completo`, `observado` |
| `ops_travel_doc_items_uploaded_by_type_check` | `CHECK (((uploaded_by_type IS NULL) OR ((uploaded_by_type)::text = ANY ((ARRAY['user'::character varying, 'client'::character varying, 'agency'::character varying])::text[]))))` | `uploaded_by_type`: `user`, `client`, `agency` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_travel_doc_items_file_id` | `USING btree (file_id)` |
| `ix_ops_travel_doc_items_reservation_id` | `USING btree (reservation_id)` |
| `ix_ops_travel_doc_items_tenant_id_reservation_id` | `USING btree (tenant_id, reservation_id)` |
| `ix_ops_travel_doc_items_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_ops_travel_doc_items_validated_by` | `USING btree (validated_by)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_travel_doc_items_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_ops_travel_doc_items_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `ops_travel_doc_reminders`

[Spec 11 §3.9] [Fase 2] Recordatorios documentales enviados.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 4 | `sent_at` | `timestamp with time zone` | no | `now()` |  |
| 5 | `sent_on` | `date` | no | `CURRENT_DATE` |  |
| 6 | `channels` | `character varying(40)` | no |  |  |
| 7 | `recipient` | `character varying(190)` | no |  |  |
| 8 | `trigger` | `character varying(20)` | no |  | Valores: `auto`, `manual`. |
| 9 | `days_before` | `smallint` | sí |  |  |
| 10 | `items_count` | `smallint` | no | `0` |  |
| 11 | `sent_by` | `uuid` | sí |  | FK → iam_users.id. |
| 12 | `notification_ids` | `uuid[]` | no | `'{}'::uuid[]` |  |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `reservation_id` | `booking_reservations.id` | NO ACTION | `fk_ops_travel_doc_reminders_reservation_id` |
| `sent_by` | `iam_users.id` | NO ACTION | `fk_ops_travel_doc_reminders_sent_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_travel_doc_reminders_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_travel_doc_reminders_reservation_id_sent_on_p` | `reservation_id, sent_on` | `((trigger)::text = 'auto'::text)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `ops_travel_doc_reminders_trigger_check` | `CHECK (((trigger)::text = ANY ((ARRAY['auto'::character varying, 'manual'::character varying])::text[])))` | `trigger`: `auto`, `manual` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_travel_doc_reminders_reservation_id_sent_at_desc` | `USING btree (reservation_id, sent_at DESC)` |
| `ix_ops_travel_doc_reminders_sent_by` | `USING btree (sent_by)` |
| `ix_ops_travel_doc_reminders_tenant_id` | `USING btree (tenant_id)` |

[↑ Índice del dominio](#tablas)

### `ops_travel_doc_special`

[Spec 11 §3.8] [Fase 2] Atención especial (sin datos clínicos; acceso restringido).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Operaciones (ops_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `passenger_id` | `uuid` | no |  | FK → booking_passengers.id. |
| 4 | `requires_attention` | `boolean` | no | `false` |  |
| 5 | `operational_note` | `character varying(300)` | sí |  |  |
| 6 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 7 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 8 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 9 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `passenger_id` | `booking_passengers.id` | CASCADE | `fk_ops_travel_doc_special_passenger_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_ops_travel_doc_special_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_ops_travel_doc_special_passenger_id` | `passenger_id` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_ops_travel_doc_special_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_ops_travel_doc_special_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)
