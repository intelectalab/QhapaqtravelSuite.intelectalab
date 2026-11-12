# Prompt de Stitch: plantilla «Andes Clásico 3.0» (sitio web de la agencia)

**Qué es:** el rediseño de la plantilla por defecto del sitio propio de cada agencia. Hoy la usan 41 agencias. Mantiene su carácter (azul marino y dorado, montañas, buscador y salidas programadas) con la calidad visual de Rutas Libres y de la landing de KipuControl. Los datos de ejemplo son de **Andes Horizonte Travel**, la agencia demo del prototipo.

**Cómo usarlo:**
1. Abra [Stitch](https://stitch.withgoogle.com/) en modo web y cree un proyecto nuevo.
2. Pegue el **Prompt principal** (inicio en escritorio).
3. En el mismo proyecto, pegue los prompts de las pantallas 2 a 8 uno por uno, para que Stitch mantenga el estilo.
4. Descargue el zip y compártalo aquí. Lo convierto en tokens del manifiesto (`template.json`) y en secciones del SDK, como pide la spec 23 §13.9.

El prompt está en inglés porque Stitch lo entiende mejor. Los textos de la página están en español de Perú.

**Reglas que el diseño tiene que respetar** (spec 23 §13):
- Es una **plantilla**: la agencia cambia logo, nombre y colores. Por eso se piden 4 colores de marca intercambiables y nada de colores fijos en las imágenes.
- La reserva siempre usa el **widget de reserva del SDK**: fecha, pasajeros por edad, adicionales y precio total.
- El pie lleva términos, privacidad, cookies y el enlace visible al **Libro de Reclamaciones**, obligatorio en Perú.
- Debe verse bien a 390 y 1280 px, con contraste AA y modo oscuro.

---

## Prompt principal: inicio (escritorio, 1440 px)

```
Design the homepage of a premium yet trustworthy website template for a Peruvian inbound tour operator / travel agency. Template name: "Andes Clásico 3.0". Demo agency: "Andes Horizonte Travel" (Cusco & Lima). This is a reusable template sold inside a SaaS: every agency swaps its logo, name, photos and 4 brand colors, so build the design on clear color roles, not on hard-coded art.

VISUAL IDENTITY (default theme):
- Color roles: SIDE / deep navy #0F2747 (header on scroll, footer, dark sections), ACCENT / Andean blue #1560B8 (links, secondary buttons, active filters), SOFT / ice blue #E3EEFB (tinted panels, chips), SUN / Inca gold #F2B33D (primary CTA "Reservar", price highlights, rating stars; dark text #2A1E00 on it). Neutrals: canvas #F7F9FC, line #E4E8EF, ink #15202E, slate #4A5568.
- Typography: "Plus Jakarta Sans" for UI and body; "Fraunces" (or similar refined serif) only for H1/H2 display titles to keep the classic feel. H1 60px, H2 40px, body 17px/1.6. Small uppercase kickers with wide tracking.
- Shapes: 12px card radius (the template's "radius" token), pill chips, 1px borders, soft shadows. Glass effect only on the floating search bar.
- Imagery: large, real-feeling photography of the Andes (Machu Picchu at sunrise, Rainbow Mountain, Sacred Valley terraces, Lake Titicaca), travelers with local guides. Warm natural light. No folkloric clipart, no textile patterns, no text baked into images.
- Feel: classic, calm, high-end tour operator (think Aman / Belmond meets a fast booking site). WCAG AA contrast. Spanish (Peru) copy.

PAGE STRUCTURE:
1. Top utility bar (navy): "Atención 24/7 · +51 984 123 456 · WhatsApp", language switch ES | EN | PT, currency switch S/ | US$, "Mi reserva".
2. Header: agency logo (placeholder mark + "Andes Horizonte"), nav: Destinos, Tours, Paquetes, Salidas programadas, Aventuras, Blog, Contacto. Gold button "Cotiza tu viaje". Transparent over the hero, solid navy after scroll.
3. HERO (hero_buscador): full-bleed Machu Picchu sunrise photo with dark gradient at the bottom. H1 "Viaja por el Perú con quienes lo conocen" + subtitle "Tours y paquetes con guías oficiales, salidas garantizadas y pago seguro en soles o dólares." Floating glass search bar: Destino (select), Fecha, Pasajeros (adultos, niños), button "Buscar tours". Under it, trust chips: "Guías oficiales certificados", "Salidas garantizadas", "Pago seguro con Yape, tarjeta o PayPal", "4.9 ★ 1 280 reseñas".
4. Destinos (destinos): bento grid of 5 destination cards with photo, name and "32 tours": Cusco y Machu Picchu (large), Valle Sagrado, Arequipa y Colca, Puno y Titicaca, Lima gastronómica.
5. Más vendidos (mas_vendidos): carousel of 4 tour cards (4:3 photo, duration chip "Full day" / "4D/3N", title, rating, "Desde S/ 480 por persona" with gold price, "Ver tour"). Examples: Machu Picchu Full Day en tren Vistadome; Montaña de 7 Colores; Valle Sagrado VIP con almuerzo; Camino Inca Clásico 4D.
6. Salidas programadas (salidas): compact table/list of the next 6 departures with date badge, tour, "6 cupos" availability pill (green / amber "Últimos 2 cupos" / red "Agotado"), price, button "Reservar".
7. Ofertas (ofertas): wide navy band with photo, "Temporada de lluvias: 15 % en paquetes a Cusco", countdown chips, gold CTA.
8. Por qué viajar con nosotros: 4 icon features (guías propios, grupos pequeños, atención en tu idioma, flexibilidad para reprogramar) + a photo of the team in Cusco + licencia MINCETUR / DIRCETUR badges.
9. Reseñas (resenas): verified reviews from the agency's own system: big rating "4.9", 3 review cards with traveler name, country flag, tour, date, "Reseña verificada" check. Small logos: Google, Tripadvisor.
10. Blog (blog): 3 article cards ("Qué llevar a Machu Picchu en temporada de lluvias", "Cusco en 3 días", "Soroche: cómo prevenirlo").
11. Boletín (boletin): soft-blue panel "Recibe ofertas y salidas nuevas", email field, consent checkbox "Acepto la política de privacidad (Ley 29733)".
12. Footer (navy): logo + short description, columns Destinos / Empresa / Ayuda / Legal, contact, payment logos (Visa, Mastercard, Yape, Plin, PayPal), social icons, RUC 20611234567, and a clearly visible "Libro de Reclamaciones" button with book icon. Small "Sitio hecho con KipuControl".
13. Floating WhatsApp button bottom-right.
```

---

## Pantalla 2: ficha del tour (escritorio)

```
Same template and theme. Design the TOUR DETAIL page for "Machu Picchu Full Day en tren Vistadome".
- Breadcrumb Inicio / Cusco / Machu Picchu Full Day.
- Gallery: 1 large + 4 small photos, "Ver 18 fotos".
- Title, rating 4.9 (312 reseñas), chips: Full day · 14 h, Grupo máx. 12, Guía en español e inglés, Recojo en hotel.
- Left column: Resumen; Itinerario as a vertical timeline (04:30 recojo, 06:10 tren Vistadome, 10:00 visita guiada circuito 2, 13:30 almuerzo en Aguas Calientes, 15:20 tren de retorno); Incluye / No incluye in two columns with check / x icons; Punto de encuentro with small map; Políticas de cancelación; FAQ accordion; Reseñas.
- Right column, sticky BOOKING WIDGET card (this is the SDK component, keep it generic): date picker with availability colors, passengers by age (Adultos, Niños 3–11, Infantes), optional add-ons with prices (Huayna Picchu +S/ 95, Almuerzo buffet +S/ 60), currency toggle S/ | US$, price breakdown and total "S/ 1 920 por 2 personas", gold button "Reservar ahora", secondary "Consultar por WhatsApp", trust line "Pago seguro · Confirmación inmediata · Cancelación gratis hasta 48 h".
- Below: "También te puede interesar" carousel.
```

## Pantalla 3: destino y búsqueda (escritorio)

```
Same template. Design the DESTINATION / SEARCH RESULTS page "Tours en Cusco".
- Hero band with Cusco photo, H1 "Tours en Cusco", short intro (2 lines), stats "64 tours · 4.8 ★".
- Left sticky filters: Fecha, Duración (medio día, full day, 2–4 días, 5+), Tipo (cultural, aventura, trekking, gastronomía, lujo), Precio (range slider S/), Idioma del guía, Solo con cupos.
- Results: sort select (Recomendados, Precio, Duración, Mejor valorados), list/grid toggle, 9 tour cards with availability pill and price, pagination.
- A "¿No encuentras lo que buscas? Arma tu viaje a medida" navy band with gold CTA.
```

## Pantalla 4: carrito y pago (escritorio)

```
Same template. Design the CART + CHECKOUT page (the payment part is the SDK checkout: clean, no distractions, no promo banners).
- 3-step progress: Datos de pasajeros · Pago · Confirmación.
- Left: lead traveler form (nombre, documento, nacionalidad, correo, WhatsApp), passenger rows by age with document type, special requests, comprobante (boleta / factura con RUC).
- Payment methods as tabs: Tarjeta (hosted card fields), Yape / Plin (QR), PayPal. Checkbox for terms and privacy.
- Right sticky summary: tour thumbnail, date, passengers, add-ons, subtotal, IGV note for non-domiciled tourists, total in S/ and approx. US$, gold "Pagar S/ 1 920", lock icon "Pago seguro".
```

## Pantalla 5: blog y artículo (escritorio)

```
Same template. Design the BLOG index (featured article + category pills: Guías, Consejos, Gastronomía, Aventura + 6 cards) and, as a second frame, an ARTICLE page "Qué llevar a Machu Picchu en temporada de lluvias": serif H1, author with photo, date, reading time, cover photo with caption, table of contents, H2 sections, a highlighted tip box, an embedded "Tours recomendados" row of 3 tour cards with live prices, FAQ, author bio and related posts.
```

## Pantalla 6: aventuras de viajeros (escritorio)

```
Same template. Design the "AVENTURAS" page: real stories written by past travelers (published with their consent). Masonry grid of story cards with traveler photo, name, country, tour taken, short quote, "Leer historia". A filter by destino. Top CTA "¿Viajaste con nosotros? Cuenta tu historia".
```

## Pantalla 7: contacto y Libro de Reclamaciones (escritorio)

```
Same template. Design the CONTACT page: form (nombre, correo, WhatsApp, fecha estimada, pasajeros, mensaje, consent), office cards in Cusco and Lima with map, hours, WhatsApp button. As a second frame, the LIBRO DE RECLAMACIONES page required by Peruvian law: official-looking form with consumer data, "Reclamo" vs "Queja" selector, product/service, amount, detail, consumer request, consent, submit; short legal note "La respuesta se enviará en un plazo máximo de 15 días hábiles" and agency RUC and address.
```

## Pantalla 8: móvil (390 px)

```
Same template. Create MOBILE versions (390 px wide) of the homepage and the tour detail.
- Header with logo, currency/language in the menu, hamburger; hero with stacked search (destino, fecha, pasajeros) and full-width gold "Buscar tours".
- Tour cards one per row; destinations as horizontal scroll.
- Tour detail: swipeable gallery, chips, collapsible itinerary, and a sticky bottom bar with "Desde S/ 960" and gold "Reservar" that opens the booking widget as a bottom sheet.
- Footer accordions; Libro de Reclamaciones still visible.
- Touch targets ≥ 44 px, no horizontal scroll.
```

---

## Versión corta (si Stitch pide menos texto)

```
Reusable website template "Andes Clásico 3.0" for a Peruvian tour operator (demo: Andes Horizonte Travel). Swappable brand roles: navy #0F2747, Andean blue #1560B8, ice blue #E3EEFB, Inca gold #F2B33D for "Reservar". Plus Jakarta Sans + Fraunces for display titles, 12px radius, real Andes photography, no folkloric clipart. Homepage: utility bar with WhatsApp and currency, transparent header, Machu Picchu hero with floating search (destino, fecha, pasajeros), trust chips, destination bento, best-seller tour cards with prices, upcoming departures with seat availability, offer band, why-us, verified reviews, blog, newsletter with Ley 29733 consent, navy footer with payment logos and a visible "Libro de Reclamaciones" button. Spanish (Peru) copy, WCAG AA.
```

## Lista para revisar el resultado

- [ ] Los 4 colores de marca se usan por rol: con solo cambiar esos 4, el sitio cambia de marca.
- [ ] El dorado aparece solo en la acción principal y en los precios.
- [ ] El widget de reserva es una tarjeta genérica: fecha, pasajeros por edad, adicionales y total.
- [ ] El Libro de Reclamaciones se ve en el pie de todas las páginas.
- [ ] La versión móvil tiene la barra fija de «Reservar» y no tiene scroll horizontal.
- [ ] No hay texto dentro de las fotos (la agencia cambia las imágenes).
