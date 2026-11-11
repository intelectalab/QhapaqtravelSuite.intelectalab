# Código de referencia — KipuControl

Archivos **listos para copiar** que resuelven las reglas de los `CLAUDE.md` del kit (`claude/backend`, `claude/web`, `claude/mobile`) con los nombres exactos del esquema (`database/*.sql`), del contrato (`api/openapi.yaml`) y de las plantillas de pruebas (`tests/pest`, `tests/e2e`). Comentarios en español; código en inglés.

No son un proyecto ejecutable: son las piezas transversales y **un caso de uso completo** (convertir cotización en reserva) que sirven de patrón para el resto de historias. La guía que explica cómo encajan está en [`../GUIA-TECNICA.md`](../GUIA-TECNICA.md).

## 1. Cómo usarlo

| Carpeta del kit | Copiar a | Notas |
|---|---|---|
| `ejemplos/backend/app/**` | `backend/app/**` (misma ruta) | Namespaces `App\Domain\{Shared,Bookings,Quotes,Integrations}`, `App\Http\Middleware`, `App\Exceptions`, `App\Providers`. |
| `ejemplos/backend/bootstrap/app.php`, `routes/api.php`, `config/integrations.php` | Fusionar con los del proyecto | Son **extractos**: alias de middleware, prioridad, renderer de errores, rate limits, ruta de conversión. |
| `ejemplos/backend/database/migrations/*` | `backend/database/migrations/` | **Generadas** desde el SQL con `tools/generar_migracion.py` (no editar a mano). |
| `ejemplos/web/src/**` | `web/src/**` | Alias `@/*` → `src/*`. Copiar además `kit-ia/design/tokens.json` y `tailwind.preset.ts` a `web/src/design/`. |
| `ejemplos/web/src/lib/api/schema.d.ts` | (generado) | `npm run api:gen` = `openapi-typescript docs/kit/api/openapi.yaml -o src/lib/api/schema.d.ts`. |
| `ejemplos/mobile/src/**` | `mobile/src/**` | Expo SDK con `expo-sqlite` (API asíncrona) y `@react-native-community/netinfo`. |

Dependencias que asumen los ejemplos: backend `laravel/sanctum`, `spatie/laravel-permission` (teams), `brick/money`, `laravel/horizon`; web `next@15`, `react@19`, `@tanstack/react-query@5`, `@tanstack/react-table@8`, `react-hook-form@7`, `zod@3`, `@hookform/resolvers`, `openapi-fetch`, `openapi-typescript` (dev), `tailwindcss@3`; mobile `expo-sqlite`, `@react-native-community/netinfo`, `expo-secure-store`, `expo-crypto`.

## 2. Qué archivo resuelve qué regla

### Backend (`claude/backend/CLAUDE.md`)

| Regla del CLAUDE.md | Archivos | Fuente |
|---|---|---|
| **Tenancy** — `BelongsToTenant`, tenant nunca del request | `Domain/Shared/Tenancy/TenantContext.php`, `TenantScope.php`, `BelongsToTenant.php` | CONVENCIONES §1; spec 00 SEC-BR-02 |
| Resolver tenant por token u host | `Http/Middleware/ResolveTenant.php` (usa `app_resolve_tenant_by_host` de `90_rls.sql`) | 02-ARQUITECTURA §4; database/README §5 |
| `SET LOCAL app.tenant_id` por transacción | `Http/Middleware/SetPostgresTenant.php`, `Domain/Shared/Tenancy/TenantDatabase.php` (llama `app_set_tenant()`) | `00_extensions_and_functions.sql` |
| Jobs restablecen el tenant | `Domain/Shared/Tenancy/Jobs/TenantAware.php`, `RestoreTenantContext.php` (nombre exigido por `TenantIsolationTest`) | spec 00 §3.11 |
| **Idempotencia** `Idempotency-Key` + `sys_idempotency_keys` + Redis 24 h | `Http/Middleware/IdempotencyMiddleware.php` | spec 00 §3.8, SEC-BR-16 |
| **Concurrencia** `lock_version` + `If-Match` | `Domain/Shared/Concurrency/IfMatch.php`, `HasLockVersion.php` | SEC-BR-17 |
| `Cache::lock` + `SELECT … FOR UPDATE` al consumir cupos | `Domain/Shared/Concurrency/InventoryLock.php` (orden fijo de ids) | spec 04 §4.3 pasos 1, 6; spec 16 §8.4 |
| **Estados** solo vía máquina de estados; enum = CHECK | `Domain/Shared/StateMachine/*`, `Bookings/Enums/ReservationStatus.php`, `Bookings/StateMachines/ReservationStateMachine.php`, `Quotes/Enums/QuoteStatus.php`, `Quotes/StateMachines/QuoteStateMachine.php` | spec 04 §4.1; spec 03 §4.1; `QuoteStateMachineTest` |
| Controlador delgado → FormRequest → Policy → Action | `Quotes/Http/Controllers/QuoteConversionController.php`, `Quotes/Http/Requests/ConvertQuoteRequest.php`, `Quotes/Policies/QuotePolicy.php`, `Bookings/Actions/ConvertQuoteToReservation.php` (+ `Support/ServicesFromQuoteItem.php`), `routes/api.php` | spec 04 §4.3 (19 pasos); `ConvertQuoteIdempotencyTest` |
| Eventos de dominio después del commit; listeners en cola | `Bookings/Events/*`, `Quotes/Events/QuoteConverted.php`, `Bookings/Listeners/NotifyReservationConfirmed.php` | SEC-BR-22; CONVENCIONES §4 |
| **Datos sensibles** omitidos en `JsonResource` | `Domain/Shared/Http/Resources/RevealsSensitiveAmounts.php`, `Bookings/Http/Resources/ReservationResource.php` | SEC-BR-13 |
| **Dinero** `numeric` + `currency` + `brick/money` | `Domain/Shared/Money/MoneyCast.php`, `Decimal.php` (round2, reparto con residuo en la última línea, conversión con TC conservado) | CONVENCIONES §2; regla transversal 15 |
| Formato estándar de error, 403 auditado | `Exceptions/ApiExceptionRenderer.php`, `Domain/Shared/Errors/ApiException.php` | spec 00 §6, SEC-BR-07 |
| correlation_id (`X-Request-Id`) | `Http/Middleware/AssignCorrelationId.php` | spec 00 §9 |
| **Motor de reservas** único + centro de reglas | `Bookings/Contracts/BookingEngineInterface.php`, `Bookings/BookingEngine.php` (esqueleto: disponibilidad y pasajeros completos), `Bookings/Data/*`, `Bookings/Rules/RuleResolver.php`, `Bookings/Inventory/DatabaseInventoryReader.php`, `Bookings/Testing/InMemoryInventory.php` | spec 16 §8.1; spec 17 §3.1 (regla efectiva v2.2); `BookingEngineQuoteTest` |
| **Auditoría** `audit_events` | `Domain/Shared/Audit/AuditLogger.php`, `AuditCodeGenerator.php` | spec 00 §3.6, §9 |
| Correlativos `sys_sequences` | `Domain/Shared/Sequences/SequenceService.php` | spec 00 §3.7, SEC-BR-20 |
| Outbox transaccional `sys_outbox` | `Domain/Shared/Outbox/OutboxWriter.php` | spec 00 §3.9 |
| **Colas**: registro en `sys_job_runs` | `Domain/Shared/Jobs/RecordJobRun.php` | CONVENCIONES §4 |
| **Integraciones** con interfaz + `Fake` | `Integrations/Contracts/*` (`FiscalGateway`, `PaymentGateway`, `MessagingChannel`, `ReviewsProvider`, `FxRateProvider`), `Integrations/Fake/*`, `Integrations/Data/*`, `Providers/IntegrationServiceProvider.php`, `config/integrations.php` | `infra/env/backend.env.example`; D-01, D-02, D-03, D-12, D-15 |
| Migración = copia exacta del SQL + RLS en la misma migración | `database/migrations/2026_02_01_000500_create_booking_reservations_table.php`, `…_add_columns_to_booking_reservations_table.php` | database/README §6 |
| Rate limit, registro de policies, modo estricto de Eloquent | `Providers/AppServiceProvider.php`, `bootstrap/app.php` | SEC-BR-25 |

### Web (`claude/web/CLAUDE.md`)

| Regla del CLAUDE.md | Archivos |
|---|---|
| Cliente tipado generado del contrato; `Idempotency-Key`, `If-Match`, manejo 409/422 | `lib/api/client.ts`, `lib/api/errors.ts`, `lib/api/idempotency.ts`, `lib/api/critical-ops.ts` (generado) |
| El token nunca llega al navegador (BFF) | `app/bff/[...path]/route.ts` |
| TanStack Query con claves por recurso y tenant; paginación por cursor | `features/reservations/api.ts`, `features/quotes/useConvertQuote.ts`, `lib/access/access-context.tsx` (`useTenantKey`) |
| `middleware.ts` por experiencia (ROLE_UX) | `middleware.ts`, `lib/access/role-ux.ts` |
| Acciones sin permiso ocultas o deshabilitadas con «Requiere permiso x.y» | `components/auth/PermissionGate.tsx` |
| Badges con `toneFor()` del preset y `data-status` | `components/ui/StatusBadge.tsx` |
| React Hook Form + Zod; errores 422 por campo; `code` de regla | `features/reservations/CancelReservationForm.tsx`, `lib/forms/apply-server-errors.ts` |
| Tabla responsive (≤ 900 px tarjetas con etiqueta por columna, regla `ResponsiveTables` v2.4) y hoja inferior de acciones | `components/data-table/DataTable.tsx`, `components/ui/ActionSheet.tsx`, `lib/ui/useMediaQuery.ts`, ejemplo de uso `features/reservations/ReservationsTable.tsx` |
| Shell con topbar móvil (búsqueda como icono, secundarias en menú de usuario) | `components/layout/AppShell.tsx` |

### Mobile (`claude/mobile/CLAUDE.md`)

| Regla | Archivos |
|---|---|
| SQLite local + outbox con estados `pending → syncing → synced \| failed \| conflict` | `offline/db.ts`, `offline/outbox.ts` |
| Sincronización en orden, lotes de 50, backoff con jitter, `Idempotency-Key`, 409 = el servidor gana | `offline/sync.ts` |
| Estado de sincronización siempre visible | `offline/useOutboxStatus.ts` |

## 3. Herramientas (`tools/`)

| Script | Qué hace |
|---|---|
| `verificar_todo.sh` | Regenera lo generado y ejecuta todas las verificaciones. |
| `generar_migracion.py <tabla> --sql 20_fase1.sql` | Migración Laravel que reproduce la tabla del SQL (CHECK, UNIQUE parciales, FKs, índices, triggers, comentarios) + `app_enable_tenant_rls`. `--solo-alter` para columnas que agrega otra fase. |
| `verificar_migracion.sh` | Cluster PostgreSQL temporal: carga 00→90, `pg_dump` de la tabla, aplica `down()`+`up()` de las migraciones y compara: deben ser idénticos. |
| `extraer_sql_migracion.py` | Auxiliar del anterior (extrae el SQL de `up()`/`down()`). |
| `verificar_backend.py` | `php -l` de todos los PHP + tablas y columnas usadas contra `database/*.sql` + lista de clases que el proyecto debe aportar. |
| `generar_operaciones_criticas.py` | `critical-ops.ts` (web y mobile) desde `api/openapi.json`: operaciones con `Idempotency-Key` y con `If-Match`. |
| `verificar_typescript.sh` | `tsc --noEmit` estricto de web/ y mobile/ con los tipos generados del contrato y las librerías reales. |
| `validar_mermaid.cjs` | Renderiza los diagramas Mermaid de la guía para detectar errores de sintaxis. |

Resultado de la última ejecución: 81 archivos PHP sin errores de sintaxis (PHP 8.4) y 0 columnas inexistentes (27 tablas, ~270 referencias); migración de `booking_reservations` idéntica al SQL en PostgreSQL 16; `tsc --noEmit` estricto sin errores en web (19 archivos) y mobile (5 archivos).

## 4. Clases que el proyecto debe aportar

Los ejemplos referencian, sin incluirlas: `App\Domain\Iam\Models\User` (`iam_users`, con `HasRoles` de spatie y `HasApiTokens`), `App\Domain\Platform\Models\Tenant` (`tenants`), `App\Domain\Crm\Models\Client` (`crm_clients`), `App\Domain\Notifications\Notify` (spec 00 §8.1) y los middleware de la historia F0 `EnsureTenantActive`, `EnsureMfaVerified`, `SetPermissionsTeam`, `EnsureExperience` (spec 00 §11 fila 1). Conexiones de BD supuestas en `config/database.php`: `pgsql` (usuario `kipucontrol_app`), `pgsql_platform` (`kipucontrol_platform`), `pgsql_owner` (migraciones) — las tres están en `infra/env/backend.env.example` — y `pgsql_audit` (**Supuesto**: segunda conexión con `kipucontrol_app` para escribir auditoría fuera de la transacción de la solicitud).

## 5. Supuestos y diferencias detectadas entre fuentes

| # | Tema | Decisión en los ejemplos | Acción sugerida |
|---|---|---|---|
| 1 | Misma `Idempotency-Key` con otro cuerpo | **422** `IDEMPOTENCY_KEY_REUSED` (contrato, spec 00 SEC-BR-16 y Pest). 409 queda para `IDEMPOTENCY_IN_PROGRESS`. | — |
| 2 | Código de `If-Match` desactualizado | `STALE_VERSION` en spec 00, contrato y Pest. | Resuelto en la v2.4 del kit. |
| 3 | Respuesta de `POST /quotes/{id}/convert` | 201 con la reserva; 200 con la misma reserva si ya estaba convertida (spec 04 §4.3, contrato y `ConvertQuoteIdempotencyTest`). | Resuelto en la v2.4 del kit. |
| 4 | `audit_events.code` (bigint sin default en el SQL) | Contador Redis por tenant (`AuditCodeGenerator`). | Decidir: secuencia PostgreSQL o contador. |
| 5 | `sys_sequences.year_reset` vs trigger «next_number no decrece» | No se reinicia la numeración; se usa el prefijo guardado. | Por definir (serie por año o ajuste del trigger). |
| 6 | Códigos de CxC y de servicios de reserva | `doc_type = 'receivable'` (prefijo `CXC-`, como la semilla) y `RS-{nº reserva}{nn}` (como el prototipo). | Confirmar y sembrar la serie. |
| 7 | `service_kind` / `requires_assignment` desde `catalog_services.type` | Mapeo propuesto en `ServicesFromQuoteItem::kindFor()`. | Validar con Operaciones (spec 05 §11-24). |
| 8 | Canal de la reserva desde el segmento del cliente | `crm_clients.segment_code` comparado sin mayúsculas con Corporativo/B2B/Grupos. | Confirmar códigos del catálogo de segmentos. |
| 9 | Rutas de portales externos | Las de `tests/e2e/support/routes.ts` (`/portal-cliente`, `/portal-pasajero`, `/b2b`, `/proveedor`, `/plataforma`, `/app-operador`), ahora también en `claude/web/CLAUDE.md`. | Resuelto en la v2.4 del kit. |
| 10 | Forma de `/me/access`, `/mobile/operator/sync`, `…/cancellation/preview` | Tipadas a mano según el texto de las specs (el contrato las publica como `GenericObject`). | Tipar los esquemas en las specs. |
| 11 | `status_label` y `services[]` en la reserva | El Resource de ejemplo los agrega; el esquema `BookingReservation` no los tiene. | Agregar al contrato si se adoptan. |
| 12 | Costos visibles para Operaciones | Se identifica por `operations.assign` (SEC-BR-13 no nombra el permiso). | Confirmar o crear permiso explícito. |
| 13 | Alcance de datos (own/tenant/linked) | Derivado del rol semilla (`sales` = own; externos = linked). | Para roles personalizados usar `roles.scope`. |
| 14 | `BookingEngine` pasos 3–10 y 12 | Lanzan `LogicException` («por implementar»): no devuelven precios incompletos. | Historias F1A-MOT-06 y E2.7. |
| 15 | Motivos de cancelación | Catálogo recibido por props. | Por definir con negocio (spec 04 §4.6). |
