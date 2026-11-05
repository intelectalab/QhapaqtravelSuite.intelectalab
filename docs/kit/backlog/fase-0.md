# Backlog · Fase 0 — Fundaciones

Alcance: repositorios, CI, tenancy con RLS, autenticación Sanctum + MFA, IAM/RBAC (ACCESS y ROLE_UX), auditoría, secuencias, idempotencia, outbox, colas, notificaciones básicas, documentos PDF, configuración del tenant, shell Next.js por experiencia y pantalla 403.
Especificaciones: `00-transversal-seguridad-rbac.md` y `09-administracion-reportes.md` (usuarios, sedes, roles, configuración, notificaciones, auditoría, jobs).
Criterio de salida (03-PLAN §2): E2E-08 (aislamiento) y pruebas RBAC en verde.

Archivo tabular equivalente: `fase-0.csv`.

## Resumen

| Épica | Nombre | Historias |
|---|---|---|
| E0.1 | Repositorios, entorno y convenciones de código | 4 |
| E0.2 | Multi-tenancy y RLS | 6 |
| E0.3 | Autenticación, sesiones y MFA | 5 |
| E0.4 | IAM: usuarios, sedes, roles y permisos | 8 |
| E0.5 | Servicios transversales del núcleo | 9 |
| E0.6 | Configuración, notificaciones y auditoría (administración) | 5 |
| E0.7 | Shell Next.js por experiencia y pantallas de administración | 9 |
| E0.8 | Datos semilla y pruebas de salida de fase | 3 |
| **Total** | | **49** |

Prioridad: P0 = imprescindible para el criterio de salida · P1 = necesaria en la fase · P2 = puede pasar a la fase siguiente sin bloquear.

Cobertura referencial: 70 endpoints, 38 tablas citadas, 40 casos de prueba de las especificaciones.

## Cómo usar este backlog con Claude Code

1. Trabajar una historia por sesión, en el orden de dependencias (columna «Depende de»).
2. Entregar a Claude Code el bloque completo de la historia más las secciones de especificación citadas; los criterios de aceptación son la definición de «hecho» de la sesión.
3. Cerrar la historia solo con sus pruebas en verde y la especificación actualizada si hubo cambios (sección 11 y `CHANGELOG.md`).

## Supuestos y decisiones que afectan esta fase

- Se agrega el permiso `crm.records.reassign` (hallazgo H-18, propuesto en 01 §11 #24) al catálogo de 00 §7.1: el seeder carga 58 permisos; se asigna a Tenant Admin y Manager.
- `admin.tenant.manage` es exclusivo de plataforma y no se asigna dentro de un tenant (decisión propuesta en 09 §11 #10).
- Las especificaciones 01, 02 y 16 nombran la bitácora `audit_logs`; se usa `audit_events` (00 §3.6) como única tabla.
- `sys_documents` no tiene columnas definidas en ninguna especificación; F0-30 propone un esquema mínimo a confirmar.
- Falta de `Idempotency-Key` en una ruta que la exige: la especificación no define la respuesta; se propone 422 `IDEMPOTENCY_KEY_REQUIRED`.
- Resolución de solicitudes de acceso (`iam_access_requests` → `atendida`/`rechazada`): sin endpoint en la especificación; se deja como supuesto.
- MFA obligatorio para Super Admin, Tenant Admin, Manager, Finanzas y Contabilidad (propuesta 09 §12-4), parametrizable.
- Correo saliente por SMTP configurable (mailpit en local) mientras se decide el dominio y proveedor (D-03). WhatsApp y Push quedan como adaptadores sin proveedor hasta Fase 2.
- Vínculos de `iam_users` a tablas de fases posteriores (`client_id`, `agency_id`, `provider_id`, `guide_id`, `driver_id`, `reservation_id`) se crean sin FK; cada módulo agrega su FK en su migración.
- Reinicio anual de correlativos internos y retenciones (auditoría 5 años, idempotencia 24 h) según propuestas de 00 §12 #10–11, pendientes de confirmación.

## Fuera de alcance de esta fase

- Asistente visual de alta de tenant (11 pasos), cambio de plan, salud por tenant y facturación de plataforma: Fase 3 (spec 13). En Fase 0 el alta se hace por Action, comando y API mínima.
- Integraciones (`integration_adapters`, `integration_errors`, prueba de conexión) y adaptadores OSE, pasarela y WhatsApp: Fase 2.
- Reportes, exportaciones (`report_exports`), panel ejecutivo y bandeja del Manager: Fase 1 parte B (reportes básicos) y Fase 3 (avanzados).
- Sesión delegada de soporte de plataforma (09 §12-5): sin definir.

## Historias

### E0.1 · Repositorios, entorno y convenciones de código

#### F0-01 · Monorepo de trabajo y Docker Compose local

**Historia:** Como desarrollador, quiero levantar todo el stack con un comando, para programar y probar con los mismos servicios que producción.

**Especificación:** 02-ARQUITECTURA §2, §8

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Repos `backend` (Laravel 12, PHP 8.4) y `web` (Next.js App Router, TypeScript estricto) creados; `mobile` e `infra` solo como carpetas vacías con README de una línea.
2. `docker compose up` levanta php-fpm 8.4 (u Octane/FrankenPHP), nginx, postgres:17, redis:8, horizon, reverb, minio y mailpit; healthchecks en verde.
3. `.env.example` completo (DB con usuario `app_role` sin BYPASSRLS y `platform_role`, Redis, S3→minio, MAIL→mailpit, REVERB).
4. `make test` / `composer test` ejecuta Pest contra PostgreSQL y Redis reales del compose (no SQLite).

**Pruebas:** Smoke: `GET /api/v1/health` 200 con estado de DB, Redis y S3.

**Depende de:** — · **Prioridad:** P0

#### F0-02 · Pipeline de CI backend y web

**Historia:** Como equipo técnico, quiero que cada push valide estilo, tipos y pruebas, para no integrar regresiones.

**Especificación:** 02-ARQUITECTURA §8 (CI)

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Backend: Pint, Larastan (nivel ≥ 6) y Pest con servicios PostgreSQL 17 y Redis 8 en el runner.
2. Web: ESLint, `tsc --noEmit`, Vitest; build de Next.js sin errores.
3. Playwright se ejecuta en un job separado (manual o nightly) contra el entorno de staging.
4. El pipeline falla si una migración no es reversible (`migrate` + `migrate:rollback` + `migrate`).

**Pruebas:** Pipeline verde en rama principal.

**Depende de:** F0-01 · **Prioridad:** P0

#### F0-03 · Núcleo `Domain/Shared`: UUID v7, dinero, máquina de estados, bloqueo optimista y formato de error

**Historia:** Como desarrollador, quiero piezas base comunes, para que todos los módulos apliquen las mismas convenciones.

**Especificación:** CONVENCIONES §2–3; 00 §5 (SEC-BR-16/17/19/21), §6 (formato de error)

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Estructura `app/Domain/{Shared,Iam,Platform,Crm,Catalog,…}` con `Models/Actions/StateMachines/Policies/Http/Events/Listeners/Jobs/Data`.
2. Modelos con `HasUuids` (v7). Cast `Money` sobre `numeric(14,2)` + `currency` con brick/math; se prohíbe `float` (regla Larastan o test arquitectónico).
3. Clase base `StateMachine` (transiciones declaradas, `TransitionNotAllowed` → 409 con `code`).
4. Trait `OptimisticLock`: exige `If-Match`/`lock_version`; desfase → 409 `STALE_VERSION`.
5. Handler de excepciones que responde `{error, code, message, required_permissions?, correlation_id}`; 422 de validación con `errors{campo:[msg]}`.
6. Middleware `CorrelationId`: toma o genera `X-Request-Id` y lo devuelve en la respuesta; logs JSON con `tenant_id`, `user_id`, `correlation_id`.

**Pruebas:** Pest unit: Money sin float; StateMachine; OptimisticLock 409; formato de error.

**Depende de:** F0-01 · **Prioridad:** P0

#### F0-04 · OpenAPI 3.1 y cliente tipado para `web`

**Historia:** Como desarrollador frontend, quiero tipos generados desde la API, para no duplicar contratos a mano.

**Especificación:** CONVENCIONES §3 (OpenAPI); 02-ARQUITECTURA §2

**Tablas:** —

**Endpoints:** `GET /docs/api.json` (scramble)

**Pantallas:** —

**Criterios de aceptación:**

1. `dedoc/scramble` publica el OpenAPI 3.1 de `/api/v1`.
2. Script `npm run api:gen` genera tipos (`openapi-typescript` u `orval`) en `web/src/api/`.
3. CI falla si el cliente generado está desactualizado respecto al OpenAPI.

**Pruebas:** CI: diff vacío tras `api:gen`.

**Depende de:** F0-02 · **Prioridad:** P1

### E0.2 · Multi-tenancy y RLS

#### F0-05 · Tablas de plataforma: planes, entitlements y tenants

**Historia:** Como Super Admin, quiero que existan tenants y planes con sus límites, para aislar agencias y aplicar entitlements.

**Especificación:** 09 §3.1–3.5, §3.18; CONVENCIONES §1

**Tablas:** `plans`, `plan_features`, `plan_channels`, `tenants`, `tenant_onboarding`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Migraciones con CHECK de `tenants.ruc` (`^(10|15|17|20)[0-9]{9}$`), `subdomain` (`^[a-z0-9-]{3,30}$`), `status IN (prueba,activo,suspendido)` y `status <> 'suspendido' OR suspend_reason IS NOT NULL`.
2. UNIQUE global de `ruc`, `subdomain`, `custom_domain`; `lock_version` en `tenants`.
3. Seeder de los 3 planes (Starter/Professional/Enterprise), 18 `plan_features` y 8 `plan_channels` con los valores del prototipo (`seeds/plans.json`, `planCatalogDemo.json`).
4. Estas tablas no tienen `tenant_id` ni RLS y solo las lee la conexión `platform_role` o los servicios de plataforma.

**Pruebas:** Pest: CHECK de RUC/subdominio rechaza `30123456789` y `AB` (base de T-03).

**Depende de:** F0-03 · **Prioridad:** P0

#### F0-06 · Aislamiento por tenant: trait `BelongsToTenant` + RLS con falla cerrada

**Historia:** Como Tenant Admin, quiero que ningún usuario de otra agencia pueda leer mis datos, aun con un error de código.

**Especificación:** 00 §3.11, §5 SEC-BR-01/02, §11 #2; CONVENCIONES §1; 02-ARQUITECTURA §4

**Tablas:** Todas las tablas de negocio (patrón)

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Macro de migración `$table->tenant()` que agrega `tenant_id uuid not null` + FK + índice y ejecuta `ENABLE` y `FORCE ROW LEVEL SECURITY` + política `tenant_isolation` (USING y WITH CHECK con `current_setting('app.tenant_id', true)`).
2. Trait `BelongsToTenant`: global scope y asignación de `tenant_id` en `creating` desde el contexto; cualquier `tenant_id` del request se ignora.
3. Rol de conexión `app_role` sin BYPASSRLS; `platform_role` separado con políticas solo sobre tablas de plataforma.
4. Test arquitectónico: toda tabla con columna `tenant_id` tiene RLS forzado (consulta a `pg_class.relforcerowsecurity`).

**Pruebas:** X-03 (sin `app.tenant_id` → 0 filas; INSERT viola política).

**Depende de:** F0-05 · **Prioridad:** P0

#### F0-07 · Cadena de middleware de tenant por solicitud

**Historia:** Como plataforma, quiero resolver el tenant solo desde el token y el host, para que un cliente no pueda forzar otro tenant.

**Especificación:** 00 §5 SEC-BR-01/02/24, §11 #1, #3; 09 §5 TEN-BR-10

**Tablas:** `tenants`

**Endpoints:** Todas las rutas `/api/v1/*` autenticadas

**Pantallas:** —

**Criterios de aceptación:**

1. Orden: `auth:sanctum` → `ResolveTenant` (token + contraste con host `{slug}.dominio`) → `EnsureTenantActive` → `EnsureMfaVerified` → `SetDbTenant` → `SetPermissionsTeam` → `EnsureExperience` → Policy.
2. `SetDbTenant` ejecuta `select set_config('app.tenant_id', :id, true)` dentro de la transacción del request (compatible con PgBouncer transaccional y Octane).
3. `X-Tenant-Id` o `tenant_id` en query/body se ignoran; si una ruta intenta fijar otro tenant → 403 `TENANT_SCOPE_VIOLATION`; recurso de otro tenant → 404 `RESOURCE_NOT_FOUND`; ambos auditados como `acceso_denegado` y evento `CrossTenantAttempt`.
4. Tenant suspendido → 403 `TENANT_SUSPENDED` en login y en cada solicitud.
5. Cache y locks con prefijo `t:{tenant_id}:`.

**Pruebas:** X-01, X-02, X-12, T-01, T-02, T-06.

**Depende de:** F0-06, F0-11, F0-24 · **Prioridad:** P0

#### F0-08 · Jobs y eventos conscientes del tenant

**Historia:** Como plataforma, quiero que cada job se ejecute con el tenant que lo originó, para que las colas no mezclen datos.

**Especificación:** 00 §3.11 (Jobs), §8.2; 02-ARQUITECTURA §4.4

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Middleware de job `TenantAware`: serializa `tenant_id` al despachar y fija `app.tenant_id` antes de `handle()`.
2. Un job de negocio sin tenant falla explícitamente (excepción `MissingTenantContext`) y no procesa datos.
3. Listeners de eventos de dominio usan `afterCommit` por defecto.

**Pruebas:** X-04.

**Depende de:** F0-07 · **Prioridad:** P0

#### F0-09 · Aprovisionamiento de tenant (Action + comando + API mínima)

**Historia:** Como Super Admin, quiero dar de alta un tenant con todo su arranque en una sola transacción, para operar desde el primer día.

**Especificación:** 09 §4.1, §5 TEN-BR-01..04, 06, 12, §6.1 (alta, validate-step), §8.1 `TenantProvisioned`

**Tablas:** `tenants`, `tenant_onboarding`, `iam_sedes`, `iam_users`, `iam_user_invitations`, `roles`, `role_has_permissions`, `sys_settings`, `sys_sequences`, `notif_event_rules`, `sys_booking_rules`

**Endpoints:** `POST /api/v1/platform/tenants` (Idempotency-Key), `POST /api/v1/platform/tenants/validate-step`, `GET /api/v1/platform/tenants`, `GET /api/v1/platform/tenants/{id}`

**Pantallas:** — (el asistente visual de 11 pasos es Fase 3)

**Criterios de aceptación:**

1. Action `ProvisionTenant` crea en una transacción: tenant (`prueba` con `trial_ends_at` +14 d o `activo`), sede principal, 12 roles base copiados con la plantilla elegida (`estandar`, `minimo_privilegio` según TEN-BR-12, `copiar_tenant`), `sys_settings` por defecto, `sys_sequences` (COT, RES, OP, VOU, F001, B001 con los números del prototipo), `notif_event_rules` por defecto, `sys_booking_rules` desde la plantilla de plataforma y el administrador en estado `pendiente` con invitación.
2. Comando `php artisan tenant:provision --file=tenant.json` usa la misma Action.
3. Validaciones TEN-BR-01..03 y 05 con los mensajes de la especificación; misma `Idempotency-Key` → un solo tenant (T-04).
4. Audita `Tenant alta` y emite `TenantProvisioned` (invitación en cola `notifications`).

**Pruebas:** T-03, T-04.

**Depende de:** F0-16, F0-17, F0-20, F0-25, F0-26, F0-33 · **Prioridad:** P0

#### F0-10 · Suspender y reactivar tenant

**Historia:** Como Super Admin, quiero suspender o reactivar un tenant con motivo, para gestionar impagos o incidentes sin borrar datos.

**Especificación:** 09 §4.1, §5 TEN-BR-07/08/10, §6.1; 00 §8.3 `TokensRevoked`

**Tablas:** `tenants`, `personal_access_tokens`

**Endpoints:** `POST /api/v1/platform/tenants/{id}/suspend`, `POST /api/v1/platform/tenants/{id}/reactivate` (lock_version)

**Pantallas:** —

**Criterios de aceptación:**

1. Motivo obligatorio; queda en auditoría (`suspender`/`reactivar`).
2. Suspender revoca todos los tokens del tenant (cola `critical`) y pausa sus jobs programados.
3. No se puede suspender el tenant de la sesión activa → 409 `TEN-BR-07` (aplica a sesiones delegadas futuras).
4. Reactivar fija `mrr` = precio del plan si era 0.

**Pruebas:** T-05, T-06, X-12.

**Depende de:** F0-09, F0-13 · **Prioridad:** P1

### E0.3 · Autenticación, sesiones y MFA

#### F0-11 · Login con Sanctum y tokens por experiencia

**Historia:** Como usuario interno o externo, quiero iniciar sesión con correo y contraseña, para acceder a mi experiencia.

**Especificación:** 00 §3.4, §4 (Sesión), §5 SEC-BR-25, §6 (auth/login, logout), §8.3

**Tablas:** `personal_access_tokens` (+ `tenant_id`, `experience`, `mfa_verified_at`, `device_name`, `ip`), `iam_users`

**Endpoints:** `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`

**Pantallas:** —

**Criterios de aceptación:**

1. Tenant resuelto por host (`tenant_slug` opcional solo en entornos locales); credenciales inválidas → 401 genérico y audit `login_fallido` en transacción propia.
2. Si el usuario requiere MFA, el token emitido solo tiene ability `mfa:verify`.
3. Expiración: back-office 12 h deslizante, portales 7 d, móvil 30 d con refresh; `experience` tomado de ROLE_UX.
4. Rate limit login 5/min por IP+email (Redis) → 429.
5. Audita `login` (`OK`/`MFA OK`) y `logout`; actualiza `last_login_at/ip`.

**Pruebas:** Pest: login OK/fallido, rate limit, token sin MFA → 403 `MFA_REQUIRED` (X-11).

**Depende de:** F0-06, F0-17 · **Prioridad:** P0

#### F0-12 · MFA TOTP: enrolamiento, verificación y códigos de recuperación

**Historia:** Como usuario interno, quiero proteger mi cuenta con un segundo factor, para que una contraseña filtrada no baste.

**Especificación:** 00 §3.3, §4 (Factor MFA), §5 SEC-BR-08, §6 (mfa/verify, me/mfa/*); 09 §12 #4

**Tablas:** `iam_mfa_factors`

**Endpoints:** `POST /api/v1/auth/mfa/verify`, `POST /api/v1/me/mfa/enroll`, `POST /api/v1/me/mfa/confirm`, `DELETE /api/v1/me/mfa`

**Pantallas:** `app/(auth)/mfa`

**Criterios de aceptación:**

1. Secreto cifrado (`encrypted` cast); 8 códigos de recuperación guardados como hash; `last_used_step` impide reutilizar el mismo código (anti-replay).
2. `mfa/verify` acepta TOTP o código de recuperación y devuelve token completo con `mfa_verified_at`.
3. Middleware `EnsureMfaVerified`: token sin MFA verificado → 403 `MFA_REQUIRED`.
4. Política por defecto (supuesto 09 §12-4): MFA obligatorio para `tenant_admin`, `manager`, `finance`, `accounting` y Super Admin; parametrizable.

**Pruebas:** X-11; Pest de anti-replay y recuperación.

**Depende de:** F0-11 · **Prioridad:** P0

#### F0-13 · Recuperación de contraseña y revocación masiva de tokens

**Historia:** Como usuario, quiero restablecer mi contraseña por enlace de un solo uso; como administrador, quiero que una baja corte las sesiones al instante.

**Especificación:** 00 §3.4 (revocación), §6 (password/forgot, reset), §8.3 `TokensRevoked`; 09 §4.2

**Tablas:** `personal_access_tokens`, `password_reset_tokens`

**Endpoints:** `POST /api/v1/auth/password/forgot`, `POST /api/v1/auth/password/reset`

**Pantallas:** `app/(auth)/recuperar`, `app/(auth)/restablecer/[token]`

**Criterios de aceptación:**

1. Enlace de un solo uso con expiración; la respuesta de `forgot` no revela si el correo existe; rate limit.
2. Servicio `TokenRevoker` por usuario (baja, cambio de rol, reset MFA) y por tenant (suspensión), en cola `critical`.
3. Tras revocar, la siguiente solicitud con ese token → 401.

**Pruebas:** T-10.

**Depende de:** F0-11 · **Prioridad:** P0

#### F0-14 · Consola de plataforma: usuarios `platform_users` y guard `platform`

**Historia:** Como Super Admin SaaS, quiero una identidad separada de los tenants, para administrar la plataforma sin ver datos comerciales.

**Especificación:** 00 §3.1, §5 SEC-BR-06, §6 (platform/auth/*), §11 #8

**Tablas:** `platform_users`

**Endpoints:** `POST /api/v1/platform/auth/login`, `POST /api/v1/platform/auth/mfa/verify`

**Pantallas:** —

**Criterios de aceptación:**

1. Guard `platform` con MFA siempre obligatorio; nunca crea filas en `iam_users`.
2. Rutas `/api/v1/platform/*` solo aceptan tokens del guard `platform`; token de plataforma en `/api/v1/crm/*` → 403 (X-10).
3. Seeder de U16 (Super Admin) solo en entornos de desarrollo.

**Pruebas:** X-10.

**Depende de:** F0-12 · **Prioridad:** P1

#### F0-15 · Login y MFA en Next.js (BFF)

**Historia:** Como usuario, quiero una pantalla de acceso clara, para entrar en mi experiencia sin configurar nada.

**Especificación:** 00 §2 (login, MFA); CONVENCIONES §6; 02-ARQUITECTURA §6

**Tablas:** —

**Endpoints:** Consume `auth/login`, `auth/mfa/verify`, `me/access`

**Pantallas:** `app/(auth)/login`, `app/(auth)/mfa`

**Criterios de aceptación:**

1. El token se guarda en cookie `httpOnly` del BFF de Next.js; nunca en `localStorage`.
2. Tras login redirige al `home` que devuelve `/me/access` (p. ej. `/dashboard`, `/proveedor/solicitudes`).
3. Formularios con React Hook Form + Zod; errores 401/429 legibles; el selector «Cambiar de rol (demo)» del prototipo no existe.

**Pruebas:** Playwright: login de U01, U03, U14, U17 aterriza en su inicio.

**Depende de:** F0-12, F0-19 · **Prioridad:** P0

### E0.4 · IAM: usuarios, sedes, roles y permisos

#### F0-16 · spatie/permission con teams: catálogo de 58 permisos y 13 roles plantilla

**Historia:** Como Tenant Admin, quiero roles con permisos explícitos y editables por tenant, para ajustar el acceso a mi operación.

**Especificación:** 00 §3.5, §7.1–7.3; 01 §11 #24 y H-18 (`crm.records.reassign`)

**Tablas:** `permissions` (+ `module`, `description`), `roles` (+ `tenant_id`, `display_name`, `description`, `scope`, `is_custom`, `experience`), `role_has_permissions`, `model_has_roles` (+ `tenant_id`)

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Config `teams=true`, `team_foreign_key=tenant_id`, guard `api`, caché Redis por tenant; `model_has_permissions` no se usa (sin permisos directos).
2. Seeder de 57 permisos de 00 §7.1 más `crm.records.reassign` (H-18) asignado a `tenant_admin` y `manager`; sin comodines.
3. Plantilla «Estándar» = matriz exacta de 00 §7.3 (totales por rol 2/56/47/16/16/15/6/2/2/4/2/1/1, +1 en TA y MG por `crm.records.reassign`).
4. `setPermissionsTeamId($tenantId)` antes de cualquier `can()` (middleware `SetPermissionsTeam`).

**Pruebas:** X-05 (matriz parametrizada desde el seeder).

**Depende de:** F0-06 · **Prioridad:** P0

#### F0-17 · Usuarios del tenant y sedes (modelo)

**Historia:** Como Tenant Admin, quiero identidades con sede y vínculo a su dato externo, para que cada usuario vea solo lo suyo.

**Especificación:** 00 §3.2, §5 SEC-BR-12; 09 §3.6

**Tablas:** `iam_users`, `iam_sedes`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. `iam_users` con UNIQUE `(tenant_id, lower(email))`, CHECK de `status` y columnas de vínculo (`client_id`, `agency_id`, `provider_id`, `guide_id`, `driver_id`, `reservation_id`) nullable sin FK todavía para tablas de fases posteriores (se agregan en su migración).
2. Validación de servicio: rol externo exige su vínculo (SEC-BR-12); rol interno no admite vínculos.
3. `iam_sedes` con UNIQUE `(tenant_id, lower(name))` e índice parcial UNIQUE `(tenant_id) WHERE is_main`.
4. Sin borrado físico de usuarios (SoftDeletes).

**Pruebas:** Pest de restricciones.

**Depende de:** F0-06 · **Prioridad:** P0

#### F0-18 · Ownership de Ventas y serialización de datos sensibles

**Historia:** Como Gerente, quiero que cada asesor vea solo su cartera y que costos y márgenes no viajen a quien no debe verlos.

**Especificación:** 00 §5 SEC-BR-09/10/11/13, §7.6

**Tablas:** —

**Endpoints:** Patrón para todos los listados

**Pantallas:** —

**Criterios de aceptación:**

1. Scope `OwnedBy` aplicado en `index` cuando el usuario tiene rol `sales`; `filter[owner]` se fuerza a `me` en servidor y no se puede ampliar.
2. Policy base `view/update` compara `owner_id`; ajeno → 403 `SCOPE_OWNERSHIP` con mensaje «pertenece a la cartera de otro asesor…».
3. Helper `SensitiveFields` para `JsonResource` (`whenCan('finance.profitability'|...)`) que omite `cost`, `margin`, `profit` según SEC-BR-13.
4. Servicio `ClientScope::clientIds()` = propios ∪ de sus oportunidades/cotizaciones/reservas (se amplía cuando existan esos módulos).

**Pruebas:** X-08, X-09 (con recursos de prueba).

**Depende de:** F0-16 · **Prioridad:** P0

#### F0-19 · ACCESS y ROLE_UX en backend: `/me`, `/me/permissions`, `/me/access`

**Historia:** Como usuario, quiero que el menú y las rutas reflejen exactamente lo que puedo hacer, calculado por el servidor.

**Especificación:** 00 §5 SEC-BR-04/05, §6 (me, me/permissions, me/access, me/tenant), §7.4, §7.5

**Tablas:** —

**Endpoints:** `GET /api/v1/me`, `GET /api/v1/me/permissions`, `GET /api/v1/me/access` (ETag), `GET /api/v1/me/tenant`

**Pantallas:** —

**Criterios de aceptación:**

1. Tabla ACCESS (prefijo de ruta → permisos «cualquiera de») y ROLE_UX (layout, home, rutas, navegación) en `config/access.php`, fuente única para API y para el middleware de Next.
2. Regla `Access.check`: sin sesión → login; externo → solo sus prefijos; Super Admin → sus 4 rutas; resto → prefijo más largo; `*` o sin entrada → permitido.
3. `/me/access` devuelve `{experience, home, routes[], nav[], screens:{ruta:bool}}` con ETag; se invalida con `PermissionsChanged`.
4. Middleware `EnsureExperience`: rol externo en endpoint de back-office → 403 con mensaje de SEC-BR-05.

**Pruebas:** X-06 (snapshot por rol vs 00 §7.5).

**Depende de:** F0-16 · **Prioridad:** P0

#### F0-20 · Invitar usuario y aceptar invitación

**Historia:** Como Tenant Admin, quiero invitar usuarios por enlace de un solo uso, para que definan su propia contraseña y MFA.

**Especificación:** 09 §3.7, §4.2, §5 USR-BR-01/02/09/11, §6.2, §12 #3

**Tablas:** `iam_user_invitations`, `iam_users`

**Endpoints:** `POST /api/v1/iam/users` (Idempotency-Key), `POST /api/v1/iam/users/{id}/resend-invitation`, `POST /api/v1/auth/invitations/{token}/accept` (Idempotency-Key)

**Pantallas:** `app/(auth)/invitacion/[token]`

**Criterios de aceptación:**

1. Usuario creado en `pendiente` con token SHA-256, 72 h, `require_mfa` (default true); la contraseña nunca viaja por correo.
2. Límite de usuarios del plan validado con `SELECT … FOR UPDATE` sobre `tenants` (409 `USR-BR-02`); correo duplicado sin distinguir mayúsculas → 422 `USR-BR-01`.
3. Reenviar invalida el token anterior y audita `reenviar_invitacion`.
4. Aceptar: define contraseña, enrola TOTP si corresponde, pasa a `activo`, audita `activar`.
5. Selector de rol excluye `super_admin` (USR-BR-09); notificación `usuario.invitado`.

**Pruebas:** T-08.

**Depende de:** F0-17, F0-12, F0-29 · **Prioridad:** P0

#### F0-21 · Gestión de usuarios: editar, desactivar, activar y resetear MFA

**Historia:** Como Tenant Admin, quiero administrar el ciclo de vida de cada identidad, para dar y quitar acceso con trazabilidad.

**Especificación:** 09 §4.2, §5 USR-BR-03..10, §6.2, §9 (Usuario)

**Tablas:** `iam_users`, `iam_mfa_factors`

**Endpoints:** `GET /api/v1/iam/users`, `GET /api/v1/iam/users/{id}`, `PATCH /api/v1/iam/users/{id}` (lock_version), `POST /api/v1/iam/users/{id}/deactivate`, `POST /api/v1/iam/users/{id}/activate`, `POST /api/v1/iam/users/{id}/reset-mfa`

**Pantallas:** —

**Criterios de aceptación:**

1. Lista con filtros `role`, `sede`, `status`, `mfa` y KPIs; detalle con permisos efectivos y últimos 8 eventos de auditoría.
2. Email no editable (USR-BR-03); no cambiar su propio rol (403 USR-BR-04); no desactivarse (403 USR-BR-06); conservar ≥ 1 Tenant Admin activo (409 USR-BR-05).
3. Desactivar exige motivo, revoca tokens y responde `warnings` si hay oportunidades/actividades abiertas (USR-BR-08).
4. Reactivar valida el límite del plan (supuesto 09 §12-2).
5. Reset MFA con motivo: elimina factor, `mfa_required=true`, notifica `seguridad.mfa_reset`; cambio de rol audita `cambio_rol` y revoca tokens.

**Pruebas:** T-09, T-10.

**Depende de:** F0-20, F0-13 · **Prioridad:** P0

#### F0-22 · Sedes: alta, edición, activación y eliminación controlada

**Historia:** Como Tenant Admin, quiero gestionar sedes dentro de los límites del plan, para organizar usuarios y documentos.

**Especificación:** 09 §3.6, §4.3, §5 SED-BR-01..05, §6.2

**Tablas:** `iam_sedes`

**Endpoints:** `GET/POST /api/v1/iam/sedes`, `PATCH /api/v1/iam/sedes/{id}` (lock_version), `POST /api/v1/iam/sedes/{id}/activate|deactivate`, `DELETE /api/v1/iam/sedes/{id}`

**Pantallas:** —

**Criterios de aceptación:**

1. Límite de sedes activas por plan (Starter 1, Professional 2, Enterprise ∞) → 409 `SED-BR-02`; también al reactivar (supuesto 09 §12-2).
2. No desactivar con usuarios activos ni la última activa (409 `SED-BR-03`).
3. Eliminar solo sin usuarios ni reservas (409 `SED-BR-04`, FK RESTRICT).
4. Responsable solo TA/MG/Ventas/Operaciones/Finanzas activo (SED-BR-05); auditoría por acción.

**Pruebas:** T-11.

**Depende de:** F0-17 · **Prioridad:** P1

#### F0-23 · Roles personalizados y matriz de permisos editable

**Historia:** Como Tenant Admin, quiero crear roles y marcar permisos por módulo con reglas anti-bloqueo, para adaptar el RBAC sin romper la seguridad.

**Especificación:** 09 §4.4, §5 RBAC-BR-01..09, §6.3, §8.1 `PermissionsChanged`, §11 #10; 00 §12 #3, #4

**Tablas:** `roles`, `role_has_permissions`

**Endpoints:** `GET/POST /api/v1/iam/roles`, `PATCH/DELETE /api/v1/iam/roles/{id}`, `GET /api/v1/iam/permissions`, `GET /api/v1/iam/role-permissions`, `PUT/DELETE /api/v1/iam/roles/{id}/permissions/{permission}`, `POST /api/v1/iam/roles/{id}/permissions/bulk`, `GET /api/v1/iam/access-map`

**Pantallas:** —

**Criterios de aceptación:**

1. Roles base no se renombran ni eliminan; personalizados: nombre único, descripción obligatoria, alcance inmutable, copiar desde otro rol eliminando permisos prohibidos (RBAC-BR-06); eliminar solo sin usuarios (RBAC-BR-07).
2. Bloqueos con 422 y `code`: TA no pierde `admin.roles.manage`/`admin.users.manage` (RBAC-BR-02); roles `canal`/`mobile` sin `admin.*`, `finance.*`, `*profitability*`, `quotes.discount_override` (RBAC-BR-03/04); `admin.tenant.manage` no asignable en tenant (RBAC-BR-05, decisión 09 §11 #10).
3. Bulk responde `{applied, blocked[]}` (RBAC-BR-08).
4. Cada cambio audita `otorgar_permiso`/`revocar_permiso`, limpia caché spatie del tenant y emite broadcast para refrescar `/me/access`; aplica en la siguiente solicitud sin re-login (T-13).
5. Rol personalizado de alcance `canal` exige elegir experiencia existente (supuesto 00 §12-4); lectura de roles con `admin.users.manage` o `admin.roles.manage` (00 §12-3).
6. `access-map` usa la misma función que `/me/access`.

**Pruebas:** T-12, T-13, T-14.

**Depende de:** F0-16, F0-19, F0-24 · **Prioridad:** P0

### E0.5 · Servicios transversales del núcleo

#### F0-24 · Auditoría append-only con correlación

**Historia:** Como Tenant Admin o auditor, quiero una bitácora inmutable de acciones críticas, para tener evidencia de quién hizo qué.

**Especificación:** 00 §3.6, §5 SEC-BR-07/15, §9; 09 §5 AUD-BR-01

**Tablas:** `audit_events` (particionada por mes)

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. `AuditLogger::log(entity, entityId, action, before, after, evidence?)` completa tenant, actor (usuario/plataforma/Sistema/api_client), rol, IP, user agent, `correlation_id`, `occurred_at`, `is_critical` (lista de 00 §9).
2. Escritura síncrona en la transacción de negocio; `acceso_denegado` y `login_fallido` en transacción propia.
3. Tabla particionada por mes con job que crea particiones futuras; índices de 00 §3.6.
4. `REVOKE UPDATE, DELETE, TRUNCATE` para `app_role` + trigger que lanza excepción.
5. Exception handler audita todo 403 como `Acceso acceso_denegado` (id = ruta, antes = rol, después = permisos requeridos).

**Pruebas:** X-16, T-27.

**Depende de:** F0-06, F0-03 · **Prioridad:** P0

#### F0-25 · Correlativos por tipo de documento

**Historia:** Como Finanzas, quiero correlativos atómicos que nunca retrocedan, para cumplir con numeración continua.

**Especificación:** 00 §3.7, §5 SEC-BR-20; 09 §3.18, CFG-BR-07

**Tablas:** `sys_sequences`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. `SequenceService::next(docType, series='default')` con `SELECT … FOR UPDATE`; formato `prefix + lpad(n, pad_width)`.
2. Trigger `BEFORE UPDATE` impide que `next_number` decrezca; reinicio anual solo si `year_reset` (supuesto 00 §12-10).
3. Documentos fiscales toman número al confirmar (sin huecos por rollback).
4. Tipos adicionales para Fase 1-A: `lead` (LEAD-), `opportunity` (OPP-), `activity` (ACT-), `client` (CLI-), `survey` (ENC-), `case` (REC-), y los `ref` del catálogo (PRD-, TAR-, SAL-, HLD-, SRV-, PRV-, TMP-, PR-, D, CAT-, RG-).

**Pruebas:** X-15 (50 concurrentes → 50 consecutivos).

**Depende de:** F0-06 · **Prioridad:** P0

#### F0-26 · Idempotencia de operaciones críticas

**Historia:** Como usuario con mala conexión, quiero reintentar una operación sin duplicarla, para no generar dos reservas o dos pagos.

**Especificación:** 00 §3.8, §4 (Idempotency key), §5 SEC-BR-16, §6 (lista de endpoints)

**Tablas:** `sys_idempotency_keys`

**Endpoints:** Middleware `Idempotent` (alias de ruta)

**Pantallas:** —

**Criterios de aceptación:**

1. Header `Idempotency-Key` obligatorio en rutas marcadas; falta → 428 o 422 con `code` (supuesto: 422 `IDEMPOTENCY_KEY_REQUIRED`).
2. Misma key + mismo `request_hash` → misma respuesta (código y cuerpo); cuerpo distinto → 422 `IDEMPOTENCY_KEY_REUSED`; en proceso → 409 `IDEMPOTENCY_IN_PROGRESS`; `failed` permite reintento.
3. Copia en Redis `idem:{tenant}:{key}` TTL 24 h; job diario purga expirados.
4. UNIQUE `(tenant_id, key)` como última defensa ante carreras.

**Pruebas:** X-13 (con un endpoint de prueba y luego con `POST /crm/leads/{code}/convert`).

**Depende de:** F0-07 · **Prioridad:** P0

#### F0-27 · Outbox transaccional

**Historia:** Como integrador, quiero que los efectos externos se publiquen solo si la transacción confirmó, para no perder ni duplicar eventos.

**Especificación:** 00 §3.9, §4 (Outbox); CONVENCIONES §4

**Tablas:** `sys_outbox`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. `Outbox::record(aggregate, event, payload)` inserta en la misma transacción.
2. Worker publica a la cola `integrations` con reintentos y backoff; estados `pending → dispatched | failed`.
3. Idempotente ante reinicios del worker (marca con `FOR UPDATE SKIP LOCKED`).

**Pruebas:** Pest: rollback no deja fila; worker despacha una sola vez.

**Depende de:** F0-08 · **Prioridad:** P1

#### F0-28 · Colas Horizon, scheduler y registro de ejecuciones

**Historia:** Como Tenant Admin, quiero ver qué jobs corren y cuándo, para detectar fallos operativos.

**Especificación:** 00 §8.2; 09 §3.14, §4.7, §5 JOB-BR-01/02, §6.6 (jobs), §8.2; CONVENCIONES §4

**Tablas:** `sys_scheduled_jobs`, `sys_job_runs`

**Endpoints:** `GET /api/v1/jobs`, `POST /api/v1/jobs/{id}/run` (Idempotency-Key; 409 si `en_curso`), `POST /api/v1/jobs/{id}/pause|resume`

**Pantallas:** —

**Criterios de aceptación:**

1. Horizon con supervisores para `critical`, `default`, `notifications`, `documents`, `integrations`, `reports`, `low`.
2. Clase base `TrackedJob` registra `sys_job_runs` (trigger schedule/manual/retry, estado, resultado, `correlation_id`).
3. Sembrado por tenant de JOB-01…09 con cron y cola de 09 §8.2; los de módulos aún no construidos quedan con `paused=true` hasta su fase.
4. Pausar deja `next_run_at` nulo; reanudar recalcula; «Ejecutar ahora» no altera la programación y es `ShouldBeUnique`.

**Pruebas:** Pest: run manual duplicado → 409; pausa/reanuda.

**Depende de:** F0-08 · **Prioridad:** P1

#### F0-29 · Notificaciones básicas: dispatcher, email y campana (Portal)

**Historia:** Como usuario, quiero recibir avisos por correo y en la campana, sin que un fallo de envío deshaga mi operación.

**Especificación:** 00 §8.1, §5 SEC-BR-22, §6 (me/notifications); 09 §3.10–3.12, §4.5, §5 NTF-BR-01..06, §8.3

**Tablas:** `notif_event_rules`, `notif_templates`, `notif_messages` (+ `client_id`, `related_type`, `related_id` según 01 §3.12)

**Endpoints:** `GET /api/v1/me/notifications`, `POST /api/v1/me/notifications/read-all`; canal Reverb `private-tenant.{tenantId}.user.{userId}`

**Pantallas:** —

**Criterios de aceptación:**

1. `Notify::event(code, recipients, data, source)` crea `NotificationRequested` tras commit; `NotificationDispatcher` (cola `notifications`) aplica regla (canales, destinatarios, `timing`, `condition`) y plantilla vigente (tenant o sistema).
2. Canales en Fase 0: Email (`MailSender`, SMTP/mailpit) y Portal (registro + broadcast Reverb). WhatsApp y Push quedan como adaptadores stub que marcan `fallido` con error permanente «canal no configurado» (Fase 2).
3. Plantillas de sistema sembradas con los textos de `DEF_TPL` del prototipo para los 10 eventos configurables y los eventos de sistema de 09 §8.3.
4. Fallo de envío no revierte la transacción de origen (T-20); reintentos con backoff INT-BR-04.
5. `/me/notifications` devuelve últimas 25 y `unread_count`.

**Pruebas:** X-17, T-20.

**Depende de:** F0-08, F0-24 · **Prioridad:** P0

#### F0-30 · Documentos PDF y almacenamiento S3

**Historia:** Como usuario, quiero descargar PDFs generados por el sistema (fichas, cotizaciones, vouchers) con enlaces seguros y versionados.

**Especificación:** CONVENCIONES §5; 02 §6.1 (`/sheet`), 03 §3 (`pdf_document_id`)

**Tablas:** `sys_documents` (supuesto de columnas: `id, tenant_id, doc_type, source_type, source_id, version, storage_path, sha256, size_bytes, status (en_cola|generado|fallido), generated_at, created_by`)

**Endpoints:** Servicio interno + `GET /api/v1/documents/{id}/download` (supuesto: 302 a URL firmada)

**Pantallas:** —

**Criterios de aceptación:**

1. Disk `s3` (minio en local) con rutas `tenants/{tenant_id}/{dominio}/{uuid}.pdf`; URLs firmadas temporales (≤ 10 min).
2. Job base `GeneratePdf` en cola `documents` con Browsershot/Chromium, `ShouldBeUnique` por (fuente, versión), guarda hash SHA-256.
3. Plantilla HTML base con logo/iniciales, colores del tenant y pie legal.
4. La descarga se audita (`descargar`).

**Pruebas:** Pest: job genera documento con hash; URL expira.

**Depende de:** F0-08, F0-24 · **Prioridad:** P1

#### F0-31 · `PricingService` y `SeasonResolver` del núcleo

**Historia:** Como Ventas, quiero que el precio siempre lo calcule el backend con la misma fórmula, para que no haya diferencias entre pantallas.

**Especificación:** 00 §5 SEC-BR-18/19, §5.1; H-13

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. `PricingService::calc` (base, markup, subtotal, descuento, neto, impuesto, total con redondeo 0.10 por defecto, comisión, utilidad, margen) y `quoteTotals(version)` idénticos al prototipo, con `BigDecimal`.
2. `SeasonResolver::for(date)`: temporadas `activa` que contienen la fecha, prioridad ascendente, primera.
3. Conversión USD→PEN con el `fx_rate` recibido (nunca el del día dentro del cálculo).

**Pruebas:** X-18 (valores idénticos al prototipo).

**Depende de:** F0-03 · **Prioridad:** P0

#### F0-32 · Búsqueda global con alcance por rol

**Historia:** Como usuario interno, quiero buscar cualquier registro desde la barra, viendo solo lo que me corresponde.

**Especificación:** 00 §2 (Búsqueda global), §6 (`/search`), §7.6, §12 #2

**Tablas:** —

**Endpoints:** `GET /api/v1/search?q=`

**Pantallas:** —

**Criterios de aceptación:**

1. Mínimo 2 caracteres, máximo 12 resultados; cada módulo registra un `SearchProvider` (Fase 1-A: leads, oportunidades, clientes, productos, proveedores).
2. Filtra por pantallas permitidas (`/me/access`) y ownership; clientes con `clientIds()` para Ventas (00 §12-2).
3. Índices trigram en los campos buscados.

**Pruebas:** Playwright: U03 no ve registros de U04.

**Depende de:** F0-18, F0-19 · **Prioridad:** P2

### E0.6 · Configuración, notificaciones y auditoría (administración)

#### F0-33 · Configuración del tenant por secciones y tipo de cambio

**Historia:** Como Tenant Admin, quiero configurar datos generales, moneda, políticas, parámetros operativos y canales, para que los módulos usen mis valores.

**Especificación:** 09 §3.8, §3.9, §5 CFG-BR-01..06, 09..12, TEN-BR-11, §6.4

**Tablas:** `sys_settings`, `sys_fx_rates`

**Endpoints:** `GET /api/v1/settings`, `PATCH /api/v1/settings/{section}` (lock_version), `GET /api/v1/settings/fx-rates`

**Pantallas:** —

**Criterios de aceptación:**

1. Secciones `general`, `currency`, `policies`, `operations`, `channels` con claves, rangos y defaults de 09 §3.8 validados por FormRequest por sección.
2. Guardado por diferencia: solo audita campos cambiados (`actualizar` por campo); sin cambios → 200 «No hay cambios que guardar» sin auditoría (T-17).
3. RUC y país prohibidos (CFG-BR-03); moneda base bloqueada si existen reservas o pagos (409 CFG-BR-05, con verificación registrable por módulo).
4. Cada TC distinto inserta fila en `sys_fx_rates`; `SettingsUpdated` invalida caché `settings:{tenant}`.
5. Canales solo editables si el plan lo incluye (CFG-BR-12).

**Pruebas:** T-16, T-17.

**Depende de:** F0-09 · **Prioridad:** P0

#### F0-34 · Series y correlativos configurables

**Historia:** Como Tenant Admin, quiero ver y ajustar prefijos y próximo número, para migrar mi numeración actual.

**Especificación:** 09 §5 CFG-BR-07/08, §6.4 (sequences)

**Tablas:** `sys_sequences`

**Endpoints:** `GET /api/v1/settings/sequences`, `PATCH /api/v1/settings/sequences`, `POST /api/v1/settings/sequences`

**Pantallas:** —

**Criterios de aceptación:**

1. Lista con «próximo documento» formateado.
2. Bajar `next_number` → 422 CFG-BR-07 (y el trigger lo bloquea por SQL directo).
3. Nuevas series solo para los 5 tipos de CFG-BR-08; prefijo no vacío y único.

**Pruebas:** T-15.

**Depende de:** F0-25 · **Prioridad:** P1

#### F0-35 · Administración de notificaciones: matriz, plantillas y log

**Historia:** Como Tenant Admin, quiero decidir qué evento sale por qué canal y editar las plantillas, para comunicar con mi estilo.

**Especificación:** 09 §4.5, §5 NTF-BR-01..08, §6.5, §9 (Notificación, Plantilla)

**Tablas:** `notif_event_rules`, `notif_templates`, `notif_messages`

**Endpoints:** `GET /api/v1/notifications/rules`, `PATCH /api/v1/notifications/rules/{event}`, `POST /api/v1/notifications/rules/{event}/test`, `GET|PUT|DELETE /api/v1/notifications/templates/{event}/{channel}`, `POST /api/v1/notifications/templates/{event}/{channel}/test`, `GET /api/v1/notifications/messages`, `POST /api/v1/notifications/messages/{id}/retry`, `POST /api/v1/notifications/messages/retry-failed`, `POST /api/v1/notifications/messages/{id}/fallback`

**Pantallas:** —

**Criterios de aceptación:**

1. `incidencia.critica` exige ≥ 1 canal (422 NTF-BR-01 + CHECK).
2. Variables permitidas cerradas (NTF-BR-03) → 422 con variable inválida; push ≤ 140 (NTF-BR-04); cada guardado incrementa versión; «restaurar» vuelve a la de sistema.
3. Reintento y canal alterno según NTF-BR-07/08; error permanente no cambia con reintento.
4. Destinatarios como texto en Fase 0 (supuesto 09 §12-14: migrar a selector en Fase 2).

**Pruebas:** T-18, T-19.

**Depende de:** F0-29 · **Prioridad:** P1

#### F0-36 · Consulta de auditoría (tenant y plataforma)

**Historia:** Como Tenant Admin o Manager, quiero filtrar la bitácora y ver eventos relacionados, para investigar incidentes.

**Especificación:** 09 §5 AUD-BR-01/02, §6.1 (`platform/audit-events`), §6.7 (`audit-events`)

**Tablas:** `audit_events`

**Endpoints:** `GET /api/v1/audit-events`, `GET /api/v1/audit-events/{id}`, `GET /api/v1/platform/audit-events`

**Pantallas:** —

**Criterios de aceptación:**

1. Filtros usuario, entidad, acción, rango (hoy/7/30/90), criticidad; agregados por acción, entidad y actor; paginación por cursor.
2. Detalle con eventos relacionados por `correlation_id` o entidad; el acceso a la bitácora también se audita.
3. Super Admin solo ve entidades de plataforma y acciones `*denegad*` (AUD-BR-02).
4. Exportación de bitácora queda para la historia de exportaciones de Fase 1 (reportes).

**Pruebas:** T-26.

**Depende de:** F0-24 · **Prioridad:** P1

#### F0-37 · Solicitud de acceso desde la pantalla 403

**Historia:** Como usuario interno sin permiso, quiero pedir acceso desde la pantalla 403, para no depender de canales informales.

**Especificación:** 00 §2 (Pantalla 403), §3.10, §4 (Solicitud de acceso), §6 (`access-requests`)

**Tablas:** `iam_access_requests`

**Endpoints:** `POST /api/v1/access-requests`

**Pantallas:** —

**Criterios de aceptación:**

1. Crea solicitud `pendiente` con ruta y permisos requeridos; notifica `acceso.solicitud` al/los Tenant Admin (Portal + Email).
2. Solo back-office (externos → 403).
3. Supuesto: la atención (`atendida`/`rechazada`) se registra desde el detalle de usuario; endpoint `POST /api/v1/access-requests/{id}/resolve` no definido en la spec.

**Pruebas:** Pest: externo 403; interno 201 + notificación.

**Depende de:** F0-29 · **Prioridad:** P2

### E0.7 · Shell Next.js por experiencia y pantallas de administración

#### F0-38 · Sistema de diseño en Next.js

**Historia:** Como usuario, quiero una interfaz coherente con el prototipo, accesible y con modo oscuro.

**Especificación:** 02-ARQUITECTURA §6 (tokens); CONVENCIONES §6

**Tablas:** —

**Endpoints:** —

**Pantallas:** Componentes base

**Criterios de aceptación:**

1. Tokens de `app.css` en Tailwind (`--accent #0A3A73`, `--sun #F4B400`, `--info`, `--ok`, `--bad`, `--warn`, `--violet`, fondo `#F3F5F9`, texto `#15202E`, radios 16/10 px, Plus Jakarta Sans) y variante oscura.
2. shadcn/Radix: Button, Input, Select, Dialog, Drawer (Sheet), Tabs, Tooltip, Toast, Badge de estado (mapa `STATUS` del prototipo), Stepper, Timeline, KPI card, EmptyState, ErrorState.
3. `DataTable` (TanStack Table) con búsqueda, filtros, orden, paginación por cursor, columnas ocultables y contenedor con scroll interno (sin scroll horizontal de página a 400 px).
4. Botón con permiso: `<Can perm>` oculta o deshabilita con tooltip «Requiere permiso x.y» (SEC-BR-14).

**Pruebas:** Vitest de componentes; Playwright 400 px sin scroll horizontal.

**Depende de:** F0-01 · **Prioridad:** P0

#### F0-39 · Layouts por experiencia y `middleware.ts`

**Historia:** Como usuario, quiero entrar siempre a la experiencia de mi rol, sin ver menús que no me corresponden.

**Especificación:** 00 §2 (Shell back-office, Shell externo), §7.4, §7.7; CONVENCIONES §6; 02-ARQUITECTURA §6

**Tablas:** —

**Endpoints:** Consume `/me`, `/me/access`, `/me/tenant`

**Pantallas:** `app/(backoffice)/layout.tsx`, `app/(portal-cliente)/layout.tsx`, `app/(portal-pasajero)/layout.tsx`, `app/(b2b)/layout.tsx`, `app/(extranet-proveedor)/layout.tsx`, `app/(plataforma)/layout.tsx`

**Criterios de aceptación:**

1. `middleware.ts` lee la experiencia del token y redirige a su `home`; bloquea grupos de rutas ajenos (la API vuelve a validar).
2. Back-office: menú lateral generado desde `nav[]` de `/me/access`, barra superior con búsqueda, campana, chip «Tenant activo» (drawer) y «Mi perfil» (drawer con permisos efectivos).
3. Externos: barra superior azul con su navegación, sin menú lateral ni búsqueda, pie «Solo se muestran datos vinculados a su cuenta».
4. Menú se refresca por broadcast `PermissionsChanged` sin re-login.
5. Páginas placeholder «Disponible en Fase N» para rutas de fases posteriores que aparezcan en `nav[]`.

**Pruebas:** Playwright: U01..U17 aterrizan en su home y el nº de ítems de menú coincide con el prototipo.

**Depende de:** F0-38, F0-19, F0-15 · **Prioridad:** P0

#### F0-40 · Pantallas 403 y 404

**Historia:** Como usuario, quiero saber por qué no puedo entrar y cómo pedir acceso.

**Especificación:** 00 §2 (Pantalla 403, Ruta inexistente), §7.7

**Tablas:** —

**Endpoints:** Consume `POST /access-requests`

**Pantallas:** `forbidden.tsx`, `not-found.tsx`

**Criterios de aceptación:**

1. 403 muestra «Error 403 · Acceso restringido», motivo, permisos requeridos, ruta, «El intento quedó registrado en auditoría» y «Ir a mi inicio».
2. En back-office agrega «Solicitar acceso al administrador»; en externos no.
3. Registro de otro asesor muestra «Registro fuera de su cartera» (respuesta `SCOPE_OWNERSHIP`).
4. 404: «La pantalla solicitada no existe».

**Pruebas:** Playwright: Manager en `/admin/usuarios` ve 403 con «Solicitar acceso».

**Depende de:** F0-39, F0-37 · **Prioridad:** P0

#### F0-41 · Campana de notificaciones en tiempo real

**Historia:** Como usuario interno, quiero ver mis avisos al instante, para reaccionar sin recargar.

**Especificación:** 00 §2 (Campana), §6 (me/notifications, canal Reverb)

**Tablas:** —

**Endpoints:** `GET /me/notifications`, `POST /me/notifications/read-all`; Echo + Reverb

**Pantallas:** Componente campana + drawer

**Criterios de aceptación:**

1. Laravel Echo suscrito a `private-tenant.{t}.user.{u}`; contador de no leídas.
2. Drawer con últimas 25; «Marcar todas como leídas»; enlace al log si tiene `admin.settings.manage`.

**Pruebas:** Playwright: notificación de prueba aparece sin recargar.

**Depende de:** F0-29, F0-39 · **Prioridad:** P1

#### F0-42 · Pantallas Administración › Usuarios y Sedes

**Historia:** Como Tenant Admin, quiero gestionar usuarios y sedes desde el back-office.

**Especificación:** 09 §2 (`admin/usuarios`, `/{id}`, `/sedes`), §7.1

**Tablas:** —

**Endpoints:** F0-20, F0-21, F0-22

**Pantallas:** `/admin/usuarios`, `/admin/usuarios/[id]` (drawer), `/admin/usuarios/sedes`

**Criterios de aceptación:**

1. KPIs (activos internos/canal, sin MFA, invitaciones, sedes) y pestañas Usuarios / Sedes.
2. Modal Invitar (nombre, correo, rol, sede, teléfono, exigir MFA); drawer con permisos efectivos, actividad, Editar / Resetear MFA / Activar-Desactivar con motivo.
3. Avisos `warnings` de desactivación visibles antes de confirmar.

**Pruebas:** Playwright: invitar → «Invitación enviada»; editar rol; desactivar con motivo.

**Depende de:** F0-39, F0-21, F0-22 · **Prioridad:** P0

#### F0-43 · Pantallas Administración › Roles, matriz y mapa de acceso

**Historia:** Como Tenant Admin, quiero editar la matriz de permisos y ver el mapa rol × pantalla.

**Especificación:** 09 §2 (`admin/roles`, `/mapa`), §7.1

**Tablas:** —

**Endpoints:** F0-23

**Pantallas:** `/admin/roles`, `/admin/roles/[role]`, `/admin/roles/mapa`

**Criterios de aceptación:**

1. Matriz por módulo con casillas; bloqueos mostrados con el `code` RBAC-BR; contador por módulo con cambio masivo; columna Super Admin deshabilitada.
2. Sin `admin.roles.manage`: casillas deshabilitadas y aviso «Vista de solo lectura».
3. Mapa rol × pantalla y resumen por rol; auditoría de cambios (12 últimos).

**Pruebas:** Playwright: desmarcar `reports.export` de Finanzas refleja el cambio en el mapa.

**Depende de:** F0-39, F0-23 · **Prioridad:** P0

#### F0-44 · Pantallas Administración › Configuración y Series

**Historia:** Como Tenant Admin, quiero editar la configuración por pestañas con validación inmediata.

**Especificación:** 09 §2 (`admin/configuracion/[tab]`)

**Tablas:** —

**Endpoints:** F0-33, F0-34

**Pantallas:** `/admin/configuracion/[general|moneda|series|politicas|operativos|canales]`

**Criterios de aceptación:**

1. Formularios RHF + Zod espejo de los FormRequest; guardado por diferencia con toast «No hay cambios que guardar».
2. Historial de TC en la pestaña Moneda; canales fuera del plan deshabilitados con el plan requerido.

**Pruebas:** Playwright: cambiar TC crea fila en historial.

**Depende de:** F0-39, F0-33, F0-34 · **Prioridad:** P1

#### F0-45 · Pantallas Administración › Notificaciones y Auditoría

**Historia:** Como Tenant Admin, quiero administrar notificaciones y consultar la bitácora desde el back-office.

**Especificación:** 09 §2 (`admin/notificaciones/[tab]`, `admin/auditoria`)

**Tablas:** —

**Endpoints:** F0-35, F0-36

**Pantallas:** `/admin/notificaciones/[matriz|plantillas|log]`, `/admin/auditoria`, `/admin/auditoria/[id]` (drawer)

**Criterios de aceptación:**

1. Matriz evento × canal con switches; editor de plantillas con variables permitidas y contador de 140 en push; log con reintento y canal alterno.
2. Auditoría con filtros, gráficos por acción/entidad y drawer de evento con relacionados.
3. Manager solo ve Auditoría en el grupo Administración.

**Pruebas:** Playwright: Manager ve solo «Auditoría» en Administración.

**Depende de:** F0-39, F0-35, F0-36 · **Prioridad:** P1

#### F0-46 · Búsqueda global en la barra superior

**Historia:** Como usuario interno, quiero buscar con `/` y abrir el resultado directamente.

**Especificación:** 00 §2 (Búsqueda global)

**Tablas:** —

**Endpoints:** `GET /api/v1/search`

**Pantallas:** Componente de búsqueda (Command palette)

**Criterios de aceptación:**

1. Atajo `/`, debounce 250 ms, resultados agrupados por tipo con enlace a la ruta Next.js.
2. Sin resultados → estado vacío.

**Pruebas:** Playwright con U03.

**Depende de:** F0-32, F0-39 · **Prioridad:** P2

### E0.8 · Datos semilla y pruebas de salida de fase

#### F0-47 · Seeders de desarrollo desde `kit-ia/seeds`

**Historia:** Como desarrollador, quiero datos de demo iguales al prototipo, para comparar pantallas y probar roles.

**Especificación:** 02-ARQUITECTURA §9; `kit-ia/seeds/_indice.json`

**Tablas:** `tenants`, `iam_sedes`, `iam_users`, roles, `sys_settings`, `sys_sequences`, `notif_*`

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. `DevSeeder` crea el tenant demo (`seeds/tenant.json`), un segundo tenant para E2E-08, 3 sedes y los 17 usuarios U01…U17 con sus roles y vínculos (U13→AGB-01/CLI-0007, U14→CLI-0001, U15→CLI-0003/RES-2026-000347, U09/U10→G01/G02, U11→C01, U17→PRV-001; vínculos a tablas futuras quedan nulos hasta su fase).
2. Contraseña común de desarrollo y MFA desactivado solo en `APP_ENV=local`.
3. Mapeo de códigos del prototipo (`U01`, `CLI-0001`…) a UUID v7 guardado en `code` para trazabilidad.

**Pruebas:** `php artisan migrate:fresh --seed` sin errores.

**Depende de:** F0-09, F0-16 · **Prioridad:** P0

#### F0-48 · Suite Pest transversal de salida de fase (X-01…X-18, T-01…T-27 aplicables)

**Historia:** Como responsable técnico, quiero pruebas automáticas de aislamiento y RBAC en verde, para cerrar la Fase 0 con evidencia.

**Especificación:** 00 §10; 09 §10; 03-PLAN §2 (criterio de salida Fase 0)

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. X-01…X-18 implementados (X-09 con recursos ficticios de prueba hasta que existan cotizaciones).
2. T-01…T-19, T-26, T-27 implementados; T-20..T-25 y T-28 se marcan `todo()` con referencia a su fase.
3. Matriz RBAC parametrizada desde el seeder: cada rol × permiso contra un endpoint representativo → 200/403.
4. Helper `actingAsRole('sales')`, factories de tenant A/B y aserción `assertAudited(entity, action)`.

**Pruebas:** Suite completa en CI.

**Depende de:** F0-07, F0-23, F0-26 · **Prioridad:** P0

#### F0-49 · Playwright base y E2E-08

**Historia:** Como responsable técnico, quiero pruebas E2E de acceso por rol y aislamiento, para validar el shell de punta a punta.

**Especificación:** 00 §10 (Playwright); 09 §10 (Playwright); E2E-08

**Tablas:** —

**Endpoints:** —

**Pantallas:** —

**Criterios de aceptación:**

1. Fixtures de login por usuario U01…U17 (storageState).
2. Por usuario: aterriza en su `home`; nº de ítems de menú = prototipo; ruta prohibida muestra 403 con permisos requeridos.
3. Externos (U09, U13, U14, U15, U17) sin menú lateral y con el pie de datos vinculados; U14 en `/canales/portal-cliente/CLI-0002/inicio` se redirige al suyo (cuando exista el portal; hasta entonces `todo`).
4. E2E-08: usuario del tenant A no ve recursos del tenant B vía UI ni vía API.

**Pruebas:** E2E-08 en verde.

**Depende de:** F0-39, F0-40, F0-47 · **Prioridad:** P0

## Definición de terminado (toda historia)

- Migraciones reversibles con RLS forzado, CHECK de estados, índices y FK en la misma migración.
- Actions dentro de transacción, con locks donde haya cupos o dinero, eventos de dominio `afterCommit` y auditoría de las acciones críticas.
- Endpoints con FormRequest, Policy + permiso spatie, `JsonResource` que omite campos sensibles por permiso y OpenAPI regenerado.
- Pantallas Next.js equivalentes al prototipo, con estados vacío, error y 403; sin scroll horizontal de página a 400 px.
- Pruebas: aislamiento de tenant, RBAC (403), ownership, máquina de estados, reglas de negocio e idempotencia cuando aplique.
