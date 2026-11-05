# Backlog · Fase 1 (parte A) — CRM, Catálogo y Motor de reservas básico

Alcance: CRM (spec 01), Catálogo (spec 02) y la parte básica del Motor de reservas (spec 16: rangos de disponibilidad, reglas de pasajeros, tarifas y temporadas, disponibilidad y cotización de precio).
Requiere Fase 0 terminada. La parte B de la Fase 1 (cotizaciones, reservas, operaciones, finanzas básicas, portal del cliente, reportes básicos, reclamaciones) consume lo construido aquí.
Criterio de salida de esta parte: suites CRM y Catálogo/Motor en verde; E2E-01 hasta la oportunidad; caso del cliente PRD-011 (16 §10.1) en verde.

Archivo tabular equivalente: `fase-1a.csv`.

## Resumen

| Épica | Nombre | Historias |
|---|---|---|
| E1A.1 | CRM · Leads | 8 |
| E1A.2 | CRM · Oportunidades y actividades | 6 |
| E1A.3 | CRM · Clientes y Customer 360 | 4 |
| E1A.4 | CRM · Postventa, fidelización y panel de Ventas | 6 |
| E1A.5 | Catálogo · Maestros (tipos, destinos, proveedores, servicios) | 7 |
| E1A.6 | Catálogo · Producto y Product 360 | 13 |
| E1A.7 | Catálogo · Tarifas, temporadas y pricing | 4 |
| E1A.8 | Catálogo · Salidas y holds | 3 |
| E1A.9 | Motor de reservas básico (BookingEngine) | 8 |
| E1A.10 | Pruebas de salida de Fase 1-A | 3 |
| **Total** | | **62** |

Prioridad: P0 = imprescindible para el criterio de salida · P1 = necesaria en la fase · P2 = puede pasar a la fase siguiente sin bloquear.

Cobertura referencial: 121 endpoints, 56 tablas citadas, 51 casos de prueba de las especificaciones.

## Cómo usar este backlog con Claude Code

1. Trabajar una historia por sesión, en el orden de dependencias (columna «Depende de»).
2. Entregar a Claude Code el bloque completo de la historia más las secciones de especificación citadas; los criterios de aceptación son la definición de «hecho» de la sesión.
3. Cerrar la historia solo con sus pruebas en verde y la especificación actualizada si hubo cambios (sección 11 y `CHANGELOG.md`).

## Supuestos y decisiones que afectan esta fase

- Fase 1-A se construye antes que Cotizaciones y Reservas (Fase 1-B). Todo dato que depende de ellas (agregados del cliente, pestañas del 360, viajes por cerrar, vendidos por fecha, uso del producto) se expone con el contrato final y devuelve vacío con `meta.available_from = "1B"`; la disponibilidad lee lo vendido a través de la interfaz `SoldSeatsProvider`.
- Se implementan los 10 permisos de catálogo del prototipo, no los 19 de la Spec PRD §35 (02 §12-1, 09 §12-9).
- Factor de temporada: costo en el simulador de rentabilidad y precio en el BookingEngine, con el mismo `SeasonResolver` (02 §12-9, H-13); pendiente de validación con negocio.
- El centro de reglas se siembra con 32 reglas (`seeds/settings.json`): las 31 de la spec 16 más `R-OWN-REVIEWS` (spec 18). En esta fase solo se leen (sin pantalla ni overrides por producto).
- Defaults de pasajeros del tenant en `sys_settings` sección `ecommerce` (16 §3.4): la sección no está en el CHECK de 09 §3.8; se amplía el CHECK.
- Catálogos del CRM (`crm_catalog_items`): la spec no define endpoints de gestión; se siembran por tenant y se leen dentro de los recursos que los usan.
- Formato de códigos CRM `LEAD-0232` (4 dígitos, sin año) mientras no se decida 01 §12-5.
- Destinos con `path` tipo `ltree` (la spec admite ltree o text).
- Reprogramar actividades a fecha pasada se rechaza; monto > 0 también en la conversión de lead; cancelada es estado terminal de la salida; disponibles ignoran holds vencidos (propuestas de 01 §12 #7–8 y 02 §12 #14–15).
- Valores de políticas comerciales (descuento máximo, anticipo, hold) según la configuración sembrada; definitivos pendientes de D-04.

## Fuera de alcance de esta fase

- Precios B2B por agencia, promociones, contenido/SEO, galería y FAQ del producto (02 §3.7, CAT-BR-26/27/29): Fase 2 (canales, sitio y widget).
- Motor completo: adicionales, alojamiento por ciudad, política de pago por producto, recojo, overrides de reglas por producto, centro de reglas `/admin/reglas` y endpoints públicos `/api/v1/public/*` (16 §3.5–3.8, §6.1): Fase 2.
- Cupos y bloqueos `catalogo/cupos` (spec 11), metas comerciales `crm/metas` (spec 14) y Libro de Reclamaciones (spec 12, Fase 1-B).
- Exportación CSV de listados del CRM y del catálogo: con la infraestructura de exportaciones de Fase 1-B.
- Creación de cotizaciones desde la oportunidad y validación de guías/vehículos en salidas: Fase 1-B (specs 03 y 05).

## Historias

### E1A.1 · CRM · Leads

#### F1A-CRM-01 · Modelo de datos CRM y catálogos configurables

**Historia:** Como desarrollador, quiero las tablas del CRM con sus restricciones, para que las reglas se cumplan también en la base.

**Especificación:** 01 §3.1–3.11; CONVENCIONES §2

**Tablas:** `crm_catalog_items`, `crm_leads`, `crm_lead_qualifications`, `crm_clients`, `crm_client_contacts`, `crm_pipeline_stages`, `crm_opportunities`, `crm_activities`, `crm_surveys`, `crm_cases`, `crm_case_events`

**Endpoints:** `GET /api/v1/crm/pipeline-stages` (cache Redis por tenant)

**Pantallas:** —

**Criterios de aceptación:**

1. Migraciones con RLS, CHECK de estados, columnas generadas (`email_norm`, `score` BANT, `category` NPS) y los CHECK compuestos de 01 §3.2, §3.4, §3.7, §3.8, §3.10.
2. UNIQUE parciales: contacto principal por cliente, `lead_id` por oportunidad, encuesta por reserva, documento de cliente `WHERE deleted_at IS NULL`.
3. FKs a tablas de fases posteriores (`booking_reservations`, `quote_quotes`, `channel_b2b_agencies`) como columnas uuid nulas sin FK; la FK se agrega en la migración del módulo dueño.
4. Semilla por tenant de `crm_catalog_items` (9 tipos con los valores del prototipo) y de las 6 etapas con probabilidad 20/35/55/70/100/0.
5. Supuesto: la gestión de catálogos del CRM no tiene endpoints en la spec; en esta fase solo se siembran y se exponen en lectura dentro de los recursos que los usan.
6. Correlativos `LEAD-`, `OPP-`, `ACT-`, `CLI-`, `ENC-`, `REC-` con 4 dígitos (01 §12-5 pendiente).

**Pruebas:** Pest de restricciones DB (CHECK y UNIQUE).

**Depende de:** F0-06, F0-25 · **Prioridad:** P0

#### F1A-CRM-02 · Listado de leads con KPIs, filtros y cola comercial

**Historia:** Como asesor de Ventas, quiero ver mis leads y la bolsa sin asignar, para priorizar a quién contactar.

**Especificación:** 01 §2 (`crm/leads`), §6.1 (GET), §7.2, CRM-BR-33/47; 00 SEC-BR-09

**Tablas:** `crm_leads`

**Endpoints:** `GET /api/v1/crm/leads`

**Pantallas:** —

**Criterios de aceptación:**

1. Filtros `status`, `source`, `owner=me|none|any|{userId}`, `q` (id, nombre, empresa, correo, teléfono, destino, notas); orden y cursor.
2. Ventas: solo propios + sin asignar (no se puede ampliar); Tenant Admin/Manager: todo con filtro Asesor.
3. `meta.kpis`: nuevos hoy, sin contactar (y sin asignar), calificados, conversión (convertidos / no duplicados), por fuente, por estado.
4. Operaciones, Finanzas, Contabilidad, externos y Super Admin → 403.

**Pruebas:** CRM-T02, CRM-T04 (lista).

**Depende de:** F1A-CRM-01, F0-18 · **Prioridad:** P0

#### F1A-CRM-03 · Alta de lead con validación y detección de duplicados

**Historia:** Como asesor, quiero registrar un lead y saber si ya existe como lead o cliente, para no atender dos veces a la misma persona.

**Especificación:** 01 §4.1 (alta, duplicado, merge), §5 CRM-BR-01..07, §6.1 (POST, duplicates)

**Tablas:** `crm_leads`, `crm_activities`

**Endpoints:** `POST /api/v1/crm/leads` (Idempotency-Key recomendado), `GET /api/v1/crm/leads/duplicates`

**Pantallas:** —

**Criterios de aceptación:**

1. Obligatorios nombre, canal, fuente, interés; correo o teléfono (formato y ≥ 7 dígitos) con el mensaje de CRM-BR-02; fecha de viaje ≥ hoy en la zona del tenant; producto solo `ACTIVE`/`APPROVED`.
2. `LeadDuplicateFinder`: coincidencia por `email_norm` o `phone_norm` (últimos 9 dígitos) contra leads (excepto el propio) y clientes.
3. Con coincidencias y sin `duplicate_resolution` → 409 `CRM-BR-04` con la lista; `merge` completa vacíos del existente, suma +5 al score (máx. 100) y no crea fila; `mark_duplicate` crea `duplicado`; `create_new` crea `nuevo` con nota.
4. Score inicial según CRM-BR-07; Ventas queda como owner forzado; si hay owner distinto al actor, notifica `lead.asignado` y audita `asignar`.
5. Audita `Lead crear` / `fusionar`.

**Pruebas:** CRM-T05, CRM-T06, CRM-T07, CRM-T08.

**Depende de:** F1A-CRM-01, F0-29 · **Prioridad:** P0

#### F1A-CRM-04 · Ficha de lead, edición e historial

**Historia:** Como asesor, quiero ver la ficha completa del lead con su historial, para retomar la conversación con contexto.

**Especificación:** 01 §2 (`crm/leads/{code}`), §4.1 (stepper), §6.1 (GET/PATCH `{code}`), §9 (Lead)

**Tablas:** `crm_leads`, `crm_lead_qualifications`, `crm_activities`, `audit_events`

**Endpoints:** `GET /api/v1/crm/leads/{code}`, `PATCH /api/v1/crm/leads/{code}` (lock_version)

**Pantallas:** —

**Criterios de aceptación:**

1. Respuesta incluye BANT vigente, duplicados actuales, actividades, historial (auditoría + actividades completadas + «recibido») y `step` del flujo de 8 pasos según 01 §4.1.
2. Ventas: propio o sin asignar; ajeno → 403 `SCOPE_OWNERSHIP`.
3. Editar solo si no está `convertido`/`descartado`; Ventas no cambia owner; recalcula duplicados; audita `editar` con campos cambiados.

**Pruebas:** CRM-T04 (detalle ajeno 403).

**Depende de:** F1A-CRM-03 · **Prioridad:** P0

#### F1A-CRM-05 · Tomar lead de la cola y asignar/reasignar

**Historia:** Como asesor, quiero tomar un lead libre sin chocar con un compañero; como Gerente, quiero asignar y reasignar la cartera.

**Especificación:** 01 §4.1 (asignación), §5 CRM-BR-08/09, §6.1 (take, assign), §8.3; H-18

**Tablas:** `crm_leads`, `crm_activities`

**Endpoints:** `POST /api/v1/crm/leads/{code}/take`, `POST /api/v1/crm/leads/{code}/assign` (lock_version)

**Pantallas:** —

**Criterios de aceptación:**

1. `take` atómico (`UPDATE … WHERE owner_id IS NULL`): uno gana, el otro 409 «Otro asesor tomó el lead antes que usted»; crea actividad Llamada «Primer contacto — {nombre}» a ahora+2 h (tope 20:00) y notifica `lead.tomado` a los Manager activos; audita `tomar_lead`.
2. `assign` exige `crm.records.reassign` (no nombre de rol); asesor distinto al actual; opción `schedule_first_contact`; notifica `lead.reasignado`/`lead.asignado`.
3. Ventas en `assign` → 403.

**Pruebas:** CRM-T09, CRM-T10.

**Depende de:** F1A-CRM-04 · **Prioridad:** P0

#### F1A-CRM-06 · Máquina de estados del lead: estado, BANT, descartar, reabrir, duplicado y fusión

**Historia:** Como asesor, quiero mover el lead por su ciclo con reglas claras, para que el embudo refleje la realidad.

**Especificación:** 01 §4.1, §5 CRM-BR-10/11/13/14, §6.1 (status, qualify, discard, reopen, mark-duplicate, merge)

**Tablas:** `crm_leads`, `crm_lead_qualifications`, `crm_activities`

**Endpoints:** `POST /api/v1/crm/leads/{code}/status`, `/qualify`, `/discard`, `/reopen`, `/mark-duplicate`, `/merge` (lock_version; merge en transacción)

**Pantallas:** —

**Criterios de aceptación:**

1. `LeadStateMachine` con las transiciones de 01 §4.1; `convertido`/`descartado` no se eligen en «Cambiar estado» (422).
2. `calificado` exige score ≥ 50 (409 `CRM-BR-10`); pasar de `nuevo` exige owner (409 `CRM-BR-11`); `contactado` fija `first_contact_at`.
3. `qualify` inserta fila BANT (0/10/18/25 ×4), devuelve si alcanzó el umbral; si supervisor sin owner, queda como owner.
4. `discard` exige motivo del catálogo, guarda `discarded_at_step` y cierra actividades pendientes con `auto_closed`.
5. `merge` pasa el origen a `duplicado`, completa vacíos, score = máximo y mueve actividades (`merged_from_lead_id`); auditoría en ambos leads.

**Pruebas:** CRM-T11, CRM-T12, CRM-T16.

**Depende de:** F1A-CRM-04 · **Prioridad:** P0

#### F1A-CRM-07 · Conversión de lead en cliente + oportunidad (idempotente)

**Historia:** Como asesor, quiero convertir un lead calificado en cliente y oportunidad en un paso, conservando su historial.

**Especificación:** 01 §4.1 (convertir), §5 CRM-BR-12/15..19, §6.1 (convert), §11 #8

**Tablas:** `crm_leads`, `crm_clients`, `crm_client_contacts`, `crm_opportunities`, `crm_activities`

**Endpoints:** `POST /api/v1/crm/leads/{code}/convert` (Idempotency-Key obligatorio)

**Pantallas:** —

**Criterios de aceptación:**

1. Solo `calificado` (409 `CRM-BR-12`); requiere `crm.leads.manage` y `crm.opportunities.manage` + propiedad.
2. `ConvertLeadAction` en una transacción: cliente nuevo (validación de documento CRM-BR-15, duplicado duro 409 CRM-BR-16, segmento sugerido, tags = fuente, `source_lead_id`, contacto principal si empresa) o vínculo a existente (agrega el correo como contacto no principal si falta).
3. Oportunidad en `calificacion`/`descubrimiento` (default) con monto > 0 (supuesto 01 §12-8); reunión de descubrimiento opcional.
4. Lead queda `convertido` con `converted_*`; eventos `LeadConverted`, `ClientCreated`, `OpportunityCreated`; notificación `lead.convertido`.
5. Reintento con la misma key → mismos IDs sin duplicar.

**Pruebas:** CRM-T13, CRM-T14, CRM-T15.

**Depende de:** F1A-CRM-06, F1A-CRM-15, F0-26 · **Prioridad:** P0

#### F1A-CRM-08 · UI Leads: lista, modal nuevo con duplicados en vivo y ficha con stepper

**Historia:** Como asesor, quiero las pantallas de leads equivalentes al prototipo, para trabajar la cola y cada lead.

**Especificación:** 01 §2, §7.3; prototipo `crm.js`

**Tablas:** —

**Endpoints:** F1A-CRM-02…F1A-CRM-07

**Pantallas:** `/crm/leads`, `/crm/leads/new`, `/crm/leads/[code]`

**Criterios de aceptación:**

1. Lista con KPIs, filtros, gráficos por fuente y estado, aviso de cola sin asignar (Ventas) y filtro Asesor (supervisor).
2. Modal nuevo con chequeo de duplicados (debounce 250 ms) y elección `merge|mark_duplicate|create_new`.
3. Ficha: banner de estado, stepper de 8 pasos, BANT, actividades, historial, panel de acciones con reglas de 01 §7.3 (deshabilitadas con tooltip), modal de conversión.
4. Registro ajeno → pantalla «Registro fuera de su cartera».

**Pruebas:** E2E-01 (tramo lead → oportunidad).

**Depende de:** F1A-CRM-07, F0-39 · **Prioridad:** P0

### E1A.2 · CRM · Oportunidades y actividades

#### F1A-CRM-09 · Oportunidades: listado, kanban por etapa y alta

**Historia:** Como asesor, quiero ver mi pipeline por etapa con montos ponderados, para enfocar el cierre.

**Especificación:** 01 §2 (`crm/oportunidades`), §5 CRM-BR-20/21, §6.2 (GET, POST)

**Tablas:** `crm_opportunities`, `crm_pipeline_stages`

**Endpoints:** `GET /api/v1/crm/opportunities` (`group_by=stage`), `POST /api/v1/crm/opportunities` (Idempotency-Key recomendado)

**Pantallas:** —

**Criterios de aceptación:**

1. Filtros `stage`, `open`, `owner`, `q`; `group_by=stage` devuelve items ordenados por cierre y total PEN por columna.
2. `meta.kpis`: pipeline abierto, ponderado, ganadas del mes (por `closed_at`), tasa de cierre; totales en PEN con el TC vigente (CRM-BR-48, supuesto 01 §12-15).
3. Alta: cliente, responsable, título, monto > 0, moneda PEN/USD, cierre ≥ hoy; probabilidad = default de la etapa; Ventas solo para clientes de su cartera y como owner (CRM-BR-21).
4. Notifica `oportunidad.asignada` si owner ≠ actor; audita `crear`.

**Pruebas:** CRM-T21.

**Depende de:** F1A-CRM-01, F1A-CRM-15 · **Prioridad:** P0

#### F1A-CRM-10 · Ficha de oportunidad, edición, cambio de etapa, ganar/perder/reabrir y reasignar

**Historia:** Como asesor, quiero avanzar la oportunidad con reglas de cierre claras, para que el pronóstico sea confiable.

**Especificación:** 01 §4.2, §5 CRM-BR-22..26, §6.2 (GET/PATCH `{code}`, stage, reassign)

**Tablas:** `crm_opportunities`, `crm_activities`

**Endpoints:** `GET /api/v1/crm/opportunities/{code}`, `PATCH /api/v1/crm/opportunities/{code}` (lock_version), `POST /api/v1/crm/opportunities/{code}/stage` (lock_version), `POST /api/v1/crm/opportunities/{code}/reassign`

**Pantallas:** —

**Criterios de aceptación:**

1. `OpportunityStateMachine`: cambio de etapa fija probabilidad por defecto; `ganada` → 100 y `closed_at`; `perdida` exige motivo (y detalle si «Otro») → 0, `lost_at_stage`.
2. Ganar sin cotización aprobada/convertida → 200 con `meta.warnings` (CRM-BR-23; supuesto 01 §12-3).
3. Reabrir exige `confirm_reopen`; destino `lost_at_stage` o `negociacion`; limpia motivo.
4. Ficha con cotizaciones vinculadas (vacío hasta Fase 1-B), actividades propias + del lead e historial.
5. Notificaciones `oportunidad.ganada`/`perdida`/`reasignado`; auditoría `cambio_etapa`, `editar`, `reasignar`.

**Pruebas:** CRM-T17, CRM-T18, CRM-T19.

**Depende de:** F1A-CRM-09 · **Prioridad:** P0

#### F1A-CRM-11 · Sincronización de etapa desde Cotizaciones (listeners)

**Historia:** Como Gerente, quiero que la oportunidad avance sola cuando se cotiza, negocia o convierte, para no tener un pipeline desactualizado.

**Especificación:** 01 §4.2 (automáticos), §5 CRM-BR-27, §8.1 (consumidos), §11 #26

**Tablas:** `crm_opportunities`

**Endpoints:** — (listeners de `QuoteCreated`, `QuoteNegotiationRecorded`, `QuoteConverted`)

**Pantallas:** —

**Criterios de aceptación:**

1. Contrato de eventos publicado en `Domain/Crm/Contracts` para que Cotizaciones (Fase 1-B) los emita con `opportunity_id`.
2. `QuoteCreated` → `cotizacion` (si estaba en calificación/descubrimiento, prob. 55); `QuoteNegotiationRecorded` → `negociacion` (70); `QuoteConverted` → `ganada` (100, `closed_at` hoy, conserva `expected_close_date`).
3. Auditoría `cambio_etapa` con actor Sistema; cola `default`.

**Pruebas:** CRM-T20 con eventos simulados (se repite con cotizaciones reales en Fase 1-B).

**Depende de:** F1A-CRM-10 · **Prioridad:** P1

#### F1A-CRM-12 · Actividades: agenda, alta, completar con próxima, reprogramar, reasignar y JOB-04

**Historia:** Como asesor, quiero una agenda de actividades con resultado obligatorio y seguimiento automático, para no perder contactos.

**Especificación:** 01 §4.3, §5 CRM-BR-28..32, §6.3, §8.2 (JOB-04)

**Tablas:** `crm_activities`, `crm_leads`

**Endpoints:** `GET /api/v1/crm/activities`, `GET /api/v1/crm/activities/related-options`, `POST /api/v1/crm/activities`, `GET /api/v1/crm/activities/{code}`, `POST /api/v1/crm/activities/{code}/complete` (Idempotency-Key), `POST /api/v1/crm/activities/{code}/reschedule`, `POST /api/v1/crm/activities/{code}/reassign`

**Pantallas:** —

**Criterios de aceptación:**

1. Filtros `type`, `owner`, `status=vencida|hoy|proximas|completada`, rango de semana, relación; `meta.kpis` (vencidas, hoy, 7 días, completadas 7 días).
2. `related-options` solo devuelve registros visibles al actor; relación obligatoria si se indica tipo.
3. Completar exige resultado; próxima actividad hereda relación y responsable; listener `ActivityCompleted` pasa el lead `nuevo` → `contactado` (CRM-BR-30).
4. Reprogramar rechaza `due_at < now()` (supuesto 01 §12-7); Ventas solo sobre las propias; supervisor puede asignar a Operaciones.
5. JOB-04 cada hora marca `vencida` y envía recordatorio Portal/Push al owner; notificación `actividad.asignada` si owner ≠ actor.

**Pruebas:** CRM-T22, CRM-T23, CRM-T24.

**Depende de:** F1A-CRM-01, F0-28 · **Prioridad:** P0

#### F1A-CRM-13 · UI Oportunidades: kanban, tabla y ficha

**Historia:** Como asesor, quiero arrastrar oportunidades entre etapas y registrar motivos de pérdida.

**Especificación:** 01 §2, §7.3

**Tablas:** —

**Endpoints:** F1A-CRM-09, F1A-CRM-10

**Pantallas:** `/crm/oportunidades?view=kanban|tabla`, `/crm/oportunidades/new`, `/crm/oportunidades/[code]`

**Criterios de aceptación:**

1. Kanban con drag & drop (dnd-kit) y menú ⋯ en móvil; soltar en «Perdida» abre modal de motivo; confirmación al reabrir.
2. Tabla con totales; ficha con «Mover a», Ganar/Perder/Reabrir, Reasignar (supervisor), «+ Actividad»; «Crear cotización» visible pero deshabilitado hasta Fase 1-B.
3. Preferencia de vista recordada en `localStorage`; a 400 px sin scroll horizontal de página.

**Pruebas:** CRM-E2E-02.

**Depende de:** F1A-CRM-10, F0-38 · **Prioridad:** P0

#### F1A-CRM-14 · UI Actividades: lista agrupada, semana y drawer

**Historia:** Como asesor, quiero ver mi agenda por grupos o por semana y completar actividades rápido.

**Especificación:** 01 §2 (`crm/actividades`), §7.3

**Tablas:** —

**Endpoints:** F1A-CRM-12

**Pantallas:** `/crm/actividades?view=lista|semana`

**Criterios de aceptación:**

1. Grupos Vencidas/Hoy/Próximas/Completadas; calendario lun–dom con navegación; filtro tipo.
2. Drawer con datos, auditoría y acciones Completar (resultado + próxima activada por defecto a +2 días 10:00), Reprogramar, Reasignar.

**Pruebas:** Playwright: completar Llamada de lead nuevo lo pasa a Contactado.

**Depende de:** F1A-CRM-12, F0-38 · **Prioridad:** P0

### E1A.3 · CRM · Clientes y Customer 360

#### F1A-CRM-15 · Clientes: listado, alta con validación documental, edición, contactos y reasignación

**Historia:** Como asesor, quiero un único maestro de clientes persona/empresa con documento válido, para evitar duplicados y rechazos en facturación.

**Especificación:** 01 §5 CRM-BR-15..17, 33, 36, §6.4 (clients, duplicates, contacts, reassign)

**Tablas:** `crm_clients`, `crm_client_contacts`

**Endpoints:** `GET /api/v1/crm/clients`, `GET /api/v1/crm/clients/duplicates`, `POST /api/v1/crm/clients`, `PATCH /api/v1/crm/clients/{code}`, `POST /api/v1/crm/clients/{code}/reassign`, `POST /api/v1/crm/clients/{code}/contacts`, `POST /api/v1/crm/clients/{code}/contacts/{id}/make-primary`

**Pantallas:** —

**Criterios de aceptación:**

1. DNI 8 dígitos; RUC 11 con prefijo 10/15/17/20; empresa peruana exige RUC (`ClientDocumentRule` + CHECK); documento duplicado → 409 `CRM-BR-16`.
2. Correo o teléfono obligatorio; coincidencia blanda exige `confirm_duplicate=true`.
3. Lista con agregados (`reservations_count`, `total_pen`, `balance_pen`, `nps`, `last_purchase_date`) servidos por un read model; en Fase 1-A devuelven 0/nulo hasta que existan reservas y CxC.
4. Ventas: solo `clientIds()`; Finanzas/Contabilidad (`finance.receivables`): lectura, `PATCH` → 403.
5. Primer contacto es principal; «Hacer principal» desmarca los demás; auditoría `crear`, `editar`, `agregar_contacto`, `contacto_principal`, `reasignar`.

**Pruebas:** CRM-T03, CRM-T14 (validación documental).

**Depende de:** F1A-CRM-01 · **Prioridad:** P0

#### F1A-CRM-16 · Customer 360: cabecera, KPIs, alertas y pestañas

**Historia:** Como asesor o Finanzas, quiero ver todo lo del cliente en una ficha, para atenderlo sin buscar en cinco pantallas.

**Especificación:** 01 §2 (`crm/clientes/{code}`), §5 CRM-BR-33/34, §6.4 (GET `{code}`, `{code}/{tab}`, previews)

**Tablas:** Lectura de `crm_*`, `audit_events`, `notif_messages`

**Endpoints:** `GET /api/v1/crm/clients/{code}`, `GET /api/v1/crm/clients/{code}/{tab}`

**Pantallas:** —

**Criterios de aceptación:**

1. Cabecera + 5 KPIs (CRM-BR-34) + alertas (saldo vencido, casos abiertos, `partial_view` para Ventas) + destinos visitados.
2. Pestañas implementadas en 1-A: `leads`, `opportunities`, `activities`, `communications`, `timeline`, `audit`. Pestañas `quotes`, `reservations`, `passengers`, `receivables`, `payments`, `invoices`, `vouchers` devuelven lista vacía con `meta.available_from = "1B"` hasta que existan sus módulos (endpoints de preview de factura/voucher también en 1-B).
3. Ventas dentro del 360 solo ve sus registros; leads propios o sin asignar.
4. `timeline` ordenado desc por fecha con los tipos de 01 §6.4.

**Pruebas:** CRM-T28 (parcial: oportunidades y actividades).

**Depende de:** F1A-CRM-15, F1A-CRM-10, F1A-CRM-12 · **Prioridad:** P0

#### F1A-CRM-17 · Enviar comunicación desde el 360

**Historia:** Como asesor, quiero enviar un correo o mensaje al cliente desde su ficha y que quede registrado.

**Especificación:** 01 §5 CRM-BR-35, §6.4 (communications), §11 #27

**Tablas:** `notif_messages` (`client_id`, `related_type`, `related_id`)

**Endpoints:** `POST /api/v1/crm/clients/{code}/communications` (Idempotency-Key)

**Pantallas:** —

**Criterios de aceptación:**

1. Canal email/whatsapp/portal; asunto obligatorio; destino requerido según canal (422 si falta).
2. Crea `notif_messages` con FK al cliente (no por coincidencia de texto); WhatsApp queda `fallido` con error «canal no configurado» hasta Fase 2.
3. Audita `Cliente comunicacion`; la pestaña Comunicaciones lo muestra.

**Pruebas:** Pest: email encolado; misma key no duplica.

**Depende de:** F1A-CRM-16, F0-29 · **Prioridad:** P1

#### F1A-CRM-18 · UI Clientes y Customer 360

**Historia:** Como asesor o Finanzas, quiero la lista de clientes y la ficha 360 con sus pestañas.

**Especificación:** 01 §2 (`crm/clientes`, `/{code}`), §7.2, §7.3

**Tablas:** —

**Endpoints:** F1A-CRM-15, F1A-CRM-16, F1A-CRM-17

**Pantallas:** `/crm/clientes`, `/crm/clientes/new`, `/crm/clientes/[code]?tab=`

**Criterios de aceptación:**

1. Lista con KPIs y agregados; modal cliente con validación documental y confirmación de duplicado blando.
2. 360 con cabecera, alertas, 5 KPIs y 12 pestañas (las de Fase 1-B con estado vacío «Disponible cuando se active el módulo»).
3. Finanzas/Contabilidad ven alerta «Modo consulta» sin botones; Ventas ve chip «Mi cartera» y `partial_view`.
4. Modal «Enviar comunicación».

**Pruebas:** CRM-T03 vía UI.

**Depende de:** F1A-CRM-16, F0-38 · **Prioridad:** P0

### E1A.4 · CRM · Postventa, fidelización y panel de Ventas

#### F1A-CRM-19 · Encuestas NPS y detractores

**Historia:** Como asesor, quiero registrar el NPS del viaje y que un detractor genere caso y seguimiento automático.

**Especificación:** 01 §4.4, §5 CRM-BR-37..42, §6.5 (after-sales/trips, surveys), §8.1 `DetractorDetected`

**Tablas:** `crm_surveys`, `crm_cases`, `crm_case_events`, `crm_activities`, `crm_clients`

**Endpoints:** `GET /api/v1/crm/after-sales/trips`, `GET /api/v1/crm/surveys`, `POST /api/v1/crm/surveys` (Idempotency-Key)

**Pantallas:** —

**Criterios de aceptación:**

1. Encuesta: cliente y puntaje 0–10; reserva opcional; una por reserva (409 `CRM-BR-41`).
2. NPS ≤ 6: en la misma transacción crea caso `Reclamo` (prioridad `alta` si ≤ 3, si no `media`), actividad Postventa mañana 10:00 y Email `postventa.detractor` al responsable.
3. Actualiza `nps_last` (audit `actualizar_nps`); `meta.stats` con NPS = %promotores − %detractores y distribución 0–10.
4. `after-sales/trips` depende de reservas: en 1-A devuelve vacío con `meta.available_from = "1B"`; alcance por cartera en ambas condiciones (supuesto 01 §12-9).

**Pruebas:** CRM-T25, CRM-T26.

**Depende de:** F1A-CRM-15, F1A-CRM-20 · **Prioridad:** P1

#### F1A-CRM-20 · Casos de postventa: ciclo abierta → en proceso → resuelta → cerrada

**Historia:** Como asesor, quiero gestionar reclamos y feedback con bitácora, para cerrar el ciclo con el cliente.

**Especificación:** 01 §4.4, §5 CRM-BR-43/44, §6.5 (cases)

**Tablas:** `crm_cases`, `crm_case_events`

**Endpoints:** `GET /api/v1/crm/cases`, `POST /api/v1/crm/cases` (Idempotency-Key), `GET /api/v1/crm/cases/{code}`, `POST /api/v1/crm/cases/{code}/start|resolve|close` (lock_version), `POST /api/v1/crm/cases/{code}/follow-ups`

**Pantallas:** —

**Criterios de aceptación:**

1. Felicitación nace `cerrada`; resolver exige texto (422); cerrar solo desde `resuelta` (409).
2. Cada acción agrega `crm_case_events`; cerrar envía Email `postventa.cierre` al cliente.
3. Ventas gestiona solo si es owner del caso o tiene al cliente en cartera (CRM-BR-44).

**Pruebas:** CRM-T27.

**Depende de:** F1A-CRM-15 · **Prioridad:** P1

#### F1A-CRM-21 · Fidelización: segmentación y oportunidad de recompra

**Historia:** Como asesor, quiero detectar clientes para recompra y abrirles una oportunidad prellenada.

**Especificación:** 01 §5 CRM-BR-45/46, §6.5 (loyalty/segments, rebuy-proposal)

**Tablas:** Lectura `crm_clients`, `crm_opportunities`

**Endpoints:** `GET /api/v1/crm/loyalty/segments`, `GET /api/v1/crm/clients/{code}/rebuy-proposal`

**Pantallas:** —

**Criterios de aceptación:**

1. Filtros segmento, recencia (≤ 30, > 90, > 180, sin compras) y destino visitado; `has_open_opportunity`.
2. Propuesta: título «Recompra — {cliente} — {sugerencia}», destino por mapa de CRM-BR-45, monto = ticket promedio o 4 000, PEN, `calificacion`, cierre +30 d, origen «Fidelización»; avisa oportunidades abiertas.
3. La creación usa `POST /crm/opportunities` con `origin=Fidelización` y audita `Cliente accion_fidelizacion`.
4. Recencia y destinos visitados dependen de reservas: con datos vacíos en 1-A, se completan en 1-B.

**Pruebas:** Pest de la propuesta con datos de factory.

**Depende de:** F1A-CRM-09 · **Prioridad:** P2

#### F1A-CRM-22 · Panel de Ventas «Mi cartera»

**Historia:** Como asesor, quiero un panel con mi pipeline, agenda y bolsa de leads, para empezar el día sabiendo qué hacer.

**Especificación:** 01 §6.6 (`dashboard/sales`), §7.4, §11 #25

**Tablas:** Lectura CRM

**Endpoints:** `GET /api/v1/dashboard/sales`

**Pantallas:** —

**Criterios de aceptación:**

1. Bloques de 01 §7.4 calculados en servidor con alcance propio; caché Redis 60 s por usuario invalidada por eventos CRM.
2. Bloques que dependen de cotizaciones, reservas y comisiones devuelven vacío con `available_from = "1B"`.
3. Acciones «Tomar» y «Hecha» usan los endpoints del CRM (unificación 01 §11 #25).

**Pruebas:** CRM-E2E-03 (parte API).

**Depende de:** F1A-CRM-05, F1A-CRM-10, F1A-CRM-12 · **Prioridad:** P1

#### F1A-CRM-23 · Registro de eventos CRM en el catálogo de notificaciones

**Historia:** Como Tenant Admin, quiero poder configurar canales y plantillas de los avisos del CRM.

**Especificación:** 01 §8.3; 09 §8.3

**Tablas:** `notif_event_rules`, `notif_templates`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Semilla de reglas y plantillas para `lead.asignado`, `lead.tomado`, `lead.convertido`, `lead.reasignado`, `oportunidad.asignada|ganada|perdida|reasignado`, `actividad.asignada|reasignado`, `cliente.reasignado`, `postventa.detractor|caso|cierre`, `cliente.comunicacion`.
2. Canales por defecto según 01 §8.3; destinatarios resueltos en backend por evento.

**Pruebas:** Pest: cada evento CRM genera `notif_messages`.

**Depende de:** F0-29 · **Prioridad:** P1

#### F1A-CRM-24 · UI Postventa y panel de Ventas

**Historia:** Como asesor, quiero la pantalla de postventa y mi panel de inicio.

**Especificación:** 01 §2 (`crm/postventa`, `dashboard` sales), §7.4

**Tablas:** —

**Endpoints:** F1A-CRM-19…F1A-CRM-22

**Pantallas:** `/crm/postventa`, `/dashboard` (rol sales)

**Criterios de aceptación:**

1. Postventa: KPIs, viajes por cerrar, distribución NPS (donut + barras 0–10), casos con drawer y bitácora, segmentación con botón de recompra, últimas encuestas.
2. Panel de Ventas con los bloques de 01 §7.4 y botones «Tomar» / «Hecha».
3. Gráficos con una sola librería (Recharts) y paleta de tokens.

**Pruebas:** CRM-E2E-03.

**Depende de:** F1A-CRM-19, F1A-CRM-20, F1A-CRM-21, F1A-CRM-22, F0-38 · **Prioridad:** P1

### E1A.5 · Catálogo · Maestros (tipos, destinos, proveedores, servicios)

#### F1A-CAT-01 · Modelo de datos del catálogo

**Historia:** Como desarrollador, quiero todas las tablas del catálogo con sus restricciones, para que la oferta sea consistente desde la base.

**Especificación:** 02 §3.1–3.9; 16 §3.3 (columnas nuevas en producto)

**Tablas:** `catalog_product_types`, `catalog_product_categories`, `catalog_product_subcategories`, `catalog_destinations`, `catalog_providers`, `catalog_provider_contacts`, `catalog_services`, `catalog_products`, satélites de 02 §3.7 (excepto `catalog_product_b2b_rates`, `catalog_product_promotions`, `catalog_product_media`, `catalog_product_faqs`), `catalog_product_versions`, `catalog_rates`, `catalog_seasons`, `catalog_price_rules`, `catalog_product_departures`, `catalog_availability_holds`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Extensiones `btree_gist`, `pg_trgm` y `ltree` (supuesto: `path ltree` para destinos).
2. `EXCLUDE` de temporadas con igual prioridad; CHECK `sold <= capacity`; `UNIQUE (product_id) WHERE status='vigente'` en versiones; `num_nonnulls(service_id, component_product_id) = 1` en componentes.
3. `ref` por `sys_sequences` (CAT-BR-45), no por máximo+1.
4. `catalog_products` incluye `operating_weekdays`, `cutoff_hours` (16 §3.3) y `lock_version`.
5. `guide_id`/`vehicle_id` de salidas sin FK hasta que existan `ops_guides`/`ops_vehicles` (Fase 1-B).
6. Tablas de B2B, promociones, media y FAQ se crean en Fase 2 junto con sus historias.

**Pruebas:** Pest de restricciones (EXCLUDE, CHECK).

**Depende de:** F0-06, F0-25 · **Prioridad:** P0

#### F1A-CAT-02 · Seeders del catálogo desde `kit-ia/seeds`

**Historia:** Como desarrollador, quiero el catálogo de demo del prototipo cargado, para probar con los mismos productos (PRD-001…PRD-011).

**Especificación:** 02 §3; 16 §10.1 (PRD-011)

**Tablas:** Catálogo

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Carga `destinations` (20), `providers` (14), `services` (17), `productTypes` (13), `categories` (5), `seasons` (6), `products` (11, con componentes, itinerario, tarifas, políticas, salidas), `pricingRules`, `catalogHolds`.
2. PRD-011 con rangos RG-1101…1103 y reglas de pasajeros del caso del cliente.
3. Idempotente (re-ejecutable) y solo en entornos no productivos.

**Pruebas:** `migrate:fresh --seed` sin errores; conteos iguales al índice.

**Depende de:** F1A-CAT-01, F1A-MOT-01 · **Prioridad:** P0

#### F1A-CAT-03 · Tipos de producto y categorías

**Historia:** Como Gerente, quiero administrar tipos y categorías, para clasificar la oferta.

**Especificación:** 02 §3.1–3.2, §5.2 CAT-BR-36, §6.5 (product-types, categories)

**Tablas:** `catalog_product_types`, `catalog_product_categories`, `catalog_product_subcategories`

**Endpoints:** `GET/POST/DELETE /api/v1/catalog/product-types[/{id}]`, `GET/POST/DELETE /api/v1/catalog/categories[/{id}]`, `POST/DELETE /api/v1/catalog/categories/{id}/subcategories[/{subId}]`

**Pantallas:** `/catalogo/categorias`

**Criterios de aceptación:**

1. Tipos en mayúsculas con `requires_itinerary`/`requires_components`; nombres únicos sin distinguir mayúsculas.
2. Eliminar en uso → 409 «No se puede eliminar: N producto(s) usan…».
3. Pantalla con contadores de uso; el botón «Tipos y categorías» del listado solo se muestra con `update` (corrige 02 §12-31).
4. Auditoría `crear_tipo`, `eliminar_tipo`, `crear_categoria`…

**Pruebas:** Pest: tipo en uso 409; Ventas → 403.

**Depende de:** F1A-CAT-01 · **Prioridad:** P1

#### F1A-CAT-04 · Destinos jerárquicos

**Historia:** Como Gerente, quiero un árbol de destinos válido, para filtrar productos por zona incluyendo subdestinos.

**Especificación:** 02 §3.3, §5.2 CAT-BR-39/43, §6.5 (destinations)

**Tablas:** `catalog_destinations`

**Endpoints:** `GET /api/v1/catalog/destinations?tree=1`, `GET /api/v1/catalog/destinations/{id}`, `POST/PATCH/DELETE /api/v1/catalog/destinations[/{id}]`

**Pantallas:** `/catalogo/destinos/[[...ref]]`

**Criterios de aceptación:**

1. Raíz solo País; nivel hijo > padre; sin ciclos; Atracción/Ruta sin hijos; nombre único entre hermanos; lat/lng juntas y en rango (advertencia fuera de Perú).
2. `path` materializado y recalculado al mover; filtro de productos incluye descendientes.
3. Eliminar con hijos o productos → 409.
4. Pantalla: árbol + ficha + productos + CRUD (gestión con `catalog.products.update`).

**Pruebas:** Pest: padre descendiente, Ciudad bajo Atracción, raíz no País → 422; borrar con hijos → 409.

**Depende de:** F1A-CAT-01 · **Prioridad:** P0

#### F1A-CAT-05 · Proveedores: ficha, contrato, contactos, calificación y vencimiento

**Historia:** Como Operaciones, quiero gestionar proveedores con contrato vigente, para que solo se usen proveedores habilitados.

**Especificación:** 02 §3.4, §4.6, §5.2 CAT-BR-38, §6.5 (providers), §8.1–8.2 (jobs de contrato)

**Tablas:** `catalog_providers`, `catalog_provider_contacts`

**Endpoints:** `GET/POST /api/v1/catalog/providers`, `GET/PATCH /api/v1/catalog/providers/{id}`, `POST /api/v1/catalog/providers/{id}/activate|deactivate|renew-contract|rating`, `POST/DELETE /api/v1/catalog/providers/{id}/contacts[/{contactId}]`

**Pantallas:** `/catalogo/proveedores`, `/catalogo/proveedores/[ref]`

**Criterios de aceptación:**

1. RUC válido y único; nace `inactivo`; activar requiere contrato vigente (422); renovar exige fecha futura; desactivar con motivo y notifica `proveedor.desactivado` a gerencia si hay productos ACTIVE afectados.
2. Ruta visible con `catalog.providers.manage` ∨ `finance.payables` ∨ `catalog.products.update`; edición solo con `catalog.providers.manage` (Manager en lectura, 02 §12-4).
3. KPI y tarjeta de CxP solo con `finance.payables` (en 1-A vacío hasta Finanzas).
4. Jobs `MarkExpiredProviderContracts` (diario 00:10) y `ProviderContractExpiryAlerts` (≤ 95 días).

**Pruebas:** Pest: RUC inválido/duplicado 422; activar vencido 422; Manager crea proveedor 403.

**Depende de:** F1A-CAT-01, F0-28 · **Prioridad:** P0

#### F1A-CAT-06 · Servicios de proveedor

**Historia:** Como Operaciones, quiero registrar servicios con costo y vigencia, para armar componentes de producto.

**Especificación:** 02 §3.5, §4.7, §5.2 CAT-BR-37, §6.5 (services)

**Tablas:** `catalog_services`

**Endpoints:** `GET/POST /api/v1/catalog/services`, `GET/PATCH /api/v1/catalog/services/{id}`, `POST /api/v1/catalog/services/{id}/activate|deactivate`

**Pantallas:** `/catalogo/servicios`, `/catalogo/servicios/[ref]`

**Criterios de aceptación:**

1. Proveedor no activo → se persiste `inactivo` con aviso; activar exige proveedor activo y `valid_to ≥ hoy`.
2. Cambio de costo/moneda audita `cambio_costo` indicando productos que lo usan.
3. Costo omitido en el `JsonResource` para quien no ve costos (Ventas).
4. KPIs (activos, vencidos/inactivos, vencen en 90 días, proveedor no activo); job `ServiceValidityAlerts`.

**Pruebas:** Pest: servicio con proveedor inactivo queda inactivo; Ventas sin `cost`.

**Depende de:** F1A-CAT-05 · **Prioridad:** P0

#### F1A-CAT-07 · UI Proveedores, Servicios y Destinos

**Historia:** Como Operaciones o Gerente, quiero pantallas para los maestros del catálogo.

**Especificación:** 02 §2 (`catalogo/servicios`, `catalogo/proveedores`, `catalogo/destinos`)

**Tablas:** —

**Endpoints:** F1A-CAT-04, F1A-CAT-05, F1A-CAT-06

**Pantallas:** `/catalogo/proveedores[/[ref]]`, `/catalogo/servicios[/[ref]]`, `/catalogo/destinos/[[...ref]]`

**Criterios de aceptación:**

1. Proveedor: flujo PROC-012 de 9 pasos, contactos, calificación, servicios, productos, reservas (vacío hasta 1-B) y CxP condicional.
2. Servicio: ficha, cadena PROC-013, productos que lo usan, historial.
3. Destinos: árbol navegable + ficha + CRUD.
4. Ventas en `/catalogo/proveedores` → 403.

**Pruebas:** CAT-E2E-04 (403 de Ventas).

**Depende de:** F1A-CAT-04, F1A-CAT-05, F1A-CAT-06, F0-38 · **Prioridad:** P1

### E1A.6 · Catálogo · Producto y Product 360

#### F1A-CAT-08 · Listado de productos con filtros, KPIs y «precio desde»

**Historia:** Como Ventas, quiero encontrar rápido productos vendibles con su precio desde, para cotizar.

**Especificación:** 02 §2 (`catalogo/productos`), §5.2 CAT-BR-43/44, §6.1 (GET products, kpis)

**Tablas:** `catalog_products`, `catalog_rates`

**Endpoints:** `GET /api/v1/catalog/products`, `GET /api/v1/catalog/products/kpis`

**Pantallas:** —

**Criterios de aceptación:**

1. Filtros tipo, categoría, estado, destino (con descendientes y secundarios), canal y `q` (trigram sobre nombre, código, SKU).
2. `from_price` según CAT-BR-44 entre tarifas visibles al rol; `margin_pct` solo con `view_profitability`; `future_departures`, `channels_count`.
3. KPIs: activos, en revisión + borradores, con salidas futuras, margen promedio (o «Reservables hoy» sin rentabilidad).
4. Exportación CSV se implementa con la infraestructura de exportaciones de Fase 1-B (supuesto 02 §12-30).

**Pruebas:** Serialización: Ventas no recibe `margin_pct`.

**Depende de:** F1A-CAT-01, F1A-CAT-21 · **Prioridad:** P0

#### F1A-CAT-09 · Alta de producto (payload del asistente) y duplicado

**Historia:** Como Gerente, quiero crear un producto completo en borrador desde el asistente, para no cargarlo pestaña por pestaña.

**Especificación:** 02 §4.1 (nuevo), §5.2 CAT-BR-01..04, 09, §6.1 (POST products, duplicate)

**Tablas:** `catalog_products` y satélites, `catalog_product_versions`, `catalog_product_channels`

**Endpoints:** `POST /api/v1/catalog/products` (Idempotency-Key), `POST /api/v1/catalog/products/{id}/duplicate` (Idempotency-Key)

**Pantallas:** —

**Criterios de aceptación:**

1. Un solo payload (ficha, flags, destinos secundarios, componentes, itinerario, tarifas, temporadas, disponibilidad, canales solicitados) validado por pasos; crea DRAFT + versión 0.1 `borrador` + canal ERP publicado.
2. `code` único sin distinguir mayúsculas; rangos min ≤ max; SKU por defecto `<prefijo>-<code>`.
3. Duplicar: «(copia)», `code-Cnn`, sin salidas ni promociones, tarifas con nuevos `ref`, versión 0.1.
4. Audita `Producto crear`; evento `ProductCreated`.

**Pruebas:** PRD-T03; código duplicado 422.

**Depende de:** F1A-CAT-10, F1A-CAT-11, F1A-CAT-12, F1A-CAT-21 · **Prioridad:** P0

#### F1A-CAT-10 · Ficha maestra, proveedor principal, políticas, inclusiones, requisitos y relacionados

**Historia:** Como Gerente, quiero editar la ficha comercial del producto, para que Ventas tenga información exacta.

**Especificación:** 02 §3.6–3.7, §5.2 CAT-BR-11, 32..35, §6.1 (GET/PATCH `{id}`), §6.2 (main-provider, policies, inclusions, requirements, related)

**Tablas:** `catalog_products`, `catalog_product_destinations`, `catalog_product_policies`, `catalog_product_inclusions`, `catalog_product_requirements`, `catalog_product_related`

**Endpoints:** `GET/PATCH /api/v1/catalog/products/{id}` (If-Match), `PUT /api/v1/catalog/products/{id}/main-provider`, `GET/PUT …/policies`, `GET/POST/DELETE …/inclusions[/{incId}]`, `POST/DELETE …/requirements[/{reqId}]`, `GET/POST/DELETE …/related[/{relId}]`

**Pantallas:** —

**Criterios de aceptación:**

1. PATCH con `lock_version`; auditoría `modificar` con lista de campos.
2. Cambio de proveedor principal: solo activo con contrato vigente, motivo obligatorio, distinto del actual; audita `cambio_proveedor`.
3. Políticas cancelación/modificación/no-show/reembolso obligatorias; defaults del prototipo al crear.
4. Inclusiones sin duplicados; relacionados distintos del propio con `referenced_by`.
5. Supuesto H-10: tramos estructurados de penalidad se modelan en Fase 1-B (Reservas); aquí solo texto legal.

**Pruebas:** Pest: lock_version 409; políticas vacías 422.

**Depende de:** F1A-CAT-01 · **Prioridad:** P0

#### F1A-CAT-11 · Componentes del producto (servicios y productos)

**Historia:** Como Gerente, quiero armar paquetes con servicios y otros productos, con trazabilidad del proveedor.

**Especificación:** 02 §3.7 (`catalog_product_items`), §5.1 PRD-BR-006/007, §5.2 CAT-BR-10, §6.2 (components)

**Tablas:** `catalog_product_items`

**Endpoints:** `GET/POST /api/v1/catalog/products/{id}/components`, `PATCH/DELETE …/components/{componentId}`, `POST …/components/reorder`

**Pantallas:** —

**Criterios de aceptación:**

1. Servicio activo y vigente con proveedor activo; producto-componente ACTIVE y distinto del propio → si no, 422 `PRD-BR-007`/`PRD-BR-002`.
2. Guarda `provider_id` del servicio al agregar; orden por defecto último+1; reordenar con `{ids}`.
3. Si el producto no tiene proveedor principal, toma el del primer servicio (CAT-BR-11).
4. Supuesto 02 §12-18: se permite repetir servicio en 360 y en el asistente (unificado).
5. Costos de componentes omitidos para Ventas; audita `cambio_componentes`.

**Pruebas:** PRD-T07, PRD-T14.

**Depende de:** F1A-CAT-06, F1A-CAT-10 · **Prioridad:** P0

#### F1A-CAT-12 · Itinerario por días

**Historia:** Como Gerente, quiero definir el itinerario día por día, para que la cotización y el voucher lo muestren.

**Especificación:** 02 §3.7 (itineraries, days, items), §5.2 CAT-BR-12, §6.2 (itineraries)

**Tablas:** `catalog_itineraries`, `catalog_itinerary_days`, `catalog_itinerary_items`

**Endpoints:** `GET /api/v1/catalog/products/{id}/itineraries`, `POST/PATCH/DELETE …/itineraries/{itId}/days[/{dayId}]`, `POST/PATCH/DELETE …/days/{dayId}/items[/{itemId}]`

**Pantallas:** —

**Criterios de aceptación:**

1. Título de día y actividad obligatorios; ítems ordenados por hora con vacíos al final; renumeración al borrar un día.
2. `service_id` solo entre componentes del producto (422).
3. `cost`/`price` de ítems solo para quien ve costos; audita `cambio_itinerario`.

**Pruebas:** Pest: servicio ajeno a componentes 422; renumeración.

**Depende de:** F1A-CAT-11 · **Prioridad:** P0

#### F1A-CAT-13 · Ciclo de vida del producto y checklist de activación

**Historia:** Como Gerente, quiero que solo se active un producto completo y aprobado, para no vender algo incompleto.

**Especificación:** 02 §4.1, §5.1 PRD-BR-002/018, §5.2 CAT-BR-05..08, §6.1 (activation-checklist, submit-review, approve, return-to-draft, activate, suspend, deactivate, archive, DELETE, usage), §8.1

**Tablas:** `catalog_products`, `catalog_product_versions`

**Endpoints:** `GET …/{id}/activation-checklist`, `POST …/{id}/submit-review|approve|return-to-draft|activate|suspend|deactivate|archive` (lock_version), `DELETE /api/v1/catalog/products/{id}`, `GET …/{id}/usage`

**Pantallas:** —

**Criterios de aceptación:**

1. `ProductStateMachine` exactamente según 02 §4.1; motivo obligatorio para devolver, suspender, inactivar y archivar.
2. Checklist de 12 ítems (CAT-BR-06) → 422 `PRD-ACT-CHECKLIST` con `failed[]` y audit `activacion_rechazada`; al activar, versiones pasan a `vigente`.
3. Supuesto 02 §12-3: el botón Activar solo se muestra en APPROVED/SUSPENDED/INACTIVE.
4. DELETE: con cotizaciones/reservas/operaciones/paquetes → 409 `PRD-BR-018` con listas (cotizaciones y reservas vacías hasta 1-B); si no, soft delete con motivo.
5. Eventos y notificaciones `producto.revision` (Manager), `producto.activado` (Ventas), `producto.no_vendible` (Ventas).
6. Servicio `Sellable::check(product)` = ACTIVE ∧ `is_bookable`, publicado para que cotizador y reservas lo reutilicen (PRD-BR-002).

**Pruebas:** PRD-T04 (parte catálogo), reglas 02 §10.2 de activación, borrado y motivos.

**Depende de:** F1A-CAT-11, F1A-CAT-12, F1A-CAT-21, F1A-CAT-15 · **Prioridad:** P0

#### F1A-CAT-14 · Versiones del producto con snapshot inmutable

**Historia:** Como Gerente, quiero versionar el producto y comparar versiones, para que las cotizaciones conserven lo vendido.

**Especificación:** 02 §3.7 (versions), §4.2, §5.1 PRD-BR-008/009/017, §5.2 CAT-BR-31, §6.2 (versions)

**Tablas:** `catalog_product_versions`

**Endpoints:** `GET/POST /api/v1/catalog/products/{id}/versions`, `GET …/versions/{versionId}`, `GET …/versions/compare?a&b`

**Pantallas:** —

**Criterios de aceptación:**

1. Nueva versión menor/mayor sobre la última no histórica, número no repetido, motivo y vigencia obligatorios; `Cache::lock("catalog:product:{id}:version")`.
2. Snapshot con los campos de 02 §3.7 + requisitos, canales y `fx_rate` (supuesto 02 §12-28); inmutable (sin UPDATE salvo `status`).
3. Las anteriores pasan a `historica`; compare devuelve diferencias campo a campo.
4. Visible con `update` ∨ `view_profitability`.

**Pruebas:** PRD-T10, PRD-T12.

**Depende de:** F1A-CAT-13 · **Prioridad:** P0

#### F1A-CAT-15 · Configuración de disponibilidad del producto y publicación por canal

**Historia:** Como Gerente, quiero definir el modelo de disponibilidad y en qué canales se publica el producto.

**Especificación:** 02 §3.7 (`catalog_product_channels`), §4.8, §5.1 PRD-BR-013, §5.2 CAT-BR-19/28, §6.2 (availability, channels), §12-21

**Tablas:** `catalog_products` (modelo, capacidad, fuente), `catalog_product_channels`

**Endpoints:** `GET/PUT /api/v1/catalog/products/{id}/availability`, `GET /api/v1/catalog/products/{id}/channels`, `PUT /api/v1/catalog/products/{id}/channels/{channel}`

**Pantallas:** —

**Criterios de aceptación:**

1. Modelo ∈ 9 valores; fuente `externa` responde aviso «adaptador INT-06 parcial» (PRD-BR-013).
2. Publicar solo si ACTIVE (422 `PRD-BR-002`); ERP no se despublica; flags `is_b2b`, `is_ecommerce`, `is_quoteable` derivados de `catalog_product_channels` (fuente única, 02 §12-21).
3. Canal publicado con producto no ACTIVE se informa como «Pendiente de activación».
4. `ProductPublished/Unpublished` al outbox (consumidores en Fase 2).

**Pruebas:** Publicar DRAFT 422; ERP no despublicable.

**Depende de:** F1A-CAT-01, F0-27 · **Prioridad:** P1

#### F1A-CAT-16 · Personalización del producto y cotización de precio (`price-quote`)

**Historia:** Como Ventas, quiero calcular el precio con opciones de personalización en el servidor, para no confiar en cálculos del navegador.

**Especificación:** 02 §3.7 (config_groups/options), §5.2 CAT-BR-30, §6.2 (config-groups, price-quote); 16 §8.1 (paso 4)

**Tablas:** `catalog_product_config_groups`, `catalog_product_config_options`

**Endpoints:** `GET/POST/DELETE /api/v1/catalog/products/{id}/config-groups[/{groupId}]`, `POST /api/v1/catalog/products/{id}/price-quote`

**Pantallas:** —

**Criterios de aceptación:**

1. Grupo con nombre único y ≥ 2 opciones «Etiqueta | diferencia».
2. `price-quote` delega en `BookingEngine::quote` (tarifa vigente, temporada, deltas, pax); ignora cualquier precio enviado por el cliente (PRD-T15).
3. Tarifa vencida → 422 (PRD-T05).

**Pruebas:** PRD-T05, PRD-T15.

**Depende de:** F1A-CAT-21, F1A-MOT-06 · **Prioridad:** P1

#### F1A-CAT-17 · Serialización de datos sensibles y pestañas del Product 360 por rol

**Historia:** Como Gerente, quiero que Ventas y Operaciones solo reciban los datos que les corresponden, aunque llamen a la API directamente.

**Especificación:** 02 §5.2 CAT-BR-40, §7.2, §7.3; 00 SEC-BR-13

**Tablas:** —

**Endpoints:** Todos los `JsonResource` del catálogo; `GET /api/v1/catalog/products/{id}` (campo `tabs[]`)

**Pantallas:** —

**Criterios de aceptación:**

1. Reglas `SEE` de 02 §7.2 implementadas como políticas reutilizables (`canSeeCost`, `canSeeMargin`, `canSeeNetRates`, `canSeeHistory`, `canSeeVersions`).
2. El detalle del producto devuelve `tabs[]` permitidas por rol según 02 §7.3 (fuente para Next.js).
3. Test de serialización por rol sobre producto, tarifas, componentes, itinerario, servicios y proveedores.

**Pruebas:** Serialización 02 §10.2 (Ventas sin `cost`/`margin_pct`; Operaciones con `cost` sin `margin_pct`).

**Depende de:** F1A-CAT-08, F1A-CAT-21 · **Prioridad:** P0

#### F1A-CAT-18 · Historial de auditoría del producto y ficha comercial PDF

**Historia:** Como Gerente, quiero ver el historial del producto y descargar su ficha comercial.

**Especificación:** 02 §6.1 (audit, sheet), §8.2 (`GenerateProductSheetPdf`), §9

**Tablas:** `audit_events`, `sys_documents`

**Endpoints:** `GET /api/v1/catalog/products/{id}/audit`, `POST /api/v1/catalog/products/{id}/sheet` (Idempotency-Key)

**Pantallas:** —

**Criterios de aceptación:**

1. Historial filtrable por acción y entidad (producto, sus tarifas y salidas), visible con `update` ∨ `view_profitability` ∨ `admin.audit.view`.
2. Todas las acciones de 02 §9 registradas, incluidas las faltantes marcadas en esa sección.
3. Ficha PDF (itinerario, incluye/no incluye, requisitos, políticas, precio desde visible al rol) en cola `documents`.

**Pruebas:** Pest: acción crítica deja evento; PDF generado con hash.

**Depende de:** F1A-CAT-13, F0-30 · **Prioridad:** P2

#### F1A-CAT-19 · UI listado de productos y asistente de 10 pasos

**Historia:** Como Gerente, quiero crear productos con el asistente guiado y ver el catálogo en tarjetas o tabla.

**Especificación:** 02 §2 (`catalogo/productos`, `/nuevo`)

**Tablas:** —

**Endpoints:** F1A-CAT-08, F1A-CAT-09

**Pantallas:** `/catalogo/productos`, `/catalogo/productos/nuevo`

**Criterios de aceptación:**

1. Tarjetas/tabla con preferencia en `localStorage`, filtros y 4 KPIs.
2. Asistente de 10 pasos con validación por paso (Zod espejo del FormRequest) y resumen final; sin `catalog.products.create` muestra 403 en página.

**Pruebas:** CAT-E2E-01 (tramo creación).

**Depende de:** F1A-CAT-09, F0-38 · **Prioridad:** P0

#### F1A-CAT-20 · UI Product 360

**Historia:** Como usuario interno, quiero la ficha 360 del producto con pestañas según mi rol.

**Especificación:** 02 §2 (`/catalogo/productos/[ref]/[[...tab]]`), §7.3, §7.4

**Tablas:** —

**Endpoints:** F1A-CAT-10…F1A-CAT-18

**Pantallas:** `/catalogo/productos/[ref]/[[...tab]]`

**Criterios de aceptación:**

1. Cabecera con acciones de ciclo de vida, flujo visual de estados y 6 indicadores; pestaña activa en la URL.
2. Pestañas de 1-A: General, Componentes, Itinerario, Tarifas, Temporadas, Disponibilidad, Salidas, Proveedores, Políticas, Inclusiones, Relacionados, Personalización, Costos y rentabilidad, Canales, Versiones (con comparación A/B), Historial, Reservas online (F1A-MOT-08). B2B, Promociones y Contenido se muestran como «Disponible en Fase 2».
3. Pestaña no permitida por URL abre General con toast «La pestaña solicitada no está disponible para su rol».
4. Modal de checklist con ✓/✗ y modal «Eliminación física bloqueada» con botón Archivar.

**Pruebas:** CAT-E2E-01 (aprobar → activar → publicar), CAT-E2E-02, CAT-E2E-04.

**Depende de:** F1A-CAT-19, F1A-CAT-17 · **Prioridad:** P0

### E1A.7 · Catálogo · Tarifas, temporadas y pricing

#### F1A-CAT-21 · Tarifas: alta, cambio de precio, estado efectivo y consolidado

**Historia:** Como Gerente, quiero tarifas por segmento, canal y vigencia con cambios de precio auditados.

**Especificación:** 02 §3.8 (`catalog_rates`), §4.3, §5.1 PRD-BR-004/005/016, §5.2 CAT-BR-13/14, §6.2 (rates), §6.4 (`/catalog/rates`)

**Tablas:** `catalog_rates`

**Endpoints:** `GET/POST /api/v1/catalog/products/{id}/rates`, `PATCH …/rates/{rateId}/price` (lock_version), `POST …/rates/{rateId}/activate|deactivate`, `GET /api/v1/catalog/rates`

**Pantallas:** —

**Criterios de aceptación:**

1. Moneda y vigencia obligatorias (PRD-T08); `valid_to ≥ hoy`; precio > 0 y dentro de min/max; precio < costo → advertencia; temporada solo activa.
2. Estado efectivo calculado: inactiva → vencida → programada → vigente; solo `vigente` seleccionable.
3. Cambio de precio con costo, precio y motivo; valida mínimo y máximo (supuesto 02 §12-17); audita `Tarifa cambio_precio`; evento `RatePriceChanged`.
4. Sin DELETE (02 §12-16). Ventas no recibe tarifas netas (Proveedor/Costo/B2B/Mayorista o canal B2B/Mayorista) ni `cost`; Operaciones recibe `cost` sin margen.

**Pruebas:** PRD-T05, PRD-T06 (snapshot en 1-B), PRD-T08, PRD-T11, PRD-T13.

**Depende de:** F1A-CAT-01, F1A-CAT-22 · **Prioridad:** P0

#### F1A-CAT-22 · Temporadas: solapamientos, resolución por fecha y asociación a productos

**Historia:** Como Gerente, quiero temporadas con prioridad que no choquen, para que el precio por fecha sea predecible.

**Especificación:** 02 §3.8 (`catalog_seasons`, `catalog_product_seasons`), §5.2 CAT-BR-16..18, §6.2 (seasons), §6.4 (seasons, resolve)

**Tablas:** `catalog_seasons`, `catalog_product_seasons`

**Endpoints:** `GET/POST /api/v1/catalog/seasons`, `PATCH/DELETE /api/v1/catalog/seasons/{id}`, `GET /api/v1/catalog/seasons/resolve?date=`, `GET/POST/DELETE /api/v1/catalog/products/{id}/seasons[/{seasonId}]`

**Pantallas:** —

**Criterios de aceptación:**

1. Factor 0.01–3.00; solape con igual prioridad → 422 «PROC-019 · solapamiento no resoluble…» (y EXCLUDE en DB); solape con otra prioridad → advertencia.
2. `resolve` usa `SeasonResolver` del núcleo (F0-31).
3. Borrar en uso → 409 con sugerencia de inactivar; temporadas usadas por tarifas se asocian solas y no se desasocian.
4. Auditoría `crear`, `modificar`, `eliminar`, `cambio_estado`.

**Pruebas:** Temporada solapada misma prioridad 422; borrar usada 409.

**Depende de:** F1A-CAT-01, F0-31 · **Prioridad:** P0

#### F1A-CAT-23 · Reglas de pricing, `PricingEngine` y simulador de rentabilidad

**Historia:** Como Gerente o Finanzas, quiero simular precio y margen con las reglas del tenant, con una sola fórmula en backend.

**Especificación:** 02 §3.8 (`catalog_price_rules`), §5.2 CAT-BR-41/42, §6.2 (profitability, markup), §6.4 (price-rules, pricing/simulate), §12-9/10; H-11, H-13

**Tablas:** `catalog_price_rules`, `catalog_products.markup_pct`

**Endpoints:** `GET/POST /api/v1/catalog/price-rules`, `POST /api/v1/catalog/price-rules/{id}/activate|deactivate`, `POST /api/v1/catalog/pricing/simulate`, `GET /api/v1/catalog/products/{id}/profitability`, `PUT /api/v1/catalog/products/{id}/markup`

**Pantallas:** —

**Criterios de aceptación:**

1. Reglas con ámbito estructurado (`channel`, `min_pax`, `customer_residency`, `product_id`, `currency`, `priority`) en lugar del texto codificado del prototipo (02 §12-10).
2. `PricingEngine` sobre `PricingService` del núcleo: base = costo×pax + ajuste de temporada; markup; descuento ≥ 10 pax; IGV domiciliado/no domiciliado; redondeo; comisión sobre neto sin IGV (H-11); precio mínimo aplicado por backend.
3. Supuesto 02 §12-9 (pendiente de negocio): el factor de temporada se aplica sobre el costo en el simulador de rentabilidad y sobre el precio en el BookingEngine; ambos usan el mismo `SeasonResolver` (H-13).
4. Endpoints de simulación y rentabilidad solo con `view_profitability` ∨ `manage_rates`; markup solo `manage_rates`.

**Pruebas:** CAT-E2E-05 (≥ 10 pax aplica PR-05); Finanzas GET profitability 200, PATCH 403.

**Depende de:** F1A-CAT-21, F1A-CAT-22 · **Prioridad:** P1

#### F1A-CAT-24 · UI Tarifas, Temporadas y Reglas de pricing

**Historia:** Como Gerente o Finanzas, quiero consultar tarifas consolidadas, la línea de tiempo de temporadas y simular precios.

**Especificación:** 02 §2 (`catalogo/tarifas[/tarifas|/temporadas|/reglas]`)

**Tablas:** —

**Endpoints:** F1A-CAT-21, F1A-CAT-22, F1A-CAT-23

**Pantallas:** `/catalogo/tarifas/[[...tab]]`

**Criterios de aceptación:**

1. Tarifas con filtros (tipo, canal, estado efectivo, moneda) y columnas según rol; resolver tarifa por fecha/segmento/canal con «Seleccionable / No seleccionable · motivo».
2. Temporadas: línea de tiempo ene-2026 → mar-2027, tabla, solapamientos detectados, resolución por fecha.
3. Reglas + simulador con desglose paso a paso; pestaña visible solo con `view_profitability` ∨ `manage_rates`.

**Pruebas:** CAT-E2E-05.

**Depende de:** F1A-CAT-23, F0-38 · **Prioridad:** P1

### E1A.8 · Catálogo · Salidas y holds

#### F1A-CAT-25 · Salidas programadas

**Historia:** Como Operaciones, quiero programar salidas con capacidad y punto de encuentro, para vender cupos reales.

**Especificación:** 02 §3.9 (`catalog_product_departures`), §4.4, §5.2 CAT-BR-20, §6.2 (departures), §6.3 (departures)

**Tablas:** `catalog_product_departures`

**Endpoints:** `GET/POST /api/v1/catalog/products/{id}/departures`, `PATCH /api/v1/catalog/products/{id}/departures/{departureId}` (lock_version), `GET /api/v1/catalog/departures`, `GET /api/v1/catalog/departures/{id}`, `POST /api/v1/catalog/departures` (Idempotency-Key)

**Pantallas:** —

**Criterios de aceptación:**

1. Fecha ≥ hoy; capacidad 1–60 (02 §12-11); en edición capacidad ≥ vendidos + hold; proveedor solo activo; no admite productos INACTIVE/ARCHIVED.
2. Validación de guía (vacaciones) y vehículo (mantenimiento, asientos) se activa cuando existan `ops_guides`/`ops_vehicles` (Fase 1-B); en 1-A los campos son opcionales sin validación.
3. `abierta ↔ completa` automático por `sold`; cancelar con vendidos notifica `salida.cancelada` a Operaciones; supuesto 02 §12-14: `cancelada` terminal.
4. Listado con KPIs y vista de calendario (`month=YYYY-MM`).

**Pruebas:** Salida capacidad 61 / fecha pasada / capacidad < vendidos+hold → 422.

**Depende de:** F1A-CAT-13 · **Prioridad:** P0

#### F1A-CAT-26 · Holds de disponibilidad con locks y expiración (JOB-01)

**Historia:** Como Operaciones o Ventas, quiero retener cupos temporalmente sin sobreventa, para confirmar después.

**Especificación:** 02 §3.9 (`catalog_availability_holds`), §4.5, §5.1 PRD-BR-012, §5.2 CAT-BR-21..25, §6.3 (holds, confirm-seats), §8.2 (JOB-01); H-14

**Tablas:** `catalog_availability_holds`, `catalog_product_departures`

**Endpoints:** `GET /api/v1/catalog/holds`, `POST /api/v1/catalog/holds` (Idempotency-Key + lock), `POST /api/v1/catalog/holds/{id}/confirm|release|consume`, `POST /api/v1/catalog/holds/expire`, `POST /api/v1/catalog/departures/{id}/confirm-seats` (Idempotency-Key + lock + lock_version)

**Pantallas:** —

**Criterios de aceptación:**

1. `Cache::lock("catalog:departure:{id}", 10)` + transacción + `FOR UPDATE` de la salida en crear/confirmar/liberar/editar capacidad.
2. Cupo insuficiente → 409 con hasta 3 `alternatives[]` del mismo producto.
3. Confirmar hold expirado → 422; liberar exige motivo y devuelve `sold` si estaba confirmada.
4. Disponibles ignoran holds vencidos aunque el job no haya corrido (supuesto 02 §12-15).
5. `ExpireAvailabilityHolds` cada 5 min, `ShouldBeUnique`, común para todos los canales (H-14), registra `sys_job_runs`; vigencia desde `policies.hold_minutes` (≥ 5).
6. Broadcast de ocupación en `tenant.{id}.catalog.departures`; notificación `disponibilidad.confirmada`.

**Pruebas:** PRD-T09; dos holds concurrentes por el último cupo (201/409); JOB-01 idempotente.

**Depende de:** F1A-CAT-25, F0-26, F0-28 · **Prioridad:** P0

#### F1A-CAT-27 · UI Salidas: programación, calendario y holds

**Historia:** Como Operaciones, quiero ver ocupación por mes y gestionar holds desde una pantalla.

**Especificación:** 02 §2 (`catalogo/salidas[/tabla|/calendario|/holds]`)

**Tablas:** —

**Endpoints:** F1A-CAT-25, F1A-CAT-26

**Pantallas:** `/catalogo/salidas/[[...tab]]`

**Criterios de aceptación:**

1. KPIs (salidas futuras, capacidad, vendidos, en hold, disponibles) y alerta de holds vencidos no procesados.
2. Calendario mensual de ocupación actualizado por broadcast Reverb.
3. Modales Nueva salida / Nuevo hold (con alternativas en 409) / Liberar con motivo; «Expirar holds vencidos».

**Pruebas:** CAT-E2E-03.

**Depende de:** F1A-CAT-26, F0-38 · **Prioridad:** P0

### E1A.9 · Motor de reservas básico (BookingEngine)

#### F1A-MOT-01 · Centro de reglas: plantilla de plataforma, semilla por tenant y `RuleResolver`

**Historia:** Como plataforma, quiero que cada tenant tenga sus reglas de reserva activables, para que el motor las respete desde el inicio.

**Especificación:** 16 §3.1, §5.1, §8.1 (`RuleResolver`), §8.3 (caché de reglas); D-11

**Tablas:** `platform_booking_rule_templates`, `sys_booking_rules`

**Endpoints:** — (administración `GET/PATCH /api/v1/admin/booking-rules` y overrides por producto quedan para Fase 2)

**Pantallas:** —

**Criterios de aceptación:**

1. Plantilla de plataforma con las reglas de `seeds/settings.json › bookingRules` (32 filas: las 31 de la spec + `R-OWN-REVIEWS` de la spec 18) con `group_name`, `enabled` por defecto, `params` y `params_schema`.
2. `ProvisionTenant` copia la plantilla al tenant (F0-09).
3. `RuleResolver::on(key, ?product)` y `param(key, name, ?product)` con caché por request y Redis `rules:{tenant}:v{ver}` (TTL 1 h); en 1-A el producto no altera el resultado (sin overrides).
4. Supuesto 16 §12-1: solo se evalúan reglas con handler conocido.

**Pruebas:** Pest: regla apagada en tenant → `on=false`; tenant B no ve reglas de A.

**Depende de:** F0-09 · **Prioridad:** P0

#### F1A-MOT-02 · Rangos de disponibilidad y operación del producto

**Historia:** Como Operaciones, quiero definir rangos disponibles, cerrados o agotados y los días de operación, para vender solo fechas reales.

**Especificación:** 16 §3.3, §4.2, §5.2 CAT-AV-01..06, §6.2 (availability-ranges, close-dates, operation), §8.2, §9

**Tablas:** `catalog_availability_ranges`, `catalog_products.operating_weekdays`, `catalog_products.cutoff_hours`

**Endpoints:** `GET/POST /api/v1/catalog/products/{id}/availability-ranges`, `PATCH/DELETE …/availability-ranges/{rangeId}` (lock_version), `POST …/availability-ranges/close-dates`, `PUT /api/v1/catalog/products/{id}/operation`

**Pantallas:** —

**Criterios de aceptación:**

1. Dos exclusion constraints parciales (disponible / cerrado-agotado) + validación en servicio → 422 `CAT-AV-01` con `conflicts[]`.
2. Disponible con capacidad 1–500; cerrado/agotado con 0; no terminar en el pasado ni durar > 730 días; ≥ 1 día de operación; cutoff 0–8760 h.
3. Capacidad no menor a lo vendido en fechas futuras (409 CAT-AV-03); cerrar con ventas exige `confirm_sales=true` y emite `AvailabilityClosedWithSales` (Email a Operaciones). En 1-A lo vendido proviene de `SoldSeatsProvider` (salidas + holds; reservas en 1-B).
4. `close-dates` agrupa fechas contiguas en N rangos en una transacción.
5. Auditoría `rango_*`, `cerrar_fechas`, `disponibilidad_operacion`; `AvailabilityRangeChanged` invalida caché.

**Pruebas:** 16 §10.1 (solapes); Operaciones 2xx en rangos.

**Depende de:** F1A-CAT-01, F1A-MOT-01 · **Prioridad:** P0

#### F1A-MOT-03 · `AvailabilityCalculator` y `BookingEngine::dayStatus/month/nextAvailable`

**Historia:** Como Ventas, quiero saber el estado exacto de cada día y la próxima fecha vendible, calculado por el servidor.

**Especificación:** 16 §4.1, §5.2 CAT-AV-07, §8.1 (algoritmo de disponibilidad, DTOs)

**Tablas:** Lectura de rangos, salidas y holds

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Algoritmo de 11 pasos idéntico a 16 §8.1 (pasado, sin_configurar, disponible sin control, fuera_de_plazo, no_opera, cerrado, agotado, sin_cupo, disponible con «Últimos N cupos»).
2. La salida programada prevalece sobre la capacidad del rango (CAT-AV-07).
3. `sold()` vía interfaz `SoldSeatsProvider`: en 1-A suma `departures.sold` y confirmaciones; la implementación con `booking_reservation_services` se registra en 1-B sin cambiar el motor.
4. `held()` solo holds vigentes; zona horaria del tenant; `nextAvailable` hasta 400 días.
5. DTOs inmutables `DayStatus`, `PaxCount`, etc.; `brick/money` escala 2 HALF_UP.

**Pruebas:** 16 §10.1: 02–06 disponible, 07–09 cerrado, 15 cerrado (sin rango), fuera_de_plazo, no_opera, sin_cupo.

**Depende de:** F1A-MOT-02, F1A-CAT-26 · **Prioridad:** P0

#### F1A-MOT-04 · Endpoint interno de disponibilidad con caché versionada

**Historia:** Como Ventas, quiero ver el calendario de un producto al instante y actualizado tras cada cambio.

**Especificación:** 16 §6.2 (`GET …/availability`), §8.3

**Tablas:** —

**Endpoints:** `GET /api/v1/catalog/products/{id}/availability?from&to&seats`

**Pantallas:** —

**Criterios de aceptación:**

1. Máximo 92 días por llamada; respuesta `[{date, status, label, note, left, sold, held, range}]`, `legend` segmentada por estado y capacidad desde hoy y `next_available`.
2. Caché Redis `avail:{tenant}:{product}:{yyyy-mm}:v{version}` (TTL 10 min) con invalidación por INCR; `ETag` = versión y soporte `If-None-Match`.
3. Invalidan: rangos, operación, reglas, holds, salidas.
4. El endpoint público `/api/v1/public/products/{id}/availability` se expone en Fase 2 reutilizando el mismo servicio.

**Pruebas:** Leyenda literal de 16 §10.1; tras crear rango cerrado, GET refleja el cambio sin esperar TTL.

**Depende de:** F1A-MOT-03 · **Prioridad:** P0

#### F1A-MOT-05 · Reglas de pasajeros por producto y simulador

**Historia:** Como Gerente, quiero definir edades, cuántos niños e infantes por adulto y si pagan, para que el motor valide y precie cada reserva.

**Especificación:** 16 §3.4, §5.1 (R-MIN-ADULTS, R-CHILD-PER-ADULT, R-INFANT-FREE, R-MAX-PAX), §5.2 CAT-PX-01..03, §6.2 (pax-rules, simulate), §8.1 (`PaxRulesResolver`, `validatePax`, `ageType`)

**Tablas:** `catalog_pax_rules`, `sys_settings` (`ecommerce.default_pax_rules`)

**Endpoints:** `GET/PUT /api/v1/catalog/products/{id}/pax-rules` (`DELETE` = volver a defaults), `POST /api/v1/catalog/products/{id}/pax-rules/simulate`

**Pantallas:** —

**Criterios de aceptación:**

1. Bandas `infante_hasta < niño_desde ≤ niño_hasta < adulto_desde` (422 `CAT-PX-01`); brechas de edad → `warnings`.
2. % niño 0–100; máx. niños/adulto ≤ 10, infantes/adulto ≤ 5, mín. adultos ≤ 10.
3. `PaxRulesResolver`: defaults del tenant → `catalog_pax_rules` → efectos de reglas apagadas (sin máximo, niño 100 %, infante paga).
4. Supuesto: la sección `ecommerce.default_pax_rules` se agrega a `sys_settings` (CHECK de sección ampliado).
5. `simulate` devuelve validación + líneas base; auditoría `reglas_pasajeros`; editar con `catalog.products.update`.

**Pruebas:** 16 §10.2: 1 ADT + 3 CHD + 2 INF → 2 errores; bandas inválidas 422; `R-CHILD-PER-ADULT` apagada sin máximo.

**Depende de:** F1A-MOT-01, F1A-CAT-01 · **Prioridad:** P0

#### F1A-MOT-06 · `BookingEngine::quote` básico (tarifa, temporada, pasajeros y modalidad de pago por defecto)

**Historia:** Como Ventas, quiero que el precio de una selección (fecha, pasajeros) lo calcule un único motor, para que web, B2B y cotizador coincidan.

**Especificación:** 16 §1 (principio), §8.1 (algoritmo de precio pasos 1–7, 11–16), §5.2 CAT-PX-03; 02 CAT-BR-15; H-09, H-13

**Tablas:** Lectura `catalog_rates`, `catalog_seasons`, `catalog_pax_rules`, `sys_booking_rules`, `sys_fx_rates`

**Endpoints:** Servicio de dominio (consumido por `price-quote` F1A-CAT-16 y `pax-rules/simulate`)

**Pantallas:** —

**Criterios de aceptación:**

1. Tarifa base vigente `Adulto`/`Pasajero` del canal o `Directo` (resolución CAT-BR-15); sin tarifa → warning bloqueante PRD-BR-005.
2. Factor de temporada si `R-SEASON` activa; tarifa `Niño` vigente prevalece sobre el % (CAT-PX-03); infante según `infantPays`.
3. Ajustes `R-GROUP-DISC`, `R-EARLY-BIRD`, `R-LAST-MINUTE` sobre el mismo subtotal (no en cascada); `R-PROMO`, adicionales, alojamiento, suplemento simple y `R-PAY-FEE` quedan como pasos no-op hasta Fase 2.
4. Modalidades desde `policies`/reglas del tenant (`R-DEPOSIT`, `R-PAY-LATER`); `deposit`, `balance`, `balance_due` (si < hoy → hoy + warning).
5. Contrato `QuoteResult` completo (lines, adjustments, subtotal, total, modes, deposit_pct, deposit, balance, balance_due, warnings, ok, currency, fx_rate) para que Fase 2 solo agregue pasos.
6. Conversión con `FxConverter` y TC del día congelado en el resultado.

**Pruebas:** 16 §10.2: PRD-011 2 ADT + 1 CHD (5 a) + 1 INF (2 a) → ADT 2 × 1 490, CHD 1 090, INF 0; `R-DEPOSIT` apagada → sin `adelanto`; saldo vencido → hoy + warning.

**Depende de:** F1A-MOT-03, F1A-MOT-05, F1A-CAT-21, F1A-CAT-22 · **Prioridad:** P0

#### F1A-MOT-07 · Resumen de configuración de reservas del producto

**Historia:** Como usuario interno, quiero ver en una tarjeta cómo se vende el producto en línea, para detectar configuraciones incompletas.

**Especificación:** 16 §2 (resumen comercial), §6.2 (`booking-config`)

**Tablas:** —

**Endpoints:** `GET /api/v1/catalog/products/{id}/booking-config`

**Pantallas:** —

**Criterios de aceptación:**

1. Devuelve leyenda de rangos, próxima fecha vendible, resumen de pasajeros, estado de cada regla del tenant que afecta secciones (con marca «desactivada para este tenant»).
2. Secciones de Fase 2 (adicionales, alojamiento, pago, recojo, reglas del producto) se devuelven con `available_from = "2"`.

**Pruebas:** Pest: regla apagada marca la sección.

**Depende de:** F1A-MOT-04, F1A-MOT-05 · **Prioridad:** P1

#### F1A-MOT-08 · UI pestaña «Reservas online»: Disponibilidad y Pasajeros

**Historia:** Como Operaciones o Gerente, quiero gestionar rangos, cerrar fechas y configurar pasajeros desde el Product 360.

**Especificación:** 16 §2, §7; 02 §11.3

**Tablas:** —

**Endpoints:** F1A-MOT-02, F1A-MOT-04, F1A-MOT-05, F1A-MOT-07

**Pantallas:** `/catalogo/productos/[code]/reservas`, `/catalogo/productos/[code]/reservas/pasajeros`

**Criterios de aceptación:**

1. Resumen + calendario mensual por estado, selector de pax, detalle de día, modo «Cerrar fechas», días de operación, horas de anticipación y CRUD de rangos con errores CAT-AV mostrados en el formulario.
2. Pasajeros: bandas, % niño, infantes, máximos, mínimo de adultos, nota y simulador.
3. Gating: «Regla desactivada para este tenant» cuando corresponda; permisos de edición según 16 §7 (Operaciones solo disponibilidad; Ventas solo lectura con simulador usable).
4. Subpestañas de Fase 2 visibles como «Disponible en Fase 2»; 400 px sin scroll horizontal.

**Pruebas:** 16 §10.3 pasos 1–4 y 7 (parte disponibilidad/pasajeros).

**Depende de:** F1A-MOT-07, F1A-CAT-20 · **Prioridad:** P0

### E1A.10 · Pruebas de salida de Fase 1-A

#### F1A-QA-01 · Suite Pest de CRM (CRM-T01…T30)

**Historia:** Como responsable técnico, quiero todas las pruebas mínimas del CRM automatizadas.

**Especificación:** 01 §10

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. CRM-T01…T19 y T21…T30 implementados; CRM-T20 con eventos simulados (repetido en 1-B con cotizaciones reales).
2. Cada acción de 01 §9 verificada con `assertAudited`.
3. Exportación CSV (CRM-T29) marcada `todo()` hasta la historia de exportaciones de Fase 1-B.

**Pruebas:** Suite en CI.

**Depende de:** Historias de backend de E1A.1–E1A.4 · **Prioridad:** P0

#### F1A-QA-02 · Suite Pest de Catálogo y Motor (PRD-T01…T15, 02 §10.2, 16 §10.1–10.2)

**Historia:** Como responsable técnico, quiero las pruebas de catálogo y motor en verde, incluida la concurrencia.

**Especificación:** 02 §10.1–10.2; 16 §10.1–10.2

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. PRD-T01…T15 (T04/T06 en la parte de catálogo; se completan con cotizaciones en 1-B).
2. Reglas de 02 §10.2 excepto B2B y promociones (Fase 2).
3. Caso del cliente PRD-011 y tabla 16 §10.2 excepto adicionales, alojamiento, pago por producto, overrides e idempotencia de `/public/bookings` (Fase 2).
4. Concurrencia: dos holds paralelos por el último cupo con `pcntl`/procesos reales contra Redis y PostgreSQL.

**Pruebas:** Suite en CI.

**Depende de:** Historias de backend de E1A.5–E1A.9 · **Prioridad:** P0

#### F1A-QA-03 · Playwright Fase 1-A

**Historia:** Como responsable técnico, quiero los flujos E2E del CRM y del catálogo automatizados.

**Especificación:** 01 §10 (E2E-01, CRM-E2E-02/03); 02 §10.3; 16 §10.3

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. E2E-01 hasta «oportunidad creada» (el tramo de cotización y aprobación se agrega en 1-B).
2. CRM-E2E-02, CRM-E2E-03, CAT-E2E-01…05, pasos de disponibilidad y pasajeros de 16 §10.3.
3. Verificación a 400 px sin scroll horizontal en kanban, 360 y Reservas online.

**Pruebas:** Suite nightly.

**Depende de:** Historias de UI de E1A.1–E1A.9 · **Prioridad:** P1

## Definición de terminado (toda historia)

- Migraciones reversibles con RLS forzado, CHECK de estados, índices y FK en la misma migración.
- Actions dentro de transacción, con locks donde haya cupos o dinero, eventos de dominio `afterCommit` y auditoría de las acciones críticas.
- Endpoints con FormRequest, Policy + permiso spatie, `JsonResource` que omite campos sensibles por permiso y OpenAPI regenerado.
- Pantallas Next.js equivalentes al prototipo, con estados vacío, error y 403; sin scroll horizontal de página a 400 px.
- Pruebas: aislamiento de tenant, RBAC (403), ownership, máquina de estados, reglas de negocio e idempotencia cuando aplique.
