# CLAUDE.md — web (Next.js · App Router · TypeScript)

Frontend del SaaS **Qhapaq Travel Suite**: back-office por rol, portales externos, consola de plataforma y sitio web público. El frontend presenta y captura; **nunca** es autoridad de precio, disponibilidad ni permisos (lo decide la API).

## Fuentes de verdad
1. `docs/kit/api/openapi.yaml` → cliente tipado generado (`npm run api:gen`, openapi-typescript + openapi-fetch). No escribir tipos de la API a mano.
2. Prototipo `docs/prototipo/index.html` + `docs/prototipo/assets/js/modules/*.js` → referencia de pantallas, flujos, textos y estados (abrir en el navegador y usar «Cambiar de rol»).
3. `docs/especificaciones/NN-*.md` §2 (pantallas y roles) y §7 (comportamiento por rol).
4. `docs/kit/design/` → tokens, preset de Tailwind, CSS global y `COMPONENTES.md`.
5. `docs/kit/tests/e2e/SELECTORES.md` → `data-testid` obligatorios por pantalla.

## Comandos
`npm run dev` · `npm run build` · `npm run lint` (ESLint + tsc --noEmit) · `npm run test` (Vitest) · `npm run e2e` (Playwright, `docs/kit/tests/e2e`) · `npm run api:gen`.

## Rutas por experiencia (App Router)
Cada experiencia es un árbol con segmento propio (evita colisiones de URL entre grupos):
- `app/(auth)/login`
- `app/(backoffice)/…` → `/dashboard`, `/crm/...`, `/catalogo/...`, `/cotizaciones/[code]`, `/reservas/[code]`, `/operaciones/...`, `/finanzas/...`, `/canales/...`, `/marketing/...`, `/aprobaciones`, `/inbox`, `/reportes`, `/admin/...` (layout con menú lateral).
- `app/plataforma/…` → consola del Super Admin (tenants, facturación de plataforma, jobs, auditoría).
- `app/portal-cliente/…` → portal del cliente · `app/portal-pasajero/…` → portal del pasajero · `app/b2b/…` → portal B2B · `app/proveedor/…` → extranet de proveedores · `app/app-operador/…` (vista web opcional). Son las rutas que usan las pruebas (`docs/kit/tests/e2e/support/routes.ts`); el cliente se resuelve desde la sesión, nunca desde la URL.
- `app/(sitio)/[locale]/…` → sitio público SSR/ISR sin sesión; `app/widget/[product]` → widget embebible.
Ruta = la del prototipo sin `#/` (ej. `#/crm/leads/LEAD-0231` → `/crm/leads/LEAD-0231`).
`middleware.ts` redirige según la experiencia del token (tabla ROLE_UX de la spec 00) y muestra 403 para rutas ajenas; es UX, la API vuelve a validar.

## Reglas de implementación
- Datos: TanStack Query (claves por recurso y tenant); mutaciones con `Idempotency-Key` (uuid v4 por intento de usuario) e `If-Match` donde el contrato lo pide; manejo de 409 (conflicto) y 422 (mostrar `code` de regla y mensaje).
- Formularios: React Hook Form + Zod (esquemas derivados del contrato); mensajes en español.
- Tablas: TanStack Table con búsqueda, filtros, orden, paginación por cursor y exportación (job, requiere `reports.export`).
- UI: Tailwind con el preset de `docs/kit/design/tailwind.preset.ts` + componentes Radix/shadcn. Paleta azul marino `#0A3A73` + dorado `#F4B400`, Plus Jakarta Sans, modo claro/oscuro. Diseño sobrio y profesional (sin degradados ni emojis salvo los del sidebar/portal definidos en el diseño).
- Botones de acciones sin permiso: ocultos o deshabilitados con tooltip «Requiere permiso x.y». Montos sensibles no se piden si el rol no los ve.
- Reglas del centro de reglas: una sección cuya regla está apagada (flag que devuelve la API) no se renderiza.
- Accesibilidad: foco visible, labels, contraste AA; responsive desde 360 px sin scroll horizontal.
- Móvil: seguir la tabla «Responsive y móvil» de `docs/kit/design/COMPONENTES.md` (topbar compacta, tablas como tarjetas, acciones secundarias en hoja inferior, modales como hoja, objetivos táctiles ≥ 40 px, inputs 16 px). Ejemplos en `docs/kit/ejemplos/web/`.
- i18n (ES/EN) y multimoneda obligatorios en sitio público, widget y portales externos.
- Tiempo real: Laravel Echo + Reverb (notificaciones, aprobaciones, inbox, operaciones).

## Cómo trabajar una historia
Leer la historia del backlog → revisar la pantalla equivalente en el prototipo → escribir/actualizar la prueba Playwright con los `data-testid` → implementar → `npm run lint test e2e` en verde → capturas a 1440 y 400 px.
