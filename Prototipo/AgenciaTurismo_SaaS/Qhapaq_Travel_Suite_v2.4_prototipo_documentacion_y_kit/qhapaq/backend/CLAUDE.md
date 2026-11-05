# CLAUDE.md — backend (Laravel 12 · PHP 8.4)

API del SaaS multi-tenant **Qhapaq Travel Suite** para agencias de viajes y tour operadores (Perú). Todo el negocio y las reglas viven aquí; el frontend y las apps solo presentan.

## Fuentes de verdad (en este orden)
1. `docs/kit/database/*.sql` — esquema PostgreSQL validado. Nombres de tablas y columnas salen de aquí.
2. `docs/kit/api/openapi.yaml` — contrato de la API. Ruta, método, permiso (`x-permission`), `Idempotency-Key` e `If-Match` salen de aquí.
3. `docs/especificaciones/NN-*.md` — comportamiento, estados, reglas (IDs como `PRD-BR-005`, `QTE-BR-12`), permisos por rol y pruebas.
4. `docs/04-HALLAZGOS-Y-DECISIONES.md` — lo que el prototipo hace mal y NO debe copiarse (H-01…H-21).
5. Prototipo (`docs/prototipo/index.html`) — solo referencia visual y de flujo.

Apoyo (no son fuente de verdad, se regeneran desde las anteriores): `docs/kit/ejemplos/backend/` (tenancy, idempotencia, concurrencia, máquina de estados, `ConvertQuoteToReservation` completo, adaptadores Fake), `docs/kit/database/referencia/` (diccionario y ER), `docs/kit/referencia/MAQUINAS-DE-ESTADO.md`, `REGLAS-DE-NEGOCIO.md`, `CODIGOS-DE-ERROR.md`, `EVENTOS-JOBS-NOTIFICACIONES.md`, `PERMISOS.md`.
Si dos fuentes chocan, gana la de número menor y se anota la diferencia en la sección 11 de la especificación y en `docs/CHANGELOG.md`.

## Comandos
- `make up` / `make down` — levanta o baja Docker (php, nginx, postgres 17, redis 8, horizon, reverb, minio, mailpit).
- `make test` — Pest contra PostgreSQL y Redis reales (nunca SQLite). `make test-f FILTER=Quote` para filtrar.
- `make lint` — Pint + Larastan nivel 8. `make openapi-check` — compara el OpenAPI generado (Scramble) con el contrato.
- `php artisan migrate:fresh --seed --seeder=DemoSeeder` — carga los datos de `docs/kit/seeds/*.json`.

## Estructura (monolito modular)
`app/Domain/{Shared,Iam,Platform,Crm,Catalog,Quotes,Bookings,Operations,Finance,Channels,Collaboration,Marketing,Supplier,Integrations}/`
cada uno con `Models/ Actions/ StateMachines/ Policies/ Http/{Controllers,Requests,Resources}/ Events/ Listeners/ Jobs/ Data/`.
- Controladores delgados: `FormRequest` valida → `Policy` autoriza → una `Action` hace el trabajo dentro de `DB::transaction`.
- Una clase `Action` por caso de uso con nombre verbo+objeto: `ConvertQuoteToReservation`, `RegisterPayment`, `AssignResource`.
- Cambios de estado SOLO a través de la máquina de estados del dominio; nunca `update(['status' => …])` directo.

## Reglas que no se negocian
- **Tenancy:** todo modelo de negocio usa el trait `BelongsToTenant` (global scope + `tenant_id` asignado desde el contexto). El middleware `SetPostgresTenant` ejecuta `SET LOCAL app.tenant_id` por transacción; las políticas RLS de `90_rls.sql` son la segunda barrera. Nunca aceptar `tenant_id` del request. Jobs: serializan y restablecen el tenant.
- **Autorización:** spatie/laravel-permission con *teams* = tenant. Cada endpoint exige el permiso de `x-permission`. Ventas (ownership): `filter[owner]=me` forzado en servidor. Usuarios externos (cliente, pasajero, B2B, guía/conductor, proveedor) solo acceden a recursos vinculados a su cuenta.
- **Datos sensibles:** costos, márgenes y utilidad se OMITEN en el `JsonResource` según permiso (`finance.profitability`, `catalog.products.view_profitability`, `quotes.approve_internal`); Operaciones ve costos, no márgenes.
- **Dinero:** `numeric(14,2)` + `currency` + `fx_rate` conservado; en PHP usar `brick/money` o enteros en céntimos; nunca `float`.
- **Idempotencia:** header `Idempotency-Key` obligatorio donde el contrato lo marca (conversión, pagos, vouchers, comprobantes, checkout); middleware + `sys_idempotency_keys` + respuesta cacheada en Redis 24 h.
- **Concurrencia:** `lock_version` + `If-Match`; `Cache::lock` de Redis y `SELECT … FOR UPDATE` al consumir cupos/salidas/holds.
- **Motor de reservas:** `App\Domain\Bookings\BookingEngine` es la ÚNICA fuente de disponibilidad, reglas de pasajeros, precio, alojamiento, adicionales, pago y moneda (spec 16). Toda regla consulta el centro de reglas (`sys_booking_rules`, override por producto, plan mínimo del tenant); regla apagada o fuera del plan ⇒ sin efecto.
- **Auditoría:** acciones críticas → `audit_events` (actor, tenant, entidad, acción, antes, después, IP, correlation_id).
- **Integraciones:** siempre detrás de una interfaz + adaptador (`FiscalGateway`, `PaymentGateway`, `MessagingChannel`, `ReviewsProvider`, `FxRateProvider`) con implementación `Fake` para desarrollo. No inventar credenciales ni URLs de proveedores.
- **Colas:** Horizon con colas `critical, default, notifications, documents, integrations, reports, low`; jobs con `tries`, `backoff` y registro en `sys_job_runs`.

## Cómo trabajar una historia
1. Leer la historia en `docs/kit/backlog/fase-N.md` y las secciones de especificación que cita.
2. Escribir primero las pruebas Pest (criterios de aceptación → casos; usar plantillas de `docs/kit/tests/pest/`).
3. Migración(es) copiando la tabla de `docs/kit/database/` (una migración por tabla/agregado; RLS en la misma migración).
4. Modelo, Action, Policy, FormRequest, Resource, ruta según el contrato. 5. `make test lint openapi-check` en verde.
6. Si algo difiere de la especificación: actualizar su sección 11 y `docs/CHANGELOG.md` en el mismo commit.

## Estilo
PHP 8.4 estricto (`declare(strict_types=1)`), tipos en todo, enums de PHP para estados (valores idénticos a los CHECK de SQL), mensajes de error y de validación en español, código y nombres en inglés. Commits: `F1B-RES-02: convertir cotización en reserva (idempotente)`.
