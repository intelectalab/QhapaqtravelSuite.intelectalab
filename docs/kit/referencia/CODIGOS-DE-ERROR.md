# Códigos de error de la API

> Generado por `kit-ia/referencia/tools/extract_errors.py` a partir de `proto/docs/especificaciones/*.md`, `proto/docs/CONVENCIONES.md` y `kit-ia/api/openapi.json`. Las secciones 1–2 son el marco fijo; las tablas 3–5 se regeneran desde las especificaciones.

## 1. Formato estándar de error

Fuente: spec 00 §6 («Formato de error (todas las API)»), CONVENCIONES §3 y `components.schemas.Error` / `ValidationError` del contrato.

**Errores de autorización, estado y negocio** (`Error`; obligatorios: `error`, `message`):

```json
{ "error": "FORBIDDEN", "code": "SEC-BR-09", "message": "Este registro pertenece a la cartera de otro asesor…",
  "required_permissions": ["quotes.view"], "correlation_id": "c-8812a", "details": {} }
```

**Errores de validación** (`ValidationError`, HTTP 422; obligatorios: `message`, `errors`):

```json
{ "message": "Los datos no son válidos.", "code": "PRD-BR-002",
  "errors": { "travel_date": ["La fecha de viaje debe ser posterior a hoy."] }, "correlation_id": "c-77e1" }
```

| Campo | Tipo | Uso |
|---|---|---|
| `error` | string | Categoría estable para el frontend: `FORBIDDEN`, `RESOURCE_NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `TENANT_SUSPENDED`… (ver §3). No va en `ValidationError`. |
| `code` | string | Código de la regla de negocio que se violó (`SEC-BR-09`, `QTE-BR-12`, `RT-4`, `PRD-BR-002`, `STALE_VERSION`…). Opcional en errores puramente técnicos. |
| `message` | string | Mensaje en español, apto para mostrar al usuario, sin datos personales ni trazas. |
| `errors` | objeto `campo → [mensajes]` | Solo 422 de validación (`FormRequest`). Claves = nombres de campo del cuerpo (snake_case; notación con punto para arreglos: `passengers.0.doc_number`). |
| `required_permissions` | string[] | En 403 por permiso: permisos que habilitarían la acción (cualquiera de ellos). |
| `correlation_id` | string | Id de la solicitud (header `X-Request-Id` / log). Se registra en `audit_logs` cuando el error se audita (accesos denegados, SEC-BR-07). |
| `details` | objeto | Datos adicionales del conflicto: checklist fallido (`PRD-ACT-CHECKLIST`), cupos libres, límite del plan, `lock_version` vigente… |

Reglas de emisión (SEC-BR-03/07/14/16/17/24/25, CONVENCIONES §3):

- El backend es la autoridad: un botón oculto en la UI siempre se revalida y responde 403 si llega por otra vía (RT-17).
- Todo 403 de pantalla o endpoint se audita como `acceso_denegado` (SEC-BR-07). Exportaciones denegadas: `exportar_denegado`.
- Recurso de otro tenant → **404** (no se revela que existe). Intento explícito de fijar otro tenant → **403** `TENANT_SCOPE_VIOLATION`.
- Respuestas 429 incluyen `Retry-After`, `X-RateLimit-Limit` y `X-RateLimit-Remaining` (`components.responses.TooManyRequests`).
- Una notificación fallida nunca convierte en error una operación ya confirmada (SEC-BR-22).
- Implementación de referencia: `App\Domain\Shared\Errors\ApiException` (`forbidden`, `notFound`, `conflict`, `unprocessable`) en `kit-ia/ejemplos/backend` si está presente, y la expectativa Pest `toBeApiError(status, code)`.

## 2. Códigos HTTP usados por el sistema

| HTTP | `error` | Significado en Qhapaq | Ejemplos de `code` | Fuente |
|---|---|---|---|---|
| 400 | BAD_REQUEST | Petición mal formada que no llega al FormRequest (JSON inválido, firma de webhook ilegible, parámetros de consulta imposibles). | — | specs (uso puntual) |
| 401 | UNAUTHENTICATED | Sin token, token vencido o revocado (logout, baja, cambio de rol, reset MFA). El cliente debe volver al login. | — | 00 §4, `responses.Unauthorized` |
| 402 | PAYMENT_REQUIRED | Tenant suspendido por falta de pago: solo se permiten `/billing/*` y el login. | `PAYMENT_REQUIRED` | 13 §6, `responses.PaymentRequired` |
| 403 | FORBIDDEN | Sin permiso (`required_permissions`), fuera del alcance del rol (ownership de Ventas, usuario externo), feature o regla fuera del plan, scope de API key faltante, MFA no verificado, tenant suspendido. | `SEC-BR-09`, `SCOPE_OWNERSHIP`, `FEATURE_NOT_IN_PLAN`, `RULE_NOT_IN_PLAN`, `TENANT_SCOPE_VIOLATION`, `TENANT_SUSPENDED`, `MFA_REQUIRED` | 00 §5, `responses.Forbidden` |
| 404 | RESOURCE_NOT_FOUND | No existe **o pertenece a otro tenant** (RLS + global scope; misma respuesta en ambos casos, SEC-BR-02). | `RESOURCE_NOT_FOUND` | 00 SEC-BR-02, `responses.NotFound` |
| 409 | CONFLICT | Conflicto de estado (transición no permitida), de disponibilidad/cupo, de versión optimista (`If-Match` ≠ `lock_version`) o clave de idempotencia aún en proceso. | `STALE_VERSION`, `IDEMPOTENCY_IN_PROGRESS`, `RT-3`, `RT-4`, `QUOTE_CHANGED`, `AVAIL_CHANGED` | CONVENCIONES §3, `responses.Conflict` |
| 410 | GONE | Solo como respuesta **recibida** en webhooks salientes: el endpoint del suscriptor devolvió 410 → la suscripción se deshabilita (13 §8). | — | 13 §8 |
| 412 / 428 | — | **No usados por las especificaciones.** Un `If-Match` desactualizado responde **409** (`STALE_VERSION`). Supuesto/Por definir: si falta `If-Match` en una ruta que lo exige, responder 428 `PRECONDITION_REQUIRED` o 422; decidir y documentar en 00 §11. Para la ausencia de `Idempotency-Key` el backlog propone 422 `IDEMPOTENCY_KEY_REQUIRED` (supuesto). | — | Por definir |
| 422 | VALIDATION_FAILED / BUSINESS_RULE | Validación de campos (`errors`) o regla de negocio (`code` de la regla). Misma `Idempotency-Key` con cuerpo distinto también es 422. | `PRD-BR-002`, `PRD-ACT-CHECKLIST`, `IDEMPOTENCY_KEY_REUSED`, `RT-14`, `CAT-AV-03` | CONVENCIONES §3, `responses.UnprocessableEntity` |
| 423 | — | **No usado por las especificaciones** (recurso bloqueado). Los bloqueos de periodo cerrado o de recurso tomado se expresan como 409/422 con `code` de regla. Por definir si se adopta. | — | Por definir |
| 429 | RATE_LIMITED / QUOTA_EXCEEDED | Rate limit Redis (login 5/min por IP+email, API 120/min por usuario, exportaciones 10/h, API pública según plan) o cuota del plan agotada (mensajes, llamadas API). | `RATE_LIMITED`, `QUOTA_EXCEEDED` | 00 SEC-BR-25, 13 §5, `responses.TooManyRequests` |
| 500 / 503 | SERVER_ERROR | Error no controlado (se registra con `correlation_id`; nunca expone trazas). 5xx de proveedores externos (OSE, pasarela) se reintenta en cola, no se propaga al usuario. | — | specs (integraciones) |

Menciones de cada estado HTTP por especificación (conteo automático; ayuda a ubicar dónde se define cada caso):

| HTTP | 00 | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | CONV | Total |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 400 |  |  | 1 |  |  | 1 |  |  |  |  |  |  |  |  |  |  | 1 |  |  |  | 3 |
| 401 | 2 |  |  |  |  |  |  |  |  | 1 | 1 |  |  | 1 |  |  |  |  |  |  | 5 |
| 402 |  |  |  |  |  |  |  |  |  |  |  |  |  | 1 |  |  |  |  |  |  | 1 |
| 403 | 25 | 11 | 11 | 3 | 4 | 8 | 4 | 12 | 5 | 15 | 5 | 4 | 8 | 17 | 7 |  | 2 | 24 | 3 | 1 | 169 |
| 404 | 6 |  | 3 | 1 |  |  | 2 |  |  | 3 | 1 |  |  |  |  | 2 | 1 |  |  |  | 19 |
| 409 | 4 | 12 | 15 | 6 | 9 | 11 | 8 | 5 | 6 | 9 | 2 | 4 | 3 |  | 7 | 5 | 7 |  | 1 | 2 | 116 |
| 410 |  |  |  |  |  | 1 |  |  |  |  |  |  |  | 1 |  |  |  |  |  |  | 2 |
| 422 | 2 | 9 | 30 | 5 | 2 | 9 | 8 | 18 | 9 | 10 | 2 | 5 | 3 | 5 | 6 | 7 | 6 | 6 | 4 | 2 | 148 |
| 429 |  |  |  |  |  |  |  |  |  | 1 |  |  |  | 7 |  |  |  |  |  |  | 8 |
| 500 |  |  | 1 |  |  |  |  | 1 |  |  |  |  | 2 | 2 |  |  | 2 |  |  |  | 8 |

## 3. Códigos de error simbólicos (`error` / `code` en MAYÚSCULAS)

Códigos con nombre propio que aparecen en las especificaciones o en el contrato. *HTTP* = estado con el que aparecen asociados en el texto (vacío si la spec no lo dice: Por definir).

| Código | HTTP | Módulo(s) | Cuándo ocurre (extracto de la especificación) | En el contrato |
|---|---|---|---|---|
| `AVAIL_CHANGED` | 409 | 16 | *16 §6 API REST › 6.1 Públicas (sitio, widget, CMS externo) — autenticación por *publishable key* del tenant + rate limit Redis*: POST · `/api/v1/public/bookings` · Crea hold + reserva `pendiente_pago` a partir de `quote_token`; **recalcula** con `BookingEngine::quote` y rechaza si cambia el total (409 `QUOTE_CHANGED`) o la disponibilidad (409 `AVAIL_CHANGED`) <br>*16 §8 Eventos, jobs (colas Redis) y notificaciones › 8.4 Locks al confirmar*: 3. Si `left < seats` ⇒ 409 `AVAIL_CHANGED` con alternativas (`nextAvailable`). Si total ≠ `quote_token` ⇒ 409 `QUOTE_CHANGED` con nuevo quote. | — |
| `COUPON_INVALID` | 422 | 13 | *13 §6 API REST*: - 422 `PLAN_LIMIT_REACHED` / `SUB_DOWNGRADE_BLOCKED` / `COUPON_INVALID`. | — |
| `FEATURE_NOT_IN_PLAN` | 403 | 13 | *13 §6 API REST*: - 403 `FEATURE_NOT_IN_PLAN`. <br>*13 §10 Casos de prueba mínimos*: 6. Entitlements: la precedencia override > add-on > plan. Override vencido → rige el plan. `feature:ecommerce` en el plan Professional → 403 `FEATURE_NOT_IN_PLAN`. | components.responses |
| `IDEMPOTENCY_IN_PROGRESS` | 409 | 00 | *00 §5 Reglas de negocio transversales*: SEC-BR-16 (RT 22) · Operaciones críticas exigen `Idempotency-Key`; misma key + mismo cuerpo → misma respuesta; misma key + cuerpo distinto → 422 `IDEMPOTENCY_KEY_REUSED`; key en proceso → 409 `IDEMPOTENCY_IN_PROGRESS` · Middleware `Idempotent` | — |
| `IDEMPOTENCY_KEY_REUSED` | 422 | 00 | *00 §5 Reglas de negocio transversales*: SEC-BR-16 (RT 22) · Operaciones críticas exigen `Idempotency-Key`; misma key + mismo cuerpo → misma respuesta; misma key + cuerpo distinto → 422 `IDEMPOTENCY_KEY_REUSED`; key en proceso → 409 `IDEMPOTENCY_IN_PROGRESS` · Middleware `Idempotent` | — |
| `MFA_REQUIRED` | 403 | 00 | *00 §10 Casos de prueba mínimos › Pest*: X-11 · Login sin MFA verificado accede a recurso · 403 `MFA_REQUIRED` | — |
| `PAYMENT_REQUIRED` | 402 | 13 | *13 §6 API REST*: - 402 `PAYMENT_REQUIRED`: tenant suspendido; solo se permiten `/billing/*` y el login. | components.responses |
| `PLAN_LIMIT_EXCEEDED` | 409 | 09 | *09 §5 Reglas de negocio*: TEN-BR-09 · Cambio de plan: bloquea si usuarios > límite (“Desactive usuarios antes del downgrade”) o almacenamiento > límite; mismo plan → aviso sin cambios · Service (409 `PLAN_LIMIT_EXCEEDED`) | — |
| `PLAN_LIMIT_REACHED` | 422 | 13 | *13 §5 Reglas de negocio*: SUB-BR-04 · Límites `hard` al 100 %: users/sedes impiden crear más (422 `PLAN_LIMIT_REACHED`). WhatsApp/email se encolan diferidos. API responde 429 `QUOTA_EXCEEDED`. Reservas: aviso sin bloqueo (límite `soft`). · Policies de alta + `NotificationThrottler` + … <br>*13 §6 API REST*: - 422 `PLAN_LIMIT_REACHED` / `SUB_DOWNGRADE_BLOCKED` / `COUPON_INVALID`. <br>*13 §10 Casos de prueba mínimos*: 7. Límites: crear el usuario 6 en Starter → 422 `PLAN_LIMIT_REACHED`. La API al 100 % de la cuota → 429 `QUOTA_EXCEEDED`. Exceder el rate por minuto → 429 con `Retry-After`. | — |
| `QUOTA_EXCEEDED` | 429 | 13 | *13 §5 Reglas de negocio*: SUB-BR-04 · Límites `hard` al 100 %: users/sedes impiden crear más (422 `PLAN_LIMIT_REACHED`). WhatsApp/email se encolan diferidos. API responde 429 `QUOTA_EXCEEDED`. Reservas: aviso sin bloqueo (límite `soft`). · Policies de alta + `NotificationThrottler` + … <br>*13 §6 API REST*: - 429 `RATE_LIMITED` / `QUOTA_EXCEEDED` con `Retry-After`. <br>*13 §8 Eventos, jobs (colas Redis) y notificaciones › 8.3 Medición de uso y rate limiting (Redis)*: - **Cuota mensual**: `GET usage:{t}:api_calls:{yyyymm}`, comparada con el límite efectivo cacheado. Si se excede → 429 `QUOTA_EXCEEDED`. | components.responses |
| `QUOTE_CHANGED` | 409 | 16 | *16 §6 API REST › 6.1 Públicas (sitio, widget, CMS externo) — autenticación por *publishable key* del tenant + rate limit Redis*: POST · `/api/v1/public/bookings` · Crea hold + reserva `pendiente_pago` a partir de `quote_token`; **recalcula** con `BookingEngine::quote` y rechaza si cambia el total (409 `QUOTE_CHANGED`) o la disponibilidad (409 `AVAIL_CHANGED`) <br>*16 §8 Eventos, jobs (colas Redis) y notificaciones › 8.4 Locks al confirmar*: 3. Si `left < seats` ⇒ 409 `AVAIL_CHANGED` con alternativas (`nextAvailable`). Si total ≠ `quote_token` ⇒ 409 `QUOTE_CHANGED` con nuevo quote. | — |
| `RATE_LIMITED` | 429 | 13 | *13 §6 API REST*: - 429 `RATE_LIMITED` / `QUOTA_EXCEEDED` con `Retry-After`. | components.responses |
| `RESOURCE_NOT_FOUND` | 404 | 00, 09 | *00 §5 Reglas de negocio transversales*: SEC-BR-02 (RT 2, E2E-08, PRD-BR-015) · El tenant se resuelve **solo** desde el token (y se contrasta con el host `{slug}.dominio`); se ignora cualquier `tenant_id`/`X-Tenant-Id` del cliente. Recurso de otro tenant → **404** `RESOURCE_NOT_FOUND`; ruta que inte… <br>*09 §10 Casos de prueba mínimos › Pest (feature)*: T-01 · E2E-08: usuario de TNT-A hace `GET /reservations/{id-de-B}` · 404 `RESOURCE_NOT_FOUND`; evento `acceso_denegado` | — |
| `RULE_NOT_IN_PLAN` | 403 | 08, 17, 18 | *08 §6 API REST › 6.8 v2.2 — Endpoints de reseñas del pasajero*: POST · `/api/v1/passenger/reviews` · Alta multipart (Idempotency-Key); 422 si no verificable, 409 si ya calificó, 403 `RULE_NOT_IN_PLAN` si la regla no aplica <br>*17 §3 Modelo de datos PostgreSQL › 3.1 `sys_booking_rules` (centro de reglas del tenant)*: **Regla efectiva (v2.2):** `effective = enabled ∧ plan_allows(code, tenant.plan) ∧ ¬override_producto`. En el prototipo: `BE.on(id, p)` devuelve `false` si `BE.planAllows(id)` es falso, aunque `enabled = true`; la configuración (enabled, params) se conserva p… <br>*17 §5 Reglas de negocio*: PLN-R-01 · Regla por plan (v2.2) · Una regla fuera del plan del tenant no aplica (BE.on = false) y no puede activarse (403 `RULE_NOT_IN_PLAN`); la vista previa por plan es solo visual | — |
| `SCOPE_OWNERSHIP` | 403 | 01 | *01 §10 Casos de prueba mínimos (Pest / Playwright)*: CRM-T04 · Ventas U03 lista leads · solo propios + sin asignar; `GET` de LEAD-0231 (U04) → 403 `SCOPE_OWNERSHIP` | components.responses |
| `STALE_VERSION` | 409 | 00 | *00 §5 Reglas de negocio transversales*: SEC-BR-17 · Recursos con `lock_version` requieren `If-Match`; desfase → 409 `STALE_VERSION` · Trait `OptimisticLock` | components.parameters |
| `SUB_DOWNGRADE_BLOCKED` | 422 | 13 | *13 §5 Reglas de negocio*: SUB-BR-03 · Un downgrade se bloquea si el consumo actual supera un límite del plan destino (usuarios, sedes, almacenamiento, API keys, webhooks) o si hay módulos en uso que el destino no incluye (e-commerce con pedidos, CMS publicado, apps con guías/conductor… <br>*13 §6 API REST*: - 422 `PLAN_LIMIT_REACHED` / `SUB_DOWNGRADE_BLOCKED` / `COUPON_INVALID`. <br>*13 §10 Casos de prueba mínimos*: 2. Downgrade Enterprise → Professional con 3 sedes y 38.2 GB → 422 `SUB_DOWNGRADE_BLOCKED` con 2 o más bloqueos. Con consumo dentro del límite → `subscription_changes.scheduled` con `effective_at` = fin de periodo + 1. | — |
| `TENANT_SCOPE_VIOLATION` | 403 | 00, 09 | *00 §5 Reglas de negocio transversales*: SEC-BR-02 (RT 2, E2E-08, PRD-BR-015) · El tenant se resuelve **solo** desde el token (y se contrasta con el host `{slug}.dominio`); se ignora cualquier `tenant_id`/`X-Tenant-Id` del cliente. Recurso de otro tenant → **404** `RESOURCE_NOT_FOUND`; ruta que inte… <br>*00 §10 Casos de prueba mínimos › Pest*: X-02 · `X-Tenant-Id: B` o `?tenant_id=B` con token de A · Datos de A; si la ruta fija tenant → 403 `TENANT_SCOPE_VIOLATION` <br>*00 §11 Cambios y decisiones respecto a la documentación inicial*: 3 · Precisado · E2E-08: recurso de otro tenant → 404 (no revela existencia); intento explícito de fijar otro tenant → 403 `TENANT_SCOPE_VIOLATION`; ambos auditados | — |
| `TENANT_SUSPENDED` | 403 | 00, 09 | *00 §4 Máquinas de estado*: Tenant (efecto en auth) · `suspendido` → login y todas las solicitudes 403 `TENANT_SUSPENDED` · Super Admin <br>*00 §5 Reglas de negocio transversales*: SEC-BR-24 · Tenant suspendido → 403 `TENANT_SUSPENDED` en login y solicitudes · Middleware <br>*09 §5 Reglas de negocio*: TEN-BR-10 · Tenant suspendido: sus usuarios no pueden iniciar sesión; los datos se conservan · Middleware `EnsureTenantActive` (403 `TENANT_SUSPENDED`) | — |

Nota: el conflicto de versión (`If-Match` desactualizado) usa el código `STALE_VERSION` en todas las fuentes (spec 00 SEC-BR-17, contrato, backlog y pruebas Pest). Unificado en la v2.4 del kit.

## 4. IDs de regla devueltos como `code`

Casos en que la especificación indica explícitamente el estado HTTP seguido del ID de regla (p. ej. «422 `RT-14`», «409 RT-4»). Cualquier otra regla de `REGLAS-DE-NEGOCIO.md` se devuelve igual: 422 si es validación de negocio, 409 si es conflicto de estado/disponibilidad, 403 si es de alcance o permiso.

| HTTP | `code` | Módulo | Cuándo ocurre (extracto) |
|---|---|---|---|
| 403 | `APR-BR-03` | 10 · Aprobaciones e inbox | *§10 Casos de prueba mínimos*: 3. Autoaprobación: Manager dueño de COT-00191 no puede aprobarla (403 `APR-BR-03`); Tenant Admin sí. |
| 422 | `APR-BR-05` | 10 · Aprobaciones e inbox | *§10 Casos de prueba mínimos*: 5. Tope: descuento 12 % sin `quotes.discount_override` → 422 `APR-BR-05`; con override aprobado. |
| 409 | `B2B-BR-07` | 08 · Canales y portales | *§6 API REST › 6.1 Back-office B2B*: POST · `/api/v1/channels/b2b/agencies/{id}/unblock` · Desbloquear (`reason`; 409 `B2B-BR-07`) |
| 422 | `CAT-BR-05` | 02 · Catálogo | *§10 Casos de prueba mínimos › 10.2 Pest — reglas del prototipo*: Enviar a revisión sin categoría · 422 CAT-BR-05 |
| 422 | `CAT-PX-01` | 16 · Motor de reservas y centro de reglas | *§10 Casos de prueba mínimos › 10.2 Pest — pasajeros, precio, pago y reglas*: Pax rules con `infant_max_age=4, child_min_age=4` · 422 `CAT-PX-01` |
| 422 | `CAT-RL-01` | 16 · Motor de reservas y centro de reglas | *§3 Modelo de datos PostgreSQL › 3.2 `catalog_product_rule_overrides`*: CHECK en servicio: no se puede crear override si `sys_booking_rules.product_override = false` (422 `CAT-RL-01`). `enabled = true` sobre regla apagada en tenant **no** la activa (CAT-RL-02). |
| 422 | `CAT-RL-01` | 16 · Motor de reservas y centro de reglas | *§10 Casos de prueba mínimos › 10.2 Pest — pasajeros, precio, pago y reglas*: Override sobre regla con `product_override=false` · 422 `CAT-RL-01` |
| 409 | `CFG-BR-05` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-16 · Cambiar moneda base con reservas existentes · 409 CFG-BR-05 |
| 422 | `CFG-BR-07` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-15 · Series: bajar `next_number` · 422 CFG-BR-07 y trigger bloquea update directo |
| 409 | `CRM-BR-04` | 01 · CRM | *§5 Reglas de negocio*: CRM-BR-04 · Si hay duplicados al registrar, el alta exige decisión explícita: `merge` (solo si hay un lead coincidente en nuevo/contactado/calificado), `mark_duplicate` (de la 1ª coincidencia) o `create_new` (queda nota "Registrado pese a coincidencia con X")… |
| 409 | `CRM-BR-04` | 01 · CRM | *§10 Casos de prueba mínimos (Pest / Playwright)*: CRM-T07 · Alta con correo de CLI-0001 sin `duplicate_resolution` · 409 `CRM-BR-04` con coincidencia `client` |
| 409 | `CRM-BR-10` | 01 · CRM | *§10 Casos de prueba mínimos (Pest / Playwright)*: CRM-T11 · `status=calificado` con score 40 / `contactado` sin owner / `status=convertido` · 409 `CRM-BR-10` / 409 `CRM-BR-11` / 422 |
| 409 | `CRM-BR-11` | 01 · CRM | *§10 Casos de prueba mínimos (Pest / Playwright)*: CRM-T11 · `status=calificado` con score 40 / `contactado` sin owner / `status=convertido` · 409 `CRM-BR-10` / 409 `CRM-BR-11` / 422 |
| 409 | `CRM-BR-12` | 01 · CRM | *§10 Casos de prueba mínimos (Pest / Playwright)*: CRM-T13 · Convertir lead `contactado` · 409 `CRM-BR-12` |
| 409 | `CRM-BR-16` | 01 · CRM | *§10 Casos de prueba mínimos (Pest / Playwright)*: CRM-T14 · Convertir lead calificado con cliente nuevo (DNI 7 dígitos; RUC que empieza en 30; empresa peruana con DNI; DNI existente) · 422 / 422 / 422 / 409 `CRM-BR-16` |
| 409 | `CRM-BR-41` | 01 · CRM | *§10 Casos de prueba mínimos (Pest / Playwright)*: CRM-T26 · Segunda encuesta a la misma reserva · 409 `CRM-BR-41` |
| 422 | `CUP-BR-002` | 11 · Cupos y documentos de viaje | *§10 Casos de prueba mínimos*: 4. Crear contrato con servicio de otro proveedor → 422 CUP-BR-002; solapado → 409 CUP-BR-003. |
| 409 | `CUP-BR-003` | 11 · Cupos y documentos de viaje | *§10 Casos de prueba mínimos*: 4. Crear contrato con servicio de otro proveedor → 422 CUP-BR-002; solapado → 409 CUP-BR-003. |
| 422 | `CUP-BR-005` | 11 · Cupos y documentos de viaje | *§10 Casos de prueba mínimos*: 5. Liberar más que disponible → 422 CUP-BR-005; concurrencia de dos liberaciones → una 409 (lock). |
| 422 | `DOC-BR-001` | 11 · Cupos y documentos de viaje | *§10 Casos de prueba mínimos*: 9. Validar pasaporte de extranjero con vencimiento < fin + 6 meses → 422 DOC-BR-001 (caso Johnson 10/03/2027 vs 23/04/2027). |
| 422 | `DOC-BR-009` | 11 · Cupos y documentos de viaje | *§10 Casos de prueba mínimos*: 11. Nota de atención especial con término clínico → 422 DOC-BR-009. |
| 422 | `DOC-BR-010` | 11 · Cupos y documentos de viaje | *§5 Reglas de negocio*: DOC-BR-010 · **Bloqueo operativo**: no se emiten entradas nominativas MAPI (servicio con proveedor Ministerio de Cultura o producto no-paquete que incluye la entrada) ni su voucher si algún pasajero no tiene `id_doc` = completo y, si es menor, `minor_auth` = … |
| 422 | `ECO-BR-01` | 08 · Canales y portales | *§6 API REST › 6.3 E-commerce*: POST · `/api/v1/channels/ecommerce/products/{id}/publish` · `/unpublish` · Publicar/retirar (422 `ECO-BR-01`) |
| 422 | `FIN-BR-48` | 07 · Finanzas | *§10 Casos de prueba mínimos › 10.1 Pest (feature)*: T20 · Periodo cerrado: emitir con fecha del periodo → 422 `FIN-BR-48`; marcar control sin permiso → 403 |
| 422 | `INB-BR-02` | 10 · Aprobaciones e inbox | *§10 Casos de prueba mínimos*: 16. Ventana 24 h: texto libre fuera de ventana → 422 `INB-BR-02`; plantilla aprobada → 202. |
| 422 | `INT-BR-02` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-21 · Integración `por_validar` a Producción · 422 INT-BR-02 |
| 409 | `MET-BR-01` | 14 · Marketing y metas | *§10 Casos de prueba mínimos*: 13 · Pest · Meta duplicada alcance+período → 409 MET-BR-01; período terminado → 422 |
| 403 | `MET-BR-05` | 14 · Marketing y metas | *§6 API REST*: POST · `/api/v1/crm/sales-targets/{code}/adjust` · `{goals, bonus_amount, reason}`; 403 `MET-BR-05` si reduce y no es Tenant Admin |
| 403 | `MET-BR-05` | 14 · Marketing y metas | *§10 Casos de prueba mínimos*: 14 · Pest · Manager reduce meta vigente al 97 % del período → 403 MET-BR-05; Tenant Admin → OK con ajuste auditado |
| 422 | `MET-BR-06` | 14 · Marketing y metas | *§10 Casos de prueba mínimos*: 15 · Pest · Cerrar antes de fin de período → 422 MET-BR-06; cerrar MET con 112,9 % y bono S/ 600 → comisión «Bono por meta» S/ 600 calculada; repetir cierre → sin segunda comisión |
| 422 | `MKT-BR-03` | 14 · Marketing y metas | *§10 Casos de prueba mínimos*: 6 · Pest · WA con plantilla en revisión: programar, probar y enviar → 422 MKT-BR-03 |
| 422 | `MKT-BR-04` | 14 · Marketing y metas | *§10 Casos de prueba mínimos*: 5 · Pest · Programar sin envío de prueba → 422 MKT-BR-04; editar contenido invalida pruebas |
| 422 | `MKT-BR-05` | 14 · Marketing y metas | *§10 Casos de prueba mínimos*: 7 · Pest · Programar < 15 min o WA a las 21:00 → 422 MKT-BR-05 |
| 422 | `MKT-BR-07` | 14 · Marketing y metas | *§5 Reglas de negocio*: MKT-BR-07 · No se programa ni envía una campaña con 0 destinatarios elegibles · Service (422 `MKT-BR-07`) |
| 409 | `MKT-BR-12` | 14 · Marketing y metas | *§6 API REST*: GET/PUT/DELETE · `/api/v1/marketing/segments/{code}` · Ver / editar / eliminar (409 MKT-BR-12) |
| 409 | `MKT-BR-12` | 14 · Marketing y metas | *§10 Casos de prueba mínimos*: 12 · Pest · Segmento usado por campaña: DELETE → 409 MKT-BR-12 |
| 422 | `NTF-BR-01` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-18 · Desactivar todos los canales de incidencia crítica · 422 NTF-BR-01 |
| 422 | `NTF-BR-03` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-19 · Plantilla con `{{precio}}` o push de 141 caracteres · 422 NTF-BR-03/04 |
| 422 | `NTF-BR-04` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-19 · Plantilla con `{{precio}}` o push de 141 caracteres · 422 NTF-BR-03/04 |
| 422 | `PRD-ACT-CHECKLIST` | 02 · Catálogo | *§6 API REST (`/api/v1`) › 6.1 Productos y ciclo de vida*: POST · `/catalog/products/{id}/activate` · →ACTIVE; 422 `PRD-ACT-CHECKLIST` con fallidos (y audit) |
| 422 | `PRD-BR-002` | 02 · Catálogo | *§10 Casos de prueba mínimos › 10.1 Pest (feature) — casos de la Spec PRD §43*: PRD-T04 · Agregar producto SUSPENDED a cotización / hold / confirmación · 422 `PRD-BR-002` |
| 422 | `PRD-BR-002` | 03 · Cotizaciones | *§10 Casos de prueba mínimos*: T-Q05 · Producto `SUSPENDED` o `quoteable=false` → 422 `PRD-BR-002`; tarifa fuera de vigencia → 422 `PRD-BR-005` · Pest feature |
| 422 | `PRD-BR-004` | 02 · Catálogo | *§6 API REST (`/api/v1`) › 6.2 Sub-recursos del producto*: GET / POST · `/catalog/products/{id}/rates` · Tarifas visibles al rol / alta (422 PRD-BR-004/005) |
| 422 | `PRD-BR-005` | 02 · Catálogo | *§6 API REST (`/api/v1`) › 6.2 Sub-recursos del producto*: GET / POST · `/catalog/products/{id}/rates` · Tarifas visibles al rol / alta (422 PRD-BR-004/005) |
| 422 | `PRD-BR-005` | 03 · Cotizaciones | *§10 Casos de prueba mínimos*: T-Q05 · Producto `SUSPENDED` o `quoteable=false` → 422 `PRD-BR-002`; tarifa fuera de vigencia → 422 `PRD-BR-005` · Pest feature |
| 422 | `PRD-BR-007` | 02 · Catálogo | *§10 Casos de prueba mínimos › 10.1 Pest (feature) — casos de la Spec PRD §43*: PRD-T07 · Componente de proveedor inactivo / servicio vencido · 422 `PRD-BR-007`; activación bloqueada |
| 409 | `PRD-BR-012` | 04 · Reservas | *§10 Casos de prueba mínimos*: T-R03 · Carrera de cupos: dos conversiones sobre la misma salida con cupo para una sola → una 201, otra 409 `PRD-BR-012`; `sold ≤ capacity` · Pest feature |
| 409 | `PRD-BR-018` | 02 · Catálogo | *§5 Reglas de negocio › 5.2 Reglas del módulo (nuevas)*: CAT-BR-08 · Eliminar: solo sin cotizaciones, reservas, operaciones ni paquetes que lo incluyan; motivo obligatorio; soft delete · S → 409 `PRD-BR-018` |
| 409 | `PRD-BR-018` | 02 · Catálogo | *§6 API REST (`/api/v1`) › 6.1 Productos y ciclo de vida*: DELETE · `/catalog/products/{id}` · Soft delete con `reason`; 409 `PRD-BR-018` con `{quotes, reservations, operations, packages}` |
| 422 | `QTE-BR-08` | 03 · Cotizaciones | *§10 Casos de prueba mínimos*: T-Q06 · Descuento 12 % por Ventas → 422 `QTE-BR-08`; por Manager → OK y auditado · Pest feature |
| 409 | `QTE-BR-12` | 03 · Cotizaciones | *§5 Reglas de negocio › 5.2 Reglas*: QTE-BR-12 · No se envía al cliente una versión con QTE-BR-11 sin aprobación interna · Service (409 `QTE-BR-12`) |
| 409 | `QTE-BR-12` | 03 · Cotizaciones | *§10 Casos de prueba mínimos*: T-Q07 · Margen < 15 % → send 409 `QTE-BR-12`; solicitud → manager aprueba → send OK · Pest feature |
| 409 | `QTE-BR-16` | 03 · Cotizaciones | *§10 Casos de prueba mínimos*: T-Q10 · Vencida: approve 409 `QTE-BR-16`; nueva versión → borrador con validez +10 d · Pest feature |
| 422 | `RBAC-BR-02` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-12 · Revocar `admin.users.manage` a tenant_admin; otorgar `finance.receivables` a rol `canal`; otorgar `admin.tenant.manage` a manager · 422 RBAC-BR-02/04/05 |
| 422 | `RBAC-BR-04` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-12 · Revocar `admin.users.manage` a tenant_admin; otorgar `finance.receivables` a rol `canal`; otorgar `admin.tenant.manage` a manager · 422 RBAC-BR-02/04/05 |
| 422 | `RBAC-BR-05` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-12 · Revocar `admin.users.manage` a tenant_admin; otorgar `finance.receivables` a rol `canal`; otorgar `admin.tenant.manage` a manager · 422 RBAC-BR-02/04/05 |
| 422 | `RT-10` | 07 · Finanzas | *§10 Casos de prueba mínimos › 10.1 Pest (feature)*: T16 · Fiscal: factura con DNI → 422 `RT-10`; boleta con RUC → 422; NC sin referencia o sobre comprobante no aceptado → 422; importe > máximo facturable → 422 |
| 422 | `RT-11` | 05 · Operaciones y móvil | *§10 Casos de prueba mínimos › Pest (feature)*: T-11 · Voucher: servicio `solicitado` → 422 RT-11; segundo voucher vigente → 409; proveedor inactivo → 422; nueva versión incrementa versión y guarda snapshot; anular sin motivo → 422; acciones sobre anulado → 409 |
| 422 | `RT-14` | 07 · Finanzas | *§10 Casos de prueba mínimos › 10.1 Pest (feature)*: T06 · Crédito B2B: agencia bloqueada → 422 `RT-14`; crédito insuficiente → 422; OK suma `credit_used`; revertir resta |
| 422 | `RT-14` | 08 · Canales y portales | *§10 Casos de prueba mínimos › Pest (feature)*: T04 · RT-14: producto sin tarifa para la agencia o con tarifa vencida → 422 `RT-14`. |
| 409 | `RT-3` | 04 · Reservas | *§4 Máquinas de estado › 4.3 Conversión idempotente cotización → reserva (PROC-025), paso a paso*: 5 · Precondiciones (RT-3) · `status='aprobada'` (si no: 409 `RT-3` "solo una cotización aprobada puede generar reserva (estado actual: …)"); versión vigente `aprobada`; ≥ 1 ítem; pax > 0; fechas; total > 0; cliente existente |
| 409 | `RT-3` | 04 · Reservas | *§10 Casos de prueba mínimos*: T-R04 · Convertir cotización `enviada` → 409 `RT-3` · Pest feature |
| 409 | `RT-4` | 04 · Reservas | *§4 Máquinas de estado › 4.3 Conversión idempotente cotización → reserva (PROC-025), paso a paso*: 7 · Re-verificar disponibilidad dentro de la transacción · `availFor(product, date, pax)`: producto `ACTIVE` (si no, PRD-BR-002); POR_SALIDA: debe existir salida ese día y `capacity − sold ≥ pax` (si no, 409 `RT-4/PRD-BR-012` con alternativas = otras salidas … |
| 409 | `RT-4` | 15 · Sitio web público | *§6 API REST › 6.2 Precio, disponibilidad, carrito*: POST · `/public/carts/current/items` · Añade línea; crea hold (409 `RT-4` si no hay cupos) |
| 422 | `RT-9` | 08 · Canales y portales | *§10 Casos de prueba mínimos › Pest (feature)*: T20 · Pago en portal cliente: monto > saldo → 422 `RT-9`; pago parcial → CxC `parcial`. |
| 409 | `SED-BR-02` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-11 · Crear sede sobre límite; desactivar sede con usuarios; eliminar sede con reservas · 409 SED-BR-02/03/04 |
| 409 | `SED-BR-03` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-11 · Crear sede sobre límite; desactivar sede con usuarios; eliminar sede con reservas · 409 SED-BR-02/03/04 |
| 409 | `SED-BR-04` | 09 · Administración y reportes | *§6 API REST › 6.2 Usuarios y sedes (PROC-002)*: DELETE · `/api/v1/iam/sedes/{id}` · Solo sin referencias (409 `SED-BR-04`) |
| 409 | `SED-BR-04` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-11 · Crear sede sobre límite; desactivar sede con usuarios; eliminar sede con reservas · 409 SED-BR-02/03/04 |
| 409 | `SIT-BR-07` | 15 · Sitio web público | *§10 Casos de prueba mínimos › Pest (feature)*: 5. Hold vencido: job lo expira; checkout lo re-bloquea si hay cupos; sin cupos → 409 SIT-BR-07. |
| 422 | `SIT-BR-09` | 15 · Sitio web público | *§10 Casos de prueba mínimos › Pest (feature)*: 7. Anticipo: primera fecha a 10 días → 422 SIT-BR-09; a 20 días → 40 %; a 60 días → 30 % + CxC saldo con vencimiento −15 días. |
| 409 | `TEN-BR-07` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-05 · Suspender tenant propio de la sesión · 409 TEN-BR-07 |
| 409 | `TEN-BR-09` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-07 · Downgrade a Starter con 9 usuarios · 409 TEN-BR-09 |
| 422 | `USR-BR-01` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-08 · Invitar con plan lleno / correo duplicado (mayúsculas) · 409 USR-BR-02 / 422 USR-BR-01 |
| 409 | `USR-BR-02` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-08 · Invitar con plan lleno / correo duplicado (mayúsculas) · 409 USR-BR-02 / 422 USR-BR-01 |
| 409 | `USR-BR-04` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-09 · Tenant Admin cambia su propio rol / se desactiva / desactiva al último TA · 403/409 USR-BR-04/06/05 |
| 409 | `USR-BR-05` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-09 · Tenant Admin cambia su propio rol / se desactiva / desactiva al último TA · 403/409 USR-BR-04/06/05 |
| 409 | `USR-BR-06` | 09 · Administración y reportes | *§10 Casos de prueba mínimos › Pest (feature)*: T-09 · Tenant Admin cambia su propio rol / se desactiva / desactiva al último TA · 403/409 USR-BR-04/06/05 |

## 5. Errores por módulo (resumen)

| Spec | Módulo | Códigos |
|---|---|---|
| 00 | Transversal (seguridad y RBAC) | `IDEMPOTENCY_IN_PROGRESS`, `IDEMPOTENCY_KEY_REUSED`, `MFA_REQUIRED`, `RESOURCE_NOT_FOUND`, `STALE_VERSION`, `TENANT_SCOPE_VIOLATION`, `TENANT_SUSPENDED` |
| 01 | CRM | 409 `CRM-BR-04`, 409 `CRM-BR-10`, 409 `CRM-BR-11`, 409 `CRM-BR-12`, 409 `CRM-BR-16`, 409 `CRM-BR-41`, `SCOPE_OWNERSHIP` |
| 02 | Catálogo | 409 `PRD-BR-018`, 422 `CAT-BR-05`, 422 `PRD-ACT-CHECKLIST`, 422 `PRD-BR-002`, 422 `PRD-BR-004`, 422 `PRD-BR-005`, 422 `PRD-BR-007` |
| 03 | Cotizaciones | 409 `QTE-BR-12`, 409 `QTE-BR-16`, 422 `PRD-BR-002`, 422 `PRD-BR-005`, 422 `QTE-BR-08` |
| 04 | Reservas | 409 `PRD-BR-012`, 409 `RT-3`, 409 `RT-4` |
| 05 | Operaciones y móvil | 422 `RT-11` |
| 07 | Finanzas | 422 `FIN-BR-48`, 422 `RT-10`, 422 `RT-14` |
| 08 | Canales y portales | 409 `B2B-BR-07`, 422 `ECO-BR-01`, 422 `RT-14`, 422 `RT-9`, `RULE_NOT_IN_PLAN` |
| 09 | Administración y reportes | 409 `CFG-BR-05`, 409 `SED-BR-02`, 409 `SED-BR-03`, 409 `SED-BR-04`, 409 `TEN-BR-07`, 409 `TEN-BR-09`, 409 `USR-BR-02`, 409 `USR-BR-04`, 409 `USR-BR-05`, 409 `USR-BR-06`, 422 `CFG-BR-07`, 422 `INT-BR-02`, 422 `NTF-BR-01`, 422 `NTF-BR-03`, 422 `NTF-BR-04`, 422 `RBAC-BR-02`, 422 `RBAC-BR-04`, 422 `RBAC-BR-05`, 422 `USR-BR-01`, `PLAN_LIMIT_EXCEEDED`, `RESOURCE_NOT_FOUND`, `TENANT_SCOPE_VIOLATION`, `TENANT_SUSPENDED` |
| 10 | Aprobaciones e inbox | 403 `APR-BR-03`, 422 `APR-BR-05`, 422 `INB-BR-02` |
| 11 | Cupos y documentos de viaje | 409 `CUP-BR-003`, 422 `CUP-BR-002`, 422 `CUP-BR-005`, 422 `DOC-BR-001`, 422 `DOC-BR-009`, 422 `DOC-BR-010` |
| 13 | Plataforma SaaS y API | `COUPON_INVALID`, `FEATURE_NOT_IN_PLAN`, `PAYMENT_REQUIRED`, `PLAN_LIMIT_REACHED`, `QUOTA_EXCEEDED`, `RATE_LIMITED`, `SUB_DOWNGRADE_BLOCKED` |
| 14 | Marketing y metas | 403 `MET-BR-05`, 409 `MET-BR-01`, 409 `MKT-BR-12`, 422 `MET-BR-06`, 422 `MKT-BR-03`, 422 `MKT-BR-04`, 422 `MKT-BR-05`, 422 `MKT-BR-07` |
| 15 | Sitio web público | 409 `RT-4`, 409 `SIT-BR-07`, 422 `SIT-BR-09` |
| 16 | Motor de reservas y centro de reglas | 422 `CAT-PX-01`, 422 `CAT-RL-01`, `AVAIL_CHANGED`, `QUOTE_CHANGED` |
| 17 | Reglas, comunicaciones, monedas, reseñas e integración web | `RULE_NOT_IN_PLAN` |
| 18 | Reseñas propias | `RULE_NOT_IN_PLAN` |

