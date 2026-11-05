# CLAUDE.md — Qhapaq Travel Suite (raíz del espacio de trabajo)

SaaS multi-tenant de gestión integral para agencias de viajes y tour operadores (Perú). Desarrollo interno asistido por IA.

Repositorios: `backend/` (Laravel 12 · PHP 8.4 · PostgreSQL 17 · Redis 8), `web/` (Next.js), `mobile/` (React Native · Expo), `docs/` (documentación y kit). Cada repositorio tiene su propio `CLAUDE.md` con comandos y reglas; léelo antes de tocar código allí.

@docs/kit/00-LEEME-KIT.md
@docs/CONVENCIONES.md

Consulta según la tarea (no se cargan automáticamente): `docs/kit/GUIA-TECNICA.md` (cómo encaja todo), `docs/kit/ejemplos/` (código de referencia verificado), `docs/kit/database/referencia/` (diccionario de datos y diagramas ER), `docs/kit/referencia/` (máquinas de estado, reglas de negocio, códigos de error, eventos y jobs, permisos, glosario) y `docs/kit/api/postman/` (colección para probar la API).

## Orden de trabajo
Fases 0 → 1A → 1B → 2 → 3 del backlog (`docs/kit/backlog/`). Una historia por sesión, respetando «Depende de». Una historia está terminada cuando: pruebas en verde, contrato OpenAPI respetado, especificación y `docs/CHANGELOG.md` actualizados si hubo cambios.

## Prohibido
- Copiar comportamientos marcados en `docs/04-HALLAZGOS-Y-DECISIONES.md` (H-01…H-21).
- Cálculos de precio, disponibilidad o permisos en el frontend o la app.
- Tablas o endpoints que no estén en `docs/kit/database/` y `docs/kit/api/` sin actualizar primero esos archivos.
- Credenciales reales en el repositorio; integraciones sin adaptador `Fake`.
- Borrar físicamente registros con historia (usar estados, `deleted_at` y versiones).
