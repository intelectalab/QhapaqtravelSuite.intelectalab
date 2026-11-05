# Sistema de diseño — Qhapaq Travel Suite

Identidad sobria de software empresarial: sidebar azul marino, área de trabajo clara, dorado solo para acentos (acción comercial destacada, avatar del tenant, estrellas de reseñas). Nada de degradados decorativos, sombras pesadas, ilustraciones genéricas ni emojis en el back-office.

## Archivos

| Archivo | Uso |
|---|---|
| `tokens.json` | Fuente única: colores claro/oscuro, tipografía, radios, sombras, tamaños, breakpoints y **tono por estado** (102 estados). |
| `globals.css` | `app/globals.css` de Next.js con Tailwind v3: variables CSS claro/oscuro y estilos base. |
| `tailwind.preset.ts` | Preset de Tailwind v3 (`presets: [qhapaqPreset]`) + `statusTone` / `toneFor()` para badges. |
| `theme.v4.css` | Alternativa si el proyecto usa Tailwind v4 (`@theme inline`). Usar este **o** el preset, no ambos. |
| `theme.native.ts` | Tema para la app Expo (mismos valores). |

Clases resultantes: `bg-surface`, `bg-surface-2`, `text-fg`, `text-fg-2`, `text-fg-3`, `border-line`, `bg-accent text-accent-fg`, `bg-sun text-sun-fg`, `bg-ok-soft text-ok`, `rounded-card`, `rounded-control`, `shadow-card`, `h-control`.

Modo oscuro: clase `dark` o `data-theme="dark"` en `<html>`; preferencia del usuario guardada en su perfil (no solo en el navegador).

## Correspondencia prototipo → componente

La columna «Uso» indica cuántas veces aparece en el prototipo: da una idea de qué construir primero.

| Prototipo (`core.js`) | Uso | Componente web (shadcn/Radix) | Notas obligatorias |
|---|---|---|---|
| `UI.toast` | 1 099 | `Toaster` (sonner) | Éxito 4 s, error persistente con acción «Ver detalle». Nunca el único aviso de un error de validación. |
| `UI.card` | 581 | `Card` (`CardHeader` título + subtítulo + acciones, `CardContent`, `CardFooter`) | Radio 16 px, borde `line`, sin sombra salvo en hover de tarjetas clicables. |
| `UI.alert` | 452 | `Alert` con tonos `info/ok/warn/bad` | Icono + texto; acción opcional a la derecha. |
| `UI.badge` / `statusLabel` | 440 | `StatusBadge status="pendiente_pago"` | Color con `toneFor(status)`; etiqueta desde el API (`status_label`) o `tokens.json → status.labels`. Punto de color + texto (no depender solo del color). |
| `UI.kpi` | 289 | `KpiCard` | Etiqueta, valor tabular, variación ▲/▼ con color y texto. Si el rol no ve montos, el KPI no se renderiza (no se muestra «***»). |
| `UI.empty` | 202 | `EmptyState` | Icono, frase de qué falta y acción primaria si el rol puede crear. |
| `UI.modal` / `UI.confirm` | 310 | `Dialog` / `AlertDialog` | Confirmación destructiva con verbo explícito («Anular comprobante»), foco en «Cancelar». Motivo obligatorio cuando la spec lo pide. |
| `UI.form` / `field` / `validate` | 524 | `Form` (React Hook Form + Zod) + `FormField` | Label arriba, obligatorio con `*` rojo, error bajo el campo; errores 422 del API mapeados al campo por `field`. |
| `UI.dl` | 128 | `DescriptionList` | Dos columnas en ≥ 768 px, una en móvil. |
| `UI.pageHeader` | 104 | `PageHeader` | Migas, título, subtítulo, acciones (máx. 1 primaria + menú «Más»). |
| `UI.chart` | 80 | `Chart` (Recharts) | Barras, líneas, dona. Colores: accent, sun, info, ok, violet, warn. Tabla accesible alternativa. |
| `UI.dataTable` | 79 | `DataTable` (TanStack Table) | Búsqueda, filtros, orden, paginación por cursor, selección, columnas ocultables, exportar (job). Montos a la derecha y tabulares. En móvil pasa a lista de tarjetas. |
| `UI.flow` | 57 | `StatusFlow` | Pasos de la máquina de estados; el actual resaltado, los futuros atenuados. |
| `UI.progress` | 51 | `Progress` | Con texto del porcentaje. |
| `UI.drawer` | 44 | `Sheet` (lado derecho, 480–640 px) | Detalle rápido sin salir del listado. |
| `UI.timeline` | 37 | `Timeline` | Historial y auditoría: actor, acción, fecha relativa + absoluta en tooltip. |
| `UI.tabs` | 30 | `Tabs` | Pestaña activa en la URL (`?tab=`). Pestañas sin permiso no se muestran. |
| `UI.userChip` / `avatar` | 47 | `Avatar` | Iniciales sobre `accent`; foto si existe. |
| `UI.menu` | 12 | `DropdownMenu` | Acciones secundarias de fila o de página. |
| `UI.copy` | 11 | `CopyButton` | Para códigos (RES-…, enlaces de pago, API keys). |
| Sidebar + topbar | — | `AppShell` | Sidebar 256 px (colapsable a 68 px) con grupos plegables y buscador de menú; topbar 58 px con búsqueda global, creación rápida, notificaciones, tema y usuario. Menú generado desde permisos. |
| Pantalla 403 | — | `Forbidden` | Explica qué permiso falta y ofrece volver al inicio de su experiencia. |

## Reglas de interfaz

- **Botones:** alto 34 px (28 `sm`, 24 `xs`); variantes `primary` (accent), `sun` (solo la acción comercial principal: «Reservar», «Pagar»), `danger`, `ghost`, `default`. Una sola primaria por vista.
- **Acciones sin permiso:** ocultas; si su ausencia confunde, deshabilitadas con tooltip «Requiere permiso `x.y`».
- **Montos:** siempre con moneda (`S/ 1 250,00`, `US$ 420.00`) y alineados a la derecha; formato por locale del usuario; nunca calcular en el cliente.
- **Fechas:** fecha corta en tablas (`14 oct 2026`), fecha y hora con zona del tenant en detalle.
- **Estados de carga:** skeleton con la forma del contenido; nunca spinners de pantalla completa tras la primera carga.
- **Formularios largos** (producto, reserva, checkout): pasos o secciones con índice lateral y guardado de borrador.
- **Responsive:** 1440 px de referencia; sin scroll horizontal a 360–400 px (las tablas pasan a tarjetas o se desplazan dentro de su contenedor).
- **Accesibilidad:** contraste AA, foco visible, `aria-label` en botones de icono, navegación por teclado en tablas, modales y menús.
- **Sitio público y widget:** mismos tokens, más aire (base 16 px, radios 16 px, fotos grandes); el dorado se usa en CTA de reserva y valoraciones. El tenant puede sobrescribir `accent` y `sun` con sus colores de marca (validar contraste AA al guardar).
- **App del operador:** botones de 48 px mínimo, textos grandes, estado de sincronización siempre visible (pendientes en outbox).

## Responsive y móvil (v2.4, auditoría del 01/10/2026)

Reglas comprobadas en el prototipo con todos los roles a 360, 768 y 1280 px. Implementarlas igual en Next.js:

| Elemento | ≤ 640 px (teléfono) | 641–900 px (tablet) | Implementación de referencia |
|---|---|---|---|
| Topbar back-office | Menú, búsqueda como icono que se expande a todo el ancho, «+» (crear) solo icono, notificaciones y avatar. Tema y «Ver sitio público» pasan al menú del usuario. | Igual que escritorio con sidebar oculto (botón menú). | `core.js` `Shell.ensure` + CSS `.top-opt`, `.gsearch:focus-within` |
| Cabecera de página | Subtítulo largo recortado a 3 líneas con «Ver más». Si hay más de 2 acciones (o una destructiva), queda visible la primaria y el resto va a una **hoja inferior «Más acciones»**. | Acciones en línea. | `MobileHeader` en `core.js` |
| Tablas | Cada fila es una **tarjeta**: la primera celda es el título; el resto, pares etiqueta/valor (la etiqueta es el encabezado de la columna); la columna de acciones va al pie. Se aplica si la tabla no cabe o tiene ≥ 5 columnas. | Tarjetas en 2 columnas si la tabla no cabe. | `ResponsiveTables` (agrega `data-label` y la clase `.rt`). Excluir matrices con `.no-stack`. |
| Modales | Hoja inferior a todo el ancho (máx. 94 % del alto), pie con botones de igual ancho, respeta `safe-area-inset-bottom`. | Modal centrado. | CSS `.overlay`, `.modal` |
| Drawers | Ancho completo. | Hasta 560/820 px. | CSS `.drawer` |
| Pestañas y navegación de portales | Desplazables; la activa se centra al cargar; bordes difuminados cuando hay más opciones. | Igual. | `MobileHeader.scrollers`, `Shell.markActive` |
| Portales externos | Marca + usuario en una fila; navegación deslizable debajo. | Igual. | CSS `.ext-*` |
| App del operador (guía/conductor) | Pantalla completa sin marco de teléfono; barra inferior fija con `safe-area`. | Marco de teléfono centrado. | `operaciones.js` `.op-app` |
| Maestro-detalle (destinos, roles, plantillas) | Al elegir un registro la vista baja al detalle. | Igual (una columna). | `UI.reveal()` y atributo `data-mdetail` |
| Documentos (cotización, voucher, comprobante) | Tablas del documento con desplazamiento interno; tipografía 12–13 px. | Documento completo. | CSS `.doc` |
| Avisos (toasts) | Arriba, a todo el ancho, para no tapar la barra de reserva ni el pie. | Abajo a la derecha. | CSS `.toasts` |
| Formularios | Inputs a 16 px (evita el zoom de iOS); una columna. | Rejilla de 12 columnas. | CSS `.input`, `.form-grid` |
| Objetivos táctiles | Con puntero táctil: botones ≥ 40 px (sm 36, xs 32), pestañas y menú con más relleno. | Igual en tablets táctiles. | `@media (pointer:coarse)` |

En React: `useMediaQuery('(max-width:640px)')` para decidir hoja inferior/menú y `DataTable` con `variant="cards"` automático. Las pruebas Playwright corren en los proyectos `desktop` (1440) y `movil-400`; agregar uno a 360 px si se quiere el peor caso.

## `data-testid`

Cada componente acepta `data-testid`; los obligatorios por pantalla y la convención (`{pantalla}-{elemento}`, `table-row:{código}`, `field:{name}`, `action:{verbo}`, atributo `data-status` con el valor de dominio) están en `docs/kit/tests/e2e/SELECTORES.md`. Los componentes compartidos (`DataTable`, `Dialog`, `Toaster`, `StatusBadge`) los traen de fábrica.
