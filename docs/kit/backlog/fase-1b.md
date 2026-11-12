# Backlog · Fase 1 (parte B) — Cotizaciones, Reservas, Operaciones, Finanzas básicas, Portal del cliente, Reportes y Libro de Reclamaciones

Alcance: Cotizaciones (spec 03), Reservas con conversión idempotente y cancelación (spec 04), Operaciones sin apps: órdenes, asignaciones, rooming, vouchers, incidencias, evidencias y cierre (spec 05), Finanzas básicas sin OSE ni conciliación: CxC, pagos, CxP, costos, comisiones, rentabilidad y liquidación (spec 07), Portal del cliente (spec 08, solo esa parte), Reportes básicos, exportación y paneles (spec 09) y Libro de Reclamaciones (spec 12, solo esa parte).
Requiere Fase 0 y Fase 1-A terminadas (IDs `F0-xx` y `F1A-xxx-nn` en «Depende de»).
Criterio de salida de la Fase 1 (03-PLAN §2) cubierto en esta parte: E2E-01 (tramo cotización), E2E-02, E2E-03, E2E-05 (sin comprobante), E2E-09 y E2E-10 (versión web). E2E-06 depende del portal del pasajero (Fase 2): ver supuestos.

Archivo tabular equivalente: `fase-1b.csv`.

## Resumen

| Épica | Nombre | Historias |
|---|---|---|
| E1B.1 | Cotizaciones | 13 |
| E1B.2 | Reservas y conversión idempotente | 18 |
| E1B.3 | Operaciones (sin apps) | 16 |
| E1B.4 | Finanzas básicas (sin OSE ni conciliación) | 13 |
| E1B.5 | Portal del cliente | 7 |
| E1B.6 | Reportes básicos, exportación y paneles | 6 |
| E1B.7 | Libro de Reclamaciones | 6 |
| E1B.8 | Integración con Fase 1-A, datos semilla y pruebas de salida | 4 |
| **Total** | | **83** |

Prioridad: P0 = imprescindible para el criterio de salida · P1 = necesaria en la fase · P2 = puede pasar a la fase siguiente sin bloquear.

Cobertura referencial: 207 endpoints (todos presentes en `kit-ia/api/openapi.json`), 55 tablas citadas, 136 casos de prueba de las especificaciones.

## Cómo usar este backlog con Claude Code

1. Trabajar una historia por sesión, en el orden de dependencias (columna «Depende de»).
2. Entregar a Claude Code el bloque completo de la historia más las secciones de especificación citadas; los criterios de aceptación son la definición de «hecho» de la sesión.
3. Cerrar la historia solo con sus pruebas en verde y la especificación actualizada si hubo cambios (sección 11 y `CHANGELOG.md`).

Orden sugerido: migraciones (COT-01, RES-01, OPS-01, FIN-01, LRC-01, INT-01) → cotizaciones → conversión y reservas → finanzas (FIN-03 antes de RES-10/RES-12) → operaciones → portal, reportes y libro → INT-04 → pantallas de cada módulo en cuanto su API esté en verde → INT-03.

## Supuestos y decisiones que afectan esta fase

- Tabla de servicios de la reserva: 04 la llama `booking_services`; 05, 06, 07, 08, 15, 16 y el backlog de Fase 1-A usan `booking_reservation_services`. Se usa `booking_reservation_services` con las columnas de 04 §3 más las operativas de 05 §3.3. La salida se nombra `catalog_product_departures` (Fase 1-A); 04 dice `catalog_departures`.
- Libro de Reclamaciones: 12 extiende `crm_claims`, pero 01 y Fase 1-A crean `crm_cases` y `crm_case_events`; se extienden esas tablas.
- Tipo de cambio: en 1-B se lee `sys_fx_rates` de Fase 0 (F0-33); `fin_fx_rates` (07 §3.19 / 17 §3.6) llega con el módulo de monedas de Fase 2. Consolidación siempre con el TC conservado del documento (H-12).
- Nota de crédito por cancelación con reembolso (H-06, 07 P-10): en 1-B se crea el reembolso pendiente y la NC queda pendiente de emisión por OSE en Fase 2.
- Un único `TaxService` para cotización y reserva directa (H-09): la reserva directa aplica IGV, a diferencia del prototipo.
- Borrador de reserva directa con cupo: hold temporal con expiración y sin CxC hasta confirmar (04 §12-7); el prototipo retiene cupo y crea CxC.
- Tramos de penalidad estructurados `[{min_days, pct}]` en políticas y snapshot (H-10); el parser de texto solo como respaldo para snapshots antiguos.
- CxP de servicio: se genera al confirmar el servicio con el proveedor y se ajusta al cierre operativo (la spec no fija el momento). Sin bloqueo por factura del proveedor hasta Fase 2 (07 P-11).
- Rentabilidad y comisiones sobre base neta sin IGV (H-11, 07 P-07).
- Umbrales comerciales (5 % / 15 % / 10 % / 50 %, anticipo 40/60, hold 30 min, SLA 4/8/24/72 h, ventana de cruce 6 h) en `sys_settings` con los valores del prototipo; definitivos pendientes de D-04.
- Permisos nuevos propuestos por las specs: `quotes.reassign`, `reservations.reassign`, `reservations.approve_changes` (F1B-INT-01).
- CRUD de guías, conductores y vehículos (05 §12-8) no figura en la API de 05 §6.3: se agrega como supuesto en F1B-OPS-05.
- Pago en línea del portal contra la interfaz `PaymentGateway` con driver sandbox; pasarela real y webhooks en Fase 2 (D-02). Método «Crédito B2B» inactivo hasta Fase 2 (H-02).
- Libro de Reclamaciones: formulario público mínimo en el dominio del tenant aunque el sitio público sea Fase 2, por ser obligación legal; normativa por validar (D-07) y proveedor de captcha por definir.
- Criterio de salida: 03-PLAN pide E2E-06 (portal del pasajero), pero el mapa de fases ubica ese portal en Fase 2; y E2E-05 incluye emitir comprobante (OSE, Fase 2). Validar con negocio si E2E-06 pasa a Fase 2.

## Fuera de alcance de esta fase

- Facturación electrónica (OSE), series, notas de crédito, panel de Contabilidad y cierre de periodo (07 §3.13–3.18, §4.6–4.8): Fase 2.
- Conciliación bancaria e indicador de match al validar pagos (07 §3.17, FIN-BR-12): Fase 2.
- Apps de operador y pasajero, check-in por pasajero y sincronización offline (05 §2.1–2.2, §3.6, §3.13–3.14, §8.4): Fase 2.
- Reserva web v2.1 (snapshot `booking`, alojamiento por ciudad, adicionales, recojo, comentarios y mensajes del pasajero, prellenado de rooming): Fase 2 con el motor completo y el sitio público.
- Portal del pasajero, B2B, extranet, e-commerce, pasarela real y tesorería: Fase 2.
- Reportes programados, formatos XLSX/PDF y metas comerciales: Fase 3.

## Historias

### E1B.1 · Cotizaciones

#### F1B-COT-01 · Migraciones del dominio de cotizaciones

**Historia:** Como desarrollador, quiero las tablas de cotizaciones con sus restricciones, para que la inmutabilidad y las reglas se cumplan también en la base.

**Especificación:** 03 §3; reglas QTE-BR-02/03/07 (CHECK), QTE-BR-15 (UNIQUE parcial pendiente por versión), QTE-BR-19 (trigger frozen_at), UNIQUE (tenant_id, reservation_id) no nulo

**Tablas:** `quote_quotes`, `quote_versions`, `quote_items`, `quote_internal_approvals`, `quote_sends`, `quote_access_tokens`, `quote_views`, `quote_negotiations`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Crear las 7 tablas `quote_*` con RLS, CHECK de estados, índices, UNIQUE parciales y trigger que impide UPDATE de ítems/montos de una versión con `frozen_at`. Modelos Eloquent con `BelongsToTenant`, `HasUuids` v7, factories.
2. `current_version_id` es FK deferrable.
3. `cost_total` y `sale_total` de `quote_items` son columnas generadas.
4. Un UPDATE directo de `quote_items` de una versión congelada falla en BD.
5. RLS activa en las 8 tablas: consulta sin `app.tenant_id` devuelve 0 filas.
6. Nota: La spec dice «7 tablas» en su estructura pero define 8 (incluye quote_negotiations); se crean las 8.

**Pruebas:** T-Q02, T-Q09 (parte DB).

**Depende de:** F0-06, F1A-CAT-01, F1A-CAT-21, F1A-CRM-01 · **Prioridad:** P0

#### F1B-COT-02 · Servicio de pricing de cotización e impuesto único

**Historia:** Como asesor, quiero que el precio sugerido y los totales los calcule el backend, para cotizar con la tarifa y temporada correctas.

**Especificación:** 03 §5.1 (PRC-01…07), 02 PricingService, H-09, H-13; reglas PRC-01, PRC-02, PRC-03, PRC-04, PRC-06, PRC-07, RT-5, QTE-BR-05, QTE-BR-06, H-09, H-13

**Tablas:** —

**Endpoints:** `POST /api/v1/quotes/pricing/preview`, `GET /api/v1/catalog/products/quoteable`, `GET /api/v1/catalog/products/{id}/rate-suggestion`

**Pantallas:** —

**Criterios de aceptación:**

1. `QuotePricingService` con brick/math: precio sugerido por línea (tarifa × factor temporada relativo, conversión con TC), tarifa por defecto por canal del segmento, defaults de línea, `quoteTotals` (escala 6, persistencia ROUND_HALF_UP 2), IGV por defecto según país. `TaxService` único para cotización y reserva directa. Endpoints de previsualización y picker.
2. TAR-001 al 2026-12-30 en PEN devuelve precio 1 806.42 y costo 1 403.25.
3. COT-2026-00191 v3 da total 243 144.90, margen 12.35 % y motivo «margen < 15 %».
4. El frontend nunca envía totales: el backend los recalcula siempre.
5. Productos no cotizables se listan con `blocked_reason` (PRD-BR-002).
6. Supuesto (03 §12#2): la cotización mantiene precio unitario directo; no aplica redondeo 0.10 ni comisión de `PricingEngine::calc`.

**Pruebas:** T-Q01, T-Q05.

**Depende de:** F1B-COT-01, F0-31, F1A-CAT-22, F1A-CAT-23 · **Prioridad:** P0

#### F1B-COT-03 · Crear cotización con versión 1 y snapshot

**Historia:** Como asesor de Ventas, quiero crear una cotización desde cero o desde una oportunidad, para proponer un viaje con precio y condiciones congeladas.

**Especificación:** 03 §4.1 (— → borrador), §5.2, §8; reglas QTE-BR-01…09, QTE-BR-20, QTE-BR-27, PRD-BR-008/009

**Tablas:** `quote_quotes`, `quote_versions`, `quote_items`

**Endpoints:** `POST /api/v1/quotes`

**Pantallas:** —

**Criterios de aceptación:**

1. `CreateQuoteAction`: StoreQuoteRequest, ownership de cartera para Ventas, código COT por `sys_sequences`, v1 borrador con `catalog_snapshot`, `policies_snapshot` (incluye tramos estructurados) y `rate_snapshot`; evento `QuoteCreated` con `opportunity_id` que consume el listener de F1A-CRM-11 (oportunidad → cotizacion, 55 %); auditoría `crear` y `descuento_sobre_tope`.
2. Ventas no puede usar un cliente fuera de su cartera (422).
3. Descuento 12 % por Ventas → 422 `QTE-BR-08`; por Manager → 201 y auditoría `descuento_sobre_tope`.
4. Validez por defecto = hoy + `quoteValidityDays` (10).
5. Idempotency-Key opcional respetada (misma key → misma respuesta).

**Pruebas:** T-Q05, T-Q06, T-Q12.

**Depende de:** F1B-COT-02, F1A-CRM-11, F0-18, F0-25 · **Prioridad:** P0

#### F1B-COT-04 · Edición de borrador, nuevas versiones, duplicar y comparar

**Historia:** Como asesor, quiero editar el borrador, versionar, duplicar y comparar, para negociar sin perder el historial.

**Especificación:** 03 §4.1, QTE-BR-10/18/19, §6; reglas QTE-BR-10, QTE-BR-18, QTE-BR-19, QTE-BR-20

**Tablas:** `quote_versions`, `quote_items`, `quote_internal_approvals`

**Endpoints:** `PUT /api/v1/quotes/{id}/versions/{v}`, `GET /api/v1/quotes/{id}/versions`, `GET /api/v1/quotes/{id}/versions/{v}`, `GET /api/v1/quotes/{id}/versions/compare`, `POST /api/v1/quotes/{id}/versions`, `POST /api/v1/quotes/{id}/duplicate`

**Pantallas:** —

**Criterios de aceptación:**

1. Editar la versión vigente en borrador con `If-Match`; nueva versión desde la vigente (anterior → reemplazada, borra aprobaciones, recalcula snapshot, renueva validez si < 10 d); duplicar; historial; comparar dos versiones (diff por clave `productId|segment#n`).
2. Editar un borrador con aprobación interna otorgada la anula (`anulada`) y audita `anular_solicitud_aprobacion`.
3. PUT sobre versión enviada/aprobada → 409.
4. `If-Match` desactualizado → 409.
5. Nueva versión desde `convertida` → 409.

**Pruebas:** T-Q08, T-Q09, T-Q14.

**Depende de:** F1B-COT-03 · **Prioridad:** P0

#### F1B-COT-05 · Aprobación interna de gerencia

**Historia:** Como Manager, quiero aprobar o rechazar cotizaciones fuera de política, para proteger el margen.

**Especificación:** 03 §4.2, QTE-BR-11…15, §8; reglas QTE-BR-11, QTE-BR-12, QTE-BR-13, QTE-BR-14, QTE-BR-15, H-21

**Tablas:** `quote_internal_approvals`

**Endpoints:** `POST /api/v1/quotes/{id}/internal-approval-requests`, `POST /api/v1/quotes/{id}/versions/{v}/internal-approval`

**Pantallas:** —

**Criterios de aceptación:**

1. `QuotePolicyEvaluator` (descuento > 5 % o margen < 15 %; tope 10 % con override) leyendo umbrales de `sys_settings`; solicitud del dueño con justificación; decisión aprobar/rechazar con nota; notificación Portal + Reverb a managers activos y al dueño.
2. Segunda solicitud pendiente de la misma versión → 409 (UNIQUE parcial).
3. Aprobar con descuento > 10 % sin `quotes.discount_override` → 403.
4. Decisión sin nota → 422.
5. Umbrales cambiados en configuración se aplican sin despliegue.
6. Supuesto (03 §12#1): umbrales parametrizados por tenant con los valores del prototipo como default (5 %, 15 %, 10 %, 50 %).

**Pruebas:** T-Q07.

**Depende de:** F1B-COT-03, F0-33 · **Prioridad:** P0

#### F1B-COT-06 · Envío multicanal, token y registro de vistas

**Historia:** Como asesor, quiero enviar la cotización por email, WhatsApp o portal y saber cuándo la abrieron, para hacer seguimiento.

**Especificación:** 03 §4.1 (borrador → enviada → vista), §3 quote_sends/quote_access_tokens/quote_views; reglas QTE-BR-12, QTE-BR-16, QTE-BR-22, QTE-BR-23, QTE-BR-24

**Tablas:** `quote_sends`, `quote_access_tokens`, `quote_views`

**Endpoints:** `POST /api/v1/quotes/{id}/token`, `POST /api/v1/quotes/{id}/send`, `POST /api/v1/quotes/{id}/views`

**Pantallas:** —

**Criterios de aceptación:**

1. Generar/regenerar token (solo se guarda hash), enviar por Email/WhatsApp/Portal con mensaje editable (un job por canal), congelar versión (`frozen_at`, `content_hash`), renovar validez vencida, registrar vista manual. PDF adjunto por job.
2. Enviar con aprobación interna pendiente → 409 `QTE-BR-12`.
3. Doble POST send con la misma Idempotency-Key → un solo registro en `quote_sends`.
4. Regenerar token revoca el anterior.
5. Reenvío en aprobada/convertida/rechazada → 409.
6. Nota: WhatsApp usa el adapter de notificaciones de Fase 0; si el proveedor (D-03) no está contratado, queda en modo simulado.

**Pruebas:** T-Q07, T-Q13.

**Depende de:** F1B-COT-05, F0-29, F0-30 · **Prioridad:** P0

#### F1B-COT-07 · Negociación, aprobación del cliente, rechazo y reasignación

**Historia:** Como asesor, quiero registrar la negociación, la aprobación con evidencia o el rechazo del cliente, para cerrar el ciclo comercial.

**Especificación:** 03 §4.1, QTE-BR-13/16/17/21/25; reglas QTE-BR-13, QTE-BR-16, QTE-BR-17, QTE-BR-21, QTE-BR-25

**Tablas:** `quote_negotiations`, `quote_quotes`

**Endpoints:** `POST /api/v1/quotes/{id}/negotiations`, `POST /api/v1/quotes/{id}/approve`, `POST /api/v1/quotes/{id}/reject`, `POST /api/v1/quotes/{id}/reassign`

**Pantallas:** —

**Criterios de aceptación:**

1. Registrar negociación (oportunidad → negociacion 70 %, opcional nueva versión); registrar aprobación del cliente con evidencia (lista cerrada) y aprobación interna en el mismo paso si corresponde; rechazo con motivo; reasignar vendedor.
2. Aprobar una vencida → 409 `QTE-BR-16`.
3. Rechazo sin motivo → 422.
4. Aprobar requiere `reservations.create`; con margen < 15 % sin aprobación interna solo pasa si el actor tiene `quotes.approve_internal` y envía la nota.
5. Reasignar requiere `quotes.reassign`; mismo dueño → 422.

**Pruebas:** T-Q10, T-Q11.

**Depende de:** F1B-COT-06, F1B-INT-01 · **Prioridad:** P0

#### F1B-COT-08 · Endpoints públicos por token (enlace de la cotización)

**Historia:** Como cliente, quiero ver y aprobar la propuesta desde el enlace recibido, para confirmar sin llamar a la agencia.

**Especificación:** 03 §6 (public), H-04, 08 §4.4; reglas H-04, QTE-BR-13, QTE-BR-16, PCL-BR-04

**Tablas:** `quote_views`, `quote_quotes`

**Endpoints:** `GET /api/v1/public/quotes/{token}`, `POST /api/v1/public/quotes/{token}/approve`, `POST /api/v1/public/quotes/{token}/reject`

**Pantallas:** —

**Criterios de aceptación:**

1. GET de la versión vigente sin costos (registra vista `portal`), aprobación con aceptación de condiciones, IP y hash sha256 del snapshot, y rechazo con motivo. Rate limit. Reusa los servicios de COT-07.
2. Con aprobación interna pendiente la aprobación del cliente → 409 (H-04).
3. Token revocado o vencido → 404.
4. La respuesta no contiene `unit_cost`, `cost_total`, `margin_pct` ni `profit_total`.
5. Aprobación guarda `approval_ip` y `approval_hash`; Idempotency-Key obligatoria.
6. Nota: La spec indica «público (token) + login cliente» para aprobar; supuesto: basta el token si no hay usuario cliente vinculado, y si existe se exige sesión del portal (POR-01).

**Pruebas:** T-Q15 (tramo portal), Pest: H-04.

**Depende de:** F1B-COT-07 · **Prioridad:** P0

#### F1B-COT-09 · Vencimiento (JOB-02), recordatorio y PDF de cotización

**Historia:** Como asesor, quiero que las cotizaciones venzan solas y tener su PDF, para no aprobar precios caducados.

**Especificación:** 03 §8; reglas QTE-BR-16

**Tablas:** `quote_versions`

**Endpoints:** `POST /api/v1/quotes/{id}/versions/{v}/pdf`

**Pantallas:** —

**Criterios de aceptación:**

1. Scheduler `quotes:expire` diario 00:05 hora del tenant; estado `vencida` calculado también en lecturas; job propuesto `quotes:expiring-reminder` (≤ 3 días); `GenerateQuotePdf` en cola documents, ShouldBeUnique por versión.
2. El job es idempotente y audita `vencer` con actor Sistema.
3. Dos solicitudes de PDF simultáneas de la misma versión generan un solo documento en `sys_documents`.
4. Una cotización enviada con validez pasada aparece como vencida en la API aunque el job no haya corrido.
5. Supuesto (03 §12#6): el job también vence borradores, como el prototipo.

**Pruebas:** Pest: job quotes:expire, Pest: PDF ShouldBeUnique.

**Depende de:** F1B-COT-06 · **Prioridad:** P1

#### F1B-COT-10 · Listado, KPIs y actividad de cotizaciones

**Historia:** Como asesor o gerente, quiero listar y filtrar cotizaciones con KPIs según mi alcance, para priorizar el seguimiento.

**Especificación:** 03 §2, §6, §7; reglas QTE-BR-26, RT-17

**Tablas:** —

**Endpoints:** `GET /api/v1/quotes`, `GET /api/v1/quotes/kpis`, `GET /api/v1/quotes/{id}`, `GET /api/v1/quotes/{id}/activity`

**Pantallas:** —

**Criterios de aceptación:**

1. Listado con filtros (estado con vencida calculada, aprobación interna, dueño, búsqueda), cursor, `owner=me` forzado para Ventas; 5 KPIs con el mismo alcance; detalle filtrado por rol (costos y margen según `seeMargin`); actividad (auditoría).
2. Ventas U03 no ve cotizaciones de U04 (lista, KPIs, detalle → 403 «fuera de su cartera»).
3. Finance ve costos y margen; operations recibe 403.
4. Exportación CSV pasa por `POST /api/v1/reports/exports` con `reports.export` (REP-03).

**Pruebas:** T-Q02, T-Q03, T-Q04.

**Depende de:** F1B-COT-03, F0-18 · **Prioridad:** P0

#### F1B-COT-11 · Front: lista y constructor de cotización

**Historia:** Como asesor, quiero la lista y el constructor de cotizaciones equivalentes al prototipo, para cotizar rápido.

**Especificación:** 03 §2, §7; reglas RT-17 (botón deshabilitado con candado), RT-5

**Tablas:** —

**Endpoints:** API de F1B-COT-02, F1B-COT-10

**Pantallas:** `/cotizaciones`, `/cotizaciones/nueva?opp={code}`, `/cotizaciones/[code]/editar`

**Criterios de aceptación:**

1. `/cotizaciones` (KPIs, filtros, Mi cartera / filtro Asesor) y `/cotizaciones/nueva` + `/[code]/editar`: constructor con RHF + Zod espejo de StoreQuoteRequest, picker de productos, preview de precios vía API, margen por línea con semáforo, precarga desde oportunidad.
2. El constructor no calcula totales localmente: muestra los de `pricing/preview`.
3. Sin `quotes.create` se ve el aviso del prototipo.
4. Estados vacío, error y 403 implementados.
5. Sin scroll horizontal a 400 px.

**Pruebas:** T-Q16 (parte).

**Depende de:** F1B-COT-02, F1B-COT-10, F0-39 · **Prioridad:** P0

#### F1B-COT-12 · Front: detalle 360 de cotización y modales

**Historia:** Como asesor o gerente, quiero el detalle 360 de la cotización con las acciones permitidas por estado y rol, para gestionarla en un solo lugar.

**Especificación:** 03 §2, §7 (acciones por estado); reglas RT-17, QTE-BR-16

**Tablas:** —

**Endpoints:** API de F1B-COT-11, F1B-COT-07

**Pantallas:** `/cotizaciones/[code]` (pestañas y diálogos)

**Criterios de aceptación:**

1. `/cotizaciones/[code]`: flujo de estados, banner de aprobación interna, pestañas Versiones, Detalle e ítems, Pricing (solo con `seeMargin`), Documento, Envío y seguimiento, Actividad; modales Enviar, Negociación, Aprobación del cliente, Rechazar, Aprobación interna, Nueva versión, Comparar, Reasignar, Convertir (RES-17).
2. Acciones visibles por estado exactamente como 03 §7.
3. Botón bloqueado muestra el motivo de negocio (p. ej. margen 12.4 % < 15 %).
4. Finance ve «Modo consulta» sin acciones de edición.

**Pruebas:** T-Q16.

**Depende de:** F1B-COT-11, F1B-COT-07 · **Prioridad:** P0

#### F1B-COT-13 · Pruebas del módulo de cotizaciones

**Historia:** Como responsable técnico, quiero la suite de pruebas de cotizaciones, para cerrar el módulo con evidencia.

**Especificación:** 03 §10

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Completar T-Q01…T-Q16 (Pest feature/unit y Playwright), incluido E2E-01 desde oportunidad hasta aprobación del cliente por portal.
2. 16 casos en verde en CI.
3. Cobertura de ramas de `QuotePricingService` y `QuotePolicyEvaluator` ≥ 90 %.

**Pruebas:** T-Q01…T-Q16, E2E-01.

**Depende de:** F1B-COT-12, F1B-COT-08 · **Prioridad:** P0

### E1B.2 · Reservas y conversión idempotente

#### F1B-RES-01 · Migraciones del dominio de reservas

**Historia:** Como desarrollador, quiero las tablas de reservas con sus restricciones, para que la idempotencia y los cupos se garanticen en la base.

**Especificación:** 04 §3; 05 §3.3 (columnas operativas); reglas RT-22 (UNIQUE parcial quote_id), RES-BR-33 (UNIQUE parcial), RES-V21-04 (un titular), CHECK sold <= capacity en catalog_product_departures

**Tablas:** `booking_reservations`, `booking_passengers`, `booking_reservation_services`, `booking_inventory_holds`, `booking_changes`, `booking_cancel_requests`, `booking_cancellations`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Tablas `booking_*` con RLS, CHECK, índices y UNIQUE parciales (una reserva por cotización, una solicitud de anulación pendiente, una cancelación por reserva). `booking_reservation_services` incluye además las columnas operativas de 05 §3.3 (`requires_assignment`, `service_kind`, `requested_by`, `confirmed_by`, `lock_version`, estado `en_curso`). Pasajeros con `relationship`, `age`, `email`, `is_lead` (UNIQUE parcial).
2. Dos INSERT con el mismo `quote_id` no nulo fallan en BD.
3. `booking_reservation_services.status` admite `en_curso` (lo usa Operaciones).
4. RLS activa y probada en las 7 tablas.
5. Supuesto: 04 llama a la tabla `booking_services`, pero 05, 06, 07, 08, 15, 16 y el backlog de Fase 1-A usan `booking_reservation_services`; se usa este último. `unit_cost/unit_price` de 05 §3.3 se mapean a `cost_amount/price_amount` de 04. La salida se referencia como `catalog_product_departures` (nombre de Fase 1-A; 04 dice `catalog_departures`).

**Pruebas:** T-R16.

**Depende de:** F1B-COT-01, F1A-CAT-25, F1A-CAT-26 · **Prioridad:** P0

#### F1B-RES-02 · Conversión idempotente cotización → reserva (19 pasos)

**Historia:** Como asesor, quiero convertir una cotización aprobada en reserva una sola vez y con cupo verificado, para no duplicar reservas ni sobrevender.

**Especificación:** 04 §4.3, H-03, RT-22; reglas RT-3, RT-4, RT-22, RES-BR-01, RES-BR-02, RES-BR-03, PRD-BR-012, PRD-BR-013, H-03

**Tablas:** `booking_reservations`, `booking_reservation_services`, `booking_passengers`, `booking_inventory_holds`, `fin_receivables`, `sys_outbox`

**Endpoints:** `GET /api/v1/quotes/{id}/conversion-preview`, `POST /api/v1/quotes/{id}/convert`

**Pantallas:** —

**Criterios de aceptación:**

1. `ConvertQuoteToReservation`: Idempotency-Key obligatoria, lock Redis de la cotización, transacción con reintentos, FOR UPDATE + If-Match, idempotencia de negocio (una cotización → una reserva aunque se cancele), precondiciones RT-3, locks de salidas ordenados por id + re-verificación de cupo dentro de la transacción, holds, `servicesFromItem` con prorrateo por peso y residuo en la última línea, snapshot y políticas, pasajeros placeholder, CxC 40/60, cotización `convertida`, oportunidad `ganada`, outbox. Incluye `conversion-preview`.
2. Ejemplo de CxC: total 243 144.90, hoy 2026-09-29, viaje 2026-11-18 → 97 257.96 vence 2026-10-02 y 145 886.94 vence 2026-11-03.
3. Ejemplo de desglose PRD-001: costos Σ 536.00 y precios Σ 690.00 exactos.
4. Misma key → misma respuesta 201; distinta key sobre cotización convertida → 200 con la reserva existente y auditoría `convertir_idempotente`.
5. Sin cupo en cualquier ítem → 409 `PRD-BR-012` con salidas alternativas y sin cambios en BD.
6. Cotización no aprobada → 409 `RT-3`.
7. Supuesto (04 §12#9): con ítems en hold de proveedor la reserva nace `confirmada` como en el prototipo.

**Pruebas:** T-R01, T-R04.

**Depende de:** F1B-RES-01, F1B-FIN-01, F1B-COT-07, F0-26, F0-27, F0-25 · **Prioridad:** P0

#### F1B-RES-03 · Pruebas de concurrencia de conversión y cupos

**Historia:** Como responsable técnico, quiero probar la conversión bajo concurrencia, para asegurar una reserva por cotización y `sold <= capacity`.

**Especificación:** 04 §10; reglas RT-22, RT-4

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Pruebas Pest en paralelo (procesos/`pcntl` o Octane test) para la doble barrera de idempotencia y la carrera de cupos.
2. 10 requests concurrentes de conversión → 1 reserva.
3. Dos conversiones sobre la misma salida con cupo para una → una 201 y otra 409; `sold <= capacity`.

**Pruebas:** T-R02, T-R03.

**Depende de:** F1B-RES-02 · **Prioridad:** P0

#### F1B-RES-04 · Reserva directa y verificación de disponibilidad

**Historia:** Como asesor, quiero crear una reserva sin cotización con disponibilidad y precio en vivo, para vender en mostrador.

**Especificación:** 04 §4.7, §4.1, RES-BR-04…06; reglas RES-BR-04, RES-BR-05, RES-BR-06, RES-BR-50, H-09

**Tablas:** `booking_reservations`, `booking_reservation_services`, `booking_inventory_holds`, `fin_receivables`

**Endpoints:** `POST /api/v1/reservations/availability-check`, `POST /api/v1/reservations`

**Pantallas:** —

**Criterios de aceptación:**

1. Previsualización de disponibilidad y precio; creación con «Guardar borrador» o «Crear y confirmar»; tarifa por canal, salida obligatoria en POR_SALIDA, anticipación mínima y máx. pax en otros modelos; impuestos con el `TaxService` único; servicios por componentes, pasajeros placeholder, CxC 40/60.
2. Sin cupo con confirm=true → 409; con confirm=false → `pendiente_disponibilidad` sin hold.
3. Ventas solo elige clientes de su cartera y queda como vendedor.
4. Idempotency-Key obligatoria; lock de salida.
5. Supuestos: (04 §12#6, H-09) la reserva directa aplica IGV con el mismo `TaxService` que la cotización; (04 §12#7) el borrador con disponibilidad crea hold temporal con expiración `holdMinutes` y sin CxC hasta confirmar. Ambos difieren del prototipo: confirmar con negocio.

**Pruebas:** T-R05.

**Depende de:** F1B-RES-02 · **Prioridad:** P0

#### F1B-RES-05 · Máquina de estados de la reserva: confirmar, iniciar y completar

**Historia:** Como Operaciones o gerencia, quiero confirmar, iniciar y completar la reserva con sus guardas, para que el estado refleje la realidad.

**Especificación:** 04 §4.1, RES-BR-07/08; reglas RES-BR-07, RES-BR-08, RES-BR-03

**Tablas:** `booking_reservations`

**Endpoints:** `POST /api/v1/reservations/{id}/confirm`, `POST /api/v1/reservations/{id}/start-operation`, `POST /api/v1/reservations/{id}/complete`

**Pantallas:** —

**Criterios de aceptación:**

1. `ReservationStateMachine` con transiciones y guardas, incluidas las automáticas (último servicio confirmado → confirmada; pago que salda → confirmada).
2. Confirmar con servicio rechazado sin alternativa → 409.
3. Iniciar operación con `travel_from > hoy + 1` → 409.
4. Ningún controlador actualiza `status` directamente (test de arquitectura Pest).

**Pruebas:** T-R06.

**Depende de:** F1B-RES-01 · **Prioridad:** P0

#### F1B-RES-06 · Pasajeros de la reserva

**Historia:** Como Operaciones, quiero completar los datos nominativos de los pasajeros, para operar y emitir documentos.

**Especificación:** 04 §3 booking_passengers, RES-BR-09/10, RES-V21-04; reglas RES-BR-09, RES-BR-10, RES-V21-04

**Tablas:** `booking_passengers`

**Endpoints:** `POST /api/v1/reservations/{id}/passengers`, `PUT /api/v1/reservations/{id}/passengers/{pid}`, `DELETE /api/v1/reservations/{id}/passengers/{pid}`

**Pantallas:** —

**Criterios de aceptación:**

1. Alta, edición y baja de pasajeros con validación de datos nominativos, tipo sugerido por edad (advertencia en la respuesta) y titular único.
2. Falta documento, nacionalidad o nacimiento → 422.
3. Tipo distinto al sugerido por edad → 200 con `warnings`.
4. Agregar/quitar pasajeros no cambia precio ni cupos (aviso).
5. Supuesto (04 §12#12): se mantiene el comportamiento del prototipo (solo aviso).

**Pruebas:** Pest: RES-BR-09.

**Depende de:** F1B-RES-01 · **Prioridad:** P0

#### F1B-RES-07 · Servicios de la reserva frente al proveedor

**Historia:** Como Operaciones, quiero solicitar, confirmar o rechazar servicios con el proveedor desde la reserva, con alternativa, para asegurar cada servicio.

**Especificación:** 04 §4.2, RES-BR-11…13; reglas RES-BR-11, RES-BR-12, RES-BR-13, PRD-BR-007

**Tablas:** `booking_reservation_services`, `ops_supplier_requests`

**Endpoints:** `POST /api/v1/reservations/{id}/services/{sid}/request`, `POST /api/v1/reservations/{id}/services/request-pending`, `POST /api/v1/reservations/{id}/services/{sid}/confirm`, `POST /api/v1/reservations/{id}/services/{sid}/reject`

**Pantallas:** —

**Criterios de aceptación:**

1. Solicitar (uno o todos los pendientes), confirmar con código y rechazar con motivo + alternativa (otro proveedor activo del mismo tipo o misma fecha distinta). Reserva confirmada → pendiente_proveedor al rechazar; vuelve a confirmada al confirmar el último pendiente.
2. Proveedor no activo → 422.
3. Confirmar sin código → 422.
4. Rechazo con alternativa crea servicio `pendiente` con `alt_of_id` y marca `replaced_by_id`.
5. Nota: Estos endpoints y los de 05 §6.2 escriben la misma tabla: ambos delegan en un único `SupplierRequestService` (registra `ops_supplier_requests`).

**Pruebas:** T-R07.

**Depende de:** F1B-RES-05, F1B-OPS-01 · **Prioridad:** P0

#### F1B-RES-08 · Modificación de reserva con aprobación de supervisor

**Historia:** Como Operaciones, quiero solicitar cambios con impacto económico y que un supervisor los apruebe, para controlar precios y cupos.

**Especificación:** 04 §4.4, RES-BR-14/15; reglas RES-BR-14, RES-BR-15, RT-4, PRD-BR-014

**Tablas:** `booking_changes`, `booking_reservation_services`, `booking_inventory_holds`, `fin_receivables`

**Endpoints:** `POST /api/v1/reservations/{id}/changes/preview`, `POST /api/v1/reservations/{id}/changes`, `POST /api/v1/reservations/{id}/changes/{cid}/approve`, `POST /api/v1/reservations/{id}/changes/{cid}/reject`

**Pantallas:** —

**Criterios de aceptación:**

1. Preview de impacto y disponibilidad; solicitud (tipos pax/servicio/upgrade/otro); aplicar directo si el actor aprueba; aprobar/rechazar; efectos en pasajeros, cupos, servicios, total y CxC (cargo o reducción + crédito).
2. Modificación de Operaciones queda `pendiente` y notifica a los aprobadores (no a un usuario fijo).
3. Aprobar aplica total, CxC y cupos en una transacción con locks de salidas.
4. Delta negativo reduce CxC abiertas en orden y el exceso queda en `credit_amount`.

**Pruebas:** T-R08.

**Depende de:** F1B-RES-05, F1B-INT-01 · **Prioridad:** P0

#### F1B-RES-09 · Reprogramación de reserva

**Historia:** Como Operaciones, quiero reprogramar la reserva con la diferencia tarifaria calculada, para mover fechas sin rehacer la venta.

**Especificación:** 04 §4.5, RES-BR-20…24; reglas RES-BR-20, RES-BR-21, RES-BR-22, RES-BR-23, RES-BR-24, RT-4

**Tablas:** `booking_reservations`, `booking_reservation_services`, `booking_changes`, `booking_inventory_holds`, `ops_orders`, `ops_assignments`, `ops_vouchers`, `fin_receivables`

**Endpoints:** `POST /api/v1/reservations/{id}/reschedule/preview`, `POST /api/v1/reservations/{id}/reschedule`

**Pantallas:** —

**Criterios de aceptación:**

1. Preview por servicio (nueva fecha, disponibilidad, diferencia por factor de temporada) y aplicación: libera y retiene salidas, recalcula precios y costos, servicios → pendiente, orden operativa y asignaciones reiniciadas, vouchers anulados, CxC por diferencia positiva, notificación `cambio.horario`.
2. Servicio de 1 000 del 28-nov (×1.00) al 05-dic (×0.88) → diferencia −120.00.
3. Con un servicio completado → 409 «use Modificar».
4. Idempotency-Key + If-Match + locks de salidas.
5. Supuesto (04 §12#5): sin cargo por cambio ni crédito por diferencia negativa, como el prototipo.

**Pruebas:** T-R09.

**Depende de:** F1B-RES-05, F1B-OPS-02, F1B-OPS-08 · **Prioridad:** P0

#### F1B-RES-10 · Cancelación con penalidad por política snapshot

**Historia:** Como gerente, quiero cancelar una reserva con la penalidad de su política snapshot, para liquidar al cliente de forma justa y trazable.

**Especificación:** 04 §4.6, RES-BR-30…32, H-06, H-10, E2E-09; reglas RES-BR-30, RES-BR-31, RES-BR-32, RT-8, H-10

**Tablas:** `booking_cancellations`, `booking_reservations`, `booking_reservation_services`, `booking_inventory_holds`, `fin_receivables`, `fin_payments`, `ops_orders`, `ops_assignments`, `ops_vouchers`

**Endpoints:** `POST /api/v1/reservations/{id}/cancellation/preview`, `POST /api/v1/reservations/{id}/cancel`

**Pantallas:** —

**Criterios de aceptación:**

1. Preview y cancelación: tramos estructurados `[{min_days, pct}]` del `policies_snapshot` (fallback al parser de texto del prototipo solo para snapshots antiguos), fórmula con factor k, efectos 1–9 (liberar cupos, cancelar servicios, anular vouchers, cancelar CxC abiertas, CxC de penalidad a 7 días, pago de reembolso pendiente, orden cancelada, `booking_cancellations`, notificaciones).
2. RES-2026-000348 (hoy 2026-09-29): penalidad 53 480, reembolso 0, CxC de penalidad 30 036.
3. Tramos 48 h / 24 h / Tren / estándar correctos para d = 0, 1, 2, 6, 7, 14, 15.
4. Con reembolso: pago `kind=reembolso`, `status=pendiente` y `credit_note_id` nulo marcado como pendiente de emisión.
5. Motivo obligatorio; Idempotency-Key + If-Match + locks.
6. Supuesto (H-06, 07 P-10): la nota de crédito por cancelación se emite por OSE con serie propia en Fase 2. En 1B no se crea `fin_invoices`; la cancelación deja el reembolso pendiente y la NC queda en la cola de emisión de Fase 2. Supuesto (04 §12#3): k excluye servicios `rechazado`, como el prototipo.

**Pruebas:** T-R10, T-R11, T-R12, E2E-09.

**Depende de:** F1B-RES-05, F1B-FIN-03, F1B-OPS-02 · **Prioridad:** P0

#### F1B-RES-11 · Solicitud de anulación Ventas → Gerencia

**Historia:** Como asesor de Ventas, quiero solicitar la anulación a gerencia, para respetar la segregación de funciones.

**Especificación:** 04 §4.6 (solicitud), RES-BR-33; reglas RES-BR-33

**Tablas:** `booking_cancel_requests`

**Endpoints:** `POST /api/v1/reservations/{id}/cancel-requests`, `POST /api/v1/reservations/{id}/cancel-requests/{rid}/reject`

**Pantallas:** —

**Criterios de aceptación:**

1. Solicitud por el dueño sin `reservations.cancel`, rechazo con nota por gerencia y «Procesar cancelación» que precarga RES-10.
2. Segunda solicitud pendiente → 409.
3. Solo el dueño la crea; notifica a managers; la reserva sigue vigente.
4. Al cancelar, la solicitud pasa a `aprobada` y notifica al solicitante.

**Pruebas:** T-R13.

**Depende de:** F1B-RES-10 · **Prioridad:** P0

#### F1B-RES-12 · Pago rápido, CxC manual, reasignación, historial y confirmación PDF

**Historia:** Como usuario de reservas, quiero atajos de cobro, reasignación, historial y documento de confirmación, para atender al cliente sin cambiar de módulo.

**Especificación:** 04 §6, RES-BR-40/41/51; reglas RES-BR-40, RES-BR-41, RES-BR-51

**Tablas:** —

**Endpoints:** `POST /api/v1/reservations/{id}/receivables/generate`, `POST /api/v1/reservations/{id}/reassign`, `GET /api/v1/reservations/{id}/history`, `GET /api/v1/reservations/{id}/documents/confirmation`

**Pantallas:** —

**Criterios de aceptación:**

1. Atajos desde la reserva que delegan en Finanzas (pago aplicado, generar CxC 40/60), reasignar asesor, historial de auditoría (reserva, servicios y CxC) y documento de confirmación por job.
2. Pago > saldo → 422; pago que salda `pendiente_pago` → `confirmada`.
3. Generar CxC con CxC existentes o reserva cancelada → 409.
4. Reasignar requiere `reservations.reassign`.
5. Nota: El pago rápido usa `POST /api/v1/finance/payments` (FIN-03); no se crea un endpoint propio.

**Pruebas:** T-R15.

**Depende de:** F1B-FIN-03, F1B-INT-01 · **Prioridad:** P0

#### F1B-RES-13 · Jobs de reservas: expiración de holds y pendientes

**Historia:** Como Operaciones, quiero que los holds vencidos se liberen solos y ser alertado de pendientes, para no perder ventas por cupos retenidos.

**Especificación:** 04 §8, H-14; reglas H-14

**Tablas:** `booking_inventory_holds`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. `holds:expire` cada 5 min común a todos los canales (holds temporales → expirada, `sold` recalculado) y `reservations:detect-pending` (pendientes de proveedor/pago próximos a viajar → alerta).
2. Hold vencido libera cupo y audita `Disponibilidad · liberar` con actor Sistema.
3. Jobs con `ShouldBeUnique` y registro en `sys_job_runs`.
4. Nota: Si Fase 1A ya entrega `ExpireHolds` del catálogo (holds del motor 16), esta historia solo lo extiende a `booking_inventory_holds`.

**Pruebas:** Pest: holds:expire.

**Depende de:** F1B-RES-01, F1A-CAT-26 · **Prioridad:** P1

#### F1B-RES-14 · Listado, KPIs, ocupación y Reserva 360 por rol

**Historia:** Como usuario interno, quiero listar reservas, ver su ocupación y abrir la Reserva 360 con los datos de mi rol, para trabajar con lo que me corresponde.

**Especificación:** 04 §2, §6, §7; reglas RES-BR-50, RT-17

**Tablas:** —

**Endpoints:** `GET /api/v1/reservations`, `GET /api/v1/reservations/kpis`, `GET /api/v1/reservations/occupancy`, `GET /api/v1/reservations/{id}`

**Pantallas:** —

**Criterios de aceptación:**

1. Listado con filtros y `owner=me` para Ventas; 4 KPIs; calendario de ocupación del mes; detalle 360 con `ReservationResource` que omite campos según `seeMargin`, `opsView` y `acc`.
2. Operaciones no recibe `total_amount`, `price_amount` ni margen.
3. Contabilidad no recibe costos.
4. Ventas recibe 403 «fuera de su cartera» en reservas ajenas.

**Pruebas:** T-R13, T-R14, T-R16.

**Depende de:** F1B-RES-01, F0-18 · **Prioridad:** P0

#### F1B-RES-15 · Front: lista/ocupación y reserva directa

**Historia:** Como asesor u Operaciones, quiero la lista, el calendario de ocupación y la reserva directa del prototipo, para vender y planificar.

**Especificación:** 04 §2; reglas RT-17

**Tablas:** —

**Endpoints:** API de F1B-RES-14, F1B-RES-04

**Pantallas:** `/reservas?view=list`, `/reservas?view=occupancy&month=YYYY-MM`, `/reservas/nueva`

**Criterios de aceptación:**

1. `/reservas?view=list|occupancy` y `/reservas/nueva` con panel de disponibilidad y precio en vivo.
2. Operaciones ve columnas «Servicios conf.» y «Costo proveedores».
3. Estados vacío/error/403.
4. Sin scroll horizontal a 400 px.

**Pruebas:** Playwright: RBAC de columnas.

**Depende de:** F1B-RES-14, F1B-RES-04, F0-39 · **Prioridad:** P0

#### F1B-RES-16 · Front: Reserva 360 y modales

**Historia:** Como usuario interno, quiero la Reserva 360 con sus modales, para gestionar el ciclo completo de la reserva.

**Especificación:** 04 §2, §7; reglas RT-17

**Tablas:** —

**Endpoints:** API de F1B-RES-15, F1B-RES-10

**Pantallas:** `/reservas/[code]` (pestañas y diálogos)

**Criterios de aceptación:**

1. `/reservas/[code]`: flujo de estados, alertas, pestañas Resumen, Pasajeros, Servicios, Pagos, Documentos, Operación, Historial; modales Confirmar, Modificar, Reprogramar, Cancelar (con tabla de penalidad del preview), Solicitar anulación, Pasajero, Servicio, Registrar pago, Reasignar.
2. Ventas ve Confirmar/Modificar/Reprogramar deshabilitados con candado y «Solicitar anulación».
3. Contabilidad abre en la pestaña Pagos y no ve Operación.
4. Los montos del modal de cancelación son los del preview de la API.

**Pruebas:** Playwright: U03, U05, U08.

**Depende de:** F1B-RES-15, F1B-RES-10 · **Prioridad:** P0

#### F1B-RES-17 · Front: modal «Convertir en reserva»

**Historia:** Como asesor, quiero convertir desde la cotización viendo precondiciones y cupos, para decidir si convierto o creo una nueva versión.

**Especificación:** 04 §2 (modal en cotización), §4.3; reglas RT-22

**Tablas:** —

**Endpoints:** API de F1B-RES-02, F1B-COT-12

**Pantallas:** Diálogo «Convertir en reserva» en `/cotizaciones/[code]`

**Criterios de aceptación:**

1. Modal en `/cotizaciones/[code]` con precondiciones y disponibilidad por ítem (`conversion-preview`), botón «Convertir y confirmar reserva» con Idempotency-Key generada en cliente y «Crear nueva versión con fecha alternativa».
2. Doble clic no crea dos reservas (misma key).
3. Con ítem sin cupo solo se ofrece nueva versión.

**Pruebas:** E2E-02 (parte).

**Depende de:** F1B-RES-02, F1B-COT-12 · **Prioridad:** P0

#### F1B-RES-18 · Pruebas del módulo de reservas

**Historia:** Como responsable técnico, quiero la suite de pruebas de reservas, para cerrar el módulo con evidencia.

**Especificación:** 04 §10

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Completar T-R01…T-R16 y Playwright de E2E-02 y E2E-09.
2. 16 casos en verde.
3. Fixtures de fecha congelada (2026-09-29) para ejemplos numéricos.

**Pruebas:** T-R01…T-R16, E2E-02, E2E-09.

**Depende de:** F1B-RES-16, F1B-RES-03 · **Prioridad:** P0

### E1B.3 · Operaciones (sin apps)

#### F1B-OPS-01 · Migraciones de operaciones (sin tablas móviles)

**Historia:** Como desarrollador, quiero las tablas de operaciones con restricciones de exclusión, para que los conflictos de rooming y vouchers se impidan en la base.

**Especificación:** 05 §3.1–3.12, §3.15; reglas OPS-BR-02, OPS-BR-30, OPS-BR-31, OPS-BR-41, OPS-BR-71, RT-13

**Tablas:** `ops_orders`, `ops_order_tasks`, `ops_supplier_requests`, `ops_assignments`, `ops_guides`, `ops_drivers`, `ops_vehicles`, `ops_rooming_lists`, `ops_rooming_rooms`, `ops_rooming_guests`, `ops_vouchers`, `ops_voucher_versions`, `ops_incidents`, `ops_incident_logs`, `ops_evidences`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Tablas `ops_*` de la operación web con RLS, CHECK, índices, UNIQUE parciales y restricciones EXCLUDE (extensión `btree_gist`); columna `stay` generada; vista `ops_resource_occupations` (asignaciones + guía/vehículo de `catalog_product_departures`).
2. Dos habitaciones del mismo hotel y número con fechas superpuestas fallan en BD.
3. Un pasajero en dos habitaciones superpuestas falla en BD.
4. Segundo voucher `emitido` del mismo servicio falla en BD.
5. `ops_incident_logs` es append-only (sin UPDATE/DELETE para el rol de la app).
6. Nota: Fuera de 1B: `ops_assignment_checkins`, `ops_mobile_devices`, `ops_sync_actions`, `channel_trip_messages`, `notif_reads` (apps, Fase 2). Columnas v2.1 de rooming por ciudad (`leg_id`, `city`, `hotel_name`, `source`) se crean ya nulas para no migrar dos veces.

**Pruebas:** T-01, T-10 (parte DB), T-11 (parte DB).

**Depende de:** F1B-RES-01 · **Prioridad:** P0

#### F1B-OPS-02 · Orden operativa y tareas

**Historia:** Como coordinador de Operaciones, quiero crear y avanzar la orden operativa de una reserva confirmada, para organizar su ejecución.

**Especificación:** 05 §4.1, OPS-BR-01…07; reglas OPS-BR-01, OPS-BR-02, OPS-BR-03, OPS-BR-04, OPS-BR-05, OPS-BR-06, OPS-BR-07, RES-BR-42

**Tablas:** `ops_orders`, `ops_order_tasks`, `ops_assignments`

**Endpoints:** `GET /api/v1/ops/orders`, `GET /api/v1/ops/orders/kpis`, `GET /api/v1/ops/orders/candidates`, `POST /api/v1/ops/orders`, `GET /api/v1/ops/orders/{id}`, `PATCH /api/v1/ops/orders/{id}/coordinator`, `POST /api/v1/ops/orders/{id}/to-assignment`, `POST /api/v1/ops/orders/{id}/mark-assigned`, `POST /api/v1/ops/orders/{id}/confirm`, `POST /api/v1/ops/orders/{id}/start`, `POST /api/v1/ops/orders/{id}/tasks`, `PATCH /api/v1/ops/order-tasks/{id}`, `DELETE /api/v1/ops/order-tasks/{id}`, `POST /api/v1/reservations/{id}/operation-order`

**Pantallas:** —

**Criterios de aceptación:**

1. Crear orden desde reserva confirmada/en operación (réplica de servicios con `requires_assignment`, 5 tareas por defecto, coordinador), candidatas, cambio de coordinador, transiciones manuales y recálculo automático, tareas (alta, check, baja lógica), iniciar ejecución (reserva → en_operacion). Endpoint de generación desde la reserva.
2. Reserva `pendiente_pago` → 422 `PROC-031`; segunda orden → 409.
3. Sin servicios que requieran asignación → `planificada`.
4. `mark-assigned` con pendientes → 409; `confirm` con servicio `solicitado` → 409.
5. Crear orden con Idempotency-Key.
6. Supuesto (05 §12#10): cancelar la reserva pasa la orden a `cancelada` y libera recursos (lo ejecuta RES-10).

**Pruebas:** T-03, T-04, T-05.

**Depende de:** F1B-OPS-01 · **Prioridad:** P0

#### F1B-OPS-03 · Solicitudes a proveedor desde Operaciones

**Historia:** Como coordinador, quiero gestionar la respuesta de cada proveedor desde la orden, para tener todos los servicios confirmados.

**Especificación:** 05 §4.3, OPS-BR-10…13; reglas OPS-BR-10, OPS-BR-11, OPS-BR-12, OPS-BR-13

**Tablas:** `ops_supplier_requests`, `booking_reservation_services`

**Endpoints:** `POST /api/v1/ops/reservation-services/{id}/supplier-request`, `POST /api/v1/ops/reservation-services/{id}/supplier-confirmation`, `POST /api/v1/ops/reservation-services/{id}/supplier-rejection`, `POST /api/v1/ops/reservation-services/{id}/complete`, `GET /api/v1/ops/supplier-requests`

**Pantallas:** —

**Criterios de aceptación:**

1. Enviar solicitud, registrar confirmación con código, rechazo con motivo y completar servicio (fecha ≤ hoy) desde la orden; historial en `ops_supplier_requests`.
2. Solo servicios `pendiente` se solicitan.
3. Completar antes de la fecha → 422.
4. Mismo servicio de dominio que RES-07.

**Pruebas:** Pest: OPS-BR-10…13.

**Depende de:** F1B-OPS-02, F1B-RES-07 · **Prioridad:** P0

#### F1B-OPS-04 · Asignación de recursos con validación de conflictos

**Historia:** Como coordinador, quiero asignar guías, conductores y vehículos con validación de cruces y documentos, para no programar recursos imposibles.

**Especificación:** 05 §4.2, OPS-BR-20…29; reglas OPS-BR-20, OPS-BR-21, OPS-BR-22, OPS-BR-23, OPS-BR-24, OPS-BR-25, OPS-BR-26, OPS-BR-27, OPS-BR-28, OPS-BR-29

**Tablas:** `ops_assignments`

**Endpoints:** `GET /api/v1/ops/assignments`, `POST /api/v1/ops/orders/{id}/assignments`, `POST /api/v1/ops/assignments/{id}/validate`, `PUT /api/v1/ops/assignments/{id}/resources`, `POST /api/v1/ops/assignments/{id}/confirm`, `POST /api/v1/ops/assignments/{id}/release`

**Pantallas:** —

**Criterios de aceptación:**

1. `AssignmentValidator` (ventana 6 h parametrizable, estados de recurso, idioma, licencia, SOAT, capacidad) con dry-run; asignar/reasignar con aceptación de advertencias y lock Redis por recurso+fecha; confirmar recurso (web); liberar; recálculo de la orden; notificaciones push/WhatsApp opcionales.
2. Guía con servicio de otra orden a < 6 h → 409 con `blocks`; misma orden → `warnings`; sin `ack_warnings` → 422.
3. Licencia vencida, SOAT vencido, capacidad < pax, mantenimiento o vacaciones → bloqueo.
4. Dos asignaciones paralelas del mismo recurso → solo una se aplica.
5. `warnings_ack` guarda usuario, fecha y advertencias.
6. Supuestos (05 §12#3/#4): ventana de 6 h en `sys_settings`; idioma requerido derivado de nacionalidad como el prototipo hasta que exista campo `language`.

**Pruebas:** T-06, T-07, T-08, T-09.

**Depende de:** F1B-OPS-02, F1B-OPS-05 · **Prioridad:** P0

#### F1B-OPS-05 · Recursos: guías, conductores y vehículos

**Historia:** Como coordinador, quiero ver y mantener los recursos con su disponibilidad y alertas de documentos, para planificar la semana.

**Especificación:** 05 §3.7, §4.7, §6.3, §12#7/#8; reglas OPS-BR-24, OPS-BR-26, OPS-BR-27

**Tablas:** `ops_guides`, `ops_drivers`, `ops_vehicles`

**Endpoints:** `GET /api/v1/ops/resources`, `GET /api/v1/ops/resources/availability`, `GET /api/v1/ops/resources/document-alerts`, `GET /api/v1/ops/resources/{type}/{id}/agenda`, `PATCH /api/v1/ops/resources/{type}/{id}/status`

**Pantallas:** —

**Criterios de aceptación:**

1. Listado con ocupación 7 días, matriz de disponibilidad, alertas documentarias (≤ 30 días), agenda por recurso, cambio de estado y CRUD básico de recursos.
2. Estados cambian solo con `operations.assign` y se auditan.
3. El CRUD de recursos aplica soft delete y placa única por tenant.
4. Nota: El CRUD de guías/conductores/vehículos no existe en el prototipo ni en la tabla de API de 05 §6.3 (05 §12#8 lo propone). Supuesto: se exponen como recursos REST estándar bajo `/api/v1/ops/resources/{type}` (POST/PUT/DELETE) y se agregan a la spec §6.3 al implementarlo.

**Pruebas:** Pest: alertas documentarias.

**Depende de:** F1B-OPS-01 · **Prioridad:** P1

#### F1B-OPS-06 · Calendario operativo

**Historia:** Como coordinador, quiero un calendario de servicios y salidas, para ver la carga operativa.

**Especificación:** 05 §2 (calendario), §6.3

**Tablas:** —

**Endpoints:** `GET /api/v1/ops/calendar`

**Pantallas:** —

**Criterios de aceptación:**

1. Eventos de servicios de reservas no canceladas y salidas programadas por rango con flag `pending`.
2. Filtra por tipo de servicio (`service_kind`).
3. Rango máximo 62 días.

**Pruebas:** Pest: calendario.

**Depende de:** F1B-OPS-02 · **Prioridad:** P1

#### F1B-OPS-07 · Rooming list

**Historia:** Como Operaciones, quiero armar y enviar la rooming list al hotel sin conflictos, para asegurar el alojamiento.

**Especificación:** 05 §4.6, OPS-BR-30…36; reglas OPS-BR-30, OPS-BR-31, OPS-BR-32, OPS-BR-33, OPS-BR-34, OPS-BR-35, OPS-BR-36, OPS-V21-03

**Tablas:** `ops_rooming_lists`, `ops_rooming_rooms`, `ops_rooming_guests`

**Endpoints:** `GET /api/v1/ops/rooming-lists`, `POST /api/v1/ops/rooming-lists`, `GET /api/v1/ops/rooming-lists/{id}`, `POST /api/v1/ops/rooming-lists/{id}/validate`, `POST /api/v1/ops/rooming-lists/{id}/rooms`, `PUT /api/v1/ops/rooming-rooms/{id}`, `DELETE /api/v1/ops/rooming-rooms/{id}`, `POST /api/v1/ops/rooming-lists/{id}/confirm`, `POST /api/v1/ops/rooming-lists/{id}/send`, `GET /api/v1/ops/rooming-lists/{id}/document`

**Pantallas:** —

**Criterios de aceptación:**

1. Crear lista por reserva y hotel, habitaciones (alta/edición/baja) con validación de conflictos y capacidad (infantes no ocupan cama), dry-run, confirmar, enviar al hotel (PDF + email, `sent_version`), documento.
2. Errores de EXCLUDE se traducen a mensajes legibles (pasajero/habitación en conflicto).
3. Editar lista enviada → `modificada`; enviar sin confirmar → 409.
4. Permiso `reservations.modify` (no `operations.assign`).
5. Nota: Prellenado desde `booking.lodging` (OPS-V21-02) queda en Fase 2 junto con la reserva web.

**Pruebas:** T-10.

**Depende de:** F1B-OPS-01 · **Prioridad:** P0

#### F1B-OPS-08 · Vouchers con versiones y QR firmado

**Historia:** Como Operaciones, quiero emitir, versionar y anular vouchers con QR firmado, para respaldar cada servicio ante el proveedor.

**Especificación:** 05 §4.4, OPS-BR-40…47; reglas OPS-BR-40, OPS-BR-41, OPS-BR-42, OPS-BR-43, OPS-BR-44, OPS-BR-45, OPS-BR-46, OPS-BR-47, RT-11

**Tablas:** `ops_vouchers`, `ops_voucher_versions`

**Endpoints:** `GET /api/v1/ops/vouchers`, `GET /api/v1/ops/vouchers/pending-issue`, `POST /api/v1/ops/vouchers/check`, `POST /api/v1/ops/vouchers`, `GET /api/v1/ops/vouchers/{id}`, `GET /api/v1/ops/vouchers/{id}/pdf`, `POST /api/v1/ops/vouchers/{id}/resend`, `POST /api/v1/ops/vouchers/{id}/versions`, `POST /api/v1/ops/vouchers/{id}/redeem`, `POST /api/v1/ops/vouchers/{id}/void`

**Pantallas:** —

**Criterios de aceptación:**

1. Dry-run de emisión, emitir (QR HMAC `code|reserva|versión`, snapshot, PDF por job), versiones con motivo, reenviar, marcar utilizado, anular con motivo, servicios confirmados sin voucher, lista con KPIs, URL firmada del PDF.
2. Servicio `solicitado` → 422 `RT-11`; proveedor inactivo → 422; segundo vigente → 409.
3. Misma Idempotency-Key → mismo voucher.
4. Acciones sobre anulado/utilizado → 409.
5. Nueva versión conserva el código e incrementa `version`.

**Pruebas:** T-11, T-12.

**Depende de:** F1B-OPS-03, F0-30 · **Prioridad:** P0

#### F1B-OPS-09 · Incidencias con SLA y alerta crítica

**Historia:** Como coordinador, quiero registrar y resolver incidencias con SLA y alerta a gerencia si son críticas, para operar 24/7.

**Especificación:** 05 §4.5, OPS-BR-60…65, H-07; reglas OPS-BR-60, OPS-BR-61, OPS-BR-62, OPS-BR-63, OPS-BR-64, OPS-BR-65, H-07

**Tablas:** `ops_incidents`, `ops_incident_logs`

**Endpoints:** `GET /api/v1/ops/incidents`, `POST /api/v1/ops/incidents`, `GET /api/v1/ops/incidents/{id}`, `POST /api/v1/ops/incidents/{id}/take`, `PATCH /api/v1/ops/incidents/{id}/assignee`, `PATCH /api/v1/ops/incidents/{id}/classification`, `POST /api/v1/ops/incidents/{id}/resolve`, `POST /api/v1/ops/incidents/{id}/close`, `POST /api/v1/ops/incidents/{id}/reopen`, `POST /api/v1/ops/incidents/{id}/comments`, `POST /api/v1/ops/incidents/{id}/evidences`

**Pantallas:** —

**Criterios de aceptación:**

1. Crear (web), tomar, asignar, reclasificar (recalcula SLA), resolver, cerrar con reglas por severidad, reabrir con motivo, comentarios en bitácora, asociar evidencias; alerta a gerencia por push + WhatsApp para `critica` sin importar el origen; job `IncidentSlaMonitor` cada 5 min.
2. Crítica → notificaciones push + WhatsApp a Manager en cola `critical`.
3. Cerrar crítica sin evidencia → 422; alta sin resolución → 422.
4. Reclasificar recalcula `sla_due_at`; el job marca vencidas.
5. Código INC por `sys_sequences` (no máx+1).
6. Supuesto (05 §12#12): SLA en horas corridas.

**Pruebas:** T-13, T-14.

**Depende de:** F1B-OPS-02, F1B-OPS-10 · **Prioridad:** P0

#### F1B-OPS-10 · Evidencias (web)

**Historia:** Como coordinador, quiero adjuntar evidencias a servicios e incidencias, para sustentar el cierre.

**Especificación:** 05 §3.12, OPS-BR-70/71; reglas OPS-BR-70, OPS-BR-71

**Tablas:** `ops_evidences`

**Endpoints:** `POST /api/v1/ops/evidences/presign`, `POST /api/v1/ops/orders/{id}/evidences`, `DELETE /api/v1/ops/evidences/{id}`

**Pantallas:** —

**Criterios de aceptación:**

1. URL S3 prefirmada, registro de evidencias subidas (servicio opcional o incidencia), deduplicación por sha256 por orden, retiro lógico con motivo, job `ProcessEvidence` (MIME, tamaño, miniatura, EXIF).
2. Mismo hash en la misma orden → devuelve la evidencia existente.
3. Retiro sin motivo → 422.
4. Solo image/* o application/pdf.

**Pruebas:** Pest: dedupe sha256.

**Depende de:** F1B-OPS-01, F0-30 · **Prioridad:** P0

#### F1B-OPS-11 · Cierre operativo (PROC-039)

**Historia:** Como coordinador, quiero cerrar la operación solo cuando se cumplen las precondiciones, para habilitar la liquidación en Finanzas.

**Especificación:** 05 §4.1 (en_ejecucion → completada), OPS-BR-80…84, H-16; reglas OPS-BR-80, OPS-BR-81, OPS-BR-82, OPS-BR-83, OPS-BR-84, H-16

**Tablas:** `ops_orders`, `booking_reservations`

**Endpoints:** `GET /api/v1/ops/orders/{id}/close-checks`, `POST /api/v1/ops/orders/{id}/close`, `GET /api/v1/ops/orders/{id}/cost-summary`

**Pantallas:** —

**Criterios de aceptación:**

1. Checklist de 4 precondiciones, cierre solo desde `en_ejecucion`, reserva → completada, evento `OperationClosed` (habilita CxP y rentabilidad en Finanzas), resumen de costos con venta/margen solo con permisos de rentabilidad.
2. Cada precondición falla por separado → 422 con código.
3. Orden no `en_ejecucion` → 409.
4. Operaciones no recibe `sale`/`margin` en `cost-summary`.

**Pruebas:** T-02, T-15.

**Depende de:** F1B-OPS-09, F1B-OPS-10 · **Prioridad:** P0

#### F1B-OPS-12 · Jobs operativos del back-office

**Historia:** Como coordinador, quiero alertas automáticas de pendientes, asignaciones sin confirmar y documentos por vencer, para anticiparme.

**Especificación:** 05 §8.3

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. `DetectPendingSupplierServices` (cada 2 h), `ExpireUnconfirmedAssignments` (cada 30 min, solo alerta), `ResourceDocumentAlerts` (diario).
2. Registran `sys_job_runs`.
3. No liberan asignaciones automáticamente.
4. Supuesto (05 §12#2): alerta al coordinador 24 h antes; `NotifyUpcomingTrips` y `SendExpoPush` quedan para Fase 2 (apps).

**Pruebas:** Pest: jobs operativos.

**Depende de:** F1B-OPS-04 · **Prioridad:** P1

#### F1B-OPS-13 · Front: órdenes y Orden 360

**Historia:** Como coordinador, quiero la lista de órdenes y la Orden 360 del prototipo, para gestionar la operación completa.

**Especificación:** 05 §2; reglas RT-17

**Tablas:** —

**Endpoints:** API de F1B-OPS-02, F1B-OPS-11

**Pantallas:** `/operaciones/ordenes`, `/operaciones/ordenes/[code]`

**Criterios de aceptación:**

1. `/operaciones/ordenes` (KPIs, alerta de críticas, filtros) y `/operaciones/ordenes/[code]` con pestañas Servicios y asignaciones, Tareas, Pasajeros, Rooming, Vouchers, Incidencias, Evidencias, Cierre (pestaña recordada), actualización en tiempo real por Reverb (`tenant.{t}.ops`).
2. Operaciones ve costos y no ve venta/margen.
3. Botones sin permiso deshabilitados con «Requiere permiso …».
4. Sin scroll horizontal a 400 px.

**Pruebas:** Playwright: RBAC Operaciones.

**Depende de:** F1B-OPS-02, F1B-OPS-11, F0-39 · **Prioridad:** P0

#### F1B-OPS-14 · Front: calendario, asignaciones y recursos

**Historia:** Como coordinador, quiero el calendario, la vista de asignaciones y el modal de asignación con validación en vivo, para asignar sin errores.

**Especificación:** 05 §2; reglas OPS-BR-28

**Tablas:** —

**Endpoints:** API de F1B-OPS-04, F1B-OPS-06

**Pantallas:** `/operaciones/calendario`, `/operaciones/asignaciones`

**Criterios de aceptación:**

1. `/operaciones/calendario` (mes/semana/lista + drawer), `/operaciones/asignaciones` (tarjetas, alertas, matriz 7 días, asignación rápida, agenda) y modal de asignación con validación en vivo (dry-run) y casilla «Asumo las advertencias».
2. El modal muestra bloqueos y advertencias devueltos por la API antes de guardar.

**Pruebas:** E2E-03 (parte).

**Depende de:** F1B-OPS-04, F1B-OPS-06 · **Prioridad:** P0

#### F1B-OPS-15 · Front: rooming, vouchers e incidencias

**Historia:** Como Operaciones, quiero las pantallas de rooming, vouchers e incidencias, para ejecutar cada proceso como en el prototipo.

**Especificación:** 05 §2; reglas RT-17

**Tablas:** —

**Endpoints:** API de F1B-OPS-07, F1B-OPS-08, F1B-OPS-09

**Pantallas:** `/operaciones/rooming/[reservationCode]`, `/operaciones/vouchers`, `/operaciones/vouchers/[code]`, `/operaciones/incidencias`, `/operaciones/incidencias/[code]`

**Criterios de aceptación:**

1. `/operaciones/rooming/[reservationCode]`, `/operaciones/vouchers` y `/[code]` (documento con QR, versiones, acciones), `/operaciones/incidencias` y `/[code]` (flujo de 8 pasos, bitácora, SLA, evidencias).
2. Sin `operations.vouchers` se ve la alerta del prototipo.
3. La barra de SLA refleja `sla_due_at` de la API.

**Pruebas:** E2E-10 (web).

**Depende de:** F1B-OPS-07, F1B-OPS-08, F1B-OPS-09 · **Prioridad:** P0

#### F1B-OPS-16 · Pruebas del módulo de operaciones (web)

**Historia:** Como responsable técnico, quiero la suite de pruebas de operaciones web, para cerrar el módulo con evidencia.

**Especificación:** 05 §10

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Casos Pest T-01…T-15 y Playwright E2E-03 (hasta voucher visible en el portal del cliente) y E2E-10 con la incidencia crítica registrada desde la web.
2. 15 casos en verde.
3. T-16…T-21 (móvil y pasajero) se marcan como Fase 2.
4. Nota: E2E-10 del prototipo parte de la app del operador; en 1B la incidencia se registra desde la web.

**Pruebas:** T-01…T-15, E2E-03, E2E-10.

**Depende de:** F1B-OPS-15 · **Prioridad:** P0

### E1B.4 · Finanzas básicas (sin OSE ni conciliación)

#### F1B-FIN-01 · Migraciones de finanzas básicas

**Historia:** Como desarrollador, quiero las tablas de finanzas básicas con sus restricciones, para que los saldos y el tipo de cambio sean consistentes en la base.

**Especificación:** 07 §3.1–3.12; reglas RT-15, RT-24, FIN-BR-27 (UNIQUE), FIN-BR-37 (UNIQUE)

**Tablas:** `fin_receivables`, `fin_receivable_reminders`, `fin_payments`, `fin_payment_applications`, `fin_status_history`, `fin_payables`, `fin_payable_payouts`, `fin_bank_accounts`, `fin_payment_methods`, `fin_commission_rules`, `fin_commissions`, `fin_settlements`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Tablas `fin_*` de CxC, pagos, aplicaciones, historial de estados, CxP/costos, payouts, cuentas bancarias, métodos de pago, reglas y comisiones, liquidaciones. CHECK de fx obligatorio en moneda distinta a la base, `paid_amount <= amount`, UNIQUE de idempotencia.
2. CxC en USD sin `fx_rate` falla en BD.
3. `fin_payment_applications` UNIQUE (payment_id) WHERE reversed_at IS NULL.
4. Semillas de `fin_payment_methods` (8) y `fin_commission_rules` (3 %, 2.5 %, convenio B2B).
5. Supuesto: 07 §3.19 propone `fin_fx_rates` y 09 §3.9 define `sys_fx_rates`. En 1-B se usa `sys_fx_rates` (Fase 0) y no se crea `fin_fx_rates`, que llega con el módulo de monedas de Fase 2 (spec 17). Fuera de 1B: `fin_document_series`, `fin_invoices`, `fin_invoice_lines`, `fin_fiscal_events`, `fin_bank_statements`, `fin_bank_lines`, `fin_reconciliation_closures`, `fin_period_closes`, `fin_period_close_checks`.

**Pruebas:** T01.

**Depende de:** F1B-RES-01 · **Prioridad:** P0

#### F1B-FIN-02 · Cuentas por cobrar, anticipos y recordatorios

**Historia:** Como Finanzas, quiero gestionar cuentas por cobrar, anticipos y recordatorios, para cobrar a tiempo.

**Especificación:** 07 §4.1, §5.2 (FIN-BR-01…06); reglas FIN-BR-01, FIN-BR-02, FIN-BR-03, FIN-BR-04, FIN-BR-05, FIN-BR-06, FIN-BR-59, H-12

**Tablas:** `fin_receivables`, `fin_receivable_reminders`

**Endpoints:** `GET /api/v1/finance/receivables`, `GET /api/v1/finance/receivables/summary`, `GET /api/v1/finance/receivables/{code}`, `GET /api/v1/finance/reservations/{code}/account`, `POST /api/v1/finance/receivables/advances`, `POST /api/v1/finance/receivables/{code}/reminders`

**Pantallas:** —

**Criterios de aceptación:**

1. Listado con saldo y saldo PEN (TC del documento), resumen con aging de 5 tramos, detalle, cuenta de la reserva (comprometido/disponible), solicitar anticipo con lock de reserva, recordatorios (email + WhatsApp si hay teléfono), jobs `fin:mark-overdue` y `fin:payment-reminders`.
2. Anticipo > disponible no comprometido → 422 `PROC-041`; reserva cancelada → 422.
3. Recordatorio a CxC pagada → 409.
4. El job de vencidas no toca pagadas ni canceladas.
5. Acciones exigen `finance.payments.register` además de `finance.receivables`.
6. Supuesto (07 FIN-BR-06): aging unificado a 5 tramos. El KPI «cobrado por facturar» de Contabilidad queda para Fase 2 (depende de comprobantes).

**Pruebas:** T11, T21, T22.

**Depende de:** F1B-FIN-01 · **Prioridad:** P0

#### F1B-FIN-03 · Pagos: registrar, validar, aplicar, rechazar y revertir

**Historia:** Como Finanzas, quiero registrar, validar, aplicar y revertir pagos contra obligaciones, para que los saldos y el estado de la reserva sean exactos.

**Especificación:** 07 §4.2, §5.3 (FIN-BR-07…17), RT-09; reglas RT-09, RT-22, FIN-BR-07, FIN-BR-08, FIN-BR-09, FIN-BR-11, FIN-BR-12, FIN-BR-13, FIN-BR-14, FIN-BR-15, FIN-BR-16, FIN-BR-17

**Tablas:** `fin_payments`, `fin_payment_applications`, `fin_status_history`, `fin_receivables`, `booking_reservations`

**Endpoints:** `GET /api/v1/finance/payments`, `GET /api/v1/finance/payments/{code}`, `POST /api/v1/finance/payments`, `POST /api/v1/finance/payments/{code}/validate`, `POST /api/v1/finance/payments/{code}/reject`, `POST /api/v1/finance/payments/{code}/retry`, `POST /api/v1/finance/payments/{code}/apply`, `POST /api/v1/finance/payments/{code}/revert`

**Pantallas:** —

**Criterios de aceptación:**

1. Registrar y aplicar atómico (back-office), validar pagos `pendiente` (confirmar o confirmar y aplicar), rechazar con motivo, reintentar, aplicar confirmados, revertir con permiso propio; recálculo de CxC por aplicaciones vigentes, sincronización `pendiente_pago → confirmada`, historial de estados, locks por CxC.
2. Monto > saldo → 422 `PROC-042`; transferencia sin referencia → 422; efectivo sin referencia → 201.
3. Pago total en CxC única de reserva `pendiente_pago` → CxC pagada, reserva confirmada, 3 auditorías.
4. Aplicar `pendiente` → 409; revertir `rechazado` → 409; revertir sin permiso → 403.
5. Dos aplicaciones simultáneas que exceden el saldo → una 409.
6. Misma Idempotency-Key → un solo pago.
7. Nota: El método «Crédito B2B» (FIN-BR-10, H-02) se deja inactivo en `fin_payment_methods` hasta Fase 2 (B2B). La indicación de match bancario del modal de validación (FIN-BR-12) depende de conciliación (Fase 2). Supuesto (07 P-09): la reversión no devuelve la reserva a `pendiente_pago`.

**Pruebas:** T02, T04, T05, T07, T08, T09, T10.

**Depende de:** F1B-FIN-02 · **Prioridad:** P0

#### F1B-FIN-04 · Cuentas por pagar y pagos a proveedores

**Historia:** Como Finanzas, quiero aprobar, programar y pagar cuentas por pagar a proveedores, para controlar la salida de caja.

**Especificación:** 07 §4.3, §5.4 (FIN-BR-18…22); reglas FIN-BR-18, FIN-BR-19, FIN-BR-20, FIN-BR-21, FIN-BR-22, FIN-BR-59

**Tablas:** `fin_payables`, `fin_payable_payouts`, `fin_bank_accounts`, `fin_status_history`

**Endpoints:** `GET /api/v1/finance/payables`, `GET /api/v1/finance/payables/by-provider`, `GET /api/v1/finance/payables/summary`, `GET /api/v1/finance/payables/{code}`, `POST /api/v1/finance/payables/{code}/approve`, `POST /api/v1/finance/payables/{code}/schedule`, `POST /api/v1/finance/payables/{code}/payouts`, `GET /api/v1/finance/bank-accounts`

**Pantallas:** —

**Criterios de aceptación:**

1. Generación de CxP por servicio con proveedor, aprobar (advertencias no bloqueantes), programar (fecha ≥ hoy, cuenta de la moneda), payouts con N° de operación, vista por proveedor, KPIs, cuentas bancarias de origen. Estados `abierta, aprobada, parcial, pagada, vencida, cancelada`.
2. Programar o pagar CxP no aprobada → 422 `PROC-046`; fecha pasada → 422.
3. Rol con `finance.payables` sin `finance.payments.register` aprueba pero no paga (403).
4. Cancelar la reserva cancela las CxP sin pagos.
5. Supuesto: la spec dice que la CxP se genera «por servicio de reserva (Reservas/Operaciones)» sin fijar el momento. Se genera al confirmar el servicio con el proveedor (código de confirmación), vence según condición de pago del proveedor (default fecha de servicio) y se ajusta al cerrar la operación. Pago sin factura del proveedor (07 P-11) no se bloquea en 1B; la factura vive en la extranet (Fase 2).

**Pruebas:** T03, T12.

**Depende de:** F1B-FIN-01, F1B-OPS-11 · **Prioridad:** P0

#### F1B-FIN-05 · Costos adicionales

**Historia:** Como Finanzas, quiero registrar costos adicionales y ver su impacto en el margen, para que la rentabilidad sea real.

**Especificación:** 07 §4.3 (costo), FIN-BR-23/24; reglas FIN-BR-23, FIN-BR-24, PRD-BR-007

**Tablas:** `fin_payables`

**Endpoints:** `POST /api/v1/finance/costs/preview`, `POST /api/v1/finance/costs`

**Pantallas:** —

**Criterios de aceptación:**

1. Preview de impacto en margen (semáforo) y registro de costo adicional como CxP `kind=costo_adicional`; impacta rentabilidad solo al aprobarse (`Rentabilidad · impacto_costo`).
2. Reserva cancelada o borrador → 422; proveedor inactivo → 422.
3. Costo no aprobado no altera la rentabilidad; aprobado sí.

**Pruebas:** T13.

**Depende de:** F1B-FIN-04 · **Prioridad:** P0

#### F1B-FIN-06 · Comisiones

**Historia:** Como Finanzas, quiero calcular, aprobar y pagar comisiones con reglas configurables, para liquidar a vendedores sin cálculos manuales.

**Especificación:** 07 §4.4, §5.5 (FIN-BR-26…30), H-11; reglas FIN-BR-26, FIN-BR-27, FIN-BR-28, FIN-BR-29, FIN-BR-30, H-11

**Tablas:** `fin_commissions`, `fin_commission_rules`

**Endpoints:** `GET /api/v1/finance/commissions`, `GET /api/v1/finance/commissions/summary`, `GET /api/v1/finance/commission-rules`, `GET /api/v1/finance/commissions/{code}`, `POST /api/v1/finance/commissions/calculate`, `POST /api/v1/finance/commissions/{code}/approve`, `POST /api/v1/finance/commissions/{code}/recalculate`, `POST /api/v1/finance/commissions/{code}/pay`

**Pantallas:** —

**Criterios de aceptación:**

1. Reglas en `fin_commission_rules`, cálculo idempotente de pendientes (una por reserva y tipo), aprobar, recalcular (aprobada vuelve a calculada; pagada bloqueada), pagar con forma y referencia, resumen por beneficiario, diferencia contra regla vigente.
2. Calcular dos veces no duplica.
3. 3 % / 2.5 % sobre neto sin IGV en PEN.
4. Recalcular pagada → 422; aprobada → calculada.
5. Supuesto (07 P-08): porcentajes configurables en `fin_commission_rules`. La regla B2B por convenio existe pero no tiene datos hasta Fase 2.

**Pruebas:** T14.

**Depende de:** F1B-FIN-01 · **Prioridad:** P0

#### F1B-FIN-07 · Rentabilidad

**Historia:** Como gerente o Finanzas, quiero ver la rentabilidad por reserva, producto, vendedor y canal, para decidir con márgenes reales.

**Especificación:** 07 §5.6 (FIN-BR-31…35), H-11, H-12; reglas FIN-BR-31, FIN-BR-32, FIN-BR-33, FIN-BR-34, FIN-BR-35, H-11, H-12

**Tablas:** —

**Endpoints:** `GET /api/v1/finance/profitability`, `GET /api/v1/finance/profitability/reservations`

**Pantallas:** —

**Criterios de aceptación:**

1. KPIs, series mensuales, margen por producto, vendedor y canal, tabla por reserva con semáforo; ingresos netos de IGV, costos de servicios no cancelados + costos adicionales aprobados, comisiones; consolidación PEN al TC del documento.
2. USD usa el TC conservado del documento, no el del día.
3. Semáforo unificado <15 % rojo, 15–25 % ámbar, ≥25 % verde.
4. Solo `finance.profitability`.
5. Supuesto (07 P-07, H-11): ingresos de rentabilidad netos de IGV (difiere de FIN-BR-32 literal, que usa el total).

**Pruebas:** T13, T22.

**Depende de:** F1B-FIN-05, F1B-FIN-06 · **Prioridad:** P0

#### F1B-FIN-08 · Liquidación de reserva y estado de cuenta

**Historia:** Como Finanzas, quiero liquidar la reserva con un checklist y enviar el estado de cuenta, para cerrar su ciclo económico.

**Especificación:** 07 §4.5, FIN-BR-36…38; reglas FIN-BR-36, FIN-BR-37, FIN-BR-38

**Tablas:** `fin_settlements`

**Endpoints:** `GET /api/v1/finance/reservations/{code}/settlement`, `POST /api/v1/finance/reservations/{code}/settlement`, `POST /api/v1/finance/reservations/{code}/account-statement`

**Pantallas:** —

**Criterios de aceptación:**

1. Estado de resultados, flujo de caja, cobros, costos, comisiones y checklist; cerrar liquidación con snapshot (única); enviar estado de cuenta en PDF por email.
2. Checklist incompleto → 422 enumerando pendientes; completo → snapshot; segunda vez → 409.
3. Notifica `reserva.liquidada` al responsable.
4. Supuesto (07 P-18): sin reapertura; ajustes posteriores van al periodo siguiente.

**Pruebas:** T15.

**Depende de:** F1B-FIN-07, F1B-OPS-11 · **Prioridad:** P0

#### F1B-FIN-09 · Panel de Finanzas

**Historia:** Como Finanzas, quiero mi panel con cifras idénticas a las del módulo, para empezar el día con prioridades.

**Especificación:** 07 §2.1, §6.8; reglas H-12, C19

**Tablas:** —

**Endpoints:** `GET /api/v1/finance/dashboards/finance`

**Pantallas:** —

**Criterios de aceptación:**

1. Endpoint del panel del rol finance con una sola fuente de cálculo (estado derivado y TC conservado).
2. Las cifras coinciden con las de CxC/CxP/pagos del módulo.
3. Meta de margen leída de configuración (H-21).
4. Nota: El panel de Contabilidad (07 §2.2) y el cierre de periodo dependen de comprobantes: Fase 2.

**Pruebas:** Pest: panel = módulo.

**Depende de:** F1B-FIN-07 · **Prioridad:** P1

#### F1B-FIN-10 · Front: cuentas por cobrar y pagos

**Historia:** Como Finanzas, quiero las pantallas de cobros y pagos del prototipo, para operar la cobranza.

**Especificación:** 07 §2; reglas RT-17, FIN-BR-59

**Tablas:** —

**Endpoints:** API de F1B-FIN-03

**Pantallas:** `/finanzas/cobros`, `/finanzas/cobros/[code]`, `/finanzas/pagos`, `/finanzas/pagos/[code]`

**Criterios de aceptación:**

1. `/finanzas/cobros` y `/[code]`, `/finanzas/pagos` y drawer: KPIs, aging, próximos vencimientos, tablas filtrables, modales Solicitar anticipo, Registrar pago, Validar, Rechazar, Aplicar, Revertir (saldo antes/después), recordatorio.
2. Manager ve sin botones de acción y banner «Modo supervisión».
3. Contabilidad ve consulta sin registrar.

**Pruebas:** FIN-E2E-C (parte).

**Depende de:** F1B-FIN-03, F0-39 · **Prioridad:** P0

#### F1B-FIN-11 · Front: cuentas por pagar, costos y comisiones

**Historia:** Como Finanzas o gerente, quiero las pantallas de cuentas por pagar, costos y comisiones, para aprobar y pagar.

**Especificación:** 07 §2; reglas RT-17

**Tablas:** —

**Endpoints:** API de F1B-FIN-05, F1B-FIN-06

**Pantallas:** `/finanzas/cuentas-por-pagar`, `/finanzas/cuentas-por-pagar/[code]`, `/finanzas/comisiones`, `/finanzas/comisiones/[code]`

**Criterios de aceptación:**

1. `/finanzas/cuentas-por-pagar` (Por documento, Por proveedor, Costos registrados; Aprobar, Programar, Pagar, Registrar costo con impacto) y `/finanzas/comisiones` (reglas, resumen, Calcular, Aprobar, Pagar, Recalcular).
2. Manager aprueba CxP y comisiones pero no ve «Pagar».
3. Contabilidad recibe 403 en ambas rutas.

**Pruebas:** FIN-E2E-C.

**Depende de:** F1B-FIN-05, F1B-FIN-06 · **Prioridad:** P0

#### F1B-FIN-12 · Front: rentabilidad, liquidación y panel de Finanzas

**Historia:** Como gerente o Finanzas, quiero la rentabilidad, la liquidación y el panel de Finanzas, para seguir el margen.

**Especificación:** 07 §2, §2.1; reglas FIN-BR-35

**Tablas:** —

**Endpoints:** API de F1B-FIN-08, F1B-FIN-09

**Pantallas:** `/finanzas/rentabilidad`, `/finanzas/rentabilidad/[reservationCode]`, `/dashboard` (rol finance)

**Criterios de aceptación:**

1. `/finanzas/rentabilidad` (flujo oficial, KPIs, gráficos, cortes, tabla con semáforo), modal de liquidación y `/dashboard` del rol finance.
2. Gráficos siguen la guía dataviz del kit.
3. Sin `finance.profitability` la ruta responde 403.

**Pruebas:** E2E-05 (parte).

**Depende de:** F1B-FIN-08, F1B-FIN-09 · **Prioridad:** P0

#### F1B-FIN-13 · Pruebas de finanzas básicas

**Historia:** Como responsable técnico, quiero la suite de pruebas de finanzas básicas, para cerrar el módulo con evidencia.

**Especificación:** 07 §10

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Casos Pest T01–T15, T21, T22 y Playwright E2E-05 (sin comprobante), E2E-09 (lado finanzas) y FIN-E2E-C.
2. Casos en verde; T16–T20 (fiscal y conciliación) marcados como Fase 2.

**Pruebas:** T01…T15, T21, T22, E2E-05, FIN-E2E-C.

**Depende de:** F1B-FIN-12 · **Prioridad:** P0

### E1B.5 · Portal del cliente

#### F1B-POR-01 · Portal del cliente: acceso, inicio y cotizaciones

**Historia:** Como cliente, quiero entrar a mi portal y revisar, aprobar o rechazar mis propuestas, para decidir mi viaje en línea.

**Especificación:** 08 §5.4, §6.5, §4.4, H-04; reglas PCL-BR-01, PCL-BR-02, PCL-BR-03, PCL-BR-04, PCL-BR-05, PCL-BR-06, H-04

**Tablas:** `quote_quotes`, `quote_views`

**Endpoints:** `GET /api/v1/portal/client/home`, `GET /api/v1/portal/client/quotes`, `GET /api/v1/portal/client/quotes/{code}`, `POST /api/v1/portal/client/quotes/{code}/view`, `POST /api/v1/portal/client/quotes/{code}/approve`, `POST /api/v1/portal/client/quotes/{code}/reject`, `POST /api/v1/portal/client/quotes/{code}/update-request`, `GET /api/v1/portal/client/quotes/{code}/pdf`

**Pantallas:** —

**Criterios de aceptación:**

1. Vínculo `iam_users.crm_client_id` tomado del token (nunca de la URL), middleware PCL-BR-01; inicio con KPIs; cotizaciones no borrador (versión vigente sin costos), marcar vista solo si el actor es el cliente, aprobar con evidencia (nombre, aceptación, IP, hash), rechazar con motivo tipificado, solicitar actualización (ticket), PDF. Reusa los servicios de COT-07/08.
2. Cliente CLI-0001 no abre cotizaciones de otro cliente (404).
3. Aprobar vencida → 422; sin aceptar condiciones → 422; con aprobación interna pendiente → 409.
4. Aprobación con Idempotency-Key y `lock_version`.
5. Supuesto: el usuario `customer` se crea por invitación desde Cliente 360 (Fase 1A/Fase 0); el flujo de alta del usuario cliente no está en 08.

**Pruebas:** T01 (08), T02 (08), T18 (08).

**Depende de:** F1B-COT-08, F1B-POR-03 · **Prioridad:** P0

#### F1B-POR-02 · Portal del cliente: viajes, documentos, obligaciones y notificaciones

**Historia:** Como cliente, quiero ver mis viajes, documentos, obligaciones y notificaciones, para tener todo en un lugar.

**Especificación:** 08 §5.4 (PCL-BR-02, PCL-BR-08), §6.5; reglas PCL-BR-02, PCL-BR-08

**Tablas:** —

**Endpoints:** `GET /api/v1/portal/client/reservations`, `GET /api/v1/portal/client/reservations/{code}`, `GET /api/v1/portal/client/reservations/{code}/itinerary.pdf`, `GET /api/v1/portal/client/documents`, `GET /api/v1/portal/client/receivables`, `GET /api/v1/portal/client/payments`, `GET /api/v1/portal/client/notifications`

**Pantallas:** —

**Criterios de aceptación:**

1. Mis viajes (reservas no borrador, progreso de servicios confirmados) y detalle, itinerario PDF, documentos (vouchers no anulados, propuestas aprobadas/convertidas, itinerarios), obligaciones y pagos, notificaciones.
2. Ninguna respuesta incluye costos, márgenes ni versiones no vigentes.
3. CxC canceladas no se listan.
4. Nota: Los comprobantes electrónicos aparecen en Documentos cuando exista facturación (Fase 2).

**Pruebas:** T02 (08).

**Depende de:** F1B-POR-01, F1B-OPS-08, F1B-FIN-02 · **Prioridad:** P0

#### F1B-POR-03 · Solicitudes de soporte (tickets) desde el portal

**Historia:** Como cliente, quiero enviar solicitudes a mi asesor desde el portal, para no depender del correo.

**Especificación:** 08 §3.12, PCL-BR-09; reglas PCL-BR-09

**Tablas:** `channel_support_tickets`, `channel_support_ticket_events`

**Endpoints:** `GET /api/v1/portal/client/tickets`, `POST /api/v1/portal/client/tickets`

**Pantallas:** —

**Criterios de aceptación:**

1. Tablas de tickets y eventos, alta con asignación al asesor del cliente, notificación `soporte.ticket`, listado propio.
2. Asunto y mensaje obligatorios.
3. `owner_id` = asesor del cliente; `first_response_due_at` = 4 h hábiles.
4. Supuesto (08 §3.12): si en Fase 2 el Inbox (10) absorbe los tickets, estas tablas migran a `collab_`. La gestión interna del ticket (en_proceso/resuelta/cerrada) no está prototipada; en 1B solo se consulta desde Cliente 360.

**Pruebas:** Pest: ticket.

**Depende de:** F0-29 · **Prioridad:** P0

#### F1B-POR-04 · Pago en línea desde el portal (interfaz de pasarela)

**Historia:** Como cliente, quiero pagar total o parcialmente una obligación en línea, para reservar sin transferencias manuales.

**Especificación:** 08 §6.5, RT-9, PCL-BR-07, D-02; reglas RT-9, PCL-BR-07

**Tablas:** `fin_payments`

**Endpoints:** `POST /api/v1/portal/client/receivables/{id}/payments`

**Pantallas:** —

**Criterios de aceptación:**

1. Endpoint de pago parcial o total de una obligación contra la interfaz `PaymentGateway` con un driver sandbox; pago aprobado → aplicado (FIN-03), rechazado → `rechazado` con reintento; evento `ClientPortalPaymentApplied/Failed`.
2. Monto > saldo → 422 `RT-9`; pago parcial → CxC `parcial`.
3. Idempotency-Key obligatoria.
4. Con el tenant sin pasarela configurada el botón «Pagar en línea» se oculta.
5. Nota: La pasarela real (D-02) y sus webhooks son Fase 2 (spec 15). Supuesto (08 §12#12): un pago total no cambia el estado de la reserva salvo la regla FIN-BR-15.

**Pruebas:** T20 (08).

**Depende de:** F1B-FIN-03 · **Prioridad:** P1

#### F1B-POR-05 · Previsualización interna del portal en solo lectura

**Historia:** Como asesor o gerente, quiero ver el portal como lo ve el cliente sin ejecutar acciones, para dar soporte sin riesgo.

**Especificación:** 08 §7.3, H-05, PCL-BR-10; reglas H-05, PCL-BR-06, PCL-BR-10

**Tablas:** —

**Endpoints:** `GET /api/v1/channels/portal-preview/clients`, `GET /api/v1/channels/portal-preview/clients/{clientId}/{portalPath}`

**Pantallas:** —

**Criterios de aceptación:**

1. Endpoints de previsualización que reutilizan los GET del portal sin efectos (no marcan vista, no aprueban, no pagan, no crean tickets); Ventas solo su cartera; auditoría `previsualizar_portal`.
2. Previsualizar una cotización enviada no la pasa a `vista`.
3. Cualquier POST en modo previsualización → 403.
4. Ventas y cliente ajeno → «Registro fuera de su cartera».

**Pruebas:** T03 (08), T19 (08).

**Depende de:** F1B-POR-02 · **Prioridad:** P0

#### F1B-POR-06 · Front del portal del cliente

**Historia:** Como cliente, quiero un portal claro en móvil y escritorio, para gestionar mis propuestas y viajes.

**Especificación:** 08 §2 (portal-cliente); reglas PCL-BR-01

**Tablas:** —

**Endpoints:** API de F1B-POR-01, F1B-POR-02, F1B-POR-05

**Pantallas:** `(portal-cliente)/inicio`, `/cotizaciones`, `/cotizaciones/[code]`, `/reservas`, `/reservas/[code]`, `/documentos`, `/pagos`, `/notificaciones`, `/soporte`; `(backoffice)/canales/portal-cliente/[clientId]/…`

**Criterios de aceptación:**

1. Grupo `app/(portal-cliente)` con shell externo: inicio, cotizaciones y detalle (aprobar/rechazar/solicitar actualización), viajes y detalle, documentos, pagos, notificaciones, soporte; y la barra «Vista del canal» solo para internos en `(backoffice)/canales/portal-cliente/[clientId]/…`.
2. Externos nunca ven «Vista del canal» ni «Ver como…».
3. Sin scroll horizontal a 400 px.
4. Accesible con teclado (Radix).

**Pruebas:** P05 (08), P07 (08).

**Depende de:** F1B-POR-01, F1B-POR-02, F1B-POR-05, F0-39 · **Prioridad:** P0

#### F1B-POR-07 · Pruebas del portal del cliente

**Historia:** Como responsable técnico, quiero la suite de pruebas del portal del cliente, para cerrar el módulo con evidencia.

**Especificación:** 08 §10

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Pest T01, T02, T03, T18, T19, T20 (partes del portal cliente) y Playwright P05 y P07.
2. Casos en verde.

**Pruebas:** T01, T02, T03, T18, T19, T20, P05, P07.

**Depende de:** F1B-POR-06 · **Prioridad:** P0

### E1B.6 · Reportes básicos, exportación y paneles

#### F1B-REP-01 · Read models de reportes

**Historia:** Como gerente, quiero que los reportes lean modelos precalculados, para obtener cifras rápidas y consistentes.

**Especificación:** 09 §3.17; reglas REP-BR-06, H-21

**Tablas:** `rpt_monthly_sales`, `rpt_seller_performance`, `rpt_funnel`, `rpt_sales_by_channel` (objetos nuevos de esta historia: rpt_monthly_sales, rpt_seller_performance, rpt_funnel, rpt_sales_by_channel; agregarlos a database/ y regenerar el diccionario antes de programar)

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Vistas materializadas por tenant con RLS: ventas mensuales, desempeño por vendedor, embudo y ventas por canal; refresco por job en cola `reports` cada 15 min y on-demand; montos a PEN con el `fx_rate` del documento.
2. Reservas canceladas no suman ventas.
3. `REFRESH MATERIALIZED VIEW CONCURRENTLY` sin bloquear lecturas.
4. Embudo y canales ya no son valores fijos.

**Pruebas:** Pest: read models.

**Depende de:** F1B-RES-01, F1B-FIN-01, F1A-CRM-01 · **Prioridad:** P0

#### F1B-REP-02 · Centro de reportes: 7 reportes con alcance por rol

**Historia:** Como usuario interno, quiero los 7 reportes con el alcance de mi rol, para analizar sin ver datos que no me corresponden.

**Especificación:** 09 §6.7, §7.3, §7.4, REP-BR-01…06; reglas REP-BR-01, REP-BR-02, REP-BR-03, REP-BR-04, REP-BR-06

**Tablas:** —

**Endpoints:** `GET /api/v1/reports/{report}`

**Pantallas:** —

**Criterios de aceptación:**

1. Endpoint único por reporte (comercial, cotizaciones, reservas, operaciones, finanzas, proveedores, clientes) con periodo y sede; pestañas por permiso; Ventas filtrado a su cartera; campos sensibles condicionales.
2. Ventas: comercial solo su cartera; finanzas → 403.
3. Contabilidad: finanzas sin `cost`, `profit`, `margin`.
4. Operaciones: sin CxP ni márgenes.

**Pruebas:** T-24, T-25.

**Depende de:** F1B-REP-01 · **Prioridad:** P0

#### F1B-REP-03 · Exportación asíncrona (PROC-061)

**Historia:** Como usuario con permiso de exportar, quiero exportaciones asíncronas y auditadas, para descargar datos sin bloquear el sistema.

**Especificación:** 09 §3.16, §4.8, EXP-BR-01, REP-BR-05; reglas EXP-BR-01, REP-BR-05

**Tablas:** `report_exports`

**Endpoints:** `POST /api/v1/reports/exports`, `GET /api/v1/reports/exports`, `GET /api/v1/reports/exports/{id}/download`

**Pantallas:** —

**Criterios de aceptación:**

1. `report_exports` + job `GenerateExport` (CSV) para los 7 reportes y para cualquier tabla de listado (`<modulo>.<tabla>`), descarga por URL firmada, historial, expiración a 7 días, auditoría `exportar`, `descargar`, `exportar_denegado`.
2. Sin `reports.export` → 403 + `exportar_denegado`; con permiso → 202 y estado `disponible`.
3. Misma Idempotency-Key → mismo `export_id`.
4. Todas las listas de la fase exportan por aquí (09 §12#13).
5. Supuesto: formatos XLSX/PDF y envíos programados (`POST /api/v1/reports/schedules`) quedan para reportes avanzados (Fase 3). Si Fase 0 ya entregó `report_exports`, esta historia se reduce a registrar los reportes.

**Pruebas:** T-23.

**Depende de:** F0-28, F0-30 · **Prioridad:** P0

#### F1B-REP-04 · Panel ejecutivo y panel de gerencia

**Historia:** Como Tenant Admin o Manager, quiero el panel ejecutivo y el de gerencia con datos reales, para dirigir el día a día.

**Especificación:** 09 §7.2, §6.7, H-21; reglas H-21, DSH-BR-02

**Tablas:** —

**Endpoints:** `GET /api/v1/dashboard/executive`, `GET /api/v1/dashboard/manager`

**Pantallas:** —

**Criterios de aceptación:**

1. KPIs, series, servicios 7 días, salidas, pendientes, cotizaciones en seguimiento, incidencias; gerencia agrega aprobaciones pendientes (cotizaciones fuera de política, anulaciones de reserva, reversiones), metas y desempeño por asesor. Umbrales y metas desde configuración.
2. Umbrales 5 %/15 % y meta de margen leídos de `sys_settings`.
3. La aprobación desde el panel usa el endpoint de COT-05 (motivo obligatorio).
4. Supuesto (09 §12#7): hasta que exista el módulo Metas (Fase 3) la meta mensual es un parámetro de configuración.

**Pruebas:** T-28.

**Depende de:** F1B-REP-01, F1B-COT-05 · **Prioridad:** P1

#### F1B-REP-05 · Front: centro de reportes y paneles

**Historia:** Como usuario interno, quiero el centro de reportes y los paneles del prototipo, para consultar y exportar.

**Especificación:** 09 §2, §7.2–7.4; reglas REP-BR-05

**Tablas:** —

**Endpoints:** API de F1B-REP-02, F1B-REP-03, F1B-REP-04

**Pantallas:** `/reportes/[tab]`, `/dashboard` (Tenant Admin y Manager)

**Criterios de aceptación:**

1. `/reportes/[tab]` con filtros periodo/sede, KPIs, gráficos, tabla detalle y modal de exportación con historial; `/dashboard` de Tenant Admin y Manager.
2. Ventas solo ve pestañas Comercial y Cotizaciones y Exportar deshabilitado con tooltip.
3. Sin scroll horizontal a 400 px en `/reportes/finanzas`.

**Pruebas:** Playwright: Ventas en reportes.

**Depende de:** F1B-REP-02, F1B-REP-03, F1B-REP-04, F0-39 · **Prioridad:** P0

#### F1B-REP-06 · Pruebas de reportes y paneles

**Historia:** Como responsable técnico, quiero la suite de pruebas de reportes, para cerrar el módulo con evidencia.

**Especificación:** 09 §10

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Pest T-23, T-24, T-25, T-28 y Playwright de reportes por rol.
2. Casos en verde.

**Pruebas:** T-23, T-24, T-25, T-28.

**Depende de:** F1B-REP-05 · **Prioridad:** P0

### E1B.7 · Libro de Reclamaciones

#### F1B-LRC-01 · Modelo del Libro de Reclamaciones

**Historia:** Como desarrollador, quiero el modelo del libro sobre los casos de postventa, para cumplir la norma sin duplicar el CRM.

**Especificación:** 12 §3.10, §3.11; reglas LR-BR-01, LR-BR-08

**Tablas:** `crm_cases`, `crm_case_events`, `crm_claim_book_settings`, `sys_holidays`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Extender la tabla de casos de postventa del CRM con las columnas del libro (`is_book`, `book_number`, `sede_id`, `channel`, `book_status`, `consumer` cifrado, `good`, `detail`, `request`, `received_at`, `due_date`, `response_days`, `response`, `closed_at`, `close_note`, `ack_sent_at`, `submitted_by`) con CHECK e índices; historial en `crm_case_events`; parámetros; feriados; correlativo por sede y año.
2. `book_number` UNIQUE por tenant; obligatorio si `is_book` (CHECK).
3. `consumer` se guarda cifrado (`encrypted:array`).
4. Feriados nacionales 2026–2027 sembrados (tenant_id null).
5. Supuesto: 12 dice extender `crm_claims`, pero 01 y Fase 1-A crean `crm_cases` y `crm_case_events`; se extienden esas tablas (el historial del libro va en `crm_case_events`).

**Pruebas:** Pest 1 (12).

**Depende de:** F1A-CRM-20 · **Prioridad:** P0

#### F1B-LRC-02 · Registro de hojas: presencial, portal y público

**Historia:** Como consumidor, quiero registrar una hoja de reclamación en línea o presencial y recibir mi constancia, para ejercer mi derecho.

**Especificación:** 12 §4 (alta), LR-BR-01…05; reglas LR-BR-01, LR-BR-02, LR-BR-03, LR-BR-04, LR-BR-05, LR-BR-09

**Tablas:** `crm_cases`, `crm_case_events`

**Endpoints:** `POST /api/v1/crm/claim-book`, `POST /api/v1/portal/claim-book`, `POST /api/v1/public/claim-book`, `GET /api/v1/portal/claim-book`

**Pantallas:** —

**Criterios de aceptación:**

1. `BusinessDayCalculator` (días hábiles desde el día siguiente, sin fines de semana ni feriados), registro por personal, desde el portal (cliente/pasajero con `client_id` del token) y público (rate limit 5/min por IP + captcha), correlativo `LR-{SEDE}-{AAAA}-{000001}` con FOR UPDATE, constancia PDF por email, aviso al responsable.
2. 20 altas paralelas → correlativos sin duplicados ni saltos.
3. `due_date` salta fines de semana y el 08/10.
4. Menor sin apoderado → 422.
5. Misma Idempotency-Key en el registro público → una sola hoja.
6. Supuesto: el sitio público es Fase 2, pero la hoja virtual es obligación legal; en 1B se publica un formulario público mínimo en `/libro-reclamaciones` del dominio del tenant que consume el endpoint público. El proveedor de captcha no está definido (supuesto: Cloudflare Turnstile, parametrizable).

**Pruebas:** Pest 9 (12), Pest 10 (12).

**Depende de:** F1B-LRC-01, F0-30 · **Prioridad:** P0

#### F1B-LRC-03 · Gestión de hojas: evaluación, respuesta y cierre

**Historia:** Como gerente, quiero evaluar, responder y cerrar hojas dentro del plazo legal, para cumplir con INDECOPI.

**Especificación:** 12 §4 (transiciones), LR-BR-06…08; reglas LR-BR-06, LR-BR-07, LR-BR-08, LR-BR-09

**Tablas:** `crm_cases`, `crm_case_events`

**Endpoints:** `GET /api/v1/crm/claim-book`, `GET /api/v1/crm/claim-book/{id}`, `POST /api/v1/crm/claim-book/{id}/review`, `POST /api/v1/crm/claim-book/{id}/response`, `POST /api/v1/crm/claim-book/{id}/response/resend`, `POST /api/v1/crm/claim-book/{id}/close`, `PATCH /api/v1/crm/claim-book/{id}/links`, `GET /api/v1/crm/claim-book/{id}/certificate`

**Pantallas:** —

**Criterios de aceptación:**

1. Listado con filtros de plazo, detalle, pasar a evaluación con responsable, responder (≥ 40 caracteres, acciones, envío por email, marca fuera de plazo), reenviar, cerrar solo respondidas (sincroniza estado CRM), vincular cliente/reserva, constancia PDF.
2. Cerrar sin respuesta → 409.
3. Responder después del vencimiento → auditoría «fuera de plazo».
4. Detalle, pedido, consumidor y `received_at` no se pueden modificar (Policy + test).
5. Finanzas → 403; cliente solo sus hojas.

**Pruebas:** Pest 2 (12), Pest 9 (12).

**Depende de:** F1B-LRC-02 · **Prioridad:** P0

#### F1B-LRC-04 · Alertas de plazo, reportes y configuración del libro

**Historia:** Como gerente, quiero alertas de vencimiento, reportes y parámetros del libro, para no incumplir plazos.

**Especificación:** 12 §8, §6 (reports, settings), LR-BR-10; reglas LR-BR-10

**Tablas:** `crm_claim_book_settings`, `sys_holidays`

**Endpoints:** `GET /api/v1/crm/claim-book/reports`, `POST /api/v1/crm/claim-book/exports`, `GET /api/v1/crm/claim-book/settings`, `PUT /api/v1/crm/claim-book/settings`

**Pantallas:** —

**Criterios de aceptación:**

1. Job `claims:deadline-alerts` diario 08:00 (por vencer / vencida al responsable y copia a Manager); reportes por tipo, sede, mes y relación anual (export por REP-03); parámetros (plazo, alerta, conservación) y feriados locales.
2. Cambiar el plazo solo afecta hojas nuevas.
3. Editar parámetros requiere `admin.settings.manage`.
4. La relación anual se exporta como job.
5. Nota: `POST /api/v1/crm/claim-book/exports` encola el mismo job `GenerateExport` de REP-03 (tabla `report_exports`).

**Pruebas:** Pest: LR-BR-10.

**Depende de:** F1B-LRC-03, F1B-REP-03 · **Prioridad:** P0

#### F1B-LRC-05 · Front del Libro de Reclamaciones

**Historia:** Como gerente y como consumidor, quiero las pantallas del libro, para registrar y gestionar hojas.

**Especificación:** 12 §2; reglas LR-BR-03, LR-BR-04

**Tablas:** —

**Endpoints:** API de F1B-LRC-03, F1B-POR-06

**Pantallas:** `/crm/reclamaciones`, `/crm/reclamaciones/[code]`, `/crm/reclamaciones/reportes`, `/crm/reclamaciones/configuracion`, `(portal-cliente)/libro-reclamaciones`, `/libro-reclamaciones` (público mínimo)

**Criterios de aceptación:**

1. Back-office `/crm/reclamaciones` (lista con KPIs, detalle con contador de plazo, reportes, configuración); formulario en `(portal-cliente)/libro-reclamaciones` con datos precargados y «Mis hojas»; formulario público mínimo; vista previa interna sin registrar.
2. Zod replica LR-BR-03/04.
3. Sin scroll horizontal a 400 px.
4. Usuario interno sin `crm.claims.manage` → 403.
5. Nota: La ruta del portal del pasajero (`(portal-pasajero)/libro-reclamaciones`) y LR-E2E-02 se completan cuando exista ese portal (Fase 2).

**Pruebas:** LR-E2E-01, LR-E2E-02.

**Depende de:** F1B-LRC-03, F1B-POR-06, F0-39 · **Prioridad:** P0

#### F1B-LRC-06 · Pruebas del Libro de Reclamaciones

**Historia:** Como responsable técnico, quiero la suite de pruebas del libro, para cerrar el módulo con evidencia.

**Especificación:** 12 §10

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Pest 1, 2, 9, 10 (parte libro) y Playwright LR-E2E-01.
2. Casos en verde.

**Pruebas:** Pest 1, Pest 2, Pest 9, Pest 10, LR-E2E-01.

**Depende de:** F1B-LRC-05 · **Prioridad:** P0

### E1B.8 · Integración con Fase 1-A, datos semilla y pruebas de salida

#### F1B-INT-01 · Permisos nuevos propuestos por las specs y catálogo de eventos de notificación de la fase

**Historia:** Como Tenant Admin, quiero que los permisos y eventos de notificación de la fase existan desde el primer despliegue, para configurarlos sin depender de nombres de rol.

**Especificación:** 03 §11#2, 04 §6, 04 §12#11, 00 §7.1; reglas QTE-BR-25, RES-BR-51, RES-BR-14, H-18 (patrón: permiso, no nombre de rol)

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Agregar al seeder de spatie/permission (teams = tenant) los permisos que las specs proponen y registrar en notif_event_rules los eventos que emite la fase (cotizacion.*, reserva.*, proveedor.*, voucher.*, incidencia.*, pago.*, comision.*, reclamacion.*, orden.*, asignacion.*).
2. Existen `quotes.reassign`, `reservations.reassign` y `reservations.approve_changes`, asignados a tenant_admin y manager en la matriz semilla.
3. Ningún Policy de la fase compara nombres de rol; todos usan permisos.
4. Cada evento de notificación de la fase tiene regla por defecto (canales del prototipo) editable en admin/notificaciones.
5. Los destinatarios fijos del prototipo (U02, U05, U07) se resuelven por rol/responsable (04 §12#17, 08 §8.3).
6. Supuesto: `reservations.approve_changes` reemplaza a `quotes.approve_internal` para aprobar modificaciones (propuesta de 04 §12#11); mientras negocio no confirme, el Policy acepta cualquiera de los dos.

**Pruebas:** Pest: PermissionSeeder idempotente, Pest: T-14 (09) sigue verde.

**Depende de:** F0-16, F0-29 · **Prioridad:** P0

#### F1B-INT-02 · Seeders de demo de la fase desde kit-ia/seeds

**Historia:** Como desarrollador, quiero datos de demo coherentes de cotizaciones, reservas, operaciones y finanzas, para reproducir los ejemplos numéricos de las specs.

**Especificación:** BRIEF_KIT; kit-ia/seeds; reglas RT-15 (fx_rate conservado), Secuencias: sys_sequences avanza al máximo sembrado

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Seeders idempotentes que cargan quotes, reservations, operations, rooming, vouchers, incidents, receivables, payments, payables, commissions, guides, drivers, vehicles, supportTickets, claims, claimBook y exports del JSON exportado, mapeando códigos del prototipo a UUID v7 y respetando las máquinas de estado (sin saltarse servicios de dominio salvo el estado inicial).
2. `php artisan db:seed --class=Phase1BDemoSeeder` deja COT-2026-00191 v3 con total 243 144.90 y RES-2026-000348 con total 58 610 y pagado 23 444.
3. Tras sembrar, `sys_sequences` de Cotización, Reserva, Orden operativa, Voucher, Incidencia, CxC, Pago, CxP, Comisión y Libro por sede no generan códigos repetidos.
4. El seeder corre dos veces sin duplicar filas.
5. Nota: Las colecciones v2.1 (`booking` web, paxFeedback, paxMessages) no se siembran en 1B: pertenecen a Fase 2.

**Pruebas:** Pest: seeder idempotente, Pest: totales de COT-00191 y RES-000348.

**Depende de:** F1B-COT-01, F1B-RES-01, F1B-OPS-01, F1B-FIN-01, F1B-LRC-01, F0-47, F1A-CAT-02 · **Prioridad:** P0

#### F1B-INT-03 · Suite E2E de salida de fase (Playwright)

**Historia:** Como responsable técnico, quiero los recorridos E2E de salida de la Fase 1 automatizados, para cerrar la fase con evidencia.

**Especificación:** 03-PLAN §2 (criterio de salida Fase 1), 03 §10, 04 §10, 05 §10, 07 §10.2

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Suite Playwright encadenada sobre datos semilla: E2E-01 (tramo cotización), E2E-02, E2E-03 (hasta voucher y portal del cliente), E2E-05 (sin comprobante electrónico), E2E-09 y E2E-10 (versión web). Corre en CI contra la API real.
2. Los 6 recorridos pasan en CI en < 15 min.
3. Cada recorrido verifica también la auditoría generada.
4. Se documenta en la suite que E2E-06 (portal del pasajero) y el paso «emitir comprobante» de E2E-05 quedan para Fase 2.
5. Nota: Problema: el plan exige E2E-06 (portal del pasajero) para salir de Fase 1, pero el mapa de fases del brief ubica el portal del pasajero en Fase 2. Validar con negocio.

**Pruebas:** E2E-01, E2E-02, E2E-03, E2E-05, E2E-09, E2E-10.

**Depende de:** F1B-COT-13, F1B-RES-18, F1B-OPS-16, F1B-FIN-13, F1B-POR-07 · **Prioridad:** P0

#### F1B-INT-04 · Conectar los contratos de Fase 1-A que esperan datos de 1-B

**Historia:** Como desarrollador, quiero conectar los contratos que Fase 1-A dejó con `available_from = "1B"`, para que CRM y Catálogo muestren datos reales de cotizaciones, reservas y finanzas.

**Especificación:** fase-1a (supuestos y historias F1A-CRM-11/16/19/21/22, F1A-CAT-10/13/25/26, F1A-MOT-03); 04 §3; 05 §3.7; reglas H-17, PRD-BR-018, PRD-BR-012

**Tablas:** `catalog_product_departures`

**Endpoints:** API de F1B-RES-02, F1B-OPS-05, F1B-FIN-03, F1B-REP-03

**Pantallas:** Pestañas de Customer 360, Postventa, panel de Ventas, Product 360 y proveedor (ya construidas en 1-A)

**Criterios de aceptación:**

1. Implementar sobre datos reales los contratos que 1-A publicó vacíos: `SoldSeatsProvider` con `booking_inventory_holds` y `booking_reservation_services`; pestañas de Customer 360 (`quotes`, `reservations`, `passengers`, `receivables`, `payments`, `vouchers`); `after-sales/trips` (viajes por cerrar con ownership, H-17); recencia y destinos de fidelización; bloques del panel de Ventas; botón «Crear cotización» de la oportunidad; listas de cotizaciones/reservas en el borrado de producto (PRD-BR-018) y en la ficha del proveedor; FK de `guide_id`/`vehicle_id` de salidas a `ops_guides`/`ops_vehicles` con su validación.
2. Ningún endpoint de 1-A devuelve `meta.available_from = "1B"` al terminar la historia (las pestañas de facturas siguen con `"2"`).
3. La disponibilidad del motor descuenta lo vendido en reservas sin cambiar `BookingEngine`.
4. CRM-T20 se repite con cotizaciones reales y CRM-T29 (exportación) deja de estar en `todo()`.
5. Validación de guía (vacaciones) y vehículo (mantenimiento, asientos) activa en salidas programadas.
6. Nota: Los comprobantes (`invoices`) del Customer 360 pasan a devolver `available_from = "2"`.

**Pruebas:** CRM-T20, CRM-T29, PRD-T04, PRD-T06.

**Depende de:** F1B-RES-02, F1B-OPS-05, F1B-FIN-03, F1B-REP-03, F1A-CAT-26, F1A-CRM-16 · **Prioridad:** P0

## Definición de terminado (toda historia)

- Migraciones reversibles con RLS forzado, CHECK de estados, índices y FK en la misma migración.
- Actions dentro de transacción, con locks donde haya cupos o dinero, eventos de dominio `afterCommit` y auditoría de las acciones críticas.
- Endpoints con FormRequest, Policy + permiso spatie, `JsonResource` que omite campos sensibles por permiso y OpenAPI regenerado.
- Pantallas Next.js equivalentes al prototipo, con estados vacío, error y 403; sin scroll horizontal de página a 400 px.
- Pruebas: aislamiento de tenant, RBAC (403), ownership, máquina de estados, reglas de negocio e idempotencia cuando aplique.
