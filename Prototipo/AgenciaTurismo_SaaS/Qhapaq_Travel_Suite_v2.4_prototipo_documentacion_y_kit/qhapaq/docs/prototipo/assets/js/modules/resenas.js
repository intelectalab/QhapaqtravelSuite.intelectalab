/* ==========================================================================
   v2.2 — Reseñas propias verificadas (regla R-OWN-REVIEWS)
   Dueño de DB.ownReviews, DB.ownReviewRequests y DB.ownReviewSettings.
   Los demás módulos (canales.js: portal del pasajero; sitio.js: fichas y tarjetas)
   leen con window.OwnReviews / `DB.ownReviews || []`.
   Si la regla está apagada, el plan no la incluye o el producto la desactiva
   (ruleOverrides), todo desaparece: formularios, bloques del sitio y datos estructurados.
   En producción: App\Domain\Reviews (Laravel) + /api/v1/reviews y /api/v1/public/reviews.
   ========================================================================== */
(function () {
  'use strict';
  const { esc, fmtN, date, datetime, sum, nowStr, addDays } = Util;
  const ic = (n) => UI.icon(n);
  const T = () => window.TODAY;
  const BEX = () => window.BookingEngine;
  const RULE = 'R-OWN-REVIEWS';

  const SUBS = [['guia', 'Guía'], ['transporte', 'Transporte'], ['alojamiento', 'Alojamiento'], ['organizacion', 'Organización'], ['valor', 'Relación calidad-precio']];
  const SUBS_EN = { guia: 'Guide', transporte: 'Transport', alojamiento: 'Accommodation', organizacion: 'Organization', valor: 'Value for money' };
  const LANGS = [['es', 'Español'], ['en', 'Inglés'], ['de', 'Alemán'], ['fr', 'Francés'], ['pt', 'Portugués']];
  const SRC = { portal: 'Portal del pasajero', app: 'App del pasajero', email: 'Enlace por correo', widget: 'Widget del sitio' };
  const ST = { pendiente: ['pendiente', 'Pendiente'], publicada: ['publicado', 'Publicada'], rechazada: ['rechazada', 'Rechazada'], oculta: ['inactiva', 'Oculta'] };
  const RQ_ST = { programada: ['asignada', 'Programada'], enviada: ['enviado', 'Enviada'], abierta: ['vista', 'Abierta'], respondida: ['completado', 'Respondida'], vencida: ['vencido', 'Vencida'], cancelada: ['cancelado', 'Cancelada'] };
  const stBadge = (s) => UI.badge((ST[s] || [s])[0], (ST[s] || [s, s])[1]);
  const rqBadge = (s) => UI.badge((RQ_ST[s] || [s])[0], (RQ_ST[s] || [s, s])[1]);
  const subLbl = (k) => (SUBS.find(x => x[0] === k) || [k, k])[1];
  const langLbl = (k) => (LANGS.find(x => x[0] === k) || [k, k])[1];
  const DEMO_TAG = '<span class="rvo-demo">ejemplo (demo)</span>';
  const nextId = (arr, prefix, w) => { const n = Math.max(0, ...(arr || []).map(x => parseInt(String(x.id || '').replace(/\D/g, ''), 10) || 0)); return prefix + String(n + 1).padStart(w, '0'); };

  /* ---------------- Semilla (datos de ejemplo, coherentes con reservas y clientes de data.js) ---------------- */
  function seed() {
    let ch = false;
    if (!DB.ownReviewSettings) {
      DB.ownReviewSettings = {
        isDemo: true, autoPublish: false, bannedWords: ['estafa', 'basura', 'idiota', 'ladrones', 'http', 'www.'],
        personalData: 'retener', activeSubs: SUBS.map(s => s[0]), showOnSite: true, showOnWidget: true, lastExport: null,
        invite: { channel: 'email', reminderDays: 5, expireDays: 30,
          subject: '{{pasajero}}, ¿cómo fue su viaje a {{producto}}?',
          body: 'Hola {{pasajero}}:\n\nGracias por viajar con Andes Horizonte Travel. Nos ayudaría mucho conocer su opinión sobre {{producto}} ({{fecha}}).\nCalifique su viaje en 2 minutos: {{enlace_resena}}\n\nSu reseña se publica con el sello «Viaje verificado» porque proviene de una reserva real. Puede elegir no publicarla.\n\nEquipo Andes Horizonte' }
      }; ch = true;
    }
    if (!DB.ownReviews) {
      const R = (o) => Object.assign({ authorName: o.author, verified: true, photos: [], subratings: {}, reply: null, helpful: 0, moderationReason: '', isDemo: true, log: [] }, o);
      DB.ownReviews = [
        R({ id: 'RVO-0001', resId: 'RES-2026-000346', productId: 'PRD-004', clientId: 'CLI-0006', author: 'Sophie M.', authorName: 'Sophie Martin', country: 'Francia', travelDate: '2026-09-25', stars: 5, subratings: { guia: 5, transporte: 5, organizacion: 5, valor: 4 }, title: 'Une journée inoubliable à Humantay', text: 'Départ très tôt mais tout était parfaitement organisé. Le guide Wilber nous a expliqué comment gérer l’altitude et nous a attendus sans pression. La lagune est magnifique.', photos: ['humantay-laguna.jpg'], lang: 'fr', status: 'publicada', reply: { text: 'Merci Sophie ! Wilber sera ravi de lire votre message. Au plaisir de vous revoir au Pérou.', by: 'U02', at: '2026-09-28 11:20' }, helpful: 4, createdAt: '2026-09-28 10:05', publishedAt: '2026-09-28 11:18', source: 'email', log: [{ ts: '2026-09-28 11:18', u: 'U02', m: 'Publicada tras moderación' }] }),
        R({ id: 'RVO-0002', resId: 'RES-2026-000346', productId: 'PRD-001', clientId: 'CLI-0006', author: 'Sophie M.', authorName: 'Sophie Martin', country: 'Francia', travelDate: '2026-09-26', stars: 5, subratings: { guia: 5, transporte: 4, organizacion: 5, valor: 5 }, title: 'Machu Picchu sin estrés', text: 'Tren puntual, entradas nominativas listas y el guía explicó la ciudadela con mucho detalle. Recomiendo el ingreso de la mañana.', lang: 'es', status: 'publicada', helpful: 2, createdAt: '2026-09-28 10:12', publishedAt: '2026-09-28 11:19', source: 'email', log: [{ ts: '2026-09-28 11:19', u: 'U02', m: 'Publicada tras moderación' }] }),
        R({ id: 'RVO-0003', resId: 'RES-2026-000347', productId: 'PRD-005', clientId: 'CLI-0003', author: 'Anna K.', authorName: 'Anna Keller', country: 'Alemania', travelDate: '2026-09-27', stars: 4, subratings: { transporte: 4, organizacion: 5 }, title: 'Pünktlicher Transfer', text: 'Der Fahrer wartete mit einem Schild am Ausgang. Das Auto war sauber, nur die Klimaanlage funktionierte nicht richtig.', lang: 'de', status: 'pendiente', createdAt: '2026-09-29 07:40', publishedAt: null, source: 'portal', log: [{ ts: '2026-09-29 07:40', u: 'Pasajero', m: 'Enviada desde el portal (viaje en curso)' }] }),
        R({ id: 'RVO-0004', resId: 'RES-2025-000212', productId: 'PRD-002', clientId: 'CLI-0002', author: 'Ernesto V.', country: 'Perú', travelDate: '2025-11-14', stars: 5, subratings: { guia: 5, transporte: 5, alojamiento: 5, organizacion: 5, valor: 4 }, title: 'Incentivo corporativo impecable', text: 'Viajamos 14 colaboradores de la minera. Coordinación permanente por WhatsApp, hoteles cómodos y guías con mucha paciencia para el grupo. Ya estamos organizando el viaje de este año con ellos.', lang: 'es', status: 'publicada', reply: { text: 'Gracias, Ernesto. Fue un gusto acompañar al equipo; los esperamos en octubre.', by: 'U02', at: '2025-11-24 09:10' }, helpful: 6, createdAt: '2025-11-22 18:30', publishedAt: '2025-11-23 09:00', source: 'email' }),
        R({ id: 'RVO-0005', resId: 'RES-2025-000212', productId: 'PRD-001', clientId: 'CLI-0002', author: 'Karla U.', country: 'Perú', travelDate: '2025-11-16', stars: 4, subratings: { guia: 5, transporte: 3, organizacion: 4, valor: 4 }, title: 'Muy buen tour, bus con demora', text: 'El guía excelente. En el retorno el bus de Aguas Calientes demoró casi una hora, pero la agencia nos mantuvo informados todo el tiempo.', lang: 'es', status: 'publicada', reply: { text: 'Gracias por el comentario, Karla. Coordinamos con Consettur un horario de retorno con más holgura para grupos.', by: 'U05', at: '2025-11-25 10:00' }, helpful: 3, createdAt: '2025-11-23 08:15', publishedAt: '2025-11-23 12:30', source: 'email' }),
        R({ id: 'RVO-0006', resId: 'RES-2026-000261', productId: 'PRD-009', clientId: 'CLI-0001', author: 'Gabriela R.', country: 'Perú', travelDate: '2026-07-12', stars: 4, subratings: { guia: 4, transporte: 4, organizacion: 4, valor: 5 }, title: 'Paracas en familia', text: 'Salida puntual desde Miraflores y los niños disfrutaron mucho los lobos marinos. El almuerzo no estaba incluido y no lo teníamos claro.', lang: 'es', status: 'publicada', helpful: 1, createdAt: '2026-07-14 20:40', publishedAt: '2026-07-14 20:40', source: 'portal', log: [{ ts: '2026-07-14 20:40', u: 'Sistema', m: 'Autopublicada (≥ 4 estrellas, sin alertas)' }] }),
        R({ id: 'RVO-0007', resId: 'RES-2026-000288', productId: 'PRD-007', clientId: 'CLI-0005', author: 'Familia Castañeda', country: 'Perú', travelDate: '2026-08-03', stars: 5, subratings: { guia: 5, organizacion: 5, valor: 5 }, title: 'La mejor actividad del viaje', text: 'Recorrimos el mercado San Pedro y luego preparamos causa y lomo saltado. La chef tuvo mucha paciencia con los chicos.', photos: ['clase-cocina-1.jpg', 'mercado-san-pedro.jpg'], lang: 'es', status: 'publicada', helpful: 5, createdAt: '2026-08-06 19:02', publishedAt: '2026-08-07 09:30', source: 'widget' }),
        R({ id: 'RVO-0008', resId: 'RES-2026-000301', productId: 'PRD-001', clientId: 'CLI-0010', author: 'Emily J.', country: 'Estados Unidos', travelDate: '2026-08-21', stars: 3, subratings: { guia: 5, transporte: 2, organizacion: 3, valor: 3 }, title: 'Amazing site, long train delay', text: 'Our guide was fantastic, but the return train was delayed two hours and we only got a short message. Better communication would help.', lang: 'en', status: 'publicada', reply: { text: 'Thank you, Emily. The delay was caused by a track incident; we now send WhatsApp updates every 30 minutes in these cases.', by: 'U05', at: '2026-08-25 16:45' }, helpful: 7, createdAt: '2026-08-24 22:10', publishedAt: '2026-08-25 16:40', source: 'email' }),
        R({ id: 'RVO-0009', resId: 'RES-2026-000240', productId: 'PRD-002', clientId: 'CLI-0004', author: 'Prof. Milagros A.', country: 'Perú', travelDate: '2026-06-20', stars: 4, subratings: { guia: 5, transporte: 4, alojamiento: 3, organizacion: 5 }, title: 'Viaje de promoción muy seguro', text: 'Excelente control del grupo de 32 alumnos. Para cualquier consulta de otros colegios pueden escribirme al 954 330 112.', lang: 'es', status: 'pendiente', moderationReason: 'Revisión requerida: contiene datos personales (teléfono)', createdAt: '2026-09-27 12:30', publishedAt: null, source: 'email', log: [{ ts: '2026-09-27 12:30', u: 'Sistema', m: 'Retenida: datos personales detectados' }] }),
        R({ id: 'RVO-0010', resId: 'RES-2026-000275', productId: 'PRD-004', clientId: 'CLI-0008', author: 'Ricardo B.', country: 'Perú', travelDate: '2026-09-05', stars: 2, subratings: { guia: 3, transporte: 2, valor: 2 }, title: 'Mejor reserven en www.otraagencia.pe', text: 'El recojo se retrasó. Reserven con otra agencia en www.otraagencia.pe que es más barata.', lang: 'es', status: 'rechazada', moderationReason: 'Publicidad o enlaces de terceros (política de reseñas, punto 3)', createdAt: '2026-09-08 09:14', publishedAt: null, source: 'portal', log: [{ ts: '2026-09-08 11:02', u: 'U02', m: 'Rechazada: publicidad de terceros. Se derivó el retraso a postventa.' }] }),
        R({ id: 'RVO-0011', resId: 'RES-2026-000230', productId: 'PRD-005', clientId: 'CLI-0009', author: 'Laboratorios Andinos (viajero corporativo)', country: 'Perú', travelDate: '2026-05-11', stars: 5, subratings: { transporte: 5, organizacion: 5 }, title: 'Traslado puntual a las 5 a. m.', text: 'Vuelo muy temprano y el conductor llegó 10 minutos antes. Servicio confiable para viajes de trabajo.', lang: 'es', status: 'publicada', helpful: 0, createdAt: '2026-05-12 08:00', publishedAt: '2026-05-12 08:00', source: 'portal', log: [{ ts: '2026-05-12 08:00', u: 'Sistema', m: 'Autopublicada (≥ 4 estrellas, sin alertas)' }] }),
        R({ id: 'RVO-0012', resId: 'RES-2025-000212', productId: 'PRD-002', clientId: 'CLI-0002', author: 'Luis H.', country: 'Perú', travelDate: '2025-11-14', stars: 5, title: 'Todo excelente', text: 'Todo excelente, muy recomendable.', lang: 'es', status: 'oculta', moderationReason: 'Duplicada: el mismo viajero envió dos reseñas del mismo producto', createdAt: '2025-11-23 21:40', publishedAt: '2025-11-23 21:40', source: 'email', log: [{ ts: '2025-11-24 09:00', u: 'U02', m: 'Oculta por duplicidad' }] })
      ]; ch = true;
    }
    if (!DB.ownReviewRequests) {
      DB.ownReviewRequests = [
        { id: 'SRV-0001', resId: 'RES-2026-000346', clientId: 'CLI-0006', to: 'sophie.martin@mail.fr', channel: 'email', lang: 'fr', scheduledAt: '2026-09-28 09:00', sentAt: '2026-09-28 09:00', openedAt: '2026-09-28 09:47', status: 'respondida', reviewIds: ['RVO-0001', 'RVO-0002'], isDemo: true },
        { id: 'SRV-0002', resId: 'RES-2026-000347', clientId: 'CLI-0003', to: 't.keller@mail.de', channel: 'email', lang: 'de', scheduledAt: '2026-10-03 09:00', sentAt: null, openedAt: null, status: 'programada', reviewIds: ['RVO-0003'], isDemo: true },
        { id: 'SRV-0003', resId: 'RES-2026-000348', clientId: 'CLI-0002', to: 'rrhh@mineracordillera.pe', channel: 'email', lang: 'es', scheduledAt: '2026-10-06 09:00', sentAt: null, openedAt: null, status: 'programada', reviewIds: [], isDemo: true },
        { id: 'SRV-0004', resId: 'RES-2026-000301', clientId: 'CLI-0010', to: 'emily.johnson@mail.com', channel: 'email', lang: 'en', scheduledAt: '2026-08-23 09:00', sentAt: '2026-08-23 09:00', openedAt: '2026-08-24 21:58', status: 'respondida', reviewIds: ['RVO-0008'], isDemo: true },
        { id: 'SRV-0005', resId: 'RES-2026-000240', clientId: 'CLI-0004', to: 'promocion@sanagustin.edu.pe', channel: 'email', lang: 'es', scheduledAt: '2026-06-22 09:00', sentAt: '2026-06-22 09:00', openedAt: '2026-09-27 12:20', status: 'respondida', reviewIds: ['RVO-0009'], isDemo: true },
        { id: 'SRV-0006', resId: 'RES-2026-000252', clientId: 'CLI-0007', to: 'reservas@wayraviajes.pe', channel: 'email', lang: 'es', scheduledAt: '2026-07-30 09:00', sentAt: '2026-07-30 09:00', openedAt: null, status: 'vencida', reviewIds: [], isDemo: true }
      ]; ch = true;
    }
    if (ch) Store.save();
  }
  seed();

  /* ---------------- Reglas y parámetros ---------------- */
  const rule = () => (BEX() && BEX().rule(RULE)) || null;
  const planOk = () => !BEX() || BEX().planAllows(RULE);
  const ruleOn = (p) => !BEX() || BEX().on(RULE, p || undefined);
  const prm = (k, p) => BEX() ? BEX().param(RULE, k, p) : ({ daysAfter: 1, minStarsAutoPublish: 4, moderation: true })[k];
  const cfg = () => { seed(); return DB.ownReviewSettings; };
  const all = () => DB.ownReviews || [];

  /* Datos personales y palabras prohibidas */
  const PII = [[/[^\s@]+@[^\s@]+\.[a-z]{2,}/i, 'correo'], [/(\+?\d[\d\s-]{7,}\d)/, 'teléfono'], [/pasaporte\s*[a-z0-9]{6,}|dni\s*\d{8}/i, 'documento']];
  function scan(text) {
    const t = String(text || ''); const out = [];
    const bw = (cfg().bannedWords || []).filter(w => w && t.toLowerCase().includes(String(w).toLowerCase()));
    if (bw.length) out.push('palabras no permitidas (' + bw.join(', ') + ')');
    const pii = PII.filter(p => p[0].test(t)).map(p => p[1]);
    if (pii.length) out.push('datos personales (' + pii.join(', ') + ')');
    return { reasons: out, pii: pii.length > 0, banned: bw.length > 0 };
  }
  const mask = (t) => PII.reduce((s, p) => s.replace(new RegExp(p[0].source, p[0].flags + 'g'), '[dato oculto]'), String(t || ''));

  /* ---------------- Estadísticas ---------------- */
  function stats(pid, rows) {
    const list = rows || all().filter(r => r.status === 'publicada' && (!pid || r.productId === pid));
    const count = list.length; const avg = count ? sum(list, 'stars') / count : 0;
    const dist = [1, 2, 3, 4, 5].map(n => list.filter(r => r.stars === n).length);
    const rec = count ? list.filter(r => r.stars >= 4).length / count * 100 : 0;
    const subs = {}; SUBS.forEach(([k]) => { const v = list.map(r => (r.subratings || {})[k]).filter(Boolean); subs[k] = v.length ? { avg: sum(v, x => x) / v.length, n: v.length } : null; });
    return { count, avg, dist, rec, subs };
  }
  const authorOf = (name) => { const w = String(name || 'Viajero').replace(/\(.*?\)/g, '').trim().split(/\s+/); return w.length > 1 ? w[0] + ' ' + w[w.length - 1].charAt(0).toUpperCase() + '.' : w[0]; };

  /* ---------------- Elegibilidad del pasajero ----------------
     Reserva completada => todos sus productos. En operación => solo servicios completados
     o ya pasados (demo: Thomas Keller, RES-2026-000347, en operación hasta el 02/10). */
  function eligibility(r, who) {
    if (!r) return { show: false };
    const prodOf = (s) => s.productId && Q.product(s.productId);
    const first = (r.services || []).map(prodOf).find(Boolean) || null;
    if (!ruleOn(first)) return { show: false };
    if (['cancelada', 'borrador'].includes(r.status)) return { show: false };
    const done = r.status === 'completada';
    const svcs = (r.services || []).filter(s => s.status !== 'cancelado' && prodOf(s) && (done || s.status === 'completado' || s.date < T()));
    const pids = [...new Set(svcs.map(s => s.productId))].filter(pid => ruleOn(Q.product(pid)));
    const name = (who && who.name) || '';
    const mine = all().filter(v => v.resId === r.id && v.authorName === name);
    const list = pids.map(pid => ({ p: Q.product(pid), date: svcs.filter(s => s.productId === pid).map(s => s.date).sort().slice(-1)[0], rv: mine.find(v => v.productId === pid) || null }));
    const partial = !done && r.status === 'en_operacion';
    return { show: list.length > 0 || mine.length > 0, list, mine, partial, pending: list.filter(x => !x.rv).length, travelTo: r.travelTo };
  }

  /* ---------------- Alta de reseña (portal / app / enlace de correo) ---------------- */
  function submit(r, d, who, source) {
    const p = Q.product(d.productId);
    if (!ruleOn(p)) return { error: 'La agencia no tiene activas las reseñas propias (regla ' + RULE + ').' };
    const el = eligibility(r, who); const it = el.list && el.list.find(x => x.p.id === d.productId);
    if (!it) return { error: 'Solo puede calificar servicios de su reserva ya realizados (reserva verificada).' };
    if (it.rv) return { error: 'Ya calificó este servicio. Puede ver su reseña y la respuesta de la agencia más abajo.' };
    const stars = parseInt(d.stars, 10); if (!(stars >= 1 && stars <= 5)) return { error: 'Elija una calificación de 1 a 5 estrellas.' };
    const title = String(d.title || '').trim(), text0 = String(d.text || '').trim();
    if (title.length < 3) return { error: 'Escriba un título para su reseña.' };
    if (text0.length < 20) return { error: 'Cuéntenos un poco más (mínimo 20 caracteres).' };
    const st = cfg(); let text = text0.slice(0, 2000); let tt = title.slice(0, 120);
    let sc = scan(tt + ' ' + text);
    if (sc.pii && st.personalData === 'enmascarar') { text = mask(text); tt = mask(tt); sc = scan(tt + ' ' + text); }
    const subs = {}; (st.activeSubs || []).forEach(k => { const v = parseInt((d.subratings || {})[k], 10); if (v >= 1 && v <= 5) subs[k] = v; });
    const c = Q.client(r.clientId) || {};
    const pax = (r.passengers || []).find(x => x.name === who.name);
    const ts = nowStr();
    const rv = { id: nextId(all(), 'RVO-', 4), resId: r.id, productId: p.id, clientId: r.clientId, author: authorOf(who.name), authorName: who.name, country: c.country || (pax && pax.nationality) || '', travelDate: it.date || r.travelTo, stars, subratings: subs, title: tt, text, photos: (d.photos || []).slice(0, 5), lang: d.lang || 'es', verified: true, consent: !!d.consent, status: 'pendiente', moderationReason: '', reply: null, helpful: 0, createdAt: ts, publishedAt: null, source: source || 'portal', isDemo: false, log: [] };
    const auto = (prm('moderation', p) === false || st.autoPublish) && stars >= (+prm('minStarsAutoPublish', p) || 5);
    if (!rv.consent) { rv.status = 'oculta'; rv.moderationReason = 'Sin consentimiento de publicación: solo uso interno'; }
    else if (sc.reasons.length) { rv.moderationReason = 'Revisión requerida: ' + sc.reasons.join('; '); }
    else if (auto) { rv.status = 'publicada'; rv.publishedAt = ts; }
    rv.log.push({ ts, u: who.name, m: 'Enviada (' + (SRC[rv.source] || rv.source) + ')' + (rv.status === 'publicada' ? ' · autopublicada (≥ ' + prm('minStarsAutoPublish', p) + ' estrellas, sin alertas)' : rv.status === 'oculta' ? ' · sin consentimiento' : ' · a moderación') });
    if (!DB.ownReviews) DB.ownReviews = [];
    DB.ownReviews.unshift(rv);
    const rq = (DB.ownReviewRequests || []).find(x => x.resId === r.id && x.status !== 'cancelada');
    if (rq) { rq.reviewIds = (rq.reviewIds || []).concat(rv.id); rq.status = 'respondida'; }
    Audit.log('Reseña propia', rv.id, 'crear', '', rv.stars + '★ · ' + p.id + ' · ' + rv.status + ' · ' + r.id);
    Notify.push('resena.nueva', 'Portal', 'U01', 'Nueva reseña ' + rv.stars + '★ de ' + rv.author + ' (' + p.name + ')' + (rv.status === 'pendiente' ? ' — pendiente de moderación' : ''));
    if (r.owner && r.owner !== 'U01') Notify.push('resena.nueva', 'Portal', r.owner, 'Su cliente ' + rv.author + ' calificó ' + p.name + ' con ' + rv.stars + '★');
    Store.save();
    return { rv };
  }

  /* ---------------- Datos estructurados schema.org para la ficha ---------------- */
  function ld(pid) {
    if (!ruleOn(Q.product(pid)) || !cfg().showOnSite) return null;
    const list = all().filter(r => r.status === 'publicada' && r.productId === pid); if (!list.length) return null;
    const s = stats(pid, list);
    return { aggregateRating: { '@type': 'AggregateRating', ratingValue: +s.avg.toFixed(1), reviewCount: s.count, bestRating: 5, worstRating: 1 },
      review: list.slice(0, 5).map(r => ({ '@type': 'Review', author: { '@type': 'Person', name: r.author }, datePublished: String(r.publishedAt || r.createdAt).slice(0, 10), name: r.title, reviewBody: r.text, inLanguage: r.lang, reviewRating: { '@type': 'Rating', ratingValue: r.stars, bestRating: 5 } })) };
  }

  /* API pública del módulo para portal, app y sitio */
  window.OwnReviews = {
    RULE, SUBS, SUBS_EN, LANGS, SRC,
    enabled: (p) => ruleOn(p), planOk, ruleOn, settings: cfg, subLabel: subLbl,
    activeSubs: () => SUBS.filter(s => (cfg().activeSubs || []).includes(s[0])),
    visibleOnSite: (p) => ruleOn(p) && cfg().showOnSite !== false,
    published: (pid) => all().filter(r => r.status === 'publicada' && (!pid || r.productId === pid)).sort((a, b) => String(b.publishedAt || b.createdAt).localeCompare(String(a.publishedAt || a.createdAt))),
    stats, eligibility, submit, ld, authorOf,
    forRes: (resId) => all().filter(r => r.resId === resId),
    statusBadge: stBadge, statusLabel: (s) => (ST[s] || [s, s])[1]
  };

  /* ---------------- Estilos del módulo ---------------- */
  (function css() {
    if (document.getElementById('css-resenas')) return;
    const s = document.createElement('style'); s.id = 'css-resenas';
    s.textContent = [
      '.rvo-stars{color:var(--sun);letter-spacing:1px;white-space:nowrap}.rvo-stars .off{color:var(--line)}',
      '.rvo-demo{display:inline-flex;align-items:center;gap:4px;font-size:.68rem;font-weight:700;color:var(--warn);background:var(--warn-soft);border-radius:5px;padding:1px 6px;white-space:nowrap}',
      '.rvo-ver{display:inline-flex;align-items:center;gap:4px;font-size:.7rem;font-weight:700;color:var(--ok);background:var(--ok-soft);border-radius:5px;padding:1px 6px;white-space:nowrap}.rvo-ver svg{width:12px;height:12px}',
      '.rvo-item{border:1px solid var(--line);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:8px;background:var(--surface);min-width:0}',
      '.rvo-item .txt{font-size:.88rem;line-height:1.5;overflow-wrap:anywhere}.rvo-item .meta{font-size:.74rem;color:var(--fg-3)}',
      '.rvo-reply{border-left:3px solid var(--accent);background:var(--surface-2);padding:8px 10px;border-radius:0 8px 8px 0;font-size:.84rem}',
      '.rvo-flag{font-size:.78rem;color:var(--warn);display:flex;gap:6px;align-items:flex-start}.rvo-flag svg{width:14px;height:14px;flex:none;margin-top:2px}',
      '.rvo-subs{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:.76rem;color:var(--fg-2)}',
      '.rvo-big{font-size:2.2rem;font-weight:700;line-height:1}',
      '.rvo-rate{display:flex;gap:4px;flex-wrap:wrap}.rvo-rate button{border:1px solid var(--line);background:var(--surface);border-radius:7px;min-width:36px;height:32px;cursor:pointer;color:var(--fg-2);font-size:.9rem}.rvo-rate button.on{border-color:var(--sun);background:var(--sun-soft);color:var(--sun-2)}',
      '.rvo-subgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}',
      '.rvo-actions{display:flex;flex-wrap:wrap;gap:6px}'
    ].join('\n');
    document.head.appendChild(s);
  })();
  const stars = (n) => { n = Math.round(n || 0); return '<span class="rvo-stars" title="' + n + ' de 5">' + '★★★★★'.slice(0, n) + '<span class="off">' + '★★★★★'.slice(0, 5 - n) + '</span></span>'; };
  window.OwnReviews.stars = stars;

  /* ================= Back-office: canales/resenas-propias ================= */
  const RS = { tab: 'resumen' };
  const canModerate = () => Auth.can('channels.ecommerce.manage') && !Scope.ownOnly();
  const canRuleParams = () => Auth.can('admin.settings.manage');
  const dis = (ok, perm) => ok ? '' : ' disabled title="Requiere permiso ' + perm + '"';
  const guard = () => { if (!canModerate()) { UI.toast(Scope.ownOnly() ? 'El rol Ventas consulta las reseñas de su cartera pero no las modera.' : 'Requiere permiso channels.ecommerce.manage.', 'bad'); return false; } return true; };
  function visible() {
    const rows = all();
    if (!Scope.ownOnly()) return rows;
    const ids = Scope.clientIds(); const me = Auth.user.id;
    return rows.filter(r => { const res = Q.reservation(r.resId); return (res && res.owner === me) || (ids && ids.has(r.clientId)); });
  }
  const resLink = (id) => Q.reservation(id) && Access.canRoute('reservas/' + id) ? '<a href="#/reservas/' + esc(id) + '" class="mono">' + esc(id) + '</a>' : '<span class="mono">' + esc(id) + '</span>' + (Q.reservation(id) ? '' : ' <span class="xs faint">(histórica)</span>');
  const log = (rv, m) => { rv.log = rv.log || []; rv.log.push({ ts: nowStr(), u: Auth.user.id, m }); };

  App.register('canales/resenas-propias', (el, params) => {
    const rl = rule();
    const actions = (Access.canRoute('admin/reglas') ? '<a class="btn" href="#/admin/reglas">' + ic('shield') + 'Regla ' + RULE + '</a>' : '') + (Access.canRoute('canales/resenas') ? '<a class="btn" href="#/canales/resenas">' + ic('star') + 'Reseñas externas</a>' : '') +
      '<button class="btn primary" id="rvo-export"' + dis(canModerate(), 'channels.ecommerce.manage') + '>' + ic('upload') + 'Exportar al widget / sitio</button>';
    const head = UI.pageHeader({ title: 'Reseñas de clientes', crumbs: [['Canales'], ['Reseñas de clientes']], subtitle: 'Módulo propio de reseñas verificadas: solo pueden opinar pasajeros con reserva realizada. Moderación, respuestas públicas, invitaciones postviaje y publicación en el sitio y el widget con sello «Viaje verificado».', actions: rl && ruleOn() ? actions : (Access.canRoute('admin/reglas') ? '<a class="btn primary" href="#/admin/reglas">' + ic('shield') + 'Ir a Reglas de reserva</a>' : '') });
    if (!rl || !planOk() || !ruleOn()) {
      const why = !rl ? 'La regla ' + RULE + ' no existe en el centro de reglas.' : !planOk() ? 'Su plan actual (' + esc(BEX().tenantPlan()) + ') no incluye «' + esc(rl.name) + '». Requiere plan ' + esc(rl.minPlan) + ' o superior.' : 'La regla <b>' + RULE + ' · ' + esc(rl.name) + '</b> está desactivada para esta agencia.';
      el.innerHTML = '<div class="page">' + head + UI.alert('info', why + ' Mientras esté inactiva no se solicitan reseñas, el portal del pasajero no muestra «Califica tu viaje» y el sitio no publica calificaciones propias. Los datos existentes se conservan.') + '</div>';
      return;
    }
    const rows = visible(); const pub = rows.filter(r => r.status === 'publicada'); const s = stats(null, pub);
    const pend = rows.filter(r => r.status === 'pendiente');
    el.innerHTML = '<div class="page">' + head +
      UI.alert('warn', '<b>Demo — editable.</b> Las reseñas marcadas «ejemplo (demo)», las solicitudes y los ajustes de moderación son datos de prueba; se reemplazarán por los valores y reseñas reales de la agencia al pasar a producción.') +
      (Scope.ownOnly() ? UI.alert('info', 'Vista de <b>' + Scope.label() + '</b>: solo ve reseñas de sus clientes y reservas. La moderación y las respuestas públicas las realiza gerencia o e-commerce.') : '') +
      '<div class="grid g4" style="margin-top:14px">' +
      UI.kpi({ label: 'Calificación promedio', value: s.count ? fmtN(s.avg, 2) + ' / 5' : '—', sub: stars(s.avg), icon: 'star', tone: 'sun' }) +
      UI.kpi({ label: 'Reseñas publicadas', value: fmtN(s.count, 0), sub: rows.length + ' recibidas en total', icon: 'award' }) +
      UI.kpi({ label: '% recomendación', value: s.count ? fmtN(s.rec, 0) + ' %' : '—', sub: '4 o 5 estrellas', icon: 'heart', tone: 'ok' }) +
      UI.kpi({ label: 'Pendientes de moderar', value: pend.length, sub: pend.filter(r => r.moderationReason).length + ' con alertas', icon: 'clock', tone: pend.length ? 'warn' : 'accent' }) + '</div>' +
      '<div id="rvo-tabs" style="margin-top:16px"></div></div>';
    const reqs = (DB.ownReviewRequests || []).filter(q => !Scope.ownOnly() || rows.some(r => r.resId === q.resId) || (Q.reservation(q.resId) || {}).owner === Auth.user.id);
    UI.tabs(el.querySelector('#rvo-tabs'), [
      { id: 'resumen', label: 'Resumen', render: (b) => tabSummary(b, rows) },
      { id: 'moderacion', label: 'Bandeja de moderación', count: pend.length, render: (b) => tabModeration(b, pend) },
      { id: 'todas', label: 'Todas las reseñas', count: rows.length, render: (b) => tabAll(b, rows) },
      { id: 'solicitudes', label: 'Solicitudes enviadas', count: reqs.length, render: (b) => tabRequests(b, reqs) },
      { id: 'ajustes', label: 'Reglas y ajustes', render: tabSettings }
    ], RS.tab, { onChange: (id) => { RS.tab = id; } });
    el.querySelector('#rvo-export').onclick = exportModal;
    if (params[0]) { const rv = rows.find(r => r.id === params[0]); if (rv) detail(rv); else if (all().some(r => r.id === params[0])) UI.toast('La reseña ' + esc(params[0]) + ' pertenece a la cartera de otro asesor.', 'bad'); }
  });

  function tabSummary(b, rows) {
    const pub = rows.filter(r => r.status === 'publicada'); const s = stats(null, pub);
    const byProd = [...new Set(pub.map(r => r.productId))].map(pid => { const x = stats(pid, pub.filter(r => r.productId === pid)); return { label: Q.productName(pid), value: x.avg, display: fmtN(x.avg, 2) + ' · ' + x.count + ' reseña' + (x.count === 1 ? '' : 's') }; }).sort((a, c) => c.value - a.value);
    const subs = SUBS.filter(([k]) => s.subs[k]).map(([k, l]) => ({ label: l, value: s.subs[k].avg, display: fmtN(s.subs[k].avg, 2) + ' (' + s.subs[k].n + ')', color: 'var(--info)' }));
    b.innerHTML = '<div class="grid g2" style="align-items:start">' +
      UI.card('Distribución de estrellas', s.count ? '<div class="row" style="gap:18px;align-items:center;margin-bottom:6px"><div><div class="rvo-big">' + fmtN(s.avg, 1) + '</div>' + stars(s.avg) + '<div class="xs faint">' + s.count + ' publicadas</div></div><div class="grow" style="min-width:240px">' + UI.chart.bars({ labels: ['1 ★', '2 ★', '3 ★', '4 ★', '5 ★'], series: [{ name: 'Reseñas publicadas', values: s.dist, color: 'var(--sun)' }], height: 170 }) + '</div></div>' : UI.empty('Aún no hay reseñas publicadas', 'star'), { sub: 'Solo reseñas publicadas (visibles en sitio y widget)' }) +
      UI.card('Promedio por producto', byProd.length ? UI.chart.hbars({ items: byProd, color: 'var(--sun)' }) : UI.empty('Sin datos', 'box'), { sub: 'Se muestra en la ficha y tarjeta del sitio con sello «Viaje verificado»' }) +
      UI.card('Promedio por subcalificación', subs.length ? UI.chart.hbars({ items: subs }) : UI.empty('Sin subcalificaciones', 'layers'), { sub: 'Subcalificaciones opcionales activas en Ajustes' }) +
      UI.card('Últimas publicadas', pub.length ? '<div class="stack" style="gap:10px">' + pub.slice().sort((a, c) => String(c.publishedAt).localeCompare(String(a.publishedAt))).slice(0, 3).map(rv => item(rv, { compact: true })).join('') + '</div>' : UI.empty('Sin reseñas publicadas', 'award')) +
      '</div>';
    bindItems(b);
  }

  function item(rv, o) {
    o = o || {};
    const subs = Object.entries(rv.subratings || {}).filter(([, v]) => v);
    const acts = !o.actions ? '' : '<div class="rvo-actions">' +
      (rv.status !== 'publicada' ? '<button class="btn sm primary" data-rvp="' + rv.id + '"' + dis(canModerate(), 'channels.ecommerce.manage') + '>' + ic('check') + 'Publicar</button>' : '') +
      (rv.status !== 'rechazada' ? '<button class="btn sm danger" data-rvr="' + rv.id + '"' + dis(canModerate(), 'channels.ecommerce.manage') + '>' + ic('x') + 'Rechazar</button>' : '') +
      (rv.status !== 'oculta' ? '<button class="btn sm" data-rvh="' + rv.id + '"' + dis(canModerate(), 'channels.ecommerce.manage') + '>' + ic('eye') + 'Ocultar</button>' : '') +
      '<button class="btn sm" data-rvy="' + rv.id + '"' + dis(canModerate(), 'channels.ecommerce.manage') + '>' + ic('msg') + (rv.reply ? 'Editar respuesta' : 'Responder') + '</button>' +
      '<button class="btn sm ghost" data-rvd="' + rv.id + '">' + ic('info') + 'Detalle</button></div>';
    return '<div class="rvo-item"><div class="row between" style="gap:8px"><div class="row" style="gap:8px">' + stars(rv.stars) + '<b class="small">' + esc(rv.title) + '</b></div><div class="row" style="gap:6px">' + (rv.verified ? '<span class="rvo-ver">' + ic('shield') + 'Viaje verificado</span>' : '') + (rv.isDemo ? DEMO_TAG : '') + stBadge(rv.status) + '</div></div>' +
      '<div class="txt">' + esc(o.compact && rv.text.length > 180 ? rv.text.slice(0, 180) + '…' : rv.text) + '</div>' +
      (subs.length && !o.compact ? '<div class="rvo-subs">' + subs.map(([k, v]) => '<span>' + esc(subLbl(k)) + ': <b>' + v + '/5</b></span>').join('') + '</div>' : '') +
      ((rv.photos || []).length && !o.compact ? '<div class="xs faint">' + ic('image').replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-2px"') + ' ' + rv.photos.map(esc).join(', ') + ' (simulado)</div>' : '') +
      (rv.moderationReason ? '<div class="rvo-flag">' + ic('alert') + '<span>' + esc(rv.moderationReason) + '</span></div>' : '') +
      (rv.reply ? '<div class="rvo-reply"><b class="xs">Respuesta de la agencia</b> <span class="xs faint">· ' + esc(Q.userName(rv.reply.by)) + ' · ' + datetime(rv.reply.at) + '</span><div>' + esc(rv.reply.text) + '</div></div>' : '') +
      '<div class="meta"><b>' + esc(rv.author) + '</b>' + (rv.country ? ' · ' + esc(rv.country) : '') + ' · ' + esc(Q.productName(rv.productId)) + ' · viaje ' + date(rv.travelDate) + ' · ' + esc(langLbl(rv.lang)) + ' · ' + esc(SRC[rv.source] || rv.source) + ' · <span class="mono">' + esc(rv.id) + '</span></div>' + acts + '</div>';
  }
  function bindItems(b) {
    const f = (id) => all().find(r => r.id === id);
    b.querySelectorAll('[data-rvp]').forEach(x => x.onclick = () => publish(f(x.dataset.rvp)));
    b.querySelectorAll('[data-rvr]').forEach(x => x.onclick = () => reject(f(x.dataset.rvr)));
    b.querySelectorAll('[data-rvh]').forEach(x => x.onclick = () => hide(f(x.dataset.rvh)));
    b.querySelectorAll('[data-rvy]').forEach(x => x.onclick = () => reply(f(x.dataset.rvy)));
    b.querySelectorAll('[data-rvd]').forEach(x => x.onclick = () => detail(f(x.dataset.rvd)));
  }

  function tabModeration(b, pend) {
    const p = rule().params || {};
    b.innerHTML = UI.alert('info', 'Política vigente: ' + (p.moderation === false ? 'moderación <b>desactivada</b> — se autopublican las reseñas de ' + p.minStarsAutoPublish + ' o más estrellas sin alertas.' : 'moderación <b>activa</b>' + (cfg().autoPublish ? ' con autopublicación de ' + p.minStarsAutoPublish + ' o más estrellas sin alertas.' : ': toda reseña pasa por esta bandeja antes de publicarse.')) + ' Palabras prohibidas y datos personales siempre retienen la reseña. No se filtra por nota (sin «review gating»): una reseña negativa legítima debe publicarse y responderse.') +
      (pend.length ? '<div class="stack" style="gap:12px;margin-top:14px">' + pend.sort((a, c) => String(a.createdAt).localeCompare(String(c.createdAt))).map(rv => item(rv, { actions: true })).join('') + '</div>' : '<div style="margin-top:14px">' + UI.card('', UI.empty('No hay reseñas pendientes de moderación.', 'checkCircle')) + '</div>');
    bindItems(b);
  }

  function tabAll(b, rows) {
    const prods = [...new Set(rows.map(r => r.productId))].map(id => [id, Q.productName(id)]);
    UI.dataTable(b, {
      exportName: 'resenas_propias', rows: () => visible(), defaultSort: 'createdAt', defaultDir: -1, searchPlaceholder: 'Buscar autor, título, texto, reserva…',
      search: (r) => [r.id, r.author, r.title, r.text, r.resId, Q.productName(r.productId), r.country].join(' '),
      filters: [{ key: 'status', label: 'Estado', options: Object.keys(ST).map(k => [k, ST[k][1]]) }, { key: 'stars', label: 'Estrellas', options: [5, 4, 3, 2, 1].map(n => [String(n), n + ' ★']), match: (r, v) => String(r.stars) === v }, { key: 'productId', label: 'Producto', options: prods }],
      columns: [
        { key: 'createdAt', label: 'Recibida', render: r => '<span class="nowrap small">' + datetime(r.createdAt) + '</span>' },
        { key: 'author', label: 'Autor', render: r => '<div class="cell-main">' + esc(r.author) + '</div><div class="xs faint">' + esc(r.country || '') + (r.isDemo ? ' ' + DEMO_TAG : '') + '</div>' },
        { key: 'productId', label: 'Producto / reserva', render: r => '<div class="small">' + esc(Q.productName(r.productId)) + '</div><div class="xs">' + resLink(r.resId) + '</div>', csv: r => Q.productName(r.productId) + ' / ' + r.resId },
        { key: 'stars', label: 'Nota', render: r => stars(r.stars), csv: r => r.stars },
        { key: 'title', label: 'Título', render: r => '<span class="small">' + esc(r.title) + '</span>' },
        { key: 'status', label: 'Estado', render: r => stBadge(r.status) + (r.moderationReason && r.status === 'pendiente' ? ' <span title="' + esc(r.moderationReason) + '" style="color:var(--warn)">' + ic('alert').replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-3px"') + '</span>' : '') },
        { key: 'reply', label: 'Respuesta', render: r => r.reply ? UI.badge('ok', 'Respondida') : '<span class="xs faint">—</span>', sortVal: r => r.reply ? 1 : 0, csv: r => r.reply ? r.reply.text : '' },
        { key: 'source', label: 'Origen', render: r => '<span class="xs">' + esc(SRC[r.source] || r.source) + '</span>' }
      ],
      onRow: (r) => detail(r)
    });
  }

  function detail(rv) {
    if (!rv) return;
    const hist = (rv.log || []).slice().reverse().map(l => ({ title: esc(l.m), meta: datetime(l.ts) + ' · ' + esc(Q.user(l.u) ? Q.userName(l.u) : l.u), icon: 'history' }));
    UI.drawer({ title: 'Reseña ' + esc(rv.id), wide: true, sub: esc(Q.productName(rv.productId)) + ' · ' + esc(rv.author),
      body: item(rv, {}) + '<div style="height:12px"></div>' + UI.dl([['Reserva', resLink(rv.resId)], ['Cliente', esc(Q.clientName(rv.clientId))], ['Fecha del viaje', date(rv.travelDate)], ['Recibida', datetime(rv.createdAt)], ['Publicada', rv.publishedAt ? datetime(rv.publishedAt) : '—'], ['Idioma', esc(langLbl(rv.lang))], ['Origen', esc(SRC[rv.source] || rv.source)], ['Consentimiento de publicación', rv.consent === false ? UI.badge('rechazado', 'No otorgado') : UI.badge('ok', 'Otorgado')], ['Votos «útil»', rv.helpful || 0], ['Estado', stBadge(rv.status)]]) +
        '<div class="upper" style="margin:16px 0 8px">Historial de moderación</div>' + UI.timeline(hist) +
        (!canModerate() ? '<div style="margin-top:12px">' + UI.alert('info', Scope.ownOnly() ? 'Con el rol Ventas puede consultar la reseña; la moderación y la respuesta pública las realiza gerencia o e-commerce.' : 'Requiere permiso channels.ecommerce.manage para moderar.') + '</div>' : ''),
      actions: canModerate() ? [rv.status !== 'publicada' ? { label: 'Publicar', cls: 'primary', icon: 'check', onClick: () => publish(rv) } : null, rv.status !== 'rechazada' ? { label: 'Rechazar', cls: 'danger', icon: 'x', onClick: () => reject(rv) } : null, rv.status !== 'oculta' ? { label: 'Ocultar', icon: 'eye', onClick: () => hide(rv) } : null, { label: rv.reply ? 'Editar respuesta' : 'Responder', icon: 'msg', onClick: () => reply(rv) }].filter(Boolean) : [{ label: 'Cerrar' }] });
  }

  function publish(rv) {
    if (!rv || !guard()) return;
    if (rv.consent === false) { UI.toast('No se puede publicar: el pasajero no otorgó consentimiento de publicación (R-OWN-REVIEWS).', 'bad'); return; }
    const sc = scan(rv.title + ' ' + rv.text);
    const go = () => { const bf = rv.status; rv.status = 'publicada'; rv.publishedAt = nowStr(); rv.moderationReason = ''; log(rv, 'Publicada'); Audit.log('Reseña propia', rv.id, 'publicar', bf, 'publicada'); Store.save(); UI.toast('Reseña publicada en el sitio y el widget.'); App.render(); };
    if (sc.reasons.length) UI.confirm({ title: 'Publicar con alertas', message: 'La reseña contiene ' + esc(sc.reasons.join('; ')) + '. ¿Confirma que revisó el contenido y desea publicarla igualmente?', confirmLabel: 'Publicar', onConfirm: go });
    else go();
  }
  function reject(rv) {
    if (!rv || !guard()) return;
    UI.confirm({ title: 'Rechazar reseña ' + esc(rv.id), danger: true, confirmLabel: 'Rechazar', reason: true, reasonLabel: 'Motivo (se registra y no se publica)', message: 'Rechace solo por incumplir la política (lenguaje ofensivo, publicidad, datos personales, contenido ajeno al servicio). Una opinión negativa legítima no es motivo de rechazo.',
      onConfirm: (why) => { const bf = rv.status; rv.status = 'rechazada'; rv.moderationReason = why; log(rv, 'Rechazada: ' + why); Audit.log('Reseña propia', rv.id, 'rechazar', bf, 'rechazada · ' + why); Store.save(); UI.toast('Reseña rechazada.'); App.render(); } });
  }
  function hide(rv) {
    if (!rv || !guard()) return;
    UI.confirm({ title: 'Ocultar reseña ' + esc(rv.id), confirmLabel: 'Ocultar', reason: true, reasonLabel: 'Motivo', message: 'La reseña deja de mostrarse en el sitio y el widget, pero se conserva para reportes y auditoría.',
      onConfirm: (why) => { const bf = rv.status; rv.status = 'oculta'; rv.moderationReason = why; log(rv, 'Oculta: ' + why); Audit.log('Reseña propia', rv.id, 'ocultar', bf, 'oculta · ' + why); Store.save(); UI.toast('Reseña oculta.'); App.render(); } });
  }
  function reply(rv) {
    if (!rv || !guard()) return;
    UI.modal({ title: (rv.reply ? 'Editar respuesta' : 'Responder públicamente') + ' · ' + esc(rv.id), sub: esc(rv.author) + ' · ' + rv.stars + ' ★ · ' + esc(Q.productName(rv.productId)),
      body: '<div class="rvo-item" style="margin-bottom:12px"><b class="small">' + esc(rv.title) + '</b><div class="txt">' + esc(rv.text) + '</div></div>' + UI.form([{ id: 'rv-rep', label: 'Respuesta pública de la agencia', type: 'textarea', rows: 5, required: true, col: 12, value: rv.reply ? rv.reply.text : '', hint: 'Se publica bajo la reseña en el sitio y el widget, y se envía al pasajero. No incluya datos personales ni condiciones comerciales.' }]),
      actions: [{ label: 'Cancelar' }, { label: 'Publicar respuesta', cls: 'primary', icon: 'send', onClick: (m) => {
        if (!UI.validate(m)) return false; const txt = UI.formData(m)['rv-rep'];
        const sc = scan(txt); if (sc.pii) { UI.toast('La respuesta contiene datos personales; retírelos antes de publicar.', 'bad'); return false; }
        const bf = rv.reply ? rv.reply.text : ''; rv.reply = { text: txt.slice(0, 1500), by: Auth.user.id, at: nowStr() }; log(rv, bf ? 'Respuesta editada' : 'Respuesta publicada');
        Audit.log('Reseña propia', rv.id, bf ? 'editar_respuesta' : 'responder', bf.slice(0, 60), txt.slice(0, 60));
        const res = Q.reservation(rv.resId); const c = Q.client(rv.clientId) || {};
        Notify.push('resena.respuesta', 'Email', c.email || rv.author, 'Respuesta de la agencia a su reseña «' + rv.title + '»');
        if (res && Array.isArray(DB.paxMessages)) DB.paxMessages.unshift({ id: nextId(DB.paxMessages, 'PM-', 5), resId: res.id, templateId: null, channel: 'portal', to: rv.authorName || rv.author, subject: 'Respuesta a su reseña «' + rv.title + '»', body: txt, status: 'enviado', scheduledAt: nowStr(), sentAt: nowStr(), readAt: null, direction: 'saliente', reviewId: rv.id });
        Store.save(); UI.toast('Respuesta publicada y enviada al pasajero.'); App.render();
      } }] });
  }

  /* ---- Solicitudes de reseña (invitación N días después del viaje: daysAfter) ---- */
  function tabRequests(b, reqs) {
    const days = +prm('daysAfter') || 1; const inv = cfg().invite || {};
    const elig = (DB.reservations || []).filter(r => ['completada', 'en_operacion', 'confirmada'].includes(r.status) && r.travelTo && !(DB.ownReviewRequests || []).some(q => q.resId === r.id) && ruleOn(((r.services || []).map(s => Q.product(s.productId)).find(Boolean)) || null) && (!Scope.ownOnly() || r.owner === Auth.user.id));
    b.innerHTML = UI.alert('info', 'Se programa una invitación <b>' + days + ' día(s)</b> después de la fecha de fin del viaje (parámetro <span class="mono">daysAfter</span> de ' + RULE + ') por ' + esc(inv.channel === 'whatsapp' ? 'WhatsApp' : 'correo') + ', con recordatorio a los ' + (inv.reminderDays || 5) + ' días y vencimiento a los ' + (inv.expireDays || 30) + ' días. Se invita a todos los pasajeros elegibles, sin filtrar por satisfacción ni ofrecer incentivos.') +
      '<div class="row between" style="margin:12px 0"><span class="small muted">' + elig.length + ' reserva(s) confirmada(s) o en curso sin invitación programada.</span><span class="row" style="gap:6px"><button class="btn sm" id="rq-prev">' + ic('eye') + 'Vista previa de la invitación</button><button class="btn sm primary" id="rq-gen"' + dis(canModerate() && elig.length > 0, 'channels.ecommerce.manage') + '>' + ic('calendar') + 'Programar invitaciones pendientes</button></span></div><div id="rq-tbl"></div>';
    UI.dataTable(b.querySelector('#rq-tbl'), {
      exportName: 'solicitudes_resena', rows: reqs, defaultSort: 'scheduledAt', defaultDir: -1, search: (q) => [q.id, q.resId, q.to, Q.clientName(q.clientId)].join(' '),
      filters: [{ key: 'status', label: 'Estado', options: Object.keys(RQ_ST).map(k => [k, RQ_ST[k][1]]) }],
      columns: [
        { key: 'id', label: 'Solicitud', render: q => '<span class="mono small">' + esc(q.id) + '</span>' + (q.isDemo ? ' ' + DEMO_TAG : '') },
        { key: 'resId', label: 'Reserva / cliente', render: q => '<div class="xs">' + resLink(q.resId) + '</div><div class="small">' + esc(Q.clientName(q.clientId)) + '</div>' },
        { key: 'to', label: 'Destinatario', render: q => '<span class="small">' + esc(q.to) + '</span><div class="xs faint">' + esc(q.channel === 'whatsapp' ? 'WhatsApp' : 'Correo') + ' · ' + esc(langLbl(q.lang)) + '</div>' },
        { key: 'scheduledAt', label: 'Programada', render: q => '<span class="small nowrap">' + datetime(q.scheduledAt) + '</span>' },
        { key: 'sentAt', label: 'Enviada / abierta', render: q => '<span class="xs">' + (q.sentAt ? datetime(q.sentAt) : '—') + (q.openedAt ? '<br>abierta ' + datetime(q.openedAt) : '') + '</span>' },
        { key: 'status', label: 'Estado', render: q => rqBadge(q.status) + ((q.reviewIds || []).length ? '<div class="xs faint">' + q.reviewIds.map(esc).join(', ') + '</div>' : '') },
        { key: '', label: '', sort: false, render: q => ['programada', 'vencida', 'enviada'].includes(q.status) ? '<button class="btn xs" data-rqs="' + q.id + '"' + dis(canModerate(), 'channels.ecommerce.manage') + '>' + ic('send') + (q.status === 'programada' ? 'Enviar ahora' : 'Reenviar') + '</button>' + (q.status === 'programada' ? ' <button class="btn xs ghost" data-rqc="' + q.id + '"' + dis(canModerate(), 'channels.ecommerce.manage') + '>Cancelar</button>' : '') : '' }
      ],
      afterDraw: (c) => {
        c.querySelectorAll('[data-rqs]').forEach(x => x.onclick = () => { if (!guard()) return; const q = DB.ownReviewRequests.find(y => y.id === x.dataset.rqs); const bf = q.status; q.status = 'enviada'; q.sentAt = nowStr(); Audit.log('Solicitud de reseña', q.id, bf === 'programada' ? 'enviar' : 'reenviar', bf, 'enviada'); Notify.push('resena.invitacion', q.channel === 'whatsapp' ? 'WhatsApp' : 'Email', q.to, fill(inv.subject, q)); Store.save(); UI.toast('Invitación enviada a ' + esc(q.to) + '.'); App.render(); });
        c.querySelectorAll('[data-rqc]').forEach(x => x.onclick = () => { if (!guard()) return; const q = DB.ownReviewRequests.find(y => y.id === x.dataset.rqc); q.status = 'cancelada'; Audit.log('Solicitud de reseña', q.id, 'cancelar', 'programada', 'cancelada'); Store.save(); UI.toast('Invitación cancelada.'); App.render(); });
      }
    });
    b.querySelector('#rq-prev').onclick = () => { const q = reqs[0] || { resId: 'RES-2026-000347', clientId: 'CLI-0003' }; UI.modal({ title: 'Vista previa de la invitación', sub: 'Plantilla editable en «Reglas y ajustes» · ' + DEMO_TAG, body: '<div class="small"><b>Asunto:</b> ' + esc(fill(inv.subject, q)) + '</div><div class="divider" style="margin:10px 0"></div><div class="small" style="white-space:pre-wrap;line-height:1.55">' + esc(fill(inv.body, q)) + '</div>', actions: [{ label: 'Cerrar', cls: 'primary' }] }); };
    const g = b.querySelector('#rq-gen'); g.onclick = () => {
      if (!guard()) return; let n = 0;
      elig.forEach(r => { const c = Q.client(r.clientId) || {}; const q = { id: nextId(DB.ownReviewRequests, 'SRV-', 4), resId: r.id, clientId: r.clientId, to: c.email || '', channel: inv.channel || 'email', lang: 'es', scheduledAt: addDays(r.travelTo, days) + ' 09:00', sentAt: null, openedAt: null, status: 'programada', reviewIds: [], isDemo: false }; DB.ownReviewRequests.unshift(q); Audit.log('Solicitud de reseña', q.id, 'programar', '', r.id + ' · ' + q.scheduledAt); n++; });
      Store.save(); UI.toast(n + ' invitación(es) programada(s).'); App.render();
    };
  }
  function fill(tpl, q) {
    const r = Q.reservation(q.resId); const c = Q.client(q.clientId) || {}; const s = r && (r.services || []).find(x => x.productId);
    const v = { pasajero: authorOf(c.name || 'viajero').split(' ')[0], reserva: q.resId, producto: s ? Q.productName(s.productId) : (r ? r.title : 'su viaje'), fecha: r ? date(r.travelTo) : '', enlace_resena: 'https://andeshorizonte.pe/resena/' + q.resId + '?t=•••' };
    return String(tpl || '').replace(/\{\{(\w+)\}\}/g, (m, k) => v[k] != null ? v[k] : m);
  }

  /* ---- Reglas de moderación y ajustes ---- */
  function tabSettings(b) {
    const st = cfg(); const p = rule().params || {}; const can = canModerate(); const canR = canRuleParams();
    b.innerHTML = UI.alert('warn', '<b>Demo — editable.</b> Palabras prohibidas, textos de invitación y subcalificaciones son valores de prueba; se reemplazarán por los definitivos de la agencia.') +
      '<div class="grid g2" style="align-items:start;margin-top:12px">' +
      UI.card('Regla ' + RULE + ' · parámetros', UI.form([
        { id: 'rs-mod', label: 'Moderación previa obligatoria (moderation)', type: 'switch', value: p.moderation !== false, col: 12, disabled: !canR, hint: 'Si se desactiva, se autopublican las reseñas con la nota mínima indicada y sin alertas.' },
        { id: 'rs-min', label: 'Autopublicar desde (minStarsAutoPublish)', type: 'select', options: [1, 2, 3, 4, 5].map(n => [n, n + ' estrella' + (n > 1 ? 's' : '') + ' o más']), value: p.minStarsAutoPublish || 4, col: 6, disabled: !canR },
        { id: 'rs-days', label: 'Invitar N días después del viaje (daysAfter)', type: 'number', min: 0, max: 30, value: p.daysAfter != null ? p.daysAfter : 1, col: 6, disabled: !canR }
      ]) + (!canR ? '<p class="xs faint" style="margin-top:8px">Los parámetros de la regla requieren permiso admin.settings.manage (Reglas de reserva).</p>' : ''), { sub: 'Centro de reglas · plan mínimo ' + esc(rule().minPlan || 'Starter') }) +
      UI.card('Reglas de moderación', UI.form([
        { id: 'rs-auto', label: 'Autopublicar con moderación activa (≥ nota mínima y sin alertas)', type: 'switch', value: !!st.autoPublish, col: 12, disabled: !can },
        { id: 'rs-words', label: 'Palabras prohibidas (separadas por coma)', type: 'textarea', rows: 2, value: (st.bannedWords || []).join(', '), col: 12, disabled: !can },
        { id: 'rs-pii', label: 'Datos personales (correo, teléfono, documento)', type: 'select', options: [['retener', 'Retener para moderación'], ['enmascarar', 'Enmascarar automáticamente']], value: st.personalData, col: 12, disabled: !can }
      ])) +
      UI.card('Subcalificaciones activas', '<div class="rvo-subgrid">' + SUBS.map(([k, l]) => '<label class="check"><input type="checkbox" data-sub="' + k + '"' + ((st.activeSubs || []).includes(k) ? ' checked' : '') + (can ? '' : ' disabled') + '> ' + esc(l) + '</label>').join('') + '</div><p class="xs faint" style="margin-top:8px">Son opcionales para el pasajero; la calificación general (1–5) es obligatoria.</p>') +
      UI.card('Publicación', UI.form([
        { id: 'rs-site', label: 'Mostrar en el sitio web (fichas, tarjetas, datos estructurados)', type: 'switch', value: st.showOnSite !== false, col: 12, disabled: !can },
        { id: 'rs-wid', label: 'Incluir en el feed del widget embebible', type: 'switch', value: st.showOnWidget !== false, col: 12, disabled: !can }
      ]) + '<p class="xs faint" style="margin-top:8px">Última exportación: ' + (st.lastExport ? datetime(st.lastExport.at) + ' · ' + st.lastExport.count + ' reseñas' : 'nunca') + '</p>') +
      '</div>' +
      UI.card('Texto de la invitación', UI.form([
        { id: 'rs-ch', label: 'Canal', type: 'select', options: [['email', 'Correo'], ['whatsapp', 'WhatsApp']], value: (st.invite || {}).channel, col: 4, disabled: !can },
        { id: 'rs-rem', label: 'Recordatorio (días)', type: 'number', min: 0, value: (st.invite || {}).reminderDays, col: 4, disabled: !can },
        { id: 'rs-exp', label: 'Vence a los (días)', type: 'number', min: 1, value: (st.invite || {}).expireDays, col: 4, disabled: !can },
        { id: 'rs-sub', label: 'Asunto', value: (st.invite || {}).subject, col: 12, required: true, disabled: !can },
        { id: 'rs-body', label: 'Cuerpo', type: 'textarea', rows: 7, value: (st.invite || {}).body, col: 12, required: true, disabled: !can, hint: 'Variables: {{pasajero}}, {{reserva}}, {{producto}}, {{fecha}}, {{enlace_resena}}' }
      ]), { footer: '<button class="btn primary" id="rs-save"' + dis(can, 'channels.ecommerce.manage') + '>' + ic('check') + 'Guardar ajustes</button>' });
    b.querySelector('#rs-save').onclick = () => {
      if (!guard()) return; if (!UI.validate(b)) return; const f = UI.formData(b);
      const bf = JSON.stringify({ p: rule().params, a: st.autoPublish, w: st.bannedWords, pii: st.personalData, subs: st.activeSubs });
      const subs = [...b.querySelectorAll('[data-sub]')].filter(x => x.checked).map(x => x.dataset.sub);
      Object.assign(st, { autoPublish: !!f['rs-auto'], bannedWords: String(f['rs-words'] || '').split(',').map(x => x.trim()).filter(Boolean), personalData: f['rs-pii'], activeSubs: subs, showOnSite: !!f['rs-site'], showOnWidget: !!f['rs-wid'] });
      st.invite = Object.assign({}, st.invite, { channel: f['rs-ch'], reminderDays: +f['rs-rem'] || 0, expireDays: +f['rs-exp'] || 30, subject: f['rs-sub'], body: f['rs-body'] });
      if (canR) { const r = rule(); const d = Math.max(0, Math.min(30, +f['rs-days'] || 0)); const bp = JSON.stringify(r.params); r.params = Object.assign({}, r.params, { moderation: !!f['rs-mod'], minStarsAutoPublish: +f['rs-min'] || 4, daysAfter: d }); if (bp !== JSON.stringify(r.params)) Audit.log('Regla de reserva', RULE, 'parametros', bp, JSON.stringify(r.params)); }
      Audit.log('Reseñas propias', 'ajustes', 'actualizar', bf.slice(0, 200), JSON.stringify({ p: rule().params, a: st.autoPublish, w: st.bannedWords, pii: st.personalData, subs: st.activeSubs }).slice(0, 200));
      Store.save(); UI.toast('Ajustes de reseñas guardados.'); App.render();
    };
  }

  /* ---- Exportación al widget / sitio (feed JSON + JSON-LD) ---- */
  function exportModal() {
    if (!guard()) return;
    const st = cfg(); const pub = all().filter(r => r.status === 'publicada' && ruleOn(Q.product(r.productId)));
    const pids = [...new Set(pub.map(r => r.productId))];
    const feed = { tenant: DB.tenant.id, generatedAt: nowStr(), source: 'own_reviews', demo: pub.some(r => r.isDemo), products: pids.map(pid => { const s = stats(pid, pub.filter(r => r.productId === pid)); return { productId: pid, name: Q.productName(pid), rating: +s.avg.toFixed(2), count: s.count, reviews: pub.filter(r => r.productId === pid).slice(0, 10).map(r => ({ id: r.id, author: r.author, country: r.country, stars: r.stars, title: r.title, text: r.text, lang: r.lang, travelDate: r.travelDate, verified: true, reply: r.reply ? r.reply.text : null, demo: !!r.isDemo })) }; }) };
    const ldx = pids[0] ? ld(pids[0]) : null;
    const snippet = '<div data-qhapaq-reviews data-tenant="' + DB.tenant.id + '" data-product="' + (pids[0] || 'PRD-001') + '" data-lang="es" data-min-stars="1"></div>\n<script src="https://widget.qhapaq.cloud/v1/reviews.js" async></script>';
    UI.modal({ title: 'Exportar reseñas al widget y al sitio', size: 'lg', sub: pub.length + ' reseñas publicadas · ' + pids.length + ' productos',
      body: (!st.showOnSite || !st.showOnWidget ? UI.alert('warn', 'Publicación desactivada en Ajustes para: ' + [!st.showOnSite ? 'sitio web' : '', !st.showOnWidget ? 'widget' : ''].filter(Boolean).join(' y ') + '.') : '') +
        UI.alert('info', 'En producción el sitio y el widget consumen <span class="mono">GET /api/v1/public/reviews?product=…</span> (caché 10 min, invalidada al publicar/ocultar). La exportación regenera el feed estático y los datos estructurados schema.org (AggregateRating/Review).') +
        '<div class="upper" style="margin:12px 0 6px">Código de inserción</div><textarea class="input mono" rows="3" readonly>' + esc(snippet) + '</textarea>' +
        '<div class="upper" style="margin:12px 0 6px">Feed JSON</div><textarea class="input mono" rows="9" readonly>' + esc(JSON.stringify(feed, null, 2)) + '</textarea>' +
        (ldx ? '<div class="upper" style="margin:12px 0 6px">JSON-LD de ' + esc(Q.productName(pids[0])) + '</div><textarea class="input mono" rows="7" readonly>' + esc(JSON.stringify(ldx, null, 2)) + '</textarea>' : ''),
      actions: [{ label: 'Cerrar' }, { label: 'Regenerar feed y publicar', cls: 'primary', icon: 'upload', onClick: () => { st.lastExport = { at: nowStr(), by: Auth.user.id, count: pub.length }; Audit.log('Reseñas propias', 'feed', 'exportar_widget', '', pub.length + ' reseñas · ' + pids.length + ' productos'); Store.save(); UI.toast('Feed de reseñas regenerado para el sitio y el widget.'); App.render(); } }] });
  }
})();
