# Prompt de Stitch: landing de KipuControl (kipucontrol.com)

> **Histórico (v2.12).** El equipo ya hizo la landing en Stitch con este prompt. La referencia vigente es [`kipucontrol/DESIGN.md`](kipucontrol/DESIGN.md), con sus tokens y preset de Tailwind, y la spec 25.

**Cómo usarlo:**
1. Abra [Stitch](https://stitch.withgoogle.com/) en modo web.
2. Pegue el **Prompt principal**.
3. En el mismo proyecto, pegue los **prompts de pantallas** uno por uno, para que Stitch mantenga el estilo.

El prompt está en inglés porque Stitch lo entiende mejor. Todos los textos de la página están en español de Perú.

**Cómo se reparten los dos sitios:**
- **kipucontrol.com** es la landing del SaaS. Vende los planes, cobra las suscripciones, muestra el blog con filtro de categorías y atiende con un chatbot.
- **rutaslibres.pe** es la puerta de entrada gratuita. Ahí la agencia publica sus free tours sin costo y, cuando quiere más, pasa a un plan de KipuControl.
- El blog es el mismo: los artículos se escriben una vez en Payload CMS y se filtran por sitio y categoría.

La estructura se inspira en sell-saas.com: hero con prueba social, productos en bloques alternados con maquetas de la interfaz, sección para partners, testimonios y doble cierre con chat. Se le suman lo que esa página no tiene: tabla de precios con interruptor mensual/anual, preguntas frecuentes, blog filtrable, popup y comentarios. No se copian textos, marca ni imágenes de sell-saas.

---

## Prompt principal (inicio, escritorio 1440 px)

```
Design a professional, high-conversion SaaS marketing homepage for "KipuControl" (kipucontrol.com), an all-in-one ERP + CRM for tour operators and travel agencies in Peru and Latin America: quotes, bookings, operations, payments, profitability, branded website with SEO and blog, AI content, and a free marketplace (Rutas Libres) where agencies publish free tours. All copy in Spanish (Peru), addressing the reader as "tú". Desktop 1440px, responsive-ready. Max content width 1280px.

VISUAL IDENTITY — trustworthy B2B software, sister brand of Rutas Libres:
- Palette: KipuControl navy #0A3A73 (primary, header logo, headings accents, dark sections), royal blue #11509A (hover, links), soft blue #EAF3FC (tinted panels), Kipu sun yellow #F4B400 (primary CTA buttons "Empieza gratis" / "Suscribirme", highlights, "Más popular" badge; dark text #2B1F00 on it), success green #22A55A (checkmarks, "verificado", uptime), ink #15202E (text), slate #4A5568 (body), lines #E4E8EF, page background #F7F9FC, white cards. Rutas Libres accents appear only inside its own mockups: cobalt #1D4ED8 and coral #F95738.
- Typography: Plus Jakarta Sans everywhere. H1 56–64px ExtraBold, tight tracking (-0.03em); H2 40px Bold; body 17px/1.6. Small uppercase kickers with wide tracking in royal blue.
- Shapes: cards 24px radius, pill buttons, 1px borders, soft shadows (0 12px 32px -4px rgba(15,32,46,.08)). Glassmorphism only for the sticky header and floating widgets.
- Imagery: mostly realistic product UI mockups (dashboard, booking calendar, quote PDF, mobile app, Google search result, chatbot window) on soft gradient backdrops; a few warm photos of Peruvian travel agency teams at work. No stock clichés, no folkloric motifs.
- Feel: Stripe/Linear-level polish, clear hierarchy, WCAG AA contrast, no gradients on text.

PAGE SECTIONS (top to bottom):
1. Top announcement bar (navy): "Nuevo: contenido con IA para tu web y tu blog →".
2. Sticky glass header: logo "KipuControl" (navy square mark with a stylized knot/kipu cord + wordmark); nav: Producto (mega-menu with 8 modules and icons), Soluciones (Tour operadores, Agencias de viaje, Guías y free tours), Precios, Blog, Recursos; language switch ES/EN/PT; "Iniciar sesión" text link; outlined "Hablar con ventas"; yellow pill CTA "Empieza gratis".
3. Hero (white with soft blue radial glow): kicker pill "ERP + CRM para turismo · hecho en Perú"; H1 "Vende, opera y cobra tus tours desde un solo lugar"; subtitle "Cotizaciones en minutos, reservas sin sobreventa, pagos con Yape, tarjeta o PayPal y tu propia web con SEO. Empieza gratis publicando en Rutas Libres."; 3 check bullets (Sin tarjeta para empezar · Tu marca y tu dominio · Listo en un día); CTAs: yellow "Empieza gratis" + white outlined "Ver demo de 2 min" with play icon; under them a row of 5 overlapping avatars + "4,9/5 · más de 300 agencias en Perú, Bolivia y Ecuador". Right side: large dashboard mockup (sales KPIs, bookings calendar, profitability chart) with two floating cards: "Reserva confirmada RES-2026-000361 · S/ 1 840" and "Cotización enviada por WhatsApp".
4. Logo strip: "Confían en KipuControl" + 8 grayscale agency logos; next to it compliance badges: "Datos en la nube con cifrado", "Facturación electrónica SUNAT", "Ley 29733 de datos personales", "99,9 % disponibilidad".
5. "Todo tu negocio en una plataforma": 8 module cards in a 4x2 grid with icon, name and one line: CRM y ventas, Cotizaciones, Reservas y cupos, Operaciones y guías, Finanzas y pagos, Rentabilidad, Web, SEO y blog, App móvil.
6. Alternating product blocks (5 blocks, mockup left/right alternating, each with kicker, H3, 4 check bullets, buttons "Probar gratis" + "Ver cómo funciona →"):
   a. "Cotiza en minutos, no en horas" — quote builder mockup with PDF preview and WhatsApp send.
   b. "Reservas sin sobreventa" — calendar with seat availability and passenger list.
   c. "Cobra como quieran tus clientes" — payment link card with Yape, tarjeta, PayPal and net-after-fees.
   d. "Tu web con SEO e IA" — Google search result showing the agency site at #1 with stars, next to an AI panel "Mejorar descripción · Generar título SEO · Traducir a EN/PT" and an SEO score ring 92/100.
   e. "Asistente IA de ventas 24/7" — chatbot window answering "¿Tienen tour a Machu Picchu el sábado?" with tour cards and "Reservar".
7. Rutas Libres band (light cobalt tint, uses Rutas Libres colors inside): "Empieza gratis en Rutas Libres" — "Publica tus free tours sin costo en rutaslibres.pe, recibe reservas y pásate a KipuControl cuando quieras vender más." Stats: S/ 0 para empezar · 30 reservas gratis al mes · 1 clic para pasar a un plan. Mockup of the Rutas Libres tour card. Buttons: coral "Publicar gratis en Rutas Libres" + navy outlined "Ver planes de KipuControl".
8. PRICING (id="precios"): H2 "Planes simples, sin sorpresas"; monthly/annual toggle with "2 meses gratis" green pill; 4 plan cards: Vitrina gratis (S/ 0, para siempre), Starter (S/ 490/mes), Professional (S/ 1 190/mes, highlighted with navy border and yellow "Más popular" badge), Enterprise (S/ 2 890/mes, "Hablar con ventas"). Each card: price, short description, users included, 6 check features, CTA ("Suscribirme" yellow on Professional, outlined on others). Below: "Add-ons sin cambiar de plan" row of chips (IA Básico S/ 59/mes, IA Pro S/ 149/mes, Dominio propio, PayPal, Plantillas premium S/ 290) and a compact comparison table toggle "Comparar todas las funciones". Small print: "Precios sin IGV. Cancela cuando quieras."
9. Testimonials: H2 "Agencias que ya venden más"; 6 cards with photo, name, agency, city, star rating and a metric chip ("+38 % reservas directas", "cotiza 4x más rápido").
10. "Del blog" (blog preview): kicker "Recursos"; H2 "Aprende a vender más tours"; horizontal category filter pills (Todos, Ventas, Marketing y SEO, Operaciones, Finanzas, IA, Guías de destino); 3 article cards with 16:9 image, category chip, title, excerpt, author avatar, date, minutes; link "Ver todo el blog →".
11. FAQ accordion (6 questions): ¿Necesito tarjeta para empezar? · ¿Puedo usar mi propio dominio? · ¿Emite facturas electrónicas? · ¿Cómo funciona Rutas Libres? · ¿Puedo cambiar de plan? · ¿Mis datos están seguros?
12. Final CTA band (navy with subtle grid pattern): "Lanza tu agencia digital hoy" + yellow "Empieza gratis" + white outlined "Chatea con nosotros"; small trust row: soporte en español, actualizaciones semanales, 99,9 % disponibilidad.
13. Footer (dark navy): logo + tagline + address in Lima; columns Producto, Soluciones, Recursos (Blog, Guías, Rutas Libres, Estado del sistema), Empresa, Legal (Términos, Privacidad, Cookies, Libro de reclamaciones); newsletter field "Recibe consejos cada mes" + button; social icons; status dot "Todos los sistemas operativos"; language switch.

FLOATING ELEMENTS (show them on the canvas):
- Chatbot launcher bottom-right: navy circle with chat icon + yellow notification dot, and an open chat panel preview (header "Kipu · asistente", online green dot, quick replies "Ver precios", "Agendar demo", "Soy agencia nueva", input field, "Hablar con una persona" link, WhatsApp shortcut).
- Exit-intent popup (centered modal over dimmed page): "Antes de irte: prueba 14 días del plan Professional" with email field, yellow "Quiero mi prueba", and "No, gracias" text link; small "Sin tarjeta · cancela cuando quieras".
- Cookie banner bottom-left compact card with "Aceptar", "Rechazar", "Configurar".
```

---

## Prompts de pantallas (en el mismo proyecto)

### 1. Precios y suscripción

```
Using the same KipuControl design system, design the pricing page (kipucontrol.com/precios) in Spanish (Peru). Hero "Elige el plan para tu agencia" with monthly/annual toggle and currency switch PEN/USD. The 4 plan cards from the homepage, then a full feature comparison table grouped by module (sticky header with plan names and CTA buttons), add-ons section with one-time vs monthly prices, a calculator "¿Cuánto ahorras?" (inputs: reservas al mes, horas cotizando a la semana → result card), FAQ about billing (facturas SUNAT, cambio de plan, cancelación, IGV), testimonials strip and final CTA. Show the chatbot launcher.
```

### 2. Proceso de suscripción (checkout en 3 pasos)

```
Design the subscription checkout for KipuControl in Spanish (Peru), same design system. A 3-step flow with a progress bar: 1) "Tu cuenta" (nombre, correo, contraseña or "Continuar con Google", nombre de la agencia, país, RUC opcional); 2) "Tu plan" (selected plan card editable, monthly/annual, add-on checkboxes, coupon field); 3) "Pago" (card form, Yape QR option, PayPal button, billing data for factura or boleta). Right column sticky order summary with subtotal, IGV 18 %, total, "Garantía de 14 días" and security badges. Success screen: "¡Bienvenido a KipuControl!" with checklist of first steps (importar tours, conectar dominio, invitar equipo) and button "Ir a mi panel". Desktop and mobile versions.
```

### 3. Blog con filtro de categorías

```
Design the KipuControl blog index (kipucontrol.com/blog) in Spanish (Peru), same design system. The articles come from the same Payload CMS as rutaslibres.pe/blog; each post can belong to KipuControl (B2B: ventas, marketing y SEO, operaciones, finanzas, IA) or Rutas Libres (destination guides). Header with H1 "Recursos para agencias de viaje", search field, and a sticky category filter bar with pills and counts (Todos 48, Ventas 12, Marketing y SEO 10, Operaciones 8, Finanzas 6, IA 7, Guías de destino 5) plus a site toggle "KipuControl · Rutas Libres". Featured article large card, then a 3-column grid of article cards (image, category chip, title, excerpt, author, date, reading minutes), pagination, sidebar on desktop with newsletter subscription box, popular posts and a "Prueba KipuControl gratis" CTA card. Inline newsletter banner after the 6th card. Mobile version with horizontally scrollable filter pills.
```

### 4. Artículo con comentarios

```
Design a KipuControl blog article page in Spanish (Peru), same design system. Title "Cómo cotizar un paquete a Cusco en 10 minutos", breadcrumb, category chip, author card (photo, role, verified), reading time, share buttons, table of contents sticky on the left (desktop), article body with H2 sections, a product screenshot callout, tip boxes, an inline CTA card "Prueba el cotizador gratis", FAQ, author bio, related articles. Comments section: count "12 comentarios", sort (Más recientes / Más útiles), comment form (nombre, correo, comentario, checkbox de privacidad, "Publicar comentario" — note "Los comentarios se revisan antes de publicarse"), threaded comments with avatar, name, date, "Responder" and "Útil (4)" buttons, an "Equipo KipuControl" badge on staff replies. Show the chatbot launcher and a slide-in newsletter popup at 60 % scroll (bottom-right card: "Recibe una guía como esta cada mes", email, "Suscribirme", close X).
```

### 5. Módulo «Web, SEO e IA» (página de producto)

```
Design the product page "Web, SEO e IA" for KipuControl in Spanish (Peru), same design system. Hero "Tu web de agencia que aparece en Google" with mockup of a branded agency site on desktop and phone. Sections: templates gallery (6 thumbnails, incluidas y premium); SEO per page (mockup of an SEO panel with Google preview, meta title/description counters, score 0–100, checklist, redirects, sitemap); AI content (panel generating title, description, translations EN/PT and alt text, with credits counter and "Revisión humana" toggle); blog with categories; tracking without code (GA4, Google Ads, Meta Pixel chips with consent banner); results stats (+62 % tráfico orgánico, 3x reservas directas); pricing chips for add-ons; FAQ and final CTA.
```

### 6. Versión móvil del inicio

```
Create the mobile version (390px) of the KipuControl homepage with the same content: hamburger menu with full-screen drawer, stacked hero with CTAs full width, module cards in 2 columns, product blocks stacked (mockup above text), pricing cards as a horizontal swipe carousel with the toggle on top, blog filter pills scrollable, FAQ accordion, sticky bottom bar with "Empieza gratis" and chat button, chatbot opening as a full-screen sheet.
```

### 7. Blog de Rutas Libres con filtro (rutaslibres.pe/blog)

Este prompt va en el **proyecto de Stitch de Rutas Libres**, no en el de KipuControl, para que use su sistema «Luminous Nomad».

```
Using the Rutas Libres "Luminous Nomad" design system (cobalt #1D4ED8 for navigation and filters, coral #F95738 only for booking CTAs and prices, emerald #059669 for verified, background #F8FAFC, Plus Jakarta Sans, 24px cards, glass sticky bars), design the blog index of rutaslibres.pe/blog in Spanish (Peru). Header: kicker "Blog de Rutas Libres", H1 "Guías para recorrer el Perú a pie", subtitle. Featured "Más leído" article as a wide split card (image left, category, title, excerpt, verified author, "Leer la guía"). Below it a sticky glass filter bar with: category pills with counts (Todo 24, Guías de barrio 8, Gastronomía 5, Itinerarios 6, Consejos prácticos 5), a destination dropdown (Todos los destinos, Lima, Cusco, Arequipa, Puno), a language chip ES/EN/PT, and a search field "Buscar en el blog". Under the bar: results count "6 artículos · Quitar filtros" and active filter chips with X. Grid of 3 columns of article cards (16:9 image, category chip, city · minutes, title, excerpt, author and date). Empty state "No hay artículos con esos filtros" with a button to clear filters. Inline banner after 6 cards: "¿Viajas a Cusco? Mira los free tours de esta semana" with coral "Ver tours". Newsletter box at the end, pagination, and footer. Mobile version: filter pills scroll horizontally, destination and search open in a bottom sheet "Filtrar" with "Aplicar" button.
```

---

## Versión corta en español (por si prefiere escribir en español)

```
Landing de software SaaS "KipuControl" (kipucontrol.com) para agencias de viaje y tour operadores del Perú. Textos en español de Perú, tuteo. Colores: azul marino #0A3A73, azul #11509A, amarillo #F4B400 para los botones principales, verde #22A55A para checks, fondo #F7F9FC, tipografía Plus Jakarta Sans, tarjetas redondeadas y maquetas reales del software. Secciones: barra de anuncio, menú fijo con «Empieza gratis», hero con dashboard y prueba social, logos y sellos de confianza, 8 módulos, 5 bloques alternados (cotizaciones, reservas, pagos, web con SEO e IA, asistente IA de ventas), banda de Rutas Libres para empezar gratis, precios con interruptor mensual/anual (Vitrina gratis, Starter S/ 490, Professional S/ 1 190 más popular, Enterprise S/ 2 890) y add-ons, testimonios, blog con filtro de categorías, preguntas frecuentes, CTA final y pie. Elementos flotantes: chatbot abajo a la derecha, popup de salida con prueba de 14 días y banner de cookies.
```

---

## Lista de verificación al revisar lo que entrega Stitch

- [ ] El botón principal es amarillo con texto oscuro; el coral solo aparece dentro de lo que es de Rutas Libres.
- [ ] Los precios coinciden con el prototipo y dicen «sin IGV».
- [ ] Interruptor mensual/anual y plan Professional destacado.
- [ ] Blog con filtro de categorías y el interruptor KipuControl / Rutas Libres.
- [ ] Blog de Rutas Libres con filtro por categoría, destino, idioma y búsqueda, y la hoja «Filtrar» en móvil.
- [ ] Artículo con formulario de comentarios moderados y respuestas en hilo.
- [ ] Chatbot, popup de salida, popup de boletín al 60 % y banner de cookies.
- [ ] Panel SEO con vista previa de Google y contadores de caracteres.
- [ ] Versión móvil sin desplazamiento horizontal y barra inferior con «Empieza gratis».
- [ ] Ningún texto, logo o imagen copiado de sell-saas.com.

## Lo que esto implica en el producto (para después del diseño)

Hoy el prototipo y las specs cubren la vitrina, el blog en Payload, el SEO y el seguimiento. La landing agrega piezas que todavía no están especificadas:
- checkout de suscripción con cobro recurrente y factura SUNAT;
- blog compartido entre los dos sitios (campo `site` en las entradas de Payload);
- comentarios moderados;
- popups con reglas (salida, desplazamiento, tiempo);
- chatbot de la landing conectado al asistente IA de ventas de la spec 19.

Cuando el diseño esté aprobado, se pueden documentar como spec 25.
