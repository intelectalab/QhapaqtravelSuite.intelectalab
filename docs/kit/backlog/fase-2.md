# Backlog · Fase 2 — Canales y campo

Alcance: apps móviles operador y pasajero con offline (spec 05), portal del pasajero y canal B2B (08), extranet de proveedores (06), sitio web público con checkout y pagos (15, con e-commerce y CMS de 08), facturación electrónica OSE, conciliación y cierre de periodo (07), motor de reservas completo, centro de reglas, widget e integración con CMS, mensajes al pasajero y monedas (16 y 17), bandeja de aprobaciones e inbox omnicanal (10), cupos y documentos de viaje (11) y tesorería (12).
Requiere Fase 0 y Fase 1 (partes A y B) terminadas; ver «Supuestos y decisiones».
Criterio de salida (03-PLAN §2): E2E-04 y E2E-07 en verde; integración OSE y pasarela validadas con proveedor real.

Archivo tabular equivalente: `fase-2.csv`.

## Resumen

| Épica | Nombre | Historias |
|---|---|---|
| E2.1 | Apps móviles operador y pasajero con offline | 17 |
| E2.2 | Portal del pasajero | 9 |
| E2.3 | Canal B2B con crédito | 10 |
| E2.4 | Extranet de proveedores | 11 |
| E2.5 | Sitio público, checkout, pagos y CMS | 19 |
| E2.6 | Facturación electrónica OSE, conciliación y cierre de periodo | 11 |
| E2.7 | Motor de reservas completo, centro de reglas, widget/CMS, mensajes al pasajero y monedas | 15 |
| E2.8 | Bandeja de aprobaciones | 5 |
| E2.9 | Inbox omnicanal | 7 |
| E2.10 | Cupos (allotments) y documentos de viaje | 10 |
| E2.11 | Tesorería (caja y bancos) | 10 |
| E2.12 | Cierre de fase y homologaciones | 3 |
| **Total** | | **127** |

Prioridad: P0 = imprescindible para el criterio de salida · P1 = necesaria en la fase · P2 = puede pasar a la fase siguiente sin bloquear.

Cobertura referencial: 364 endpoints, 100 tablas y vistas citadas (92 nuevas, el resto con columnas agregadas), 215 referencias a casos de prueba.

## Cómo usar este backlog con Claude Code

1. Trabajar una historia por sesión, en el orden de dependencias (columna «Depende de») y por olas (tabla más abajo).
2. Entregar a Claude Code el bloque completo de la historia más las secciones de especificación citadas; los criterios de aceptación son la definición de «hecho» de la sesión.
3. Cerrar la historia solo con sus pruebas en verde y la especificación actualizada si hubo cambios (sección 11 y `CHANGELOG.md`).

### Orden por olas

| Ola | Historias |
|---|---|
| Ola 1 · Bases | F2-MOV-01, F2-MOV-02, F2-WEB-01, F2-WEB-02, F2-MOT-01, F2-MOT-12, F2-MOT-14, F2-INB-01, F2-APR-01, F2-FIS-01, F2-FIS-02, F2-TES-01, F2-CUP-01, F2-DOC-01, F2-EXT-01, F2-EXT-02, F2-B2B-01 |
| Ola 2 · Núcleo de dominio | F2-MOT-02, F2-MOT-03, F2-MOT-04, F2-MOT-05, F2-MOT-06, F2-MOT-08, F2-MOT-10, F2-MOT-09, F2-INB-02, F2-INB-03, F2-INB-04, F2-APR-02, F2-FIS-03, F2-FIS-04, F2-FIS-09, F2-TES-02, F2-TES-03, F2-TES-04, F2-TES-05, F2-CUP-02, F2-CUP-03, F2-DOC-02, F2-EXT-03, F2-EXT-05, F2-EXT-06, F2-B2B-02, F2-B2B-03, F2-B2B-04, F2-B2B-05, F2-MOV-03, F2-MOV-04, F2-MOV-05, F2-MOV-06, F2-PAX-01, F2-PAX-02 |
| Ola 3 · Canales y experiencia | F2-WEB-03, F2-WEB-04, F2-WEB-05, F2-WEB-06, F2-WEB-07, F2-WEB-08, F2-WEB-09, F2-WEB-10, F2-WEB-11, F2-WEB-15, F2-MOT-07, F2-MOT-11, F2-MOT-13, F2-FIS-05, F2-FIS-06, F2-FIS-07, F2-FIS-10, F2-APR-03, F2-APR-04, F2-APR-05, F2-INB-05, F2-INB-06, F2-B2B-06, F2-B2B-07, F2-B2B-08, F2-EXT-04, F2-EXT-07, F2-EXT-08, F2-EXT-09, F2-MOV-07, F2-MOV-08, F2-MOV-09, F2-MOV-10, F2-MOV-11, F2-MOV-12, F2-PAX-03, F2-PAX-04, F2-PAX-05, F2-TES-06, F2-TES-07, F2-TES-08, F2-TES-09, F2-CUP-04, F2-CUP-05, F2-DOC-03, F2-DOC-04 |
| Ola 4 · Cierre de canales, pruebas y homologación | F2-WEB-12, F2-WEB-13, F2-WEB-14, F2-WEB-16, F2-WEB-17, F2-WEB-18, F2-WEB-19, F2-MOV-13, F2-MOV-14, F2-MOV-15, F2-MOV-16, F2-MOV-17, F2-PAX-06, F2-PAX-07, F2-PAX-08, F2-PAX-09, F2-B2B-09, F2-B2B-10, F2-EXT-10, F2-EXT-11, F2-FIS-08, F2-FIS-11, F2-MOT-15, F2-INB-07, F2-CUP-06, F2-TES-10, F2-CIE-01, F2-CIE-02, F2-CIE-03 |

## Supuestos y decisiones que afectan esta fase

- Fase 0 entrega tenancy + RLS, Sanctum + MFA, permisos con teams, `audit_events`, `sys_sequences`, `sys_idempotency_keys`, `sys_outbox`, notificaciones por email, `sys_documents` + PDF, Reverb, Horizon y el shell Next.js por experiencia. Los adaptadores de WhatsApp y Push se implementan aquí.
- Fase 1 entrega el `BookingEngine` básico (rangos, pasajeros, tarifas, temporadas, salidas, holds), CRM, cotizaciones, reservas, operaciones web (órdenes, asignaciones, rooming, vouchers, incidencias, evidencias, recursos), finanzas sin OSE ni conciliación, portal del cliente, reportes básicos y Libro de Reclamaciones. Si algo no quedó, la historia que lo usa lo indica.
- Las specs nombran `audit_logs`; se usa `audit_events` (00 §3.6), como en Fase 0.
- El cierre contable de periodo (07 §5.9) se incluye aquí porque depende de facturación electrónica y conciliación.
- El CMS editorial (08 §5.3) no está en Fase 1 y se construye aquí (F2-WEB-15).
- `sys_booking_rules` y `RuleResolver` vienen de F1A-MOT-01 (definición de 16 §3.1); aquí se agregan las columnas de 17 §3.1 y la administración. `min_plan` existe pero `plan_allows()` devuelve verdadero hasta Fase 3.
- `fin_fx_rates` se crea con la definición de 17 §3.6 más `buy`/`sell` opcionales (07 §3.19) y absorbe el historial de `sys_fx_rates` (F0-33), que queda como vista de compatibilidad.
- Se reutilizan de Fase 1: interfaz `PaymentGateway` con driver sandbox (F1B-POR-04), previsualización de portal sin escritura (F1B-POR-05), tickets de soporte (F1B-POR-03), job `ExpireAvailabilityHolds` (F1A-CAT-26), presign de evidencias (F1B-OPS-10) y columnas de rooming por ciudad (F1B-OPS-01).
- Se proponen los permisos de campo `field.assignments.view`, `field.assignments.act` y `field.incidents.report` (H-08; la spec 05 no los enumera) y se usan los `supplier.*` de 06 §7.
- `ConsentService` mínimo (checkout, newsletter, analítica) se crea aquí; Fase 3 (spec 14) lo extiende con segmentos y campañas.
- Un pedido web genera una reserva por línea del carrito (D-14, resuelta).

### Conflictos entre especificaciones (resolver al programar y registrar en §11)

| Dónde | Conflicto | Propuesta | Historia |
|---|---|---|
| 16 §3.1 vs 17 §3.1 | `sys_booking_rules`: `rule_key/group_name/is_system` vs `code/rule_group/is_custom/depends_on/min_plan` | Adoptar 17 (v2.2) | F2-MOT-01 |
| 07 §3.19 vs 17 §3.6 | `fin_fx_rates`: `buy/sell/source` vs `rate_pen/previous_rate/provider_id` | Adoptar 17 + `buy`/`sell` opcionales | F2-MOT-14 |
| 16 §6.2 vs 17 §6 | Permiso de excepciones por producto: `update` vs `admin.settings.manage` | Producto: `catalog.products.update`; tenant: `admin.settings.manage` | F2-MOT-02 |
| 15 §6.2 vs 15 §6.6 / 16 §6.1 | `POST /public/price-quote` y `POST /public/quote` | Motor único `/public/quote`; `price-quote` como alias deprecado | F2-WEB-05 |
| 15 §3.13 vs 15 §3.14 | `channel_ecom_orders.reservation_id UNIQUE` vs una reserva por línea | `reservation_ids uuid[]`; quitar el UNIQUE | F2-WEB-07 |
| 05 §6.8 vs 05 §6.9 | `GET /mobile/passenger/messages` para chat y para la bandeja de mensajes | Bandeja en `/mobile/passenger/pax-messages` | F2-MOV-13 |
| 12 §6 vs 15 §6.4 | `POST /public/{tenant}/claim-book` y `POST /public/claims` | Un endpoint (tenant por host) con alias | F2-WEB-14 |
| 10 §6 vs 15 §6.4 | `POST /public/contact` en dos specs | Un solo endpoint | F2-INB-02 |
| 05 §3.14 vs 10 §3.7 | `channel_trip_messages` y `collab_messages` para el chat del pasajero | Adaptador sobre `collab_messages` | F2-MOV-12 |

### Decisiones de negocio pendientes que bloquean historias

| ID | Tema | Historias afectadas |
|---|---|---|
| D-01 | OSE/PSE, series por sede, exportación de servicios | F2-FIS-03, F2-FIS-04, F2-CIE-02 |
| D-02 | Pasarela (tarjeta, Yape/Plin), anticipo/saldo en línea, liquidación | F2-WEB-08, F2-WEB-09, F2-CIE-01 |
| D-03 | Proveedor de WhatsApp Business y dominio de correo | F2-INB-02, F2-INB-03, F2-MOT-13 |
| D-04 | Umbrales de aprobación, anticipos, tramos | F2-APR-01, F2-MOT-06 |
| D-05 | Crédito B2B: límite, plazo, comisión vs neto | F2-B2B-01, F2-B2B-06 |
| D-06 | Proveedores que usarán la extranet | F2-EXT-01 |
| D-07 | Visas por nacionalidad, permisos de menores, protección de datos | F2-DOC-01, F2-DOC-02 |
| D-09 | Idiomas y monedas del sitio y portales | F2-WEB-01, F2-MOT-14 |
| D-10 | Android/iOS, tiempo máximo offline, GPS | F2-MOV-01, F2-MOV-16 |
| D-12 | Proveedor real de tipo de cambio y margen | F2-MOT-14 |
| D-13 | Datos capturados con reglas luego apagadas | F2-MOT-07, F2-MOT-10 |

### Hallazgos del prototipo que se corrigen en esta fase

| Hallazgo | Problema | Historia |
|---|---|---|
| H-01 | Exportación sin IGV por país del cliente | F2-FIS-03 |
| H-02 | Crédito B2B descontado dos veces | F2-B2B-02 |
| H-05 | Previsualización de portales ejecuta acciones reales | F2-PAX-09, F2-MOV-15 |
| H-06 | NC con serie de factura y sin OSE | F2-FIS-01, F2-FIS-06 |
| H-07 | Incidencia crítica del proveedor no alerta a gerencia | F2-EXT-08 |
| H-08 | Acciones de campo y del proveedor sin permiso específico | F2-MOV-03, F2-EXT-01 |
| H-09 | IGV distinto según el camino de la reserva | F2-FIS-03 |
| H-12 | TC del día en vez del conservado en el documento | F2-MOT-14 |
| H-14 | El hold de la tienda no expira | F2-WEB-06 |
| H-15 | Tarifa B2B: advierte en un módulo y bloquea en otro | F2-B2B-03 |
| H-19 | CMS sin permiso de solo redacción | F2-WEB-15 |
| H-20 | Extranet muestra la tarifa en la moneda de la reserva | F2-EXT-07 |
| H-21 | Umbrales de aprobación escritos en el código | F2-APR-01 |

## Fuera de alcance de esta fase

- Reseñas propias verificadas (18) y reseñas externas de 17 (conectores, respuestas, widget de reseñas, invitaciones R-REVIEW-INVITE, «Califica tu viaje» de 08 §5.7): Fase 3.
- Matriz planes × reglas (`plan_rule_entitlements`, PLN-R-01, vista previa por plan): Fase 3.
- Marketing completo (segmentos, campañas, automatizaciones, `mkt_*`) y metas: Fase 3.
- API keys de integradores y webhooks salientes configurables (13): Fase 3. La clave publicable del widget sí entra aquí.
- Libro de Reclamaciones (12): ya en Fase 1; aquí solo se expone en el sitio público.
- GPS del guía (05 §12 #14) y comunicación de baja en producción (07 §6.6): posteriores a su validación.

## Historias

### E2.1 · Apps móviles operador y pasajero con offline

Fuente: 05 §2.1–2.3, §3.13–3.14, §4.8, §5 (MOB-BR, PAX-BR), §6.7–6.9, §8.4.

#### F2-MOV-01 · Proyecto Expo base para las dos apps (operador y pasajero)

**Historia:** Como desarrollador, quiero una base Expo común para las dos apps, para construir operador y pasajero con el mismo cliente API, almacenamiento y validaciones.

**Especificación:** 05 §8.4.1

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Monorepo `apps/mobile-operator` y `apps/mobile-passenger` con Expo Router + TypeScript, `app.config.ts` con branding por tenant y EAS Build configurado (perfiles dev/preview/prod).
2. Paquete compartido `packages/mobile-core`: cliente API con token Sanctum en expo-secure-store, TanStack Query persistido en expo-sqlite, esquemas Zod espejo de los FormRequest, i18n es/en.
3. Detección online/offline con NetInfo expuesta como hook; tema con tokens de color del prototipo (`app.css`).
4. CI ejecuta typecheck, lint y tests unitarios de ambas apps.
5. Supuesto / nota: D-10 (Android/iOS) abierta: configurar ambos targets; publicar según decisión.

**Pruebas:** Unit: cliente API adjunta token y maneja 401/426.

**Depende de:** F0 auth Sanctum · **Prioridad:** P0

#### F2-MOV-02 · Registro de dispositivo, sesión móvil y revocación remota

**Historia:** Como administrador del tenant, quiero registrar y revocar dispositivos móviles, para controlar quién accede desde campo y borrar datos de un teléfono perdido.

**Especificación:** 05 §3.13, §8.4.1

**Tablas:** `ops_mobile_devices`

**Endpoints:** `POST /api/v1/mobile/devices`, `DELETE /api/v1/mobile/devices/{id}`

**Pantallas:** —

**Criterios de aceptación:**

1. Login emite token Sanctum con ability `mobile:operator` o `mobile:passenger` según rol; `device_id` UUID v7 generado en el dispositivo y guardado en SecureStore.
2. `app_version` menor a la mínima configurada → 426 y pantalla de actualización obligatoria.
3. `revoked_at` no nulo → 401 en el siguiente request y la app borra SQLite y archivos locales al arrancar.
4. `expo_push_token` único parcial; al cerrar sesión se anula.

**Pruebas:** Pest: dispositivo revocado → 401; Pest: versión mínima → 426; Pest: aislamiento tenant en dispositivos.

**Depende de:** F2-MOV-01 · **Prioridad:** P0

#### F2-MOV-03 · Vínculo usuario ↔ recurso operativo y permisos de campo

**Historia:** Como guía o conductor, quiero entrar a la app vinculado a mi recurso, para ver y operar solo mis asignaciones.

**Especificación:** 05 §5 MOB-BR-13, §6.7; 04-HALLAZGOS H-08

**Tablas:** —

**Endpoints:** `GET /api/v1/mobile/operator/me`

**Pantallas:** —

**Criterios de aceptación:**

1. Guía/conductor autenticado resuelve su recurso (`ops_guides`/`ops_drivers`) desde el token; sin vínculo → 403 con el texto de MOB-BR-13.
2. Cada endpoint `/mobile/operator/*` valida un permiso específico de campo (H-08) además de `AssignmentPolicy` (recurso asignado).
3. `/me` devuelve carné/licencia y vencimientos del recurso.
4. Supuesto / nota: Supuesto: la spec no nombra los permisos `field.*`; se proponen `field.assignments.view`, `field.assignments.act`, `field.incidents.report` (registrar en §11 de la spec 05).

**Pruebas:** Pest T-16: guía no actúa sobre asignación de otro recurso → 403; Pest: usuario sin recurso → 403 MOB-BR-13.

**Depende de:** F2-MOV-02; F1B-OPS-05 · **Prioridad:** P0

#### F2-MOV-04 · Sincronización delta (bootstrap) para la app del operador

**Historia:** Como guía o conductor, quiero descargar mis servicios de los próximos días, para trabajar aunque pierda la señal.

**Especificación:** 05 §6.7, §6.9, §8.4.3 paso 7

**Tablas:** —

**Endpoints:** `GET /api/v1/mobile/operator/bootstrap`, `GET /api/v1/mobile/operator/assignments/{id}`

**Pantallas:** —

**Criterios de aceptación:**

1. `bootstrap?since={cursor}` devuelve asignaciones del recurso en ventana [-2 d, +14 d] con pasajeros, punto de encuentro, compañero, coordinador, notas/dietas, incidencias abiertas y evidencias.
2. Devuelve tombstones de asignaciones quitadas o reasignadas y un nuevo `sync_cursor` (guardado en `ops_mobile_devices`).
3. Detalle incluye `client_pickup`, `client_comments` y `alert_tags` (v2.1).
4. Nunca devuelve datos de asignaciones de otros recursos.

**Pruebas:** Pest: delta sin cambios devuelve vacío; Pest: reasignación produce tombstone.

**Depende de:** F2-MOV-03 · **Prioridad:** P0

#### F2-MOV-05 · Acciones de campo idempotentes con resolución de conflictos en servidor

**Historia:** Como coordinador de operaciones, quiero que las acciones hechas sin conexión lleguen una sola vez y con reglas claras de conflicto, para confiar en el estado de cada servicio.

**Especificación:** 05 §3.13 `ops_sync_actions`, §5 MOB-BR-01/05–11, §6.7, §8.4.4

**Tablas:** `ops_sync_actions`

**Endpoints:** `POST /api/v1/mobile/operator/actions`, `POST /api/v1/mobile/operator/sync`

**Pantallas:** —

**Criterios de aceptación:**

1. Acción `{client_action_id, type, assignment_id, occurred_at, offline, payload}`; `client_action_id` existente → devuelve `response` guardada (`duplicate`) sin reejecutar efectos.
2. `/sync` procesa hasta 50 acciones en orden de `occurred_at`, cada una en su transacción con `SELECT … FOR UPDATE` de la asignación; resultado por acción.
3. Reglas MOB-BR-05 a 11 aplicadas con `conflict_rule` y `conflict_message`; acción sobre asignación liberada/reasignada → `rejected` (MOB-BR-10).
4. `start` pasa orden a `en_ejecucion` y reserva a `en_operacion`; `finish` exige ≥ 1 check-in y ≥ 1 evidencia.
5. Auditoría y notificaciones solo al aplicar en servidor, con marca `offline {ts}` (MOB-BR-02).

**Pruebas:** Pest T-17: misma client_action_id → duplicate; Pest T-18: check-in offline conserva la marca más temprana; Pest T-19: finish sin check-in/evidencia o sobre asignación liberada → rejected; Pest T-20: start cambia orden y reserva; Pest: lote de 50 en orden causal.

**Depende de:** F2-MOV-04; F1 máquina de estados de asignación · **Prioridad:** P0

#### F2-MOV-06 · Evidencias fotográficas desde el móvil con deduplicación por hash

**Historia:** Como guía, quiero subir fotos de evidencia desde el teléfono, para cerrar el servicio sin enviar archivos por otros medios.

**Especificación:** 05 §6.6 presign, §8.4.1, MOB-BR-09

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. La app comprime (máx. 1920 px, JPEG q=0.7), calcula SHA-256, pide URL prefirmada, hace PUT a S3 y envía acción `evidence {upload_id, sha256}`.
2. Mismo hash ya registrado en la asignación → se asocia la evidencia existente (MOB-BR-09).
3. `POST /api/v1/ops/evidences/presign` (creado en F1B-OPS-10) se extiende para aceptar guía/conductor con permiso de campo; ruta S3 `tenants/{tenant}/ops/{uuid}`.

**Pruebas:** Pest: presign rechaza mime/tamaño no permitido; Pest: hash duplicado no crea segunda evidencia.

**Depende de:** F2-MOV-05; F1B-OPS-10 · **Prioridad:** P0

#### F2-MOV-07 · App operador: pantallas Hoy, Detalle, Calendario, Incidencias y Perfil

**Historia:** Como guía o conductor, quiero ver hoy, próximos servicios y el detalle de cada uno, para ejecutar el servicio paso a paso.

**Especificación:** 05 §2.1, §2.3

**Tablas:** —

**Endpoints:** —

**Pantallas:** App operador: Hoy, Detalle, Nueva incidencia, Calendario, Incidencias, Perfil

**Criterios de aceptación:**

1. Hoy: contadores hoy/próximos/por confirmar, estado de red y última sincronización, alerta si hay incidencia crítica abierta en sus órdenes.
2. Detalle: barra `Asignado → Confirmado → Inicio → Check-in → Evidencia → Fin`, botones según estado (UX, la API es autoridad, MOB-BR-12), recojo del cliente y comentarios (v2.1), llamar al coordinador.
3. Calendario: tira de 7 días y agenda de 14 días. Incidencias: propias y de sus órdenes.
4. Perfil: datos del recurso y bandeja de salida con estado por acción.

**Pruebas:** Maestro/Detox: flujo confirmar → iniciar → check-in → evidencia → finalizar (base de E2E-04).

**Depende de:** F2-MOV-04 · **Prioridad:** P0

#### F2-MOV-08 · App operador offline: SQLite local, outbox, coalescencia y reintentos

**Historia:** Como guía en zonas sin cobertura, quiero que la app guarde mis acciones y las sincronice sola, para no perder check-ins ni evidencias.

**Especificación:** 05 §4.8, §5 MOB-BR-02–04, §8.4.2–8.4.3

**Tablas:** —

**Endpoints:** —

**Pantallas:** App operador: Perfil › Bandeja de salida

**Criterios de aceptación:**

1. Esquema SQLite versionado con tablas `assignments, passengers, checkins, evidences, incidents, outbox, sync_history, sync_state` (§8.4.2).
2. Cada acción se aplica localmente y se inserta en `outbox` en una transacción; `confirm`/`checkin` pendientes con la misma `coalesce_key` se reemplazan (MOB-BR-03).
3. Reintentos con backoff exponencial y jitter (2 s … máx. 5 min), máx. 8 intentos → `failed` con botón Reintentar; `rejected` revierte el cambio local.
4. Sincroniza al reconectar, al volver a primer plano y por background fetch (≥ 15 min); chip «Sin conexión · N».

**Pruebas:** E2E-07: 3 acciones offline → reconectar → synced, conflicto resuelto visible; Unit: coalescencia y backoff.

**Depende de:** F2-MOV-05, F2-MOV-07 · **Prioridad:** P0

#### F2-MOV-09 · Reporte de incidencias desde campo (online y offline)

**Historia:** Como guía, quiero reportar una incidencia desde el lugar, para que operaciones y gerencia reaccionen a tiempo.

**Especificación:** 05 §6.7, MOB-BR-11, §3.11 `related_incident_id`

**Tablas:** —

**Endpoints:** `GET /api/v1/mobile/operator/incidents`, `POST /api/v1/mobile/operator/incidents`

**Pantallas:** App operador: Nueva incidencia, Incidencias

**Criterios de aceptación:**

1. Formulario con servicio, tipo, severidad, título, descripción y fotos; funciona offline vía outbox (`type=incident`).
2. Si el coordinador creó una incidencia de la misma orden y tipo en los últimos 10 min, se crea vinculada con `related_incident_id` y se notifica para revisión.
3. Crítica dispara `IncidentCreated` con alerta a gerencia (push + WhatsApp).

**Pruebas:** Pest: incidencia similar < 10 min → vinculada; Pest T-13 (vía móvil): crítica notifica al Manager.

**Depende de:** F2-MOV-05 · **Prioridad:** P1

#### F2-MOV-10 · Notificaciones push con Expo y deep links

**Historia:** Como guía o pasajero, quiero recibir avisos en el teléfono, para enterarme al instante de asignaciones, cambios de horario y vouchers.

**Especificación:** 05 §8.4.5

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Job `SendExpoPush` (cola notifications) para: nueva asignación/liberación/cambio de hora, alerta operativa, voucher emitido, cambio de horario, respuesta de chat.
2. Deep links `kipucontrol-ops://assignments/{id}` y `kipucontrol-trip://alerts/{id}` abren la pantalla correcta.
3. Receipt `DeviceNotRegistered` anula el token; si push falla, se usa WhatsApp según la matriz de notificaciones.

**Pruebas:** Pest: receipt inválido anula token; Pest: evento ServiceAssigned encola push al recurso.

**Depende de:** F2-MOV-02 · **Prioridad:** P1

#### F2-MOV-11 · App pasajero: Mi viaje, Itinerario, Vouchers con QR, Docs, Alertas y Soporte

**Historia:** Como pasajero, quiero tener mi viaje, itinerario y vouchers en el teléfono, para viajar sin papeles.

**Especificación:** 05 §2.2, §5 PAX-BR-01–03, §6.8

**Tablas:** —

**Endpoints:** `GET /api/v1/mobile/passenger/trip`, `GET /api/v1/mobile/passenger/itinerary`, `GET /api/v1/mobile/passenger/vouchers`, `GET /api/v1/mobile/passenger/vouchers/{id}`, `GET /api/v1/mobile/passenger/documents`, `GET /api/v1/mobile/passenger/documents/{id}/download`, `GET /api/v1/mobile/passenger/support`

**Pantallas:** App pasajero: Mi viaje, Itinerario, Vouchers, Docs, Alertas, Soporte

**Criterios de aceptación:**

1. Login con email + contraseña o enlace mágico; solo ve su reserva (PAX-BR-01), sin vínculo muestra el mensaje de la regla.
2. Mi viaje: estado (faltan N días / día X de N / finalizado), próxima actividad (PAX-BR-03) con cuenta regresiva, hotel y habitación de la rooming list.
3. Vouchers: solo no anulados, QR con `{voucher}|{reserva}|{versión}` firmado; lectura offline de lo ya descargado.
4. Documentos desde `sys_documents` vinculados a la reserva con URL firmada; emergencia 24/7 configurable por sede.
5. Supuesto / nota: Supuestos 05 §12 #15 y #20 adoptados (documentos desde sys_documents, emergencia por sede).

**Pruebas:** Pest T-21: pasajero solo accede a su reserva; vouchers anulados no se devuelven.

**Depende de:** F2-MOV-01, F2-MOV-02 · **Prioridad:** P0

#### F2-MOV-12 · App pasajero: alertas con leído y chat con la agencia

**Historia:** Como pasajero, quiero ver alertas y escribir a la agencia desde la app, para resolver dudas durante el viaje.

**Especificación:** 05 §3.14, §6.8, §12 #16–17

**Tablas:** `notif_reads`, `channel_trip_messages`

**Endpoints:** `GET /api/v1/mobile/passenger/alerts`, `POST /api/v1/mobile/passenger/alerts/{id}/read`, `GET /api/v1/mobile/passenger/messages`, `POST /api/v1/mobile/passenger/messages`

**Pantallas:** App pasajero: Alertas, Soporte (chat)

**Criterios de aceptación:**

1. Alertas = `notif_notifications` con `reservation_id` y `audience=passenger`; badge de no leídas; `notif_reads` UNIQUE (notification_id, user_id).
2. Chat del pasajero se refleja como conversación del inbox (canal app) y las respuestas del agente llegan por push.
3. Supuesto / nota: Supuesto: `channel_trip_messages` se implementa como vista/adaptador sobre `collab_messages` (05 §3.14 permite unificar).

**Pruebas:** Pest: marcar leída dos veces → una fila; Pest: mensaje del pasajero crea/reabre conversación.

**Depende de:** F2-MOV-11, F2-INB-02 · **Prioridad:** P1

#### F2-MOV-13 · App pasajero v2.1: bandeja de mensajes y comentarios

**Historia:** Como pasajero, quiero leer los mensajes de la agencia y dejar comentarios desde la app, para estar informado y dar mi opinión.

**Especificación:** 05 §2.3, §6.9 (R-PAX-MESSAGES, R-PAX-FEEDBACK)

**Tablas:** —

**Endpoints:** `POST /api/v1/mobile/passenger/messages/{id}/read`, `POST /api/v1/mobile/passenger/feedback`

**Pantallas:** App pasajero: Mensajes, Comentar

**Criterios de aceptación:**

1. Botones «Mensajes (n)» y «Comentar» en Mi viaje; desaparecen si la regla está apagada.
2. Comentario con `Idempotency-Key`; reclamo/incidencia abre conversación en el inbox (misma lógica que el portal).
3. Supuesto / nota: Conflicto de rutas: 05 §6.9 usa `GET /mobile/passenger/messages` para la bandeja v2.1 y 05 §6.8 para el chat; se propone `/mobile/passenger/pax-messages` para la bandeja (registrar en §11).

**Pruebas:** Pest: regla apagada → 404/sección oculta; Pest: feedback idempotente.

**Depende de:** F2-MOV-11, F2-MOT-13, F2-PAX-07 · **Prioridad:** P2

#### F2-MOV-14 · Retención y privacidad de datos en el dispositivo

**Historia:** Como responsable de datos personales, quiero que el teléfono guarde lo mínimo y por poco tiempo, para cumplir la Ley 29733.

**Especificación:** 05 §12 #13

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. La caché local solo guarda la ventana [-2 d, +14 d]; purga automática 7 días después del servicio.
2. No se guardan imágenes de documentos de pasajeros; teléfonos y nombres se borran al revocar el dispositivo.
3. Supuesto / nota: Supuesto por defecto de la spec; validar con negocio (Ley 29733).

**Pruebas:** Unit: purga de datos vencidos.

**Depende de:** F2-MOV-08 · **Prioridad:** P2

#### F2-MOV-15 · Vista previa interna de las apps en web (solo lectura)

**Historia:** Como coordinador, quiero ver cómo luce la app de un guía o pasajero sin modificar datos, para dar soporte.

**Especificación:** 05 §2 (`/mobile/operador`, `/mobile/pasajero`); H-05

**Tablas:** —

**Endpoints:** —

**Pantallas:** `/mobile/operador`, `/mobile/pasajero` (vista previa interna)

**Criterios de aceptación:**

1. Internos con `operations.assign` ven la maqueta con selector «Ver como recurso» y reserva demo; ninguna acción muta datos (impersonación sin escritura, igual que H-05).
2. Guía/conductor/pasajero no acceden a la vista previa (403).

**Pruebas:** Pest: token de previsualización recibe 403 en endpoints de escritura.

**Depende de:** F2-MOV-07, F2-MOV-11 · **Prioridad:** P2

#### F2-MOV-16 · Publicación en tiendas y actualizaciones OTA

**Historia:** Como responsable técnico, quiero publicar las apps y sus actualizaciones de forma controlada, para no romper versiones instaladas.

**Especificación:** 05 §8.4.1 (EAS Build/Submit/Update)

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Pipelines EAS para builds firmados de Android e iOS y envío a tiendas.
2. EAS Update solo publica parches JS compatibles con la `app_version` mínima registrada en backend.
3. Supuesto / nota: Bloqueado por D-10 (plataformas).

**Pruebas:** Checklist de release.

**Depende de:** F2-MOV-08, F2-MOV-11 · **Prioridad:** P2

#### F2-MOV-17 · Pruebas de aceptación de apps (E2E-04, E2E-07)

**Historia:** Como responsable técnico, quiero E2E-04 y E2E-07 automatizados, para cumplir el criterio de salida de la fase.

**Especificación:** 05 §10

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. E2E-04 y E2E-07 automatizados (Maestro sobre emulador en CI) y en verde.
2. Pest T-16 a T-21 en verde.
3. Supuesto / nota: Criterio de salida de Fase 2.

**Pruebas:** E2E-04; E2E-07; Pest T-16…T-21.

**Depende de:** F2-MOV-08, F2-MOV-11 · **Prioridad:** P0

### E2.2 · Portal del pasajero

Fuente: 08 §2, §2.1, §3.13–3.16, §5.5–5.6, §6.6–6.7.

#### F2-PAX-01 · Acceso del pasajero por enlace mágico

**Historia:** Como pasajero, quiero entrar al portal con un enlace enviado a mi correo, para no tener que crear contraseña.

**Especificación:** 08 §3.13, §5.5 PPX-BR-02, §6.6

**Tablas:** `channel_portal_access_links`

**Endpoints:** `POST /api/v1/portal/passenger/auth/link`, `POST /api/v1/portal/passenger/auth/verify`

**Pantallas:** `(portal-pasajero)/ingresar`

**Criterios de aceptación:**

1. Email + código de reserva deben coincidir con el cliente titular o el pasajero; si no, 422 «Correo o código de reserva no coinciden».
2. Token guardado como SHA-256, un solo uso, con expiración; rate limit por IP y email.
3. Canje devuelve sesión Sanctum con rol `passenger` vinculada a `reservation_id`.

**Pruebas:** Pest T21: login con email/código incorrecto → 422; Pest: token reutilizado → 410/422.

**Depende de:** F0 auth · **Prioridad:** P1

#### F2-PAX-02 · Mi viaje, itinerario, hoteles, transporte y actividades

**Historia:** Como pasajero, quiero ver mi viaje día a día con hoteles, traslados y actividades, para saber qué sigue.

**Especificación:** 08 §2, §5.5 PPX-BR-01/07, §6.6

**Tablas:** —

**Endpoints:** `GET /api/v1/portal/passenger/trip`, `GET /api/v1/portal/passenger/itinerary`, `GET /api/v1/portal/passenger/hotels`, `GET /api/v1/portal/passenger/transport`, `GET /api/v1/portal/passenger/activities`, `GET /api/v1/portal/passenger/contacts`

**Pantallas:** `(portal-pasajero)/viajes`, `/itinerario`, `/hoteles`, `/transporte`, `/actividades`, `/contacto`

**Criterios de aceptación:**

1. Grupo `app/(portal-pasajero)` con las rutas de 08 §2; el `reservation_id` sale del token, nunca de la URL.
2. Estado visual por servicio según PPX-BR-07; asignaciones (guía, conductor, vehículo) visibles.
3. Contactos: emergencias 24/7, coordinadora y guía del próximo servicio.

**Pruebas:** Pest T02: pasajero solo ve su reserva; Playwright P06 (parte itinerario).

**Depende de:** F2-PAX-01 · **Prioridad:** P1

#### F2-PAX-03 · Vouchers y documentos del pasajero

**Historia:** Como pasajero, quiero descargar vouchers y documentos del viaje, para presentarlos a los proveedores.

**Especificación:** 08 §5.5 PPX-BR-05, §6.6

**Tablas:** —

**Endpoints:** `GET /api/v1/portal/passenger/vouchers`, `GET /api/v1/portal/passenger/vouchers/{code}`, `GET /api/v1/portal/passenger/documents`

**Pantallas:** `(portal-pasajero)/vouchers`, `/documentos`

**Criterios de aceptación:**

1. Solo vouchers no anulados en su última versión; cada apertura se audita.
2. Documentos: itinerario, certificado, comprobantes aceptados, política de cancelación (CMS).

**Pruebas:** Pest: voucher anulado no aparece; Pest: apertura genera audit_log.

**Depende de:** F2-PAX-02 · **Prioridad:** P1

#### F2-PAX-04 · Alertas del viaje con confirmación de lectura

**Historia:** Como pasajero, quiero ver alertas del viaje y confirmar que las leí, para que la agencia sepa que estoy informado.

**Especificación:** 08 §3.14, §3.15 (`ops_incidents.public_*`), §5.5 PPX-BR-03/04

**Tablas:** `ops_incident_pax_acks`

**Endpoints:** `GET /api/v1/portal/passenger/alerts`, `POST /api/v1/portal/passenger/alerts/{incidentId}/ack`

**Pantallas:** `(portal-pasajero)/alertas`

**Criterios de aceptación:**

1. Alertas = incidencias de la reserva tipo Transporte u Horario no resueltas/cerradas, con `public_title`/`public_message` (columnas nuevas en `ops_incidents`).
2. `ack` idempotente (UNIQUE incident_id, user_id), registra en bitácora de la incidencia y emite `IncidentAlertAcknowledged` al responsable.

**Pruebas:** Pest T21: ack dos veces → una fila; Playwright P06.

**Depende de:** F2-PAX-02 · **Prioridad:** P1

#### F2-PAX-05 · Mensaje a operaciones desde el portal del pasajero

**Historia:** Como pasajero, quiero enviar un mensaje a operaciones, para pedir ayuda durante el viaje.

**Especificación:** 08 §3.12, §5.5 PPX-BR-06, §6.6

**Tablas:** `channel_support_tickets` (source portal_pasajero, topic)

**Endpoints:** `POST /api/v1/portal/passenger/messages`

**Pantallas:** `(portal-pasajero)/contacto`

**Criterios de aceptación:**

1. Crea ticket `source=portal_pasajero` asignado al coordinador de la operación; tema «Salud» → prioridad alta.
2. Evento `SupportTicketCreated` crea la conversación canal `portal` en el inbox (INB-BR-09).
3. Supuesto / nota: `channel_support_tickets` ya existe (F1B-POR-03, portal del cliente); aquí solo se habilita `source=portal_pasajero` y el campo `topic`.

**Pruebas:** Pest: tema Salud → prioridad alta; Pest: ticket crea conversación.

**Depende de:** F2-PAX-02, F2-INB-02; F1B-POR-03 · **Prioridad:** P1

#### F2-PAX-06 · Bandeja de mensajes al pasajero en el portal

**Historia:** Como pasajero, quiero ver los mensajes que me envió la agencia, para no perder información por canal.

**Especificación:** 08 §2.1, §5.6 CAN-V21-01/02, §6.7

**Tablas:** —

**Endpoints:** `GET /api/v1/portal/passenger/messages`, `POST /api/v1/portal/passenger/messages/{id}/read`, `POST /api/v1/portal/passenger/messages/read-all`

**Pantallas:** `(portal-pasajero)/mensajes`

**Criterios de aceptación:**

1. Solo mensajes `enviado|entregado|leido|fallido` de su reserva, filtro por canal; abrir marca `read_at`.
2. Sección oculta si R-PAX-MESSAGES está apagada (CAN-V21-01).
3. Supuesto / nota: Conflicto de ruta: `POST /portal/passenger/messages` (08 §6.6) crea ticket y `GET /portal/passenger/messages` (08 §6.7) lista mensajes; se mantiene tal cual (métodos distintos).

**Pruebas:** Pest: programados/cancelados no se listan.

**Depende de:** F2-MOT-13 · **Prioridad:** P2

#### F2-PAX-07 · Comentarios del pasajero (feedback)

**Historia:** Como pasajero, quiero dejar comentarios, sugerencias o reclamos, para que la agencia los atienda.

**Especificación:** 08 §3.16, §5.6 CAN-V21-03/04, §6.7

**Tablas:** `channel_pax_feedback`

**Endpoints:** `GET /api/v1/portal/passenger/feedback`, `POST /api/v1/portal/passenger/feedback`

**Pantallas:** `(portal-pasajero)/comentarios`

**Criterios de aceptación:**

1. Texto 5–1000, calificación 1–5 o nula, servicio de la misma reserva; `Idempotency-Key`.
2. Reclamo/incidencia abre conversación en el inbox; reclamo muestra enlace al Libro de Reclamaciones sin registrarlo.
3. Supuesto / nota: 08 §3.16 indica tabla única compartida con `booking_pax_feedback` (04); crear una sola tabla.

**Pruebas:** Pest: servicio de otra reserva → 422; Pest: reclamo crea conversación.

**Depende de:** F2-PAX-02, F2-INB-01 · **Prioridad:** P2

#### F2-PAX-08 · Acompañantes, recojo y plan de pago en portales pasajero y cliente

**Historia:** Como cliente o pasajero, quiero completar los datos de mis acompañantes y pagar el saldo, para dejar lista la reserva antes de viajar.

**Especificación:** 08 §2.1, §5.6 CAN-V21-05/06/07, §6.7

**Tablas:** —

**Endpoints:** `GET /api/v1/portal/passenger/companions`, `PUT /api/v1/portal/passenger/companions`, `GET /api/v1/portal/customer/reservations/{code}/web-summary`, `PUT /api/v1/portal/customer/reservations/{code}/companions`, `POST /api/v1/portal/customer/receivables/{code}/pay`

**Pantallas:** `(portal-pasajero)/acompanantes`, `(portal-cliente)/viajes/[code]`

**Criterios de aceptación:**

1. Editable hasta `travelFrom − daysBeforeIfLater`; titular solo documento/nacimiento; cambio de tipo ADT/CHD/INF por edad → 422 (requiere modificación PROC-027).
2. Resumen web con alojamiento por ciudad, adicionales, recojo, comentarios y plan de pago; «Pagar saldo» aplica a la CxC abierta más próxima vía pasarela (Idempotency-Key).
3. Internos sin `finance.payments.register` solo previsualizan (CAN-V21-06).
4. Supuesto / nota: `/portal/customer/receivables/{code}/pay` (08 §6.7) duplica `/portal/client/receivables/{id}/payments` de F1B-POR-04: implementar como alias del mismo Action.

**Pruebas:** Pest: edición fuera de plazo → 422; Pest: cambio de tipo por edad → 422; Pest: pago de saldo idempotente.

**Depende de:** F2-MOT-10, F2-WEB-08 · **Prioridad:** P2

#### F2-PAX-09 · Previsualización interna de portales sin escritura

**Historia:** Como usuario interno, quiero previsualizar los portales sin ejecutar acciones reales, para dar soporte sin riesgo.

**Especificación:** 08 §2, §6.1 impersonation; H-05

**Tablas:** —

**Endpoints:** `POST /api/v1/channels/b2b/agencies/{id}/impersonation`

**Pantallas:** `(backoffice)/canales/portal-pasajero/*`, `(backoffice)/canales/b2b/portal/*`

**Criterios de aceptación:**

1. Token de previsualización con ability `preview` (solo lectura) para portal pasajero y B2B; cualquier mutación → 403 y no cambia estados (p. ej. `enviada → vista`).
2. Reutiliza el modo de previsualización de F1B-POR-05 (portal del cliente) y lo extiende a pasajero y B2B; la barra «Vista del canal» solo se muestra a internos.

**Pruebas:** Pest T19: previsualización no muta; Playwright P07: externos no ven «Vista del canal».

**Depende de:** F2-PAX-02, F2-B2B-04; F1B-POR-05 · **Prioridad:** P1

### E2.3 · Canal B2B con crédito

Fuente: 08 §3.1–3.5, §4.1, §5.1, §6.1–6.2.

#### F2-B2B-01 · Administración de agencias B2B y listas de precios

**Historia:** Como ejecutivo del canal B2B, quiero registrar agencias con su convenio y línea de crédito, para controlar quién puede vender nuestros productos.

**Especificación:** 08 §3.1–3.2, §4.1, §5.1 B2B-BR-07/08/09, §6.1

**Tablas:** `channel_b2b_agencies`, `channel_b2b_price_lists`

**Endpoints:** `GET /api/v1/channels/b2b/summary`, `GET /api/v1/channels/b2b/agencies`, `POST /api/v1/channels/b2b/agencies`, `GET /api/v1/channels/b2b/agencies/{id}`, `PATCH /api/v1/channels/b2b/agencies/{id}`, `POST /api/v1/channels/b2b/agencies/{id}/block`, `POST /api/v1/channels/b2b/agencies/{id}/unblock`, `GET /api/v1/channels/b2b/price-lists`

**Pantallas:** `(backoffice)/canales/b2b/admin`

**Criterios de aceptación:**

1. Alta/edición con RUC 11 dígitos, comisión 0–30, vigencias; estado `activa/bloqueada/inactiva` persistido y `vencido` derivado.
2. Bloqueo automático si `credit_used > credit_limit`; desbloqueo prohibido mientras exceda (409 B2B-BR-07).
3. Pantallas `(backoffice)/canales/b2b/admin` con KPIs, filtros, drawer y exportación; `lock_version` en edición.
4. Supuesto / nota: D-05 (límite, plazo, comisión vs neto) abierta.

**Pruebas:** Pest T08: desbloqueo con crédito excedido → 409; Pest T03: roles sin `channels.b2b.manage` → 403.

**Depende de:** F1 CRM clientes · **Prioridad:** P1

#### F2-B2B-02 · Libro único de crédito B2B

**Historia:** Como analista de finanzas, quiero un único libro de movimientos del crédito B2B, para que el saldo usado sea exacto.

**Especificación:** 08 §3.4, B2B-BR-12; 07 §3.20; H-02

**Tablas:** `channel_b2b_credit_movements`

**Endpoints:** `GET /api/v1/channels/b2b/agencies/{id}/credit-movements`

**Pantallas:** —

**Criterios de aceptación:**

1. `credit_used` solo cambia por movimientos inmutables (`cargo_reserva`, `pago_aplicado`, `reversion_pago`, `anulacion_reserva`, `ajuste`) con TC conservado; lock `b2b:credit:{agency}` + `FOR UPDATE`.
2. Listeners de `PaymentApplied`, `PaymentReverted` y cancelación de reserva generan el movimiento; el método de pago «Crédito B2B» de Finanzas ya no descuenta por su cuenta.
3. Job diario `RecalculateB2bCredit` alerta si `credit_used` ≠ suma de movimientos.
4. Supuesto / nota: Corrige H-02.

**Pruebas:** Pest T10: pago aplicado libera crédito sin doble conteo; Pest: reversión vuelve a consumir.

**Depende de:** F2-B2B-01; F1 pagos · **Prioridad:** P1

#### F2-B2B-03 · Tarifas netas por agencia y producto

**Historia:** Como ejecutivo B2B, quiero asignar tarifas netas por agencia y producto, para vender a cada agencia con sus condiciones.

**Especificación:** 08 §3.3, B2B-BR-10, RT-14; H-15

**Tablas:** `catalog_product_b2b_rates`

**Endpoints:** `GET /api/v1/channels/b2b/product-rates`, `PUT /api/v1/catalog/products/{id}/b2b-rates/{agencyId}`, `DELETE /api/v1/catalog/products/{id}/b2b-rates/{agencyId}`

**Pantallas:** `(backoffice)/canales/b2b/precios`

**Criterios de aceptación:**

1. Upsert con neto ≤ precio público vigente y ≥ costo; marca el producto `is_b2b=true`.
2. Sin tarifa vigente para la agencia se **bloquea** la reserva en todos los canales (unificación H-15), error `RT-14`.
3. Evento `B2bRateAssigned/Removed` invalida caché del catálogo B2B.

**Pruebas:** Pest T04: sin tarifa o vencida → 422 RT-14; Pest: neto > público → 422.

**Depende de:** F2-B2B-01; F1 catálogo · **Prioridad:** P1

#### F2-B2B-04 · Usuarios B2B y sesión de la agencia

**Historia:** Como usuario de una agencia, quiero iniciar sesión en el portal B2B, para operar en nombre de mi agencia.

**Especificación:** 08 §3.15 (`iam_users.agency_id`), B2B-BR-02/17, §6.2 auth

**Tablas:** —

**Endpoints:** `POST /api/v1/b2b/auth/login`, `POST /api/v1/b2b/auth/logout`, `GET /api/v1/b2b/me`

**Pantallas:** —

**Criterios de aceptación:**

1. Usuario B2B vinculado a una agencia; sin vínculo → mensaje B2B-BR-17; agencia `inactiva` → login denegado.
2. `/me` devuelve estado efectivo, crédito disponible, comisión y vigencia; rate limit en login.

**Pruebas:** Pest T09: agencia inactiva no inicia sesión; Pest: usuario sin agencia → 403.

**Depende de:** F2-B2B-01 · **Prioridad:** P1

#### F2-B2B-05 · Catálogo autorizado y salidas para la agencia

**Historia:** Como agencia, quiero ver solo el catálogo autorizado con neto, comisión y salidas, para ofrecerlo a mis clientes.

**Especificación:** 08 §5.1 B2B-BR-01/06, §6.2

**Tablas:** —

**Endpoints:** `GET /api/v1/b2b/catalog`, `GET /api/v1/b2b/catalog/{productId}/departures`

**Pantallas:** `(b2b)/portal/catalogo`

**Criterios de aceptación:**

1. Solo productos ACTIVE, `is_b2b` y publicados en canal B2B con tarifa vigente para la agencia; primero los reservables.
2. Cada ítem trae `ok`, `reason`, neto, PVP sugerido, comisión, crédito permitido y salidas; marca «fuera de anticipación».
3. Pantalla `(b2b)/portal/catalogo`.

**Pruebas:** Pest T02: agencia A no ve tarifas de B.

**Depende de:** F2-B2B-03, F2-B2B-04 · **Prioridad:** P1

#### F2-B2B-06 · Reserva B2B con crédito o prepago

**Historia:** Como agencia, quiero reservar con crédito o prepago, para confirmar a mis clientes sin llamar a la operadora.

**Especificación:** 08 §4.5, §5.1 B2B-BR-03/04/05/11/12/13, RT-4, §6.2

**Tablas:** —

**Endpoints:** `POST /api/v1/b2b/reservations/quote-price`, `POST /api/v1/b2b/reservations`

**Pantallas:** `(b2b)/portal/catalogo` (modal Reservar)

**Criterios de aceptación:**

1. `Idempotency-Key` obligatoria; lock Redis de la salida + `FOR UPDATE` de la agencia; cupos < pax → 409.
2. Crédito solo si la tarifa lo permite, límite > 0 y agencia activa; total en PEN > disponible → 422 B2B-BR-04 y auditoría `credito_excedido` sin crear reserva.
3. Estado inicial según B2B-BR-11 (crédito+salida → `confirmada` + voucher v1; prepago → `pendiente_pago`); CxC (+15 d crédito / +1 d prepago), comisión `calculada`, movimiento de crédito.
4. Pasajeros opcionales «por nominar» (B2B-BR-13).

**Pruebas:** Pest T05; Pest T06; Pest T07 (concurrencia último cupo); Pest T22 (idempotencia); Playwright P01, P02.

**Depende de:** F2-B2B-02, F2-B2B-05; F1 reservas y salidas · **Prioridad:** P1

#### F2-B2B-07 · Mis reservas y vouchers de la agencia

**Historia:** Como agencia, quiero ver mis reservas y descargar vouchers, para dar seguimiento a mis ventas.

**Especificación:** 08 §5.1 B2B-BR-16, §6.2

**Tablas:** —

**Endpoints:** `GET /api/v1/b2b/reservations`, `GET /api/v1/b2b/reservations/{code}`, `GET /api/v1/b2b/vouchers/{code}/pdf`

**Pantallas:** `(b2b)/portal/reservas`

**Criterios de aceptación:**

1. Solo reservas `channel='B2B'` de su agencia; muestra total neto y su referencia; nunca notas internas, costos ni márgenes.
2. Voucher por URL firmada temporal.

**Pruebas:** Pest T02: agencia A no lee reservas de B → 404.

**Depende de:** F2-B2B-06 · **Prioridad:** P1

#### F2-B2B-08 · Estado de cuenta, informe de pago y liquidación de comisiones

**Historia:** Como agencia, quiero ver mi estado de cuenta, informar pagos y pedir la liquidación de comisiones, para conciliar con la operadora.

**Especificación:** 08 §3.5, B2B-BR-14/15, §6.1–6.2

**Tablas:** `channel_b2b_settlement_requests`

**Endpoints:** `GET /api/v1/b2b/statement`, `POST /api/v1/b2b/receivables/{id}/payment-reports`, `POST /api/v1/b2b/settlement-requests`, `GET /api/v1/channels/b2b/settlement-requests`

**Pantallas:** `(b2b)/portal/cuenta`

**Criterios de aceptación:**

1. Informar pago: monto > 0 y ≤ saldo, N.° de operación obligatorio → pago `pendiente` y aviso a Finanzas; el crédito se libera al aplicar.
2. Solicitud de liquidación solo con comisiones no pagadas; consolida en PEN con TC y notifica a Finanzas.
3. Pantalla `(b2b)/portal/cuenta` con KPIs.

**Pruebas:** Pest: informe > saldo → 422; Pest: liquidación sin comisiones → 422.

**Depende de:** F2-B2B-06 · **Prioridad:** P1

#### F2-B2B-09 · Notificaciones y vencimiento de convenios B2B

**Historia:** Como ejecutivo B2B, quiero avisos automáticos de bloqueos y convenios por vencer, para renovar a tiempo.

**Especificación:** 08 §8.1–8.3

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Email a la agencia por alta/bloqueo/desbloqueo; alerta al ejecutivo por intento de crédito excedido.
2. Job `MarkB2bAgreementsExpired` avisa convenios por vencer (30/7 días) y vencidos.

**Pruebas:** Pest: job notifica convenios por vencer.

**Depende de:** F2-B2B-01 · **Prioridad:** P2

#### F2-B2B-10 · Pruebas de aceptación del canal B2B

**Historia:** Como responsable técnico, quiero las pruebas del canal B2B automatizadas, para liberar el canal con seguridad.

**Especificación:** 08 §10

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Pest T01–T10 y T22 en verde; Playwright P01, P02 y P07 (400 px).

**Pruebas:** Pest T01–T10, T22; Playwright P01, P02, P07.

**Depende de:** F2-B2B-08 · **Prioridad:** P1

### E2.4 · Extranet de proveedores

Fuente: 06 completa.

#### F2-EXT-01 · Shell de la extranet, vínculo proveedor y permisos `supplier.*`

**Historia:** Como proveedor, quiero una extranet con mis datos y permisos según mi función, para gestionar mi relación con la agencia.

**Especificación:** 06 §2, §3.1, §5 SUP-BR-01, §6, §7; H-08

**Tablas:** `iam_users` (provider_id, provider_role)

**Endpoints:** `GET /api/v1/supplier/me`, `GET /api/v1/supplier/dashboard`, `POST /api/v1/catalog/providers/{id}/users`

**Pantallas:** `app/(extranet-proveedor)/layout.tsx`, `/proveedor`

**Criterios de aceptación:**

1. Layout `app/(extranet-proveedor)` con navegación Solicitudes · Rooming · Vouchers · Pagos · Incidencias · Mi contrato y 4 KPIs.
2. Permisos `supplier.*` asignados por `provider_role` (admin, reservas, recepcion, contabilidad); MVP: un admin por proveedor.
3. `SupplierScope` global + Policy: el proveedor sale del token; internos → 403 en `/supplier/*`, proveedor → 403 en `/ops/*`.
4. Canal Reverb `tenant.{t}.supplier.{providerId}` refresca KPIs.

**Pruebas:** Pest S-12; Pest S-02.

**Depende de:** F0 IAM; F1 proveedores · **Prioridad:** P1

#### F2-EXT-02 · Vistas de lectura con lista blanca de columnas

**Historia:** Como agencia, quiero que la extranet solo exponga lo necesario, para no revelar precios de venta ni datos del cliente.

**Especificación:** 06 §3.5, SUP-BR-02/03

**Tablas:** `supplier_v_requests`, `supplier_v_rooming`, `supplier_v_vouchers`, `supplier_v_payables`, `supplier_v_incidents`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Vistas SQL con `holder_label` y solo columnas permitidas; nunca `unit_price`, margen, contacto del cliente ni documentos de pasajeros.
2. Servicios de reservas en `borrador` excluidos.

**Pruebas:** Pest S-03: JSON sin campos sensibles.

**Depende de:** F2-EXT-01 · **Prioridad:** P1

#### F2-EXT-03 · Responder solicitudes: confirmar, rechazar o proponer alternativa

**Historia:** Como proveedor, quiero confirmar, rechazar o proponer una alternativa a cada solicitud, para responder sin correos.

**Especificación:** 06 §3.2, §4.1, SUP-BR-04–10, §6

**Tablas:** `supplier_request_responses`

**Endpoints:** `GET /api/v1/supplier/requests`, `GET /api/v1/supplier/requests/{serviceId}`, `POST /api/v1/supplier/requests/{serviceId}/confirm`, `POST /api/v1/supplier/requests/{serviceId}/reject`, `POST /api/v1/supplier/requests/{serviceId}/alternative`

**Pantallas:** `/proveedor/solicitudes`

**Criterios de aceptación:**

1. Confirmar exige código ≥ 4 (mayúsculas); rechazar exige motivo de lista cerrada + detalle; alternativa exige tipo + detalle y solo servicios activos del propio proveedor.
2. Solo solicitudes `pendiente/solicitado`; ya respondida → 409; ajena → 403/404.
3. Eventos `SupplierConfirmed/Rejected/AlternativeProposed` notifican al coordinador y desbloquean el voucher (RT-11).

**Pruebas:** Pest S-01, S-04, S-05, S-06; Playwright SUP-E2E-01 (parte).

**Depende de:** F2-EXT-02; F1 `ops_supplier_requests` · **Prioridad:** P1

#### F2-EXT-04 · Bandeja interna de alternativas del proveedor

**Historia:** Como coordinador de operaciones, quiero aceptar o rechazar las alternativas del proveedor, para cerrar el servicio.

**Especificación:** 06 §6 contraparte, §12 #1

**Tablas:** —

**Endpoints:** `GET /api/v1/ops/supplier-responses`, `POST /api/v1/ops/supplier-responses/{id}/accept`, `POST /api/v1/ops/supplier-responses/{id}/reject`

**Pantallas:** `/operaciones/ordenes/[code]` (alternativas), bandeja de alternativas

**Criterios de aceptación:**

1. Operaciones ve alternativas `pendiente` en la orden 360 y en un listado; aceptar actualiza fecha/servicio/costo y confirma o reenvía; rechazar notifica al proveedor.
2. Job `ExpireSupplierAlternativeHolds` pasa a `expirada` las vencidas.
3. Supuesto / nota: Pantalla no existe en el prototipo; supuesto por defecto de 06 §12 #1.

**Pruebas:** Pest: aceptar actualiza el servicio; Pest: job expira alternativas.

**Depende de:** F2-EXT-03 · **Prioridad:** P1

#### F2-EXT-05 · Rooming del lado del hotel

**Historia:** Como hotel, quiero acusar recibo, confirmar habitaciones y reportar observaciones de la rooming list, para evitar errores al check-in.

**Especificación:** 06 §4.2, SUP-BR-20–22, §6

**Tablas:** —

**Endpoints:** `GET /api/v1/supplier/rooming-lists`, `POST /api/v1/supplier/rooming-lists/{id}/acknowledge`, `POST /api/v1/supplier/rooming-lists/{id}/confirm`, `POST /api/v1/supplier/rooming-rooms/{id}/observations`

**Pantallas:** `/proveedor/rooming`

**Criterios de aceptación:**

1. Acuse y confirmación registran `hotel_ack_*` / `hotel_confirmed_*`; confirmar deja pendientes las habitaciones observadas.
2. Observación exige motivo, impacto y propuesta; crea incidencia `source=extranet` asignada al coordinador.
3. Al reenviar una lista `modificada` se reinician acuse y confirmación (supuesto 06 §12 #8).

**Pruebas:** Pest S-07; Playwright SUP-E2E-02.

**Depende de:** F2-EXT-02; F1 rooming · **Prioridad:** P1

#### F2-EXT-06 · Validación de vouchers en recepción

**Historia:** Como recepcionista del proveedor, quiero validar un voucher por su código, para registrar que el pasajero usó el servicio.

**Especificación:** 06 §4.3, SUP-BR-30–33

**Tablas:** —

**Endpoints:** `GET /api/v1/supplier/vouchers`, `POST /api/v1/supplier/vouchers/redeem`

**Pantallas:** `/proveedor/vouchers`

**Criterios de aceptación:**

1. Código inexistente o de otro proveedor → 404; anulado → 409; utilizado → 409 con fecha de uso previa.
2. Fecha futura requiere `confirm_future=true`; canje con `Idempotency-Key` + `lock_version`, `used_via=extranet`; evento `VoucherRedeemed`.
3. Supuesto / nota: 06 §12 #7 propone permitir solo el día del servicio o el anterior: parametrizar y confirmar con negocio.

**Pruebas:** Pest S-08 (incluye doble canje concurrente).

**Depende de:** F2-EXT-02 · **Prioridad:** P1

#### F2-EXT-07 · Pagos del proveedor y carga de su factura

**Historia:** Como proveedor, quiero ver lo que me debe la agencia y subir mi factura, para cobrar a tiempo.

**Especificación:** 06 §3.3, §4.4, SUP-BR-40–44, §6; H-20

**Tablas:** `supplier_invoices`

**Endpoints:** `GET /api/v1/supplier/payables`, `POST /api/v1/supplier/payables/{id}/invoices`, `POST /api/v1/fin/supplier-invoices/{id}/validate`, `POST /api/v1/fin/supplier-invoices/{id}/observe`, `POST /api/v1/fin/supplier-invoices/{id}/reject`

**Pantallas:** `/proveedor/pagos`; Finanzas › CxP (factura del proveedor)

**Criterios de aceptación:**

1. Número `^[A-Z0-9]{4}-\d{1,8}$`, fecha y archivo PDF/XML/ZIP obligatorios; una factura activa por CxP (índice parcial).
2. Importe distinto del saldo se acepta con `amount_difference` y aviso a Finanzas.
3. Saldos por moneda del contrato sin conversión (corrige H-20); Finanzas valida/observa/rechaza.
4. Job `ProcessSupplierInvoice` valida XML UBL (RUC emisor = proveedor, receptor = tenant) y guarda hash.
5. Supuesto / nota: Validación contra SUNAT/OSE diferida (06 §12 #9).

**Pruebas:** Pest S-09; Playwright SUP-E2E-03.

**Depende de:** F2-EXT-02; F1 CxP · **Prioridad:** P1

#### F2-EXT-08 · Incidencias reportadas por el proveedor

**Historia:** Como proveedor, quiero reportar y seguir incidencias de mis servicios, para coordinar soluciones con la agencia.

**Especificación:** 06 §4.5, SUP-BR-50–53; H-07

**Tablas:** —

**Endpoints:** `GET /api/v1/supplier/incidents`, `GET /api/v1/supplier/incidents/{id}`, `POST /api/v1/supplier/incidents`, `POST /api/v1/supplier/incidents/{id}/comments`

**Pantallas:** `/proveedor/incidencias`

**Criterios de aceptación:**

1. Solo servicios del proveedor no cancelados con fecha ≥ hoy − 7 días; tipos Proveedor, Horario, Capacidad, Pasajero, Otro.
2. Crítica emite `IncidentCreated` con severidad crítica: alerta a gerencia push + WhatsApp igual que en back-office (H-07).
3. Comentarios solo en abiertas/en proceso; autores internos anonimizados.

**Pruebas:** Pest S-11; Pest: crítica desde extranet alerta al Manager.

**Depende de:** F2-EXT-02 · **Prioridad:** P1

#### F2-EXT-09 · Contrato, tarifas y solicitud de actualización de tarifa

**Historia:** Como proveedor, quiero consultar mi contrato y pedir actualización de tarifas, para mantener precios vigentes.

**Especificación:** 06 §3.4, §4.6, SUP-BR-60–63; 10 §4.3 `provider_rate`

**Tablas:** `supplier_rate_requests`

**Endpoints:** `GET /api/v1/supplier/contract`, `GET /api/v1/supplier/rates`, `GET /api/v1/supplier/rate-requests`, `POST /api/v1/supplier/rate-requests`, `POST /api/v1/supplier/rate-requests/{id}/withdraw`, `GET /api/v1/catalog/rate-requests`, `POST /api/v1/catalog/rate-requests/{id}/approve`, `POST /api/v1/catalog/rate-requests/{id}/reject`

**Pantallas:** `/proveedor/contrato`; Catálogo › Proveedores (solicitudes de tarifa)

**Criterios de aceptación:**

1. Alerta de contrato < 60 días; tarifas sin IGV en moneda del contrato.
2. Solicitud con importe > 0 y vigencia ≥ hoy + 30 días; una pendiente por servicio.
3. Genera solicitud de aprobación `provider_rate`; aprobar crea nueva vigencia en `catalog_service_rates`; reservas confirmadas conservan su tarifa.

**Pruebas:** Pest S-10; E2E-AP-04.

**Depende de:** F2-EXT-02, F2-APR-03 · **Prioridad:** P1

#### F2-EXT-10 · Recordatorios y alertas de la extranet

**Historia:** Como coordinador, quiero recordatorios automáticos a proveedores que no responden, para no bloquear vouchers.

**Especificación:** 06 §8 jobs

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. `RemindPendingSupplierRequests` cada 2 h (sin respuesta > 24 h o servicio ≤ 48 h) y `ProviderContractExpiryAlerts` diario.
2. Destinatarios por permiso y coordinador de la orden, nunca IDs fijos (06 §11 #13).

**Pruebas:** Pest: recordatorio no se duplica en la misma ventana.

**Depende de:** F2-EXT-03 · **Prioridad:** P2

#### F2-EXT-11 · Pruebas de aceptación de la extranet

**Historia:** Como responsable técnico, quiero las pruebas de la extranet automatizadas, para abrirla a proveedores con seguridad.

**Especificación:** 06 §10

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Pest S-01…S-12 y Playwright SUP-E2E-01…04 (incluye 400 px) en verde.

**Pruebas:** Pest S-01…S-12; Playwright SUP-E2E-01…04.

**Depende de:** F2-EXT-09 · **Prioridad:** P1

### E2.5 · Sitio público, checkout, pagos y CMS

Fuente: 15 completa (salvo reseñas v2.2); 08 §3.6–3.11, §5.2–5.3, §6.3–6.4.

#### F2-WEB-01 · Aplicación del sitio público multi-tenant e idioma

**Historia:** Como visitante, quiero un sitio rápido de la agencia en mi idioma, para conocer su oferta.

**Especificación:** 15 §2, §11.1, §11.5, §11.6

**Tablas:** —

**Endpoints:** `GET /api/v1/public/site`

**Pantallas:** Layout `app/(sitio)/[locale]`, cabecera, pie, banner de cookies

**Criterios de aceptación:**

1. Grupo `app/(sitio)/[locale]` con middleware que resuelve tenant por host (`tenants.domain` o subdominio) y locale es/en (next-intl).
2. Cabecera/pie con datos del tenant (razón social, RUC, sedes, horarios, WhatsApp, TC del día, enlace al Libro de Reclamaciones).
3. CSP estricta, cookies Secure/HttpOnly, banner de cookies granular, Turnstile/reCAPTCHA en formularios.
4. BFF con Route Handlers y clave de servicio del tenant; token de carrito en cookie HttpOnly.
5. Supuesto / nota: D-09 (idiomas y monedas) abierta.

**Pruebas:** Pest 1 (parte): host de B no ve productos de A.

**Depende de:** F0 shell Next.js · **Prioridad:** P0

#### F2-WEB-02 · Contenido de producto y destino para el sitio

**Historia:** Como editor de catálogo, quiero cargar fotos, traducciones y contenido de destinos, para que el sitio muestre fichas completas.

**Especificación:** 15 §3.11

**Tablas:** `catalog_product_media`, `catalog_product_translations`, `catalog_destination_contents`, `catalog_products` (difficulty, guide_languages, pickup_text, rating_avg, rating_count)

**Endpoints:** —

**Pantallas:** Catálogo › Producto (galería, traducciones); Catálogo › Destinos (contenido)

**Criterios de aceptación:**

1. Galería con mínimo 3 imágenes para publicar; traducciones por locale con slug único; contenido de destinos (clima, altitud, FAQ).
2. Formularios de edición en la ficha de producto y destino del back-office (permisos de catálogo).
3. `rating_*` queda en 0 hasta Fase 3 (reseñas propias).
4. Supuesto / nota: Supuesto: la edición vive en Catálogo; Fase 1 no la incluía.

**Pruebas:** Pest: publicar con < 3 imágenes → 422.

**Depende de:** F1 catálogo · **Prioridad:** P0

#### F2-WEB-03 · Gestión del canal e-commerce: publicación y promociones

**Historia:** Como responsable de e-commerce, quiero publicar productos y crear promociones, para controlar qué se vende en línea y a qué precio.

**Especificación:** 08 §3.9, §5.2 ECO-BR-01/15, §6.3

**Tablas:** `catalog_product_promotions`

**Endpoints:** `GET /api/v1/channels/ecommerce/summary`, `GET /api/v1/channels/ecommerce/products`, `POST /api/v1/channels/ecommerce/products/{id}/publish`, `POST /api/v1/channels/ecommerce/products/{id}/unpublish`, `GET /api/v1/channels/ecommerce/promotions`, `POST /api/v1/catalog/products/{id}/promotions`, `POST /api/v1/catalog/promotions/{id}/activate`, `POST /api/v1/catalog/promotions/{id}/deactivate`

**Pantallas:** `(backoffice)/canales/ecommerce/gestion`

**Criterios de aceptación:**

1. Publicar solo productos ACTIVE con tarifa vigente (422 ECO-BR-01); publicar/despublicar invalida caché e ISR.
2. Promoción: % 1–50, vigencia, código único en mayúsculas (con código → «Descuento %», sin código → «Descuento por cantidad»).
3. Pantalla `(backoffice)/canales/ecommerce/gestion` con KPIs, pedidos, productos y promociones.

**Pruebas:** Pest T11; Pest: código duplicado → 422.

**Depende de:** F2-WEB-02 · **Prioridad:** P0

#### F2-WEB-04 · Home, destinos, listados y búsqueda

**Historia:** Como visitante, quiero buscar y filtrar tours y paquetes, para encontrar lo que me interesa.

**Especificación:** 15 §2, §6.1, SIT-BR-01/03, §8.2 RefreshCatalogReadModels

**Tablas:** —

**Endpoints:** `GET /api/v1/public/destinations`, `GET /api/v1/public/destinations/{slug}`, `GET /api/v1/public/products`, `GET /api/v1/public/departures/guaranteed`, `GET /api/v1/public/offers`

**Pantallas:** `/`, `/destinos`, `/destinos/[slug]`, `/tours`, `/paquetes`, `/experiencias`, `/buscar`, `/ofertas`

**Criterios de aceptación:**

1. Home con buscador, destacados, ofertas con cuenta regresiva y salidas garantizadas; ISR según 15 §11.1.
2. Listado con filtros (destino, tipo, fecha, pax, duración, precio, dificultad, idioma) y paginación por cursor; `from_price` y precio tachado desde read model.
3. Job `RefreshCatalogReadModels` al cambiar tarifas/salidas/promos y cada 15 min; `revalidateTag` por producto/destino.
4. La API pública nunca serializa `cost`, `markup` ni margen.

**Pruebas:** Pest 1, 3, 16.

**Depende de:** F2-WEB-01, F2-WEB-03 · **Prioridad:** P0

#### F2-WEB-05 · Ficha de producto con calendario de precios y disponibilidad

**Historia:** Como visitante, quiero ver la ficha con calendario de precios y disponibilidad, para elegir fecha y viajeros.

**Especificación:** 15 §2, §6.1, §6.6, SIT-BR-02/04/05; 16 §4.1

**Tablas:** —

**Endpoints:** `GET /api/v1/public/products/{slug}`, `GET /api/v1/public/products/{slug}/calendar`, `GET /api/v1/public/products/{slug}/departures`, `POST /api/v1/public/availability`, `POST /api/v1/public/price-quote`

**Pantallas:** `/tours/[slug]`

**Criterios de aceptación:**

1. Contenido SSG/ISR; precio, calendario y cupos siempre en vivo (no-store/SWR ≤ 60 s).
2. Calendario con estados por día del `BookingEngine` y precio por fecha con factor de temporada (SIT-BR-02).
3. Panel de reserva con pasajeros por tipo y edades del producto; errores de `validatePax` bloquean continuar.
4. JSON-LD `TouristTrip` + `Product` + `BreadcrumbList`.
5. Supuesto / nota: `/public/price-quote` (15 §6.2) y `/public/quote` (15 §6.6, 16 §6.1) se solapan: usar `/public/quote` del motor y dejar `price-quote` como alias deprecado (registrar en §11).

**Pruebas:** Pest 2 (precio por fecha y temporada).

**Depende de:** F2-WEB-04, F2-MOT-09 · **Prioridad:** P0

#### F2-WEB-06 · Carrito persistente con bloqueo de cupos

**Historia:** Como comprador, quiero un carrito que me reserve los cupos por un tiempo, para completar la compra sin perder la salida.

**Especificación:** 15 §3.1–3.2, §4.1, §4.3, SIT-BR-06/08, §6.2; H-14

**Tablas:** `channel_web_carts`, `channel_web_cart_items`

**Endpoints:** `POST /api/v1/public/carts`, `GET /api/v1/public/carts/current`, `POST /api/v1/public/carts/current/items`, `PATCH /api/v1/public/carts/current/items/{line}`, `DELETE /api/v1/public/carts/current/items/{line}`, `POST /api/v1/public/carts/current/items/{line}/hold`, `PUT /api/v1/public/carts/current/promo`, `DELETE /api/v1/public/carts/current/promo`, `PUT /api/v1/public/carts/current/preferences`, `PATCH /api/v1/public/carts/current/items/{line}/removed-lines`

**Pantallas:** `/carrito`

**Criterios de aceptación:**

1. Añadir línea crea hold (`reference_type='cart'`) con `Cache::lock` + `FOR UPDATE`; sin cupos → 409 RT-4.
2. Temporizador visible; el job común `ExpireAvailabilityHolds` de F1A-CAT-26 (H-14) se extiende a holds de carrito, pasa a correr cada minuto (15 §8.2) y emite `CartHoldExpired` por socket.
3. Código promo a nivel de carrito sin acumular (gana el mayor por línea); quitar/restaurar líneas removibles solo si R-PREVIEW-REMOVE.

**Pruebas:** Pest 4 (dos carritos por los últimos cupos); Pest 5; Pest 6; Pest v2.1 RemovedLineTest.

**Depende de:** F2-WEB-05; F1A-CAT-26 · **Prioridad:** P0

#### F2-WEB-07 · Checkout: pedido, reservas por línea y cuentas por cobrar

**Historia:** Como comprador, quiero completar mis datos y los de mis acompañantes, para generar mi pedido y mis reservas.

**Especificación:** 15 §3.3–3.5, §3.14, §4.2, SIT-BR-07/09/13/14/15, §6.3, §6.6; D-14

**Tablas:** `channel_ecom_orders`, `channel_ecom_order_lines`, `channel_ecom_passengers`

**Endpoints:** `POST /api/v1/public/checkout/validate`, `POST /api/v1/public/checkout/orders`

**Pantallas:** `/checkout`

**Criterios de aceptación:**

1. Pasos Comprador → Pasajeros/Acompañantes → Recojo y comentarios → Pago según reglas activas; validación por paso sin crear nada.
2. `POST /checkout/orders` en una transacción: cliente (reutiliza por email), pedido, líneas, pasajeros, **una reserva por línea** (D-14, `reservation_ids`), servicios, CxC con `kind` según modalidad; `Idempotency-Key` + locks de salidas + `lock_version` del carrito.
3. Recotiza con `BookingEngine::quote`; total distinto → 409 `QUOTE_CHANGED`; hold vencido sin cupos → 409 SIT-BR-07.
4. Datos fiscales (DNI/RUC) validados (SIT-BR-13); consentimientos obligatorios versionados (SIT-BR-15).

**Pruebas:** Pest 7, 8, 11; Pest v2.1 QuoteParityTest, CompanionAgeTest.

**Depende de:** F2-WEB-06, F2-MOT-10; F1 reservas y CxC · **Prioridad:** P0

#### F2-WEB-08 · Pasarela de pagos: adaptador, 3-D Secure y webhook

**Historia:** Como comprador, quiero pagar con tarjeta de forma segura, para confirmar mi viaje al instante.

**Especificación:** 15 §6.3, SIT-BR-16; 08 §3.8, ECO-BR-12/13/16; D-02

**Tablas:** `channel_ecom_payment_attempts`

**Endpoints:** `POST /api/v1/public/orders/{code}/payment-session`, `POST /api/v1/public/orders/{code}/payments`, `POST /api/v1/webhooks/payments/{provider}`

**Pantallas:** `/checkout` (paso Pago)

**Criterios de aceptación:**

1. Adaptador real del proveedor elegido sobre la interfaz `PaymentGateway` creada en F1B-POR-04 (que ya tiene driver sandbox); nunca PAN/CVV en backend (solo últimos 4 y token).
2. Rechazo: pedido `pago_rechazado`, hold vivo, reintento permitido. Aprobado: pago `aplicado`, CxC pagada, reserva confirmada y vouchers si procede (SIT-BR-18).
3. Webhook con firma HMAC, idempotente por `gateway_txn_id`, efectos vía outbox; contracargo registrado.
4. Supuesto / nota: Bloqueado para producción por D-02 (pasarela, Yape/Plin, liquidación).

**Pruebas:** Pest 9; Pest T13, T14 (08); Playwright P03.

**Depende de:** F2-WEB-07; F1B-POR-04 · **Prioridad:** P0

#### F2-WEB-09 · Pagos por transferencia, Yape o Plin por validar

**Historia:** Como comprador, quiero pagar por transferencia o Yape, para usar el medio que prefiero.

**Especificación:** 15 SIT-BR-17, §8.2 ExpireUnvalidatedTransfers

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Exige código de operación; pago `pendiente`, cupos consumidos, reserva `pendiente_pago`, sin vouchers hasta aplicar.
2. Aviso `pago.por_validar` a Finanzas; job alerta a las 4 h hábiles y cancela/libera a las 24 h (supuesto 15 §12 #2).

**Pruebas:** Pest 10.

**Depende de:** F2-WEB-08 · **Prioridad:** P1

#### F2-WEB-10 · Confirmación y «gestionar mi reserva»

**Historia:** Como comprador, quiero ver la confirmación y volver a consultar mi reserva, para tener mis vouchers a mano.

**Especificación:** 15 SIT-BR-18/19, §6.3

**Tablas:** —

**Endpoints:** `GET /api/v1/public/orders/{code}`, `GET /api/v1/public/orders/{code}/vouchers/{id}.pdf`, `POST /api/v1/public/orders/lookup`

**Pantallas:** `/confirmacion/[code]`, `/cuenta/mi-reserva`

**Criterios de aceptación:**

1. Acceso con token del pedido, sesión del cliente dueño o email + código exactos (rate limit 5/min/IP, auditado).
2. Vouchers solo con servicios confirmados y todas las CxC del pedido pagadas; nunca costos ni datos de terceros.

**Pruebas:** Pest: lookup con email incorrecto → 404 sin filtrar existencia.

**Depende de:** F2-WEB-08 · **Prioridad:** P0

#### F2-WEB-11 · Expiración y anulación de pedidos web

**Historia:** Como responsable de e-commerce, quiero que los pedidos sin pago expiren y poder anularlos, para liberar cupos.

**Especificación:** 08 §4.2, ECO-BR-11/14, §6.3; 15 §8.2

**Tablas:** —

**Endpoints:** `GET /api/v1/channels/ecommerce/orders`, `GET /api/v1/channels/ecommerce/orders/{code}`, `POST /api/v1/channels/ecommerce/orders/{code}/payment-link`, `POST /api/v1/channels/ecommerce/orders/{code}/cancel`

**Pantallas:** `(backoffice)/canales/ecommerce/gestion` (Pedidos web)

**Criterios de aceptación:**

1. Job `ExpireEcomOrders` (5 min): pedidos sin pago con hold vencido → `expirado`, libera cupos, cancela reservas y CxC.
2. Anular solo `pago_pendiente/pago_rechazado` con motivo; enlace de pago solo en esos estados.

**Pruebas:** Pest T15, T16 (08).

**Depende de:** F2-WEB-07 · **Prioridad:** P1

#### F2-WEB-12 · Cuenta del cliente en el sitio

**Historia:** Como cliente, quiero una cuenta en el sitio con mis reservas, pagos y favoritos, para gestionar mis viajes.

**Especificación:** 15 §3.7, §3.10, SIT-BR-20/21, §6.5

**Tablas:** `channel_wishlist_items`, `iam_users` (created_via, email_verified_at)

**Endpoints:** `POST /api/v1/public/auth/register`, `POST /api/v1/public/auth/login`, `POST /api/v1/public/auth/logout`, `POST /api/v1/public/auth/password/forgot`, `POST /api/v1/public/auth/email/verify`, `GET /api/v1/public/me`, `PATCH /api/v1/public/me`, `GET /api/v1/public/me/reservations`, `GET /api/v1/public/me/reservations/{code}`, `GET /api/v1/public/me/vouchers`, `GET /api/v1/public/me/receivables`, `POST /api/v1/public/me/receivables/{id}/payments`, `GET /api/v1/public/me/wishlist`, `PUT /api/v1/public/me/wishlist/{product}`, `DELETE /api/v1/public/me/wishlist/{product}`, `POST /api/v1/public/me/arco-requests`

**Pantallas:** `/cuenta/ingresar`, `/cuenta/registro`, `/cuenta/reservas`, `/cuenta/vouchers`, `/cuenta/pagos`, `/cuenta/deseos`, `/cuenta/datos`

**Criterios de aceptación:**

1. Registro vincula al `crm_clients` existente por email; hash Argon2id y verificación de email.
2. Mis reservas, vouchers, pagos pendientes (descuenta pagos por validar) y pago de saldo con tarjeta (Idempotency-Key).
3. Lista de deseos local para anónimos que se fusiona al iniciar sesión; solicitud ARCO registrada.

**Pruebas:** Pest 12; Playwright E2E-SIT-04.

**Depende de:** F2-WEB-08 · **Prioridad:** P1

#### F2-WEB-13 · Captación: viaje a medida, contacto, chat web y newsletter

**Historia:** Como visitante, quiero pedir un viaje a medida, contactar, chatear o suscribirme, para recibir atención comercial.

**Especificación:** 15 §3.9, SIT-BR-22–25, §6.4

**Tablas:** `crm_leads` (web_request, matched_client_id, sla_due_at)

**Endpoints:** `POST /api/v1/public/leads`, `POST /api/v1/public/contact`, `POST /api/v1/public/chat/sessions`, `POST /api/v1/public/chat/sessions/{id}/messages`, `POST /api/v1/public/newsletter`, `GET /api/v1/public/newsletter/confirm/{token}`, `POST /api/v1/public/newsletter/unsubscribe`

**Pantallas:** `/viajes-a-medida`, `/contacto`, chat flotante, pie (newsletter)

**Criterios de aceptación:**

1. Lead web sin asignar con `sla_due_at` y detección de duplicados; contacto → conversación canal Formulario (+ lead si «cotizar»).
2. Chat web por Reverb (`private-webchat.{session}`) con respuesta automática que no cuenta para el SLA.
3. Newsletter con doble opt-in y consentimiento explícito versionado.
4. Supuesto / nota: Supuesto: suscriptores y consentimientos (`mkt_*`) son de Fase 3 (spec 14); aquí se crea el mínimo `ConsentService` + tabla de consentimientos que Fase 3 extiende.

**Pruebas:** Pest 13, 15; Playwright E2E-SIT-03.

**Depende de:** F2-INB-02; F1 CRM leads · **Prioridad:** P1

#### F2-WEB-14 · Libro de Reclamaciones público en el sitio

**Historia:** Como consumidor, quiero registrar una hoja de reclamación desde el sitio, para ejercer mi derecho legal.

**Especificación:** 15 SIT-BR-26, §6.4; 12 §6

**Tablas:** —

**Endpoints:** `POST /api/v1/public/claims`

**Pantallas:** `/libro-reclamaciones`

**Criterios de aceptación:**

1. Formulario público con captcha que reutiliza el servicio de Fase 1 (correlativo por sede, plazo hábil, constancia).
2. Supuesto / nota: `/public/claims` (15) y `/public/{tenant}/claim-book` (12) son el mismo caso: exponer uno y documentar el alias.

**Pruebas:** Pest 14.

**Depende de:** F1 Libro de Reclamaciones · **Prioridad:** P1

#### F2-WEB-15 · CMS editorial y consumo en el sitio

**Historia:** Como redactor o editor, quiero preparar, revisar y publicar contenidos, para mantener el sitio y los portales actualizados.

**Especificación:** 08 §3.10–3.11, §4.3, §5.3 CMS-BR-01–07, §6.4; 15 §3.12; H-19

**Tablas:** `cms_contents`, `cms_content_events`

**Endpoints:** `GET /api/v1/cms/contents`, `POST /api/v1/cms/contents`, `GET /api/v1/cms/contents/{id}`, `PATCH /api/v1/cms/contents/{id}`, `POST /api/v1/cms/contents/{id}/submit`, `POST /api/v1/cms/contents/{id}/return`, `POST /api/v1/cms/contents/{id}/approve`, `POST /api/v1/cms/contents/{id}/publish`, `POST /api/v1/cms/contents/{id}/unpublish`, `POST /api/v1/cms/contents/{id}/preview`, `GET /api/v1/public/cms/contents/{slug}`, `GET /api/v1/public/cms/placements/{placement}`, `GET /api/v1/public/posts`, `GET /api/v1/public/posts/{slug}`, `GET /api/v1/public/pages/{slug}`

**Pantallas:** `(backoffice)/canales/cms`, `(backoffice)/canales/cms/[id]`; `/blog`, `/blog/[slug]`, `/legal/[slug]`

**Criterios de aceptación:**

1. Flujo borrador → en_revision → aprobado → publicado → despublicado con bitácora; `channels.cms.edit` para redactar (H-19) y `channels.cms.publish` para aprobar/publicar.
2. Publicar exige SEO title ≤ 60 y meta ≤ 160; slug único; devolver/despublicar con motivo.
3. Blog, legales y banner por `placement` en el sitio; publicar invalida caché y dispara revalidación.
4. Supuesto / nota: Fase 1 no incluye CMS; `placement` y `valid_from/valid_to` son columnas agregadas por 08 §3.10.

**Pruebas:** Pest T17 (08); Playwright P04.

**Depende de:** F2-WEB-01 · **Prioridad:** P1

#### F2-WEB-16 · Analítica del embudo web

**Historia:** Como responsable de e-commerce, quiero medir el embudo de compra con consentimiento, para mejorar la conversión.

**Especificación:** 15 §3.8, §8.4, §6.4 analytics

**Tablas:** `channel_web_events`, `channel_web_funnel_daily`

**Endpoints:** `POST /api/v1/public/analytics/events`

**Pantallas:** —

**Criterios de aceptación:**

1. Eventos GA4 solo con consentimiento analítico; tabla particionada por mes, retención 13 meses.
2. Job `AggregateWebFunnel` alimenta el embudo del panel e-commerce (reemplaza datos simulados).

**Pruebas:** Pest: sin consentimiento → evento descartado.

**Depende de:** F2-WEB-01 · **Prioridad:** P2

#### F2-WEB-17 · SEO técnico y rendimiento del sitio

**Historia:** Como responsable de marketing, quiero que el sitio sea encontrable y rápido, para atraer tráfico orgánico.

**Especificación:** 15 §11.2–11.4

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Sitemaps por idioma con `hreflang`, robots, JSON-LD por tipo de página, `document.title`/meta por ruta.
2. Core Web Vitals p75 móvil: LCP < 2,5 s, INP < 200 ms, CLS < 0,1; Lighthouse ≥ 90 en home, listado y ficha.

**Pruebas:** Playwright E2E-SIT-05, E2E-SIT-06.

**Depende de:** F2-WEB-05 · **Prioridad:** P1

#### F2-WEB-18 · Recordatorios de saldo y carritos abandonados

**Historia:** Como responsable de e-commerce, quiero recordar saldos y carritos abandonados, para recuperar ventas.

**Especificación:** 15 §8.2 RemindBalanceDue, AbandonedCartRecovery

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Saldo que vence en 7 y 2 días → email + plantilla WhatsApp.
2. Carrito activo 24 h con email y consentimiento de marketing → un recordatorio.
3. Supuesto / nota: 15 §12 #14 pendiente (base legal).

**Pruebas:** Pest: sin consentimiento no se envía recuperación.

**Depende de:** F2-WEB-07, F2-WEB-13 · **Prioridad:** P2

#### F2-WEB-19 · Pruebas de aceptación del sitio

**Historia:** Como responsable técnico, quiero las pruebas del sitio automatizadas, para publicar cambios sin romper la venta.

**Especificación:** 15 §10; 08 §10 P03

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Pest 1–16 y v2.1 en verde; Playwright E2E-SIT-01…09 y P03 en verde a 400 y 1440 px sin errores de consola.

**Pruebas:** Pest 1–16; E2E-SIT-01…09; P03.

**Depende de:** F2-WEB-12 · **Prioridad:** P1

### E2.6 · Facturación electrónica OSE, conciliación y cierre de periodo

Fuente: 07 §1.1, §3.13–3.19, §4.6–4.8, §5.7–5.9, §6.6–6.8.

#### F2-FIS-01 · Series de comprobantes y numeración sin huecos

**Historia:** Como contador, quiero series y correlativos sin huecos, para cumplir con SUNAT.

**Especificación:** 07 §3.13, FIN-BR-46; H-06

**Tablas:** `fin_document_series`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Series por tipo (`01`, `03`, `07`, `08`) y opcionalmente por sede; NC con serie propia `FC01`/`BC01` según el comprobante que modifica.
2. Correlativo con `SELECT … FOR UPDATE` en la transacción de emisión.

**Pruebas:** Pest T17: numeración concurrente sin duplicados ni huecos.

**Depende de:** F0-34 · **Prioridad:** P0

#### F2-FIS-02 · Modelo de comprobante electrónico y bitácora fiscal

**Historia:** Como desarrollador, quiero el modelo de comprobante y su bitácora fiscal, para trazar cada envío al OSE.

**Especificación:** 07 §3.14–3.16, §4.6

**Tablas:** `fin_invoices`, `fin_invoice_lines`, `fin_fiscal_events`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Estados `pendiente_envio, emitido, aceptado, observado, rechazado, anulado` con CHECK; sin `deleted_at`.
2. Líneas con afectación IGV (`10` gravado / `40` exportación); `ref_invoice_id` obligatorio en NC/ND (CHECK).

**Pruebas:** Pest: NC sin referencia rechazada por constraint.

**Depende de:** F2-FIS-01 · **Prioridad:** P0

#### F2-FIS-03 · Validación fiscal y emisión de factura y boleta

**Historia:** Como contador, quiero validar y emitir facturas y boletas desde las cuentas por cobrar, para facturar lo cobrado.

**Especificación:** 07 §5.7 FIN-BR-39–45/48/50, §6.6; H-01, H-09

**Tablas:** —

**Endpoints:** `GET /api/v1/invoices`, `GET /api/v1/invoices/summary`, `GET /api/v1/invoices/{number}`, `GET /api/v1/receivables/{code}/invoice-draft`, `POST /api/v1/invoices/validate`, `POST /api/v1/invoices`

**Pantallas:** `/finanzas/facturacion`, panel de Contabilidad

**Criterios de aceptación:**

1. Factura requiere RUC válido; boleta DNI/pasaporte/CE; RUC en boleta → error; importe ≤ máximo facturable de la CxC.
2. Un único `TaxService` para reservas directas, conversión y e-commerce (H-09); reglas de exportación parametrizadas por tipo de servicio, no por país del cliente (H-01).
3. Periodo cerrado bloquea la emisión con fecha del periodo (FIN-BR-48); respuesta `202` con `pendiente_envio`/`emitido`.
4. Pantallas de Facturación y panel de Contabilidad; Manager solo lectura.
5. Supuesto / nota: H-01 y D-01/P-01 bloquean las reglas de exportación: validar con contador antes de programar.

**Pruebas:** Pest T16; Pest T20 (parte); Pest T02 (Contabilidad emite 202).

**Depende de:** F2-FIS-02; F1 CxC · **Prioridad:** P0

#### F2-FIS-04 · Adaptador OSE/PSE con outbox, reintentos y consulta de estado

**Historia:** Como contador, quiero que los comprobantes se envíen al OSE con reintentos, para no perder emisiones por fallas externas.

**Especificación:** 07 §1.1, §8 SendInvoiceToFiscalProvider/PollFiscalStatus, FIN-BR-49, §6.6 webhook

**Tablas:** —

**Endpoints:** `POST /api/v1/invoices/{number}/status-check`, `POST /api/v1/integrations/fiscal/{provider}/webhook`

**Pantallas:** —

**Criterios de aceptación:**

1. Interfaz `FiscalProvider` (Regla transversal 20) con modo simulado por tenant y un adaptador real; genera UBL 2.1 según el modelo OSE o PSE elegido.
2. Emisión persiste, encola en `sys_outbox` y `SendInvoiceToFiscalProvider` (tries 5, backoff, ShouldBeUnique por comprobante) registra cada intento en `fin_fiscal_events`.
3. Fallo externo no revierte la emisión interna; fallo definitivo alerta a Contabilidad (PROC-065).
4. `PollFiscalStatus` y webhook (idempotente por ticket) actualizan a aceptado/observado/rechazado y guardan XML y CDR en `sys_documents`.
5. Supuesto / nota: D-01/P-02: proveedor OSE/PSE, contrato y ambiente de pruebas pendientes; homologación en F2-CIE-02.

**Pruebas:** Pest T18.

**Depende de:** F2-FIS-03 · **Prioridad:** P0

#### F2-FIS-05 · PDF con QR, reenvío de observados y entrega al cliente

**Historia:** Como contador, quiero el PDF del comprobante y entregarlo al cliente, para cerrar la venta.

**Especificación:** 07 §4.6, FIN-BR-47, §6.6

**Tablas:** —

**Endpoints:** `POST /api/v1/invoices/{number}/resend`, `POST /api/v1/invoices/{number}/deliver`, `GET /api/v1/invoices/{number}/pdf`, `GET /api/v1/invoices/{number}/xml`, `GET /api/v1/invoices/{number}/cdr`

**Pantallas:** `/finanzas/facturacion/[number]`

**Criterios de aceptación:**

1. `GenerateInvoicePdf` (cola documents) con monto en letras y QR del hash.
2. Solo se entregan comprobantes `aceptado`; entrega por email y portal del cliente (`comprobante.emitido`).
3. Reenvío de observados según lo que confirme el OSE (P-03): por defecto observado → NC + nuevo comprobante; rechazado → nuevo número.

**Pruebas:** Pest: entregar no aceptado → 422; Playwright FIN-E2E-B.

**Depende de:** F2-FIS-04 · **Prioridad:** P0

#### F2-FIS-06 · Notas de crédito con motivo SUNAT y tope acumulado

**Historia:** Como contador, quiero emitir notas de crédito correctas, para anular o ajustar ventas ante SUNAT.

**Especificación:** 07 FIN-BR-41, P-04, P-10; H-06; 04 cancelación

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. NC solo sobre comprobante aceptado del mismo cliente, motivo Catálogo 09 y suma de NC ≤ original.
2. La cancelación de reservas y el efecto `cancel` de aprobaciones usan este servicio (serie FC01/BC01, pasa por OSE).
3. Supuesto / nota: Corrige H-06/P-10.

**Pruebas:** Pest T16 (NC); Playwright E2E-09.

**Depende de:** F2-FIS-04 · **Prioridad:** P0

#### F2-FIS-07 · Comprobante para ventas web y B2B

**Historia:** Como contador, quiero que las ventas web tengan su comprobante con los datos del checkout, para no digitarlos otra vez.

**Especificación:** 15 §1 PROC-050, SIT-BR-13; 07 FIN-BR-44

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Al aplicar el pago de un pedido web se prepara el comprobante con los datos fiscales capturados en el checkout; emisión automática o por Finanzas según configuración del tenant.
2. Supuesto / nota: Supuesto: modo de emisión (automático vs manual) configurable; confirmar con negocio.

**Pruebas:** Pest: pago web aplicado genera borrador de comprobante.

**Depende de:** F2-FIS-03, F2-WEB-08 · **Prioridad:** P1

#### F2-FIS-08 · Comunicación de baja detrás de bandera

**Historia:** Como contador, quiero tener preparada la comunicación de baja, para activarla cuando el OSE la valide.

**Especificación:** 07 §6.6 void (futuro, por validar)

**Tablas:** —

**Endpoints:** `POST /api/v1/invoices/{number}/void`

**Pantallas:** —

**Criterios de aceptación:**

1. Endpoint implementado detrás de feature flag desactivado hasta validar el procedimiento con el OSE.

**Pruebas:** Pest: flag apagado → 403.

**Depende de:** F2-FIS-04 · **Prioridad:** P2

#### F2-FIS-09 · Conciliación bancaria: importación, matching, resolución y cierre

**Historia:** Como analista de finanzas, quiero conciliar los extractos bancarios con pagos y cuentas por pagar, para asegurar que el dinero registrado existe.

**Especificación:** 07 §3.17, §4.7, §5.8 FIN-BR-51–55, §6.7, P-14, P-15

**Tablas:** `fin_bank_statements`, `fin_bank_lines`, `fin_reconciliation_closures`

**Endpoints:** `GET /api/v1/bank-lines`, `POST /api/v1/bank-statements`, `POST /api/v1/reconciliation/matching`, `POST /api/v1/bank-lines/{code}/confirm`, `POST /api/v1/bank-lines/{code}/reject`, `POST /api/v1/bank-lines/{code}/resolve`, `GET /api/v1/reconciliation/closures`, `POST /api/v1/reconciliation/closures`

**Pantallas:** `/finanzas/conciliacion`

**Criterios de aceptación:**

1. Importación multipart → `NormalizeBankStatement` con parser por banco (CSV/TXT/XLSX).
2. Matching ±0,50 PEN con prioridad por referencia/RUC; pagos revertidos no son candidatos; confirmar pago `pendiente → confirmado`, CxP con payout `cargo_bancario`.
3. Excepciones con sustento; cierre por cuenta bancaria y periodo solo sin líneas abiertas; líneas cerradas inmutables.
4. Todas las acciones exigen `finance.payments.register` + permiso del recurso (FIN-BR-59).
5. Supuesto / nota: P-15: layouts reales de BCP/Interbank/BBVA pendientes.

**Pruebas:** Pest T19; Playwright FIN-E2E-A, FIN-E2E-D.

**Depende de:** F1 pagos y CxP · **Prioridad:** P1

#### F2-FIS-10 · Cierre contable de periodo

**Historia:** Como contador, quiero cerrar el periodo contable con controles, para que no se emitan documentos en meses cerrados.

**Especificación:** 07 §3.18, §4.8, §5.9 FIN-BR-56–58, §6.8, P-13

**Tablas:** `fin_period_closes`, `fin_period_close_checks`

**Endpoints:** `GET /api/v1/dashboards/accounting`, `GET /api/v1/period-closes/{period}`, `PUT /api/v1/period-closes/{period}/checks/{check}`, `DELETE /api/v1/period-closes/{period}/checks/{check}`, `POST /api/v1/period-closes/{period}/close`

**Pantallas:** Panel de Contabilidad › Cierre de periodo

**Criterios de aceptación:**

1. 7 controles (automáticos filtrados por periodo, P-13) y 3 manuales (`fx, aging, igv`) marcados solo con periodo abierto.
2. Cerrar exige todos OK, bloquea emisión en el periodo y notifica `contabilidad.cierre`; sin reapertura.
3. Supuesto / nota: Supuesto: el cierre de periodo entra en Fase 2 porque depende de facturación y conciliación.

**Pruebas:** Pest T20.

**Depende de:** F2-FIS-03, F2-FIS-09 · **Prioridad:** P1

#### F2-FIS-11 · Pruebas de aceptación fiscales

**Historia:** Como responsable técnico, quiero las pruebas fiscales automatizadas, para cambiar el módulo sin riesgo tributario.

**Especificación:** 07 §10

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Pest T16–T20 y Playwright E2E-09, FIN-E2E-B, FIN-E2E-D en verde con el adaptador simulado.

**Pruebas:** Pest T16–T20; E2E-09; FIN-E2E-B; FIN-E2E-D.

**Depende de:** F2-FIS-10 · **Prioridad:** P1

### E2.7 · Motor de reservas completo, centro de reglas, widget/CMS, mensajes al pasajero y monedas

Fuente: 16 completa; 17 §3.1–3.6, §3.8 (sin reseñas externas).

#### F2-MOT-01 · Administración del centro de reglas: edición, plantillas de negocio y reglas personalizadas

**Historia:** Como administrador del tenant, quiero activar, desactivar y parametrizar las reglas de reserva, para adaptar el motor a mi negocio.

**Especificación:** 17 §3.1, §3.3, CR-01/03/04, §6; 16 §3.1

**Tablas:** `sys_booking_rules` (is_custom, depends_on, min_plan, lock_version), `sys_rule_templates`

**Endpoints:** `GET /api/v1/admin/booking-rules`, `PATCH /api/v1/admin/booking-rules/{code}`, `POST /api/v1/admin/booking-rules`, `DELETE /api/v1/admin/booking-rules/{code}`, `POST /api/v1/admin/booking-rules/apply-template`, `POST /api/v1/admin/booking-rules/reset`, `GET /api/v1/admin/booking-rules/audit`

**Pantallas:** —

**Criterios de aceptación:**

1. Migración que alinea `sys_booking_rules` (creada en F1A-MOT-01 con la plantilla de plataforma y `RuleResolver`) con 17 §3.1: `is_custom`, `depends_on`, `min_plan`, `lock_version`, índice GIN en `scope`.
2. `PATCH` valida `params` contra `params_schema` y las validaciones cruzadas CR-01; `BookingRuleChanged` invalida `rules:{tenant}:v{ver}` y, si afecta comunicaciones, reprograma mensajes.
3. Plantillas por tipo de negocio solo cambian `enabled` de reglas estándar; reglas personalizadas nacen inactivas y son banderas consultables.
4. Toda edición con `If-Match`, auditada antes/después.
5. Supuesto / nota: 16 §3.1 y 17 §3.1 difieren en nombres (`rule_key/group_name/is_system` vs `code/rule_group/is_custom`); F1A usó 16 y aquí se agregan las columnas de 17 sin renombrar (alias en el modelo). `min_plan` se crea pero `plan_allows()` devuelve verdadero hasta Fase 3 (planes × reglas). Restablecer copia desde `platform_booking_rule_templates` (F1A).

**Pruebas:** Pest 17 §10 #3 (CR-01); Pest 17 §10 #1 (aislamiento); Pest 17 §10 #2 (RBAC).

**Depende de:** F1A-MOT-01 · **Prioridad:** P0

#### F2-MOT-02 · Excepciones de reglas por producto

**Historia:** Como responsable de producto, quiero excepciones de reglas por producto, para tratar casos especiales sin cambiar todo el tenant.

**Especificación:** 16 §3.2, CAT-RL-01–03; 17 §3.2, CR-02

**Tablas:** `catalog_product_rule_overrides`

**Endpoints:** `GET /api/v1/catalog/products/{id}/rule-overrides`, `PUT /api/v1/catalog/products/{id}/rule-overrides/{code}`, `DELETE /api/v1/catalog/products/{id}/rule-overrides/{code}`

**Pantallas:** `/catalogo/productos/[code]/reservas/reglas`

**Criterios de aceptación:**

1. Solo reglas con `product_override=true` (422 CAT-RL-01, trigger en BD); un override nunca activa una regla apagada en el tenant.
2. Parámetros propios con el mismo esquema; valores iguales al tenant no se guardan.
3. Pestaña `…/reservas/reglas` del producto.
4. Supuesto / nota: Permiso: 16 §6.2 dice `update`, 17 §6 dice `admin.settings.manage`; se usa `catalog.products.update` para el producto y `admin.settings.manage` para el tenant (confirmar).

**Pruebas:** Pest 16 §10.2 overrides; Pest 17 §10 #4.

**Depende de:** F2-MOT-01 · **Prioridad:** P1

#### F2-MOT-03 · Pantalla del centro de reglas con simulador

**Historia:** Como administrador, quiero simular el efecto de las reglas antes de publicarlas, para evitar errores de precio.

**Especificación:** 17 §2 `/admin/reglas`, §6 simulate

**Tablas:** —

**Endpoints:** `POST /api/v1/admin/booking-rules/simulate`

**Pantallas:** `/admin/reglas`

**Criterios de aceptación:**

1. Interruptores, parámetros, excepciones por producto, plantillas, reglas personalizadas e historial.
2. Simulador `{product, selection}` → `dayStatus`, `quote` y estado de reglas sin persistir.
3. Supuesto / nota: Vista previa por plan (v2.2) queda para Fase 3.

**Pruebas:** Playwright E2E-R1.

**Depende de:** F2-MOT-01 · **Prioridad:** P1

#### F2-MOT-04 · Adicionales por producto

**Historia:** Como responsable de producto, quiero ofrecer adicionales como museos o entradas, para aumentar el ticket promedio.

**Especificación:** 16 §3.5, CAT-AD-01–03, §8.1 paso 8

**Tablas:** `catalog_product_addons`

**Endpoints:** `GET /api/v1/catalog/products/{id}/addons`, `POST /api/v1/catalog/products/{id}/addons`, `PATCH /api/v1/catalog/products/{id}/addons/{addonId}`, `DELETE /api/v1/catalog/products/{id}/addons/{addonId}`

**Pantallas:** `/catalogo/productos/[code]/reservas/adicionales`

**Criterios de aceptación:**

1. CRUD con nombre único por producto, precio ≥ 0, aplica a ≥ 1 tipo de pasajero, moneda activa; servicio vinculado debe ser del proveedor.
2. `quote` suma adicionales solo si R-ADDONS; soft delete no altera reservas (snapshot).

**Pruebas:** Pest 16 §10.2 override R-ADDONS.

**Depende de:** F2-MOT-01 · **Prioridad:** P0

#### F2-MOT-05 · Alojamiento opcional por tramos (ciudades, hoteles, habitaciones)

**Historia:** Como responsable de producto, quiero configurar alojamiento opcional por ciudad, para vender circuitos con o sin hotel.

**Especificación:** 16 §3.6, CAT-LG-01–03, §8.1 pasos 9–10

**Tablas:** `catalog_accommodation_legs`, `catalog_accommodation_hotels`, `catalog_accommodation_room_types`, `catalog_products` (accommodation_*)

**Endpoints:** `PUT /api/v1/catalog/products/{id}/accommodation`, `POST /api/v1/catalog/products/{id}/accommodation/legs`, `PATCH /api/v1/catalog/products/{id}/accommodation/legs/{legId}`, `DELETE /api/v1/catalog/products/{id}/accommodation/legs/{legId}`, `POST /api/v1/catalog/products/{id}/accommodation/legs/reorder`, `POST /api/v1/catalog/products/{id}/accommodation/legs/{legId}/hotels`, `PATCH /api/v1/catalog/products/{id}/accommodation/legs/{legId}/hotels/{hotelId}`, `DELETE /api/v1/catalog/products/{id}/accommodation/legs/{legId}/hotels/{hotelId}`

**Pantallas:** `/catalogo/productos/[code]/reservas/alojamiento`

**Criterios de aceptación:**

1. Tramos 1–30 noches con orden; hoteles con tipos de habitación (capacidad 1–8, precio por noche > 0).
2. `quote` calcula habitaciones × noches por tramo no removido, suplemento simple (R-SINGLE-SUPP) y advertencia de capacidad (R-LODGING-CAPACITY).
3. Advertencia si Σ noches ≠ duración del producto.

**Pruebas:** Pest 16 §10.2: PRD-011 4 tramos → rooms=4, nights=9, US$ 585; Pest: 3 ADT en 1 doble → warning.

**Depende de:** F2-MOT-01 · **Prioridad:** P0

#### F2-MOT-06 · Política de pago: total, adelanto, pagar después y recargo

**Historia:** Como responsable de producto, quiero definir pago total, adelanto o pagar después, para ajustar el cobro a cada producto.

**Especificación:** 16 §3.7, CAT-PY-01/02, §8.1 pasos 13–15, §8.2 ReleasePayLaterHolds

**Tablas:** `catalog_payment_policies`

**Endpoints:** `GET /api/v1/catalog/products/{id}/payment-policy`, `PUT /api/v1/catalog/products/{id}/payment-policy`

**Pantallas:** `/catalogo/productos/[code]/reservas/pago`

**Criterios de aceptación:**

1. Modalidades por producto; `pagar_despues` lo gobierna R-PAY-LATER + override; `adelanto` se quita si R-DEPOSIT está apagada.
2. Saldo con vencimiento pasado se cobra hoy con advertencia; recargo R-PAY-FEE sobre el total.
3. Job `ReleasePayLaterHolds` libera bloqueos de pagar después vencidos.
4. Supuesto / nota: R-PAY-FEE requiere validación legal antes de activarse (17 §12 #5).

**Pruebas:** Pest 16 §10.2: adelanto 30 % saldo vencido → hoy + warning; Pest: R-DEPOSIT apagada → sin adelanto.

**Depende de:** F2-MOT-01 · **Prioridad:** P1

#### F2-MOT-07 · Puntos de recojo y datos del cliente para Operaciones

**Historia:** Como coordinador de operaciones, quiero recibir el punto de recojo, vuelo y comentarios del cliente, para operar sin llamar al cliente.

**Especificación:** 16 §3.8, CAT-PK-01; 05 §2.3, §3.14b, §6.9

**Tablas:** `catalog_pickup_points`

**Endpoints:** `GET /api/v1/catalog/products/{id}/pickup`, `PUT /api/v1/catalog/products/{id}/pickup`, `POST /api/v1/operations/rooming/prefill`

**Pantallas:** `/catalogo/productos/[code]/reservas/recojo`; `/operaciones/ordenes/[code]`; `/operaciones/rooming/[reservationCode]`

**Criterios de aceptación:**

1. Recojo obligatorio exige ≥ 1 punto; pedir vuelo configurable; Operaciones puede editar con `manage_availability`.
2. Orden 360, voucher y app operador muestran recojo, vuelo, comentarios y etiquetas del cliente (dato histórico rotulado si la regla se apagó, D-13).
3. Prellenado de rooming por ciudad desde `booking.lodging` (idempotente, único por tramo) usando las columnas `leg_id`, `city`, `hotel_name`, `source` que F1B-OPS-01 dejó creadas; infantes no ocupan capacidad.

**Pruebas:** Pest: prefill dos veces no duplica listas; Pest: rooming excluye INF de la capacidad.

**Depende de:** F2-MOT-10; F1B-OPS-07 · **Prioridad:** P1

#### F2-MOT-08 · Ajustes de precio configurables y quitar ítems en la previsualización

**Historia:** Como responsable comercial, quiero descuentos por grupo, anticipación y última hora configurables, para aplicar la política sin tocar código.

**Especificación:** 16 §8.1 pasos 11–13; 17 §5 R-GROUP-DISC/EARLY-BIRD/LAST-MINUTE/PROMO/PREVIEW-REMOVE

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Ajustes calculados sobre el mismo subtotal (no en cascada) según reglas activas y sus parámetros.
2. `removed[]` solo afecta líneas `removable` si R-PREVIEW-REMOVE está activa; líneas base → 422.

**Pruebas:** Pest 17 §10 #5 (regla de oro).

**Depende de:** F2-MOT-04, F2-MOT-05 · **Prioridad:** P0

#### F2-MOT-09 · API pública del motor con clave publicable, caché y locks

**Historia:** Como integrador del sitio o widget, quiero una API pública del motor rápida y segura, para cotizar y reservar en línea.

**Especificación:** 16 §6.1, §8.3, §8.4; 17 WG-02/03, §6

**Tablas:** —

**Endpoints:** `GET /api/v1/public/products/{id}/availability`, `POST /api/v1/public/quote`, `POST /api/v1/public/bookings`, `GET /api/v1/public/booking-rules`, `GET /api/v1/public/currencies`

**Pantallas:** —

**Criterios de aceptación:**

1. Autenticación por `X-KipuControl-Key` (publishable key) + Origin verificado + rate limit Redis.
2. Caché mensual `avail:{tenant}:{product}:{yyyy-mm}:v{ver}` con invalidación por INCR de versión y `ETag`.
3. Confirmación con `Cache::lock` por fecha (orden ascendente), `FOR UPDATE`, recálculo sin caché; 409 `AVAIL_CHANGED` o `QUOTE_CHANGED`; `Idempotency-Key`.

**Pruebas:** Pest 16 §10.1 (casos PRD-011, sobreventa concurrente); Pest 16 §10.2 idempotencia y caché.

**Depende de:** F2-MOT-08, F2-MOT-14 · **Prioridad:** P0

#### F2-MOT-10 · Snapshot completo del motor en la reserva

**Historia:** Como auditor, quiero que cada reserva guarde cómo se calculó, para explicar su precio aunque cambie la configuración.

**Especificación:** 16 §3.9; 15 §3.14

**Tablas:** `booking_reservations` (booking jsonb), `booking_lodging_rooms`, `booking_addons`, `booking_passengers` (relationship, age, …), `fin_receivables` (kind)

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. La reserva guarda `booking` con líneas, ajustes, alojamiento, adicionales, recojo, pago, `rulesApplied` y `fx_rate`; tablas normalizadas para alojamiento y adicionales.
2. Cambios posteriores de configuración no alteran reservas existentes.
3. Supuesto / nota: Coordinar con el dueño de la spec 04 (columnas en `booking_*`).

**Pruebas:** Pest: cambiar precio de un adicional no cambia la reserva.

**Depende de:** F2-MOT-08 · **Prioridad:** P0

#### F2-MOT-11 · Widget embebible e integración con cualquier CMS

**Historia:** Como agencia con web propia, quiero incrustar el motor en cualquier CMS, para vender desde mi sitio actual.

**Especificación:** 17 §2 integracion-web y widget, §3.8, §4 (dominio, traspaso), WG-01–03, §6

**Tablas:** `channel_widget_config`, `channel_widget_domains`, `channel_widget_handoffs`

**Endpoints:** `GET /api/v1/channels/widget`, `PUT /api/v1/channels/widget`, `POST /api/v1/channels/widget/rotate-key`, `GET /api/v1/channels/widget/domains`, `POST /api/v1/channels/widget/domains`, `DELETE /api/v1/channels/widget/domains/{id}`, `POST /api/v1/channels/widget/domains/{id}/verify`, `POST /api/v1/public/widget-handoffs`

**Pantallas:** `/canales/integracion-web`, `/widget/[code]`

**Criterios de aceptación:**

1. Web Component + iframe + shortcode WordPress + uso headless; ruta pública `/widget/[code]` con calendario, pasajeros, alojamiento, adicionales y resumen.
2. Solo dominios verificados por DNS TXT reciben CORS y `frame-ancestors` (job `VerifyWidgetDomain`); rotación de clave con 24 h de gracia.
3. Traspaso al checkout del sitio (`widget-handoffs` → `checkout_url`), TTL 24 h con `ExpireWidgetHandoffs`; eventos `kipucontrol:*` por postMessage a orígenes verificados.
4. Configurador `/canales/integracion-web` genera el código a copiar.
5. Supuesto / nota: Widget de reseñas (17) queda para Fase 3.

**Pruebas:** Pest 17 §10 #10; Playwright E2E-W1, E2E-W2.

**Depende de:** F2-MOT-09, F2-WEB-06 · **Prioridad:** P1

#### F2-MOT-12 · Plantillas de mensajes al pasajero

**Historia:** Como administrador, quiero plantillas de mensajes al pasajero por evento, canal e idioma, para comunicar sin redactar cada vez.

**Especificación:** 17 §3.4, MSG-01, §6

**Tablas:** `notif_pax_message_templates`

**Endpoints:** `GET /api/v1/notifications/pax-templates`, `POST /api/v1/notifications/pax-templates`, `PATCH /api/v1/notifications/pax-templates/{id}`, `DELETE /api/v1/notifications/pax-templates/{id}`, `POST /api/v1/notifications/pax-templates/{id}/preview`, `POST /api/v1/notifications/pax-templates/{id}/test`

**Pantallas:** `/admin/comunicaciones` (Plantillas)

**Criterios de aceptación:**

1. Evento, desfase (−720…720 h), canales, idioma, condiciones y nombre de plantilla WhatsApp aprobada; variables solo de la lista.
2. Vista previa con una reserva real y envío de prueba; eliminar solo sin historial.
3. Pantalla `/admin/comunicaciones` (pestaña Plantillas).

**Pruebas:** Pest 17 §10 #7 (MSG-01).

**Depende de:** F0 notificaciones · **Prioridad:** P1

#### F2-MOT-13 · Programación, envío y acuses de mensajes al pasajero

**Historia:** Como coordinador, quiero que los mensajes se programen y envíen solos con acuse, para informar al pasajero en el momento correcto.

**Especificación:** 17 §3.5, §4 Mensaje, MSG-02/03, §8

**Tablas:** `notif_pax_messages`

**Endpoints:** `GET /api/v1/notifications/pax-messages`, `POST /api/v1/reservations/{id}/pax-messages`, `POST /api/v1/notifications/pax-messages/{id}/send-now`, `POST /api/v1/notifications/pax-messages/{id}/cancel`, `POST /api/v1/notifications/pax-messages/{id}/retry`, `POST /api/v1/notifications/pax-messages/reschedule`, `POST /api/v1/webhooks/providers/{provider}`

**Pantallas:** `/admin/comunicaciones` (Programados, Historial)

**Criterios de aceptación:**

1. `SchedulePaxMessages` (cada 15 min y tras eventos) hace upsert de programados por reserva × plantilla × canal sin duplicar (índice único) y retira pendientes si R-PAX-MESSAGES se apaga.
2. `DispatchDuePaxMessages` (cada minuto) envía por email/WhatsApp/portal/push con tries 5 y backoff; webhooks SES/WhatsApp/FCM actualizan entregado/leído/fallido.
3. Envío manual solo `operations.assign` o `admin.settings.manage`; idioma EN si el cliente no es de Perú (supuesto 17 §12 #2).
4. Supuesto / nota: D-03 (WhatsApp Business y dominio de correo) abierta.

**Pruebas:** Pest 17 §10 #6 (MSG-02); Playwright E2E-M1.

**Depende de:** F2-MOT-12, F2-INB-03 · **Prioridad:** P1

#### F2-MOT-14 · Monedas, tipos de cambio y proveedor de TC

**Historia:** Como administrador financiero, quiero gestionar monedas y tipos de cambio con historial, para mostrar y cobrar en varias monedas.

**Especificación:** 17 §3.6, FX-01–04; 07 §3.19; H-12

**Tablas:** `fin_currencies`, `fin_fx_rates`, `fx_rate_providers`

**Endpoints:** `GET /api/v1/finance/currencies`, `PATCH /api/v1/finance/currencies/{code}`, `GET /api/v1/finance/currencies/{code}/rates`, `POST /api/v1/finance/currencies/refresh`, `GET /api/v1/finance/fx-rates`, `GET /api/v1/finance/fx-providers`, `PATCH /api/v1/finance/fx-settings`, `POST /api/v1/finance/fx-providers/{code}/test`, `GET /api/v1/finance/currencies/convert`

**Pantallas:** `/admin/monedas`

**Criterios de aceptación:**

1. Moneda base siempre activa y de cobro; moneda de cobro debe estar activa; historial append-only con un valor por día.
2. `FxConverter` aplica `TC × (1 − margen)` al mostrar; los documentos conservan su `fx_rate` (H-12).
3. Job `RefreshFxRates` diario por tenant con alerta si la variación supera `fx_alert_pct`; pantalla `/admin/monedas` rotulada DEMO hasta D-12.
4. Finanzas solo edita TC; activar/cobro/margen requieren `admin.settings.manage`.
5. Supuesto / nota: `fin_fx_rates` tiene dos definiciones (07 §3.19 buy/sell/source; 17 §3.6 rate_pen/previous_rate/provider_id). Se adopta 17 y se agregan `buy`/`sell` opcionales para Contabilidad. Fase 0 (F0-33) guarda el TC en `sys_fx_rates` (09 §3.9): migrar su historial a `fin_fx_rates` y dejar `sys_fx_rates` como vista de compatibilidad. Registrar en §11 de 07, 09 y 17.

**Pruebas:** Pest 17 §10 #8 (FX-01/02); Playwright E2E-F1.

**Depende de:** F0-33 · **Prioridad:** P0

#### F2-MOT-15 · Pruebas de aceptación del motor, reglas, widget, mensajes y monedas

**Historia:** Como responsable técnico, quiero las pruebas del motor y del centro de reglas automatizadas, para cambiar reglas sin regresiones.

**Especificación:** 16 §10; 17 §10

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Suite PRD-011 de 16 §10.1–10.2 y Pest 17 §10 #1–10 en verde; Playwright E2E-W1, W2, R1, M1, F1.
2. Supuesto / nota: 17 §10 #9 (reseñas) es de Fase 3.

**Pruebas:** 16 §10.1–10.2; 17 §10 #1–8, #10; E2E-W1/W2/R1/M1/F1.

**Depende de:** F2-MOT-13 · **Prioridad:** P1

### E2.8 · Bandeja de aprobaciones

Fuente: 10 §3.1–3.5, §4.1, §4.3, APR-BR, §6.

#### F2-APR-01 · Matriz de reglas de aprobación

**Historia:** Como administrador del tenant, quiero configurar quién aprueba qué y desde qué monto, para aplicar la política de control.

**Especificación:** 10 §3.1, APR-BR-01/02/14/15, §6, §11 valores por defecto

**Tablas:** `collab_approval_rules`

**Endpoints:** `GET /api/v1/approval-rules`, `POST /api/v1/approval-rules`, `PATCH /api/v1/approval-rules/{id}`, `DELETE /api/v1/approval-rules/{id}`, `POST /api/v1/approval-rules/reset`

**Pantallas:** `/aprobaciones/reglas`

**Criterios de aceptación:**

1. Semilla con los valores por defecto de 10 §11; nivel 1 de tipos de origen con permiso del módulo no editable.
2. Cada tipo conserva al menos una regla activa de nivel 1; DELETE solo nivel 2; umbrales en moneda base.
3. Supuesto / nota: D-04 (umbrales) abierta; valores leídos de configuración (H-21).

**Pruebas:** Pest 10 §10 #13.

**Depende de:** F0 IAM · **Prioridad:** P1

#### F2-APR-02 · Solicitudes de aprobación y enrutamiento desde los módulos

**Historia:** Como solicitante, quiero que mis excepciones generen una solicitud de aprobación automática, para no gestionarlas por fuera.

**Especificación:** 10 §3.2–3.5, §4.1, APR-BR-01/06/11, §8 listeners

**Tablas:** `collab_approval_requests`, `collab_approval_steps`, `collab_approval_info_requests`, `collab_approval_events`

**Endpoints:** `GET /api/v1/approvals`, `GET /api/v1/approvals/counters`, `GET /api/v1/approvals/{code}`, `POST /api/v1/approvals`

**Pantallas:** —

**Criterios de aceptación:**

1. `ApprovalRequestFactory::fromSubject()` escucha `QuoteApprovalRequested`, `QuoteVersionSaved`, `ReservationCancelRequested`, `PaymentReversalRequested`, `PayableRegistered`, `CommissionCalculated`, `SupplierRateRequested`.
2. Una solicitud viva por `dedupe_key`; `amount_base` con TC de la solicitud; `due_at` por SLA del nivel.
3. Solicitud genérica (`credit_b2b`, `refund`, `other`) con `Idempotency-Key`; listados por pestaña con alcance por rol en servidor.

**Pruebas:** Pest 10 §10 #1, #2.

**Depende de:** F2-APR-01; F1 cotizaciones, reservas, pagos, CxP, comisiones · **Prioridad:** P1

#### F2-APR-03 · Decisión por niveles y ejecución del efecto en el origen

**Historia:** Como aprobador, quiero aprobar o rechazar y que el efecto se aplique en el registro de origen, para cerrar la excepción en un paso.

**Especificación:** 10 §4.1, §4.3, APR-BR-03/04/05/08/09/12

**Tablas:** —

**Endpoints:** `POST /api/v1/approvals/{code}/approve`, `POST /api/v1/approvals/{code}/reject`, `POST /api/v1/approvals/{code}/resubmit`, `GET /api/v1/approvals/cancel-preview/{reservation}`

**Pantallas:** —

**Criterios de aceptación:**

1. Aprobar el último nivel ejecuta el efecto del tipo (§4.3) con los mismos servicios de dominio del módulo, en la misma transacción y con `lock_version` del origen; origen cambiado → 409.
2. Solicitante no aprueba lo suyo; un usuario no aprueba dos niveles (`UNIQUE (request_id, decided_by)`); descuento > tope requiere `quotes.discount_override`.
3. Resolución en el módulo de origen cierra la solicitud como `closed_in_origin`; CxP/comisión rechazadas quedan observadas y se reenvían en nueva ronda.
4. `Idempotency-Key` + `If-Match` en aprobar/rechazar.

**Pruebas:** Pest 10 §10 #3–#10, #12; Playwright E2E-AP-01, E2E-AP-02, E2E-AP-03.

**Depende de:** F2-APR-02, F2-FIS-06, F2-B2B-02 · **Prioridad:** P1

#### F2-APR-04 · Pedir información, delegar, retirar y SLA con escalamiento

**Historia:** Como aprobador, quiero pedir información, delegar y ver el SLA, para decidir a tiempo.

**Especificación:** 10 §4.1, APR-BR-10, §8 approvals:sla-check

**Tablas:** —

**Endpoints:** `POST /api/v1/approvals/{code}/info-requests`, `POST /api/v1/approvals/{code}/info-requests/{id}/answer`, `POST /api/v1/approvals/{code}/delegate`, `POST /api/v1/approvals/{code}/withdraw`

**Pantallas:** —

**Criterios de aceptación:**

1. Pedir información pausa el SLA y al responder extiende `due_at` por el tiempo en pausa.
2. Delegar solo a usuarios con el permiso del nivel; retirar marca el origen como anulado/retirado.
3. `approvals:sla-check` cada 5 min: aviso al 75 % y vencido con notificación al Manager.
4. Supuesto / nota: 10 §12 #1–2 (horas hábiles, reasignación automática) abiertos.

**Pruebas:** Pest 10 §10 #11.

**Depende de:** F2-APR-03 · **Prioridad:** P1

#### F2-APR-05 · Bandeja de aprobaciones en Next.js con contador en tiempo real

**Historia:** Como aprobador, quiero una bandeja única con contador en tiempo real, para ver todo lo pendiente.

**Especificación:** 10 §2, §7

**Tablas:** —

**Endpoints:** —

**Pantallas:** `/aprobaciones`, `/aprobaciones/[code]`

**Criterios de aceptación:**

1. `/aprobaciones` con KPIs, pestañas Para mí / Enviadas / Todas / Historial / Reglas y drawer de detalle con snapshot del origen.
2. Badge de menú alimentado por `/approvals/counters` y Reverb; margen y costos solo con permisos de rentabilidad.
3. Responsive 400 px sin scroll horizontal.

**Pruebas:** Playwright responsive `/aprobaciones`.

**Depende de:** F2-APR-03 · **Prioridad:** P1

### E2.9 · Inbox omnicanal

Fuente: 10 §3.6–3.11, §4.2, INB-BR, §6.

#### F2-INB-01 · Modelo del inbox omnicanal

**Historia:** Como desarrollador, quiero el modelo de conversaciones y mensajes, para centralizar la atención por todos los canales.

**Especificación:** 10 §3.6–3.11, §4.2

**Tablas:** `collab_conversations`, `collab_messages`, `collab_message_attachments`, `collab_reply_templates`, `collab_channel_accounts`, `collab_inbound_events`

**Endpoints:** `GET /api/v1/inbox/templates`, `POST /api/v1/inbox/templates`, `PATCH /api/v1/inbox/templates/{id}`

**Pantallas:** —

**Criterios de aceptación:**

1. Estados `abierta, pendiente, resuelta` con transiciones solo vía servicio; SLA por canal en `collab_channel_accounts`.
2. Plantillas con variables; escritura solo `admin.settings.manage`.

**Pruebas:** Pest: transición inválida → 409.

**Depende de:** F0 · **Prioridad:** P1

#### F2-INB-02 · Ingesta de canales: WhatsApp, email, formulario, chat web y tickets

**Historia:** Como asesor, quiero recibir en un solo lugar los mensajes de WhatsApp, email, formulario, chat y portales, para no perder consultas.

**Especificación:** 10 INB-BR-08/09, §6 integraciones, §8 ProcessInboundMessage

**Tablas:** —

**Endpoints:** `POST /api/v1/integrations/whatsapp/webhook`, `GET /api/v1/integrations/whatsapp/webhook`, `POST /api/v1/integrations/email/inbound`, `POST /api/v1/public/contact`

**Pantallas:** —

**Criterios de aceptación:**

1. Webhook WhatsApp con verify token y firma HMAC; entradas a `collab_inbound_events` y job idempotente por `external_message_id`.
2. Resuelve cliente por email/teléfono, crea o reabre conversación y emite `MessageReceived` por Reverb.
3. Tickets de portal (cliente/pasajero) se reflejan como conversación canal `portal`.
4. Supuesto / nota: `POST /public/contact` aparece en 10 y 15: un solo endpoint. D-03 abierta.

**Pruebas:** Pest 10 §10 #15, #19.

**Depende de:** F2-INB-01 · **Prioridad:** P1

#### F2-INB-03 · Respuesta y envío saliente por canal

**Historia:** Como asesor, quiero responder desde el inbox por el mismo canal del cliente, para mantener el historial completo.

**Especificación:** 10 INB-BR-02/10/11, §8 SendOutboundMessage, ProcessDeliveryStatus, ScanAttachment

**Tablas:** —

**Endpoints:** `POST /api/v1/inbox/conversations/{code}/messages`, `POST /api/v1/inbox/conversations/{code}/notes`, `POST /api/v1/inbox/attachments`

**Pantallas:** —

**Criterios de aceptación:**

1. Adaptadores `WhatsAppCloudAdapter`, `SmtpAdapter`, `PortalAdapter`; fuera de 24 h solo plantillas aprobadas (422 INB-BR-02).
2. Notas internas nunca se envían ni aparecen en portales; adjuntos ≤ 16 MB con antivirus antes de enviar.
3. Estados de entrega por webhook; «enviar y resolver».

**Pruebas:** Pest 10 §10 #16, #20.

**Depende de:** F2-INB-02 · **Prioridad:** P1

#### F2-INB-04 · Asignación, alcance por rol y SLA de primera respuesta

**Historia:** Como gerente, quiero asignación por alcance y alertas de primera respuesta, para cumplir tiempos de atención.

**Especificación:** 10 INB-BR-01/03/04, §8 inbox:first-response-sla

**Tablas:** —

**Endpoints:** `GET /api/v1/inbox/conversations`, `GET /api/v1/inbox/conversations/{code}`, `POST /api/v1/inbox/conversations/{code}/assign`, `POST /api/v1/inbox/conversations/{code}/resolve`, `POST /api/v1/inbox/conversations/{code}/reopen`, `PATCH /api/v1/inbox/conversations/{code}`

**Pantallas:** —

**Criterios de aceptación:**

1. Ventas ve asignadas + sin asignar y solo puede tomar; Operaciones ve asignadas + pasajeros en viaje; Manager/Admin todas.
2. Primera respuesta registra `first_response_at` y autoasigna; job cada minuto alerta próximas a vencer y vencidas.

**Pruebas:** Pest 10 §10 #14, #17.

**Depende de:** F2-INB-03 · **Prioridad:** P1

#### F2-INB-05 · Ficha CRM en la conversación: vincular, crear lead y actividad

**Historia:** Como asesor, quiero vincular la conversación al cliente y crear leads o actividades, para no perder oportunidades.

**Especificación:** 10 INB-BR-05/06/07, §6

**Tablas:** —

**Endpoints:** `POST /api/v1/inbox/conversations/{code}/link`, `POST /api/v1/inbox/conversations/{code}/lead`, `POST /api/v1/inbox/conversations/{code}/activities`

**Pantallas:** —

**Criterios de aceptación:**

1. Vincular solo a clientes dentro del alcance (Ventas: su cartera); lead con detección de duplicados PROC-004 y `conversation_id` de origen.
2. Actividad requiere lead o cliente vinculado; «crear cotización» navega a `/cotizaciones/nueva` y registra el evento.

**Pruebas:** Pest 10 §10 #18.

**Depende de:** F2-INB-04; F1 CRM · **Prioridad:** P1

#### F2-INB-06 · Pantalla del inbox en tres columnas con tiempo real

**Historia:** Como asesor, quiero una pantalla de inbox ágil en escritorio y móvil, para atender rápido.

**Especificación:** 10 §2, §7

**Tablas:** —

**Endpoints:** —

**Pantallas:** `/inbox`, `/inbox/[code]`

**Criterios de aceptación:**

1. `/inbox` y `/inbox/[code]`: lista con filtros, hilo con modo nota, plantillas y adjuntos, ficha a la derecha (drawer < 1180 px, una columna < 760 px).
2. Actualización en vivo por Reverb.

**Pruebas:** Playwright E2E-IB-01, E2E-IB-02; Responsive 400 px.

**Depende de:** F2-INB-04 · **Prioridad:** P1

#### F2-INB-07 · Pruebas de aceptación de aprobaciones e inbox

**Historia:** Como responsable técnico, quiero las pruebas de aprobaciones e inbox automatizadas, para operar la bandeja con confianza.

**Especificación:** 10 §10

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Pest 10 §10 #1–20 y Playwright E2E-AP-01…04, E2E-IB-01/02 en verde.

**Pruebas:** Pest 10 §10 #1–20; E2E-AP-01…04; E2E-IB-01/02.

**Depende de:** F2-APR-05, F2-INB-06 · **Prioridad:** P1

### E2.10 · Cupos (allotments) y documentos de viaje

Fuente: 11 completa.

#### F2-CUP-01 · Contratos de cupo con proveedores

**Historia:** Como coordinador de operaciones, quiero registrar contratos de cupo con proveedores, para controlar el inventario garantizado.

**Especificación:** 11 §3.1–3.2, §4.1, CUP-BR-001–003, §6

**Tablas:** `catalog_allotments`, `catalog_allotment_days`, `catalog_allotment_events`

**Endpoints:** `GET /api/v1/catalog/allotments`, `POST /api/v1/catalog/allotments`, `GET /api/v1/catalog/allotments/{id}`, `PATCH /api/v1/catalog/allotments/{id}`, `POST /api/v1/catalog/allotments/{id}/release`

**Pantallas:** —

**Criterios de aceptación:**

1. Contrato genera una fila por fecha; servicio del proveedor de tipo Alojamiento/Tren/Entrada; EXCLUDE impide contratos vigentes solapados (409).
2. Editar condiciones regenera días; liberar contrato exige motivo y notifica al proveedor.

**Pruebas:** Pest 11 §10 #1, #2, #4.

**Depende de:** F1 catálogo y proveedores · **Prioridad:** P1

#### F2-CUP-02 · Consumo derivado de las reservas

**Historia:** Como coordinador, quiero que las reservas consuman el cupo automáticamente, para saber cuánto queda sin cálculos manuales.

**Especificación:** 11 §3.3, CUP-BR-006/008, §8 ConsumeAllotmentOnServiceChange

**Tablas:** `catalog_allotment_consumptions`

**Endpoints:** `GET /api/v1/catalog/allotments/{id}/days/{date}`

**Pantallas:** —

**Criterios de aceptación:**

1. Servicio confirmado/en curso/completado consume `used_qty`; solicitado/pendiente suma `pending_qty`; cancelación revierte; lock `allot:{id}:{date}`.
2. Exceso marca sobreventa y deja el servicio *on request* (o 409 si el tenant activa modo estricto).
3. Supuesto / nota: Modo estricto de sobreventa por tenant (11 §12 #5) pendiente.

**Pruebas:** Pest 11 §10 #6.

**Depende de:** F2-CUP-01; F1 reservas · **Prioridad:** P1

#### F2-CUP-03 · Liberación, retención, penalidades y job de release

**Historia:** Como coordinador, quiero liberar o retener cupos antes del release y ver penalidades, para evitar cargos por no uso.

**Especificación:** 11 §3.5, CUP-BR-005/007/009/010, §8 ReleaseAllotments/ReleaseDueAlerts

**Tablas:** `catalog_allotment_charges`

**Endpoints:** `POST /api/v1/catalog/allotments/{id}/days/{date}/release`, `PUT /api/v1/catalog/allotments/{id}/days/{date}/retention`, `DELETE /api/v1/catalog/allotments/{id}/days/{date}/retention`, `GET /api/v1/catalog/allotments/{id}/charges`, `POST /api/v1/catalog/allotments/jobs/release`

**Pantallas:** —

**Criterios de aceptación:**

1. Solo se libera lo disponible; concurrencia protegida por lock (una 409).
2. Retener tras el release muestra la exposición a penalidad antes de confirmar.
3. `ReleaseAllotments` diario (ShouldBeUnique, `sys_job_runs`) libera, registra cargos y crea `fin_payables` con moneda y TC; segunda ejecución no duplica.

**Pruebas:** Pest 11 §10 #5, #7.

**Depende de:** F2-CUP-02; F1 CxP · **Prioridad:** P1

#### F2-CUP-04 · Ampliaciones de cupo

**Historia:** Como coordinador, quiero pedir ampliaciones de cupo al proveedor, para atender la demanda en temporada alta.

**Especificación:** 11 §3.4, §4.3, CUP-BR-004

**Tablas:** `catalog_allotment_requests`

**Endpoints:** `GET /api/v1/catalog/allotments/{id}/requests`, `POST /api/v1/catalog/allotments/{id}/requests`, `POST /api/v1/catalog/allotments/{id}/requests/{rid}/respond`

**Pantallas:** —

**Criterios de aceptación:**

1. Solicitud futura y dentro de la vigencia; aceptar suma `extra_qty` a cada fecha del rango; respuesta obligatoria.
2. Supuesto / nota: Respuesta desde la extranet queda como mejora (11 §12 #7).

**Pruebas:** Pest 11 §10 #8; Playwright E2E-CUP-02.

**Depende de:** F2-CUP-01 · **Prioridad:** P2

#### F2-CUP-05 · Grilla de cupos, detalle y pick-up report

**Historia:** Como coordinador, quiero una grilla de cupos y el ritmo de ventas, para decidir liberaciones y ampliaciones.

**Especificación:** 11 §2, §6 grid/pickup, §7

**Tablas:** —

**Endpoints:** `GET /api/v1/catalog/allotments/grid`, `GET /api/v1/catalog/allotments/pickup`

**Pantallas:** `/catalogo/cupos` (Grilla, Contratos, Release, Pick-up), `/catalogo/cupos/[code]`

**Criterios de aceptación:**

1. `/catalogo/cupos` con pestañas Grilla (14 días), Contratos, Release y Pick-up; detalle con calendario de 28 días, consumo, ampliaciones, penalidades e historial.
2. Finanzas en solo lectura con botones deshabilitados; Ventas 403; actualización por Reverb `tenant.{id}.ops`.

**Pruebas:** Playwright E2E-CUP-01, E2E-CUP-03.

**Depende de:** F2-CUP-03 · **Prioridad:** P1

#### F2-DOC-01 · Checklist documental por pasajero

**Historia:** Como coordinador, quiero un checklist documental por pasajero, para saber qué falta antes del viaje.

**Especificación:** 11 §3.7–3.10, §4.4, DOC-BR-003–007, §8 CreateTravelDocChecklist

**Tablas:** `ops_travel_doc_items`, `ops_travel_doc_contacts`, `ops_travel_doc_special`, `ops_travel_doc_reminders`

**Endpoints:** `GET /api/v1/ops/travel-docs`, `GET /api/v1/ops/travel-docs/passengers`, `GET /api/v1/reservations/{id}/travel-docs`, `GET /api/v1/settings/travel-docs`, `PUT /api/v1/settings/travel-docs`

**Pantallas:** —

**Criterios de aceptación:**

1. Ítems creados/ajustados al confirmar la reserva o cambiar pasajeros; aplicabilidad por nacionalidad, edad, categoría y destino.
2. `vencido` y `no_aplica` calculados; estado por pasajero y reserva = peor estado.
3. Configuración `travel_docs` en `sys_settings` (visas, meses de pasaporte, recordatorios).
4. Supuesto / nota: Listas de visa y reglas de menores son referenciales (D-07, 11 §12 #1–2).

**Pruebas:** Pest 11 §10 #1, #3.

**Depende de:** F1 reservas · **Prioridad:** P1

#### F2-DOC-02 · Carga, validación y observación de documentos

**Historia:** Como coordinador, quiero cargar, validar u observar documentos, para asegurar que el pasajero pueda viajar.

**Especificación:** 11 §4.4, DOC-BR-001/002/006/008/009/011/013, §6

**Tablas:** —

**Endpoints:** `POST /api/v1/reservations/{id}/travel-docs/{passengerId}/{type}/files`, `POST /api/v1/reservations/{id}/travel-docs/{passengerId}/{type}/validate`, `POST /api/v1/reservations/{id}/travel-docs/{passengerId}/{type}/observe`, `PUT /api/v1/reservations/{id}/travel-docs/{passengerId}/emergency-contact`, `PUT /api/v1/reservations/{id}/travel-docs/{passengerId}/special-attention`

**Pantallas:** —

**Criterios de aceptación:**

1. Archivos PDF/JPG/PNG ≤ 10 MB con antivirus y URL firmada de 10 min; carga desde portal cliente/pasajero entra como `recibido`.
2. Validar pasaporte exige vencimiento ≥ fin del viaje + 6 meses (extranjero); menor requiere autorización con archivo.
3. Atención especial sin términos clínicos (lista configurable).

**Pruebas:** Pest 11 §10 #9, #11.

**Depende de:** F2-DOC-01 · **Prioridad:** P1

#### F2-DOC-03 · Bloqueo de emisión de entradas nominativas (gate MAPI)

**Historia:** Como coordinador, quiero que no se emitan entradas nominativas sin documentos validados, para evitar entradas inválidas.

**Especificación:** 11 DOC-BR-010, §8 TravelDocsGate; 05 vouchers

**Tablas:** —

**Endpoints:** `GET /api/v1/reservations/{id}/travel-docs/gate`

**Pantallas:** —

**Criterios de aceptación:**

1. La emisión de vouchers/entradas MAPI consulta el gate y se bloquea si falta documento de identidad validado o autorización de menor.

**Pruebas:** Pest 11 §10 #10; Playwright E2E-DOC-01.

**Depende de:** F2-DOC-02 · **Prioridad:** P1

#### F2-DOC-04 · Recordatorios, solicitudes al cliente y tablero de documentos

**Historia:** Como asesor u operaciones, quiero recordatorios y solicitudes automáticas de documentos, para completar el checklist a tiempo.

**Especificación:** 11 §2, DOC-BR-012, §8 TravelDocReminders

**Tablas:** —

**Endpoints:** `POST /api/v1/reservations/{id}/travel-docs/requests`, `POST /api/v1/ops/travel-docs/jobs/reminders`

**Pantallas:** `/operaciones/documentos-viaje`, `/operaciones/documentos-viaje/[reservationCode]`

**Criterios de aceptación:**

1. `/operaciones/documentos-viaje` y detalle por reserva; Ventas solo reservas propias (owner=me forzado en servidor) y puede solicitar documentos.
2. Job diario de recordatorios según `reminder_days`, un envío automático por día (email + WhatsApp).

**Pruebas:** Pest 11 §10 #3, #12; Playwright E2E-DOC-02.

**Depende de:** F2-DOC-02 · **Prioridad:** P1

#### F2-CUP-06 · Pruebas de aceptación de cupos y documentos

**Historia:** Como responsable técnico, quiero las pruebas de cupos y documentos automatizadas, para operar la temporada sin errores.

**Especificación:** 11 §10

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Pest 11 §10 #1–12 y Playwright E2E-CUP-01…03, E2E-DOC-01/02 y 400 px en verde.

**Pruebas:** Pest 11 §10 #1–12; E2E-CUP-01…03; E2E-DOC-01/02.

**Depende de:** F2-CUP-05, F2-DOC-04 · **Prioridad:** P1

### E2.11 · Tesorería (caja y bancos)

Fuente: 12 §3.1–3.9, §4, TES-BR, §6 (sin Libro de Reclamaciones).

#### F2-TES-01 · Cuentas de tesorería y libro de movimientos

**Historia:** Como analista de finanzas, quiero ver saldos y movimientos por cuenta, para conocer la posición de caja y bancos.

**Especificación:** 12 §3.1–3.2, §3.9, TES-BR-01/02/17, §6

**Tablas:** `fin_treasury_accounts`, `fin_treasury_movements`, `fin_treasury_settings`

**Endpoints:** `GET /api/v1/treasury/accounts`, `GET /api/v1/treasury/accounts/{id}/movements`, `POST /api/v1/treasury/accounts`, `PATCH /api/v1/treasury/accounts/{id}`, `GET /api/v1/treasury/movements`

**Pantallas:** —

**Criterios de aceptación:**

1. Bancos PEN/USD, cajas chicas por sede y pasarela como cuenta de tránsito; saldo derivado del libro.
2. Sin fechas futuras ni sobregiro (lock `treasury:account:{id}` + `FOR UPDATE`); moneda y TC conservados.

**Pruebas:** Pest 12 §10 #1, #2.

**Depende de:** F1 finanzas · **Prioridad:** P1

#### F2-TES-02 · Sincronización idempotente con pagos y CxP

**Historia:** Como analista de finanzas, quiero que cobros y pagos se reflejen solos en tesorería, para no registrarlos dos veces.

**Especificación:** 12 TES-BR-03/04, §8 TreasurySyncListener

**Tablas:** —

**Endpoints:** `POST /api/v1/treasury/sync`

**Pantallas:** —

**Criterios de aceptación:**

1. Pago confirmado/aplicado → un ingreso por `source_key`; reversión → egreso; payout de CxP → egreso; crédito B2B no mueve caja.
2. Movimientos sincronizados no se editan ni anulan en tesorería.

**Pruebas:** Pest 12 §10 #3.

**Depende de:** F2-TES-01 · **Prioridad:** P1

#### F2-TES-03 · Movimientos manuales, transferencias y liquidación de pasarela

**Historia:** Como analista de finanzas, quiero registrar movimientos, transferencias y liquidaciones de pasarela, para mantener los saldos reales.

**Especificación:** 12 §3.4, §4 Movimiento, §6

**Tablas:** `fin_treasury_transfers`

**Endpoints:** `POST /api/v1/treasury/movements`, `POST /api/v1/treasury/movements/{id}/void`, `POST /api/v1/treasury/transfers`, `POST /api/v1/treasury/gateway/{account}/settlements`

**Pantallas:** —

**Criterios de aceptación:**

1. Transferencias con locks ordenados por id de cuenta; anular transferencia no puede dejar saldo negativo.
2. Liquidación de pasarela acredita el neto al banco y registra la comisión como gasto (Idempotency-Key por lote).

**Pruebas:** Pest 12 §10 #4.

**Depende de:** F2-TES-01 · **Prioridad:** P1

#### F2-TES-04 · Caja chica: sesiones y gastos con comprobante

**Historia:** Como analista de finanzas, quiero operar las cajas chicas con sesiones y comprobantes, para controlar el efectivo por sede.

**Especificación:** 12 §3.3, §3.5, TES-BR-05/06/07/11/12

**Tablas:** `fin_cash_sessions`, `fin_expense_receipts`

**Endpoints:** `POST /api/v1/treasury/petty-cash/{account}/sessions`, `POST /api/v1/treasury/petty-cash/{account}/expenses`

**Pantallas:** —

**Criterios de aceptación:**

1. Una sesión abierta por caja; apertura igual al último cierre; sin gastos con caja cerrada.
2. Tope por gasto (S/ 500), comprobante con serie/número y RUC; declaración jurada hasta S/ 150; comprobante único.
3. Supuesto / nota: Montos son parámetros iniciales (12 §12 #3).

**Pruebas:** Pest 12 §10 #5.

**Depende de:** F2-TES-01 · **Prioridad:** P1

#### F2-TES-05 · Arqueos con tolerancia, aprobación y visto bueno contable

**Historia:** Como gerente, quiero arqueos con aprobación de diferencias, para detectar faltantes.

**Especificación:** 12 §3.6, §4 Arqueo, TES-BR-13/14

**Tablas:** `fin_cash_counts`

**Endpoints:** `POST /api/v1/treasury/petty-cash/{account}/counts`, `POST /api/v1/treasury/counts/{id}/approve`, `POST /api/v1/treasury/counts/{id}/validate`

**Pantallas:** —

**Criterios de aceptación:**

1. Diferencia dentro de tolerancia genera ajuste al firmar; mayor → `pending_approval` y ajuste al aprobar por alguien distinto del firmante.
2. Arqueo de cierre cierra la sesión; Contabilidad valida.

**Pruebas:** Pest 12 §10 #6.

**Depende de:** F2-TES-04 · **Prioridad:** P1

#### F2-TES-06 · Reposiciones de caja chica

**Historia:** Como analista de finanzas, quiero solicitar y pagar reposiciones de caja con aprobación, para mantener el fondo fijo.

**Especificación:** 12 §3.7, §4 Reposición, TES-BR-10/14/15

**Tablas:** `fin_cash_replenishments`

**Endpoints:** `POST /api/v1/treasury/petty-cash/{account}/replenishments`, `POST /api/v1/treasury/replenishments/{id}/approve`, `POST /api/v1/treasury/replenishments/{id}/reject`, `POST /api/v1/treasury/replenishments/{id}/pay`

**Pantallas:** —

**Criterios de aceptación:**

1. Una reposición en curso por caja; el solicitante no aprueba; pagar crea transferencia banco → caja y anularla devuelve a `approved`.

**Pruebas:** Pest 12 §10 #7; Playwright TES-E2E-01, TES-E2E-02.

**Depende de:** F2-TES-04, F2-TES-03 · **Prioridad:** P1

#### F2-TES-07 · Flujo de caja proyectado

**Historia:** Como gerente, quiero el flujo de caja proyectado, para anticipar necesidades de liquidez.

**Especificación:** 12 §2 flujo, §6 cash-flow, §8 cash-flow-snapshot

**Tablas:** —

**Endpoints:** `GET /api/v1/treasury/cash-flow`

**Pantallas:** —

**Criterios de aceptación:**

1. Horizontes 0–30/31–60/61–90 y 13 semanas con CxC, CxP, comisiones y egresos fijos; caché Redis 5 min y snapshot diario.
2. Supuesto / nota: Egresos fijos manuales hasta integrar planillas (12 §12 #4).

**Pruebas:** Pest: proyección incluye vencidos si `include_overdue=1`.

**Depende de:** F2-TES-02 · **Prioridad:** P1

#### F2-TES-08 · Revaluación de saldos en USD

**Historia:** Como contador, quiero revaluar los saldos en dólares al cierre, para registrar la diferencia de cambio.

**Especificación:** 12 §3.8, TES-BR-16/18, §6 fx

**Tablas:** `fin_fx_revaluations`

**Endpoints:** `GET /api/v1/treasury/fx/revaluation-preview`, `POST /api/v1/treasury/fx/revaluations`

**Pantallas:** —

**Criterios de aceptación:**

1. `FxValuationService` por costo promedio ponderado: diferencia realizada en salidas y no realizada al cierre.
2. Una revaluación por cuenta y periodo (409 la segunda); registra solo `finance.invoicing`.

**Pruebas:** Pest 12 §10 #8; Playwright TES-E2E-03.

**Depende de:** F2-TES-01, F2-MOT-14 · **Prioridad:** P1

#### F2-TES-09 · Pantallas de tesorería y alertas

**Historia:** Como analista de finanzas, quiero las pantallas de tesorería con alertas, para trabajar el día a día.

**Especificación:** 12 §2, §7, §8 jobs

**Tablas:** —

**Endpoints:** —

**Pantallas:** `/finanzas/tesoreria`, `/movimientos`, `/cajas`, `/flujo`, `/cambio`, `/cuentas/[code]`

**Criterios de aceptación:**

1. `/finanzas/tesoreria` (resumen, movimientos, cajas, flujo, cambio, cuenta) con botones deshabilitados según permiso (Manager lectura + aprobación).
2. Jobs `treasury:cash-deposit-alerts` y `treasury:open-session-check`; notificaciones de umbral, diferencias y reposiciones.

**Pruebas:** Playwright 400 px en rutas de tesorería.

**Depende de:** F2-TES-06 · **Prioridad:** P1

#### F2-TES-10 · Pruebas de aceptación de tesorería

**Historia:** Como responsable técnico, quiero las pruebas de tesorería automatizadas, para cuidar los saldos.

**Especificación:** 12 §10 (tesorería)

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Pest 12 §10 #1–8 y Playwright TES-E2E-01…03 en verde.

**Pruebas:** Pest 12 §10 #1–8; TES-E2E-01…03.

**Depende de:** F2-TES-09 · **Prioridad:** P1

### E2.12 · Cierre de fase y homologaciones

Fuente: 03-PLAN §2 (criterio de salida Fase 2).

#### F2-CIE-01 · Homologación de la pasarela con el proveedor real

**Historia:** Como responsable técnico, quiero homologar la pasarela con el proveedor real, para cumplir el criterio de salida.

**Especificación:** 03-PLAN §2 criterio de salida; D-02

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Pagos aprobados, rechazados, 3-D Secure, webhook y contracargo probados contra el ambiente del proveedor elegido; credenciales en secret manager.
2. Supuesto / nota: Bloqueado por D-02.

**Pruebas:** Checklist de homologación firmado.

**Depende de:** F2-WEB-08 · **Prioridad:** P0

#### F2-CIE-02 · Homologación de facturación electrónica con el OSE/PSE real

**Historia:** Como responsable técnico, quiero homologar la facturación electrónica con el OSE/PSE real, para cumplir el criterio de salida.

**Especificación:** 03-PLAN §2; 07 §1.1; D-01

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Factura, boleta y NC aceptadas por el OSE en ambiente de pruebas; manejo de observado y rechazado verificado; modo simulado desactivado para el tenant piloto.
2. Supuesto / nota: Bloqueado por D-01.

**Pruebas:** Checklist de homologación firmado.

**Depende de:** F2-FIS-05 · **Prioridad:** P0

#### F2-CIE-03 · Regresión transversal de aislamiento y RBAC de Fase 2

**Historia:** Como responsable técnico, quiero una regresión de aislamiento y permisos sobre todo lo nuevo, para cerrar la fase sin fugas de datos.

**Especificación:** CONVENCIONES §7; E2E-08

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Prueba automática que recorre todos los endpoints nuevos con usuario de otro tenant (404) y con roles sin permiso (403).
2. Barrido 400/1440 px de todas las rutas nuevas sin scroll horizontal ni errores de consola.

**Pruebas:** E2E-08 extendido; Barrido responsive.

**Depende de:** Todas las épicas · **Prioridad:** P0

## Definición de terminado (toda historia)

- Migraciones reversibles con RLS forzado, CHECK de estados, índices y FK en la misma migración.
- Actions dentro de transacción, con locks donde haya cupos o dinero, eventos de dominio `afterCommit` y auditoría de las acciones críticas.
- Endpoints con FormRequest, Policy + permiso spatie, `JsonResource` que omite campos sensibles por permiso y OpenAPI regenerado.
- Integraciones externas (OSE, pasarela, WhatsApp, Expo Push, proveedor de TC) detrás de una interfaz con adaptador simulado, vía `sys_outbox` y colas con reintentos; un fallo externo nunca revierte la transacción interna.
- Pantallas Next.js y apps Expo equivalentes al prototipo, con estados vacío, error, sin conexión y 403; sin scroll horizontal de página a 400 px.
- Pruebas: aislamiento de tenant, RBAC (403), ownership, máquina de estados, reglas de negocio e idempotencia cuando aplique.
