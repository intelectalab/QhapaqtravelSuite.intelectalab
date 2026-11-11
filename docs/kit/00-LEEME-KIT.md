# Kit de desarrollo con IA — KipuControl

Todo lo necesario para programar el SaaS completo (fases 0 a 3) con un asistente de IA como Claude Code: el esquema de base de datos validado, el contrato de la API, el backlog de historias con criterios de aceptación, las pruebas de referencia, los datos semilla, el sistema de diseño, la infraestructura local, las instrucciones para el asistente y material de referencia técnica para el programador: guía técnica, código de ejemplo verificado, diccionario de datos con diagramas entidad-relación, máquinas de estado, reglas de negocio, códigos de error, eventos y jobs, permisos, glosario y una colección de la API lista para importar.

El kit no incluye equipo, plazos ni estimaciones de tiempo: eso lo definen la empresa y el proyectista.

Stack: **Laravel 12 / PHP 8.4** · **PostgreSQL 17** (RLS por tenant) · **Redis 8** · **Next.js** (App Router, TypeScript) · **React Native / Expo**.

## 1. Contenido

| Carpeta | Qué contiene | Cifras |
|---|---|---|
| `database/` | SQL de PostgreSQL por fase (extensiones y funciones, plataforma, fases 0–3, RLS), DBML para diagramas, prueba de humo y validador. Conflictos entre especificaciones resueltos y documentados. | 262 tablas · validado en PostgreSQL |
| `api/` | Contrato OpenAPI 3.1 (`openapi.yaml`/`.json`), índice `ENDPOINTS.md`, generador desde las especificaciones y comparador contra el código. Cada operación trae permiso (`x-permission`), fase (`x-phase`), spec de origen e idempotencia. | 1 006 endpoints en 852 rutas (F0 84 · F1 411 · F2 371 · F3 140) |
| `backlog/` | Historias por fase en Markdown y CSV, con especificación, tablas, endpoints, pantallas, criterios, pruebas, dependencias y prioridad. `README.md` (resumen y épicas) y `FORMATO.md`. | 378 historias · 49 épicas |
| `tests/` | Playwright (TypeScript) con fixtures por rol y contrato de `data-testid`; plantillas Pest para aislamiento de tenant, 403 por rol, ownership, máquinas de estado, idempotencia y motor de reservas. | 91 pruebas E2E · 72 pruebas Pest · 138 selectores |
| `seeds/` | Datos demo del prototipo en JSON (tenants, usuarios por rol, productos, tarifas, reservas, pagos, reglas, monedas, reseñas…), base del `DemoSeeder` y del `E2ESeeder`. | 108 colecciones |
| `design/` | Tokens (claro/oscuro, tono por estado), `globals.css`, preset de Tailwind v3 / tema v4, tema para Expo y `COMPONENTES.md`. | 102 estados con color |
| `infra/` | Docker Compose (php-fpm, nginx, Horizon, scheduler, Reverb, Next.js, PostgreSQL 17, Redis 8, MinIO, Mailpit), `.env` de ejemplo, `Makefile` y CI de GitHub Actions. | 10 servicios |
| `claude/` | `CLAUDE.md` raíz y por repositorio (backend, web, mobile), 10 comandos, 3 subagentes y permisos para Claude Code. | — |
| `PROMPTS.md` | Prompts listos para pegar, por fase y de uso diario. | — |
| `GUIA-TECNICA.md` | Guía de arranque para el programador: arquitectura, ciclo de vida de una petición, tenancy y RLS paso a paso, permisos y experiencias, dinero y monedas, idempotencia y concurrencia, motor de reservas y centro de reglas, integraciones, colas y tiempo real, frontend y móvil, pruebas, seguridad, observabilidad, rendimiento, despliegue y preguntas frecuentes. | 18 secciones |
| `ejemplos/` | Código de referencia listo para copiar: backend Laravel (tenancy, RLS, idempotencia, `lock_version`, máquina de estados, caso completo `ConvertQuoteToReservation`, recursos que ocultan costos, `BookingEngine` y `RuleResolver`, adaptadores Fake, auditoría, secuencias, migración con RLS), web Next.js (cliente tipado, hooks, `middleware.ts`, `PermissionGate`, formulario con errores 422, `DataTable` responsive, `AppShell` móvil) y app Expo (outbox offline). Verificado: `php -l`, columnas contra el SQL, migración idéntica al esquema y `tsc` estricto. | 81 PHP · 19 TS web · 5 TS móvil |
| `database/referencia/` | Diccionario de datos generado desde el catálogo de PostgreSQL (por dominio y fase; columnas, FKs, UNIQUE parciales, CHECK, índices, triggers, RLS), `diccionario.csv` y diagramas entidad-relación por dominio (Mermaid + SVG + visor HTML). | 262 tablas · 4 146 columnas · 804 FKs · 18 diagramas |
| `referencia/` | `MAQUINAS-DE-ESTADO.md` (valores, transiciones, permisos, guardas y diagrama por entidad), `REGLAS-DE-NEGOCIO.md/.csv`, `CODIGOS-DE-ERROR.md`, `EVENTOS-JOBS-NOTIFICACIONES.md`, `PERMISOS.md` + matrices rol × permiso y rol × pantalla, `GLOSARIO.md`. | 108 columnas de estado · 747 reglas · 144 eventos · 89 jobs · 115 notificaciones · 105 términos |
| `api/postman/` | Colección Postman v2.1 generada del contrato (login que guarda el token, `Idempotency-Key` e `If-Match` donde corresponde, cuerpos de ejemplo) y entornos `local` y `tenant-b`. Importable en Postman, Insomnia y Bruno. | 1 006 requests |

El kit se usa junto con la documentación funcional (`docs/`): `CONVENCIONES.md`, `02-ARQUITECTURA.md`, `03-PLAN-DE-IMPLEMENTACION.md`, `04-HALLAZGOS-Y-DECISIONES.md`, las 19 especificaciones de `especificaciones/` y el prototipo navegable.

## 2. Armar el espacio de trabajo

```text
kipucontrol/                          ← abrir Claude Code aquí para trabajo transversal
├── CLAUDE.md                    ← kit/claude/CLAUDE.md
├── .claude/                     ← kit/claude/.claude/ (commands, agents, settings.json)
├── docker-compose.yml  Makefile  docker/      ← kit/infra/
├── .github/workflows/ci.yml     ← kit/infra/github/workflows/ci.yml
├── backend/   CLAUDE.md         ← kit/claude/backend/CLAUDE.md   · .env.example ← kit/infra/env/backend.env.example
├── web/       CLAUDE.md         ← kit/claude/web/CLAUDE.md       · .env.example ← kit/infra/env/web.env.example
├── mobile/    CLAUDE.md         ← kit/claude/mobile/CLAUDE.md    · .env.example ← kit/infra/env/mobile.env.example
└── docs/
    ├── CONVENCIONES.md  02-ARQUITECTURA.md  03-PLAN…  04-HALLAZGOS…  CHANGELOG.md
    ├── especificaciones/00…18-*.md
    ├── prototipo/               ← carpeta del prototipo (index.html + assets/)
    └── kit/                     ← esta carpeta completa
```

Pasos:

```bash
mkdir kipucontrol && cd kipucontrol && git init
mkdir -p docs backend web mobile
# copiar la documentación y el prototipo en docs/, y este kit en docs/kit/
cp docs/kit/claude/CLAUDE.md . && cp -r docs/kit/claude/.claude .
cp docs/kit/claude/backend/CLAUDE.md backend/ && cp docs/kit/claude/web/CLAUDE.md web/ && cp docs/kit/claude/mobile/CLAUDE.md mobile/
cp docs/kit/infra/docker-compose.yml docs/kit/infra/Makefile . && cp -r docs/kit/infra/docker .
mkdir -p .github/workflows && cp docs/kit/infra/github/workflows/ci.yml .github/workflows/
```

Con un solo repositorio (monorepo) funciona tal cual. Si se prefieren repositorios separados, cada uno lleva su `CLAUDE.md` y una copia (o submódulo) de `docs/`.

Instalación y uso de Claude Code: documentación oficial en <https://docs.claude.com/en/docs/claude-code/overview>. Los formatos de `CLAUDE.md`, comandos (`.claude/commands/*.md`), subagentes (`.claude/agents/*.md`) y `settings.json` siguen esa documentación; si alguna opción cambia de nombre en una versión nueva, ajustarla allí.

## 3. Fuentes de verdad

Cuando dos fuentes no coinciden, gana la de número menor y la diferencia se anota en la §11 de la especificación y en `docs/CHANGELOG.md`:

1. `kit/database/*.sql` — nombres y tipos de tablas y columnas, estados (CHECK), índices, RLS.
2. `kit/api/openapi.yaml` — rutas, métodos, permisos, idempotencia, concurrencia.
3. `especificaciones/NN-*.md` — comportamiento, reglas de negocio, permisos por rol, pruebas.
4. `04-HALLAZGOS-Y-DECISIONES.md` — lo que el prototipo hace mal y no debe copiarse (H-01…H-21) y decisiones tomadas (D-01…D-15).
5. Prototipo — referencia visual, textos y flujo.

## 4. Ciclo de trabajo por historia

```text
/siguiente-historia 1a            → elegir historia con dependencias cumplidas
/implementar-historia F1A-CRM-03  → plan → pruebas → código → batería en verde
subagente verificador-historia    → revisión independiente, criterio por criterio
/revisar-seguridad                → tenancy, permisos, datos sensibles, dinero
git commit -m "F1A-CRM-03: …"     → el ID en el commit mide el avance
```

Una historia por sesión; `/clear` entre historias. Las historias de pantalla empiezan con el subagente `explorador-prototipo` sobre la ruta equivalente del prototipo.

Comandos incluidos: `implementar-historia`, `siguiente-historia`, `nueva-migracion`, `nuevo-endpoint`, `nueva-pantalla`, `revisar-seguridad`, `verificar-contrato`, `actualizar-docs`, `cerrar-fase`, `corregir-error`. Subagentes: `revisor-seguridad`, `verificador-historia`, `explorador-prototipo`.

## 5. Fases

| Fase | Alcance | Historias | Salida |
|---|---|--:|---|
| 0 · Fundaciones | Repos, Docker, CI, tenancy + RLS, Sanctum + MFA, RBAC (ACCESS/ROLE_UX), auditoría, secuencias, idempotencia, colas, notificaciones básicas, PDF, configuración del tenant, shell Next.js por experiencia, 403 | 49 | E2E-08 y 403 por rol en verde |
| 1A · MVP comercial | CRM, catálogo, motor de reservas básico (rangos, pasajeros, tarifas, temporadas, salidas, holds), cotizaciones | 62 | E2E-01 en verde; PRD-011 exacto al céntimo |
| 1B · MVP operativo | Reservas, operaciones sin apps, finanzas básicas, portal del cliente, reportes básicos, Libro de Reclamaciones | 83 | E2E-02, 03, 05 y 09 en verde; uso interno |
| 2 · Canales y campo | Apps móviles, portal del pasajero y B2B, extranet, sitio público y pagos, OSE y conciliación, centro de reglas completo, widget/CMS, mensajes al pasajero, monedas, aprobaciones e inbox, cupos, documentos de viaje, tesorería | 127 | E2E-04, 06, 07 y 10 en verde; venta en línea |
| 3 · SaaS y crecimiento | Suscripciones, planes × reglas, facturación de plataforma, API keys y webhooks, marketing y metas, reseñas propias y externas, reportes avanzados | 57 | Nuevas agencias dadas de alta y facturadas desde la consola de plataforma |
| **Total** | | **378** | |

El kit no incluye equipo, plazos ni estimaciones de tiempo: la planificación la definen la empresa y el proyectista. El orden lo dan las fases, las dependencias y la prioridad de cada historia.

## 6. Reglas que el asistente no debe romper

Resumen de lo que ya dicen los `CLAUDE.md`; conviene tenerlo presente al revisar su trabajo:

- **Tenant** siempre desde la autenticación, nunca desde el request; RLS como segunda barrera; `kipucontrol_app` sin BYPASSRLS.
- **Permisos** del contrato en cada endpoint; Ventas solo ve su cartera; usuarios externos solo sus recursos vinculados.
- **Costos y márgenes** omitidos en las respuestas según permiso.
- **Dinero** con moneda y tipo de cambio conservado; nunca `float`.
- **Precio, disponibilidad y reglas** solo en `BookingEngine` del backend; frontend y apps presentan.
- **Reglas activables**: cada regla del centro de reglas se puede encender o apagar por tenant (y por producto) y depende del plan; apagada = sin efecto.
- **Idempotencia** en conversión, pagos, vouchers, comprobantes y checkout; **concurrencia** con `lock_version` y bloqueos al consumir cupos.
- **Integraciones** detrás de interfaz con adaptador `Fake`; sin credenciales reales en el código.
- **Nada del prototipo** marcado como hallazgo (H-01…H-21) se copia.

## 7. Decisiones abiertas

El kit toma supuestos donde las especificaciones dejan algo abierto; están marcados en `database/README.md` §7–8, `ejemplos/README.md` §5, `referencia/MAQUINAS-DE-ESTADO.md` (transiciones por definir), `api/ENDPOINTS.md` (conflictos y rutas ambiguas), la sección «Supuestos y decisiones» de cada `backlog/fase-*.md` y `docs/04-HALLAZGOS-Y-DECISIONES.md`. Entre las que conviene cerrar antes de la fase indicada:

| Antes de | Decisión |
|---|---|
| Fase 0 | Cifrado de documentos de identidad de pasajeros: la columna es `varchar(30)` y un valor cifrado no cabe (ampliar a `text` o cifrar a nivel de disco). |
| Fase 0 | Reinicio anual de correlativos: `sys_sequences.year_reset` choca con el trigger que impide que el número baje. |
| Fase 0 | Uso de los códigos HTTP 412, 423 y 428 (hoy no los usa ninguna especificación). |
| Fase 1B | Unificar `catalog_availability_holds` y `booking_inventory_holds` en una sola fuente de cupos. |
| Fase 1B | Estados sin origen documentado: `cancelada` en asignaciones operativas (no está en el CHECK de `ops_assignments`), `anulado` en `fin_invoices`, `parcial` e `incidencia` en `booking_reservations`. |
| Fase 2 | Proveedor OSE/PSE, pasarela de pago, proveedor de WhatsApp y fuente de tipo de cambio (hoy: adaptadores `Fake` y tasas demo). |
| Fase 2 | GPS en la app del operador (D-10): finalidad y consentimiento. |
| Fase 2 | Relación entre `fin_bank_accounts` y `fin_treasury_accounts`. |
| Fase 3 | Planes comerciales y reglas incluidas en cada uno (hoy: planes y reglas de prueba, editables). El catálogo tiene 32 reglas activables (31 en las especificaciones + `R-OWN-REVIEWS` de la v2.2). |
| Fase 3 | Cuentas y acuerdos con TripAdvisor, Trustpilot y Google para reseñas externas. |

## 8. Mantener el kit al día

- Material de referencia: `bash docs/kit/referencia/tools/regenerar.sh` (Postman, reglas, errores, eventos, permisos, glosario, diccionario, ER y máquinas de estado) y `bash docs/kit/ejemplos/tools/verificar_todo.sh` (regenera y verifica el código de ejemplo).

- Cambio de tabla: editar `database/*.sql` → `make db-validate` → migración.
- Cambio de endpoint: editar la §6 de la especificación → `python3 docs/kit/api/build_openapi.py` → implementar. Las specs se buscan en `docs/especificaciones/` (o en la ruta de la variable `KIPUCONTROL_SPECS_DIR`).
- Cambio de historia: `.md` y `.csv` de la fase y `backlog-completo.csv` en el mismo commit.
- Cambio de valores del motor: `node docs/kit/tests/tools/recalcular-esperados.cjs docs/prototipo/index.html` regenera los esperados desde el prototipo.
- Todo cambio con entrada en `docs/CHANGELOG.md`.
