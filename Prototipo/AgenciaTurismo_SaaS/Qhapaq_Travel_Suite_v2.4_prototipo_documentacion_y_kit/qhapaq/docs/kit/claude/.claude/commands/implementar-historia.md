---
description: Implementa una historia del backlog de punta a punta (pruebas primero)
argument-hint: <ID de historia, ej. F1B-RES-02>
---
Implementa la historia **$ARGUMENTS** del backlog de Qhapaq Travel Suite.

1. Busca la historia en `docs/kit/backlog/` (grep por el ID) y léela completa: especificación, tablas, endpoints, pantallas, criterios, pruebas y «Depende de».
2. Si alguna dependencia no está implementada (revisa el código y `docs/CHANGELOG.md`), detente y dime cuál falta. No la implementes por tu cuenta.
3. Lee las secciones de especificación citadas en `docs/especificaciones/` y los hallazgos relacionados en `docs/04-HALLAZGOS-Y-DECISIONES.md`.
4. Muéstrame un plan corto (archivos a crear o cambiar, migraciones, endpoints, pantallas) y espera mi confirmación.
5. Escribe primero las pruebas: Pest en backend (criterios → casos, incluye 403 por rol y aislamiento de tenant) y Playwright en web si hay pantalla (usa los `data-testid` de `docs/kit/tests/e2e/SELECTORES.md`).
6. Implementa siguiendo el `CLAUDE.md` del repositorio: tablas copiadas de `docs/kit/database/`, rutas y permisos según `docs/kit/api/openapi.yaml`.
7. Ejecuta `make test lint openapi-check` (backend) y `npm run lint test` (web). No termines con pruebas en rojo.
8. Si algo difiere de la especificación, actualiza su sección 11 y `docs/CHANGELOG.md`.
9. Resume en español: archivos cambiados, pruebas agregadas, supuestos tomados y el mensaje de commit con formato `<ID>: <descripción>`.
