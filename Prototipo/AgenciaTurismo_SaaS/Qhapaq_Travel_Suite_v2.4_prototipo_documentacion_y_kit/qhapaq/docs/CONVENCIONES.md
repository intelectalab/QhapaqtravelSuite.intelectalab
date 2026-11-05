# Convenciones técnicas para las especificaciones de módulo

Stack objetivo: **Laravel 12 / PHP 8.4** (API) · **PostgreSQL 17** · **Redis 8** (cache, colas, locks, rate limit) · **Next.js** (App Router, TypeScript) para web · **React Native (Expo)** para apps móviles (según documentación inicial). Todo en español para el negocio; código, tablas y endpoints en inglés.

## 1. Multi-tenancy
- Base de datos única, esquema compartido. **Toda tabla de negocio lleva `tenant_id uuid not null`** con FK a `tenants(id)`.
- Aislamiento en dos capas: (a) Laravel: trait `BelongsToTenant` con global scope + `tenant_id` asignado desde el contexto autenticado, nunca desde el request; (b) PostgreSQL **Row Level Security**: `ALTER TABLE x ENABLE ROW LEVEL SECURITY; CREATE POLICY tenant_isolation ON x USING (tenant_id = current_setting('app.tenant_id')::uuid);` El middleware ejecuta `SET LOCAL app.tenant_id = '<uuid>'` por transacción.
- Unicidad siempre compuesta: `UNIQUE (tenant_id, code)`.
- Tablas de plataforma (sin tenant_id): `tenants`, `plans`, `plan_features`, `subscriptions`, `platform_invoices`, `platform_users`.

## 2. Convenciones de tablas y columnas
- Prefijos por dominio: `iam_` (usuarios, roles, permisos, sedes), `crm_`, `catalog_`, `quote_`, `booking_` (reservas), `ops_`, `fin_`, `channel_` (B2B, e-commerce, portales), `cms_`, `mkt_`, `collab_` (aprobaciones, inbox), `supplier_` (extranet), `notif_`, `audit_`, `integration_`, `sys_` (jobs, settings, secuencias).
- PK `id uuid` (UUID v7, `HasUuids` de Laravel 12 genera v7 ordenables). Código legible `code varchar(30)` único por tenant (ej. `COT-2026-00191`), generado por `sys_sequences` con `SELECT … FOR UPDATE`.
- Dinero: `numeric(14,2)` + `currency char(3)` (ISO 4217: PEN, USD) + `fx_rate numeric(12,6)` conservado al momento de la operación (regla transversal 15). Nunca `float`.
- Fechas: `timestamptz` para instantes, `date` para fechas de servicio, `time` para horas locales; zona del tenant en `tenants.timezone`.
- Estados: `varchar(30)` + `CHECK (status IN (...))` (más simple de migrar que un ENUM nativo). Transiciones solo vía servicio de dominio (máquina de estados), nunca update directo.
- Borrado: `deleted_at timestamptz` (SoftDeletes) en entidades con historia; prohibido el borrado físico de registros usados en cotizaciones, reservas o finanzas.
- Auditoría de fila: `created_by`, `updated_by uuid` + `created_at`, `updated_at`.
- Concurrencia optimista: `lock_version integer not null default 0` en cotizaciones, reservas, salidas/cupos y pagos.
- JSONB solo para snapshots y atributos configurables (`attributes jsonb`), con índice GIN si se filtra.
- Índices: FK siempre indexadas; `(tenant_id, status)`, `(tenant_id, owner_id)`, `(tenant_id, created_at desc)` en tablas de listados.

## 3. API REST
- Prefijo `/api/v1`. Recursos en inglés plural y kebab-case: `/api/v1/crm/leads`, `/api/v1/quotes/{id}/versions`.
- Auth: **Laravel Sanctum** (tokens para Next.js BFF y apps móviles; cookie SPA opcional). MFA TOTP para roles internos.
- Autorización: `Policy` por modelo + permisos de **spatie/laravel-permission** con *teams* = tenant. El frontend nunca es autoridad.
- Listados: `?filter[status]=…&filter[owner]=me&sort=-created_at&include=client&page[size]=25&page[cursor]=…` (cursor pagination). Filtro `owner=me` obligatorio del lado servidor para el rol Ventas (ownership).
- Validación: `FormRequest`. Errores `422` con `errors{campo:[msg]}`; negocio `409` (conflicto de estado/disponibilidad) o `422` con `code` de regla (ej. `PRD-BR-002`).
- Operaciones críticas (convertir cotización, crear reserva, registrar pago, emitir voucher/comprobante, webhooks) requieren header **`Idempotency-Key`** (tabla `sys_idempotency_keys`, TTL 24 h, respuesta cacheada en Redis).
- Recursos con `lock_version`: enviar `If-Match`/`lock_version`; conflicto → `409`.
- Respuestas con `JsonResource`; montos como string decimal + `currency`.
- Documentar con OpenAPI 3.1 (p. ej. `dedoc/scramble`).

## 4. Eventos, colas y tiempo real
- Colas en Redis gestionadas con **Laravel Horizon**. Colas: `critical` (pagos, conversión), `default`, `notifications`, `documents` (PDF), `integrations`, `reports`, `low`.
- Eventos de dominio (`QuoteApproved`, `ReservationConfirmed`, `PaymentApplied`, `ServiceAssigned`, `IncidentCreated` …) → listeners en cola. Outbox transaccional para integraciones externas (tabla `sys_outbox`) cuando el efecto externo deba garantizarse.
- Jobs con `tries`, `backoff` exponencial, `ShouldBeUnique` cuando aplique, y registro en `sys_job_runs`.
- Scheduler (`routes/console.php`): expirar holds, vencer cotizaciones, recordatorios, alertas de vencimiento, etc.
- Tiempo real: **Laravel Reverb** (WebSockets) para notificaciones, bandeja de aprobaciones, inbox y tablero de operaciones. Canales privados `tenant.{tenantId}.user.{userId}`.
- Locks distribuidos Redis (`Cache::lock`) para cupos/salidas/asignaciones en paralelo.

## 5. Archivos y documentos
- Almacenamiento S3 compatible (disk `s3`), rutas `tenants/{tenant_id}/{dominio}/{uuid}.{ext}`, URLs firmadas temporales.
- PDFs (cotización, voucher, comprobante, liquidación) generados por job en cola `documents` (Browsershot/Chromium o DomPDF), versionados en `sys_documents` con hash.

## 6. Frontend Next.js
- App Router con grupos de rutas por experiencia: `app/(backoffice)/…`, `app/(portal-cliente)/…`, `app/(portal-pasajero)/…`, `app/(b2b)/…`, `app/(extranet-proveedor)/…`, `app/(plataforma)/…`. El middleware de Next redirige según la experiencia del rol (tabla ROLE_UX del prototipo), pero la autorización real la hace la API.
- Ruta Next.js sugerida = ruta del prototipo sin `#/` (ej. `#/crm/leads/LEAD-0231` → `/crm/leads/[code]`).
- Datos con TanStack Query; formularios React Hook Form + Zod (esquemas espejo de los FormRequest); tablas TanStack Table; componentes accesibles (Radix/shadcn) con los tokens de color del prototipo (`app.css`).
- Subdominio por tenant (`{slug}.dominio.com`) o dominio propio; el tenant se resuelve en backend desde el token/host.

## 7. Pruebas
- Backend: **Pest** (unit + feature). Obligatorias por módulo: aislamiento tenant (A no ve B), RBAC (403), ownership de Ventas, máquina de estados, reglas de negocio, idempotencia.
- E2E: **Playwright** sobre Next.js con los casos E2E-01…E2E-10 de DOC-PROC-001.

## 8. Plantilla obligatoria de cada especificación de módulo
```
# <Módulo>
## 1. Propósito y procesos cubiertos (PROC-xxx)
## 2. Pantallas (tabla: Ruta prototipo | Ruta Next.js | Qué hace | Roles con acceso)
## 3. Modelo de datos PostgreSQL (una tabla markdown por entidad: columna | tipo | null | notas/FK/índice) + restricciones clave
## 4. Máquinas de estado (estados, transiciones, quién las dispara, efectos)
## 5. Reglas de negocio (ID | regla | dónde se valida: FormRequest / Policy / Service / constraint DB / Job)
## 6. API REST (Método | Endpoint | Permiso | Descripción | Idempotente/lock)
## 7. Permisos y comportamiento por rol (qué ve y qué hace cada rol, alcance de datos)
## 8. Eventos, jobs (colas Redis) y notificaciones
## 9. Auditoría (acciones críticas registradas)
## 10. Casos de prueba mínimos (Pest / Playwright)
## 11. Cambios y decisiones respecto a la documentación inicial (qué se agregó, cambió o precisó y por qué)
## 12. Supuestos y puntos a validar con negocio
```
Escribir en español, directo, en tablas; sin relleno. Documentar lo que el prototipo realmente hace (leer el código), no lo que se supone.
