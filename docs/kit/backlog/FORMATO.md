# Formato de las historias

Cada archivo `fase-N.md` tiene: **Resumen** (épicas e historias), **Cómo usar este backlog con Claude Code**, **Supuestos y decisiones** que afectan la fase, **Fuera de alcance** y **Historias**, agrupadas por épica (`### E1B.2 · Reservas`).

## Historia (Markdown)

```markdown
#### F1B-RES-02 · Conversión idempotente cotización → reserva (ejemplo abreviado)

**Historia:** Como vendedor, quiero convertir una cotización aceptada en reserva, para no volver a digitar servicios ni pasajeros.

**Especificación:** 04 §5 RES-BR-01…04, 03 §4

**Tablas:** booking_reservations, booking_reservation_services, booking_passengers

**Endpoints:** POST /api/v1/quotes/{quote}/convert

**Pantallas:** /cotizaciones/[code], /reservas/[code]

**Criterios de aceptación:**

1. …
2. …

**Pruebas:** Pest: … · Playwright: e2e-02-conversion.spec.ts

**Depende de:** F1A-QTE-09 · **Prioridad:** P0
```

## Campos

| Campo | Contenido | Regla |
|---|---|---|
| ID | `F{fase}-{MÓDULO}-{nn}`; fases `0`, `1A`, `1B`, `2`, `3` | Único y estable. Va en la rama y en el commit. |
| Título | Verbo + objeto | Una sola capacidad entregable. |
| Historia | «Como `<rol>`, quiero `<capacidad>`, para `<beneficio>`» | Rol tal como en la matriz de roles (spec 00 / 09). |
| Especificación | `NN §x.y` y/o IDs de reglas (`PRD-BR-005`, `QTE-BR-12`, `SIT-BR-18`) | Lo primero que lee Claude antes de programar. |
| Tablas | Nombres exactos de `../database/*.sql` | `—` si no toca la base. |
| Endpoints | `MÉTODO /api/v1/...` exactos de `../api/openapi.yaml` | `—` si no hay API. |
| Pantallas | Ruta de Next.js (`/reservas/[code]`) o de la app (`App operador › Hoy`) | Equivalente en el prototipo = misma ruta con `#/`. |
| Criterios de aceptación | Lista numerada, verificable | Cada criterio → al menos un caso de prueba. |
| Pruebas | Pest, Playwright, o ambos; referencia a archivos de `../tests/` cuando existen | Incluye siempre el caso negativo por permiso o tenant cuando aplica. |
| Depende de | IDs de historias previas | No empezar sin ellas terminadas. |
| Prioridad | P0 / P1 / P2 | Ver `README.md`. |

## CSV

`fase-*.csv` y `backlog-completo.csv` tienen las mismas historias con estas columnas:

`id, fase, epica_id, epica, titulo, historia, especificacion, tablas, endpoints, pantallas, criterios_aceptacion, pruebas, dependencias, prioridad`

Criterios en una sola celda (`1) … | 2) …`); listas de tablas, endpoints y dependencias separadas por `, `; `—` cuando no aplica.

## Definición de terminado (todas las historias)

1. Pruebas escritas antes del código y en verde (Pest contra PostgreSQL y Redis reales; Playwright si hay pantalla).
2. Tablas y endpoints idénticos a `../database/` y `../api/openapi.yaml` (`make openapi-check`).
3. Permiso del contrato aplicado y probado con un rol sin permiso (403) y con otro tenant (404).
4. `data-testid` de `../tests/e2e/SELECTORES.md` presentes en la pantalla.
5. Pantalla revisada a 1440 px y 400 px, modo claro y oscuro.
6. Diferencias con la especificación registradas en su §11 y en `docs/CHANGELOG.md`.
7. Commit con el ID de la historia.

## Agregar o cambiar historias

- Nuevas historias: siguiente número libre del módulo en esa fase; nunca reutilizar un ID.
- Si una historia cambia tablas o endpoints, primero se actualizan `../database/*.sql` y la §6 de la especificación (y se regenera `../api/openapi.yaml`), luego la historia.
- Mantener sincronizados el `.md` y el `.csv` de la fase y `backlog-completo.csv`.
