# Pruebas de referencia — KipuControl

Plantillas ejecutables para que el asistente de IA (Claude Code) programe **primero la prueba de cada historia y después el código**. Cubren los 10 casos E2E de DOC-PROC-001 y las pruebas obligatorias de CONVENCIONES §7 (aislamiento de tenant, RBAC 403, ownership de Ventas, máquinas de estado, reglas de negocio, idempotencia) más el motor de reservas con el caso PRD-011.

```
kit-ia/tests/
├── README.md                     este documento
├── tools/recalcular-esperados.cjs   recalcula los valores del motor ejecutando el prototipo
├── e2e/                          Playwright + TypeScript sobre Next.js
│   ├── playwright.config.ts      proyectos desktop (1440 px) y movil-400; globalSetup
│   ├── package.json · tsconfig.json · .env.example
│   ├── SELECTORES.md             contrato de data-testid por pantalla (el frontend DEBE exponerlos)
│   ├── fixtures/global-setup.ts  reinicia la base y guarda sesión por rol (storageState)
│   ├── fixtures/auth.ts          fixtures pageAs(rol), apiAs(rol), passengerPage (enlace mágico)
│   ├── support/                  users (seeds/users.json), routes, testids, api, arrange, operator, rules, expected
│   └── specs/                    15 archivos, 82 pruebas en desktop + 9 en móvil 400 px
└── pest/                         plantillas Pest (Laravel 12) — copiar a tests/ del repo backend
    ├── Pest.php · Support/Helpers.php · Datasets/prd011.php
    ├── Feature/Tenancy/TenantIsolationTest.php        E2E-08 a nivel API
    ├── Feature/Rbac/ForbiddenByRoleTest.php           403 por rol + entitlement
    ├── Feature/Quotes/SalesOwnershipTest.php          ownership de Ventas
    ├── Feature/Quotes/QuoteLifecycleGuardsTest.php    guardas de la máquina de estados
    ├── Feature/Quotes/ConvertQuoteIdempotencyTest.php conversión idempotente
    ├── Feature/Booking/BookingRulesToggleTest.php     reglas activables vía API
    ├── Unit/Quotes/QuoteStateMachineTest.php          grafo de estados
    └── Unit/Booking/BookingEngineQuoteTest.php        precio PRD-011 y disponibilidad
```

## 1. Mapa de casos

| Caso | Archivo | Fase | Etiqueta |
|---|---|---|---|
| E2E-01 Lead → oportunidad → cotización → aprobación interna → envío → vista en portal → aprobación del cliente (+ H-04) | `e2e/specs/e2e-01-lead-a-aprobacion.spec.ts` | 1 | `@e2e01` |
| E2E-02 Conversión cotización → reserva, CxC 40/60, doble clic = 1 reserva, RT-3 | `e2e/specs/e2e-02-conversion.spec.ts` · `pest/Feature/Quotes/ConvertQuoteIdempotencyTest.php` | 1 | `@e2e02` |
| E2E-03 Orden → solicitud → confirmación → asignación con advertencia → voucher → vista del pasajero | `e2e/specs/e2e-03-orden-voucher.spec.ts` | 1 | `@e2e03` |
| E2E-04 App operador: confirmar → iniciar → check-in → evidencia → finalizar | `e2e/specs/e2e-04-app-operador.spec.ts` | 2 | `@e2e04` |
| E2E-05 Anticipo → pago → comprobante → costo → rentabilidad → liquidación (+ pago idempotente) | `e2e/specs/e2e-05-finanzas.spec.ts` | 1 | `@e2e05` |
| E2E-06 Portal del pasajero: alerta → lectura → itinerario → voucher | `e2e/specs/e2e-06-portal-pasajero.spec.ts` | 2 | `@e2e06` |
| E2E-07 Offline: 3 acciones en outbox, conflicto MOB-BR-05 resuelto, reenvío idempotente | `e2e/specs/e2e-07-offline-sync.spec.ts` | 2 | `@e2e07` |
| E2E-08 Aislamiento multi-tenant (404, X-Tenant-Id ignorado, 403 TENANT_SCOPE_VIOLATION, RLS) | `e2e/specs/e2e-08-aislamiento-tenant.spec.ts` · `pest/Feature/Tenancy/TenantIsolationTest.php` | 0 | `@e2e08` |
| E2E-09 Cancelación RES-2026-000348: penalidad 53 480, reembolso 0, CxC 30 036 | `e2e/specs/e2e-09-cancelacion.spec.ts` | 1 | `@e2e09` |
| E2E-10 Incidencia crítica desde app → alerta gerencia → resolución → cierre habilitado | `e2e/specs/e2e-10-incidencia-critica.spec.ts` | 2 | `@e2e10` |
| Disponibilidad por rangos PRD-011 (02–06 disponible · 07–09 ocupado · 10–14 disponible) | `e2e/specs/motor-disponibilidad-rangos.spec.ts` · `pest/Unit/Booking/BookingEngineQuoteTest.php` | 1 | `@motor` |
| Reglas de pasajeros por adulto | `e2e/specs/motor-pasajeros.spec.ts` · `pest/Unit/Booking/BookingEngineQuoteTest.php` | 1 | `@motor` |
| Checkout con adelanto y previsualización quitando ítems | `e2e/specs/checkout-adelanto-quitar-items.spec.ts` | 2 | `@motor` |
| Ownership de Ventas | `e2e/specs/ownership-ventas.spec.ts` · `pest/Feature/Quotes/SalesOwnershipTest.php` | 1 | `@ownership` |
| Acceso 403 por rol (UI y API) | `e2e/specs/rbac-403.spec.ts` · `pest/Feature/Rbac/ForbiddenByRoleTest.php` | 0 | `@rbac` |
| Máquina de estados de cotización | `pest/Unit/Quotes/QuoteStateMachineTest.php` · `pest/Feature/Quotes/QuoteLifecycleGuardsTest.php` | 1 | — |
| Precio del motor PRD-011 y reglas activables (regla apagada / plan sin la regla) | `pest/Unit/Booking/BookingEngineQuoteTest.php` · `pest/Feature/Booking/BookingRulesToggleTest.php` | 1 (reglas por plan: 3) | — |

Las etiquetas `@fase0`…`@fase2` permiten correr solo lo que ya existe: una prueba de una fase posterior falla hasta que su módulo se construye, y eso es lo esperado.

## 2. Valores esperados del motor (PRD-011)

Calculados ejecutando `window.BookingEngine.quote` y `dayStatus` en `proto/index.html` (fecha del prototipo `window.TODAY = 2026-09-29`, TC USD 3.74, temporada media factor 1.00). Fuente única: `e2e/support/expected.ts` y `pest/Datasets/prd011.php`.

Caso canónico: 12/10/2026 · 2 ADT + 1 CHD + 1 INF · alojamiento 3* en las 4 ciudades (1 doble + 1 simple por ciudad) · Museo Larco × 3 · adelanto 30 %.

| Escenario | Total | Adelanto | Saldo | Hab. / noches |
|---|---|---|---|---|
| PEN canónico | S/ 19 324.98 | S/ 5 797.49 | S/ 13 527.49 (vence hoy, con advertencia) | 8 / 9 |
| USD canónico | US$ 5 167.11 | US$ 1 550.13 | US$ 3 616.98 | 8 / 9 |
| Quitar Museo Larco (PEN) | S/ 19 174.98 | S/ 5 752.49 | S/ 13 422.49 | 8 / 9 |
| Quitar Lima (USD) | US$ 5 012.11 | US$ 1 503.63 | US$ 3 508.48 | 6 / 8 |
| R-LODGING apagada | S/ 15 371.80 | S/ 4 611.54 | S/ 10 760.26 | 0 / 0 |
| R-DEPOSIT apagada | S/ 19 324.98 | S/ 19 324.98 (solo pago total) | 0.00 | 8 / 9 |
| Plan Starter (R-LODGING y R-ADDONS no incluidas) | S/ 15 221.80 | S/ 4 566.54 | S/ 10 655.26 | 0 / 0 |
| Widget E2E (Larco × 1, USD) antes / después de quitar Lima | US$ 5 140.37 / 4 985.37 | 1 542.11 / 1 495.61 | 3 598.26 / 3 489.76 | 8/9 → 6/8 |

**Diferencia detectada con el prototipo:** con R-PREVIEW-REMOVE apagada, la especificación 17 (§5 y §10.5) exige que `removed[]` no altere el total (S/ 19 324.98), pero el prototipo devuelve S/ 19 174.98 porque marca la línea como quitada aunque ya no sea removible. Las pruebas siguen la especificación; no copiar ese comportamiento.

Para recalcular tras cambiar semillas:

```bash
npx playwright install chromium        # una vez
node kit-ia/tests/tools/recalcular-esperados.cjs proto/index.html > /tmp/esperados.json
```

## 3. Cómo correr las pruebas E2E (Playwright)

Requisitos: stack local levantado (`docker compose up`: API Laravel, Next.js, PostgreSQL 17, Redis 8, Mailpit), `E2ESeeder` disponible y fecha de negocio congelada en el backend (`APP_FROZEN_TODAY=2026-09-29` o equivalente).

```bash
cd kit-ia/tests/e2e
npm install
npx playwright install --with-deps chromium
cp .env.example .env            # ajustar URLs, contraseña y secreto TOTP de prueba
npx playwright test --grep @fase0            # lo que exige la Fase 0 (E2E-08 + RBAC)
npx playwright test --grep "@fase0|@fase1"   # al cerrar la Fase 1
npx playwright test --grep @e2e02            # un caso
npx playwright test --project=movil-400      # barrido responsive de las pantallas marcadas
npx playwright show-report
```

`global-setup.ts` ejecuta `E2E_DB_RESET_CMD` (base en estado semilla) e inicia sesión por la UI con cada rol (login + MFA TOTP); guarda la sesión en `.auth/{rol}.json` (no versionar). El pasajero entra con enlace mágico leído de Mailpit.

Qué debe proveer el backend para E2E (supuestos del kit, sin endpoints nuevos):

1. `Database\Seeders\E2ESeeder`: carga `kit-ia/seeds/*.json` en TNT-0001, crea TNT-0002 con su admin (`gerencia@selvaviva.pe`), asigna `E2E_PASSWORD` a todos los usuarios y `E2E_TOTP_SECRET` a los que tienen `mfa=true`, y deja al menos una asignación de G01 (U09) con fecha de hoy (E2E-04/07/10).
2. Todos los listados aceptan `filter[code]=` (lo usa `Api.idOf`).
3. Clave pública del widget del tenant demo en `E2E_WIDGET_PUBLIC_KEY`.

## 4. Cómo correr las pruebas Pest (backend)

1. Copiar `pest/*` a `tests/` del repositorio Laravel (respetando carpetas) y `kit-ia/seeds/*.json` a `database/seeders/data/`.
2. Base de pruebas en PostgreSQL 17 real (nunca SQLite): el usuario de conexión **no** es superusuario ni tiene `BYPASSRLS`, y las tablas de tenant usan `FORCE ROW LEVEL SECURITY`. Si RLS no está activa, `TenantIsolationTest` falla a propósito.
3. Ajustar en `Support/Helpers.php` los namespaces si difieren de 02-ARQUITECTURA §3 (`App\Domain\<Dominio>\Models|Actions|StateMachines`).

```bash
php artisan test                                   # o ./vendor/bin/pest
./vendor/bin/pest tests/Feature/Tenancy            # aislamiento
./vendor/bin/pest --filter=ConvertQuoteIdempotency
./vendor/bin/pest tests/Unit/Booking --parallel
```

Nombres de clases que las plantillas asumen (crear con estos nombres o ajustar los `use`): `BookingEngine` y DTOs `ProductData`, `QuoteSelection`, `RuleSet`, `FxTable`, `SeasonCalendar` en `App\Domain\Bookings`; `QuoteStateMachine`; `ConvertQuoteToReservation` (02-ARQUITECTURA §3; F1B-RES-02 la llama `ConvertQuoteToReservation`: unificar el nombre); `TenantContext`; `ChangeTenantPlan`; `QuoteFactory` con estados `approved()`, `sent()`, `withPendingInternalApproval()`.

## 5. Cómo debe usarlas la IA: primero la prueba, luego el código

Para **cada historia del backlog** (`kit-ia/backlog/fase-*.md`) Claude Code sigue este ciclo en una sola sesión:

1. **Leer** la historia completa (criterios de aceptación, endpoints, tablas, pruebas citadas) y las secciones de especificación que cita.
2. **Escribir la prueba primero**, copiando la plantilla más cercana:
   - endpoint nuevo → fila en `ForbiddenByRoleTest` (rol sin permiso), en `TenantIsolationTest` (recurso de A pedido por B) y, si el recurso tiene dueño, un caso en el estilo de `SalesOwnershipTest`;
   - estado nuevo → dataset en el estilo de `QuoteStateMachineTest` + guardas en Feature;
   - operación crítica → casos de `ConvertQuoteIdempotencyTest` (misma key, key distinta, concurrencia);
   - regla del motor → caso «regla apagada» y «plan sin la regla» como en `BookingRulesToggleTest`;
   - pantalla → spec Playwright con `data-testid` de `SELECTORES.md` (agregar los nuevos allí y en `support/testids.ts`).
3. **Ejecutarla y verla fallar** por la razón correcta (ruta inexistente, 200 en vez de 403, total distinto). Una prueba que pasa antes de escribir el código no prueba nada.
4. **Implementar lo mínimo** para ponerla en verde: migración, Action, FormRequest, Policy, Resource, pantalla.
5. **Correr la suite del módulo y las transversales** (`@fase0` + Pest de Tenancy/Rbac) antes de cerrar.
6. **Refactorizar** con las pruebas en verde.

Reglas para la IA:

- Nunca cambiar un valor esperado para que la prueba pase. Si el código correcto según la especificación da otro número, detenerse, explicar la diferencia y registrarla en la sección 11 de la especificación y en `CHANGELOG.md`.
- Nunca borrar ni marcar `skip` una prueba existente sin justificarlo en el mensaje de commit.
- Sin `waitForTimeout` ni `sleep`: esperar estados (`toHaveAttribute`, `expect.poll`).
- Preparar datos por API (`support/arrange.ts`) o factories, no con clics de otra prueba; cada prueba es independiente.
- Los montos se comparan como string decimal de 2 decimales (`data-amount`, `toBeMoney`), nunca como float.
- Las reglas del prototipo marcadas en `04-HALLAZGOS-Y-DECISIONES.md` (H-01…H-21) no se copian: la prueba sigue la corrección indicada.

Prompt sugerido para cada sesión:

```
Historia F1A-MOT-06 (pegar el bloque completo). Especificación: 16 §6.1 y §10.1.
1) Escribe primero las pruebas Pest a partir de kit-ia/tests/pest (BookingEngineQuoteTest y BookingRulesToggleTest)
   y ejecútalas: deben fallar. 2) Implementa lo mínimo hasta verde. 3) Corre también tests/Feature/Tenancy y Rbac.
No cambies valores esperados; si discrepan de la especificación, detente y explícame por qué.
```

## 6. Supuestos del kit

- Rutas Next.js de experiencias externas con segmento propio (`/portal-cliente`, `/portal-pasajero`, `/plataforma`) para evitar la colisión de route groups sin segmento; se cambia en `e2e/support/routes.ts` si se opta por subdominio.
- Apps React Native: E2E-04, E2E-07 y E2E-10 ejercen el contrato `/api/v1/mobile/operator/*` que usa la app y verifican su efecto en el back-office; la UI de la app (outbox local, coalescencia MOB-BR-03, estados pending/syncing) se prueba con Maestro o Detox en el repo `mobile`. El formato de `payload` por tipo de acción es supuesto hasta que exista el OpenAPI.
- Cuerpos de `POST /quotes` y `POST /finance/payments` en `support/arrange.ts` y specs según las §6; ajustar al FormRequest real.
- La vista previa interna del portal del pasajero para una reserva usa `?reserva={code}` (la especificación no fija el parámetro).
- `Concurrency::run` en la prueba de conversión concurrente requiere el driver `process`; alternativa: `pest --parallel` con dos procesos disparando la misma Action.
