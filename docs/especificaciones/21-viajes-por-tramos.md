# Viajes por tramos: noches por ciudad, tours, movilidad y venta en ruta (v2.8)

Módulo nuevo de la v2.8. Amplía el alojamiento por tramos de la v2.1 (spec 16, regla R-LODGING) para circuitos de varias ciudades como «Perú Clásico 10D/9N: Lima, Arequipa, Puno y Cusco»:

1. El viajero elige **cuántas noches** pasa en cada ciudad, dentro de un mínimo y un máximo por tramo.
2. El precio del hotel cambia **por fecha** (temporada alta, feriados): cada noche se cobra con la tarifa de su día.
3. Por cada ciudad puede sumar **tours opcionales** con precio de adulto y niño, edad mínima y cupo.
4. Elige **cómo llegar** de una ciudad a otra (vuelo, bus, tren; una opción por par) y **movilidad local** (traslados o auto por día) cobrada por pasajero o por vehículo.
5. El resumen muestra el **gasto por categoría**: tour base, alojamiento, tours y movilidad.
6. Durante el viaje, el pasajero puede **comprar en ruta** los tours y la movilidad de los tramos que faltan, con link de pago.

Fase del plan: **3 · SaaS y crecimiento** (épica E3.18). Dos reglas activables nuevas del motor (spec 16): **R-TRIP-BUILDER** (grupo Alojamiento) y **R-IN-TRIP-SALES** (grupo Comunicación, parámetro `minHoursBefore`, por defecto 12). Ambas con plan mínimo **Professional**; en Starter se venden como add-on «Armador de viajes por tramos» (spec 22).

Prototipo:
- Ficha pública del circuito `#/sitio/tour/peru-clasico-10d9n` (PRD-011): sección «Tours y movilidad por ciudad», selector de noches por ciudad y resumen «Gastos del viaje por categoría».
- Portal del cliente `#/canales/portal-cliente/CLI-0001/reservas/RES-2026-000361` (usuario **U14**): tarjeta «Agregar en ruta».

## 1. Propósito y procesos cubiertos (PROC-xxx)

| Proceso | Cobertura |
|---|---|
| PROC-054 E-commerce | El armador de viaje calcula el precio en el servidor con noches, temporadas, tours y movilidad |
| PROC-020 Reserva | La reserva guarda los tramos (fechas por ciudad) y cada tour o movilidad como servicio con su proveedor |
| PROC-030 Operaciones | Cada tour y movilidad genera su orden operativa y su voucher como cualquier servicio |
| PROC-051 Portal del cliente | Venta en ruta de lo que falta del viaje, con link de pago |
| PROC-060 Reportes | Rentabilidad por categoría del viaje (base, alojamiento, tours, movilidad) |

## 2. Pantallas

| Ruta Next.js | Qué hace | Roles con acceso |
|---|---|---|
| `(sitio)/tour/[slug]` · «Alojamiento por ciudad» | Noches por ciudad con − / +, fechas de entrada y salida, hotel y habitación; nota «Tarifa por fecha» cuando hay temporada | Público |
| `(sitio)/tour/[slug]` · «Tours y movilidad por ciudad» | Por cada tramo: tours opcionales, movilidad local y «Cómo llegar a X (elija una)»; fecha de fin del viaje | Público |
| `(sitio)/tour/[slug]` · resumen | Líneas por servicio y «Gastos del viaje por categoría» | Público |
| `(portal-cliente)/reservas/[code]` · «Agregar en ruta» | Lista de tours y movilidad de los tramos pendientes con fecha y precio; «Agregar y pagar» | Cliente titular de la reserva |
| `(backoffice)/catalogo/productos/[code]/tramos` | Mínimo y máximo de noches por tramo, temporadas por hotel, tours por tramo y opciones de movilidad con vehículos | `catalog.products.update` |
| `(backoffice)/reservas/[code]` · «Viaje por tramos» | Tramos con fechas, tours y movilidad; ofertas en ruta enviadas y su estado | `reservations.view` |

## 3. Modelo de datos PostgreSQL

SQL: `kit/database/40_fase3.sql`, bloque «v2.8 · Viajes por tramos». 7 tablas con `tenant_id`, RLS estricto y FKs compuestas `(tenant_id, …)`, más dos columnas en `catalog_accommodation_legs`.

### 3.0 `catalog_accommodation_legs` (cambio)

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| min_nights, max_nights | smallint | sí | Ambas nulas (noches fijas) o ambas con valor: 1 ≤ min ≤ nights ≤ max ≤ 30 (CHECK) |

### 3.1 `catalog_hotel_season_rates`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id, tenant_id | uuid | no | PK, RLS |
| hotel_id | uuid | no | FK `catalog_accommodation_hotels` (cascade) |
| label | varchar(60) | no | «Temporada alta», «Fiestas Patrias» |
| date_from, date_to | date | no | `date_to ≥ date_from`; EXCLUDE: sin solapes por hotel |
| adjust_pct | numeric(6,2) | no | −50 a 300; se aplica a la tarifa base de la noche |

### 3.2 `catalog_leg_tours`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id, tenant_id | uuid | no | PK, RLS |
| leg_id | uuid | no | FK `catalog_accommodation_legs` (cascade); UNIQUE (leg_id, code) |
| code, name | varchar | no | |
| day_offset | smallint | no | Día del tramo (0 = día de llegada), 0–30 |
| start_time, duration_hours | time, numeric(4,1) | no | |
| currency, price_adult, price_child | char(3), numeric | no | Infantes no pagan |
| min_age, capacity | smallint | sí | Edad mínima; cupo por salida |
| provider_id | uuid | sí | FK `catalog_providers` |
| in_trip_sale, active | boolean | no | `in_trip_sale` habilita la venta en ruta |

### 3.3 `catalog_transport_options` y `catalog_transport_vehicles`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id, tenant_id | uuid | no | PK, RLS |
| product_id | uuid | no | FK `catalog_products` (cascade) |
| from_leg_id, to_leg_id | uuid | no / sí | Con `to_leg_id`: traslado entre ciudades; sin él: movilidad local. CHECK distintos |
| mode | varchar(12) | no | CHECK IN ('vuelo','bus','tren','traslado','movilidad') |
| pricing | varchar(10) | no | 'pax' (exige `price_adult`) o 'vehiculo' (exige vehículos) |
| price_adult, price_child, duration_hours | numeric | sí | |
| in_trip_sale, active | boolean | no | |
| *Vehículos:* option_id, name, max_pax (1–60), price | | no | UNIQUE (option_id, name) |

### 3.4 `booking_trip_legs`

Tramos del viaje en la reserva. `check_out = check_in + nights` (CHECK); UNIQUE (reservation_id, sequence). FK `booking_reservations` (cascade) y `catalog_accommodation_legs`.

### 3.5 `booking_trip_items`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id, tenant_id, reservation_id | uuid | no | FK `booking_reservations` (cascade) |
| trip_leg_id | uuid | sí | FK `booking_trip_legs` |
| kind | varchar(10) | no | 'tour' (exige `leg_tour_id`) o 'transporte' (exige `transport_option_id`) |
| vehicle_id, vehicle_units | uuid, smallint | sí | Juntos o ninguno (CHECK) |
| service_date, start_time | date, time | no / sí | |
| adults, children | smallint | no | Suma > 0 |
| currency, amount | char(3), numeric | no | Importe confirmado por el servidor |
| reservation_service_id | uuid | sí | FK `booking_reservation_services` (servicio generado) |
| sold_in_trip | boolean | no | true si se compró en ruta |

UNIQUE: un mismo tour por fecha y una sola opción de movilidad por reserva.

### 3.6 `booking_in_trip_offers`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id, tenant_id, code | | no | UNIQUE (tenant_id, code) |
| reservation_id | uuid | no | FK `booking_reservations` |
| kind, leg_tour_id, transport_option_id | | | Igual que 3.5 (CHECK) |
| service_date, currency, amount | | no | amount > 0 |
| status | varchar(14) | no | CHECK IN ('ofrecida','link_enviado','pagada','confirmada','vencida','cancelada','reembolsada'); pagada/confirmada exigen `payment_link_id`; confirmada exige `trip_item_id` |
| payment_link_id | uuid | sí | FK `fin_payment_links` (spec 19) |
| trip_item_id | uuid | sí | FK `booking_trip_items` |
| expires_at | timestamptz | no | `service_date + start_time − minHoursBefore` |
| channel | varchar(12) | no | portal, whatsapp, email, app, asesor |

## 4. Máquinas de estado

| Entidad | Transiciones |
|---|---|
| Oferta en ruta | `ofrecida → link_enviado` (se genera el link) · `link_enviado → pagada` (webhook del link) · `pagada → confirmada` (proveedor confirma; se crea `booking_trip_items` y el servicio) · `pagada → reembolsada` (proveedor rechaza) · `ofrecida|link_enviado → vencida` (job al `expires_at`) · `ofrecida|link_enviado → cancelada` |

## 5. Reglas de negocio

| ID | Regla | Dónde |
|---|---|---|
| TB-01 | R-TRIP-BUILDER apagada o fuera de plan: las noches son fijas, no se muestran tours ni movilidad y el API ignora `nights`, `tours` y `transport` del pedido | BookingEngine (spec 16) |
| TB-02 | Noches por tramo dentro de `[min_nights, max_nights]`; el servidor las acota y avisa. Las fechas de cada tramo salen de la fecha de inicio y las noches anteriores | BookingEngine::tripSchedule |
| TB-03 | Cada noche se cobra con la tarifa base del hotel ajustada por la temporada vigente ese día (`adjust_pct`). La línea de alojamiento muestra el precio medio y la etiqueta «Temporada alta» si alguna noche la tuvo | BookingEngine::quote |
| TB-04 | Tour: adultos × `price_adult` + niños × `price_child`; infantes gratis. Con `min_age`, si hay niños menores se avisa y no se cobra por ellos | BookingEngine |
| TB-05 | Movilidad por pasajero igual que TB-04. Por vehículo: el vehículo más chico con `max_pax` ≥ personas; si ninguno alcanza, varias unidades del más grande | BookingEngine |
| TB-06 | Entre dos ciudades se elige una sola opción de movilidad (elegir otra reemplaza la anterior). Sin opción elegida no se bloquea la reserva | BookingEngine + UI |
| TB-07 | El resumen y la reserva guardan `byCategory` = {base, lodging, tour, transport, addon, surcharge}; la suma es el subtotal antes de promociones | BookingEngine::byCategory |
| TB-08 | Al confirmar, cada tour y movilidad crea un servicio de reserva con su proveedor y fecha, y su orden operativa (spec 05) | ConvertCart / Action |
| TB-09 | Venta en ruta (R-IN-TRIP-SALES): solo reservas confirmadas o en operación, solo ítems con `in_trip_sale`, de tramos cuya fecha no pasó y con al menos `minHoursBefore` horas de anticipación. No se ofrece otra movilidad para un par que ya tiene una | InTripOffers service |
| TB-10 | El precio de la oferta en ruta lo calcula el servidor al crearla y queda congelado hasta `expires_at`; el pago se hace con link (spec 19). Si el proveedor no confirma, se reembolsa el total | Job + webhook |

## 6. API REST

| Método | Endpoint | Permiso | Descripción | Idem./lock |
|---|---|---|---|---|
| GET | `/api/v1/catalog/products/{code}/trip` | catalog.products.view | Tramos con noches mínimas y máximas, temporadas por hotel, tours y movilidad | — |
| PUT | `/api/v1/catalog/products/{code}/trip/legs/{legId}/nights` | catalog.products.update | Fijar `min_nights` y `max_nights` del tramo | lock_version del producto |
| GET | `/api/v1/catalog/hotels/{hotelId}/season-rates` | catalog.products.view | Temporadas del hotel | — |
| POST | `/api/v1/catalog/hotels/{hotelId}/season-rates` | catalog.products.update | Crear temporada (409 si se solapa) | — |
| DELETE | `/api/v1/catalog/hotels/{hotelId}/season-rates/{id}` | catalog.products.update | Borrar temporada | — |
| POST | `/api/v1/catalog/products/{code}/trip/tours` | catalog.products.update | Crear tour de un tramo | — |
| PATCH | `/api/v1/catalog/products/{code}/trip/tours/{tourId}` | catalog.products.update | Editar o desactivar | — |
| POST | `/api/v1/catalog/products/{code}/trip/transport` | catalog.products.update | Crear opción de movilidad (con vehículos si es por vehículo) | — |
| PATCH | `/api/v1/catalog/products/{code}/trip/transport/{optionId}` | catalog.products.update | Editar o desactivar | — |
| GET | `/api/v1/reservations/{code}/trip` | reservations.view | Tramos, tours, movilidad y gasto por categoría de la reserva | — |
| GET | `/api/v1/reservations/{code}/in-trip-offers` | reservations.view | Ofertas en ruta y su estado | — |
| POST | `/api/v1/reservations/{code}/in-trip-offers` | reservations.modify | El asesor ofrece un tour o movilidad (`kind`, `item_id`, `channel`) | Idempotency-Key |
| POST | `/api/v1/reservations/{code}/in-trip-offers/{offerCode}/cancel` | reservations.modify | Cancelar oferta no pagada | — |
| GET | `/api/v1/portal/client/reservations/{code}/in-trip` | customer (titular) | Lo que puede comprar en ruta, con precio y fecha | — |
| POST | `/api/v1/portal/client/reservations/{code}/in-trip` | customer (titular) | Crear la oferta y el link de pago (`kind`, `item_id`) | Idempotency-Key |

La ficha pública usa el motor de la spec 16: `POST /api/v1/public/products/{slug}/quote` acepta en `sel` los campos `nights` `{legId: n}`, `tours` `[{id}]` y `transport` `[{id}]`, y responde con `legs`, `tripEnd` y `byCategory` (sin endpoints nuevos).

## 7. Permisos y comportamiento por rol

Sin permisos nuevos. Edición de tramos con `catalog.products.update`; ofertas desde el back-office con `reservations.modify`; el cliente compra en ruta por pertenencia a la reserva (SEC-BR-12).

## 8. Eventos, jobs y notificaciones

| Evento / job | Cola | Efecto |
|---|---|---|
| `InTripOfferCreated` | notifications | Envía el link de pago por el canal elegido |
| `InTripOfferPaid` | default | Pide confirmación al proveedor (spec 06) |
| `InTripOfferConfirmed` | default | Crea `booking_trip_items`, el servicio, la orden operativa y el voucher |
| `ExpireInTripOffers` (cada 15 min) | default | `→ vencida` al pasar `expires_at` |
| `SuggestInTripSales` (diario 18:00) | notifications | Con la regla activa, recuerda al pasajero lo disponible para mañana y pasado |

Plantillas nuevas: `venta_ruta.link`, `venta_ruta.confirmada`, `venta_ruta.recordatorio`.

## 9. Auditoría

Cambios de noches mínimas y máximas, temporadas, tours y movilidad; creación, pago, confirmación, vencimiento y cancelación de ofertas en ruta.

## 10. Casos de prueba mínimos

- TB-02: pedir 9 noches en un tramo con máximo 4 → se cobran 4 y se avisa.
- TB-03: una estadía que cruza el inicio de la temporada alta cobra cada noche con su tarifa.
- TB-05: 5 personas con autos de 3 y vans de 10 → 1 van.
- TB-06: elegir bus y luego vuelo Lima → Arequipa deja solo el vuelo.
- TB-09: una oferta para un tramo que empieza en 6 h (con `minHoursBefore` 12) → 422.
- Aislamiento de tenant en las 7 tablas; EXCLUDE de temporadas solapadas.
- Playwright: en PRD-011 sumar una noche en Cusco, el tour Valle Sagrado y el vuelo Lima → Arequipa; el total por categoría coincide con las líneas. U14 compra en ruta el kayak en Puno y paga con tarjeta de prueba.

## 11. Cambios y decisiones respecto a la documentación inicial

- Se extiende R-LODGING (v2.1) en lugar de crear otro producto: el circuito sigue siendo un producto con tramos.
- Tours y movilidad del circuito viven en el producto y no como productos sueltos, porque su fecha depende del tramo.
- La venta en ruta reutiliza los links de pago de la spec 19.

## 12. Supuestos y puntos a validar con negocio

- Si los tours por tramo tienen cupo compartido con el mismo tour vendido suelto (supuesto: no, cupo propio).
- Anticipación mínima de la venta en ruta (supuesto: 12 h).
- Si un niño menor de la edad mínima puede ir sin pagar o no puede ir (supuesto: no paga y se avisa).
