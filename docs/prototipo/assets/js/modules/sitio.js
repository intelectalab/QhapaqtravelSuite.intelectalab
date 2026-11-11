/* ==========================================================================
   Sitio web público de la agencia (Andes Horizonte Travel) — rutas #/sitio/*
   Accesible sin iniciar sesión. PROC-054 (E-commerce), PROC-055 (CMS), PROC-001 (leads web).
   Catálogo, disponibilidad, precios por temporada, carrito con hold de cupos, checkout por pasos,
   pago simulado, cuenta del cliente, cotización a medida, contacto, chat, blog y legales.
   En producción: Next.js (SSR/ISR) consumiendo /api/v1/public/* — ver 15-sitio-web-publico.md
   ========================================================================== */
(function () {
  'use strict';
  const { esc, money, fmtN, sum, daysFromToday, addDays, nowStr, parseD, pad } = Util;
  const T = () => window.TODAY;
  const ic = (n) => UI.icon(n);
  const WA = '+51 987 640 221', MAIL = 'reservas@andeshorizonte.pe', PHONE = '(01) 640 2210', EMERG = '+51 984 110 247';
  const LSK = { prefs: 'ah_site_prefs', cart: 'ah_site_cart', wish: 'ah_site_wish', chat: 'ah_site_chat', orders: 'ah_site_orders' };
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } }
  };
  const prefs = Object.assign({ lang: 'es', cur: 'PEN' }, ls.get(LSK.prefs, {}));
  const savePrefs = () => ls.set(LSK.prefs, prefs);
  const rnd1 = (v) => Math.round(v * 10) / 10;
  const rnd2 = (v) => Math.round(v * 100) / 100;
  const nextId = (arr, prefix, w) => { const n = Math.max(0, ...(arr || []).map(x => parseInt(String(x.id || '').replace(prefix, '').replace(/\D/g, ''), 10) || 0)); return prefix + String(n + 1).padStart(w, '0'); };
  const plusMin = (s, m) => { const d = parseD(s); d.setMinutes(d.getMinutes() + m); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  /* "Ahora" simulado: fecha de referencia del prototipo + hora real del navegador */
  const nowMs = () => { const d = new Date(); const b = parseD(T()); b.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), 0); return b.getTime(); };
  const addBizDays = (s, n) => { const d = parseD(s); let k = 0; while (k < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) k++; } return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const emailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());

  /* ---------------- Idioma ---------------- */
  const I18N = {
    es: {
      destinos: 'Destinos', tours: 'Tours', paquetes: 'Paquetes', experiencias: 'Experiencias', ofertas: 'Ofertas', medida: 'Viajes a medida', blog: 'Blog', nosotros: 'Nosotros', contacto: 'Contacto',
      cart: 'Carrito', account: 'Mi cuenta', signin: 'Ingresar', backoffice: 'Back-office', hours: 'Lun–Vie 9:00–19:00 · Sáb 9:00–13:00', lang: 'Idioma', currency: 'Moneda',
      hero_k: 'Operador turístico en Perú desde 2012', hero_t: 'Viaje por el Perú con expertos locales: Machu Picchu, los Andes y la costa, a su ritmo.', hero_s: 'Tours, paquetes y experiencias con confirmación inmediata, guías oficiales y asistencia 24/7 durante todo su viaje.',
      s_dest: 'Destino', s_any: 'Todos los destinos', s_date: 'Fecha de viaje', s_pax: 'Viajeros', s_btn: 'Buscar', s_hint: 'Precios por persona con impuestos incluidos.',
      f_dest: 'Destinos destacados', f_dest_s: 'Los lugares que más nos piden, con programas probados por nuestro equipo en Cusco.', f_pk: 'Tours y paquetes destacados', f_pk_s: 'Selección del equipo de viajes para esta temporada.', all: 'Ver todos',
      offers_t: 'Ofertas por tiempo limitado', offers_s: 'Precios web y códigos promocionales vigentes.', ends: 'Termina en', deps_t: 'Salidas grupales garantizadas', deps_s: 'Salidas que ya alcanzaron el mínimo de viajeros: se operan con seguridad.', seats: 'cupos', left: 'disponibles',
      why_t: 'Por qué viajar con nosotros', rev_t: 'Lo que dicen nuestros viajeros', rev_demo: 'Reseñas de ejemplo (demo): en producción provienen de encuestas post-viaje verificadas.', guar_t: 'Certificaciones y garantías',
      news_t: 'Reciba ofertas y guías de viaje', news_s: 'Un correo al mes con salidas garantizadas, precios web y consejos para viajar por el Perú.', news_btn: 'Suscribirme',
      from: 'Desde', pp: 'por persona', view: 'Ver detalle', add: 'Añadir al carrito', book: 'Reservar ahora', wa: 'Consultar por WhatsApp', quote: 'Cotizar a medida',
      best: 'Más vendido', offer: 'Oferta', free: 'Cancelación gratis', instant: 'Confirmación inmediata', guaranteed: 'Salida garantizada', onreq: 'Confirmación en 24 h',
      overview: 'Resumen', itinerary: 'Itinerario', incl: 'Incluye', excl: 'No incluye', reqs: 'Requisitos', policies: 'Políticas de cancelación y cambios', avail: 'Disponibilidad y precios', meet: 'Punto de encuentro', faq: 'Preguntas frecuentes', related: 'También le puede interesar', reviews: 'Reseñas',
      duration: 'Duración', group: 'Grupo', language: 'Idioma del guía', pickup: 'Recojo', modality: 'Modalidad', difficulty: 'Condición física',
      adults: 'Adultos', children: 'Niños', infants: 'Infantes', a_sub: '12 años o más', c_sub: '2 a 11 años', i_sub: 'Menores de 2 años · sin costo', total: 'Total', extras: 'Extras recomendados', options: 'Personalice su viaje', date: 'Fecha',
      results: 'resultados', filters: 'Filtros', sort: 'Ordenar', clear: 'Limpiar filtros', nores: 'No encontramos productos con esos filtros.', search_t: 'Tours, paquetes y experiencias',
      priv: 'Privado', shared: 'Compartido', footer_about: 'Operador turístico y agencia de viajes con oficinas en Lima, Cusco y Arequipa. Diseñamos viajes por el Perú con proveedores seleccionados y guías oficiales.',
      f_company: 'Empresa', f_help: 'Ayuda', f_legal: 'Legal', f_contact: 'Contacto', f_pay: 'Medios de pago', f_social: 'Redes sociales', terms: 'Términos y condiciones', privacy: 'Política de privacidad', cancel: 'Política de cancelación', claims: 'Libro de Reclamaciones',
      chat: 'Chatee con un asesor', wish: 'Lista de deseos', subtotal: 'Subtotal', discount: 'Descuento', checkout: 'Continuar con la compra', empty_cart: 'Su carrito está vacío.', hold: 'Cupos bloqueados por', keep: 'Seguir comprando'
    },
    en: {
      destinos: 'Destinations', tours: 'Tours', paquetes: 'Packages', experiencias: 'Experiences', ofertas: 'Deals', medida: 'Tailor-made trips', blog: 'Blog', nosotros: 'About us', contacto: 'Contact',
      cart: 'Cart', account: 'My account', signin: 'Sign in', backoffice: 'Back-office', hours: 'Mon–Fri 9:00–19:00 · Sat 9:00–13:00', lang: 'Language', currency: 'Currency',
      hero_k: 'Tour operator in Peru since 2012', hero_t: 'Travel Peru with local experts: Machu Picchu, the Andes and the coast, at your own pace.', hero_s: 'Tours, packages and experiences with instant confirmation, licensed guides and 24/7 assistance throughout your trip.',
      s_dest: 'Destination', s_any: 'All destinations', s_date: 'Travel date', s_pax: 'Travelers', s_btn: 'Search', s_hint: 'Prices per person, taxes included.',
      f_dest: 'Featured destinations', f_dest_s: 'Our most requested places, with programs tested by our Cusco team.', f_pk: 'Featured tours and packages', f_pk_s: 'Hand-picked by our travel team for this season.', all: 'See all',
      offers_t: 'Limited-time deals', offers_s: 'Online prices and promo codes currently available.', ends: 'Ends in', deps_t: 'Guaranteed group departures', deps_s: 'Departures that already reached the minimum number of travelers.', seats: 'seats', left: 'left',
      why_t: 'Why travel with us', rev_t: 'What our travelers say', rev_demo: 'Sample reviews (demo): in production they come from verified post-trip surveys.', guar_t: 'Certifications and guarantees',
      news_t: 'Get deals and travel guides', news_s: 'One email a month with guaranteed departures, online prices and tips for traveling in Peru.', news_btn: 'Subscribe',
      from: 'From', pp: 'per person', view: 'View details', add: 'Add to cart', book: 'Book now', wa: 'Ask on WhatsApp', quote: 'Request a custom quote',
      best: 'Best seller', offer: 'Deal', free: 'Free cancellation', instant: 'Instant confirmation', guaranteed: 'Guaranteed departure', onreq: 'Confirmation within 24 h',
      overview: 'Overview', itinerary: 'Itinerary', incl: 'Included', excl: 'Not included', reqs: 'Requirements', policies: 'Cancellation and change policy', avail: 'Availability and prices', meet: 'Meeting point', faq: 'Frequently asked questions', related: 'You may also like', reviews: 'Reviews',
      duration: 'Duration', group: 'Group size', language: 'Guide language', pickup: 'Pickup', modality: 'Type', difficulty: 'Fitness level',
      adults: 'Adults', children: 'Children', infants: 'Infants', a_sub: 'Age 12+', c_sub: 'Age 2–11', i_sub: 'Under 2 · free', total: 'Total', extras: 'Recommended extras', options: 'Customize your trip', date: 'Date',
      results: 'results', filters: 'Filters', sort: 'Sort by', clear: 'Clear filters', nores: 'No products match those filters.', search_t: 'Tours, packages and experiences',
      priv: 'Private', shared: 'Shared', footer_about: 'Tour operator and travel agency with offices in Lima, Cusco and Arequipa. We design trips across Peru with selected suppliers and licensed guides.',
      f_company: 'Company', f_help: 'Help', f_legal: 'Legal', f_contact: 'Contact', f_pay: 'Payment methods', f_social: 'Social media', terms: 'Terms and conditions', privacy: 'Privacy policy', cancel: 'Cancellation policy', claims: 'Complaints Book',
      chat: 'Chat with an advisor', wish: 'Wishlist', subtotal: 'Subtotal', discount: 'Discount', checkout: 'Proceed to checkout', empty_cart: 'Your cart is empty.', hold: 'Seats held for', keep: 'Keep shopping'
    }
  };
  const t = (k) => (I18N[prefs.lang] && I18N[prefs.lang][k]) || I18N.es[k] || k;
  const EN = () => prefs.lang === 'en';
  const MES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'], MES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MESL_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'], MESL_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dt = (s) => { const d = parseD(s); if (!d || isNaN(d)) return s || '—'; return EN() ? MES_EN[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() : pad(d.getDate()) + ' ' + MES_ES[d.getMonth()] + ' ' + d.getFullYear(); };
  const dtw = (s) => { const d = parseD(s); const W = EN() ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']; return W[d.getDay()] + ' ' + dt(s); };

  /* ---------------- Moneda: SIEMPRE vía BookingEngine (BE.currencies / BE.convert / BE.fmt) ----------------
     R-MULTICURRENCY activa → el visitante elige cualquier moneda activa (precio referencial);
     se cobra en DB.settings.ecommerce.chargeCurrencies (PEN / USD). Regla apagada → solo monedas de cobro. */
  const BE = window.BookingEngine;
  const charges = () => (BE.cfg().chargeCurrencies || ['PEN', 'USD']);
  const multiCur = () => BE.on('R-MULTICURRENCY');
  const curList = () => { const l = BE.currencies().filter(c => multiCur() || charges().includes(c.code)); return l.length ? l : [BE.currency('PEN')]; };
  const curFix = () => { if (!curList().some(c => c.code === prefs.cur)) prefs.cur = curList().some(c => c.code === 'PEN') ? 'PEN' : curList()[0].code; };
  const conv = (v, from, to) => BE.convert(v || 0, from || 'PEN', to || prefs.cur);
  const fmtC = (v, code) => BE.fmt(v, code || prefs.cur);
  const pm = (v, from, to) => fmtC(conv(v, from, to), to || prefs.cur);
  const pm0 = (v, from) => fmtC(Math.round(conv(v, from)), prefs.cur).replace(/[.,]00$/, '');
  /* Moneda de cobro: la elegida si es de cobro; si no, USD (o la primera configurada) */
  const chargeCur = () => charges().includes(prefs.cur) ? prefs.cur : (charges().includes('USD') ? 'USD' : charges()[0]);
  const isRef = () => !charges().includes(prefs.cur);
  const rateTxt = (code) => { if (code === 'PEN') return ''; const r = BE.currency(code).rate || 1; return r >= 0.1 ? '1 ' + code + ' = S/ ' + r.toLocaleString('es-PE', { maximumFractionDigits: 4 }) : 'S/ 1 = ' + BE.fmt(1 / r, code); };
  /* Aviso de moneda: precio referencial + moneda de cobro + tipo de cambio aplicado */
  function fxNote(compact) {
    const cc = chargeCur(); const codes = [...new Set([prefs.cur, cc, 'USD'].filter(c => c !== 'PEN'))];
    const tc = codes.map(rateTxt).filter(Boolean).join(' · ');
    const ref = isRef() ? (EN() ? 'Prices in ' + prefs.cur + ' are for reference only; you are charged in ' + charges().join(' or ') + ' (' + cc + ' for this purchase). ' : 'Precio referencial en ' + prefs.cur + '; se cobra en ' + charges().join(' o ') + ' (esta compra en ' + cc + '). ') : '';
    const txt = ref + (tc ? (EN() ? 'Exchange rate applied: ' : 'Tipo de cambio aplicado: ') + tc + ' (' + (EN() ? 'updated ' : 'actualizado ') + esc(BE.cfg().rateUpdatedAt || T()) + ').' : '');
    if (!txt) return '';
    return compact ? '<p class="ws-note ws-fx">' + ic('coins').replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-2px"') + ' ' + txt + '</p>' : '<div class="ws-fxbar">' + ic('coins') + '<span>' + txt + '</span></div>';
  }

  /* ---------------- Contenido editorial del sitio (en producción: CMS / traducciones) ---------------- */
  const PX = {
    'PRD-001': { diff: 'Moderada', diffEn: 'Moderate', langs: ['ES', 'EN', 'DE', 'FR'], pickup: 'Recojo en hoteles del Centro Histórico de Cusco a las 04:10', gal: ['Ciudadela de Machu Picchu', 'Tren por el valle del Urubamba', 'Aguas Calientes'], rating: 4.9, reviews: 312,
      en: { name: 'Machu Picchu Full Day Trip', short: 'Guided visit to the Inca citadel in one day, with a panoramic train from Ollantaytambo.', long: 'Early pickup from your hotel in Cusco to Ollantaytambo station. Expedition train to Aguas Calientes, bus up to the citadel and a 2.5-hour guided visit of Circuit 2. Free time for lunch and return by train and bus to Cusco.' } },
    'PRD-002': { diff: 'Fácil', diffEn: 'Easy', langs: ['ES', 'EN'], pickup: 'Recepción en el aeropuerto de Cusco (día 1)', gal: ['Plaza de Armas de Cusco', 'Valle Sagrado de los Incas', 'Machu Picchu'], rating: 4.8, reviews: 187,
      en: { name: 'Magical Cusco 5D/4N', short: 'Classic package: City Tour, Sacred Valley and Machu Picchu with a 4-star hotel.', long: '5-day, 4-night program covering Cusco essentials: city tour of Inca temples, full day in the Sacred Valley with buffet lunch, and a Machu Picchu excursion. Includes 4-star hotel with breakfast and all transfers.' } },
    'PRD-004': { diff: 'Moderada a exigente', diffEn: 'Moderate to challenging', langs: ['ES', 'EN'], pickup: 'Punto de encuentro en Plaza Regocijo, Cusco (04:30)', gal: ['Laguna Humantay', 'Nevado Salkantay', 'Soraypampa'], rating: 4.7, reviews: 421,
      en: { name: 'Humantay Lake Full Day', short: 'Hike to the turquoise lake at the foot of Salkantay snow peak.', long: 'Early departure to Mollepata and Soraypampa. 1.5-hour hike up to Humantay Lake (4,200 m a.s.l.).' } },
    'PRD-005': { diff: 'Fácil', diffEn: 'Easy', langs: ['ES', 'EN'], pickup: 'Aeropuerto Alejandro Velasco Astete o su hotel', gal: ['Llegada a Cusco', 'Vehículo privado', 'Centro Histórico'], rating: 4.8, reviews: 96,
      en: { name: 'Cusco airport transfer (private)', short: 'Private transfer between the airport and hotels in downtown Cusco.', long: '' } },
    'PRD-007': { diff: 'Fácil', diffEn: 'Easy', langs: ['ES', 'EN'], pickup: 'Mercado San Pedro, puerta principal (09:00)', gal: ['Mercado San Pedro', 'Cocina andina', 'Pisco sour'], rating: 4.9, reviews: 142,
      en: { name: 'Andean cooking class and San Pedro market', short: 'Market tour and hands-on cooking class with a local chef.', long: '' } },
    'PRD-009': { diff: 'Fácil', diffEn: 'Easy', langs: ['ES', 'EN'], pickup: 'Recojo en hoteles de Miraflores y Barranco, Lima (04:00)', gal: ['Islas Ballestas', 'Reserva de Paracas', 'Pingüinos de Humboldt'], rating: 4.6, reviews: 208,
      en: { name: 'Paracas and Ballestas Islands from Lima', short: 'Sea lions, Humboldt penguins and the Paracas reserve in one day.', long: '' } }
  };
  const px = (p) => PX[p.id] || { diff: 'Fácil', diffEn: 'Easy', langs: ['ES', 'EN'], pickup: 'Según programa', gal: [p.name, 'Paisaje', 'Detalle'], rating: 4.6, reviews: 20, en: {} };
  const pName = (p) => (EN() && px(p).en && px(p).en.name) || p.name;
  const pShort = (p) => (EN() && px(p).en && px(p).en.short) || p.short;
  const pLong = (p) => (EN() && px(p).en && px(p).en.long) || p.long || p.short;

  const DEST = [
    { slug: 'cusco', id: 'D03', hue: 192, name: 'Cusco', en: 'Cusco', tag: 'Capital histórica del Imperio inca', tagEn: 'Historic capital of the Inca Empire', alt: '3 399 m s. n. m.',
      desc: 'Cusco combina calles incas y coloniales, barrios bohemios como San Blas y la puerta de entrada al Valle Sagrado y Machu Picchu. Es la base ideal para aclimatarse y organizar excursiones de uno o varios días.',
      climate: 'Estación seca de mayo a octubre (días soleados, noches frías); lluvias de diciembre a marzo. Temperaturas entre 2 °C y 20 °C.',
      faq: [['¿Cuántos días necesito en Cusco?', 'Recomendamos al menos 4 días: uno de aclimatación y city tour, uno para el Valle Sagrado y uno para Machu Picchu.'], ['¿Cómo evito el mal de altura?', 'Descanse el primer día, hidrátese, coma ligero y evite el alcohol las primeras 24 horas. Programe las caminatas de altura después del segundo día.'], ['¿Necesito comprar el Boleto Turístico?', 'Los paquetes que lo requieren ya lo incluyen. Para visitas libres puede adquirirlo en la ciudad.']] },
    { slug: 'machu-picchu', id: 'D06', hue: 172, name: 'Machu Picchu', en: 'Machu Picchu', tag: 'Maravilla del mundo moderno', tagEn: 'New Wonder of the World', alt: '2 430 m s. n. m.',
      desc: 'La ciudadela inca se visita por circuitos con horario de ingreso y entrada nominativa. Se llega en tren desde Ollantaytambo o Poroy hasta Aguas Calientes y luego en bus a la ciudadela.',
      climate: 'Clima subtropical de montaña. Abril a octubre con menos lluvia; enero a marzo con lluvias intensas y posible neblina por la mañana.',
      faq: [['¿Las entradas son nominativas?', 'Sí. Se emiten con nombre y documento de cada pasajero; lleve el mismo documento el día de la visita.'], ['¿Puedo subir a Huayna Picchu?', 'Requiere una entrada especial con cupos limitados. Consúltenos con anticipación.'], ['¿Qué pasa si llueve?', 'La visita se realiza igual. Lleve poncho o casaca impermeable.']] },
    { slug: 'valle-sagrado', id: 'D05', hue: 150, name: 'Valle Sagrado', en: 'Sacred Valley', tag: 'Pueblos andinos y andenes incas', tagEn: 'Andean villages and Inca terraces', alt: '2 870 m s. n. m.',
      desc: 'Pisac, Chinchero, Moray, Maras y Ollantaytambo conforman un valle fértil a menor altura que Cusco, ideal para aclimatarse y conocer comunidades tejedoras.',
      climate: 'Más templado que Cusco. Temporada seca de mayo a octubre.',
      faq: [['¿Conviene dormir en el valle?', 'Sí, especialmente si su tren a Machu Picchu sale de Ollantaytambo temprano.']] },
    { slug: 'arequipa', id: 'D11', hue: 32, name: 'Arequipa y Colca', en: 'Arequipa & Colca', tag: 'La Ciudad Blanca y el vuelo del cóndor', tagEn: 'The White City and the condor flight', alt: '2 335 m s. n. m.',
      desc: 'Arequipa, con su centro histórico de sillar, es punto de partida al Cañón del Colca, uno de los más profundos del mundo, donde se observa el vuelo del cóndor andino.',
      climate: 'Soleado casi todo el año. Lluvias moderadas de enero a marzo.',
      faq: [['¿Cuántos días para el Colca?', 'El programa más común es de 2 días y 1 noche desde Arequipa.']] },
    { slug: 'paracas', id: 'D16', hue: 200, name: 'Paracas e Ica', en: 'Paracas & Ica', tag: 'Fauna marina y desierto', tagEn: 'Marine wildlife and desert', alt: 'Nivel del mar',
      desc: 'A 3.5 horas de Lima, Paracas ofrece paseos a las Islas Ballestas para ver lobos marinos y pingüinos de Humboldt, y la Reserva Nacional con paisajes desérticos frente al mar.',
      climate: 'Cálido y seco todo el año; viento fuerte por las tardes. Los paseos en lancha salen por la mañana.',
      faq: [['¿Se puede hacer en un día desde Lima?', 'Sí, el full day sale de madrugada y retorna por la noche.'], ['¿El paseo en lancha se cancela?', 'Solo por disposición de Capitanía por oleaje; en ese caso se reprograma o se reembolsa.']] },
    { slug: 'lago-titicaca', id: 'D09', hue: 215, name: 'Puno y Lago Titicaca', en: 'Puno & Lake Titicaca', tag: 'El lago navegable más alto del mundo', tagEn: "World's highest navigable lake", alt: '3 812 m s. n. m.',
      desc: 'Islas flotantes de los Uros, Taquile y Amantaní, con turismo vivencial en comunidades quechuas y aimaras.',
      climate: 'Frío y seco de mayo a setiembre; lluvias de diciembre a marzo.',
      faq: [['¿Se puede combinar con Cusco?', 'Sí, en bus turístico de día completo o en tren panorámico.']] },
    { slug: 'amazonia', id: 'D18', hue: 120, name: 'Amazonía', en: 'Amazon', tag: 'Selva tropical y biodiversidad', tagEn: 'Rainforest and biodiversity', alt: '100–200 m s. n. m.',
      desc: 'Iquitos y Tambopata ofrecen lodges en la selva, caminatas nocturnas, observación de aves y navegación por ríos amazónicos.',
      climate: 'Cálido y húmedo todo el año; mayor nivel de ríos de diciembre a mayo.',
      faq: [['¿Necesito vacunas?', 'Se recomienda la vacuna contra la fiebre amarilla al menos 10 días antes del viaje.']] }
  ];
  const POSTS = [
    { slug: 'mejor-epoca-para-visitar-machu-picchu', title: 'Mejor época para visitar Machu Picchu', cat: 'Guías de viaje', date: '2026-09-10', hue: 172, excerpt: 'Temporada seca, meses de lluvia y cómo elegir la fecha según su tipo de viaje.', body: '## Temporada seca (mayo a octubre)\nCielos despejados y más visitantes. Reserve entradas y tren con al menos 30 días de anticipación.\n\n## Temporada media (setiembre a noviembre)\nDías soleados y menos grupos: es la época que más recomendamos.\n\n## Temporada de lluvias (diciembre a marzo)\nPrecios más bajos y paisajes verdes. El Camino Inca cierra en febrero por mantenimiento.\n\n- Lleve poncho impermeable\n- Prefiera ingresos de la mañana' },
    { slug: 'que-llevar-a-laguna-humantay', title: 'Qué llevar a la Laguna Humantay', cat: 'Aventura', date: '2026-08-22', hue: 186, excerpt: 'Lista práctica para una caminata de altura de un día.', body: '## Lista esencial\n- Ropa en capas y casaca cortaviento\n- Bloqueador solar y lentes de sol\n- 1.5 L de agua y snacks\n- Bastones de trekking (opcional)\n- Efectivo para el ingreso comunal\n\n## Recomendaciones\nRealice la caminata después de dos días de aclimatación en Cusco.' },
    { slug: 'gastronomia-cusquena', title: 'Cinco platos cusqueños que debe probar', cat: 'Gastronomía', date: '2026-07-30', hue: 20, excerpt: 'Del chiriuchu al lechón: sabores de los Andes para su viaje.', body: '## Imperdibles\n- Chiriuchu, plato festivo del Corpus Christi\n- Lechón con tamal\n- Adobo cusqueño al desayuno\n- Sopa de quinua\n- Chicha morada y mate de coca\n\nNuestra clase de cocina andina incluye visita al mercado San Pedro.' },
    { slug: 'paracas-en-un-dia', title: 'Paracas en un día desde Lima', cat: 'Costa', date: '2026-06-18', hue: 200, excerpt: 'Cómo aprovechar el full day a Islas Ballestas y la reserva.', body: '## Horarios\nSalida 04:00 desde Miraflores, lancha a las 08:00 y visita a la reserva al mediodía.\n\n## Consejos\n- Lleve casaca: en la lancha hace viento\n- Use bloqueador aunque esté nublado' }
  ];

  /* ---------------- Datos semilla propios del sitio ---------------- */
  function ensureSeed() {
    let ch = false;
    if (!DB.catalogHolds) { /* mismo formato y semilla que catalogo.js (holds de disponibilidad) */
      DB.catalogHolds = [
        { id: 'HLD-0001', depId: 'SAL-0103', qty: 2, ref: 'COT-2026-00188', status: 'hold', createdAt: T() + ' 08:50', expiresAt: T() + ' 23:50', user: 'U03', notes: 'Bloqueo mientras el cliente aprueba la cotización' },
        { id: 'HLD-0002', depId: 'SAL-0403', qty: 4, ref: 'B2B Mundo Andino Tours', status: 'hold', createdAt: T() + ' 00:05', expiresAt: T() + ' 00:35', user: 'U13', notes: 'Hold desde portal B2B' },
        { id: 'HLD-0003', depId: 'SAL-0404', qty: 2, ref: 'WEB-10433', status: 'confirmada', createdAt: '2026-09-28 22:10', expiresAt: '2026-09-28 22:40', user: 'Sistema', notes: 'Pedido e-commerce' },
        { id: 'HLD-0004', depId: 'SAL-0105', qty: 3, ref: 'COT-2026-00190', status: 'liberada', createdAt: '2026-09-27 10:00', expiresAt: '2026-09-27 10:30', user: 'U04', notes: 'Cliente cambió de fecha' },
        { id: 'HLD-0005', depId: 'SAL-0101', qty: 2, ref: 'RES-2026-000347', status: 'confirmada', createdAt: '2026-08-28 14:12', expiresAt: '2026-08-28 14:42', user: 'U03', notes: 'Keller — MAPI' }
      ]; ch = true;
    }
    if (!DB.siteSeedV1) { /* Salidas programadas publicadas para la venta web (oct–dic 2026) */
      const add = (pid, pre, start, days, cap, time, meeting, sold) => {
        const p = Q.product(pid); if (!p) return; let n = 0;
        days.forEach((off, i) => {
          const d = addDays(start, off); if (p.departures.some(x => x.date === d)) return;
          const id = nextId(DB.products.flatMap(x => x.departures || []).filter(x => x.id.startsWith(pre)), 'SAL-', 4);
          const s = sold[i % sold.length];
          p.departures.push({ id, date: d, time, capacity: cap, sold: s, status: s >= cap ? 'completa' : 'abierta', guideId: null, vehicleId: null, meeting, ret: meeting === 'Hotel (recojo)' ? 'Hotel Cusco' : meeting }); n++;
        });
        p.departures.sort((a, b) => a.date < b.date ? -1 : 1);
      };
      add('PRD-001', 'SAL-01', '2026-10-07', [0, 2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 25, 28, 30, 35, 42, 49, 56, 63, 70, 77, 84, 88], 16, '04:10', 'Hotel (recojo)', [11, 6, 13, 3, 8, 16, 5, 9, 2, 12, 7, 4]);
      add('PRD-004', 'SAL-04', '2026-10-06', [0, 2, 3, 5, 7, 9, 10, 12, 14, 17, 19, 21, 24, 28, 31, 35, 42, 49, 56, 63, 70, 77], 20, '04:30', 'Plaza Regocijo', [9, 14, 4, 17, 6, 20, 11, 2, 8, 15, 5, 12]);
      DB.siteSeedV1 = true; ch = true;
    }
    if (!DB.webCarts) { DB.webCarts = []; ch = true; }
    if (!DB.wishlists) { DB.wishlists = { 'CLI-0001': ['PRD-004', 'PRD-007'] }; ch = true; }
    if (!DB.webEvents) { DB.webEvents = []; ch = true; }
    if (!DB.settings.holdMinutes) { DB.settings.holdMinutes = 30; ch = true; }
    if (ch) Store.save();
  }

  /* Suscriptor + consentimiento: mismo formato que Marketing (crecimiento.js: DB.subscribers / DB.consents) */
  function upsertSubscriber(o) {
    if (!DB.subscribers) DB.subscribers = [];
    let sb = DB.subscribers.find(x => (x.email || '').toLowerCase() === o.email);
    const isNew = !sb;
    if (!sb) { sb = { id: nextId(DB.subscribers, 'SUB-', 4), name: o.name || '', email: o.email, phone: o.phone || '', country: o.country || '', interest: o.interest || 'General', source: o.source, createdAt: nowStr() }; DB.subscribers.unshift(sb); }
    Object.assign(sb, { status: 'activo', lang: prefs.lang, clientId: o.clientId || sb.clientId || null, unsubscribedAt: null });
    if (DB.consents) {
      const key = 'subscriber:' + sb.id; let c = DB.consents.find(x => x.key === key && x.channel === 'email');
      if (!c) { c = { id: nextId(DB.consents, 'CNS-', 4), key, subjectType: 'subscriber', subjectId: sb.id, channel: 'email', history: [] }; DB.consents.push(c); }
      Object.assign(c, { status: 'otorgado', grantedAt: nowStr(), source: o.source + ' — casilla Ley 29733', evidence: 'Sitio web · IP 190.43.12.20 · texto política PDP-2026.1', policyVersion: 'PDP-2026.1', revokedAt: null, revokeSource: '', revokeCampaign: null });
      c.history.push({ ts: nowStr(), u: 'Web', m: 'Consentimiento otorgado · ' + o.source });
    }
    Store.save(); Audit.log('Suscriptor', sb.id, isNew ? 'crear' : 'reactivar', '', 'activo · consentimiento PDP-2026.1 · ' + o.source);
    return { sb, isNew };
  }
  function unsubscribe(email) {
    const sb = (DB.subscribers || []).find(x => (x.email || '').toLowerCase() === email); if (!sb) return;
    sb.status = 'baja'; sb.unsubscribedAt = nowStr();
    const c = (DB.consents || []).find(x => x.key === 'subscriber:' + sb.id && x.channel === 'email'); if (c) { c.status = 'revocado'; c.revokedAt = nowStr(); c.revokeSource = 'Mi cuenta (sitio web)'; c.history.push({ ts: nowStr(), u: 'Web', m: 'Baja (opt-out) · Mi cuenta' }); }
    Store.save(); Audit.log('Suscriptor', sb.id, 'baja', 'activo', 'baja · Mi cuenta');
  }

  /* ---------------- Catálogo público: precios y disponibilidad ---------------- */
  const vig = (p, d) => (p.rates || []).filter(r => r.status === 'vigente' && r.validFrom <= d && r.validTo >= d);
  /* Tarifa pública por fecha: canal E-commerce (precio web) o Directo; ajustada por el factor de la temporada de la fecha */
  function rateOn(p, d, seg) {
    const rs = vig(p, d); const segs = seg === 'chd' ? ['Niño'] : ['Adulto', 'Pasajero'];
    const pick = (ch) => rs.find(r => r.channel === ch && segs.includes(r.segment));
    const r = pick('E-commerce') || pick('Directo'); if (!r) return null;
    const base = DB.seasons.find(s => s.id === r.season); const s = Pricing.seasonFor(d);
    const f = (s ? s.factor : 1) / (base && base.status === 'activa' ? base.factor : 1);
    const dir = pick('Directo');
    return { rate: r, price: rnd1(r.price * f), cur: r.currency, season: s, factor: f, cost: r.cost * f, list: dir && dir !== r ? rnd1(dir.price * f) : null };
  }
  const siteProducts = () => DB.products.filter(p => p.status === 'ACTIVE' && p.flags && p.flags.ecommerce && (p.rates || []).some(r => r.status === 'vigente'));
  const slugOf = (p) => (p.seo && p.seo.slug) || p.id.toLowerCase();
  const bySlug = (s) => siteProducts().find(p => slugOf(p) === s || p.id === s);
  const kindOf = (p) => ['PAQUETE', 'CIRCUITO', 'PROGRAMA TURÍSTICO'].includes(p.type) ? 'paquetes' : ['EXPERIENCIA', 'ACTIVIDAD'].includes(p.type) ? 'experiencias' : p.type === 'TRASLADO' ? 'traslados' : 'tours';
  const durDays = (p) => p.durationUnit === 'días' ? p.durationValue : 1;
  const durLbl = (p) => p.durationUnit === 'días' ? (EN() ? p.durationValue + ' days / ' + (p.durationValue - 1) + ' nights' : p.durationValue + ' días / ' + (p.durationValue - 1) + ' noches') : p.durationValue + (p.durationValue === 1 ? (EN() ? ' hour' : ' hora') : (EN() ? ' hours' : ' horas'));
  const hasDeps = (p) => (p.departures || []).length > 0;
  /* Cupos de salidas con bloqueos activos (formato compartido con catalogo.js; los holds del sitio llevan además productId/date para BE.heldOn) */
  const activeHeld = (depId, exceptRef) => sum((DB.catalogHolds || []).filter(h => h.depId === depId && h.status === 'hold' && h.expiresAt > nowStr() && h.ref !== exceptRef), 'qty');
  const depFree = (d, exceptRef) => Math.max(0, d.capacity - d.sold - activeHeld(d.id, exceptRef));
  const guaranteed = (p, d) => d.sold >= Math.max(p.minPax || 1, 4);
  /* Disponibilidad de un día: SIEMPRE BE.dayStatus (rangos, cutoff, días de operación, cupos y holds).
     Productos sin rangos ni salidas (servicio diario a pedido) → 'sin_configurar' = a solicitud dentro de la ventana de venta. */
  const ST_LBL = { disponible: 'Disponible', cerrado: 'Ocupado / cerrado', agotado: 'Agotado', sin_cupo: 'Sin cupo suficiente', fuera_de_plazo: 'Fuera de plazo', no_opera: 'No opera', pasado: 'Fecha pasada', sin_configurar: 'A solicitud' };
  function dayInfo(p, d, pax) {
    pax = pax || 1; const dd = daysFromToday(d);
    const r = rateOn(p, d, 'adt');
    const st = BE.dayStatus(p, d, pax);
    const base = { st, status: st.status, r, free: st.left, dep: st.departure || (p.departures || []).find(x => x.date === d && x.status !== 'cancelada') || null };
    if (!r) return Object.assign(base, { ok: false, why: 'Tarifa por publicar', status: 'sin_tarifa' });
    if (dd > p.advMax) return Object.assign(base, { ok: false, why: 'Fuera del rango de venta', status: 'fuera_de_plazo' });
    if (st.status === 'sin_configurar') {
      if (dd < p.advMin) return Object.assign(base, { ok: false, why: 'Requiere ' + p.advMin + ' días de anticipación', status: 'fuera_de_plazo' });
      return Object.assign(base, { ok: true, onRequest: true, why: '' });
    }
    return Object.assign(base, { ok: st.status === 'disponible', why: st.status === 'disponible' ? '' : (st.label || ST_LBL[st.status]) + (st.note ? ' · ' + st.note : '') });
  }
  const nextOk = (p, pax) => { if (p.availability || hasDeps(p)) { const d = BE.nextAvailable(p, pax || 1); return d && dayInfo(p, d, pax).ok ? d : null; } return Array.from({ length: 120 }, (_, i) => addDays(T(), i)).find(d => dayInfo(p, d, pax).ok) || null; };
  let memo = {};
  function fromPrice(p) {
    if (memo[p.id]) return memo[p.id];
    let best = null;
    const dates = hasDeps(p) && !p.availability ? p.departures.map(d => d.date) : Array.from({ length: 150 }, (_, i) => addDays(T(), i));
    dates.forEach(d => { const di = dayInfo(p, d, 1); if (di.ok && (!best || di.r.price < best.price)) best = { price: di.r.price, cur: di.r.cur, list: di.r.list, date: d }; });
    if (!best) { const r = rateOn(p, addDays(T(), Math.max(p.advMin, 7)), 'adt'); if (r) best = { price: r.price, cur: r.cur, list: r.list, date: null }; }
    /* El importe mostrado lo calcula el motor (BE.quote) para la fecha más económica: misma cifra que el checkout */
    if (best && best.date) { const q = BE.quote(p, { date: best.date, pax: { adt: 1, chd: 0, inf: 0 }, currency: best.cur, channel: 'E-commerce' }); const l = q.lines.find(x => x.key === 'base-adt'); if (l) best.price = rnd2(l.unit); }
    return (memo[p.id] = best);
  }
  const activePromos = (p) => (p.promotions || []).filter(x => x.status === 'activa' && x.from <= T() && x.to >= T() && ['E-commerce', 'Todos'].includes(x.channel));
  function salesCount(pid) { return sum(DB.reservations.filter(r => r.status !== 'cancelada'), r => sum(r.services.filter(s => s.productId === pid), () => r.passengers.length)) + sum(DB.ecomOrders.filter(o => o.product === pid && o.status === 'confirmado'), 'pax'); }
  function freeCancel(p) { const m = /Sin penalidad hasta (\d+)\s*(días|h)/i.exec((p.policies && p.policies.cancel) || ''); return m ? (EN() ? 'Free cancellation up to ' + m[1] + (m[2] === 'h' ? ' h' : ' days') + ' before' : 'Cancelación gratis hasta ' + m[1] + ' ' + m[2] + ' antes') : ''; }
  function flags(p) {
    const out = []; const top = siteProducts().map(x => [x.id, salesCount(x.id)]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
    if (top.includes(p.id)) out.push(['sun', t('best')]);
    const fp = fromPrice(p); if (activePromos(p).length || (fp && fp.list)) out.push(['ok', t('offer')]);
    if (freeCancel(p)) out.push(['', t('free')]);
    return out;
  }
  const diffOf = (p) => EN() ? px(p).diffEn : px(p).diff;
  const langsOf = (p) => px(p).langs;
  const destSubtree = (id) => { const ids = new Set([id]); let grow = true; while (grow) { grow = false; DB.destinations.forEach(d => { if (d.parent && ids.has(d.parent) && !ids.has(d.id)) { ids.add(d.id); grow = true; } }); } return ids; };
  const prodsInDest = (id) => { const set = destSubtree(id); return siteProducts().filter(p => set.has(p.destId) || (p.secondary || []).some(s => set.has(s))); };
  const destOfProduct = (p) => DEST.find(d => destSubtree(d.id).has(p.destId)) || DEST[0];
  const destName = (d) => EN() ? d.en : d.name;

  /* ---------------- Imágenes (SVG propias, sin recursos externos) ---------------- */
  const PATHS = [
    ['M0 140 L0 96 L42 64 L78 88 L128 32 L172 82 L214 56 L258 92 L296 70 L320 82 L320 200 L0 200Z', 'M0 200 L0 138 L58 114 L112 140 L172 108 L232 146 L282 120 L320 134 L320 200Z', 'M118 42 L128 32 L140 46 L132 44 L126 50Z'],
    ['M0 150 L0 110 L60 70 L100 96 L150 50 L196 94 L240 60 L290 100 L320 86 L320 200 L0 200Z', 'M0 200 L0 150 L70 128 L130 150 L200 122 L260 152 L320 136 L320 200Z', 'M142 58 L150 50 L160 62 L152 60 L147 66Z'],
    ['M0 130 L0 104 L30 90 L70 110 L110 74 L150 104 L200 60 L240 98 L280 84 L320 100 L320 200 L0 200Z', 'M0 200 L0 160 L50 146 L120 162 L180 140 L250 166 L320 150 L320 200Z', 'M192 68 L200 60 L210 72 L202 70 L197 76Z']
  ];
  function art(hue, v, cap) {
    v = v || 0; const h = (hue || 190) % 360; const k = v % 3;
    return '<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="' + esc(cap || '') + '">' +
      '<rect width="320" height="200" fill="hsl(' + h + ' 42% ' + (30 + k * 4) + '%)"/><circle cx="' + (250 - k * 60) + '" cy="46" r="15" fill="rgba(255,255,255,.22)"/>' +
      '<path d="' + PATHS[k][0] + '" fill="hsl(' + h + ' 36% ' + (21 + k * 2) + '%)"/><path d="' + PATHS[k][2] + '" fill="rgba(255,255,255,.55)"/><path d="' + PATHS[k][1] + '" fill="hsl(' + h + ' 40% 13%)"/></svg>';
  }
  const imgBox = (hue, v, cap, extra) => '<div class="ws-img">' + art(hue, v, cap) + (extra || '') + (cap ? '<span class="cap">' + esc(cap) + '</span>' : '') + '</div>';
  const stars = (r) => { const n = Math.round(r); return '<span class="ws-stars" aria-label="' + fmtN(r, 1) + ' de 5">' + '★★★★★'.slice(0, n) + '<span class="off">' + '★★★★★'.slice(0, 5 - n) + '</span></span>'; };

  /* ---------------- Sesión del cliente, deseos, carrito ---------------- */
  const clientUser = () => (Auth.user && Auth.user.clientId) ? Auth.user : null;
  const myOrders = () => ls.get(LSK.orders, []);
  function wishList() { const u = clientUser(); if (u) return DB.wishlists[u.clientId] || []; return ls.get(LSK.wish, []); }
  function toggleWish(pid) {
    const u = clientUser(); const l = wishList().slice(); const i = l.indexOf(pid); if (i >= 0) l.splice(i, 1); else l.push(pid);
    if (u) { DB.wishlists[u.clientId] = l; Store.save(); } else ls.set(LSK.wish, l);
    track(i >= 0 ? 'remove_from_wishlist' : 'add_to_wishlist', { item_id: pid });
    UI.toast(i >= 0 ? 'Quitado de su lista de deseos.' : 'Guardado en su lista de deseos' + (u ? '.' : ' (en este navegador; inicie sesión para conservarlo).'), 'info');
    return i < 0;
  }
  function getCart(create) {
    const tok = ls.get(LSK.cart, null);
    let c = tok ? DB.webCarts.find(x => x.id === tok && x.status === 'activo') : null;
    if (!c && create) {
      c = { id: nextId(DB.webCarts, 'CART-', 5), clientId: clientUser() ? clientUser().clientId : null, items: [], promo: '', status: 'activo', createdAt: nowStr(), updatedAt: nowStr(), channel: 'Sitio web', lang: prefs.lang };
      DB.webCarts.unshift(c); ls.set(LSK.cart, c.id); Store.save();
    }
    return c;
  }
  const cartCount = () => { const c = getCart(false); return c ? c.items.length : 0; };
  const holdOf = (it) => it.holdId ? (DB.catalogHolds || []).find(h => h.id === it.holdId) : null;
  const holdLive = (it) => { const h = holdOf(it); return !!(h && h.status === 'hold' && it.holdUntil > nowMs()); };
  function expireHolds(c) {
    let n = 0; if (!c) return 0;
    c.items.forEach(it => { const h = holdOf(it); if (h && h.status === 'hold' && it.holdUntil <= nowMs()) { h.status = 'expirada'; n++; Audit.log('Disponibilidad', h.id, 'expirar_hold', 'hold', 'expirada · carrito ' + c.id); } });
    if (n) Store.save(); return n;
  }
  function createHold(c, it) {
    /* R-HOLD: bloqueo temporal de cupos. null = no aplica (regla apagada o producto sin control de cupos); false = sin cupos */
    const p = Q.product(it.pid); if (!p || !BE.on('R-HOLD', p)) return null;
    const seats = BE.validatePax(p, it.pax).seats; const di = dayInfo(p, it.date, seats);
    if (di.onRequest || di.free == null) return null;
    if (!di.ok) return false;
    const mins = BE.param('R-HOLD', 'minutes', p) || DB.settings.holdMinutes || 30;
    const h = { id: nextId(DB.catalogHolds, 'HLD-', 4), depId: di.dep ? di.dep.id : null, productId: p.id, date: it.date, qty: seats, ref: c.id, status: 'hold', createdAt: nowStr(), expiresAt: plusMin(nowStr(), mins), user: Auth.user ? Auth.user.id : 'Web', notes: 'Hold automático de carrito web (' + mins + ' min, R-HOLD)' };
    DB.catalogHolds.unshift(h); it.holdId = h.id; it.holdUntil = nowMs() + mins * 60000;
    Audit.log('Disponibilidad', h.id, 'hold', 'disponible', p.id + ' · ' + it.date + (h.depId ? ' · ' + h.depId : '') + ' · ' + seats + ' cupos · carrito ' + c.id + ' · expira ' + h.expiresAt.split(' ')[1]);
    return h;
  }
  function releaseHold(it, why) { const h = holdOf(it); if (h && h.status === 'hold') { h.status = 'liberada'; Audit.log('Disponibilidad', h.id, 'liberar_hold', 'hold', 'liberada · ' + why); } }

  /* ---------------- Selección → BookingEngine (fuente única de precio) ----------------
     Ítem de carrito: {key, pid, date, pax:{adt,chd,inf}, opts:{grupo:opción}, addons:[{id, by:{ADT,CHD,INF}}],
     lodging:[{legId, hotelId, rooms:[{type, qty}]}], noLodging, removed:[lineKey], holdId, holdUntil} */
  const perVehicle = (p) => p.type === 'TRASLADO' && p.modality === 'Privado';
  const addonQty = (it) => (it.addons || []).map(a => ({ id: a.id, qty: sum(Object.values(a.by || {}), v => +v || 0) })).filter(a => a.qty > 0);
  const optsOf = (p, it) => (p.config || []).map((g, i) => { const oi = it.opts && it.opts[i] != null ? it.opts[i] : Math.max(0, g.options.findIndex(o => o.delta === 0)); return { group: g.group, label: (g.options[oi] || g.options[0]).label }; });
  function selOf(it, cur, o) {
    const p = Q.product(it.pid); o = o || {};
    /* Traslado privado: se cotiza por vehículo (unidades = pax / capacidad), el grupo se valida aparte con BE.validatePax */
    const pax = perVehicle(p) ? { adt: Math.max(1, Math.ceil((it.pax.adt + it.pax.chd + it.pax.inf) / Math.max(1, p.maxPax))), chd: 0, inf: 0 } : it.pax;
    return { date: it.date, pax, options: optsOf(p, it), addons: BE.on('R-ADDONS', p) ? addonQty(it) : [], lodging: BE.on('R-LODGING', p) && !it.noLodging ? (it.lodging || []) : [],
      removed: BE.on('R-PREVIEW-REMOVE', p) ? (it.removed || []) : [], currency: cur || prefs.cur, promoPct: o.promoPct || 0, paymentMode: o.mode, paymentMethod: o.method === 'card' ? 'tarjeta' : o.method, channel: 'E-commerce' };
  }
  function promoFor(p, code) { if (!code || !BE.on('R-PROMO', p)) return null; return activePromos(p).find(x => x.code && x.code.toUpperCase() === String(code).toUpperCase()) || null; }
  function quoteItem(it, cur, o) {
    const p = Q.product(it.pid); o = o || {}; const pr = promoFor(p, o.promo);
    const q = BE.quote(p, selOf(it, cur, Object.assign({}, o, { promoPct: pr ? pr.value : 0 })));
    if (perVehicle(p)) q.lines.forEach(l => { if (l.key === 'base-adt') l.label = (EN() ? 'Private vehicle (up to ' : 'Vehículo privado (hasta ') + p.maxPax + ' pax)'; });
    q.promoLbl = pr ? (EN() ? 'Code ' : 'Código ') + pr.code : '';
    return q;
  }
  /* Errores de composición del grupo (BE.validatePax) + mínimo del producto */
  function paxErrors(p, pax) { const v = BE.validatePax(p, pax); const e = v.errors.slice(); if ((pax.adt + pax.chd) < (p.minPax || 1)) e.push((EN() ? 'Minimum ' : 'Mínimo ') + p.minPax + (EN() ? ' travelers for this product.' : ' viajeros que pagan asiento para este producto.')); return e; }
  const modesInter = (qs) => { let m = null; qs.forEach(q => { m = m ? m.filter(x => q.modes.includes(x)) : q.modes.slice(); }); return m && m.length ? m : ['total']; };
  function calcCart(c, cur, o) {
    cur = cur || prefs.cur; o = o || {};
    const lines = c.items.map(it => { normItem(it); const p = Q.product(it.pid); return p ? { it, p, q: quoteItem(it, cur, Object.assign({ promo: c.promo }, o)) } : null; }).filter(Boolean);
    const modes = modesInter(lines.map(x => x.q));
    const mode = modes.includes(o.mode) ? o.mode : modes[0];
    if (o.mode && mode !== o.mode) lines.forEach(x => { x.q = quoteItem(x.it, cur, Object.assign({ promo: c.promo }, o, { mode })); });
    const total = rnd2(sum(lines, x => x.q.total)), deposit = rnd2(sum(lines, x => x.q.deposit));
    const promoDisc = rnd2(sum(lines, x => x.q.promo || 0));
    const dues = lines.map(x => x.q.balanceDue).filter(Boolean).sort();
    return { cur, lines, modes, mode, total, deposit, balance: rnd2(total - deposit), balanceDue: dues[0] || null, holdHours: Math.min(...lines.map(x => x.q.holdHours || 999)), promoOk: c.promo ? lines.some(x => x.q.promoLbl) : null, promoDisc, depositPct: lines.length ? lines[0].q.depositPct : 100, ok: lines.every(x => x.q.ok) };
  }
  /* Compatibilidad con carritos antiguos (adt/chd/inf sueltos) */
  function normItem(it) { if (!it.pax) it.pax = { adt: it.adt || 1, chd: it.chd || 0, inf: it.inf || 0 }; if (!it.addons) it.addons = []; if (!it.lodging) it.lodging = []; if (!it.removed) it.removed = []; if (it.noLodging == null) it.noLodging = !it.lodging.length; return it; }

  /* ---------------- Analítica (eventos de embudo; en producción: GA4/GTM + tabla de eventos) ---------------- */
  function track(event, params) {
    DB.webEvents.unshift({ ts: nowStr(), event, params: params || {}, session: sessId(), clientId: clientUser() ? clientUser().clientId : null, lang: prefs.lang, currency: prefs.cur });
    if (DB.webEvents.length > 300) DB.webEvents.length = 300;
    Store.save();
  }
  let _sid = null; const sessId = () => _sid || (_sid = 'ws-' + Math.random().toString(36).slice(2, 8));

  /* ---------------- SEO por página ---------------- */
  const SEO0 = { title: document.title, desc: (document.querySelector('meta[name="description"]') || {}).content || '' };
  function setSEO(title, desc, ld) {
    document.title = title + ' | Andes Horizonte Travel';
    let m = document.querySelector('meta[name="description"]'); if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); }
    m.content = desc || '';
    let s = document.getElementById('ws-ld'); if (s) s.remove();
    if (ld) { s = document.createElement('script'); s.type = 'application/ld+json'; s.id = 'ws-ld'; s.textContent = JSON.stringify(ld); document.head.appendChild(s); }
    document.documentElement.lang = prefs.lang;
  }
  window.addEventListener('hashchange', () => {
    const h = location.hash.replace(/^#\/?/, '');
    if (!(h === 'sitio' || h.startsWith('sitio/'))) { document.title = SEO0.title; const m = document.querySelector('meta[name="description"]'); if (m) m.content = SEO0.desc; const s = document.getElementById('ws-ld'); if (s) s.remove(); document.documentElement.lang = 'es'; const c = document.getElementById('ws-chatw'); if (c) c.remove(); }
  });

  /* ---------------- Estilos del sitio ---------------- */
  (function css() {
    if (document.getElementById('css-sitio')) return;
    const s = document.createElement('style'); s.id = 'css-sitio';
    s.textContent = [
      '.ws{min-height:100vh;display:flex;flex-direction:column;background:var(--bg);overflow-x:clip}',
      '.ws-wrap{max-width:1200px;margin:0 auto;padding:0 20px;width:100%}',
      '@media (max-width:600px){.ws-wrap{padding:0 16px}}',
      '.ws-util{background:var(--side);color:rgba(255,255,255,.82);font-size:.75rem}',
      '.ws-util .ws-wrap{display:flex;gap:6px 16px;align-items:center;min-height:36px;flex-wrap:wrap;padding-top:4px;padding-bottom:4px}',
      '.ws-util span{display:inline-flex;align-items:center;gap:5px}.ws-util svg{width:14px;height:14px;opacity:.8}',
      '.ws-util .sel{user-select:all;-webkit-user-select:all;font-weight:600;color:#fff}',
      '.ws-util select{background:transparent;border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:6px;height:24px;font-size:.74rem;padding:0 4px;cursor:pointer}',
      '.ws-util select option{color:var(--fg);background:var(--surface)}',
      '.ws-util .sp{margin-left:auto;display:flex;gap:8px;align-items:center}',
      '@media (max-width:760px){.ws-util .hide-m{display:none}.ws-util .sp{margin-left:0}}',
      '.ws-head{background:var(--surface);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:40}',
      '.ws-head .ws-wrap{display:flex;align-items:center;gap:6px 14px;min-height:64px;flex-wrap:wrap;padding-top:8px}',
      '.ws-logo{display:flex;align-items:center;gap:10px;color:var(--fg);text-decoration:none;flex:none}.ws-logo:hover{text-decoration:none}',
      '.ws-logo .mk{width:38px;height:38px;border-radius:10px;background:var(--side);display:grid;place-items:center}',
      '.ws-logo .mk svg{width:22px;height:22px;color:var(--sun)}',
      '.ws-logo b{font-family:var(--f-display);font-size:1rem;display:block;line-height:1.1;font-weight:700}',
      '.ws-logo .sub{display:block;font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--fg-3)}',
      '.ws-nav{display:flex;gap:2px;order:3;flex-basis:100%;min-width:0;border-top:1px solid var(--line-2);padding:4px 0 6px;margin-left:-9px}',
      '.ws-nav a{padding:8px 9px;border-radius:8px;color:var(--fg-2);font-size:.84rem;font-weight:600;white-space:nowrap;text-decoration:none}',
      '.ws-nav a:hover{background:var(--surface-3);color:var(--fg);text-decoration:none}.ws-nav a.on{color:var(--accent);background:var(--accent-soft)}',
      '.ws-hact{display:flex;gap:8px;align-items:center;margin-left:auto}',
      '.ws-ib{position:relative;height:38px;min-width:38px;border-radius:10px;border:1px solid var(--line);background:var(--surface);display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px;color:var(--fg);cursor:pointer;font-size:.8rem;font-weight:600;text-decoration:none;white-space:nowrap}',
      '.ws-ib:hover{background:var(--surface-3);text-decoration:none}.ws-ib svg{width:18px;height:18px;flex:none}',
      '.ws-ib .n{position:absolute;top:-7px;right:-7px;min-width:19px;height:19px;border-radius:10px;background:var(--sun);color:var(--sun-fg);font-size:.66rem;display:grid;place-items:center;padding:0 5px;font-weight:700}',
      '.ws-ib.wa{background:var(--ok-soft);border-color:transparent;color:var(--ok)}',
      '.ws-burger{display:none!important}',
      '@media (max-width:980px){.ws-head .ws-wrap{flex-wrap:nowrap;padding-top:0}.ws-nav{display:none;margin-left:0;border-top:0;position:absolute;top:100%;left:0;right:0;flex-direction:column;background:var(--surface);border-bottom:1px solid var(--line);padding:8px 16px 14px;box-shadow:var(--shadow-m)}.ws-nav.open{display:flex}.ws-nav a{padding:11px 10px;font-size:.92rem}.ws-burger{display:inline-flex!important}}',
      '@media (max-width:700px){.ws-ib .lbl{display:none}.ws-ib{padding:0 9px}.ws-head .ws-wrap{gap:8px}.ws-logo .sub{display:none}.ws-hact .wa{display:none}}',
      '@media (max-width:480px){.ws-head .ws-wrap{gap:6px}.ws-logo{flex:1 1 auto;min-width:0;gap:8px}.ws-logo>span:last-child{min-width:0}.ws-logo b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.95rem}.ws-logo .mk{width:34px;height:34px}.ws-hact{gap:6px}.ws-ib{height:38px;min-width:38px;padding:0 8px}.ws-hact a[href="#/sitio/cuenta/deseos"]{display:none}.ws-util .ws-wrap{font-size:.72rem}.ws-util select{height:30px}}',
      '.ws-hero{background:var(--side);color:#fff;position:relative;overflow:hidden}',
      '.ws-hero svg.bg{position:absolute;left:0;right:0;bottom:0;width:100%;height:78%;pointer-events:none}',
      '.ws-hero .ws-wrap{position:relative;padding-top:60px;padding-bottom:64px}',
      '.ws-hero .k{font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;color:var(--sun);font-weight:700}',
      '.ws-hero h1{color:#fff;font-size:clamp(1.55rem,3.8vw,2.6rem);font-weight:750;max-width:780px;line-height:1.15;margin-top:10px}',
      '.ws-hero p.l{color:rgba(255,255,255,.82);max-width:640px;margin-top:12px;font-size:1rem}',
      '.ws-search{margin-top:28px;background:var(--surface);color:var(--fg);border-radius:14px;padding:14px;display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1.3fr) minmax(0,1fr) auto;gap:10px;box-shadow:var(--shadow-lg);max-width:920px;align-items:end}',
      '.ws-search .btn{height:40px;justify-content:center}.ws-search .input{height:40px}',
      '@media (max-width:760px){.ws-search{grid-template-columns:minmax(0,1fr)}}',
      '.ws-hero .ws-trust{display:flex;gap:8px 22px;flex-wrap:wrap;margin-top:22px;font-size:.8rem;color:rgba(255,255,255,.85)}.ws-hero .ws-trust span{display:inline-flex;gap:6px;align-items:center}.ws-hero .ws-trust svg{width:16px;height:16px;color:var(--sun)}',
      '.ws-announce{background:var(--sun-soft);color:var(--fg);font-size:.82rem;border-bottom:1px solid var(--line)}.ws-announce .ws-wrap{padding-top:8px;padding-bottom:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}',
      '.ws-sec{padding:44px 0}.ws-sec.alt{background:var(--surface);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.ws-sec.tight{padding:26px 0}',
      '.ws-sech{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:20px;flex-wrap:wrap}',
      '.ws-h2{font-size:clamp(1.2rem,2.4vw,1.5rem);font-weight:720}.ws-subt{color:var(--fg-2);margin-top:4px;font-size:.92rem}',
      '.ws-grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}',
      '.ws-grid.g3{grid-template-columns:repeat(3,minmax(0,1fr))}@media (max-width:980px){.ws-grid.g3{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:620px){.ws-grid.g3{grid-template-columns:minmax(0,1fr)}}',
      '.ws-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;box-shadow:var(--shadow);min-width:0;transition:box-shadow .15s}',
      '.ws-card:hover{box-shadow:var(--shadow-m)}',
      '.ws-img{position:relative;aspect-ratio:16/10;overflow:hidden;display:block;background:var(--side)}.ws-img svg{display:block;width:100%;height:100%}',
      '.ws-img .cap{position:absolute;left:10px;bottom:8px;color:#fff;font-size:.72rem;font-weight:600;text-shadow:0 1px 4px rgba(0,0,0,.5)}',
      '.ws-flags{position:absolute;top:10px;left:10px;display:flex;gap:5px;flex-wrap:wrap;max-width:78%}',
      '.ws-flag{background:var(--surface);color:var(--fg);font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:6px;white-space:nowrap}.ws-flag.sun{background:var(--sun);color:var(--sun-fg)}.ws-flag.ok{background:var(--ok);color:#fff}',
      '.ws-heart{position:absolute;top:8px;right:8px;width:34px;height:34px;border-radius:50%;border:0;background:var(--surface);color:var(--fg-2);display:grid;place-items:center;cursor:pointer;box-shadow:var(--shadow)}.ws-heart svg{width:18px;height:18px}.ws-heart.on{color:var(--bad)}.ws-heart.on svg{fill:currentColor}',
      '.ws-cb{padding:14px 16px 16px;display:flex;flex-direction:column;gap:7px;flex:1}',
      '.ws-cb .kd{font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-3);font-weight:700}',
      '.ws-cb h3{font-size:1rem;line-height:1.3}.ws-cb h3 a{color:var(--fg)}',
      '.ws-meta{display:flex;gap:4px 12px;flex-wrap:wrap;font-size:.76rem;color:var(--fg-2)}.ws-meta span{display:inline-flex;gap:4px;align-items:center}.ws-meta svg{width:14px;height:14px;color:var(--fg-3)}',
      '.ws-price{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;gap:8px;padding-top:10px;border-top:1px solid var(--line-2)}',
      '.ws-price .f{font-size:.7rem;color:var(--fg-3);display:block}.ws-price b{font-size:1.18rem;font-family:var(--f-display);font-weight:750}.ws-price s{color:var(--fg-3);font-size:.78rem;margin-right:4px}',
      '.ws-stars{color:var(--sun-2);letter-spacing:1px;font-size:.82rem}.ws-stars .off{color:var(--line)}',
      '.ws-avail{font-size:.74rem;color:var(--ok);font-weight:600}.ws-avail.warn{color:var(--warn)}',
      '.ws-dest{position:relative;border-radius:14px;overflow:hidden;display:block;color:#fff;min-height:190px;text-decoration:none;box-shadow:var(--shadow)}.ws-dest:hover{text-decoration:none;box-shadow:var(--shadow-m)}',
      '.ws-dest svg{position:absolute;inset:0;width:100%;height:100%}.ws-dest .in{position:relative;padding:16px;display:flex;flex-direction:column;justify-content:flex-end;min-height:190px;height:100%;background:linear-gradient(180deg,transparent 30%,rgba(0,0,0,.45))}',
      '.ws-dest b{font-family:var(--f-display);font-size:1.15rem}.ws-dest span{font-size:.78rem;opacity:.9}',
      '.ws-why{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}@media (max-width:900px){.ws-why{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:520px){.ws-why{grid-template-columns:minmax(0,1fr)}}',
      '.ws-why .it{display:flex;gap:12px;align-items:flex-start}.ws-why .ib{width:42px;height:42px;border-radius:12px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;flex:none}.ws-why .ib svg{width:22px;height:22px}.ws-why b{display:block;margin-bottom:3px}.ws-why p{font-size:.84rem;color:var(--fg-2)}',
      '.ws-rev{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:8px;min-width:0}.ws-rev p{font-size:.88rem}.ws-rev .who{font-size:.76rem;color:var(--fg-3)}',
      '.ws-ver{display:inline-flex;gap:4px;align-items:center;font-size:.68rem;font-weight:700;color:var(--ok);background:var(--ok-soft);border-radius:6px;padding:1px 6px;white-space:nowrap}',
      '.ws-reply{border-left:3px solid var(--accent);background:var(--surface-2);border-radius:0 8px 8px 0;padding:8px 10px}',
      '.ws-orf{display:flex;flex-wrap:wrap;gap:6px}',
      '.ws-ownsum{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,220px);gap:18px;align-items:center}.ws-ownsum .big{font-size:2.2rem;font-weight:750;line-height:1}.ws-ownsum .bars,.ws-ownsum .subs{display:flex;flex-direction:column;gap:5px;min-width:0}',
      '@media (max-width:720px){.ws-ownsum{grid-template-columns:1fr}}',
      '.ws-demo{display:inline-flex;gap:6px;align-items:center;font-size:.72rem;font-weight:700;color:var(--warn);background:var(--warn-soft);border-radius:6px;padding:3px 8px}',
      '.ws-news{background:var(--side);color:#fff;border-radius:16px;padding:26px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:22px;align-items:center}',
      '.ws-news h2{color:#fff}.ws-news p{color:rgba(255,255,255,.8);font-size:.9rem}.ws-news .row .input{flex:1 1 200px}.ws-news label.check{color:rgba(255,255,255,.85);font-size:.76rem;align-items:flex-start}.ws-news label.check a{color:var(--sun)}',
      '@media (max-width:820px){.ws-news{grid-template-columns:minmax(0,1fr);padding:20px}}',
      '.ws-deps{display:grid;gap:10px}.ws-dep{display:grid;grid-template-columns:86px minmax(0,1fr) 170px auto;gap:14px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px}',
      '.ws-dep .d{text-align:center;border-right:1px solid var(--line-2);padding-right:10px}.ws-dep .d b{display:block;font-size:1.3rem;font-family:var(--f-display);line-height:1}.ws-dep .d span{font-size:.7rem;text-transform:uppercase;color:var(--fg-3);font-weight:700}',
      '@media (max-width:760px){.ws-dep{grid-template-columns:64px minmax(0,1fr)}.ws-dep .c3,.ws-dep .c4{grid-column:1/-1}}',
      '.ws-cd{font-variant-numeric:tabular-nums;font-weight:700;color:var(--bad)}',
      '.ws-guar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}@media (max-width:900px){.ws-guar{grid-template-columns:minmax(0,1fr)}}',
      '.ws-guar .it{border:1px solid var(--line);border-radius:12px;padding:14px;display:flex;gap:10px;align-items:flex-start;background:var(--surface)}.ws-guar svg{width:20px;height:20px;color:var(--accent);flex:none}.ws-guar p{font-size:.8rem;color:var(--fg-2)}',
      '.ws-crumbs{font-size:.78rem;color:var(--fg-3);display:flex;gap:6px;flex-wrap:wrap;padding:14px 0 6px}.ws-crumbs a{color:var(--fg-2)}',
      '.ws-page-h{padding-top:6px;padding-bottom:18px}.ws-page-h h1{font-size:clamp(1.35rem,3vw,1.9rem);font-weight:750}.ws-page-h p{color:var(--fg-2);margin-top:6px;max-width:820px}',
      '.ws-list{display:grid;grid-template-columns:260px minmax(0,1fr);gap:22px;align-items:start;padding-bottom:40px}',
      '.ws-filters{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:12px;position:sticky;top:84px}',
      '.ws-filters .field label{font-size:.72rem}.ws-fbtn{display:none!important}',
      '@media (max-width:900px){.ws-list{grid-template-columns:minmax(0,1fr)}.ws-filters{display:none;position:static}.ws-filters.open{display:flex}.ws-fbtn{display:inline-flex!important}}',
      '.ws-lbar{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}',
      '.ws-chips{display:flex;gap:6px;flex-wrap:wrap}.ws-chip{border:1px solid var(--line);background:var(--surface);border-radius:20px;padding:5px 12px;font-size:.8rem;cursor:pointer;color:var(--fg-2);font-weight:600}.ws-chip.on{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}',
      '.ws-pd{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:26px;align-items:start;padding-bottom:60px}',
      '.ws-book{position:sticky;top:84px;background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow-m);overflow:hidden}',
      '.ws-book .hd{padding:14px 16px;border-bottom:1px solid var(--line-2)}.ws-book .bd{padding:14px 16px;display:flex;flex-direction:column;gap:12px}',
      '@media (max-width:980px){.ws-pd{grid-template-columns:minmax(0,1fr)}.ws-book{position:static}}',
      '.ws-gal{display:grid;grid-template-columns:2fr 1fr;grid-template-rows:1fr 1fr;gap:8px;border-radius:14px;overflow:hidden;height:380px}',
      '.ws-gal .ws-img{aspect-ratio:auto;height:100%}.ws-gal .ws-img:first-child{grid-row:span 2}',
      '@media (max-width:700px){.ws-gal{grid-template-columns:1fr 1fr;grid-template-rows:200px 96px;height:auto}.ws-gal .ws-img:first-child{grid-column:span 2;grid-row:auto}}',
      '.ws-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}@media (max-width:700px){.ws-facts{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '.ws-fact{display:flex;gap:9px;align-items:flex-start;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px}.ws-fact svg{width:18px;height:18px;color:var(--accent);flex:none;margin-top:2px}.ws-fact small{display:block;font-size:.68rem;color:var(--fg-3);text-transform:uppercase;letter-spacing:.06em;font-weight:700}.ws-fact b{font-size:.84rem;font-weight:600}',
      '.ws-block{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px}.ws-block h2{font-size:1.08rem;margin-bottom:12px}',
      '.ws-itin{display:grid;gap:12px}.ws-day-h{display:flex;gap:10px;align-items:center}.ws-day-h .n{width:30px;height:30px;border-radius:50%;background:var(--accent);color:var(--accent-fg);display:grid;place-items:center;font-weight:700;font-size:.8rem;flex:none}',
      '.ws-day-i{margin:6px 0 0 14px;border-left:2px solid var(--line-2);padding-left:22px;display:grid;gap:6px}.ws-day-i div{font-size:.86rem}.ws-day-i .tm{font-family:var(--f-mono);font-size:.76rem;color:var(--fg-3);margin-right:8px}',
      '.ws-ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}.ws-ul li{display:flex;gap:8px;font-size:.88rem;align-items:flex-start}.ws-ul svg{width:16px;height:16px;flex:none;margin-top:3px}.ws-ul.ok svg{color:var(--ok)}.ws-ul.no svg{color:var(--bad)}.ws-ul.inf svg{color:var(--accent)}',
      '.ws-cal-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}',
      '.ws-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.ws-cal .wd{font-size:.66rem;text-transform:uppercase;color:var(--fg-3);text-align:center;font-weight:700;padding:2px 0}',
      '.ws-day{border:1px solid var(--line);border-radius:8px;background:var(--surface);min-height:48px;padding:3px 1px;font-size:.78rem;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;color:var(--fg);min-width:0;overflow:hidden}',
      '.ws-day .p{font-size:.6rem;color:var(--fg-3);white-space:nowrap}.ws-day[disabled]{opacity:.38;cursor:default;background:var(--surface-2)}.ws-day.blank{visibility:hidden}',
      '.ws-day.s-alta{box-shadow:inset 0 -3px 0 var(--warn)}.ws-day.s-baja{box-shadow:inset 0 -3px 0 var(--ok)}.ws-day.s-esp{box-shadow:inset 0 -3px 0 var(--bad)}',
      '.ws-day.sel{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}.ws-day.sel .p{color:inherit}',
      '.ws-leg{display:flex;gap:4px 12px;flex-wrap:wrap;font-size:.7rem;color:var(--fg-3);margin-top:8px}.ws-leg i{display:inline-block;width:12px;height:3px;border-radius:2px;margin-right:4px;vertical-align:middle}',
      '.ws-qty{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:9px;overflow:hidden}.ws-qty button{width:32px;height:32px;border:0;background:var(--surface-2);cursor:pointer;font-size:1rem;color:var(--fg)}.ws-qty button:disabled{opacity:.4;cursor:default}.ws-qty b{min-width:32px;text-align:center}',
      '.ws-prow{display:flex;justify-content:space-between;align-items:center;gap:8px}.ws-prow small{display:block;font-size:.7rem;color:var(--fg-3)}',
      '.ws-opt{display:flex;gap:6px;flex-wrap:wrap}.ws-opt button{border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:5px 9px;font-size:.76rem;cursor:pointer;color:var(--fg)}.ws-opt button.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent);font-weight:700}',
      '.ws-sum{display:grid;gap:6px;font-size:.86rem}.ws-sum .l{display:flex;justify-content:space-between;gap:10px}.ws-sum .l span:last-child{font-variant-numeric:tabular-nums;white-space:nowrap}.ws-sum .tot{border-top:1px solid var(--line);padding-top:8px;font-weight:750;font-size:1.05rem}',
      '.ws-note{font-size:.72rem;color:var(--fg-3)}',
      '.ws-mbar{display:none}',
      '@media (max-width:980px){.ws-mbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:55;background:var(--surface);border-top:1px solid var(--line);padding:10px 16px;gap:10px;align-items:center;justify-content:space-between;box-shadow:var(--shadow-lg)}.ws.has-bar{padding-bottom:64px}.ws.has-bar .ws-chatbtn{bottom:78px}}',
      '.ws-cart{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:22px;align-items:start;padding-bottom:50px}@media (max-width:900px){.ws-cart{grid-template-columns:minmax(0,1fr)}}',
      '.ws-ci{display:grid;grid-template-columns:130px minmax(0,1fr) auto;gap:14px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px;align-items:start}.ws-ci .ws-img{border-radius:10px}',
      '@media (max-width:600px){.ws-ci{grid-template-columns:84px minmax(0,1fr)}.ws-ci .pr{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center}}',
      '.ws-hold{display:flex;gap:10px;align-items:center;background:var(--warn-soft);border-radius:10px;padding:10px 12px;font-size:.84rem}.ws-hold svg{width:18px;height:18px;color:var(--warn);flex:none}.ws-hold b{font-variant-numeric:tabular-nums}',
      '.ws-steps{margin-bottom:16px;overflow-x:auto}',
      '.ws-paym{display:grid;gap:8px}.ws-paym label{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:10px;padding:10px 12px;cursor:pointer;background:var(--surface)}.ws-paym label.on{border-color:var(--accent);background:var(--accent-soft)}.ws-paym input{margin-top:3px;accent-color:var(--accent)}.ws-paym small{display:block;color:var(--fg-3);font-size:.74rem}',
      '.ws-foot{background:var(--side);color:rgba(255,255,255,.75);margin-top:auto;font-size:.82rem}',
      '.ws-foot .cols{display:grid;grid-template-columns:1.4fr 1fr 1fr 1.2fr;gap:26px;padding:40px 0 26px}@media (max-width:900px){.ws-foot .cols{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:560px){.ws-foot .cols{grid-template-columns:minmax(0,1fr)}}',
      '.ws-foot h4{color:#fff;font-size:.8rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px}.ws-foot a{color:rgba(255,255,255,.8);display:block;padding:3px 0}.ws-foot a:hover{color:#fff}',
      '.ws-foot .pm{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.ws-foot .pm span{border:1px solid rgba(255,255,255,.25);border-radius:5px;padding:2px 7px;font-size:.7rem;color:#fff}',
      '.ws-foot .bot{border-top:1px solid rgba(255,255,255,.12);padding:14px 0 70px;display:flex;gap:8px 18px;flex-wrap:wrap;justify-content:space-between;font-size:.74rem;color:rgba(255,255,255,.6)}.ws-foot .bot a{display:inline;padding:0;color:rgba(255,255,255,.75)}',
      '.ws-foot .sel{user-select:all;-webkit-user-select:all;color:#fff;font-weight:600}',
      '.ws-lr{display:inline-flex!important;gap:8px;align-items:center;border:1px solid rgba(255,255,255,.3);border-radius:8px;padding:6px 10px!important;margin-top:8px}.ws-lr svg{width:16px;height:16px}',
      '.ws-chatbtn{position:fixed;right:18px;bottom:18px;z-index:60;height:50px;border-radius:25px;background:var(--accent);color:var(--accent-fg);border:0;display:flex;align-items:center;gap:8px;padding:0 18px 0 14px;box-shadow:var(--shadow-lg);cursor:pointer;font-weight:700;font-size:.86rem}.ws-chatbtn svg{width:20px;height:20px}',
      '@media (max-width:600px){.ws-chatbtn .lbl{display:none}.ws-chatbtn{padding:0;width:50px;justify-content:center}}',
      '.ws-chat{position:fixed;right:18px;bottom:80px;width:min(370px,calc(100vw - 32px));height:min(540px,calc(100vh - 110px));background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow-lg);z-index:61;display:flex;flex-direction:column;overflow:hidden}',
      '@media (max-width:600px){.ws-chat{right:16px}}',
      '.ws-chat .hd{background:var(--side);color:#fff;padding:12px 14px;display:flex;gap:10px;align-items:center}.ws-chat .hd b{display:block;font-size:.9rem}.ws-chat .hd span{font-size:.72rem;opacity:.8}.ws-chat .hd button{margin-left:auto;background:transparent;border:0;color:#fff;cursor:pointer}.ws-chat .hd svg{width:18px;height:18px}',
      '.ws-chat .bd{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:var(--surface-2)}',
      '.ws-msg{max-width:84%;padding:8px 11px;border-radius:12px;font-size:.84rem;line-height:1.4}.ws-msg.cliente{align-self:flex-end;background:var(--accent);color:var(--accent-fg);border-bottom-right-radius:4px}.ws-msg.agente{align-self:flex-start;background:var(--surface);border:1px solid var(--line);border-bottom-left-radius:4px}.ws-msg small{display:block;font-size:.66rem;opacity:.7;margin-top:3px}',
      '.ws-chat .ft{padding:10px;border-top:1px solid var(--line);display:flex;gap:8px}',
      '.ws-post{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:24px;max-width:820px}.ws-post h2{font-size:1.1rem;margin:18px 0 8px}.ws-post p{margin:8px 0;color:var(--fg-2)}.ws-post ul{padding-left:20px;color:var(--fg-2)}',
      '.ws-acc{display:grid;grid-template-columns:230px minmax(0,1fr);gap:20px;align-items:start;padding-bottom:50px}@media (max-width:860px){.ws-acc{grid-template-columns:minmax(0,1fr)}}',
      '.ws-accnav{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:8px;display:flex;flex-direction:column;gap:2px}.ws-accnav a{padding:9px 11px;border-radius:8px;color:var(--fg-2);font-weight:600;font-size:.86rem;display:flex;gap:8px;align-items:center}.ws-accnav a svg{width:16px;height:16px}.ws-accnav a.on{background:var(--accent-soft);color:var(--accent)}',
      '@media (max-width:860px){.ws-accnav{flex-direction:row;overflow-x:auto}.ws-accnav a{white-space:nowrap}}',
      '.ws-faq details{border-bottom:1px solid var(--line-2);padding:10px 0}.ws-faq summary{cursor:pointer;font-weight:600;font-size:.9rem}.ws-faq p{margin-top:6px;color:var(--fg-2);font-size:.86rem}',
      '.ws-season{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:3px}.ws-season div{text-align:center;font-size:.64rem;padding:6px 0;border-radius:6px;font-weight:700}',
      '.ws-season .alta{background:var(--warn-soft);color:var(--warn)}.ws-season .media{background:var(--info-soft);color:var(--info)}.ws-season .baja{background:var(--ok-soft);color:var(--ok)}.ws-season .reg{background:var(--surface-3);color:var(--fg-3)}',
      '@media (max-width:520px){.ws-season{grid-template-columns:repeat(6,minmax(0,1fr))}}',
      '.ws-map{border-radius:12px;overflow:hidden;border:1px solid var(--line);background:var(--surface-2)}.ws-map svg{display:block;width:100%;height:170px}',
      '.ws-2col{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:22px;align-items:start;padding-bottom:50px}@media (max-width:900px){.ws-2col{grid-template-columns:minmax(0,1fr)}}',
      '.ws-kv{display:grid;gap:8px}.ws-kv div{display:flex;gap:10px;align-items:flex-start;font-size:.88rem}.ws-kv svg{width:18px;height:18px;color:var(--accent);flex:none;margin-top:2px}',
      '.ws-doc-legal h2{font-size:1.02rem;margin:18px 0 6px}.ws-doc-legal p,.ws-doc-legal li{color:var(--fg-2);font-size:.9rem}.ws-doc-legal ul{padding-left:20px}',
      /* v2.1 · motor de reservas */
      '.ws-fxtop{background:var(--surface-2);border-bottom:1px solid var(--line)}.ws-fxtop .ws-note{margin:0;padding:5px 0}',
      '.ws-fx{margin:0;line-height:1.45}.ws-fxbar{display:flex;gap:8px;align-items:flex-start;font-size:.76rem;color:var(--fg-2);background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:8px 10px}.ws-fxbar svg{width:16px;height:16px;flex:none;color:var(--accent)}',
      '.ws-cfg{display:flex;flex-direction:column;gap:4px}.ws-cfgs{border-top:1px solid var(--line-2);padding-top:14px;margin-top:6px}.ws-cfgs:first-of-type{border-top:0;padding-top:0;margin-top:0}',
      '.ws-cfgs h3{display:flex;gap:9px;align-items:center;font-size:.95rem;margin-bottom:10px}.ws-cfgs h3 .n{width:24px;height:24px;border-radius:50%;background:var(--accent);color:var(--accent-fg);display:grid;place-items:center;font-size:.74rem;flex:none}',
      '#ws-calw{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:18px;align-items:start}@media (max-width:760px){#ws-calw{grid-template-columns:minmax(0,1fr)}}',
      '.ws-day.st-ok{box-shadow:inset 0 -3px 0 var(--ok)}.ws-day.sel{box-shadow:none}',
      '.ws-day[disabled].st-cerrado{opacity:1;background:var(--surface-3);color:var(--fg-3)}.ws-day.st-cerrado b{text-decoration:line-through}',
      '.ws-day[disabled].st-agotado{opacity:1;background:var(--bad-soft);color:var(--bad);border-color:transparent}',
      '.ws-day[disabled].st-sin_cupo{opacity:1;background:var(--warn-soft);color:var(--warn);border-color:transparent}',
      '.ws-day[disabled].st-fuera_de_plazo,.ws-day[disabled].st-no_opera,.ws-day[disabled].st-pasado{opacity:.4}.ws-day.st-no_opera{border-style:dashed}',
      '.ws-leg2{gap:6px 12px}.ws-leg2 span{display:inline-flex;align-items:center;gap:5px}',
      '.sw{display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid var(--line);flex:none;background:var(--surface)}.sw.st-ok{border-color:var(--ok);box-shadow:inset 0 -3px 0 var(--ok)}.sw.st-cerrado{background:var(--surface-3)}.sw.st-agotado{background:var(--bad-soft);border-color:var(--bad)}.sw.st-sin_cupo{background:var(--warn-soft);border-color:var(--warn)}.sw.st-fuera_de_plazo{opacity:.45}.sw.st-no_opera{border-style:dashed;opacity:.6}',
      '.ws-selday{display:flex;gap:9px;align-items:flex-start;border-radius:10px;padding:10px 12px;font-size:.84rem}.ws-selday.ok{background:var(--ok-soft)}.ws-selday.ok svg{color:var(--ok)}.ws-selday.bad{background:var(--bad-soft)}.ws-selday.bad svg{color:var(--bad)}',
      '.ws-next{display:flex;gap:6px 8px;align-items:center;flex-wrap:wrap;font-size:.82rem;margin-top:10px}',
      '.ws-ranges{list-style:none;margin:0;padding:0;display:grid;gap:6px}.ws-ranges li{display:grid;grid-template-columns:12px 92px minmax(0,1fr);gap:8px;align-items:start;font-size:.78rem}.ws-ranges li .sw{margin-top:3px}.ws-ranges span{color:var(--fg-2)}',
      '.ws-paxgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px 18px}.ws-paxgrid .ws-prow{border:1px solid var(--line-2);border-radius:10px;padding:8px 10px}',
      '.ws-rule{display:inline-flex;font-size:.72rem;font-weight:600;color:var(--fg-2);background:var(--surface-2);border:1px solid var(--line);border-radius:6px;padding:2px 8px}',
      '.ws-lodgopt,.ws-2opt{grid-template-columns:1fr 1fr}@media (max-width:520px){.ws-lodgopt,.ws-2opt{grid-template-columns:minmax(0,1fr)}}',
      '.ws-legs{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:12px}.ws-leg-c{border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--surface);min-width:0}',
      '.ws-rooms{display:grid;gap:6px;margin-top:10px}.ws-beds{display:flex;gap:6px 8px;align-items:center;flex-wrap:wrap;font-size:.78rem;margin-top:10px;padding:6px 8px;border-radius:8px}.ws-beds.ok{background:var(--ok-soft)}.ws-beds.bad{background:var(--bad-soft);color:var(--bad)}.ws-beds .btn{margin-left:auto}',
      '.ws-lodtot{display:flex;gap:4px 10px;align-items:center;flex-wrap:wrap;margin-top:12px;background:var(--accent-soft);border-radius:10px;padding:10px 12px}.ws-lodtot b{color:var(--accent)}',
      '.ws-addons{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px}.ws-addon{border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:0}.ws-addon.on{border-color:var(--accent);background:var(--accent-soft)}',
      '.ws-addq{display:grid;gap:6px;margin-top:8px}.ws-addq .btn{justify-self:end}.ws-qty.sm button{width:28px;height:28px}.ws-qty.sm b{min-width:26px;font-size:.84rem}',
      '.ws-paymodes{display:grid;gap:4px;border:1px dashed var(--line);border-radius:10px;padding:8px 10px}.ws-paymodes div{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}',
      '.ws-sum .l.rm{text-decoration:line-through;color:var(--fg-3)}.ws-sum .l.warn span{color:var(--warn)}',
      '.ws-side{position:sticky;top:84px}@media (max-width:900px){.ws-side{position:static}}',
      '.ws-ptbl td{vertical-align:top}.ws-ptbl tr.rm td:not(:last-child){text-decoration:line-through;color:var(--fg-3)}.ws-ptbl tr.tot td{border-top:1px solid var(--line)}',
      '@media (max-width:520px){.ws-ptbl th:nth-child(2),.ws-ptbl td:nth-child(2){display:none}.ws-ptbl .btn .t{display:none}.ws-ptbl td:first-child{min-width:150px}}',
      '.ws-later{display:flex;align-items:flex-start;background:var(--warn-soft);border-radius:10px;padding:10px 12px;margin-bottom:6px}',
      '.ws-2btn{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:6px}.ws-2btn .btn{justify-content:center;min-width:0;white-space:normal;line-height:1.2;text-align:center}',
      '.ws-srcs{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.ws-src{border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--surface);display:flex;flex-direction:column;gap:3px}'
    ].join('\n');
    document.head.appendChild(s);
  })();

  /* ---------------- Marco del sitio: cabecera, pie, chat ---------------- */
  const NAVI = [['destinos', '#/sitio/destinos'], ['tours', '#/sitio/tours'], ['paquetes', '#/sitio/paquetes'], ['experiencias', '#/sitio/experiencias'], ['ofertas', '#/sitio/ofertas'], ['medida', '#/sitio/a-medida'], ['blog', '#/sitio/blog'], ['nosotros', '#/sitio/nosotros'], ['contacto', '#/sitio/contacto']];
  const claimsHref = () => (Auth.user && ['customer', 'passenger'].includes(Auth.role)) ? '#/libro-reclamaciones' : '#/sitio/libro-reclamaciones';
  function header(active) {
    const u = clientUser(); const n = cartCount(); const banner = DB.cms.find(c => c.id === 'CMS-02' && c.status === 'publicado');
    const internal = Auth.user && !u;
    return '<div class="ws-util"><div class="ws-wrap"><span>' + ic('phoneCall') + 'WhatsApp <span class="sel">' + WA + '</span></span><span class="hide-m">' + ic('mail') + MAIL + '</span><span class="hide-m">' + ic('clock') + t('hours') + '</span>' +
      '<span class="sp"><label class="sr" style="display:inline-flex;gap:4px;align-items:center">' + ic('globe') + '<select data-c="lang" aria-label="' + t('lang') + '"><option value="es"' + (prefs.lang === 'es' ? ' selected' : '') + '>ES</option><option value="en"' + (prefs.lang === 'en' ? ' selected' : '') + '>EN</option></select></label>' +
      '<select data-c="cur" aria-label="' + t('currency') + '" title="' + (EN() ? 'Display currency' : 'Moneda de visualización') + '">' + curList().map(c => '<option value="' + c.code + '"' + (prefs.cur === c.code ? ' selected' : '') + '>' + c.code + ' ' + esc(c.symbol) + '</option>').join('') + '</select></span></div></div>' +
      (isRef() ? '<div class="ws-fxtop"><div class="ws-wrap">' + fxNote(true) + '</div></div>' : '') +
      (banner ? '<div class="ws-announce"><div class="ws-wrap"><span class="ws-flag sun">' + (EN() ? 'Online deal' : 'Precio web') + '</span><span>' + esc(banner.title.replace(/^Banner:\s*/, '')) + ' — ' + (EN() ? 'book online until Oct 31.' : 'reservando en línea hasta el 31 de octubre.') + '</span><a href="#/sitio/tour/laguna-humantay" style="font-weight:700">' + t('view') + '</a></div></div>' : '') +
      '<header class="ws-head"><div class="ws-wrap"><button class="ws-ib ws-burger" data-a="burger" aria-label="Menú">' + ic('menu') + '</button>' +
      '<a class="ws-logo" href="#/sitio"><span class="mk">' + ic('logo') + '</span><span><b>Andes Horizonte</b><span class="sub">Travel · Tour operator</span></span></a>' +
      '<nav class="ws-nav" id="ws-nav" aria-label="Principal">' + NAVI.map(([k, h]) => '<a href="' + h + '"' + (active === k ? ' class="on"' : '') + '>' + t(k) + '</a>').join('') + '</nav>' +
      '<div class="ws-hact"><a class="ws-ib wa" href="#/sitio/contacto" title="WhatsApp ' + WA + '">' + ic('msg') + '<span class="lbl">WhatsApp</span></a>' +
      '<a class="ws-ib" href="#/sitio/cuenta/deseos" title="' + t('wish') + '" aria-label="' + t('wish') + '">' + ic('heart') + (wishList().length ? '<span class="n">' + wishList().length + '</span>' : '') + '</a>' +
      '<a class="ws-ib" href="#/sitio/carrito" aria-label="' + t('cart') + '">' + ic('cart') + '<span class="lbl">' + t('cart') + '</span>' + (n ? '<span class="n" id="ws-cartn">' + n + '</span>' : '') + '</a>' +
      (internal ? '<a class="ws-ib" href="' + Access.ux().home + '" title="Volver al sistema">' + ic('dashboard') + '<span class="lbl">' + t('backoffice') + '</span></a>'
        : '<a class="ws-ib" href="#/sitio/cuenta">' + ic('user') + '<span class="lbl">' + (u ? esc(u.name.split(' ')[0]) : t('signin')) + '</span></a>') +
      '</div></div></header>';
  }
  function footer() {
    const tn = DB.tenant;
    return '<footer class="ws-foot"><div class="ws-wrap"><div class="cols">' +
      '<div><a class="ws-logo" href="#/sitio" style="color:#fff;display:flex;padding:0;margin-bottom:10px"><span class="mk">' + ic('logo') + '</span><span><b>Andes Horizonte Travel</b></span></a><p>' + t('footer_about') + '</p>' +
      '<div style="margin-top:10px">' + esc(tn.name) + '<br>RUC ' + esc(tn.ruc) + '</div><h4 style="margin-top:14px">' + t('f_social') + '</h4><div>Facebook: /andeshorizontetravel · Instagram: @andeshorizonte · TikTok: @andeshorizonte · YouTube: Andes Horizonte Travel</div></div>' +
      '<div><h4>' + t('f_company') + '</h4><a href="#/sitio/nosotros">' + t('nosotros') + '</a><a href="#/sitio/destinos">' + t('destinos') + '</a><a href="#/sitio/ofertas">' + t('ofertas') + '</a><a href="#/sitio/blog">' + t('blog') + '</a><a href="#/sitio/a-medida">' + t('medida') + '</a>' +
      '<h4 style="margin-top:14px">' + t('f_legal') + '</h4><a href="#/sitio/legal/terminos">' + t('terms') + '</a><a href="#/sitio/legal/privacidad">' + t('privacy') + '</a><a href="#/sitio/legal/cancelacion">' + t('cancel') + '</a><a href="#/sitio/legal/cookies">' + (EN() ? 'Cookie policy' : 'Política de cookies') + '</a></div>' +
      '<div><h4>' + t('f_help') + '</h4><a href="#/sitio/cuenta">' + t('account') + '</a><a href="#/sitio/cuenta/reserva">' + (EN() ? 'Manage my booking' : 'Gestionar mi reserva') + '</a><a href="#/sitio/contacto">' + t('contacto') + '</a><a href="#/sitio/legal/cancelacion">' + (EN() ? 'Changes and refunds' : 'Cambios y reembolsos') + '</a>' +
      '<a class="ws-lr" href="' + claimsHref() + '">' + ic('clipboard') + t('claims') + '</a></div>' +
      '<div><h4>' + t('f_contact') + '</h4><div>' + ic('pin').replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"') + ' Av. José Larco 1150, Of. 602, Miraflores, Lima</div><div style="margin-top:4px">Calle Plateros 348, Cusco · Av. Ejército 710, Yanahuara, Arequipa</div>' +
      '<div style="margin-top:8px">WhatsApp: <span class="sel">' + WA + '</span><br>' + (EN() ? 'Phone' : 'Teléfono') + ': <span class="sel">' + PHONE + '</span><br>' + (EN() ? 'Emergencies 24/7' : 'Emergencias 24/7') + ': <span class="sel">' + EMERG + '</span><br>' + MAIL + '</div>' +
      '<div style="margin-top:8px">' + t('hours') + '</div><h4 style="margin-top:14px">' + t('f_pay') + '</h4><div class="pm"><span>Visa</span><span>Mastercard</span><span>American Express</span><span>Diners Club</span><span>Yape</span><span>Plin</span><span>Transferencia BCP / Interbank</span></div></div>' +
      '</div><div class="bot"><span>© 2026 ' + esc(tn.name) + ' · ' + (EN() ? 'Charged in ' : 'Se cobra en ') + charges().join(EN() ? ' or ' : ' o ') + ' · ' + rateTxt('USD') + (isRef() ? ' · ' + rateTxt(prefs.cur) : '') + '</span><span>Prototipo de demostración · datos ficticios · <a href="#" data-a="events">' + (EN() ? 'Analytics events (demo)' : 'Eventos de analítica (demo)') + '</a></span></div></div></footer>';
  }
  function chatWidget() {
    const cid = ls.get(LSK.chat, null); const conv = cid && (DB.conversations || []).find(c => c.id === cid);
    const pub = conv ? conv.messages.filter(m => m.type !== 'note' && m.type !== 'event') : []; const reply = pub.length && !['contact', 'system'].includes(pub[pub.length - 1].from);
    return '<button class="ws-chatbtn" data-a="chat" aria-label="' + t('chat') + '">' + ic('msg') + '<span class="lbl">' + (reply ? (EN() ? 'New reply' : 'Nueva respuesta') : t('chat')) + '</span></button>';
  }
  function openChat() {
    let w = document.getElementById('ws-chatw'); if (w) { w.remove(); return; }
    w = document.createElement('div'); w.className = 'ws-chat'; w.id = 'ws-chatw'; document.body.appendChild(w);
    const draw = () => {
      const cid = ls.get(LSK.chat, null); const conv = cid && (DB.conversations || []).find(c => c.id === cid);
      w.innerHTML = '<div class="hd">' + ic('msg') + '<div><b>Andes Horizonte · ' + (EN() ? 'Online help' : 'Atención en línea') + '</b><span>' + (EN() ? 'Advisors Mon–Sat 8:00–20:00 · reply in minutes' : 'Asesores lun–sáb 8:00–20:00 · respondemos en minutos') + '</span></div><button data-x aria-label="Cerrar">' + ic('x') + '</button></div>' +
        (conv ? '<div class="bd" id="ws-chb">' + conv.messages.filter(m => m.type !== 'note' && m.type !== 'event').map(m => '<div class="ws-msg ' + (m.from === 'contact' ? 'cliente' : 'agente') + '">' + esc(m.text) + '<small>' + (m.from === 'contact' ? esc(convName(conv)) : m.from === 'system' ? (EN() ? 'Automatic reply' : 'Respuesta automática') : esc(Q.userName(m.from).split(' ')[0]) + ' · ' + (EN() ? 'Advisor' : 'Asesor')) + ' · ' + esc(String(m.ts).split(' ')[1] || m.ts) + '</small></div>').join('') + '</div><div class="ft"><input class="input" id="ws-chi" placeholder="' + (EN() ? 'Write a message…' : 'Escriba su mensaje…') + '" aria-label="Mensaje"><button class="btn primary" data-send>' + ic('send') + '</button></div>'
          : '<div class="bd"><div class="ws-msg agente">' + (EN() ? 'Hello, we are here to help you plan your trip. Leave us your details and your question.' : 'Hola, le ayudamos a planificar su viaje. Déjenos sus datos y su consulta.') + '</div>' +
          '<div class="form-grid" style="margin-top:6px"><div class="field c12"><label>Nombre <span class="req">*</span></label><input class="input" id="wc-n" value="' + esc(clientUser() ? clientUser().name : '') + '"></div><div class="field c12"><label>Email o WhatsApp <span class="req">*</span></label><input class="input" id="wc-e" value="' + esc(clientUser() ? clientUser().email : '') + '"></div><div class="field c12"><label>Consulta <span class="req">*</span></label><textarea class="input" id="wc-m" rows="3" placeholder="Ej.: ¿Hay cupos para Machu Picchu el 10 de octubre?"></textarea></div>' +
          '<div class="c12"><label class="check" style="font-size:.74rem;align-items:flex-start"><input type="checkbox" id="wc-ok"> Acepto el tratamiento de mis datos para atender esta consulta (Ley 29733). <a href="#/sitio/legal/privacidad">Política de privacidad</a></label></div><div class="c12"><button class="btn primary" data-start style="width:100%;justify-content:center">' + ic('send') + (EN() ? 'Start chat' : 'Iniciar conversación') + '</button></div></div></div>');
      w.querySelector('[data-x]').onclick = () => w.remove();
      const b = w.querySelector('#ws-chb'); if (b) b.scrollTop = b.scrollHeight;
      const st = w.querySelector('[data-start]');
      if (st) st.onclick = () => {
        const n = w.querySelector('#wc-n').value.trim(), e = w.querySelector('#wc-e').value.trim(), m = w.querySelector('#wc-m').value.trim();
        if (!n || !e || !m) { UI.toast('Complete nombre, contacto y consulta.', 'bad'); return; }
        if (!w.querySelector('#wc-ok').checked) { UI.toast('Debe aceptar el tratamiento de datos (Ley 29733) para iniciar el chat.', 'bad'); return; }
        const conv = newConversation('Web chat', { name: n, email: emailOk(e) ? e : '', phone: emailOk(e) ? '' : e }, m.slice(0, 70), m);
        ls.set(LSK.chat, conv.id); track('generate_lead', { method: 'web_chat', conversation: conv.id }); draw(); autoReply(conv, n, draw);
      };
      const sb = w.querySelector('[data-send]');
      if (sb) { const inp = w.querySelector('#ws-chi'); const send = () => { const v = inp.value.trim(); if (!v) return; const cid2 = ls.get(LSK.chat, null); const c = DB.conversations.find(x => x.id === cid2); c.messages.push({ from: 'contact', text: v, ts: nowStr(), type: 'msg' }); c.status = c.status === 'cerrada' ? 'abierta' : c.status; c.updatedAt = nowStr(); c.unread = (c.unread || 0) + 1; Store.save(); draw(); }; sb.onclick = send; inp.onkeydown = (e) => { if (e.key === 'Enter') send(); }; setTimeout(() => inp.focus(), 30); }
    };
    draw();
  }
  const convName = (c) => (c.contact && typeof c.contact === 'object') ? (c.contact.name || 'Cliente') : (c.contact || 'Cliente');
  /* Conversación del inbox omnicanal (formato compartido con el módulo Bandeja omnicanal) */
  function newConversation(channel, contact, subject, text) {
    if (!DB.conversations) DB.conversations = [];
    const u = clientUser();
    const cli = u ? Q.client(u.clientId) : DB.clients.find(c => contact.email && (c.email || '').toLowerCase() === contact.email.toLowerCase());
    const sla = channel === 'Web chat' ? 15 : 120; const ts = nowStr();
    const conv = { id: nextId(DB.conversations, 'CNV-', 4), channel, contact: { name: contact.name, email: contact.email || '', phone: contact.phone || '' }, subject, status: 'abierta', assignee: null, messages: [{ from: 'contact', text, ts, type: 'msg' }], createdAt: ts, clientId: cli ? cli.id : null, leadId: null, resId: null, quoteId: null, priority: 'media', tags: ['Web', channel === 'Web chat' ? 'Chat' : 'Formulario'], slaDueAt: plusMin(ts, sla), firstResponseAt: null, ticketId: null, unread: 1, source: 'Sitio web', lang: prefs.lang };
    DB.conversations.unshift(conv); Store.save();
    Audit.log('Conversación', conv.id, 'crear', '', channel + ' · ' + (contact.email || contact.phone || ''));
    Notify.push('inbox.nueva', 'Portal', 'U03', 'Nueva conversación ' + channel + ': ' + subject);
    return conv;
  }
  function autoReply(conv, name, redraw) {
    setTimeout(() => {
      conv.messages.push({ from: 'system', type: 'msg', text: 'Hola ' + name.split(' ')[0] + ', gracias por escribirnos. Su consulta ' + conv.id + ' ya está en nuestra bandeja; un asesor de viajes le responderá por este chat en unos minutos (lun–sáb 8:00–20:00). Fuera de horario le escribiremos al contacto indicado.', ts: nowStr(), auto: true });
      Store.save(); if (document.getElementById('ws-chatw') && redraw) redraw();
    }, 900);
  }

  /* ---------------- Enrutador del sitio ---------------- */
  let H = {}, C = {};
  const on = (k, f) => { H[k] = f; }, onc = (k, f) => { C[k] = f; };
  const query = () => { const q = (location.hash.split('?')[1] || ''); const o = {}; q.split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); o[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' ')); }); return o; };
  const qs = (o) => Object.entries(o).filter(([, v]) => v !== '' && v != null).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');

  App.register('sitio', (el, params) => {
    ensureSeed(); curFix(); memo = {}; H = {}; C = {};
    const segs = params.map(s => s.split('?')[0]).filter(Boolean);
    const [a, b, c] = segs;
    expireHolds(getCart(false));
    let pg;
    switch (a || '') {
      case '': case 'inicio': pg = pHome(); break;
      case 'destinos': pg = b ? pDestino(b) : pDestinos(); break;
      case 'tours': case 'paquetes': case 'experiencias': case 'traslados': case 'buscar': pg = pList(a); break;
      case 'tour': pg = pProduct(b); break;
      case 'ofertas': pg = pOfertas(); break;
      case 'a-medida': pg = pMedida(); break;
      case 'blog': pg = b ? pPost(b) : pBlog(); break;
      case 'nosotros': pg = pNosotros(); break;
      case 'contacto': pg = pContacto(); break;
      case 'legal': pg = pLegal(b); break;
      case 'libro-reclamaciones': pg = pLibro(); break;
      case 'carrito': pg = pCart(); break;
      case 'checkout': pg = pCheckout(); break;
      case 'confirmacion': pg = pConfirm(b); break;
      case 'cuenta': pg = pCuenta(b, c); break;
      default: pg = { title: 'Página no encontrada', desc: '', html: '<div class="ws-wrap ws-sec">' + UI.empty('La página solicitada no existe.', 'compass') + '<div class="center"><a class="btn primary" href="#/sitio">Ir al inicio</a></div></div>' };
    }
    el.innerHTML = '<div class="ws' + (pg.bar ? ' has-bar' : '') + '">' + header(pg.nav || '') + '<main>' + pg.html + '</main>' + footer() + chatWidget() + '</div>';
    bindFrame(el);
    if (pg.after) pg.after(el);
    setSEO(pg.title, pg.desc || (EN() ? 'Tours, packages and tailor-made trips in Peru.' : 'Tours, paquetes y viajes a medida por el Perú con Andes Horizonte Travel.'), pg.ld);
    track('page_view', { page: '/' + ['sitio'].concat(segs).join('/'), title: pg.title });
  });
  function bindFrame(el) {
    el.onclick = (e) => {
      const b = e.target.closest('[data-a]'); if (!b || !el.contains(b)) return;
      const k = b.dataset.a;
      if (k === 'burger') { el.querySelector('#ws-nav').classList.toggle('open'); return; }
      if (k === 'chat') { openChat(); return; }
      if (k === 'events') { e.preventDefault(); showEvents(); return; }
      if (k === 'wish') { e.preventDefault(); const onNow = toggleWish(b.dataset.id); b.classList.toggle('on', onNow); return; }
      if (H[k]) { e.preventDefault(); H[k](b, e); }
    };
    el.onchange = (e) => {
      const s = e.target.closest('[data-c]'); if (!s) return; const k = s.dataset.c;
      if (k === 'lang') { prefs.lang = s.value; savePrefs(); track('select_language', { lang: s.value }); App.render(); return; }
      if (k === 'cur') { prefs.cur = s.value; savePrefs(); track('select_currency', { currency: s.value }); App.render(); return; }
      if (C[k]) C[k](s, e);
    };
    el.oninput = (e) => { const s = e.target.closest('[data-i]'); if (s && C[s.dataset.i]) C[s.dataset.i](s, e); };
    el.onsubmit = (e) => e.preventDefault();
  }
  function showEvents() {
    const ev = DB.webEvents.slice(0, 60);
    UI.modal({ title: 'Eventos de analítica (demo)', size: 'lg', sub: 'Embudo e-commerce: view_item_list → view_item → add_to_cart → begin_checkout → add_payment_info → purchase. En producción se envían a GA4/GTM (con consentimiento) y a la tabla channel_web_events.', body: '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Hora</th><th>Evento</th><th>Parámetros</th></tr></thead><tbody>' + ev.map(x => '<tr><td class="mono small nowrap">' + esc(x.ts) + '</td><td><b class="small">' + esc(x.event) + '</b></td><td class="mono xs" style="word-break:break-all">' + esc(JSON.stringify(x.params)) + '</td></tr>').join('') + '</tbody></table></div>' });
  }

  /* ---------------- Piezas reutilizables ---------------- */
  function card(p) {
    const fp = fromPrice(p); const x = px(p); const fl = flags(p); const w = wishList().includes(p.id); const dests = Q.destName(p.destId);
    const nx = (hasDeps(p) || p.availability) ? nextOk(p, 1) : null;
    const avail = (hasDeps(p) || p.availability) ? (nx ? '<span class="ws-avail">' + ic('calendar').replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-2px"') + ' ' + (EN() ? 'Next date: ' : 'Próxima fecha: ') + dt(nx) + '</span>' : '<span class="ws-avail warn">' + (EN() ? 'Sold out — ask us' : 'Agotado — consúltenos') + '</span>') : '<span class="ws-avail">' + (EN() ? 'Daily · ' : 'Todos los días · ') + t('onreq') + '</span>';
    return '<article class="ws-card"><div style="position:relative"><a href="#/sitio/tour/' + slugOf(p) + '" class="ws-img" aria-label="' + esc(pName(p)) + '">' + art(p.hue, 0, x.gal[0]) + '<span class="ws-flags">' + fl.map(f => '<span class="ws-flag ' + f[0] + '">' + esc(f[1]) + '</span>').join('') + '</span></a><button class="ws-heart' + (w ? ' on' : '') + '" data-a="wish" data-id="' + p.id + '" aria-label="' + t('wish') + '">' + ic('heart') + '</button></div>' +
      '<div class="ws-cb">' +
      '<div class="kd">' + esc(dests) + ' · ' + esc(p.type.charAt(0) + p.type.slice(1).toLowerCase()) + '</div><h3><a href="#/sitio/tour/' + slugOf(p) + '">' + esc(pName(p)) + '</a></h3>' +
      (ownLine(p) || '<div class="row" style="gap:6px">' + stars(x.rating) + '<span class="xs faint">' + fmtN(x.rating, 1) + ' (' + x.reviews + ')</span></div>') +
      '<div class="ws-meta"><span>' + ic('clock') + durLbl(p) + '</span><span>' + ic('users') + (p.modality === 'Privado' ? t('priv') : t('shared')) + '</span><span>' + ic('globe') + langsOf(p).join(' · ') + '</span></div>' + avail +
      '<div class="ws-price"><div><span class="f">' + t('from') + '</span>' + (fp && fp.list ? '<s>' + pm0(fp.list, fp.cur) + '</s>' : '') + '<b>' + (fp ? pm0(fp.price, fp.cur) : '—') + '</b><span class="f">' + (p.modality === 'Privado' && p.type === 'TRASLADO' ? (EN() ? 'per vehicle' : 'por servicio') : t('pp')) + '</span></div><a class="btn sm primary" href="#/sitio/tour/' + slugOf(p) + '">' + t('view') + '</a></div></div></article>';
  }
  const crumbs = (arr) => '<div class="ws-wrap"><nav class="ws-crumbs" aria-label="Migas"><a href="#/sitio">' + (EN() ? 'Home' : 'Inicio') + '</a>' + arr.map(c => '<span>/</span>' + (c[1] ? '<a href="' + c[1] + '">' + esc(c[0]) + '</a>' : '<span>' + esc(c[0]) + '</span>')).join('') + '</nav></div>';
  const pageH = (title, sub) => '<div class="ws-wrap ws-page-h"><h1>' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>';
  function mdLite(s) {
    return String(s || '').split(/\n\n+/).map(b => { if (b.startsWith('## ')) { const [h, ...r] = b.split('\n'); return '<h2>' + esc(h.slice(3)) + '</h2>' + (r.length ? mdLite(r.join('\n')) : ''); } const ls2 = b.split('\n'); if (ls2.every(l => l.startsWith('- '))) return '<ul>' + ls2.map(l => '<li>' + esc(l.slice(2)) + '</li>').join('') + '</ul>'; return '<p>' + esc(b).replace(/\n/g, '<br>') + '</p>'; }).join('');
  }
  function upcomingDeps(limit) {
    const out = [];
    siteProducts().filter(hasDeps).forEach(p => p.departures.forEach(d => { const di = dayInfo(p, d.date, 1); if (di.ok && guaranteed(p, d)) out.push({ p, d, free: di.free, r: di.r }); }));
    return out.sort((x, y) => x.d.date < y.d.date ? -1 : 1).slice(0, limit || 6);
  }
  const depRow = (x) => { const dd = parseD(x.d.date); const pct = x.d.sold / x.d.capacity * 100; return '<div class="ws-dep"><div class="d"><span>' + (EN() ? MES_EN : MES_ES)[dd.getMonth()] + '</span><b>' + dd.getDate() + '</b><span>' + x.d.time + '</span></div><div><b class="small">' + esc(pName(x.p)) + '</b><div class="xs faint">' + (EN() ? 'Meeting: ' : 'Encuentro: ') + esc(x.d.meeting) + ' · <span class="ok" style="font-weight:700">' + t('guaranteed') + '</span></div></div><div class="c3"><div class="row between xs"><span>' + x.free + ' ' + t('seats') + ' ' + t('left') + '</span><span class="faint">' + x.d.sold + '/' + x.d.capacity + '</span></div>' + UI.progress(pct, pct >= 80 ? 'sun' : '') + '</div><div class="c4 row" style="gap:8px;justify-content:flex-end"><b>' + pm0(x.r.price, x.r.cur) + '</b><a class="btn sm primary" href="#/sitio/tour/' + slugOf(x.p) + '?fecha=' + x.d.date + '">' + t('book') + '</a></div></div>'; };
  const cd = (endStr) => '<span class="ws-cd" data-cd="' + parseD(endStr + ' 23:59').getTime() + '">—</span>';
  function offersList() {
    const out = [];
    siteProducts().forEach(p => {
      activePromos(p).filter(pr => pr.code && BE.on('R-PROMO', p)).forEach(pr => out.push({ p, kind: 'promo', title: pr.name, value: pr.value, code: pr.code, to: pr.to, desc: pr.code ? (EN() ? 'Use code ' : 'Use el código ') + pr.code + ' — ' + pr.value + '% off' : (EN() ? 'Automatic ' : 'Automático ') + pr.value + '% ' + (EN() ? 'for groups of 4+' : 'para grupos de 4 o más') }));
      (p.rates || []).filter(r => r.status === 'vigente' && r.channel === 'E-commerce' && r.validTo >= T()).forEach(r => { const dir = (p.rates || []).find(x => x.status === 'vigente' && x.channel === 'Directo' && x.segment === r.segment); out.push({ p, kind: 'web', title: EN() ? 'Online price' : 'Precio web', value: dir ? Math.round((1 - r.price / dir.price) * 100) : 0, to: r.validTo, price: r.price, list: dir ? dir.price : null, cur: r.currency, desc: (EN() ? 'Special online rate' : 'Tarifa especial comprando en línea') + (dir ? ' (' + (EN() ? 'regular ' : 'regular ') + pm(dir.price, r.currency) + ')' : '') }); });
    });
    return out.sort((x, y) => x.to < y.to ? -1 : 1);
  }
  const offerCard = (o) => '<article class="ws-card"><a class="ws-img" href="#/sitio/tour/' + slugOf(o.p) + '">' + art(o.p.hue, 1, px(o.p).gal[1]) + '<span class="ws-flags"><span class="ws-flag ok">−' + o.value + '%</span>' + (o.code ? '<span class="ws-flag sun">' + esc(o.code) + '</span>' : '') + '</span></a><div class="ws-cb"><div class="kd">' + esc(o.title) + '</div><h3><a href="#/sitio/tour/' + slugOf(o.p) + '">' + esc(pName(o.p)) + '</a></h3><p class="small muted">' + esc(o.desc) + '</p><div class="small">' + ic('clock').replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"') + ' ' + t('ends') + ' ' + cd(o.to) + '</div><div class="ws-price"><div>' + (o.list ? '<s>' + pm0(o.list, o.cur) + '</s>' : '') + '<b>' + (o.price ? pm0(o.price, o.cur) : pm0(fromPrice(o.p).price, fromPrice(o.p).cur)) + '</b><span class="f">' + t('pp') + '</span></div>' + (o.code ? '<button class="btn sm" data-a="copy" data-v="' + esc(o.code) + '">' + ic('copy') + (EN() ? 'Copy code' : 'Copiar código') + '</button>' : '<a class="btn sm primary" href="#/sitio/tour/' + slugOf(o.p) + '">' + t('view') + '</a>') + '</div></div></article>';
  const heroSvg = '<svg class="bg" viewBox="0 0 1440 360" preserveAspectRatio="none" aria-hidden="true"><path d="M0 360 L0 230 L120 170 L210 210 L330 90 L430 190 L520 140 L640 230 L760 110 L860 190 L960 130 L1080 220 L1200 120 L1320 200 L1440 150 L1440 360Z" fill="rgba(255,255,255,.06)"/><path d="M322 98 L330 90 L342 104 L334 101 L328 108Z M752 118 L760 110 L772 124 L764 121 L758 128Z M1192 128 L1200 120 L1212 134 L1204 131 L1198 138Z" fill="rgba(255,255,255,.28)"/><path d="M0 360 L0 290 L150 240 L260 280 L400 210 L540 280 L680 235 L820 290 L980 230 L1120 285 L1280 240 L1440 275 L1440 360Z" fill="rgba(255,255,255,.08)"/></svg>';

  /* ================= INICIO ================= */
  function pHome() {
    const prods = siteProducts(); const feat = prods.filter(p => p.flags.featured).concat(prods.filter(p => !p.flags.featured)).slice(0, 6);
    const deps = upcomingDeps(5); const offs = offersList().slice(0, 3);
    const destOpts = DEST.map(d => '<option value="' + d.slug + '">' + esc(destName(d)) + '</option>').join('');
    const html = '<section class="ws-hero">' + heroSvg + '<div class="ws-wrap"><div class="k">' + t('hero_k') + '</div><h1>' + t('hero_t') + '</h1><p class="l">' + t('hero_s') + '</p>' +
      '<form class="ws-search" id="ws-sf"><div class="field"><label for="sf-d">' + t('s_dest') + '</label><select class="input" id="sf-d"><option value="">' + t('s_any') + '</option>' + destOpts + '</select></div><div class="field"><label for="sf-f">' + t('s_date') + '</label><input class="input" type="date" id="sf-f" min="' + addDays(T(), 1) + '"></div><div class="field"><label for="sf-p">' + t('s_pax') + '</label><select class="input" id="sf-p">' + [1, 2, 3, 4, 5, 6, 8, 10].map(n => '<option' + (n === 2 ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div><button class="btn sun" type="button" data-a="search">' + ic('search') + t('s_btn') + '</button></form>' +
      '<div class="ws-trust"><span>' + ic('checkCircle') + t('instant') + '</span><span>' + ic('shield') + (EN() ? 'Secure payment' : 'Pago seguro') + '</span><span>' + ic('award') + (EN() ? 'Licensed guides' : 'Guías oficiales') + '</span><span>' + ic('phoneCall') + (EN() ? '24/7 assistance' : 'Asistencia 24/7') + '</span></div></div></section>' +
      '<section class="ws-sec"><div class="ws-wrap"><div class="ws-sech"><div><h2 class="ws-h2">' + t('f_dest') + '</h2><p class="ws-subt">' + t('f_dest_s') + '</p></div><a class="btn" href="#/sitio/destinos">' + t('all') + ic('arrowRight') + '</a></div><div class="ws-grid g3">' +
      DEST.slice(0, 6).map((d, i) => '<a class="ws-dest" href="#/sitio/destinos/' + d.slug + '">' + art(d.hue, i, '') + '<div class="in"><b>' + esc(destName(d)) + '</b><span>' + esc(EN() ? d.tagEn : d.tag) + ' · ' + prodsInDest(d.id).length + ' ' + (EN() ? 'experiences' : 'experiencias') + '</span></div></a>').join('') + '</div></div></section>' +
      '<section class="ws-sec alt"><div class="ws-wrap"><div class="ws-sech"><div><h2 class="ws-h2">' + t('f_pk') + '</h2><p class="ws-subt">' + t('f_pk_s') + '</p></div><a class="btn" href="#/sitio/buscar">' + t('all') + ic('arrowRight') + '</a></div><div class="ws-grid g3">' + feat.map(card).join('') + '</div></div></section>' +
      (offs.length ? '<section class="ws-sec"><div class="ws-wrap"><div class="ws-sech"><div><h2 class="ws-h2">' + t('offers_t') + '</h2><p class="ws-subt">' + t('offers_s') + '</p></div><a class="btn" href="#/sitio/ofertas">' + t('ofertas') + ic('arrowRight') + '</a></div><div class="ws-grid g3">' + offs.map(offerCard).join('') + '</div></div></section>' : '') +
      '<section class="ws-sec alt"><div class="ws-wrap"><div class="ws-sech"><div><h2 class="ws-h2">' + t('deps_t') + '</h2><p class="ws-subt">' + t('deps_s') + '</p></div></div><div class="ws-deps">' + (deps.length ? deps.map(depRow).join('') : UI.empty('Sin salidas garantizadas próximas.', 'calendar')) + '</div></div></section>' +
      '<section class="ws-sec"><div class="ws-wrap"><h2 class="ws-h2" style="margin-bottom:20px">' + t('why_t') + '</h2><div class="ws-why">' +
      [['compass', EN() ? 'Local operator' : 'Operador local', EN() ? 'Our own team in Cusco and Arequipa, not intermediaries.' : 'Equipo propio en Cusco y Arequipa, sin intermediarios.'], ['checkCircle', t('instant'), EN() ? 'Scheduled departures confirmed online with seats held for you.' : 'Salidas programadas confirmadas en línea con cupos bloqueados para usted.'], ['phoneCall', EN() ? 'Assistance 24/7' : 'Asistencia 24/7', EN() ? 'Emergency line during your whole trip.' : 'Línea de emergencia durante todo su viaje.'], ['heart', EN() ? 'Flexible booking' : 'Reserva flexible', EN() ? 'Pay a deposit and the balance later; free cancellation on many tours.' : 'Pague un anticipo y el saldo después; cancelación gratis en muchos tours.']].map(w => '<div class="it"><div class="ib">' + ic(w[0]) + '</div><div><b>' + esc(w[1]) + '</b><p>' + esc(w[2]) + '</p></div></div>').join('') + '</div></div></section>' +
      ownHome() +
      extReviewsBlock(null, true) +
      '<section class="ws-sec"><div class="ws-wrap"><h2 class="ws-h2" style="margin-bottom:16px">' + t('guar_t') + '</h2><div class="ws-guar">' + GUAR().map(g => '<div class="it">' + ic(g[0]) + '<div><b class="small">' + esc(g[1]) + '</b><p>' + esc(g[2]) + '</p></div></div>').join('') + '</div></div></section>' +
      '<section class="ws-sec tight" style="padding-bottom:50px"><div class="ws-wrap">' + newsletter() + '</div></section>';
    return { nav: '', html, title: EN() ? 'Tours and packages in Peru' : 'Tours y paquetes en Perú: Machu Picchu, Cusco y más', desc: EN() ? 'Tour operator in Peru: Machu Picchu, Cusco, Humantay and Paracas with instant confirmation.' : 'Operador turístico en Perú: Machu Picchu, Cusco, Laguna Humantay y Paracas con confirmación inmediata, guías oficiales y asistencia 24/7.',
      ld: { '@context': 'https://schema.org', '@type': 'TravelAgency', name: 'Andes Horizonte Travel', legalName: DB.tenant.name, taxID: DB.tenant.ruc, telephone: WA, email: MAIL, address: { '@type': 'PostalAddress', streetAddress: 'Av. José Larco 1150, Of. 602', addressLocality: 'Miraflores, Lima', addressCountry: 'PE' }, openingHours: 'Mo-Fr 09:00-19:00, Sa 09:00-13:00' },
      after: (el) => { bindNews(el); on('search', () => { const f = { destino: el.querySelector('#sf-d').value, fecha: el.querySelector('#sf-f').value, pax: el.querySelector('#sf-p').value }; track('search', f); App.go('#/sitio/buscar?' + qs(f)); }); on('copy', (b) => { UI.copy(b.dataset.v); }); } };
  }
  const GUAR = () => [
    ['award', EN() ? 'Registered travel agency' : 'Agencia registrada', EN() ? 'Registered with the regional tourism authority as a travel agency and tour operator.' : 'Inscrita ante la autoridad regional de turismo como agencia de viajes y operador turístico.'],
    ['users', EN() ? 'Licensed guides' : 'Guías oficiales colegiados', EN() ? 'All tours are led by licensed tour guides.' : 'Todos los tours son conducidos por guías oficiales de turismo con licencia vigente.'],
    ['shield', EN() ? 'Civil liability insurance' : 'Seguro de responsabilidad civil', EN() ? 'Coverage for the services we operate and travel assistance on selected programs.' : 'Cobertura en los servicios que operamos y asistencia en viaje en programas seleccionados.'],
    ['lock', EN() ? 'Secure payments' : 'Pagos seguros', EN() ? 'Encrypted checkout (TLS) with 3-D Secure; we never store card numbers.' : 'Checkout cifrado (TLS) con 3-D Secure; no almacenamos números de tarjeta.'],
    ['fileCheck', EN() ? 'Personal data protection' : 'Protección de datos personales', EN() ? 'Processing under Peruvian Law 29733 with ARCO rights.' : 'Tratamiento conforme a la Ley 29733 y su reglamento, con derechos ARCO.'],
    ['clipboard', EN() ? 'Complaints Book' : 'Libro de Reclamaciones', EN() ? 'Virtual complaints book available; response within 15 business days.' : 'Libro de Reclamaciones virtual; respuesta en un plazo máximo de 15 días hábiles.']
  ];
  function newsletter() {
    return '<div class="ws-news"><div><h2 class="ws-h2">' + t('news_t') + '</h2><p style="margin-top:6px">' + t('news_s') + '</p></div><form id="ws-nl" class="col" style="gap:10px"><div class="row" style="gap:8px"><input class="input" id="nl-name" placeholder="' + (EN() ? 'Name' : 'Nombre') + '" aria-label="Nombre" style="flex:1 1 140px"><input class="input" id="nl-mail" type="email" placeholder="' + (EN() ? 'Email' : 'Correo electrónico') + '" aria-label="Correo" style="flex:2 1 200px"><button class="btn sun" type="button" data-a="news">' + t('news_btn') + '</button></div>' +
      '<label class="check"><input type="checkbox" id="nl-ok"> <span>' + (EN() ? 'I authorize Andes Horizonte Travel S.A.C. to process my data to send me commercial information, under Law 29733. ' : 'Autorizo a Andes Horizonte Travel S.A.C. a tratar mis datos para enviarme información comercial, conforme a la Ley 29733 de Protección de Datos Personales. ') + '<a href="#/sitio/legal/privacidad">' + t('privacy') + '</a></span></label></form></div>';
  }
  function bindNews(el) {
    on('news', () => {
      const name = el.querySelector('#nl-name').value.trim(), email = el.querySelector('#nl-mail').value.trim().toLowerCase();
      if (!emailOk(email)) { UI.toast('Ingrese un correo válido.', 'bad'); el.querySelector('#nl-mail').classList.add('err'); return; }
      if (!el.querySelector('#nl-ok').checked) { UI.toast('Para suscribirse debe autorizar el tratamiento de sus datos (Ley 29733).', 'bad'); return; }
      const ex = (DB.subscribers || []).find(x => (x.email || '').toLowerCase() === email);
      if (ex && ex.status !== 'baja') { UI.toast('Este correo ya está suscrito. Gracias.', 'info'); return; }
      const cli = DB.clients.find(c => (c.email || '').toLowerCase() === email);
      const { sb: s } = upsertSubscriber({ email, name, source: 'Newsletter web', clientId: cli ? cli.id : null });
      Notify.push('newsletter.doble_optin', 'Email', email, 'Confirme su suscripción a las novedades de Andes Horizonte Travel');
      track('sign_up_newsletter', { subscriber: s.id });
      el.querySelector('#ws-nl').innerHTML = UI.alert('ok', '<b>¡Gracias por suscribirse!</b> Le enviamos un correo a ' + esc(email) + ' para confirmar su suscripción (doble opt-in). Puede darse de baja en cualquier momento desde el enlace de cada correo.');
    });
  }

  /* ================= LISTADO Y BÚSQUEDA ================= */
  function pList(kind) {
    const q = query();
    const st = { destino: q.destino || '', tipo: q.tipo || (['tours', 'paquetes', 'experiencias', 'traslados'].includes(kind) ? kind : ''), dur: q.dur || '', pmin: q.pmin || '', pmax: q.pmax || '', fecha: q.fecha || '', cat: q.cat || '', diff: q.diff || '', idioma: q.idioma || '', mod: q.mod || '', pax: +(q.pax || 1), orden: q.orden || 'rec' };
    const title = kind === 'buscar' ? t('search_t') : t(kind === 'traslados' ? 'tours' : kind);
    const cats = [...new Set(siteProducts().map(p => p.category))];
    const sel = (id, label, opts, v) => '<div class="field"><label for="' + id + '">' + label + '</label><select class="input sm" id="' + id + '" data-c="flt" data-k="' + id.slice(3) + '"><option value="">' + (EN() ? 'Any' : 'Todos') + '</option>' + opts.map(o => '<option value="' + esc(o[0]) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></div>';
    const filters = '<aside class="ws-filters" id="ws-flt"><div class="row between"><b>' + t('filters') + '</b><button class="btn xs ghost" data-a="clr">' + t('clear') + '</button></div>' +
      sel('fl-destino', t('s_dest'), DEST.map(d => [d.slug, destName(d)]), st.destino) +
      sel('fl-tipo', EN() ? 'Type' : 'Tipo', [['tours', t('tours')], ['paquetes', t('paquetes')], ['experiencias', t('experiencias')], ['traslados', EN() ? 'Transfers' : 'Traslados']], st.tipo) +
      '<div class="field"><label for="fl-fecha">' + t('s_date') + '</label><input class="input sm" type="date" id="fl-fecha" data-c="flt" data-k="fecha" value="' + esc(st.fecha) + '" min="' + addDays(T(), 1) + '"></div>' +
      sel('fl-pax', t('s_pax'), [1, 2, 3, 4, 5, 6, 8, 10].map(n => [n, n]), q.pax || '') +
      sel('fl-dur', t('duration'), [['1', EN() ? 'Up to 1 day' : 'Hasta 1 día'], ['2-4', EN() ? '2 to 4 days' : '2 a 4 días'], ['5', EN() ? '5+ days' : '5 días o más']], st.dur) +
      '<div class="field"><label>' + (EN() ? 'Price per person (' : 'Precio por persona (') + prefs.cur + ')</label><div class="row" style="gap:6px;flex-wrap:nowrap"><input class="input sm" type="number" min="0" id="fl-pmin" data-c="flt" data-k="pmin" placeholder="Mín." value="' + esc(st.pmin) + '"><input class="input sm" type="number" min="0" id="fl-pmax" data-c="flt" data-k="pmax" placeholder="Máx." value="' + esc(st.pmax) + '"></div></div>' +
      sel('fl-cat', EN() ? 'Category' : 'Categoría', cats.map(c => [c, c]), st.cat) +
      sel('fl-diff', t('difficulty'), [['Fácil', EN() ? 'Easy' : 'Fácil'], ['Moderada', EN() ? 'Moderate' : 'Moderada'], ['exigente', EN() ? 'Challenging' : 'Exigente']], st.diff) +
      sel('fl-idioma', t('language'), [['ES', 'Español'], ['EN', 'English'], ['DE', 'Deutsch'], ['FR', 'Français']], st.idioma) +
      sel('fl-mod', t('modality'), [['Privado', t('priv')], ['Compartido', t('shared')]], st.mod) + '</aside>';
    const html = crumbs([[title]]) + pageH(title, kind === 'paquetes' ? (EN() ? 'Multi-day programs with hotel, transfers and guided visits.' : 'Programas de varios días con hotel, traslados y visitas guiadas.') : kind === 'experiencias' ? (EN() ? 'Food, culture and nature experiences with local hosts.' : 'Experiencias gastronómicas, culturales y de naturaleza con anfitriones locales.') : (EN() ? 'Filter by destination, date, price and more. Real-time availability.' : 'Filtre por destino, fecha, precio y más. Disponibilidad en tiempo real.')) +
      '<div class="ws-wrap ws-list">' + filters + '<section><div class="ws-lbar"><div class="row" style="gap:8px"><button class="btn sm ws-fbtn" data-a="fbtn">' + ic('filter') + t('filters') + '</button><span class="small muted" id="ws-cnt"></span></div><div class="row" style="gap:6px"><label class="small muted" for="fl-orden">' + t('sort') + '</label><select class="input sm" id="fl-orden" data-c="flt" data-k="orden" style="width:auto"><option value="rec">' + (EN() ? 'Recommended' : 'Recomendados') + '</option><option value="pasc"' + (st.orden === 'pasc' ? ' selected' : '') + '>' + (EN() ? 'Price: low to high' : 'Precio: menor a mayor') + '</option><option value="pdesc"' + (st.orden === 'pdesc' ? ' selected' : '') + '>' + (EN() ? 'Price: high to low' : 'Precio: mayor a menor') + '</option><option value="dur"' + (st.orden === 'dur' ? ' selected' : '') + '>' + t('duration') + '</option><option value="top"' + (st.orden === 'top' ? ' selected' : '') + '>' + t('best') + '</option><option value="rating"' + (st.orden === 'rating' ? ' selected' : '') + '>' + (EN() ? 'Top rated' : 'Mejor valorados') + '</option></select></div></div><div id="ws-res"></div></section></div>';
    const draw = (el) => {
      const pax = +(st.pax || 1);
      let rows = siteProducts().filter(p => {
        if (st.tipo && kindOf(p) !== st.tipo) return false;
        if (st.destino) { const d = DEST.find(x => x.slug === st.destino); if (d && !prodsInDest(d.id).includes(p)) return false; }
        const dd = durDays(p); if (st.dur === '1' && dd > 1) return false; if (st.dur === '2-4' && (dd < 2 || dd > 4)) return false; if (st.dur === '5' && dd < 5) return false;
        const fp = fromPrice(p); const pv = fp ? conv(fp.price, fp.cur) : 0;
        if (st.pmin && pv < +st.pmin) return false; if (st.pmax && pv > +st.pmax) return false;
        if (st.cat && p.category !== st.cat) return false;
        if (st.diff && !px(p).diff.toLowerCase().includes(st.diff.toLowerCase())) return false;
        if (st.idioma && !langsOf(p).includes(st.idioma)) return false;
        if (st.mod && p.modality !== st.mod) return false;
        if (st.fecha && !dayInfo(p, st.fecha, pax).ok) return false;
        if (pax > p.maxPax) return false;
        return true;
      });
      const pv = (p) => { const f = fromPrice(p); return f ? conv(f.price, f.cur) : 0; };
      const sorters = { pasc: (a, b) => pv(a) - pv(b), pdesc: (a, b) => pv(b) - pv(a), dur: (a, b) => (durDays(a) * 24 + (a.durationUnit === 'horas' ? a.durationValue : 0)) - (durDays(b) * 24 + (b.durationUnit === 'horas' ? b.durationValue : 0)), top: (a, b) => salesCount(b.id) - salesCount(a.id), rating: (a, b) => px(b).rating - px(a).rating, rec: (a, b) => (b.flags.featured - a.flags.featured) || (salesCount(b.id) - salesCount(a.id)) };
      rows.sort(sorters[st.orden] || sorters.rec);
      el.querySelector('#ws-cnt').textContent = rows.length + ' ' + t('results') + (st.fecha ? ' · ' + dt(st.fecha) : '') + (st.pax > 1 ? ' · ' + st.pax + ' ' + t('s_pax').toLowerCase() : '');
      el.querySelector('#ws-res').innerHTML = rows.length ? '<div class="ws-grid">' + rows.map(card).join('') + '</div>' : '<div class="ws-block">' + UI.empty(t('nores'), 'search') + '<div class="row" style="justify-content:center"><button class="btn" data-a="clr">' + t('clear') + '</button><a class="btn primary" href="#/sitio/a-medida">' + t('quote') + '</a></div></div>';
      track('view_item_list', { list: kind, filters: qs(st), items: rows.map(p => p.id) });
    };
    return { nav: ['tours', 'paquetes', 'experiencias'].includes(kind) ? kind : '', title: title, desc: EN() ? 'Tours, packages and experiences in Peru with online prices and availability.' : 'Tours, paquetes y experiencias en Perú con precios web y disponibilidad en línea.', html,
      after: (el) => {
        draw(el);
        onc('flt', (s) => { st[s.dataset.k] = s.value; try { history.replaceState(null, '', '#/sitio/' + kind + '?' + qs(st)); } catch (e) { } memo = {}; draw(el); });
        on('clr', () => App.go('#/sitio/' + (kind === 'buscar' ? 'buscar' : kind)));
        on('fbtn', () => el.querySelector('#ws-flt').classList.toggle('open'));
      } };
  }

  /* ================= DESTINOS ================= */
  function pDestinos() {
    const html = crumbs([[t('destinos')]]) + pageH(t('destinos'), EN() ? 'Choose where to go. Every destination includes best time to visit and our programs.' : 'Elija a dónde ir. Cada destino incluye la mejor época para viajar y nuestros programas.') +
      '<div class="ws-wrap" style="padding-bottom:50px"><div class="ws-grid g3">' + DEST.map((d, i) => '<a class="ws-dest" href="#/sitio/destinos/' + d.slug + '" style="min-height:220px">' + art(d.hue, i, '') + '<div class="in" style="min-height:220px"><b>' + esc(destName(d)) + '</b><span>' + esc(EN() ? d.tagEn : d.tag) + '</span><span>' + d.alt + ' · ' + prodsInDest(d.id).length + ' ' + (EN() ? 'experiences' : 'experiencias') + '</span></div></a>').join('') + '</div></div>';
    return { nav: 'destinos', title: EN() ? 'Destinations in Peru' : 'Destinos en Perú', desc: 'Cusco, Machu Picchu, Valle Sagrado, Arequipa, Paracas, Titicaca y Amazonía: mejor época, clima y tours.', html };
  }
  function seasonStrip() {
    const months = Array.from({ length: 12 }, (_, i) => { const y = i < 3 ? 2027 : 2026; const m = i < 3 ? i + 1 : i + 1; const d = y + '-' + pad(m) + '-15'; const s = Pricing.seasonFor(d); const typ = s ? s.type.toLowerCase() : ''; const cls = typ === 'alta' ? 'alta' : typ === 'media' ? 'media' : typ === 'baja' ? 'baja' : 'reg'; return '<div class="' + cls + '" title="' + esc(s ? s.name : 'Temporada regular') + '">' + (EN() ? MES_EN : MES_ES)[i] + '</div>'; });
    return '<div class="ws-season">' + months.join('') + '</div><div class="ws-leg"><span><i style="background:var(--warn)"></i>' + (EN() ? 'High season (higher prices)' : 'Temporada alta (tarifas mayores)') + '</span><span><i style="background:var(--info)"></i>' + (EN() ? 'Mid season' : 'Temporada media') + '</span><span><i style="background:var(--ok)"></i>' + (EN() ? 'Low season (rainy, lower prices)' : 'Temporada baja (lluvias, tarifas menores)') + '</span><span><i style="background:var(--fg-3)"></i>' + (EN() ? 'Regular' : 'Regular') + '</span></div><p class="ws-note" style="margin-top:6px">' + (EN() ? 'Special dates (Inti Raymi, national holidays, New Year) apply their own rate factor.' : 'Las fechas especiales (Inti Raymi, Fiestas Patrias, Año Nuevo) aplican su propio factor tarifario: ') + DB.seasons.filter(s => s.status === 'activa' && s.priority === 0).map(s => esc(s.name) + ' ×' + fmtN(s.factor, 2)).join(' · ') + '.</p>';
  }
  function pDestino(slug) {
    const d = DEST.find(x => x.slug === slug); if (!d) return { title: 'Destino no encontrado', html: '<div class="ws-wrap ws-sec">' + UI.empty('Destino no encontrado.', 'map') + '</div>' };
    const prods = prodsInDest(d.id); const dd = Q.destination(d.id) || {};
    const html = '<section class="ws-hero" style="min-height:260px">' + heroSvg + '<div class="ws-wrap" style="padding-top:40px;padding-bottom:44px"><nav class="ws-crumbs" style="padding:0 0 10px"><a href="#/sitio" style="color:rgba(255,255,255,.8)">' + (EN() ? 'Home' : 'Inicio') + '</a><span>/</span><a href="#/sitio/destinos" style="color:rgba(255,255,255,.8)">' + t('destinos') + '</a></nav><div class="k">' + esc(EN() ? d.tagEn : d.tag) + '</div><h1>' + esc(destName(d)) + '</h1><p class="l">' + esc(d.desc) + '</p><div class="ws-trust"><span>' + ic('mountain') + d.alt + '</span><span>' + ic('pin') + esc(Q.destPath(d.id)) + '</span><span>' + ic('box') + prods.length + ' ' + (EN() ? 'experiences' : 'experiencias') + '</span></div></div></section>' +
      '<div class="ws-wrap ws-2col" style="padding-top:26px"><div class="stack">' +
      '<div class="ws-block"><h2>' + (EN() ? 'Tours and packages in ' : 'Tours y paquetes en ') + esc(destName(d)) + '</h2>' + (prods.length ? '<div class="ws-grid">' + prods.map(card).join('') + '</div>' : UI.alert('info', (EN() ? 'We design tailor-made programs for this destination. ' : 'Diseñamos programas a medida para este destino. ') + '<a href="#/sitio/a-medida?destino=' + d.slug + '"><b>' + t('quote') + '</b></a>')) + '</div>' +
      '<div class="ws-block ws-faq"><h2>' + t('faq') + '</h2>' + d.faq.map(f => '<details><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>').join('') + '</div></div>' +
      '<aside class="stack"><div class="ws-block"><h2>' + (EN() ? 'Best time to visit' : 'Mejor época para viajar') + '</h2><p class="small muted" style="margin-bottom:10px">' + esc(d.climate) + '</p>' + seasonStrip() + '</div>' +
      '<div class="ws-block"><h2>' + (EN() ? 'Location' : 'Ubicación') + '</h2>' + mapSvg(dd.lat, dd.lng, destName(d)) + '</div>' +
      '<div class="ws-block"><h2>' + (EN() ? 'Plan your trip' : 'Planifique su viaje') + '</h2><p class="small muted">' + (EN() ? 'Tell us your dates and interests; an advisor sends you a proposal within 24 business hours.' : 'Cuéntenos sus fechas e intereses; un asesor le envía una propuesta en máximo 24 horas hábiles.') + '</p><div class="row" style="margin-top:10px"><a class="btn primary" href="#/sitio/a-medida?destino=' + d.slug + '">' + t('quote') + '</a><button class="btn" data-a="wa">' + ic('msg') + 'WhatsApp</button></div></div></aside></div>';
    return { nav: 'destinos', title: destName(d) + (EN() ? ': tours, best time and tips' : ': tours, mejor época y consejos'), desc: d.desc.slice(0, 155), html,
      ld: { '@context': 'https://schema.org', '@type': 'TouristDestination', name: destName(d), description: d.desc, geo: dd.lat ? { '@type': 'GeoCoordinates', latitude: dd.lat, longitude: dd.lng } : undefined },
      after: () => on('wa', () => waModal((EN() ? 'Hello, I would like information about trips to ' : 'Hola, deseo información para viajar a ') + destName(d) + '.')) };
  }
  function mapSvg(lat, lng, label) {
    /* Mapa esquemático del Perú (sin teselas externas). En producción: proveedor de mapas (INT-05). */
    const x = lat == null ? 160 : 40 + (lng + 81.5) / 13 * 240, y = lat == null ? 90 : 10 + (-lat - 0) / 18.5 * 150;
    return '<div class="ws-map"><svg viewBox="0 0 320 170" role="img" aria-label="Mapa: ' + esc(label) + '"><path d="M70 12 L120 8 L170 30 L220 48 L262 70 L280 120 L250 160 L210 150 L170 128 L120 96 L86 60 L60 30Z" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.2"/><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="6" fill="var(--bad)"/><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="12" fill="none" stroke="var(--bad)" opacity=".5"/><text x="' + Math.min(250, x + 12).toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" style="font-size:11px;font-weight:700;fill:var(--fg)">' + esc(label) + '</text></svg></div>' + (lat != null ? '<div class="xs faint" style="margin-top:6px">' + fmtN(lat, 4) + ', ' + fmtN(lng, 4) + '</div>' : '');
  }
  function waModal(msg) {
    track('contact_whatsapp', {});
    UI.modal({ title: 'Consultar por WhatsApp', size: 'sm', body: '<p class="small">Escríbanos al <b style="user-select:all">' + WA + '</b> (lun–sáb 8:00–20:00). Puede copiar este mensaje:</p><textarea class="input" rows="4" readonly style="margin-top:10px">' + esc(msg) + '</textarea><p class="xs faint" style="margin-top:8px">En producción el botón abre WhatsApp (enlace wa.me con el mensaje prellenado) y la conversación ingresa a la Bandeja omnicanal.</p>', actions: [{ label: 'Copiar número', icon: 'copy', onClick: () => { UI.copy(WA); return false; } }, { label: 'Copiar mensaje', icon: 'copy', cls: 'primary', onClick: () => { UI.copy(msg); return false; } }] });
  }

  /* ================= FICHA DE PRODUCTO ================= */
  /* Reglas que gobiernan la ficha (todas vía BookingEngine): R-AVAIL-RANGES, R-CUTOFF, R-WEEKDAYS (calendario),
     R-MIN-ADULTS, R-CHILD-PER-ADULT, R-INFANT-FREE, R-MAX-PAX (pasajeros), R-LODGING, R-LODGING-CAPACITY, R-SINGLE-SUPP
     (alojamiento), R-ADDONS (adicionales), R-SEASON y ajustes de precio, R-DEPOSIT / R-PAY-LATER (resumen), R-HOLD (carrito). */
  let PS = null;
  const TYPES = ['ADT', 'CHD', 'INF'];
  const TYL = (ty) => ({ ADT: EN() ? 'Adults' : 'Adultos', CHD: EN() ? 'Children' : 'Niños', INF: EN() ? 'Infants' : 'Infantes' })[ty];
  const TY1 = (ty) => ({ ADT: EN() ? 'Adult' : 'Adulto', CHD: EN() ? 'Child' : 'Niño', INF: EN() ? 'Infant' : 'Infante' })[ty];
  const tyKey = (ty) => ty.toLowerCase();
  const paxTxt = (pax, sep) => TYPES.filter(ty => pax[tyKey(ty)]).map(ty => pax[tyKey(ty)] + ' ' + (pax[tyKey(ty)] === 1 ? TY1(ty) : TYL(ty)).toLowerCase()).join(sep || ', ');
  const ageBand = (r, ty) => ty === 'ADT' ? r.adultMinAge + '+ ' + (EN() ? 'yrs' : 'años') : ty === 'CHD' ? r.childMinAge + '–' + r.childMaxAge + ' ' + (EN() ? 'yrs' : 'años') : '0–' + r.infantMaxAge + ' ' + (EN() ? 'yrs' : 'años');
  const legsOf = (p) => (p.accommodation && p.accommodation.legs) || [];
  const lodgingOn = (p) => BE.on('R-LODGING', p) && legsOf(p).length > 0;
  const addonsOn = (p) => BE.on('R-ADDONS', p) && (p.addons || []).length > 0;
  const smallIc = (n, s) => ic(n).replace('<svg', '<svg style="width:' + (s || 14) + 'px;height:' + (s || 14) + 'px;vertical-align:-2px"');
  function freshPS(p) {
    const r = BE.paxRules(p);
    const ps = { pid: p.id, date: null, month: null, pax: { adt: Math.max(r.minAdults || 0, 1, Math.min(2, p.maxPax), p.minPax || 1), chd: 0, inf: 0 }, opts: {}, addons: {}, lodgeOn: false, lodging: {} };
    (p.config || []).forEach((g, i) => { ps.opts[i] = Math.max(0, g.options.findIndex(o => o.delta === 0)); });
    ps.date = nextOk(p, ps.pax.adt);
    return ps;
  }
  /* Ítem de carrito equivalente a la selección actual de la ficha */
  function itemFromPS(p) {
    const lodging = lodgingOn(p) && PS.lodgeOn ? legsOf(p).map(l => { const s = PS.lodging[l.id]; if (!s || !s.hotelId) return null; const rooms = Object.entries(s.rooms || {}).filter(([, q]) => q > 0).map(([type, qty]) => ({ type, qty })); return rooms.length ? { legId: l.id, hotelId: s.hotelId, rooms } : null; }).filter(Boolean) : [];
    return normItem({ pid: p.id, date: PS.date, pax: Object.assign({}, PS.pax), opts: Object.assign({}, PS.opts), addons: addonsOn(p) ? Object.entries(PS.addons).map(([id, by]) => ({ id, by: Object.assign({}, by) })).filter(a => sum(Object.values(a.by), v => v) > 0) : [], lodging, noLodging: !lodging.length, removed: [] });
  }
  function suggestRooms(h, need) {
    const has = (t2) => h.rooms.some(r => r.type === t2); const out = {};
    if (need <= 0) return out;
    if (need === 1 && has('Simple')) { out.Simple = 1; return out; }
    if (has('Doble')) { let n = need; if (n % 2 && has('Triple') && n >= 3) { out.Triple = 1; n -= 3; } if (n > 0) out.Doble = Math.ceil(n / 2); return out; }
    const big = h.rooms.slice().sort((a, b) => b.capacity - a.capacity)[0]; out[big.type] = Math.ceil(need / big.capacity); return out;
  }
  function pProduct(slug) {
    const p = bySlug(slug);
    if (!p) return { title: 'Producto no disponible', html: crumbs([[t('tours'), '#/sitio/tours']]) + '<div class="ws-wrap ws-sec">' + UI.alert('warn', 'Este producto no está disponible para la venta en línea (debe estar ACTIVO y publicado en el canal e-commerce, PRD-BR-002).') + '<div class="row" style="margin-top:12px"><a class="btn primary" href="#/sitio/buscar">Ver todos los tours</a><a class="btn" href="#/sitio/a-medida">' + t('quote') + '</a></div></div>' };
    const q = query();
    if (!PS || PS.pid !== p.id) PS = freshPS(p);
    if (q.fecha && dayInfo(p, q.fecha, 1).ok) PS.date = q.fecha;
    if (q.pax) PS.pax.adt = Math.max(1, Math.min(p.maxPax, +q.pax));
    if (!PS.month) PS.month = (PS.date || T()).slice(0, 7);
    const x = px(p); const dest = destOfProduct(p); const fp = fromPrice(p);
    const deps = hasDeps(p) ? p.departures.filter(d => d.date >= T() && dayInfo(p, d.date, 1).ok).slice(0, 4) : [];
    const rel = (p.related || []).map(r => Q.product(r.productId)).filter(r => r && siteProducts().includes(r)).concat(siteProducts().filter(o => o.id !== p.id && o.destId && destSubtree(dest.id).has(o.destId))).filter((v, i, a) => a.indexOf(v) === i && v.id !== p.id).slice(0, 3);
    const firstIt = (p.itinerary[0] && p.itinerary[0].items[0]) || null;
    const meeting = hasDeps(p) ? (p.departures[0].meeting === 'Hotel (recojo)' ? x.pickup : p.departures[0].meeting + ', Cusco') : x.pickup;
    const dd = Q.destination(p.destId) || {};
    const pay = p.payment || {};
    const faqs = (p.faqs || []).map(f => [f.q, f.a]).concat(BE.on('R-DEPOSIT', p) && (pay.modes || BE.cfg().paymentModes || []).includes('adelanto') ? [[EN() ? 'Can I pay a deposit?' : '¿Puedo pagar un adelanto?', 'Sí. Puede pagar un adelanto del ' + (pay.depositPct != null ? pay.depositPct : BE.param('R-DEPOSIT', 'pct')) + ' % al reservar y el saldo hasta ' + (pay.balanceDueDays != null ? pay.balanceDueDays : BE.param('R-DEPOSIT', 'balanceDueDays')) + ' días antes del viaje desde Mi cuenta.']] : []).concat([[EN() ? 'How do I receive my voucher?' : '¿Cómo recibo mi voucher?', 'Al confirmar el pago total le enviamos el voucher por correo y queda disponible en Mi cuenta y en el portal del pasajero.']]).concat(dest.faq.slice(0, 2));
    let n = 0; const sec = (id, title, sub) => '<section class="ws-cfgs" id="' + id + '-s"><h3><span class="n">' + (++n) + '</span>' + title + '</h3>' + (sub ? '<p class="ws-note" style="margin:-4px 0 10px">' + sub + '</p>' : '') + '<div id="' + id + '"></div></section>';
    const cfg = '<div class="ws-block ws-cfg" id="ws-avail"><h2>' + (EN() ? 'Configure your booking' : 'Configure su reserva') + '</h2>' +
      sec('ws-calw', EN() ? 'Departure date' : 'Fecha de salida') +
      (deps.length ? '<div class="upper" style="margin:-4px 0 8px">' + (EN() ? 'Scheduled departures' : 'Salidas programadas') + '</div><div class="ws-deps" style="margin-bottom:16px">' + deps.map(d => { const di = dayInfo(p, d.date, 1); return '<div class="ws-dep" style="grid-template-columns:70px minmax(0,1fr) auto"><div class="d"><span>' + (EN() ? MES_EN : MES_ES)[parseD(d.date).getMonth()] + '</span><b>' + parseD(d.date).getDate() + '</b><span>' + d.time + '</span></div><div><b class="small">' + dtw(d.date) + '</b><div class="xs ok" style="font-weight:700">' + (di.free != null ? di.free + ' ' + t('seats') + ' ' + t('left') : '') + (guaranteed(p, d) ? ' · ' + t('guaranteed') : '') + '</div></div><button class="btn sm primary" data-a="day" data-d="' + d.date + '">' + (EN() ? 'Select' : 'Elegir') + '</button></div>'; }).join('') + '</div>' : '') +
      sec('ws-paxw', EN() ? 'Travelers' : 'Pasajeros', EN() ? 'Ages are checked against each traveler’s date of birth at checkout.' : 'Las edades se validan con la fecha de nacimiento de cada pasajero en el checkout.') +
      ((p.config || []).length ? sec('ws-optw', t('options')) : '') +
      (lodgingOn(p) ? sec('ws-lodw', EN() ? 'Accommodation (optional)' : 'Alojamiento (opcional)', esc((p.accommodation && p.accommodation.note) || '')) : '') +
      (addonsOn(p) ? sec('ws-addw', EN() ? 'Add-ons: museum tickets and more' : 'Adicionales: entradas a museos y otros', EN() ? 'Choose the quantity per traveler type.' : 'Elija la cantidad por tipo de pasajero.') : '') + '</div>';
    const html = crumbs([[t(kindOf(p) === 'traslados' ? 'tours' : kindOf(p)), '#/sitio/' + (kindOf(p) === 'traslados' ? 'tours' : kindOf(p))], [destName(dest), '#/sitio/destinos/' + dest.slug], [pName(p)]]) +
      '<div class="ws-wrap"><div class="row between top" style="margin:4px 0 14px"><div style="min-width:0;flex:1 1 420px"><h1 style="font-size:clamp(1.3rem,3vw,1.85rem);font-weight:750">' + esc(pName(p)) + '</h1><div class="row" style="gap:10px;margin-top:6px">' + stars(x.rating) + '<span class="small"><b>' + fmtN(x.rating, 1) + '</b> · ' + x.reviews + ' ' + (EN() ? 'reviews' : 'opiniones') + '</span>' + (ownStats(p) ? '<a class="small" href="#/sitio/tour/' + slugOf(p) + '" data-a="toown" style="display:inline-flex;gap:6px;align-items:center">' + ownTag() + '<b>' + fmtN(ownStats(p).avg, 1) + '</b> (' + ownStats(p).count + ')</a>' : '') + '<span class="small muted">' + smallIc('pin') + ' ' + esc(Q.destPath(p.destId)) + '</span>' + flags(p).map(f => '<span class="ws-flag ' + f[0] + '" style="border:1px solid var(--line)">' + esc(f[1]) + '</span>').join('') + '</div></div>' +
      '<div class="row"><button class="btn' + (wishList().includes(p.id) ? ' on' : '') + '" data-a="wishp">' + ic('heart') + (wishList().includes(p.id) ? (EN() ? 'Saved' : 'Guardado') : (EN() ? 'Save' : 'Guardar')) + '</button><button class="btn" data-a="share">' + ic('link') + (EN() ? 'Share' : 'Compartir') + '</button></div></div>' +
      '<div class="ws-gal">' + x.gal.map((g, i) => imgBox(p.hue + i * 14, i, g)).join('') + '</div></div>' +
      '<div class="ws-wrap ws-pd" style="margin-top:20px"><div class="stack" style="min-width:0">' +
      '<div class="ws-facts">' + [['clock', t('duration'), durLbl(p)], ['users', t('group'), (EN() ? 'Up to ' : 'Hasta ') + p.maxPax + (EN() ? ' people' : ' personas') + (p.minPax > 1 ? ' · mín. ' + p.minPax : '')], ['globe', t('language'), langsOf(p).join(', ')], ['pin', t('pickup'), x.pickup], ['layers', t('modality'), p.modality === 'Privado' ? t('priv') : t('shared')], ['trending', t('difficulty'), diffOf(p)]].map(f => '<div class="ws-fact">' + ic(f[0]) + '<div style="min-width:0"><small>' + esc(f[1]) + '</small><b>' + esc(f[2]) + '</b></div></div>').join('') + '</div>' +
      '<div class="ws-block"><h2>' + t('overview') + '</h2><p>' + esc(pLong(p)) + '</p>' + (freeCancel(p) ? '<div class="row" style="margin-top:10px;gap:14px"><span class="small ok" style="font-weight:700">' + smallIc('checkCircle', 16) + ' ' + esc(freeCancel(p)) + '</span></div>' : '') + '</div>' +
      (p.itinerary.length ? '<div class="ws-block"><h2>' + t('itinerary') + '</h2><div class="ws-itin">' + p.itinerary.map(d => '<div><div class="ws-day-h"><span class="n">' + d.day + '</span><b>' + (EN() ? 'Day ' : 'Día ') + d.day + ' · ' + esc(d.title) + '</b></div>' + (d.items.length ? '<div class="ws-day-i">' + d.items.map(i => '<div><span class="tm">' + esc(i.time) + '</span>' + esc(i.activity) + (i.location ? ' <span class="faint small">· ' + esc(i.location) + '</span>' : '') + '</div>').join('') + '</div>' : '') + '</div>').join('') + '</div><p class="ws-note" style="margin-top:10px">' + (EN() ? 'Times are approximate and may change due to weather or operational conditions.' : 'Horarios referenciales; pueden variar por clima o condiciones operativas.') + '</p></div>' : '') +
      '<div class="grid g2"><div class="ws-block"><h2>' + t('incl') + '</h2><ul class="ws-ul ok">' + p.inclusions.map(i => '<li>' + ic('check') + esc(i) + '</li>').join('') + '</ul></div><div class="ws-block"><h2>' + t('excl') + '</h2><ul class="ws-ul no">' + p.exclusions.map(i => '<li>' + ic('x') + esc(i) + '</li>').join('') + '</ul></div></div>' +
      '<div class="ws-block"><h2>' + t('reqs') + '</h2><ul class="ws-ul inf">' + p.requirements.concat(p.minAge ? [(EN() ? 'Minimum age: ' : 'Edad mínima: ') + p.minAge + (EN() ? ' years' : ' años')] : []).concat(needAlt(p) ? [(EN() ? 'High-altitude itinerary (' : 'Itinerario de altura (hasta ') + fmtN(maxAlt(p), 0) + ' m s. n. m.): ' + (EN() ? 'a health declaration is requested at checkout.' : 'se solicita una declaración al pagar.')] : []).map(i => '<li>' + ic('info') + esc(i) + '</li>').join('') + '</ul></div>' +
      cfg +
      '<div class="ws-block"><h2>' + t('meet') + '</h2><div class="grid g2"><div class="ws-kv"><div>' + ic('pin') + '<span><b>' + esc(meeting) + '</b><br><span class="small muted">' + (firstIt ? esc(firstIt.time + ' · ' + firstIt.activity) : '') + '</span></span></div>' + (BE.on('R-PICKUP', p) && p.pickup ? '<div>' + ic('route') + '<span class="small">' + (EN() ? 'Pickup options: ' : 'Opciones de recojo: ') + p.pickup.points.map(esc).join(' · ') + '</span></div>' : '') + '<div>' + ic('phoneCall') + '<span class="small">' + (EN() ? 'Operations line on the day of the service: ' : 'Central de operaciones el día del servicio: ') + '<b style="user-select:all">' + EMERG + '</b></span></div></div>' + mapSvg(dd.lat, dd.lng, Q.destName(p.destId)) + '</div></div>' +
      '<div class="ws-block"><h2>' + t('policies') + '</h2>' + UI.dl([[EN() ? 'Cancellation' : 'Cancelación', esc(p.policies.cancel)], [EN() ? 'Changes' : 'Cambios', esc(p.policies.modify)], ['No-show', esc(p.policies.noshow)], [EN() ? 'Refunds' : 'Reembolsos', esc(p.policies.refund)], [EN() ? 'Payment' : 'Pago', esc(payPolicy(p))]]) + '</div>' +
      '<div class="ws-block ws-faq"><h2>' + t('faq') + '</h2>' + faqs.map(f => '<details><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>').join('') + '</div>' +
      ownReviewsBlock(p) +
      extReviewsBlock(p) +
      (rel.length ? '<div><h2 class="ws-h2" style="margin-bottom:14px">' + t('related') + '</h2><div class="ws-grid">' + rel.map(card).join('') + '</div></div>' : '') +
      '</div><aside class="ws-book" id="ws-book"></aside></div>' +
      '<div class="ws-mbar"><div style="min-width:0"><span class="xs faint" id="ws-mbl">' + t('from') + '</span> <b id="ws-mbp">' + (fp ? pm0(fp.price, fp.cur) : '—') + '</b> <span class="xs faint" id="ws-mbs">' + t('pp') + '</span></div><button class="btn sun" data-a="tobook">' + t('book') + '</button></div>';
    const ld = { '@context': 'https://schema.org', '@type': ['TouristTrip', 'Product'], name: pName(p), description: pShort(p), sku: p.sku, brand: { '@type': 'Brand', name: 'Andes Horizonte Travel' }, touristType: p.category, itinerary: { '@type': 'ItemList', itemListElement: p.itinerary.map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: d.title })) }, offers: fp ? { '@type': 'Offer', price: fp.price, priceCurrency: fp.cur, availability: 'https://schema.org/InStock', validFrom: T(), url: 'https://andeshorizonte.pe/tours/' + slugOf(p) } : undefined };
    const oLd = ownOn(p) && OR().ld(p.id); if (oLd) Object.assign(ld, oLd);
    return { nav: kindOf(p) === 'traslados' ? 'tours' : kindOf(p), bar: true, title: (!EN() && p.seo && p.seo.title) ? p.seo.title : pName(p), desc: (p.seo && p.seo.description && !EN() ? p.seo.description : pShort(p)), ld, html,
      after: (el) => {
        track('view_item', { item_id: p.id, item_name: p.name, price: fp ? fp.price : null, currency: fp ? fp.cur : null });
        const all = () => { drawCal(el, p); drawPax(el, p); drawOpts(el, p); drawLodging(el, p); drawAddons(el, p); drawBook(el, p); };
        all();
        on('day', (b) => { PS.date = b.dataset.d; PS.month = PS.date.slice(0, 7); drawCal(el, p); drawBook(el, p); track('select_date', { item_id: p.id, date: PS.date }); });
        on('mon', (b) => { const [y, m] = PS.month.split('-').map(Number); const d = new Date(y, m - 1 + (+b.dataset.d), 1); PS.month = d.getFullYear() + '-' + pad(d.getMonth() + 1); drawCal(el, p); });
        on('q', (b) => { const k = b.dataset.k, d = +b.dataset.d; PS.pax[k] = Math.max(0, PS.pax[k] + d); clampAddons(p); drawPax(el, p); drawCal(el, p); drawLodging(el, p); drawAddons(el, p); drawBook(el, p); });
        on('opt', (b) => { const [g, o] = b.dataset.v.split(':').map(Number); PS.opts[g] = o; drawOpts(el, p); drawBook(el, p); });
        on('lodge', (b) => { PS.lodgeOn = b.dataset.v === '1'; if (PS.lodgeOn) legsOf(p).forEach(l => { if (!PS.lodging[l.id]) { const h = l.hotels[0]; PS.lodging[l.id] = { hotelId: h.id, rooms: suggestRooms(h, PS.pax.adt + PS.pax.chd) }; } }); drawLodging(el, p); drawBook(el, p); });
        on('room', (b) => { const s = PS.lodging[b.dataset.leg]; if (!s) return; s.rooms[b.dataset.t] = Math.max(0, (s.rooms[b.dataset.t] || 0) + (+b.dataset.d)); drawLodging(el, p); drawBook(el, p); });
        on('suggest', (b) => { const s = PS.lodging[b.dataset.leg]; const l = legsOf(p).find(x => x.id === b.dataset.leg); const h = l && l.hotels.find(x => x.id === s.hotelId); if (h) s.rooms = suggestRooms(h, PS.pax.adt + PS.pax.chd); drawLodging(el, p); drawBook(el, p); });
        onc('hotel', (s) => { const leg = s.dataset.leg; const l = legsOf(p).find(x => x.id === leg); const h = l.hotels.find(x => x.id === s.value); PS.lodging[leg] = { hotelId: s.value, rooms: h ? suggestRooms(h, PS.pax.adt + PS.pax.chd) : {} }; drawLodging(el, p); drawBook(el, p); });
        on('addq', (b) => { const id = b.dataset.id, ty = b.dataset.t; const by = PS.addons[id] || (PS.addons[id] = {}); by[ty] = Math.max(0, Math.min(PS.pax[tyKey(ty)], (by[ty] || 0) + (+b.dataset.d))); drawAddons(el, p); drawBook(el, p); });
        on('addall', (b) => { const ad = (p.addons || []).find(a => a.id === b.dataset.id); const by = PS.addons[ad.id] = {}; const full = b.dataset.v === '1'; (ad.appliesTo || TYPES).forEach(ty => { by[ty] = full ? PS.pax[tyKey(ty)] : 0; }); drawAddons(el, p); drawBook(el, p); });
        on('orf', (b) => { ORF.star = +b.dataset.v; ORF.all = false; const w = el.querySelector('#ws-ownlist'); if (w) w.innerHTML = ownList(p); });
        on('orm', () => { ORF.all = true; const w = el.querySelector('#ws-ownlist'); if (w) w.innerHTML = ownList(p); });
        on('toown', () => { const w = el.querySelector('#ws-ownrev'); if (w) w.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        on('add', () => addToCart(p, false));
        on('buy', () => addToCart(p, true));
        on('wa', () => waModal((EN() ? 'Hello, I am interested in ' : 'Hola, me interesa ') + pName(p) + (PS.date ? (EN() ? ' on ' : ' para el ') + dt(PS.date) : '') + ' (' + PS.pax.adt + ' ' + t('adults').toLowerCase() + (PS.pax.chd ? ', ' + PS.pax.chd + ' ' + t('children').toLowerCase() : '') + (PS.pax.inf ? ', ' + PS.pax.inf + ' ' + t('infants').toLowerCase() : '') + ').'));
        on('quote', () => App.go('#/sitio/a-medida?' + qs({ producto: p.id, destino: dest.slug, fecha: PS.date || '', pax: PS.pax.adt + PS.pax.chd })));
        on('wishp', () => { toggleWish(p.id); App.render(); });
        on('share', () => { UI.copy('https://andeshorizonte.pe/tours/' + slugOf(p)); track('share', { item_id: p.id }); });
        on('tobook', () => el.querySelector('#ws-book').scrollIntoView({ behavior: 'smooth', block: 'start' }));
        on('tocal', () => el.querySelector('#ws-avail').scrollIntoView({ behavior: 'smooth', block: 'start' }));
      } };
  }
  function payPolicy(p) {
    const pay = p.payment || {}; const modes = BE.quote(p, { pax: { adt: 1 } }).modes;
    const out = [EN() ? 'Full payment' : 'Pago total'];
    if (modes.includes('adelanto')) out.push((EN() ? 'deposit ' : 'adelanto ') + (pay.depositPct != null ? pay.depositPct : BE.param('R-DEPOSIT', 'pct')) + ' % ' + (EN() ? 'and balance ' : 'y saldo ') + (pay.balanceDueDays != null ? pay.balanceDueDays : BE.param('R-DEPOSIT', 'balanceDueDays')) + (EN() ? ' days before departure' : ' días antes de la salida'));
    if (modes.includes('pagar_despues')) out.push((EN() ? 'book now and pay within ' : 'reserve y pague dentro de ') + BE.param('R-PAY-LATER', 'holdHours', p) + ' h');
    return out.join(' · ') + (pay.note ? '. ' + pay.note : '');
  }
  function clampAddons(p) { Object.values(PS.addons).forEach(by => TYPES.forEach(ty => { if (by[ty] > PS.pax[tyKey(ty)]) by[ty] = PS.pax[tyKey(ty)]; })); }
  /* Calendario con estados por día (BE.month / BE.dayStatus) y leyenda de rangos */
  const CAL_ST = [['ok', 'Disponible', 'Available'], ['cerrado', 'Ocupado / cerrado', 'Closed / occupied'], ['agotado', 'Agotado', 'Sold out'], ['sin_cupo', 'Sin cupo para su grupo', 'Not enough seats'], ['fuera_de_plazo', 'Fuera de plazo', 'Booking window closed'], ['no_opera', 'No opera', 'No service']];
  function drawCal(el, p) {
    const w = el.querySelector('#ws-calw'); if (!w) return;
    const [y, m] = PS.month.split('-').map(Number); const first = new Date(y, m - 1, 1); const lead = (first.getDay() + 6) % 7;
    const minM = T().slice(0, 7), maxM = addDays(T(), p.advMax).slice(0, 7);
    const seats = BE.validatePax(p, PS.pax).seats || 1;
    const days = BE.month(p, y, m - 1, seats); let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span class="ws-day blank"></span>';
    days.forEach(d => {
      const di = dayInfo(p, d.date, seats); let pr = '';
      if (di.ok) { const qq = BE.quote(p, { date: d.date, pax: { adt: 1, chd: 0, inf: 0 }, currency: prefs.cur, channel: 'E-commerce' }); const l = qq.lines.find(x => x.key === 'base-adt'); pr = l ? fmtN(Math.round(l.unit), 0) : ''; }
      const cls = di.ok ? 'st-ok' : 'st-' + (di.status === 'sin_tarifa' ? 'fuera_de_plazo' : di.status);
      cells += '<button type="button" class="ws-day ' + cls + (PS.date === d.date ? ' sel' : '') + '" data-a="day" data-d="' + d.date + '"' + (di.ok ? '' : ' disabled') + ' title="' + esc(dt(d.date) + ' · ' + (di.ok ? (di.onRequest ? t('onreq') : (d.label || 'Disponible')) : di.why)) + '" aria-label="' + esc(dt(d.date) + ': ' + (di.ok ? 'disponible' : di.why)) + '"><b>' + d.day + '</b>' + (di.ok ? '<span class="p">' + pr + '</span>' : '<span class="p">' + (d.status === 'cerrado' && d.range ? (EN() ? 'closed' : 'ocup.') : d.status === 'agotado' ? (EN() ? 'full' : 'agot.') : '') + '</span>') + '</button>';
    });
    const nx = nextOk(p, seats);
    const ranges = BE.on('R-AVAIL-RANGES', p) ? BE.rangesSummary(p).filter(r => r.to >= T()) : [];
    const rLbl = (r) => { const a = parseD(r.from), b = parseD(r.to); const mm = (d) => (EN() ? MES_EN : MES_ES)[d.getMonth()]; return pad(a.getDate()) + (a.getMonth() !== b.getMonth() ? ' ' + mm(a) : '') + '–' + pad(b.getDate()) + ' ' + mm(b); };
    const sel = PS.date ? dayInfo(p, PS.date, seats) : null;
    w.innerHTML = '<div class="ws-calbox"><div class="ws-cal-h"><button class="btn sm icon" data-a="mon" data-d="-1"' + (PS.month <= minM ? ' disabled' : '') + ' aria-label="Mes anterior">' + ic('chevronLeft') + '</button><b style="text-transform:capitalize">' + (EN() ? MESL_EN : MESL_ES)[m - 1] + ' ' + y + '</b><button class="btn sm icon" data-a="mon" data-d="1"' + (PS.month >= maxM ? ' disabled' : '') + ' aria-label="Mes siguiente">' + ic('chevronRight') + '</button></div>' +
      '<div class="ws-cal">' + (EN() ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do']).map(d => '<span class="wd">' + d + '</span>').join('') + cells + '</div>' +
      '<div class="ws-leg ws-leg2">' + CAL_ST.map(s => '<span><i class="sw st-' + s[0] + '"></i>' + (EN() ? s[2] : s[1]) + '</span>').join('') + '<span>' + (EN() ? 'Adult price in ' : 'Precio adulto en ') + prefs.cur + '</span></div></div>' +
      '<div class="ws-calside">' +
      (sel ? '<div class="ws-selday ' + (sel.ok ? 'ok' : 'bad') + '">' + smallIc(sel.ok ? 'checkCircle' : 'alert', 16) + '<div><b>' + dtw(PS.date) + '</b><div class="xs">' + (sel.ok ? (sel.onRequest ? t('onreq') : (sel.free != null ? sel.free + ' ' + (EN() ? 'seats left' : 'cupos disponibles') : 'Disponible')) + (sel.st.range && sel.st.range.note ? ' · ' + esc(sel.st.range.note) : '') : esc(sel.why)) + '</div></div></div>' : '') +
      (nx ? '<div class="ws-next">' + smallIc('calendar') + ' <span>' + (EN() ? 'Next available date: ' : 'Próxima fecha disponible: ') + '<b>' + dtw(nx) + '</b></span>' + (nx !== PS.date ? '<button class="btn xs" data-a="day" data-d="' + nx + '">' + (EN() ? 'Choose' : 'Elegir') + '</button>' : '') + '</div>' : UI.alert('warn', EN() ? 'No available dates for this group size. Ask us for a custom quote.' : 'No hay fechas disponibles para este grupo. Solicite una cotización a medida.')) +
      (ranges.length ? '<div class="upper" style="margin:12px 0 6px">' + (EN() ? 'Availability by date range' : 'Disponibilidad por rangos') + '</div><ul class="ws-ranges">' + ranges.map(r => '<li><i class="sw st-' + (r.status === 'disponible' ? 'ok' : r.status) + '"></i><b>' + rLbl(r) + '</b><span>' + (r.status === 'disponible' ? (EN() ? 'Available' : 'Disponible') + (r.capacityPerDay ? ' · ' + r.capacityPerDay + ' ' + (EN() ? 'seats/day' : 'cupos/día') : '') : r.status === 'cerrado' ? (EN() ? 'Occupied / closed' : 'Ocupado / cerrado') : (EN() ? 'Sold out' : 'Agotado')) + (r.note ? ' — ' + esc(r.note) : '') + '</span></li>').join('') + '</ul>' : '') +
      (BE.on('R-CUTOFF', p) && p.availability && p.availability.cutoffHours ? '<p class="ws-note" style="margin-top:8px">' + (EN() ? 'Book at least ' : 'Reserve con al menos ') + p.availability.cutoffHours + (EN() ? ' h in advance.' : ' h de anticipación.') + '</p>' : '') + '</div>';
  }
  function drawPax(el, p) {
    const w = el.querySelector('#ws-paxw'); if (!w) return;
    const r = BE.paxRules(p); const pax = PS.pax;
    const q = BE.quote(p, { date: PS.date, pax: { adt: 1, chd: 1, inf: 1 }, currency: prefs.cur, channel: 'E-commerce' });
    const unit = (k) => { const l = q.lines.find(x => x.key === 'base-' + k); return l ? l.unit : 0; };
    const errs = paxErrors(p, pax);
    const wouldErr = (k) => { const c = Object.assign({}, pax); c[k]++; const e = BE.validatePax(p, c).errors; return e.length > BE.validatePax(p, pax).errors.length; };
    const types = TYPES.filter(ty => ty !== 'INF' || r.infantAllowed !== false);
    const row = (ty) => { const k = tyKey(ty); const minV = ty === 'ADT' ? Math.max(r.minAdults || 0, 0) : 0; const u = unit(k);
      const sub = ageBand(r, ty) + ' · ' + (ty === 'INF' && !r.infantPays ? (EN() ? 'free' : 'no pagan') : ty === 'CHD' && !r.childPays ? (EN() ? 'free' : 'sin costo') : pm(u, prefs.cur) + (EN() ? ' each' : ' c/u'));
      return '<div class="ws-prow"><div><b class="small">' + TYL(ty) + '</b><small>' + sub + '</small></div><div class="ws-qty"><button type="button" data-a="q" data-k="' + k + '" data-d="-1"' + (pax[k] <= minV || (pax.adt + pax.chd + pax.inf) <= 1 ? ' disabled' : '') + ' aria-label="Menos ' + TYL(ty) + '">−</button><b>' + pax[k] + '</b><button type="button" data-a="q" data-k="' + k + '" data-d="1"' + (wouldErr(k) ? ' disabled title="' + esc(EN() ? 'Limit per adult reached' : 'Límite por adulto alcanzado') + '"' : '') + ' aria-label="Más ' + TYL(ty) + '">+</button></div></div>'; };
    const chips = [];
    if (BE.on('R-MIN-ADULTS', p) && r.minAdults) chips.push((EN() ? 'At least ' : 'Mínimo ') + r.minAdults + (EN() ? ' adult' : ' adulto') + (r.minAdults > 1 ? 's' : ''));
    if (BE.on('R-CHILD-PER-ADULT', p)) chips.push((EN() ? 'Max. ' : 'Máx. ') + r.maxChildrenPerAdult + (EN() ? ' paying children per adult' : ' niño(s) que pagan por adulto'));
    if (BE.on('R-INFANT-FREE', p) && r.infantAllowed !== false) chips.push((EN() ? 'Max. ' : 'Máx. ') + r.maxInfantsPerAdult + (EN() ? ' infant per adult (free)' : ' infante por adulto (sin costo)'));
    if (BE.on('R-MAX-PAX', p) && p.maxPax) chips.push((EN() ? 'Up to ' : 'Hasta ') + p.maxPax + (EN() ? ' per booking' : ' pasajeros por reserva'));
    w.innerHTML = '<div class="ws-paxgrid">' + types.map(row).join('') + '</div>' +
      (chips.length ? '<div class="ws-chips" style="margin-top:10px">' + chips.map(c => '<span class="ws-rule">' + esc(c) + '</span>').join('') + '</div>' : '') +
      (r.infantAllowed === false ? '<p class="ws-note" style="margin-top:6px">' + (EN() ? 'Infants are not allowed on this service.' : 'Este servicio no admite infantes.') + '</p>' : '') +
      (r.note ? '<p class="ws-note" style="margin-top:6px">' + esc(r.note) + '</p>' : '') +
      (errs.length ? '<div style="margin-top:10px">' + UI.alert('bad', errs.map(esc).join('<br>')) + '</div>' : '');
  }
  function drawOpts(el, p) {
    const w = el.querySelector('#ws-optw'); if (!w) return;
    const rc = (p.rates.find(r => r.status === 'vigente') || {}).currency || 'USD';
    w.innerHTML = p.config.map((g, gi) => '<div style="margin-bottom:8px"><div class="xs muted" style="margin-bottom:4px;font-weight:700">' + esc(g.group) + '</div><div class="ws-opt">' + g.options.map((o, oi) => '<button type="button" data-a="opt" data-v="' + gi + ':' + oi + '" class="' + (PS.opts[gi] === oi ? 'on' : '') + '">' + esc(o.label) + (o.delta ? ' (' + (o.delta > 0 ? '+' : '−') + pm0(Math.abs(o.delta), rc) + ')' : '') + '</button>').join('') + '</div></div>').join('');
  }
  function drawLodging(el, p) {
    const w = el.querySelector('#ws-lodw'); if (!w) return;
    const acc = p.accommodation; const cur = acc.currency || 'USD'; const need = PS.pax.adt + PS.pax.chd;
    const it = itemFromPS(p); const q = BE.quote(p, selOf(it, prefs.cur));
    const legs = legsOf(p);
    let html = '<div class="ws-paym ws-lodgopt"><label class="' + (!PS.lodgeOn ? 'on' : '') + '"><input type="radio" name="lodge" data-a="lodge" data-v="0"' + (!PS.lodgeOn ? ' checked' : '') + '><span><b>' + (EN() ? 'Without accommodation' : 'Sin alojamiento') + '</b><small>' + (EN() ? 'I will book my own hotels.' : 'Reservo mis hoteles por mi cuenta.') + '</small></span></label><label class="' + (PS.lodgeOn ? 'on' : '') + '"><input type="radio" name="lodge" data-a="lodge" data-v="1"' + (PS.lodgeOn ? ' checked' : '') + '><span><b>' + (EN() ? 'Include hotels' : 'Incluir hoteles') + '</b><small>' + legs.length + ' ' + (EN() ? 'cities · ' : 'ciudades · ') + sum(legs, 'nights') + ' ' + (EN() ? 'nights' : 'noches') + '</small></span></label></div>';
    if (PS.lodgeOn) {
      html += '<div class="ws-legs">' + legs.map(l => {
        const s = PS.lodging[l.id] || { hotelId: '', rooms: {} }; const h = l.hotels.find(x => x.id === s.hotelId);
        const beds = h ? sum(h.rooms, r => (s.rooms[r.type] || 0) * r.capacity) : 0; const nRooms = h ? sum(Object.values(s.rooms), v => v) : 0;
        const legAmt = sum(q.lines.filter(x => x.kind === 'lodging' && x.legId === l.id), 'amount');
        const capOk = !h || !nRooms || beds >= need || !BE.on('R-LODGING-CAPACITY', p);
        return '<div class="ws-leg-c"><div class="row between" style="flex-wrap:nowrap;gap:8px"><div style="min-width:0"><b>' + esc(l.city) + '</b> <span class="xs faint">· ' + l.nights + ' ' + (l.nights === 1 ? (EN() ? 'night' : 'noche') : (EN() ? 'nights' : 'noches')) + '</span></div>' + (h && nRooms ? '<b class="small nowrap">' + fmtC(legAmt) + '</b>' : '') + '</div>' +
          '<select class="input sm" data-c="hotel" data-leg="' + l.id + '" aria-label="Hotel en ' + esc(l.city) + '" style="margin-top:8px"><option value="">' + (EN() ? 'No accommodation in ' : 'Sin alojamiento en ') + esc(l.city) + '</option>' + l.hotels.map(x => '<option value="' + x.id + '"' + (x.id === s.hotelId ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select>' +
          (h ? '<div class="ws-rooms">' + h.rooms.map(r => '<div class="ws-prow"><div><b class="small">' + esc(r.type) + '</b><small>' + r.capacity + ' ' + (r.capacity === 1 ? (EN() ? 'bed' : 'cama') : (EN() ? 'beds' : 'camas')) + ' · ' + pm(r.price, cur) + (EN() ? '/night' : '/noche') + '</small></div><div class="ws-qty"><button type="button" data-a="room" data-leg="' + l.id + '" data-t="' + esc(r.type) + '" data-d="-1"' + (!(s.rooms[r.type] > 0) ? ' disabled' : '') + ' aria-label="Menos">−</button><b>' + (s.rooms[r.type] || 0) + '</b><button type="button" data-a="room" data-leg="' + l.id + '" data-t="' + esc(r.type) + '" data-d="1"' + ((s.rooms[r.type] || 0) >= 8 ? ' disabled' : '') + ' aria-label="Más">+</button></div></div>').join('') + '</div>' +
            '<div class="ws-beds ' + (capOk ? 'ok' : 'bad') + '">' + smallIc('bed') + ' <span>' + (EN() ? 'Beds ' : 'Camas ') + '<b>' + beds + '</b> · ' + (EN() ? 'people ' : 'personas ') + '<b>' + need + '</b>' + (PS.pax.inf ? ' <span class="faint">(+' + PS.pax.inf + ' ' + (EN() ? 'infant(s) share' : 'infante(s) comparten') + ')</span>' : '') + '</span>' + (!capOk || !nRooms ? '<button class="btn xs" data-a="suggest" data-leg="' + l.id + '">' + (EN() ? 'Suggest rooms' : 'Sugerir habitaciones') + '</button>' : '') + '</div>' : '') + '</div>';
      }).join('') + '</div>' +
        '<div class="ws-lodtot">' + smallIc('bed', 16) + ' <b>' + q.rooms + ' ' + (q.rooms === 1 ? (EN() ? 'room' : 'habitación') : (EN() ? 'rooms' : 'habitaciones')) + ' · ' + q.nights + ' ' + (q.nights === 1 ? (EN() ? 'night' : 'noche') : (EN() ? 'nights' : 'noches')) + '</b><span class="xs faint">' + (EN() ? 'Total rooms across cities · nights with hotel' : 'Total de habitaciones en todas las ciudades · noches con hotel') + '</span></div>';
    }
    w.innerHTML = html;
  }
  function drawAddons(el, p) {
    const w = el.querySelector('#ws-addw'); if (!w) return;
    w.innerHTML = '<div class="ws-addons">' + (p.addons || []).map(ad => {
      const by = PS.addons[ad.id] || {}; const qty = sum(Object.values(by), v => v); const types = (ad.appliesTo || TYPES).filter(ty => PS.pax[tyKey(ty)] > 0);
      const full = types.length && types.every(ty => (by[ty] || 0) >= PS.pax[tyKey(ty)]);
      return '<div class="ws-addon' + (qty ? ' on' : '') + '"><div class="row between top" style="gap:8px;flex-wrap:nowrap"><div style="min-width:0"><b class="small">' + esc(ad.name) + '</b><div class="xs faint">' + esc(ad.category) + ' · ' + pm(ad.price, ad.currency) + ' ' + (ad.per === 'pax' ? (EN() ? 'per person' : 'por persona') : (EN() ? 'per booking' : 'por reserva')) + (ad.stock ? ' · ' + esc(ad.stock) : '') + '</div></div>' + (qty ? '<b class="small nowrap">' + pm(ad.price * qty, ad.currency) + '</b>' : '') + '</div>' +
        (types.length ? '<div class="ws-addq">' + types.map(ty => '<div class="ws-prow"><small>' + TYL(ty) + ' <span class="faint">(' + PS.pax[tyKey(ty)] + ')</span></small><div class="ws-qty sm"><button type="button" data-a="addq" data-id="' + ad.id + '" data-t="' + ty + '" data-d="-1"' + (!(by[ty] > 0) ? ' disabled' : '') + ' aria-label="Menos">−</button><b>' + (by[ty] || 0) + '</b><button type="button" data-a="addq" data-id="' + ad.id + '" data-t="' + ty + '" data-d="1"' + ((by[ty] || 0) >= PS.pax[tyKey(ty)] ? ' disabled' : '') + ' aria-label="Más">+</button></div></div>').join('') + '<button class="btn xs ghost" data-a="addall" data-id="' + ad.id + '" data-v="' + (full ? '0' : '1') + '">' + (full ? (EN() ? 'None' : 'Ninguno') : (EN() ? 'Everyone' : 'Todos')) + '</button></div>' : '<div class="xs faint" style="margin-top:6px">' + (EN() ? 'Not applicable to the selected travelers.' : 'No aplica a los pasajeros elegidos.') + '</div>') + '</div>';
    }).join('') + '</div>';
  }
  function linesHtml(q, o) {
    o = o || {};
    return q.lines.filter(l => l.kind !== 'info' && (o.showRemoved || !l.removed)).map(l => '<div class="l' + (l.removed ? ' rm' : '') + '"><span>' + esc(l.label) + (l.qty > 1 && l.kind !== 'lodging' && l.kind !== 'surcharge' ? ' <span class="faint">× ' + l.qty + '</span>' : '') + '</span><span>' + fmtC(l.amount, q.currency) + '</span></div>').join('') +
      q.lines.filter(l => l.kind === 'info').map(l => '<div class="l faint xs"><span>' + esc(l.label) + '</span><span></span></div>').join('') +
      q.adjustments.map(a => '<div class="l ' + (a.amount < 0 ? 'ok' : 'warn') + '"><span>' + esc(a.label) + '</span><span>' + (a.amount < 0 ? '− ' : '+ ') + fmtC(Math.abs(a.amount), q.currency) + '</span></div>').join('');
  }
  function drawBook(el, p) {
    const b = el.querySelector('#ws-book'); if (!b) return;
    const it = itemFromPS(p); const seats = BE.validatePax(p, PS.pax).seats;
    const di = PS.date ? dayInfo(p, PS.date, seats || 1) : null;
    const q = PS.date ? quoteItem(it, prefs.cur) : null; const fp = fromPrice(p);
    const warn = paxErrors(p, PS.pax).concat(q ? q.warnings.filter(w => !paxErrors(p, PS.pax).includes(w)) : []);
    if (di && !di.ok) warn.unshift(di.why);
    if (!PS.date) warn.unshift(EN() ? 'Choose an available date.' : 'Elija una fecha disponible.');
    const block = !q || !di || !di.ok || paxErrors(p, PS.pax).length || !q.ok || (q.warnings.some(w => /alojan/.test(w)));
    const nPax = PS.pax.adt + PS.pax.chd + PS.pax.inf;
    b.innerHTML = '<div class="hd"><span class="xs faint">' + (q ? t('total') + ' · ' + nPax + ' pax' : t('from')) + '</span><div class="row" style="gap:8px;align-items:baseline"><b style="font-size:1.5rem;font-family:var(--f-display)">' + (q ? fmtC(q.total) : fp ? pm(fp.price, fp.cur) : '—') + '</b>' + (q ? '' : '<span class="small muted">' + t('pp') + '</span>') + '</div></div><div class="bd">' +
      '<div class="field"><label>' + t('date') + '</label><button type="button" class="input" data-a="tocal" style="text-align:left;cursor:pointer;height:auto;min-height:38px">' + (PS.date ? dtw(PS.date) + (di && di.dep ? ' · ' + di.dep.time : '') : (EN() ? 'Choose a date in the calendar' : 'Elija una fecha en el calendario')) + '</button>' + (di && di.ok ? '<div class="xs ok" style="font-weight:600;margin-top:4px">' + (di.onRequest ? t('onreq') : di.free != null ? di.free + ' ' + (EN() ? 'seats left' : 'cupos disponibles') : 'Disponible') + '</div>' : '') + '</div>' +
      '<div class="small">' + paxTxt(PS.pax, ' · ') + ' <button class="btn xs ghost" data-a="tocal">' + ic('edit') + (EN() ? 'Edit' : 'Editar') + '</button></div>' +
      (q ? '<div class="ws-sum">' + linesHtml(q) + (q.rooms ? '<div class="l xs"><span>' + smallIc('bed') + ' ' + q.rooms + ' ' + (EN() ? 'rooms' : 'habitaciones') + ' · ' + q.nights + ' ' + (EN() ? 'nights' : 'noches') + '</span><span></span></div>' : '') + '<div class="l tot"><span>' + t('total') + '</span><span>' + fmtC(q.total) + '</span></div>' +
        '</div>' : '') +
      (q && q.modes.length > 1 ? '<div class="ws-paymodes">' + q.modes.map(m => { const qq = quoteItem(it, prefs.cur, { mode: m }); return '<div><b class="xs">' + modeLbl(m) + '</b><span class="xs">' + (m === 'total' ? fmtC(qq.total) : m === 'adelanto' ? fmtC(qq.deposit) + (EN() ? ' today' : ' hoy') + (qq.balanceDue ? ' · ' + (EN() ? 'balance by ' : 'saldo al ') + dt(qq.balanceDue) : '') : (EN() ? 'S/ 0 today · held ' : '0 hoy · bloqueo ') + qq.holdHours + ' h') + '</span></div>'; }).join('') + '</div>' : '') +
      (warn.length ? UI.alert('warn', warn.map(esc).join('<br>')) : '') +
      fxNote(true) +
      '<button class="btn sun" data-a="buy" style="height:44px;justify-content:center"' + (block ? ' disabled' : '') + '>' + t('book') + '</button><button class="btn primary" data-a="add" style="justify-content:center"' + (block ? ' disabled' : '') + '>' + ic('cart') + t('add') + '</button>' +
      '<div class="ws-2btn"><button class="btn sm" data-a="wa">' + ic('msg') + 'WhatsApp</button><button class="btn sm" data-a="quote">' + ic('edit') + t('quote') + '</button></div>' +
      '<p class="ws-note">' + (BE.on('R-HOLD', p) && di && di.free != null ? (EN() ? 'Seats are held for ' : 'Al añadir al carrito bloqueamos sus cupos por ') + (BE.param('R-HOLD', 'minutes', p) || 30) + ' min. ' : '') + (EN() ? 'You will review every line before paying. Final price is calculated by the server.' : 'Antes de pagar revisará cada línea del pedido. El precio final lo calcula el servidor al confirmar.') + '</p></div>';
    const mb = el.querySelector('#ws-mbp'); if (mb && q) { mb.textContent = fmtC(q.total); el.querySelector('#ws-mbl').textContent = t('total'); el.querySelector('#ws-mbs').textContent = '· ' + nPax + ' pax'; }
  }
  const modeLbl = (m) => ({ total: EN() ? 'Full payment' : 'Pago total', adelanto: EN() ? 'Deposit' : 'Adelanto', pagar_despues: EN() ? 'Pay later' : 'Pagar después' })[m] || m;
  function addToCart(p, go) {
    const it = itemFromPS(p); const seats = BE.validatePax(p, it.pax).seats;
    const errs = paxErrors(p, it.pax); if (errs.length) { UI.toast(errs[0] + ' (R-CHILD-PER-ADULT / R-INFANT-FREE)', 'bad'); return; }
    const di = it.date ? dayInfo(p, it.date, seats) : null;
    if (!di || !di.ok) { UI.toast('Sin disponibilidad para ' + seats + ' pasajero(s) en la fecha elegida' + (di && di.why ? ': ' + esc(di.why) : '') + ' (R-AVAIL-RANGES).', 'bad'); return; }
    const q = quoteItem(it, prefs.cur); if (!q.ok || q.warnings.some(w => /alojan/.test(w))) { UI.toast(esc(q.warnings[0] || 'Revise la selección.'), 'bad'); return; }
    const c = getCart(true);
    it.key = nextId(c.items.map(x => ({ id: x.key })), 'L', 3); it.addedAt = nowStr();
    const h = createHold(c, it); if (h === false) { UI.toast('No fue posible bloquear los cupos: otro cliente acaba de reservarlos. Elija otra fecha.', 'bad'); return; }
    c.items.push(it); c.updatedAt = nowStr(); if (clientUser()) c.clientId = clientUser().clientId;
    Store.save();
    track('add_to_cart', { item_id: p.id, date: it.date, quantity: seats, value: q.total, currency: q.currency, cart: c.id, rooms: q.rooms, nights: q.nights, addons: addonQty(it).length });
    PS = null;
    if (go) { App.go('#/sitio/checkout'); return; }
    UI.toast(esc(pName(p)) + ' ' + (EN() ? 'added to your cart.' : 'se añadió a su carrito.') + (it.holdId ? (EN() ? ' Seats held for ' : ' Cupos bloqueados por ') + (BE.param('R-HOLD', 'minutes', p) || 30) + ' min.' : '') + ' <a href="#/sitio/carrito" style="color:inherit;text-decoration:underline">' + (EN() ? 'View cart' : 'Ver carrito') + '</a>');
    App.render();
  }
  /* Altitud máxima del itinerario (m s. n. m.) por destino; en producción: catalog_destinations.altitude_m */
  const ALT = { D03: 3399, D04: 3399, D05: 2870, D06: 2430, D07: 4200, D08: 5036, D09: 3812, D10: 3812, D11: 2335, D12: 3635, D14: 154, D01: 154, D16: 5 };
  const maxAlt = (p) => Math.max(0, ...[p.destId].concat(p.secondary || []).map(d => ALT[d] || 0));
  const needAlt = (p) => BE.on('R-ALTITUDE', p) && maxAlt(p) >= (BE.param('R-ALTITUDE', 'minAltitude', p) || 3500);
  const nominative = (p) => BE.on('R-NOMINATIVE', p) && /machu picchu|nominativ/i.test([p.name].concat(p.inclusions || [], [(p.paxRules || {}).note || '']).join(' '));

  /* ---------------- v2.2 · Reseñas propias verificadas (R-OWN-REVIEWS; datos en resenas.js → window.OwnReviews) ---------------- */
  const OR = () => window.OwnReviews || null;
  const ownOn = (p) => !!(OR() && OR().visibleOnSite(p));
  const ownStats = (p) => { if (!ownOn(p)) return null; const s = OR().stats(p.id); return s.count ? s : null; };
  const ownTag = () => '<span class="ws-ver">' + smallIc('shield', 13) + (EN() ? 'Verified trip' : 'Viaje verificado') + '</span>';
  const ownDemo = () => '<span class="ws-demo" style="font-size:.66rem;padding:1px 6px">' + (EN() ? 'sample (demo)' : 'ejemplo (demo)') + '</span>';
  const ownLine = (p) => { const s = ownStats(p); return s ? '<div class="row" style="gap:6px">' + stars(s.avg) + '<span class="xs"><b>' + fmtN(s.avg, 1) + '</b> <span class="faint">(' + s.count + ')</span></span>' + ownTag() + '</div>' : ''; };
  let ORF = { pid: null, star: 0, all: false };
  function ownRev(r, home) {
    const subs = Object.entries(r.subratings || {}).filter(([, v]) => v);
    return '<div class="ws-rev"><div class="row between" style="gap:6px">' + stars(r.stars) + '<span class="row" style="gap:6px">' + ownTag() + (r.isDemo ? ownDemo() : '') + '</span></div>' +
      '<b class="small">' + esc(r.title) + '</b><p>“' + esc(r.text) + '”</p>' +
      (subs.length ? '<div class="xs faint">' + subs.map(([k, v]) => esc(EN() ? OR().SUBS_EN[k] : OR().subLabel(k)) + ' ' + v + '/5').join(' · ') + '</div>' : '') +
      (r.reply ? '<div class="ws-reply"><b class="xs">' + (EN() ? 'Response from Andes Horizonte' : 'Respuesta de Andes Horizonte') + '</b><div class="small">' + esc(r.reply.text) + '</div></div>' : '') +
      '<div class="who"><b>' + esc(r.author) + '</b>' + (r.country ? ' · ' + esc(r.country) : '') + ' · ' + (EN() ? 'traveled ' : 'viajó el ') + dt(r.travelDate) + (home && Q.product(r.productId) ? ' · ' + esc(pName(Q.product(r.productId))) : '') + '</div></div>';
  }
  function ownList(p) {
    const all = OR().published(p.id); const f = ORF.pid === p.id ? ORF : (ORF = { pid: p.id, star: 0, all: false });
    const rows = f.star ? all.filter(r => r.stars === f.star) : all; const shown = f.all ? rows : rows.slice(0, 4);
    return '<div class="ws-orf" role="group" aria-label="' + (EN() ? 'Filter by stars' : 'Filtrar por estrellas') + '">' + [0, 5, 4, 3, 2, 1].map(n => { const c = n ? all.filter(r => r.stars === n).length : all.length; return '<button class="btn xs' + (f.star === n ? ' primary' : '') + '" data-a="orf" data-v="' + n + '"' + (n && !c ? ' disabled' : '') + '>' + (n ? n + ' ★' : (EN() ? 'All' : 'Todas')) + ' (' + c + ')</button>'; }).join('') + '</div>' +
      (shown.length ? '<div class="grid g2" style="margin-top:12px">' + shown.map(r => ownRev(r)).join('') + '</div>' : '<p class="small muted" style="margin-top:10px">' + (EN() ? 'No reviews with this rating.' : 'No hay reseñas con esa calificación.') + '</p>') +
      (rows.length > shown.length ? '<div class="center" style="margin-top:12px"><button class="btn sm" data-a="orm">' + (EN() ? 'Show all ' : 'Ver las ') + rows.length + (EN() ? ' reviews' : ' reseñas') + '</button></div>' : '');
  }
  function ownReviewsBlock(p) {
    const s = ownStats(p); if (!s) return '';
    const subs = OR().activeSubs().filter(([k]) => s.subs[k]);
    return '<div class="ws-block" id="ws-ownrev"><div class="row between" style="margin-bottom:10px;gap:8px"><h2 style="margin:0">' + (EN() ? 'Reviews from verified travelers' : 'Reseñas de viajeros verificados') + '</h2>' + (OR().published(p.id).some(r => r.isDemo) ? '<span class="ws-demo">' + ic('info') + (EN() ? 'Sample reviews (demo)' : 'Reseñas de ejemplo (demo)') + '</span>' : '') + '</div>' +
      '<div class="ws-ownsum"><div><div class="big">' + fmtN(s.avg, 1) + '</div>' + stars(s.avg) + '<div class="xs faint">' + s.count + ' ' + (EN() ? (s.count === 1 ? 'verified review' : 'verified reviews') : (s.count === 1 ? 'reseña verificada' : 'reseñas verificadas')) + ' · ' + fmtN(s.rec, 0) + ' % ' + (EN() ? 'recommend' : 'recomienda') + '</div></div>' +
      '<div class="bars">' + [5, 4, 3, 2, 1].map(n => '<div class="row" style="gap:8px;flex-wrap:nowrap"><span class="xs" style="width:26px">' + n + ' ★</span><div class="grow">' + UI.progress(s.count ? s.dist[n - 1] / s.count * 100 : 0, 'sun') + '</div><span class="xs faint" style="width:18px;text-align:right">' + s.dist[n - 1] + '</span></div>').join('') + '</div>' +
      (subs.length ? '<div class="subs">' + subs.map(([k, l]) => '<div class="row between xs" style="gap:8px"><span>' + esc(EN() ? OR().SUBS_EN[k] : l) + '</span><b>' + fmtN(s.subs[k].avg, 1) + '</b></div>').join('') + '</div>' : '') + '</div>' +
      '<p class="xs faint" style="margin:10px 0 0">' + (EN() ? 'Only travelers with a completed booking can review. The agency moderates offensive content and personal data, never by rating.' : 'Solo opinan pasajeros con una reserva realizada. La agencia modera lenguaje ofensivo y datos personales, nunca por la calificación.') + '</p>' +
      '<div id="ws-ownlist" style="margin-top:12px">' + ownList(p) + '</div></div>';
  }
  function ownHome() {
    if (!ownOn(null)) return '';
    const pubOk = OR().published().filter(r => { const p = Q.product(r.productId); return p && ownOn(p) && siteProducts().includes(p); });
    const list = pubOk.slice(0, 3); if (!list.length) return '';
    const s = OR().stats(null, pubOk);
    return '<section class="ws-sec" id="ws-ownrev"><div class="ws-wrap"><div class="ws-sech"><div><h2 class="ws-h2">' + (EN() ? 'Verified traveler reviews' : 'Opiniones de viajeros verificados') + '</h2><p class="ws-subt">' + stars(s.avg) + ' <b>' + fmtN(s.avg, 1) + '</b>/5 · ' + s.count + ' ' + (EN() ? 'reviews from real bookings' : 'reseñas de reservas reales') + '</p></div>' + (list.some(r => r.isDemo) ? '<span class="ws-demo">' + ic('info') + (EN() ? 'Sample reviews (demo)' : 'Reseñas de ejemplo (demo)') + '</span>' : '') + '</div><div class="ws-grid g3">' + list.map(r => ownRev(r, true)).join('') + '</div></div></section>';
  }

  /* ---------------- Reseñas externas (DB.reviewIntegrations / DB.externalReviews, dueño experiencia.js) ---------------- */
  const revConnected = (i) => i && (i.connected === true || ['conectada', 'conectado', 'connected', 'activa', 'activo', 'active'].includes(String(i.status || '').toLowerCase()));
  const revName = (i) => i.name || i.provider || i.source || i.id;
  /* Una reseña pertenece a una integración si su `source` es el id o el nombre de la integración */
  const revOf = (i, r) => { const s2 = String(r.source || r.provider || '').toLowerCase(); return r.integrationId === i.id || s2 === String(i.id).toLowerCase() || s2 === String(revName(i)).toLowerCase(); };
  function extReviews(pid) {
    const ints = (DB.reviewIntegrations || []).filter(revConnected); if (!ints.length) return null;
    const rows = (DB.externalReviews || []).filter(r => ints.some(i => revOf(i, r)) && !['oculta', 'hidden', 'rechazada'].includes(r.status) && (!pid || r.productId === pid || (r.productIds || []).includes(pid)));
    rows.forEach(r => { const i = ints.find(x => revOf(x, r)); r._src = i ? revName(i) : (r.source || ''); });
    const bySrc = ints.map(i => { const mine = rows.filter(r => revOf(i, r)); const avg = pid ? (mine.length ? sum(mine, r => +r.rating || 0) / mine.length : 0) : (i.rating || i.avgRating || (mine.length ? sum(mine, r => +r.rating || 0) / mine.length : 0)); return { i, name: revName(i), avg: +avg || 0, count: pid ? mine.length : (i.count || i.reviewsCount || i.reviewCount || mine.length), rows: mine }; }).filter(s2 => !pid || s2.count);
    return { bySrc, rows: rows.sort((a2, b2) => String(b2.date || '').localeCompare(String(a2.date || ''))) };
  }
  function extReviewsBlock(p, home) {
    const x = extReviews(p ? p.id : null); if (!x) return '';
    const rv = (r) => '<div class="ws-rev"><div class="row between">' + stars(+r.rating || 0) + '<span class="xs faint">' + esc(r._src || '') + (r.date || r.createdAt ? ' · ' + dt(String(r.date || r.createdAt).slice(0, 10)) : '') + '</span></div>' + (r.title ? '<b class="small">' + esc(r.title) + '</b>' : '') + '<p>“' + esc(r.text || r.body || r.comment || '') + '”</p><div class="who"><b>' + esc(r.author || r.name || r.reviewer || 'Viajero') + '</b>' + (r.country || r.from ? ' · ' + esc(r.country || r.from) : '') + (home && r.productId && Q.product(r.productId) ? ' · ' + esc(pName(Q.product(r.productId))) : '') + '</div></div>';
    const srcCards = !x.bySrc.length ? '' : '<div class="ws-srcs">' + x.bySrc.map(s => '<div class="ws-src"><b>' + esc(s.name) + '</b><div class="row" style="gap:6px">' + stars(s.avg) + '<span class="small"><b>' + fmtN(s.avg, 1) + '</b>/5</span></div><span class="xs faint">' + fmtN(s.count, 0) + ' ' + (EN() ? 'reviews' : 'reseñas') + (s.i.lastSync ? ' · ' + (EN() ? 'synced ' : 'sincronizado ') + esc(String(s.i.lastSync).slice(0, 16)) : '') + '</span></div>').join('') + '</div>';
    const list = x.rows.slice(0, home ? 6 : 4);
    const demo = '<span class="ws-demo">' + ic('info') + (EN() ? 'Sample reviews (demo)' : 'Reseñas de ejemplo (demo)') + '</span>';
    if (home) return '<section class="ws-sec alt" id="ws-extrev"><div class="ws-wrap"><div class="ws-sech"><div><h2 class="ws-h2">' + t('rev_t') + '</h2><p class="ws-subt">' + (EN() ? 'Summary by source' : 'Resumen por fuente') + '</p></div>' + demo + '</div>' + srcCards + (list.length ? '<div class="ws-grid g3" style="margin-top:16px">' + list.map(rv).join('') + '</div>' : '') + '</div></section>';
    return '<div class="ws-block" id="ws-extrev"><div class="row between" style="margin-bottom:10px"><h2 style="margin:0">' + t('reviews') + '</h2>' + demo + '</div>' + srcCards + (list.length ? '<div class="grid g2" style="margin-top:12px">' + list.map(rv).join('') + '</div>' : '<p class="small muted" style="margin-top:10px">' + (EN() ? 'No reviews for this product yet.' : 'Aún no hay reseñas de este producto en las fuentes conectadas.') + '</p>') + '</div>';
  }

  /* ================= CARRITO ================= */
  const holdBanner = (c) => {
    const live = c.items.filter(holdLive); if (!live.length) return '';
    const min = Math.min(...live.map(x => x.holdUntil));
    return '<div class="ws-hold">' + ic('lock') + '<div class="grow">' + t('hold') + ' <b data-hold="' + min + '">--:--</b>. ' + (EN() ? 'Complete your purchase before the hold expires; afterwards seats return to general availability.' : 'Complete su compra antes de que venza el bloqueo; luego los cupos vuelven a la disponibilidad general.') + '</div></div>';
  };
  function itemSummary(it, q) {
    const p = Q.product(it.pid); const out = [paxTxt(it.pax, ', ')];
    if (q.rooms) out.push(q.rooms + ' ' + (EN() ? 'rooms' : 'hab.') + ' · ' + q.nights + ' ' + (EN() ? 'nights' : 'noches'));
    else if (lodgingOn(p)) out.push(EN() ? 'no accommodation' : 'sin alojamiento');
    const ads = q.lines.filter(l => l.kind === 'addon' && !l.removed); if (ads.length) out.push(ads.map(l => esc(l.label) + ' ×' + l.qty).join(', '));
    return out.join(' · ');
  }
  function pCart() {
    const c = getCart(false);
    if (!c || !c.items.length) return { title: t('cart'), desc: '', html: crumbs([[t('cart')]]) + pageH(t('cart')) + '<div class="ws-wrap" style="padding-bottom:60px"><div class="ws-block">' + UI.empty(t('empty_cart'), 'cart') + '<div class="row" style="justify-content:center"><a class="btn primary" href="#/sitio/buscar">' + (EN() ? 'Browse tours' : 'Ver tours') + '</a></div></div></div>' };
    const k = calcCart(c, prefs.cur);
    const html = crumbs([[t('cart')]]) + pageH(t('cart') + ' (' + c.items.length + ')', EN() ? 'You can combine several products and dates in one purchase.' : 'Puede combinar varios productos y fechas en una sola compra.') +
      '<div class="ws-wrap ws-cart"><div class="stack" style="min-width:0">' + holdBanner(c) + k.lines.map(({ it, p, q }) => {
        const h = holdOf(it); const expired = h && h.status !== 'hold' && h.status !== 'confirmada'; const live = holdLive(it);
        return '<div class="ws-ci">' + imgBox(p.hue, 0, '') + '<div style="min-width:0"><a href="#/sitio/tour/' + slugOf(p) + '"><b>' + esc(pName(p)) + '</b></a><div class="small muted">' + dtw(it.date) + '</div>' +
          '<div class="small">' + itemSummary(it, q) + '</div>' + (q.promoLbl ? '<div class="xs ok" style="font-weight:700">' + esc(q.promoLbl) + '</div>' : '') +
          (h ? (live ? '<div class="xs warn" style="font-weight:700;margin-top:4px">' + smallIc('lock', 12) + ' ' + (EN() ? 'Seats held' : 'Cupos bloqueados') + ' (' + esc(h.id) + ')</div>' : expired ? '<div class="xs bad" style="font-weight:700;margin-top:4px">' + (EN() ? 'Hold expired. ' : 'El bloqueo venció. ') + '<button class="btn xs" data-a="renew" data-k="' + it.key + '">' + (EN() ? 'Hold again' : 'Volver a bloquear') + '</button></div>' : '') : '') +
          '</div><div class="pr" style="text-align:right"><b>' + fmtC(q.total) + '</b><div class="row" style="gap:4px;justify-content:flex-end;margin-top:6px"><button class="btn xs ghost" data-a="rm" data-k="' + it.key + '">' + ic('trash') + (EN() ? 'Remove' : 'Quitar') + '</button></div></div></div>';
      }).join('') +
      '<div class="ws-block"><h2>' + (EN() ? 'Complete your trip' : 'Complete su viaje') + '</h2><div class="ws-grid">' + siteProducts().filter(p => !c.items.some(i => i.pid === p.id)).slice(0, 3).map(card).join('') + '</div></div></div>' +
      '<aside class="ws-block ws-side"><h2>' + (EN() ? 'Summary' : 'Resumen') + '</h2><div class="ws-sum">' + k.lines.map(x => '<div class="l"><span>' + esc(pName(x.p)) + '</span><span>' + fmtC(x.q.total) + '</span></div>').join('') + (k.promoDisc ? '<div class="l ok xs"><span>' + t('discount') + ' ' + esc(c.promo) + '</span><span>− ' + fmtC(k.promoDisc) + '</span></div>' : '') + '<div class="l tot"><span>' + t('total') + '</span><span>' + fmtC(k.total) + '</span></div></div>' +
      (k.lines.some(x => BE.on('R-PROMO', x.p)) ? '<div class="row" style="margin:12px 0 4px;flex-wrap:nowrap;gap:6px"><input class="input sm" id="ws-promo" placeholder="' + (EN() ? 'Promo code' : 'Código promocional') + '" value="' + esc(c.promo) + '" style="text-transform:uppercase"><button class="btn sm" data-a="promo">' + (EN() ? 'Apply' : 'Aplicar') + '</button></div>' +
        (c.promo ? (k.promoOk ? '<div class="xs ok" style="font-weight:700">' + (EN() ? 'Code ' : 'Código ') + esc(c.promo) + (EN() ? ' applied.' : ' aplicado.') + ' <button class="btn xs ghost" data-a="unpromo">' + (EN() ? 'Remove' : 'Quitar') + '</button></div>' : '<div class="xs bad">' + (EN() ? 'Code not valid for the products in your cart or expired.' : 'El código no aplica a los productos de su carrito o no está vigente.') + '</div>') : '') : '') +
      fxNote(true) + '<p class="ws-note" style="margin:6px 0 10px">' + (EN() ? 'Final price calculated by the server at checkout (PROC-018).' : 'Precio final calculado por el servidor al confirmar (PROC-018). En el siguiente paso podrá revisar y quitar adicionales y alojamiento.') + '</p>' +
      '<button class="btn sun" data-a="go" style="width:100%;height:44px;justify-content:center">' + t('checkout') + '</button><a class="btn" href="#/sitio/buscar" style="width:100%;justify-content:center;margin-top:8px">' + t('keep') + '</a>' +
      '<div class="ws-kv" style="margin-top:14px"><div>' + ic('lock') + '<span class="small muted">' + (EN() ? 'Secure payment · Visa, Mastercard, Amex, Diners, Yape, transfer' : 'Pago seguro · Visa, Mastercard, Amex, Diners, Yape, transferencia') + '</span></div>' + (k.modes.includes('adelanto') ? '<div>' + ic('coins') + '<span class="small muted">' + (EN() ? 'Pay a deposit and the balance later.' : 'Pague un adelanto y el saldo después.') + '</span></div>' : '') + '</div></aside></div>';
    return { title: t('cart'), desc: '', html, after: (el) => {
      track('view_cart', { cart: c.id, value: k.total, currency: k.cur, items: c.items.length });
      on('rm', (b) => { const i = c.items.findIndex(x => x.key === b.dataset.k); if (i < 0) return; const it = c.items[i]; releaseHold(it, 'eliminado del carrito ' + c.id); c.items.splice(i, 1); c.updatedAt = nowStr(); Store.save(); track('remove_from_cart', { item_id: it.pid }); App.render(); });
      on('renew', (b) => { const it = c.items.find(x => x.key === b.dataset.k); const h = createHold(c, it); if (h === false) { UI.toast('Ya no hay cupos suficientes en esa fecha. Quite el producto o elija otra fecha.', 'bad'); return; } Store.save(); UI.toast('Cupos bloqueados nuevamente.'); App.render(); });
      on('promo', () => { c.promo = el.querySelector('#ws-promo').value.trim().toUpperCase(); Store.save(); const ok = calcCart(c).promoOk; track('apply_promo', { code: c.promo, ok }); UI.toast(ok ? 'Código ' + esc(c.promo) + ' aplicado.' : 'El código no aplica a los productos del carrito.', ok ? 'ok' : 'bad'); App.render(); });
      on('unpromo', () => { c.promo = ''; Store.save(); App.render(); });
      on('go', () => App.go('#/sitio/checkout'));
    } };
  }

  /* ================= CHECKOUT =================
     Pasos dinámicos según reglas: Titular → Acompañantes (R-COMPANIONS) → Recojo y comentarios (R-PICKUP / R-COMMENTS)
     → Previsualización obligatoria (R-PREVIEW-REMOVE habilita «Quitar») → Pago (R-DEPOSIT, R-PAY-LATER, R-PAY-FEE, R-ALTITUDE) */
  let CO = null;
  const REL = ['Titular', 'Cónyuge / pareja', 'Hijo/a', 'Padre / madre', 'Hermano/a', 'Amigo/a', 'Otro'];
  const NATS = ['Peruana', 'Argentina', 'Boliviana', 'Brasileña', 'Chilena', 'Colombiana', 'Ecuatoriana', 'Mexicana', 'Estadounidense', 'Canadiense', 'Española', 'Alemana', 'Francesa', 'Británica', 'Italiana', 'Otra'];
  function paxNeeds(c) { return { adt: Math.max(0, ...c.items.map(i => normItem(i).pax.adt)), chd: Math.max(0, ...c.items.map(i => i.pax.chd)), inf: Math.max(0, ...c.items.map(i => i.pax.inf)) }; }
  const cartProds = (c) => c.items.map(i => Q.product(i.pid)).filter(Boolean);
  const compProd = (c) => cartProds(c).find(p => BE.on('R-COMPANIONS', p)) || null;
  const pickItems = (c) => c.items.filter(it => { const p = Q.product(it.pid); return p && ((BE.on('R-PICKUP', p) && p.pickup) || BE.on('R-COMMENTS', p)); });
  function coSteps(c) { const k = ['titular']; if (CO.pax.length > 1 && compProd(c)) k.push('acomp'); if (pickItems(c).length) k.push('recojo'); k.push('preview', 'pago'); return k; }
  const STEPL = { titular: ['Titular', 'Lead traveler'], acomp: ['Acompañantes', 'Companions'], recojo: ['Recojo y comentarios', 'Pickup & comments'], preview: ['Previsualización', 'Preview'], pago: ['Pago', 'Payment'] };
  const ageAt = (birth, on) => { if (!birth) return null; const b = parseD(birth), d = parseD(on); let a = d.getFullYear() - b.getFullYear(); if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--; return a; };
  const blankPax = (ty) => ({ type: ty, first: '', last: '', doctype: ty === 'ADT' ? 'DNI' : 'DNI', doc: '', nat: 'Peruana', birth: '', rel: ty === 'ADT' ? 'Cónyuge / pareja' : 'Hijo/a', email: '', phone: '', diet: '' });
  /* Valida la edad de un pasajero contra el tipo elegido en CADA ítem del carrito donde viaja (BE.ageType) */
  function ageErr(c, x, idxInType) {
    if (!x.birth) return '';
    for (const it of c.items) { const p = Q.product(it.pid); if (!p || idxInType >= it.pax[tyKey(x.type)]) continue; const a = ageAt(x.birth, it.date); const ty = BE.ageType(p, a); if (a < 0) return 'Fecha de nacimiento no válida.'; if (ty !== x.type) { const r = BE.paxRules(p); return 'Tendrá ' + a + ' años el ' + dt(it.date) + ': en «' + pName(p) + '» corresponde a ' + (ty === 'NA' ? 'una edad no admitida' : TY1(ty).toLowerCase() + ' (' + ageBand(r, ty) + ')') + ', no a ' + TY1(x.type).toLowerCase() + ' (' + ageBand(r, x.type) + ').'; } }
    return '';
  }
  const idxInType = (i) => CO.pax.slice(0, i).filter(y => y.type === CO.pax[i].type).length;
  const payOpts = () => ({ mode: CO.payMode, method: CO.payMode === 'pagar_despues' ? null : CO.method });
  function pCheckout() {
    const c = getCart(false);
    if (!c || !c.items.length) return { title: 'Checkout', html: crumbs([['Checkout']]) + '<div class="ws-wrap ws-sec">' + UI.alert('info', (EN() ? 'Your cart is empty. ' : 'Su carrito está vacío. ') + '<a href="#/sitio/buscar">' + (EN() ? 'Browse tours' : 'Ver tours') + '</a>') + '</div>' };
    c.items.forEach(normItem);
    if (!CO || CO.cartId !== c.id) {
      const u = clientUser(); const cli = u ? Q.client(u.clientId) : null;
      const [dt0, dn0] = cli ? String(cli.doc || '').split(' ') : ['DNI', ''];
      const parts = cli ? cli.name.split(' ') : []; const hh = Math.ceil(parts.length / 2);
      CO = { cartId: c.id, key: 'titular', buyer: { first: parts.slice(0, hh).join(' '), last: parts.slice(hh).join(' '), email: cli ? cli.email : '', phone: cli ? cli.phone : '', country: cli ? cli.country || 'Perú' : 'Perú', doctype: ['DNI', 'Pasaporte', 'CE'].includes(dt0) ? dt0 : 'DNI', doc: dn0 || '', nat: 'Peruana', birth: cli ? cli.birth || '' : '', receipt: 'Boleta', ruc: '', company: '', fiscal: '' }, pax: [], later: false, pick: {}, comments: {}, accept: { terms: false, cancel: false, privacy: false, marketing: false }, payMode: SC_MODE || 'total', method: 'card', card: {}, altitude: false, orderId: null, began: false }; SC_MODE = null;
    }
    { /* Sincroniza la lista de pasajeros si el carrito cambió (titular = primer pasajero) */
      const need = paxNeeds(c); const want = [].concat(Array(need.adt).fill('ADT'), Array(need.chd).fill('CHD'), Array(need.inf).fill('INF'));
      if (want.join() !== CO.pax.map(x => x.type).join()) { const pool = CO.pax.slice(1); CO.pax = want.map((ty, i) => { if (i === 0) return Object.assign(blankPax(ty), { rel: 'Titular' }); const j = pool.findIndex(x => x.type === ty); return j >= 0 ? pool.splice(j, 1)[0] : blankPax(ty); }); }
    }
    const steps = coSteps(c); if (!steps.includes(CO.key)) CO.key = 'titular';
    const K = calcCart(c, prefs.cur, payOpts()); if (!K.modes.includes(CO.payMode)) CO.payMode = K.modes[0];
    if (!CO.began) { CO.began = true; track('begin_checkout', { cart: c.id, value: K.total, currency: K.cur, items: c.items.map(i => i.pid) }); }
    const si = steps.indexOf(CO.key);
    const summary = '<aside class="ws-block ws-side"><h2>' + (EN() ? 'Your order' : 'Su pedido') + '</h2>' + holdBanner(c) + '<div class="stack" style="gap:10px;margin-top:10px">' + K.lines.map(({ it, p, q }) => '<div class="row top" style="gap:10px;flex-wrap:nowrap"><div style="width:56px;flex:none">' + imgBox(p.hue, 0, '') + '</div><div class="grow" style="min-width:0"><b class="small">' + esc(pName(p)) + '</b><div class="xs faint">' + dt(it.date) + ' · ' + itemSummary(it, q) + '</div></div><b class="small nowrap">' + fmtC(q.total) + '</b></div>').join('') + '</div><div class="ws-sum" style="margin-top:12px"><div class="l tot"><span>' + t('total') + '</span><span>' + fmtC(K.total) + '</span></div>' +
      (K.mode === 'adelanto' ? '<div class="l"><span>' + (EN() ? 'Deposit today' : 'Adelanto hoy') + ' (' + K.depositPct + ' %)</span><span>' + fmtC(K.deposit) + '</span></div><div class="l faint"><span>' + (EN() ? 'Balance' : 'Saldo') + (K.balanceDue ? ' · ' + dt(K.balanceDue) : '') + '</span><span>' + fmtC(K.balance) + '</span></div>' : K.mode === 'pagar_despues' ? '<div class="l"><span>' + (EN() ? 'Pay today' : 'Pago hoy') + '</span><span>' + fmtC(0) + '</span></div>' : '') + '</div>' + fxNote(true) +
      '<a href="#/sitio/carrito" class="btn sm" style="margin-top:8px">' + ic('edit') + (EN() ? 'Edit cart' : 'Editar carrito') + '</a></aside>';
    const body = ({ titular: stepTitular, acomp: stepAcomp, recojo: stepRecojo, preview: stepPreview, pago: stepPay })[CO.key](c, K, steps);
    const html = crumbs([[t('cart'), '#/sitio/carrito'], ['Checkout']]) + '<div class="ws-wrap"><div class="ws-steps">' + UI.flow(steps.map(s => STEPL[s][EN() ? 1 : 0]).concat([EN() ? 'Confirmation' : 'Confirmación']), si) + '</div></div><div class="ws-wrap ws-cart"><div class="stack" style="min-width:0">' + (clientUser() || si ? '' : UI.alert('info', (EN() ? 'Already a customer? ' : '¿Ya es cliente? ') + '<a href="#/sitio/cuenta?volver=checkout"><b>' + (EN() ? 'Sign in' : 'Inicie sesión') + '</b></a>' + (EN() ? ' to autofill your details, or continue as a guest.' : ' para completar sus datos automáticamente, o continúe como invitado.'))) + body.html + '</div>' + summary + '</div>';
    const goStep = (d) => { CO.key = steps[Math.max(0, Math.min(steps.length - 1, si + d))]; App.render(); window.scrollTo(0, 0); };
    return { title: 'Checkout', desc: '', html, after: (el) => { body.after && body.after(el, goStep); } };
  }
  const fld = (id, label, val, o) => { o = o || {}; return '<div class="field c' + (o.col || 6) + '"><label for="' + id + '">' + esc(label) + (o.req === false ? '' : ' <span class="req">*</span>') + '</label>' + (o.opts ? '<select class="input" id="' + id + '">' + o.opts.map(x => '<option' + (x === val ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select>' : '<input class="input" id="' + id + '" type="' + (o.type || 'text') + '" value="' + esc(val || '') + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.max ? ' max="' + o.max + '"' : '') + (o.maxlength ? ' maxlength="' + o.maxlength + '"' : '') + '>') + (o.hint ? '<div class="hint">' + esc(o.hint) + '</div>' : '') + '</div>'; };
  const markErr = (el, id, msg) => { const i = el.querySelector('#' + id); if (!i) return; i.classList.add('err'); const f = i.closest('.field'); if (f && !f.querySelector('.errmsg')) f.insertAdjacentHTML('beforeend', '<div class="errmsg">' + esc(msg) + '</div>'); };
  const clearErr = (el) => { el.querySelectorAll('.errmsg').forEach(x => x.remove()); el.querySelectorAll('.input.err').forEach(x => x.classList.remove('err')); };
  function validDoc(type, doc) { const d = String(doc || '').trim(); if (type === 'DNI') return /^\d{8}$/.test(d); if (type === 'RUC') return /^(10|15|17|20)\d{9}$/.test(d); if (type === 'CE') return /^[A-Z0-9]{9,12}$/i.test(d); return /^[A-Z0-9]{6,15}$/i.test(d); }
  const navBtns = (back, nextLbl, nextCls) => '<div class="row end">' + (back ? '<button class="btn" data-a="back">' + ic('chevronLeft') + (EN() ? 'Back' : 'Volver') + '</button>' : '<a class="btn" href="#/sitio/carrito">' + ic('chevronLeft') + (EN() ? 'Back' : 'Volver') + '</a>') + '<button class="btn ' + (nextCls || 'primary') + '" data-a="next">' + (nextLbl || (EN() ? 'Continue' : 'Continuar')) + ic('chevronRight') + '</button></div>';
  function stepTitular(c) {
    const b = CO.buyer; const ty = CO.pax[0] ? CO.pax[0].type : 'ADT'; const p0 = cartProds(c)[0]; const r0 = BE.paxRules(p0);
    return { html: '<div class="ws-block"><h2>' + (EN() ? 'Lead traveler (booking holder)' : 'Titular de la reserva') + '</h2><p class="small muted" style="margin-bottom:12px">' + (EN() ? 'The lead traveler also travels and is the contact for the booking.' : 'El titular viaja, es el pasajero 1 y el contacto de la reserva (' + TY1(ty).toLowerCase() + ', ' + ageBand(r0, ty) + ').') + '</p><div class="form-grid">' +
      fld('b-first', 'Nombres', b.first) + fld('b-last', 'Apellidos', b.last) + fld('b-email', 'Correo electrónico', b.email, { type: 'email', hint: 'Recibirá la confirmación, los vouchers y los mensajes del viaje.' }) + fld('b-phone', 'Celular / WhatsApp', b.phone, { hint: 'Con código de país si es del extranjero.' }) +
      fld('b-doctype', 'Tipo de documento', b.doctype, { col: 3, opts: ['DNI', 'Pasaporte', 'CE'] }) + fld('b-doc', 'Número de documento', b.doc, { col: 3 }) + fld('b-nat', 'Nacionalidad', b.nat, { col: 3, opts: NATS }) + fld('b-birth', 'Fecha de nacimiento', b.birth, { col: 3, type: 'date', max: T() }) +
      fld('b-country', 'País de residencia', b.country, { opts: ['Perú', 'Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Ecuador', 'México', 'Estados Unidos', 'Canadá', 'España', 'Alemania', 'Francia', 'Reino Unido', 'Italia', 'Otro'] }) + fld('b-diet', 'Restricciones alimentarias', b.diet || '', { req: false, ph: 'Ej.: vegetariano, sin gluten' }) +
      '<div class="section-title">' + (EN() ? 'Receipt' : 'Comprobante de pago') + '</div><div class="c12 ws-paym ws-2opt"><label class="' + (b.receipt === 'Boleta' ? 'on' : '') + '"><input type="radio" name="rc" value="Boleta"' + (b.receipt === 'Boleta' ? ' checked' : '') + '><span><b>Boleta de venta</b><small>A nombre del titular.</small></span></label><label class="' + (b.receipt === 'Factura' ? 'on' : '') + '"><input type="radio" name="rc" value="Factura"' + (b.receipt === 'Factura' ? ' checked' : '') + '><span><b>Factura</b><small>Para empresas o personas con RUC.</small></span></label></div>' +
      (b.receipt === 'Factura' ? fld('b-ruc', 'RUC', b.ruc, { col: 4, hint: '11 dígitos (10…, 20…).' }) + fld('b-company', 'Razón social', b.company, { col: 8 }) + fld('b-fiscal', 'Dirección fiscal', b.fiscal, { col: 12 }) : '') + '</div></div>' + navBtns(false),
      after: (el, goStep) => {
        const read = () => { const g = (id) => { const i = el.querySelector('#' + id); return i ? i.value.trim() : ''; }; Object.assign(CO.buyer, { first: g('b-first'), last: g('b-last'), email: g('b-email').toLowerCase(), phone: g('b-phone'), country: g('b-country'), doctype: g('b-doctype'), doc: g('b-doc').toUpperCase(), nat: g('b-nat'), birth: g('b-birth'), diet: g('b-diet') }); if (el.querySelector('#b-ruc')) Object.assign(CO.buyer, { ruc: g('b-ruc'), company: g('b-company'), fiscal: g('b-fiscal') }); syncLead(); };
        el.querySelectorAll('input[name=rc]').forEach(r => r.onchange = () => { read(); CO.buyer.receipt = r.value; App.render(); });
        on('next', () => {
          read(); clearErr(el); const b2 = CO.buyer; let ok = true;
          if (!b2.first) { markErr(el, 'b-first', 'Obligatorio.'); ok = false; } if (!b2.last) { markErr(el, 'b-last', 'Obligatorio.'); ok = false; }
          if (!emailOk(b2.email)) { markErr(el, 'b-email', 'Correo no válido.'); ok = false; }
          if (String(b2.phone).replace(/\D/g, '').length < 7) { markErr(el, 'b-phone', 'Teléfono no válido.'); ok = false; }
          if (!validDoc(b2.doctype, b2.doc)) { markErr(el, 'b-doc', b2.doctype === 'DNI' ? 'El DNI debe tener 8 dígitos.' : 'Documento no válido.'); ok = false; }
          if (!b2.birth) { markErr(el, 'b-birth', 'Obligatorio.'); ok = false; } else { const e = ageErr(c, CO.pax[0], 0); if (e) { markErr(el, 'b-birth', e); ok = false; } }
          if (b2.receipt === 'Factura') { if (!validDoc('RUC', b2.ruc)) { markErr(el, 'b-ruc', 'RUC no válido (11 dígitos, inicia en 10, 15, 17 o 20).'); ok = false; } if (!b2.company) { markErr(el, 'b-company', 'Obligatorio.'); ok = false; } if (!b2.fiscal) { markErr(el, 'b-fiscal', 'Obligatorio.'); ok = false; } }
          if (!ok) { UI.toast('Revise los datos marcados.', 'bad'); return; }
          goStep(1);
        });
      } };
  }
  function syncLead() { const b = CO.buyer, x = CO.pax[0]; if (!x) return; Object.assign(x, { first: b.first, last: b.last, doctype: b.doctype, doc: b.doc, nat: b.nat, birth: b.birth, rel: 'Titular', email: b.email, phone: b.phone, diet: b.diet || '' }); }
  function stepAcomp(c) {
    const p = compProd(c); const when = BE.param('R-COMPANIONS', 'when', p); const later = when === 'antes_de_viaje';
    const reqDoc = BE.param('R-COMPANIONS', 'requireDocument', p) !== false || cartProds(c).some(nominative);
    const daysB = BE.param('R-COMPANIONS', 'daysBeforeIfLater', p) || 7; const first = c.items.map(i => i.date).sort()[0];
    const r0 = BE.paxRules(p);
    const opt = CO.later ? { req: false } : {};
    return { html: '<div class="ws-block"><h2>' + (EN() ? 'Companions' : 'Datos de los acompañantes') + '</h2><p class="small muted" style="margin-bottom:12px">' + (EN() ? 'Register each companion as shown on their ID.' : 'Registre a cada acompañante tal como figura en su documento') + (cartProds(c).some(nominative) ? ' (las entradas a Machu Picchu y los boletos de tren son nominativos: R-NOMINATIVE)' : '') + '. ' + (EN() ? 'Age is validated against the traveler type.' : 'La edad se valida contra el tipo de pasajero elegido.') + '</p>' +
      (later ? '<label class="check ws-later"><input type="checkbox" id="cp-later"' + (CO.later ? ' checked' : '') + '> <span>' + (EN() ? 'I will complete my companions’ details later from my account' : 'Completaré los datos de mis acompañantes más tarde desde Mi cuenta / portal del cliente') + ' <span class="faint">(' + (EN() ? 'until ' : 'hasta el ') + dt(addDays(first, -daysB)) + ')</span></span></label>' : '') +
      CO.pax.slice(1).map((x, j) => { const i = j + 1; return '<div class="section-title" style="margin:14px 0 10px">' + (EN() ? 'Companion ' : 'Acompañante ') + i + ' · ' + TY1(x.type) + ' <span class="faint" style="font-weight:500">(' + ageBand(r0, x.type) + ')</span></div><div class="form-grid">' +
        fld('p' + i + '-first', 'Nombres', x.first, Object.assign({ col: 4 }, opt)) + fld('p' + i + '-last', 'Apellidos', x.last, Object.assign({ col: 4 }, opt)) + fld('p' + i + '-birth', 'Fecha de nacimiento', x.birth, Object.assign({ col: 4, type: 'date', max: T() }, opt)) +
        fld('p' + i + '-doctype', 'Documento', x.doctype, { col: 2, opts: ['DNI', 'Pasaporte', 'CE'] }) + fld('p' + i + '-doc', 'Número', x.doc, Object.assign({ col: 3 }, reqDoc ? opt : { req: false })) + fld('p' + i + '-nat', 'Nacionalidad', x.nat, { col: 3, opts: NATS }) + fld('p' + i + '-rel', 'Parentesco con el titular', x.rel, { col: 4, opts: REL.slice(1) }) +
        fld('p' + i + '-email', 'Correo (opcional)', x.email, { col: 6, type: 'email', req: false }) + fld('p' + i + '-phone', 'Teléfono (opcional)', x.phone, { col: 6, req: false }) + '</div>'; }).join('') + '</div>' + navBtns(true),
      after: (el, goStep) => {
        const read = () => CO.pax.forEach((x, i) => { if (!i) return; const g = (f) => { const e = el.querySelector('#p' + i + '-' + f); return e ? e.value.trim() : ''; }; Object.assign(x, { first: g('first'), last: g('last'), birth: g('birth'), doctype: g('doctype'), doc: g('doc').toUpperCase(), nat: g('nat'), rel: g('rel'), email: g('email').toLowerCase(), phone: g('phone') }); });
        const lt = el.querySelector('#cp-later'); if (lt) lt.onchange = () => { read(); CO.later = lt.checked; App.render(); };
        on('back', () => { read(); goStep(-1); });
        on('next', () => {
          read(); clearErr(el); let ok = true; const seen = {}; seen[CO.pax[0].doctype + CO.pax[0].doc] = 1;
          CO.pax.forEach((x, i) => {
            if (!i) return; const req = !CO.later;
            if (req && !x.first) { markErr(el, 'p' + i + '-first', 'Obligatorio.'); ok = false; } if (req && !x.last) { markErr(el, 'p' + i + '-last', 'Obligatorio.'); ok = false; }
            if (x.doc || (req && reqDoc)) { if (!validDoc(x.doctype, x.doc)) { markErr(el, 'p' + i + '-doc', x.doctype === 'DNI' ? '8 dígitos.' : 'No válido.'); ok = false; } else if (seen[x.doctype + x.doc]) { markErr(el, 'p' + i + '-doc', 'Documento repetido.'); ok = false; } seen[x.doctype + x.doc] = 1; }
            if (!x.birth) { if (req) { markErr(el, 'p' + i + '-birth', 'Obligatorio.'); ok = false; } } else { const e = ageErr(c, x, idxInType(i)); if (e) { markErr(el, 'p' + i + '-birth', e); ok = false; } }
            if (x.email && !emailOk(x.email)) { markErr(el, 'p' + i + '-email', 'Correo no válido.'); ok = false; }
          });
          if (!ok) { UI.toast('Revise los datos de los acompañantes (R-COMPANIONS).', 'bad'); return; }
          goStep(1);
        });
      } };
  }
  const isAirport = (s) => /aeropuerto|vuelo|airport/i.test(s || '');
  function stepRecojo(c) {
    const items = pickItems(c);
    return { html: items.map(it => { const p = Q.product(it.pid); const pk = CO.pick[it.key] || (CO.pick[it.key] = { point: '', address: '', flight: '', arrival: '' }); const k = it.key; const pOn = BE.on('R-PICKUP', p) && p.pickup; const ask = pOn && p.pickup.askFlight && BE.param('R-PICKUP', 'askFlight', p) !== false; const mx = BE.param('R-COMMENTS', 'maxChars', p) || 1000; const cm = CO.comments[k] || '';
      return '<div class="ws-block"><h2>' + esc(pName(p)) + ' <span class="small muted" style="font-weight:500">· ' + dt(it.date) + '</span></h2>' +
        (pOn ? '<div class="section-title" style="margin-bottom:8px">' + (EN() ? 'Starting point / pickup' : 'Punto de partida / recojo') + (p.pickup.required ? ' <span class="req">*</span>' : '') + '</div><div class="ws-paym">' + p.pickup.points.concat(['__otro']).map(pt => '<label class="' + (pk.point === pt ? 'on' : '') + '"><input type="radio" name="pk-' + k + '" value="' + esc(pt) + '"' + (pk.point === pt ? ' checked' : '') + '><span><b>' + (pt === '__otro' ? (EN() ? 'Other address / my hotel' : 'Otra dirección / dirección de mi hotel') : esc(pt)) + '</b></span></label>').join('') + '</div>' +
          '<div class="form-grid" style="margin-top:10px">' + (pk.point === '__otro' || /hotel/i.test(pk.point) ? fld('pk-' + k + '-addr', 'Dirección o nombre del hotel', pk.address, { col: 12, ph: 'Ej.: Hotel Costa Verde Suites, Malecón de la Reserva 610, Miraflores', req: pk.point === '__otro' }) : '') +
          (ask ? fld('pk-' + k + '-fl', 'Vuelo de llegada', pk.flight, { col: 6, ph: 'Ej.: LA2041', req: isAirport(pk.point), hint: isAirport(pk.point) ? 'Obligatorio para recojo en aeropuerto.' : 'Opcional.' }) + fld('pk-' + k + '-arr', 'Fecha y hora de llegada', pk.arrival, { col: 6, type: 'datetime-local', req: isAirport(pk.point) }) : '') + '</div>' : '') +
        (BE.on('R-COMMENTS', p) ? '<div class="section-title" style="margin:14px 0 8px">' + (EN() ? 'Comments and special requests' : 'Comentarios y pedidos especiales') + '</div><textarea class="input" id="cm-' + k + '" data-i="cmt" data-k="' + k + '" rows="3" maxlength="' + mx + '" placeholder="' + (EN() ? 'Diets, celebrations, accessibility, preferences…' : 'Dietas, celebraciones, accesibilidad, preferencias de habitación…') + '">' + esc(cm) + '</textarea><div class="row between xs faint" style="margin-top:4px"><span>' + (EN() ? 'Shared with operations and suppliers when relevant.' : 'Se comparte con operaciones y proveedores cuando corresponda.') + '</span><span id="cmn-' + k + '">' + cm.length + ' / ' + mx + '</span></div>' : '') + '</div>'; }).join('') + navBtns(true),
      after: (el, goStep) => {
        const read = () => items.forEach(it => { const k = it.key; const pk = CO.pick[k]; const r = el.querySelector('input[name="pk-' + k + '"]:checked'); if (r) pk.point = r.value; const g = (id) => { const e = el.querySelector('#' + id); return e ? e.value.trim() : null; }; const a = g('pk-' + k + '-addr'); if (a != null) pk.address = a; const f = g('pk-' + k + '-fl'); if (f != null) pk.flight = f.toUpperCase(); const ar = g('pk-' + k + '-arr'); if (ar != null) pk.arrival = ar; const cm = el.querySelector('#cm-' + k); if (cm) CO.comments[k] = cm.value; });
        el.querySelectorAll('input[type=radio][name^="pk-"]').forEach(r => r.onchange = () => { read(); App.render(); });
        onc('cmt', (s) => { const n2 = el.querySelector('#cmn-' + s.dataset.k); if (n2) n2.textContent = s.value.length + ' / ' + s.getAttribute('maxlength'); CO.comments[s.dataset.k] = s.value; });
        on('back', () => { read(); goStep(-1); });
        on('next', () => {
          read(); clearErr(el); let ok = true;
          items.forEach(it => { const p = Q.product(it.pid); if (!(BE.on('R-PICKUP', p) && p.pickup)) return; const pk = CO.pick[it.key]; const k = it.key;
            if (p.pickup.required && !pk.point) { ok = false; UI.toast('Elija el punto de partida de ' + esc(pName(p)) + ' (R-PICKUP).', 'bad'); }
            if (pk.point === '__otro' && pk.address.length < 5) { markErr(el, 'pk-' + k + '-addr', 'Indique la dirección o el hotel.'); ok = false; }
            if (isAirport(pk.point) && el.querySelector('#pk-' + k + '-fl')) { if (!/^[A-Z0-9]{2}\s?\d{2,4}$/.test(pk.flight)) { markErr(el, 'pk-' + k + '-fl', 'Formato de vuelo, p. ej. LA2041.'); ok = false; } if (!pk.arrival) { markErr(el, 'pk-' + k + '-arr', 'Obligatorio.'); ok = false; } }
          });
          if (!ok) { UI.toast('Complete el punto de partida y los datos de llegada.', 'bad'); return; }
          goStep(1);
        });
      } };
  }
  const pickTxt = (pk) => !pk || !pk.point ? '' : (pk.point === '__otro' ? pk.address : pk.point + (pk.address ? ' — ' + pk.address : '')) + (pk.flight ? ' · vuelo ' + pk.flight : '') + (pk.arrival ? ' · llegada ' + pk.arrival.replace('T', ' ') : '');
  function stepPreview(c, K) {
    const who = CO.pax.map((x, i) => (i ? '' : '<b>') + esc(((x.first || '') + ' ' + (x.last || '')).trim() || (TY1(x.type) + ' ' + i + (EN() ? ' (to complete)' : ' (por completar)'))) + (i ? '' : '</b>') + ' <span class="faint">(' + TY1(x.type) + (x.birth ? ', ' + ageAt(x.birth, c.items[0].date) + ' a.' : '') + (i ? ' · ' + esc(x.rel || '') : ' · titular') + ')</span>').join('<br>');
    return { html: '<div class="ws-block"><h2>' + (EN() ? 'Preview your booking' : 'Previsualice su reserva') + '</h2><p class="small muted">' + (EN() ? 'Check every line before paying.' : 'Revise cada línea antes de pagar.') + (K.lines.some(x => BE.on('R-PREVIEW-REMOVE', x.p)) ? ' ' + (EN() ? 'You can remove add-ons and accommodation; the base tour cannot be removed.' : 'Puede quitar adicionales y alojamiento; el tour base no se puede quitar. El total se recalcula al instante.') : '') + '</p></div>' +
      K.lines.map(({ it, p, q }) => '<div class="ws-block ws-prev"><div class="row between top" style="gap:8px"><div style="min-width:0"><h2 style="margin:0">' + esc(pName(p)) + '</h2><div class="small muted">' + dtw(it.date) + ' · ' + paxTxt(it.pax, ', ') + '</div></div><b class="nowrap">' + fmtC(q.total) + '</b></div>' +
        '<div class="tbl-wrap" style="margin-top:10px"><table class="tbl compact ws-ptbl"><thead><tr><th>' + (EN() ? 'Item' : 'Concepto') + '</th><th class="num">' + (EN() ? 'Qty' : 'Cant.') + '</th><th class="num">' + (EN() ? 'Amount' : 'Importe') + '</th><th></th></tr></thead><tbody>' +
        q.lines.filter(l => l.kind !== 'info').map(l => '<tr class="' + (l.removed ? 'rm' : '') + '"><td>' + esc(l.label) + (l.kind === 'base' ? '<div class="xs faint">' + (EN() ? 'Base service' : 'Servicio base') + '</div>' : '') + '</td><td class="num">' + l.qty + '</td><td class="num nowrap">' + fmtC(l.amount, q.currency) + '</td><td class="nowrap" style="text-align:right">' + (l.removable ? '<button class="btn xs ' + (l.removed ? '' : 'ghost') + '" data-a="rmline" data-k="' + it.key + '" data-l="' + esc(l.key) + '" title="' + (l.removed ? 'Restaurar' : 'Quitar') + '" aria-label="' + (l.removed ? 'Restaurar ' : 'Quitar ') + esc(l.label) + '">' + (l.removed ? ic('refresh') + '<span class="t">' + (EN() ? 'Restore' : 'Restaurar') + '</span>' : ic('trash') + '<span class="t">' + (EN() ? 'Remove' : 'Quitar') + '</span>')  + '</button>' : '') + '</td></tr>').join('') +
        q.lines.filter(l => l.kind === 'info').map(l => '<tr><td colspan="4" class="xs faint">' + esc(l.label) + '</td></tr>').join('') +
        q.adjustments.map(a => '<tr><td class="' + (a.amount < 0 ? 'ok' : 'warn') + '">' + esc(a.label) + '</td><td></td><td class="num nowrap">' + (a.amount < 0 ? '− ' : '+ ') + fmtC(Math.abs(a.amount), q.currency) + '</td><td></td></tr>').join('') +
        '<tr class="tot"><td><b>' + t('total') + '</b></td><td></td><td class="num nowrap"><b>' + fmtC(q.total) + '</b></td><td></td></tr></tbody></table></div>' +
        (lodgingOn(p) ? '<div class="small" style="margin-top:8px">' + smallIc('bed') + ' ' + (q.rooms ? '<b>' + q.rooms + ' ' + (EN() ? 'rooms' : 'habitaciones') + ' · ' + q.nights + ' ' + (EN() ? 'nights' : 'noches') + '</b>' : (EN() ? 'No accommodation' : 'Sin alojamiento')) + '</div>' : '') +
        (pickTxt(CO.pick[it.key]) ? '<div class="small" style="margin-top:4px">' + smallIc('route') + ' ' + esc(pickTxt(CO.pick[it.key])) + '</div>' : '') + (CO.comments[it.key] ? '<div class="small muted" style="margin-top:4px">' + smallIc('msg') + ' “' + esc(CO.comments[it.key]) + '”</div>' : '') +
        (q.warnings.length ? '<div style="margin-top:10px">' + UI.alert('warn', q.warnings.map(esc).join('<br>')) + '</div>' : '') + '</div>').join('') +
      '<div class="ws-block"><h2>' + (EN() ? 'Travelers' : 'Pasajeros') + '</h2><div class="small">' + who + '</div>' + (CO.later ? '<p class="xs warn" style="margin-top:6px;font-weight:700">' + (EN() ? 'Companion details will be completed later.' : 'Completará los datos de los acompañantes después desde Mi cuenta.') + '</p>' : '') + '</div>' +
      '<div class="ws-block"><h2>' + (EN() ? 'Terms and consent' : 'Condiciones y consentimiento') + '</h2><div class="col" style="gap:10px">' +
      '<label class="check" style="align-items:flex-start"><input type="checkbox" id="ac-terms"' + (CO.accept.terms ? ' checked' : '') + '> <span>He leído y acepto los <a href="#/sitio/legal/terminos">Términos y condiciones</a> de venta. <span class="req">*</span></span></label>' +
      '<label class="check" style="align-items:flex-start"><input type="checkbox" id="ac-cancel"' + (CO.accept.cancel ? ' checked' : '') + '> <span>Acepto las políticas de cancelación, cambios y no-show de cada servicio y la <a href="#/sitio/legal/cancelacion">Política de cancelación</a>. <span class="req">*</span></span></label>' +
      '<label class="check" style="align-items:flex-start"><input type="checkbox" id="ac-privacy"' + (CO.accept.privacy ? ' checked' : '') + '> <span>Autorizo el tratamiento de mis datos y los de los acompañantes para gestionar la reserva, incluida su transferencia a proveedores (hoteles, trenes, Ministerio de Cultura), conforme a la Ley 29733. <a href="#/sitio/legal/privacidad">Política de privacidad</a> <span class="req">*</span></span></label>' +
      '<label class="check" style="align-items:flex-start"><input type="checkbox" id="ac-mkt"' + (CO.accept.marketing ? ' checked' : '') + '> <span>Deseo recibir ofertas y novedades por correo o WhatsApp (opcional).</span></label></div></div>' + navBtns(true, EN() ? 'Go to payment' : 'Ir al pago'),
      after: (el, goStep) => {
        const read = () => { CO.accept = { terms: el.querySelector('#ac-terms').checked, cancel: el.querySelector('#ac-cancel').checked, privacy: el.querySelector('#ac-privacy').checked, marketing: el.querySelector('#ac-mkt').checked }; };
        on('rmline', (b) => { read(); const it = c.items.find(x => x.key === b.dataset.k); if (!it || CO.orderId) return; const i = it.removed.indexOf(b.dataset.l); const was = i >= 0; if (was) it.removed.splice(i, 1); else it.removed.push(b.dataset.l); c.updatedAt = nowStr(); Store.save(); track(was ? 'restore_line' : 'remove_line', { item_id: it.pid, line: b.dataset.l }); UI.toast(was ? 'Ítem restaurado.' : 'Ítem quitado; total recalculado.', 'info'); App.render(); });
        on('back', () => { read(); goStep(-1); });
        on('next', () => { read(); if (!CO.accept.terms || !CO.accept.cancel || !CO.accept.privacy) { UI.toast('Debe aceptar los términos, las políticas de cancelación y el tratamiento de datos para continuar.', 'bad'); return; } const bad = K.lines.find(x => !x.q.ok || x.q.warnings.some(w => /alojan/.test(w))); if (bad) { UI.toast('Corrija las advertencias de ' + esc(pName(bad.p)) + ' antes de pagar.', 'bad'); return; } track('add_shipping_info', { cart: c.id }); goStep(1); });
      } };
  }
  function stepPay(c, K) {
    const order = CO.orderId ? DB.ecomOrders.find(o => o.id === CO.orderId) : null;
    const cc = chargeCur(); const KC = calcCart(c, cc, payOpts());
    const m = CO.method; const later = K.mode === 'pagar_despues';
    const fee = K.lines.some(x => BE.on('R-PAY-FEE', x.p)) ? BE.param('R-PAY-FEE', 'cardPct') : 0;
    const altP = cartProds(c).filter(needAlt);
    const due = KC.mode === 'total' ? KC.total : KC.deposit;
    const modeCard = (md) => { const kd = calcCart(c, prefs.cur, { mode: md, method: CO.method }); const kc = calcCart(c, cc, { mode: md, method: CO.method });
      const sub = md === 'total' ? (EN() ? 'Vouchers are issued as soon as payment is confirmed.' : 'Recibe los vouchers al confirmarse el pago.') : md === 'adelanto' ? (EN() ? 'Balance ' : 'Saldo de ') + fmtC(kd.balance) + (kd.balanceDue ? (EN() ? ' due ' : ' con vencimiento el ') + dt(kd.balanceDue) : '') + (EN() ? ', payable from My account.' : ', pagable desde Mi cuenta. Los vouchers se emiten al completar el pago.') : (EN() ? 'Seats are held for ' : 'Sus cupos quedan bloqueados ') + kd.holdHours + (EN() ? ' h without payment; pay from My account before the hold expires.' : ' h sin pago (R-PAY-LATER); pague desde Mi cuenta antes de que venza o se liberan.');
      const amt = md === 'total' ? fmtC(kd.total) : md === 'adelanto' ? kd.depositPct + ' % · ' + fmtC(kd.deposit) + (EN() ? ' today' : ' hoy') : fmtC(0) + (EN() ? ' today' : ' hoy');
      return '<label class="' + (K.mode === md ? 'on' : '') + '"><input type="radio" name="pmode" value="' + md + '"' + (K.mode === md ? ' checked' : '') + '><span><b>' + modeLbl(md) + ' · ' + amt + '</b><small>' + sub + (isRef() ? ' ' + (EN() ? 'Charged: ' : 'Se cobra: ') + fmtC(md === 'total' ? kc.total : md === 'adelanto' ? kc.deposit : 0, cc) + '.' : '') + '</small></span></label>'; };
    return { html: (order && order.status === 'pago_rechazado' ? UI.alert('bad', '<b>Pago rechazado.</b> ' + esc((order.attempts[order.attempts.length - 1] || {}).msg || '') + '. Su pedido ' + esc(order.id) + ' sigue pendiente: puede reintentar con otra tarjeta o elegir transferencia / Yape.') : '') +
      '<div class="ws-block"><h2>' + (EN() ? 'Payment option' : 'Modalidad de pago') + '</h2><div class="ws-paym">' + K.modes.map(modeCard).join('') + '</div>' + (() => { const w = [...new Set([].concat(...K.lines.map(x => x.q.warnings)))]; return w.length ? '<div style="margin-top:10px">' + UI.alert('warn', w.map(esc).join('<br>')) + '</div>' : ''; })() + (K.modes.length === 1 && BE.on('R-DEPOSIT') ? '<p class="ws-note" style="margin-top:6px">' + (EN() ? 'This product requires full payment.' : 'Este producto requiere pago total.') + '</p>' : '') + '</div>' +
      (later ? '' : '<div class="ws-block"><h2>' + (EN() ? 'Payment method' : 'Medio de pago') + '</h2><div class="ws-paym">' +
        '<label class="' + (m === 'card' ? 'on' : '') + '"><input type="radio" name="pmeth" value="card"' + (m === 'card' ? ' checked' : '') + '><span><b>Tarjeta de crédito o débito' + (fee ? ' · recargo ' + fmtN(fee, 1) + ' %' : '') + '</b><small>Visa, Mastercard, American Express, Diners Club · 3-D Secure · confirmación inmediata.' + (fee ? ' Recargo por medio de pago (R-PAY-FEE) incluido en el total.' : '') + '</small></span></label>' +
        '<label class="' + (m === 'transfer' ? 'on' : '') + '"><input type="radio" name="pmeth" value="transfer"' + (m === 'transfer' ? ' checked' : '') + '><span><b>Transferencia bancaria</b><small>BCP o Interbank. La reserva queda pendiente hasta validar el abono (máx. 4 h hábiles).</small></span></label>' +
        '<label class="' + (m === 'yape' ? 'on' : '') + '"><input type="radio" name="pmeth" value="yape"' + (m === 'yape' ? ' checked' : '') + '><span><b>Yape / Plin</b><small>Solo en soles. Pendiente de validación por Finanzas.</small></span></label></div>' +
        '<div style="margin-top:14px">' + (m === 'card' ? '<div class="form-grid">' + fld('cd-num', 'Número de tarjeta', CO.card.num || '', { col: 12, ph: '4111 1111 1111 1111', hint: 'Sandbox: 4111 1111 1111 1111 aprobada · 4000 0000 0000 0002 rechazada (fondos insuficientes).' }) + fld('cd-name', 'Nombre en la tarjeta', CO.card.name || (CO.buyer.first + ' ' + CO.buyer.last).toUpperCase(), { col: 6 }) + fld('cd-exp', 'Vencimiento (MM/AA)', CO.card.exp || '12/29', { col: 3 }) + fld('cd-cvv', 'CVV', '', { col: 3, type: 'password' }) + '</div><p class="ws-note" style="margin-top:8px">En producción los datos de la tarjeta se capturan en el formulario seguro de la pasarela (tokenización PCI DSS); el comercio nunca los recibe ni almacena.</p>'
          : m === 'transfer' ? UI.dl([['BCP soles', '<span style="user-select:all">193-2456789-0-12</span> · CCI 002-193-002456789012-15'], ['BCP dólares', '<span style="user-select:all">193-2456790-1-45</span>'], ['Interbank soles', '<span style="user-select:all">200-3001234567</span>'], ['Titular', esc(DB.tenant.name) + ' · RUC ' + DB.tenant.ruc]]) + '<div class="form-grid" style="margin-top:10px">' + fld('tr-op', 'Número de operación', '', { col: 6 }) + fld('tr-bank', 'Banco de origen', 'BCP', { col: 6, opts: ['BCP', 'Interbank', 'BBVA', 'Scotiabank', 'Otro'] }) + '</div>'
            : '<div class="row top" style="gap:14px"><div style="width:110px;height:110px;border:1px solid var(--line);border-radius:10px;display:grid;place-items:center;background:var(--surface-2)" aria-label="Código QR de Yape">' + ic('grid').replace('<svg', '<svg style="width:70px;height:70px;color:var(--fg-3)"') + '</div><div class="grow small">Yape / Plin al <b style="user-select:all">' + WA + '</b> a nombre de Andes Horizonte Travel S.A.C.<br>Monto: <b>' + BE.fmt(BE.convert(due, cc, 'PEN'), 'PEN') + '</b>' + (cc !== 'PEN' ? ' (' + rateTxt(cc) + ')' : '') + '</div></div><div class="form-grid" style="margin-top:10px">' + fld('yp-op', 'Código de operación', '', { col: 6 }) + '</div>') + '</div></div>') +
      (altP.length ? '<div class="ws-block"><h2>' + (EN() ? 'High-altitude declaration' : 'Declaración para viajes de altura') + '</h2><label class="check" style="align-items:flex-start"><input type="checkbox" id="alt-ok"' + (CO.altitude ? ' checked' : '') + '> <span>' + (EN() ? 'I declare that all travelers know that the itinerary reaches ' : 'Declaro que todos los pasajeros conocen que el itinerario alcanza ') + fmtN(Math.max(...altP.map(maxAlt)), 0) + ' m s. n. m. (' + altP.map(x => esc(pName(x))).join(', ') + '), ' + (EN() ? 'that they will consult their doctor if needed and follow acclimatization advice.' : 'que consultarán a su médico si lo consideran necesario y que seguirán las recomendaciones de aclimatación.') + ' <span class="req">*</span></span></label><p class="ws-note" style="margin-top:6px">' + (EN() ? 'We do not record diagnoses (R-ALTITUDE).' : 'No registramos diagnósticos ni datos de salud; solo la aceptación de la declaración (R-ALTITUDE).') + '</p></div>' : '') +
      '<div class="ws-block"><div class="ws-sum"><div class="l tot"><span>' + (later ? (EN() ? 'To pay today' : 'A pagar hoy') : (EN() ? 'To pay now' : 'A pagar ahora')) + '</span><span>' + fmtC(later ? 0 : K.mode === 'total' ? K.total : K.deposit) + '</span></div>' + (isRef() && !later ? '<div class="l small"><span>' + (EN() ? 'Charged in ' : 'Importe cobrado en ') + cc + '</span><span>' + fmtC(due, cc) + '</span></div>' : '') + '</div>' + fxNote(true) + '</div>' +
      '<div class="row end"><button class="btn" data-a="back">' + ic('chevronLeft') + (EN() ? 'Back' : 'Volver') + '</button><button class="btn sun" data-a="pay" style="height:44px">' + ic('lock') + (later ? (EN() ? 'Confirm booking without payment' : 'Confirmar reserva sin pago') : m === 'card' ? (EN() ? 'Pay ' : 'Pagar ') + fmtC(due, cc) : (EN() ? 'Register payment of ' : 'Registrar pago de ') + fmtC(due, cc)) + '</button></div>',
      after: (el, goStep) => {
        el.querySelectorAll('input[name=pmode]').forEach(r => { if (order) r.disabled = true; r.onchange = () => { CO.payMode = r.value; track('select_payment_mode', { mode: r.value }); App.render(); }; });
        el.querySelectorAll('input[name=pmeth]').forEach(r => r.onchange = () => { CO.method = r.value; track('add_payment_info', { payment_type: r.value }); App.render(); });
        const alt = el.querySelector('#alt-ok'); if (alt) alt.onchange = () => { CO.altitude = alt.checked; };
        on('back', () => goStep(-1));
        on('pay', (btn) => {
          const g = (id) => { const i = el.querySelector('#' + id); return i ? i.value.trim() : ''; };
          clearErr(el);
          if (altP.length && !CO.altitude) { UI.toast('Debe aceptar la declaración para viajes de altura (R-ALTITUDE).', 'bad'); return; }
          if (!later) {
            if (m === 'card') { CO.card = { num: g('cd-num'), name: g('cd-name'), exp: g('cd-exp') }; if (String(CO.card.num).replace(/\D/g, '').length < 15) { markErr(el, 'cd-num', 'Número de tarjeta incompleto.'); return; } if (!/^\d{3,4}$/.test(g('cd-cvv'))) { markErr(el, 'cd-cvv', 'CVV inválido.'); return; } if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(CO.card.exp)) { markErr(el, 'cd-exp', 'Formato MM/AA.'); return; } }
            if (m === 'transfer' && g('tr-op').length < 4) { markErr(el, 'tr-op', 'Ingrese el número de operación.'); return; }
            if (m === 'yape' && g('yp-op').length < 4) { markErr(el, 'yp-op', 'Ingrese el código de operación.'); return; }
          }
          btn.disabled = true;
          const ref = m === 'transfer' ? 'Op. ' + g('tr-op') + ' · ' + g('tr-bank') : m === 'yape' ? 'Yape ' + g('yp-op') : '';
          const res = placeOrder(c, ref);
          if (res === 'ok' || res === 'pending') { App.go('#/sitio/confirmacion/' + CO.orderId); }
          else { btn.disabled = false; App.render(); }
        });
      } };
  }

  /* API pública del carrito para el widget embebible (experiencia.js, ruta sitio/widget → window.SiteCart.add)
     o = {productId, date, pax:{adt,chd,inf}, addons:[{id,qty}], lodging:[{legId,hotelId,rooms}], removed, currency, paymentMode, source} */
  let SC_MODE = null;
  window.SiteCart = {
    add(o) {
      ensureSeed(); const p = Q.product(o.productId); if (!p) throw new Error('Producto no encontrado');
      const pax = { adt: +((o.pax || {}).adt) || 0, chd: +((o.pax || {}).chd) || 0, inf: +((o.pax || {}).inf) || 0 };
      const addons = (o.addons || []).map(a => { const ad = (p.addons || []).find(x => x.id === a.id) || {}; const by = {}; let left = +a.qty || 0; (ad.appliesTo || TYPES).forEach(ty => { const n = Math.min(left, pax[tyKey(ty)]); if (n > 0) { by[ty] = n; left -= n; } }); if (left > 0) by.ADT = (by.ADT || 0) + left; return { id: a.id, by }; });
      const it = normItem({ pid: p.id, date: o.date, pax, opts: {}, addons, lodging: o.lodging || [], noLodging: !(o.lodging || []).length, removed: (o.removed || []).slice(), source: o.source || 'widget' });
      const errs = paxErrors(p, pax); if (errs.length) throw new Error(errs[0]);
      const di = dayInfo(p, it.date, BE.validatePax(p, pax).seats); if (!di.ok) throw new Error(di.why || 'Sin disponibilidad');
      if (o.currency && curList().some(c => c.code === o.currency)) { prefs.cur = o.currency; savePrefs(); }
      const c = getCart(true); it.key = nextId(c.items.map(x => ({ id: x.key })), 'L', 3); it.addedAt = nowStr();
      const h = createHold(c, it); if (h === false) throw new Error('Sin cupos para bloquear');
      c.items.push(it); c.updatedAt = nowStr(); Store.save();
      SC_MODE = o.paymentMode || null; if (CO && CO.cartId === c.id && SC_MODE) CO.payMode = SC_MODE;
      track('add_to_cart', { item_id: p.id, date: it.date, quantity: pax.adt + pax.chd, cart: c.id, source: it.source });
      return it.key;
    },
    count: () => cartCount()
  };

  /* ---------------- Confirmación del pedido: reservas, CxC, pagos, holds, auditoría, notificaciones y mensajes ---------------- */
  const USED_RULES = ['R-AVAIL-RANGES', 'R-CUTOFF', 'R-WEEKDAYS', 'R-HOLD', 'R-MIN-ADULTS', 'R-CHILD-PER-ADULT', 'R-INFANT-FREE', 'R-MAX-PAX', 'R-COMPANIONS', 'R-ALTITUDE', 'R-LODGING', 'R-LODGING-CAPACITY', 'R-SINGLE-SUPP', 'R-ADDONS', 'R-PROMO', 'R-GROUP-DISC', 'R-EARLY-BIRD', 'R-LAST-MINUTE', 'R-SEASON', 'R-MULTICURRENCY', 'R-DEPOSIT', 'R-PAY-LATER', 'R-PAY-FEE', 'R-PREVIEW-REMOVE', 'R-PICKUP', 'R-COMMENTS', 'R-NOMINATIVE', 'R-PAX-MESSAGES'];
  function passengersFor(it, date) {
    const out = []; const pick = (ty, n) => CO.pax.filter(x => x.type === ty).slice(0, n);
    const list = pick('ADT', it.pax.adt).concat(pick('CHD', it.pax.chd), pick('INF', it.pax.inf));
    if (CO.pax[0] && !list.includes(CO.pax[0])) list.unshift(CO.pax[0]);
    list.forEach((x, i) => { const lead = x === CO.pax[0]; const nm = ((x.first || '') + ' ' + (x.last || '')).trim(); const pend = !lead && (!nm || !x.birth || !x.doc);
      out.push({ name: nm || (TY1(x.type) + ' ' + (i + 1) + ' (por completar)'), doc: x.doc ? x.doctype + ' ' + x.doc : '', type: x.type, nationality: x.nat || '', birth: x.birth || '', phone: x.phone || '', email: x.email || '', diet: x.diet || '', relationship: lead ? 'Titular' : (x.rel || 'Otro'), age: x.birth ? ageAt(x.birth, date) : null, isLead: lead, pending: pend || undefined }); });
    return out;
  }
  function placeOrder(c, ref) {
    const b = CO.buyer; const now = nowStr(); const cc = chargeCur();
    const KC = calcCart(c, cc, payOpts()); const KD = calcCart(c, prefs.cur, payOpts());
    /* Revalidación de disponibilidad y holds antes de cobrar (Regla transversal 4; BE.dayStatus) */
    if (!CO.orderId) for (const x of KC.lines) {
      const it = x.it; if (holdLive(it)) continue; const seats = BE.validatePax(x.p, it.pax).seats; const di = dayInfo(x.p, it.date, seats);
      if (!di.ok) { UI.toast('La fecha ' + dt(it.date) + ' de ' + esc(x.p.name) + ' ya no está disponible (' + esc(di.why) + '). Actualice su carrito.', 'bad'); return 'fail'; }
      if (it.holdId) { const h = createHold(c, it); if (h === false) { UI.toast('No fue posible volver a bloquear los cupos.', 'bad'); return 'fail'; } if (h) UI.toast('El bloqueo había vencido; se volvieron a bloquear los cupos.', 'info'); }
    }
    let order = CO.orderId ? DB.ecomOrders.find(o => o.id === CO.orderId) : null;
    if (!order) {
      const fullName = (b.first + ' ' + b.last).trim();
      let cli = clientUser() ? Q.client(clientUser().clientId) : DB.clients.find(x => (x.email || '').toLowerCase() === b.email);
      if (!cli) {
        cli = { id: nextId(DB.clients, 'CLI-', 4), kind: 'Persona', name: fullName, doc: b.doctype + ' ' + b.doc, email: b.email, phone: b.phone, country: b.country, city: '', segment: 'Retail', owner: 'U03', createdAt: T(), tags: ['Web', 'E-commerce'], nps: null, contacts: [], birth: b.birth, consents: { privacy: now, marketing: CO.accept.marketing ? now : null, policyVersion: 'PDP-2026.1' } };
        DB.clients.push(cli); Audit.log('Cliente', cli.id, 'crear_desde_sitio_web', '', b.email);
      }
      if (CO.accept.marketing) upsertSubscriber({ email: b.email, name: fullName, phone: b.phone, country: b.country, source: 'Checkout e-commerce', clientId: cli.id });
      const oid = nextId(DB.ecomOrders, 'WEB-', 5); const resIds = [];
      let svcN = parseInt(nextId(DB.reservations.flatMap(x => x.services || []), 'RS-', 4).slice(3), 10);
      const mode = KC.mode; const fxRate = rnd2(BE.convert(1, cc, prefs.cur) * 1e4) / 1e4;
      KC.lines.forEach((x, idx) => {
        const { it, p, q } = x; const qd = KD.lines[idx].q; const resId = Seq.next('Reserva');
        const seats = BE.validatePax(p, it.pax).seats; const di = dayInfo(p, it.date, seats); const dep = di.dep;
        const rate = (p.rates || []).find(r => r.status === 'vigente' && ['Adulto', 'Pasajero'].includes(r.segment)) || { cost: 0, price: 1 };
        const act = q.lines.filter(l => !l.removed);
        const legs = legsOf(p); const legStart = (legId) => { let off = 0; for (const l of legs) { if (l.id === legId) return addDays(it.date, off); off += l.nights; } return it.date; };
        const svc = [];
        const baseAmt = rnd2(sum(act.filter(l => l.kind === 'base'), 'amount'));
        const instant = !!(di.free != null && !di.onRequest);
        svc.push({ id: 'RS-' + String(svcN++).padStart(4, '0'), productId: p.id, name: p.name + ' — ' + (it.pax.adt + it.pax.chd + it.pax.inf) + ' pax' + (dep ? ' (salida ' + dep.id + ')' : ''), date: it.date, time: dep ? dep.time : (p.itinerary[0] && p.itinerary[0].items[0] ? p.itinerary[0].items[0].time : '—'), providerId: p.mainProviderId, status: 'solicitado', cost: rnd2(baseAmt * (rate.cost / rate.price)), price: baseAmt, confirmationCode: '', pax: seats, paxDetail: Object.assign({}, it.pax), options: optsOf(p, it).map(o => o.group + ': ' + o.label), depId: dep ? dep.id : null, holdId: it.holdId || null, instant });
        act.filter(l => l.kind === 'addon').forEach(l => svc.push({ id: 'RS-' + String(svcN++).padStart(4, '0'), productId: null, addonId: l.addonId, name: l.label + ' × ' + l.qty, date: it.date, time: '—', providerId: p.mainProviderId, status: 'solicitado', cost: rnd2(l.amount / (1 + (p.markupPct || 25) / 100)), price: rnd2(l.amount), confirmationCode: '', pax: l.qty, extraOf: p.id, kind: 'adicional' }));
        act.filter(l => l.kind === 'lodging').forEach(l => { const leg = legs.find(z => z.id === l.legId); const h = leg && leg.hotels.find(z => z.name === l.hotel); svc.push({ id: 'RS-' + String(svcN++).padStart(4, '0'), productId: null, name: 'Alojamiento ' + l.city + ' · ' + l.hotel + ' · ' + l.rooms + ' hab. ' + l.roomType.toLowerCase() + ' × ' + l.nights + ' noche(s)', date: legStart(l.legId), time: '14:00', providerId: (h && h.providerId) || p.mainProviderId, status: 'solicitado', cost: rnd2(l.amount / (1 + (p.markupPct || 25) / 100)), price: rnd2(l.amount), confirmationCode: '', pax: seats, extraOf: p.id, kind: 'alojamiento', rooms: l.rooms, nights: l.nights }); });
        act.filter(l => l.kind === 'surcharge').forEach(l => svc.push({ id: 'RS-' + String(svcN++).padStart(4, '0'), productId: null, name: l.label, date: it.date, time: '—', providerId: p.mainProviderId, status: 'confirmado', cost: 0, price: rnd2(l.amount), confirmationCode: '', pax: 1, extraOf: p.id, kind: 'recargo' }));
        const pk = CO.pick[it.key] || {};
        const lodging = act.filter(l => l.kind === 'lodging').map(l => ({ legId: l.legId, city: l.city, hotel: l.hotel, roomType: l.roomType, rooms: l.rooms, nights: l.nights }));
        const passengers = passengersFor(it, it.date);
        const pendComp = passengers.some(z => z.pending);
        const compP = BE.on('R-COMPANIONS', p);
        const booking = { productId: p.id, date: it.date, pax: Object.assign({}, it.pax), currencyDisplay: prefs.cur, fxRate, chargeCurrency: cc,
          lines: act.map(l => Object.assign({}, l)), adjustments: q.adjustments.map(a => Object.assign({}, a)), total: q.total, totalDisplay: qd.total,
          lodging, rooms: q.rooms, nights: q.nights,
          addons: act.filter(l => l.kind === 'addon').map(l => { const a = (it.addons || []).find(z => z.id === l.addonId) || {}; return { id: l.addonId, name: l.label, qty: l.qty, amount: rnd2(l.amount), byType: a.by || null }; }),
          removedLines: q.lines.filter(l => l.removed).map(l => ({ key: l.key, label: l.label, amount: rnd2(l.amount) })),
          pickup: BE.on('R-PICKUP', p) && p.pickup ? { point: pk.point === '__otro' ? 'Otra dirección' : (pk.point || ''), address: pk.address || '', flight: pk.flight || '', arrival: pk.arrival ? pk.arrival.replace('T', ' ') : '' } : null,
          comments: BE.on('R-COMMENTS', p) ? (CO.comments[it.key] || '').trim() : '',
          payment: { mode, depositPct: q.depositPct, deposit: q.deposit, balance: q.balance, balanceDue: q.balanceDue, holdHours: q.holdHours || null, holdUntil: mode === 'pagar_despues' ? plusMin(now, (q.holdHours || 24) * 60) : null, method: mode === 'pagar_despues' ? null : CO.method },
          companionsPending: compP && pendComp, companionsDue: compP && pendComp ? addDays(it.date, -(BE.param('R-COMPANIONS', 'daysBeforeIfLater', p) || 7)) : null,
          altitudeDeclaration: needAlt(p) ? { accepted: true, at: now, maxAltitude: maxAlt(p) } : null,
          rulesApplied: USED_RULES.filter(id => BE.rule(id) && BE.on(id, p)), promoCode: q.promoLbl ? c.promo : '', lang: prefs.lang };
        const r = { id: resId, quoteId: null, quoteVersion: null, clientId: cli.id, title: fullName.split(' ').slice(0, 2).join(' ') + ' — ' + p.name + ' (web)', status: 'pendiente_pago', channel: 'E-commerce', travelFrom: it.date, travelTo: addDays(it.date, durDays(p) - 1), currency: cc, fxRate: BE.currency('USD').rate, total: q.total, owner: 'U03', createdAt: now, sede: destSubtree('D03').has(p.destId) ? 'SED-02' : 'SED-01',
          notes: 'Pedido web ' + oid + ' desde el sitio público (' + prefs.lang.toUpperCase() + ', moneda ' + prefs.cur + ').' + (booking.comments ? ' Comentario del cliente: ' + booking.comments : ''), passengers, services: svc, ecomOrderId: oid,
          billing: { type: b.receipt, doc: b.receipt === 'Factura' ? 'RUC ' + b.ruc : b.doctype + ' ' + b.doc, name: b.receipt === 'Factura' ? b.company : fullName, address: b.fiscal || '' },
          paymentPlan: { mode: mode === 'adelanto' ? 'anticipo' : mode, depositPct: q.depositPct, balanceDue: q.balanceDue }, consents: { terms: now, cancellation: now, privacy: now, marketing: CO.accept.marketing ? now : null, altitude: booking.altitudeDeclaration ? now : null }, webCartId: c.id, booking };
        DB.reservations.unshift(r); resIds.push(resId);
        /* CxC según modalidad */
        if (mode === 'total') DB.receivables.unshift({ id: nextId(DB.receivables, 'CXC-', 5), resId, clientId: cli.id, concept: 'Pago total — pedido web ' + oid, amount: q.total, currency: cc, due: T(), paid: 0, status: 'abierta', kind: 'total' });
        else if (mode === 'adelanto') { DB.receivables.unshift({ id: nextId(DB.receivables, 'CXC-', 5), resId, clientId: cli.id, concept: 'Adelanto ' + q.depositPct + ' % — pedido web ' + oid, amount: q.deposit, currency: cc, due: T(), paid: 0, status: 'abierta', kind: 'adelanto' }); DB.receivables.unshift({ id: nextId(DB.receivables, 'CXC-', 5), resId, clientId: cli.id, concept: 'Saldo ' + (100 - q.depositPct) + ' % — pedido web ' + oid, amount: q.balance, currency: cc, due: q.balanceDue || it.date, paid: 0, status: 'abierta', kind: 'saldo' }); }
        else DB.receivables.unshift({ id: nextId(DB.receivables, 'CXC-', 5), resId, clientId: cli.id, concept: 'Reserva sin pago (bloqueo ' + (q.holdHours || 24) + ' h) — pedido web ' + oid, amount: q.total, currency: cc, due: booking.payment.holdUntil.slice(0, 10), paid: 0, status: 'abierta', kind: 'pago_posterior' });
        /* Holds → consumidos por la reserva; salidas programadas suman vendidos */
        const h = holdOf(it); if (h && h.status === 'hold') { h.status = 'confirmada'; h.ref = oid; h.notes = (h.notes || '') + ' · consumido por ' + resId + (mode === 'pagar_despues' ? ' (pago pendiente hasta ' + booking.payment.holdUntil + ')' : ''); Audit.log('Disponibilidad', h.id, 'consumir_hold', 'hold', 'confirmada · ' + resId); }
        if (dep) { const before = dep.sold; dep.sold += seats; if (dep.sold >= dep.capacity) dep.status = 'completa'; Audit.log('Disponibilidad', dep.id, 'consumir_cupos', before + '/' + dep.capacity, dep.sold + '/' + dep.capacity + ' · ' + resId); }
        Audit.log('Reserva', resId, 'crear_ecommerce', '', 'pendiente_pago · ' + svc.length + ' servicios · ' + money(q.total, cc) + ' · ' + mode + ' · reglas ' + booking.rulesApplied.length);
        if (booking.removedLines.length) Audit.log('Reserva', resId, 'items_quitados_previsualizacion', '', booking.removedLines.map(l => l.label).join(' | '));
      });
      order = { id: oid, date: now, customer: fullName, email: b.email, phone: b.phone, product: c.items[0].pid, items: c.items.map(i => ({ pid: i.pid, date: i.date, depId: (dayInfo(Q.product(i.pid), i.date, 1).dep || {}).id || null, adt: i.pax.adt, chd: i.pax.chd, inf: i.pax.inf })), pax: CO.pax.length, total: KC.total, currency: cc, currencyDisplay: prefs.cur, totalDisplay: KD.total, fxRate: BE.currency('USD').rate, status: 'pago_pendiente', resId: resIds[0], resIds, depId: null, promo: c.promo && KC.promoOk ? c.promo : '', payMode: KC.mode === 'adelanto' ? 'anticipo' : KC.mode, amountDue: KC.mode === 'total' ? KC.total : KC.deposit, attempts: [], channel: 'Sitio web', lang: prefs.lang, cartId: c.id, clientId: cli.id };
      DB.ecomOrders.unshift(order); CO.orderId = oid;
      const mine = myOrders(); mine.unshift(oid); ls.set(LSK.orders, mine.slice(0, 20));
      Audit.log('Pedido web', oid, 'crear', '', 'pago_pendiente · ' + money(order.total, cc) + ' · ' + KC.mode + ' · ' + resIds.join(', '));
      Store.save();
    }
    const rs = (order.resIds || [order.resId]).map(Q.reservation).filter(Boolean);
    /* CxC que se cobra ahora: la de adelanto o pago total (nunca el saldo, aunque venza hoy) */
    const openDue = (r) => DB.receivables.find(x => x.resId === r.id && x.status !== 'pagada' && ['total', 'adelanto', 'pago_posterior'].includes(x.kind)) || DB.receivables.filter(x => x.resId === r.id && x.status !== 'pagada').sort((a, b2) => a.due < b2.due ? -1 : 1)[0];
    if (KC.mode === 'pagar_despues') {
      order.attempts.push({ ts: nowStr(), method: '—', result: 'sin_pago', msg: 'Reservar ahora, pagar después (R-PAY-LATER)' });
      Store.save();
      rs.forEach(r => { Notify.push('reserva.pendiente_pago', 'Email', order.email, 'Reserva ' + r.id + ' bloqueada hasta ' + r.booking.payment.holdUntil + ': complete el pago'); sendPaxMessages(r, ['reserva_creada', 'reserva_pendiente_pago']); });
      Notify.push('pedido.web', 'Portal', 'U03', 'Reserva web sin pago ' + order.id + ' (vence ' + rs[0].booking.payment.holdUntil + ')');
      finishCart(c, order); track('purchase_pending', { transaction_id: order.id, value: order.total, currency: order.currency, payment_type: 'pay_later' });
      return 'pending';
    }
    const m = CO.method;
    if (m === 'card') {
      const digits = String(CO.card.num).replace(/\D/g, ''); const last4 = digits.slice(-4);
      const okCard = ['4111111111111111', '5555555555554444', '378282246310005', '36227206271667'].includes(digits);
      if (!okCard) {
        const msg = digits === '4000000000000002' ? 'Fondos insuficientes (código 51)' : 'Tarjeta no reconocida por la pasarela sandbox (código 14)';
        order.status = 'pago_rechazado'; order.attempts.push({ ts: nowStr(), method: 'Tarjeta', card: '•••• ' + last4, result: 'rechazado', msg });
        rs.forEach(r => { const rc = openDue(r); DB.payments.unshift({ id: nextId(DB.payments, 'PAG-', 5), receivableId: rc ? rc.id : null, resId: r.id, method: 'Tarjeta (e-commerce)', amount: rc ? rc.amount : 0, currency: order.currency, date: T(), status: 'rechazado', ref: 'Rechazo emisor · ' + msg, by: 'Sistema' }); });
        Store.save(); Audit.log('Pedido web', order.id, 'pago_rechazado', 'pago_pendiente', 'pago_rechazado · •••• ' + last4);
        Notify.push('pago.rechazado', 'Email', order.email, 'No pudimos procesar el pago del pedido ' + order.id);
        track('payment_failed', { order: order.id, reason: msg });
        UI.toast('Pago rechazado: ' + esc(msg) + '. Puede reintentar; sus cupos siguen reservados.', 'bad');
        return 'fail';
      }
      order.attempts.push({ ts: nowStr(), method: 'Tarjeta', card: '•••• ' + last4, result: 'ok', msg: 'Autorización ' + String(Math.floor(Math.random() * 1e6)).padStart(6, '0') + ' · 3DS OK' });
      rs.forEach(r => {
        const rc = openDue(r); const amt = rc ? rnd2(rc.amount - rc.paid) : 0;
        const pay = { id: nextId(DB.payments, 'PAG-', 5), receivableId: rc ? rc.id : null, resId: r.id, method: 'Tarjeta (e-commerce)', amount: amt, currency: r.currency, date: T(), status: 'aplicado', ref: 'TXN ' + String(Math.floor(Math.random() * 1e4)).padStart(4, '0') + '-' + String(Math.floor(Math.random() * 1e4)).padStart(4, '0') + ' · •••• ' + last4, by: 'Sistema' };
        DB.payments.unshift(pay); if (rc) { rc.paid = rc.amount; rc.status = 'pagada'; }
        r.services.forEach(s => { if (s.instant || s.kind === 'recargo') { s.status = 'confirmado'; s.confirmationCode = s.confirmationCode || 'AH-' + r.id.slice(-6) + '-' + s.id.slice(-2); } });
        const before = r.status; r.status = r.services.every(s => s.status === 'confirmado') ? 'confirmada' : 'pendiente_proveedor';
        const vous = r.booking.payment.mode === 'total' ? issueVouchers(r) : [];
        Audit.log('Pago', pay.id, 'aplicar', 'pendiente', 'aplicado · ' + money(pay.amount, pay.currency) + ' · pasarela · ' + r.id);
        Audit.log('Reserva', r.id, 'cambio_estado', before, r.status);
        vous.forEach(v => { Audit.log('Voucher', v.id, 'emitir', '', 'emitido v1 (sitio web)'); });
        Notify.push('reserva.confirmada', 'Email', order.email, (r.status === 'confirmada' ? 'Reserva confirmada ' : 'Reserva registrada ') + r.id);
        Notify.push('reserva.confirmada', 'WhatsApp', order.phone, 'Andes Horizonte: su reserva ' + r.id + ' fue registrada.');
        if (r.status === 'pendiente_proveedor') Notify.push('reserva.pendiente_proveedor', 'Portal', 'U05', 'Servicios web por confirmar con proveedor — ' + r.id);
        if (vous.length) Notify.push('voucher.emitido', 'Email', order.email, 'Sus vouchers de la reserva ' + r.id);
        if (r.booking.companionsPending) Notify.push('reserva.datos_pendientes', 'Email', order.email, 'Complete los datos de sus acompañantes antes del ' + dt(r.booking.companionsDue) + ' — ' + r.id);
        sendPaxMessages(r, ['reserva_confirmada']);
      });
      order.status = 'confirmado'; Store.save();
      Notify.push('pago.recibido', 'Email', order.email, 'Pago confirmado — pedido ' + order.id);
      Notify.push('pedido.web', 'Portal', 'U03', 'Nuevo pedido web ' + order.id + ' — ' + money(order.total, order.currency));
      finishCart(c, order); track('purchase', { transaction_id: order.id, reservations: order.resIds, value: order.total, currency: order.currency, display_currency: order.currencyDisplay, payment_type: 'card', pay_mode: KC.mode, items: order.items.map(i => i.pid) });
      return 'ok';
    }
    /* Transferencia / Yape: pago pendiente de validación; cupos retenidos para la reserva */
    order.attempts.push({ ts: nowStr(), method: m === 'yape' ? 'Yape' : 'Transferencia', result: 'por_validar', msg: ref });
    rs.forEach(r => { const rc = openDue(r); const amt = rc ? rnd2(rc.amount - rc.paid) : 0; const pay = { id: nextId(DB.payments, 'PAG-', 5), receivableId: rc ? rc.id : null, resId: r.id, method: m === 'yape' ? 'Yape' : 'Transferencia ' + (ref.split('· ')[1] || ''), amount: m === 'yape' ? rnd2(BE.convert(amt, r.currency, 'PEN')) : amt, currency: m === 'yape' ? 'PEN' : r.currency, date: T(), status: 'pendiente', ref: ref + ' · por validar', by: 'Web' };
      DB.payments.unshift(pay); Audit.log('Pago', pay.id, 'registrar', '', 'pendiente de validación · ' + money(pay.amount, pay.currency) + ' · ' + r.id);
      Notify.push('pago.por_validar', 'Portal', 'U07', 'Validar abono ' + pay.id + ' del pedido web ' + order.id);
      Notify.push('reserva.recibida', 'Email', order.email, 'Recibimos su reserva ' + r.id + ' — pago en validación');
      sendPaxMessages(r, ['reserva_creada', 'reserva_pendiente_pago']); });
    order.status = 'pago_pendiente'; Store.save();
    finishCart(c, order); track('purchase_pending', { transaction_id: order.id, value: order.total, currency: order.currency, payment_type: m });
    return 'pending';
  }
  /* Mensajes al pasajero desde plantillas activas (DB.paxMessageTemplates, dueño experiencia.js) — R-PAX-MESSAGES */
  function sendPaxMessages(r, events) {
    /* Una plantilla por evento/grupo, en el idioma de la reserva (o ES) — mismo criterio que experiencia.js */
    const lang = (r.booking.lang || 'es').toUpperCase(); const byKey = {};
    (DB.paxMessageTemplates || []).filter(x => events.includes(x.event)).forEach(x => { const k = x.event + '|' + (x.group || x.id); (byKey[k] = byKey[k] || []).push(x); });
    const tpls = Object.values(byKey).map(l => l.find(x => String(x.lang || 'ES').toUpperCase() === lang && x.active !== false) || l.find(x => String(x.lang || 'ES').toUpperCase() === 'ES' && x.active !== false)).filter(Boolean);
    if (!tpls.length || !BE.on('R-PAX-MESSAGES')) return 0;
    if (!DB.paxMessages) DB.paxMessages = [];
    const p = Q.product(r.booking.productId); const lead = r.passengers.find(x => x.isLead) || r.passengers[0] || {};
    const pk = r.booking.pickup || {}; const firstTime = (p && p.itinerary[0] && p.itinerary[0].items[0]) ? p.itinerary[0].items[0].time : '';
    const rcvBal = DB.receivables.filter(x => x.resId === r.id && x.status !== 'pagada' && x.due > T());
    const vars = { pasajero: lead.name || '', reserva: r.id, producto: p ? p.name : '', fecha: Util.date(r.booking.date), hora_recojo: (r.services[0] && r.services[0].time !== '—' ? r.services[0].time : firstTime) || 'por confirmar', punto_recojo: [pk.point, pk.address].filter(Boolean).join(' — ') || 'por confirmar', saldo: rcvBal.length ? money(sum(rcvBal, x => x.amount - x.paid), r.currency) : money(0, r.currency), fecha_saldo: r.booking.payment.balanceDue ? Util.date(r.booking.payment.balanceDue) : '—', enlace_portal: 'https://andeshorizonte.pe/mi-cuenta/reservas/' + r.id };
    const fill = (s) => String(s || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m0, k) => vars[k] != null ? vars[k] : m0);
    const cond = (x) => { const cd = x.conditions; if (!cd || typeof cd !== 'object') return true; const prods = cd.products || cd.productIds || []; if (prods.length && !prods.includes(r.booking.productId)) return false; if (cd.channels && cd.channels.length && !cd.channels.some(ch => ['E-commerce', 'Sitio web', 'web'].includes(ch))) return false; if (cd.requiresRule && !BE.on(cd.requiresRule, p)) return false; if (cd.onlyIfBalance && !rcvBal.length) return false; if (cd.onlyIfMissingDocs && !r.booking.companionsPending) return false; return true; };
    let n = 0; const now = nowStr();
    tpls.filter(cond).forEach(x => (x.channels || ['email']).forEach(ch => {
      const to = ch === 'email' ? (lead.email || '') : ch === 'whatsapp' ? (lead.phone || '') : ch === 'push' ? 'app:' + r.clientId : 'portal:' + r.clientId;
      const off = +x.offsetHours || 0; const sched = off > 0 ? plusMin(now, off * 60) : now;
      if (DB.paxMessages.some(m => m.resId === r.id && m.templateId === x.id && m.channel === ch && m.status !== 'cancelado')) return;
      DB.paxMessages.unshift({ id: 'MSG-' + String(DB.paxMessages.length + 5001).padStart(6, '0'), resId: r.id, templateId: x.id, channel: ch, to, subject: fill(x.subject), body: fill(x.body), status: off > 0 ? 'programado' : 'enviado', scheduledAt: sched, sentAt: off > 0 ? null : now, readAt: null, direction: 'saliente', auto: true, origin: 'Sitio web' });
      n++;
    }));
    if (n) { Store.save(); Audit.log('Reserva', r.id, 'mensajes_pasajero', '', n + ' mensaje(s) desde plantillas · ' + events[0]); }
    return n;
  }
  function issueVouchers(r) {
    const out = [];
    r.services.filter(s => s.status === 'confirmado' && s.kind !== 'recargo' && !DB.vouchers.some(v => v.serviceId === s.id && v.status !== 'anulado')).forEach(s => {
      const v = { id: Seq.next('Voucher'), resId: r.id, serviceId: s.id, service: s.name.replace(/ \(salida .*\)$/, ''), providerId: s.providerId, date: s.date, pax: typeof s.pax === 'number' ? s.pax : r.passengers.length, status: 'emitido', version: 1, issuedAt: nowStr(), issuedBy: Auth.user ? Auth.user.id : 'Sistema' };
      DB.vouchers.unshift(v); out.push(v);
    });
    return out;
  }
  function finishCart(c, order) { c.status = 'convertido'; c.orderId = order.id; c.updatedAt = nowStr(); ls.del(LSK.cart); Store.save(); }

  /* ================= CONFIRMACIÓN ================= */
  const canSeeOrder = (o) => o && (myOrders().includes(o.id) || (clientUser() && o.clientId === clientUser().clientId));
  function voucherDoc(v) {
    const r = Q.reservation(v.resId); const s = (r.services || []).find(x => x.id === v.serviceId) || {};
    return '<div class="doc"><div class="doc-head"><div><h2>Andes Horizonte Travel S.A.C.</h2><div class="muted">RUC ' + DB.tenant.ruc + ' · Av. José Larco 1150, Of. 602, Miraflores<br>Operaciones Cusco: Calle Plateros 348 · Emergencias 24/7 ' + EMERG + '</div></div><div style="text-align:right"><h3>VOUCHER DE SERVICIO</h3><div style="font-family:var(--f-mono)">' + esc(v.id) + '</div><div class="muted">v' + v.version + ' · ' + esc(v.issuedAt) + '</div></div></div>' +
      '<table><tr><th>Servicio</th><th>Fecha / hora</th><th>Pax</th><th>Confirmación</th></tr><tr><td>' + esc(v.service) + '</td><td>' + Util.date(v.date) + ' · ' + esc(s.time || '—') + '</td><td>' + v.pax + '</td><td>' + esc(s.confirmationCode || '—') + '</td></tr></table>' +
      '<p><b>Reserva:</b> ' + esc(r.id) + ' · <b>Titular:</b> ' + esc(Q.clientName(r.clientId)) + '</p><p><b>Pasajeros:</b> ' + r.passengers.map(p => esc(p.name) + (p.doc ? ' (' + esc(p.doc) + ')' : '')).join(', ') + '</p>' + (r.booking && r.booking.pickup && r.booking.pickup.point ? '<p><b>Recojo:</b> ' + esc([r.booking.pickup.point, r.booking.pickup.address].filter(Boolean).join(' — ')) + '</p>' : '') + '<p><b>Proveedor:</b> ' + esc(Q.providerName(v.providerId)) + '</p>' +
      '<p class="muted" style="margin-top:10px">Presente este voucher (impreso o digital) y el documento de identidad de cada pasajero. En producción el PDF se genera por job en la cola "documents" e incluye un código QR verificable.</p></div>';
  }
  function pConfirm(id) {
    const o = DB.ecomOrders.find(x => x.id === id);
    if (!canSeeOrder(o)) return { title: 'Confirmación', html: crumbs([['Confirmación']]) + '<div class="ws-wrap ws-sec">' + UI.alert('warn', 'No encontramos este pedido en su navegador. Consulte su reserva con su correo y número de reserva en <a href="#/sitio/cuenta/reserva"><b>Gestionar mi reserva</b></a>.') + '</div>' };
    const rs = (o.resIds || [o.resId]).map(Q.reservation).filter(Boolean); const r0 = rs[0];
    const vous = DB.vouchers.filter(v => rs.some(r => r.id === v.resId) && v.status !== 'anulado'); const rcvs = DB.receivables.filter(x => rs.some(r => r.id === x.resId));
    const later = o.payMode === 'pagar_despues'; const pending = o.status === 'pago_pendiente'; const paid = rnd2(sum(rcvs, 'paid')); const tot = rnd2(sum(rs, 'total')); const bal = rnd2(tot - paid);
    const bk = r0.booking || {}; const holdUntil = bk.payment && bk.payment.holdUntil;
    const anyPend = rs.some(r => r.booking && r.booking.companionsPending);
    const steps = later ? [['Reserva bloqueada sin pago', 'Sus cupos quedan reservados hasta ' + holdUntil + '. Pague desde Mi cuenta antes de esa hora o se liberan automáticamente.', 'lock'], ['Pago', 'Al registrar el pago confirmamos los servicios y le enviamos los vouchers.', 'wallet'], ['Antes del viaje', 'Recibirá la ficha de viaje con horarios de recojo 48 horas antes.', 'calendar']]
      : pending ? [['Pago en validación', 'Finanzas valida su abono en máximo 4 horas hábiles (lun–sáb). Le avisaremos por correo y WhatsApp.', 'clock'], ['Confirmación de la reserva', 'Con el abono validado, confirmamos los servicios y le enviamos los vouchers.', 'checkCircle'], ['Antes del viaje', 'Recibirá la ficha de viaje con horarios de recojo 48 horas antes.', 'calendar']]
        : [['Confirmación enviada', 'Enviamos la confirmación a ' + o.email + (vous.length ? ' con sus vouchers.' : '.'), 'mail'], rs.some(r => r.status === 'pendiente_proveedor') ? ['Confirmación con proveedores', 'Hoteles y adicionales se confirman con cada proveedor en máximo 24 horas; le avisaremos.', 'clock'] : ['Servicios confirmados', 'Sus cupos están asegurados y el equipo de operaciones ya tiene su reserva.', 'checkCircle'], o.payMode === 'anticipo' ? ['Pago del saldo', 'Saldo de ' + money(bal, o.currency) + (bk.payment && bk.payment.balanceDue ? ' hasta el ' + dt(bk.payment.balanceDue) : '') + ' desde Mi cuenta. Los vouchers se emiten al completar el pago.', 'wallet'] : ['Documentos listos', 'Vouchers disponibles en Mi cuenta y en el portal del pasajero.', 'ticket'], ['48 h antes del viaje', 'Le confirmamos por WhatsApp la hora exacta de recojo y el nombre de su guía.', 'phoneCall']];
    if (anyPend) steps.splice(1, 0, ['Datos de acompañantes', 'Complete los datos pendientes desde Mi cuenta antes del ' + dt(rs.find(r => r.booking && r.booking.companionsPending).booking.companionsDue) + '.', 'users']);
    const msgs = (DB.paxMessages || []).filter(mm => rs.some(r => r.id === mm.resId));
    const title = later ? (EN() ? 'Booking held — payment pending' : 'Reserva bloqueada — pago pendiente') : pending ? (EN() ? 'Booking received — payment under review' : 'Reserva recibida — pago en validación') : (EN() ? 'Thank you! Your booking is confirmed' : '¡Gracias! Su reserva está ' + (rs.every(r => r.status === 'confirmada') ? 'confirmada' : 'registrada'));
    const html = crumbs([['Confirmación']]) + '<div class="ws-wrap" style="padding-bottom:50px"><div class="ws-block" style="text-align:center;padding:28px 16px"><div style="width:56px;height:56px;border-radius:50%;margin:0 auto 10px;display:grid;place-items:center;background:' + (pending || later ? 'var(--warn-soft);color:var(--warn)' : 'var(--ok-soft);color:var(--ok)') + '">' + ic(pending || later ? 'clock' : 'checkCircle').replace('<svg', '<svg style="width:30px;height:30px"') + '</div><h1 style="font-size:1.4rem">' + title + '</h1><p class="muted" style="margin-top:6px">' + (rs.length > 1 ? (EN() ? 'Booking numbers' : 'Números de reserva') : (EN() ? 'Booking number' : 'Número de reserva')) + ' ' + rs.map(r => '<b class="mono" style="user-select:all;font-size:1.05rem">' + esc(r.id) + '</b>').join(', ') + ' · ' + (EN() ? 'Order' : 'Pedido') + ' <span class="mono">' + esc(o.id) + '</span></p><div class="row" style="justify-content:center;margin-top:10px">' + rs.map(r => UI.badge(r.status)).join('') + UI.badge(o.status, o.status === 'confirmado' ? 'Pago confirmado' : later ? 'Sin pago' : o.status === 'pago_pendiente' ? 'Pago por validar' : null) + '</div></div>' +
      '<div class="ws-2col" style="margin-top:18px"><div class="stack" style="min-width:0">' + rs.map(r => { const b = r.booking || {}; return '<div class="ws-block"><div class="row between" style="gap:8px"><h2 style="margin:0">' + esc((Q.product(b.productId) || {}).name || r.title) + '</h2><span class="mono small">' + esc(r.id) + '</span></div><div class="small muted" style="margin:4px 0 8px">' + (b.date ? dtw(b.date) + ' · ' : '') + r.passengers.length + ' pax' + (b.rooms ? ' · ' + b.rooms + ' hab. · ' + b.nights + ' noches' : '') + '</div>' + r.services.map(s => '<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--line-2);flex-wrap:nowrap;gap:8px"><div style="min-width:0"><b class="small">' + esc(s.name) + '</b><div class="xs faint">' + dtw(s.date) + ' · ' + esc(s.time) + (s.confirmationCode ? ' · ' + esc(s.confirmationCode) : '') + '</div></div>' + UI.badge(s.status) + '</div>').join('') + (b.pickup && b.pickup.point ? '<div class="small" style="margin-top:8px">' + smallIc('route') + ' ' + esc([b.pickup.point, b.pickup.address, b.pickup.flight ? 'vuelo ' + b.pickup.flight : '', b.pickup.arrival].filter(Boolean).join(' · ')) + '</div>' : '') + (b.comments ? '<div class="small muted" style="margin-top:4px">' + smallIc('msg') + ' “' + esc(b.comments) + '”</div>' : '') + '</div>'; }).join('') +
      '<div class="ws-block"><h2>Vouchers</h2>' + (vous.length ? vous.map(v => '<div class="row between" style="padding:6px 0;gap:8px"><span class="small" style="min-width:0"><b class="mono">' + esc(v.id) + '</b> · ' + esc(v.service) + '</span><button class="btn sm" data-a="vou" data-id="' + v.id + '">' + ic('ticket') + (EN() ? 'View' : 'Ver') + '</button></div>').join('') : '<p class="small muted">' + (later ? 'Se emitirán al completar el pago.' : pending ? 'Se emitirán al validarse el pago.' : o.payMode === 'anticipo' ? 'Se emitirán al completar el pago del saldo.' : 'Se emitirán cuando los proveedores confirmen los servicios pendientes.') + '</p>') + '</div>' +
      (msgs.length ? '<div class="ws-block"><h2>' + (EN() ? 'Messages scheduled for your trip' : 'Mensajes de su viaje') + '</h2>' + msgs.slice(0, 8).map(mm => '<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line-2);gap:8px;flex-wrap:nowrap"><div style="min-width:0"><b class="small">' + esc(mm.subject || '(sin asunto)') + '</b><div class="xs faint">' + esc(mm.channel) + ' · ' + esc(mm.status === 'programado' ? 'programado ' + mm.scheduledAt : 'enviado ' + (mm.sentAt || '')) + '</div></div>' + UI.badge(mm.status === 'programado' ? 'pendiente' : 'enviado', mm.status === 'programado' ? 'Programado' : 'Enviado') + '</div>').join('') + '</div>' : '') +
      '<div class="ws-block"><h2>' + (EN() ? 'What happens next' : 'Qué pasa ahora') + '</h2>' + UI.timeline(steps.map(s => ({ title: esc(s[0]), desc: esc(s[1]), icon: s[2] }))) + '</div></div>' +
      '<aside class="stack"><div class="ws-block"><h2>' + (EN() ? 'Payment' : 'Pago') + '</h2>' + UI.dl([['Total', money(tot, o.currency) + (o.currencyDisplay && o.currencyDisplay !== o.currency ? ' <span class="faint">(≈ ' + fmtC(o.totalDisplay, o.currencyDisplay) + ')</span>' : '')], ['Pagado', money(paid, o.currency)], ['Saldo', bal > 0 ? money(bal, o.currency) + (bk.payment && bk.payment.balanceDue && !later ? ' · vence ' + dt(bk.payment.balanceDue) : later ? ' · antes de ' + esc(holdUntil) : '') : '—'], ['Modalidad', later ? 'Pagar después (' + (bk.payment.holdHours || '') + ' h)' : o.payMode === 'anticipo' ? 'Adelanto ' + (bk.payment ? bk.payment.depositPct : '') + ' %' : 'Pago total'], ['Moneda', o.currency + (o.currencyDisplay && o.currencyDisplay !== o.currency ? ' · mostrado en ' + o.currencyDisplay : '')], ['Comprobante', r0.billing ? esc(r0.billing.type) + ' · ' + esc(r0.billing.doc) : '—']]) + '<p class="ws-note" style="margin-top:8px">El comprobante electrónico se emite al aplicarse el pago (OSE/SUNAT) y se envía a ' + esc(o.email) + '.</p></div>' +
      '<div class="ws-block"><h2>' + (EN() ? 'Manage your booking' : 'Gestione su reserva') + '</h2><div class="col">' + (clientUser() ? '<a class="btn primary" href="#/sitio/cuenta/reservas">' + ic('suitcase') + t('account') + '</a>' : '<p class="small muted">Cree su cuenta con ' + esc(o.email) + ' para ver sus reservas, pagar el saldo, completar datos de acompañantes y descargar vouchers.</p><a class="btn primary" href="#/sitio/cuenta?registro=1&email=' + encodeURIComponent(o.email) + '">' + ic('user') + 'Crear mi cuenta</a>') + '<button class="btn" data-a="wa">' + ic('msg') + t('wa') + '</button><a class="btn" href="#/sitio">' + (EN() ? 'Back to home' : 'Volver al inicio') + '</a></div></div></aside></div></div>';
    return { title: EN() ? 'Booking confirmation' : 'Confirmación de reserva', desc: '', html, after: () => {
      on('vou', (b) => { const v = DB.vouchers.find(x => x.id === b.dataset.id); UI.modal({ title: 'Voucher ' + v.id, size: 'lg', body: voucherDoc(v) }); });
      on('wa', () => waModal('Hola, tengo la reserva ' + r0.id + ' y quisiera hacer una consulta.'));
    } };
  }
  /* Completar acompañantes pendientes (R-COMPANIONS con when = antes_de_viaje) desde Mi cuenta */
  function companionsModal(r) {
    const p = Q.product(r.booking.productId); const list = r.passengers.map((x, i) => ({ x, i })).filter(o => !o.x.isLead);
    UI.modal({ title: 'Datos de acompañantes · ' + r.id, sub: 'Complételos antes del ' + dt(r.booking.companionsDue) + '. La edad se valida contra el tipo de pasajero.', size: 'lg', body: list.map(({ x, i }) => { const [f, ...l] = x.pending ? ['', ''] : x.name.split(' '); const [dty, dno] = String(x.doc || 'DNI ').split(' ');
      return '<div class="section-title" style="margin:10px 0">' + TY1(x.type) + ' ' + i + '</div><div class="form-grid">' + fld('cm' + i + '-first', 'Nombres', x.pending ? '' : f, { col: 4 }) + fld('cm' + i + '-last', 'Apellidos', x.pending ? '' : l.join(' '), { col: 4 }) + fld('cm' + i + '-birth', 'Fecha de nacimiento', x.birth, { col: 4, type: 'date', max: T() }) + fld('cm' + i + '-doctype', 'Documento', dty || 'DNI', { col: 3, opts: ['DNI', 'Pasaporte', 'CE'] }) + fld('cm' + i + '-doc', 'Número', dno || '', { col: 3 }) + fld('cm' + i + '-nat', 'Nacionalidad', x.nationality || 'Peruana', { col: 3, opts: NATS }) + fld('cm' + i + '-rel', 'Parentesco', x.relationship === 'Titular' ? 'Otro' : x.relationship, { col: 3, opts: REL.slice(1) }) + '</div>'; }).join(''),
      actions: [{ label: 'Cancelar' }, { label: 'Guardar datos', cls: 'primary', icon: 'check', onClick: (m) => {
        const g = (id) => { const e = m.querySelector('#' + id); return e ? e.value.trim() : ''; }; let ok = true; clearErr(m);
        const upd = list.map(({ x, i }) => { const o = { first: g('cm' + i + '-first'), last: g('cm' + i + '-last'), birth: g('cm' + i + '-birth'), doctype: g('cm' + i + '-doctype'), doc: g('cm' + i + '-doc').toUpperCase(), nat: g('cm' + i + '-nat'), rel: g('cm' + i + '-rel') };
          if (!o.first) { markErr(m, 'cm' + i + '-first', 'Obligatorio.'); ok = false; } if (!o.last) { markErr(m, 'cm' + i + '-last', 'Obligatorio.'); ok = false; }
          if (!validDoc(o.doctype, o.doc)) { markErr(m, 'cm' + i + '-doc', 'No válido.'); ok = false; }
          if (!o.birth) { markErr(m, 'cm' + i + '-birth', 'Obligatorio.'); ok = false; } else { const a = ageAt(o.birth, r.booking.date); const ty = BE.ageType(p, a); if (ty !== x.type) { markErr(m, 'cm' + i + '-birth', 'Tendrá ' + a + ' años: no corresponde a ' + TY1(x.type).toLowerCase() + ' (' + ageBand(BE.paxRules(p), x.type) + ').'); ok = false; } }
          return { x, o }; });
        if (!ok) { UI.toast('Revise los datos marcados.', 'bad'); return false; }
        const before = r.passengers.filter(z => z.pending).length;
        upd.forEach(({ x, o }) => Object.assign(x, { name: o.first + ' ' + o.last, doc: o.doctype + ' ' + o.doc, birth: o.birth, nationality: o.nat, relationship: o.rel, age: ageAt(o.birth, r.booking.date), pending: undefined }));
        r.booking.companionsPending = false; Store.save();
        Audit.log('Reserva', r.id, 'completar_acompanantes', before + ' pendientes', '0 pendientes · Mi cuenta (sitio web)');
        Notify.push('reserva.datos_completos', 'Portal', 'U05', 'Datos de acompañantes completados — ' + r.id);
        UI.toast('Datos de acompañantes guardados.'); App.render();
      } }] });
  }

  /* ================= MI CUENTA ================= */
  function pCuenta(tab, sub) {
    const q = query(); const u = clientUser();
    if (tab === 'reserva') return pLookup();
    if (!u) return pLogin(q);
    const cli = Q.client(u.clientId) || { id: u.clientId, name: u.name, email: u.email };
    const myRes = DB.reservations.filter(r => r.clientId === cli.id).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
    const resIds = new Set(myRes.map(r => r.id));
    const rcv = DB.receivables.filter(x => resIds.has(x.resId));
    const openR = rcv.filter(x => x.status !== 'pagada' && x.status !== 'anulada');
    const vous = DB.vouchers.filter(v => resIds.has(v.resId));
    tab = tab || 'reservas';
    const NAV2 = [['reservas', EN() ? 'My bookings' : 'Mis reservas', 'suitcase', myRes.length], ['vouchers', 'Vouchers', 'ticket', vous.filter(v => v.status === 'emitido').length], ['pagos', EN() ? 'Pending payments' : 'Pagos pendientes', 'wallet', openR.length], ['deseos', t('wish'), 'heart', wishList().length], ['datos', EN() ? 'Personal details' : 'Datos personales', 'user', null]];
    let body = '';
    const pendingPayFor = (x) => sum(DB.payments.filter(p => p.receivableId === x.id && p.status === 'pendiente'), p => conv(p.amount, p.currency, x.currency));
    if (tab === 'reservas') {
      body = '<div class="ws-block"><h2>' + (EN() ? 'My bookings' : 'Mis reservas') + '</h2>' + (myRes.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Reserva</th><th>Viaje</th><th>Fechas</th><th>Estado</th><th class="num">Total</th><th class="num">Saldo</th></tr></thead><tbody>' + myRes.map(r => { const paid = sum(rcv.filter(x => x.resId === r.id), 'paid'); const bal = r.status === 'cancelada' ? 0 : rnd2(r.total - paid); return '<tr><td class="mono small">' + esc(r.id) + '</td><td class="small">' + esc(r.title) + '<div class="xs faint">' + esc(r.channel) + (r.booking && r.booking.rooms ? ' · ' + r.booking.rooms + ' hab. · ' + r.booking.nights + ' noches' : '') + '</div>' + (r.booking && r.booking.companionsPending ? '<button class="btn xs sun" data-a="comp" data-id="' + r.id + '" style="margin-top:4px">' + ic('users') + 'Completar acompañantes</button>' : '') + '</td><td class="small nowrap">' + Util.dateShort(r.travelFrom) + ' – ' + Util.dateShort(r.travelTo) + '</td><td>' + UI.badge(r.status) + '</td><td class="num nowrap">' + money(r.total, r.currency) + '</td><td class="num nowrap">' + (bal > 0 ? '<b class="warn">' + money(bal, r.currency) + '</b>' : '<span class="ok">Pagado</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' : UI.empty('Aún no tiene reservas.', 'suitcase')) +
        '<div class="row" style="margin-top:12px"><a class="btn" href="#/canales/portal-cliente/' + cli.id + '/inicio">' + ic('globe') + 'Abrir portal del cliente (cotizaciones, documentos, soporte)</a></div></div>';
    } else if (tab === 'vouchers') {
      body = '<div class="ws-block"><h2>Vouchers</h2>' + (vous.length ? vous.map(v => '<div class="row between" style="padding:9px 0;border-bottom:1px solid var(--line-2)"><div style="min-width:0"><b class="small mono">' + esc(v.id) + '</b> · <span class="small">' + esc(v.service) + '</span><div class="xs faint">' + dt(v.date) + ' · ' + v.pax + ' pax · reserva ' + esc(v.resId) + '</div></div><div class="row" style="gap:6px">' + UI.badge(v.status) + '<button class="btn sm" data-a="vou" data-id="' + v.id + '">' + ic('eye') + 'Ver</button></div></div>').join('') : UI.empty('Sin vouchers emitidos.', 'ticket')) + '<p class="ws-note" style="margin-top:8px">Los vouchers se emiten con el pago total y la confirmación del proveedor (Regla transversal 11).</p></div>';
    } else if (tab === 'pagos') {
      body = '<div class="ws-block"><h2>' + (EN() ? 'Pending payments' : 'Pagos pendientes') + '</h2>' + (openR.length ? openR.map(x => { const pend = pendingPayFor(x); const rem = rnd2(x.amount - x.paid - pend); return '<div class="row between" style="padding:10px 0;border-bottom:1px solid var(--line-2)"><div style="min-width:0"><b class="small">' + esc(x.concept) + '</b><div class="xs faint">' + esc(x.id) + ' · reserva ' + esc(x.resId) + ' · vence ' + dt(x.due) + '</div>' + (pend ? '<div class="xs warn" style="font-weight:700">' + money(pend, x.currency) + ' en validación</div>' : '') + '</div><div class="row" style="gap:8px">' + UI.badge(x.status === 'abierta' && x.due < T() ? 'vencida' : x.status) + '<b class="nowrap">' + money(rem, x.currency) + '</b>' + (rem > 0 ? '<button class="btn sm sun" data-a="paybal" data-id="' + x.id + '">' + ic('card') + (EN() ? 'Pay' : 'Pagar') + '</button>' : '') + '</div></div>'; }).join('') : UI.alert('ok', 'No tiene pagos pendientes.')) + '</div>';
    } else if (tab === 'deseos') {
      const w = wishList().map(Q.product).filter(p => p && siteProducts().includes(p));
      body = '<div class="ws-block"><h2>' + t('wish') + '</h2>' + (w.length ? '<div class="ws-grid">' + w.map(card).join('') + '</div>' : UI.empty('Guarde tours con el ícono de corazón para verlos aquí.', 'heart')) + '</div>';
    } else {
      body = '<div class="ws-block"><h2>' + (EN() ? 'Personal details' : 'Datos personales') + '</h2><div class="form-grid">' + fld('me-name', 'Nombres y apellidos', cli.name, { col: 12 }) + fld('me-email', 'Correo', cli.email, { type: 'email' }) + fld('me-phone', 'Celular', cli.phone) + fld('me-doc', 'Documento', cli.doc, { req: false }) + fld('me-city', 'Ciudad', cli.city, { req: false }) + fld('me-country', 'País', cli.country, { req: false }) + fld('me-birth', 'Fecha de nacimiento', cli.birth || '', { type: 'date', req: false }) +
        '<div class="c12"><label class="check"><input type="checkbox" id="me-news"' + ((DB.subscribers || []).some(s => (s.email || '').toLowerCase() === (cli.email || '').toLowerCase() && s.status !== 'baja') ? ' checked' : '') + '> Recibir ofertas y novedades (boletín)</label></div></div><div class="row end" style="margin-top:12px"><button class="btn primary" data-a="saveme">' + ic('check') + 'Guardar cambios</button></div>' +
        '<div class="divider" style="margin:16px 0"></div><p class="small muted">Derechos ARCO (acceso, rectificación, cancelación y oposición): puede solicitarlos a privacidad@andeshorizonte.pe o desde <a href="#/sitio/contacto">Contacto</a>. Atendemos en el plazo legal.</p></div>';
    }
    const html = crumbs([[t('account')]]) + '<div class="ws-wrap ws-page-h"><div class="row between"><div><h1>' + (EN() ? 'Hello, ' : 'Hola, ') + esc(u.name.split(' ')[0]) + '</h1><p>' + esc(cli.email || '') + ' · ' + esc(cli.id) + '</p></div><button class="btn" data-a="logout">' + ic('logout') + (EN() ? 'Sign out' : 'Cerrar sesión') + '</button></div></div>' +
      '<div class="ws-wrap ws-acc"><nav class="ws-accnav">' + NAV2.map(n => '<a href="#/sitio/cuenta/' + n[0] + '" class="' + (tab === n[0] ? 'on' : '') + '">' + ic(n[2]) + esc(n[1]) + (n[3] ? ' <span class="badge" style="margin-left:auto">' + n[3] + '</span>' : '') + '</a>').join('') + '</nav><div class="stack">' + body + '</div></div>';
    return { title: t('account'), desc: '', html, after: (el) => {
      on('logout', () => { Audit.log('Sesión', u.id, 'logout', '', 'sitio web'); Auth.user = null; try { localStorage.removeItem('kipucontrol_session'); } catch (e) { } UI.toast('Sesión cerrada.'); App.go('#/sitio'); });
      on('vou', (b) => { const v = DB.vouchers.find(x => x.id === b.dataset.id); UI.modal({ title: 'Voucher ' + v.id, size: 'lg', body: voucherDoc(v) }); });
      on('comp', (b) => { const r = Q.reservation(b.dataset.id); if (r && r.clientId === cli.id) companionsModal(r); });
      on('paybal', (b) => payBalance(DB.receivables.find(x => x.id === b.dataset.id), pendingPayFor));
      on('saveme', () => {
        const g = (id) => el.querySelector('#' + id).value.trim(); clearErr(el);
        if (!g('me-name')) { markErr(el, 'me-name', 'Obligatorio.'); return; } if (!emailOk(g('me-email'))) { markErr(el, 'me-email', 'Correo no válido.'); return; }
        const before = [cli.name, cli.email, cli.phone].join(' / ');
        Object.assign(cli, { name: g('me-name'), email: g('me-email').toLowerCase(), phone: g('me-phone'), doc: g('me-doc'), city: g('me-city'), country: g('me-country'), birth: g('me-birth') || cli.birth });
        const sub = (DB.subscribers || []).find(s => (s.email || '').toLowerCase() === cli.email); const want = el.querySelector('#me-news').checked;
        if (want && (!sub || sub.status === 'baja')) upsertSubscriber({ email: cli.email, name: cli.name, phone: cli.phone, source: 'Mi cuenta (sitio web)', clientId: cli.id });
        else if (!want && sub && sub.status !== 'baja') unsubscribe(cli.email);
        Store.save(); Audit.log('Cliente', cli.id, 'actualizar_datos_sitio', before, [cli.name, cli.email, cli.phone].join(' / ')); UI.toast('Datos actualizados.'); App.render();
      });
    } };
  }
  function payBalance(x, pendingPayFor) {
    const rem = rnd2(x.amount - x.paid - pendingPayFor(x)); const r = Q.reservation(x.resId);
    UI.modal({ title: 'Pagar ' + money(rem, x.currency), sub: esc(x.concept) + ' · reserva ' + esc(x.resId), size: 'sm', body: '<div class="form-grid">' + fld('pb-num', 'Número de tarjeta', '', { col: 12, ph: '4111 1111 1111 1111', hint: 'Sandbox: 4111… aprobada · 4000 0000 0000 0002 rechazada.' }) + fld('pb-exp', 'Vencimiento', '12/29', { col: 6 }) + fld('pb-cvv', 'CVV', '', { col: 6, type: 'password' }) + '</div>',
      actions: [{ label: 'Cancelar' }, { label: 'Pagar', cls: 'sun', icon: 'lock', onClick: (m) => {
        const d = m.querySelector('#pb-num').value.replace(/\D/g, ''); if (!/^\d{3,4}$/.test(m.querySelector('#pb-cvv').value.trim())) { UI.toast('CVV inválido.', 'bad'); return false; }
        if (!['4111111111111111', '5555555555554444', '378282246310005', '36227206271667'].includes(d)) {
          DB.payments.unshift({ id: nextId(DB.payments, 'PAG-', 5), receivableId: x.id, resId: x.resId, method: 'Tarjeta (sitio web)', amount: rem, currency: x.currency, date: T(), status: 'rechazado', ref: 'Rechazo emisor · código ' + (d === '4000000000000002' ? '51' : '14'), by: 'Sistema' }); Store.save();
          Audit.log('Pago', x.id, 'pago_rechazado', '', '•••• ' + d.slice(-4)); UI.toast('Pago rechazado por el emisor. Intente con otra tarjeta.', 'bad'); return false;
        }
        const pay = { id: nextId(DB.payments, 'PAG-', 5), receivableId: x.id, resId: x.resId, method: 'Tarjeta (sitio web)', amount: rem, currency: x.currency, date: T(), status: 'aplicado', ref: 'TXN ' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0') + ' · •••• ' + d.slice(-4), by: 'Sistema' };
        DB.payments.unshift(pay); x.paid = rnd2(x.paid + rem); if (x.paid >= x.amount - 0.009) x.status = 'pagada';
        const allPaid = DB.receivables.filter(y => y.resId === x.resId).every(y => y.status === 'pagada');
        let vous = []; if (allPaid && r) { if (r.status === 'pendiente_pago') r.status = r.services.every(s => s.status === 'confirmado') ? 'confirmada' : 'pendiente_proveedor'; vous = issueVouchers(r); }
        Store.save(); Audit.log('Pago', pay.id, 'aplicar', 'pendiente', 'aplicado · ' + money(rem, x.currency) + ' · ' + x.id);
        Notify.push('pago.recibido', 'Email', clientUser().email, 'Pago recibido — ' + x.concept);
        vous.forEach(v => Audit.log('Voucher', v.id, 'emitir', '', 'emitido v1 (saldo pagado en sitio web)')); if (vous.length) Notify.push('voucher.emitido', 'Email', clientUser().email, 'Sus vouchers de la reserva ' + r.id);
        track('purchase_balance', { receivable: x.id, value: rem, currency: x.currency });
        UI.toast('Pago aplicado' + (vous.length ? '. Se emitieron ' + vous.length + ' voucher(s).' : '.')); App.render();
      } }] });
  }
  function pLogin(q) {
    const reg = q.registro === '1';
    const html = crumbs([[t('account')]]) + pageH(reg ? (EN() ? 'Create your account' : 'Cree su cuenta') : t('account'), EN() ? 'Manage your bookings, pay balances and download vouchers.' : 'Gestione sus reservas, pague saldos y descargue vouchers.') +
      '<div class="ws-wrap ws-2col"><div class="ws-block"><div class="tabs" style="margin-bottom:14px"><button class="tab' + (reg ? '' : ' on') + '" data-a="tab" data-v="0">Ingresar</button><button class="tab' + (reg ? ' on' : '') + '" data-a="tab" data-v="1">Crear cuenta</button></div>' +
      (reg ? '<div class="form-grid">' + fld('rg-name', 'Nombres y apellidos', '', { col: 12 }) + fld('rg-email', 'Correo', q.email || '', { type: 'email' }) + fld('rg-phone', 'Celular', '') + fld('rg-doctype', 'Documento', 'DNI', { col: 3, opts: ['DNI', 'Pasaporte', 'CE'] }) + fld('rg-doc', 'Número', '', { col: 3 }) + fld('rg-pass', 'Contraseña', '', { type: 'password', hint: 'Mínimo 8 caracteres.' }) +
        '<div class="c12"><label class="check" style="align-items:flex-start"><input type="checkbox" id="rg-ok"> <span>Acepto los <a href="#/sitio/legal/terminos">Términos</a> y autorizo el tratamiento de mis datos (Ley 29733). <span class="req">*</span></span></label></div><div class="c12"><button class="btn primary" data-a="register" style="width:100%;justify-content:center">' + ic('user') + 'Crear cuenta</button></div></div>'
        : '<div class="form-grid">' + fld('lg-email', 'Correo', q.email || '', { col: 12, type: 'email' }) + fld('lg-pass', 'Contraseña', '', { col: 12, type: 'password' }) + '<div class="c12"><button class="btn primary" data-a="login" style="width:100%;justify-content:center">' + ic('lock') + 'Ingresar</button></div><div class="c12 xs faint">Demo: cualquier contraseña. Cuentas de cliente existentes, p. ej. gabriela.rios@correo.pe.</div></div>' +
          '<div class="divider" style="margin:16px 0"></div><button class="btn" data-a="demo" style="width:100%;justify-content:center">' + ic('user') + 'Ingresar como Gabriela Ríos (cliente demo U14)</button>') + '</div>' +
      '<aside class="stack"><div class="ws-block"><h2>' + (EN() ? 'Manage a booking without an account' : 'Gestionar una reserva sin cuenta') + '</h2><p class="small muted">Consulte el estado, los servicios y los vouchers con su correo y número de reserva.</p><a class="btn" href="#/sitio/cuenta/reserva" style="margin-top:10px">' + ic('search') + 'Buscar mi reserva</a></div>' +
      '<div class="ws-block"><h2>' + (EN() ? 'Benefits' : 'Beneficios de su cuenta') + '</h2><ul class="ws-ul ok">' + ['Historial de reservas y pagos', 'Pago del saldo en línea', 'Vouchers y documentos del viaje', 'Lista de deseos sincronizada', 'Cotizaciones de su asesor en el portal del cliente'].map(x => '<li>' + ic('check') + x + '</li>').join('') + '</ul></div></aside></div>';
    const back = () => App.go(q.volver === 'checkout' ? '#/sitio/checkout' : '#/sitio/cuenta');
    const doLogin = (usr) => { const anonWish = ls.get(LSK.wish, []); Auth.login(usr.id); Audit.log('Sesión', usr.id, 'login_sitio_web', '', 'OK'); if (anonWish.length && usr.clientId) { const l = DB.wishlists[usr.clientId] || []; anonWish.forEach(p => { if (!l.includes(p)) l.push(p); }); DB.wishlists[usr.clientId] = l; ls.del(LSK.wish); } const c = getCart(false); if (c && usr.clientId) c.clientId = usr.clientId; Store.save(); CO = null; track('login', { method: 'email' }); UI.toast('Bienvenido(a), ' + esc(usr.name.split(' ')[0]) + '.'); back(); };
    return { title: t('account'), desc: '', html, after: (el) => {
      on('tab', (b) => App.go('#/sitio/cuenta?' + qs({ registro: b.dataset.v === '1' ? '1' : '', volver: q.volver || '', email: q.email || '' })));
      on('demo', () => doLogin(Q.user('U14')));
      on('login', () => {
        const email = el.querySelector('#lg-email').value.trim().toLowerCase(); clearErr(el);
        if (!emailOk(email)) { markErr(el, 'lg-email', 'Correo no válido.'); return; }
        if (!el.querySelector('#lg-pass').value) { markErr(el, 'lg-pass', 'Ingrese su contraseña.'); return; }
        const usr = DB.users.find(x => (x.email || '').toLowerCase() === email && x.clientId && x.status === 'activo' && ['customer', 'passenger'].includes(x.role));
        if (!usr) { Audit.log('Sesión', email, 'login_fallido_sitio_web', '', 'usuario no encontrado'); UI.toast('Correo o contraseña incorrectos. Si compró como invitado, cree su cuenta con el mismo correo.', 'bad'); return; }
        doLogin(usr);
      });
      on('register', () => {
        const g = (id) => el.querySelector('#' + id).value.trim(); clearErr(el); let ok = true;
        const d = { name: g('rg-name'), email: g('rg-email').toLowerCase(), phone: g('rg-phone'), doctype: g('rg-doctype'), doc: g('rg-doc').toUpperCase(), pass: el.querySelector('#rg-pass').value };
        if (d.name.split(' ').filter(Boolean).length < 2) { markErr(el, 'rg-name', 'Nombres y apellidos.'); ok = false; }
        if (!emailOk(d.email)) { markErr(el, 'rg-email', 'Correo no válido.'); ok = false; }
        if (!validDoc(d.doctype, d.doc)) { markErr(el, 'rg-doc', 'Documento no válido.'); ok = false; }
        if (d.pass.length < 8) { markErr(el, 'rg-pass', 'Mínimo 8 caracteres.'); ok = false; }
        if (!el.querySelector('#rg-ok').checked) { UI.toast('Debe aceptar los términos y el tratamiento de datos.', 'bad'); ok = false; }
        if (!ok) return;
        if (DB.users.some(x => (x.email || '').toLowerCase() === d.email)) { UI.toast('Ya existe una cuenta con ese correo. Ingrese con su contraseña.', 'bad'); return; }
        let cli = DB.clients.find(x => (x.email || '').toLowerCase() === d.email);
        if (!cli) { cli = { id: nextId(DB.clients, 'CLI-', 4), kind: 'Persona', name: d.name, doc: d.doctype + ' ' + d.doc, email: d.email, phone: d.phone, country: d.doctype === 'DNI' ? 'Perú' : '', city: '', segment: 'Retail', owner: 'U03', createdAt: T(), tags: ['Web', 'Cuenta sitio'], nps: null, contacts: [], consents: { privacy: nowStr(), policyVersion: 'PDP-2026.1' } }; DB.clients.push(cli); Audit.log('Cliente', cli.id, 'crear_desde_registro_web', '', d.email); }
        const usr = { id: nextId(DB.users, 'U', 2), clientId: cli.id, name: cli.name, email: d.email, role: 'customer', sede: 'SED-01', status: 'activo', lastLogin: nowStr(), mfa: false, phone: d.phone || cli.phone, color: '#1560B8', createdVia: 'Sitio web' };
        DB.users.push(usr); Store.save(); Audit.log('Usuario', usr.id, 'registro_cliente_web', '', 'customer · ' + cli.id);
        Notify.push('cuenta.bienvenida', 'Email', d.email, 'Bienvenido(a) a Andes Horizonte Travel — verifique su correo');
        track('sign_up', { method: 'email', client: cli.id });
        doLogin(usr);
      });
    } };
  }
  function pLookup() {
    const html = crumbs([[t('account'), '#/sitio/cuenta'], [EN() ? 'Manage my booking' : 'Gestionar mi reserva']]) + pageH(EN() ? 'Manage my booking' : 'Gestionar mi reserva', 'Ingrese el correo del comprador y el número de reserva (RES-…) o de pedido (WEB-…).') +
      '<div class="ws-wrap" style="padding-bottom:50px;max-width:720px"><div class="ws-block"><div class="form-grid">' + fld('lk-email', 'Correo del comprador', '', { type: 'email' }) + fld('lk-code', 'Número de reserva o pedido', '', { ph: 'RES-2026-000350' }) + '<div class="c12"><button class="btn primary" data-a="look">' + ic('search') + 'Buscar</button></div></div></div><div id="lk-out" style="margin-top:14px"></div></div>';
    return { title: 'Gestionar mi reserva', desc: '', html, after: (el) => on('look', () => {
      const email = el.querySelector('#lk-email').value.trim().toLowerCase(); const code = el.querySelector('#lk-code').value.trim().toUpperCase();
      const o = DB.ecomOrders.find(x => (x.id === code || x.resId === code) && (x.email || '').toLowerCase() === email);
      const r = o ? Q.reservation(o.resId) : DB.reservations.find(x => x.id === code && (Q.client(x.clientId) || {}).email === email);
      Audit.log('Consulta pública', code || '—', 'buscar_reserva', '', r ? 'encontrada' : 'no encontrada');
      if (!r) { el.querySelector('#lk-out').innerHTML = UI.alert('warn', 'No encontramos una reserva con esos datos. Verifique el correo y el número.'); return; }
      if (o) { const mine = myOrders(); if (!mine.includes(o.id)) { mine.unshift(o.id); ls.set(LSK.orders, mine.slice(0, 20)); } App.go('#/sitio/confirmacion/' + o.id); return; }
      el.querySelector('#lk-out').innerHTML = '<div class="ws-block">' + UI.dl([['Reserva', esc(r.id)], ['Estado', UI.badge(r.status)], ['Viaje', esc(r.title)], ['Fechas', dt(r.travelFrom) + ' – ' + dt(r.travelTo)]]) + '<p class="small muted" style="margin-top:10px">Para ver vouchers y pagos, ingrese a <a href="#/sitio/cuenta">Mi cuenta</a>.</p></div>';
    }) };
  }

  /* ================= OFERTAS ================= */
  function pOfertas() {
    const offs = offersList();
    const html = crumbs([[t('ofertas')]]) + pageH(t('offers_t'), EN() ? 'Online prices and promo codes. Discounts are not cumulative: the system applies the best one.' : 'Precios web y códigos promocionales vigentes. Los descuentos no son acumulables: el sistema aplica el mayor.') +
      '<div class="ws-wrap" style="padding-bottom:50px"><div class="ws-grid g3">' + offs.map(offerCard).join('') + '</div>' + (offs.length ? '' : UI.empty('No hay ofertas vigentes.', 'tag')) +
      '<div class="ws-block" style="margin-top:22px"><h2>' + t('deps_t') + '</h2><div class="ws-deps">' + upcomingDeps(8).map(depRow).join('') + '</div></div>' +
      '<p class="ws-note" style="margin-top:12px">Condiciones: promociones sujetas a disponibilidad y vigencia de compra; el código se ingresa en el carrito. Las promociones se configuran en Catálogo › Producto › Promociones y en Canales › E-commerce.</p></div>';
    return { nav: 'ofertas', title: EN() ? 'Deals and promo codes' : 'Ofertas y promociones de viaje', desc: 'Precios web, códigos promocionales y salidas garantizadas con cupos.', html, after: () => on('copy', (b) => { UI.copy(b.dataset.v); track('select_promotion', { code: b.dataset.v }); }) };
  }

  /* ================= VIAJES A MEDIDA ================= */
  function pMedida() {
    const q = query(); const pr = q.producto ? Q.product(q.producto) : null;
    const interests = ['Cultura e historia', 'Aventura y trekking', 'Naturaleza y fauna', 'Gastronomía', 'Relax y bienestar', 'Fotografía', 'Viaje en familia', 'Luna de miel', 'Turismo vivencial'];
    const html = crumbs([[t('medida')]]) + pageH(t('medida'), EN() ? 'Tell us about your ideal trip. An advisor will send you a personalized proposal.' : 'Cuéntenos cómo imagina su viaje. Un asesor le enviará una propuesta personalizada con itinerario y precio.') +
      '<div class="ws-wrap ws-2col"><div class="ws-block" id="md-f"><div class="form-grid">' +
      '<div class="section-title">Su viaje</div><div class="field c12"><label>Destinos de interés <span class="req">*</span></label><div class="ws-chips" id="md-dest">' + DEST.map(d => '<button type="button" class="ws-chip' + (q.destino === d.slug ? ' on' : '') + '" data-a="chip" data-v="' + esc(d.name) + '">' + esc(d.name) + '</button>').join('') + '</div></div>' +
      fld('md-from', 'Fecha de inicio', q.fecha || '', { col: 4, type: 'date' }) + fld('md-to', 'Fecha de regreso', '', { col: 4, type: 'date', req: false }) + fld('md-flex', 'Flexibilidad', 'Fechas exactas', { col: 4, opts: ['Fechas exactas', '± 3 días', '± 1 semana', 'Aún no defino fechas'], req: false }) +
      fld('md-adt', 'Adultos', q.pax || '2', { col: 3, type: 'number' }) + fld('md-chd', 'Niños (2–11)', '0', { col: 3, type: 'number', req: false }) + fld('md-budget', 'Presupuesto por persona', 'US$ 1 000 – 2 000', { col: 6, opts: ['Hasta US$ 500', 'US$ 500 – 1 000', 'US$ 1 000 – 2 000', 'US$ 2 000 – 3 500', 'Más de US$ 3 500'] }) +
      '<div class="field c12"><label>Intereses</label><div class="ws-chips" id="md-int">' + interests.map(i => '<button type="button" class="ws-chip" data-a="chip" data-v="' + esc(i) + '">' + esc(i) + '</button>').join('') + '</div></div>' +
      fld('md-hotel', 'Categoría de hotel', '4 estrellas', { col: 6, opts: ['3 estrellas', '4 estrellas', '5 estrellas / boutique', 'Hostal / económico', 'Sin alojamiento'], req: false }) + fld('md-mode', 'Tipo de servicio', 'Privado', { col: 6, opts: ['Privado', 'Compartido', 'Indistinto'], req: false }) +
      '<div class="field c12"><label for="md-notes">Comentarios</label><textarea class="input" id="md-notes" rows="3" placeholder="Celebraciones, ritmo de viaje, necesidades especiales, vuelos ya comprados…">' + (pr ? 'Me interesa: ' + esc(pr.name) + '.' : '') + '</textarea></div>' +
      '<div class="section-title">Sus datos</div>' + fld('md-name', 'Nombres y apellidos', clientUser() ? clientUser().name : '', { col: 12 }) + fld('md-email', 'Correo', clientUser() ? clientUser().email : '', { type: 'email' }) + fld('md-phone', 'Celular / WhatsApp', clientUser() ? clientUser().phone : '') + fld('md-country', 'País', 'Perú', { opts: ['Perú', 'Argentina', 'Chile', 'Colombia', 'México', 'Estados Unidos', 'España', 'Alemania', 'Francia', 'Otro'], req: false }) + fld('md-contact', 'Prefiere que lo contactemos por', 'WhatsApp', { opts: ['WhatsApp', 'Correo', 'Llamada'], req: false }) +
      '<div class="c12"><label class="check" style="align-items:flex-start"><input type="checkbox" id="md-ok"> <span>Autorizo el tratamiento de mis datos para recibir la cotización solicitada (Ley 29733). <a href="#/sitio/legal/privacidad">Política de privacidad</a> <span class="req">*</span></span></label></div><div class="c12"><button class="btn sun" data-a="send" style="height:44px">' + ic('send') + 'Solicitar cotización</button></div></div></div>' +
      '<aside class="stack"><div class="ws-block"><h2>Cómo trabajamos</h2>' + UI.timeline([{ title: 'Recibimos su solicitud', desc: 'Ingresa a nuestra cola comercial como lead web.', icon: 'mail' }, { title: 'Le contactamos en máx. 24 h hábiles', desc: 'Un asesor especialista confirma detalles (4 h en horario de oficina).', icon: 'phoneCall' }, { title: 'Propuesta con itinerario y precio', desc: 'Cotización versionada que puede aprobar en línea desde el portal del cliente.', icon: 'file' }, { title: 'Reserva y viaje', desc: 'Confirmamos servicios, emitimos vouchers y le acompañamos 24/7.', icon: 'checkCircle' }]) + '</div>' +
      '<div class="ws-block"><h2>¿Prefiere conversar?</h2><p class="small">WhatsApp <b style="user-select:all">' + WA + '</b><br>' + t('hours') + '</p></div></aside></div>';
    return { nav: 'medida', title: EN() ? 'Tailor-made trips to Peru' : 'Viajes a medida por el Perú', desc: 'Solicite una cotización personalizada: destinos, fechas, presupuesto e intereses. Respuesta en máximo 24 horas hábiles.', html, after: (el) => {
      on('chip', (b) => b.classList.toggle('on'));
      on('send', () => {
        const g = (id) => el.querySelector('#' + id).value.trim(); clearErr(el); let ok = true;
        const dests = [...el.querySelectorAll('#md-dest .on')].map(b => b.dataset.v); const ints = [...el.querySelectorAll('#md-int .on')].map(b => b.dataset.v);
        if (!dests.length) { UI.toast('Elija al menos un destino.', 'bad'); ok = false; }
        if (!g('md-from') && g('md-flex') !== 'Aún no defino fechas') { markErr(el, 'md-from', 'Indique la fecha o elija "Aún no defino fechas".'); ok = false; }
        if (g('md-from') && daysFromToday(g('md-from')) < 2) { markErr(el, 'md-from', 'Debe ser una fecha futura (mín. 2 días).'); ok = false; }
        if (g('md-to') && g('md-from') && g('md-to') < g('md-from')) { markErr(el, 'md-to', 'Posterior al inicio.'); ok = false; }
        if (!(+g('md-adt') >= 1)) { markErr(el, 'md-adt', 'Mínimo 1 adulto.'); ok = false; }
        if (g('md-name').split(' ').filter(Boolean).length < 2) { markErr(el, 'md-name', 'Nombres y apellidos.'); ok = false; }
        if (!emailOk(g('md-email'))) { markErr(el, 'md-email', 'Correo no válido.'); ok = false; }
        if (String(g('md-phone')).replace(/\D/g, '').length < 7) { markErr(el, 'md-phone', 'Teléfono no válido.'); ok = false; }
        if (!el.querySelector('#md-ok').checked) { UI.toast('Debe autorizar el tratamiento de datos (Ley 29733).', 'bad'); ok = false; }
        if (!ok) return;
        const pax = (+g('md-adt') || 0) + (+g('md-chd') || 0);
        const lead = createLead({ name: g('md-name'), email: g('md-email').toLowerCase(), phone: g('md-phone'), interest: 'Viaje a medida', destination: dests.join(', '), productId: pr ? pr.id : '', travelDate: g('md-from'), pax, source: 'Formulario web', notes: 'Solicitud de viaje a medida desde el sitio web. Regreso: ' + (g('md-to') || '—') + ' · Flexibilidad: ' + g('md-flex') + ' · Adultos ' + g('md-adt') + ', niños ' + (g('md-chd') || 0) + ' · Presupuesto ' + g('md-budget') + ' p.p. · Hotel ' + g('md-hotel') + ' · Servicio ' + g('md-mode') + ' · Intereses: ' + (ints.join(', ') || '—') + ' · País ' + g('md-country') + ' · Contacto por ' + g('md-contact') + (g('md-notes') ? ' · Comentarios: ' + g('md-notes') : ''),
          extra: { budget: g('md-budget'), returnDate: g('md-to') || null, interests: ints, hotel: g('md-hotel'), serviceMode: g('md-mode'), country: g('md-country'), preferredContact: g('md-contact'), adults: +g('md-adt'), children: +g('md-chd') || 0 } });
        track('generate_lead', { method: 'tailor_made', lead: lead.id });
        el.querySelector('#md-f').innerHTML = UI.alert('ok', '<b>¡Solicitud recibida!</b> Registramos su pedido con el código <b class="mono">' + esc(lead.id) + '</b>. Un asesor le contactará por ' + esc(g('md-contact') || 'WhatsApp').toLowerCase() + ' en un plazo máximo de <b>24 horas hábiles</b> (4 horas en horario de oficina, lun–vie 9:00–19:00, sáb 9:00–13:00). Le enviamos una copia a ' + esc(g('md-email')) + '.') + '<div class="row" style="margin-top:12px"><a class="btn" href="#/sitio">Volver al inicio</a><a class="btn primary" href="#/sitio/buscar">Ver tours</a></div>';
      });
    } };
  }
  /* Lead web: mismo formato que el CRM (DB.leads), sin asignar → cola comercial */
  function createLead(o) {
    const dup = DB.leads.find(l => (l.email || '').toLowerCase() === o.email && !['convertido', 'descartado'].includes(l.status));
    const cli = DB.clients.find(c => (c.email || '').toLowerCase() === o.email);
    let score = 40; if (o.travelDate) score += 12; if (o.pax >= 4) score += 10; if (o.phone) score += 6; if (o.extra && /2 000|3 500/.test(o.extra.budget || '')) score += 12; if (o.productId) score += 8;
    const lead = Object.assign({ id: nextId(DB.leads, 'LEAD-', 4), name: o.name, email: o.email, phone: o.phone, company: '', source: o.source || 'Formulario web', interest: o.interest, destination: o.destination, productId: o.productId || '', travelDate: o.travelDate || '', pax: o.pax || 0, channel: 'Web', status: dup ? 'duplicado' : 'nuevo', owner: '', score: Math.min(95, score), createdAt: nowStr(), notes: o.notes, validatedAt: nowStr(), createdBy: 'Sitio web', duplicateOf: dup ? dup.id : undefined, matchedClientId: cli ? cli.id : undefined, consent: { dataProcessing: true, ts: nowStr(), policyVersion: 'PDP-2026.1' }, slaDue: plusMin(nowStr(), 24 * 60) }, o.extra ? { webRequest: o.extra } : {});
    DB.leads.unshift(lead); Store.save();
    Audit.log('Lead', lead.id, 'crear_desde_sitio_web', '', lead.status + ' · sin asignar · ' + lead.source);
    Notify.push('lead.nuevo', 'Portal', 'U02', 'Nuevo lead web sin asignar: ' + lead.name + ' (' + lead.destination + ')');
    Notify.push('lead.acuse', 'Email', lead.email, 'Recibimos su solicitud ' + lead.id + ' — Andes Horizonte Travel');
    return lead;
  }

  /* ================= BLOG ================= */
  function allPosts() {
    const cms = DB.cms.filter(c => c.status === 'publicado' && c.type === 'Artículo').map(c => ({ slug: c.slug || c.id.toLowerCase(), title: c.title.replace(/^Blog:\s*/, ''), cat: 'Novedades', date: c.updated, hue: 210, excerpt: String(c.body || '').replace(/[#\-]/g, '').slice(0, 130) + '…', body: c.body || '', cmsId: c.id }));
    return cms.concat(POSTS.map(p => Object.assign({ sample: true }, p)));
  }
  function pBlog() {
    const posts = allPosts();
    const html = crumbs([[t('blog')]]) + pageH(EN() ? 'Travel blog' : 'Blog de viajes', EN() ? 'Guides and tips to travel Peru.' : 'Guías y consejos para viajar por el Perú.') +
      '<div class="ws-wrap" style="padding-bottom:50px"><div class="row" style="margin-bottom:14px"><span class="ws-demo">' + ic('info') + 'Se muestran los artículos publicados en el CMS y artículos de ejemplo de la demo.</span></div><div class="ws-grid g3">' + posts.map((p, i) => '<article class="ws-card"><a class="ws-img" href="#/sitio/blog/' + p.slug + '">' + art(p.hue, i, '') + '</a><div class="ws-cb"><div class="kd">' + esc(p.cat) + ' · ' + dt(p.date) + (p.cmsId ? ' · CMS' : '') + '</div><h3><a href="#/sitio/blog/' + p.slug + '">' + esc(p.title) + '</a></h3><p class="small muted">' + esc(p.excerpt) + '</p><a class="btn sm" href="#/sitio/blog/' + p.slug + '" style="margin-top:auto;align-self:flex-start">' + (EN() ? 'Read more' : 'Leer más') + '</a></div></article>').join('') + '</div></div>';
    return { nav: 'blog', title: EN() ? 'Travel blog' : 'Blog de viajes por el Perú', desc: 'Consejos, mejores épocas y guías para viajar a Cusco, Machu Picchu, Paracas y más.', html };
  }
  function pPost(slug) {
    const p = allPosts().find(x => x.slug === slug); if (!p) return { title: 'Artículo no encontrado', html: '<div class="ws-wrap ws-sec">' + UI.empty('Artículo no encontrado.', 'file') + '</div>' };
    const rel = siteProducts().filter(x => (p.title + p.body).toLowerCase().includes((x.name.split(' ')[0] || '').toLowerCase().slice(0, 6))).slice(0, 2);
    const html = crumbs([[t('blog'), '#/sitio/blog'], [p.title]]) + '<div class="ws-wrap ws-2col"><article class="ws-post"><div class="kd upper">' + esc(p.cat) + ' · ' + dt(p.date) + '</div><h1 style="font-size:1.6rem;margin:6px 0 14px">' + esc(p.title) + '</h1><div class="ws-img" style="border-radius:12px;margin-bottom:14px">' + art(p.hue, 1, '') + '</div>' + mdLite(p.body) + (p.sample ? '<p class="xs faint" style="margin-top:16px">Artículo de ejemplo de la demo.</p>' : '') + '</article><aside class="stack">' + (rel.length ? '<div><h2 class="ws-h2" style="font-size:1.05rem;margin-bottom:10px">' + (EN() ? 'Related tours' : 'Tours relacionados') + '</h2><div class="stack">' + rel.map(card).join('') + '</div></div>' : '') + '<div class="ws-block"><h2>' + t('medida') + '</h2><p class="small muted">Arme su viaje con un asesor.</p><a class="btn primary" href="#/sitio/a-medida" style="margin-top:8px">' + t('quote') + '</a></div></aside></div>';
    return { nav: 'blog', title: p.title, desc: p.excerpt, html, ld: { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, datePublished: p.date, author: { '@type': 'Organization', name: 'Andes Horizonte Travel' } } };
  }

  /* ================= NOSOTROS / CONTACTO ================= */
  function pNosotros() {
    const html = crumbs([[t('nosotros')]]) + pageH(EN() ? 'About Andes Horizonte Travel' : 'Sobre Andes Horizonte Travel', EN() ? 'Local tour operator with offices in Lima, Cusco and Arequipa.' : 'Operador turístico local con oficinas en Lima, Cusco y Arequipa.') +
      '<div class="ws-wrap ws-2col"><div class="stack"><div class="ws-block"><h2>Nuestra historia</h2><p>Nacimos en Cusco en 2012 como un pequeño operador de excursiones a Machu Picchu. Hoy diseñamos viajes por todo el Perú para viajeros independientes, familias, grupos escolares y empresas, con equipo propio de operaciones en Cusco y una red de proveedores evaluados cada temporada.</p><p style="margin-top:10px">Trabajamos con guías oficiales, transportistas formales y hoteles seleccionados, y acompañamos cada viaje con una central de emergencias 24/7.</p></div>' +
      '<div class="ws-block"><h2>Cifras</h2><div class="ws-why" style="grid-template-columns:repeat(4,minmax(0,1fr))">' + [['14', 'años operando'], ['38 000+', 'viajeros atendidos'], ['60+', 'proveedores evaluados'], ['4.8/5', 'satisfacción (ejemplo)']].map(x => '<div><b style="font-size:1.4rem;font-family:var(--f-display)">' + x[0] + '</b><p>' + x[1] + '</p></div>').join('') + '</div></div>' +
      '<div class="ws-block"><h2>Oficinas</h2>' + DB.sedes.map(s => '<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line-2)">' + ic('building') + '<div><b class="small">' + esc(s.name) + '</b><div class="xs faint">' + esc(s.address) + ' · ' + esc(s.phone) + '</div></div></div>').join('') + '</div></div>' +
      '<aside class="stack"><div class="ws-block"><h2>' + t('guar_t') + '</h2><div class="ws-guar" style="grid-template-columns:minmax(0,1fr)">' + GUAR().map(g => '<div class="it">' + ic(g[0]) + '<div><b class="small">' + esc(g[1]) + '</b><p>' + esc(g[2]) + '</p></div></div>').join('') + '</div></div><div class="ws-block">' + UI.dl([['Razón social', esc(DB.tenant.name)], ['RUC', DB.tenant.ruc], ['Domicilio fiscal', 'Av. José Larco 1150, Of. 602, Miraflores, Lima']]) + '</div></aside></div>';
    return { nav: 'nosotros', title: EN() ? 'About us' : 'Nosotros', desc: 'Operador turístico con oficinas en Lima, Cusco y Arequipa; guías oficiales y asistencia 24/7.', html };
  }
  function pContacto() {
    const html = crumbs([[t('contacto')]]) + pageH(t('contacto'), EN() ? 'We answer in less than 4 business hours.' : 'Respondemos en menos de 4 horas hábiles.') +
      '<div class="ws-wrap ws-2col"><div class="ws-block" id="ct-f"><div class="form-grid">' + fld('ct-name', 'Nombres y apellidos', clientUser() ? clientUser().name : '', { col: 12 }) + fld('ct-email', 'Correo', clientUser() ? clientUser().email : '', { type: 'email' }) + fld('ct-phone', 'Teléfono / WhatsApp', clientUser() ? clientUser().phone : '', { req: false }) +
      fld('ct-topic', 'Motivo', 'Quiero cotizar un viaje', { col: 6, opts: ['Quiero cotizar un viaje', 'Consulta sobre una reserva', 'Pagos y comprobantes', 'Agencias y alianzas (B2B)', 'Otro'] }) + fld('ct-res', 'N.º de reserva (si tiene)', '', { col: 6, req: false, ph: 'RES-2026-…' }) +
      '<div class="field c12"><label for="ct-msg">Mensaje <span class="req">*</span></label><textarea class="input" id="ct-msg" rows="5"></textarea></div>' +
      '<div class="c12"><label class="check" style="align-items:flex-start"><input type="checkbox" id="ct-ok"> <span>Autorizo el tratamiento de mis datos para atender mi consulta (Ley 29733). <span class="req">*</span></span></label></div><div class="c12"><button class="btn primary" data-a="send">' + ic('send') + 'Enviar mensaje</button></div></div></div>' +
      '<aside class="stack"><div class="ws-block"><h2>Canales de atención</h2><div class="ws-kv"><div>' + ic('msg') + '<span>WhatsApp <b style="user-select:all">' + WA + '</b></span></div><div>' + ic('phoneCall') + '<span>Central <b style="user-select:all">' + PHONE + '</b></span></div><div>' + ic('alert') + '<span>Emergencias 24/7 (viajeros en ruta) <b style="user-select:all">' + EMERG + '</b></span></div><div>' + ic('mail') + '<span>' + MAIL + '</span></div><div>' + ic('clock') + '<span>' + t('hours') + '</span></div></div></div>' +
      '<div class="ws-block"><h2>Oficinas</h2>' + DB.sedes.map(s => '<div class="small" style="padding:6px 0"><b>' + esc(s.name) + '</b><br><span class="muted">' + esc(s.address) + ' · ' + esc(s.phone) + '</span></div>').join('') + '</div></aside></div>';
    return { nav: 'contacto', title: t('contacto'), desc: 'Contacte a Andes Horizonte Travel por WhatsApp, teléfono o formulario. Oficinas en Lima, Cusco y Arequipa.', html, after: (el) => on('send', () => {
      const g = (id) => el.querySelector('#' + id).value.trim(); clearErr(el); let ok = true;
      if (g('ct-name').length < 3) { markErr(el, 'ct-name', 'Obligatorio.'); ok = false; } if (!emailOk(g('ct-email'))) { markErr(el, 'ct-email', 'Correo no válido.'); ok = false; } if (g('ct-msg').length < 10) { markErr(el, 'ct-msg', 'Detalle su consulta (mín. 10 caracteres).'); ok = false; }
      if (!el.querySelector('#ct-ok').checked) { UI.toast('Debe autorizar el tratamiento de datos (Ley 29733).', 'bad'); ok = false; }
      if (!ok) return;
      const conv = newConversation('Formulario', { name: g('ct-name'), email: g('ct-email').toLowerCase(), phone: g('ct-phone') }, g('ct-topic') + (g('ct-res') ? ' · ' + g('ct-res').toUpperCase() : ''), g('ct-msg'));
      if (g('ct-res')) conv.resId = g('ct-res').toUpperCase();
      let lead = null; if (g('ct-topic') === 'Quiero cotizar un viaje') { lead = createLead({ name: g('ct-name'), email: g('ct-email').toLowerCase(), phone: g('ct-phone'), interest: 'Consulta web', destination: 'Por definir', travelDate: '', pax: 0, source: 'Formulario de contacto', notes: g('ct-msg') }); conv.leadId = lead.id; }
      Store.save(); track('generate_lead', { method: 'contact_form', conversation: conv.id, lead: lead ? lead.id : null });
      el.querySelector('#ct-f').innerHTML = UI.alert('ok', '<b>Mensaje enviado.</b> Su consulta quedó registrada con el código <b class="mono">' + esc(conv.id) + '</b>' + (lead ? ' (solicitud comercial ' + esc(lead.id) + ')' : '') + '. Le responderemos en menos de 4 horas hábiles a ' + esc(g('ct-email')) + '.');
    }) };
  }

  /* ================= LEGALES ================= */
  function pLegal(which) {
    const cms05 = DB.cms.find(c => c.id === 'CMS-05' && c.status === 'publicado');
    const docs = {
      terminos: ['Términos y condiciones', '<h2>1. Identificación</h2><p>' + esc(DB.tenant.name) + ', RUC ' + DB.tenant.ruc + ', con domicilio en Av. José Larco 1150, Of. 602, Miraflores, Lima, agencia de viajes y turismo y operador turístico.</p><h2>2. Reservas y contrato</h2><p>La reserva se perfecciona con la confirmación del pago (total o anticipo) y la emisión del número de reserva. Los precios mostrados son por persona, incluyen impuestos aplicables y los calcula el sistema al momento de la compra.</p><h2>3. Precios y moneda</h2><p>Los precios se publican en soles o dólares; la conversión usa el tipo de cambio del día publicado en el sitio y se conserva en la reserva.</p><h2>4. Anticipos y saldos</h2><p>Para viajes con 15 días o más de anticipación puede pagarse un anticipo (30 % con 30 días o más; 40 % entre 15 y 29 días). El saldo vence 15 días antes del inicio del viaje; si no se paga, la agencia puede anular la reserva aplicando la política de cancelación.</p><h2>5. Obligaciones del pasajero</h2><ul><li>Proporcionar datos exactos: las entradas y boletos son nominativos.</li><li>Portar documento de identidad vigente.</li><li>Cumplir los requisitos físicos y de edad de cada servicio.</li></ul><h2>6. Responsabilidad</h2><p>La agencia responde por la correcta prestación de los servicios contratados, salvo caso fortuito o fuerza mayor (clima, cierres dispuestos por autoridades, conflictos sociales), en cuyo caso se ofrecerá reprogramación o reembolso según corresponda.</p><h2>7. Reclamos</h2><p>Ponemos a su disposición el Libro de Reclamaciones virtual conforme al Código de Protección y Defensa del Consumidor.</p>'],
      privacidad: ['Política de privacidad', '<h2>Titular del banco de datos</h2><p>' + esc(DB.tenant.name) + ' (RUC ' + DB.tenant.ruc + '). Los bancos de datos de clientes y prospectos se encuentran inscritos ante la Autoridad Nacional de Protección de Datos Personales.</p><h2>Finalidades</h2><ul><li>Gestionar cotizaciones, reservas, pagos y comprobantes.</li><li>Transferir datos a proveedores necesarios para prestar el servicio (hoteles, transporte, Ministerio de Cultura, aseguradora).</li><li>Enviar información comercial, solo con su consentimiento expreso (revocable).</li></ul><h2>Base legal</h2><p>Ley 29733, Ley de Protección de Datos Personales, y su reglamento. El consentimiento se registra con fecha, hora, versión de la política (PDP-2026.1) y origen.</p><h2>Derechos ARCO</h2><p>Puede ejercer sus derechos de acceso, rectificación, cancelación y oposición escribiendo a privacidad@andeshorizonte.pe. Atendemos en los plazos legales.</p><h2>Conservación</h2><p>Los datos de reservas se conservan durante el plazo exigido por la normativa tributaria; los de marketing hasta que revoque su consentimiento.</p>'],
      cancelacion: ['Política de cancelación', (cms05 && cms05.body ? mdLite(cms05.body) : '<p>Las cancelaciones sin penalidad aplican hasta 15 días antes del inicio del servicio. Entre 14 y 7 días se retiene el 50 %. Dentro de los 7 días o en caso de no-show se factura el 100 %.</p><p>Las entradas nominativas y los boletos de tren emitidos no son reembolsables.</p>') + '<h2>Condiciones por producto</h2>' + siteProducts().map(p => '<p><b>' + esc(p.name) + ':</b> ' + esc(p.policies.cancel) + '</p>').join('') + '<h2>Cómo cancelar</h2><p>Desde Mi cuenta, por WhatsApp o por correo, indicando el número de reserva. Los reembolsos se realizan por el mismo medio de pago en 7 a 15 días hábiles.</p>'],
      cookies: ['Política de cookies', '<p>Usamos cookies técnicas (carrito, idioma, moneda y sesión) necesarias para el funcionamiento del sitio, y cookies analíticas y de marketing solo si usted las acepta en el banner de consentimiento.</p><ul><li>Técnicas: carrito, preferencia de idioma y moneda, sesión.</li><li>Analíticas: medición del embudo de compra (con consentimiento).</li><li>Marketing: remarketing (con consentimiento).</li></ul>']
    };
    const d = docs[which] || docs.terminos;
    const html = crumbs([[t('f_legal')], [d[0]]]) + pageH(d[0], 'Última actualización: ' + dt('2026-06-01') + (which === 'cancelacion' && cms05 ? ' · Contenido publicado desde el CMS (CMS-05)' : '')) + '<div class="ws-wrap" style="padding-bottom:50px"><div class="ws-post ws-doc-legal">' + d[1] + '</div></div>';
    return { title: d[0], desc: d[0] + ' de Andes Horizonte Travel.', html };
  }

  /* ================= LIBRO DE RECLAMACIONES (formulario público) ================= */
  function pLibro() {
    const u = clientUser(); const cli = u ? Q.client(u.clientId) : null;
    const html = crumbs([[t('claims')]]) + pageH('Libro de Reclamaciones virtual', 'Conforme al Código de Protección y Defensa del Consumidor (Ley 29571) y su reglamento. La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.') +
      '<div class="ws-wrap ws-2col"><div class="ws-block" id="lr-f"><div class="section-title" style="margin-bottom:10px">Hoja de reclamación · ' + esc(DB.tenant.name) + ' · RUC ' + DB.tenant.ruc + '</div><div class="form-grid">' +
      '<div class="section-title">1. Identificación del consumidor reclamante</div>' + fld('lr-name', 'Nombres y apellidos', cli ? cli.name : '', { col: 12 }) + fld('lr-doctype', 'Tipo de documento', 'DNI', { col: 3, opts: ['DNI', 'Carné de extranjería', 'Pasaporte', 'RUC'] }) + fld('lr-doc', 'Número', cli ? String(cli.doc || '').split(' ')[1] || '' : '', { col: 3 }) + fld('lr-phone', 'Teléfono', cli ? cli.phone : '', { col: 6 }) + fld('lr-email', 'Correo electrónico', cli ? cli.email : '', { col: 6, type: 'email' }) + fld('lr-address', 'Domicilio', '', { col: 6 }) +
      '<div class="c12"><label class="check"><input type="checkbox" id="lr-minor"> El consumidor es menor de edad: los datos anteriores corresponden al padre, madre o apoderado</label></div>' + fld('lr-minorname', 'Nombre del menor (si corresponde)', '', { col: 6, req: false }) + fld('lr-sede', 'Establecimiento', 'Lima — Miraflores', { col: 6, opts: DB.sedes.map(x => x.name) }) +
      '<div class="section-title">2. Identificación del bien contratado</div><div class="c12 ws-paym" style="grid-template-columns:1fr 1fr"><label class="on"><input type="radio" name="lr-kind" value="Servicio" checked><span><b>Servicio</b></span></label><label><input type="radio" name="lr-kind" value="Producto"><span><b>Producto</b></span></label></div>' + fld('lr-service', 'Descripción del servicio', '', { col: 8, ph: 'Ej.: Machu Picchu Full Day, reserva RES-2026-…' }) + fld('lr-amount', 'Monto reclamado (S/)', '', { col: 4, type: 'number', req: false }) +
      '<div class="section-title">3. Detalle de la reclamación</div><div class="c12 ws-paym" style="grid-template-columns:1fr 1fr"><label class="on"><input type="radio" name="lr-type" value="reclamo" checked><span><b>Reclamo</b><small>Disconformidad relacionada con el servicio contratado.</small></span></label><label><input type="radio" name="lr-type" value="queja"><span><b>Queja</b><small>Malestar respecto a la atención al público, no relacionado con el servicio.</small></span></label></div>' +
      '<div class="field c12"><label for="lr-detail">Detalle <span class="req">*</span></label><textarea class="input" id="lr-detail" rows="4"></textarea></div><div class="field c12"><label for="lr-request">Pedido del consumidor <span class="req">*</span></label><textarea class="input" id="lr-request" rows="2"></textarea></div>' +
      '<div class="c12"><label class="check" style="align-items:flex-start"><input type="checkbox" id="lr-ok"> <span>Declaro que los datos son verdaderos y autorizo que la respuesta se me envíe al correo indicado. <span class="req">*</span></span></label></div><div class="c12"><button class="btn primary" data-a="send">' + ic('send') + 'Registrar hoja de reclamación</button></div></div></div>' +
      '<aside class="stack"><div class="ws-block"><h2>Plazos</h2><p class="small">El proveedor responde en un plazo no mayor a <b>15 días hábiles</b>. Recibirá una copia de su hoja con el código de registro en su correo.</p></div><div class="ws-block"><h2>Diferencias</h2><p class="small"><b>Reclamo:</b> disconformidad con el servicio.<br><b>Queja:</b> malestar por la atención recibida.</p></div>' + (Auth.user && ['customer', 'passenger'].includes(Auth.role) ? '<div class="ws-block"><p class="small">También puede registrarlo desde su portal: <a href="#/libro-reclamaciones">Libro de reclamaciones del portal</a>.</p></div>' : '') + '</aside></div>';
    return { title: 'Libro de Reclamaciones', desc: 'Libro de Reclamaciones virtual de Andes Horizonte Travel S.A.C.', html, after: (el) => {
      el.querySelectorAll('input[type=radio]').forEach(r => r.onchange = () => r.closest('.ws-paym').querySelectorAll('label').forEach(l => l.classList.toggle('on', l.contains(r) ? r.checked : false)));
      on('send', () => {
        const g = (id) => el.querySelector('#' + id).value.trim(); clearErr(el); let ok = true;
        if (g('lr-name').split(' ').filter(Boolean).length < 2) { markErr(el, 'lr-name', 'Nombres y apellidos.'); ok = false; }
        if (el.querySelector('#lr-minor').checked && g('lr-minorname').split(' ').filter(Boolean).length < 2) { markErr(el, 'lr-minorname', 'Nombre completo del menor.'); ok = false; }
        if (!validDoc(g('lr-doctype') === 'Carné de extranjería' ? 'CE' : g('lr-doctype'), g('lr-doc').toUpperCase())) { markErr(el, 'lr-doc', 'Documento no válido.'); ok = false; }
        if (!emailOk(g('lr-email'))) { markErr(el, 'lr-email', 'Correo no válido.'); ok = false; }
        if (!g('lr-phone')) { markErr(el, 'lr-phone', 'Obligatorio.'); ok = false; } if (!g('lr-address')) { markErr(el, 'lr-address', 'Obligatorio.'); ok = false; }
        if (!g('lr-service')) { markErr(el, 'lr-service', 'Obligatorio.'); ok = false; }
        if (g('lr-detail').length < 15) { markErr(el, 'lr-detail', 'Describa el hecho (mín. 15 caracteres).'); ok = false; } if (!g('lr-request')) { markErr(el, 'lr-request', 'Obligatorio.'); ok = false; }
        if (!el.querySelector('#lr-ok').checked) { UI.toast('Debe marcar la declaración.', 'bad'); ok = false; }
        if (!ok) return;
        const minor = el.querySelector('#lr-minor').checked; const parent = { name: g('lr-name'), docType: g('lr-doctype'), docNumber: g('lr-doc').toUpperCase(), relation: 'Padre / madre / apoderado' };
        const cl = saveClaim({ type: el.querySelector('input[name=lr-type]:checked').value, sede: (DB.sedes.find(x => x.name === g('lr-sede')) || DB.sedes[0]).id,
          consumer: { name: minor ? g('lr-minorname') : g('lr-name'), docType: minor ? '' : g('lr-doctype'), docNumber: minor ? '' : g('lr-doc').toUpperCase(), address: g('lr-address'), email: g('lr-email').toLowerCase(), phone: g('lr-phone'), minor, guardian: minor ? parent : null },
          good: { kind: el.querySelector('input[name=lr-kind]:checked').value, description: g('lr-service'), amount: g('lr-amount') ? +g('lr-amount') : 0, currency: 'PEN' }, detail: g('lr-detail'), request: g('lr-request') });
        const cons = cl.consumer || {};
        el.querySelector('#lr-f').innerHTML = UI.alert('ok', '<b>Hoja de reclamación registrada.</b> Código <b class="mono" style="user-select:all">' + esc(cl.bookNo) + '</b> (' + esc(cl.type) + '), recibida el ' + dt(cl.createdAt.split(' ')[0]) + ' a las ' + esc(cl.createdAt.split(' ')[1]) + '. Responderemos a ' + esc(cons.email) + ' a más tardar el <b>' + dt(cl.dueDate) + '</b> (' + (cl.responseDays || 15) + ' días hábiles). Enviamos la constancia a su correo.') + '<div class="doc" style="margin-top:14px"><div class="doc-head"><div><h3>HOJA DE RECLAMACIÓN</h3><div class="muted">' + esc(DB.tenant.name) + ' · RUC ' + DB.tenant.ruc + ' · ' + esc(Q.sedeName(cl.sede)) + '</div></div><div style="text-align:right;font-family:var(--f-mono)">' + esc(cl.bookNo) + '</div></div>' + UI.dl([['Tipo', esc(cl.type)], ['Consumidor', esc(cons.name) + (cons.docNumber ? ' · ' + esc(cons.docType + ' ' + cons.docNumber) : '') + (cons.minor && cons.guardian ? ' (menor; apoderado ' + esc(cons.guardian.name + ' · ' + cons.guardian.docType + ' ' + cons.guardian.docNumber) + ')' : '')], ['Contacto', esc(cons.email) + ' · ' + esc(cons.phone)], ['Domicilio', esc(cons.address)], ['Bien contratado', esc(cl.good.kind + ': ' + cl.good.description) + (cl.good.amount ? ' · S/ ' + fmtN(cl.good.amount) : '')], ['Detalle', esc(cl.desc)], ['Pedido', esc(cl.request)], ['Fecha límite de respuesta', dt(cl.dueDate)]]) + '</div>';
      });
    } };
  }
  /* Registra la hoja con el servicio del Libro de Reclamaciones (tesoreria.js → window.ClaimBook): DB.claims con book:true,
     correlativo por sede (LR-LIM-2026-000006), plazo en días hábiles con feriados (DB.claimBook). Fallback si el módulo no está cargado. */
  function saveClaim(o) {
    const cli = DB.clients.find(c => (c.email || '').toLowerCase() === o.consumer.email) || (clientUser() ? Q.client(clientUser().clientId) : null);
    const resM = /RES-\d{4}-\d{6}/.exec(o.good.description); const res = resM ? Q.reservation(resM[0]) : null;
    const data = { sede: o.sede, channel: 'Sitio web', type: o.type === 'queja' ? 'Queja' : 'Reclamo', clientId: cli ? cli.id : null, resId: res ? res.id : null, consumer: o.consumer, good: o.good, detail: o.detail, request: o.request, owner: cli && cli.owner ? cli.owner : 'U02', submittedBy: Auth.user ? Auth.user.id : 'web' };
    let cl;
    if (window.ClaimBook) cl = window.ClaimBook.register(data);
    else {
      if (!DB.claims) DB.claims = [];
      const now = nowStr(); const code = { 'SED-01': 'LIM', 'SED-02': 'CUS', 'SED-03': 'AQP' }[o.sede] || 'WEB';
      const n = DB.claims.filter(c => String(c.bookNo || '').startsWith('LR-' + code + '-' + T().slice(0, 4))).length + 1;
      cl = { id: nextId(DB.claims, 'REC-', 4), book: true, bookNo: 'LR-' + code + '-' + T().slice(0, 4) + '-' + String(n).padStart(6, '0'), sede: o.sede, channel: 'Sitio web', type: data.type, clientId: data.clientId, resId: data.resId, surveyId: null, priority: data.type === 'Reclamo' ? 'alta' : 'media', subject: o.detail.slice(0, 90), desc: o.detail, request: o.request, consumer: o.consumer, good: o.good, bookStatus: 'recibido', status: 'abierta', owner: data.owner, createdAt: now, dueDate: addBizDays(T(), 15), responseDays: 15, resolution: '', response: null, submittedBy: data.submittedBy, ackSentAt: now, log: [{ ts: now, u: data.submittedBy, m: 'Hoja registrada (Sitio web)' }] };
      DB.claims.unshift(cl); Store.save();
      Audit.log('Libro de reclamaciones', cl.id, 'registrar', '', cl.bookNo + ' · ' + cl.type + ' · vence ' + cl.dueDate);
      Notify.push('reclamacion.constancia', 'Email', o.consumer.email, 'Constancia de ' + cl.type.toLowerCase() + ' — Hoja ' + cl.bookNo);
    }
    track('claim_submitted', { code: cl.bookNo, type: cl.type });
    return cl;
  }

  /* ---------------- Temporizadores (cuentas regresivas y holds) ---------------- */
  const fmtLeft = (ms) => { if (ms <= 0) return '00:00'; const s = Math.floor(ms / 1000); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60; return d ? d + 'd ' + pad(h) + 'h ' + pad(m) + 'm' : (h ? pad(h) + ':' : '') + pad(m) + ':' + pad(sec); };
  let expiredToast = false;
  setInterval(() => {
    const h = location.hash; if (!h.startsWith('#/sitio')) return;
    const now = nowMs();
    document.querySelectorAll('[data-cd]').forEach(e => { e.textContent = fmtLeft(+e.dataset.cd - now); });
    let exp = false;
    document.querySelectorAll('[data-hold]').forEach(e => { const left = +e.dataset.hold - now; e.textContent = fmtLeft(left); if (left <= 0) exp = true; });
    if (exp && !expiredToast) {
      expiredToast = true; const n = expireHolds(getCart(false));
      if (n) { UI.toast('El bloqueo de cupos venció y se liberaron ' + n + ' reserva(s) temporal(es). Puede volver a bloquearlos desde el carrito si aún hay disponibilidad.', 'warn'); App.render(); }
      setTimeout(() => { expiredToast = false; }, 3000);
    }
  }, 1000);
})();
