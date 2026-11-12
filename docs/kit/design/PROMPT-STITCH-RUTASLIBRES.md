# Prompt de diseño para Stitch: Rutas Libres Perú (rutaslibres.pe)

> **Histórico (v2.11).** El equipo rediseñó Rutas Libres en Stitch con el sistema **«Luminous Nomad»** (cobalto, coral y esmeralda, sin motivos folclóricos). La referencia vigente es [`rutaslibres/DESIGN.md`](rutaslibres/DESIGN.md) con sus tokens (`rutaslibres/tokens.json`, `rutaslibres/tailwind.preset.ts`). Este prompt queda como registro de la primera versión.


Uso: copie el bloque **Prompt principal** en [Stitch](https://stitch.withgoogle.com/) (modo web, «Experimental» si quiere más detalle). Stitch entiende mejor las instrucciones en inglés, así que el prompt está en inglés y **todos los textos de la página están en español**. Después use los **prompts de pantallas** uno por uno, en el mismo proyecto, para que mantenga el estilo. Al final hay una versión corta en español y una lista de verificación.

Nombre y dominio son provisionales (spec 22 §12). Si cambian, reemplace «Rutas Libres Perú» y `rutaslibres.pe` en todo el texto.

---

## Prompt principal (página de inicio, escritorio 1440 px)

```
Design a professional, high-conversion marketing website homepage for "Rutas Libres Perú" (rutaslibres.pe), a free walking tour marketplace where travelers book free tours (pay-what-you-want tips) from verified local agencies in Lima, Cusco, Arequipa and Puno. All copy must be in Spanish (Peru). Desktop 1440px, responsive-ready.

VISUAL IDENTITY — contemporary Peruvian, not folkloric cliché:
- Palette: cochineal crimson #C8102E (primary, CTAs), deep granate #7E1526 and #3E0A13 (hero, footer), Inti gold #E3A33B (accents, ratings, highlights), Andean green #2F6B4F (trust, "verificada" badges), Titicaca blue #1F5F8B (Puno, links on light), adobe cream #FBF6EF (page background), sand #F4E6D4 (soft panels), ink #2A1A14 (text). White cards.
- Shapes inspired by Andean textiles and Inca architecture: a stepped Chakana (Andean cross) as the logo mark in crimson with a gold center; thin horizontal "tocapu" textile bands (repeating zigzag triangles in crimson, gold, green and cream) used as section dividers under the hero and above the footer; cards with asymmetric stepped corners (small radius top-left/bottom-right, large radius top-right/bottom-left, like terraced andenes); subtle layered mountain silhouettes (Andes) at the bottom of the hero; a minimal line-art Inti sun (concentric circles with rays) in gold at 40% opacity in the hero top-right.
- Typography: a confident geometric sans for headings (e.g. Plus Jakarta Sans ExtraBold, tight letter-spacing), clean humanist sans for body (16px, 1.6 line-height). Small uppercase kickers with wide tracking in gold.
- Photography: warm, authentic, golden-hour images of real places (Plaza de Armas Lima, Barranco murals, San Blas Cusco, Arequipa sillar streets, Lake Titicaca reed boats) with small groups and a guide holding a red flag. No stock-smile clichés.
- Feel: premium travel magazine meets modern marketplace. Generous whitespace, strong hierarchy, accessible contrast (WCAG AA), no gradients on text.

PAGE SECTIONS (top to bottom):
1. Sticky header on white: Chakana logo + "Rutas Libres Perú" with tiny uppercase tagline "FREE TOURS DEL PERÚ"; nav: Inicio, Lima, Cusco, Arequipa, Puno, Blog; language switch ES/EN/PT; pill CTA in crimson "Publica tu tour gratis".
2. Hero (deep granate-to-crimson diagonal gradient, Andes silhouettes, gold Inti sun): kicker "LIMA · CUSCO · AREQUIPA · PUNO"; H1 "Free tours por el Perú, con guías locales"; subtitle "Reserve gratis con su nombre y correo. Pague al final lo que le pareció justo. Agencias verificadas y reseñas reales."; a white rounded search bar with 3 selects (Ciudad, Tema, Idioma) and a crimson "Buscar" button; below, 3 trust chips in cream text: "Reserva sin pago", "Guías verificados", "Cancelación gratis". Textile zigzag band right under the hero.
3. "Elija su ciudad": 4 large city cards with photo + color overlay (Lima crimson, Cusco granate-gold, Arequipa terracotta-sand, Puno Titicaca blue), mountain silhouette at the bottom of each card, city name, "5 tours · Centro Histórico, Miraflores, Barranco".
4. "Los más reservados": grid of 4 tour cards: photo with small textile strip at the bottom edge, badge "FREE TOUR" (white pill, crimson text) or "DESDE S/ 45" (ink pill), title, duration, theme, language flags ES/EN/PT, gold star rating with review count, "por Lima a Pie · verificada" with green check.
5. "Cómo funciona" in 3 steps with stepped-number icons: Elige tu tour → Reserva gratis → Paga al final lo que valga.
6. Band for agencies (sand background, gold left border, stepped corners): "¿Tiene una agencia o es guía?" + "Publique sus free tours sin costo y reciba reservas hoy. Cuando quiera vender más, KipuControl le da su propio sitio web con SEO, cobros con tarjeta o PayPal y paquetes con hotel por ciudad." + buttons "Publicar gratis" (crimson) and "Ver beneficios" (outline). On the right, 4 small benefit tiles: Vitrina gratis, Su propio sitio web, Venda más en cada viaje, Cobre como quiera.
7. "Lo que dicen los viajeros": 3 testimonial cards with avatar, country flag, stars, short quote, tour name.
8. "Del blog": 3 article cards (city · date, title, excerpt), e.g. "Free tours en Lima: guía 2026 por barrio", "Qué comer en Lima en un día (sin gastar de más)", "Cusco en 3 días a pie: free tours y miradores".
9. Newsletter strip: "Reciba rutas nuevas cada mes" with email field.
10. Footer on deep granate #2A0A10 with textile band on top: logo, short description, columns (Ciudades, Para agencias, Ayuda, Legal: Términos, Privacidad, Libro de Reclamaciones), social icons, "Un servicio de KipuControl".

Make it look like a real, polished, award-worthy product. Include hover states for cards and buttons.
```

## Prompts de pantallas (en el mismo proyecto)

**Ciudad**
```
Using the same design system, create the city listing page "Free tours en Cusco". Breadcrumb Inicio / Cusco. Compact hero with Cusco photo (San Blas rooftops) and granate overlay, H1, short intro, chips of zones (Centro Histórico, San Blas, Valle Sagrado). Sticky filter bar: Zona, Tema, Idioma, Tipo (Free tour / De pago), Ordenar por (Mejor valorados). Results grid of tour cards (same card style) with a map toggle on the right showing meeting points as crimson Chakana pins. Bottom: SEO text block "Guía para hacer free tours en Cusco" and FAQ accordion. All copy in Spanish.
```

**Ficha del tour con reserva gratis**
```
Same design system. Tour detail page "Free tour Cusco: Centro Histórico y San Blas". Left column: photo gallery (1 large + 4 small with stepped corners), title, rating, duration 2.5 h, languages, "Lo que verá" checklist with gold Chakana bullets, meeting point card with small map, "Organiza" agency card with green "verificada" badge, reviews list. Right sticky booking card (white, stepped corners, crimson top border): title "Reservar gratis", date chips for next 7 days, time chips (10:00, 15:00), people selector, language select, Nombre, Correo, optional marketing checkbox, big crimson button "Reservar gratis", note "Sin pago por adelantado. Cancele desde el correo." Mobile: booking card becomes a bottom sheet with a sticky "Reservar gratis" bar.
```

**Para agencias**
```
Same design system. Landing page "Para agencias": hero "Su agencia, vista por miles de viajeros" with stats (visitas al mes, reservas, agencias publicando, ciudades). Benefits grid with icons. Pricing section with 4 plan cards: Vitrina gratis (S/ 0), Pase Básico 30 días (S/ 149 pago único, highlighted with gold ribbon "Recomendado"), Starter, Professional; each with feature checklist and CTA. Add-ons table (Cobros con PayPal, Armador de viajes por tramos, SEO y blog de aventuras, Destacado en la vitrina, Dominio propio, Contenido con IA, Imágenes con IA, Plantilla premium) with columns Pago único / Mensual. "Elija el diseño de su sitio": carousel of 6 website template thumbnails (Andes Clásico, Inti Raymi, Amazonía, Pacífico, Chakana Free Tours, Nazca Noche - premium). Registration form: Nombre comercial, Ciudad, Correo, WhatsApp, RUC, Diseño de su sitio, Quiero (Publicar gratis / Probar 30 días), crimson submit.
```

**Blog**
```
Same design system. Blog article page "Free tours en Lima: guía 2026 por barrio": reading width 720px, kicker city · date · reading time, H1, hero image, table of contents, body with H2s, pull quote in gold, inline "Tours recomendados" cards (3), author box, related articles, and an agency CTA band at the end.
```

**Móvil**
```
Generate the mobile (390px) versions of the homepage and the tour detail page with the same design system: hamburger menu with Chakana logo, stacked search fields, horizontally scrollable city cards, single-column tour cards, sticky bottom booking bar.
```

## Versión corta en español (si prefiere escribir en español)

```
Diseña la página de inicio de «Rutas Libres Perú» (rutaslibres.pe), un sitio donde viajeros reservan free tours gratis de agencias verificadas en Lima, Cusco, Arequipa y Puno. Estilo peruano contemporáneo y profesional: rojo cochinilla #C8102E, granate #7E1526, dorado Inti #E3A33B, verde andino #2F6B4F, azul Titicaca #1F5F8B y fondo crema #FBF6EF. Logo con chakana escalonada; bandas textiles en zigzag como separadores; tarjetas con esquinas escalonadas como andenes; siluetas de los Andes y un sol Inti de líneas en el hero. Secciones: cabecera con botón «Publica tu tour gratis», hero con buscador (ciudad, tema, idioma), ciudades, tours más reservados con insignia FREE TOUR y estrellas, cómo funciona en 3 pasos, banda para agencias con beneficios, testimonios, blog, boletín y pie granate con Libro de Reclamaciones. Textos en español, contraste accesible, fotos reales a la hora dorada.
```

## Lista de verificación al recibir el diseño

- Contraste de botones y textos ≥ 4,5:1 (rojo #C8102E sobre blanco cumple; dorado #E3A33B **no** sirve para texto sobre blanco, solo para acentos).
- El hero carga rápido: una imagen optimizada (AVIF/WebP) o solo degradado + SVG; nada de video automático en móvil.
- Los patrones textiles son SVG livianos, no imágenes grandes.
- Objetivos táctiles ≥ 40 px y sin scroll horizontal a 360 px.
- Libro de Reclamaciones, privacidad (Ley 29733) y términos visibles en el pie.
- Exportar a Figma o HTML y pasarlo al equipo como plantilla siguiendo el contrato técnico de la spec 23 §13 (tokens en `template.json`).

El prototipo ya aplica esta línea gráfica en `#/vitrina` (`prototipo/assets/js/modules/vitrina.js`), útil como referencia de colores y formas.
