# Portal corporativo: reportes de compras y movimientos para la empresa cliente (v2.7)

Módulo nuevo de la v2.7. Le da a la **empresa cliente** (segmento Corporativo) un panel dentro del portal del cliente para controlar lo que compra a la agencia:

1. Resumen de compras por período, con gasto por mes, por centro de costo y por viajero.
2. Movimientos: compras, pagos y notas de crédito con saldo acumulado.
3. Estado de cuenta mensual, en PDF y con envío automático por correo.
4. Aprobación previa de compras por un aprobador de la empresa.
5. Usuarios de la empresa con rol (administrador, aprobador, pagador y viajero) y centros de costo con presupuesto.
6. Exportación de reportes a Excel, PDF y CSV.

Fase del plan: **3 · SaaS y crecimiento** (épica E3.17 del backlog). La función es la regla activable **R-CORP-PORTAL**, con plan mínimo **Professional** (CP-01).

El portal B2B de agencias (spec 08) ya tiene su estado de cuenta con comisiones; este módulo cubre a las empresas que compran viajes para su personal, que no son agencias y no cobran comisión.

Prototipo: `#/canales/portal-cliente/{clientId}/corporativo`, pestaña «Panel corporativo» del portal del cliente. Usuario de prueba **U18** (Úrsula Benavides, administradora de Minera Cordillera Blanca, CLI-0002). El personal interno lo previsualiza con «Ver como cliente».

## 1. Propósito y procesos cubiertos (PROC-xxx)

| Proceso | Cobertura |
|---|---|
| PROC-051 Portal del cliente | Nueva sección «Panel corporativo» para clientes con cuenta corporativa activa |
| PROC-010 Cotización | Si la cuenta exige aprobación y el total supera el umbral, la cotización pide aprobación a la empresa antes de convertirse en reserva |
| PROC-020 Reserva | Reparto del importe de la reserva por centro de costo y viajero |
| PROC-040 Cobranza | Estado de cuenta mensual con saldo inicial, compras, pagos, notas de crédito y saldo final; envío automático |
| PROC-060 Reportes | Reportes de compras y movimientos por período, centro de costo y viajero, exportables |

## 2. Pantallas

| Ruta Next.js | Qué hace | Roles con acceso |
|---|---|---|
| `(portal-cliente)/corporativo` · pestaña «Resumen de compras» | KPIs (total comprado, saldo por pagar, viajeros, ticket promedio), gasto por mes, gasto y presupuesto por centro de costo, gasto por viajero y lista de compras del período | Cliente con cuenta corporativa (todos los roles del portal; el viajero solo ve sus viajes) |
| `…/corporativo` · «Movimientos» | Compras, pagos y notas de crédito con cargo, abono y saldo acumulado; filtros por tipo y centro de costo; exportar CSV, Excel y PDF | Administrador, pagador, aprobador (su centro de costo), viajero (sus viajes) |
| `…/corporativo` · «Estado de cuenta» | Estados mensuales, vista PDF, envío por correo y configuración del envío automático | Ver: todos menos viajero. Configurar y enviar: administrador y pagador |
| `…/corporativo` · «Aprobaciones» | Solicitudes pendientes, aprobadas y rechazadas; aprobar o rechazar con motivo | Ver: administrador y aprobador. Decidir: aprobador de ese centro de costo o administrador |
| `…/corporativo` · «Usuarios y centros de costo» | Usuarios del portal con rol y centro de costo; invitar usuarios; crear centros de costo con presupuesto | Administrador |
| `(backoffice)/crm/clientes/[code]/corporativo` | Alta de la cuenta corporativa, crédito, umbral de aprobación, centros de costo, viajeros y usuarios del portal | `crm.corporate.manage` |
| `(backoffice)/finanzas/estados-cuenta-corporativos` | Generar, enviar y anular estados de cuenta mensuales | `finance.corporate_statements` |

## 3. Modelo de datos PostgreSQL

SQL: `kit/database/40_fase3.sql`, bloque «v2.7». Las 8 tablas tienen `tenant_id`, RLS estricto y FKs compuestas `(tenant_id, …)`.

### 3.1 `crm_corporate_accounts`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id, tenant_id | uuid | no | PK, RLS |
| client_id | uuid | no | FK `crm_clients`; UNIQUE por tenant (una cuenta por cliente) |
| status | varchar(12) | no | CHECK IN ('activa','suspendida','cerrada') |
| currency | char(3) | no | Moneda de los reportes y del estado de cuenta |
| credit_days | smallint | no | 0–120 |
| require_approval, approval_threshold | boolean, numeric(14,2) | no / sí | Si exige aprobación, el umbral es obligatorio (CHECK) |
| approval_ttl_hours | smallint | no | Vigencia de la solicitud (1–720 h, por defecto 72) |
| default_cost_center_id | uuid | sí | FK `crm_corporate_cost_centers` |
| statement_auto, statement_day, statement_recipients | boolean, smallint, text[] | no | Día 1–28; con envío automático hace falta al menos un destinatario (CHECK) |
| statement_last_sent_at | timestamptz | sí | |
| lock_version | integer | no | |

### 3.2 `crm_corporate_cost_centers`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| account_id | uuid | no | FK `crm_corporate_accounts` |
| code | varchar(20) | no | `^[A-Z0-9-]{2,20}$`; UNIQUE por cuenta |
| name | varchar(120) | no | |
| budget_amount, budget_period | numeric(14,2), varchar(12) | sí / no | Período 'mensual', 'trimestral' o 'anual' |
| active | boolean | no | |

### 3.3 `crm_corporate_travelers`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| account_id, cost_center_id | uuid | no / sí | FKs |
| full_name, email | varchar | no / sí | |
| doc_type, doc_number | varchar | sí | Los dos o ninguno (CHECK); UNIQUE por cuenta cuando hay documento |
| employee_code | varchar(30) | sí | UNIQUE por cuenta cuando existe |
| active | boolean | no | |

### 3.4 `crm_corporate_portal_users`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| account_id | uuid | no | FK |
| user_id | uuid | sí | FK `iam_users` (rol `customer`, `client_id` = cliente de la cuenta); se llena al aceptar la invitación |
| email, full_name | varchar | no | Email UNIQUE por cuenta (sin distinguir mayúsculas) |
| portal_role | varchar(15) | no | CHECK IN ('administrador','aprobador','pagador','viajero'); el aprobador exige `cost_center_id` |
| cost_center_id, traveler_id | uuid | sí | Alcance del aprobador; vínculo del viajero con su ficha |
| status | varchar(10) | no | 'invitado','activo','inactivo'; `activo` exige `user_id` y `accepted_at` |

### 3.5 `booking_corporate_approvals`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| code | varchar(20) | no | `APC-0001`, UNIQUE por tenant |
| account_id, cost_center_id | uuid | no | FKs |
| quote_id, reservation_id | uuid | sí | Exactamente uno (CHECK). Solo una solicitud `pendiente` por cotización o reserva (índice parcial) |
| amount, currency | numeric(14,2), char(3) | no | Total de la versión vigente al pedir la aprobación |
| requested_by_portal_user_id, requested_by_user_id | uuid | sí | Quién la pidió: un usuario de la empresa o el vendedor |
| approver_portal_user_id | uuid | sí | Quién decidió; obligatorio en `aprobada` y `rechazada` |
| status | varchar(10) | no | 'pendiente','aprobada','rechazada','vencida','cancelada'; `rechazada` exige motivo |
| expires_at, decided_at | timestamptz | no / sí | |
| lock_version | integer | no | |

### 3.6 `booking_cost_allocations`

Reparto de una reserva: `reservation_id`, `account_id`, `cost_center_id`, `traveler_id` (opcional), `pct` (0 a 100), `amount` y `currency`. Es UNIQUE por reserva, centro de costo y viajero. Los porcentajes de una reserva suman 100 (CP-04, validado en el servicio).

### 3.7 `fin_corporate_statements`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| code | varchar(20) | no | `EC-CLI0002-2026-09`, UNIQUE por tenant |
| account_id | uuid | no | FK |
| period_start, period_end | date | no | Un estado vigente por cuenta, mes y moneda (índice parcial sin `anulado`) |
| opening_balance, charges, payments, credits, closing_balance | numeric(14,2) | no | CHECK `closing = opening + charges − payments − credits` |
| lines | jsonb | no | Movimientos del mes congelados al generar |
| status | varchar(10) | no | 'generado','enviado','anulado'; `enviado` exige `sent_at` y destinatarios |
| document_id | uuid | sí | FK `sys_documents` (PDF) |

### 3.8 `report_corporate_exports`

`code` (`EXC-0001`), `account_id`, quién la pidió (`requested_by_portal_user_id` o `requested_by_user_id`, al menos uno), `report_type` ('compras','movimientos','centro_costo','viajeros','estado_cuenta','aprobaciones'), `filters`, `format` ('xlsx','pdf','csv'), `status` ('en_cola','procesando','listo','fallido','vencido'), `row_count`, `document_id`, `completed_at` y `expires_at`. `listo` exige documento y fecha de término.

## 4. Máquinas de estado

| Entidad | Transiciones |
|---|---|
| Cuenta corporativa | `activa ↔ suspendida` (Finanzas o Ventas con `crm.corporate.manage`) · `activa|suspendida → cerrada` |
| Usuario del portal | `invitado → activo` (acepta la invitación) · `activo ↔ inactivo` · `invitado → inactivo` (invitación revocada) |
| Aprobación corporativa | `pendiente → aprobada | rechazada` (aprobador) · `pendiente → vencida` (job al `expires_at`) · `pendiente → cancelada` (la cotización cambia de versión o se cancela) |
| Estado de cuenta | `generado → enviado` · `generado|enviado → anulado` (se regenera el mes) |
| Exportación | `en_cola → procesando → listo` · `procesando → fallido` · `listo → vencido` (job a los 7 días) |

## 5. Reglas de negocio

| ID | Regla | Dónde |
|---|---|---|
| CP-01 | La regla R-CORP-PORTAL (plan mínimo Professional) habilita el módulo. Regla apagada o fuera de plan → 403 en los endpoints y sin pestaña en el portal | Middleware de regla (spec 13) |
| CP-02 | Solo los usuarios del portal de la cuenta ven el panel; cada endpoint filtra por la cuenta del `client_id` del token (SEC-BR-12). El viajero solo ve compras donde figura como pasajero o como viajero asignado; el aprobador ve las de su centro de costo | Policy + scope |
| CP-03 | Si la cuenta exige aprobación y el total de la versión vigente es mayor o igual al umbral, convertir la cotización en reserva exige una aprobación `aprobada` de esa versión. Sin ella → 422 `CORPORATE_APPROVAL_REQUIRED`. Una nueva versión cancela la solicitud pendiente | Action `ConvertQuote` |
| CP-04 | El reparto de costos de una reserva suma 100 % y su importe suma el total de la reserva (diferencia de redondeo al último renglón). Sin reparto, la reserva va al centro de costo por defecto | Service |
| CP-05 | El estado de cuenta se genera por mes calendario en la moneda de la cuenta (los importes en otra moneda se convierten con el tipo de cambio del día del movimiento, 07 §4). El envío automático corre el `statement_day` del mes siguiente y no duplica un estado `generado` o `enviado` del mismo mes | Job + índice parcial |
| CP-06 | Un correo solo puede tener un usuario por cuenta. Solo el administrador de la empresa o el personal con `crm.corporate.manage` invita, cambia roles o desactiva usuarios. La cuenta siempre conserva al menos un administrador activo | Action |
| CP-07 | El aprobador solo decide solicitudes de su centro de costo (el administrador decide todas). Rechazar exige motivo. La decisión es idempotente: una segunda decisión sobre una solicitud cerrada → 409 | Action + `lock_version` |
| CP-08 | Las exportaciones se generan en segundo plano y quedan 7 días; el enlace es firmado y de un solo usuario. Máximo 10 exportaciones en cola por cuenta | Job |
| CP-09 | El panel nunca muestra costos de proveedor, márgenes ni comisiones (SEC-BR-13): solo importes de venta, pagos y notas de crédito del cliente | Resource |
| CP-10 | Presupuesto: al superar el 80 % del presupuesto del período de un centro de costo se avisa al administrador y al aprobador; superarlo no bloquea la compra, pero la marca «excedido» en el reporte y en la solicitud de aprobación | Service + notificación |

## 6. API REST

| Método | Endpoint | Permiso | Descripción | Idem./lock |
|---|---|---|---|---|
| GET | `/api/v1/crm/corporate-accounts` | crm.corporate.manage | Cuentas corporativas con saldo y estado | — |
| POST | `/api/v1/crm/corporate-accounts` | crm.corporate.manage | Alta de la cuenta de un cliente (`client_id`, crédito, aprobación, envío automático) | Idempotency-Key |
| GET | `/api/v1/crm/corporate-accounts/{id}` | crm.corporate.manage | Detalle con centros de costo, usuarios y totales | — |
| PATCH | `/api/v1/crm/corporate-accounts/{id}` | crm.corporate.manage | Editar condiciones | lock_version |
| POST | `/api/v1/crm/corporate-accounts/{id}/suspend` | crm.corporate.manage | Suspender o reactivar (`{active}`) | lock_version |
| GET | `/api/v1/crm/corporate-accounts/{id}/cost-centers` | crm.corporate.manage | Centros de costo | — |
| POST | `/api/v1/crm/corporate-accounts/{id}/cost-centers` | crm.corporate.manage | Crear centro de costo | — |
| PATCH | `/api/v1/crm/corporate-accounts/{id}/cost-centers/{costCenterId}` | crm.corporate.manage | Editar o desactivar | — |
| GET | `/api/v1/crm/corporate-accounts/{id}/travelers` | crm.corporate.manage | Viajeros | — |
| POST | `/api/v1/crm/corporate-accounts/{id}/travelers` | crm.corporate.manage | Crear viajero | — |
| POST | `/api/v1/crm/corporate-accounts/{id}/travelers/import` | crm.corporate.manage | Importar viajeros desde CSV o Excel | Idempotency-Key |
| PATCH | `/api/v1/crm/corporate-accounts/{id}/travelers/{travelerId}` | crm.corporate.manage | Editar o desactivar | — |
| GET | `/api/v1/crm/corporate-accounts/{id}/portal-users` | crm.corporate.manage | Usuarios del portal | — |
| POST | `/api/v1/crm/corporate-accounts/{id}/portal-users` | crm.corporate.manage | Invitar usuario con rol | Idempotency-Key |
| PATCH | `/api/v1/crm/corporate-accounts/{id}/portal-users/{portalUserId}` | crm.corporate.manage | Cambiar rol, centro de costo o estado | — |
| POST | `/api/v1/crm/corporate-accounts/{id}/portal-users/{portalUserId}/resend-invite` | crm.corporate.manage | Reenviar invitación | — |
| GET | `/api/v1/reservations/{code}/cost-allocations` | crm.corporate.manage \| reservations.view | Reparto de la reserva | — |
| PUT | `/api/v1/reservations/{code}/cost-allocations` | crm.corporate.manage \| reservations.modify | Reemplazar el reparto (CP-04) | lock_version de la reserva |
| POST | `/api/v1/quotes/{code}/corporate-approval` | quotes.send | Pedir aprobación a la empresa para la versión vigente | Idempotency-Key |
| GET | `/api/v1/finance/corporate-statements` | finance.corporate_statements | Estados de cuenta por cuenta y mes | — |
| POST | `/api/v1/finance/corporate-statements` | finance.corporate_statements | Generar el estado de un mes (`account_id`, `month`) | Idempotency-Key |
| GET | `/api/v1/finance/corporate-statements/{code}` | finance.corporate_statements | Detalle con líneas y PDF | — |
| POST | `/api/v1/finance/corporate-statements/{code}/send` | finance.corporate_statements | Enviar por correo a los destinatarios | Idempotency-Key |
| POST | `/api/v1/finance/corporate-statements/{code}/void` | finance.corporate_statements | Anular para regenerar | — |
| GET | `/api/v1/portal/client/corporate/summary` | customer (cuenta corporativa) | KPIs, gasto por mes, por centro de costo y por viajero (`period`) | — |
| GET | `/api/v1/portal/client/corporate/purchases` | customer (cuenta corporativa) | Compras del período con centro de costo y viajeros | — |
| GET | `/api/v1/portal/client/corporate/movements` | customer (cuenta corporativa) | Compras, pagos y notas de crédito con saldo acumulado | — |
| GET | `/api/v1/portal/client/corporate/statements` | customer (administrador, pagador, aprobador) | Estados de cuenta mensuales | — |
| GET | `/api/v1/portal/client/corporate/statements/{code}/pdf` | customer (administrador, pagador, aprobador) | PDF del estado de cuenta | — |
| PATCH | `/api/v1/portal/client/corporate/statement-settings` | customer (administrador, pagador) | Envío automático, día y destinatarios | lock_version |
| GET | `/api/v1/portal/client/corporate/approvals` | customer (administrador, aprobador) | Solicitudes de aprobación | — |
| POST | `/api/v1/portal/client/corporate/approvals/{code}/approve` | customer (administrador, aprobador) | Aprobar | Idempotency-Key; lock_version |
| POST | `/api/v1/portal/client/corporate/approvals/{code}/reject` | customer (administrador, aprobador) | Rechazar con motivo | lock_version |
| GET | `/api/v1/portal/client/corporate/users` | customer (administrador) | Usuarios de la empresa | — |
| POST | `/api/v1/portal/client/corporate/users` | customer (administrador) | Invitar usuario | Idempotency-Key |
| PATCH | `/api/v1/portal/client/corporate/users/{portalUserId}` | customer (administrador) | Cambiar rol, centro de costo o estado (CP-06) | — |
| GET | `/api/v1/portal/client/corporate/cost-centers` | customer (cuenta corporativa) | Centros de costo con presupuesto y consumo | — |
| POST | `/api/v1/portal/client/corporate/cost-centers` | customer (administrador) | Crear centro de costo | — |
| PATCH | `/api/v1/portal/client/corporate/cost-centers/{code}` | customer (administrador) | Editar presupuesto o desactivar | — |
| GET | `/api/v1/portal/client/corporate/travelers` | customer (administrador, aprobador) | Viajeros de la empresa | — |
| POST | `/api/v1/portal/client/corporate/travelers` | customer (administrador) | Crear viajero | — |
| GET | `/api/v1/portal/client/corporate/exports` | customer (cuenta corporativa) | Exportaciones propias | — |
| POST | `/api/v1/portal/client/corporate/exports` | customer (cuenta corporativa) | Pedir exportación (`report_type`, `format`, `filters`) → 202 | Idempotency-Key |
| GET | `/api/v1/portal/client/corporate/exports/{code}` | customer (cuenta corporativa) | Estado y enlace firmado de descarga | — |

## 7. Permisos y comportamiento por rol

Permisos nuevos (2), módulo «Corporativo»: `crm.corporate.manage` y `finance.corporate_statements`. El total del catálogo pasa a 86 permisos.

| Rol | Permisos nuevos |
|---|---|
| Tenant Admin | Los 2 |
| Manager | Los 2 |
| Ventas | `crm.corporate.manage` (solo clientes de su cartera) |
| Finanzas | Los 2 |
| Contabilidad | `finance.corporate_statements` |
| Cliente (`customer`) | Sin permisos nuevos. El acceso al panel sale de la pertenencia (`client_id`) y del `portal_role` en `crm_corporate_portal_users` |

Roles dentro del portal:

| Rol del portal | Resumen y compras | Movimientos | Estado de cuenta | Aprobaciones | Usuarios y centros de costo |
|---|---|---|---|---|---|
| Administrador | Todo | Todo | Ver, enviar y configurar | Ver y decidir todas | Gestionar |
| Pagador | Todo | Todo | Ver, enviar y configurar | — | — |
| Aprobador | Su centro de costo | Su centro de costo | Ver | Ver y decidir las de su centro | — |
| Viajero | Sus viajes | Sus viajes | — | — | — |

## 8. Eventos, jobs y notificaciones

| Evento / job | Cola | Efecto |
|---|---|---|
| `CorporateApprovalRequested` | notifications | Avisa por correo y portal a los aprobadores del centro de costo y al administrador |
| `CorporateApprovalDecided` | notifications | Avisa al vendedor; si fue aprobada, la cotización ya puede convertirse |
| `ExpireCorporateApprovals` (cada 30 min) | default | `pendiente → vencida` y aviso al vendedor |
| `GenerateCorporateStatements` (diario 05:00) | reports | Para cada cuenta con `statement_auto` y `statement_day` = hoy, genera el estado del mes anterior y lo envía |
| `BuildCorporateExport` | reports | Genera el archivo, lo guarda en `sys_documents` y avisa al usuario |
| `ExpireCorporateExports` (diario) | default | `listo → vencido` a los 7 días |
| `CostCenterBudgetThreshold` | notifications | Aviso al 80 % y al 100 % del presupuesto (CP-10) |

Plantillas nuevas: `aprobacion_corporativa.pendiente`, `aprobacion_corporativa.decidida`, `estado_cuenta.corporativo`, `portal.invitacion_corporativa`, `exportacion.lista` y `presupuesto.umbral`.

## 9. Auditoría

Se auditan: alta, cambio y suspensión de la cuenta; altas y cambios de centros de costo, viajeros y usuarios del portal (con rol antes y después); solicitudes y decisiones de aprobación; cambios del reparto de costos; generación, envío y anulación de estados de cuenta; configuración del envío automático; y pedidos de exportación.

## 10. Casos de prueba mínimos

Pest:

- Aislamiento de tenant en las 8 tablas (incluido en `tests/smoke_test.sql`, línea «OK portal corporativo»).
- CP-01: regla apagada → 403 y sin pestaña.
- CP-02: un cliente de otra empresa no ve el panel (403); el viajero solo ve sus viajes; el aprobador solo su centro de costo.
- CP-03: convertir una cotización sobre el umbral sin aprobación → 422; con aprobación de una versión anterior → 422; con aprobación vigente → OK.
- CP-04: un reparto que no suma 100 % → 422.
- CP-05: el estado de cuenta cumple `closing = opening + charges − payments − credits`; el job no duplica el mes.
- CP-06: correo repetido → 422; desactivar al último administrador → 422.
- CP-07: un aprobador de otro centro de costo → 403; segunda decisión → 409.
- CP-09: ninguna respuesta del portal incluye costos, márgenes ni comisiones.

Playwright: U18 entra al portal, abre «Panel corporativo», filtra el tercer trimestre, exporta movimientos, abre el estado de cuenta de setiembre y aprueba la solicitud pendiente; a 390 px el panel no tiene scroll horizontal.

## 11. Cambios y decisiones respecto a la documentación inicial

- **Módulo nuevo** (v2.7), pedido para que la empresa cliente tenga un panel de reportes de compras y movimientos.
- Se reutiliza lo existente: el portal del cliente (spec 08) y su rol `customer`, los pagos y las notas de crédito de finanzas (spec 07), las aprobaciones internas siguen en spec 10 y los documentos en `sys_documents`.
- No se crea un rol externo nuevo: los cuatro roles del portal viven en `crm_corporate_portal_users` para no tocar la matriz de roles del tenant.
- El prototipo incluye la pestaña «Panel corporativo» con datos de ejemplo de Minera Cordillera Blanca. Las compras de febrero a agosto son historial de ejemplo (`DB.corpAccounts[].history`); la reserva RES-2026-000348 y su pago salen de las tablas del demo. La pantalla interna de alta de cuentas corporativas queda para la construcción (§2).

## 12. Supuestos y puntos a validar con negocio

- Plan mínimo (supuesto: Professional) y si se cobra por número de empresas con cuenta corporativa.
- Umbral de aprobación por defecto (supuesto: S/ 5 000) y vigencia de la solicitud (72 h).
- Si el viajero puede pedir cotizaciones desde el portal o solo ver sus viajes (supuesto: solo ver).
- Formato del Excel que piden las áreas de contabilidad de los clientes (columnas, centro de costo y orden de compra).
- Si el reparto por viajero es en partes iguales por defecto (supuesto: sí) o por servicio.
