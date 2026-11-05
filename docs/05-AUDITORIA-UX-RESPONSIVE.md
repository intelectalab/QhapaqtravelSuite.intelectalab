# Auditoría de experiencia de usuario y diseño responsive (v2.4 · 01/10/2026)

Motivo: en teléfonos, varias vistas no se adaptaban según el rol. Se auditó el prototipo completo con **todos los perfiles** y se corrigieron las causas en los componentes compartidos. Lo hecho en el prototipo es la referencia para Next.js y la app: las reglas quedan en `kit/design/COMPONENTES.md` («Responsive y móvil») y en `kit/ejemplos/web/`.

## 1. Método

- Recorrido automático con Chromium (Playwright) de **14 perfiles**: Tenant Admin, Manager, Ventas, Operaciones, Finanzas, Contabilidad, Guía, Conductor, Agencia B2B, Cliente, Pasajero, Super Admin, Proveedor y visitante anónimo del sitio público.
- Anchos: **360 px** (teléfono pequeño, peor caso), **768 px** (tablet) y **1280/1440 px** (escritorio), con emulación táctil en teléfono.
- Por perfil se recorrieron el menú, los enlaces internos de cada pantalla (detalles, fichas), las pestañas y las acciones de cabecera que abren modales o paneles laterales.
- En cada vista se midió: desplazamiento horizontal de la página, elementos fuera de pantalla, tablas que obligan a desplazarse de lado, texto recortado, modales que no caben, objetivos táctiles menores de 30 px y tipografía menor de 11 px. Además se revisaron capturas de cada pantalla.
- Verificación final: barrido de roles (452 rutas a 1440 y 360 px, 0 errores de JavaScript, 0 accesos indebidos) y nueva medición completa.

## 2. Resultado

| Indicador (vistas a 360 px, 14 perfiles) | Antes | Después |
|---|--:|--:|
| Vistas con desplazamiento horizontal de la página | 432 de 737 | 0 |
| Tablas que obligaban a deslizar de lado | 363 | 8 (matrices de calendario y cupos, intencionales) |
| Modales o paneles más anchos que la pantalla | 12 | 0 |
| Objetivos táctiles menores de 30 px | 2 248 | Solo los días de calendarios mensuales (29 × 37 px, limitados por las 7 columnas) |
| Vistas a 768 px con desplazamiento horizontal | 0 | 0 |

## 3. Hallazgos y corrección

| # | Hallazgo | Afectaba a | Corrección |
|---|---|---|---|
| UX-01 | La barra superior del back-office medía más que la pantalla a 360 px (búsqueda, «Nuevo», sitio público, tema, notificaciones y usuario en una fila). Toda la página se desplazaba de lado y los paneles laterales quedaban cortados. | Todos los roles internos | Búsqueda como icono que se expande a todo el ancho; «+» solo icono; tema y «Ver sitio público» pasan al menú del usuario. |
| UX-02 | Tablas con muchas columnas obligaban a deslizar de lado; las columnas importantes quedaban fuera de vista. | Todos los roles | Las filas se muestran como **tarjetas** (título + pares etiqueta/valor, acciones al pie) cuando la tabla no cabe; en tablet, tarjetas en dos columnas. Matrices (permisos, calendarios, cupos) mantienen desplazamiento propio. |
| UX-03 | Cabeceras de página con 3–5 botones apilados a todo el ancho (incluidas acciones destructivas en rojo) empujaban el contenido fuera de la primera pantalla. | Todos los roles internos | Queda visible la acción principal; el resto (y las destructivas) van a una hoja inferior «Más acciones». |
| UX-04 | Subtítulos largos con referencias de proceso ocupaban media pantalla. | Todos | Recorte a 3 líneas con «Ver más». |
| UX-05 | Modales centrados con márgenes, pie con botones desiguales, contenido difícil de alcanzar. | Todos | En teléfono, modales como hoja inferior a todo el ancho con pie fijo y botones del mismo tamaño. Paneles laterales a todo el ancho. |
| UX-06 | Encabezado de portales (cliente, pasajero, B2B, proveedor, app) en tres filas; marca cortada; la pestaña activa podía quedar oculta. | Cliente, Pasajero, B2B, Proveedor, Guía, Conductor | Marca y usuario en una fila; navegación deslizable con la pestaña activa centrada y bordes difuminados. |
| UX-07 | App del operador con 4 px de desborde y pie del portal debajo de la barra inferior de la app. | Guía, Conductor | App a pantalla completa (altura dinámica del navegador), barra inferior con área segura, sin pie de portal. |
| UX-08 | Cabecera del sitio público más ancha que el teléfono (iconos cortados); botón «Cotizar a medida» recortado. | Visitante, Cliente | Logotipo con elipsis, lista de deseos en la cuenta, botones de la ficha que se acomodan en dos líneas. |
| UX-09 | Selector «Ver como cliente» de la vista de canal desbordaba. | Roles internos | Selector a todo el ancho en teléfono. |
| UX-10 | Documento de cotización: la tabla de precios desbordaba y forzaba deslizar toda la página. | Ventas, Manager, Admin | En teléfono las tablas del documento se desplazan dentro del documento; tipografía de documento ajustada. |
| UX-11 | Pantallas maestro-detalle (destinos, roles, plantillas): al elegir un elemento, el detalle cambiaba debajo de una lista larga sin que el usuario lo viera. | Admin, Catálogo | La vista baja al detalle automáticamente en pantallas angostas. |
| UX-12 | Avisos emergentes tapaban la barra de reserva del sitio y el pie de los formularios. | Todos | En teléfono, avisos arriba y a todo el ancho. |
| UX-13 | Pestañas de los detalles cortadas sin indicar que había más. | Todos | La activa se centra y los bordes se difuminan cuando hay más pestañas. |
| UX-14 | Controles táctiles pequeños (paginación, cantidades de pasajeros, botones `sm`/`xs`, selectores de idioma y moneda). | Todos | Con pantalla táctil: botones ≥ 40 px (sm 36, xs 32), cantidades de 40 px, pestañas y menú con más relleno. |
| UX-15 | Campos de formulario a 14 px: iOS hace zoom al enfocarlos. | Todos | Campos a 16 px en teléfono. |
| UX-16 | KPIs a 360 px con títulos de tres líneas e icono grande. | Todos | KPIs compactos con icono reducido. |

## 4. Pendientes menores (no bloquean)

- Calendarios de disponibilidad y matrices de cupos y permisos mantienen desplazamiento horizontal propio (es el patrón esperado para una grilla de fechas o roles); en Next.js conviene fijar la primera columna (`position: sticky`).
- Algunas etiquetas en mayúsculas (10–11 px) en el sitio público y en insignias son decorativas; mantener contraste AA si se reducen más.
- En el checkout del sitio, el resumen del pedido aparece después del formulario en teléfono; se recomienda un resumen plegable arriba en la implementación final.

## 5. Cómo verificarlo en desarrollo

- Proyectos Playwright `desktop` (1440) y `movil-400`; agregar uno a 360 px para el peor caso.
- Prueba de humo por pantalla: `document.documentElement.scrollWidth === clientWidth` a 360 px.
- Revisar cada historia de pantalla a 1440 y 360 px, en modo claro y oscuro (definición de terminado del backlog).
