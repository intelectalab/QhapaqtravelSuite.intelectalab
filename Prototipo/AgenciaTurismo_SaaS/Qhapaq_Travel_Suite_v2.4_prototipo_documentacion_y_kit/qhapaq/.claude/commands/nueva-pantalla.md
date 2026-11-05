---
description: Construye una pantalla de Next.js a partir del prototipo y el contrato
argument-hint: <ruta del prototipo, ej. #/reservas/RES-2026-0001>
---
Construye la pantalla del prototipo `$ARGUMENTS` en `web/`.

1. Abre el módulo correspondiente en `docs/prototipo/assets/js/modules/` y ubica la función que la renderiza: estructura, textos, estados vacíos, acciones y qué ve cada rol.
2. Lee §2 (pantallas) y §7 (permisos por rol) de la especificación del módulo.
3. Ruta en App Router = ruta del prototipo sin `#/`, dentro del árbol de su experiencia (ver `web/CLAUDE.md`).
4. Datos solo con el cliente tipado generado del OpenAPI y TanStack Query. Nada de cálculos de precio, disponibilidad o permisos en el cliente.
5. Componentes de `docs/kit/design/COMPONENTES.md` y tokens del preset de Tailwind. Añade los `data-testid` de `docs/kit/tests/e2e/SELECTORES.md`.
6. Estados obligatorios: cargando (skeleton), vacío, error, sin permiso (acciones ocultas o deshabilitadas con tooltip) y 409/422.
7. Prueba Playwright del flujo principal; `npm run lint test e2e` en verde; revisa a 1440 px y 400 px sin scroll horizontal.
