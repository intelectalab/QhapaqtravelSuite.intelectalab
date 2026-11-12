# Diccionario de datos · Catálogo (catalog_)

_Generado por `build_reference.py` desde el catálogo de PostgreSQL 16.15 tras cargar `00`→`90`. No editar a mano._

Productos, versiones, servicios, proveedores, tarifas, salidas, holds, cupos y reglas por producto.

56 tablas · 826 columnas · 152 claves foráneas. Diagrama ER: [`../er/catalog.svg`](../er/catalog.svg) (fuente [`../er/catalog.mmd`](../er/catalog.mmd)). Volver al [índice general](../DICCIONARIO-DE-DATOS.md).

## Tablas

| Tabla | Fase | RLS | Columnas | FKs | Descripción |
|---|---|---|---|---|---|
| [`catalog_availability_holds`](#catalog_availability_holds) | Fase 1 · MVP | tenant | 19 | 3 | [Spec 02 §3.9 + 15 §3.13–3.14] [Fase 1] Retenciones de cupo (hold → confirmada/liberada/expirada/consumida). v2.5: fuente única de retenciones para el cálculo d |
| [`catalog_availability_ranges`](#catalog_availability_ranges) | Fase 1 · MVP | tenant | 14 | 2 | [Spec 16 §3.3] [Fase 1] Rangos de disponibilidad por producto (motor básico). |
| [`catalog_destinations`](#catalog_destinations) | Fase 1 · MVP | tenant | 16 | 2 | [Spec 02 §3.3] [Fase 1] Árbol de destinos (País → Atracción/Ruta). |
| [`catalog_itineraries`](#catalog_itineraries) | Fase 1 · MVP | tenant | 9 | 2 | [Spec 02 §3.7] [Fase 1] Itinerario del producto. |
| [`catalog_itinerary_days`](#catalog_itinerary_days) | Fase 1 · MVP | tenant | 9 | 2 | [Spec 02 §3.7] [Fase 1] Días del itinerario. |
| [`catalog_itinerary_items`](#catalog_itinerary_items) | Fase 1 · MVP | tenant | 16 | 3 | [Spec 02 §3.7] [Fase 1] Actividades por día del itinerario. |
| [`catalog_pax_rules`](#catalog_pax_rules) | Fase 1 · MVP | tenant | 19 | 2 | [Spec 16 §3.4] [Fase 1] Reglas de pasajeros por producto (edades, proporciones). |
| [`catalog_price_rules`](#catalog_price_rules) | Fase 1 · MVP | tenant | 18 | 2 | [Spec 02 §3.8] [Fase 1] Reglas de pricing a nivel tenant. |
| [`catalog_product_categories`](#catalog_product_categories) | Fase 1 · MVP | tenant | 9 | 1 | [Spec 02 §3.2] [Fase 1] Categorías de producto. |
| [`catalog_product_channels`](#catalog_product_channels) | Fase 1 · MVP | tenant | 11 | 3 | [Spec 02 §3.7] [Fase 1] Publicación del producto por canal. |
| [`catalog_product_config_groups`](#catalog_product_config_groups) | Fase 1 · MVP | tenant | 9 | 2 | [Spec 02 §3.7] [Fase 1] Grupos de personalización del producto (§23). |
| [`catalog_product_config_options`](#catalog_product_config_options) | Fase 1 · MVP | tenant | 10 | 2 | [Spec 02 §3.7] [Fase 1] Opciones de personalización (delta de precio por pasajero). |
| [`catalog_product_departures`](#catalog_product_departures) | Fase 1 · MVP | tenant | 20 | 5 | [Spec 02 §3.9] [Fase 1] Salidas programadas (cupo por fecha/hora). |
| [`catalog_product_destinations`](#catalog_product_destinations) | Fase 1 · MVP | tenant | 9 | 3 | [Spec 02 §3.7] [Fase 1] Destinos secundarios del producto. |
| [`catalog_product_faqs`](#catalog_product_faqs) | Fase 1 · MVP | tenant | 10 | 2 | [Spec 02 §3.7] [Fase 1] Preguntas frecuentes del producto. |
| [`catalog_product_inclusions`](#catalog_product_inclusions) | Fase 1 · MVP | tenant | 10 | 2 | [Spec 02 §3.7] [Fase 1] Incluye / no incluye. |
| [`catalog_product_items`](#catalog_product_items) | Fase 1 · MVP | tenant | 17 | 5 | [Spec 02 §3.7] [Fase 1] Componentes del producto (servicio o producto; paquetes). |
| [`catalog_product_media`](#catalog_product_media) | Fase 1 · MVP | tenant | 17 | 2 | [Spec 02 §3.7] [Fase 1] Galería del producto. |
| [`catalog_product_policies`](#catalog_product_policies) | Fase 1 · MVP | tenant | 16 | 2 | [Spec 02 §3.7] [Fase 1] Políticas comerciales 1:1 con producto. |
| [`catalog_product_promotions`](#catalog_product_promotions) | Fase 1 · MVP | tenant | 19 | 3 | [Spec 02 §3.7 + 08 §3.9] [Fase 1] Promociones por producto (códigos promocionales). |
| [`catalog_product_related`](#catalog_product_related) | Fase 1 · MVP | tenant | 9 | 3 | [Spec 02 §3.7] [Fase 1] Productos relacionados (cross-sell/upsell). |
| [`catalog_product_requirements`](#catalog_product_requirements) | Fase 1 · MVP | tenant | 9 | 2 | [Spec 02 §3.7] [Fase 1] Requisitos del producto. |
| [`catalog_product_seasons`](#catalog_product_seasons) | Fase 1 · MVP | tenant | 8 | 3 | [Spec 02 §3.7] [Fase 1] Temporadas asociadas al producto. |
| [`catalog_product_subcategories`](#catalog_product_subcategories) | Fase 1 · MVP | tenant | 9 | 2 | [Spec 02 §3.2] [Fase 1] Subcategorías de producto. |
| [`catalog_product_types`](#catalog_product_types) | Fase 1 · MVP | tenant | 11 | 1 | [Spec 02 §3.1] [Fase 1] Tipos de producto (TOUR, EXCURSIÓN, PAQUETE…). |
| [`catalog_product_versions`](#catalog_product_versions) | Fase 1 · MVP | tenant | 10 | 2 | [Spec 02 §3.7] [Fase 1] Versiones inmutables del producto (snapshot). |
| [`catalog_products`](#catalog_products) | Fase 1 · MVP | tenant | 59 | 7 | [Spec 02 §3.6 + 16 §3.3] [Fase 1] Ficha maestra de producto. |
| [`catalog_provider_contacts`](#catalog_provider_contacts) | Fase 1 · MVP | tenant | 11 | 2 | [Spec 02 §3.4] [Fase 1] Contactos adicionales del proveedor. |
| [`catalog_providers`](#catalog_providers) | Fase 1 · MVP | tenant | 23 | 1 | [Spec 02 §3.4] [Fase 1] Proveedores (hoteles, transporte, guías…). |
| [`catalog_rate_conditions`](#catalog_rate_conditions) | Fase 1 · MVP | tenant | 10 | 2 | [Spec 02 §3.8] [Fase 1] Condiciones estructuradas de tarifa (propuesta; el prototipo no la usa). |
| [`catalog_rates`](#catalog_rates) | Fase 1 · MVP | tenant | 23 | 3 | [Spec 02 §3.8] [Fase 1] Tarifas del producto por segmento/canal/vigencia. |
| [`catalog_seasons`](#catalog_seasons) | Fase 1 · MVP | tenant | 15 | 1 | [Spec 02 §3.8] [Fase 1] Temporadas (factor de precio). |
| [`catalog_services`](#catalog_services) | Fase 1 · MVP | tenant | 20 | 2 | [Spec 02 §3.5] [Fase 1] Servicios de proveedor (componentes de costo). |
| [`catalog_accommodation_hotels`](#catalog_accommodation_hotels) | Fase 2 · Canales y campo | tenant | 11 | 3 | [Spec 16 §3.6] [Fase 2] Hoteles por tramo. |
| [`catalog_accommodation_legs`](#catalog_accommodation_legs) | Fase 2 · Canales y campo | tenant | 14 | 3 | [Spec 16 §3.6] [Fase 2] Tramos de alojamiento del circuito. |
| [`catalog_accommodation_room_types`](#catalog_accommodation_room_types) | Fase 2 · Canales y campo | tenant | 10 | 2 | [Spec 16 §3.6] [Fase 2] Tipos de habitación y precio por noche. |
| [`catalog_allotment_charges`](#catalog_allotment_charges) | Fase 2 · Canales y campo | tenant | 13 | 3 | [Spec 11 §3.5] [Fase 2] Penalidades por cupo no usado. |
| [`catalog_allotment_consumptions`](#catalog_allotment_consumptions) | Fase 2 · Canales y campo | tenant | 11 | 4 | [Spec 11 §3.3] [Fase 2] Consumo de cupo por servicio de reserva (idempotente). |
| [`catalog_allotment_days`](#catalog_allotment_days) | Fase 2 · Canales y campo | tenant | 18 | 3 | [Spec 11 §3.2] [Fase 2] Cupo por contrato y fecha. |
| [`catalog_allotment_events`](#catalog_allotment_events) | Fase 2 · Canales y campo | tenant | 6 | 3 | [Spec 11 §3.6] [Fase 2] Bitácora del contrato de cupo. |
| [`catalog_allotment_requests`](#catalog_allotment_requests) | Fase 2 · Canales y campo | tenant | 16 | 3 | [Spec 11 §3.4] [Fase 2] Solicitudes de ampliación de cupo. |
| [`catalog_allotments`](#catalog_allotments) | Fase 2 · Canales y campo | tenant | 26 | 4 | [Spec 11 §3.1] [Fase 2] Contratos de cupo (allotment) con proveedores. |
| [`catalog_destination_contents`](#catalog_destination_contents) | Fase 2 · Canales y campo | tenant | 15 | 3 | [Spec 15 §3.11] [Fase 2] Contenido de páginas de destino por idioma. |
| [`catalog_payment_policies`](#catalog_payment_policies) | Fase 2 · Canales y campo | tenant | 11 | 2 | [Spec 16 §3.7] [Fase 2] Política de pago del producto (total/adelanto). |
| [`catalog_pickup_points`](#catalog_pickup_points) | Fase 2 · Canales y campo | tenant | 11 | 2 | [Spec 16 §3.8] [Fase 2] Puntos de recojo del producto. |
| [`catalog_product_addons`](#catalog_product_addons) | Fase 2 · Canales y campo | tenant | 19 | 4 | [Spec 16 §3.5] [Fase 2] Adicionales del producto (museos, seguros…). |
| [`catalog_product_b2b_rates`](#catalog_product_b2b_rates) | Fase 2 · Canales y campo | tenant | 18 | 4 | [Spec 02 §3.7 + 08 §3.3] [Fase 2] Tarifa neta por agencia y producto. |
| [`catalog_product_rule_overrides`](#catalog_product_rule_overrides) | Fase 2 · Canales y campo | tenant | 10 | 3 | [Spec 17 §3.2 + 16 §3.2] [Fase 2] Excepción de regla por producto. |
| [`catalog_product_translations`](#catalog_product_translations) | Fase 2 · Canales y campo | tenant | 19 | 2 | [Spec 15 §3.11] [Fase 2] Traducciones del producto para el sitio. |
| [`catalog_service_cost_history`](#catalog_service_cost_history) | Fase 2 · Canales y campo | tenant | 12 | 4 | [Spec 10 §3.11 + 06 §3.4] [Fase 2] Historial de costos/vigencias de servicios de proveedor (tarifas aprobadas). |
| [`catalog_dynamic_price_rules`](#catalog_dynamic_price_rules) | Fase 3 · SaaS y crecimiento | tenant | 20 | 2 | [Spec 19 §3.8] [Fase 3] Ajustes de precio dinámicos por ocupación, anticipación, día, temporada o demanda (regla R-DYNAMIC-PRICING). |
| [`catalog_hotel_season_rates`](#catalog_hotel_season_rates) | Fase 3 · SaaS y crecimiento | tenant | 10 | 3 | [Spec 21 §3.1] [Fase 3] Ajuste porcentual de la tarifa de un hotel del tramo por rango de fechas (temporada); sin solapes por hotel. |
| [`catalog_import_jobs`](#catalog_import_jobs) | Fase 3 · SaaS y crecimiento | tenant | 16 | 2 | [Spec 19 §3.5] [Fase 3] Importación de productos desde una web, PDF o planilla con IA; revisión humana antes de crear. |
| [`catalog_leg_tours`](#catalog_leg_tours) | Fase 3 · SaaS y crecimiento | tenant | 19 | 4 | [Spec 21 §3.2] [Fase 3] Tours opcionales de un tramo (ciudad) con precio adulto/niño, día relativo, edad mínima y cupo. |
| [`catalog_transport_options`](#catalog_transport_options) | Fase 3 · SaaS y crecimiento | tenant | 19 | 6 | [Spec 21 §3.3] [Fase 3] Movilidad del circuito: entre tramos (elegir una por par) o local, por pasajero o por vehículo. |
| [`catalog_transport_vehicles`](#catalog_transport_vehicles) | Fase 3 · SaaS y crecimiento | tenant | 8 | 2 | [Spec 21 §3.3] [Fase 3] Vehículos y capacidad de una opción de movilidad cobrada por vehículo. |

## Detalle por tabla

### `catalog_availability_holds`

[Spec 02 §3.9 + 15 §3.13–3.14] [Fase 1] Retenciones de cupo (hold → confirmada/liberada/expirada/consumida). v2.5: fuente única de retenciones para el cálculo de disponibilidad (carrito, checkout, cotización y motor).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_product_departures.tenant_id, catalog_products.tenant_id, tenants.id. |
| 3 | `ref` | `character varying(20)` | no |  |  |
| 4 | `departure_id` | `uuid` | sí |  | FK → catalog_product_departures.id. |
| 5 | `product_id` | `uuid` | sí |  | FK → catalog_products.id. |
| 6 | `service_date` | `date` | sí |  |  |
| 7 | `quantity` | `smallint` | no |  |  |
| 8 | `reference` | `character varying(60)` | no |  |  |
| 9 | `reference_type` | `character varying(20)` | sí |  |  |
| 10 | `reference_id` | `uuid` | sí |  |  |
| 11 | `status` | `character varying(12)` | no | `'hold'::character varying` | Valores: `hold`, `confirmada`, `liberada`, `expirada`, `consumida`. |
| 12 | `expires_at` | `timestamp with time zone` | no |  |  |
| 13 | `released_reason` | `text` | sí |  |  |
| 14 | `notes` | `text` | sí |  |  |
| 15 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 16 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 17 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 18 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 19 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, departure_id` | `catalog_product_departures.tenant_id, id` | NO ACTION | `fk_catalog_availability_holds_departure_id` |
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | NO ACTION | `fk_catalog_availability_holds_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_availability_holds_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_availability_holds_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_availability_holds_tenant_id_ref` | `tenant_id, ref` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_availability_holds_quantity_check` | `CHECK ((quantity >= 1))` |  |
| `catalog_availability_holds_status_check` | `CHECK (((status)::text = ANY ((ARRAY['hold'::character varying, 'confirmada'::character varying, 'liberada'::character varying, 'expirada'::character varying, 'consumida'::character varying])::text[])))` | `status`: `hold`, `confirmada`, `liberada`, `expirada`, `consumida` |
| `ck_catalog_availability_holds_1` | `CHECK (((departure_id IS NOT NULL) OR ((product_id IS NOT NULL) AND (service_date IS NOT NULL))))` |  |
| `ck_catalog_availability_holds_2` | `CHECK ((((status)::text <> 'liberada'::text) OR (released_reason IS NOT NULL)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_availability_holds_departure_id_status` | `USING btree (departure_id, status)` |
| `ix_catalog_availability_holds_product_id` | `USING btree (product_id)` |
| `ix_catalog_availability_holds_reference_type_reference_id` | `USING btree (reference_type, reference_id)` |
| `ix_catalog_availability_holds_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_catalog_availability_holds_tenant_id_product_id_servi_d63fbf` | `USING btree (tenant_id, product_id, service_date) WHERE ((status)::text = 'hold'::text)` |
| `ix_catalog_availability_holds_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_catalog_availability_holds_tenant_id_status_expires_at` | `USING btree (tenant_id, status, expires_at)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_availability_holds_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_catalog_availability_holds_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_availability_ranges`

[Spec 16 §3.3] [Fase 1] Rangos de disponibilidad por producto (motor básico).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `code` | `character varying(20)` | no |  |  |
| 5 | `date_from` | `date` | no |  |  |
| 6 | `date_to` | `date` | no |  |  |
| 7 | `status` | `character varying(20)` | no | `'disponible'::character varying` | Valores: `disponible`, `cerrado`, `agotado`. |
| 8 | `capacity_per_day` | `integer` | no | `0` |  |
| 9 | `note` | `character varying(200)` | sí |  |  |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 13 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 14 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_availability_ranges_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_availability_ranges_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_availability_ranges_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_availability_ranges_status_check` | `CHECK (((status)::text = ANY ((ARRAY['disponible'::character varying, 'cerrado'::character varying, 'agotado'::character varying])::text[])))` | `status`: `disponible`, `cerrado`, `agotado` |
| `ck_catalog_availability_ranges_1` | `CHECK ((date_to >= date_from))` |  |
| `ck_catalog_availability_ranges_2` | `CHECK (((date_to - date_from) <= 730))` |  |
| `ck_catalog_availability_ranges_3` | `CHECK ((((status)::text <> 'disponible'::text) OR ((capacity_per_day >= 1) AND (capacity_per_day <= 500))))` |  |

**EXCLUDE**

- `ex_avail_closed`: `EXCLUDE USING gist (product_id WITH =, daterange(date_from, date_to, '[]'::text) WITH &&) WHERE ((((status)::text = ANY ((ARRAY['cerrado'::character varying, 'agotado'::character varying])::text[])) AND (deleted_at IS NULL)))`
- `ex_avail_open`: `EXCLUDE USING gist (product_id WITH =, daterange(date_from, date_to, '[]'::text) WITH &&) WHERE ((((status)::text = 'disponible'::text) AND (deleted_at IS NULL)))`

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_availability_ranges_daterange_date_from_date_to` | `USING gist (daterange(date_from, date_to, '[]'::text))` |
| `ix_catalog_availability_ranges_product_id` | `USING btree (product_id)` |
| `ix_catalog_availability_ranges_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_catalog_availability_ranges_tenant_id_product_id_date_60aa29` | `USING btree (tenant_id, product_id, date_from, date_to)` |
| `ix_catalog_availability_ranges_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_availability_ranges_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_destinations`

[Spec 02 §3.3] [Fase 1] Árbol de destinos (País → Atracción/Ruta).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_destinations.tenant_id, tenants.id. |
| 3 | `ref` | `character varying(20)` | no |  |  |
| 4 | `parent_id` | `uuid` | sí |  | FK → catalog_destinations.id. |
| 5 | `name` | `character varying(120)` | no |  |  |
| 6 | `type` | `character varying(20)` | no |  | Valores: `País`, `Región`, `Departamento`, `Provincia`, `Ciudad`, `Zona`, `Lugar`, `Atracción`, `Ruta`. |
| 7 | `level` | `smallint` | no |  |  |
| 8 | `lat` | `numeric(9,6)` | sí |  |  |
| 9 | `lng` | `numeric(9,6)` | sí |  |  |
| 10 | `description` | `text` | sí |  |  |
| 11 | `path` | `text` | no |  |  |
| 12 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 13 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 15 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 16 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, parent_id` | `catalog_destinations.tenant_id, id` | NO ACTION | `fk_catalog_destinations_parent_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_destinations_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_destinations_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_destinations_tenant_id_coalesce_parent_id_000_334257` | `tenant_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower((name)::text)` |  | índice único |
| `uq_catalog_destinations_tenant_id_ref` | `tenant_id, ref` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_destinations_lat_check` | `CHECK (((lat >= ('-90'::integer)::numeric) AND (lat <= (90)::numeric)))` |  |
| `catalog_destinations_level_check` | `CHECK (((level >= 0) AND (level <= 6)))` |  |
| `catalog_destinations_lng_check` | `CHECK (((lng >= ('-180'::integer)::numeric) AND (lng <= (180)::numeric)))` |  |
| `catalog_destinations_type_check` | `CHECK (((type)::text = ANY ((ARRAY['País'::character varying, 'Región'::character varying, 'Departamento'::character varying, 'Provincia'::character varying, 'Ciudad'::character varying, 'Zona'::character varying, 'Lugar'::character varying, 'Atracción'::character varying, 'Ruta'::character varying])::text[])))` | `type`: `País`, `Región`, `Departamento`, `Provincia`, `Ciudad`, `Zona`, `Lugar`, `Atracción`, `Ruta` |
| `ck_catalog_destinations_1` | `CHECK (((lat IS NULL) = (lng IS NULL)))` |  |
| `ck_catalog_destinations_2` | `CHECK (((parent_id IS NOT NULL) OR ((type)::text = 'País'::text)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_destinations_parent_id` | `USING btree (parent_id)` |
| `ix_catalog_destinations_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_catalog_destinations_tenant_id_path_text_pattern_ops` | `USING btree (tenant_id, path text_pattern_ops)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_destinations_level_guard` | BEFORE INSERT OR UPDATE OF parent_id, level | `app_destinations_level_guard` |
| `trg_catalog_destinations_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_itineraries`

[Spec 02 §3.7] [Fase 1] Itinerario del producto.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `name` | `character varying(120)` | no | `'Principal'::character varying` |  |
| 5 | `is_default` | `boolean` | no | `true` |  |
| 6 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 7 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 8 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 9 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_itineraries_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_itineraries_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_itineraries_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_itineraries_product_id_p` | `product_id` | `is_default` | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_itineraries_product_id` | `USING btree (product_id)` |
| `ix_catalog_itineraries_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_itineraries_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_itinerary_days`

[Spec 02 §3.7] [Fase 1] Días del itinerario.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_itineraries.tenant_id, tenants.id. |
| 3 | `itinerary_id` | `uuid` | no |  | FK → catalog_itineraries.id. |
| 4 | `day_number` | `smallint` | no |  |  |
| 5 | `title` | `character varying(160)` | no |  |  |
| 6 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 7 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 8 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 9 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, itinerary_id` | `catalog_itineraries.tenant_id, id` | CASCADE | `fk_catalog_itinerary_days_itinerary_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_itinerary_days_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_itinerary_days_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_itinerary_days_itinerary_id_day_number` | `itinerary_id, day_number` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_itinerary_days_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_itinerary_days_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_itinerary_items`

[Spec 02 §3.7] [Fase 1] Actividades por día del itinerario.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_itinerary_days.tenant_id, catalog_services.tenant_id, tenants.id. |
| 3 | `day_id` | `uuid` | no |  | FK → catalog_itinerary_days.id. |
| 4 | `start_time` | `time without time zone` | sí |  |  |
| 5 | `activity` | `character varying(200)` | no |  |  |
| 6 | `item_type` | `character varying(20)` | sí |  | Valores: `Traslado`, `Transporte`, `Tren`, `Hotel`, `Alimentación`, `Guía`, `Actividad`, `Entrada`, `Libre`, `Otro`. |
| 7 | `location` | `character varying(160)` | sí |  |  |
| 8 | `service_id` | `uuid` | sí |  | FK → catalog_services.id. |
| 9 | `note` | `text` | sí |  |  |
| 10 | `image_ref` | `character varying(300)` | sí |  |  |
| 11 | `cost` | `numeric(14,2)` | no | `0` |  |
| 12 | `price` | `numeric(14,2)` | no | `0` |  |
| 13 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 14 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 15 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 16 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, day_id` | `catalog_itinerary_days.tenant_id, id` | CASCADE | `fk_catalog_itinerary_items_day_id` |
| `tenant_id, service_id` | `catalog_services.tenant_id, id` | NO ACTION | `fk_catalog_itinerary_items_service_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_itinerary_items_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_itinerary_items_item_type_check` | `CHECK (((item_type IS NULL) OR ((item_type)::text = ANY ((ARRAY['Traslado'::character varying, 'Transporte'::character varying, 'Tren'::character varying, 'Hotel'::character varying, 'Alimentación'::character varying, 'Guía'::character varying, 'Actividad'::character varying, 'Entrada'::character varying, 'Libre'::character varying, 'Otro'::character varying])::text[]))))` | `item_type`: `Traslado`, `Transporte`, `Tren`, `Hotel`, `Alimentación`, `Guía`, `Actividad`, `Entrada`, `Libre`, `Otro` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_itinerary_items_day_id` | `USING btree (day_id)` |
| `ix_catalog_itinerary_items_service_id` | `USING btree (service_id)` |
| `ix_catalog_itinerary_items_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_itinerary_items_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_pax_rules`

[Spec 16 §3.4] [Fase 1] Reglas de pasajeros por producto (edades, proporciones).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `adult_min_age` | `smallint` | no |  |  |
| 5 | `child_min_age` | `smallint` | no |  |  |
| 6 | `child_max_age` | `smallint` | no |  |  |
| 7 | `infant_max_age` | `smallint` | no |  |  |
| 8 | `child_pays` | `boolean` | no | `true` |  |
| 9 | `child_price_pct` | `numeric(5,2)` | no | `100` |  |
| 10 | `infant_allowed` | `boolean` | no | `true` |  |
| 11 | `infant_pays` | `boolean` | no | `false` |  |
| 12 | `max_children_per_adult` | `smallint` | no | `10` |  |
| 13 | `max_infants_per_adult` | `smallint` | no | `5` |  |
| 14 | `min_adults` | `smallint` | no | `1` |  |
| 15 | `note` | `text` | sí |  |  |
| 16 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 17 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 18 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 19 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_pax_rules_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_pax_rules_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_pax_rules_tenant_id_product_id` | `tenant_id, product_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_pax_rules_child_price_pct_check` | `CHECK (((child_price_pct >= (0)::numeric) AND (child_price_pct <= (100)::numeric)))` |  |
| `catalog_pax_rules_max_children_per_adult_check` | `CHECK (((max_children_per_adult >= 0) AND (max_children_per_adult <= 10)))` |  |
| `catalog_pax_rules_max_infants_per_adult_check` | `CHECK (((max_infants_per_adult >= 0) AND (max_infants_per_adult <= 5)))` |  |
| `catalog_pax_rules_min_adults_check` | `CHECK (((min_adults >= 0) AND (min_adults <= 10)))` |  |
| `ck_catalog_pax_rules_1` | `CHECK (((infant_max_age < child_min_age) AND (child_min_age <= child_max_age) AND (child_max_age < adult_min_age)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_pax_rules_product_id` | `USING btree (product_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_pax_rules_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_price_rules`

[Spec 02 §3.8] [Fase 1] Reglas de pricing a nivel tenant.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, tenants.id. |
| 3 | `ref` | `character varying(20)` | no |  |  |
| 4 | `name` | `character varying(120)` | no |  |  |
| 5 | `kind` | `character varying(20)` | no |  | Valores: `Markup %`, `Markup fijo`, `Descuento %`, `Descuento fijo`, `Impuesto %`, `Comisión %`, `Redondeo`, `Precio mínimo`, `Precio máximo`. |
| 6 | `value` | `numeric(12,4)` | no |  |  |
| 7 | `scope` | `character varying(200)` | no |  |  |
| 8 | `channel` | `character varying(12)` | sí |  |  |
| 9 | `min_pax` | `smallint` | sí |  |  |
| 10 | `customer_residency` | `character varying(10)` | sí |  | Valores: `dom`, `nodom`. |
| 11 | `product_id` | `uuid` | sí |  | FK → catalog_products.id. |
| 12 | `currency` | `character(3)` | sí |  |  |
| 13 | `priority` | `smallint` | no | `100` |  |
| 14 | `status` | `character varying(10)` | no | `'activa'::character varying` | Valores: `activa`, `inactiva`. |
| 15 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 16 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 17 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 18 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | NO ACTION | `fk_catalog_price_rules_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_price_rules_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_price_rules_tenant_id_ref` | `tenant_id, ref` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_price_rules_customer_residency_check` | `CHECK (((customer_residency IS NULL) OR ((customer_residency)::text = ANY ((ARRAY['dom'::character varying, 'nodom'::character varying])::text[]))))` | `customer_residency`: `dom`, `nodom` |
| `catalog_price_rules_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['Markup %'::character varying, 'Markup fijo'::character varying, 'Descuento %'::character varying, 'Descuento fijo'::character varying, 'Impuesto %'::character varying, 'Comisión %'::character varying, 'Redondeo'::character varying, 'Precio mínimo'::character varying, 'Precio máximo'::character varying])::text[])))` | `kind`: `Markup %`, `Markup fijo`, `Descuento %`, `Descuento fijo`, `Impuesto %`, `Comisión %`, `Redondeo`, `Precio mínimo`, `Precio máximo` |
| `catalog_price_rules_status_check` | `CHECK (((status)::text = ANY ((ARRAY['activa'::character varying, 'inactiva'::character varying])::text[])))` | `status`: `activa`, `inactiva` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_price_rules_product_id` | `USING btree (product_id)` |
| `ix_catalog_price_rules_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_catalog_price_rules_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_price_rules_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_categories`

[Spec 02 §3.2] [Fase 1] Categorías de producto.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `ref` | `character varying(20)` | no |  |  |
| 4 | `name` | `character varying(80)` | no |  |  |
| 5 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 6 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 7 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 8 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 9 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_categories_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_product_categories_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_product_categories_tenant_id_lower_name` | `tenant_id, lower((name)::text)` |  | índice único |
| `uq_catalog_product_categories_tenant_id_ref` | `tenant_id, ref` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_categories_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_categories_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_channels`

[Spec 02 §3.7] [Fase 1] Publicación del producto por canal.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, iam_users.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `channel` | `character varying(12)` | no |  | Valores: `erp`, `crm`, `quotes`, `b2b`, `portal`, `portal_pax`, `cms`, `ecommerce`, `mobile`. |
| 5 | `is_published` | `boolean` | no | `false` |  |
| 6 | `published_at` | `timestamp with time zone` | sí |  |  |
| 7 | `published_by` | `uuid` | sí |  | FK → iam_users.id. |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 9 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 11 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_channels_product_id` |
| `tenant_id, published_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_catalog_product_channels_published_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_channels_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_product_channels_product_id_channel` | `product_id, channel` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_product_channels_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['erp'::character varying, 'crm'::character varying, 'quotes'::character varying, 'b2b'::character varying, 'portal'::character varying, 'portal_pax'::character varying, 'cms'::character varying, 'ecommerce'::character varying, 'mobile'::character varying])::text[])))` | `channel`: `erp`, `crm`, `quotes`, `b2b`, `portal`, `portal_pax`, `cms`, `ecommerce`, `mobile` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_channels_published_by` | `USING btree (published_by)` |
| `ix_catalog_product_channels_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_channels_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_config_groups`

[Spec 02 §3.7] [Fase 1] Grupos de personalización del producto (§23).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `name` | `character varying(60)` | no |  |  |
| 5 | `sort_order` | `smallint` | no | `0` |  |
| 6 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 7 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 8 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 9 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_config_groups_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_config_groups_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_product_config_groups_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_product_config_groups_product_id_lower_name` | `product_id, lower((name)::text)` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_config_groups_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_config_groups_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_config_options`

[Spec 02 §3.7] [Fase 1] Opciones de personalización (delta de precio por pasajero).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_product_config_groups.tenant_id, tenants.id. |
| 3 | `group_id` | `uuid` | no |  | FK → catalog_product_config_groups.id. |
| 4 | `label` | `character varying(80)` | no |  |  |
| 5 | `price_delta` | `numeric(14,2)` | no | `0` |  |
| 6 | `sort_order` | `smallint` | no | `0` |  |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 10 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, group_id` | `catalog_product_config_groups.tenant_id, id` | CASCADE | `fk_catalog_product_config_options_group_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_config_options_tenant_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_config_options_group_id` | `USING btree (group_id)` |
| `ix_catalog_product_config_options_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_config_options_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_departures`

[Spec 02 §3.9] [Fase 1] Salidas programadas (cupo por fecha/hora).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → ops_guides.tenant_id, catalog_products.tenant_id, catalog_providers.tenant_id, tenants.id, ops_vehicles.tenant_id. |
| 3 | `ref` | `character varying(20)` | no |  |  |
| 4 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 5 | `departure_date` | `date` | no |  |  |
| 6 | `departure_time` | `time without time zone` | no |  |  |
| 7 | `capacity` | `smallint` | no |  |  |
| 8 | `sold` | `smallint` | no | `0` |  |
| 9 | `status` | `character varying(12)` | no | `'abierta'::character varying` | Valores: `abierta`, `completa`, `cerrada`, `cancelada`. |
| 10 | `provider_id` | `uuid` | sí |  | FK → catalog_providers.id. |
| 11 | `guide_id` | `uuid` | sí |  | FK → ops_guides.id. |
| 12 | `vehicle_id` | `uuid` | sí |  | FK → ops_vehicles.id. |
| 13 | `meeting_point` | `character varying(160)` | no |  |  |
| 14 | `return_point` | `character varying(160)` | sí |  |  |
| 15 | `notes` | `text` | sí |  |  |
| 16 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 17 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 18 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 19 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 20 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, guide_id` | `ops_guides.tenant_id, id` | NO ACTION | `fk_catalog_product_departures_guide_id` |
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | NO ACTION | `fk_catalog_product_departures_product_id` |
| `tenant_id, provider_id` | `catalog_providers.tenant_id, id` | NO ACTION | `fk_catalog_product_departures_provider_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_departures_tenant_id` |
| `tenant_id, vehicle_id` | `ops_vehicles.tenant_id, id` | NO ACTION | `fk_catalog_product_departures_vehicle_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_product_departures_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_product_departures_tenant_id_ref` | `tenant_id, ref` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_product_departures_capacity_check` | `CHECK (((capacity >= 1) AND (capacity <= 60)))` |  |
| `catalog_product_departures_status_check` | `CHECK (((status)::text = ANY ((ARRAY['abierta'::character varying, 'completa'::character varying, 'cerrada'::character varying, 'cancelada'::character varying])::text[])))` | `status`: `abierta`, `completa`, `cerrada`, `cancelada` |
| `ck_catalog_product_departures_1` | `CHECK (((sold >= 0) AND (sold <= capacity)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_departures_guide_id` | `USING btree (guide_id)` |
| `ix_catalog_product_departures_product_id_departure_date__1e9996` | `USING btree (product_id, departure_date, departure_time)` |
| `ix_catalog_product_departures_provider_id` | `USING btree (provider_id)` |
| `ix_catalog_product_departures_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_catalog_product_departures_tenant_id_departure_date` | `USING btree (tenant_id, departure_date)` |
| `ix_catalog_product_departures_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_catalog_product_departures_vehicle_id` | `USING btree (vehicle_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_departures_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_catalog_product_departures_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_destinations`

[Spec 02 §3.7] [Fase 1] Destinos secundarios del producto.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_destinations.tenant_id, catalog_products.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `destination_id` | `uuid` | no |  | FK → catalog_destinations.id. |
| 5 | `role` | `character varying(10)` | no | `'secondary'::character varying` |  |
| 6 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 7 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 8 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 9 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, destination_id` | `catalog_destinations.tenant_id, id` | NO ACTION | `fk_catalog_product_destinations_destination_id` |
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_destinations_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_destinations_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_product_destinations_product_id_destination_id` | `product_id, destination_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_product_destinations_role_check` | `CHECK (((role)::text = 'secondary'::text))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_destinations_destination_id` | `USING btree (destination_id)` |
| `ix_catalog_product_destinations_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_destinations_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_faqs`

[Spec 02 §3.7] [Fase 1] Preguntas frecuentes del producto.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `question` | `character varying(300)` | no |  |  |
| 5 | `answer` | `text` | no |  |  |
| 6 | `sort_order` | `smallint` | no | `0` |  |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 10 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_faqs_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_faqs_tenant_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_faqs_product_id` | `USING btree (product_id)` |
| `ix_catalog_product_faqs_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_faqs_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_inclusions`

[Spec 02 §3.7] [Fase 1] Incluye / no incluye.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `kind` | `character varying(10)` | no |  | Valores: `include`, `exclude`. |
| 5 | `text` | `character varying(200)` | no |  |  |
| 6 | `sort_order` | `smallint` | no | `0` |  |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 10 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_inclusions_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_inclusions_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_product_inclusions_product_id_kind_lower_text` | `product_id, kind, lower((text)::text)` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_product_inclusions_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['include'::character varying, 'exclude'::character varying])::text[])))` | `kind`: `include`, `exclude` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_inclusions_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_inclusions_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_items`

[Spec 02 §3.7] [Fase 1] Componentes del producto (servicio o producto; paquetes).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, catalog_products.tenant_id, catalog_providers.tenant_id, catalog_services.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `service_id` | `uuid` | sí |  | FK → catalog_services.id. |
| 5 | `component_product_id` | `uuid` | sí |  | FK → catalog_products.id. |
| 6 | `provider_id` | `uuid` | sí |  | FK → catalog_providers.id. |
| 7 | `quantity` | `numeric(8,2)` | no | `1` |  |
| 8 | `unit` | `character varying(20)` | no |  | Valores: `pax`, `servicio`, `habitación`, `noche`, `vehículo`, `unidad`. |
| 9 | `sort_order` | `smallint` | no | `0` |  |
| 10 | `is_required` | `boolean` | no | `true` |  |
| 11 | `is_included` | `boolean` | no | `true` |  |
| 12 | `unit_cost_override` | `numeric(14,2)` | sí |  |  |
| 13 | `notes` | `text` | sí |  |  |
| 14 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 15 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 16 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 17 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, component_product_id` | `catalog_products.tenant_id, id` | NO ACTION | `fk_catalog_product_items_component_product_id` |
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_items_product_id` |
| `tenant_id, provider_id` | `catalog_providers.tenant_id, id` | NO ACTION | `fk_catalog_product_items_provider_id` |
| `tenant_id, service_id` | `catalog_services.tenant_id, id` | NO ACTION | `fk_catalog_product_items_service_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_items_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_product_items_quantity_check` | `CHECK ((quantity >= (1)::numeric))` |  |
| `catalog_product_items_unit_check` | `CHECK (((unit)::text = ANY ((ARRAY['pax'::character varying, 'servicio'::character varying, 'habitación'::character varying, 'noche'::character varying, 'vehículo'::character varying, 'unidad'::character varying])::text[])))` | `unit`: `pax`, `servicio`, `habitación`, `noche`, `vehículo`, `unidad` |
| `ck_catalog_product_items_1` | `CHECK ((num_nonnulls(service_id, component_product_id) = 1))` |  |
| `ck_catalog_product_items_2` | `CHECK (((component_product_id IS NULL) OR (component_product_id <> product_id)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_items_component_product_id` | `USING btree (component_product_id)` |
| `ix_catalog_product_items_product_id_sort_order` | `USING btree (product_id, sort_order)` |
| `ix_catalog_product_items_provider_id` | `USING btree (provider_id)` |
| `ix_catalog_product_items_service_id` | `USING btree (service_id)` |
| `ix_catalog_product_items_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_items_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_media`

[Spec 02 §3.7] [Fase 1] Galería del producto.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `kind` | `character varying(10)` | no | `'image'::character varying` |  |
| 5 | `storage_path` | `character varying(400)` | no |  |  |
| 6 | `alt_text` | `character varying(200)` | no |  |  |
| 7 | `is_main` | `boolean` | no | `false` |  |
| 8 | `sort_order` | `smallint` | no | `0` |  |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 12 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 13 | `alt_i18n` | `jsonb` | sí |  | Columnas agregadas en Fase 2 por spec 15 §3.11 [Agregada en `30_fase2.sql`] |
| 14 | `caption_i18n` | `jsonb` | sí |  | Columnas agregadas en Fase 2 por spec 15 §3.11 [Agregada en `30_fase2.sql`] |
| 15 | `width` | `integer` | sí |  | Columnas agregadas en Fase 2 por spec 15 §3.11 [Agregada en `30_fase2.sql`] |
| 16 | `height` | `integer` | sí |  | Columnas agregadas en Fase 2 por spec 15 §3.11 [Agregada en `30_fase2.sql`] |
| 17 | `blurhash` | `character varying(60)` | sí |  | Columnas agregadas en Fase 2 por spec 15 §3.11 [Agregada en `30_fase2.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_media_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_media_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_product_media_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_product_media_product_id_p` | `product_id` | `is_main` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_product_media_kind_check` | `CHECK (((kind)::text = 'image'::text))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_media_product_id` | `USING btree (product_id)` |
| `ix_catalog_product_media_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_media_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_policies`

[Spec 02 §3.7] [Fase 1] Políticas comerciales 1:1 con producto.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `cancellation` | `text` | no |  |  |
| 5 | `modification` | `text` | no |  |  |
| 6 | `no_show` | `text` | no |  |  |
| 7 | `penalties` | `text` | sí |  |  |
| 8 | `refund` | `text` | no |  |  |
| 9 | `date_change` | `text` | sí |  |  |
| 10 | `advance_min` | `character varying(40)` | sí |  |  |
| 11 | `advance_max` | `character varying(40)` | sí |  |  |
| 12 | `penalty_tiers` | `jsonb` | no | `'[]'::jsonb` |  |
| 13 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 14 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 15 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 16 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_policies_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_policies_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_product_policies_product_id` | `product_id` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_policies_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_policies_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_promotions`

[Spec 02 §3.7 + 08 §3.9] [Fase 1] Promociones por producto (códigos promocionales).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → mkt_campaigns.tenant_id, catalog_products.tenant_id, tenants.id. |
| 3 | `ref` | `character varying(20)` | no |  |  |
| 4 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 5 | `name` | `character varying(120)` | no |  |  |
| 6 | `kind` | `character varying(30)` | no |  | Valores: `Precio promocional`, `Descuento fijo`, `Descuento %`, `Promoción por fecha`, `Descuento por cantidad`, `Promoción por temporada`, `Promoción por canal`, `Código promocional`. |
| 7 | `value` | `numeric(12,2)` | no |  |  |
| 8 | `channel` | `character varying(20)` | no | `'Todos'::character varying` | Valores: `Todos`, `Directo`, `E-commerce`, `B2B`, `Corporativo`. |
| 9 | `promo_code` | `character varying(40)` | sí |  |  |
| 10 | `min_pax` | `smallint` | sí |  |  |
| 11 | `date_from` | `date` | no |  |  |
| 12 | `date_to` | `date` | no |  |  |
| 13 | `status` | `character varying(10)` | no | `'activa'::character varying` | Valores: `activa`, `inactiva`. |
| 14 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 15 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 16 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 17 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 18 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |
| 19 | `campaign_id` | `uuid` | sí |  | Columnas agregadas en Fase 3 por spec 14 §3.17 FK → mkt_campaigns.id. [Agregada en `40_fase3.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, campaign_id` | `mkt_campaigns.tenant_id, id` | NO ACTION | `fk_catalog_product_promotions_campaign_id` |
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_promotions_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_promotions_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_product_promotions_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_product_promotions_tenant_id_promo_code_p` | `tenant_id, promo_code` | `((promo_code IS NOT NULL) AND (deleted_at IS NULL))` | índice único |
| `uq_catalog_product_promotions_tenant_id_ref` | `tenant_id, ref` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_product_promotions_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['Todos'::character varying, 'Directo'::character varying, 'E-commerce'::character varying, 'B2B'::character varying, 'Corporativo'::character varying])::text[])))` | `channel`: `Todos`, `Directo`, `E-commerce`, `B2B`, `Corporativo` |
| `catalog_product_promotions_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['Precio promocional'::character varying, 'Descuento fijo'::character varying, 'Descuento %'::character varying, 'Promoción por fecha'::character varying, 'Descuento por cantidad'::character varying, 'Promoción por temporada'::character varying, 'Promoción por canal'::character varying, 'Código promocional'::character varying])::text[])))` | `kind`: `Precio promocional`, `Descuento fijo`, `Descuento %`, `Promoción por fecha`, `Descuento por cantidad`, `Promoción por temporada`, `Promoción por canal`, `Código promocional` |
| `catalog_product_promotions_promo_code_check` | `CHECK (((promo_code IS NULL) OR ((promo_code)::text = upper((promo_code)::text))))` |  |
| `catalog_product_promotions_status_check` | `CHECK (((status)::text = ANY ((ARRAY['activa'::character varying, 'inactiva'::character varying])::text[])))` | `status`: `activa`, `inactiva` |
| `catalog_product_promotions_value_check` | `CHECK ((value > (0)::numeric))` |  |
| `ck_catalog_product_promotions_1` | `CHECK ((date_to >= date_from))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_promotions_campaign_id` | `USING btree (campaign_id)` |
| `ix_catalog_product_promotions_product_id` | `USING btree (product_id)` |
| `ix_catalog_product_promotions_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_catalog_product_promotions_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_promotions_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_related`

[Spec 02 §3.7] [Fase 1] Productos relacionados (cross-sell/upsell).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, catalog_products.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `related_product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 5 | `relation` | `character varying(20)` | no |  | Valores: `Complementario`, `Alternativo`, `Upgrade`, `Cross-sell`, `Upsell`. |
| 6 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 7 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 8 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 9 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_related_product_id` |
| `tenant_id, related_product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_related_related_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_related_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_product_related_product_id_related_product_id` | `product_id, related_product_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_product_related_relation_check` | `CHECK (((relation)::text = ANY ((ARRAY['Complementario'::character varying, 'Alternativo'::character varying, 'Upgrade'::character varying, 'Cross-sell'::character varying, 'Upsell'::character varying])::text[])))` | `relation`: `Complementario`, `Alternativo`, `Upgrade`, `Cross-sell`, `Upsell` |
| `ck_catalog_product_related_1` | `CHECK ((related_product_id <> product_id))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_related_related_product_id` | `USING btree (related_product_id)` |
| `ix_catalog_product_related_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_related_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_requirements`

[Spec 02 §3.7] [Fase 1] Requisitos del producto.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `category` | `character varying(30)` | sí |  | Valores: `Condición física`, `Documentos`, `Nacionalidad`, `Restricción`, `Recomendación`, `Equipamiento`, `Requisito especial`. |
| 5 | `text` | `character varying(300)` | no |  |  |
| 6 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 7 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 8 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 9 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_requirements_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_requirements_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_product_requirements_category_check` | `CHECK (((category IS NULL) OR ((category)::text = ANY ((ARRAY['Condición física'::character varying, 'Documentos'::character varying, 'Nacionalidad'::character varying, 'Restricción'::character varying, 'Recomendación'::character varying, 'Equipamiento'::character varying, 'Requisito especial'::character varying])::text[]))))` | `category`: `Condición física`, `Documentos`, `Nacionalidad`, `Restricción`, `Recomendación`, `Equipamiento`, `Requisito especial` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_requirements_product_id` | `USING btree (product_id)` |
| `ix_catalog_product_requirements_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_requirements_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_seasons`

[Spec 02 §3.7] [Fase 1] Temporadas asociadas al producto.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, catalog_seasons.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `season_id` | `uuid` | no |  | FK → catalog_seasons.id. |
| 5 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 6 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 7 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 8 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_seasons_product_id` |
| `tenant_id, season_id` | `catalog_seasons.tenant_id, id` | NO ACTION | `fk_catalog_product_seasons_season_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_seasons_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_product_seasons_product_id_season_id` | `product_id, season_id` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_seasons_season_id` | `USING btree (season_id)` |
| `ix_catalog_product_seasons_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_seasons_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_subcategories`

[Spec 02 §3.2] [Fase 1] Subcategorías de producto.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_product_categories.tenant_id, tenants.id. |
| 3 | `category_id` | `uuid` | no |  | FK → catalog_product_categories.id. |
| 4 | `name` | `character varying(80)` | no |  |  |
| 5 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 6 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 7 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 8 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 9 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, category_id` | `catalog_product_categories.tenant_id, id` | NO ACTION | `fk_catalog_product_subcategories_category_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_subcategories_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_product_subcategories_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_product_subcategories_category_id_lower_name` | `category_id, lower((name)::text)` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_subcategories_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_subcategories_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_types`

[Spec 02 §3.1] [Fase 1] Tipos de producto (TOUR, EXCURSIÓN, PAQUETE…).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `name` | `character varying(60)` | no |  |  |
| 4 | `requires_itinerary` | `boolean` | no | `false` |  |
| 5 | `requires_components` | `boolean` | no | `true` |  |
| 6 | `sort_order` | `smallint` | no | `0` |  |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 10 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 11 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_types_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_product_types_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_product_types_tenant_id_lower_name` | `tenant_id, lower((name)::text)` |  | índice único |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_types_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_versions`

[Spec 02 §3.7] [Fase 1] Versiones inmutables del producto (snapshot).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `version` | `character varying(10)` | no |  |  |
| 5 | `status` | `character varying(15)` | no | `'borrador'::character varying` | Valores: `borrador`, `en_revision`, `vigente`, `historica`. |
| 6 | `valid_from` | `date` | no |  |  |
| 7 | `reason` | `text` | no |  |  |
| 8 | `snapshot` | `jsonb` | no |  |  |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_versions_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_versions_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_product_versions_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_product_versions_product_id_p` | `product_id` | `((status)::text = 'vigente'::text)` | índice único |
| `uq_catalog_product_versions_product_id_version` | `product_id, version` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_product_versions_status_check` | `CHECK (((status)::text = ANY ((ARRAY['borrador'::character varying, 'en_revision'::character varying, 'vigente'::character varying, 'historica'::character varying])::text[])))` | `status`: `borrador`, `en_revision`, `vigente`, `historica` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_versions_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_versions_immutable` | BEFORE DELETE OR UPDATE | `app_product_versions_immutable` |

[↑ Índice del dominio](#tablas)

### `catalog_products`

[Spec 02 §3.6 + 16 §3.3] [Fase 1] Ficha maestra de producto.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_product_categories.tenant_id, catalog_product_versions.tenant_id, catalog_providers.tenant_id, catalog_destinations.tenant_id, catalog_product_types.tenant_id, catalog_product_subcategories.tenant_id, tenants.id. |
| 3 | `ref` | `character varying(20)` | no |  |  |
| 4 | `code` | `character varying(30)` | no |  |  |
| 5 | `sku` | `character varying(40)` | no |  |  |
| 6 | `name` | `character varying(160)` | no |  |  |
| 7 | `internal_name` | `character varying(160)` | no |  |  |
| 8 | `product_type_id` | `uuid` | no |  | FK → catalog_product_types.id. |
| 9 | `category_id` | `uuid` | no |  | FK → catalog_product_categories.id. |
| 10 | `subcategory_id` | `uuid` | sí |  | FK → catalog_product_subcategories.id. |
| 11 | `primary_destination_id` | `uuid` | no |  | FK → catalog_destinations.id. |
| 12 | `status` | `character varying(20)` | no | `'DRAFT'::character varying` | Valores: `DRAFT`, `REVIEW`, `APPROVED`, `ACTIVE`, `SUSPENDED`, `INACTIVE`, `ARCHIVED`. |
| 13 | `short_description` | `text` | sí |  |  |
| 14 | `long_description` | `text` | sí |  |  |
| 15 | `duration_value` | `numeric(6,1)` | no |  |  |
| 16 | `duration_unit` | `character varying(10)` | no |  | Valores: `horas`, `días`, `noches`. |
| 17 | `modality` | `character varying(15)` | no |  | Valores: `Privado`, `Compartido`, `Grupal`. |
| 18 | `main_provider_id` | `uuid` | sí |  | FK → catalog_providers.id. |
| 19 | `minimum_passengers` | `smallint` | no | `1` |  |
| 20 | `maximum_passengers` | `smallint` | no | `1` |  |
| 21 | `minimum_age` | `smallint` | no | `0` |  |
| 22 | `maximum_age` | `smallint` | no | `99` |  |
| 23 | `booking_advance_min_days` | `smallint` | no | `0` |  |
| 24 | `booking_advance_max_days` | `smallint` | no | `365` |  |
| 25 | `is_bookable` | `boolean` | no | `true` |  |
| 26 | `is_quoteable` | `boolean` | no | `true` |  |
| 27 | `is_b2b` | `boolean` | no | `false` |  |
| 28 | `is_ecommerce` | `boolean` | no | `false` |  |
| 29 | `is_featured` | `boolean` | no | `false` |  |
| 30 | `markup_pct` | `numeric(6,2)` | no | `25` |  |
| 31 | `availability_model` | `character varying(20)` | no | `'SIN_CONTROL'::character varying` | Valores: `SIN_CONTROL`, `CUPOS`, `CAPACIDAD`, `POR_PROVEEDOR`, `POR_ACTIVIDAD`, `POR_TRANSPORTE`, `POR_HABITACION`, `POR_SALIDA`, `POR_FECHA`. |
| 32 | `availability_capacity` | `integer` | sí |  |  |
| 33 | `availability_source` | `character varying(10)` | no | `'interna'::character varying` | Valores: `interna`, `externa`. |
| 34 | `features` | `jsonb` | no | `'[]'::jsonb` |  |
| 35 | `video_url` | `character varying(500)` | sí |  |  |
| 36 | `seo_title` | `character varying(120)` | sí |  |  |
| 37 | `seo_description` | `character varying(320)` | sí |  |  |
| 38 | `slug` | `character varying(160)` | sí |  |  |
| 39 | `current_version_id` | `uuid` | sí |  | FK → catalog_product_versions.id. |
| 40 | `attributes` | `jsonb` | no | `'{}'::jsonb` |  |
| 41 | `operating_weekdays` | `smallint[]` | no | `'{0,1,2,3,4,5,6}'::smallint[]` |  |
| 42 | `cutoff_hours` | `integer` | sí |  |  |
| 43 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 44 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 45 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 46 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 47 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 48 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |
| 49 | `accommodation_enabled` | `boolean` | no | `false` | Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11 [Agregada en `30_fase2.sql`] |
| 50 | `accommodation_optional` | `boolean` | no | `true` | Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11 [Agregada en `30_fase2.sql`] |
| 51 | `accommodation_currency` | `character(3)` | sí |  | Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11 [Agregada en `30_fase2.sql`] |
| 52 | `accommodation_note` | `text` | sí |  | Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11 [Agregada en `30_fase2.sql`] |
| 53 | `pickup_required` | `boolean` | no | `false` | Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11 [Agregada en `30_fase2.sql`] |
| 54 | `pickup_ask_flight` | `boolean` | no | `false` | Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11 [Agregada en `30_fase2.sql`] |
| 55 | `difficulty` | `character varying(30)` | sí |  | Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11 Valores: `facil`, `moderada`, `moderada_exigente`, `exigente`. [Agregada en `30_fase2.sql`] |
| 56 | `guide_languages` | `character(2)[]` | no | `'{}'::bpchar[]` | Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11 [Agregada en `30_fase2.sql`] |
| 57 | `pickup_text` | `character varying(200)` | sí |  | Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11 [Agregada en `30_fase2.sql`] |
| 58 | `rating_avg` | `numeric(3,2)` | sí |  | Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11 [Agregada en `30_fase2.sql`] |
| 59 | `rating_count` | `integer` | no | `0` | Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11 [Agregada en `30_fase2.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, category_id` | `catalog_product_categories.tenant_id, id` | NO ACTION | `fk_catalog_products_category_id` |
| `tenant_id, current_version_id` | `catalog_product_versions.tenant_id, id` | NO ACTION · DEFERRABLE | `fk_catalog_products_current_version_id` |
| `tenant_id, main_provider_id` | `catalog_providers.tenant_id, id` | NO ACTION | `fk_catalog_products_main_provider_id` |
| `tenant_id, primary_destination_id` | `catalog_destinations.tenant_id, id` | NO ACTION | `fk_catalog_products_primary_destination_id` |
| `tenant_id, product_type_id` | `catalog_product_types.tenant_id, id` | NO ACTION | `fk_catalog_products_product_type_id` |
| `tenant_id, subcategory_id` | `catalog_product_subcategories.tenant_id, id` | NO ACTION | `fk_catalog_products_subcategory_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_products_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_products_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_products_tenant_id_lower_code` | `tenant_id, lower((code)::text)` |  | índice único |
| `uq_catalog_products_tenant_id_ref` | `tenant_id, ref` |  | índice único |
| `uq_catalog_products_tenant_id_slug_p` | `tenant_id, slug` | `(slug IS NOT NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_products_availability_model_check` | `CHECK (((availability_model)::text = ANY ((ARRAY['SIN_CONTROL'::character varying, 'CUPOS'::character varying, 'CAPACIDAD'::character varying, 'POR_PROVEEDOR'::character varying, 'POR_ACTIVIDAD'::character varying, 'POR_TRANSPORTE'::character varying, 'POR_HABITACION'::character varying, 'POR_SALIDA'::character varying, 'POR_FECHA'::character varying])::text[])))` | `availability_model`: `SIN_CONTROL`, `CUPOS`, `CAPACIDAD`, `POR_PROVEEDOR`, `POR_ACTIVIDAD`, `POR_TRANSPORTE`, `POR_HABITACION`, `POR_SALIDA`, `POR_FECHA` |
| `catalog_products_availability_source_check` | `CHECK (((availability_source)::text = ANY ((ARRAY['interna'::character varying, 'externa'::character varying])::text[])))` | `availability_source`: `interna`, `externa` |
| `catalog_products_cutoff_hours_check` | `CHECK (((cutoff_hours >= 0) AND (cutoff_hours <= 8760)))` |  |
| `catalog_products_difficulty_check` | `CHECK (((difficulty IS NULL) OR ((difficulty)::text = ANY ((ARRAY['facil'::character varying, 'moderada'::character varying, 'moderada_exigente'::character varying, 'exigente'::character varying])::text[]))))` | `difficulty`: `facil`, `moderada`, `moderada_exigente`, `exigente` |
| `catalog_products_duration_unit_check` | `CHECK (((duration_unit)::text = ANY ((ARRAY['horas'::character varying, 'días'::character varying, 'noches'::character varying])::text[])))` | `duration_unit`: `horas`, `días`, `noches` |
| `catalog_products_duration_value_check` | `CHECK ((duration_value >= (1)::numeric))` |  |
| `catalog_products_modality_check` | `CHECK (((modality)::text = ANY ((ARRAY['Privado'::character varying, 'Compartido'::character varying, 'Grupal'::character varying])::text[])))` | `modality`: `Privado`, `Compartido`, `Grupal` |
| `catalog_products_operating_weekdays_check` | `CHECK ((cardinality(operating_weekdays) >= 1))` |  |
| `catalog_products_slug_check` | `CHECK (((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))` |  |
| `catalog_products_status_check` | `CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'REVIEW'::character varying, 'APPROVED'::character varying, 'ACTIVE'::character varying, 'SUSPENDED'::character varying, 'INACTIVE'::character varying, 'ARCHIVED'::character varying])::text[])))` | `status`: `DRAFT`, `REVIEW`, `APPROVED`, `ACTIVE`, `SUSPENDED`, `INACTIVE`, `ARCHIVED` |
| `ck_catalog_products_1` | `CHECK (((minimum_passengers >= 1) AND (maximum_passengers >= minimum_passengers)))` |  |
| `ck_catalog_products_2` | `CHECK (((minimum_age >= 0) AND (maximum_age >= minimum_age)))` |  |
| `ck_catalog_products_3` | `CHECK ((booking_advance_max_days >= booking_advance_min_days))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_products_category_id` | `USING btree (category_id)` |
| `ix_catalog_products_current_version_id` | `USING btree (current_version_id)` |
| `ix_catalog_products_main_provider_id` | `USING btree (main_provider_id)` |
| `ix_catalog_products_name_code_sku_gin_trgm_ops` | `USING gin (((((((name)::text \|\| ' '::text) \|\| (code)::text) \|\| ' '::text) \|\| (sku)::text)) gin_trgm_ops)` |
| `ix_catalog_products_primary_destination_id` | `USING btree (primary_destination_id)` |
| `ix_catalog_products_product_type_id` | `USING btree (product_type_id)` |
| `ix_catalog_products_subcategory_id` | `USING btree (subcategory_id)` |
| `ix_catalog_products_tenant_id_category_id` | `USING btree (tenant_id, category_id)` |
| `ix_catalog_products_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_catalog_products_tenant_id_primary_destination_id` | `USING btree (tenant_id, primary_destination_id)` |
| `ix_catalog_products_tenant_id_product_type_id` | `USING btree (tenant_id, product_type_id)` |
| `ix_catalog_products_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_products_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_catalog_products_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_provider_contacts`

[Spec 02 §3.4] [Fase 1] Contactos adicionales del proveedor.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_providers.tenant_id, tenants.id. |
| 3 | `provider_id` | `uuid` | no |  | FK → catalog_providers.id. |
| 4 | `name` | `character varying(120)` | no |  |  |
| 5 | `role` | `character varying(80)` | sí |  |  |
| 6 | `phone` | `character varying(40)` | sí |  |  |
| 7 | `email` | `character varying(160)` | sí |  |  |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 9 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 11 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, provider_id` | `catalog_providers.tenant_id, id` | CASCADE | `fk_catalog_provider_contacts_provider_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_provider_contacts_tenant_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_provider_contacts_provider_id` | `USING btree (provider_id)` |
| `ix_catalog_provider_contacts_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_provider_contacts_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_providers`

[Spec 02 §3.4] [Fase 1] Proveedores (hoteles, transporte, guías…).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `ref` | `character varying(20)` | no |  |  |
| 4 | `name` | `character varying(160)` | no |  |  |
| 5 | `type` | `character varying(20)` | no |  | Valores: `Hotel`, `Transporte`, `Tren`, `Guía`, `Conductor`, `Restaurante`, `Operador`, `Actividad`, `Entrada`, `Otros`. |
| 6 | `ruc` | `character(11)` | no |  |  |
| 7 | `city` | `character varying(80)` | sí |  |  |
| 8 | `stars` | `smallint` | sí |  |  |
| 9 | `contact_name` | `character varying(120)` | no |  |  |
| 10 | `phone` | `character varying(40)` | sí |  |  |
| 11 | `email` | `character varying(160)` | sí |  |  |
| 12 | `contract_start` | `date` | no |  |  |
| 13 | `contract_end` | `date` | no |  |  |
| 14 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 15 | `payment_terms` | `character varying(120)` | sí |  |  |
| 16 | `status` | `character varying(20)` | no | `'inactivo'::character varying` | Valores: `activo`, `inactivo`, `vencido`. |
| 17 | `rating` | `numeric(2,1)` | no | `0` |  |
| 18 | `rating_note` | `text` | sí |  |  |
| 19 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 20 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 21 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 22 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 23 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_providers_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_providers_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_providers_tenant_id_ref` | `tenant_id, ref` |  | índice único |
| `uq_catalog_providers_tenant_id_ruc` | `tenant_id, ruc` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_providers_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `catalog_providers_rating_check` | `CHECK (((rating = (0)::numeric) OR ((rating >= (1)::numeric) AND (rating <= (5)::numeric))))` |  |
| `catalog_providers_ruc_check` | `CHECK ((ruc ~ '^(10\|15\|17\|20)[0-9]{9}$'::text))` |  |
| `catalog_providers_stars_check` | `CHECK (((stars >= 0) AND (stars <= 5)))` |  |
| `catalog_providers_status_check` | `CHECK (((status)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying, 'vencido'::character varying])::text[])))` | `status`: `activo`, `inactivo`, `vencido` |
| `catalog_providers_type_check` | `CHECK (((type)::text = ANY ((ARRAY['Hotel'::character varying, 'Transporte'::character varying, 'Tren'::character varying, 'Guía'::character varying, 'Conductor'::character varying, 'Restaurante'::character varying, 'Operador'::character varying, 'Actividad'::character varying, 'Entrada'::character varying, 'Otros'::character varying])::text[])))` | `type`: `Hotel`, `Transporte`, `Tren`, `Guía`, `Conductor`, `Restaurante`, `Operador`, `Actividad`, `Entrada`, `Otros` |
| `ck_catalog_providers_1` | `CHECK ((contract_end >= contract_start))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_providers_name_gin_trgm_ops` | `USING gin (name gin_trgm_ops)` |
| `ix_catalog_providers_tenant_id_contract_end` | `USING btree (tenant_id, contract_end)` |
| `ix_catalog_providers_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_catalog_providers_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_providers_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_rate_conditions`

[Spec 02 §3.8] [Fase 1] Condiciones estructuradas de tarifa (propuesta; el prototipo no la usa).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_rates.tenant_id, tenants.id. |
| 3 | `rate_id` | `uuid` | no |  | FK → catalog_rates.id. |
| 4 | `kind` | `character varying(20)` | no |  | Valores: `weekday`, `min_pax`, `max_pax`, `min_age`, `max_age`, `advance_days_min`, `advance_days_max`, `customer_type`, `occupancy`, `duration`. |
| 5 | `operator` | `character varying(4)` | no |  |  |
| 6 | `value` | `jsonb` | no |  |  |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 10 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, rate_id` | `catalog_rates.tenant_id, id` | CASCADE | `fk_catalog_rate_conditions_rate_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_rate_conditions_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_rate_conditions_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['weekday'::character varying, 'min_pax'::character varying, 'max_pax'::character varying, 'min_age'::character varying, 'max_age'::character varying, 'advance_days_min'::character varying, 'advance_days_max'::character varying, 'customer_type'::character varying, 'occupancy'::character varying, 'duration'::character varying])::text[])))` | `kind`: `weekday`, `min_pax`, `max_pax`, `min_age`, `max_age`, `advance_days_min`, `advance_days_max`, `customer_type`, `occupancy`, `duration` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_rate_conditions_rate_id` | `USING btree (rate_id)` |
| `ix_catalog_rate_conditions_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_rate_conditions_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_rates`

[Spec 02 §3.8] [Fase 1] Tarifas del producto por segmento/canal/vigencia.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, catalog_seasons.tenant_id, tenants.id. |
| 3 | `ref` | `character varying(20)` | no |  |  |
| 4 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 5 | `rate_type` | `character varying(15)` | no |  | Valores: `Proveedor`, `Costo`, `Venta`, `Retail`, `B2B`, `Mayorista`, `Corporativa`, `VIP`, `Promocional`, `Especial`, `Grupal`. |
| 6 | `segment` | `character varying(10)` | no |  | Valores: `Adulto`, `Niño`, `Infante`, `Pasajero`, `Grupo`. |
| 7 | `channel` | `character varying(12)` | no |  | Valores: `Directo`, `B2B`, `Corporativo`, `E-commerce`, `Mayorista`, `Todos`. |
| 8 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 9 | `price_basis` | `character varying(15)` | no | `'Por persona'::character varying` | Valores: `Por persona`, `Precio fijo`, `Por grupo`, `Por habitación`, `Por unidad`. |
| 10 | `cost` | `numeric(14,2)` | no |  |  |
| 11 | `price` | `numeric(14,2)` | no |  |  |
| 12 | `min_price` | `numeric(14,2)` | sí |  |  |
| 13 | `max_price` | `numeric(14,2)` | sí |  |  |
| 14 | `valid_from` | `date` | no |  |  |
| 15 | `valid_to` | `date` | no |  |  |
| 16 | `season_id` | `uuid` | sí |  | FK → catalog_seasons.id. |
| 17 | `conditions` | `character varying(300)` | sí |  |  |
| 18 | `status` | `character varying(10)` | no | `'vigente'::character varying` | Valores: `vigente`, `inactiva`. |
| 19 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 20 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 21 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 22 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 23 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | NO ACTION | `fk_catalog_rates_product_id` |
| `tenant_id, season_id` | `catalog_seasons.tenant_id, id` | NO ACTION | `fk_catalog_rates_season_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_rates_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_rates_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_rates_tenant_id_ref` | `tenant_id, ref` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_rates_channel_check` | `CHECK (((channel)::text = ANY ((ARRAY['Directo'::character varying, 'B2B'::character varying, 'Corporativo'::character varying, 'E-commerce'::character varying, 'Mayorista'::character varying, 'Todos'::character varying])::text[])))` | `channel`: `Directo`, `B2B`, `Corporativo`, `E-commerce`, `Mayorista`, `Todos` |
| `catalog_rates_cost_check` | `CHECK ((cost >= (0)::numeric))` |  |
| `catalog_rates_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `catalog_rates_price_basis_check` | `CHECK (((price_basis)::text = ANY ((ARRAY['Por persona'::character varying, 'Precio fijo'::character varying, 'Por grupo'::character varying, 'Por habitación'::character varying, 'Por unidad'::character varying])::text[])))` | `price_basis`: `Por persona`, `Precio fijo`, `Por grupo`, `Por habitación`, `Por unidad` |
| `catalog_rates_price_check` | `CHECK ((price > (0)::numeric))` |  |
| `catalog_rates_rate_type_check` | `CHECK (((rate_type)::text = ANY ((ARRAY['Proveedor'::character varying, 'Costo'::character varying, 'Venta'::character varying, 'Retail'::character varying, 'B2B'::character varying, 'Mayorista'::character varying, 'Corporativa'::character varying, 'VIP'::character varying, 'Promocional'::character varying, 'Especial'::character varying, 'Grupal'::character varying])::text[])))` | `rate_type`: `Proveedor`, `Costo`, `Venta`, `Retail`, `B2B`, `Mayorista`, `Corporativa`, `VIP`, `Promocional`, `Especial`, `Grupal` |
| `catalog_rates_segment_check` | `CHECK (((segment)::text = ANY ((ARRAY['Adulto'::character varying, 'Niño'::character varying, 'Infante'::character varying, 'Pasajero'::character varying, 'Grupo'::character varying])::text[])))` | `segment`: `Adulto`, `Niño`, `Infante`, `Pasajero`, `Grupo` |
| `catalog_rates_status_check` | `CHECK (((status)::text = ANY ((ARRAY['vigente'::character varying, 'inactiva'::character varying])::text[])))` | `status`: `vigente`, `inactiva` |
| `ck_catalog_rates_1` | `CHECK ((valid_to >= valid_from))` |  |
| `ck_catalog_rates_2` | `CHECK (((min_price IS NULL) OR (price >= min_price)))` |  |
| `ck_catalog_rates_3` | `CHECK (((max_price IS NULL) OR (price <= max_price)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_rates_product_id_segment_channel_valid_from_valid_to` | `USING btree (product_id, segment, channel, valid_from, valid_to)` |
| `ix_catalog_rates_season_id` | `USING btree (season_id)` |
| `ix_catalog_rates_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_catalog_rates_tenant_id_product_id` | `USING btree (tenant_id, product_id)` |
| `ix_catalog_rates_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_catalog_rates_tenant_id_valid_to` | `USING btree (tenant_id, valid_to)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_rates_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_catalog_rates_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_seasons`

[Spec 02 §3.8] [Fase 1] Temporadas (factor de precio).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → tenants.id. |
| 3 | `ref` | `character varying(20)` | no |  |  |
| 4 | `name` | `character varying(120)` | no |  |  |
| 5 | `type` | `character varying(20)` | no |  | Valores: `Alta`, `Media`, `Baja`, `Feriado`, `Fecha especial`, `Personalizada`. |
| 6 | `date_from` | `date` | no |  |  |
| 7 | `date_to` | `date` | no |  |  |
| 8 | `priority` | `smallint` | no | `0` |  |
| 9 | `factor` | `numeric(4,2)` | no | `1` |  |
| 10 | `status` | `character varying(10)` | no | `'activa'::character varying` | Valores: `activa`, `inactiva`. |
| 11 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 12 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 13 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 14 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 15 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_seasons_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_seasons_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_seasons_tenant_id_ref` | `tenant_id, ref` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_seasons_factor_check` | `CHECK (((factor > (0)::numeric) AND (factor <= (3)::numeric)))` |  |
| `catalog_seasons_priority_check` | `CHECK ((priority >= 0))` |  |
| `catalog_seasons_status_check` | `CHECK (((status)::text = ANY ((ARRAY['activa'::character varying, 'inactiva'::character varying])::text[])))` | `status`: `activa`, `inactiva` |
| `catalog_seasons_type_check` | `CHECK (((type)::text = ANY ((ARRAY['Alta'::character varying, 'Media'::character varying, 'Baja'::character varying, 'Feriado'::character varying, 'Fecha especial'::character varying, 'Personalizada'::character varying])::text[])))` | `type`: `Alta`, `Media`, `Baja`, `Feriado`, `Fecha especial`, `Personalizada` |
| `ck_catalog_seasons_1` | `CHECK ((date_to >= date_from))` |  |

**EXCLUDE**

- `ex_catalog_seasons_overlap`: `EXCLUDE USING gist (tenant_id WITH =, priority WITH =, daterange(date_from, date_to, '[]'::text) WITH &&) WHERE ((((status)::text = 'activa'::text) AND (deleted_at IS NULL)))`

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_seasons_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_catalog_seasons_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_seasons_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_services`

[Spec 02 §3.5] [Fase 1] Servicios de proveedor (componentes de costo).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 1 · MVP (`20_fase1.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_providers.tenant_id, tenants.id. |
| 3 | `ref` | `character varying(20)` | no |  |  |
| 4 | `provider_id` | `uuid` | no |  | FK → catalog_providers.id. |
| 5 | `name` | `character varying(200)` | no |  |  |
| 6 | `type` | `character varying(20)` | no |  | Valores: `Traslado`, `Transporte`, `Tren`, `Entrada`, `Guía`, `Alimentación`, `Alojamiento`, `Actividad`, `Tour`, `Seguro`, `Otro`. |
| 7 | `unit` | `character varying(20)` | no |  | Valores: `pax`, `servicio`, `habitación`, `noche`, `vehículo`, `unidad`. |
| 8 | `cost` | `numeric(14,2)` | no |  |  |
| 9 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 10 | `capacity` | `integer` | sí |  |  |
| 11 | `valid_from` | `date` | no |  |  |
| 12 | `valid_to` | `date` | no |  |  |
| 13 | `status` | `character varying(20)` | no | `'activo'::character varying` | Valores: `activo`, `inactivo`, `vencido`. |
| 14 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 15 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 16 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 17 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 18 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |
| 19 | `scheduled_cost` | `numeric(14,2)` | sí |  | Columnas agregadas en Fase 2 por spec 10 §3.11 [Agregada en `30_fase2.sql`] |
| 20 | `scheduled_cost_from` | `date` | sí |  | Columnas agregadas en Fase 2 por spec 10 §3.11 [Agregada en `30_fase2.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, provider_id` | `catalog_providers.tenant_id, id` | NO ACTION | `fk_catalog_services_provider_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_services_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_services_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_services_tenant_id_ref` | `tenant_id, ref` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_services_cost_check` | `CHECK ((cost >= (0)::numeric))` |  |
| `catalog_services_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `catalog_services_status_check` | `CHECK (((status)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying, 'vencido'::character varying])::text[])))` | `status`: `activo`, `inactivo`, `vencido` |
| `catalog_services_type_check` | `CHECK (((type)::text = ANY ((ARRAY['Traslado'::character varying, 'Transporte'::character varying, 'Tren'::character varying, 'Entrada'::character varying, 'Guía'::character varying, 'Alimentación'::character varying, 'Alojamiento'::character varying, 'Actividad'::character varying, 'Tour'::character varying, 'Seguro'::character varying, 'Otro'::character varying])::text[])))` | `type`: `Traslado`, `Transporte`, `Tren`, `Entrada`, `Guía`, `Alimentación`, `Alojamiento`, `Actividad`, `Tour`, `Seguro`, `Otro` |
| `catalog_services_unit_check` | `CHECK (((unit)::text = ANY ((ARRAY['pax'::character varying, 'servicio'::character varying, 'habitación'::character varying, 'noche'::character varying, 'vehículo'::character varying, 'unidad'::character varying])::text[])))` | `unit`: `pax`, `servicio`, `habitación`, `noche`, `vehículo`, `unidad` |
| `ck_catalog_services_1` | `CHECK ((valid_to >= valid_from))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_services_provider_id` | `USING btree (provider_id)` |
| `ix_catalog_services_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_catalog_services_tenant_id_provider_id` | `USING btree (tenant_id, provider_id)` |
| `ix_catalog_services_tenant_id_status` | `USING btree (tenant_id, status)` |
| `ix_catalog_services_tenant_id_valid_to` | `USING btree (tenant_id, valid_to)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_services_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_accommodation_hotels`

[Spec 16 §3.6] [Fase 2] Hoteles por tramo.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_accommodation_legs.tenant_id, catalog_providers.tenant_id, tenants.id. |
| 3 | `leg_id` | `uuid` | no |  | FK → catalog_accommodation_legs.id. |
| 4 | `code` | `character varying(20)` | no |  |  |
| 5 | `name` | `character varying(150)` | no |  |  |
| 6 | `category` | `character varying(30)` | no |  |  |
| 7 | `provider_id` | `uuid` | sí |  | FK → catalog_providers.id. |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 9 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 11 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, leg_id` | `catalog_accommodation_legs.tenant_id, id` | CASCADE | `fk_catalog_accommodation_hotels_leg_id` |
| `tenant_id, provider_id` | `catalog_providers.tenant_id, id` | NO ACTION | `fk_catalog_accommodation_hotels_provider_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_accommodation_hotels_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_accommodation_hotels_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_accommodation_hotels_leg_id_lower_name` | `leg_id, lower((name)::text)` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_accommodation_hotels_provider_id` | `USING btree (provider_id)` |
| `ix_catalog_accommodation_hotels_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_accommodation_hotels_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_accommodation_legs`

[Spec 16 §3.6] [Fase 2] Tramos de alojamiento del circuito.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_destinations.tenant_id, catalog_products.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `code` | `character varying(20)` | no |  |  |
| 5 | `sequence` | `smallint` | no |  |  |
| 6 | `city` | `character varying(80)` | no |  |  |
| 7 | `destination_id` | `uuid` | sí |  | FK → catalog_destinations.id. |
| 8 | `nights` | `smallint` | no |  |  |
| 9 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 10 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 11 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 12 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 13 | `min_nights` | `smallint` | sí |  | [Agregada en `40_fase3.sql`] |
| 14 | `max_nights` | `smallint` | sí |  | [Agregada en `40_fase3.sql`] |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, destination_id` | `catalog_destinations.tenant_id, id` | NO ACTION | `fk_catalog_accommodation_legs_destination_id` |
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_accommodation_legs_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_accommodation_legs_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_accommodation_legs_seq` | `product_id, sequence` |  | restricción DEFERRABLE |
| `uq_tid_catalog_accommodation_legs_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_accommodation_legs_tenant_id_product_id_code` | `tenant_id, product_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_accommodation_legs_nights_check` | `CHECK (((nights >= 1) AND (nights <= 30)))` |  |
| `ck_catalog_accommodation_legs_nights_range` | `CHECK ((((min_nights IS NULL) AND (max_nights IS NULL)) OR (((min_nights >= 1) AND (min_nights <= 30)) AND ((max_nights >= min_nights) AND (max_nights <= 30)) AND ((nights >= min_nights) AND (nights <= max_nights)))))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_accommodation_legs_destination_id` | `USING btree (destination_id)` |
| `ix_catalog_accommodation_legs_product_id` | `USING btree (product_id)` |
| `ix_catalog_accommodation_legs_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_accommodation_legs_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_accommodation_room_types`

[Spec 16 §3.6] [Fase 2] Tipos de habitación y precio por noche.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_accommodation_hotels.tenant_id, tenants.id. |
| 3 | `hotel_id` | `uuid` | no |  | FK → catalog_accommodation_hotels.id. |
| 4 | `room_type` | `character varying(20)` | no |  |  |
| 5 | `capacity` | `smallint` | no |  |  |
| 6 | `price_per_night` | `numeric(14,2)` | no |  |  |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 10 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, hotel_id` | `catalog_accommodation_hotels.tenant_id, id` | CASCADE | `fk_catalog_accommodation_room_types_hotel_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_accommodation_room_types_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_accommodation_room_types_hotel_id_room_type` | `hotel_id, room_type` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_accommodation_room_types_capacity_check` | `CHECK (((capacity >= 1) AND (capacity <= 8)))` |  |
| `catalog_accommodation_room_types_price_per_night_check` | `CHECK ((price_per_night > (0)::numeric))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_accommodation_room_types_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_accommodation_room_types_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_allotment_charges`

[Spec 11 §3.5] [Fase 2] Penalidades por cupo no usado.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_allotment_days.tenant_id, fin_payables.tenant_id, tenants.id. |
| 3 | `allotment_day_id` | `uuid` | no |  | FK → catalog_allotment_days.id. |
| 4 | `qty` | `integer` | no |  |  |
| 5 | `amount` | `numeric(14,2)` | no |  |  |
| 6 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 7 | `fx_rate` | `numeric(12,6)` | sí |  |  |
| 8 | `reason` | `character varying(200)` | no |  |  |
| 9 | `payable_id` | `uuid` | sí |  | FK → fin_payables.id. |
| 10 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 11 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 13 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, allotment_day_id` | `catalog_allotment_days.tenant_id, id` | NO ACTION | `fk_catalog_allotment_charges_allotment_day_id` |
| `tenant_id, payable_id` | `fin_payables.tenant_id, id` | NO ACTION | `fk_catalog_allotment_charges_payable_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_allotment_charges_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_allotment_charges_allotment_day_id` | `allotment_day_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_allotment_charges_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_allotment_charges_payable_id` | `USING btree (payable_id)` |
| `ix_catalog_allotment_charges_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_allotment_charges_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_allotment_consumptions`

[Spec 11 §3.3] [Fase 2] Consumo de cupo por servicio de reserva (idempotente).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_allotment_days.tenant_id, booking_reservation_services.tenant_id, booking_reservations.tenant_id, tenants.id. |
| 3 | `allotment_day_id` | `uuid` | no |  | FK → catalog_allotment_days.id. |
| 4 | `booking_service_id` | `uuid` | no |  | FK → booking_reservation_services.id. |
| 5 | `reservation_id` | `uuid` | no |  | FK → booking_reservations.id. |
| 6 | `qty` | `integer` | no |  |  |
| 7 | `state` | `character varying(15)` | no |  | Valores: `consumido`, `en_tramite`, `revertido`. |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 9 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 11 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, allotment_day_id` | `catalog_allotment_days.tenant_id, id` | NO ACTION | `fk_catalog_allotment_consumptions_allotment_day_id` |
| `tenant_id, booking_service_id` | `booking_reservation_services.tenant_id, id` | NO ACTION | `fk_catalog_allotment_consumptions_booking_service_id` |
| `tenant_id, reservation_id` | `booking_reservations.tenant_id, id` | NO ACTION | `fk_catalog_allotment_consumptions_reservation_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_allotment_consumptions_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_allotment_consumptions_allotment_day_id_booki_483905` | `allotment_day_id, booking_service_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_allotment_consumptions_qty_check` | `CHECK ((qty > 0))` |  |
| `catalog_allotment_consumptions_state_check` | `CHECK (((state)::text = ANY ((ARRAY['consumido'::character varying, 'en_tramite'::character varying, 'revertido'::character varying])::text[])))` | `state`: `consumido`, `en_tramite`, `revertido` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_allotment_consumptions_booking_service_id` | `USING btree (booking_service_id)` |
| `ix_catalog_allotment_consumptions_reservation_id` | `USING btree (reservation_id)` |
| `ix_catalog_allotment_consumptions_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_allotment_consumptions_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_allotment_days`

[Spec 11 §3.2] [Fase 2] Cupo por contrato y fecha.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_allotments.tenant_id, iam_users.tenant_id, tenants.id. |
| 3 | `allotment_id` | `uuid` | no |  | FK → catalog_allotments.id. |
| 4 | `service_date` | `date` | no |  |  |
| 5 | `blocked_qty` | `integer` | no |  |  |
| 6 | `released_qty` | `integer` | no | `0` |  |
| 7 | `used_qty` | `integer` | no | `0` |  |
| 8 | `pending_qty` | `integer` | no | `0` |  |
| 9 | `release_deadline` | `date` | no |  |  |
| 10 | `retained_reason` | `character varying(200)` | sí |  |  |
| 11 | `retained_by` | `uuid` | sí |  | FK → iam_users.id. |
| 12 | `retained_at` | `timestamp with time zone` | sí |  |  |
| 13 | `closed_at` | `timestamp with time zone` | sí |  |  |
| 14 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 15 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 16 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 17 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 18 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, allotment_id` | `catalog_allotments.tenant_id, id` | CASCADE | `fk_catalog_allotment_days_allotment_id` |
| `tenant_id, retained_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_catalog_allotment_days_retained_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_allotment_days_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_allotment_days_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_allotment_days_allotment_id_service_date` | `allotment_id, service_date` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_allotment_days_blocked_qty_check` | `CHECK ((blocked_qty >= 0))` |  |
| `catalog_allotment_days_used_qty_check` | `CHECK ((used_qty >= 0))` |  |
| `ck_catalog_allotment_days_1` | `CHECK (((released_qty >= 0) AND (released_qty <= blocked_qty)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_allotment_days_retained_by` | `USING btree (retained_by)` |
| `ix_catalog_allotment_days_tenant_id_service_date` | `USING btree (tenant_id, service_date)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_allotment_days_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_catalog_allotment_days_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_allotment_events`

[Spec 11 §3.6] [Fase 2] Bitácora del contrato de cupo.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_allotments.tenant_id, tenants.id, iam_users.tenant_id. |
| 3 | `allotment_id` | `uuid` | no |  | FK → catalog_allotments.id. |
| 4 | `occurred_at` | `timestamp with time zone` | no | `now()` |  |
| 5 | `user_id` | `uuid` | sí |  | FK → iam_users.id. |
| 6 | `message` | `character varying(300)` | no |  |  |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, allotment_id` | `catalog_allotments.tenant_id, id` | NO ACTION | `fk_catalog_allotment_events_allotment_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_allotment_events_tenant_id` |
| `tenant_id, user_id` | `iam_users.tenant_id, id` | NO ACTION | `fk_catalog_allotment_events_user_id` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_allotment_events_allotment_id_occurred_at_desc` | `USING btree (allotment_id, occurred_at DESC)` |
| `ix_catalog_allotment_events_tenant_id` | `USING btree (tenant_id)` |
| `ix_catalog_allotment_events_user_id` | `USING btree (user_id)` |

[↑ Índice del dominio](#tablas)

### `catalog_allotment_requests`

[Spec 11 §3.4] [Fase 2] Solicitudes de ampliación de cupo.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_allotments.tenant_id, iam_users.tenant_id, tenants.id. |
| 3 | `code` | `character varying(20)` | no |  |  |
| 4 | `allotment_id` | `uuid` | no |  | FK → catalog_allotments.id. |
| 5 | `date_from` | `date` | no |  |  |
| 6 | `date_to` | `date` | no |  |  |
| 7 | `extra_qty` | `integer` | no |  |  |
| 8 | `note` | `text` | no |  |  |
| 9 | `status` | `character varying(15)` | no | `'solicitada'::character varying` | Valores: `solicitada`, `aceptada`, `rechazada`. |
| 10 | `response` | `text` | sí |  |  |
| 11 | `responded_at` | `timestamp with time zone` | sí |  |  |
| 12 | `responded_by` | `uuid` | sí |  | FK → iam_users.id. |
| 13 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 14 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 15 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 16 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, allotment_id` | `catalog_allotments.tenant_id, id` | NO ACTION | `fk_catalog_allotment_requests_allotment_id` |
| `tenant_id, responded_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_catalog_allotment_requests_responded_by` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_allotment_requests_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_allotment_requests_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_allotment_requests_extra_qty_check` | `CHECK ((extra_qty > 0))` |  |
| `catalog_allotment_requests_status_check` | `CHECK (((status)::text = ANY ((ARRAY['solicitada'::character varying, 'aceptada'::character varying, 'rechazada'::character varying])::text[])))` | `status`: `solicitada`, `aceptada`, `rechazada` |
| `ck_catalog_allotment_requests_1` | `CHECK ((date_to >= date_from))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_allotment_requests_allotment_id` | `USING btree (allotment_id)` |
| `ix_catalog_allotment_requests_responded_by` | `USING btree (responded_by)` |
| `ix_catalog_allotment_requests_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_catalog_allotment_requests_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_allotment_requests_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_allotments`

[Spec 11 §3.1] [Fase 2] Contratos de cupo (allotment) con proveedores.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, catalog_providers.tenant_id, catalog_services.tenant_id, tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `provider_id` | `uuid` | no |  | FK → catalog_providers.id. |
| 5 | `service_id` | `uuid` | no |  | FK → catalog_services.id. |
| 6 | `kind` | `character varying(20)` | no |  | Valores: `hotel`, `tren`, `entrada`. |
| 7 | `name` | `character varying(150)` | no |  |  |
| 8 | `contract_ref` | `character varying(80)` | sí |  |  |
| 9 | `valid_from` | `date` | no |  |  |
| 10 | `valid_to` | `date` | no |  |  |
| 11 | `base_qty` | `integer` | no |  |  |
| 12 | `release_days` | `smallint` | no |  |  |
| 13 | `net_rate` | `numeric(14,2)` | no |  |  |
| 14 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 15 | `penalty_pct` | `numeric(5,2)` | no | `0` |  |
| 16 | `status` | `character varying(20)` | no | `'activo'::character varying` | Valores: `activo`, `en_release`, `liberado`, `vencido`. |
| 17 | `owner_id` | `uuid` | no |  | FK → iam_users.id. |
| 18 | `notes` | `text` | sí |  |  |
| 19 | `released_at` | `timestamp with time zone` | sí |  |  |
| 20 | `release_reason` | `text` | sí |  |  |
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
| `tenant_id, owner_id` | `iam_users.tenant_id, id` | NO ACTION | `fk_catalog_allotments_owner_id` |
| `tenant_id, provider_id` | `catalog_providers.tenant_id, id` | NO ACTION | `fk_catalog_allotments_provider_id` |
| `tenant_id, service_id` | `catalog_services.tenant_id, id` | NO ACTION | `fk_catalog_allotments_service_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_allotments_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_allotments_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_allotments_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_allotments_base_qty_check` | `CHECK ((base_qty > 0))` |  |
| `catalog_allotments_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `catalog_allotments_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['hotel'::character varying, 'tren'::character varying, 'entrada'::character varying])::text[])))` | `kind`: `hotel`, `tren`, `entrada` |
| `catalog_allotments_net_rate_check` | `CHECK ((net_rate >= (0)::numeric))` |  |
| `catalog_allotments_penalty_pct_check` | `CHECK (((penalty_pct >= (0)::numeric) AND (penalty_pct <= (100)::numeric)))` |  |
| `catalog_allotments_release_days_check` | `CHECK (((release_days >= 0) AND (release_days <= 120)))` |  |
| `catalog_allotments_status_check` | `CHECK (((status)::text = ANY ((ARRAY['activo'::character varying, 'en_release'::character varying, 'liberado'::character varying, 'vencido'::character varying])::text[])))` | `status`: `activo`, `en_release`, `liberado`, `vencido` |
| `ck_catalog_allotments_1` | `CHECK ((valid_to >= valid_from))` |  |

**EXCLUDE**

- `ex_catalog_allotments_overlap`: `EXCLUDE USING gist (tenant_id WITH =, service_id WITH =, daterange(valid_from, valid_to, '[]'::text) WITH &&) WHERE ((((status)::text = ANY ((ARRAY['activo'::character varying, 'en_release'::character varying])::text[])) AND (deleted_at IS NULL)))`

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_allotments_owner_id` | `USING btree (owner_id)` |
| `ix_catalog_allotments_provider_id` | `USING btree (provider_id)` |
| `ix_catalog_allotments_service_id` | `USING btree (service_id)` |
| `ix_catalog_allotments_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |
| `ix_catalog_allotments_tenant_id_owner_id` | `USING btree (tenant_id, owner_id)` |
| `ix_catalog_allotments_tenant_id_provider_id` | `USING btree (tenant_id, provider_id)` |
| `ix_catalog_allotments_tenant_id_service_id` | `USING btree (tenant_id, service_id)` |
| `ix_catalog_allotments_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_allotments_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_catalog_allotments_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_destination_contents`

[Spec 15 §3.11] [Fase 2] Contenido de páginas de destino por idioma.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_destinations.tenant_id, catalog_product_media.tenant_id, tenants.id. |
| 3 | `destination_id` | `uuid` | no |  | FK → catalog_destinations.id. |
| 4 | `locale` | `character varying(5)` | no |  |  |
| 5 | `slug` | `character varying(160)` | no |  |  |
| 6 | `tagline` | `character varying(200)` | sí |  |  |
| 7 | `description` | `text` | sí |  |  |
| 8 | `climate` | `text` | sí |  |  |
| 9 | `altitude_text` | `character varying(120)` | sí |  |  |
| 10 | `faqs` | `jsonb` | sí |  |  |
| 11 | `hero_media_id` | `uuid` | sí |  | FK → catalog_product_media.id. |
| 12 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 13 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 14 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 15 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, destination_id` | `catalog_destinations.tenant_id, id` | CASCADE | `fk_catalog_destination_contents_destination_id` |
| `tenant_id, hero_media_id` | `catalog_product_media.tenant_id, id` | NO ACTION | `fk_catalog_destination_contents_hero_media_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_destination_contents_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_destination_contents_destination_id_locale` | `destination_id, locale` |  | índice único |
| `uq_catalog_destination_contents_tenant_id_locale_slug` | `tenant_id, locale, slug` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_destination_contents_hero_media_id` | `USING btree (hero_media_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_destination_contents_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_payment_policies`

[Spec 16 §3.7] [Fase 2] Política de pago del producto (total/adelanto).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `modes` | `character varying(15)[]` | no | `'{total}'::character varying[]` |  |
| 5 | `deposit_pct` | `numeric(5,2)` | sí |  |  |
| 6 | `balance_due_days` | `smallint` | sí |  |  |
| 7 | `note` | `text` | sí |  |  |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 9 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 11 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_payment_policies_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_payment_policies_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_payment_policies_product_id` | `product_id` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_payment_policies_balance_due_days_check` | `CHECK (((balance_due_days >= 0) AND (balance_due_days <= 180)))` |  |
| `catalog_payment_policies_deposit_pct_check` | `CHECK (((deposit_pct >= (1)::numeric) AND (deposit_pct <= (99)::numeric)))` |  |
| `catalog_payment_policies_modes_check` | `CHECK (((cardinality(modes) >= 1) AND (modes <@ ARRAY['total'::character varying, 'adelanto'::character varying])))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_payment_policies_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_payment_policies_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_pickup_points`

[Spec 16 §3.8] [Fase 2] Puntos de recojo del producto.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `sequence` | `smallint` | no | `0` |  |
| 5 | `label` | `character varying(150)` | no |  |  |
| 6 | `kind` | `character varying(20)` | no | `'punto_encuentro'::character varying` | Valores: `aeropuerto`, `hotel`, `punto_encuentro`, `terminal`, `por_cuenta`. |
| 7 | `requires_address` | `boolean` | no | `false` |  |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 9 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 10 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 11 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_pickup_points_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_pickup_points_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_pickup_points_product_id_lower_label` | `product_id, lower((label)::text)` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_pickup_points_kind_check` | `CHECK (((kind)::text = ANY ((ARRAY['aeropuerto'::character varying, 'hotel'::character varying, 'punto_encuentro'::character varying, 'terminal'::character varying, 'por_cuenta'::character varying])::text[])))` | `kind`: `aeropuerto`, `hotel`, `punto_encuentro`, `terminal`, `por_cuenta` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_pickup_points_tenant_id` | `USING btree (tenant_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_pickup_points_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_addons`

[Spec 16 §3.5] [Fase 2] Adicionales del producto (museos, seguros…).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, catalog_providers.tenant_id, catalog_services.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `code` | `character varying(20)` | no |  |  |
| 5 | `name` | `character varying(150)` | no |  |  |
| 6 | `category` | `character varying(20)` | no |  | Valores: `Museo`, `Entrada`, `Alimentación`, `Transporte`, `Extensión`, `Seguro`, `Experiencia`, `Servicio`, `Otro`. |
| 7 | `price` | `numeric(14,2)` | no |  |  |
| 8 | `currency` | `character(3)` | no |  |  |
| 9 | `charge_per` | `character varying(10)` | no |  | Valores: `pax`, `reserva`. |
| 10 | `applies_to` | `character varying(3)[]` | no | `'{ADT}'::character varying[]` |  |
| 11 | `stock_note` | `character varying(200)` | sí |  |  |
| 12 | `provider_id` | `uuid` | sí |  | FK → catalog_providers.id. |
| 13 | `service_id` | `uuid` | sí |  | FK → catalog_services.id. |
| 14 | `is_optional` | `boolean` | no | `true` |  |
| 15 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 16 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 17 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 18 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 19 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_addons_product_id` |
| `tenant_id, provider_id` | `catalog_providers.tenant_id, id` | NO ACTION | `fk_catalog_product_addons_provider_id` |
| `tenant_id, service_id` | `catalog_services.tenant_id, id` | NO ACTION | `fk_catalog_product_addons_service_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_addons_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_product_addons_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_product_addons_tenant_id_code` | `tenant_id, code` |  | índice único |
| `uq_catalog_product_addons_tenant_id_product_id_lower_name` | `tenant_id, product_id, lower((name)::text)` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_product_addons_applies_to_check` | `CHECK (((cardinality(applies_to) >= 1) AND (applies_to <@ ARRAY['ADT'::character varying, 'CHD'::character varying, 'INF'::character varying])))` |  |
| `catalog_product_addons_category_check` | `CHECK (((category)::text = ANY ((ARRAY['Museo'::character varying, 'Entrada'::character varying, 'Alimentación'::character varying, 'Transporte'::character varying, 'Extensión'::character varying, 'Seguro'::character varying, 'Experiencia'::character varying, 'Servicio'::character varying, 'Otro'::character varying])::text[])))` | `category`: `Museo`, `Entrada`, `Alimentación`, `Transporte`, `Extensión`, `Seguro`, `Experiencia`, `Servicio`, `Otro` |
| `catalog_product_addons_charge_per_check` | `CHECK (((charge_per)::text = ANY ((ARRAY['pax'::character varying, 'reserva'::character varying])::text[])))` | `charge_per`: `pax`, `reserva` |
| `catalog_product_addons_price_check` | `CHECK ((price >= (0)::numeric))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_addons_product_id` | `USING btree (product_id)` |
| `ix_catalog_product_addons_provider_id` | `USING btree (provider_id)` |
| `ix_catalog_product_addons_service_id` | `USING btree (service_id)` |
| `ix_catalog_product_addons_tenant_id_created_at_desc` | `USING btree (tenant_id, created_at DESC)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_addons_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_b2b_rates`

[Spec 02 §3.7 + 08 §3.3] [Fase 2] Tarifa neta por agencia y producto.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → channel_b2b_agencies.tenant_id, channel_b2b_price_lists.tenant_id, catalog_products.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `agency_id` | `uuid` | no |  | FK → channel_b2b_agencies.id. |
| 5 | `price_list_id` | `uuid` | sí |  | FK → channel_b2b_price_lists.id. |
| 6 | `price_list` | `character varying(80)` | sí |  |  |
| 7 | `price` | `numeric(14,2)` | no |  |  |
| 8 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 9 | `commission_pct` | `numeric(5,2)` | no | `10` |  |
| 10 | `is_credit` | `boolean` | no | `false` |  |
| 11 | `valid_to` | `date` | sí |  |  |
| 12 | `conditions` | `character varying(300)` | sí |  |  |
| 13 | `restrictions` | `character varying(300)` | sí |  |  |
| 14 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 15 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 16 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 17 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |
| 18 | `deleted_at` | `timestamp with time zone` | sí |  | Borrado lógico (soft delete). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, agency_id` | `channel_b2b_agencies.tenant_id, id` | NO ACTION | `fk_catalog_product_b2b_rates_agency_id` |
| `tenant_id, price_list_id` | `channel_b2b_price_lists.tenant_id, id` | NO ACTION | `fk_catalog_product_b2b_rates_price_list_id` |
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_b2b_rates_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_b2b_rates_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_product_b2b_rates_tenant_id_product_id_agency_id_p` | `tenant_id, product_id, agency_id` | `(deleted_at IS NULL)` | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_product_b2b_rates_commission_pct_check` | `CHECK ((commission_pct >= (0)::numeric))` |  |
| `catalog_product_b2b_rates_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |
| `catalog_product_b2b_rates_price_check` | `CHECK ((price >= (0)::numeric))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_b2b_rates_agency_id` | `USING btree (agency_id)` |
| `ix_catalog_product_b2b_rates_price_list_id` | `USING btree (price_list_id)` |
| `ix_catalog_product_b2b_rates_product_id` | `USING btree (product_id)` |
| `ix_catalog_product_b2b_rates_tenant_id_agency_id` | `USING btree (tenant_id, agency_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_b2b_rates_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_rule_overrides`

[Spec 17 §3.2 + 16 §3.2] [Fase 2] Excepción de regla por producto.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, sys_booking_rules.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `rule_code` | `character varying(40)` | no |  | FK → sys_booking_rules.code. |
| 5 | `disabled` | `boolean` | no | `false` |  |
| 6 | `params` | `jsonb` | sí |  |  |
| 7 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 8 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 10 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_rule_overrides_product_id` |
| `tenant_id, rule_code` | `sys_booking_rules.tenant_id, code` | CASCADE | `fk_catalog_product_rule_overrides_rule` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_rule_overrides_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_product_rule_overrides_tenant_id_product_id_r_b479e9` | `tenant_id, product_id, rule_code` |  | índice único |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_product_rule_overrides_product_id` | `USING btree (product_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_rule_overrides_guard` | BEFORE INSERT OR UPDATE | `app_rule_override_guard` |
| `trg_catalog_product_rule_overrides_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_product_translations`

[Spec 15 §3.11] [Fase 2] Traducciones del producto para el sitio.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, tenants.id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `locale` | `character varying(5)` | no |  |  |
| 5 | `name` | `character varying(160)` | no |  |  |
| 6 | `short` | `text` | sí |  |  |
| 7 | `long` | `text` | sí |  |  |
| 8 | `itinerary` | `jsonb` | sí |  |  |
| 9 | `inclusions` | `jsonb` | sí |  |  |
| 10 | `exclusions` | `jsonb` | sí |  |  |
| 11 | `requirements` | `jsonb` | sí |  |  |
| 12 | `faqs` | `jsonb` | sí |  |  |
| 13 | `seo_title` | `character varying(120)` | sí |  |  |
| 14 | `seo_description` | `character varying(320)` | sí |  |  |
| 15 | `slug` | `character varying(160)` | no |  |  |
| 16 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 17 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 18 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 19 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_product_translations_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_product_translations_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_product_translations_product_id_locale` | `product_id, locale` |  | índice único |
| `uq_catalog_product_translations_tenant_id_locale_slug` | `tenant_id, locale, slug` |  | índice único |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_product_translations_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_service_cost_history`

[Spec 10 §3.11 + 06 §3.4] [Fase 2] Historial de costos/vigencias de servicios de proveedor (tarifas aprobadas).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 2 · Canales y campo (`30_fase2.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → collab_approval_requests.tenant_id, supplier_rate_requests.tenant_id, catalog_services.tenant_id, tenants.id. |
| 3 | `service_id` | `uuid` | no |  | FK → catalog_services.id. |
| 4 | `cost` | `numeric(14,2)` | no |  |  |
| 5 | `currency` | `character(3)` | no |  | Valores: `PEN`, `USD`. |
| 6 | `effective_from` | `date` | no |  |  |
| 7 | `effective_to` | `date` | sí |  |  |
| 8 | `source` | `character varying(30)` | no | `'manual'::character varying` |  |
| 9 | `rate_request_id` | `uuid` | sí |  | FK → supplier_rate_requests.id. |
| 10 | `approval_request_id` | `uuid` | sí |  | FK → collab_approval_requests.id. |
| 11 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, approval_request_id` | `collab_approval_requests.tenant_id, id` | NO ACTION | `fk_catalog_service_cost_history_approval_request_id` |
| `tenant_id, rate_request_id` | `supplier_rate_requests.tenant_id, id` | NO ACTION | `fk_catalog_service_cost_history_rate_request_id` |
| `tenant_id, service_id` | `catalog_services.tenant_id, id` | NO ACTION | `fk_catalog_service_cost_history_service_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_service_cost_history_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_service_cost_history_id` | `tenant_id, id` |  | restricción |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_service_cost_history_cost_check` | `CHECK ((cost >= (0)::numeric))` |  |
| `catalog_service_cost_history_currency_check` | `CHECK ((currency = ANY (ARRAY['PEN'::bpchar, 'USD'::bpchar])))` | `currency`: `PEN`, `USD` |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_service_cost_history_approval_request_id` | `USING btree (approval_request_id)` |
| `ix_catalog_service_cost_history_rate_request_id` | `USING btree (rate_request_id)` |
| `ix_catalog_service_cost_history_service_id` | `USING btree (service_id)` |
| `ix_catalog_service_cost_history_tenant_id_service_id_eff_aefef2` | `USING btree (tenant_id, service_id, effective_from DESC)` |

[↑ Índice del dominio](#tablas)

### `catalog_dynamic_price_rules`

[Spec 19 §3.8] [Fase 3] Ajustes de precio dinámicos por ocupación, anticipación, día, temporada o demanda (regla R-DYNAMIC-PRICING).

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_products.tenant_id, tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `name` | `character varying(120)` | no |  |  |
| 5 | `product_id` | `uuid` | sí |  | FK → catalog_products.id. |
| 6 | `basis` | `character varying(15)` | no |  | Valores: `ocupacion`, `anticipacion`, `dia_semana`, `temporada`, `demanda`. |
| 7 | `conditions` | `jsonb` | no |  |  |
| 8 | `adjust_pct` | `numeric(6,2)` | no |  |  |
| 9 | `floor_pct` | `numeric(6,2)` | no | `'-30'::integer` |  |
| 10 | `ceiling_pct` | `numeric(6,2)` | no | `50` |  |
| 11 | `priority` | `smallint` | no | `100` |  |
| 12 | `channels` | `text[]` | no | `'{web,b2b,ota,interno}'::text[]` |  |
| 13 | `valid_from` | `date` | sí |  |  |
| 14 | `valid_to` | `date` | sí |  |  |
| 15 | `active` | `boolean` | no | `false` |  |
| 16 | `lock_version` | `integer` | no | `0` | Bloqueo optimista: UPDATE … WHERE lock_version = ? (409 si no afecta filas). |
| 17 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 18 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 19 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 20 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | NO ACTION | `fk_catalog_dynamic_price_rules_product_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_dynamic_price_rules_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_dynamic_price_rules_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_dynamic_price_rules_adjust_pct_check` | `CHECK (((adjust_pct >= ('-50'::integer)::numeric) AND (adjust_pct <= (100)::numeric)))` |  |
| `catalog_dynamic_price_rules_basis_check` | `CHECK (((basis)::text = ANY ((ARRAY['ocupacion'::character varying, 'anticipacion'::character varying, 'dia_semana'::character varying, 'temporada'::character varying, 'demanda'::character varying])::text[])))` | `basis`: `ocupacion`, `anticipacion`, `dia_semana`, `temporada`, `demanda` |
| `catalog_dynamic_price_rules_ceiling_pct_check` | `CHECK (((ceiling_pct >= (0)::numeric) AND (ceiling_pct <= (100)::numeric)))` |  |
| `catalog_dynamic_price_rules_floor_pct_check` | `CHECK (((floor_pct >= ('-50'::integer)::numeric) AND (floor_pct <= (0)::numeric)))` |  |
| `ck_catalog_dynamic_price_rules_1` | `CHECK (((valid_to IS NULL) OR (valid_from IS NULL) OR (valid_to >= valid_from)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_dynamic_price_rules_product_id` | `USING btree (product_id)` |
| `ix_catalog_dynamic_price_rules_tenant_id_active_priority` | `USING btree (tenant_id, active, priority)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_dynamic_price_rules_lock_version` | BEFORE UPDATE | `app_bump_lock_version` |
| `trg_catalog_dynamic_price_rules_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_hotel_season_rates`

[Spec 21 §3.1] [Fase 3] Ajuste porcentual de la tarifa de un hotel del tramo por rango de fechas (temporada); sin solapes por hotel.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, catalog_accommodation_hotels.tenant_id, tenants.id. |
| 3 | `hotel_id` | `uuid` | no |  | FK → catalog_accommodation_hotels.id. |
| 4 | `label` | `character varying(60)` | no |  |  |
| 5 | `date_from` | `date` | no |  |  |
| 6 | `date_to` | `date` | no |  |  |
| 7 | `adjust_pct` | `numeric(6,2)` | no |  |  |
| 8 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). FK → iam_users.id. |
| 9 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 10 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, created_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_catalog_hotel_season_rates_created_by` |
| `tenant_id, hotel_id` | `catalog_accommodation_hotels.tenant_id, id` | CASCADE | `fk_catalog_hotel_season_rates_hotel_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_hotel_season_rates_tenant_id` |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_hotel_season_rates_adjust_pct_check` | `CHECK (((adjust_pct >= ('-50'::integer)::numeric) AND (adjust_pct <= (300)::numeric)))` |  |
| `ck_catalog_hotel_season_rates_1` | `CHECK ((date_to >= date_from))` |  |

**EXCLUDE**

- `ex_catalog_hotel_season_rates_overlap`: `EXCLUDE USING gist (tenant_id WITH =, hotel_id WITH =, daterange(date_from, date_to, '[]'::text) WITH &&)`

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_hotel_season_rates_created_by` | `USING btree (created_by)` |
| `ix_catalog_hotel_season_rates_hotel_id` | `USING btree (hotel_id, date_from)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_hotel_season_rates_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_import_jobs`

[Spec 19 §3.5] [Fase 3] Importación de productos desde una web, PDF o planilla con IA; revisión humana antes de crear.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → sys_ai_requests.tenant_id, tenants.id. |
| 3 | `code` | `character varying(30)` | no |  |  |
| 4 | `source_type` | `character varying(10)` | no |  | Valores: `url`, `pdf`, `csv`, `xlsx`. |
| 5 | `source_url` | `text` | sí |  |  |
| 6 | `file_path` | `text` | sí |  |  |
| 7 | `status` | `character varying(12)` | no | `'en_cola'::character varying` | Valores: `en_cola`, `procesando`, `revision`, `importado`, `fallido`, `cancelado`. |
| 8 | `extracted` | `jsonb` | no | `'[]'::jsonb` |  |
| 9 | `products_detected` | `integer` | no | `0` |  |
| 10 | `products_created` | `integer` | no | `0` |  |
| 11 | `ai_request_id` | `uuid` | sí |  | FK → sys_ai_requests.id. |
| 12 | `error` | `text` | sí |  |  |
| 13 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). |
| 14 | `updated_by` | `uuid` | sí |  | Usuario de la última actualización (sin FK). |
| 15 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 16 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, ai_request_id` | `sys_ai_requests.tenant_id, id` | NO ACTION | `fk_catalog_import_jobs_ai_request_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_import_jobs_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_catalog_import_jobs_tenant_id_code` | `tenant_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_import_jobs_source_type_check` | `CHECK (((source_type)::text = ANY ((ARRAY['url'::character varying, 'pdf'::character varying, 'csv'::character varying, 'xlsx'::character varying])::text[])))` | `source_type`: `url`, `pdf`, `csv`, `xlsx` |
| `catalog_import_jobs_status_check` | `CHECK (((status)::text = ANY ((ARRAY['en_cola'::character varying, 'procesando'::character varying, 'revision'::character varying, 'importado'::character varying, 'fallido'::character varying, 'cancelado'::character varying])::text[])))` | `status`: `en_cola`, `procesando`, `revision`, `importado`, `fallido`, `cancelado` |
| `ck_catalog_import_jobs_1` | `CHECK (((source_url IS NOT NULL) OR (file_path IS NOT NULL)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_import_jobs_ai_request_id` | `USING btree (ai_request_id)` |
| `ix_catalog_import_jobs_tenant_id_status` | `USING btree (tenant_id, status)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_import_jobs_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_leg_tours`

[Spec 21 §3.2] [Fase 3] Tours opcionales de un tramo (ciudad) con precio adulto/niño, día relativo, edad mínima y cupo.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, catalog_accommodation_legs.tenant_id, catalog_providers.tenant_id, tenants.id. |
| 3 | `leg_id` | `uuid` | no |  | FK → catalog_accommodation_legs.id. |
| 4 | `code` | `character varying(20)` | no |  |  |
| 5 | `name` | `character varying(160)` | no |  |  |
| 6 | `day_offset` | `smallint` | no | `0` |  |
| 7 | `start_time` | `time without time zone` | no |  |  |
| 8 | `duration_hours` | `numeric(4,1)` | no |  |  |
| 9 | `currency` | `character(3)` | no |  |  |
| 10 | `price_adult` | `numeric(14,2)` | no |  |  |
| 11 | `price_child` | `numeric(14,2)` | no | `0` |  |
| 12 | `min_age` | `smallint` | sí |  |  |
| 13 | `capacity` | `smallint` | sí |  |  |
| 14 | `provider_id` | `uuid` | sí |  | FK → catalog_providers.id. |
| 15 | `in_trip_sale` | `boolean` | no | `true` |  |
| 16 | `active` | `boolean` | no | `true` |  |
| 17 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). FK → iam_users.id. |
| 18 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 19 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, created_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_catalog_leg_tours_created_by` |
| `tenant_id, leg_id` | `catalog_accommodation_legs.tenant_id, id` | CASCADE | `fk_catalog_leg_tours_leg_id` |
| `tenant_id, provider_id` | `catalog_providers.tenant_id, id` | NO ACTION | `fk_catalog_leg_tours_provider_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_leg_tours_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_leg_tours_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_leg_tours_leg_id_code` | `tenant_id, leg_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_leg_tours_capacity_check` | `CHECK (((capacity IS NULL) OR (capacity > 0)))` |  |
| `catalog_leg_tours_currency_check` | `CHECK ((currency ~ '^[A-Z]{3}$'::text))` |  |
| `catalog_leg_tours_day_offset_check` | `CHECK (((day_offset >= 0) AND (day_offset <= 30)))` |  |
| `catalog_leg_tours_duration_hours_check` | `CHECK (((duration_hours > (0)::numeric) AND (duration_hours <= (24)::numeric)))` |  |
| `catalog_leg_tours_min_age_check` | `CHECK (((min_age IS NULL) OR ((min_age >= 0) AND (min_age <= 99))))` |  |
| `catalog_leg_tours_price_adult_check` | `CHECK ((price_adult >= (0)::numeric))` |  |
| `catalog_leg_tours_price_child_check` | `CHECK ((price_child >= (0)::numeric))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_leg_tours_created_by` | `USING btree (created_by)` |
| `ix_catalog_leg_tours_leg_id` | `USING btree (leg_id)` |
| `ix_catalog_leg_tours_provider_id` | `USING btree (provider_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_leg_tours_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_transport_options`

[Spec 21 §3.3] [Fase 3] Movilidad del circuito: entre tramos (elegir una por par) o local, por pasajero o por vehículo.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → iam_users.tenant_id, catalog_accommodation_legs.tenant_id, catalog_products.tenant_id, catalog_providers.tenant_id, tenants.id, catalog_accommodation_legs.tenant_id. |
| 3 | `product_id` | `uuid` | no |  | FK → catalog_products.id. |
| 4 | `code` | `character varying(20)` | no |  |  |
| 5 | `from_leg_id` | `uuid` | no |  | FK → catalog_accommodation_legs.id. |
| 6 | `to_leg_id` | `uuid` | sí |  | FK → catalog_accommodation_legs.id. |
| 7 | `mode` | `character varying(12)` | no |  | Valores: `vuelo`, `bus`, `tren`, `traslado`, `movilidad`. |
| 8 | `name` | `character varying(160)` | no |  |  |
| 9 | `pricing` | `character varying(10)` | no |  | Valores: `pax`, `vehiculo`. |
| 10 | `currency` | `character(3)` | no |  |  |
| 11 | `price_adult` | `numeric(14,2)` | sí |  |  |
| 12 | `price_child` | `numeric(14,2)` | sí |  |  |
| 13 | `duration_hours` | `numeric(4,1)` | sí |  |  |
| 14 | `provider_id` | `uuid` | sí |  | FK → catalog_providers.id. |
| 15 | `in_trip_sale` | `boolean` | no | `true` |  |
| 16 | `active` | `boolean` | no | `true` |  |
| 17 | `created_by` | `uuid` | sí |  | Usuario que creó la fila (sin FK: usuario del tenant, de plataforma o NULL = Sistema). FK → iam_users.id. |
| 18 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 19 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, created_by` | `iam_users.tenant_id, id` | NO ACTION | `fk_catalog_transport_options_created_by` |
| `tenant_id, from_leg_id` | `catalog_accommodation_legs.tenant_id, id` | NO ACTION | `fk_catalog_transport_options_from_leg_id` |
| `tenant_id, product_id` | `catalog_products.tenant_id, id` | CASCADE | `fk_catalog_transport_options_product_id` |
| `tenant_id, provider_id` | `catalog_providers.tenant_id, id` | NO ACTION | `fk_catalog_transport_options_provider_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_transport_options_tenant_id` |
| `tenant_id, to_leg_id` | `catalog_accommodation_legs.tenant_id, id` | NO ACTION | `fk_catalog_transport_options_to_leg_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_transport_options_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_transport_options_product_id_code` | `tenant_id, product_id, code` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_transport_options_currency_check` | `CHECK ((currency ~ '^[A-Z]{3}$'::text))` |  |
| `catalog_transport_options_duration_hours_check` | `CHECK (((duration_hours IS NULL) OR (duration_hours > (0)::numeric)))` |  |
| `catalog_transport_options_mode_check` | `CHECK (((mode)::text = ANY ((ARRAY['vuelo'::character varying, 'bus'::character varying, 'tren'::character varying, 'traslado'::character varying, 'movilidad'::character varying])::text[])))` | `mode`: `vuelo`, `bus`, `tren`, `traslado`, `movilidad` |
| `catalog_transport_options_price_adult_check` | `CHECK (((price_adult IS NULL) OR (price_adult >= (0)::numeric)))` |  |
| `catalog_transport_options_price_child_check` | `CHECK (((price_child IS NULL) OR (price_child >= (0)::numeric)))` |  |
| `catalog_transport_options_pricing_check` | `CHECK (((pricing)::text = ANY ((ARRAY['pax'::character varying, 'vehiculo'::character varying])::text[])))` | `pricing`: `pax`, `vehiculo` |
| `ck_catalog_transport_options_1` | `CHECK (((to_leg_id IS NULL) OR (to_leg_id <> from_leg_id)))` |  |
| `ck_catalog_transport_options_2` | `CHECK ((((pricing)::text = 'pax'::text) = (price_adult IS NOT NULL)))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_transport_options_created_by` | `USING btree (created_by)` |
| `ix_catalog_transport_options_from_leg_id` | `USING btree (from_leg_id)` |
| `ix_catalog_transport_options_product_id` | `USING btree (product_id)` |
| `ix_catalog_transport_options_provider_id` | `USING btree (provider_id)` |
| `ix_catalog_transport_options_to_leg_id` | `USING btree (to_leg_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_transport_options_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)

### `catalog_transport_vehicles`

[Spec 21 §3.3] [Fase 3] Vehículos y capacidad de una opción de movilidad cobrada por vehículo.

| Dominio | Fase (archivo) | RLS | Políticas | Particionado |
|---|---|---|---|---|
| Catálogo (catalog_) | Fase 3 · SaaS y crecimiento (`40_fase3.sql`) | tenant · FORCE | `platform_access`, `tenant_isolation` | No |

**Columnas**

| # | Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| 1 | `id` | `uuid` | no | `app_uuid_v7()` | PK. |
| 2 | `tenant_id` | `uuid` | no | `app_current_tenant_id()` | Tenant propietario de la fila (RLS). FK → catalog_transport_options.tenant_id, tenants.id. |
| 3 | `option_id` | `uuid` | no |  | FK → catalog_transport_options.id. |
| 4 | `name` | `character varying(60)` | no |  |  |
| 5 | `max_pax` | `smallint` | no |  |  |
| 6 | `price` | `numeric(14,2)` | no |  |  |
| 7 | `created_at` | `timestamp with time zone` | no | `now()` | Fecha y hora de creación. |
| 8 | `updated_at` | `timestamp with time zone` | no | `now()` | Última actualización (trigger app_set_updated_at). |

**PK:** `id`

**Claves foráneas**

| Columna(s) | Referencia | ON DELETE | Nombre |
|---|---|---|---|
| `tenant_id, option_id` | `catalog_transport_options.tenant_id, id` | CASCADE | `fk_catalog_transport_vehicles_option_id` |
| `tenant_id` | `tenants.id` | NO ACTION | `fk_catalog_transport_vehicles_tenant_id` |

**UNIQUE**

| Nombre | Columnas / expresión | Condición (parcial) | Tipo |
|---|---|---|---|
| `uq_tid_catalog_transport_vehicles_id` | `tenant_id, id` |  | restricción |
| `uq_catalog_transport_vehicles_option_id_name` | `tenant_id, option_id, name` |  | índice único |

**CHECK**

| Nombre | Definición | Valores permitidos |
|---|---|---|
| `catalog_transport_vehicles_max_pax_check` | `CHECK (((max_pax >= 1) AND (max_pax <= 60)))` |  |
| `catalog_transport_vehicles_price_check` | `CHECK ((price >= (0)::numeric))` |  |

**Índices**

| Nombre | Definición |
|---|---|
| `ix_catalog_transport_vehicles_option_id` | `USING btree (option_id)` |

**Triggers**

| Nombre | Momento y evento | Función |
|---|---|---|
| `trg_catalog_transport_vehicles_updated_at` | BEFORE UPDATE | `app_set_updated_at` |

[↑ Índice del dominio](#tablas)
